#!/bin/bash

# Setup Nginx Load Balancer trên EC2 D
# Usage: ./setup-load-balancer.sh <ec2-a-ip> <ec2-b-ip> <ec2-c-ip>
# Example: ./setup-load-balancer.sh 10.0.1.10 10.0.1.20 10.0.1.30

set -e

EC2_A_IP=$1
EC2_B_IP=$2
EC2_C_IP=$3

if [ -z "$EC2_A_IP" ] || [ -z "$EC2_B_IP" ] || [ -z "$EC2_C_IP" ]; then
    echo "Usage: $0 <ec2-a-ip> <ec2-b-ip> <ec2-c-ip>"
    echo "Example: $0 10.0.1.10 10.0.1.20 10.0.1.30"
    exit 1
fi

echo "🚀 Setting up Nginx Load Balancer on EC2 D"
echo "📦 Backend Servers:"
echo "   - EC2 A: $EC2_A_IP:5000"
echo "   - EC2 B: $EC2_B_IP:5000"
echo "   - EC2 C: $EC2_C_IP:5000"

# Step 1: Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
fi

# Step 2: Create Nginx config
echo "⚙️ Creating Nginx load balancer config..."
sudo tee /etc/nginx/sites-available/backend-load-balancer > /dev/null <<EOF
upstream backend_servers {
    # Load balancing method
    least_conn;  # Least connections - phân tán dựa trên số kết nối
    
    # Backend servers với health check
    server ${EC2_A_IP}:5000 max_fails=3 fail_timeout=30s weight=1;
    server ${EC2_B_IP}:5000 max_fails=3 fail_timeout=30s weight=1;
    server ${EC2_C_IP}:5000 max_fails=3 fail_timeout=30s weight=1;
    
    # Health check (passive - chỉ check khi có request)
    # Nginx sẽ tự động loại bỏ server sau 3 lần fail liên tiếp
    # Sau 30 giây sẽ thử lại
    keepalive 32;
}

# Health check endpoint cho monitoring
server {
    listen 8080;
    server_name _;

    location /nginx-health {
        access_log off;
        return 200 "nginx healthy\n";
        add_header Content-Type text/plain;
    }

    location /backend-health {
        access_log off;
        proxy_pass http://backend_servers/api/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_connect_timeout 3s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
}

# Main API server
server {
    listen 80;
    server_name _;

    # Logs
    access_log /var/log/nginx/backend-access.log;
    error_log /var/log/nginx/backend-error.log;

    # Health check endpoint
    location /nginx-health {
        access_log off;
        return 200 "nginx healthy\n";
        add_header Content-Type text/plain;
    }

    # Proxy health check đến backend
    location /api/health {
        proxy_pass http://backend_servers;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_connect_timeout 3s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
        
        # Health check response
        access_log off;
    }

    # API routes
    location /api {
        proxy_pass http://backend_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        
        # Retry logic
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
        
        # Keepalive
        proxy_set_header Connection "";
    }

    # Root redirect
    location / {
        return 301 /api/health;
    }
}
EOF

# Step 3: Enable site
echo "🔗 Enabling Nginx site..."
sudo ln -sf /etc/nginx/sites-available/backend-load-balancer /etc/nginx/sites-enabled/

# Step 4: Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Step 5: Test Nginx config
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

# Step 6: Restart Nginx
echo "▶️ Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

# Step 7: Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 8080/tcp
sudo ufw --force enable || true

echo ""
echo "========================================="
echo "✅ LOAD BALANCER SETUP HOÀN TẤT!"
echo "========================================="
echo ""
echo "📝 Nginx Load Balancer:"
echo "   - Main API: http://$(curl -s ifconfig.me):80/api"
echo "   - Health Check: http://$(curl -s ifconfig.me):8080/backend-health"
echo "   - Status: sudo systemctl status nginx"
echo ""
echo "🔗 Backend Servers:"
echo "   - EC2 A: http://${EC2_A_IP}:5000"
echo "   - EC2 B: http://${EC2_B_IP}:5000"
echo "   - EC2 C: http://${EC2_C_IP}:5000"
echo ""
echo "🧪 Test load balancer:"
echo "   curl http://localhost/api/health"
echo "   curl http://localhost/api/health"
echo "   curl http://localhost/api/health"
echo "   # Mỗi request sẽ được phân tán đến backend khác nhau"
echo ""
echo "📊 Monitor backend health:"
echo "   curl http://localhost:8080/backend-health"
echo ""

