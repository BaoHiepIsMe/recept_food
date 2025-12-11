# MongoDB Community Edition - Sharded Cluster Quick Start

Hướng dẫn nhanh để setup MongoDB sharded cluster **100% FREE**.

## 🎯 Kiến trúc

```
EC2 A → MongoDB Shard A (Port 27018)
EC2 B → MongoDB Shard B (Port 27018)
EC2 C → MongoDB Shard C (Port 27018)
EC2 D → Config Server (Port 27019) + Mongos Router (Port 27017)
         ↓
Sharded Cluster
         ↓
GridFS Storage (tích hợp)
```

## ⚡ Quick Setup

### Trên EC2 A, B, C (Shard Servers)

```bash
# 1. Copy script lên EC2
scp scripts/setup-shard-server.sh ubuntu@EC2_A_IP:~/

# 2. SSH vào EC2
ssh ubuntu@EC2_A_IP

# 3. Chạy script (thay IP và shard name)
chmod +x setup-shard-server.sh
sudo ./setup-shard-server.sh shardA 10.0.1.10  # EC2 A
sudo ./setup-shard-server.sh shardB 10.0.1.20  # EC2 B
sudo ./setup-shard-server.sh shardC 10.0.1.30  # EC2 C
```

### Trên EC2 D (Config + Mongos)

```bash
# 1. Copy script lên EC2
scp scripts/setup-config-mongos.sh ubuntu@EC2_D_IP:~/

# 2. SSH vào EC2
ssh ubuntu@EC2_D_IP

# 3. Chạy script
chmod +x setup-config-mongos.sh
sudo ./setup-config-mongos.sh 10.0.1.40 10.0.1.10 10.0.1.20 10.0.1.30
#                    ↑           ↑        ↑        ↑        ↑
#              Config IP    Shard A  Shard B  Shard C
```

### Verify Setup

```bash
# Copy verify script
scp scripts/verify-sharding.sh ubuntu@EC2_D_IP:~/

# Run verification
chmod +x verify-sharding.sh
./verify-sharding.sh 10.0.1.40 27017
```

## 🐳 Docker Compose (Local Testing)

Để test local trước khi deploy lên EC2:

```bash
cd cloud-master/backend
docker-compose -f docker-compose.sharded.yml up -d

# Wait for setup (takes ~1-2 minutes)
# Then connect to mongos
mongosh mongodb://localhost:27017/recipe-share
```

## 🔧 Backend Configuration

Cập nhật `.env`:

```env
# MongoDB Sharded Cluster (MongoDB Community Edition)
MONGODB_URI=mongodb://EC2_D_PUBLIC_IP:27017/recipe-share?directConnection=false&serverSelectionTimeoutMS=5000

# Hoặc MongoDB Atlas (nếu dùng)
# MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/recipe-share

JWT_SECRET=your-jwt-secret
PORT=5000
SERVER_ID=BE1-MongoDB-Sharded
```

## 🔒 Security (Production)

### Tạo Admin User

```bash
mongosh --port 27017

use admin
db.createUser({
  user: "admin",
  pwd: "secure-password",
  roles: [ { role: "root", db: "admin" } ]
})
```

### Enable Authentication

Thêm vào config files (`/etc/mongos.conf`, `/etc/mongod-shard.conf`, `/etc/mongod-config.conf`):

```yaml
security:
  authorization: enabled
```

Restart services:

```bash
sudo pkill mongos
sudo pkill mongod
# Restart với config mới
```

Update connection string:

```env
MONGODB_URI=mongodb://admin:password@EC2_D_IP:27017/recipe-share?authSource=admin
```

## 📊 Monitoring

### Check Cluster Status

```bash
mongosh --port 27017
sh.status()
```

### Check Shard Distribution

```bash
mongosh --port 27017 recipe-share
db.users.getShardDistribution()
db.recipes.getShardDistribution()
```

## 🚨 Troubleshooting

### Port không mở
- Kiểm tra Security Groups trên EC2
- Verify firewall: `sudo ufw status`

### Shard không kết nối
- Kiểm tra IP addresses trong config
- Verify shard đã khởi động: `ps aux | grep mongod`

### Mongos không tìm thấy config
- Kiểm tra config server: `mongosh --port 27019`
- Verify replica set: `rs.status()`

## 📚 Tài liệu chi tiết

Xem `docs/MONGODB_COMMUNITY_SETUP.md` để biết chi tiết từng bước.

## ✅ Checklist

- [ ] 4 EC2 instances đã tạo
- [ ] Security Groups đã mở ports (27017, 27018, 27019)
- [ ] Scripts đã copy lên EC2
- [ ] Shard servers đã setup (A, B, C)
- [ ] Config server và Mongos đã setup
- [ ] Shards đã được add vào cluster
- [ ] Sharding đã enable cho database
- [ ] Backend `.env` đã cấu hình
- [ ] Test connection thành công

## 🎉 Done!

Sau khi setup xong, backend sẽ tự động kết nối và sử dụng sharded cluster. GridFS cũng tự động hoạt động!

