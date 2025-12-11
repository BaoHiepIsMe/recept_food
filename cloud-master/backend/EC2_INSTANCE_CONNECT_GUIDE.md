# 🚀 Hướng Dẫn Deploy Backend Lên EC2 - Sử Dụng EC2 Instance Connect

Hướng dẫn chi tiết deploy backend lên EC2 **trực tiếp qua browser console** (EC2 Instance Connect), không cần SSH key.

## 📋 Mục Lục

1. [Chuẩn Bị EC2 Instance](#1-chuẩn-bị-ec2-instance)
2. [Kết Nối Qua EC2 Instance Connect](#2-kết-nối-qua-ec2-instance-connect)
3. [Cài Đặt Node.js](#3-cài-đặt-nodejs)
4. [Cài Đặt MongoDB](#4-cài-đặt-mongodb)
5. [Upload Code](#5-upload-code)
6. [Cài Đặt Dependencies](#6-cài-đặt-dependencies)
7. [Cấu Hình Environment](#7-cấu-hình-environment)
8. [Cài Đặt PM2](#8-cài-đặt-pm2)
9. [Cấu Hình Firewall](#9-cấu-hình-firewall)
10. [Test và Verify](#10-test-và-verify)

---

## 1. Chuẩn Bị EC2 Instance

### 1.1. Launch EC2 Instance

1. **Vào AWS Console:**
   - https://console.aws.amazon.com/ec2/
   - Click **"Launch Instance"**

2. **Cấu hình Instance:**
   - **Name**: `recipe-share-backend`
   - **AMI**: `Ubuntu Server 22.04 LTS` (Free tier eligible)
   - **Instance Type**: `t2.micro` (Free tier) hoặc `t3.small`
   - **Key Pair**: Chọn hoặc tạo key pair (cần cho Instance Connect)
   - **Network Settings**: 
     - ✅ Auto-assign public IP: Enable
     - Click **"Edit"** → Add security group rules:
       - **SSH (22)**: My IP
       - **Custom TCP (5000)**: Anywhere (0.0.0.0/0) - cho backend
       - **HTTP (80)**: Anywhere - cho Nginx (optional)
       - **HTTPS (443)**: Anywhere - cho SSL (optional)
   - **Storage**: 20GB gp3 (đủ cho development)
   - **Advanced details** → **IAM instance profile**: 
     - Tạo role mới với policy `AmazonEC2InstanceConnect` (nếu chưa có)

3. **Launch Instance:**
   - Click **"Launch Instance"**
   - Đợi instance chạy (Status: Running)

### 1.2. Lấy Public IP

- Vào EC2 → Instances → Copy **Public IPv4 address**
- Ví dụ: `54.123.45.67`

---

## 2. Kết Nối Qua EC2 Instance Connect

### 2.1. Mở EC2 Instance Connect

1. **Vào EC2 Console:**
   - https://console.aws.amazon.com/ec2/
   - Click vào instance vừa tạo

2. **Click nút "Connect":**
   - Ở góc trên bên phải, click **"Connect"**

3. **Chọn "EC2 Instance Connect":**
   - Tab **"EC2 Instance Connect"** (mặc định)
   - Click **"Connect"**
   - Terminal sẽ mở trong browser

### 2.2. Verify Connection

Bạn sẽ thấy terminal prompt:
```bash
ubuntu@ip-172-31-xx-xx:~$
```

**Lưu ý:**
- Terminal này chạy trực tiếp trên EC2
- Không cần SSH key
- Session sẽ timeout sau 1 giờ không hoạt động
- Có thể mở nhiều tab terminal cùng lúc

---

## 3. Cài Đặt Node.js

### 3.1. Cập Nhật System

```bash
# Update package list
sudo apt update

# Upgrade system
sudo apt upgrade -y
```

### 3.2. Cài Đặt Node.js 18.x

```bash
# Thêm NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Cài đặt Node.js
sudo apt-get install -y nodejs

# Verify installation
node --version
# Output: v18.x.x

npm --version
# Output: 9.x.x hoặc cao hơn
```

### 3.3. Cài Đặt Git

```bash
sudo apt install -y git
git --version
```

---

## 4. Cài Đặt MongoDB

### Option A: MongoDB Atlas (Khuyến nghị - FREE)

**Không cần cài đặt trên EC2**, chỉ cần connection string.

1. **Tạo MongoDB Atlas Account:**
   - https://www.mongodb.com/cloud/atlas/register
   - Đăng ký FREE tier

2. **Tạo Cluster:**
   - Click **"Build a Database"**
   - Chọn **FREE (M0)** tier
   - Chọn region gần EC2 nhất
   - Click **"Create"**

3. **Setup Database User:**
   - Database Access → Add New Database User
   - Username: `recipe-share-user`
   - Password: Tạo password mạnh (lưu lại)
   - Database User Privileges: **Read and write to any database**

4. **Whitelist EC2 IP:**
   - Network Access → Add IP Address
   - Add Current IP Address (hoặc `0.0.0.0/0` để test)
   - Click **"Add Access List Entry"**

5. **Lấy Connection String:**
   - Click **"Connect"** trên cluster
   - Chọn **"Connect your application"**
   - Copy connection string:
     ```
     mongodb+srv://recipe-share-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Thay `<password>` bằng password đã tạo

**Lưu lại connection string để dùng sau!**

### Option B: MongoDB Local (Trên EC2)

Nếu muốn chạy MongoDB trên chính EC2:

```bash
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

---

## 5. Upload Code

### Cách 1: Clone từ Git (Khuyến nghị)

```bash
# Tạo thư mục project
mkdir -p ~/projects
cd ~/projects

# Clone repository (thay bằng URL thực tế)
git clone https://github.com/your-username/your-repo.git

# Hoặc nếu repo private, cần setup SSH key hoặc token
cd your-repo/cloud-master/backend

# Verify
ls -la
# Phải thấy: package.json, server.js, config/, routes/, models/
```

### Cách 2: Upload File Trực Tiếp

**Bước 1: Nén code trên máy local**

Trên máy Windows:
- Nén thư mục `cloud-master` thành `cloud-master.zip`

**Bước 2: Upload lên S3 (hoặc dùng cách khác)**

**Option A: Dùng AWS S3 (Khuyến nghị)**

1. **Tạo S3 bucket:**
   - AWS Console → S3 → Create bucket
   - Tên: `recipe-share-deploy` (hoặc tên khác)
   - Region: Cùng region với EC2
   - Click **"Create bucket"**

2. **Upload file:**
   - Vào bucket → Upload
   - Chọn file `cloud-master.zip`
   - Click **"Upload"**

3. **Download trên EC2:**
   ```bash
   # Cài đặt AWS CLI (nếu chưa có)
   sudo apt install -y awscli
   
   # Configure AWS CLI (nếu cần)
   aws configure
   # Nhập: Access Key ID, Secret Access Key, Region
   
   # Download từ S3
   cd ~/projects
   aws s3 cp s3://recipe-share-deploy/cloud-master.zip .
   
   # Giải nén
   unzip cloud-master.zip
   cd cloud-master/backend
   ```

**Option B: Dùng SCP từ máy local**

```bash
# Trên máy local (Windows PowerShell hoặc Git Bash)
# Cần có key pair file (.pem)
scp -i your-key.pem -r cloud-master ubuntu@your-ec2-ip:~/projects/
```

Sau đó trên EC2:
```bash
cd ~/projects/cloud-master/backend
```

**Option C: Dùng VS Code Remote (Nếu có)**

1. Cài extension "Remote - SSH" trong VS Code
2. Connect đến EC2
3. Upload folder trực tiếp

---

## 6. Cài Đặt Dependencies

```bash
# Đảm bảo đang ở thư mục backend
cd ~/projects/your-repo/cloud-master/backend
# Hoặc
cd ~/projects/cloud-master/backend

# Cài đặt dependencies
npm install

# Nếu có lỗi permission
npm install --unsafe-perm=true

# Verify
ls -la node_modules | head -20
```

**Thời gian cài đặt:** ~2-5 phút

---

## 7. Cấu Hình Environment

### 7.1. Tạo File .env

```bash
# Tạo file .env
nano .env
```

### 7.2. Thêm Nội Dung

**Copy và paste vào nano, sau đó chỉnh sửa:**

```env
# MongoDB Configuration
# Option A: MongoDB Atlas (thay connection string)
MONGODB_URI=mongodb+srv://recipe-share-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/recipe-share?retryWrites=true&w=majority

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

# API Base URL
API_BASE_URL=http://YOUR_EC2_IP:5000
# Hoặc nếu có domain:
# API_BASE_URL=https://api.yourdomain.com
```

### 7.3. Tạo JWT Secret

```bash
# Tạo random secret
openssl rand -base64 32

# Copy output và paste vào JWT_SECRET trong .env
```

### 7.4. Lưu File

Trong nano:
- **Ctrl + O** → Enter (Save)
- **Ctrl + X** (Exit)

### 7.5. Bảo Mật File .env

```bash
# Chỉ owner mới đọc được
chmod 600 .env

# Verify
ls -la .env
# Phải hiển thị: -rw------- (chỉ owner đọc/ghi)
```

---

## 8. Cài Đặt PM2

### 8.1. Cài Đặt PM2

```bash
# Cài đặt PM2 globally
sudo npm install -g pm2

# Verify
pm2 --version
```

### 8.2. Tạo PM2 Ecosystem File

```bash
# Tạo file config
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

**Lưu file:** Ctrl + O → Enter → Ctrl + X

### 8.3. Tạo Thư Mục Logs

```bash
mkdir -p logs
```

### 8.4. Start Backend với PM2

```bash
# Start backend
pm2 start ecosystem.config.js

# Hoặc đơn giản:
pm2 start server.js --name recipe-share-backend

# Kiểm tra status
pm2 status

# Xem logs
pm2 logs recipe-share-backend

# Xem logs real-time (Ctrl+C để thoát)
pm2 logs recipe-share-backend --lines 50
```

### 8.5. Cấu Hình PM2 Auto-Start

```bash
# Tạo startup script
pm2 startup

# Output sẽ có dạng:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Copy và chạy command đó

# Ví dụ:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save PM2 process list
pm2 save
```

**Verify:**
```bash
# Restart EC2 và kiểm tra
sudo reboot
# Sau khi reboot, connect lại và chạy:
pm2 status
# Backend phải tự động start
```

---

## 9. Cấu Hình Firewall

### 9.1. Cấu Hình UFW (Ubuntu Firewall)

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

### 9.2. Verify Security Group

1. **Vào EC2 Console:**
   - Instances → Chọn instance
   - Tab **"Security"** → Click Security Group

2. **Edit Inbound Rules:**
   - Port 22 (SSH): Your IP
   - Port 5000 (Backend): 0.0.0.0/0 (hoặc chỉ IP frontend)
   - Port 80, 443: 0.0.0.0/0 (nếu dùng Nginx)

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

**Từ máy local hoặc browser:**

```bash
# Thay YOUR_EC2_IP bằng IP thực tế
curl http://YOUR_EC2_IP:5000/api/health
```

**Hoặc mở browser:**
```
http://YOUR_EC2_IP:5000/api/health
```

### 10.3. Test API Endpoints

```bash
# Test register
curl -X POST http://YOUR_EC2_IP:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "test123456"
  }'

# Test login
curl -X POST http://YOUR_EC2_IP:5000/api/auth/login \
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

# Monitor (Ctrl+C để thoát)
pm2 monit
```

### 10.5. Kiểm Tra MongoDB Connection

**Nếu dùng MongoDB Atlas:**
- Vào Atlas Dashboard → Collections
- Phải thấy database `recipe-share` và collections

**Nếu dùng MongoDB Local:**
```bash
mongosh mongodb://localhost:27017/recipe-share

# Trong mongosh:
show dbs
use recipe-share
show collections
exit
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
cd ~/projects/cloud-master/backend
node server.js
```

### 11.2. MongoDB Connection Error

**Nếu dùng Atlas:**
- Kiểm tra IP whitelist trong Atlas
- Kiểm tra connection string trong .env
- Kiểm tra username/password

**Nếu dùng Local:**
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log

# Test connection
mongosh mongodb://localhost:27017/recipe-share
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

### 11.5. Cloudinary Connection Error

```bash
# Check .env có đủ Cloudinary credentials
grep CLOUDINARY .env

# Test từ EC2
curl https://api.cloudinary.com/v1_1/your-cloud-name/ping
```

### 11.6. Permission Denied

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
# Hoặc cài htop
sudo apt install -y htop
htop

# Check network
netstat -tulpn
```

---

## 13. Next Steps

1. **Cập nhật Frontend:**
   - Thay API URL trong frontend thành EC2 IP
   - Ví dụ: `http://YOUR_EC2_IP:5000`

2. **Setup Domain (Optional):**
   - Mua domain
   - Point DNS đến EC2 IP
   - Setup Nginx reverse proxy
   - Setup SSL với Let's Encrypt

3. **Monitoring:**
   - Setup CloudWatch logs
   - Setup alerts
   - Monitor PM2 logs

4. **Backup:**
   - Setup automated MongoDB backup
   - Backup .env file

---

## ✅ Checklist

- [ ] EC2 instance đã được tạo và chạy
- [ ] Đã kết nối qua EC2 Instance Connect
- [ ] Node.js 18.x đã được cài đặt
- [ ] MongoDB Atlas đã được setup (hoặc MongoDB local)
- [ ] Code đã được upload/clone
- [ ] Dependencies đã được cài đặt (`npm install`)
- [ ] File `.env` đã được tạo và cấu hình đúng
- [ ] PM2 đã được cài đặt và backend đang chạy
- [ ] PM2 auto-start đã được cấu hình
- [ ] Firewall đã được mở port 5000
- [ ] Security Group đã được cấu hình
- [ ] Health check endpoint trả về `{"status": "ok", "database": "connected", "cloudinary": "connected"}`
- [ ] API endpoints hoạt động từ bên ngoài

---

## 🎉 Hoàn Thành!

Backend đã được deploy thành công lên EC2 qua EC2 Instance Connect!

**Lưu ý:**
- EC2 Instance Connect session sẽ timeout sau 1 giờ không hoạt động
- Có thể mở nhiều tab terminal cùng lúc
- PM2 sẽ tự động restart backend khi EC2 reboot
- Logs được lưu trong `~/projects/cloud-master/backend/logs/`

---

## 📞 Support

Nếu gặp vấn đề:
1. Check PM2 logs: `pm2 logs recipe-share-backend`
2. Check system logs: `journalctl -xe`
3. Verify .env file: `cat .env`
4. Test connection: `curl http://localhost:5000/api/health`

