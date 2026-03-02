export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
};

export const FAMILY_REQUEST_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
};

export const ALERT_TYPES = {
  SHADOW: 'shadow',
  SOS: 'sos',
  SYSTEM: 'system',
};

export const ALERT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

export const RISK_THRESHOLDS = {
  SAFE: 0,
  ELEVATED: 40,
  ORANGE: 60,
  RED: 80,
};

export const NIGHT_MODE = {
  START_HOUR: 22,
  END_HOUR: 5,
  MULTIPLIERS: {
    EARLY_NIGHT: { start: 22, end: 24, multiplier: 1.2 },
    DEEP_NIGHT: { start: 0, end: 4, multiplier: 1.5 },
    LATE_NIGHT: { start: 4, end: 5, multiplier: 1.3 },
  },
};

export const RISK_WEIGHTS = {
  ROUTE_DEVIATION: {
    MAX_SCORE: 30,
    THRESHOLDS: [
      { max: 10, score: 0 },
      { max: 25, score: 10 },
      { max: 40, score: 20 },
      { max: 100, score: 30 },
    ],
  },
  STOP_DURATION: {
    MAX_SCORE: 25,
    THRESHOLDS: [
      { max: 2, score: 0 },
      { max: 4, score: 10 },
      { max: 7, score: 20 },
      { max: Infinity, score: 25 },
    ],
  },
  SPEED_ENTROPY: {
    MAX_SCORE: 20,
    THRESHOLDS: [
      { max: 20, score: 0 },
      { max: 50, score: 10 },
      { max: Infinity, score: 20 },
    ],
  },
  LOCATION_RISK: {
    MAX_SCORE: 15,
  },
};

export const LOCATION_UPDATE_INTERVAL = 3000;
export const SPEED_SAMPLE_SIZE = 10;
export const STATIONARY_THRESHOLD_MINUTES = 3;
export const DEFAULT_TAGGED_RADIUS = 100;
