# NOCTIS Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites Check
```bash
node -v        # Should be 18.x or higher
npm -v         # Should be 9.x or higher
mongosh --version  # MongoDB must be installed
```

---

## Step 1: Install Dependencies

```bash
# Navigate to project root
cd e:\noctis

# Install backend
cd server
npm install

# Install frontend
cd ../client
npm install

# Return to root
cd ..
```

---

## Step 2: Setup MongoDB

### Option A: Local MongoDB
```bash
# Start MongoDB
mongod

# In another terminal, verify connection
mongosh
```

### Option B: MongoDB Atlas (Cloud)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create account and cluster
3. Create database user
4. Get connection string
5. Update `server/.env`

---

## Step 3: Configure Environment

### Backend `.env`
Create `server/.env`:
```env
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/noctis
JWT_SECRET=noctis-dev-secret-key-change-this
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Step 4: Seed Test Data (Optional but Recommended)

```bash
cd server
npm run seed
```

This creates test users:
- **Admin**: admin@noctis.io / Admin@123
- **Demo**: demo@noctis.io / Demo@123
- **Family**: family@noctis.io / Family@123

---

## Step 5: Start Development Servers

### Terminal 1: Backend
```bash
cd server
npm run dev
```
Expected output: `Server running on port 5001`

### Terminal 2: Frontend
```bash
cd client
npm run dev
```
Expected output: `Local: http://localhost:5173`

---

## Step 6: Access Application

Open browser and go to: **http://localhost:5173**

### Test Flow
1. **Login** with demo account
2. **Start Tracking** (browser must allow geolocation)
3. **Create Tagged Location** (save your home address)
4. **Go to Family** and add family member
5. **View Dashboard** to see risk scoring
6. **Check Timeline** for risk history

---

## 📊 System Overview

### What You Get

**Real-time Features:**
- ✅ Live location tracking (every 2-3 seconds)
- ✅ Instant risk scoring
- ✅ Automatic alerts for high-risk behavior
- ✅ Real-time family notifications

**Intelligence Features:**
- ✅ Context-aware status (where are you?)
- ✅ Route deviation detection
- ✅ Stop duration analysis
- ✅ Speed anomaly detection
- ✅ Night mode multipliers

**Safety Features:**
- ✅ Shadow alerts (automatic)
- ✅ SOS button (manual)
- ✅ Family safety network
- ✅ Risk timeline & replay

---

## 🎯 Core User Flows

### As a Regular User

**Setup:**
1. Login to account
2. Add tagged locations (home, office, etc.)
3. Invite family members
4. Enable location tracking

**Daily Usage:**
1. Start tracking when going out
2. Monitor risk meter
3. Receive automatic alerts if at risk
4. View family members on map
5. Check timeline later

### As Admin

1. Login with admin account
2. View admin panel
3. See active night users
4. View risk heatmap
5. Check alert logs

---

## 📱 Architecture at a Glance

```
┌─────────────┐                    ┌──────────────┐
│   Browser   │                    │  Node.js     │
│  (React)    │◄─────HTTP/WS──────►│  Server      │
│             │                    │  (Express)   │
└─────────────┘                    └──────────────┘
                                           │
                                           │
                                    ┌──────▼──────┐
                                    │  MongoDB    │
                                    │  Database   │
                                    └─────────────┘

Components:
- Frontend: React + Vite + TailwindCSS
- Backend: Express + Node.js + Socket.io
- Database: MongoDB + Mongoose
- Real-time: Socket.io for WebSocket
```

---

## 🔐 Authentication

**Three-tier security:**
1. JWT tokens (7-day expiration)
2. Bcrypt password hashing
3. Role-based access control

**Flow:**
```
Login → JWT Token → Store in localStorage → Auto-add to API headers
```

---

## 🗺️ Key APIs

### Location Updates
```
POST /api/v1/location/update
→ Raw GPS data
→ Risk engine calculates score
→ Context engine generates status
→ Response includes risk + context
```

### Real-time Notifications
```
WebSocket Socket.io events
→ location:update (client → server)
→ location:processed (server → client)
→ alert:new (server → family)
→ family:location:update (broadcast)
```

---

## 📈 Risk Scoring System

### Components (What affects your score)

| Component | Why | Max Points |
|-----------|-----|-----------|
| Route Deviation | Are you on expected path? | 30 |
| Stop Duration | How long stopped in unknown area? | 25 |
| Speed Entropy | Erratic movement? | 20 |
| Location Risk | High-crime area? | 15 |
| Night Multiplier | 10 PM–5 AM active | 1.5x |

### Score Levels

| Score | Status | Action |
|-------|--------|--------|
| 0–40 | ✅ Safe | None |
| 40–60 | 🟡 Elevated | Monitor |
| 60–80 | 🟠 Orange | Alert |
| ≥80 + 2+ anomalies | 🔴 Red | Auto-notify family |

---

## 🌙 Night Mode

**Activated:** 22:00 – 05:00 (10 PM – 5 AM)

**Effects:**
- Risk multiplier = 1.2x – 1.5x
- Enhanced monitoring
- Visual indicator in UI

---

## 🏠 Tagged Locations

**Mark important places:**
- Home
- Office
- Friend's house
- Hospital
- Gym
- Custom locations

**Why:**
- Auto-context generation
- Route detection
- Deviation alerts
- Visit tracking

---

## 👥 Family Safety Network

**How it works:**
1. Send family request (by email)
2. Family member accepts
3. Once accepted: Can see live location
4. Receive automatic alerts
5. Can see risk score & status

**Privacy:**
- Family can only see accepted members
- Toggle location sharing per user
- No data before acceptance

---

## 🚨 Alert System

### Automatic (Shadow Alert)
- Triggered when: Risk ≥ 80 + 2+ anomaly types
- Action: Instantly notifies family
- No user action needed

### Manual (SOS)
- User presses SOS button
- Immediately notifies family
- Can add message
- Shows location

---

## 🌐 Real-time Updates

**Update Frequency:**
- Location: Every 2–3 seconds
- Risk: Recalculated on each update
- Map: Refreshes in real-time
- Alerts: Instant notifications

**Broadcast:**
- Only to authorized family members
- Only when connection accepted
- Respects privacy settings

---

## ⚙️ Troubleshooting

### Backend Won't Start
```
Error: EADDRINUSE: address already in use :::5001
→ Kill process on port 5001
→ Or change PORT in .env
```

### MongoDB Connection Failed
```
Error: connect ECONNREFUSED
→ Ensure MongoDB is running
→ Check MONGODB_URI in .env
```

### Location Permission Denied
```
→ Browser blocked geolocation
→ Allow in browser settings
→ HTTPS required in production
```

### Socket.io Not Connecting
```
→ Check backend running
→ Verify port 5001 accessible
→ Check firewall settings
```

---

## 📝 Common Tasks

### View Server Logs
```bash
# Backend logs appear in terminal running npm run dev
# Check for errors and connection info
```

### View API Calls
```
Browser DevTools → Network tab
→ Filter by XHR/Fetch
→ See all API calls and responses
```

### Reset Test Data
```bash
# Delete current data
use noctis
db.dropDatabase()

# Reseed
npm run seed
```

### Change Default Port
```env
# In server/.env
PORT=5002
```

---

## 🎨 UI Customization

### Change Colors
Edit `client/tailwind.config.js`:
```javascript
colors: {
  noctis: {
    500: '#YourColor',
  },
  risk: {
    safe: '#YourGreen',
    elevated: '#YourYellow',
  },
}
```

### Add New Pages
1. Create component in `client/src/pages/`
2. Add route in `App.jsx`
3. Add navigation in `MainLayout.jsx`

---

## 🔄 Development Workflow

```
Write Code
    ↓
Save File
    ↓
HMR Refresh (automatic)
    ↓
See changes in browser
    ↓
Check console for errors
```

**Tips:**
- Keep browser DevTools open
- Use React DevTools extension
- Check Network tab for API issues
- Use console.log for debugging

---

## 📊 Monitoring

### What to Watch

**Server Health:**
- Check terminal output for errors
- Monitor MongoDB logs
- Check CPU/memory usage (pm2 monit)

**Application Health:**
- Monitor WebSocket connections
- Check alert delivery
- Track API response times

---

## 🚀 When Ready for Production

1. ✅ Update JWT_SECRET (strong random string)
2. ✅ Update MONGODB_URI (production cluster)
3. ✅ Set NODE_ENV=production
4. ✅ Enable HTTPS
5. ✅ Configure CORS properly
6. ✅ Setup monitoring
7. ✅ Backup database daily
8. ✅ Test alerting system

---

## 📚 Documentation

- **[Full README](./README.md)** - Complete overview
- **[Setup Guide](./SETUP_GUIDE.md)** - Detailed setup
- **[Backend Guide](./server/README.md)** - Architecture & APIs
- **[Frontend Guide](./client/README.md)** - Components & state
- **[Deployment Guide](./SETUP_GUIDE.md#production-deployment)** - Deploy options

---

## 🆘 Need Help?

**Check:**
1. Console errors first
2. Network tab for API issues
3. Server logs
4. MongoDB status

**Documentation:**
- Backend API: See `/server/README.md`
- Frontend setup: See `/client/README.md`
- Deployment: See `SETUP_GUIDE.md`

---

## ✅ Checklist

- [ ] Node.js 18+ installed
- [ ] MongoDB running
- [ ] Dependencies installed
- [ ] .env files configured
- [ ] Test data seeded
- [ ] Backend running on :5001
- [ ] Frontend running on :5173
- [ ] Can login with test account
- [ ] Geolocation working
- [ ] Socket.io connected
- [ ] Can create tagged location
- [ ] Can add family member
- [ ] Risk scoring working
- [ ] Admin panel accessible

---

**NOCTIS is ready to run!** 🌙

Happy coding! For questions, see the full documentation.
