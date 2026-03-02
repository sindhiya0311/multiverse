import { create } from 'zustand';
import api from '../services/api';

export const useFamilyStore = create((set, get) => ({
  familyMembers: [],
  pendingRequests: [],
  sentRequests: [],
  isLoading: false,

  fetchFamilyMembers: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/family/members');
      set({ familyMembers: response.data.data.familyMembers, isLoading: false });
      return response.data.data.familyMembers;
    } catch (error) {
      set({ isLoading: false });
      console.error('Failed to fetch family members:', error);
      return [];
    }
  },

  fetchPendingRequests: async () => {
    try {
      const response = await api.get('/family/requests/pending');
      set({ pendingRequests: response.data.data.requests });
      return response.data.data.requests;
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
      return [];
    }
  },

  fetchSentRequests: async () => {
    try {
      const response = await api.get('/family/requests/sent');
      set({ sentRequests: response.data.data.requests });
      return response.data.data.requests;
    } catch (error) {
      console.error('Failed to fetch sent requests:', error);
      return [];
    }
  },

  sendRequest: async (recipientEmail, relationship) => {
    try {
      const response = await api.post('/family/request', {
        recipientEmail,
        relationship,
      });
      
      set((state) => ({
        sentRequests: [...state.sentRequests, response.data.data.connection],
      }));
      
      return { success: true, connection: response.data.data.connection };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to send request';
      return { success: false, message };
    }
  },

  respondToRequest: async (requestId, action) => {
    try {
      const response = await api.post(`/family/requests/${requestId}/respond`, {
        action,
      });
      
      set((state) => ({
        pendingRequests: state.pendingRequests.filter((r) => r._id !== requestId),
      }));
      
      if (action === 'accept') {
        get().fetchFamilyMembers();
      }
      
      return { success: true, connection: response.data.data.connection };
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to respond to request';
      return { success: false, message };
    }
  },

  cancelRequest: async (requestId) => {
    try {
      await api.delete(`/family/requests/${requestId}/cancel`);
      
      set((state) => ({
        sentRequests: state.sentRequests.filter((r) => r._id !== requestId),
      }));
      
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  },

  removeMember: async (connectionId) => {
    try {
      await api.delete(`/family/members/${connectionId}`);
      
      set((state) => ({
        familyMembers: state.familyMembers.filter((m) => m.connectionId !== connectionId),
      }));
      
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  },

  updateMemberSettings: async (connectionId, settings) => {
    try {
      await api.patch(`/family/members/${connectionId}/settings`, settings);
      
      set((state) => ({
        familyMembers: state.familyMembers.map((m) =>
          m.connectionId === connectionId ? { ...m, ...settings } : m
        ),
      }));
      
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  },

  updateMemberLocation: (memberId, locationData) => {
    set((state) => ({
      familyMembers: state.familyMembers.map((m) =>
        m.member.id === memberId
          ? {
              ...m,
              member: {
                ...m.member,
                lastKnownLocation: {
                  latitude: locationData.latitude,
                  longitude: locationData.longitude,
                  timestamp: locationData.timestamp,
                },
                currentRiskScore: locationData.riskScore,
                currentStatus: locationData.status,
                isNightModeActive: locationData.isNightMode,
                isOnline: true,
              },
            }
          : m
      ),
    }));
  },

  updateMemberPresence: (memberId, isOnline) => {
    set((state) => ({
      familyMembers: state.familyMembers.map((m) =>
        m.member.id === memberId
          ? { ...m, member: { ...m.member, isOnline } }
          : m
      ),
    }));
  },
}));
