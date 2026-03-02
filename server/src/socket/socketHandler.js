import { authenticateSocket } from '../middleware/auth.js';
import { riskEngine, contextEngine, alertService, simulationService } from '../services/index.js';
import User from '../models/User.js';
import LocationLog from '../models/LocationLog.js';
import FamilyConnection from '../models/FamilyConnection.js';
import { FAMILY_REQUEST_STATUS } from '../config/constants.js';

const connectedUsers = new Map();
const userSockets = new Map();

export const initializeSocket = (io) => {
  alertService.setSocketIO(io);

  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const userId = socket.userId.toString();
    const user = socket.user;

    console.log(`User connected: ${user.name} (${userId})`);

    connectedUsers.set(userId, {
      socketId: socket.id,
      user: user.toPublicJSON(),
      connectedAt: new Date(),
    });
    userSockets.set(socket.id, userId);

    socket.join(`user:${userId}`);

    if (user.role === 'admin') {
      socket.join('admin:alerts');
      socket.join('admin:dashboard');
    }

    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: new Date(),
    });

    await notifyFamilyPresence(io, userId, true);

    socket.on('location:update', async (data) => {
      try {
        const { latitude, longitude, speed, accuracy, heading, altitude } = data;

        const currentLocation = {
          latitude,
          longitude,
          speed: speed || 0,
          accuracy: accuracy || 0,
          heading: heading || 0,
          altitude: altitude || 0,
          timestamp: new Date(),
        };

        const previousLocations = await LocationLog.getRecentLogs(userId, 20);

        const riskResult = await riskEngine.calculateRiskScore(
          userId,
          currentLocation,
          previousLocations
        );

        const contextResult = await contextEngine.generateStatus(
          userId,
          currentLocation,
          previousLocations
        );

        const locationLog = await LocationLog.create({
          user: userId,
          ...currentLocation,
          isNightMode: riskResult.isNightMode,
          riskScore: riskResult.score,
          riskBreakdown: riskResult.breakdown,
          status: contextResult.status,
          contextualInfo: {
            nearbyTaggedLocation: contextResult.nearbyTaggedLocation,
            isMoving: contextResult.isMoving,
            isStationary: contextResult.isStationary,
            stationaryDuration: contextResult.stationaryDuration,
            travellingFrom: contextResult.travellingFrom,
            travellingTo: contextResult.travellingTo,
          },
          anomalies: riskResult.anomalies,
        });

        await User.findByIdAndUpdate(userId, {
          lastKnownLocation: {
            latitude,
            longitude,
            timestamp: currentLocation.timestamp,
            accuracy: currentLocation.accuracy,
          },
          currentRiskScore: riskResult.score,
          currentStatus: contextResult.status,
          isNightModeActive: riskResult.isNightMode,
        });

        socket.emit('location:processed', {
          location: locationLog,
          risk: {
            score: riskResult.score,
            breakdown: riskResult.breakdown,
            alertLevel: riskResult.alertLevel,
            anomalies: riskResult.anomalies,
            isNightMode: riskResult.isNightMode,
          },
          context: contextResult,
        });

        await broadcastToFamily(io, userId, 'family:location:update', {
          memberId: userId,
          memberName: user.name,
          location: {
            latitude,
            longitude,
            timestamp: currentLocation.timestamp,
          },
          riskScore: riskResult.score,
          status: contextResult.status,
          isNightMode: riskResult.isNightMode,
          alertLevel: riskResult.alertLevel,
        });

        if (riskResult.alertLevel === 'red') {
          const alert = await alertService.triggerShadowAlert(
            userId,
            riskResult,
            currentLocation
          );
          
          socket.emit('alert:triggered', {
            alertId: alert._id,
            severity: alert.severity,
            riskScore: riskResult.score,
          });
        }

        io.to('admin:dashboard').emit('user:update', {
          userId,
          name: user.name,
          location: { latitude, longitude },
          riskScore: riskResult.score,
          status: contextResult.status,
          isNightMode: riskResult.isNightMode,
        });

      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to process location update' });
      }
    });

    socket.on('simulation:tick', async () => {
      try {
        const location = simulationService.getNextLocation(userId);
        
        if (!location) {
          socket.emit('simulation:ended');
          return;
        }

        socket.emit('location:update', location);
      } catch (error) {
        socket.emit('error', { message: 'Simulation tick failed' });
      }
    });

    socket.on('sos:trigger', async (data) => {
      try {
        const { latitude, longitude, message } = data;

        const alert = await alertService.triggerSOSAlert(
          userId,
          { latitude, longitude },
          message
        );

        socket.emit('sos:confirmed', {
          alertId: alert._id,
          message: 'SOS alert sent to your family members',
        });

      } catch (error) {
        socket.emit('error', { message: 'Failed to trigger SOS' });
      }
    });

    socket.on('alert:acknowledge', async (data) => {
      try {
        const { alertId } = data;
        await alertService.acknowledgeAlert(alertId, userId);
        socket.emit('alert:acknowledged', { alertId });
      } catch (error) {
        socket.emit('error', { message: 'Failed to acknowledge alert' });
      }
    });

    socket.on('family:subscribe', async () => {
      const connections = await FamilyConnection.getAcceptedConnections(userId);
      
      for (const conn of connections) {
        const memberId = conn.requester._id.toString() === userId
          ? conn.recipient._id.toString()
          : conn.requester._id.toString();
        
        socket.join(`family:${memberId}`);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.name} (${userId})`);

      connectedUsers.delete(userId);
      userSockets.delete(socket.id);

      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      riskEngine.clearUserData(userId);
      contextEngine.clearUserData(userId);
      simulationService.stopSimulation(userId);

      await notifyFamilyPresence(io, userId, false);
    });
  });

  return io;
};

async function broadcastToFamily(io, userId, event, data) {
  const connections = await FamilyConnection.find({
    $or: [{ requester: userId }, { recipient: userId }],
    status: FAMILY_REQUEST_STATUS.ACCEPTED,
    canViewLocation: true,
  });

  for (const conn of connections) {
    const memberId = conn.requester.toString() === userId
      ? conn.recipient.toString()
      : conn.requester.toString();

    const memberSocket = connectedUsers.get(memberId);
    if (memberSocket) {
      io.to(memberSocket.socketId).emit(event, data);
    }
  }
}

async function notifyFamilyPresence(io, userId, isOnline) {
  const user = await User.findById(userId).select('name');
  
  await broadcastToFamily(io, userId, 'family:presence', {
    memberId: userId,
    memberName: user?.name,
    isOnline,
    timestamp: new Date(),
  });
}

export const getConnectedUsers = () => {
  return Array.from(connectedUsers.values());
};

export const getUserSocket = (userId) => {
  return connectedUsers.get(userId.toString());
};

export const isUserOnline = (userId) => {
  return connectedUsers.has(userId.toString());
};
