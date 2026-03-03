# PRODUCTION DEPLOYMENT GUIDE
# Real-Time Predictive Night Safety Platform

## 1. PRE-DEPLOYMENT CHECKLIST

### Code Quality
- [ ] All simulation code removed
- [ ] RiskEngine verified with real GPS data
- [ ] AlertEngine tested with multi-factor logic
- [ ] DataProcessor coordinate validation working
- [ ] No console.error entries from core services
- [ ] Environment variables configured
- [ ] Database indexes created
- [ ] API rate limiting enabled
- [ ] Security headers configured

### Testing
- [ ] Real location streaming (GPS) tested
- [ ] Risk score calculations verified accurate
- [ ] Red alert triggering tested (score ≥80 + 2+ anomalies)
- [ ] Family notifications working
- [ ] Socket.io real-time events tested
- [ ] Alarm sound plays and loops
- [ ] Emergency modal displays correctly
- [ ] SOS button triggers family alerts
- [ ] Database backups configured
- [ ] Monitoring/logging configured

### Documentation
- [ ] README.md complete
- [ ] SETUP_GUIDE.md updated for production
- [ ] IMPLEMENTATION.md reflects current architecture
- [ ] API documentation current
- [ ] Component documentation updated
- [ ] Deployment runbook created

---

## 2. ENVIRONMENT SETUP

### Backend Environment (.env)
```env
# Node
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/noctis
MONGODB_POOL_SIZE=50

# Authentication
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# Redis (for sessions, caching)
REDIS_URL=redis://redis:6379

# Socket.io
SOCKETIO_CORS_ORIGIN=https://yourdomain.com
SOCKETIO_ADAPTER=redis

# Email (for alerts)
SENDGRID_API_KEY=<key>
SENDGRID_FROM_EMAIL=alerts@yourdomain.com

# SMS (for emergency alerts)
TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>

# AWS S3 (for location logs backup)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_BUCKET=noctis-location-logs

# Monitoring
SENTRY_DSN=<sentry-url>
DATADOG_API_KEY=<key>
DATADOG_APP_KEY=<key>

# API
API_RATE_LIMIT=100
API_RATE_LIMIT_WINDOW=15m
```

### Frontend Environment (.env)
```env
VITE_API_URL=https://api.yourdomain.com
VITE_SOCKET_URL=https://socket.yourdomain.com
VITE_ENVIRONMENT=production
```

---

## 3. DATABASE SETUP

### MongoDB Indexes (CRITICAL for performance)

```javascript
// Create indexes for optimal query performance
db.locationlogs.createIndex({ user: 1, timestamp: -1 })
db.locationlogs.createIndex({ "location": "2dsphere" })
db.locationlogs.createIndex({ "riskScore": 1 })
db.locationlogs.createIndex({ "timestamp": -1 })

db.riskzones.createIndex({ "location": "2dsphere" })

db.taggedlocations.createIndex({ user: 1 })
db.taggedlocations.createIndex({ "location": "2dsphere" })

db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ "lastKnownLocation": "2dsphere" })

db.alerts.createIndex({ user: 1, timestamp: -1 })
db.alerts.createIndex({ status: 1 })
db.alerts.createIndex({ "timestamp": -1 })

db.familyconnections.createIndex({ requester: 1, recipient: 1 })
```

### Database Backup Strategy
- [ ] Configure MongoDB Atlas automated backups (daily)
- [ ] Set retention to 30+ days
- [ ] Test restore procedure
- [ ] Configure S3 export of critical logs
- [ ] Set up alert on backup failure

---

## 4. SERVER DEPLOYMENT

### Docker (Recommended)

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health')"

EXPOSE 5000

CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: secure_password
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./server
    environment:
      MONGODB_URI: mongodb://root:secure_password@mongodb:27017/noctis
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "5000:5000"
    depends_on:
      - mongodb
      - redis
    restart: unless-stopped

  frontend:
    build: ./client
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://localhost:5000
    restart: unless-stopped

volumes:
  mongo_data:
```

### Kubernetes Deployment

#### backend-deployment.yaml
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: noctis-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: noctis-backend
  template:
    metadata:
      labels:
        app: noctis-backend
    spec:
      containers:
      - name: backend
        image: noctis/backend:latest
        ports:
        - containerPort: 5000
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: noctis-secrets
              key: mongodb-uri
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
```

---

## 5. SCALING CONSIDERATIONS

### Horizontal Scaling

**Socket.io Adapter**: Use Redis/MongoDB adapter for multi-server deployment
```javascript
import { createAdapter } from "@socket.io/redis-adapter";

const pubClient = redis.createClient();
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

**Load Balancing**:
- Use sticky sessions for Socket.io connections
- Configure Nginx/HAProxy with session affinity
- Health check endpoint: `/health`

### Vertical Scaling

**Node.js Clustering**:
```javascript
import cluster from 'cluster';
import os from 'os';

if (cluster.isMaster) {
  const numCores = os.cpus().length;
  for (let i = 0; i < numCores; i++) {
    cluster.fork();
  }
  cluster.on('exit', () => cluster.fork());
} else {
  startServer();
}
```

### Database Scaling

**MongoDB Atlas M10+ Cluster**:
- Replica set (3+ nodes)
- Sharding for >1M documents per day
- Read replicas for analytics queries
- TTL index on LocationLog (30-day retention)

```javascript
// TTL index: auto-delete logs after 30 days
db.locationlogs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 2592000 })
```

---

## 6. MONITORING & LOGGING

### Sentry Error Tracking
```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.errorHandler());
```

### Structured Logging
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Log key events
logger.info('RED_ALERT_TRIGGERED', { userId, riskScore });
logger.error('LOCATION_PROCESSING_FAILED', { userId, error });
```

### Key Metrics to Monitor
- **Real-time**: Active Socket.io connections
- **Performance**: Location processing latency (target: <100ms)
- **Alerts**: RED alerts triggered per hour
- **System**: CPU, memory, database connections
- **API**: Request latency, error rate, throughput

---

## 7. SECURITY HARDENING

### TLS/SSL Certificate
```bash
# Use Let's Encrypt with certbot
sudo certbot certonly --standalone -d api.yourdomain.com
```

### CORS/CSRF Protection
```javascript
import cors from 'cors';
import helmet from 'helmet';

app.use(helmet());
app.use(cors({
  origin: process.env.SOCKETIO_CORS_ORIGIN,
  credentials: true,
}));
```

### Rate Limiting
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);

// Stricter limit for location updates
const locationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Max 30 updates per minute per user
});

io.on('connection', (socket) => {
  socket.on('location:update', locationLimiter, handleLocationUpdate);
});
```

### Data Encryption
- TLS 1.3 for all connections
- Encrypt sensitive fields in MongoDB
- Rotate JWT secrets regularly

---

## 8. DEPLOYMENT PIPELINE

### GitHub Actions CI/CD
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        run: |
          ssh user@server "cd /app && git pull && npm install && npm run build"
```

### Blue-Green Deployment
```bash
# Deploy to green environment
docker pull noctis/backend:latest
docker run -d --name backend-green -p 5001:5000 noctis/backend:latest

# Run health checks
wait_for_health_check "http://localhost:5001/health"

# Switch traffic (update load balancer)
update_nginx_config "upstream backend { server localhost:5001; }"
nginx -s reload

# Keep blue around for quick rollback
```

---

## 9. ROLLBACK PROCEDURE

```bash
# Monitor deployment
watch -n 1 'curl http://api.yourdomain.com/health'

# If issues detected:
1. Stop new deployment
2. Revert load balancer to previous version
3. Investigate logs in Sentry
4. Fix issue locally
5. Create hotfix PR
6. Redeploy after tests pass
```

---

## 10. DISASTER RECOVERY

### RTO/RPO Targets
- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 15 minutes

### Backup Strategy
- Daily automated MongoDB backups
- 30-day retention
- Monthly full backup to cold storage
- Test restore monthly
- Off-site backup replication

### Failover Procedure
```bash
# Detect failure (monitoring alert)
# Failover to backup MongoDB cluster
# Redirect traffic to standby server
# Restore from latest backup
# Verify data integrity
# Resume normal operations
```

---

## 11. PERFORMANCE TUNING

### Database Query Optimization
```javascript
// Bad: Full collection scan
User.find({ currentRiskScore: { $gt: 80 } })

// Good: Use indexed field
User.find({ currentRiskScore: { $gt: 80 } }).hint({ currentRiskScore: 1 })

// Explain query performance
User.find({ currentRiskScore: { $gt: 80 } }).explain('executionStats')
```

### Caching Strategy
```javascript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600 }); // 10 min TTL

// Cache frequently accessed data
export async function getUser(userId) {
  const cached = cache.get(`user:${userId}`);
  if (cached) return cached;
  
  const user = await User.findById(userId);
  cache.set(`user:${userId}`, user);
  return user;
}
```

### Connection Pooling
```
MONGODB_POOL_SIZE=50
```

---

## 12. PRODUCTION LAUNCH CHECKLIST

### Before Launch
- [ ] Load tests pass (1000 concurrent users)
- [ ] Failover tests successful
- [ ] Backup/restore verified
- [ ] Monitoring configured
- [ ] Alert thresholds set
- [ ] On-call rotation established
- [ ] Support documentation complete
- [ ] Security audit passed

### Post-Launch (First Week)
- [ ] Monitor error rates (target: <0.1%)
- [ ] Track location processing latency
- [ ] Monitor database performance
- [ ] Check user feedback
- [ ] Verify alert triggering accuracy
- [ ] Test emergency SOS flow with users

---

## 13. ONGOING MAINTENANCE

### Weekly Tasks
- Review error logs
- Monitor database size
- Check backup completion

### Monthly Tasks
- Security patches
- Dependency updates
- Performance analysis
- Disaster recovery drill

### Quarterly Tasks
- Full security audit
- Load test with 50% more users
- Update documentation
- Review cost optimization

---

## CONTACT & ESCALATION

- **On-call Engineer**: [contact info]
- **CTO**: [contact info]
- **Emergency Hotline**: [phone]
- **Incident Channel**: Slack #noctis-incidents

