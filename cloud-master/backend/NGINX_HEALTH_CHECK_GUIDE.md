# 🔄 Nginx Health Check Guide

## Cách Nginx Health Check Hoạt Động

### 1. **Passive Health Check (Mặc định - Đã có trong config)**

Nginx có **passive health check** với các tham số:
- `max_fails=3`: Sau 3 lần fail liên tiếp → mark server là DOWN
- `fail_timeout=30s`: Sau 30 giây → thử lại server

**Cách hoạt động:**
- Nginx chỉ check khi có request đến
- Nếu request fail → đếm số lần fail
- Sau 3 lần fail → tự động loại bỏ server khỏi pool
- Sau 30 giây → tự động thêm lại server vào pool

**Ưu điểm:**
- ✅ Đơn giản, không cần cấu hình thêm
- ✅ Tự động loại bỏ server chết
- ✅ Tự động thêm lại server khi sống lại

**Nhược điểm:**
- ❌ Chỉ check khi có request (không proactive)
- ❌ Phải có 3 requests fail mới phát hiện

### 2. **Active Health Check (Cần module hoặc Nginx Plus)**

Để có **active health check** (check định kỳ), cần:
- **Nginx Plus** (trả phí) - có sẵn active health check
- **nginx_upstream_check_module** (free) - cần compile Nginx với module này

### 3. **Giải Pháp: Script Health Check (Khuyến nghị - FREE)**

Dùng script bash để check health định kỳ và update Nginx config.

## Setup Health Check Script

### Bước 1: Tạo Script

**Trên EC2 D, tạo file:**

```bash
sudo nano /usr/local/bin/nginx-backend-healthcheck.sh
```

**Nội dung (copy từ file `nginx-health-check-script.sh`):**

```bash
#!/bin/bash
# Script để check health của backends và update Nginx config

NGINX_CONFIG="/etc/nginx/sites-available/backend-lb"
BACKENDS=(
    "EC2_A_PUBLIC_IP:5000"
    "EC2_B_PUBLIC_IP:5000"
    "EC2_C_PUBLIC_IP:5000"
)

check_backend_health() {
    local backend=$1
    local ip=$(echo $backend | cut -d: -f1)
    local port=$(echo $backend | cut -d: -f2)
    
    timeout 2 curl -s -f "http://${ip}:${port}/api/health" > /dev/null 2>&1
    return $?
}

update_nginx_config() {
    local active_backends=()
    
    for backend in "${BACKENDS[@]}"; do
        if check_backend_health "$backend"; then
            active_backends+=("server $backend max_fails=3 fail_timeout=30s;")
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
        cp /tmp/backend-lb-new.conf "$NGINX_CONFIG"
        nginx -t && systemctl reload nginx
        echo "$(date): 🔄 Nginx config updated"
    fi
}

update_nginx_config
```

**Lưu ý:** Thay `EC2_A_PUBLIC_IP`, `EC2_B_PUBLIC_IP`, `EC2_C_PUBLIC_IP` bằng IP thực tế.

### Bước 2: Cấp quyền và test

```bash
# Cấp quyền execute
sudo chmod +x /usr/local/bin/nginx-backend-healthcheck.sh

# Test script
sudo /usr/local/bin/nginx-backend-healthcheck.sh

# Kiểm tra config đã update chưa
sudo cat /etc/nginx/sites-available/backend-lb
```

### Bước 3: Setup Cron để chạy định kỳ

```bash
# Mở crontab
sudo crontab -e

# Thêm dòng này để chạy mỗi 10 giây
# (Cron không hỗ trợ < 1 phút, nên dùng workaround)
* * * * * /usr/local/bin/nginx-backend-healthcheck.sh
* * * * * sleep 10; /usr/local/bin/nginx-backend-healthcheck.sh
* * * * * sleep 20; /usr/local/bin/nginx-backend-healthcheck.sh
* * * * * sleep 30; /usr/local/bin/nginx-backend-healthcheck.sh
* * * * * sleep 40; /usr/local/bin/nginx-backend-healthcheck.sh
* * * * * sleep 50; /usr/local/bin/nginx-backend-healthcheck.sh
```

**Hoặc dùng systemd timer (tốt hơn):**

```bash
# Tạo service
sudo nano /etc/systemd/system/nginx-healthcheck.service
```

**Nội dung:**
```ini
[Unit]
Description=Nginx Backend Health Check
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/nginx-backend-healthcheck.sh
User=root
```

**Tạo timer:**
```bash
sudo nano /etc/systemd/system/nginx-healthcheck.timer
```

**Nội dung:**
```ini
[Unit]
Description=Run Nginx Health Check every 10 seconds
Requires=nginx-healthcheck.service

[Timer]
OnBootSec=10s
OnUnitActiveSec=10s
AccuracySec=1s

[Install]
WantedBy=timers.target
```

**Enable và start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable nginx-healthcheck.timer
sudo systemctl start nginx-healthcheck.timer

# Kiểm tra
sudo systemctl status nginx-healthcheck.timer
```

## Cách Hoạt Động

### Passive Health Check (Mặc định):
1. Request đến → Nginx forward đến backend
2. Backend fail → Đếm số lần fail
3. Sau 3 lần fail → Tự động loại bỏ backend
4. Sau 30 giây → Tự động thêm lại backend

### Active Health Check (Script):
1. Script chạy mỗi 10 giây
2. Check health của từng backend (`/api/health`)
3. Nếu backend DOWN → Loại bỏ khỏi config
4. Nếu backend UP → Thêm vào config
5. Reload Nginx nếu config thay đổi

## Test Health Check

### Test 1: Stop một backend

```bash
# Trên EC2 A, stop backend
pm2 stop recipe-share-backend-ec2-a

# Trên EC2 D, check script log
sudo journalctl -u nginx-healthcheck.service -f

# Hoặc check config
sudo cat /etc/nginx/sites-available/backend-lb | grep server
# Phải không thấy EC2_A trong config
```

### Test 2: Start lại backend

```bash
# Trên EC2 A, start backend
pm2 start recipe-share-backend-ec2-a

# Đợi 10 giây, check lại config
sudo cat /etc/nginx/sites-available/backend-lb | grep server
# Phải thấy EC2_A lại trong config
```

## Monitoring

### Xem log của health check:

```bash
# Systemd timer
sudo journalctl -u nginx-healthcheck.service -f

# Hoặc thêm logging vào script
sudo tail -f /var/log/nginx-healthcheck.log
```

### Check Nginx status:

```bash
# Xem upstream status (nếu có module)
curl http://localhost/nginx-upstream-status

# Hoặc check config
sudo nginx -T | grep -A 10 "upstream backend_servers"
```

## Tóm Tắt

| Method | Type | Tần suất | Tự động? |
|--------|------|----------|----------|
| **max_fails** | Passive | Khi có request | ✅ Có |
| **Script** | Active | Mỗi 10 giây | ✅ Có |
| **Nginx Plus** | Active | Configurable | ✅ Có (trả phí) |

**Khuyến nghị:** Dùng **Script** (FREE) để có active health check tốt nhất.

