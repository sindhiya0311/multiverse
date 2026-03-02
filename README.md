# NOCTIS - Predictive Night Safety OS

<p align="center">
  <img src="client/public/noctis-icon.svg" width="120" alt="NOCTIS Logo">
</p>

<p align="center">
  <strong>A context-aware predictive behavioral safety intelligence platform</strong>
</p>

---

## Overview

NOCTIS is a production-ready MERN stack application designed for personal safety monitoring, primarily during night mobility (10PM–5AM). Unlike traditional safety apps that rely on reactive panic buttons, NOCTIS is **predictive** - it converts raw location data into contextual intelligence, calculates probabilistic behavioral risk scores, and automatically escalates anomalies.

## Key Features

### Core Safety Features
- **Behavioral Risk Engine** - Calculates risk scores (0-100) based on:
  - Route deviation analysis
  - Stop duration monitoring
  - Speed entropy detection
  - Location risk assessment
  - Night time multipliers

- **Context-Aware Status** - Intelligently interprets GPS data:
  - "At Home", "At Office"
  - "Travelling from Home to Hospital"
  - "Stopped in Unknown Area (5 min)"
  - Night Mode Active indicators

- **Shadow Alert System** - Automatic alerts when risk threshold is exceeded (≥80)
- **Manual SOS** - Immediate emergency alert trigger
- **Family Safety Network** - Connect with family members to monitor each other

### Technical Features
- JWT-based authentication with role-based access
- Real-time WebSocket location streaming
- Tagged locations with geofencing
- Risk history timeline with anomaly markers
- GPS simulation mode for testing
- Admin dashboard with analytics

## Tech Stack

### Backend
- Node.js + Express
- MongoDB with Mongoose
- Socket.io for real-time communication
- JWT authentication
- Express Validator

### Frontend
- React 18 with Vite
- TailwindCSS for styling
- Zustand for state management
- React Leaflet for maps
- Recharts for visualizations
- Socket.io Client

## Project Structure

```
noctis/
├── server/                 # Backend application
│   ├── src/
│   │   ├── config/        # Database & constants
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── models/        # Mongoose schemas
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   │   ├── RiskEngine.js      # Risk calculation
│   │   │   ├── ContextEngine.js   # Status generation
│   │   │   ├── AlertService.js    # Alert management
│   │   │   └── SimulationService.js
│   │   ├── socket/        # WebSocket handlers
│   │   └── utils/         # Helpers & seed data
│   ├── package.json
│   └── .env.example
│
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── layouts/       # Layout wrappers
│   │   ├── store/         # Zustand stores
│   │   ├── services/      # API & Socket services
│   │   └── utils/         # Helper functions
│   ├── package.json
│   └── index.html
│
└── README.md
```

## Prerequisites

- Node.js 18+ 
- MongoDB 6+ (local or Atlas)
- npm or yarn

## Installation

### 1. Clone and Setup

```bash
# Navigate to project directory
cd noctis

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Configure Environment

Create `.env` file in the `server` directory:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/noctis
JWT_SECRET=your-super-secure-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

### 3. Seed Database (Optional)

```bash
cd server
npm run seed
```

This creates demo accounts:
- **Admin**: admin@noctis.io / Admin@123
- **Demo User**: demo@noctis.io / Demo@123
- **Family Member**: family@noctis.io / Family@123

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

Access the application at: http://localhost:5173

### Production Build

```bash
# Build frontend
cd client
npm run build

# Start backend (serves static files in production)
cd ../server
NODE_ENV=production npm start
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/logout` - Logout
- `GET /api/v1/auth/me` - Get current user

### Family
- `POST /api/v1/family/request` - Send family request
- `GET /api/v1/family/members` - Get family members
- `POST /api/v1/family/requests/:id/respond` - Accept/reject request

### Location
- `POST /api/v1/location/update` - Update location
- `GET /api/v1/location/history` - Get location history
- `GET /api/v1/location/risk-history` - Get risk timeline

### Tagged Locations
- `GET /api/v1/tagged-locations` - List all
- `POST /api/v1/tagged-locations` - Create new
- `PATCH /api/v1/tagged-locations/:id` - Update
- `DELETE /api/v1/tagged-locations/:id` - Delete

### Alerts
- `POST /api/v1/alerts/sos` - Trigger SOS
- `GET /api/v1/alerts/active` - Get active alerts
- `GET /api/v1/alerts/family` - Get family alerts
- `POST /api/v1/alerts/:id/acknowledge` - Acknowledge alert
- `POST /api/v1/alerts/:id/resolve` - Resolve alert

### Simulation
- `GET /api/v1/simulation/routes` - Get available routes
- `POST /api/v1/simulation/start` - Start simulation
- `POST /api/v1/simulation/stop` - Stop simulation
- `POST /api/v1/simulation/next` - Get next location
- `POST /api/v1/simulation/inject-anomaly` - Inject anomaly

### Admin (requires admin role)
- `GET /api/v1/admin/dashboard` - Dashboard stats
- `GET /api/v1/admin/night-users` - Active night users
- `GET /api/v1/admin/alerts` - All alerts
- `GET /api/v1/admin/alerts/analytics` - Alert analytics

## Risk Engine Algorithm

### Score Components (Max 90 before multiplier)

| Component | Max Score | Thresholds |
|-----------|-----------|------------|
| Route Deviation | 30 | <10%: 0, 10-25%: 10, 25-40%: 20, >40%: 30 |
| Stop Duration | 25 | <2min: 0, 2-4min: 10, 4-7min: 20, >7min: 25 |
| Speed Entropy | 20 | Variance <20: 0, 20-50: 10, >50: 20 |
| Location Risk | 15 | Based on risk zone proximity |

### Night Multipliers
- 22:00-24:00: ×1.2
- 00:00-04:00: ×1.5
- 04:00-05:00: ×1.3

### Alert Thresholds
- **Orange**: Score ≥60
- **Red**: Score ≥80 AND at least 2 anomaly types

## WebSocket Events

### Client → Server
- `location:update` - Send location update
- `sos:trigger` - Trigger SOS alert
- `alert:acknowledge` - Acknowledge alert
- `family:subscribe` - Subscribe to family updates

### Server → Client
- `location:processed` - Processed location data with risk
- `family:location:update` - Family member location update
- `family:presence` - Family member online/offline
- `alert:new` - New alert triggered
- `alert:acknowledged` - Alert acknowledged
- `alert:resolved` - Alert resolved

## Simulation Mode

The application includes a GPS simulation mode for testing:

1. Navigate to **Simulation** page
2. Select a route type:
   - Home to Office (normal commute)
   - Night Walk (pedestrian movement)
   - Erratic Movement (anomalous pattern)
3. Start simulation
4. Inject anomalies to test risk engine:
   - Route Deviation
   - Unexpected Stop
   - Speed Entropy
   - All Combined

## Deployment

### Docker (Recommended)

```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/noctis
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d
CLIENT_URL=https://your-domain.com
```

### MongoDB Atlas Setup

1. Create cluster at mongodb.com/atlas
2. Create database user
3. Whitelist IP addresses
4. Get connection string
5. Update MONGODB_URI in .env

## Security Considerations

- All passwords are hashed with bcrypt (12 rounds)
- JWT tokens expire after 7 days
- Rate limiting on sensitive endpoints
- Socket authentication required
- Admin routes protected by role
- Input validation on all endpoints
- CORS configured for client origin

## License

MIT License - See LICENSE file for details

---

<p align="center">
  Built for predictive safety intelligence
</p>
