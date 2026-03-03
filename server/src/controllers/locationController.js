import User from '../models/User.js';
import LocationLog from '../models/LocationLog.js';
import TaggedLocation from '../models/TaggedLocation.js';
import { riskEngine, contextEngine } from '../services/index.js';
import { RISK_THRESHOLDS } from '../config/constants.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const updateLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude, speed, accuracy, heading, altitude } = req.body;
  const userId = req.userId;

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

  const riskResult = await riskEngine.calculateRealTimeRiskScore(
    userId,
    currentLocation,
    false // isNightMode (now properly handled in DataProcessor for socket updates)
  );

  const contextResult = await contextEngine.generateStatus(
    userId,
    currentLocation,
    previousLocations
  );

  const locationLog = await LocationLog.create({
    user: userId,
    latitude,
    longitude,
    speed: currentLocation.speed,
    accuracy: currentLocation.accuracy,
    heading: currentLocation.heading,
    altitude: currentLocation.altitude,
    timestamp: currentLocation.timestamp,
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

  let alert = null;
  // Alerts are now processed via socket.io in real-time
  // This REST endpoint is for legacy/fallback support only

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
      context: {
        status: contextResult.status,
        isMoving: contextResult.isMoving,
        isStationary: contextResult.isStationary,
        nearbyTaggedLocation: contextResult.nearbyTaggedLocation,
      },
      alert: alert ? { id: alert._id, severity: alert.severity } : null,
    },
  });
});

export const getLocationHistory = asyncHandler(async (req, res) => {
  const { startDate, endDate, limit = 100 } = req.query;
  const userId = req.userId;

  let logs;

  if (startDate && endDate) {
    logs = await LocationLog.getLogsInTimeRange(
      userId,
      new Date(startDate),
      new Date(endDate)
    );
  } else {
    logs = await LocationLog.getRecentLogs(userId, parseInt(limit));
  }

  res.json({
    success: true,
    data: { locations: logs },
  });
});

export const getRiskHistory = asyncHandler(async (req, res) => {
  const { hours = 24 } = req.query;
  const userId = req.userId;

  const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

  const logs = await LocationLog.find({
    user: userId,
    timestamp: { $gte: since },
  })
    .select('timestamp riskScore riskBreakdown anomalies status latitude longitude')
    .sort({ timestamp: 1 });

  const riskTimeline = logs.map((log) => ({
    timestamp: log.timestamp,
    score: log.riskScore,
    breakdown: log.riskBreakdown,
    anomalies: log.anomalies,
    status: log.status,
    location: {
      latitude: log.latitude,
      longitude: log.longitude,
    },
  }));

  const stats = {
    averageScore: logs.length
      ? logs.reduce((sum, l) => sum + l.riskScore, 0) / logs.length
      : 0,
    maxScore: logs.length ? Math.max(...logs.map((l) => l.riskScore)) : 0,
    anomalyCount: logs.reduce((sum, l) => sum + l.anomalies.length, 0),
    dataPoints: logs.length,
  };

  res.json({
    success: true,
    data: { timeline: riskTimeline, stats },
  });
});

export const getFamilyMemberLocation = asyncHandler(async (req, res) => {
  const { memberId } = req.params;

  const member = await User.findById(memberId).select(
    'name email avatar isOnline lastSeen lastKnownLocation currentRiskScore currentStatus isNightModeActive isLocationSharingEnabled'
  );

  if (!member) {
    throw new AppError('Member not found', 404);
  }

  if (!member.isLocationSharingEnabled) {
    return res.json({
      success: true,
      data: {
        member: {
          id: member._id,
          name: member.name,
          locationSharingDisabled: true,
        },
      },
    });
  }

  res.json({
    success: true,
    data: {
      member: {
        id: member._id,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        isOnline: member.isOnline,
        lastSeen: member.lastSeen,
        location: member.lastKnownLocation,
        riskScore: member.currentRiskScore,
        status: member.currentStatus,
        isNightModeActive: member.isNightModeActive,
      },
    },
  });
});

export const setExpectedRoute = asyncHandler(async (req, res) => {
  const { route } = req.body;

  if (!Array.isArray(route) || route.length < 2) {
    throw new AppError('Route must be an array with at least 2 points', 400);
  }

  for (const point of route) {
    if (
      typeof point.latitude !== 'number' ||
      typeof point.longitude !== 'number'
    ) {
      throw new AppError('Each route point must have latitude and longitude', 400);
    }
  }

  riskEngine.setExpectedRoute(req.userId, route);

  res.json({
    success: true,
    message: 'Expected route set successfully',
    data: { routeLength: route.length },
  });
});

export const clearExpectedRoute = asyncHandler(async (req, res) => {
  riskEngine.clearExpectedRoute(req.userId);

  res.json({
    success: true,
    message: 'Expected route cleared',
  });
});
