# MongoDB Atlas Migration Guide

Backend đã được migration từ Supabase sang MongoDB Atlas với kiến trúc sharded cluster và GridFS storage.

## Kiến trúc

```
EC2 A → MongoDB Shard A (M0 Free Tier)
EC2 B → MongoDB Shard B (M0 Free Tier)  
EC2 C → MongoDB Shard C (M0 Free Tier)
         ↓
MongoDB Atlas Global Cluster (Sharded)
         ↓
GridFS Storage (cho images/files)
```

## Setup MongoDB Atlas

### 1. Tạo MongoDB Atlas Account
- Truy cập: https://www.mongodb.com/cloud/atlas
- Đăng ký tài khoản miễn phí

### 2. Tạo Cluster
- Chọn **M0 Free Tier** (512MB storage)
- Chọn region gần nhất
- Tạo cluster

### 3. Enable Sharding (Optional - cho production)
- Vào **Clusters** → **Configure** → **Enable Sharding**
- Tạo 3 shards (M0 Free Tier cho mỗi shard)
- Setup shard keys:
  ```javascript
  sh.enableSharding("recipe-share")
  sh.shardCollection("recipe-share.users", { email: 1 })
  sh.shardCollection("recipe-share.recipes", { authorId: 1 })
  sh.shardCollection("recipe-share.blogs", { authorId: 1 })
  sh.shardCollection("recipe-share.notifications", { userId: 1 })
  ```

### 4. Setup Database Access
- Vào **Database Access** → **Add New Database User**
- Tạo username và password (lưu lại để dùng trong connection string)

### 5. Setup Network Access
- Vào **Network Access** → **Add IP Address**
- Thêm `0.0.0.0/0` cho development (hoặc IP cụ thể cho production)

### 6. Get Connection String
- Vào **Clusters** → **Connect** → **Connect your application**
- Copy connection string
- Thay `<password>` bằng password đã tạo ở bước 4
- Thay `<database>` bằng `recipe-share`

## Environment Variables

Tạo file `.env` trong thư mục `backend/`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/recipe-share?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-here
PORT=5000
SERVER_ID=BE1-MongoDB
```

## Installation

```bash
cd cloud-master/backend
npm install
```

## Run

```bash
# Development
npm run dev

# Production
npm start
```

## Models

- **User**: Người dùng (dùng email làm _id cho sharding)
- **Recipe**: Công thức nấu ăn
- **Blog**: Blog posts
- **Comment**: Bình luận (cho cả recipes và blogs)
- **Favorite**: Yêu thích recipes
- **CommentLike**: Like comments
- **BlogLike**: Like blogs
- **Notification**: Thông báo

## GridFS Storage

Files (images) được lưu trong GridFS bucket `files`:
- Avatars: `/api/files/{fileId}`
- Recipe images: `/api/files/{fileId}`
- Blog images: `/api/files/{fileId}`

## API Endpoints

Tất cả endpoints giữ nguyên như trước:
- `/api/auth/*` - Authentication
- `/api/recipes/*` - Recipes CRUD
- `/api/blogs/*` - Blogs CRUD
- `/api/notifications/*` - Notifications
- `/api/files/*` - File serving từ GridFS

## Migration từ Supabase

Nếu bạn có data cũ từ Supabase, cần:
1. Export data từ Supabase
2. Transform data format (UUID → ObjectId, timestamps, etc.)
3. Import vào MongoDB

## Notes

- User `_id` sử dụng email (string) thay vì ObjectId để dễ sharding
- Recipe/Blog/Comment sử dụng ObjectId
- GridFS file IDs là ObjectId strings
- JWT tokens có thời hạn 7 ngày

