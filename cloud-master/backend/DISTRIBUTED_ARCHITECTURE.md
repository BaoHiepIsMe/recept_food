# 🏗️ Kiến Trúc Phân Tán - Distributed Architecture

## 📋 Tổng Quan

Kiến trúc phân tán cho Recipe Share với 5 EC2 instances:

- **EC2 A, B, C**: MongoDB Shard + Backend Server (mỗi server chạy cả database và backend)
- **EC2 D**: Config Server + Mongos Router + Nginx Load Balancer (coordinator)
- **EC2 E**: Frontend (React App)

## 🎯 Kiến Trúc

```
┌─────────────────────────────────────────────────────────────┐
│                         EC2 E (Frontend)                      │
│                    React App (Port 3000)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTP Requests
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    EC2 D (Coordinator)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Nginx Load Balancer (Port 80)                        │   │
│  │  - Phân tán requests đến backend servers              │   │
│  │  - Health check và failover                           │   │
│  └───────────────────┬──────────────────────────────────┘   │
│                      │                                        │
│  ┌───────────────────▼──────────────────────────────────┐   │
│  │  Config Server (Port 27019) + Mongos (Port 27017)    │   │
│  │  - Quản lý metadata của sharded cluster              │   │
│  │  - Route queries đến các shards                       │   │
│  └───────────────────┬──────────────────────────────────┘   │
└──────────────────────┼───────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   EC2 A      │ │   EC2 B      │ │   EC2 C      │
│              │ │              │ │              │
│ MongoDB      │ │ MongoDB      │ │ MongoDB      │
│ Shard A      │ │ Shard B      │ │ Shard C      │
│ (Port 27017) │ │ (Port 27017) │ │ (Port 27017) │
│              │ │              │ │              │
│ Backend      │ │ Backend      │ │ Backend      │
│ Server       │ │ Server       │ │ Server       │
│ (Port 5000)  │ │ (Port 5000)  │ │ (Port 5000)  │
│              │ │              │ │              │
│ Server ID:   │ │ Server ID:   │ │ Server ID:   │
│ BE-A         │ │ BE-B         │ │ BE-C         │
└──────────────┘ └──────────────┘ └──────────────┘
```

## 📦 Phân Bổ Chức Năng

### EC2 A, B, C (Backend + Database)

Mỗi server chạy:
- **MongoDB Shard**: Lưu trữ một phần dữ liệu
  - Shard A: Dữ liệu với shard key bắt đầu từ A-M
  - Shard B: Dữ liệu với shard key bắt đầu từ N-Z
  - Shard C: Dữ liệu với shard key khác
- **Backend Server**: Xử lý API requests
  - Kết nối đến Mongos trên EC2 D
  - Xử lý requests từ load balancer
  - Server ID khác nhau để tracking

### EC2 D (Coordinator)

Chạy 3 services:
- **Config Server**: Lưu metadata của sharded cluster
- **Mongos Router**: Route queries đến các shards
- **Nginx Load Balancer**: Phân tán requests đến backend servers

### EC2 E (Frontend)

- React application
- Kết nối đến Nginx Load Balancer trên EC2 D

## 🚀 Hướng Dẫn Deploy

### Bước 1: Setup EC2 A, B, C (Shard + Backend)

Trên mỗi EC2 A, B, C:

```bash
# Clone repository
cd ~
git clone <your-repo-url> cloud
cd cloud/cloud-master/backend/scripts

# Make script executable
chmod +x setup-shard-with-backend.sh

# EC2 A
sudo ./setup-shard-with-backend.sh shardA <EC2_A_PRIVATE_IP> <EC2_D_PRIVATE_IP> BE-A

# EC2 B
sudo ./setup-shard-with-backend.sh shardB <EC2_B_PRIVATE_IP> <EC2_D_PRIVATE_IP> BE-B

# EC2 C
sudo ./setup-shard-with-backend.sh shardC <EC2_C_PRIVATE_IP> <EC2_D_PRIVATE_IP> BE-C
```

**Lưu ý:**
- Thay `<EC2_X_PRIVATE_IP>` bằng private IP thực tế
- Script sẽ tự động:
  - Cài đặt MongoDB và setup shard
  - Cài đặt Node.js và backend
  - Cấu hình PM2 để chạy backend
  - Tạo .env file

### Bước 2: Setup EC2 D (Config + Mongos + Load Balancer)

#### 2.1. Setup Config Server + Mongos

```bash
cd ~/cloud/cloud-master/backend/scripts
chmod +x setup-config-mongos.sh

sudo ./setup-config-mongos.sh \
  <EC2_D_PRIVATE_IP> \
  <EC2_A_PRIVATE_IP> \
  <EC2_B_PRIVATE_IP> \
  <EC2_C_PRIVATE_IP>
```

#### 2.2. Setup Nginx Load Balancer

```bash
cd ~/cloud/cloud-master/backend/scripts
chmod +x setup-load-balancer.sh

sudo ./setup-load-balancer.sh \
  <EC2_A_PRIVATE_IP> \
  <EC2_B_PRIVATE_IP> \
  <EC2_C_PRIVATE_IP>
```

### Bước 3: Verify Setup

#### 3.1. Verify MongoDB Sharding

Trên EC2 D:

```bash
mongosh --port 27017

# Trong mongosh:
sh.status()
# Phải hiển thị 3 shards: shardA-rs, shardB-rs, shardC-rs
```

#### 3.2. Verify Backend Servers

Trên mỗi EC2 A, B, C:

```bash
# Check backend status
pm2 status

# Check health
curl http://localhost:5000/api/health
# Response phải có "server": "BE-A" (hoặc BE-B, BE-C)
```

#### 3.3. Verify Load Balancer

Trên EC2 D:

```bash
# Test load balancer
curl http://localhost/api/health

# Test nhiều lần để thấy load balancing
for i in {1..10}; do
  curl -s http://localhost/api/health | grep -o '"server":"[^"]*"'
done
# Mỗi request sẽ được phân tán đến backend khác nhau
```

### Bước 4: Configure Frontend (EC2 E)

Cập nhật API endpoint trong frontend:

```javascript
// src/api.js hoặc tương tự
const API_BASE_URL = 'http://<EC2_D_PUBLIC_IP>/api';
// hoặc nếu có domain:
// const API_BASE_URL = 'https://api.yourdomain.com/api';
```

## 🔧 Cấu Hình Chi Tiết

### MongoDB Sharding Keys

Collections được shard theo:

- `users`: `{ email: 1 }`
- `recipes`: `{ authorId: 1 }`
- `blogs`: `{ authorId: 1 }`
- `notifications`: `{ userId: 1 }`

### Nginx Load Balancing

- **Method**: `least_conn` (least connections)
- **Health Check**: Passive (check khi có request)
- **Failover**: Tự động loại bỏ server sau 3 lần fail
- **Retry**: 3 lần với timeout 10s

### Backend Server IDs

- EC2 A: `BE-A`
- EC2 B: `BE-B`
- EC2 C: `BE-C`

Response header sẽ có `X-Server-ID` để tracking.

## 📊 Monitoring

### Check Backend Health

```bash
# Từ EC2 D
curl http://localhost:8080/backend-health
```

### Check MongoDB Sharding Status

```bash
# Từ EC2 D
mongosh --port 27017
sh.status()
```

### Check Backend Logs

```bash
# Trên mỗi EC2 A, B, C
pm2 logs recipe-share-backend-sharda
pm2 logs recipe-share-backend-shardb
pm2 logs recipe-share-backend-shardc
```

### Check Nginx Logs

```bash
# Trên EC2 D
sudo tail -f /var/log/nginx/backend-access.log
sudo tail -f /var/log/nginx/backend-error.log
```

## 🔒 Security

### Firewall Rules

**EC2 A, B, C:**
- Port 22 (SSH): Your IP only
- Port 5000 (Backend): EC2 D IP only
- Port 27017 (MongoDB): EC2 D IP only

**EC2 D:**
- Port 22 (SSH): Your IP only
- Port 80 (Nginx): 0.0.0.0/0 (hoặc chỉ EC2 E IP)
- Port 27017 (Mongos): EC2 A, B, C IPs only
- Port 27019 (Config): EC2 D localhost only

**EC2 E:**
- Port 22 (SSH): Your IP only
- Port 3000 (Frontend): 0.0.0.0/0 (hoặc chỉ specific IPs)

### Environment Variables

- `.env` files phải có permission `600` (chỉ owner đọc/ghi)
- JWT_SECRET phải là random string mạnh (32+ chars)
- MongoDB connection strings không nên expose trong logs

## 🐛 Troubleshooting

### Backend không kết nối được MongoDB

```bash
# Check MongoDB connection từ backend server
mongosh mongodb://<EC2_D_IP>:27017/recipe-share

# Check .env file
cat .env | grep MONGODB_URI

# Check PM2 logs
pm2 logs
```

### Load Balancer trả về 502

```bash
# Check backend servers đang chạy
# Từ EC2 D, test từng backend:
curl http://<EC2_A_IP>:5000/api/health
curl http://<EC2_B_IP>:5000/api/health
curl http://<EC2_C_IP>:5000/api/health

# Check Nginx logs
sudo tail -f /var/log/nginx/backend-error.log
```

### Sharding không hoạt động

```bash
# Check shards đã được add
mongosh --port 27017
sh.status()

# Check shard keys
sh.status().collections

# Test insert và check shard distribution
use recipe-share
db.users.insertOne({ email: "test@example.com", name: "Test" })
db.users.find().explain("executionStats")
```

## 📈 Scaling

### Thêm Backend Server

1. Setup EC2 mới với script `setup-shard-with-backend.sh`
2. Add shard vào Mongos: `sh.addShard("shardD-rs/<IP>:27017")`
3. Update Nginx config trên EC2 D để thêm backend server mới
4. Reload Nginx: `sudo nginx -s reload`

### Thêm Shard

1. Setup MongoDB shard mới
2. Add vào cluster: `sh.addShard("shardD-rs/<IP>:27017")`
3. MongoDB tự động rebalance data

## ✅ Checklist

### EC2 A, B, C
- [ ] MongoDB shard đã được setup và chạy
- [ ] Replica set đã được initialize
- [ ] Backend server đã được deploy
- [ ] PM2 đang chạy backend
- [ ] Health check trả về đúng server ID
- [ ] Firewall đã được cấu hình

### EC2 D
- [ ] Config Server đang chạy
- [ ] Mongos đang chạy
- [ ] 3 shards đã được add vào cluster
- [ ] Database đã enable sharding
- [ ] Collections đã được shard
- [ ] Nginx load balancer đang chạy
- [ ] Load balancer phân tán requests đúng

### EC2 E
- [ ] Frontend đã được deploy
- [ ] API endpoint trỏ đến EC2 D
- [ ] Frontend có thể kết nối đến backend

## 🎉 Hoàn Thành!

Kiến trúc phân tán đã được setup thành công!

**Lợi ích:**
- ✅ High Availability: Nếu 1 backend server down, còn 2 servers khác
- ✅ Load Distribution: Requests được phân tán đều
- ✅ Database Sharding: Dữ liệu được phân tán trên 3 shards
- ✅ Scalability: Dễ dàng thêm servers và shards

