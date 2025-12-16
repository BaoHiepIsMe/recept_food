#!/bin/bash

# Setup MongoDB Shard + Backend Server trên EC2 A, B, C
# Usage: ./setup-shard-with-backend.sh <shard-name> <private-ip> <mongos-ip> <server-id>
# Example: ./setup-shard-with-backend.sh shardA 10.0.1.10 10.0.1.40 BE-A

set -e

SHARD_NAME=$1
PRIVATE_IP=$2
MONGOS_IP=$3
SERVER_ID=$4
SHARD_PORT=27017

if [ -z "$SHARD_NAME" ] || [ -z "$PRIVATE_IP" ] || [ -z "$MONGOS_IP" ] || [ -z "$SERVER_ID" ]; then
    echo "Usage: $0 <shard-name> <private-ip> <mongos-ip> <server-id>"
    echo "Example: $0 shardA 10.0.1.10 10.0.1.40 BE-A"
    exit 1
fi

echo "🚀 Setting up MongoDB Shard + Backend: $SHARD_NAME on $PRIVATE_IP"
echo "📦 Server ID: $SERVER_ID"
echo "🔗 Mongos IP: $MONGOS_IP"

# ============================================
# PHẦN 1: SETUP MONGODB SHARD
# ============================================

echo ""
echo "========================================="
echo "📦 PHẦN 1: SETUP MONGODB SHARD"
echo "========================================="

# Step 1: Install MongoDB
if ! command -v mongod &> /dev/null; then
    echo "📦 Installing MongoDB Community Edition..."
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    sudo apt-get update
    sudo apt-get install -y mongodb-org
fi

# Step 2: Stop default MongoDB
echo "🛑 Stopping default MongoDB..."
sudo systemctl stop mongod 2>/dev/null || true
sudo systemctl disable mongod 2>/dev/null || true

# Step 3: Create directories
echo "📁 Creating directories..."
sudo mkdir -p /data/shard-${SHARD_NAME,,}
sudo mkdir -p /var/log/mongodb
sudo mkdir -p /var/run/mongodb

sudo chown -R mongodb:mongodb /data/shard-${SHARD_NAME,,}
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb

# Step 4: Create shard config file
echo "⚙️ Creating shard config..."
sudo tee /etc/mongod-${SHARD_NAME,,}.conf > /dev/null <<EOF
storage:
  dbPath: /data/shard-${SHARD_NAME,,}
  journal:
    enabled: true

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/shard-${SHARD_NAME,,}.log

net:
  port: $SHARD_PORT
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/shard-${SHARD_NAME,,}.pid

sharding:
  clusterRole: shardsvr

replication:
  replSetName: ${SHARD_NAME}-rs
EOF

# Step 5: Create systemd service for shard
echo "⚙️ Creating systemd service..."
sudo tee /etc/systemd/system/mongod-${SHARD_NAME,,}.service > /dev/null <<EOF
[Unit]
Description=MongoDB Shard ${SHARD_NAME}
After=network.target

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config /etc/mongod-${SHARD_NAME,,}.conf
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Step 6: Enable and start shard service
echo "▶️ Starting shard service..."
sudo systemctl daemon-reload
sudo systemctl enable mongod-${SHARD_NAME,,}
sudo systemctl start mongod-${SHARD_NAME,,}

# Wait for MongoDB to start
echo "⏳ Waiting for MongoDB to start..."
sleep 10

# Step 7: Initialize replica set
echo "🔧 Initializing replica set..."
mongosh --port $SHARD_PORT --eval "
rs.initiate({
  _id: '${SHARD_NAME}-rs',
  members: [
    { _id: 0, host: '$PRIVATE_IP:$SHARD_PORT' }
  ]
})
" || echo "⚠️  Replica set may already be initialized"

echo "✅ MongoDB Shard setup complete!"

# ============================================
# PHẦN 2: SETUP BACKEND SERVER
# ============================================

echo ""
echo "========================================="
echo "🚀 PHẦN 2: SETUP BACKEND SERVER"
echo "========================================="

# Step 1: Install Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

# Step 2: Install Git (if not installed)
if ! command -v git &> /dev/null; then
    echo "📦 Installing Git..."
    sudo apt-get install -y git
fi

# Step 3: Create project directory
echo "📁 Creating project directory..."
PROJECT_DIR="$HOME/recipe-share-backend"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Step 4: Check if code exists, if not, prompt user
if [ ! -f "package.json" ]; then
    echo "⚠️  Backend code not found in $PROJECT_DIR"
    echo "📝 Please upload backend code to $PROJECT_DIR or clone from git"
    echo "   Example: git clone <your-repo> $PROJECT_DIR"
    echo ""
    echo "Press Enter after uploading code, or Ctrl+C to exit..."
    read
fi

# Step 5: Install dependencies
if [ -f "package.json" ]; then
    echo "📦 Installing backend dependencies..."
    npm install
else
    echo "❌ package.json not found. Please ensure backend code is in $PROJECT_DIR"
    exit 1
fi

# Step 6: Create .env file
echo "⚙️ Creating .env file..."
cat > .env <<EOF
# MongoDB Connection (connect to Mongos on EC2 D)
MONGODB_URI=mongodb://${MONGOS_IP}:27017/recipe-share?directConnection=false

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# Server Configuration
PORT=5000
SERVER_ID=${SERVER_ID}

# Cloudinary Configuration (update with your credentials)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# API Base URL
API_BASE_URL=http://${PRIVATE_IP}:5000
EOF

chmod 600 .env
echo "✅ .env file created"

# Step 7: Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Step 8: Create PM2 ecosystem file
echo "⚙️ Creating PM2 ecosystem file..."
cat > ecosystem.config.js <<EOF
export default {
  apps: [{
    name: 'recipe-share-backend-${SHARD_NAME,,}',
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
EOF

# Step 9: Create logs directory
mkdir -p logs

# Step 10: Start backend with PM2
echo "▶️ Starting backend with PM2..."
pm2 start ecosystem.config.js

# Step 11: Setup PM2 auto-start
echo "⚙️ Setting up PM2 auto-start..."
pm2 startup | tail -1 | sudo bash || true
pm2 save

# Step 12: Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 5000/tcp
sudo ufw allow 27017/tcp
sudo ufw --force enable || true

echo ""
echo "========================================="
echo "✅ SETUP HOÀN TẤT!"
echo "========================================="
echo ""
echo "📝 MongoDB Shard:"
echo "   - Shard Name: ${SHARD_NAME}"
echo "   - Port: $SHARD_PORT"
echo "   - Replica Set: ${SHARD_NAME}-rs"
echo "   - Status: sudo systemctl status mongod-${SHARD_NAME,,}"
echo ""
echo "📝 Backend Server:"
echo "   - Server ID: ${SERVER_ID}"
echo "   - Port: 5000"
echo "   - Status: pm2 status"
echo "   - Logs: pm2 logs recipe-share-backend-${SHARD_NAME,,}"
echo ""
echo "🔗 Test backend:"
echo "   curl http://localhost:5000/api/health"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Update Cloudinary credentials in .env file"
echo "   2. Add this shard to Mongos on EC2 D:"
echo "      sh.addShard(\"${SHARD_NAME}-rs/${PRIVATE_IP}:${SHARD_PORT}\")"
echo ""

