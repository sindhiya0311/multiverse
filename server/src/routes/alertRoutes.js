import { Router } from 'express';
import {
  triggerSOS,
  getMyAlerts,
  getActiveAlerts,
  getFamilyAlerts,
  acknowledgeAlert,
  resolveAlert,
  markAsFalseAlarm,
  getAlertDetails,
} from '../controllers/alertController.js';
import { authenticate } from '../middleware/auth.js';
import { sosValidation, mongoIdValidation } from '../middleware/validation.js';
import { sosLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.use(authenticate);

router.post('/sos', sosLimiter, sosValidation, triggerSOS);
router.get('/my', getMyAlerts);
router.get('/active', getActiveAlerts);
router.get('/family', getFamilyAlerts);

router.get('/:id', mongoIdValidation, getAlertDetails);
router.post('/:id/acknowledge', mongoIdValidation, acknowledgeAlert);
router.post('/:id/resolve', mongoIdValidation, resolveAlert);
router.post('/:id/false-alarm', mongoIdValidation, markAsFalseAlarm);

export default router;
