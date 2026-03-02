import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[\d\s-]{10,}$/, 'Please enter a valid phone number'],
    },
    avatar: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    isLocationSharingEnabled: {
      type: Boolean,
      default: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    lastKnownLocation: {
      latitude: Number,
      longitude: Number,
      timestamp: Date,
      accuracy: Number,
    },
    currentRiskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentStatus: {
      type: String,
      default: 'Unknown',
    },
    isNightModeActive: {
      type: Boolean,
      default: false,
    },
    settings: {
      nightModeAutoEnable: {
        type: Boolean,
        default: true,
      },
      alertsEnabled: {
        type: Boolean,
        default: true,
      },
      soundEnabled: {
        type: Boolean,
        default: true,
      },
    },
    deviceInfo: {
      platform: String,
      deviceId: String,
      pushToken: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.index({ email: 1 });
userSchema.index({ 'lastKnownLocation.latitude': 1, 'lastKnownLocation.longitude': 1 });
userSchema.index({ isOnline: 1, isNightModeActive: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    phone: this.phone,
    avatar: this.avatar,
    role: this.role,
    isLocationSharingEnabled: this.isLocationSharingEnabled,
    isOnline: this.isOnline,
    lastSeen: this.lastSeen,
    currentRiskScore: this.currentRiskScore,
    currentStatus: this.currentStatus,
    isNightModeActive: this.isNightModeActive,
    settings: this.settings,
  };
};

const User = mongoose.model('User', userSchema);

export default User;
