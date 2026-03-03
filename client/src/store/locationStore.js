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
        // Geolocation API returns speed in m/s; server expects km/h
        const speedMps = position.coords.speed ?? null;
        const speedKmh = speedMps !== null ? Math.max(0, speedMps * 3.6) : 0;

        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          speed: speedKmh,
          accuracy: position.coords.accuracy ?? 100,
          heading: position.coords.heading ?? 0,
          altitude: position.coords.altitude ?? 0,
          timestamp: new Date().toISOString(),
        };

        set({ currentLocation: location });
      },
      (error) => {
        // Graceful degradation: keep last known location on GPS error
        if (error.code === error.POSITION_UNAVAILABLE) {
          set((s) => ({ currentLocation: s.currentLocation }));
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
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
