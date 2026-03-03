import { authenticateSocket } from '../middleware/auth.js';
import { riskEngine, contextEngine } from '../services/index.js';
import alertEngine from '../services/AlertEngine.js';
import dataProcessor from '../services/DataProcessor.js';
import User from '../models/User.js';
import LocationLog from '../models/LocationLog.js';
import FamilyConnection from '../models/FamilyConnection.js';
import { FAMILY_REQUEST_STATUS } from '../config/constants.js';

const connectedUsers = new Map();
const userSockets = new Map();

export const initializeSocket = (io) => {
  alertEngine.setSocketIO(io);
  dataProcessor.setSocketIO(io);

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
        // NEW: Use DataProcessor to orchestrate all location processing
        const result = await dataProcessor.processLocationUpdate(userId, data);

        if (!result.success) {
          socket.emit('error', {
            message: 'Failed to process location update',
            reason: result.reason,
          });
        }
      } catch (error) {
        console.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to process location update' });
      }
    });

    socket.on('sos:trigger', async (data) => {
      try {
        const { latitude, longitude, message } = data;

        const alert = await alertEngine.triggerSOS(
          userId,
          { latitude, longitude },
          message || ''
        );

        socket.emit('sos:confirmed', {
          alertId: alert._id,
          message: 'SOS alert sent to your family members',
        });

      } catch (error) {
        console.error('SOS trigger error:', error);
        socket.emit('error', { message: 'Failed to trigger SOS' });
      }
    });

    socket.on('alert:acknowledge', async (data) => {
      try {
        const { alertId } = data;
        await alertEngine.acknowledgeAlert(alertId, userId);
        socket.emit('alert:acknowledged', { alertId });
      } catch (error) {
        console.error('Alert acknowledge error:', error);
        socket.emit('error', { message: 'Failed to acknowledge alert' });
      }
    });

    socket.on('alert:resolve', async (data) => {
      try {
        const { alertId, resolution, notes } = data;
        await alertEngine.resolveAlert(alertId, userId, resolution || 'safe', notes || '');
        socket.emit('alert:resolved', { alertId });
      } catch (error) {
        console.error('Alert resolve error:', error);
        socket.emit('error', { message: 'Failed to resolve alert' });
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
