import { Router } from 'express';
import {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  updatePassword,
  toggleLocationSharing,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { registerValidation, loginValidation } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, registerValidation, register);
router.post('/login', authLimiter, loginValidation, login);

router.use(authenticate);

router.post('/logout', logout);
router.get('/me', getMe);
router.patch('/profile', updateProfile);
router.patch('/password', updatePassword);
router.patch('/toggle-location-sharing', toggleLocationSharing);

export default router;
