#!/bin/bash
# Script để check health của backends và update Nginx config
# Chạy script này với cron mỗi 10 giây

NGINX_CONFIG="/etc/nginx/sites-available/backend-lb"
NGINX_CONFIG_ENABLED="/etc/nginx/sites-enabled/backend-lb"
BACKENDS=(
    "EC2_A_PUBLIC_IP:5000"
    "EC2_B_PUBLIC_IP:5000"
    "EC2_C_PUBLIC_IP:5000"
)

# Function to check backend health
check_backend_health() {
    local backend=$1
    local ip=$(echo $backend | cut -d: -f1)
    local port=$(echo $backend | cut -d: -f2)
    
    # Check với timeout 2 giây
    timeout 2 curl -s -f "http://${ip}:${port}/api/health" > /dev/null 2>&1
    return $?
}

# Function to update nginx config
update_nginx_config() {
    local active_backends=()
    
    for backend in "${BACKENDS[@]}"; do
        if check_backend_health "$backend"; then
            active_backends+=("server $backend max_fails=3 fail_timeout=30s;")
            echo "$(date): ✅ $backend is UP"
        else
            echo "$(date): ❌ $backend is DOWN"
        fi
    done
    
    # Tạo config mới
    cat > /tmp/backend-lb-new.conf << EOF
upstream backend_servers {
    least_conn;
$(printf '    %s\n' "${active_backends[@]}")
}

server {
    listen 80;
    server_name _;

    location /nginx-health {
        access_log off;
        return 200 "nginx healthy\n";
        add_header Content-Type text/plain;
    }

    location /api/health {
        proxy_pass http://backend_servers;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_connect_timeout 3s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
        access_log off;
    }

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
        
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        
        proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
    }

    location / {
        return 301 /api/health;
    }
}
EOF

    # So sánh với config hiện tại
    if ! cmp -s /tmp/backend-lb-new.conf "$NGINX_CONFIG"; then
        # Config đã thay đổi, reload nginx
        cp /tmp/backend-lb-new.conf "$NGINX_CONFIG"
        nginx -t && systemctl reload nginx
        echo "$(date): 🔄 Nginx config updated and reloaded"
    fi
}

# Main
update_nginx_config

