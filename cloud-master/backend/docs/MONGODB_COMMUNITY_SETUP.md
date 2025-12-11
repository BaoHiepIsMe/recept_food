# MongoDB Community Edition - Sharded Cluster Setup Guide

Hướng dẫn setup MongoDB Community Edition với sharding trên EC2 instances - **100% FREE**.

## Kiến trúc

```
EC2 A → MongoDB Shard A (MongoDB Community)
EC2 B → MongoDB Shard B (MongoDB Community)
EC2 C → MongoDB Shard C (MongoDB Community)
EC2 D → MongoDB Config Server + Mongos Router
         ↓
Sharded Cluster (Global)
         ↓
GridFS Storage (tích hợp)
```

## Yêu cầu

- 4 EC2 instances (t2.micro FREE tier hoặc tương đương)
- Ubuntu 20.04/22.04 LTS
- MongoDB Community Edition 7.0+
- Ports cần mở:
  - **Shard servers**: 27017, 27018, 27019
  - **Config servers**: 27019, 27020, 27021
  - **Mongos router**: 27017

## Setup trên EC2 A, B, C (Shard Servers)

### Bước 1: Cài đặt MongoDB Community Edition

```bash
# Import MongoDB public GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update và cài đặt
sudo apt-get update
sudo apt-get install -y mongodb-org

# Khởi động MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Bước 2: Cấu hình Shard Server

Tạo file config: `/etc/mongod-shard.conf`

```yaml
# /etc/mongod-shard.conf
storage:
  dbPath: /var/lib/mongodb-shard
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod-shard.log

net:
  port: 27018
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod-shard.pid

sharding:
  clusterRole: shardsvr

replication:
  replSetName: shardA  # Đổi thành shardB, shardC cho EC2 B, C
```

**Lưu ý**: 
- EC2 A: `replSetName: shardA`
- EC2 B: `replSetName: shardB`
- EC2 C: `replSetName: shardC`

### Bước 3: Tạo thư mục và khởi động

```bash
# Tạo thư mục
sudo mkdir -p /var/lib/mongodb-shard
sudo mkdir -p /var/log/mongodb
sudo mkdir -p /var/run/mongodb

# Set permissions
sudo chown -R mongodb:mongodb /var/lib/mongodb-shard
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb

# Khởi động shard server
sudo mongod --config /etc/mongod-shard.conf
```

### Bước 4: Khởi tạo Replica Set cho Shard

```bash
# Kết nối đến shard server
mongosh --port 27018

# Trong mongosh, chạy:
rs.initiate({
  _id: "shardA",  # Đổi thành shardB, shardC
  members: [
    { _id: 0, host: "EC2_A_PRIVATE_IP:27018" }  # Đổi IP cho từng EC2
  ]
})
```

## Setup trên EC2 D (Config Server + Mongos)

### Bước 1: Cài đặt MongoDB (giống như trên)

### Bước 2: Cấu hình Config Server

Tạo file: `/etc/mongod-config.conf`

```yaml
# /etc/mongod-config.conf
storage:
  dbPath: /var/lib/mongodb-config
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod-config.log

net:
  port: 27019
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod-config.pid

sharding:
  clusterRole: configsvr

replication:
  replSetName: configReplSet
```

### Bước 3: Khởi động Config Server

```bash
# Tạo thư mục
sudo mkdir -p /var/lib/mongodb-config
sudo chown -R mongodb:mongodb /var/lib/mongodb-config

# Khởi động
sudo mongod --config /etc/mongod-config.conf
```

### Bước 4: Khởi tạo Config Replica Set

```bash
mongosh --port 27019

# Trong mongosh:
rs.initiate({
  _id: "configReplSet",
  configsvr: true,
  members: [
    { _id: 0, host: "EC2_D_PRIVATE_IP:27019" }
  ]
})
```

### Bước 5: Cấu hình Mongos Router

Tạo file: `/etc/mongos.conf`

```yaml
# /etc/mongos.conf
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongos.log

net:
  port: 27017
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongos.pid

sharding:
  configDB: configReplSet/EC2_D_PRIVATE_IP:27019
```

### Bước 6: Khởi động Mongos

```bash
sudo mongos --config /etc/mongos.conf
```

### Bước 7: Thêm Shards vào Cluster

```bash
mongosh --port 27017

# Thêm các shards
sh.addShard("shardA/EC2_A_PRIVATE_IP:27018")
sh.addShard("shardB/EC2_B_PRIVATE_IP:27018")
sh.addShard("shardC/EC2_C_PRIVATE_IP:27018")

# Enable sharding cho database
sh.enableSharding("recipe-share")

# Shard collections
sh.shardCollection("recipe-share.users", { email: 1 })
sh.shardCollection("recipe-share.recipes", { authorId: 1 })
sh.shardCollection("recipe-share.blogs", { authorId: 1 })
sh.shardCollection("recipe-share.notifications", { userId: 1 })
```

## Cấu hình Security (Production)

### Tạo Admin User

```bash
mongosh --port 27017

use admin
db.createUser({
  user: "admin",
  pwd: "your-secure-password",
  roles: [ { role: "root", db: "admin" } ]
})
```

### Enable Authentication

Thêm vào config files:

```yaml
security:
  authorization: enabled
```

Connection string sẽ là:
```
mongodb://admin:password@EC2_D_IP:27017/recipe-share?authSource=admin
```

## Cấu hình Backend

Cập nhật `.env`:

```env
# MongoDB Sharded Cluster Connection
MONGODB_URI=mongodb://EC2_D_PUBLIC_IP:27017/recipe-share?directConnection=false&serverSelectionTimeoutMS=5000

# Hoặc với authentication:
MONGODB_URI=mongodb://admin:password@EC2_D_PUBLIC_IP:27017/recipe-share?authSource=admin&directConnection=false

JWT_SECRET=your-jwt-secret
PORT=5000
SERVER_ID=BE1-MongoDB-Sharded
```

## Kiểm tra Sharding

```bash
mongosh --port 27017

# Xem shard status
sh.status()

# Xem shard distribution
db.users.getShardDistribution()
db.recipes.getShardDistribution()
```

## GridFS

GridFS tự động hoạt động với sharded cluster. Không cần cấu hình thêm.

## Monitoring

### Xem cluster status
```bash
mongosh --port 27017
sh.status()
```

### Xem shard distribution
```bash
use recipe-share
db.users.getShardDistribution()
```

## Backup

```bash
# Backup từ mongos
mongodump --host EC2_D_IP:27017 --db recipe-share --out /backup/recipe-share

# Restore
mongorestore --host EC2_D_IP:27017 --db recipe-share /backup/recipe-share/recipe-share
```

## Troubleshooting

### Shard không kết nối được
- Kiểm tra Security Groups trên EC2
- Kiểm tra firewall rules
- Verify IP addresses trong config

### Mongos không tìm thấy config server
- Kiểm tra config server đã khởi động
- Verify replica set name trong mongos config

### Data không được shard
- Kiểm tra sharding đã enable: `sh.status()`
- Verify shard keys đã được set: `db.collection.getShardDistribution()`

## Performance Tuning

### Tăng cache size (nếu có RAM)
```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 2  # Tăng lên nếu có RAM
```

### Index optimization
Đảm bảo indexes được tạo trên shard keys để tối ưu query performance.

## Next Steps

1. Setup monitoring (MongoDB Compass, mongostat)
2. Configure automated backups
3. Setup alerts cho cluster health
4. Tối ưu shard keys dựa trên query patterns

