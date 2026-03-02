import riskEngine from './RiskEngine.js';
import contextEngine from './ContextEngine.js';

class SimulationService {
  constructor() {
    this.activeSimulations = new Map();
    this.predefinedRoutes = {
      homeToOffice: [
        { latitude: 40.7128, longitude: -74.006, speed: 0 },
        { latitude: 40.714, longitude: -74.004, speed: 25 },
        { latitude: 40.716, longitude: -74.002, speed: 30 },
        { latitude: 40.718, longitude: -74.0, speed: 28 },
        { latitude: 40.72, longitude: -73.998, speed: 32 },
        { latitude: 40.722, longitude: -73.996, speed: 30 },
        { latitude: 40.724, longitude: -73.994, speed: 25 },
        { latitude: 40.726, longitude: -73.992, speed: 20 },
        { latitude: 40.728, longitude: -73.99, speed: 15 },
        { latitude: 40.73, longitude: -73.988, speed: 0 },
      ],
      nightWalk: [
        { latitude: 40.758, longitude: -73.9855, speed: 5 },
        { latitude: 40.759, longitude: -73.9845, speed: 4 },
        { latitude: 40.76, longitude: -73.9835, speed: 5 },
        { latitude: 40.761, longitude: -73.9825, speed: 4 },
        { latitude: 40.762, longitude: -73.9815, speed: 3 },
        { latitude: 40.762, longitude: -73.9815, speed: 0 },
        { latitude: 40.762, longitude: -73.9815, speed: 0 },
        { latitude: 40.763, longitude: -73.9805, speed: 5 },
        { latitude: 40.764, longitude: -73.9795, speed: 4 },
        { latitude: 40.765, longitude: -73.9785, speed: 5 },
      ],
      erraticMovement: [
        { latitude: 40.73, longitude: -73.99, speed: 10 },
        { latitude: 40.731, longitude: -73.988, speed: 45 },
        { latitude: 40.729, longitude: -73.991, speed: 5 },
        { latitude: 40.732, longitude: -73.985, speed: 50 },
        { latitude: 40.728, longitude: -73.992, speed: 0 },
        { latitude: 40.733, longitude: -73.983, speed: 60 },
        { latitude: 40.727, longitude: -73.994, speed: 8 },
        { latitude: 40.734, longitude: -73.981, speed: 55 },
        { latitude: 40.726, longitude: -73.995, speed: 2 },
        { latitude: 40.735, longitude: -73.979, speed: 40 },
      ],
    };
  }

  startSimulation(userId, routeType = 'homeToOffice', options = {}) {
    const userIdStr = userId.toString();
    const route = this.predefinedRoutes[routeType] || this.predefinedRoutes.homeToOffice;
    
    const simulation = {
      userId: userIdStr,
      route: [...route],
      currentIndex: 0,
      intervalMs: options.intervalMs || 3000,
      isRunning: true,
      startedAt: new Date(),
      anomalies: {
        deviationInjected: false,
        stopInjected: false,
        entropyInjected: false,
      },
    };

    this.activeSimulations.set(userIdStr, simulation);

    return {
      success: true,
      message: `Simulation started: ${routeType}`,
      routeLength: route.length,
      estimatedDuration: route.length * (options.intervalMs || 3000),
    };
  }

  stopSimulation(userId) {
    const userIdStr = userId.toString();
    const simulation = this.activeSimulations.get(userIdStr);
    
    if (!simulation) {
      return { success: false, message: 'No active simulation' };
    }

    simulation.isRunning = false;
    this.activeSimulations.delete(userIdStr);
    
    riskEngine.clearUserData(userId);
    contextEngine.clearUserData(userId);

    return { success: true, message: 'Simulation stopped' };
  }

  getNextLocation(userId) {
    const userIdStr = userId.toString();
    const simulation = this.activeSimulations.get(userIdStr);
    
    if (!simulation || !simulation.isRunning) {
      return null;
    }

    if (simulation.currentIndex >= simulation.route.length) {
      simulation.currentIndex = 0;
    }

    let location = { ...simulation.route[simulation.currentIndex] };
    
    location = this.applyAnomalies(location, simulation);
    
    location.timestamp = new Date();
    location.accuracy = 10 + Math.random() * 20;
    location.isSimulated = true;

    simulation.currentIndex++;

    return location;
  }

  applyAnomalies(location, simulation) {
    if (simulation.anomalies.deviationInjected) {
      const deviationFactor = 0.005;
      location.latitude += (Math.random() - 0.5) * deviationFactor * 2;
      location.longitude += (Math.random() - 0.5) * deviationFactor * 2;
    }

    if (simulation.anomalies.stopInjected) {
      location.speed = 0;
    }

    if (simulation.anomalies.entropyInjected) {
      location.speed = Math.random() * 60;
    }

    return location;
  }

  injectAnomaly(userId, anomalyType) {
    const userIdStr = userId.toString();
    const simulation = this.activeSimulations.get(userIdStr);
    
    if (!simulation) {
      return { success: false, message: 'No active simulation' };
    }

    switch (anomalyType) {
      case 'deviation':
        simulation.anomalies.deviationInjected = true;
        riskEngine.injectDeviation(userId, 45);
        return { success: true, message: 'Route deviation injected' };
        
      case 'stop':
        simulation.anomalies.stopInjected = true;
        riskEngine.injectStop(userId, 8);
        return { success: true, message: 'Unexpected stop injected' };
        
      case 'entropy':
        simulation.anomalies.entropyInjected = true;
        riskEngine.injectSpeedEntropy(userId, 60);
        return { success: true, message: 'Speed entropy injected' };
        
      case 'all':
        simulation.anomalies.deviationInjected = true;
        simulation.anomalies.stopInjected = true;
        simulation.anomalies.entropyInjected = true;
        riskEngine.injectDeviation(userId, 45);
        riskEngine.injectStop(userId, 8);
        riskEngine.injectSpeedEntropy(userId, 60);
        return { success: true, message: 'All anomalies injected' };
        
      default:
        return { success: false, message: 'Unknown anomaly type' };
    }
  }

  clearAnomaly(userId, anomalyType) {
    const userIdStr = userId.toString();
    const simulation = this.activeSimulations.get(userIdStr);
    
    if (!simulation) {
      return { success: false, message: 'No active simulation' };
    }

    switch (anomalyType) {
      case 'deviation':
        simulation.anomalies.deviationInjected = false;
        return { success: true, message: 'Deviation cleared' };
        
      case 'stop':
        simulation.anomalies.stopInjected = false;
        return { success: true, message: 'Stop cleared' };
        
      case 'entropy':
        simulation.anomalies.entropyInjected = false;
        return { success: true, message: 'Entropy cleared' };
        
      case 'all':
        simulation.anomalies.deviationInjected = false;
        simulation.anomalies.stopInjected = false;
        simulation.anomalies.entropyInjected = false;
        return { success: true, message: 'All anomalies cleared' };
        
      default:
        return { success: false, message: 'Unknown anomaly type' };
    }
  }

  getSimulationStatus(userId) {
    const userIdStr = userId.toString();
    const simulation = this.activeSimulations.get(userIdStr);
    
    if (!simulation) {
      return { active: false };
    }

    return {
      active: simulation.isRunning,
      currentIndex: simulation.currentIndex,
      totalPoints: simulation.route.length,
      progress: ((simulation.currentIndex / simulation.route.length) * 100).toFixed(1),
      anomalies: simulation.anomalies,
      startedAt: simulation.startedAt,
      runningFor: Date.now() - simulation.startedAt.getTime(),
    };
  }

  generateRandomRoute(startLat, startLng, pointCount = 20, maxDeviation = 0.01) {
    const route = [];
    let lat = startLat;
    let lng = startLng;

    for (let i = 0; i < pointCount; i++) {
      lat += (Math.random() - 0.5) * maxDeviation;
      lng += (Math.random() - 0.5) * maxDeviation;
      
      const speed = i === 0 || i === pointCount - 1 
        ? 0 
        : 20 + Math.random() * 30;

      route.push({
        latitude: lat,
        longitude: lng,
        speed,
      });
    }

    return route;
  }

  setCustomRoute(userId, route) {
    const userIdStr = userId.toString();
    let simulation = this.activeSimulations.get(userIdStr);
    
    if (!simulation) {
      simulation = {
        userId: userIdStr,
        route: [],
        currentIndex: 0,
        intervalMs: 3000,
        isRunning: true,
        startedAt: new Date(),
        anomalies: {
          deviationInjected: false,
          stopInjected: false,
          entropyInjected: false,
        },
      };
      this.activeSimulations.set(userIdStr, simulation);
    }

    simulation.route = route;
    simulation.currentIndex = 0;

    return { success: true, message: 'Custom route set', routeLength: route.length };
  }

  getAvailableRoutes() {
    return Object.keys(this.predefinedRoutes).map((key) => ({
      id: key,
      name: key.replace(/([A-Z])/g, ' $1').trim(),
      pointCount: this.predefinedRoutes[key].length,
    }));
  }
}

const simulationService = new SimulationService();
export default simulationService;
