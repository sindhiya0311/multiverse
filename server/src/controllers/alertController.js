import { alertService } from '../services/index.js';
import Alert from '../models/Alert.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const triggerSOS = asyncHandler(async (req, res) => {
  const { latitude, longitude, message } = req.body;

  const alert = await alertService.triggerSOSAlert(
    req.userId,
    { latitude, longitude },
    message
  );

  res.status(201).json({
    success: true,
    message: 'SOS alert triggered successfully',
    data: { alert },
  });
});

export const getMyAlerts = asyncHandler(async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;

  const query = { user: req.userId };
  if (status) query.status = status;

  const alerts = await Alert.find(query)
    .sort({ triggeredAt: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .populate('acknowledgedBy resolvedBy', 'name email');

  const total = await Alert.countDocuments(query);

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

export const getActiveAlerts = asyncHandler(async (req, res) => {
  const alerts = await alertService.getActiveAlertsForUser(req.userId);

  res.json({
    success: true,
    data: { alerts },
  });
});

export const getFamilyAlerts = asyncHandler(async (req, res) => {
  const { activeOnly = false, limit = 50 } = req.query;

  const alerts = await alertService.getFamilyAlerts(req.userId, {
    activeOnly: activeOnly === 'true',
    limit: parseInt(limit),
  });

  res.json({
    success: true,
    data: { alerts },
  });
});

export const acknowledgeAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const alert = await alertService.acknowledgeAlert(id, req.userId);

  res.json({
    success: true,
    message: 'Alert acknowledged',
    data: { alert },
  });
});

export const resolveAlert = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolution, notes } = req.body;

  if (!resolution) {
    throw new AppError('Resolution type is required', 400);
  }

  const validResolutions = ['safe', 'false_alarm', 'emergency_services', 'family_assisted', 'other'];
  if (!validResolutions.includes(resolution)) {
    throw new AppError('Invalid resolution type', 400);
  }

  const alert = await alertService.resolveAlert(id, req.userId, resolution, notes);

  res.json({
    success: true,
    message: 'Alert resolved',
    data: { alert },
  });
});

export const markAsFalseAlarm = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const alert = await alertService.markAsFalseAlarm(id, req.userId, notes);

  res.json({
    success: true,
    message: 'Alert marked as false alarm',
    data: { alert },
  });
});

export const getAlertDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const alert = await Alert.findById(id)
    .populate('user', 'name email avatar lastKnownLocation')
    .populate('acknowledgedBy resolvedBy', 'name email')
    .populate('notifiedMembers.user', 'name email');

  if (!alert) {
    throw new AppError('Alert not found', 404);
  }

  res.json({
    success: true,
    data: { alert },
  });
});
