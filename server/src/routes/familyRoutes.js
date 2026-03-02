import { Router } from 'express';
import {
  sendFamilyRequest,
  getPendingRequests,
  getSentRequests,
  respondToRequest,
  getFamilyMembers,
  removeFamilyMember,
  updateConnectionSettings,
  cancelRequest,
} from '../controllers/familyController.js';
import { authenticate } from '../middleware/auth.js';
import { familyRequestValidation, mongoIdValidation } from '../middleware/validation.js';

const router = Router();

router.use(authenticate);

router.post('/request', familyRequestValidation, sendFamilyRequest);
router.get('/requests/pending', getPendingRequests);
router.get('/requests/sent', getSentRequests);
router.post('/requests/:id/respond', mongoIdValidation, respondToRequest);
router.delete('/requests/:id/cancel', mongoIdValidation, cancelRequest);

router.get('/members', getFamilyMembers);
router.delete('/members/:id', mongoIdValidation, removeFamilyMember);
router.patch('/members/:id/settings', mongoIdValidation, updateConnectionSettings);

export default router;
