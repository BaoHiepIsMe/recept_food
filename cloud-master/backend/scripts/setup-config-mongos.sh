#!/bin/bash

# MongoDB Config Server + Mongos Setup Script
# Usage: ./setup-config-mongos.sh <private-ip> <shard-a-ip> <shard-b-ip> <shard-c-ip>
# Example: ./setup-config-mongos.sh 10.0.1.40 10.0.1.10 10.0.1.20 10.0.1.30

set -e

CONFIG_IP=$1
SHARD_A_IP=$2
SHARD_B_IP=$3
SHARD_C_IP=$4

if [ -z "$CONFIG_IP" ] || [ -z "$SHARD_A_IP" ] || [ -z "$SHARD_B_IP" ] || [ -z "$SHARD_C_IP" ]; then
    echo "Usage: $0 <config-server-ip> <shard-a-ip> <shard-b-ip> <shard-c-ip>"
    echo "Example: $0 10.0.1.40 10.0.1.10 10.0.1.20 10.0.1.30"
    exit 1
fi

CONFIG_PORT=27019
MONGOS_PORT=27017

echo "🚀 Setting up MongoDB Config Server and Mongos Router on $CONFIG_IP"

# Step 1: Install MongoDB (if not already installed)
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

# Step 3: Create directories for config server
echo "📁 Creating directories..."
sudo mkdir -p /var/lib/mongodb-config
sudo mkdir -p /var/log/mongodb
sudo mkdir -p /var/run/mongodb

sudo chown -R mongodb:mongodb /var/lib/mongodb-config
sudo chown -R mongodb:mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/run/mongodb

# Step 4: Create config server config
echo "⚙️ Creating config server config..."
sudo tee /etc/mongod-config.conf > /dev/null <<EOF
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
  port: $CONFIG_PORT
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongod-config.pid

sharding:
  clusterRole: configsvr

replication:
  replSetName: configReplSet
EOF

# Step 5: Start config server
echo "▶️ Starting config server..."
sudo mongod --config /etc/mongod-config.conf

# Wait for config server to start
sleep 5

# Step 6: Initialize config replica set
echo "🔧 Initializing config replica set..."
mongosh --port $CONFIG_PORT --eval "
rs.initiate({
  _id: 'configReplSet',
  configsvr: true,
  members: [
    { _id: 0, host: '$CONFIG_IP:$CONFIG_PORT' }
  ]
})
"

# Wait for replica set to be ready
echo "⏳ Waiting for config replica set to be ready..."
sleep 10

# Step 7: Create mongos config
echo "⚙️ Creating mongos config..."
sudo tee /etc/mongos.conf > /dev/null <<EOF
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongos.log

net:
  port: $MONGOS_PORT
  bindIp: 0.0.0.0

processManagement:
  fork: true
  pidFilePath: /var/run/mongodb/mongos.pid

sharding:
  configDB: configReplSet/$CONFIG_IP:$CONFIG_PORT
EOF

# Step 8: Start mongos
echo "▶️ Starting mongos router..."
sudo mongos --config /etc/mongos.conf

# Wait for mongos to start
sleep 5

# Step 9: Add shards to cluster
echo "🔗 Adding shards to cluster..."
mongosh --port $MONGOS_PORT <<EOF
sh.addShard("shardA/$SHARD_A_IP:27018")
sh.addShard("shardB/$SHARD_B_IP:27018")
sh.addShard("shardC/$SHARD_C_IP:27018")

sh.enableSharding("recipe-share")

sh.shardCollection("recipe-share.users", { email: 1 })
sh.shardCollection("recipe-share.recipes", { authorId: 1 })
sh.shardCollection("recipe-share.blogs", { authorId: 1 })
sh.shardCollection("recipe-share.notifications", { userId: 1 })

sh.status()
EOF

echo "✅ Config server and Mongos setup complete!"
echo "📝 Mongos is running on port $MONGOS_PORT"
echo "🔗 Connection string: mongodb://$CONFIG_IP:$MONGOS_PORT/recipe-share"
echo "📊 Run 'sh.status()' in mongosh to verify cluster status"

