import { create } from 'zustand';
import api from '../services/api';

export const useAlertStore = create((set, get) => ({
  activeAlerts: [],
  familyAlerts: [],
  alertHistory: [],
  unreadCount: 0,

  fetchActiveAlerts: async () => {
    try {
      const response = await api.get('/alerts/active');
      set({ activeAlerts: response.data.data.alerts });
      return response.data.data.alerts;
    } catch (error) {
      console.error('Failed to fetch active alerts:', error);
      return [];
    }
  },

  fetchFamilyAlerts: async (activeOnly = true) => {
    try {
      const response = await api.get('/alerts/family', {
        params: { activeOnly },
      });
      set({ familyAlerts: response.data.data.alerts });
      return response.data.data.alerts;
    } catch (error) {
      console.error('Failed to fetch family alerts:', error);
      return [];
    }
  },

  fetchAlertHistory: async (params = {}) => {
    try {
      const response = await api.get('/alerts/my', { params });
      set({ alertHistory: response.data.data.alerts });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch alert history:', error);
      return { alerts: [], pagination: {} };
    }
  },

  triggerSOS: async (location, message = '') => {
    try {
      const response = await api.post('/alerts/sos', {
        latitude: location.latitude,
        longitude: location.longitude,
        message,
      });
      
      const newAlert = response.data.data.alert;
      set((state) => ({
        activeAlerts: [newAlert, ...state.activeAlerts],
      }));
      
      return { success: true, alert: newAlert };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to trigger SOS';
      return { success: false, message };
    }
  },

  acknowledgeAlert: async (alertId) => {
    try {
      const response = await api.post(`/alerts/${alertId}/acknowledge`);
      
      set((state) => ({
        activeAlerts: state.activeAlerts.map((alert) =>
          alert._id === alertId
            ? { ...alert, status: 'acknowledged' }
            : alert
        ),
        familyAlerts: state.familyAlerts.map((alert) =>
          alert._id === alertId
            ? { ...alert, status: 'acknowledged' }
            : alert
        ),
      }));
      
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  },

  resolveAlert: async (alertId, resolution, notes = '') => {
    try {
      await api.post(`/alerts/${alertId}/resolve`, { resolution, notes });
      
      set((state) => ({
        activeAlerts: state.activeAlerts.filter((a) => a._id !== alertId),
        familyAlerts: state.familyAlerts.filter((a) => a._id !== alertId),
      }));
      
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  },

  addAlert: (alert) => {
    set((state) => ({
      activeAlerts: [alert, ...state.activeAlerts],
      unreadCount: state.unreadCount + 1,
    }));
  },

  updateAlert: (alertId, updates) => {
    set((state) => ({
      activeAlerts: state.activeAlerts.map((alert) =>
        alert._id === alertId ? { ...alert, ...updates } : alert
      ),
      familyAlerts: state.familyAlerts.map((alert) =>
        alert._id === alertId ? { ...alert, ...updates } : alert
      ),
    }));
  },

  clearUnread: () => set({ unreadCount: 0 }),
}));
