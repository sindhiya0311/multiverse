import mongoose from 'mongoose';

const locationLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    accuracy: {
      type: Number,
      default: 0,
    },
    altitude: {
      type: Number,
    },
    speed: {
      type: Number,
      default: 0,
    },
    heading: {
      type: Number,
      min: 0,
      max: 360,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    isNightMode: {
      type: Boolean,
      default: false,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    riskBreakdown: {
      routeDeviation: { type: Number, default: 0 },
      stopDuration: { type: Number, default: 0 },
      speedEntropy: { type: Number, default: 0 },
      locationRisk: { type: Number, default: 0 },
      nightMultiplier: { type: Number, default: 1 },
    },
    status: {
      type: String,
      default: 'Unknown',
    },
    contextualInfo: {
      nearbyTaggedLocation: String,
      isMoving: Boolean,
      isStationary: Boolean,
      stationaryDuration: Number,
      travellingFrom: String,
      travellingTo: String,
    },
    anomalies: [
      {
        type: {
          type: String,
          enum: ['route_deviation', 'unexpected_stop', 'speed_anomaly', 'high_risk_zone'],
        },
        severity: {
          type: String,
          enum: ['low', 'medium', 'high'],
        },
        description: String,
      },
    ],
    metadata: {
      deviceId: String,
      batteryLevel: Number,
      networkType: String,
      isSimulated: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

locationLogSchema.index({ user: 1, timestamp: -1 });
locationLogSchema.index({ user: 1, createdAt: -1 });
locationLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

locationLogSchema.statics.getRecentLogs = async function (userId, limit = 100) {
  return this.find({ user: userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

locationLogSchema.statics.getLogsInTimeRange = async function (userId, startTime, endTime) {
  return this.find({
    user: userId,
    timestamp: { $gte: startTime, $lte: endTime },
  }).sort({ timestamp: 1 });
};

locationLogSchema.statics.getRecentSpeeds = async function (userId, sampleSize = 10) {
  const logs = await this.find({ user: userId })
    .sort({ timestamp: -1 })
    .limit(sampleSize)
    .select('speed timestamp');
  return logs.map((log) => log.speed);
};

const LocationLog = mongoose.model('LocationLog', locationLogSchema);

export default LocationLog;
