# ☁️ Cloudinary Setup Guide

Hướng dẫn setup Cloudinary để lưu trữ hình ảnh thay vì GridFS.

## 📋 Yêu cầu

1. Tạo tài khoản Cloudinary FREE: https://cloudinary.com/users/register/free
2. Lấy Cloudinary credentials từ Dashboard

## 🔑 Lấy Cloudinary Credentials

1. Đăng nhập Cloudinary Dashboard: https://console.cloudinary.com/
2. Vào **Settings** → **Product environment credentials**
3. Copy 3 giá trị:
   - **Cloud name**
   - **API Key**
   - **API Secret**

## ⚙️ Cấu hình .env

Thêm vào file `.env` trong `cloud-master/backend/`:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# MongoDB (giữ nguyên)
MONGODB_URI=mongodb://localhost:27017/recipe-share?directConnection=false

# JWT Secret (giữ nguyên)
JWT_SECRET=your-secret-key

# Server Config (giữ nguyên)
PORT=5000
SERVER_ID=BE1-MongoDB-Cloudinary
```

## 📦 Cài đặt Package

```bash
cd cloud-master/backend
npm install cloudinary
```

## ✅ Đã cập nhật

Backend đã được cập nhật để:
- ✅ Upload images lên Cloudinary
- ✅ Trả về Cloudinary URL trực tiếp
- ✅ Xóa images từ Cloudinary khi cần
- ✅ Không cần GridFS nữa

## 🧪 Test

### Test Upload

1. Chạy backend: `npm run dev`
2. Mở frontend: `http://localhost:3000`
3. Đăng nhập
4. Tạo recipe/blog với image
5. Kiểm tra response có Cloudinary URL:
   ```json
   {
     "image": "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/recipe-share/recipes/..."
   }
   ```

### Test trong Browser

1. Mở browser: `http://localhost:3000`
2. F12 → Network
3. Upload image
4. Xem response → Image URL phải là Cloudinary URL
5. Image phải hiển thị đúng

## 📊 Cloudinary Dashboard

Sau khi upload, vào Cloudinary Dashboard:
- **Media Library** → Sẽ thấy images đã upload
- **Folders**: `recipe-share/recipes/`, `recipe-share/blogs/`, `recipe-share/avatars/`

## 🎯 Lợi ích

- ✅ Không cần GridFS
- ✅ Images được optimize tự động
- ✅ CDN global (tải nhanh)
- ✅ FREE tier: 25GB storage, 25GB bandwidth/month
- ✅ URL trực tiếp, không cần route `/api/files/`

## 🔧 Troubleshooting

### Lỗi: Missing Cloudinary credentials

**Triệu chứng:** `Missing Cloudinary environment variables`

**Cách sửa:**
- Kiểm tra `.env` có đủ 3 biến: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Restart backend

### Lỗi: Upload failed

**Triệu chứng:** `Cloudinary upload failed`

**Cách sửa:**
- Kiểm tra credentials đúng chưa
- Kiểm tra internet connection
- Xem Cloudinary Dashboard → Settings → Security → Allowed upload presets

### Lỗi: Image không hiển thị

**Triệu chứng:** Image URL có nhưng không load được

**Cách sửa:**
- Kiểm tra URL có đúng format Cloudinary không
- Kiểm tra CORS settings trong Cloudinary (nếu cần)
- Test URL trực tiếp trong browser

## 📝 Notes

- Images được lưu trong folder: `recipe-share/{type}/` (recipes, blogs, avatars)
- Cloudinary tự động optimize images (quality, format)
- FREE tier đủ cho development và small production
- Có thể upgrade lên paid plan nếu cần

