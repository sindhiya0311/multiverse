import { Router } from 'express';
import {
  updateLocation,
  getLocationHistory,
  getRiskHistory,
  getFamilyMemberLocation,
  setExpectedRoute,
  clearExpectedRoute,
} from '../controllers/locationController.js';
import { authenticate } from '../middleware/auth.js';
import { locationUpdateValidation, mongoIdValidation } from '../middleware/validation.js';
import { locationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(authenticate);

router.post('/update', locationLimiter, locationUpdateValidation, updateLocation);
router.get('/history', getLocationHistory);
router.get('/risk-history', getRiskHistory);
router.get('/family/:memberId', getFamilyMemberLocation);

router.post('/expected-route', setExpectedRoute);
router.delete('/expected-route', clearExpectedRoute);

export default router;
