import Alert from '../models/Alert.js';
import User from '../models/User.js';
import FamilyConnection from '../models/FamilyConnection.js';
import { FAMILY_REQUEST_STATUS, ALERT_TYPES, ALERT_SEVERITY } from '../config/constants.js';

/**
 * REAL-TIME ALERT ENGINE
 * 
 * Monitors risk scores and automatically triggers alerts based on:
 * - Score thresholds (0-59 normal, 60-79 warning, ≥80+2 anomalies = RED)
 * - Alert level determination
 * - Automatic shadow alerts for RED level
 * - Real-time family notifications
 */
class AlertEngine {
  constructor() {
    this.io = null;
    this.activeAlerts = new Map();
    this.lastAlertTime = new Map();
    this.ALERT_COOLDOWN_MS = 5000; // Prevent spam
  }

  setSocketIO(io) {
    this.io = io;
  }

  /**
   * REAL-TIME ALERT PROCESSING
   * Called on every location update
   */
  async processRiskScore(userId, riskData, currentLocation) {
    try {
      const userIdStr = userId.toString();
      
      // Determine alert level from risk score and anomalies
      const alertLevel = this.determineAlertLevel(riskData);
      
      // Check cooldown to prevent alert spam
      const lastAlert = this.lastAlertTime.get(userIdStr) || 0;
      const timeSinceLastAlert = Date.now() - lastAlert;
      
      // RED ALERT: Score ≥80 AND at least 2 anomaly categories
      if (alertLevel === 'red') {
        if (timeSinceLastAlert >= this.ALERT_COOLDOWN_MS) {
          await this.triggerRedAlert(userId, riskData, currentLocation);
          this.lastAlertTime.set(userIdStr, Date.now());
        }
      }
      // ORANGE ALERT: Score ≥60 (no automatic trigger, just logging)
      else if (alertLevel === 'orange') {
        // Log but don't notify (reduce noise)
        await this.logWarningAlert(userId, riskData, currentLocation);
      }
    } catch (error) {
      console.error('Alert processing error:', error);
    }
  }

  /**
   * Determine alert level based on score and anomalies
   * 
   * 0-59: normal
   * 60-79: warning/orange
   * ≥80 AND 2+ anomaly categories: RED
   */
  determineAlertLevel(riskData) {
    const { score, anomalyCount, multipleAnomalyCategories } = riskData;
    
    // RED: ≥80 AND at least 2 category types
    if (score >= 80 && multipleAnomalyCategories) {
      return 'red';
    }
    
    // ORANGE: ≥60
    if (score >= 60) {
      return 'orange';
    }
    
    // NORMAL: <60
    return 'safe';
  }

  /**
   * TRIGGER RED ALERT
   * Automatically notifies family members
   */
  async triggerRedAlert(userId, riskData, currentLocation) {
    try {
      const user = await User.findById(userId).select('name email phone');
      
      if (!user) {
        console.error('User not found for alert:', userId);
        return;
      }
      
      // Create alert record
      const alert = await Alert.create({
        user: userId,
        type: ALERT_TYPES.SHADOW,
        severity: riskData.score >= 90 ? ALERT_SEVERITY.CRITICAL : ALERT_SEVERITY.HIGH,
        riskScore: riskData.score,
        baseScore: riskData.baseScore,
        location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
        anomalyBreakdown: {
          routeDeviation: riskData.breakdown.routeDeviation,
          stopDuration: riskData.breakdown.stopDuration,
          speedEntropy: riskData.breakdown.speedEntropy,
          locationRisk: riskData.breakdown.locationRiskWeight,
          nightMultiplier: riskData.breakdown.nightMultiplier,
          anomalyTypes: riskData.anomalies.map(a => a.type),
          anomalyCount: riskData.anomalies.length,
        },
        anomalyDetails: riskData.anomalies,
        isNightMode: riskData.isNightMode,
        status: 'active',
      });
      
      // Get authorized family members
      const familyConnections = await FamilyConnection.find({
        $or: [
          { requester: userId, status: FAMILY_REQUEST_STATUS.ACCEPTED },
          { recipient: userId, status: FAMILY_REQUEST_STATUS.ACCEPTED },
        ],
        canReceiveAlerts: true,
      });
      
      const notifiedMembers = [];
      
      // Send real-time notifications to family
      for (const connection of familyConnections) {
        const memberId = connection.requester.toString() === userId.toString()
          ? connection.recipient
          : connection.requester;
        
        notifiedMembers.push({
          user: memberId,
          notifiedAt: new Date(),
        });
        
        // Emit socket event to family member
        this.io.to(`user:${memberId}`).emit('alert:red', {
          alertId: alert._id,
          userName: user.name,
          userEmail: user.email,
          userPhone: user.phone,
          riskScore: riskData.score,
          baseScore: riskData.baseScore,
          location: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
          anomalyBreakdown: {
            routeDeviation: riskData.breakdown.routeDeviation,
            stopDuration: riskData.breakdown.stopDuration,
            speedEntropy: riskData.breakdown.speedEntropy,
            locationRisk: riskData.breakdown.locationRiskWeight,
            nightMultiplier: riskData.breakdown.nightMultiplier,
            anomalies: riskData.anomalies,
          },
          isNightMode: riskData.isNightMode,
          timestamp: new Date(),
          severity: riskData.score >= 90 ? 'CRITICAL' : 'HIGH',
        });
      }
      
      // Update alert with notified members
      alert.notifiedMembers = notifiedMembers;
      await alert.save();
      
      // Also notify admins
      this.io.to('admin:alerts').emit('admin:alert', {
        type: 'RED_ALERT',
        userName: user.name,
        userId: userId,
        riskScore: riskData.score,
        timestamp: new Date(),
      });
      
      console.log(`🔴 RED ALERT triggered for ${user.name} (score: ${riskData.score})`);
      
    } catch (error) {
      console.error('Error triggering red alert:', error);
    }
  }

  /**
   * Log warning alert (Orange - no auto-notify)
   */
  async logWarningAlert(userId, riskData, currentLocation) {
    try {
      // Just log for analytics, don't spam family
      await Alert.create({
        user: userId,
        type: ALERT_TYPES.SYSTEM,
        severity: ALERT_SEVERITY.MEDIUM,
        riskScore: riskData.score,
        location: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
        anomalyBreakdown: {
          routeDeviation: riskData.breakdown.routeDeviation,
          stopDuration: riskData.breakdown.stopDuration,
          speedEntropy: riskData.breakdown.speedEntropy,
          locationRisk: riskData.breakdown.locationRiskWeight,
        },
        status: 'logged',
      });
    } catch (error) {
      console.error('Error logging warning:', error);
    }
  }

  /**
   * MANUAL SOS TRIGGER
   * User presses emergency button
   */
  async triggerSOS(userId, location, message = '') {
    try {
      const user = await User.findById(userId).select('name email phone');
      
      // Create SOS alert
      const alert = await Alert.create({
        user: userId,
        type: ALERT_TYPES.SOS,
        severity: ALERT_SEVERITY.CRITICAL,
        riskScore: 100, // Manual SOS is always critical
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        status: 'active',
        resolutionNotes: message,
      });
      
      // Notify all family members
      const familyConnections = await FamilyConnection.find({
        $or: [
          { requester: userId, status: FAMILY_REQUEST_STATUS.ACCEPTED },
          { recipient: userId, status: FAMILY_REQUEST_STATUS.ACCEPTED },
        ],
      });
      
      for (const connection of familyConnections) {
        const memberId = connection.requester.toString() === userId.toString()
          ? connection.recipient
          : connection.requester;
        
        // Send urgent SOS notification
        this.io.to(`user:${memberId}`).emit('alert:sos', {
          alertId: alert._id,
          userName: user.name,
          userPhone: user.phone,
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          message: message,
          timestamp: new Date(),
        });
      }
      
      // Notify admins
      this.io.to('admin:alerts').emit('admin:sos', {
        userName: user.name,
        userId: userId,
        location: location,
        timestamp: new Date(),
      });
      
      console.log(`🚨 SOS ALERT triggered by ${user.name}`);
      
      return alert;
    } catch (error) {
      console.error('Error triggering SOS:', error);
      throw error;
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId, userId) {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        {
          status: 'acknowledged',
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
        },
        { new: true }
      );
      
      return alert;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId, userId, resolution = 'safe', notes = '') {
    try {
      const alert = await Alert.findByIdAndUpdate(
        alertId,
        {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: userId,
          resolution: resolution,
          resolutionNotes: notes,
        },
        { new: true }
      );
      
      // Notify family that alert is resolved
      if (alert) {
        const user = alert.user;
        
        const familyConnections = await FamilyConnection.find({
          $or: [
            { requester: user, status: FAMILY_REQUEST_STATUS.ACCEPTED },
            { recipient: user, status: FAMILY_REQUEST_STATUS.ACCEPTED },
          ],
        });
        
        for (const connection of familyConnections) {
          const memberId = connection.requester.toString() === user.toString()
            ? connection.recipient
            : connection.requester;
          
          this.io.to(`user:${memberId}`).emit('alert:resolved', {
            alertId: alert._id,
            resolution: resolution,
            resolvedAt: new Date(),
          });
        }
      }
      
      return alert;
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  /**
   * Get active alerts for user
   */
  async getActiveAlerts(userId) {
    try {
      return await Alert.find({
        user: userId,
        status: { $in: ['active', 'acknowledged'] },
      })
        .sort({ triggeredAt: -1 })
        .limit(10);
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      return [];
    }
  }

  /**
   * Get family alerts (alerts from family members)
   */
  async getFamilyAlerts(userId, activeOnly = true) {
    try {
      // Get all accepted family connections
      const connections = await FamilyConnection.find({
        $or: [
          { requester: userId, status: FAMILY_REQUEST_STATUS.ACCEPTED },
          { recipient: userId, status: FAMILY_REQUEST_STATUS.ACCEPTED },
        ],
        canReceiveAlerts: true,
      });
      
      const familyMemberIds = connections.map(conn =>
        conn.requester.toString() === userId.toString()
          ? conn.recipient
          : conn.requester
      );
      
      const query = { user: { $in: familyMemberIds } };
      
      if (activeOnly) {
        query.status = { $in: ['active', 'acknowledged'] };
      }
      
      return await Alert.find(query)
        .sort({ triggeredAt: -1 })
        .limit(50)
        .populate('user', 'name email');
    } catch (error) {
      console.error('Error fetching family alerts:', error);
      return [];
    }
  }
}

const alertEngine = new AlertEngine();
export default alertEngine;
