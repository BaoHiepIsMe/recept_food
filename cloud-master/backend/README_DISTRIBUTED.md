# 📦 Distributed Architecture - Recipe Share Backend

## 🎯 Tổng Quan

Kiến trúc phân tán với 5 EC2 instances:
- **EC2 A, B, C**: MongoDB Shard + Backend Server
- **EC2 D**: Config Server + Mongos Router + Nginx Load Balancer
- **EC2 E**: Frontend (React)

## 📚 Tài Liệu

### 🚀 Quick Start
- **[DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)** - Deploy nhanh trong 3 bước

### 📖 Chi Tiết
- **[DISTRIBUTED_ARCHITECTURE.md](./DISTRIBUTED_ARCHITECTURE.md)** - Kiến trúc chi tiết và hướng dẫn đầy đủ

### 🔧 Scripts

#### Setup Scripts
- **`scripts/setup-shard-with-backend.sh`** - Setup MongoDB shard + Backend trên EC2 A, B, C
- **`scripts/setup-config-mongos.sh`** - Setup Config Server + Mongos trên EC2 D
- **`scripts/setup-load-balancer.sh`** - Setup Nginx Load Balancer trên EC2 D

#### Verification Scripts
- **`scripts/verify-distributed-setup.sh`** - Verify toàn bộ setup

### ⚙️ Configuration Files

#### Environment Variables
- **`config/env.ec2-a.example`** - .env mẫu cho EC2 A
- **`config/env.ec2-b.example`** - .env mẫu cho EC2 B
- **`config/env.ec2-c.example`** - .env mẫu cho EC2 C

#### Nginx Config
- **`nginx-backend-lb.conf`** - Nginx load balancer config mẫu

## 🏗️ Kiến Trúc

```
┌─────────────────┐
│   EC2 E (FE)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│      EC2 D (Coordinator)         │
│  ┌───────────────────────────┐  │
│  │  Nginx Load Balancer      │  │
│  └───────────┬───────────────┘  │
│              │                   │
│  ┌───────────▼───────────────┐  │
│  │  Config + Mongos          │  │
│  └───────────┬───────────────┘  │
└──────────────┼───────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│ EC2 A  │ │ EC2 B  │ │ EC2 C  │
│ Shard  │ │ Shard  │ │ Shard  │
│ Backend│ │ Backend│ │ Backend│
└────────┘ └────────┘ └────────┘
```

## 🚀 Quick Deploy

### 1. Setup EC2 A, B, C

```bash
cd ~/cloud/cloud-master/backend/scripts
chmod +x setup-shard-with-backend.sh

# EC2 A
sudo ./setup-shard-with-backend.sh shardA <EC2_A_IP> <EC2_D_IP> BE-A

# EC2 B
sudo ./setup-shard-with-backend.sh shardB <EC2_B_IP> <EC2_D_IP> BE-B

# EC2 C
sudo ./setup-shard-with-backend.sh shardC <EC2_C_IP> <EC2_D_IP> BE-C
```

### 2. Setup EC2 D

```bash
cd ~/cloud/cloud-master/backend/scripts
chmod +x setup-config-mongos.sh setup-load-balancer.sh

# Config + Mongos
sudo ./setup-config-mongos.sh <EC2_D_IP> <EC2_A_IP> <EC2_B_IP> <EC2_C_IP>

# Load Balancer
sudo ./setup-load-balancer.sh <EC2_A_IP> <EC2_B_IP> <EC2_C_IP>
```

### 3. Verify

```bash
cd ~/cloud/cloud-master/backend/scripts
chmod +x verify-distributed-setup.sh

./verify-distributed-setup.sh <EC2_D_IP> <EC2_A_IP> <EC2_B_IP> <EC2_C_IP>
```

## ✅ Features

- ✅ **Database Sharding**: Dữ liệu phân tán trên 3 shards
- ✅ **Load Balancing**: Requests được phân tán đều
- ✅ **High Availability**: Nếu 1 server down, còn 2 servers khác
- ✅ **Scalability**: Dễ dàng thêm servers và shards
- ✅ **Auto Failover**: Nginx tự động loại bỏ server lỗi

## 🔍 Monitoring

### Check Backend Health
```bash
# Từng server
curl http://<EC2_A_IP>:5000/api/health
curl http://<EC2_B_IP>:5000/api/health
curl http://<EC2_C_IP>:5000/api/health

# Load balancer
curl http://<EC2_D_IP>/api/health
```

### Check MongoDB Sharding
```bash
mongosh --host <EC2_D_IP> --port 27017
sh.status()
```

### Check Load Balancing
```bash
# Test nhiều lần để thấy load balancing
for i in {1..10}; do
  curl -s http://<EC2_D_IP>/api/health | grep -o '"server":"[^"]*"'
done
```

## 🐛 Troubleshooting

Xem [DISTRIBUTED_ARCHITECTURE.md](./DISTRIBUTED_ARCHITECTURE.md#-troubleshooting) để biết cách xử lý các vấn đề thường gặp.

## 📞 Support

Nếu gặp vấn đề:
1. Check logs: `pm2 logs` (backend), `sudo tail -f /var/log/nginx/backend-error.log` (nginx)
2. Verify setup: Chạy `verify-distributed-setup.sh`
3. Check documentation: Xem các file .md trong thư mục này

