import { Router } from 'express';
import {
  getDashboardStats,
  getActiveNightUsers,
  getLiveRiskHeatmap,
  getAllAlerts,
  getAlertAnalytics,
  getAllUsers,
  getUserDetails,
  updateUserRole,
} from '../controllers/adminController.js';
import { authenticate, isAdmin } from '../middleware/auth.js';
import { mongoIdValidation } from '../middleware/validation.js';

const router = Router();

router.use(authenticate);
router.use(isAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/night-users', getActiveNightUsers);
router.get('/heatmap', getLiveRiskHeatmap);

router.get('/alerts', getAllAlerts);
router.get('/alerts/analytics', getAlertAnalytics);

router.get('/users', getAllUsers);
router.get('/users/:id', mongoIdValidation, getUserDetails);
router.patch('/users/:id/role', mongoIdValidation, updateUserRole);

export default router;
