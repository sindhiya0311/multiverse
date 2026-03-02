import mongoose from 'mongoose';
import { FAMILY_REQUEST_STATUS } from '../config/constants.js';

const familyConnectionSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(FAMILY_REQUEST_STATUS),
      default: FAMILY_REQUEST_STATUS.PENDING,
    },
    relationship: {
      type: String,
      default: 'Family',
      maxlength: 50,
    },
    canViewLocation: {
      type: Boolean,
      default: true,
    },
    canReceiveAlerts: {
      type: Boolean,
      default: true,
    },
    acceptedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

familyConnectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });
familyConnectionSchema.index({ status: 1 });
familyConnectionSchema.index({ requester: 1, status: 1 });
familyConnectionSchema.index({ recipient: 1, status: 1 });

familyConnectionSchema.statics.findConnection = async function (userId1, userId2) {
  return this.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });
};

familyConnectionSchema.statics.getAcceptedConnections = async function (userId) {
  return this.find({
    $or: [{ requester: userId }, { recipient: userId }],
    status: FAMILY_REQUEST_STATUS.ACCEPTED,
  }).populate('requester recipient', 'name email avatar isOnline lastSeen currentRiskScore currentStatus isNightModeActive lastKnownLocation isLocationSharingEnabled');
};

familyConnectionSchema.statics.getPendingRequests = async function (userId) {
  return this.find({
    recipient: userId,
    status: FAMILY_REQUEST_STATUS.PENDING,
  }).populate('requester', 'name email avatar');
};

familyConnectionSchema.statics.getSentRequests = async function (userId) {
  return this.find({
    requester: userId,
    status: FAMILY_REQUEST_STATUS.PENDING,
  }).populate('recipient', 'name email avatar');
};

const FamilyConnection = mongoose.model('FamilyConnection', familyConnectionSchema);

export default FamilyConnection;
