import mongoose from 'mongoose';

const riskZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    geometry: {
      type: {
        type: String,
        enum: ['Point', 'Polygon'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    radius: {
      type: Number,
      default: 500,
    },
    riskLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 15,
    },
    category: {
      type: String,
      enum: ['crime', 'accident', 'construction', 'isolated', 'lighting', 'other'],
      default: 'other',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
    },
    verificationCount: {
      type: Number,
      default: 0,
    },
    lastVerified: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

riskZoneSchema.index({ geometry: '2dsphere' });
riskZoneSchema.index({ isActive: 1, riskLevel: -1 });

riskZoneSchema.statics.findNearbyRiskZones = async function (lat, lng, maxDistance = 1000) {
  return this.find({
    isActive: true,
    geometry: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        $maxDistance: maxDistance,
      },
    },
  });
};

riskZoneSchema.statics.getRiskWeightForLocation = async function (lat, lng) {
  const zones = await this.findNearbyRiskZones(lat, lng, 500);
  if (zones.length === 0) return 0;
  return Math.max(...zones.map((z) => z.riskLevel));
};

const RiskZone = mongoose.model('RiskZone', riskZoneSchema);

export default RiskZone;
