# 🚀 Hướng Dẫn Deploy Backend Lên EC2 - Từ A-Z

Hướng dẫn chi tiết để deploy backend Recipe Share lên EC2 instance mới.

## 📋 Mục Lục

1. [Chuẩn Bị EC2](#1-chuẩn-bị-ec2)
2. [Cài Đặt Node.js và npm](#2-cài-đặt-nodejs-và-npm)
3. [Cài Đặt MongoDB](#3-cài-đặt-mongodb)
4. [Clone Code](#4-clone-code)
5. [Cài Đặt Dependencies](#5-cài-đặt-dependencies)
6. [Cấu Hình Environment Variables](#6-cấu-hình-environment-variables)
7. [Cài Đặt PM2 (Process Manager)](#7-cài-đặt-pm2-process-manager)
8. [Cấu Hình Firewall](#8-cấu-hình-firewall)
9. [Cấu Hình Nginx (Optional)](#9-cấu-hình-nginx-optional)
10. [Test và Verify](#10-test-và-verify)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Chuẩn Bị EC2

### 1.1. Tạo EC2 Instance

1. Vào AWS Console → EC2 → Launch Instance
2. Chọn:
   - **AMI**: Ubuntu 22.04 LTS (hoặc Amazon Linux 2023)
   - **Instance Type**: t2.micro (FREE tier) hoặc t3.small
   - **Key Pair**: Tạo hoặc chọn key pair
   - **Security Group**: Mở port 22 (SSH), 5000 (Backend), 80, 443 (HTTP/HTTPS)
   - **Storage**: 20GB (đủ cho development)

### 1.2. Kết Nối EC2

```bash
# SSH vào EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Hoặc nếu dùng Amazon Linux
ssh -i your-key.pem ec2-user@your-ec2-ip
```

### 1.3. Cập Nhật Hệ Thống

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# Amazon Linux
sudo yum update -y
```

---

## 2. Cài Đặt Node.js và npm

### 2.1. Cài Đặt Node.js 18.x (LTS)

**Ubuntu/Debian:**
```bash
# Cài đặt Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # Should be v18.x.x
npm --version   # Should be 9.x.x or higher
```

**Amazon Linux:**
```bash
# Cài đặt Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Verify
node --version
npm --version
```

### 2.2. Cài Đặt Git (nếu chưa có)

```bash
# Ubuntu/Debian
sudo apt install -y git

# Amazon Linux
sudo yum install -y git
```

---

## 3. Cài Đặt MongoDB

Bạn có 2 lựa chọn:

### Option A: MongoDB Atlas (Cloud - Recommended)

Không cần cài đặt gì trên EC2, chỉ cần connection string.

1. Tạo tài khoản MongoDB Atlas: https://www.mongodb.com/cloud/atlas/register
2. Tạo cluster FREE (M0)
3. Lấy connection string
4. Thêm EC2 IP vào whitelist trong Atlas

### Option B: MongoDB Community Edition (Local)

Nếu muốn chạy MongoDB trên chính EC2:

```bash
# Ubuntu/Debian
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update và cài đặt
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
sudo systemctl status mongod
```

**Amazon Linux:**
```bash
# Tạo MongoDB repo file
sudo vi /etc/yum.repos.d/mongodb-org-7.0.repo

# Thêm nội dung:
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc

# Cài đặt
sudo yum install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

---

## 4. Clone Code

### 4.1. Tạo Thư Mục Project

```bash
# Tạo thư mục
mkdir -p ~/projects
cd ~/projects

# Clone repository (thay bằng URL thực tế của bạn)
git clone https://github.com/your-username/your-repo.git
cd your-repo/cloud-master/backend

# Hoặc upload code bằng SCP
# Từ máy local:
# scp -i your-key.pem -r cloud-master ubuntu@your-ec2-ip:~/projects/
```

### 4.2. Kiểm Tra Cấu Trúc

```bash
ls -la
# Phải có: package.json, server.js, config/, routes/, models/
```

---

## 5. Cài Đặt Dependencies

```bash
# Cài đặt dependencies
npm install

# Nếu có lỗi permission, dùng:
npm install --unsafe-perm=true
```

**Verify:**
```bash
# Kiểm tra node_modules đã được tạo
ls -la node_modules | head -20
```

---

## 6. Cấu Hình Environment Variables

### 6.1. Tạo File .env

```bash
cd ~/projects/your-repo/cloud-master/backend
nano .env
```

### 6.2. Thêm Nội Dung .env

```env
# MongoDB Configuration
# Option A: MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/recipe-share?retryWrites=true&w=majority

# Option B: MongoDB Local
# MONGODB_URI=mongodb://localhost:27017/recipe-share?directConnection=false

# JWT Secret (Tạo random string mạnh)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars

# Server Configuration
PORT=5000
SERVER_ID=BE1-EC2-Production

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# API Base URL (cho image URLs)
API_BASE_URL=http://your-ec2-ip:5000
# Hoặc nếu có domain:
# API_BASE_URL=https://api.yourdomain.com
```

### 6.3. Tạo JWT Secret Mạnh

```bash
# Tạo random secret
openssl rand -base64 32
# Copy output vào JWT_SECRET
```

### 6.4. Bảo Mật File .env

```bash
# Chỉ owner mới đọc được
chmod 600 .env

# Verify
ls -la .env
# Phải hiển thị: -rw------- (chỉ owner đọc/ghi)
```

---

## 7. Cài Đặt PM2 (Process Manager)

PM2 giúp chạy backend như một service, tự động restart khi crash.

### 7.1. Cài Đặt PM2

```bash
# Cài đặt PM2 globally
sudo npm install -g pm2

# Verify
pm2 --version
```

### 7.2. Tạo PM2 Ecosystem File

```bash
cd ~/projects/your-repo/cloud-master/backend
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

### 7.3. Tạo Thư Mục Logs

```bash
mkdir -p logs
```

### 7.4. Start Backend với PM2

```bash
# Start backend
pm2 start ecosystem.config.js

# Hoặc đơn giản:
pm2 start server.js --name recipe-share-backend

# Kiểm tra status
pm2 status

# Xem logs
pm2 logs recipe-share-backend

# Xem logs real-time
pm2 logs recipe-share-backend --lines 50
```

### 7.5. Cấu Hình PM2 Auto-Start

```bash
# Tạo startup script
pm2 startup

# Copy command được output và chạy (ví dụ):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save PM2 process list
pm2 save
```

**Verify:**
```bash
# Restart EC2 và kiểm tra
sudo reboot
# Sau khi reboot, SSH lại và chạy:
pm2 status
# Backend phải tự động start
```

---

## 8. Cấu Hình Firewall

### 8.1. Ubuntu/Debian (UFW)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow Backend port
sudo ufw allow 5000/tcp

# Allow HTTP/HTTPS (nếu dùng Nginx)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### 8.2. Amazon Linux (Firewalld hoặc Security Groups)

**Option A: Dùng Security Groups (Recommended)**
- Vào EC2 Console → Security Groups
- Edit inbound rules:
  - Port 22 (SSH) - Your IP only
  - Port 5000 (Backend) - 0.0.0.0/0 (hoặc chỉ IP frontend)
  - Port 80, 443 (HTTP/HTTPS) - 0.0.0.0/0

**Option B: Firewalld**
```bash
sudo systemctl start firewalld
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

---

## 9. Cấu Hình Nginx (Optional - Recommended)

Nginx làm reverse proxy, giúp:
- Chạy backend trên port 5000 (internal)
- Expose qua port 80/443 (public)
- SSL/HTTPS support
- Load balancing (nếu có nhiều backend instances)

### 9.1. Cài Đặt Nginx

```bash
# Ubuntu/Debian
sudo apt install -y nginx

# Amazon Linux
sudo yum install -y nginx
```

### 9.2. Cấu Hình Nginx

```bash
sudo nano /etc/nginx/sites-available/recipe-share-backend
```

**Nội dung:**
```nginx
server {
    listen 80;
    server_name your-ec2-ip-or-domain.com;

    # Logs
    access_log /var/log/nginx/recipe-share-access.log;
    error_log /var/log/nginx/recipe-share-error.log;

    # Proxy to backend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Increase body size for file uploads
    client_max_body_size 10M;
}
```

### 9.3. Enable Site

```bash
# Ubuntu/Debian
sudo ln -s /etc/nginx/sites-available/recipe-share-backend /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 9.4. SSL với Let's Encrypt (Optional)

```bash
# Cài đặt Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 10. Test và Verify

### 10.1. Test Backend Trực Tiếp

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Response mong đợi:
# {
#   "status": "ok",
#   "server": "BE1-EC2-Production",
#   "database": "connected",
#   "cloudinary": "connected"
# }
```

### 10.2. Test Từ Bên Ngoài

```bash
# Từ máy local hoặc browser
curl http://your-ec2-ip:5000/api/health

# Hoặc nếu dùng Nginx
curl http://your-ec2-ip/api/health
```

### 10.3. Test API Endpoints

```bash
# Test register
curl -X POST http://your-ec2-ip:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123456"
  }'

# Test login
curl -X POST http://your-ec2-ip:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }'
```

### 10.4. Kiểm Tra PM2

```bash
# Status
pm2 status

# Logs
pm2 logs recipe-share-backend --lines 100

# Monitor
pm2 monit
```

### 10.5. Kiểm Tra MongoDB Connection

```bash
# Nếu MongoDB local
mongosh mongodb://localhost:27017/recipe-share

# Trong mongosh:
show dbs
use recipe-share
show collections
```

---

## 11. Troubleshooting

### 11.1. Backend Không Start

```bash
# Check logs
pm2 logs recipe-share-backend

# Check .env file
cat .env

# Test manually
cd ~/projects/your-repo/cloud-master/backend
node server.js
```

### 11.2. MongoDB Connection Error

```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh mongodb://localhost:27017/recipe-share

# Check firewall
sudo ufw status
```

### 11.3. Port Đã Được Sử Dụng

```bash
# Find process using port 5000
sudo lsof -i :5000
# Hoặc
sudo netstat -tulpn | grep 5000

# Kill process
sudo kill -9 <PID>
```

### 11.4. PM2 Process Không Auto-Start

```bash
# Re-run startup
pm2 startup

# Save process list
pm2 save

# Check systemd service
systemctl status pm2-ubuntu
```

### 11.5. Nginx 502 Bad Gateway

```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/recipe-share-error.log

# Check backend đang chạy
pm2 status

# Test backend trực tiếp
curl http://localhost:5000/api/health
```

### 11.6. Cloudinary Connection Error

```bash
# Check .env có đủ Cloudinary credentials
grep CLOUDINARY .env

# Test từ EC2
curl https://api.cloudinary.com/v1_1/your-cloud-name/ping
```

### 11.7. Permission Denied

```bash
# Fix file permissions
sudo chown -R $USER:$USER ~/projects

# Fix .env permission
chmod 600 .env
```

---

## 12. Useful Commands

### PM2 Commands

```bash
# Start
pm2 start server.js --name recipe-share-backend

# Stop
pm2 stop recipe-share-backend

# Restart
pm2 restart recipe-share-backend

# Delete
pm2 delete recipe-share-backend

# Monitor
pm2 monit

# Logs
pm2 logs recipe-share-backend
pm2 logs recipe-share-backend --lines 100

# Status
pm2 status
pm2 info recipe-share-backend
```

### System Commands

```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
top
htop

# Check network
netstat -tulpn
```

### MongoDB Commands

```bash
# Start MongoDB
sudo systemctl start mongod

# Stop MongoDB
sudo systemctl stop mongod

# Restart MongoDB
sudo systemctl restart mongod

# Check status
sudo systemctl status mongod
```

---

## 13. Security Best Practices

1. **Firewall**: Chỉ mở port cần thiết
2. **SSH**: Dùng key pair, disable password login
3. **.env**: Chmod 600, không commit vào git
4. **JWT_SECRET**: Dùng random string mạnh (32+ chars)
5. **MongoDB**: Nếu local, chỉ bind localhost
6. **Updates**: Thường xuyên update system packages
7. **Backup**: Backup database định kỳ

---

## 14. Monitoring

### 14.1. PM2 Monitoring

```bash
# Install PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 14.2. System Monitoring

```bash
# Install monitoring tools
sudo apt install -y htop iotop

# Check system resources
htop
```

---

## ✅ Checklist

- [ ] EC2 instance đã được tạo và SSH được
- [ ] Node.js 18.x đã được cài đặt
- [ ] MongoDB đã được cài đặt hoặc Atlas đã được setup
- [ ] Code đã được clone/upload
- [ ] Dependencies đã được cài đặt (`npm install`)
- [ ] File `.env` đã được tạo và cấu hình đúng
- [ ] PM2 đã được cài đặt và backend đang chạy
- [ ] PM2 auto-start đã được cấu hình
- [ ] Firewall đã được mở port 5000 (và 80/443 nếu dùng Nginx)
- [ ] Health check endpoint trả về `{"status": "ok", "database": "connected", "cloudinary": "connected"}`
- [ ] API endpoints hoạt động từ bên ngoài
- [ ] Nginx đã được cấu hình (nếu dùng)

---

## 🎉 Hoàn Thành!

Backend đã được deploy thành công lên EC2. Bây giờ bạn có thể:

1. Cập nhật frontend để trỏ đến EC2 IP/domain
2. Test tất cả API endpoints
3. Monitor logs và performance
4. Setup backup cho database

**Next Steps:**
- Setup domain name và DNS
- Configure SSL certificate
- Setup automated backups
- Configure monitoring và alerts

---

## 📞 Support

Nếu gặp vấn đề, kiểm tra:
1. PM2 logs: `pm2 logs recipe-share-backend`
2. Nginx logs: `sudo tail -f /var/log/nginx/recipe-share-error.log`
3. MongoDB logs: `sudo tail -f /var/log/mongodb/mongod.log`
4. System logs: `journalctl -xe`
