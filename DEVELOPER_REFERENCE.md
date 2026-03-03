# DEVELOPER REFERENCE GUIDE
# Real-Time Risk Engine & Alert System

## 🔧 Development Setup

### Prerequisites
- Node.js 18+
- MongoDB 7+ (local or Atlas)
- Redis (for caching)
- npm or yarn

### Installation
```bash
# Backend
cd server
npm install
cp .env.example .env
npm run dev

# Frontend (new terminal)
cd client
npm install
npm run dev
```

### Environment Variables
```env
# server/.env
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/noctis
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-key-change-in-production
PORT=5000
```

---

## 📊 RiskEngine Deep Dive

### Entry Point: `calculateRealTimeRiskScore()`

```javascript
async calculateRealTimeRiskScore(userId, currentLocation, isNightMode = false) {
  // 1. Initialize or get user buffers
  if (!userLocationBuffer[userId]) {
    userLocationBuffer[userId] = [];
    userSpeedBuffer[userId] = [];
  }

  // 2. Validate and add to buffer
  userLocationBuffer[userId].push(currentLocation);
  if (userLocationBuffer[userId].length > 20) {
    userLocationBuffer[userId].shift(); // Keep last 20
  }

  // 3. Calculate 5 risk components
  const routeDeviation = await this.calculateRouteDeviation(userId);
  const stopDuration = await this.calculateStopDurationScore(userId);
  const speedEntropy = this.calculateSpeedEntropy(userId);
  const locationRisk = await this.calculateLocationRiskWeight(userId);
  const nightMultiplier = this.getNightMultiplier();

  // 4. Sum components (max 90 before multiplier)
  const baseScore = Math.min(90,
    routeDeviation.score +
    stopDuration.score +
    speedEntropy.score +
    locationRisk.score
  );

  // 5. Apply night multiplier
  const finalScore = baseScore * nightMultiplier;

  // 6. Collect anomalies
  const anomalies = [
    routeDeviation.score > 10 && routeDeviation,
    stopDuration.score > 5 && stopDuration,
    speedEntropy.score > 8 && speedEntropy,
    locationRisk.score > 5 && locationRisk,
    nightMultiplier > 1.0 && { type: 'night_mode', value: nightMultiplier }
  ].filter(Boolean);

  // 7. Count unique anomaly categories
  const anomalyTypes = new Set(anomalies.map(a => a.type));
  const multipleAnomalyCategories = anomalyTypes.size >= 2;

  return {
    score: Math.min(100, finalScore),
    baseScore,
    breakdown: {
      routeDeviation: routeDeviation.score,
      stopDuration: stopDuration.score,
      speedEntropy: speedEntropy.score,
      locationRiskWeight: locationRisk.score,
      nightMultiplier,
    },
    anomalies,
    multipleAnomalyCategories,
    isNightMode: nightMultiplier > 1.0,
  };
}
```

### Debugging Risk Calculations

```javascript
// Add logging to track calculations
async calculateRouteDeviation(userId) {
  const buffer = userLocationBuffer[userId] || [];
  
  if (buffer.length < 3) {
    console.log(`[RouteDeviation] User ${userId}: Buffer too small (${buffer.length})`);
    return { score: 0, severity: 'none' };
  }

  // Build corridor from last 10 points
  const corridorPoints = buffer.slice(-10);
  console.log(`[RouteDeviation] Building corridor from ${corridorPoints.length} points`);
  
  const distance = this.calculatePerpendicular(currentLocation, corridorPoints);
  const score = Math.min(30, (distance / 1000) * 30);
  
  console.log(`[RouteDeviation] Distance: ${distance.toFixed(0)}m, Score: ${score.toFixed(1)}`);
  
  return { score, severity: score > 15 ? 'high' : 'low' };
}

// Test specific calculation
const testRiskScore = async () => {
  const userId = new mongoose.Types.ObjectId("user123");
  const testLocation = {
    latitude: 40.7128,
    longitude: -74.0060,
    speed: 25,
    accuracy: 10,
    timestamp: new Date(),
  };
  
  const result = await riskEngine.calculateRealTimeRiskScore(userId, testLocation);
  console.log('Risk Result:', JSON.stringify(result, null, 2));
};
```

### Accessing Buffers in Debugger

```javascript
// Get current buffer state for a user
console.log('Location Buffer:', riskEngine.userLocationBuffer[userId]);
console.log('Speed Buffer:', riskEngine.userSpeedBuffer[userId]);
console.log('Stop Info:', riskEngine.userStopInfo[userId]);
console.log('Anomalies:', riskEngine.userAnomalies[userId]);

// Clear buffers (e.g., for testing)
riskEngine.clearUserData(userId);
```

---

## 🚨 AlertEngine Deep Dive

### Alert Lifecycle

```javascript
// 1. Risk score arrives
await alertEngine.processRiskScore(userId, riskData, currentLocation);

// 2. Check thresholds
if (score >= 80 && multipleAnomalyCategories) {
  // 3. Trigger RED alert
  await alertEngine.triggerRedAlert(userId, riskData, currentLocation);
  
  // 4. Create Alert record
  const alert = await Alert.create({...});
  
  // 5. Get family connections
  const families = await FamilyConnection.find({...});
  
  // 6. Emit socket event to each family member
  for (const member of families) {
    io.to(`user:${member._id}`).emit('alert:red', alertData);
  }
}
```

### Testing Alert Triggering

```javascript
// Manually test RED alert
const testAlert = async () => {
  const userId = new mongoose.Types.ObjectId("user123");
  const riskData = {
    score: 85,
    baseScore: 57,
    breakdown: {
      routeDeviation: 25,
      stopDuration: 15,
      speedEntropy: 12,
      locationRiskWeight: 5,
      nightMultiplier: 1.3,
    },
    anomalies: [
      { type: 'route_deviation', severity: 'high', value: 25 },
      { type: 'stop_duration', severity: 'high', value: 15 },
    ],
    multipleAnomalyCategories: true,
    isNightMode: true,
  };
  
  const currentLocation = {
    latitude: 40.7128,
    longitude: -74.0060,
    timestamp: new Date(),
  };
  
  await alertEngine.processRiskScore(userId, riskData, currentLocation);
};

// Check if alert was created
const recentAlerts = await Alert.find({ user: userId })
  .sort({ createdAt: -1 })
  .limit(5);
console.log('Recent Alerts:', recentAlerts);
```

### Alert Levels Reference

```javascript
// SAFE: <60 points
// No action, no logging
Risk: 45
Score: 45 (Below threshold)
Result: SAFE - Normal operations

// ORANGE: 60-79 points
// Logged but no family notification
Risk: 72
Breakdown: Route 18 + Stop 15 + Speed 12 + Location 5 = 50
Score: 50 < 60 due to single anomaly
Result: ORANGE - Logged, watched

// RED: ≥80 points PLUS 2+ anomaly categories
Risk: 85 (good) + MULTIPLE anomalies (required)
Score: 85 ✓
Anomalies: route_deviation + stop_duration ✓
Result: RED - Auto-trigger shadow alert + family notification

// NOT RED (just high score):
Risk: 88 (good!)
Anomalies: [stop_duration only] ✗ (only 1 category)
Result: Would be ORANGE - doesn't meet multi-factor requirement
```

---

## 📡 Socket.io Events Reference

### Client → Server Events

#### location:update
```javascript
// Client emits location every 2-3 seconds
socket.emit('location:update', {
  latitude: 40.7128,
  longitude: -74.0060,
  speed: 15.5,         // km/h
  accuracy: 25,        // meters
  heading: 90,         // 0-360 degrees
  altitude: 10,        // meters
});

// Server validates and processes
socket.on('location:update', async (data) => {
  const result = await dataProcessor.processLocationUpdate(userId, data);
});
```

#### sos:trigger
```javascript
// User presses emergency button
socket.emit('sos:trigger', {
  latitude: 40.7128,
  longitude: -74.0060,
  message: 'I need emergency help immediately',
});

// Server creates SOS alert (always CRITICAL severity)
socket.on('sos:trigger', async (data) => {
  const alert = await alertEngine.triggerSOS(userId, data.location, data.message);
});
```

#### alert:acknowledge
```javascript
// User confirms they're safe
socket.emit('alert:acknowledge', { alertId: alert._id });

// Server updates alert status
socket.on('alert:acknowledge', async (data) => {
  await alertEngine.acknowledgeAlert(data.alertId, userId);
});
```

#### alert:resolve
```javascript
// Family member marks alert as handled
socket.emit('alert:resolve', {
  alertId: alert._id,
  resolution: 'safe',
  notes: 'User confirmed safe, false alarm',
});
```

### Server → Client Events

#### location:processed
```javascript
// Server sends back processed location result
socket.emit('location:processed', {
  location: {
    _id: '...',
    latitude: 40.7128,
    longitude: -74.0060,
    riskScore: 45,
    timestamp: '2024-01-15T22:45:30Z',
  },
  risk: {
    score: 45,
    baseScore: 30,
    breakdown: {
      routeDeviation: 10,
      stopDuration: 8,
      speedEntropy: 5,
      locationRiskWeight: 2,
      nightMultiplier: 1.0,
    },
    anomalies: [],
    alertLevel: 'safe',
    isNightMode: false,
  },
  context: {
    status: 'Traveling',
    isMoving: true,
    isStationary: false,
  },
});
```

#### alert:red
```javascript
// RED alert triggered - send to family members
io.to(`user:${familyMemberId}`).emit('alert:red', {
  alertId: alert._id,
  userName: 'John Doe',
  userEmail: 'john@example.com',
  userPhone: '+1-234-567-8900',
  riskScore: 85,
  baseScore: 57,
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
  },
  anomalyBreakdown: {
    routeDeviation: 25,
    stopDuration: 15,
    speedEntropy: 12,
    locationRisk: 5,
    nightMultiplier: 1.3,
    anomalies: ['route_deviation', 'stop_duration', 'speed_entropy'],
  },
  isNightMode: true,
  timestamp: '2024-01-15T22:45:30Z',
  severity: 'HIGH',
});
```

#### family:location:update
```javascript
// Broadcast family member's location to others
io.to(`user:${familyMemberId}`).emit('family:location:update', {
  memberId: userId,
  memberName: 'John Doe',
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    timestamp: '2024-01-15T22:45:30Z',
    accuracy: 25,
  },
  riskScore: 45,
  status: 'Traveling',
  isNightMode: false,
  anomalies: [],
});
```

---

## 🗄️ Database Query Reference

### Find Recent Locations

```javascript
// Get last 20 locations for a user
const recentLocations = await LocationLog.find({ user: userId })
  .sort({ timestamp: -1 })
  .limit(20);

// Get locations from last 30 minutes
const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
const recentLocations = await LocationLog.find({
  user: userId,
  timestamp: { $gte: thirtyMinutesAgo },
}).sort({ timestamp: -1 });

// Get average risk score (hourly)
const avgRisk = await LocationLog.aggregate([
  {
    $match: {
      user: userId,
      timestamp: { $gte: oneHourAgo },
    },
  },
  {
    $group: {
      _id: null,
      avgRisk: { $avg: '$riskScore' },
      maxRisk: { $max: '$riskScore' },
      count: { $sum: 1 },
    },
  },
]);
```

### Query Risk Zones

```javascript
// Find risk zones near user location
const nearbyZones = await RiskZone.find({
  location: {
    $near: {
      $geometry: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      $maxDistance: 1000, // 1 km
    },
  },
});

// Find ALL risk zones (admin view)
const allZones = await RiskZone.find();
```

### Query Alerts

```javascript
// Get active alerts for user
const activeAlerts = await Alert.find({
  user: userId,
  status: { $in: ['active', 'acknowledged'] },
}).sort({ triggeredAt: -1 });

// Get RED alerts in last 24 hours
const recentRedAlerts = await Alert.find({
  severity: 'HIGH',
  triggeredAt: { $gte: oneDayAgo },
}).sort({ triggeredAt: -1 });

// Get alert stats
const stats = await Alert.aggregate([
  {
    $match: { triggeredAt: { $gte: oneDayAgo } },
  },
  {
    $group: {
      _id: '$severity',
      count: { $sum: 1 },
    },
  },
]);
```

---

## 🐛 Common Issues & Solutions

### Issue: High Risk Score But No Alert

**Problem**: User has score 85 but no RED alert triggered

**Debug**:
```javascript
const riskData = {
  score: 85,
  multipleAnomalyCategories: ??? // Check this
};

if (riskData.multipleAnomalyCategories === false) {
  console.log('❌ Only 1 anomaly type - needs 2+');
}

// Check anomalies count
console.log('Anomalies:', riskData.anomalies);
console.log('Types:', new Set(riskData.anomalies.map(a => a.type)));
```

**Solution**: Multi-factor logic requires BOTH high score AND multiple anomaly types

### Issue: Location Buffer Not Populating

**Problem**: Route deviation scoring always 0

**Debug**:
```javascript
console.log('Buffer size:', riskEngine.userLocationBuffer[userId]?.length);

if (!riskEngine.userLocationBuffer[userId]) {
  console.log('❌ No buffer initialized');
}

if (riskEngine.userLocationBuffer[userId].length < 3) {
  console.log('⚠️ Buffer too small for route calculation');
}
```

**Solution**: 
- Ensure location:update events are being emitted
- Check Socket.io connection status
- Verify location is being added to buffer in RiskEngine

### Issue: Family Not Receiving Alerts

**Problem**: RED alert triggered but family doesn't see modal

**Debug**:
```javascript
// Check family connections exist
const connections = await FamilyConnection.find({
  requester: userId,
  status: 'accepted',
});
console.log('Family connections:', connections);

// Check if family member is online
console.log('Is family member online?', 
  connectedUsers.has(familyMemberId.toString()));

// Check Socket.io room
console.log('Family member sockets in room:', 
  io.sockets.adapter.rooms.get(`user:${familyMemberId}`));
```

**Solution**:
- Verify family connections have `status: 'accepted'`
- Ensure family member is connected to Socket.io
- Check network latency / firewall rules

### Issue: Alert Spam (Too Many Alerts)

**Problem**: 20+ RED alerts in 1 minute

**Check**:
```javascript
// Alert cooldown check (should be 5 seconds)
console.log('Last alert time:', alertEngine.lastAlertTime.get(userId));
console.log('Time since last:', Date.now() - lastAlertTime);

if (timeSince < 5000) {
  console.log('⚠️ Alert rate limited (expected behavior)');
}
```

**Solution**:
- Check for GPS spoofing
- Verify route/speed data is realistic
- Check for database issues causing slow reads

---

## 📈 Performance Monitoring

### Key Metrics to Track

```javascript
// Processing latency per location update
const startTime = Date.now();
const result = await dataProcessor.processLocationUpdate(userId, location);
const latency = Date.now() - startTime;
console.log(`Processing latency: ${latency}ms`);

// Target: <100ms (95th percentile)
// Warning: >150ms
// Alert: >250ms

// Location update rate
const locationsPerSecond = updateCount / timeWindow;
console.log(`Updates/sec: ${locationsPerSecond}`);
// Target: 0.5/sec (1 per 2 seconds)
// Warning: <0.3/sec (detection gap)

// Alert trigger rate
const redAlertsPerHour = alertCount / (timeWindow / 3600000);
console.log(`RED alerts/hour: ${redAlertsPerHour}`);
// Target: <5/hour per user
// Warning: >20/hour (false positives?)

// Database write latency
const dbStartTime = Date.now();
await LocationLog.create(data);
const dbLatency = Date.now() - dbStartTime;
console.log(`DB latency: ${dbLatency}ms`);
// Target: <5ms
```

### Setting Up Monitoring

```javascript
// server/src/services/MonitoringService.js
import prometheus from 'prom-client';

const processingLatency = new prometheus.Histogram({
  name: 'location_processing_latency_ms',
  help: 'Time to process location update',
  buckets: [10, 50, 100, 250, 500],
});

const redAlertsTriggered = new prometheus.Counter({
  name: 'red_alerts_total',
  help: 'Total RED alerts triggered',
  labelNames: ['reason'],
});

// In dataProcessor
const startTime = Date.now();
const result = await processLocationUpdate(...);
processingLatency.observe(Date.now() - startTime);

if (alertTriggered) {
  redAlertsTriggered.inc({ reason: 'multi_factor' });
}
```

---

## 🧪 Testing Strategies

### Unit Test: Risk Calculation

```javascript
// tests/riskEngine.test.js
import { describe, it, expect } from 'vitest';
import riskEngine from '../services/RiskEngine.js';

describe('RiskEngine', () => {
  it('should calculate route deviation correctly', async () => {
    const userId = 'test-user-123';
    
    // Simulate locations along a straight path
    const locations = [
      { lat: 40.0, lng: -74.0, speed: 30 },
      { lat: 40.01, lng: -74.0, speed: 30 },
      { lat: 40.02, lng: -74.0, speed: 30 },
    ];
    
    // Add to buffer
    for (const loc of locations) {
      await riskEngine.calculateRealTimeRiskScore(userId, loc);
    }
    
    // Add off-route location
    const result = await riskEngine.calculateRealTimeRiskScore(userId, {
      lat: 40.02,
      lng: -73.8, // 20 km deviation
      speed: 0,
    });
    
    expect(result.breakdown.routeDeviation).toBeGreaterThan(15);
  });
});
```

### Integration Test: Alert Flow

```javascript
// tests/alertFlow.test.js
describe('Alert Flow', () => {
  it('should trigger RED alert on high risk with multiple anomalies', async () => {
    const userId = 'test-user-123';
    
    const riskData = {
      score: 85,
      anomalies: [
        { type: 'route_deviation', value: 20 },
        { type: 'stop_duration', value: 15 },
      ],
      multipleAnomalyCategories: true,
    };
    
    const alert = await alertEngine.processRiskScore(userId, riskData, location);
    
    expect(alert).toBeDefined();
    expect(alert.severity).toBe('HIGH');
  });
});
```

---

## 📚 Code Navigation Map

```
Backend Real-Time Processing:
├─ server/src/socket/socketHandler.js (entry point)
├─ server/src/services/DataProcessor.js (orchestration)
├─ server/src/services/RiskEngine.js (calculations)
├─ server/src/services/AlertEngine.js (alerting)
└─ server/src/services/ContextEngine.js (context)

Frontend Alert Handling:
├─ client/src/pages/Dashboard.jsx (socket listener)
├─ client/src/components/EmergencyAlertModal.jsx (UI)
├─ client/src/store/alertStore.js (state)
└─ client/src/services/socket.js (connection)

Database Models:
├─ server/src/models/LocationLog.js (time-series)
├─ server/src/models/Alert.js (alerts)
├─ server/src/models/RiskZone.js (geospatial)
└─ server/src/models/FamilyConnection.js (relationships)

Configuration:
├─ server/src/config/constants.js (thresholds)
└─ server/.env (credentials)
```

---

## 🎯 Common Development Tasks

### Add a New Anomaly Type

```javascript
// 1. Update RiskEngine calculation
async calculateNewAnomaly(userId) {
  // Implementation
  return {
    score: value,  // 0-N points
    severity: 'low' | 'medium' | 'high',
    description: 'Human-readable message',
    type: 'new_anomaly_type',
  };
}

// 2. Add to aggregation in calculateRealTimeRiskScore()
const newAnomaly = await this.calculateNewAnomaly(userId);
const anomalies = [
  ..., newAnomaly // Include new calculation
];

// 3. Test with new values
const result = await riskEngine.calculateRealTimeRiskScore(userId, location);
console.log('New anomaly included:', result.anomalies);
```

### Adjust Alert Thresholds

```javascript
// In AlertEngine.determineAlertLevel()
if (score >= 75 && multipleAnomalyCategories) {  // Changed from 80
  return 'red';
}

// Or make it configurable
const RED_SCORE_THRESHOLD = 80; // Move to constants.js
const MIN_ANOMALY_TYPES = 2;

if (score >= RED_SCORE_THRESHOLD && anomalyTypes.size >= MIN_ANOMALY_TYPES) {
  return 'red';
}
```

### Debug Production Issue

```javascript
// 1. Check recent logs
tail -f logs/combined.log | grep 'userId'

// 2. Query alert history
db.alerts.find({ user: ObjectId('...') }).sort({ createdAt: -1 }).pretty()

// 3. Check current risk state
db.locationlogs.findOne(
  { user: ObjectId('...') },
  { sort: { timestamp: -1 } }
)

// 4. Verify family connections
db.familyconnections.find({ requester: ObjectId('...') }).pretty()

// 5. Check socket connections
console.log('Connected users:', getConnectedUsers());
```

---

**Happy coding! 🚀**

