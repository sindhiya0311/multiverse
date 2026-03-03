import { simulationService, riskEngine, contextEngine } from '../services/index.js';
import LocationLog from '../models/LocationLog.js';
import User from '../models/User.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const startSimulation = asyncHandler(async (req, res) => {
  const { routeType, intervalMs } = req.body;

  const result = simulationService.startSimulation(req.userId, routeType, {
    intervalMs,
  });

  if (!result.success) {
    throw new AppError(result.message, 400);
  }

  res.json({
    success: true,
    message: result.message,
    data: {
      routeLength: result.routeLength,
      estimatedDuration: result.estimatedDuration,
    },
  });
});

export const stopSimulation = asyncHandler(async (req, res) => {
  const result = simulationService.stopSimulation(req.userId);

  if (!result.success) {
    throw new AppError(result.message, 400);
  }

  res.json({
    success: true,
    message: result.message,
  });
});

export const getSimulationStatus = asyncHandler(async (req, res) => {
  const status = simulationService.getSimulationStatus(req.userId);

  res.json({
    success: true,
    data: { status },
  });
});

export const getNextSimulatedLocation = asyncHandler(async (req, res) => {
  const location = simulationService.getNextLocation(req.userId);

  if (!location) {
    throw new AppError('No active simulation', 400);
  }

  const previousLocations = await LocationLog.getRecentLogs(req.userId, 20);

  const riskResult = await riskEngine.calculateRiskScore(
    req.userId,
    location,
    previousLocations
  );

  const contextResult = await contextEngine.generateStatus(
    req.userId,
    location,
    previousLocations
  );

  const locationLog = await LocationLog.create({
    user: req.userId,
    ...location,
    isNightMode: riskResult.isNightMode,
    riskScore: riskResult.score,
    riskBreakdown: riskResult.breakdown,
    status: contextResult.status,
    contextualInfo: {
      nearbyTaggedLocation: contextResult.nearbyTaggedLocation,
      isMoving: contextResult.isMoving,
      isStationary: contextResult.isStationary,
      stationaryDuration: contextResult.stationaryDuration,
    },
    anomalies: riskResult.anomalies,
    metadata: {
      isSimulated: true,
    },
  });

  await User.findByIdAndUpdate(req.userId, {
    lastKnownLocation: {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.timestamp,
      accuracy: location.accuracy,
    },
    currentRiskScore: riskResult.score,
    currentStatus: contextResult.status,
    isNightModeActive: riskResult.isNightMode,
  });

  res.json({
    success: true,
    data: {
      location: locationLog,
      risk: {
        score: riskResult.score,
        breakdown: riskResult.breakdown,
        alertLevel: riskResult.alertLevel,
        anomalies: riskResult.anomalies,
        isNightMode: riskResult.isNightMode,
      },
      context: contextResult,
      simulation: simulationService.getSimulationStatus(req.userId),
    },
  });
});

export const injectAnomaly = asyncHandler(async (req, res) => {
  const { anomalyType } = req.body;

  const result = simulationService.injectAnomaly(req.userId, anomalyType);

  if (!result.success) {
    throw new AppError(result.message, 400);
  }

  res.json({
    success: true,
    message: result.message,
  });
});

export const clearAnomaly = asyncHandler(async (req, res) => {
  const { anomalyType } = req.body;

  const result = simulationService.clearAnomaly(req.userId, anomalyType || 'all');

  if (!result.success) {
    throw new AppError(result.message, 400);
  }

  res.json({
    success: true,
    message: result.message,
  });
});

export const getAvailableRoutes = asyncHandler(async (req, res) => {
  const routes = simulationService.getAvailableRoutes();

  res.json({
    success: true,
    data: { routes },
  });
});

export const setCustomRoute = asyncHandler(async (req, res) => {
  const { route } = req.body;

  if (!Array.isArray(route) || route.length < 2) {
    throw new AppError('Route must be an array with at least 2 points', 400);
  }

  const result = simulationService.setCustomRoute(req.userId, route);

  res.json({
    success: true,
    message: result.message,
    data: { routeLength: result.routeLength },
  });
});

export const generateRandomRoute = asyncHandler(async (req, res) => {
  const { startLat, startLng, pointCount, maxDeviation } = req.body;

  if (!startLat || !startLng) {
    throw new AppError('Start coordinates are required', 400);
  }

  const route = simulationService.generateRandomRoute(
    parseFloat(startLat),
    parseFloat(startLng),
    parseInt(pointCount) || 20,
    parseFloat(maxDeviation) || 0.01
  );

  res.json({
    success: true,
    data: { route },
  });
});
