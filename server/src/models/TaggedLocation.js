import mongoose from 'mongoose';
import { DEFAULT_TAGGED_RADIUS } from '../config/constants.js';

const taggedLocationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    label: {
      type: String,
      required: [true, 'Location label is required'],
      trim: true,
      maxlength: [100, 'Label cannot exceed 100 characters'],
    },
    type: {
      type: String,
      enum: ['home', 'office', 'friend', 'family', 'gym', 'school', 'hospital', 'custom'],
      default: 'custom',
    },
    latitude: {
      type: Number,
      required: [true, 'Latitude is required'],
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: [true, 'Longitude is required'],
      min: -180,
      max: 180,
    },
    radius: {
      type: Number,
      default: DEFAULT_TAGGED_RADIUS,
      min: 10,
      max: 5000,
    },
    address: {
      type: String,
      trim: true,
    },
    isHighRisk: {
      type: Boolean,
      default: false,
    },
    riskWeight: {
      type: Number,
      default: 0,
      min: 0,
      max: 15,
    },
    icon: {
      type: String,
      default: 'location',
    },
    color: {
      type: String,
      default: '#3B82F6',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    visitCount: {
      type: Number,
      default: 0,
    },
    lastVisited: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

taggedLocationSchema.index({ user: 1 });
taggedLocationSchema.index({ latitude: 1, longitude: 1 });
taggedLocationSchema.index({ user: 1, isActive: 1 });

taggedLocationSchema.methods.isWithinRadius = function (lat, lng) {
  const R = 6371e3;
  const φ1 = (this.latitude * Math.PI) / 180;
  const φ2 = (lat * Math.PI) / 180;
  const Δφ = ((lat - this.latitude) * Math.PI) / 180;
  const Δλ = ((lng - this.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance <= this.radius;
};

taggedLocationSchema.statics.findNearbyTagged = async function (userId, lat, lng) {
  const locations = await this.find({ user: userId, isActive: true });
  return locations.filter((loc) => loc.isWithinRadius(lat, lng));
};

const TaggedLocation = mongoose.model('TaggedLocation', taggedLocationSchema);

export default TaggedLocation;
