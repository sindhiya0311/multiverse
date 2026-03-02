import User from '../models/User.js';
import FamilyConnection from '../models/FamilyConnection.js';
import { FAMILY_REQUEST_STATUS } from '../config/constants.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const sendFamilyRequest = asyncHandler(async (req, res) => {
  const { recipientEmail, relationship } = req.body;
  const requesterId = req.userId;

  const recipient = await User.findOne({ email: recipientEmail });
  if (!recipient) {
    throw new AppError('User not found with this email', 404);
  }

  if (recipient._id.toString() === requesterId.toString()) {
    throw new AppError('You cannot send a request to yourself', 400);
  }

  const existingConnection = await FamilyConnection.findConnection(
    requesterId,
    recipient._id
  );

  if (existingConnection) {
    if (existingConnection.status === FAMILY_REQUEST_STATUS.ACCEPTED) {
      throw new AppError('Already connected as family', 400);
    }
    if (existingConnection.status === FAMILY_REQUEST_STATUS.PENDING) {
      throw new AppError('A pending request already exists', 400);
    }
  }

  const connection = await FamilyConnection.create({
    requester: requesterId,
    recipient: recipient._id,
    relationship: relationship || 'Family',
  });

  await connection.populate('recipient', 'name email avatar');

  res.status(201).json({
    success: true,
    message: 'Family request sent successfully',
    data: { connection },
  });
});

export const getPendingRequests = asyncHandler(async (req, res) => {
  const requests = await FamilyConnection.getPendingRequests(req.userId);

  res.json({
    success: true,
    data: { requests },
  });
});

export const getSentRequests = asyncHandler(async (req, res) => {
  const requests = await FamilyConnection.getSentRequests(req.userId);

  res.json({
    success: true,
    data: { requests },
  });
});

export const respondToRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  if (!['accept', 'reject'].includes(action)) {
    throw new AppError('Invalid action. Use "accept" or "reject"', 400);
  }

  const connection = await FamilyConnection.findOne({
    _id: id,
    recipient: req.userId,
    status: FAMILY_REQUEST_STATUS.PENDING,
  });

  if (!connection) {
    throw new AppError('Request not found or already processed', 404);
  }

  if (action === 'accept') {
    connection.status = FAMILY_REQUEST_STATUS.ACCEPTED;
    connection.acceptedAt = new Date();
  } else {
    connection.status = FAMILY_REQUEST_STATUS.REJECTED;
    connection.rejectedAt = new Date();
  }

  await connection.save();
  await connection.populate('requester recipient', 'name email avatar');

  res.json({
    success: true,
    message: `Request ${action}ed successfully`,
    data: { connection },
  });
});

export const getFamilyMembers = asyncHandler(async (req, res) => {
  const connections = await FamilyConnection.getAcceptedConnections(req.userId);

  const familyMembers = connections.map((conn) => {
    const member =
      conn.requester._id.toString() === req.userId.toString()
        ? conn.recipient
        : conn.requester;

    return {
      connectionId: conn._id,
      relationship: conn.relationship,
      canViewLocation: conn.canViewLocation,
      canReceiveAlerts: conn.canReceiveAlerts,
      connectedAt: conn.acceptedAt,
      member: {
        id: member._id,
        name: member.name,
        email: member.email,
        avatar: member.avatar,
        isOnline: member.isOnline,
        lastSeen: member.lastSeen,
        currentRiskScore: member.currentRiskScore,
        currentStatus: member.currentStatus,
        isNightModeActive: member.isNightModeActive,
        lastKnownLocation: member.isLocationSharingEnabled
          ? member.lastKnownLocation
          : null,
        isLocationSharingEnabled: member.isLocationSharingEnabled,
      },
    };
  });

  res.json({
    success: true,
    data: { familyMembers },
  });
});

export const removeFamilyMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const connection = await FamilyConnection.findOne({
    _id: id,
    $or: [{ requester: req.userId }, { recipient: req.userId }],
    status: FAMILY_REQUEST_STATUS.ACCEPTED,
  });

  if (!connection) {
    throw new AppError('Connection not found', 404);
  }

  await connection.deleteOne();

  res.json({
    success: true,
    message: 'Family member removed successfully',
  });
});

export const updateConnectionSettings = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { canViewLocation, canReceiveAlerts, relationship } = req.body;

  const connection = await FamilyConnection.findOne({
    _id: id,
    $or: [{ requester: req.userId }, { recipient: req.userId }],
    status: FAMILY_REQUEST_STATUS.ACCEPTED,
  });

  if (!connection) {
    throw new AppError('Connection not found', 404);
  }

  if (canViewLocation !== undefined) connection.canViewLocation = canViewLocation;
  if (canReceiveAlerts !== undefined) connection.canReceiveAlerts = canReceiveAlerts;
  if (relationship) connection.relationship = relationship;

  await connection.save();
  await connection.populate('requester recipient', 'name email avatar');

  res.json({
    success: true,
    message: 'Connection settings updated',
    data: { connection },
  });
});

export const cancelRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const connection = await FamilyConnection.findOne({
    _id: id,
    requester: req.userId,
    status: FAMILY_REQUEST_STATUS.PENDING,
  });

  if (!connection) {
    throw new AppError('Request not found or already processed', 404);
  }

  await connection.deleteOne();

  res.json({
    success: true,
    message: 'Request cancelled successfully',
  });
});
