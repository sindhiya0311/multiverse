import mongoose from 'mongoose';
import { ALERT_TYPES, ALERT_SEVERITY } from '../config/constants.js';

const alertSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(ALERT_TYPES),
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(ALERT_SEVERITY),
      required: true,
    },
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
      address: String,
    },
    anomalyBreakdown: {
      routeDeviation: { type: Number, default: 0 },
      stopDuration: { type: Number, default: 0 },
      speedEntropy: { type: Number, default: 0 },
      locationRisk: { type: Number, default: 0 },
      nightMultiplier: { type: Number, default: 1 },
      anomalyTypes: [String],
    },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'resolved', 'false_alarm'],
      default: 'active',
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    acknowledgedAt: {
      type: Date,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    resolution: {
      type: String,
      enum: ['safe', 'false_alarm', 'emergency_services', 'family_assisted', 'other'],
    },
    resolutionNotes: {
      type: String,
      maxlength: 500,
    },
    notifiedMembers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        notifiedAt: Date,
        viewedAt: Date,
        acknowledgedAt: Date,
      },
    ],
    metadata: {
      isNightMode: Boolean,
      deviceInfo: String,
      batteryLevel: Number,
    },
  },
  {
    timestamps: true,
  }
);

alertSchema.index({ user: 1, triggeredAt: -1 });
alertSchema.index({ status: 1 });
alertSchema.index({ type: 1, severity: 1 });
alertSchema.index({ triggeredAt: -1 });

alertSchema.statics.getActiveAlerts = async function (userId) {
  return this.find({
    user: userId,
    status: 'active',
  })
    .sort({ triggeredAt: -1 })
    .populate('user', 'name email avatar');
};

alertSchema.statics.getAlertHistory = async function (userId, limit = 50) {
  return this.find({ user: userId })
    .sort({ triggeredAt: -1 })
    .limit(limit)
    .populate('user acknowledgedBy resolvedBy', 'name email avatar');
};

alertSchema.statics.getRecentCriticalAlerts = async function (limit = 20) {
  return this.find({
    severity: { $in: [ALERT_SEVERITY.HIGH, ALERT_SEVERITY.CRITICAL] },
    status: 'active',
  })
    .sort({ triggeredAt: -1 })
    .limit(limit)
    .populate('user', 'name email avatar lastKnownLocation');
};

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;
