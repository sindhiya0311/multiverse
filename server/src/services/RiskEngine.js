import {
  RISK_WEIGHTS,
  NIGHT_MODE,
  RISK_THRESHOLDS,
  SPEED_SAMPLE_SIZE,
} from '../config/constants.js';
import LocationLog from '../models/LocationLog.js';
import TaggedLocation from '../models/TaggedLocation.js';
import RiskZone from '../models/RiskZone.js';

class RiskEngine {
  constructor() {
    this.expectedRoutes = new Map();
    this.userSpeedHistory = new Map();
    this.userStopInfo = new Map();
  }

  async calculateRiskScore(userId, currentLocation, previousLocations = []) {
    const breakdown = {
      routeDeviation: 0,
      stopDuration: 0,
      speedEntropy: 0,
      locationRisk: 0,
      nightMultiplier: 1,
    };

    const anomalies = [];

    breakdown.routeDeviation = await this.calculateRouteDeviationScore(
      userId,
      currentLocation,
      previousLocations,
      anomalies
    );

    breakdown.stopDuration = this.calculateStopDurationScore(
      userId,
      currentLocation,
      previousLocations,
      anomalies
    );

    breakdown.speedEntropy = await this.calculateSpeedEntropyScore(
      userId,
      currentLocation.speed,
      anomalies
    );

    breakdown.locationRisk = await this.calculateLocationRiskScore(
      currentLocation.latitude,
      currentLocation.longitude,
      anomalies
    );

    breakdown.nightMultiplier = this.getNightMultiplier();

    const baseScore =
      breakdown.routeDeviation +
      breakdown.stopDuration +
      breakdown.speedEntropy +
      breakdown.locationRisk;

    let finalScore = Math.round(baseScore * breakdown.nightMultiplier);
    finalScore = Math.min(100, Math.max(0, finalScore));

    const alertLevel = this.determineAlertLevel(finalScore, anomalies);

    return {
      score: finalScore,
      breakdown,
      anomalies,
      alertLevel,
      isNightMode: breakdown.nightMultiplier > 1,
      timestamp: new Date(),
    };
  }

  async calculateRouteDeviationScore(userId, currentLocation, previousLocations, anomalies) {
    const expectedRoute = this.expectedRoutes.get(userId.toString());
    
    if (!expectedRoute || previousLocations.length < 3) {
      return 0;
    }

    const deviationPercent = this.calculateDeviationFromExpectedRoute(
      currentLocation,
      expectedRoute
    );

    let score = 0;
    for (const threshold of RISK_WEIGHTS.ROUTE_DEVIATION.THRESHOLDS) {
      if (deviationPercent <= threshold.max) {
        score = threshold.score;
        break;
      }
    }

    if (score >= 20) {
      anomalies.push({
        type: 'route_deviation',
        severity: score >= 25 ? 'high' : 'medium',
        description: `Route deviation: ${deviationPercent.toFixed(1)}% from expected path`,
        value: deviationPercent,
      });
    }

    return score;
  }

  calculateDeviationFromExpectedRoute(currentLocation, expectedRoute) {
    if (!expectedRoute || expectedRoute.length < 2) return 0;

    let minDistance = Infinity;
    for (const point of expectedRoute) {
      const distance = this.haversineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        point.latitude,
        point.longitude
      );
      minDistance = Math.min(minDistance, distance);
    }

    const thresholdDistance = 500;
    const deviationPercent = (minDistance / thresholdDistance) * 100;
    return Math.min(100, deviationPercent);
  }

  calculateStopDurationScore(userId, currentLocation, previousLocations, anomalies) {
    const userIdStr = userId.toString();
    const currentTime = Date.now();
    const isStationary = currentLocation.speed < 1;

    if (isStationary) {
      if (!this.userStopInfo.has(userIdStr)) {
        this.userStopInfo.set(userIdStr, {
          startTime: currentTime,
          location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
        });
      }

      const stopInfo = this.userStopInfo.get(userIdStr);
      const stopDurationMinutes = (currentTime - stopInfo.startTime) / (1000 * 60);

      let score = 0;
      for (const threshold of RISK_WEIGHTS.STOP_DURATION.THRESHOLDS) {
        if (stopDurationMinutes <= threshold.max) {
          score = threshold.score;
          break;
        }
      }

      if (score >= 10) {
        anomalies.push({
          type: 'unexpected_stop',
          severity: score >= 20 ? 'high' : 'medium',
          description: `Unexpected stop: ${stopDurationMinutes.toFixed(1)} minutes in unknown area`,
          value: stopDurationMinutes,
        });
      }

      return score;
    } else {
      this.userStopInfo.delete(userIdStr);
      return 0;
    }
  }

  async calculateSpeedEntropyScore(userId, currentSpeed, anomalies) {
    const userIdStr = userId.toString();

    if (!this.userSpeedHistory.has(userIdStr)) {
      this.userSpeedHistory.set(userIdStr, []);
    }

    const speedHistory = this.userSpeedHistory.get(userIdStr);
    speedHistory.push(currentSpeed || 0);

    if (speedHistory.length > SPEED_SAMPLE_SIZE) {
      speedHistory.shift();
    }

    if (speedHistory.length < SPEED_SAMPLE_SIZE) {
      return 0;
    }

    const variance = this.calculateVariance(speedHistory);

    let score = 0;
    for (const threshold of RISK_WEIGHTS.SPEED_ENTROPY.THRESHOLDS) {
      if (variance <= threshold.max) {
        score = threshold.score;
        break;
      }
    }

    if (score >= 10) {
      anomalies.push({
        type: 'speed_anomaly',
        severity: score >= 15 ? 'high' : 'medium',
        description: `Speed variance anomaly: ${variance.toFixed(2)} (erratic movement pattern)`,
        value: variance,
      });
    }

    return score;
  }

  async calculateLocationRiskScore(latitude, longitude, anomalies) {
    try {
      const riskWeight = await RiskZone.getRiskWeightForLocation(latitude, longitude);
      
      if (riskWeight > 0) {
        anomalies.push({
          type: 'high_risk_zone',
          severity: riskWeight >= 10 ? 'high' : 'medium',
          description: `Currently in a high-risk zone (risk level: ${riskWeight})`,
          value: riskWeight,
        });
      }

      return Math.min(riskWeight, RISK_WEIGHTS.LOCATION_RISK.MAX_SCORE);
    } catch (error) {
      return 0;
    }
  }

  getNightMultiplier() {
    const hour = new Date().getHours();

    for (const period of Object.values(NIGHT_MODE.MULTIPLIERS)) {
      if (period.start <= period.end) {
        if (hour >= period.start && hour < period.end) {
          return period.multiplier;
        }
      } else {
        if (hour >= period.start || hour < period.end) {
          return period.multiplier;
        }
      }
    }

    return 1;
  }

  isNightModeActive() {
    const hour = new Date().getHours();
    return hour >= NIGHT_MODE.START_HOUR || hour < NIGHT_MODE.END_HOUR;
  }

  determineAlertLevel(score, anomalies) {
    const uniqueAnomalyTypes = new Set(anomalies.map((a) => a.type));

    if (score >= RISK_THRESHOLDS.RED && uniqueAnomalyTypes.size >= 2) {
      return 'red';
    } else if (score >= RISK_THRESHOLDS.ORANGE) {
      return 'orange';
    } else if (score >= RISK_THRESHOLDS.ELEVATED) {
      return 'elevated';
    }
    return 'safe';
  }

  setExpectedRoute(userId, route) {
    this.expectedRoutes.set(userId.toString(), route);
  }

  clearExpectedRoute(userId) {
    this.expectedRoutes.delete(userId.toString());
  }

  clearUserData(userId) {
    const userIdStr = userId.toString();
    this.expectedRoutes.delete(userIdStr);
    this.userSpeedHistory.delete(userIdStr);
    this.userStopInfo.delete(userIdStr);
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  injectDeviation(userId, deviationPercent) {
    const userIdStr = userId.toString();
    const currentRoute = this.expectedRoutes.get(userIdStr) || [];
    
    if (currentRoute.length > 0) {
      return {
        injected: true,
        deviationPercent,
        message: `Simulated ${deviationPercent}% route deviation`,
      };
    }
    return { injected: false, message: 'No expected route set' };
  }

  injectStop(userId, durationMinutes) {
    const userIdStr = userId.toString();
    const startTime = Date.now() - durationMinutes * 60 * 1000;
    
    this.userStopInfo.set(userIdStr, {
      startTime,
      location: { latitude: 0, longitude: 0 },
      simulated: true,
    });

    return {
      injected: true,
      durationMinutes,
      message: `Simulated ${durationMinutes} minute stop`,
    };
  }

  injectSpeedEntropy(userId, varianceLevel) {
    const userIdStr = userId.toString();
    const erraticSpeeds = [];
    
    for (let i = 0; i < SPEED_SAMPLE_SIZE; i++) {
      const baseSpeed = 30;
      const variance = (Math.random() - 0.5) * varianceLevel * 2;
      erraticSpeeds.push(Math.max(0, baseSpeed + variance));
    }

    this.userSpeedHistory.set(userIdStr, erraticSpeeds);

    return {
      injected: true,
      varianceLevel,
      message: `Simulated speed entropy with variance level ${varianceLevel}`,
    };
  }
}

const riskEngine = new RiskEngine();
export default riskEngine;
