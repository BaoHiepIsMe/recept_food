#!/bin/bash

# Script để verify toàn bộ distributed setup
# Usage: ./verify-distributed-setup.sh <ec2-d-ip> <ec2-a-ip> <ec2-b-ip> <ec2-c-ip>

set -e

EC2_D_IP=$1
EC2_A_IP=$2
EC2_B_IP=$3
EC2_C_IP=$4

if [ -z "$EC2_D_IP" ] || [ -z "$EC2_A_IP" ] || [ -z "$EC2_B_IP" ] || [ -z "$EC2_C_IP" ]; then
    echo "Usage: $0 <ec2-d-ip> <ec2-a-ip> <ec2-b-ip> <ec2-c-ip>"
    echo "Example: $0 10.0.1.40 10.0.1.10 10.0.1.20 10.0.1.30"
    exit 1
fi

echo "🔍 Verifying Distributed Setup..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check command
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅ $1 installed${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 not installed${NC}"
        return 1
    fi
}

# Function to check service
check_service() {
    if systemctl is-active --quiet $1; then
        echo -e "${GREEN}✅ $1 is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 is not running${NC}"
        return 1
    fi
}

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local expected=$2
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 $url)
    if [ "$response" = "200" ]; then
        if [ -n "$expected" ]; then
            content=$(curl -s --connect-timeout 5 $url)
            if echo "$content" | grep -q "$expected"; then
                echo -e "${GREEN}✅ $url - OK (contains: $expected)${NC}"
                return 0
            else
                echo -e "${YELLOW}⚠️  $url - OK but doesn't contain: $expected${NC}"
                return 1
            fi
        else
            echo -e "${GREEN}✅ $url - OK${NC}"
            return 0
        fi
    else
        echo -e "${RED}❌ $url - Failed (HTTP $response)${NC}"
        return 1
    fi
}

echo "========================================="
echo "1. Checking Local Prerequisites"
echo "========================================="
check_command mongosh || echo "⚠️  Install MongoDB shell to check sharding"
check_command curl || echo "⚠️  Install curl to check HTTP endpoints"
check_command nginx || echo "⚠️  Install nginx to check load balancer"
echo ""

echo "========================================="
echo "2. Checking EC2 D (Coordinator)"
echo "========================================="
echo "Checking Nginx Load Balancer..."
check_http "http://${EC2_D_IP}/nginx-health" "nginx healthy" || true
check_http "http://${EC2_D_IP}/api/health" || true
echo ""

echo "Checking MongoDB Mongos..."
if command -v mongosh &> /dev/null; then
    echo "Connecting to Mongos..."
    mongosh --host $EC2_D_IP --port 27017 --quiet --eval "
        try {
            var status = sh.status();
            print('✅ Mongos is accessible');
            var shards = status.shards;
            if (shards && shards.length >= 3) {
                print('✅ Found ' + shards.length + ' shards');
            } else {
                print('⚠️  Expected 3 shards, found: ' + (shards ? shards.length : 0));
            }
        } catch(e) {
            print('❌ Error: ' + e);
        }
    " 2>/dev/null || echo "⚠️  Could not connect to Mongos"
else
    echo "⚠️  mongosh not installed, skipping Mongos check"
fi
echo ""

echo "========================================="
echo "3. Checking EC2 A, B, C (Backend Servers)"
echo "========================================="

for server in "A:$EC2_A_IP:BE-A" "B:$EC2_B_IP:BE-B" "C:$EC2_C_IP:BE-C"; do
    IFS=':' read -r name ip server_id <<< "$server"
    echo "Checking EC2 $name ($ip)..."
    
    # Check backend health
    check_http "http://${ip}:5000/api/health" "$server_id" || true
    
    # Check MongoDB shard (if accessible)
    if command -v mongosh &> /dev/null; then
        mongosh --host $ip --port 27017 --quiet --eval "
            try {
                var status = rs.status();
                print('✅ MongoDB shard is accessible');
            } catch(e) {
                print('⚠️  Could not check MongoDB shard: ' + e);
            }
        " 2>/dev/null || echo "⚠️  Could not connect to MongoDB shard"
    fi
    echo ""
done

echo "========================================="
echo "4. Testing Load Balancing"
echo "========================================="
echo "Sending 10 requests to load balancer..."
echo ""

servers_seen=()
for i in {1..10}; do
    response=$(curl -s --connect-timeout 5 "http://${EC2_D_IP}/api/health")
    server_id=$(echo "$response" | grep -o '"server":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$server_id" ]; then
        if [[ ! " ${servers_seen[@]} " =~ " ${server_id} " ]]; then
            servers_seen+=("$server_id")
        fi
        echo -e "Request $i: ${GREEN}$server_id${NC}"
    else
        echo -e "Request $i: ${RED}Failed${NC}"
    fi
    sleep 0.5
done

echo ""
if [ ${#servers_seen[@]} -ge 2 ]; then
    echo -e "${GREEN}✅ Load balancing is working (saw ${#servers_seen[@]} different servers)${NC}"
else
    echo -e "${YELLOW}⚠️  Load balancing may not be working properly (saw ${#servers_seen[@]} server(s))${NC}"
fi
echo ""

echo "========================================="
echo "5. Summary"
echo "========================================="
echo ""
echo "✅ Verification complete!"
echo ""
echo "Next steps:"
echo "  1. Check individual backend servers:"
echo "     curl http://${EC2_A_IP}:5000/api/health"
echo "     curl http://${EC2_B_IP}:5000/api/health"
echo "     curl http://${EC2_C_IP}:5000/api/health"
echo ""
echo "  2. Check load balancer:"
echo "     curl http://${EC2_D_IP}/api/health"
echo ""
echo "  3. Check MongoDB sharding:"
echo "     mongosh --host ${EC2_D_IP} --port 27017"
echo "     sh.status()"
echo ""

