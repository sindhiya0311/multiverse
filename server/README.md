# NOCTIS Backend Architecture & Development Guide

## 📁 Project Structure

```
server/
├── src/
│   ├── config/
│   │   ├── constants.js         # Risk thresholds, night mode settings
│   │   └── database.js          # MongoDB connection setup
│   │
│   ├── models/                   # Mongoose Schemas
│   │   ├── User.js              # User profile & settings
│   │   ├── LocationLog.js        # Location history with risk data
│   │   ├── TaggedLocation.js     # Saved locations (home, office, etc)
│   │   ├── RiskZone.js          # High-risk areas
│   │   ├── FamilyConnection.js  # Family relationships
│   │   ├── Alert.js             # Alert logs
│   │   └── index.js             # Model exports
│   │
│   ├── controllers/              # Request handlers
│   │   ├── authController.js    # Login, register, profile
│   │   ├── locationController.js # Location updates & history
│   │   ├── taggedLocationController.js # Location CRUD
│   │   ├── familyController.js  # Family management
│   │   ├── alertController.js   # Alert handling
│   │   ├── adminController.js   # Admin metrics
│   │   └── index.js             # Controller exports
│   │
│   ├── routes/                   # Express Route Handlers
│   │   ├── authRoutes.js
│   │   ├── locationRoutes.js
│   │   ├── taggedLocationRoutes.js
│   │   ├── familyRoutes.js
│   │   ├── alertRoutes.js
│   │   ├── adminRoutes.js
│   │   └── index.js             # Main router
│   │
│   ├── services/                 # Business Logic Layer
│   │   ├── RiskEngine.js         # Risk scoring algorithm
│   │   ├── ContextEngine.js      # Status/context analysis
│   │   ├── AlertService.js       # Alert triggering & management
│   │   ├── SimulationService.js  # Testing utility
│   │   └── index.js             # Service exports
│   │
│   ├── middleware/               # Express Middleware
│   │   ├── auth.js              # JWT verification, generateToken
│   │   ├── validation.js        # Request validation rules
│   │   ├── errorHandler.js      # Error handling, asyncHandler
│   │   ├── rateLimiter.js       # Rate limiting
│   │   └── index.js             # Middleware exports
│   │
│   ├── socket/
│   │   └── socketHandler.js     # WebSocket event handlers
│   │
│   ├── utils/
│   │   └── seedData.js          # Test data generator
│   │
│   └── index.js                  # Application entry point
│
├── package.json
├── .env                          # Environment variables (git-ignored)
├── .env.example                  # Example env file
└── README.md
```

---

## 🔄 Request Flow

### Typical Request Flow

```
Client HTTP Request
    ↓
Express Server
    ↓
[CORS & Security Middleware]
    ↓
[Authentication Middleware] (if protected route)
    ↓
[Validation Middleware]
    ↓
Route Matching
    ↓
Controller Function
    ↓
Service Layer (Business Logic)
    ↓
Database Query (Mongoose)
    ↓
Response JSON
    ↓
Client Receives Response
```

### Example: Location Update

```
Client sends GPS → POST /api/v1/location/update
    ↓
locationController.updateLocation()
    ↓
riskEngine.calculateRiskScore()
contextEngine.generateStatus()
alertService.triggerShadowAlert() [if needed]
    ↓
LocationLog.create()
User.findByIdAndUpdate()
    ↓
Socket.io Broadcast to Family
    ↓
Response sent to client
```

---

## 🎯 Core Services

### 1. RiskEngine Service

**Purpose**: Calculate behavioral risk scores

**Key Methods**:
- `calculateRiskScore(userId, currentLocation, previousLocations)`
- `calculateRouteDeviationScore()`
- `calculateStopDurationScore()`
- `calculateSpeedEntropyScore()`
- `calculateLocationRiskScore()`
- `getNightMultiplier()`
- `determineAlertLevel(score, anomalies)`

**Risk Calculation Formula**:

```javascript
const baseScore = 
  routeDeviation (0-30) +
  stopDuration (0-25) +
  speedEntropy (0-20) +
  locationRisk (0-15);

const nightMultiplier = getNightMultiplier(); // 1.0, 1.2, 1.3, or 1.5

let finalScore = baseScore * nightMultiplier;
finalScore = Math.min(100, Math.max(0, finalScore)); // Cap at 100
```

**Alert Level Logic**:
```javascript
if (score >= 80 && uniqueAnomalyTypes.size >= 2) {
  return 'red';    // Shadow Alert triggered
} else if (score >= 60) {
  return 'orange';
} else if (score >= 40) {
  return 'elevated';
}
return 'safe';
```

### 2. ContextEngine Service

**Purpose**: Convert GPS into human-readable context

**Key Methods**:
- `generateStatus(userId, currentLocation, previousLocations)`
- `findCurrentTaggedLocation(lat, lng, taggedLocations)`
- `analyzeMovement(currentLocation, previousLocations)`
- `analyzeTravelContext(userId, currentLocation, previousLocations, taggedLocations)`
- `isNightModeActive()`

**Status Examples**:

| Scenario | Status |
|----------|--------|
| Inside "Home" (tagged location) | "At Home (Night Mode Active)" |
| Moving & not in tagged | "Travelling from Home to Hospital" |
| Stationary > 3 min, not tagged | "Stopped in Unknown Area (5 min)" |
| Moving in night mode | "In Transit (Night Mode Active)" |

### 3. AlertService

**Purpose**: Manage alert lifecycle

**Key Methods**:
- `triggerShadowAlert(userId, riskData, location)`
- `triggerSOSAlert(userId, location, message)`
- `acknowledgeAlert(alertId, userId)`
- `resolveAlert(alertId, userId, resolution, notes)`
- `notifyFamilyMembers(userId, alert)`
- `getActiveAlertsForUser(userId)`
- `getFamilyAlerts(userId, options)`

**Alert Flow**:

```
Risk Score ≥ 80 + 2+ Anomaly Types
    ↓ (Automatic)
alertService.triggerShadowAlert()
    ↓
Alert.create() - Saved to DB
    ↓
Socket.io emit 'alert:new' to family
    ↓
Family receives notification
    ↓
Can acknowledge/resolve
```

---

## 🔌 WebSocket Events

### Server-Client Communication

```javascript
// Client sends location update
socket.emit('location:update', {
  latitude: 40.7128,
  longitude: -74.0060,
  speed: 5.2,
  accuracy: 10,
  heading: 45,
  altitude: 0
});

// Server processes and broadcasts
socket.on('location:processed', (data) => {
  // Receive risk score, context, alerts
});

// Family members notified
socket.on('family:location:update', (data) => {
  // Update family member on map
});

// Alert triggered
socket.on('alert:new', (alertData) => {
  // Show notification
});
```

---

## 🛡️ Authentication Flow

### JWT Authentication

```javascript
// Login
1. User sends email + password
2. Password verified with bcrypt
3. JWT token generated: jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
4. Token returned to client
5. Client stores in localStorage

// Protected Requests
1. Client sends: Authorization: Bearer <token>
2. Server middleware verifies JWT
3. req.userId set from decoded token
4. Proceed to controller

// Token Refresh
1. If token expired (401 response)
2. Client removes token from localStorage
3. Redirects to /login
```

---

## 🗄️ Database Indexes

**Important Indexes**:

```javascript
// User searches
User.index({ email: 1 });

// Location queries
LocationLog.index({ user: 1, timestamp: -1 });
LocationLog.index({ user: 1, createdAt: -1 });

// Cleanup old logs (30 days)
LocationLog.index({ timestamp: 1 }, { expireAfterSeconds: 30*24*60*60 });

// Family connections
FamilyConnection.index({ requester: 1, status: 1 });
FamilyConnection.index({ recipient: 1, status: 1 });

// Risk zones (geospatial)
RiskZone.index({ geometry: '2dsphere' });

// Alerts
Alert.index({ user: 1, triggeredAt: -1 });
```

---

## 📡 API Endpoints Reference

### Authentication `/auth`
```
POST   /register          - Create account
POST   /login             - Get JWT token
POST   /logout            - Clear session
GET    /me                - Get current user
PATCH  /profile           - Update profile
PATCH  /password          - Change password
PATCH  /toggle-location-sharing - Privacy toggle
```

### Location `/location`
```
POST   /update            - Send location update
GET    /history           - Get location history
GET    /risk-history      - Get risk timeline
GET    /family/:memberId  - Get family member location
POST   /expected-route    - Set expected route (for deviation calc)
DELETE /expected-route    - Clear expected route
```

### Tagged Locations `/tagged-locations`
```
POST   /                  - Create tagged location
GET    /                  - List all tagged locations
GET    /:id               - Get specific location
PATCH  /:id               - Update location
DELETE /:id               - Delete location
POST   /check             - Check if at tagged location
GET    /types             - Get location type options
```

### Family `/family`
```
POST   /request           - Send family request
GET    /requests/pending  - Get pending requests
GET    /requests/sent     - Get sent requests
POST   /requests/:id/respond - Accept/reject request
DELETE /requests/:id/cancel - Cancel request
GET    /members           - Get accepted family members
DELETE /members/:id       - Remove family member
PATCH  /members/:id/settings - Update visibility settings
```

### Alerts `/alerts`
```
POST   /sos               - Trigger manual SOS
GET    /my                - Get my alerts
GET    /active            - Get active alerts
GET    /family            - Get family alerts
POST   /:id/acknowledge   - Mark as acknowledged
POST   /:id/resolve       - Mark as resolved
```

### Admin `/admin`
```
GET    /dashboard         - Dashboard stats
GET    /night-users       - Active night mode users
GET    /heatmap           - Risk heatmap data
GET    /alerts            - All alerts
GET    /users             - User analytics
```

---

## 🧪 Error Handling

### Custom Error Handler

```javascript
// Throw errors in controllers
throw new AppError('User not found', 404);
throw new AppError('Invalid password', 401);

// Caught by errorHandler middleware
app.use(errorHandler);

// Response format
{
  success: false,
  status: 'fail',         // or 'error'
  message: 'User not found',
  errorCode: null,
  statusCode: 404
}
```

### Validation Errors

```javascript
// Validation middleware catches errors
if (!errors.isEmpty()) {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: [
      { field: 'email', message: 'Invalid email' },
      { field: 'password', message: 'Too short' }
    ]
  });
}
```

---

## 🔒 Security Considerations

### Implemented
- ✅ JWT with expiration
- ✅ Bcrypt password hashing
- ✅ CORS restrictions
- ✅ Helmet security headers
- ✅ Rate limiting
- ✅ Input validation
- ✅ Socket.io authentication
- ✅ Role-based access control

### Production Checklist
- ✅ Use HTTPS
- ✅ Strong JWT secret (32+ chars)
- ✅ Helmet middleware enabled
- ✅ CORS to specific domain
- ✅ Rate limit configured
- ✅ MongoDB auth enabled
- ✅ Sensitive .env not committed
- ✅ Logging configured

---

## 📊 Data Models Overview

### User Model
```javascript
{
  email: String,
  password: String (hashed),
  name: String,
  phone: String,
  role: String (user | admin),
  isLocationSharingEnabled: Boolean,
  isOnline: Boolean,
  lastKnownLocation: { lat, lng, timestamp },
  currentRiskScore: Number (0-100),
  currentStatus: String,
  isNightModeActive: Boolean,
  settings: { nightModeAutoEnable, alertsEnabled, soundEnabled },
  timestamps: { createdAt, updatedAt }
}
```

### LocationLog Model
```javascript
{
  user: ObjectId (ref User),
  latitude: Number,
  longitude: Number,
  speed: Number,
  accuracy: Number,
  heading: Number,
  altitude: Number,
  timestamp: Date,
  riskScore: Number,
  riskBreakdown: { routeDeviation, stopDuration, speedEntropy, locationRisk, nightMultiplier },
  status: String,
  contextualInfo: { nearbyTaggedLocation, isMoving, isStationary, travellingFrom, travellingTo },
  anomalies: Array<{ type, severity, description, value }>,
  metadata: { deviceId, batteryLevel, networkType, isSimulated },
  timestamps: { createdAt, updatedAt }
}
```

---

## 🚀 Performance Optimization

### Database Queries
- Use indexes on frequently queried fields
- Limit results with pagination
- Project only needed fields

### Socket.io
- Use rooms for targeted broadcasts
- Implement acknowledgments for critical events
- Batch updates when possible

### API Caching
- Cache location types
- Cache admin stats (5 min)
- Cache user preferences

---

## 🧩 Adding New Features

### Adding a New Endpoint

1. **Create controller** in `controllers/newController.js`
```javascript
export const getNewData = asyncHandler(async (req, res) => {
  // Logic here
  res.json({ success: true, data: result });
});
```

2. **Create route** in `routes/newRoutes.js`
```javascript
router.get('/new', authenticate, getNewData);
```

3. **Add to main router** in `routes/index.js`
```javascript
router.use('/new', newRoutes);
```

### Adding a New Service

1. **Create service** in `services/NewService.js`
```javascript
class NewService {
  async processData(input) { return result; }
}
export default new NewService();
```

2. **Export from index** in `services/index.js`
3. **Use in controller**
```javascript
import { newService } from '../services/index.js';
```

---

## 📝 Logging & Monitoring

### Morgan HTTP Logging
```javascript
app.use(morgan('combined'));
```

### Application Logging
```javascript
console.log('User connected:', userId);
console.error('Alert triggered:', error);
```

### Production Logging
- Use Winston or Bunyan
- Log to file
- Rotate logs daily
- Monitor with tools like Loggly

---

## 🔧 Development Utilities

### Seed Test Data
```bash
npm run seed
```

### Run Dev Server
```bash
npm run dev
```

### Start Production
```bash
npm start
```

---

## 📚 Related Documentation

- [Main README](../README.md)
- [Setup Guide](../SETUP_GUIDE.md)
- [Frontend Guide](../client/README.md)

