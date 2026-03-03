import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const register = asyncHandler(async (req, res) => {
  const { email, password, name, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('Email already registered', 400);
  }

  const userData = { email, password, name };
  if (phone && String(phone).trim()) {
    userData.phone = String(phone).trim();
  }
  const user = await User.create(userData);

  const token = generateToken(user._id);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: user.toPublicJSON(),
      token,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: user.toPublicJSON(),
      token,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.userId, {
    isOnline: false,
    lastSeen: new Date(),
  });

  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    data: { user: user.toPublicJSON() },
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const allowedUpdates = ['name', 'phone', 'avatar', 'settings'];
  const updates = {};

  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  const user = await User.findByIdAndUpdate(req.userId, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: user.toPublicJSON() },
  });
});

export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.userId).select('+password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError('Current password is incorrect', 400);
  }

  user.password = newPassword;
  await user.save();

  const token = generateToken(user._id);

  res.json({
    success: true,
    message: 'Password updated successfully',
    data: { token },
  });
});

export const toggleLocationSharing = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.isLocationSharingEnabled = !user.isLocationSharingEnabled;
  await user.save({ validateBeforeSave: false });

  res.json({
    success: true,
    message: `Location sharing ${user.isLocationSharingEnabled ? 'enabled' : 'disabled'}`,
    data: { isLocationSharingEnabled: user.isLocationSharingEnabled },
  });
});
