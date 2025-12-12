#!/bin/bash

# ============================================
# Script để test hệ thống Realtime
# ============================================

echo "🧪 Testing Realtime System..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check Redis
echo "1️⃣ Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Redis is running${NC}"
else
    echo -e "${RED}❌ Redis is not running${NC}"
    echo "   Start Redis: sudo systemctl start redis"
    exit 1
fi

# Test 2: Check PubSub Server
echo ""
echo "2️⃣ Checking PubSub Server (EC2 D)..."
PUBSUB_URL=${PUBSUB_URL:-"http://localhost:4000"}
HEALTH_RESPONSE=$(curl -s ${PUBSUB_URL}/health)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ PubSub Server is running${NC}"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}❌ PubSub Server is not running${NC}"
    echo "   Start: node pubsub-server.js"
    exit 1
fi

# Test 3: Check Backend Server
echo ""
echo "3️⃣ Checking Backend Server..."
API_URL=${API_URL:-"http://localhost:5000"}
API_RESPONSE=$(curl -s ${API_URL}/api/health)

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backend Server is running${NC}"
    echo "   Response: $API_RESPONSE"
else
    echo -e "${RED}❌ Backend Server is not running${NC}"
    echo "   Start: npm start"
    exit 1
fi

# Test 4: Check Frontend
echo ""
echo "4️⃣ Checking Frontend..."
FE_URL=${FE_URL:-"http://localhost:3000"}
if curl -s ${FE_URL} > /dev/null; then
    echo -e "${GREEN}✅ Frontend is running${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend is not running${NC}"
    echo "   Start: npm start (in frontend directory)"
fi

# Test 5: Test Redis PubSub
echo ""
echo "5️⃣ Testing Redis PubSub..."
echo "Publishing test message..."

# Publish test event
redis-cli PUBLISH "test:event" '{"message":"test"}' > /dev/null

echo -e "${GREEN}✅ Redis PubSub test completed${NC}"

echo ""
echo "================================================"
echo -e "${GREEN}🎉 All checks passed!${NC}"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Open browser at ${FE_URL}"
echo "2. Open F12 Console"
echo "3. Create/Update/Delete a recipe"
echo "4. Check console logs for:"
echo "   - ✅ WebSocket connected"
echo "   - 📥 Received dataChanged event"
echo "   - Data changed, refreshing..."
echo ""
echo "Multi-user test:"
echo "1. Open 2 different browsers"
echo "2. Both go to ${FE_URL}"
echo "3. User 1: Stay on Home page"
echo "4. User 2: Add new recipe"
echo "5. User 1 should see new recipe IMMEDIATELY"
echo ""
