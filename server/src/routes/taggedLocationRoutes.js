import { Router } from 'express';
import {
  createTaggedLocation,
  getTaggedLocations,
  getTaggedLocation,
  updateTaggedLocation,
  deleteTaggedLocation,
  checkCurrentLocation,
  getLocationTypes,
} from '../controllers/taggedLocationController.js';
import { authenticate } from '../middleware/auth.js';
import { taggedLocationValidation, mongoIdValidation } from '../middleware/validation.js';

const router = Router();

router.use(authenticate);

router.get('/types', getLocationTypes);
router.get('/check', checkCurrentLocation);

router.route('/')
  .get(getTaggedLocations)
  .post(taggedLocationValidation, createTaggedLocation);

router.route('/:id')
  .get(mongoIdValidation, getTaggedLocation)
  .patch(mongoIdValidation, updateTaggedLocation)
  .delete(mongoIdValidation, deleteTaggedLocation);

export default router;
