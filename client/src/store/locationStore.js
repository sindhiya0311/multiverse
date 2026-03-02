import { create } from 'zustand';
import api from '../services/api';

export const useLocationStore = create((set, get) => ({
  currentLocation: null,
  locationHistory: [],
  riskData: null,
  contextData: null,
  isTracking: false,
  watchId: null,
  familyLocations: {},

  setCurrentLocation: (location) => set({ currentLocation: location }),

  setRiskData: (data) => set({ riskData: data }),

  setContextData: (data) => set({ contextData: data }),

  updateFamilyLocation: (memberId, locationData) => {
    set((state) => ({
      familyLocations: {
        ...state.familyLocations,
        [memberId]: locationData,
      },
    }));
  },

  startTracking: () => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: position.coords.speed || 0,
          accuracy: position.coords.accuracy,
          heading: position.coords.heading || 0,
          altitude: position.coords.altitude || 0,
          timestamp: new Date().toISOString(),
        };
        
        set({ currentLocation: location });
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );

    set({ watchId, isTracking: true });
  },

  stopTracking: () => {
    const { watchId } = get();
    if (watchId) {
      navigator.geolocation.clearWatch(watchId);
    }
    set({ watchId: null, isTracking: false });
  },

  fetchLocationHistory: async (params = {}) => {
    try {
      const response = await api.get('/location/history', { params });
      set({ locationHistory: response.data.data.locations });
      return response.data.data.locations;
    } catch (error) {
      console.error('Failed to fetch location history:', error);
      return [];
    }
  },

  fetchRiskHistory: async (hours = 24) => {
    try {
      const response = await api.get('/location/risk-history', { params: { hours } });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch risk history:', error);
      return null;
    }
  },

  clearHistory: () => set({ locationHistory: [] }),
}));
