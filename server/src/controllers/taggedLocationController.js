import TaggedLocation from '../models/TaggedLocation.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const createTaggedLocation = asyncHandler(async (req, res) => {
  const {
    label,
    type,
    latitude,
    longitude,
    radius,
    address,
    isHighRisk,
    riskWeight,
    icon,
    color,
  } = req.body;

  const existingLocation = await TaggedLocation.findOne({
    user: req.userId,
    label: label.trim(),
  });

  if (existingLocation) {
    throw new AppError('A location with this label already exists', 400);
  }

  const taggedLocation = await TaggedLocation.create({
    user: req.userId,
    label: label.trim(),
    type: type || 'custom',
    latitude,
    longitude,
    radius: radius || 100,
    address,
    isHighRisk: isHighRisk || false,
    riskWeight: riskWeight || 0,
    icon: icon || 'location',
    color: color || '#3B82F6',
  });

  res.status(201).json({
    success: true,
    message: 'Tagged location created successfully',
    data: { location: taggedLocation },
  });
});

export const getTaggedLocations = asyncHandler(async (req, res) => {
  const { type, isActive } = req.query;

  const query = { user: req.userId };
  if (type) query.type = type;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  const locations = await TaggedLocation.find(query).sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { locations },
  });
});

export const getTaggedLocation = asyncHandler(async (req, res) => {
  const location = await TaggedLocation.findOne({
    _id: req.params.id,
    user: req.userId,
  });

  if (!location) {
    throw new AppError('Tagged location not found', 404);
  }

  res.json({
    success: true,
    data: { location },
  });
});

export const updateTaggedLocation = asyncHandler(async (req, res) => {
  const allowedUpdates = [
    'label',
    'type',
    'latitude',
    'longitude',
    'radius',
    'address',
    'isHighRisk',
    'riskWeight',
    'icon',
    'color',
    'isActive',
  ];

  const updates = {};
  for (const key of allowedUpdates) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  const location = await TaggedLocation.findOneAndUpdate(
    { _id: req.params.id, user: req.userId },
    updates,
    { new: true, runValidators: true }
  );

  if (!location) {
    throw new AppError('Tagged location not found', 404);
  }

  res.json({
    success: true,
    message: 'Tagged location updated successfully',
    data: { location },
  });
});

export const deleteTaggedLocation = asyncHandler(async (req, res) => {
  const location = await TaggedLocation.findOneAndDelete({
    _id: req.params.id,
    user: req.userId,
  });

  if (!location) {
    throw new AppError('Tagged location not found', 404);
  }

  res.json({
    success: true,
    message: 'Tagged location deleted successfully',
  });
});

export const checkCurrentLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.query;

  if (!latitude || !longitude) {
    throw new AppError('Latitude and longitude are required', 400);
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  const nearbyLocations = await TaggedLocation.findNearbyTagged(
    req.userId,
    lat,
    lng
  );

  res.json({
    success: true,
    data: {
      isInTaggedLocation: nearbyLocations.length > 0,
      locations: nearbyLocations,
    },
  });
});

export const getLocationTypes = asyncHandler(async (req, res) => {
  const types = [
    { id: 'home', label: 'Home', icon: 'home', color: '#10B981' },
    { id: 'office', label: 'Office', icon: 'briefcase', color: '#3B82F6' },
    { id: 'friend', label: "Friend's House", icon: 'users', color: '#8B5CF6' },
    { id: 'family', label: "Family's House", icon: 'heart', color: '#EC4899' },
    { id: 'gym', label: 'Gym', icon: 'dumbbell', color: '#F59E0B' },
    { id: 'school', label: 'School', icon: 'graduation-cap', color: '#6366F1' },
    { id: 'hospital', label: 'Hospital', icon: 'hospital', color: '#EF4444' },
    { id: 'custom', label: 'Custom', icon: 'map-pin', color: '#6B7280' },
  ];

  res.json({
    success: true,
    data: { types },
  });
});
