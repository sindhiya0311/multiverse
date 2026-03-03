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
const recentLocationUpdates = new Map(); // Deduplication: userId -> {key, time}
const locationUpdateCounts = new Map(); // Rate limit: userId -> {count, resetAt}
const LOCATION_UPDATE_RATE_LIMIT = 5; // max per second per user

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

    // Join personal room (consolidate multiple connections)
    socket.join(`user:${userId}`);

    // Track socket in per-user set to prevent duplicate broadcasts
    if (!connectedUsers.get(userId).sockets) {
      connectedUsers.get(userId).sockets = new Set();
    }
    connectedUsers.get(userId).sockets.add(socket.id);

    if (user.role === 'admin') {
      socket.join('admin:alerts');
      socket.join('admin:dashboard');
      console.log(`Admin connected: ${user.name}`);
    }

    await User.findByIdAndUpdate(userId, {
      isOnline: true,
      lastSeen: new Date(),
    });

    await notifyFamilyPresence(io, userId, true);

    socket.on('location:update', async (data) => {
      try {
        // Validate payload before processing
        const lat = parseFloat(data?.latitude);
        const lon = parseFloat(data?.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          socket.emit('error', { message: 'Invalid location data' });
          return;
        }

        // DEDUPLICATION: Check if this exact update was just processed
        const lastUpdate = recentLocationUpdates.get(userId);
        const ts = data?.timestamp ?? Date.now();
        const currentKey = `${lat.toFixed(6)}_${lon.toFixed(6)}_${ts}`;

        if (lastUpdate && lastUpdate.key === currentKey && Date.now() - lastUpdate.time < 1000) {
          return;
        }

        const now = Date.now();
        const limit = locationUpdateCounts.get(userId);
        if (limit) {
          if (now >= limit.resetAt) {
            locationUpdateCounts.set(userId, { count: 1, resetAt: now + 1000 });
          } else if (limit.count >= LOCATION_UPDATE_RATE_LIMIT) {
            return;
          } else {
            limit.count++;
          }
        } else {
          locationUpdateCounts.set(userId, { count: 1, resetAt: now + 1000 });
        }

        recentLocationUpdates.set(userId, { key: currentKey, time: now });

        const result = await dataProcessor.processLocationUpdate(userId, {
          ...data,
          latitude: lat,
          longitude: lon,
          timestamp: typeof ts === 'string' ? new Date(ts) : ts,
        });

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
        const lat = parseFloat(data?.latitude);
        const lon = parseFloat(data?.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          socket.emit('error', { message: 'Invalid location for SOS' });
          return;
        }
        const message = typeof data?.message === 'string' ? data.message.slice(0, 500) : '';

        const alert = await alertEngine.triggerSOS(
          userId,
          { latitude: lat, longitude: lon },
          message
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
        const alertId = data?.alertId;
        if (!alertId || typeof alertId !== 'string') {
          socket.emit('error', { message: 'Invalid alert ID' });
          return;
        }
        await alertEngine.acknowledgeAlert(alertId, userId);
        socket.emit('alert:acknowledged', { alertId });
      } catch (error) {
        console.error('Alert acknowledge error:', error);
        socket.emit('error', { message: 'Failed to acknowledge alert' });
      }
    });

    socket.on('alert:resolve', async (data) => {
      try {
        const alertId = data?.alertId;
        if (!alertId || typeof alertId !== 'string') {
          socket.emit('error', { message: 'Invalid alert ID' });
          return;
        }
        const resolution = data?.resolution ?? 'safe';
        const notes = typeof data?.notes === 'string' ? data.notes.slice(0, 500) : '';
        await alertEngine.resolveAlert(alertId, userId, resolution, notes);
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
      locationUpdateCounts.delete(userId);

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

    // Use room broadcast for multi-tab support
    io.to(`user:${memberId}`).emit(event, data);
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
