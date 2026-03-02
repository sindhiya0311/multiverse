import { body, param, query, validationResult } from 'express-validator';

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }
  
  next();
};

export const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('phone')
    .optional()
    .matches(/^\+?[\d\s-]{10,}$/)
    .withMessage('Please provide a valid phone number'),
  validate,
];

export const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate,
];

export const taggedLocationValidation = [
  body('label')
    .trim()
    .notEmpty()
    .withMessage('Label is required')
    .isLength({ max: 100 })
    .withMessage('Label cannot exceed 100 characters'),
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('radius')
    .optional()
    .isInt({ min: 10, max: 5000 })
    .withMessage('Radius must be between 10 and 5000 meters'),
  body('type')
    .optional()
    .isIn(['home', 'office', 'friend', 'family', 'gym', 'school', 'hospital', 'custom'])
    .withMessage('Invalid location type'),
  validate,
];

export const locationUpdateValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('speed')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Speed must be a positive number'),
  body('accuracy')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Accuracy must be a positive number'),
  body('heading')
    .optional()
    .isFloat({ min: 0, max: 360 })
    .withMessage('Heading must be between 0 and 360'),
  validate,
];

export const familyRequestValidation = [
  body('recipientEmail')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('relationship')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Relationship cannot exceed 50 characters'),
  validate,
];

export const mongoIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  validate,
];

export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate,
];

export const sosValidation = [
  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Message cannot exceed 500 characters'),
  validate,
];

export const simulationValidation = [
  body('routeType')
    .optional()
    .isIn(['homeToOffice', 'nightWalk', 'erraticMovement'])
    .withMessage('Invalid route type'),
  body('intervalMs')
    .optional()
    .isInt({ min: 1000, max: 10000 })
    .withMessage('Interval must be between 1000 and 10000 ms'),
  validate,
];

export const anomalyInjectionValidation = [
  body('anomalyType')
    .isIn(['deviation', 'stop', 'entropy', 'all'])
    .withMessage('Invalid anomaly type'),
  validate,
];
