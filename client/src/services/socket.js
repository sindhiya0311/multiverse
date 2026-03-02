import { io } from 'socket.io-client';
import { useLocationStore } from '../store/locationStore';
import { useAlertStore } from '../store/alertStore';
import { useFamilyStore } from '../store/familyStore';
import toast from 'react-hot-toast';

let socket = null;

export const initializeSocket = (token) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io('/', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    socket.emit('family:subscribe');
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
  });

  socket.on('location:processed', (data) => {
    useLocationStore.getState().setRiskData(data.risk);
    useLocationStore.getState().setContextData(data.context);
  });

  socket.on('family:location:update', (data) => {
    useFamilyStore.getState().updateMemberLocation(data.memberId, {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      timestamp: data.location.timestamp,
      riskScore: data.riskScore,
      status: data.status,
      isNightMode: data.isNightMode,
    });
  });

  socket.on('family:presence', (data) => {
    useFamilyStore.getState().updateMemberPresence(data.memberId, data.isOnline);
    
    if (data.isOnline) {
      toast.success(`${data.memberName} is now online`);
    }
  });

  socket.on('alert:new', (alertData) => {
    useAlertStore.getState().addAlert(alertData);
    
    toast.error(
      `Alert: ${alertData.user.name} - Risk Score: ${alertData.riskScore}`,
      { duration: 10000 }
    );

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('NOCTIS Alert', {
        body: `${alertData.user.name} has triggered a ${alertData.type} alert!`,
        icon: '/noctis-icon.svg',
      });
    }
  });

  socket.on('alert:acknowledged', (data) => {
    useAlertStore.getState().updateAlert(data.alertId, {
      status: 'acknowledged',
      acknowledgedAt: data.acknowledgedAt,
    });
  });

  socket.on('alert:resolved', (data) => {
    useAlertStore.getState().updateAlert(data.alertId, {
      status: 'resolved',
      resolvedAt: data.resolvedAt,
    });
  });

  socket.on('alert:triggered', (data) => {
    toast.error(`Shadow Alert Triggered! Risk Score: ${data.riskScore}`);
  });

  socket.on('sos:confirmed', (data) => {
    toast.success('SOS alert sent to your family members');
  });

  socket.on('error', (data) => {
    toast.error(data.message || 'An error occurred');
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const emitLocationUpdate = (location) => {
  if (socket && socket.connected) {
    socket.emit('location:update', location);
  }
};

export const emitSOS = (location, message) => {
  if (socket && socket.connected) {
    socket.emit('sos:trigger', { ...location, message });
  }
};

export const acknowledgeAlert = (alertId) => {
  if (socket && socket.connected) {
    socket.emit('alert:acknowledge', { alertId });
  }
};

export const getSocket = () => socket;
