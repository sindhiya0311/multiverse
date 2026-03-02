import TaggedLocation from '../models/TaggedLocation.js';
import LocationLog from '../models/LocationLog.js';
import { STATIONARY_THRESHOLD_MINUTES, NIGHT_MODE } from '../config/constants.js';

class ContextEngine {
  constructor() {
    this.userContextCache = new Map();
    this.userTravelState = new Map();
  }

  async generateStatus(userId, currentLocation, previousLocations = []) {
    const context = {
      status: 'Unknown',
      isMoving: false,
      isStationary: false,
      stationaryDuration: 0,
      nearbyTaggedLocation: null,
      travellingFrom: null,
      travellingTo: null,
      isNightMode: this.isNightModeActive(),
    };

    const taggedLocations = await TaggedLocation.find({
      user: userId,
      isActive: true,
    });

    const currentTagged = this.findCurrentTaggedLocation(
      currentLocation.latitude,
      currentLocation.longitude,
      taggedLocations
    );

    if (currentTagged) {
      context.nearbyTaggedLocation = currentTagged.label;
      context.status = `At ${currentTagged.label}`;
      
      await TaggedLocation.findByIdAndUpdate(currentTagged._id, {
        $inc: { visitCount: 1 },
        lastVisited: new Date(),
      });
    }

    const movementAnalysis = this.analyzeMovement(
      currentLocation,
      previousLocations
    );
    
    context.isMoving = movementAnalysis.isMoving;
    context.isStationary = movementAnalysis.isStationary;
    context.stationaryDuration = movementAnalysis.stationaryDuration;

    if (context.isMoving && !currentTagged) {
      const travelContext = await this.analyzeTravelContext(
        userId,
        currentLocation,
        previousLocations,
        taggedLocations
      );
      
      if (travelContext.from && travelContext.to) {
        context.status = `Travelling from ${travelContext.from} to ${travelContext.to}`;
        context.travellingFrom = travelContext.from;
        context.travellingTo = travelContext.to;
      } else if (travelContext.from) {
        context.status = `Left ${travelContext.from}`;
        context.travellingFrom = travelContext.from;
      } else {
        context.status = 'In Transit';
      }
    }

    if (context.isStationary && !currentTagged) {
      if (context.stationaryDuration >= STATIONARY_THRESHOLD_MINUTES) {
        context.status = `Stopped in Unknown Area (${Math.round(context.stationaryDuration)} min)`;
      } else {
        context.status = 'Briefly Stopped';
      }
    }

    if (context.isNightMode) {
      context.status += ' (Night Mode Active)';
    }

    this.userContextCache.set(userId.toString(), {
      ...context,
      timestamp: Date.now(),
    });

    return context;
  }

  findCurrentTaggedLocation(latitude, longitude, taggedLocations) {
    for (const tagged of taggedLocations) {
      if (tagged.isWithinRadius(latitude, longitude)) {
        return tagged;
      }
    }
    return null;
  }

  analyzeMovement(currentLocation, previousLocations) {
    const result = {
      isMoving: false,
      isStationary: false,
      stationaryDuration: 0,
      averageSpeed: 0,
    };

    if (currentLocation.speed !== undefined) {
      result.isMoving = currentLocation.speed > 1;
      result.isStationary = currentLocation.speed <= 1;
    }

    if (previousLocations.length < 2) {
      return result;
    }

    const recentLocations = previousLocations.slice(-10);
    let totalSpeed = 0;
    let speedCount = 0;

    for (let i = 1; i < recentLocations.length; i++) {
      const prev = recentLocations[i - 1];
      const curr = recentLocations[i];
      
      const distance = this.haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
      
      const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / 1000;
      
      if (timeDiff > 0) {
        const speed = distance / timeDiff;
        totalSpeed += speed;
        speedCount++;
      }
    }

    if (speedCount > 0) {
      result.averageSpeed = totalSpeed / speedCount;
      result.isMoving = result.averageSpeed > 0.5;
      result.isStationary = result.averageSpeed <= 0.5;
    }

    if (result.isStationary && previousLocations.length > 0) {
      const stationaryStart = this.findStationaryStart(previousLocations);
      if (stationaryStart) {
        result.stationaryDuration = (Date.now() - stationaryStart) / (1000 * 60);
      }
    }

    return result;
  }

  findStationaryStart(locations) {
    if (locations.length < 2) return null;

    for (let i = locations.length - 1; i > 0; i--) {
      const speed = locations[i].speed || 0;
      if (speed > 1) {
        return new Date(locations[i].timestamp).getTime();
      }
    }

    return new Date(locations[0].timestamp).getTime();
  }

  async analyzeTravelContext(userId, currentLocation, previousLocations, taggedLocations) {
    const userIdStr = userId.toString();
    const travelState = this.userTravelState.get(userIdStr) || {
      lastTaggedLocation: null,
      departureTime: null,
    };

    const result = {
      from: travelState.lastTaggedLocation,
      to: null,
    };

    if (previousLocations.length > 0) {
      for (let i = previousLocations.length - 1; i >= 0; i--) {
        const loc = previousLocations[i];
        const tagged = this.findCurrentTaggedLocation(
          loc.latitude,
          loc.longitude,
          taggedLocations
        );
        
        if (tagged && tagged.label !== result.from) {
          result.from = tagged.label;
          travelState.lastTaggedLocation = tagged.label;
          travelState.departureTime = new Date(loc.timestamp);
          break;
        }
      }
    }

    const possibleDestination = this.predictDestination(
      currentLocation,
      previousLocations,
      taggedLocations
    );
    
    if (possibleDestination) {
      result.to = possibleDestination.label;
    }

    this.userTravelState.set(userIdStr, travelState);

    return result;
  }

  predictDestination(currentLocation, previousLocations, taggedLocations) {
    if (previousLocations.length < 3) return null;

    const recentLocations = previousLocations.slice(-5);
    
    let avgBearing = 0;
    let bearingCount = 0;

    for (let i = 1; i < recentLocations.length; i++) {
      const bearing = this.calculateBearing(
        recentLocations[i - 1].latitude,
        recentLocations[i - 1].longitude,
        recentLocations[i].latitude,
        recentLocations[i].longitude
      );
      avgBearing += bearing;
      bearingCount++;
    }

    if (bearingCount === 0) return null;
    avgBearing /= bearingCount;

    let bestMatch = null;
    let bestScore = Infinity;

    for (const tagged of taggedLocations) {
      const bearingToTagged = this.calculateBearing(
        currentLocation.latitude,
        currentLocation.longitude,
        tagged.latitude,
        tagged.longitude
      );

      const bearingDiff = Math.abs(this.normalizeBearing(bearingToTagged - avgBearing));
      const distance = this.haversineDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        tagged.latitude,
        tagged.longitude
      );

      if (bearingDiff < 45 && distance < 10000) {
        const score = bearingDiff + distance / 1000;
        if (score < bestScore) {
          bestScore = score;
          bestMatch = tagged;
        }
      }
    }

    return bestMatch;
  }

  isNightModeActive() {
    const hour = new Date().getHours();
    return hour >= NIGHT_MODE.START_HOUR || hour < NIGHT_MODE.END_HOUR;
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

  calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
      Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return ((θ * 180) / Math.PI + 360) % 360;
  }

  normalizeBearing(bearing) {
    while (bearing > 180) bearing -= 360;
    while (bearing < -180) bearing += 360;
    return bearing;
  }

  clearUserData(userId) {
    const userIdStr = userId.toString();
    this.userContextCache.delete(userIdStr);
    this.userTravelState.delete(userIdStr);
  }

  getUserContext(userId) {
    return this.userContextCache.get(userId.toString());
  }
}

const contextEngine = new ContextEngine();
export default contextEngine;
