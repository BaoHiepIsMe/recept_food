# Backend - Recipe Share API

Backend API cho ứng dụng Recipe Share, hỗ trợ **MongoDB Community Edition với sharding** - **100% FREE**.

## 🎯 Kiến trúc

```
EC2 A → MongoDB Shard A (FREE)
EC2 B → MongoDB Shard B (FREE)
EC2 C → MongoDB Shard C (FREE)
EC2 D → Config Server + Mongos Router (FREE)
         ↓
Sharded Cluster
         ↓
GridFS Storage (FREE)
```

## 📚 Tài liệu

- **🚀 Quick Start**: [`QUICK_START.md`](./QUICK_START.md) - Setup nhanh trong 3 bước
- **📖 Setup chi tiết**: [`docs/MONGODB_COMMUNITY_SETUP.md`](./docs/MONGODB_COMMUNITY_SETUP.md) - Hướng dẫn từng bước
- **⚡ Quick Reference**: [`README_SHARDED_SETUP.md`](./README_SHARDED_SETUP.md) - Tham khảo nhanh
- **☁️ MongoDB Atlas**: [`README_MONGODB.md`](./README_MONGODB.md) - Nếu dùng Atlas thay vì Community Edition

## 🛠️ Tech Stack

- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB Community Edition (Sharded Cluster)
- **File Storage**: GridFS
- **Authentication**: JWT
- **Password Hashing**: bcryptjs

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

Tạo file `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/recipe-share
JWT_SECRET=your-super-secret-jwt-key
PORT=5000
SERVER_ID=BE1-MongoDB
```

### Connection String Examples

**MongoDB Community Edition (Sharded):**
```env
MONGODB_URI=mongodb://mongos-ip:27017/recipe-share?directConnection=false
```

**MongoDB Atlas:**
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/recipe-share
```

## 🚀 Running

```bash
# Development
npm run dev

# Production
npm start
```

## 🐳 Docker (Local Testing)

Test sharded cluster local:

```bash
docker-compose -f docker-compose.sharded.yml up -d
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/profile` - Lấy profile
- `PUT /api/auth/profile` - Cập nhật profile

### Recipes
- `GET /api/recipes` - Lấy tất cả recipes
- `GET /api/recipes/search?q=...` - Tìm kiếm
- `GET /api/recipes/my` - Recipes của user
- `GET /api/recipes/favorites` - Recipes yêu thích
- `GET /api/recipes/:id` - Lấy recipe theo ID
- `POST /api/recipes` - Tạo recipe mới
- `PUT /api/recipes/:id` - Cập nhật recipe
- `DELETE /api/recipes/:id` - Xóa recipe
- `POST /api/recipes/:id/favorite` - Toggle favorite
- `GET /api/recipes/:id/favorite/check` - Kiểm tra favorite

### Blogs
- `GET /api/blogs` - Lấy tất cả blogs
- `GET /api/blogs/my` - Blogs của user
- `POST /api/blogs` - Tạo blog mới
- `PUT /api/blogs/:id` - Cập nhật blog
- `DELETE /api/blogs/:id` - Xóa blog
- `POST /api/blogs/:id/like` - Toggle like

### Comments
- `GET /api/recipes/:id/comments` - Comments của recipe
- `POST /api/recipes/:id/comments` - Tạo comment
- `DELETE /api/recipes/:id/comments/:commentId` - Xóa comment
- `POST /api/recipes/:id/comments/:commentId/like` - Like comment

- `GET /api/blogs/:id/comments` - Comments của blog
- `POST /api/blogs/:id/comments` - Tạo comment
- `DELETE /api/blogs/:id/comments/:commentId` - Xóa comment
- `POST /api/blogs/:id/comments/:commentId/like` - Like comment

### Notifications
- `GET /api/notifications` - Lấy notifications
- `GET /api/notifications/unread-count` - Số lượng chưa đọc
- `PUT /api/notifications/:id/read` - Đánh dấu đã đọc
- `PUT /api/notifications/read-all` - Đánh dấu tất cả đã đọc

### Files
- `GET /api/files/:fileId` - Serve file từ GridFS

## 🗄️ Database Models

- **User** - Người dùng (shard key: `email`)
- **Recipe** - Công thức (shard key: `authorId`)
- **Blog** - Blog posts (shard key: `authorId`)
- **Comment** - Bình luận
- **Favorite** - Yêu thích recipes
- **BlogLike** - Like blogs
- **CommentLike** - Like comments
- **Notification** - Thông báo (shard key: `userId`)

## 🔐 Authentication

Tất cả endpoints (trừ register, login) yêu cầu JWT token:

```
Authorization: Bearer <token>
```

## 📁 File Storage

Files được lưu trong GridFS bucket `files`:
- Avatars: `/api/files/{fileId}`
- Recipe images: `/api/files/{fileId}`
- Blog images: `/api/files/{fileId}`

## 🧪 Testing

```bash
# Health check
curl http://localhost:5000/api/health

# Test MongoDB connection
curl http://localhost:5000/api/health | jq
```

## 📝 Scripts

- `scripts/setup-shard-server.sh` - Setup shard server
- `scripts/setup-config-mongos.sh` - Setup config server + mongos
- `scripts/verify-sharding.sh` - Verify sharding setup

## 🐛 Troubleshooting

### Connection Error
- Kiểm tra `MONGODB_URI` trong `.env`
- Verify MongoDB đã khởi động
- Check firewall/security groups

### GridFS Error
- Verify GridFS bucket đã được tạo
- Check MongoDB version (7.0+)

### Sharding Issues
- Run `sh.status()` trong mongosh
- Verify shards đã được add
- Check shard keys đã được set

## 📄 License

ISC

## 👥 Contributors

- Backend migration to MongoDB Community Edition with sharding

