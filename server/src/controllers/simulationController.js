import { asyncHandler, AppError } from '../middleware/errorHandler.js';

const simulationMessage = 'Simulations are no longer supported. NOCTIS now uses real GPS data for all risk calculations.';

export const startSimulation = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});

export const stopSimulation = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});

export const getSimulationStatus = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});

export const getNextSimulatedLocation = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});

export const injectAnomaly = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});

export const clearAnomaly = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});

export const getAvailableRoutes = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});

export const setCustomRoute = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});

export const generateRandomRoute = asyncHandler(async (req, res) => {
  throw new AppError(simulationMessage, 410);
});
