import { Router } from 'express';
import {
  startSimulation,
  stopSimulation,
  getSimulationStatus,
  getNextSimulatedLocation,
  injectAnomaly,
  clearAnomaly,
  getAvailableRoutes,
  setCustomRoute,
  generateRandomRoute,
} from '../controllers/simulationController.js';
import { authenticate } from '../middleware/auth.js';
import { simulationValidation, anomalyInjectionValidation } from '../middleware/validation.js';

const router = Router();

router.use(authenticate);

router.get('/routes', getAvailableRoutes);
router.get('/status', getSimulationStatus);

router.post('/start', simulationValidation, startSimulation);
router.post('/stop', stopSimulation);
router.post('/next', getNextSimulatedLocation);

router.post('/inject-anomaly', anomalyInjectionValidation, injectAnomaly);
router.post('/clear-anomaly', clearAnomaly);

router.post('/custom-route', setCustomRoute);
router.post('/random-route', generateRandomRoute);

export default router;
