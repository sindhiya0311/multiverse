# NOCTIS Setup & Deployment Guide

## 📋 Table of Contents
1. [Local Development](#local-development)
2. [Environment Configuration](#environment-configuration)
3. [MongoDB Setup](#mongodb-setup)
4. [First Run](#first-run)
5. [Production Deployment](#production-deployment)
6. [Troubleshooting](#troubleshooting)

---

## Local Development

### Prerequisites
```
Node.js >= 18.x (Check: node -v)
npm >= 9.x (Check: npm -v)
MongoDB >= 7.x (Check: mongosh --version)
Git (Check: git --version)
```

### Step 1: Clone & Install Dependencies

```bash
# Navigate to project
cd e:\noctis

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Step 2: Configure Environment

#### Backend Configuration

Create `server/.env`:
```env
# Development Environment
NODE_ENV=development
PORT=5001

# Database
MONGODB_URI=mongodb://localhost:27017/noctis

# JWT
JWT_SECRET=noctis-local-dev-secret-key-12345
JWT_EXPIRES_IN=7d

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend Configuration

Frontend auto-configures for local development. Modify `client/vite.config.js` if needed:
```javascript
server: {
  port: 5173,
  proxy: {
    '/api': 'http://localhost:5001',
    '/socket.io': {
      target: 'http://localhost:5001',
      ws: true,
    },
  },
}
```

### Step 3: Start MongoDB

#### Option A: Local MongoDB
```bash
# Windows
mongod

# macOS/Linux
brew services start mongodb-community
# or
mongod
```

#### Option B: MongoDB Atlas (Cloud)
```bash
# Update MONGODB_URI in server/.env to your Atlas connection string
MONGODB_URI=mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/<DATABASE>
```

### Step 4: Seed Initial Data (Optional)

```bash
cd server
npm run seed
```

This creates test users and demo data.

### Step 5: Run Development Servers

#### Terminal 1 - Backend
```bash
cd server
npm run dev
```
Output: `Server running on port 5001`

#### Terminal 2 - Frontend
```bash
cd client
npm run dev
```
Output: `Local: http://localhost:5173`

### Access Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5001/api/v1
- **Socket.io**: ws://localhost:5001/socket.io

---

## Environment Configuration

### Development (.env)
```env
NODE_ENV=development
PORT=5001
MONGODB_URI=mongodb://localhost:27017/noctis
JWT_SECRET=dev-secret-key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Staging (.env.staging)
```env
NODE_ENV=staging
PORT=5001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/noctis-staging
JWT_SECRET=staging-secret-key-change-this
JWT_EXPIRES_IN=7d
CLIENT_URL=https://noctis-staging.example.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
```

### Production (.env.production)
```env
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/noctis
JWT_SECRET=production-secret-key-very-secure-random-string
JWT_EXPIRES_IN=7d
CLIENT_URL=https://noctis.example.com
RATE_LIMIT_WINDOW_MS=600000
RATE_LIMIT_MAX_REQUESTS=50
```

---

## MongoDB Setup

### Local Standalone

```bash
# Windows
# Download from: https://www.mongodb.com/try/download/community
# Run installer and choose "MongoDB Community Server"
# Default connects to: mongodb://localhost:27017

# macOS (Homebrew)
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community

# Linux (Ubuntu)
sudo apt-get install -y mongodb
sudo systemctl start mongod
```

### MongoDB Atlas Cloud

1. Visit https://www.mongodb.com/cloud/atlas
2. Create account
3. Create cluster
4. Create database user
5. Get connection string: `mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/<DATABASE>`
6. Add IP whitelist (use 0.0.0.0/0 for development)
7. Update `.env` with connection string

### Verify MongoDB Connection

```bash
# Test connection
mongosh "mongodb://localhost:27017"

# Or with Atlas
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/noctis"

# Check database
show databases
use noctis
show collections
```

---

## First Run

### Test Data Login

After running `npm run seed`:

| Email | Password | Role |
|-------|----------|------|
| admin@noctis.io | Admin@123 | Admin |
| demo@noctis.io | Demo@123 | User |
| family@noctis.io | Family@123 | User |

### Test Checklist

- [ ] Login with test account
- [ ] Create tagged location
- [ ] Add family member
- [ ] Start tracking (browser must allow geolocation)
- [ ] View risk dashboard
- [ ] Check admin panel (admin account)

---

## Production Deployment

### Option 1: Heroku

#### Backend Deployment

```bash
# Login to Heroku
heroku login

# Create app
heroku create noctis-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=mongodb+srv://...
heroku config:set JWT_SECRET=your-production-secret
heroku config:set CLIENT_URL=https://noctis.example.com

# Deploy
cd server
git push heroku main

# Check logs
heroku logs --tail
```

#### Frontend Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from client directory
cd client
vercel --prod

# Set environment variables in Vercel dashboard
VITE_API_URL=https://noctis-api.herokuapp.com/api/v1
```

### Option 2: AWS EC2 + RDS

#### EC2 Setup

```bash
# SSH into instance
ssh -i key.pem ec2-user@instance-ip

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2
sudo npm i -g pm2

# Clone repository
git clone <repo-url>
cd noctis/server
npm install

# Create .env
nano .env
# Add production configuration

# Start with PM2
pm2 start npm --name "noctis" -- start
pm2 startup
pm2 save

# Install Nginx
sudo yum install -y nginx
sudo systemctl start nginx
```

#### Nginx Configuration

```
server {
    listen 80;
    server_name api.noctis.com;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### HTTPS with Let's Encrypt

```bash
sudo yum install -y certbot python2-certbot-nginx
sudo certbot --nginx -d api.noctis.com
```

### Option 3: Docker Deployment

#### Dockerfile (Server)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5001

CMD ["npm", "start"]
```

#### Dockerfile (Client)

```dockerfile
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7
    container_name: noctis-db
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: noctis

  backend:
    build: ./server
    container_name: noctis-api
    ports:
      - "5001:5001"
    environment:
      MONGODB_URI: mongodb://mongodb:27017/noctis
      JWT_SECRET: docker-secret-key
      NODE_ENV: production
      CLIENT_URL: http://localhost:3000
    depends_on:
      - mongodb

  frontend:
    build: ./client
    container_name: noctis-web
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  mongo_data:
```

#### Deploy with Docker

```bash
docker-compose up -d
```

### Option 4: DigitalOcean App Platform

1. Connect GitHub repository
2. Add environment variables
3. Create MongoDB Managed Database
4. Deploy

### Security Checklist

- [ ] Use HTTPS everywhere
- [ ] Set strong JWT_SECRET (min 32 chars)
- [ ] Enable CORS properly
- [ ] Use rate limiting
- [ ] Enable MongoDB authentication
- [ ] Set NODE_ENV=production
- [ ] Use helmet middleware
- [ ] Enable logging
- [ ] Setup monitoring

---

## Troubleshooting

### MongoDB Connection Error

**Error**: `MongoNetworkError: connect ECONNREFUSED 127.0.0.1:27017`

**Solutions**:
1. Ensure MongoDB is running
2. Check MONGODB_URI in .env
3. Verify firewall rules
4. For Atlas: Check IP whitelist

### CORS Error

**Error**: `Access to XMLHttpRequest blocked by CORS policy`

**Solutions**:
1. Verify CLIENT_URL in server/.env
2. Check that it matches frontend URL
3. Ensure Socket.io CORS config

### Location Permission Denied

**Error**: `GeolocationPositionError: User denies geolocation`

**Solutions**:
1. Browser permission must be allowed
2. Use HTTPS in production
3. Check browser settings

### Socket.io Connection Failed

**Error**: `WebSocket is closed before the connection is established`

**Solutions**:
1. Verify backend running
2. Check firewall/proxy
3. Enable WebSocket support
4. Verify Socket.io auth token

### Port Already in Use

**Error**: `listen EADDRINUSE: address already in use :::5001`

**Solutions**:
```bash
# Find process using port
# Windows
netstat -ano | findstr :5001
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5001
kill -9 <PID>

# Or change PORT in .env
```

### Database Quota Exceeded (MongoDB Atlas)

**Solution**:
1. Upgrade cluster tier
2. Set TTL on location logs (30 days)
3. Archive old alerts

---

## Performance Tuning

### Backend Optimization

```javascript
// Enable compression
app.use(compression());

// Add caching
app.use(cache('5 minutes'));

// Optimize MongoDB queries
locationLogSchema.index({ user: 1, timestamp: -1 });
```

### Frontend Optimization

```bash
# Build with optimization
npm run build

# Check bundle size
npm run preview
```

---

## Monitoring & Logging

### Backend Logging

```bash
# Enable Morgan logging
app.use(morgan('combined'));

# Log to file
const fs = require('fs');
const access = fs.createWriteStream('access.log');
app.use(morgan('combined', { stream: access }));
```

### Application Monitoring

```bash
# Use PM2 plus monitoring
pm2 install pm2-auto-pull
pm2 web
```

---

## Backup & Recovery

### MongoDB Backup

```bash
# Local backup
mongodump --uri "mongodb://localhost:27017/noctis" --out ./backup

# Restore
mongorestore --uri "mongodb://localhost:27017/noctis" ./backup/noctis
```

---

## Support

For deployment issues, check:
1. Error logs: `npm run dev` output
2. MongoDB: `mongosh` connection
3. Network: Browser DevTools Console
4. Firewall: Port access

