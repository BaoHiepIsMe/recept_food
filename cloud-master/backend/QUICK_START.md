# 🚀 Quick Start - MongoDB Sharded Cluster

## Tổng quan

Backend đã được cấu hình để hỗ trợ **MongoDB Community Edition với sharding** - **100% FREE**.

## 📋 Yêu cầu

- 4 EC2 instances (t2.micro FREE tier)
- Ubuntu 20.04/22.04 LTS
- Ports: 27017, 27018, 27019

## ⚡ Setup nhanh (3 bước)

### Bước 1: Setup Shard Servers (EC2 A, B, C)

```bash
# Trên mỗi EC2 A, B, C
git clone <your-repo>
cd cloud-master/backend/scripts
chmod +x setup-shard-server.sh

# EC2 A
sudo ./setup-shard-server.sh shardA <EC2_A_PRIVATE_IP>

# EC2 B  
sudo ./setup-shard-server.sh shardB <EC2_B_PRIVATE_IP>

# EC2 C
sudo ./setup-shard-server.sh shardC <EC2_C_PRIVATE_IP>
```

### Bước 2: Setup Config Server + Mongos (EC2 D)

```bash
# Trên EC2 D
cd cloud-master/backend/scripts
chmod +x setup-config-mongos.sh
sudo ./setup-config-mongos.sh <EC2_D_PRIVATE_IP> <EC2_A_PRIVATE_IP> <EC2_B_PRIVATE_IP> <EC2_C_PRIVATE_IP>
```

### Bước 3: Cấu hình Backend

```bash
# Tạo .env
cd cloud-master/backend
cat > .env <<EOF
MONGODB_URI=mongodb://<EC2_D_PUBLIC_IP>:27017/recipe-share?directConnection=false
JWT_SECRET=your-secret-key-here
PORT=5000
SERVER_ID=BE1-MongoDB-Sharded
EOF

# Install và chạy
npm install
npm run dev
```

## 🐳 Test Local (Docker)

```bash
cd cloud-master/backend
docker-compose -f docker-compose.sharded.yml up -d

# Wait 2 minutes, then:
mongosh mongodb://localhost:27017/recipe-share
sh.status()
```

## ✅ Verify

```bash
# Trên EC2 D
cd cloud-master/backend/scripts
chmod +x verify-sharding.sh
./verify-sharding.sh localhost 27017
```

## 📚 Tài liệu chi tiết

- **Setup chi tiết**: `docs/MONGODB_COMMUNITY_SETUP.md`
- **Quick reference**: `README_SHARDED_SETUP.md`

## 🎯 Kết quả

Sau khi setup:
- ✅ 3 Shards (A, B, C) - FREE
- ✅ 1 Config Server + Mongos - FREE  
- ✅ GridFS Storage - FREE
- ✅ Sharding enabled - FREE
- ✅ Backend tự động kết nối

**Tổng chi phí: $0/month** 🎉

