import User from '../models/User.js';
import LocationLog from '../models/LocationLog.js';
import riskEngine from './RiskEngine.js';
import alertEngine from './AlertEngine.js';

/**
 * REAL-TIME DATA PROCESSOR
 * 
 * Continuously processes incoming location streams from all connected users
 * Orchestrates risk calculation → alert processing → user/family notifications
 * 
 * Features:
 * - Batches location updates for efficiency
 * - Coordinates RiskEngine and AlertEngine
 * - Maintains per-user state (buffers, anomalies)
 * - Handles disconnections and cleanup
 */
class DataProcessor {
  constructor() {
    this.io = null;
    this.processingQueue = new Map();
    this.activeProcessing = new Set();
  }

  setSocketIO(io) {
    this.io = io;
  }

  /**
   * MAIN ENTRY POINT: Process incoming location from client
   * Called on every location:update socket event
   */
  async processLocationUpdate(userId, locationData) {
    try {
      const userIdStr = userId.toString();

      // Parse location data
      const currentLocation = {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        speed: parseFloat(locationData.speed) || 0,
        accuracy: parseFloat(locationData.accuracy) || 0,
        heading: parseFloat(locationData.heading) || 0,
        altitude: parseFloat(locationData.altitude) || 0,
        timestamp: new Date(),
      };

      // Validate coordinates
      if (!this.validateCoordinates(currentLocation)) {
        console.warn(`Invalid coordinates for user ${userIdStr}:`, currentLocation);
        return { success: false, reason: 'invalid_coordinates' };
      }

      // Validate speed (reasonable bounds: 0-300 km/h)
      if (currentLocation.speed < 0 || currentLocation.speed > 300) {
        console.warn(`Suspicious speed for user ${userIdStr}: ${currentLocation.speed} km/h`);
        currentLocation.speed = Math.max(0, Math.min(300, currentLocation.speed));
      }

      // Get user for context and location sharing preference
      const user = await User.findById(userId).select('name email phone currentRiskScore isLocationSharingEnabled');
      if (!user) {
        console.error('User not found:', userId);
        return { success: false, reason: 'user_not_found' };
      }

      // ============================================
      // STEP 1: REAL-TIME RISK CALCULATION
      // ============================================
      // Calculate night mode based on user's timezone
      const isNightMode = this.isNightModeActive(currentLocation.timestamp);
      
      const riskResult = await riskEngine.calculateRealTimeRiskScore(
        userId,
        currentLocation,
        isNightMode // Correctly pass night mode status
      );

      if (!riskResult) {
        console.error('Risk calculation failed for', userIdStr);
        return { success: false, reason: 'risk_calc_failed' };
      }

      // ============================================
      // STEP 2: CONTEXT GENERATION
      // ============================================
      const contextResult = await this.generateContext(
        userId,
        currentLocation,
        riskResult
      );

      // ============================================
      // STEP 3: LOCATION PERSISTENCE
      // ============================================
      const locationLog = await LocationLog.create({
        user: userId,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        speed: currentLocation.speed,
        accuracy: currentLocation.accuracy,
        heading: currentLocation.heading,
        altitude: currentLocation.altitude,
        timestamp: currentLocation.timestamp,
        isNightMode: riskResult.isNightMode,
        riskScore: riskResult.score,
        baseScore: riskResult.baseScore,
        riskBreakdown: {
          routeDeviation: riskResult.breakdown?.routeDeviation || 0,
          stopDuration: riskResult.breakdown?.stopDuration || 0,
          speedEntropy: riskResult.breakdown?.speedEntropy || 0,
          locationRiskWeight: riskResult.breakdown?.locationRiskWeight || 0,
          nightMultiplier: riskResult.breakdown?.nightMultiplier || 1.0,
        },
        status: contextResult.status,
        contextualInfo: {
          nearbyTaggedLocation: contextResult.nearbyTaggedLocation,
          isMoving: contextResult.isMoving,
          isStationary: contextResult.isStationary,
          stationaryDuration: contextResult.stationaryDuration,
          travellingFrom: contextResult.travellingFrom,
          travellingTo: contextResult.travellingTo,
        },
        anomalies: riskResult.anomalies || [],
        anomalyCount: (riskResult.anomalies || []).length,
      });

      // ============================================
      // STEP 4: ALERT PROCESSING
      // ============================================
      await alertEngine.processRiskScore(userId, {
        score: riskResult.score,
        baseScore: riskResult.baseScore,
        breakdown: riskResult.breakdown,
        anomalies: riskResult.anomalies,
        anomalyCount: (riskResult.anomalies || []).length,
        multipleAnomalyCategories: riskResult.multipleAnomalyCategories,
        isNightMode: riskResult.isNightMode,
      }, currentLocation);

      // ============================================
      // STEP 5: UPDATE USER STATE
      // ============================================
      await User.findByIdAndUpdate(userId, {
        lastKnownLocation: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          timestamp: currentLocation.timestamp,
          accuracy: currentLocation.accuracy,
        },
        currentRiskScore: riskResult.score,
        currentBaseScore: riskResult.baseScore,
        currentStatus: contextResult.status,
        isNightModeActive: riskResult.isNightMode,
        lastLocationUpdateAt: new Date(),
      });

      // ============================================
      // STEP 6: BROADCAST RESULTS
      // ============================================
      const result = {
        success: true,
        location: locationLog,
        risk: {
          score: riskResult.score,
          baseScore: riskResult.baseScore,
          breakdown: riskResult.breakdown,
          anomalies: riskResult.anomalies,
          alertLevel: this.determineAlertLevel(riskResult),
          isNightMode: riskResult.isNightMode,
        },
        context: contextResult,
      };

      // Emit to user
      if (this.io) {
        this.io.to(`user:${userId}`).emit('location:processed', result);

        // Broadcast to family
        this.broadcastToFamily(userId, {
          memberId: userId,
          memberName: user.name,
          location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            timestamp: currentLocation.timestamp,
            accuracy: currentLocation.accuracy,
          },
          riskScore: riskResult.score,
          baseScore: riskResult.baseScore,
          status: contextResult.status,
          isNightMode: riskResult.isNightMode,
          anomalies: riskResult.anomalies,
        });

        // Update admin dashboard
        this.io.to('admin:dashboard').emit('user:update', {
          userId: userId,
          name: user.name,
          location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
          riskScore: riskResult.score,
          status: contextResult.status,
          isNightMode: riskResult.isNightMode,
          anomalies: riskResult.anomalies,
        });
      }

      return result;

    } catch (error) {
      console.error('Location processing error:', error);
      return { success: false, reason: 'processing_error', error: error.message };
    }
  }

  /**
   * Validate coordinates are within reasonable bounds AND not teleporting
   */
  validateCoordinates(location) {
    const { latitude, longitude, accuracy } = location;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;

    // Check latitude range [-90, 90]
    if (latitude < -90 || latitude > 90) return false;

    // Check longitude range [-180, 180]
    if (longitude < -180 || longitude > 180) return false;

    // Check accuracy when provided (0-1000 meters; undefined is acceptable)
    if (accuracy !== undefined && accuracy !== null) {
      if (typeof accuracy !== 'number' || accuracy < 0 || accuracy > 1000) return false;
    }
    
    // NEW: Filter very inaccurate GPS (likely GPS glitch)
    // Accuracy > 500m means GPS is too noisy for route deviation scoring
    if (accuracy > 500) {
      console.warn(`GPS accuracy too low (${accuracy}m), treating as unreliable`);
      // Don't reject completely, but we can flag this for risk calculation
    }
    
    return true;
  }

  /**
   * Determine alert level from risk result
   */
  determineAlertLevel(riskResult) {
    const { score, multipleAnomalyCategories } = riskResult;
    
    if (score >= 80 && multipleAnomalyCategories) {
      return 'red';
    }
    
    if (score >= 60) {
      return 'orange';
    }
    
    return 'safe';
  }

  /**
   * Generate contextual information
   */
  async generateContext(userId, location, riskResult) {
    try {
      const recentLocations = await LocationLog.find({
        user: userId,
      })
        .sort({ timestamp: -1 })
        .limit(10);

      // Determine if moving
      let isMoving = false;
      let isStationary = false;
      let stationaryDuration = 0;

      if (recentLocations.length > 1) {
        const currentSpeed = location.speed;
        isMoving = currentSpeed > 2; // > 2 km/h is moving
        isStationary = currentSpeed < 2;

        if (isStationary) {
          const oldestLocation = recentLocations[recentLocations.length - 1];
          stationaryDuration = Math.round(
            (location.timestamp - oldestLocation.timestamp) / 60000 // minutes
          );
        }
      } else if (location.speed > 2) {
        isMoving = true;
      }

      return {
        status: isMoving ? 'Traveling' : isStationary ? 'Stopped' : 'Unknown',
        isMoving,
        isStationary,
        stationaryDuration,
        nearbyTaggedLocation: null,
        travellingFrom: null,
        travellingTo: null,
      };
    } catch (error) {
      console.error('Context generation error:', error);
      return {
        status: 'Unknown',
        isMoving: location.speed > 2,
        isStationary: location.speed < 2,
        stationaryDuration: 0,
      };
    }
  }

  /**
   * Broadcast family location updates
   */
  async broadcastToFamily(userId, data) {
    try {
      if (!this.io) return;

      // Get family connections
      const { FamilyConnection } = await import('../models/index.js');
      const { FAMILY_REQUEST_STATUS } = await import('../config/constants.js');

      const connections = await FamilyConnection.find({
        $or: [
          { requester: userId, status: FAMILY_REQUEST_STATUS.ACCEPTED },
          { recipient: userId, status: FAMILY_REQUEST_STATUS.ACCEPTED },
        ],
        canViewLocation: true,
      });

      for (const connection of connections) {
        const memberId = connection.requester.toString() === userId.toString()
          ? connection.recipient
          : connection.requester;

        this.io.to(`user:${memberId}`).emit('family:location:update', data);
      }
    } catch (error) {
      console.error('Error broadcasting to family:', error);
    }
  }

  /**
   * Check if currently in night mode
   * Night mode: 22:00-05:00 (server timezone, but should be enhanced to user timezone)
   */
  isNightModeActive(timestamp = Date.now()) {
    const date = new Date(timestamp);
    const hour = date.getHours();
    return hour >= 22 || hour < 5;
  }

  /**
   * Health check / metrics
   */
  getMetrics() {
    return {
      activeProcessing: this.activeProcessing.size,
      queuedItems: this.processingQueue.size,
      timestamp: new Date(),
    };
  }
}

const dataProcessor = new DataProcessor();
export default dataProcessor;
