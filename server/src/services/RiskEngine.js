import {
  RISK_WEIGHTS,
  NIGHT_MODE,
  RISK_THRESHOLDS,
  SPEED_SAMPLE_SIZE,
} from '../config/constants.js';
import LocationLog from '../models/LocationLog.js';
import TaggedLocation from '../models/TaggedLocation.js';
import RiskZone from '../models/RiskZone.js';

/**
 * REAL-TIME RISK ENGINE
 * 
 * Computes predictive behavioral safety scores based on:
 * 1. Route deviation from historical patterns
 * 2. Stop duration in unknown zones
 * 3. Speed entropy (erratic movement)
 * 4. Location risk weight (high-crime zones)
 * 5. Night mode amplification
 */
class RiskEngine {
  constructor() {
    // Rolling window: store last 20 location points per user
    this.userLocationBuffer = new Map();
    
    // Track expected routes from historical data
    this.userRouteClusters = new Map();
    
    // Track stop information per user
    this.userStopInfo = new Map();
    
    // Track speed variance per user
    this.userSpeedBuffer = new Map();
    
    // Active anomalies per user
    this.userAnomalies = new Map();
  }

  /**
   * MAIN RISK CALCULATION
   * Real-time computation on every location update
   */
  async calculateRealTimeRiskScore(userId, currentLocation, isNightMode = false) {
    try {
      const userIdStr = userId.toString();
      
      // Initialize buffers if needed
      this.initializeUserBuffers(userIdStr);
      
      // Get last 20 location points
      const previousLocations = this.userLocationBuffer.get(userIdStr) || [];
      
      // Add current location to buffer
      previousLocations.push({
        ...currentLocation,
        timestamp: Date.now(),
      });
      
      // Keep only last 20 points
      if (previousLocations.length > 20) {
        previousLocations.shift();
      }
      this.userLocationBuffer.set(userIdStr, previousLocations);
      
      // Compute risk components
      const breakdown = {
        routeDeviation: 0,
        stopDuration: 0,
        speedEntropy: 0,
        locationRiskWeight: 0,
        nightMultiplier: 1,
      };
      
      const anomalies = [];
      
      // 1. ROUTE DEVIATION SCORE (0-30)
      if (previousLocations.length >= 3) {
        breakdown.routeDeviation = await this.calculateRouteDeviation(
          userIdStr,
          currentLocation,
          previousLocations,
          anomalies
        );
      }
      
      // 2. STOP DURATION ANOMALY (0-25)
      breakdown.stopDuration = await this.calculateStopDurationScore(
        userIdStr,
        currentLocation,
        previousLocations,
        anomalies
      );
      
      // 3. DRIVING PATTERN ENTROPY (0-20)
      breakdown.speedEntropy = this.calculateSpeedEntropy(
        userIdStr,
        currentLocation.speed,
        anomalies
      );
      
      // 4. LOCATION RISK WEIGHT (0-15)
      breakdown.locationRiskWeight = await this.calculateLocationRiskWeight(
        currentLocation.latitude,
        currentLocation.longitude,
        anomalies
      );
      
      // 5. NIGHT MODE AMPLIFIER
      breakdown.nightMultiplier = isNightMode ? this.getNightMultiplier() : 1;
      
      // Calculate base score
      const baseScore =
        breakdown.routeDeviation +
        breakdown.stopDuration +
        breakdown.speedEntropy +
        breakdown.locationRiskWeight;
      
      // Apply night multiplier
      let finalScore = Math.round(baseScore * breakdown.nightMultiplier);
      finalScore = Math.min(100, Math.max(0, finalScore));
      
      // Determine alert level
      const alertLevel = this.determineAlertLevel(finalScore, anomalies);
      
      // Cache anomalies for this user
      this.userAnomalies.set(userIdStr, {
        anomalies,
        timestamp: Date.now(),
      });
      
      return {
        score: finalScore,
        baseScore,
        breakdown,
        anomalies,
        alertLevel,
        isNightMode,
        anomalyCount: anomalies.length,
        multipleAnomalyCategories: this.countAnomalyCategories(anomalies) >= 2,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Risk calculation error:', error);
      return {
        score: 0,
        baseScore: 0,
        breakdown: { routeDeviation: 0, stopDuration: 0, speedEntropy: 0, locationRiskWeight: 0, nightMultiplier: 1 },
        anomalies: [],
        alertLevel: 'safe',
        error: error.message,
      };
    }
  }

  /**
   * 1️⃣ ROUTE DEVIATION SCORE
   * 
   * Build expected route from historical trips.
   * Compute perpendicular distance from corridor.
   * Calculate deviation percentage.
   */
  async calculateRouteDeviation(userIdStr, currentLocation, previousLocations, anomalies) {
    try {
      // Need minimum 5 historical points
      if (previousLocations.length < 5) {
        return 0;
      }
      
      // Build route corridor from last 10 points
      const routePoints = previousLocations.slice(-10).map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));
      
      // Calculate perpendicular distance to route line
      let minDistance = Infinity;
      
      for (let i = 0; i < routePoints.length - 1; i++) {
        const p1 = routePoints[i];
        const p2 = routePoints[i + 1];
        
        // Distance from current point to line segment (p1-p2)
        const distance = this.distancePointToLineSegment(
          currentLocation.latitude,
          currentLocation.longitude,
          p1.latitude,
          p1.longitude,
          p2.latitude,
          p2.longitude
        );
        
        minDistance = Math.min(minDistance, distance);
      }
      
      // Deviation threshold: 500 meters
      const corridorWidth = 500;
      const deviationPercent = (minDistance / corridorWidth) * 100;
      const clampedDeviation = Math.min(100, deviationPercent);
      
      // Apply thresholds
      let score = 0;
      if (clampedDeviation < 10) {
        score = 0;
      } else if (clampedDeviation < 25) {
        score = 10;
      } else if (clampedDeviation < 40) {
        score = 20;
      } else {
        score = 30;
      }
      
      // Record anomaly if significant deviation
      if (score >= 20) {
        anomalies.push({
          type: 'route_deviation',
          severity: score >= 25 ? 'high' : 'medium',
          description: `Route deviation: ${clampedDeviation.toFixed(1)}%`,
          value: clampedDeviation,
          distance_meters: minDistance,
        });
      }
      
      return score;
    } catch (error) {
      console.error('Route deviation calculation error:', error);
      return 0;
    }
  }

  /**
   * 2️⃣ STOP DURATION ANOMALY
   * 
   * Detect if speed < 2 km/h (stationary).
   * Track duration in unknown zones.
   */
  async calculateStopDurationScore(userIdStr, currentLocation, previousLocations, anomalies) {
    try {
      // Speed < 2 km/h indicates stationary
      const STATIONARY_SPEED_THRESHOLD = 2; // km/h
      const isStationary = (currentLocation.speed || 0) < STATIONARY_SPEED_THRESHOLD;
      
      if (isStationary) {
        // Check if in tagged location (home, office, etc)
        const taggedLocations = await TaggedLocation.find({
          user: userIdStr,
          isActive: true,
        });
        
        const inTaggedLocation = taggedLocations.some(loc =>
          loc.isWithinRadius(currentLocation.latitude, currentLocation.longitude)
        );
        
        // If in tagged location, no anomaly
        if (inTaggedLocation) {
          this.userStopInfo.delete(userIdStr);
          return 0;
        }
        
        // Track stop duration in unknown zone
        const stopInfo = this.userStopInfo.get(userIdStr) || {
          startTime: Date.now(),
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        };
        
        const stopDurationMinutes = (Date.now() - stopInfo.startTime) / (1000 * 60);
        
        let score = 0;
        if (stopDurationMinutes >= 7) {
          score = 25;
        } else if (stopDurationMinutes >= 4) {
          score = 20;
        } else if (stopDurationMinutes >= 2) {
          score = 10;
        } else {
          score = 0;
        }
        
        // Record anomaly if duration significant
        if (score >= 10) {
          anomalies.push({
            type: 'stop_duration',
            severity: score >= 20 ? 'high' : 'medium',
            description: `Stopped in unknown area: ${stopDurationMinutes.toFixed(1)} minutes`,
            value: stopDurationMinutes,
          });
        }
        
        // Update stop info
        this.userStopInfo.set(userIdStr, stopInfo);
        
        return score;
      } else {
        // User is moving, reset stop tracking
        this.userStopInfo.delete(userIdStr);
        return 0;
      }
    } catch (error) {
      console.error('Stop duration calculation error:', error);
      return 0;
    }
  }

  /**
   * 3️⃣ DRIVING PATTERN ENTROPY
   * 
   * Maintain rolling speed array (last 10 samples).
   * Calculate variance for erratic detection.
   */
  calculateSpeedEntropy(userIdStr, currentSpeed, anomalies) {
    try {
      // Initialize speed buffer
      if (!this.userSpeedBuffer.has(userIdStr)) {
        this.userSpeedBuffer.set(userIdStr, []);
      }
      
      const speedBuffer = this.userSpeedBuffer.get(userIdStr);
      speedBuffer.push(currentSpeed || 0);
      
      // Keep only last 10 samples
      if (speedBuffer.length > 10) {
        speedBuffer.shift();
      }
      
      // Need minimum 5 samples for variance
      if (speedBuffer.length < 5) {
        return 0;
      }
      
      // Calculate variance
      const variance = this.calculateVariance(speedBuffer);
      
      let score = 0;
      if (variance >= 50) {
        score = 20;
      } else if (variance >= 20) {
        score = 10;
      } else {
        score = 0;
      }
      
      // Record anomaly if erratic
      if (score >= 10) {
        anomalies.push({
          type: 'speed_entropy',
          severity: score >= 15 ? 'high' : 'medium',
          description: `Erratic speed pattern: variance ${variance.toFixed(2)}`,
          value: variance,
        });
      }
      
      return score;
    } catch (error) {
      console.error('Speed entropy calculation error:', error);
      return 0;
    }
  }

  /**
   * 4️⃣ LOCATION RISK WEIGHT
   * 
   * Check if in high-risk zone geofence.
   */
  async calculateLocationRiskWeight(latitude, longitude, anomalies) {
    try {
      // Query nearby risk zones
      const riskZones = await RiskZone.find({
        isActive: true,
        geometry: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: 1000, // 1km
          },
        },
      }).limit(5);
      
      if (riskZones.length === 0) {
        return 0;
      }
      
      // Get maximum risk level
      const maxRisk = Math.max(...riskZones.map(z => z.riskLevel));
      const score = Math.min(maxRisk, RISK_WEIGHTS.LOCATION_RISK.MAX_SCORE);
      
      if (score > 0) {
        anomalies.push({
          type: 'high_risk_zone',
          severity: score >= 10 ? 'high' : 'medium',
          description: `In high-risk zone (level: ${score})`,
          value: score,
          zones: riskZones.map(z => z.name),
        });
      }
      
      return score;
    } catch (error) {
      console.error('Location risk calculation error:', error);
      return 0;
    }
  }

  /**
   * 5️⃣ NIGHT MODE AMPLIFIER
   * 
   * 22:00-24:00 → 1.2x
   * 00:00-04:00 → 1.5x
   * 04:00-05:00 → 1.3x
   */
  getNightMultiplier() {
    const hour = new Date().getHours();
    
    if (hour >= 22 || hour < 5) {
      if (hour >= 22) {
        return 1.2; // 22-24
      } else if (hour < 4) {
        return 1.5; // 00-04
      } else {
        return 1.3; // 04-05
      }
    }
    
    return 1; // Not night mode
  }

  /**
   * Determine alert level based on score and anomalies
   */
  determineAlertLevel(score, anomalies) {
    const anomalyCategories = new Set(anomalies.map(a => a.type)).size;
    
    // RED: ≥80 AND at least 2 anomaly categories
    if (score >= 80 && anomalyCategories >= 2) {
      return 'red';
    }
    
    // ORANGE: ≥60
    if (score >= 60) {
      return 'orange';
    }
    
    // ELEVATED: ≥40
    if (score >= 40) {
      return 'elevated';
    }
    
    return 'safe';
  }

  /**
   * Helper: Count unique anomaly categories
   */
  countAnomalyCategories(anomalies) {
    return new Set(anomalies.map(a => a.type)).size;
  }

  /**
   * Helper: Calculate distance from point to line segment
   */
  distancePointToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy) * 111000; // Convert degrees to meters
  }

  /**
   * Helper: Haversine distance
   */
  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // meters
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

  /**
   * Helper: Calculate variance
   */
  calculateVariance(values) {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Clear user data on logout
   */
  clearUserData(userId) {
    const userIdStr = userId.toString();
    this.userLocationBuffer.delete(userIdStr);
    this.userRouteClusters.delete(userIdStr);
    this.userStopInfo.delete(userIdStr);
    this.userSpeedBuffer.delete(userIdStr);
    this.userAnomalies.delete(userIdStr);
  }

  /**
   * Initialize user buffers
   */
  initializeUserBuffers(userIdStr) {
    if (!this.userLocationBuffer.has(userIdStr)) {
      this.userLocationBuffer.set(userIdStr, []);
    }
    if (!this.userSpeedBuffer.has(userIdStr)) {
      this.userSpeedBuffer.set(userIdStr, []);
    }
  }
}

const riskEngine = new RiskEngine();
export default riskEngine;
