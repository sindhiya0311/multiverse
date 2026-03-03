# NOCTIS Frontend Development Guide

## 📁 Project Structure

```
client/
├── src/
│   ├── components/                    # Reusable Components
│   │   ├── RiskMeter.jsx             # Circular animated risk score
│   │   ├── LiveMap.jsx               # Real-time location map
│   │   ├── NightModeIndicator.jsx    # Night mode badge
│   │   ├── StatusBadge.jsx           # Current status display
│   │   ├── AlertBanner.jsx           # Alert notification banner
│   │   ├── SOSButton.jsx             # Emergency button
│   │   ├── RiskBreakdown.jsx         # Risk score breakdown chart
│   │   └── index.js                  # Component exports
│   │
│   ├── pages/                         # Full Page Components
│   │   ├── Login.jsx                 # Authentication page
│   │   ├── Register.jsx              # Registration page
│   │   ├── Dashboard.jsx             # Main safety dashboard
│   │   ├── Family.jsx                # Family management
│   │   ├── TaggedLocations.jsx       # Location management
│   │   ├── RiskTimeline.jsx          # Risk history & replay
│   │   ├── AdminPanel.jsx            # Admin dashboard
│   │   └── index.js                  # Page exports
│   │
│   ├── store/                         # Zustand State Management
│   │   ├── authStore.js              # Auth state & login logic
│   │   ├── locationStore.js          # Location tracking state
│   │   ├── familyStore.js            # Family connections state
│   │   ├── alertStore.js             # Alerts state
│   │   └── index.js                  # Store exports
│   │
│   ├── services/                      # API & WebSocket
│   │   ├── api.js                    # Axios instance with interceptors
│   │   ├── socket.js                 # Socket.io client
│   │   └── index.js                  # Service exports
│   │
│   ├── layouts/                       # Layout Components
│   │   ├── MainLayout.jsx            # App shell (sidebar, navbar)
│   │   └── AuthLayout.jsx            # Auth page shell
│   │
│   ├── utils/
│   │   └── helpers.js                # Date, color, distance utilities
│   │
│   ├── App.jsx                        # Main router
│   ├── main.jsx                       # React DOM entry
│   ├── index.css                      # Global styles
│   └── [other files]
│
├── public/                            # Static assets
│   ├── noctis-icon.svg
│   └── [images, fonts]
│
├── package.json
├── vite.config.js                     # Vite configuration
├── tailwind.config.js                 # TailwindCSS theme
├── postcss.config.js                  # PostCSS config
├── index.html                         # HTML entry point
└── README.md
```

---

## 🎨 UI/UX Architecture

### Design System

**Colors**:
- **Primary**: Noctis indigo (#6366F1)
- **Night**: Dark slate (#0F172A)
- **Safe**: Green (#10B981)
- **Elevated**: Amber (#F59E0B)
- **Orange**: Orange (#F97316)
- **Danger**: Red (#EF4444)

**Typography**:
- **Heading**: 24-36px, bold
- **Body**: 14-16px, regular
- **Small**: 12px, medium

**Spacing**: 8px base unit (4, 8, 12, 16, 24, 32, 48px)

### Component Library

#### 1. RiskMeter Component
```jsx
<RiskMeter
  score={riskData.score}      // 0-100
  size="lg"                   // sm, md, lg, xl
  showLabel={true}
  animated={true}
/>
```

#### 2. LiveMap Component
```jsx
<LiveMap
  center={[lat, lng]}
  currentLocation={location}
  familyMembers={members}
  taggedLocations={locations}
  riskScore={score}
  showTaggedRadii={true}
/>
```

#### 3. Alert Banner
```jsx
<AlertBanner
  alert={alertData}
  onAcknowledge={() => {}}
/>
```

#### 4. Status Badge
```jsx
<StatusBadge
  status="Travelling from Home to Hospital"
  riskScore={75}
/>
```

---

## 🔄 State Management (Zustand)

### Authentication Store

```javascript
useAuthStore:
  - state: { user, token, isAuthenticated, isLoading, error }
  - actions: { login, register, logout, updateUser, refreshUser }
  - persistence: localStorage ('noctis-auth')
```

**Usage**:
```jsx
const { user, login, isLoading } = useAuthStore();

const handleLogin = async (email, password) => {
  const result = await login(email, password);
  if (result.success) navigate('/dashboard');
};
```

### Location Store

```javascript
useLocationStore:
  - state: { currentLocation, locationHistory, riskData, contextData, isTracking, familyLocations }
  - actions: { startTracking, stopTracking, fetchLocationHistory, fetchRiskHistory }
  - persistence: none (real-time data)
```

**Usage**:
```jsx
const { currentLocation, riskData, startTracking } = useLocationStore();

useEffect(() => {
  startTracking(); // Watch browser geolocation
}, []);
```

### Family Store

```javascript
useFamilyStore:
  - state: { familyMembers, pendingRequests, sentRequests }
  - actions: { sendRequest, respondToRequest, removeMember, fetchFamilyMembers }
  - persistence: none
```

### Alert Store

```javascript
useAlertStore:
  - state: { activeAlerts, familyAlerts, alertHistory }
  - actions: { triggerSOS, fetchAlerts, acknowledgeAlert, resolveAlert }
  - persistence: none
```

---

## 🔌 API Integration

### Axios Setup (api.js)

```javascript
const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' }
});

// Request Interceptor (adds JWT)
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor (handles 401)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('noctis-auth');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### Making API Calls

```jsx
// In component/hook
const response = await api.post('/location/update', {
  latitude: 40.7128,
  longitude: -74.0060,
  speed: 5.2,
  accuracy: 10,
  heading: 45,
  altitude: 0
});

const { location, risk, context } = response.data.data;
```

---

## 🔌 WebSocket Events

### Socket.io Setup (socket.js)

```javascript
import { io } from 'socket.io-client';

export const initializeSocket = (token) => {
  const socket = io('/', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
  });

  // Handle events
  socket.on('location:processed', (data) => {
    useLocationStore.setState({
      riskData: data.risk,
      contextData: data.context,
    });
  });

  return socket;
};
```

### Emitting Location Updates

```javascript
export const emitLocationUpdate = (location) => {
  socket.emit('location:update', location);
};
```

### Listening for Alerts

```javascript
socket.on('alert:new', (alertData) => {
  useAlertStore.getState().addAlert(alertData);
  toast.error(`Alert: ${alertData.user.name}`);
  
  // Browser notification
  if ('Notification' in window) {
    new Notification('NOCTIS Alert', {
      body: alertData.user.name,
      icon: '/noctis-icon.svg',
    });
  }
});
```

---

## 📱 Responsive Design

### Breakpoints (TailwindCSS)
- **Mobile**: 320px (no prefix)
- **Tablet**: 768px (`md:`)
- **Desktop**: 1024px (`lg:`)
- **Wide**: 1280px (`xl:`)

### Mobile Optimization
- Stack layout on mobile
- Simplify navigation (hamburger menu)
- Full-width components
- Touch-friendly buttons (44px minimum)

---

## 🎯 Key Pages

### Dashboard Page
```jsx
// Main safety interface
- Risk Meter (center)
- Live Map (below)
- Status Badge
- Alert Banners
- Start/Stop Tracking button
- Quick access to family, locations
```

### Family Page
```jsx
// Connection management
- Family members list
- Pending requests
- Send request form
- Member location cards
- Real-time presence status
```

### Locations Page
```jsx
// Tagged location CRUD
- Create new location
- List all locations
- Edit/Delete locations
- Map preview
- Visit history
```

### RiskTimeline Page
```jsx
// Historical analysis
- Risk score graph
- Anomaly timeline
- Route replay
- Export data
```

### Admin Panel
```jsx
// Admin-only dashboard
- Active night users
- Risk heatmap
- Alert logs
- User analytics
- System metrics
```

---

## 🔐 Authentication Flow

### Login/Register
```
User enters credentials
    ↓
useAuthStore.login(email, password)
    ↓
API POST /auth/login
    ↓
Server returns { user, token }
    ↓
Store token in localStorage
    ↓
Set API default header
    ↓
Navigate to /dashboard
    ↓
Initialize Socket.io with token
```

### Protected Routes
```jsx
const ProtectedRoute = ({ children, adminOnly }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (adminOnly && user?.role !== 'admin') return <Navigate to="/dashboard" />;
  
  return children;
};
```

---

## 🎨 Styling Approach

### TailwindCSS Classes
```jsx
// Example component
<div className="p-6 bg-gradient-to-br from-night-900 to-night-950 rounded-xl border border-night-800">
  <h1 className="text-2xl font-bold text-white mb-4">Risk Score</h1>
  <p className="text-night-400">Your current safety status</p>
</div>
```

### Dark Mode
- All components use dark theme by default
- CSS variables: `--color-night-900`, `--color-noctis-500`
- No light mode support (intentional design choice)

---

## 📊 Data Processing

### Risk Score Display
```javascript
// In component
const riskScore = riskData?.score || 0;
const riskLevel = getRiskLevel(riskScore);  // safe, elevated, orange, red
const riskColor = getRiskColor(riskScore);  // hex color
const riskLabel = getRiskLabel(riskScore);  // Safe, Warning, Critical, etc.
```

### Distance Calculation
```javascript
const distance = calculateDistance(lat1, lon1, lat2, lon2); // meters
```

### Date Formatting
```javascript
const formatted = formatDate(date);           // "Today at 3:45 PM"
const relative = formatRelativeTime(date);    // "2 hours ago"
```

---

## 🧪 Development Workflow

### Start Dev Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build          # Creates /dist
npm run preview        # Preview production build
```

### Code Organization
- One component per file
- Hooks in separate files in `utils/`
- Store logic in `store/` files
- Services in `services/` files

---

## 📈 Performance Optimization

### Code Splitting
- React lazy loading for pages
- Separate chunks per page

### Memoization
```jsx
const RiskMeter = React.memo(({ score }) => {
  return <div>{score}</div>;
});
```

### Image Optimization
- SVG for icons
- WebP for images
- Lazy loading for images

---

## 🔍 Debugging

### Browser DevTools
- React DevTools extension
- Redux/Zustand DevTools

### Console Logging
```javascript
console.log('Location update:', location);
console.error('API Error:', error);
```

### Network Tab
- Monitor API calls
- Check WebSocket frames
- Inspect response headers

---

## 📚 Useful Utilities

### helpers.js

```javascript
// Date utilities
formatDate(date)          // "Today at 3:45 PM"
formatRelativeTime(date)  // "2 hours ago"

// Risk utilities
getRiskLevel(score)       // "safe", "elevated", "orange", "red"
getRiskColor(score)       // "#10b981"
getRiskLabel(score)       // "Safe", "Warning", "Critical"

// Location utilities
calculateDistance(lat1, lon1, lat2, lon2)  // meters
```

---

## 🌐 Environment Configuration

### Vite Proxy (Development)
```javascript
// vite.config.js
server: {
  proxy: {
    '/api': 'http://localhost:5001',
    '/socket.io': {
      target: 'http://localhost:5001',
      ws: true,
    },
  },
}
```

### Production Environment
- Backend URL from environment variable
- API base URL configured in `api.js`

---

## 📝 Best Practices

### Component Organization
```jsx
// ✅ Good
export default function Dashboard() {
  const { user } = useAuthStore();
  const { riskData } = useLocationStore();
  
  return <div>{/* content */}</div>;
}

// ❌ Avoid
function Dashboard() { /* huge component */ }
```

### State Management
```jsx
// ✅ Use stores
const { data, action } = useStore();

// ❌ Avoid
const [data, setData] = useState();
api.get().then(res => setData(res));
```

### Error Handling
```jsx
// ✅ Handle errors
try {
  await api.post('/endpoint', data);
} catch (error) {
  toast.error(error.response.data.message);
}

// ❌ Ignore errors
api.post('/endpoint', data);
```

---

## 🚀 Deployment

### Build
```bash
npm run build
```

### Static Hosting (Vercel, Netlify)
1. Push to GitHub
2. Connect repository
3. Set build command: `npm run build`
4. Set output directory: `dist`

### Environment Variables
```
VITE_API_URL=https://api.noctis.com/api/v1
```

---

## 📚 Related Documentation

- [Main README](../README.md)
- [Setup Guide](../SETUP_GUIDE.md)
- [Backend Guide](../server/README.md)

