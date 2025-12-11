#!/bin/bash

# MongoDB Shard Server Setup Script
# Usage: ./setup-shard-server.sh <shard-name> <private-ip>
# Example: ./setup-shard-server.sh shardA 10.0.1.10

set -e

SHARD_NAME=$1
PRIVATE_IP=$2
SHARD_PORT=27018

if [ -z "$SHARD_NAME" ] || [ -z "$PRIVATE_IP" ]; then
    echo "Usage: $0 <shard-name> <private-ip>"
    echo "Example: $0 shardA 10.0.1.10"
    exit 1
fi

echo "🚀 Setting up MongoDB Shard Server: $SHARD_NAME on $PRIVATE_IP"

# Step 1: Install MongoDB
echo "📦 Installing MongoDB Community Edition..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt-get update
sudo apt-get install -y mongodb-org

# Step 2: Stop default MongoDB
echo "🛑 Stopping default MongoDB..."
sudo systemctl stop mongod
sudo systemctl disable mongod

# Step 3: Create directories
echo "📁 Creating directories..."
sudo mkdir -p /var/lib/mongodb-shard
sudo mkdir -p /var/log/mongodb
sudo mkdir -p /var/run/mongodb

sudo chown -R mongodb:mongodb /var/lib/mongodb-shard
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb

# Step 4: Create config file
echo "⚙️ Creating shard config..."
sudo tee /etc/mongod-shard.conf > /dev/null <<EOF
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
  port: $SHARD_PORT
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod-shard.pid

sharding:
  clusterRole: shardsvr

replication:
  replSetName: $SHARD_NAME
EOF

# Step 5: Start shard server
echo "▶️ Starting shard server..."
sudo mongod --config /etc/mongod-shard.conf

# Wait for MongoDB to start
sleep 5

# Step 6: Initialize replica set
echo "🔧 Initializing replica set..."
mongosh --port $SHARD_PORT --eval "
rs.initiate({
  _id: '$SHARD_NAME',
  members: [
    { _id: 0, host: '$PRIVATE_IP:$SHARD_PORT' }
  ]
})
"

echo "✅ Shard server $SHARD_NAME setup complete!"
echo "📝 Shard is running on port $SHARD_PORT"
echo "🔗 Connection string: mongodb://$PRIVATE_IP:$SHARD_PORT"

