# ✅ CHECKLIST TRIỂN KHAI REALTIME

## 📋 PRE-DEPLOYMENT CHECKLIST

### 🔧 1. Infrastructure Setup

- [ ] EC2 D có Redis đã cài đặt
  ```bash
  redis-cli ping  # Should return PONG
  ```

- [ ] Security Groups đã cấu hình:
  - [ ] EC2 D: Port 4000 (WebSocket) mở cho Frontend
  - [ ] EC2 D: Port 6379 (Redis) mở cho Backend A/B/C (Private IPs)
  - [ ] Backend A/B/C: Port 5000 mở cho Frontend

- [ ] Network connectivity:
  ```bash
  # From Backend A/B/C → EC2 D
  telnet <EC2_D_PRIVATE_IP> 6379
  
  # From Frontend → EC2 D
  curl http://<EC2_D_PUBLIC_IP>:4000/health
  ```

### 📦 2. Dependencies Installation

- [ ] **Backend (EC2 A, B, C):**
  ```bash
  npm install ioredis socket.io
  ```

- [ ] **Frontend (EC2 E):**
  ```bash
  npm install socket.io-client
  ```

### 📝 3. Environment Variables

- [ ] **EC2 D (.env):**
  ```env
  PORT=4000
  REDIS_HOST=localhost
  REDIS_PORT=6379
  FRONTEND_URL=http://your-frontend-url.com
  ```

- [ ] **Backend A (.env):**
  ```env
  REDIS_HOST=<EC2_D_PRIVATE_IP>
  REDIS_PORT=6379
  SERVER_ID=A
  ```

- [ ] **Backend B (.env):**
  ```env
  REDIS_HOST=<EC2_D_PRIVATE_IP>
  REDIS_PORT=6379
  SERVER_ID=B
  ```

- [ ] **Backend C (.env):**
  ```env
  REDIS_HOST=<EC2_D_PRIVATE_IP>
  REDIS_PORT=6379
  SERVER_ID=C
  ```

- [ ] **Frontend (.env):**
  ```env
  REACT_APP_PUBSUB_URL=http://<EC2_D_PUBLIC_IP>:4000
  ```

### 📂 4. Files Created/Modified

- [ ] **Backend Files:**
  - [ ] `utils/eventPublisher.js` (created)
  - [ ] `middleware/eventEmitter.js` (created)
  - [ ] `routes/recipeRoutes.js` (modified - added publishEvent)
  - [ ] `routes/blogRoutes.js` (modified - added publishEvent)
  - [ ] `pubsub-server.js` (created)

- [ ] **Frontend Files:**
  - [ ] `src/services/websocket.js` (created)
  - [ ] `src/App.js` (modified - added WebSocket connect)

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Deploy PubSub Server (EC2 D)

- [ ] Copy `pubsub-server.js` to EC2 D
- [ ] Start Redis:
  ```bash
  sudo systemctl start redis
  sudo systemctl enable redis
  ```
- [ ] Start PubSub server:
  ```bash
  cd backend
  node pubsub-server.js
  ```
- [ ] Verify running:
  ```bash
  curl http://localhost:4000/health
  # Expected: {"status":"healthy","role":"pubsub-server"}
  ```

### Step 2: Deploy Backend Servers (EC2 A, B, C)

- [ ] **On EC2 A:**
  ```bash
  cd backend
  SERVER_ID=A npm start
  ```

- [ ] **On EC2 B:**
  ```bash
  cd backend
  SERVER_ID=B npm start
  ```

- [ ] **On EC2 C:**
  ```bash
  cd backend
  SERVER_ID=C npm start
  ```

- [ ] Verify Redis connection in logs:
  ```
  ✅ Redis Publisher connected
  ```

### Step 3: Deploy Frontend (EC2 E)

- [ ] Build frontend:
  ```bash
  cd Clould_Computing-main
  npm run build
  ```

- [ ] Start frontend:
  ```bash
  npm start
  # or serve -s build
  ```

---

## ✅ TESTING CHECKLIST

### 🧪 1. Component Tests

- [ ] **Redis Connection:**
  ```bash
  redis-cli ping
  # Expected: PONG
  ```

- [ ] **PubSub Server:**
  ```bash
  curl http://<EC2_D>:4000/health
  # Expected: JSON with status and connectedClients
  ```

- [ ] **Backend Health:**
  ```bash
  curl http://<BACKEND_A>:5000/api/health
  # Expected: JSON with serverId: "A"
  ```

### 🔌 2. WebSocket Connection Test

- [ ] Open browser console (F12)
- [ ] Navigate to frontend URL
- [ ] Check console logs:
  ```
  ✅ WebSocket connected to PubSub server
  ```

### 🔄 3. Realtime Update Tests

#### Test 1: Same Backend
- [ ] Open 2 browser tabs
- [ ] Tab 1: Stay on Home page
- [ ] Tab 2: Add new recipe
- [ ] **Expected:** Tab 1 shows new recipe immediately

#### Test 2: Different Backends (CRITICAL)
- [ ] Open Browser 1 → Connect to Backend A
- [ ] Open Browser 2 → Connect to Backend B
- [ ] Browser 2: Create recipe
- [ ] **Expected:** Browser 1 sees recipe immediately ✅
- [ ] Check console logs in Browser 1:
  ```
  📥 Received dataChanged event: {channel: "recipe:created"}
  Data changed, refreshing recipes
  ```

#### Test 3: Multiple Operations
- [ ] Create recipe → Check UI updates
- [ ] Edit recipe → Check UI updates
- [ ] Delete recipe → Check UI updates
- [ ] Add to favorites → Check UI updates
- [ ] Create blog → Check UI updates

### 📊 4. Load Test

- [ ] Open 5+ browser tabs/windows
- [ ] All connected to different backends
- [ ] Perform CRUD operations
- [ ] **Expected:** All tabs update in realtime

---

## 🐛 TROUBLESHOOTING CHECKLIST

### ❌ WebSocket Not Connecting

- [ ] Check EC2 D Security Group allows port 4000
- [ ] Verify `REACT_APP_PUBSUB_URL` is correct
- [ ] Check PubSub server is running:
  ```bash
  netstat -tulpn | grep 4000
  ```
- [ ] Check browser console for errors

### ❌ Events Not Broadcasting

- [ ] Verify Redis is running:
  ```bash
  redis-cli ping
  ```
- [ ] Check Backend logs for:
  ```
  📤 Published to recipe:created
  ```
- [ ] Check PubSub logs for:
  ```
  📢 Broadcasting recipe:created
  ```
- [ ] Verify `REDIS_HOST` in Backend .env

### ❌ UI Not Updating

- [ ] Check browser console for:
  ```
  📥 Received dataChanged event
  ```
- [ ] Verify `useCallback` dependencies
- [ ] Check event listener registered:
  ```javascript
  window.addEventListener('dataChanged', ...)
  ```

### ❌ Redis Connection Errors

- [ ] Check Redis logs:
  ```bash
  sudo tail -f /var/log/redis/redis-server.log
  ```
- [ ] Verify Redis bind address:
  ```bash
  redis-cli CONFIG GET bind
  ```
- [ ] Test connection:
  ```bash
  redis-cli -h <EC2_D_IP> -p 6379 ping
  ```

---

## 📈 MONITORING CHECKLIST

### 🔍 1. Real-time Monitoring

- [ ] WebSocket connections count:
  ```bash
  curl http://localhost:4000/health | jq .connectedClients
  ```

- [ ] Redis PubSub channels:
  ```bash
  redis-cli PUBSUB CHANNELS
  ```

- [ ] Active subscriptions:
  ```bash
  redis-cli PUBSUB NUMSUB recipe:created
  ```

### 📊 2. Performance Metrics

- [ ] Average latency < 250ms
- [ ] WebSocket reconnection < 5 seconds
- [ ] Redis memory usage < 100MB
- [ ] CPU usage normal (no spikes)

### 📝 3. Log Files

- [ ] Backend logs show event publishing
- [ ] PubSub logs show broadcasting
- [ ] Frontend console shows event receiving
- [ ] No error logs

---

## 🎯 SUCCESS CRITERIA

- ✅ Multiple users see updates in realtime
- ✅ Works across different backend servers
- ✅ Update latency < 500ms
- ✅ No manual refresh needed
- ✅ WebSocket auto-reconnects
- ✅ No console errors
- ✅ All CRUD operations emit events
- ✅ System stable under load

---

## 📞 SUPPORT

### Common Commands

**Check all services:**
```bash
./test-realtime.sh
```

**Monitor Redis:**
```bash
redis-cli MONITOR
```

**Check WebSocket connections:**
```bash
netstat -an | grep 4000 | wc -l
```

**Restart services:**
```bash
# PubSub Server
pkill -f pubsub-server
node pubsub-server.js

# Redis
sudo systemctl restart redis
```

### Debug Mode

**Enable verbose logging:**
```javascript
// In pubsub-server.js
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id, socket.handshake.address);
});
```

---

**📚 Full Documentation:**
- Setup Guide: `REALTIME_SETUP_GUIDE.md`
- Architecture: `ARCHITECTURE_DIAGRAM.md`
- Summary: `REALTIME_SOLUTION_SUMMARY.md`
