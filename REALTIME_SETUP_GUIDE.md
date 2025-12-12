# ============================================
# HƯỚNG DẪN CÀI ĐẶT & TRIỂN KHAI REALTIME
# ============================================

## 📦 1. CÀI ĐẶT DEPENDENCIES

### Backend (EC2 A, B, C, D):
```bash
cd cloud-master/backend
npm install ioredis socket.io
```

### Frontend (EC2 E):
```bash
cd Clould_Computing-main
npm install socket.io-client
```

## 🔧 2. CÀI ĐẶT REDIS (EC2 D)

### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install redis-server -y
sudo systemctl start redis
sudo systemctl enable redis
```

### Kiểm tra Redis:
```bash
redis-cli ping
# Output: PONG
```

## ⚙️ 3. CẤU HÌNH ENVIRONMENT

### EC2 D (.env):
```env
PORT=4000
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://your-frontend-url.com
```

### EC2 A, B, C (.env):
Thêm vào file .env hiện tại:
```env
REDIS_HOST=<EC2_D_PRIVATE_IP>
REDIS_PORT=6379
SERVER_ID=A  # hoặc B, C
```

### Frontend (.env):
Thêm vào file .env:
```env
REACT_APP_PUBSUB_URL=http://<EC2_D_PUBLIC_IP>:4000
```

## 🚀 4. CHẠY HỆ THỐNG

### Bước 1: Khởi động PubSub Server (EC2 D)
```bash
cd cloud-master/backend
node pubsub-server.js
```

### Bước 2: Khởi động Backend A, B, C
```bash
cd cloud-master/backend
SERVER_ID=A npm start  # Trên EC2 A
SERVER_ID=B npm start  # Trên EC2 B  
SERVER_ID=C npm start  # Trên EC2 C
```

### Bước 3: Khởi động Frontend (EC2 E)
```bash
cd Clould_Computing-main
npm start
```

## ✅ 5. KIỂM TRA HOẠT ĐỘNG

### Test 1: WebSocket Connection
1. Mở F12 Console trong browser
2. Kiểm tra log: `✅ WebSocket connected to PubSub server`

### Test 2: Realtime Update
1. Mở 2 browser/tab khác nhau
2. User 1: Vào trang Home
3. User 2: Thêm recipe mới
4. **Kỳ vọng:** User 1 thấy recipe mới NGAY LẬP TỨC (không F5)

### Test 3: Multi-Backend
1. User 1 kết nối Backend A
2. User 2 kết nối Backend B
3. User 2 xóa recipe
4. **Kỳ vọng:** User 1 thấy recipe bị xóa NGAY LẬP TỨC

## 📊 6. MONITORING

### Backend Logs:
```bash
# Kiểm tra Redis connection
✅ Redis Publisher connected
📤 Published to recipe:created: {...}

# Kiểm tra PubSub
📢 Broadcasting recipe:created: {...}
```

### Frontend Console:
```javascript
✅ WebSocket connected to PubSub server
📥 Received dataChanged event: {channel: "recipe:created", ...}
🔔 Global event received: recipe:created
Data changed, refreshing recipes: {...}
```

## 🐛 7. TROUBLESHOOTING

### Vấn đề: WebSocket không kết nối
**Giải pháp:**
- Kiểm tra EC2 D Security Group mở port 4000
- Kiểm tra `REACT_APP_PUBSUB_URL` đúng IP public EC2 D
- Kiểm tra PubSub server đang chạy: `curl http://<EC2_D>:4000/health`

### Vấn đề: Event không broadcast
**Giải pháp:**
- Kiểm tra Redis đang chạy: `redis-cli ping`
- Kiểm tra Backend A/B/C kết nối Redis thành công
- Xem logs backend có `📤 Published to...`

### Vấn đề: UI không update
**Giải pháp:**
- Kiểm tra console có log `📥 Received dataChanged event`
- Kiểm tra `useCallback` dependencies đúng
- Kiểm tra event listener được đăng ký

## 🔒 8. BẢO MẬT

### Production:
1. Cấu hình CORS đúng:
```javascript
// pubsub-server.js
cors: {
  origin: ['https://your-frontend.com'],
  methods: ['GET', 'POST']
}
```

2. Bảo mật Redis:
```bash
# /etc/redis/redis.conf
requirepass your-strong-password
bind 127.0.0.1 <private-ip>
```

3. SSL/TLS cho WebSocket:
```javascript
const server = https.createServer(sslOptions, app);
```

## 📈 9. SCALE

### Nhiều PubSub Servers (Load Balance):
```javascript
// Frontend connect to multiple PubSub
const PUBSUB_URLS = [
  'http://ec2-d1:4000',
  'http://ec2-d2:4000'
];
```

### Redis Cluster:
```javascript
const redis = new Redis.Cluster([
  { host: 'redis-1', port: 6379 },
  { host: 'redis-2', port: 6379 }
]);
```

## 🎯 10. KẾT QUẢ

✅ User ở Backend khác → Realtime update
✅ Không cần F5
✅ Không polling
✅ Scale được nhiều backend
✅ Code rõ ràng, dễ maintain
