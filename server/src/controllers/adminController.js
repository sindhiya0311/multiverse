import User from '../models/User.js';
import Alert from '../models/Alert.js';
import LocationLog from '../models/LocationLog.js';
import { alertService } from '../services/index.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalUsers,
    activeUsers,
    nightModeUsers,
    alertStats,
    recentHighRiskUsers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isOnline: true }),
    User.countDocuments({ isNightModeActive: true, isOnline: true }),
    alertService.getAlertStats('24h'),
    User.find({ currentRiskScore: { $gte: 60 } })
      .select('name email currentRiskScore currentStatus isNightModeActive lastKnownLocation')
      .limit(10)
      .sort({ currentRiskScore: -1 }),
  ]);

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        nightMode: nightModeUsers,
      },
      alerts: alertStats,
      highRiskUsers: recentHighRiskUsers,
    },
  });
});

export const getActiveNightUsers = asyncHandler(async (req, res) => {
  const users = await User.find({
    isOnline: true,
    isNightModeActive: true,
  })
    .select('name email avatar currentRiskScore currentStatus lastKnownLocation lastSeen')
    .sort({ currentRiskScore: -1 });

  res.json({
    success: true,
    data: { users },
  });
});

export const getLiveRiskHeatmap = asyncHandler(async (req, res) => {
  const users = await User.find({
    isOnline: true,
    'lastKnownLocation.latitude': { $exists: true },
  }).select('lastKnownLocation currentRiskScore isNightModeActive');

  const heatmapData = users.map((user) => ({
    latitude: user.lastKnownLocation.latitude,
    longitude: user.lastKnownLocation.longitude,
    intensity: user.currentRiskScore / 100,
    isNightMode: user.isNightModeActive,
  }));

  res.json({
    success: true,
    data: { heatmap: heatmapData },
  });
});

export const getAllAlerts = asyncHandler(async (req, res) => {
  const { status, severity, type, limit = 100, offset = 0 } = req.query;

  const query = {};
  if (status) query.status = status;
  if (severity) query.severity = severity;
  if (type) query.type = type;

  const [alerts, total] = await Promise.all([
    Alert.find(query)
      .sort({ triggeredAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('user', 'name email avatar lastKnownLocation')
      .populate('acknowledgedBy resolvedBy', 'name email'),
    Alert.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      alerts,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    },
  });
});

export const getAlertAnalytics = asyncHandler(async (req, res) => {
  const { timeRange = '7d' } = req.query;

  const timeRanges = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  const since = new Date(Date.now() - (timeRanges[timeRange] || timeRanges['7d']));

  const [
    alertsByHour,
    alertsBySeverity,
    alertsByType,
    topAnomalies,
    avgResponseTime,
  ] = await Promise.all([
    Alert.aggregate([
      { $match: { triggeredAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d %H:00',
              date: '$triggeredAt',
            },
          },
          count: { $sum: 1 },
          avgRiskScore: { $avg: '$riskScore' },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Alert.aggregate([
      { $match: { triggeredAt: { $gte: since } } },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
        },
      },
    ]),

    Alert.aggregate([
      { $match: { triggeredAt: { $gte: since } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]),

    Alert.aggregate([
      { $match: { triggeredAt: { $gte: since } } },
      { $unwind: '$anomalyBreakdown.anomalyTypes' },
      {
        $group: {
          _id: '$anomalyBreakdown.anomalyTypes',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),

    Alert.aggregate([
      {
        $match: {
          triggeredAt: { $gte: since },
          acknowledgedAt: { $exists: true },
        },
      },
      {
        $project: {
          responseTime: {
            $subtract: ['$acknowledgedAt', '$triggeredAt'],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$responseTime' },
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      alertsByHour,
      alertsBySeverity: alertsBySeverity.reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {}
      ),
      alertsByType: alertsByType.reduce(
        (acc, item) => ({ ...acc, [item._id]: item.count }),
        {}
      ),
      topAnomalies,
      avgResponseTimeMs: avgResponseTime[0]?.avgResponseTime || 0,
    },
  });
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { role, isOnline, limit = 50, offset = 0 } = req.query;

  const query = {};
  if (role) query.role = role;
  if (isOnline !== undefined) query.isOnline = isOnline === 'true';

  const [users, total] = await Promise.all([
    User.find(query)
      .select('-settings')
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit)),
    User.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: {
      users: users.map((u) => u.toPublicJSON()),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    },
  });
});

export const getUserDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const [recentAlerts, locationStats] = await Promise.all([
    Alert.find({ user: id })
      .sort({ triggeredAt: -1 })
      .limit(10),
    LocationLog.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          avgRiskScore: { $avg: '$riskScore' },
          maxRiskScore: { $max: '$riskScore' },
          firstLog: { $min: '$timestamp' },
          lastLog: { $max: '$timestamp' },
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      user: user.toPublicJSON(),
      recentAlerts,
      locationStats: locationStats[0] || {},
    },
  });
});

export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  const user = await User.findByIdAndUpdate(
    id,
    { role },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    message: 'User role updated',
    data: { user: user.toPublicJSON() },
  });
});
