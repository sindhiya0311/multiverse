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
      
      // Check for GPS teleportation (impossible jump)
      // Compare current with PREVIOUS point (index -2), not the one we just pushed
      let isTeleportation = false;
      if (previousLocations.length >= 2) {
        const prevLoc = previousLocations[previousLocations.length - 2];
        const prevTs = prevLoc.timestamp || Date.now();
        const currTs = currentLocation.timestamp ? new Date(currentLocation.timestamp).getTime() : Date.now();
        const timeDiffSec = Math.max(0.1, (currTs - prevTs) / 1000);
        const distance = this.haversineDistance(
          prevLoc.latitude,
          prevLoc.longitude,
          currentLocation.latitude,
          currentLocation.longitude
        );
        
        // Impossible speed check: >1000 km/h = GPS glitch
        const speedMps = distance / timeDiffSec;
        const speedKmh = speedMps * 3.6;
        
        if (speedKmh > 1000) {
          isTeleportation = true;
          console.warn(`GPS teleportation detected: ${speedKmh.toFixed(0)} km/h, ignoring this update`);
          return {
            score: 0,
            baseScore: 0,
            breakdown,
            anomalies: [],
            alertLevel: 'safe',
            isNightMode,
            anomalyCount: 0,
            multipleAnomalyCategories: false,
            timestamp: new Date(),
            warning: 'GPS_GLITCH_DETECTED',
          };
        }
      }
      
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
   * 
   * Filter out single bad GPS points to reduce false positives.
   */
  async calculateRouteDeviation(userIdStr, currentLocation, previousLocations, anomalies) {
    try {
      // Need minimum 5 historical points for reliable route
      if (previousLocations.length < 5) {
        return 0;
      }
      
      // Filter out points with very poor accuracy (>500m likely GPS noise)
      const qualityPoints = previousLocations.filter(loc => 
        (loc.accuracy !== undefined && loc.accuracy <= 500) || loc.accuracy === undefined
      );
      
      // If too many points filtered, route is unreliable
      if (qualityPoints.length < 3) {
        console.warn('Insufficient quality GPS points for route deviation');
        return 0;
      }
      
      // Build route corridor from last 10 good quality points
      const routePoints = qualityPoints.slice(-10).map(loc => ({
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
      
      // Apply thresholds - require stronger deviation to trigger
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
      
      // Record anomaly only if strong and consistent deviation
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
   * Reset tracking when user moves OR at day boundary.
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
          startDate: new Date().toDateString(), // Track date for daily reset
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        };
        
        // Reset stop if it's a new day
        const currentDate = new Date().toDateString();
        if (stopInfo.startDate !== currentDate) {
          // New day, reset stop tracking
          this.userStopInfo.set(userIdStr, {
            startTime: Date.now(),
            startDate: currentDate,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          });
          return 0;
        }
        
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
   * Filter out normal acceleration patterns.
   */
  calculateSpeedEntropy(userIdStr, currentSpeed, anomalies) {
    try {
      // Clamp negative speed (invalid GPS data)
      const speed = Math.max(0, parseFloat(currentSpeed) || 0);

      if (!this.userSpeedBuffer.has(userIdStr)) {
        this.userSpeedBuffer.set(userIdStr, []);
      }

      const speedBuffer = this.userSpeedBuffer.get(userIdStr);
      speedBuffer.push(speed);
      
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
      
      // High variance can be normal acceleration, require very high variance for anomaly
      // Normal acceleration 0→60 km/h over 5 seconds = moderate variance
      // Erratic = rapid speed changes back and forth
      let score = 0;
      if (variance >= 100) {
        // Very high variance = likely erratic movement
        score = 20;
      } else if (variance >= 60) {
        // High variance = possibly erratic
        score = 10;
      } else {
        score = 0;
      }
      
      // Record anomaly only if very erratic (high variance sustained)
      if (score >= 10 && variance >= 60) {
        // Check if it's sustained erratic pattern (not just one acceleration)
        const last5 = speedBuffer.slice(-5);
        const last5Variance = this.calculateVariance(last5);
        
        if (last5Variance > 40) {
          anomalies.push({
            type: 'speed_entropy',
            severity: score >= 15 ? 'high' : 'medium',
            description: `Erratic speed pattern: variance ${variance.toFixed(2)}`,
            value: variance,
          });
        } else {
          score = 0; // Normal acceleration, not sustained erratic
        }
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
   * 22:00-23:59 → 1.2x (early night) - reduced alertness
   * 00:00-03:59 → 1.5x (deep night) - highest vulnerability
   * 04:00-04:59 → 1.3x (late night) - transitions back
   * 
   * Only called when isNightMode=true
   */
  getNightMultiplier() {
    const hour = new Date().getHours();
    
    if (hour >= 22) {
      return 1.2; // 22:00-23:59 - early night
    } else if (hour < 4) {
      return 1.5; // 00:00-03:59 - deep night (highest risk)
    } else if (hour < 5) {
      return 1.3; // 04:00-04:59 - late night
    }
    
    // Fallback (shouldn't reach if called only when isNightMode=true)
    return 1;
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
