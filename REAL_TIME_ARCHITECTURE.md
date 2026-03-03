# NOCTIS REAL-TIME ARCHITECTURE
# Predictive Night Safety Platform - Production Architecture

## 🎯 System Overview

NOCTIS is a real-time predictive safety platform that converts continuous GPS streams into behavioral intelligence. The system detects anomalies in real-time and automatically alerts family members when high-risk patterns emerge.

```
User Device (GPS Streaming)
        ↓
   Socket.io (TLS)
        ↓
  Real-Time Pipeline
  ├─→ DataProcessor (validation, orchestration)
  ├─→ RiskEngine (calculate 5-component score)
  ├─→ AlertEngine (multi-factor alert logic)
  ├─→ MongoDB (persist + index)
  └─→ Redis (caching, session state)
        ↓
   Broadcasting
  ├─→ User (risk score, breakdown)
  ├─→ Family (location + anomalies)
  └─→ Admin (dashboard)
        ↓
   Emergency Path (RED alert only)
  ├─→ Play alarm sound
  ├─→ Show modal with location, risk breakdown, call button
  └─→ Notify family via Socket.io + email/SMS
```

---

## 📊 Data Model

### Core Collections

#### LocationLog (Time-Series)
```javascript
{
  _id: ObjectId,
  user: ObjectId,
  latitude: Number,      // -90 to 90
  longitude: Number,     // -180 to 180
  speed: Number,         // km/h
  accuracy: Number,      // meters
  heading: Number,       // 0-360 degrees
  altitude: Number,      // meters
  timestamp: Date,       // every 2-3 seconds
  
  // Risk Scoring
  isNightMode: Boolean,
  riskScore: Number,     // 0-100
  baseScore: Number,     // before night mult
  riskBreakdown: {
    routeDeviation: 0,   // 0-30 pts
    stopDuration: 0,     // 0-25 pts
    speedEntropy: 0,     // 0-20 pts
    locationRiskWeight: 0, // 0-15 pts
    nightMultiplier: 1.0 // 1.2-1.5x
  },
  
  // Context
  status: String,        // "Traveling", "Stopped", "At Home"
  contextualInfo: {
    nearbyTaggedLocation: ObjectId,
    isMoving: Boolean,
    isStationary: Boolean,
    stationaryDuration: Number,
  },
  
  // Anomalies
  anomalies: [{
    type: String,        // "route_deviation", "stop_duration", ...
    severity: String,    // "low", "medium", "high"
    value: Number,       // component score
    description: String,
  }],
  
  createdAt: Date,
}

// Indexes (CRITICAL)
db.locationlogs.createIndex({ user: 1, timestamp: -1 })
db.locationlogs.createIndex({ "location": "2dsphere" })
db.locationlogs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 2592000 }) // TTL: 30 days
Estimated size: ~100 bytes/record × 1200/day × 365 = ~44 GB/year/user
```

#### User
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  phone: String,
  password: String,      // bcrypted
  
  // Current State
  currentRiskScore: Number,      // last computed
  currentBaseScore: Number,
  currentStatus: String,
  isNightModeActive: Boolean,
  
  // Location State
  lastKnownLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date,
    accuracy: Number,
  },
  lastLocationUpdateAt: Date,
  
  // Presence
  isOnline: Boolean,
  lastSeen: Date,
  
  // Settings
  noctisEnabled: Boolean,
  nightModeAuto: Boolean,
  nightModeStartHour: Number,    // 22 (10 PM)
  nightModeEndHour: Number,      // 5 (5 AM)
  
  // Role
  role: String,                  // "user" | "admin"
  
  createdAt: Date,
  updatedAt: Date,
}
```

#### Alert
```javascript
{
  _id: ObjectId,
  user: ObjectId,        // alert subject
  type: String,          // "shadow" | "sos" | "system"
  severity: String,      // "low" | "medium" | "high" | "critical"
  
  // Risk Data
  riskScore: Number,
  baseScore: Number,
  location: {
    latitude: Number,
    longitude: Number,
  },
  
  // Breakdown
  anomalyBreakdown: {
    routeDeviation: Number,
    stopDuration: Number,
    speedEntropy: Number,
    locationRisk: Number,
    nightMultiplier: Number,
    anomalyTypes: [String],
    anomalyCount: Number,
  },
  
  // Notifications
  notifiedMembers: [{
    user: ObjectId,
    notifiedAt: Date,
  }],
  
  // Status
  status: String,        // "active" | "acknowledged" | "resolved"
  triggeredAt: Date,
  acknowledgedAt: Date,
  acknowledgedBy: ObjectId,
  resolvedAt: Date,
  resolvedBy: ObjectId,
  resolution: String,    // "safe" | "false_alarm" | "other"
  
  isNightMode: Boolean,
  createdAt: Date,
}
```

#### RiskZone
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  location: {
    type: "Point",
    coordinates: [longitude, longitude],
  },
  radius: Number,        // meters
  riskLevel: String,     // "low" | "high"
  
  createdAt: Date,
}

// 2dsphere index for geospatial queries
db.riskzones.createIndex({ "location": "2dsphere" })
```

#### FamilyConnection
```javascript
{
  _id: ObjectId,
  requester: ObjectId,
  recipient: ObjectId,
  relationship: String,  // "parent", "sibling", "friend"
  status: String,        // "pending" | "accepted" | "rejected"
  
  // Permissions
  canViewLocation: Boolean,
  canReceiveAlerts: Boolean,
  canCall: Boolean,
  
  createdAt: Date,
  acceptedAt: Date,
}
```

---

## 🔄 Real-Time Data Flow

### 1. Location Capture (Client)

```javascript
// client/src/store/locationStore.js
useLocationStore.startTracking() → navigator.geolocation.watchPosition()
```

**Frequency**: Every 2-3 seconds during active tracking
**Accuracy**: Device-dependent (typically 5-50 meters)
**Payload**:
```json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "speed": 15.5,
  "accuracy": 25,
  "heading": 90,
  "altitude": 10,
  "timestamp": "2024-01-15T22:45:30Z"
}
```

### 2. Socket.io Transport

```javascript
// client/src/services/socket.js
socket.emit('location:update', location);

// server/src/socket/socketHandler.js
socket.on('location:update', async (data) => {
  await dataProcessor.processLocationUpdate(userId, data);
});
```

**Security**: JWT authentication, TLS, rate limiting (30 updates/min)
**Latency**: <50ms network + processing

### 3. DataProcessor Orchestration

```
processLocationUpdate()
├─→ validateCoordinates()    // Check bounds, accuracy
├─→ RiskEngine.calculateRealTimeRiskScore()
│   ├─→ calculateRouteDeviation()
│   ├─→ calculateStopDurationScore()
│   ├─→ calculateSpeedEntropy()
│   ├─→ calculateLocationRiskWeight()
│   └─→ getNightMultiplier()
├─→ generateContext()         // Status generation
├─→ LocationLog.create()      // Persist to DB
├─→ AlertEngine.processRiskScore()  // Check conditions
├─→ User.update()             // Update current state
└─→ Socket.io.emit()          // Broadcast results
```

### 4. Risk Calculation (Real-Time)

#### a) Route Deviation (0-30 points)

```javascript
calculateRouteDeviation() {
  // Get last 10 historical points (2-3 min history)
  const historicalPoints = userLocationBuffer.slice(-10);
  
  // Build expected route corridor
  const expectedCorridor = buildCorridor(historicalPoints, 200); // 200m width
  
  // Calculate perpendicular distance from current location to corridor
  const distance = perpendicular_distance(currentLocation, expectedCorridor);
  
  // Score: 0 pts (on route) to 30 pts (>1 km deviation)
  const score = Math.min(30, (distance / 1000) * 30);
  
  return {
    score,
    severity: score > 15 ? 'high' : 'low',
    description: `Route deviation: ${distance.toFixed(0)}m from expected path`,
  };
}
```

**Anomaly triggered**: Deviation > 500m for >30 seconds

#### b) Stop Duration (0-25 points)

```javascript
calculateStopDurationScore() {
  // Detect stationarity: speed < 2 km/h
  const isStationary = currentSpeed < 2;
  
  if (!isStationary) return { score: 0, severity: 'low' };
  
  // Check if stopped at tagged location (home, work, etc.)
  const isAtTaggedLocation = await checkTaggedLocationProximity(
    currentLocation,
    100 // 100m radius
  );
  
  if (isAtTaggedLocation) return { score: 0, severity: 'none' };
  
  // Track stop duration in unknown zone
  if (!userStopInfo[userId]) {
    userStopInfo[userId] = { startTime: Date.now() };
  }
  
  const stopDuration = Date.now() - userStopInfo[userId].startTime;
  const stopMinutes = stopDuration / 60000;
  
  // Score: 5 pts @ 5 min, 25 pts @ 30 min
  const score = Math.min(25, (stopMinutes / 30) * 25);
  
  return {
    score,
    severity: score > 10 ? 'high' : 'low',
    description: `Stopped in unknown zone for ${stopMinutes.toFixed(1)} minutes`,
  };
}
```

**Anomaly triggered**: Stationary > 15 min in unknown zone

#### c) Speed Entropy (0-20 points)

```javascript
calculateSpeedEntropy() {
  // Maintain rolling buffer of last 10 speed samples
  userSpeedBuffer.push(currentSpeed);
  if (userSpeedBuffer.length > 10) userSpeedBuffer.shift();
  
  // Calculate variance (deviation from mean)
  const mean = userSpeedBuffer.reduce((a, b) => a + b, 0) / userSpeedBuffer.length;
  const variance = userSpeedBuffer.reduce(
    (sum, speed) => sum + Math.pow(speed - mean, 2),
    0
  ) / userSpeedBuffer.length;
  
  // Standard deviation = sqrt(variance)
  const stdDev = Math.sqrt(variance);
  
  // Score: 0-20 based on stdDev (target: smooth travel = low variance)
  // High variance = erratic/suspicious
  const score = Math.min(20, stdDev * 2);
  
  return {
    score,
    severity: score > 10 ? 'high' : 'low',
    description: `Speed variance: ${stdDev.toFixed(1)} km/h (erratic: ${score > 10})`,
  };
}
```

**Anomaly triggered**: Speed oscillation (0→50→0 km/h) suggesting suspicious activity

#### d) Location Risk Weight (0-15 points)

```javascript
async calculateLocationRiskWeight() {
  // Query geospatial high-risk zones
  const nearbyZones = await RiskZone.find({
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [currentLocation.longitude, currentLocation.latitude],
        },
        $maxDistance: 1000, // 1 km
      },
    },
  });
  
  if (!nearbyZones || nearbyZones.length === 0) {
    return { score: 0, severity: 'none' };
  }
  
  // Score based on highest risk zone
  const maxRisk = Math.max(...nearbyZones.map(z => 
    z.riskLevel === 'high' ? 15 : 5
  ));
  
  return {
    score: maxRisk,
    severity: 'high',
    description: `In high-risk zone: ${nearbyZones[0].name}`,
  };
}
```

#### e) Night Multiplier (1.2x - 1.5x)

```javascript
getNightMultiplier() {
  const hour = new Date().getHours();
  
  // Night mode: 22:00 - 05:00
  if (hour >= 22 || hour < 5) {
    if (hour >= 22 && hour < 23) return 1.2; // 10 PM
    if (hour >= 23 && hour < 1) return 1.5;  // Midnight peak
    if (hour >= 1 && hour < 4) return 1.5;   // Late night peak
    if (hour >= 4 && hour < 5) return 1.3;   // Early morning
  }
  
  return 1.0; // Daytime
}
```

### 5. Alert Processing

#### RED Alert Trigger Conditions

```javascript
determineAlertLevel(riskResult) {
  // RED: score ≥80 AND at least 2 different anomaly categories
  if (riskResult.score >= 80 && riskResult.multipleAnomalyCategories) {
    return 'red';
  }
  
  // ORANGE: score ≥60 (logged but no auto-notify)
  if (riskResult.score >= 60) {
    return 'orange';
  }
  
  // SAFE: <60
  return 'safe';
}

async processRiskScore(userId, riskData) {
  if (riskData.score >= 80 && riskData.multipleAnomalyCategories) {
    await triggerRedAlert(userId, riskData); // Auto-trigger shadow alert
    
    // NOTIFY FAMILY
    const families = await FamilyConnection.find({
      $or: [
        { requester: userId, canReceiveAlerts: true },
        { recipient: userId, canReceiveAlerts: true },
      ],
    });
    
    for (const conn of families) {
      const memberId = conn.requester === userId ? conn.recipient : conn.requester;
      io.to(`user:${memberId}`).emit('alert:red', {
        alertId: alert._id,
        riskScore: riskData.score,
        anomalies: riskData.anomalies,
        location: currentLocation,
        timestamp: new Date(),
      });
    }
  }
}
```

### 6. Frontend Alert Handling

```javascript
// client/src/pages/Dashboard.jsx
useEffect(() => {
  socket.on('alert:red', (alertData) => {
    setEmergencyAlert(alertData);
    setShowEmergencyModal(true);
    playAlarmSound(); // Repeating alarm
  });
}, []);

// EmergencyAlertModal.jsx
<div className="bg-gradient-to-br from-red-600 via-red-700 to-red-900">
  <div className="text-4xl font-bold">SAFETY ALERT</div>
  <div className="text-3xl font-bold text-red-200">
    Risk: {alertData.riskScore}/100
  </div>
  <div className="grid grid-cols-5 gap-3">
    <div>Route Deviation: {breakdown.routeDeviation}/30</div>
    <div>Stop Duration: {breakdown.stopDuration}/25</div>
    <div>Speed Entropy: {breakdown.speedEntropy}/20</div>
    <div>Location Risk: {breakdown.locationRisk}/15</div>
    <div>Night Mult: {breakdown.nightMultiplier}x</div>
  </div>
  <div className="flex gap-2">
    <button className="bg-red-600">EMERGENCY CALL</button>
    <button className="bg-red-900">I'm Safe</button>
  </div>
  <div>Auto-acknowledges in {countdown}s</div>
</div>
```

---

## 🚀 Performance Characteristics

### Latency Breakdown (per location update)

| Step | Latency | Component |
|------|---------|-----------|
| Network (GPS → Server) | 50ms | Socket.io |
| Coordinate Validation | <1ms | DataProcessor |
| Route Deviation Calc | 5ms | RiskEngine (buffer lookup) |
| Stop Duration Calc | 2ms | RiskEngine (tagged location check) |
| Speed Entropy Calc | <1ms | RiskEngine (variance on 10 samples) |
| Location Risk Calc | 8ms | RiskEngine (geospatial query) |
| Night Multiplier | <1ms | RiskEngine (hour lookup) |
| MongoDB Insert | 2ms | LocationLog.create |
| Alert Check | 1ms | AlertEngine |
| Broadcast | 30ms | Socket.io (async) |
| **Total** | **~98ms** | **End-to-end** |

**Target**: <150ms 99th percentile

### Throughput

- **Single Server**: 200-500 concurrent users
- **Multi-Server (3x)**: 600-1500 concurrent users
- **Database**: 1,440 inserts/day/user × 10,000 users = 14.4M/day = 167/second (easily handled)

### Storage

- **LocationLog**: ~44 GB/year/user (auto-purge after 30 days)
- **Database**: 500 GB for 10,000 users
- **Total (replicas)**: 1.5 TB with replication

---

## 🔐 Security Architecture

### Authentication Flow

```
Client obtains JWT token
        ↓
JWT stored in localStorage (encrypted)
        ↓
API headers: Authorization: Bearer <token>
        ↓
Socket.io authentication:
  socket.handshake.auth = { token: jwt }
        ↓
Middleware validates signature
        ↓
Socket attached to user context
```

### Data Protection

- **In Transit**: TLS 1.3
- **At Rest**: MongoDB encryption (enterprise feature)
- **Sensitive Fields**: Encrypted in application layer
- **Passwords**: bcrypt (salt rounds: 12)

### Rate Limiting

```
/api/*:          100 requests/15 min per IP
location:update: 30 updates/min per user
/auth/login:     5 attempts/30 min per IP
```

---

## 📈 Monitoring & Observability

### Key Metrics

```
Real-time Dashboard:
├─ Active Socket.io Connections
├─ Location Updates/sec (target: >100)
├─ Avg Processing Latency (target: <100ms)
├─ RED Alerts/hour
├─ Database Write Latency
├─ CPU Usage
├─ Memory Usage
└─ API Error Rate
```

### Alerts

```
• Processing latency > 200ms
• Error rate > 0.1%
• Database connection pool exhausted
• Location update rate drops > 50%
• RED alert spam (>10 in 5 min)
• Database replication lag > 5s
```

---

## 🎯 Scalability Roadmap

### Phase 1 (Current)
- Single server
- 100-500 users
- Basic monitoring
- Manual backups

### Phase 2
- 3-server cluster with load balancer
- 1000-5000 users
- Redis caching
- Automated backups
- Docker/Kubernetes

### Phase 3
- Geographically distributed servers
- 10,000+ users
- Database sharding by region
- Advanced analytics
- ML-based anomaly detection

### Phase 4
- Predictive models (ML)
- Multi-region failover
- Edge computing for location processing
- Real-time visualization platform

---

## 📋 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 | UI |
| | Vite | Build tool |
| | Zustand | State management |
| | Tailwind CSS | Styling |
| | Leaflet | Map rendering |
| **Backend** | Node.js 18+ | Runtime |
| | Express | HTTP server |
| | Socket.io | Real-time WebSocket |
| | MongoDB 7+ | Primary database |
| | Redis | Caching + sessions |
| **Infrastructure** | Docker | Containerization |
| | Kubernetes | Orchestration |
| | Nginx | Reverse proxy |
| | Let's Encrypt | TLS certificates |
| **Monitoring** | Sentry | Error tracking |
| | Datadog | Metrics + logs |
| | Prometheus | Metrics collection |

---

## 🚨 Incident Response

### RED Alert Triggering

**If RED alerts spam (>10 in 5 min)**:
1. Check API latency spike
2. Verify database is online
3. Check for GPS spoofing/bugs
4. Review recent RiskEngine changes
5. Disable anomaly injection if active

**If alerts stopped triggering**:
1. Verify Socket.io connections
2. Check AlertEngine logs
3. Verify family connections exist
4. Test location:update event

**If broadcast failed**:
1. Check Socket.io Redis adapter
2. Verify family member sockets are connected
3. Check message size (<10KB)

---

## 📞 Support Contacts

- **Technical Lead**: [Name]
- **On-call**: [Phone+Slack]
- **Emergency**: [Hotline]

