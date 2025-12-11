# 🚀 Hướng Dẫn Cấu Hình MongoDB Sharded Cluster Trên 4 EC2 Instances

**Cài đặt trực tiếp MongoDB Community Edition (không dùng Docker) - Đơn giản và nhẹ nhất**

Hướng dẫn setup MongoDB sharded cluster với 4 EC2 instances:
- **EC2 A**: MongoDB Shard A
- **EC2 B**: MongoDB Shard B
- **EC2 C**: MongoDB Shard C
- **EC2 D**: Config Server + Mongos Router + Backend

## 📋 Mục Lục

1. [Tổng Quan Kiến Trúc](#1-tổng-quan-kiến-trúc)
2. [Chuẩn Bị 4 EC2 Instances](#2-chuẩn-bị-4-ec2-instances)
3. [EC2 A - Setup MongoDB Shard A](#3-ec2-a---setup-mongodb-shard-a)
4. [EC2 B - Setup MongoDB Shard B](#4-ec2-b---setup-mongodb-shard-b)
5. [EC2 C - Setup MongoDB Shard C](#5-ec2-c---setup-mongodb-shard-c)
6. [EC2 D - Setup Config Server + Mongos](#6-ec2-d---setup-config-server--mongos)
7. [Kết Nối Sharded Cluster](#7-kết-nối-sharded-cluster)
8. [Enable Sharding và Test](#8-enable-sharding-và-test)
9. [Deploy Backend Lên EC2 D](#9-deploy-backend-lên-ec2-d)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tổng Quan Kiến Trúc

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   EC2 A     │     │   EC2 B     │     │   EC2 C     │
│  Shard A    │     │  Shard B    │     │  Shard C    │
│  Port 27017 │     │  Port 27017 │     │  Port 27017 │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌────────▼────────┐
                  │      EC2 D      │
                  │ Config Server   │
                  │  Port 27019     │
                  │                 │
                  │  Mongos Router  │
                  │  Port 27017     │
                  └────────┬────────┘
                           │
                  ┌────────▼────────┐
                  │   Backend App   │
                  │  Connect to     │
                  │  Mongos:27017   │
                  └─────────────────┘
```

**Ports:**
- **Shard A, B, C**: 27017 (MongoDB)
- **Config Server**: 27019
- **Mongos Router**: 27017
- **Backend**: 5000

---

## 2. Chuẩn Bị 4 EC2 Instances

### 2.1. Launch 4 EC2 Instances

**Cho mỗi EC2 instance:**

1. **Vào AWS Console → EC2 → Launch Instance**

2. **Cấu hình:**
   - **AMI**: Ubuntu Server 22.04 LTS
   - **Instance Type**: t2.micro (FREE tier) hoặc t3.small
   - **Key Pair**: Chọn key pair
   - **Network Settings**: 
     - ✅ Auto-assign public IP: Enable
     - Security Group: Tạo mới hoặc chọn existing
     - **Inbound Rules:**
       - **SSH (22)**: My IP
       - **Custom TCP (27017)**: Anywhere (0.0.0.0/0) - cho MongoDB
       - **Custom TCP (27019)**: Anywhere (0.0.0.0/0) - cho Config Server (chỉ EC2 D)
       - **Custom TCP (5000)**: Anywhere - cho Backend (chỉ EC2 D)
   - **Storage**: 20GB gp3
   - **Tags**: 
     - EC2 A: `Name: mongodb-shard-a`
     - EC2 B: `Name: mongodb-shard-b`
     - EC2 C: `Name: mongodb-shard-c`
     - EC2 D: `Name: mongodb-config-mongos`

3. **Launch Instances:**
   - Launch 4 instances với cấu hình trên
   - Đặt tên rõ ràng để phân biệt

### 2.2. Lấy IP Addresses

Sau khi launch xong, lấy **Public IPv4** của từng instance:

- **EC2 A (Shard A)**: `54.xxx.xxx.1` (ví dụ)
- **EC2 B (Shard B)**: `54.xxx.xxx.2`
- **EC2 C (Shard C)**: `54.xxx.xxx.3`
- **EC2 D (Config + Mongos)**: `54.xxx.xxx.4`

**Lưu lại các IP này!**

### 2.3. Kết Nối Qua EC2 Instance Connect

Cho mỗi EC2:
1. Click vào instance → **"Connect"**
2. Chọn **"EC2 Instance Connect"**
3. Click **"Connect"**

---

## 3. EC2 A - Setup MongoDB Shard A

### 3.1. Cập Nhật System

```bash
sudo apt update
sudo apt upgrade -y
```

### 3.2. Cài Đặt MongoDB

```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update và cài đặt
sudo apt update
sudo apt install -y mongodb-org
```

### 3.3. Cấu Hình MongoDB Shard A (Đơn Giản)

```bash
# Tạo thư mục data
sudo mkdir -p /data/shard-a
sudo chown -R mongodb:mongodb /data/shard-a

# Tạo file config (copy-paste toàn bộ)
sudo tee /etc/mongod-shard-a.conf > /dev/null <<EOF
storage:
  dbPath: /data/shard-a
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/shard-a.log

net:
  port: 27017
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/shard-a.pid

sharding:
  clusterRole: shardsvr

replication:
  replSetName: shard-a-rs
EOF
```

### 3.4. Tạo Systemd Service (Copy-Paste)

```bash
# Tạo service file (copy-paste toàn bộ)
sudo tee /etc/systemd/system/mongod-shard-a.service > /dev/null <<EOF
[Unit]
Description=MongoDB Shard A
After=network.target

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config /etc/mongod-shard-a.conf
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable và start service
sudo systemctl daemon-reload
sudo systemctl enable mongod-shard-a
sudo systemctl start mongod-shard-a

# Check status
sudo systemctl status mongod-shard-a
```

### 3.5. Initialize Replica Set (1 Lệnh)

```bash
# Initialize replica set (copy-paste)
mongosh --port 27017 --eval 'rs.initiate({_id: "shard-a-rs", members: [{_id: 0, host: "localhost:27017"}]})'

# Verify
mongosh --port 27017 --eval 'rs.status()'
```

### 3.6. Verify Shard A

```bash
# Check MongoDB đang chạy
sudo systemctl status mongod-shard-a

# Check port
sudo netstat -tulpn | grep 27017

# Test connection
mongosh --port 27017
# Phải kết nối được
exit
```

**✅ EC2 A hoàn thành!**

---

## 4. EC2 B - Setup MongoDB Shard B

### 4.1. Cập Nhật System

```bash
sudo apt update
sudo apt upgrade -y
```

### 4.2. Cài Đặt MongoDB

```bash
# Cài đặt MongoDB (copy-paste)
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

### 4.3. Cấu Hình MongoDB Shard B

```bash
# Tạo thư mục và config (copy-paste)
sudo mkdir -p /data/shard-b
sudo chown -R mongodb:mongodb /data/shard-b

sudo tee /etc/mongod-shard-b.conf > /dev/null <<EOF
storage:
  dbPath: /data/shard-b
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/shard-b.log

net:
  port: 27017
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/shard-b.pid

sharding:
  clusterRole: shardsvr

replication:
  replSetName: shard-b-rs
EOF
```

### 4.4. Tạo Systemd Service

```bash
# Tạo service (copy-paste)
sudo tee /etc/systemd/system/mongod-shard-b.service > /dev/null <<EOF
[Unit]
Description=MongoDB Shard B
After=network.target

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config /etc/mongod-shard-b.conf
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mongod-shard-b
sudo systemctl start mongod-shard-b
sudo systemctl status mongod-shard-b
```

### 4.5. Initialize Replica Set

```bash
# Initialize (copy-paste)
mongosh --port 27017 --eval 'rs.initiate({_id: "shard-b-rs", members: [{_id: 0, host: "localhost:27017"}]})'
mongosh --port 27017 --eval 'rs.status()'
```

### 4.6. Verify Shard B

```bash
# Check MongoDB đang chạy
sudo systemctl status mongod-shard-b

# Check port
sudo netstat -tulpn | grep 27017

# Test connection
mongosh --port 27017
exit
```

**✅ EC2 B hoàn thành!**

---

## 5. EC2 C - Setup MongoDB Shard C

### 5.1. Cập Nhật System

```bash
sudo apt update
sudo apt upgrade -y
```

### 5.2. Cài Đặt MongoDB

```bash
# Cài đặt MongoDB (copy-paste)
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

### 5.3. Cấu Hình MongoDB Shard C

```bash
# Tạo thư mục và config (copy-paste)
sudo mkdir -p /data/shard-c
sudo chown -R mongodb:mongodb /data/shard-c

sudo tee /etc/mongod-shard-c.conf > /dev/null <<EOF
storage:
  dbPath: /data/shard-c
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/shard-c.log

net:
  port: 27017
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/shard-c.pid

sharding:
  clusterRole: shardsvr

replication:
  replSetName: shard-c-rs
EOF
```

### 5.4. Tạo Systemd Service

```bash
# Tạo service (copy-paste)
sudo tee /etc/systemd/system/mongod-shard-c.service > /dev/null <<EOF
[Unit]
Description=MongoDB Shard C
After=network.target

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config /etc/mongod-shard-c.conf
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mongod-shard-c
sudo systemctl start mongod-shard-c
sudo systemctl status mongod-shard-c
```

### 5.5. Initialize Replica Set

```bash
# Initialize (copy-paste)
mongosh --port 27017 --eval 'rs.initiate({_id: "shard-c-rs", members: [{_id: 0, host: "localhost:27017"}]})'
mongosh --port 27017 --eval 'rs.status()'
```

### 5.6. Verify Shard C

```bash
# Check MongoDB đang chạy
sudo systemctl status mongod-shard-c

# Check port
sudo netstat -tulpn | grep 27017

# Test connection
mongosh --port 27017
exit
```

**✅ EC2 C hoàn thành!**

---

## 6. EC2 D - Setup Config Server + Mongos

### 6.1. Cập Nhật System

```bash
sudo apt update
sudo apt upgrade -y
```

### 6.2. Cài Đặt MongoDB

```bash
# Cài đặt MongoDB (copy-paste)
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

### 6.3. Cấu Hình Config Server

```bash
# Tạo thư mục và config (copy-paste)
sudo mkdir -p /data/config-server
sudo chown -R mongodb:mongodb /data/config-server

sudo tee /etc/mongod-config.conf > /dev/null <<EOF
storage:
  dbPath: /data/config-server
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/config-server.log

net:
  port: 27019
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/config-server.pid

sharding:
  clusterRole: configsvr

replication:
  replSetName: config-rs
EOF
```

### 6.4. Tạo Systemd Service cho Config Server

```bash
# Tạo service (copy-paste)
sudo tee /etc/systemd/system/mongod-config.service > /dev/null <<EOF
[Unit]
Description=MongoDB Config Server
After=network.target

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config /etc/mongod-config.conf
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mongod-config
sudo systemctl start mongod-config
sudo systemctl status mongod-config
```

### 6.5. Initialize Config Server Replica Set

```bash
# Initialize (copy-paste)
mongosh --port 27019 --eval 'rs.initiate({_id: "config-rs", configsvr: true, members: [{_id: 0, host: "localhost:27019"}]})'
mongosh --port 27019 --eval 'rs.status()'
```

### 6.6. Cấu Hình Mongos Router

**Lấy IP của 3 shards (thay vào lệnh dưới):**
- EC2 A IP: `54.xxx.xxx.1` (ví dụ)
- EC2 B IP: `54.xxx.xxx.2`
- EC2 C IP: `54.xxx.xxx.3`

```bash
# Tạo config cho Mongos (copy-paste)
sudo tee /etc/mongos.conf > /dev/null <<EOF
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
  configDB: config-rs/localhost:27019
EOF
```

### 6.7. Tạo Systemd Service cho Mongos

```bash
# Tạo service (copy-paste)
sudo tee /etc/systemd/system/mongos.service > /dev/null <<EOF
[Unit]
Description=MongoDB Mongos Router
After=network.target mongod-config.service
Requires=mongod-config.service

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongos --config /etc/mongos.conf
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mongos
sudo systemctl start mongos
sudo systemctl status mongos
```

### 6.8. Verify Config Server và Mongos

```bash
# Check Config Server
sudo systemctl status mongod-config
sudo netstat -tulpn | grep 27019

# Check Mongos
sudo systemctl status mongos
sudo netstat -tulpn | grep 27017

# Test Mongos connection
mongosh --port 27017
# Phải kết nối được
exit
```

**✅ EC2 D hoàn thành!**

---

## 7. Kết Nối Sharded Cluster

### 7.1. Connect to Mongos

Trên **EC2 D**, connect đến Mongos:

```bash
mongosh --port 27017
```

### 7.2. Add Shards to Cluster

**Thay IP thực tế của EC2 A, B, C:**

```javascript
// Add Shard A
sh.addShard("shard-a-rs/EC2_A_IP:27017")

// Add Shard B
sh.addShard("shard-b-rs/EC2_B_IP:27017")

// Add Shard C
sh.addShard("shard-c-rs/EC2_C_IP:27017")

// Verify shards
sh.status()
```

**Ví dụ với IP thực tế:**
```javascript
sh.addShard("shard-a-rs/54.xxx.xxx.1:27017")
sh.addShard("shard-b-rs/54.xxx.xxx.2:27017")
sh.addShard("shard-c-rs/54.xxx.xxx.3:27017")
```

### 7.3. Verify Sharding Status

```javascript
// Check sharding status
sh.status()

// Output phải hiển thị 3 shards:
// shard-a-rs
// shard-b-rs
// shard-c-rs
```

**Exit mongosh:**
```javascript
exit
```

---

## 8. Enable Sharding và Test

### 8.1. Enable Sharding cho Database

Trên **EC2 D**, connect đến Mongos:

```bash
mongosh --port 27017
```

```javascript
// Enable sharding cho database
sh.enableSharding("recipe-share")

// Verify
sh.status()
```

### 8.2. Create Shard Keys

```javascript
// Use recipe-share database
use recipe-share

// Shard users collection by email
sh.shardCollection("recipe-share.users", { email: 1 })

// Shard recipes collection by authorId
sh.shardCollection("recipe-share.recipes", { authorId: 1 })

// Shard blogs collection by authorId
sh.shardCollection("recipe-share.blogs", { authorId: 1 })

// Shard notifications collection by userId
sh.shardCollection("recipe-share.notifications", { userId: 1 })

// Verify
sh.status()
```

### 8.3. Test Sharding

```javascript
// Test insert
use recipe-share
db.users.insertOne({ 
  _id: "test@example.com",
  name: "Test User",
  email: "test@example.com"
})

// Check which shard has the data
db.users.find().explain("executionStats")

// Exit
exit
```

---

## 9. Deploy Backend Lên EC2 D

### 9.1. Cài Đặt Node.js

```bash
# Cài đặt Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

### 9.2. Upload Backend Code

**Cách 1: Clone từ Git**
```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/your-username/your-repo.git
cd your-repo/cloud-master/backend
```

**Cách 2: Upload qua S3 hoặc SCP**
(Xem hướng dẫn trong `EC2_INSTANCE_CONNECT_GUIDE.md`)

### 9.3. Cài Đặt Dependencies

```bash
cd ~/projects/your-repo/cloud-master/backend
npm install
```

### 9.4. Cấu Hình .env

```bash
nano .env
```

**Nội dung** (thay IP thực tế của EC2 D):
```env
# MongoDB Connection (connect to Mongos)
MONGODB_URI=mongodb://localhost:27017/recipe-share?directConnection=false

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars

# Server Configuration
PORT=5000
SERVER_ID=BE1-EC2-Sharded-Cluster

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# API Base URL
API_BASE_URL=http://EC2_D_IP:5000
```

**Lưu file:** Ctrl + O → Enter → Ctrl + X

```bash
# Bảo mật file
chmod 600 .env
```

### 9.5. Cài Đặt PM2

```bash
sudo npm install -g pm2

# Tạo ecosystem file
nano ecosystem.config.js
```

**Nội dung:**
```javascript
export default {
  apps: [{
    name: 'recipe-share-backend',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M'
  }]
};
```

**Lưu file và start:**
```bash
mkdir -p logs
pm2 start ecosystem.config.js

# Setup auto-start
pm2 startup
# Copy và chạy command được output
pm2 save
```

### 9.6. Test Backend

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Response phải có:
# {
#   "status": "ok",
#   "server": "BE1-EC2-Sharded-Cluster",
#   "database": "connected",
#   "cloudinary": "connected"
# }
```

---

## 10. Troubleshooting

### 10.1. Shard Không Kết Nối Được

**Kiểm tra:**
```bash
# Trên EC2 A, B, C - Check MongoDB đang chạy
sudo systemctl status mongod-shard-a
sudo systemctl status mongod-shard-b
sudo systemctl status mongod-shard-c

# Check port
sudo netstat -tulpn | grep 27017

# Check firewall
sudo ufw status
sudo ufw allow 27017/tcp
```

**Kiểm tra Security Group:**
- EC2 A, B, C phải allow port 27017 từ EC2 D IP

### 10.2. Config Server Không Start

```bash
# Check logs
sudo tail -f /var/log/mongodb/config-server.log

# Check status
sudo systemctl status mongod-config

# Restart
sudo systemctl restart mongod-config
```

### 10.3. Mongos Không Start

```bash
# Check logs
sudo tail -f /var/log/mongodb/mongos.log

# Check Config Server đang chạy
sudo systemctl status mongod-config

# Restart Mongos
sudo systemctl restart mongos
```

### 10.4. Sharding Không Hoạt Động

```bash
# Connect to Mongos
mongosh --port 27017

# Check shards
sh.status()

# Check database
use recipe-share
db.stats()

# Check collections
show collections
```

### 10.5. Backend Không Kết Nối MongoDB

```bash
# Check .env
cat .env | grep MONGODB_URI

# Test connection từ backend
mongosh mongodb://localhost:27017/recipe-share

# Check PM2 logs
pm2 logs recipe-share-backend
```

---

## 11. Useful Commands

### MongoDB Commands

```bash
# Start/Stop Services
sudo systemctl start mongod-shard-a
sudo systemctl stop mongod-shard-a
sudo systemctl restart mongod-shard-a

# Check Status
sudo systemctl status mongod-shard-a
sudo systemctl status mongod-config
sudo systemctl status mongos

# View Logs
sudo tail -f /var/log/mongodb/shard-a.log
sudo tail -f /var/log/mongodb/config-server.log
sudo tail -f /var/log/mongodb/mongos.log
```

### Sharding Commands (trong mongosh)

```javascript
// Check sharding status
sh.status()

// List shards
sh.status().shards

// Check database sharding
sh.status().databases

// Check collection sharding
sh.status().collections

// Remove shard (nếu cần)
sh.removeShard("shard-a-rs/EC2_A_IP:27017")
```

---

## ✅ Checklist

### EC2 A (Shard A)
- [ ] MongoDB đã được cài đặt
- [ ] Service `mongod-shard-a` đang chạy
- [ ] Replica set `shard-a-rs` đã được init
- [ ] Port 27017 đang listen
- [ ] Security Group allow port 27017 từ EC2 D

### EC2 B (Shard B)
- [ ] MongoDB đã được cài đặt
- [ ] Service `mongod-shard-b` đang chạy
- [ ] Replica set `shard-b-rs` đã được init
- [ ] Port 27017 đang listen
- [ ] Security Group allow port 27017 từ EC2 D

### EC2 C (Shard C)
- [ ] MongoDB đã được cài đặt
- [ ] Service `mongod-shard-c` đang chạy
- [ ] Replica set `shard-c-rs` đã được init
- [ ] Port 27017 đang listen
- [ ] Security Group allow port 27017 từ EC2 D

### EC2 D (Config + Mongos)
- [ ] MongoDB đã được cài đặt
- [ ] Config Server đang chạy (port 27019)
- [ ] Mongos đang chạy (port 27017)
- [ ] Config replica set đã được init
- [ ] 3 shards đã được add vào cluster
- [ ] Database `recipe-share` đã enable sharding
- [ ] Collections đã được shard
- [ ] Backend đã được deploy và chạy
- [ ] Health check trả về `database: "connected"`

---

## 🎉 Hoàn Thành!

MongoDB Sharded Cluster đã được setup thành công trên 4 EC2 instances!

**Kiến trúc:**
- ✅ 3 Shards (A, B, C) trên 3 EC2 riêng biệt
- ✅ Config Server + Mongos trên EC2 D
- ✅ Backend connect đến Mongos
- ✅ GridFS storage tự động shard theo data

**Next Steps:**
- Monitor sharding performance
- Setup backup cho từng shard
- Scale thêm shards nếu cần
- Setup monitoring và alerts

---

## 📞 Support

Nếu gặp vấn đề:
1. Check logs: `/var/log/mongodb/`
2. Check service status: `sudo systemctl status`
3. Check sharding status: `sh.status()` trong mongosh
4. Verify Security Groups allow connections

