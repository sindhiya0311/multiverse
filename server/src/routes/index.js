import { Router } from 'express';
import authRoutes from './authRoutes.js';
import familyRoutes from './familyRoutes.js';
import locationRoutes from './locationRoutes.js';
import taggedLocationRoutes from './taggedLocationRoutes.js';
import alertRoutes from './alertRoutes.js';
import adminRoutes from './adminRoutes.js';
import simulationRoutes from './simulationRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/family', familyRoutes);
router.use('/location', locationRoutes);
router.use('/tagged-locations', taggedLocationRoutes);
router.use('/alerts', alertRoutes);
router.use('/admin', adminRoutes);
router.use('/simulation', simulationRoutes);

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'NOCTIS API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default router;
