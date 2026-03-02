import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import TaggedLocation from '../models/TaggedLocation.js';
import RiskZone from '../models/RiskZone.js';

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await User.deleteMany({});
    await TaggedLocation.deleteMany({});
    await RiskZone.deleteMany({});
    console.log('Cleared existing data');

    const adminUser = await User.create({
      email: 'admin@noctis.io',
      password: 'Admin@123',
      name: 'System Admin',
      phone: '+1234567890',
      role: 'admin',
    });

    const demoUser = await User.create({
      email: 'demo@noctis.io',
      password: 'Demo@123',
      name: 'Demo User',
      phone: '+1987654321',
      role: 'user',
    });

    const familyUser = await User.create({
      email: 'family@noctis.io',
      password: 'Family@123',
      name: 'Family Member',
      phone: '+1122334455',
      role: 'user',
    });

    console.log('Created users');

    await TaggedLocation.insertMany([
      {
        user: demoUser._id,
        label: 'Home',
        type: 'home',
        latitude: 40.7128,
        longitude: -74.006,
        radius: 100,
        address: '123 Main Street, New York, NY',
        icon: 'home',
        color: '#10B981',
      },
      {
        user: demoUser._id,
        label: 'Office',
        type: 'office',
        latitude: 40.7589,
        longitude: -73.9851,
        radius: 150,
        address: 'Times Square, New York, NY',
        icon: 'briefcase',
        color: '#3B82F6',
      },
      {
        user: demoUser._id,
        label: "Mom's House",
        type: 'family',
        latitude: 40.73,
        longitude: -73.935,
        radius: 100,
        address: '456 Oak Avenue, Brooklyn, NY',
        icon: 'heart',
        color: '#EC4899',
      },
      {
        user: demoUser._id,
        label: 'Gym',
        type: 'gym',
        latitude: 40.72,
        longitude: -74.0,
        radius: 80,
        address: 'Fitness Center, Manhattan',
        icon: 'dumbbell',
        color: '#F59E0B',
      },
    ]);

    console.log('Created tagged locations');

    await RiskZone.insertMany([
      {
        name: 'High Crime Area - Downtown',
        description: 'Known for late-night incidents',
        geometry: {
          type: 'Point',
          coordinates: [-74.005, 40.71],
        },
        radius: 500,
        riskLevel: 12,
        category: 'crime',
      },
      {
        name: 'Poor Lighting Area',
        description: 'Insufficient street lighting',
        geometry: {
          type: 'Point',
          coordinates: [-73.99, 40.725],
        },
        radius: 300,
        riskLevel: 8,
        category: 'lighting',
      },
      {
        name: 'Isolated Industrial Zone',
        description: 'Low foot traffic at night',
        geometry: {
          type: 'Point',
          coordinates: [-74.01, 40.735],
        },
        radius: 600,
        riskLevel: 10,
        category: 'isolated',
      },
    ]);

    console.log('Created risk zones');

    console.log(`
╔════════════════════════════════════════════════════════════╗
║                    Seed Data Complete                      ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║   Admin Account:                                           ║
║   Email: admin@noctis.io                                   ║
║   Password: Admin@123                                      ║
║                                                            ║
║   Demo Account:                                            ║
║   Email: demo@noctis.io                                    ║
║   Password: Demo@123                                       ║
║                                                            ║
║   Family Account:                                          ║
║   Email: family@noctis.io                                  ║
║   Password: Family@123                                     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
