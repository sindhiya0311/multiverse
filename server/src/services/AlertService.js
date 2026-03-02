import Alert from '../models/Alert.js';
import FamilyConnection from '../models/FamilyConnection.js';
import User from '../models/User.js';
import { ALERT_TYPES, ALERT_SEVERITY, FAMILY_REQUEST_STATUS } from '../config/constants.js';

class AlertService {
  constructor() {
    this.io = null;
    this.activeAlerts = new Map();
  }

  setSocketIO(io) {
    this.io = io;
  }

  async triggerShadowAlert(userId, riskData, location) {
    const alert = await this.createAlert({
      userId,
      type: ALERT_TYPES.SHADOW,
      severity: riskData.alertLevel === 'red' ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
      riskScore: riskData.score,
      location,
      anomalyBreakdown: {
        ...riskData.breakdown,
        anomalyTypes: riskData.anomalies.map((a) => a.type),
      },
      isNightMode: riskData.isNightMode,
    });

    await this.notifyFamilyMembers(userId, alert);

    return alert;
  }

  async triggerSOSAlert(userId, location, message = '') {
    const alert = await this.createAlert({
      userId,
      type: ALERT_TYPES.SOS,
      severity: ALERT_SEVERITY.CRITICAL,
      riskScore: 100,
      location,
      anomalyBreakdown: {
        routeDeviation: 0,
        stopDuration: 0,
        speedEntropy: 0,
        locationRisk: 0,
        nightMultiplier: 1,
        anomalyTypes: ['manual_sos'],
      },
      metadata: { sosMessage: message },
    });

    await this.notifyFamilyMembers(userId, alert);

    return alert;
  }

  async createAlert(data) {
    const user = await User.findById(data.userId);
    
    const alert = new Alert({
      user: data.userId,
      type: data.type,
      severity: data.severity,
      riskScore: data.riskScore,
      location: {
        latitude: data.location.latitude,
        longitude: data.location.longitude,
        address: data.location.address || null,
      },
      anomalyBreakdown: data.anomalyBreakdown,
      metadata: {
        isNightMode: data.isNightMode,
        ...data.metadata,
      },
    });

    await alert.save();
    
    this.activeAlerts.set(alert._id.toString(), {
      alert,
      user,
      createdAt: new Date(),
    });

    return alert;
  }

  async notifyFamilyMembers(userId, alert) {
    const connections = await FamilyConnection.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: FAMILY_REQUEST_STATUS.ACCEPTED,
      canReceiveAlerts: true,
    }).populate('requester recipient', 'name email');

    const familyMemberIds = connections.map((conn) => {
      return conn.requester._id.toString() === userId.toString()
        ? conn.recipient._id
        : conn.requester._id;
    });

    const user = await User.findById(userId).select('name email lastKnownLocation');
    
    const alertData = {
      alertId: alert._id,
      type: alert.type,
      severity: alert.severity,
      riskScore: alert.riskScore,
      location: alert.location,
      anomalyBreakdown: alert.anomalyBreakdown,
      triggeredAt: alert.triggeredAt,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    };

    if (this.io) {
      for (const memberId of familyMemberIds) {
        this.io.to(`user:${memberId}`).emit('alert:new', alertData);
      }

      this.io.to('admin:alerts').emit('alert:new', alertData);
    }

    const notifiedMembers = familyMemberIds.map((memberId) => ({
      user: memberId,
      notifiedAt: new Date(),
    }));

    await Alert.findByIdAndUpdate(alert._id, {
      $set: { notifiedMembers },
    });

    return familyMemberIds;
  }

  async acknowledgeAlert(alertId, userId) {
    const alert = await Alert.findById(alertId);
    
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (alert.status !== 'active') {
      throw new Error('Alert is not active');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = userId;

    const memberIndex = alert.notifiedMembers.findIndex(
      (m) => m.user.toString() === userId.toString()
    );
    
    if (memberIndex !== -1) {
      alert.notifiedMembers[memberIndex].acknowledgedAt = new Date();
    }

    await alert.save();

    if (this.io) {
      this.io.to(`user:${alert.user}`).emit('alert:acknowledged', {
        alertId: alert._id,
        acknowledgedBy: userId,
        acknowledgedAt: alert.acknowledgedAt,
      });
    }

    return alert;
  }

  async resolveAlert(alertId, userId, resolution, notes = '') {
    const alert = await Alert.findById(alertId);
    
    if (!alert) {
      throw new Error('Alert not found');
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    alert.resolvedBy = userId;
    alert.resolution = resolution;
    alert.resolutionNotes = notes;

    await alert.save();
    
    this.activeAlerts.delete(alertId);

    if (this.io) {
      this.io.to(`user:${alert.user}`).emit('alert:resolved', {
        alertId: alert._id,
        resolvedBy: userId,
        resolution,
        resolvedAt: alert.resolvedAt,
      });
    }

    return alert;
  }

  async markAsFalseAlarm(alertId, userId, notes = '') {
    return this.resolveAlert(alertId, userId, 'false_alarm', notes);
  }

  async getActiveAlertsForUser(userId) {
    return Alert.find({
      user: userId,
      status: 'active',
    }).sort({ triggeredAt: -1 });
  }

  async getAlertHistory(userId, options = {}) {
    const { limit = 50, offset = 0, type, severity } = options;
    
    const query = { user: userId };
    if (type) query.type = type;
    if (severity) query.severity = severity;

    return Alert.find(query)
      .sort({ triggeredAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('acknowledgedBy resolvedBy', 'name email');
  }

  async getFamilyAlerts(userId, options = {}) {
    const { limit = 50, activeOnly = false } = options;

    const connections = await FamilyConnection.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: FAMILY_REQUEST_STATUS.ACCEPTED,
    });

    const familyMemberIds = connections.map((conn) => {
      return conn.requester.toString() === userId.toString()
        ? conn.recipient
        : conn.requester;
    });

    const query = {
      user: { $in: familyMemberIds },
    };
    
    if (activeOnly) {
      query.status = 'active';
    }

    return Alert.find(query)
      .sort({ triggeredAt: -1 })
      .limit(limit)
      .populate('user', 'name email avatar lastKnownLocation');
  }

  async getSystemAlerts(options = {}) {
    const { limit = 100, severity, status } = options;
    
    const query = {};
    if (severity) query.severity = severity;
    if (status) query.status = status;

    return Alert.find(query)
      .sort({ triggeredAt: -1 })
      .limit(limit)
      .populate('user', 'name email avatar lastKnownLocation');
  }

  async getAlertStats(timeRange = '24h') {
    const timeRanges = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - (timeRanges[timeRange] || timeRanges['24h']));

    const stats = await Alert.aggregate([
      { $match: { triggeredAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          critical: {
            $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] },
          },
          high: {
            $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] },
          },
          medium: {
            $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] },
          },
          low: {
            $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] },
          },
          shadowAlerts: {
            $sum: { $cond: [{ $eq: ['$type', 'shadow'] }, 1, 0] },
          },
          sosAlerts: {
            $sum: { $cond: [{ $eq: ['$type', 'sos'] }, 1, 0] },
          },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] },
          },
          falseAlarms: {
            $sum: { $cond: [{ $eq: ['$resolution', 'false_alarm'] }, 1, 0] },
          },
          avgRiskScore: { $avg: '$riskScore' },
        },
      },
    ]);

    return stats[0] || {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      shadowAlerts: 0,
      sosAlerts: 0,
      active: 0,
      resolved: 0,
      falseAlarms: 0,
      avgRiskScore: 0,
    };
  }
}

const alertService = new AlertService();
export default alertService;
