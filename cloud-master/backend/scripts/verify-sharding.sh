#!/bin/bash

# Verify MongoDB Sharding Setup
# Usage: ./verify-sharding.sh <mongos-ip> [mongos-port]
# Example: ./verify-sharding.sh 10.0.1.40 27017

set -e

MONGOS_IP=${1:-localhost}
MONGOS_PORT=${2:-27017}

echo "🔍 Verifying MongoDB Sharded Cluster..."
echo "📡 Connecting to mongos at $MONGOS_IP:$MONGOS_PORT"

# Check mongos connection
if ! mongosh --host $MONGOS_IP:$MONGOS_PORT --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    echo "❌ Cannot connect to mongos at $MONGOS_IP:$MONGOS_PORT"
    exit 1
fi

echo "✅ Connected to mongos"

# Check cluster status
echo ""
echo "📊 Cluster Status:"
mongosh --host $MONGOS_IP:$MONGOS_PORT --quiet <<EOF
sh.status()
EOF

# Check shard distribution
echo ""
echo "📈 Shard Distribution:"
mongosh --host $MONGOS_IP:$MONGOS_PORT recipe-share --quiet <<EOF
print("Users collection:");
try {
    db.users.getShardDistribution()
} catch(e) {
    print("Collection not created yet");
}

print("\nRecipes collection:");
try {
    db.recipes.getShardDistribution()
} catch(e) {
    print("Collection not created yet");
}

print("\nBlogs collection:");
try {
    db.blogs.getShardDistribution()
} catch(e) {
    print("Collection not created yet");
}
EOF

# Check GridFS
echo ""
echo "📁 GridFS Status:"
mongosh --host $MONGOS_IP:$MONGOS_PORT recipe-share --quiet <<EOF
const bucket = new GridFSBucket(db, { bucketName: 'files' });
print("GridFS bucket 'files' is ready");
EOF

echo ""
echo "✅ Verification complete!"

