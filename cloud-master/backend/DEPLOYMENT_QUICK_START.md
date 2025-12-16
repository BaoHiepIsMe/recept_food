# 🚀 Quick Start - Deploy Distributed Architecture

Hướng dẫn nhanh để deploy kiến trúc phân tán lên 5 EC2 instances.

## 📋 Yêu Cầu

- 5 EC2 instances (Ubuntu 22.04 LTS)
  - EC2 A, B, C: t2.micro hoặc lớn hơn (chạy MongoDB + Backend)
  - EC2 D: t2.micro hoặc lớn hơn (chạy Config + Mongos + Load Balancer)
  - EC2 E: t2.micro (chạy Frontend)
- Security Groups đã được cấu hình
- SSH access đến tất cả instances

## 🎯 Kiến Trúc

```
EC2 E (Frontend) 
    ↓
EC2 D (Load Balancer + Mongos)
    ↓
EC2 A, B, C (Backend + MongoDB Shard)
```

## ⚡ Deploy Nhanh (3 Bước)

### Bước 1: Setup EC2 A, B, C

Trên mỗi EC2 A, B, C, chạy:

```bash
# Clone repository
cd ~
git clone <your-repo-url> cloud
cd cloud/cloud-master/backend/scripts
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
- Script sẽ tự động setup MongoDB shard và backend
- Cập nhật Cloudinary credentials trong `.env` sau khi setup

### Bước 2: Setup EC2 D

```bash
# Clone repository
cd ~
git clone <your-repo-url> cloud
cd cloud/cloud-master/backend/scripts
chmod +x setup-config-mongos.sh setup-load-balancer.sh

# Setup Config Server + Mongos
sudo ./setup-config-mongos.sh \
  <EC2_D_PRIVATE_IP> \
  <EC2_A_PRIVATE_IP> \
  <EC2_B_PRIVATE_IP> \
  <EC2_C_PRIVATE_IP>

# Setup Nginx Load Balancer
sudo ./setup-load-balancer.sh \
  <EC2_A_PRIVATE_IP> \
  <EC2_B_PRIVATE_IP> \
  <EC2_C_PRIVATE_IP>
```

### Bước 3: Verify

```bash
# Trên EC2 D
cd ~/cloud/cloud-master/backend/scripts
chmod +x verify-distributed-setup.sh

./verify-distributed-setup.sh \
  <EC2_D_PRIVATE_IP> \
  <EC2_A_PRIVATE_IP> \
  <EC2_B_PRIVATE_IP> \
  <EC2_C_PRIVATE_IP>
```

## ✅ Checklist

### Sau Bước 1 (EC2 A, B, C)
- [ ] MongoDB shard đang chạy: `sudo systemctl status mongod-sharda`
- [ ] Backend đang chạy: `pm2 status`
- [ ] Health check OK: `curl http://localhost:5000/api/health`

### Sau Bước 2 (EC2 D)
- [ ] Config Server đang chạy: `sudo systemctl status mongod-config`
- [ ] Mongos đang chạy: `sudo systemctl status mongos`
- [ ] Nginx đang chạy: `sudo systemctl status nginx`
- [ ] Shards đã được add: `mongosh --port 27017` → `sh.status()`

### Sau Bước 3
- [ ] Load balancer phân tán requests
- [ ] Tất cả backend servers accessible
- [ ] MongoDB sharding hoạt động

## 🔧 Cấu Hình Bổ Sung

### Update Cloudinary Credentials

Trên mỗi EC2 A, B, C:

```bash
cd ~/recipe-share-backend
nano .env
# Cập nhật CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
pm2 restart all
```

### Configure Frontend (EC2 E)

Cập nhật API endpoint:

```javascript
// src/api.js
const API_BASE_URL = 'http://<EC2_D_PUBLIC_IP>/api';
```

## 🐛 Troubleshooting

### Backend không start

```bash
# Check logs
pm2 logs

# Check .env
cat .env

# Restart
pm2 restart all
```

### Load balancer 502

```bash
# Check backend servers
curl http://<EC2_A_IP>:5000/api/health
curl http://<EC2_B_IP>:5000/api/health
curl http://<EC2_C_IP>:5000/api/health

# Check Nginx logs
sudo tail -f /var/log/nginx/backend-error.log
```

### MongoDB không kết nối

```bash
# Check Mongos
mongosh --port 27017

# Check shards
sh.status()

# Check connection từ backend
mongosh mongodb://<EC2_D_IP>:27017/recipe-share
```

## 📚 Tài Liệu Chi Tiết

Xem [`DISTRIBUTED_ARCHITECTURE.md`](./DISTRIBUTED_ARCHITECTURE.md) để biết thêm chi tiết.

## 🎉 Hoàn Thành!

Sau khi hoàn thành, bạn có:
- ✅ 3 MongoDB shards phân tán dữ liệu
- ✅ 3 backend servers với load balancing
- ✅ High availability và scalability

