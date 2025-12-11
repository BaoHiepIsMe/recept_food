# 🔍 Hướng Dẫn Kiểm Tra Vấn Đề Hình Ảnh

## Các bước kiểm tra

### Bước 1: Kiểm tra Backend có chạy không

```bash
curl http://localhost:5000/api/health
```

Kết quả phải có `"database": "connected"`

### Bước 2: Kiểm tra Recipes có image ID không

```bash
# Vào mongosh
docker exec -it mongodb-mongos mongosh

# Trong mongosh:
use recipe-share
db.recipes.find({}, {title: 1, image: 1}).limit(5)
```

**Kiểm tra:**
- Nếu `image: ""` → Chưa upload được
- Nếu `image: "67abc123..."` → Đã có image ID

### Bước 3: Kiểm tra GridFS có file không

```bash
# Trong mongosh:
use recipe-share
db.fs.files.find().limit(5)
```

**Kiểm tra:**
- Nếu có kết quả → Files đã được lưu vào GridFS
- Nếu không có → Files chưa được upload

### Bước 4: Test API lấy file

```bash
# Lấy image ID từ bước 2, ví dụ: 67abc123...
curl -I http://localhost:5000/api/files/67abc123...
```

**Kết quả mong đợi:**
```
HTTP/1.1 200 OK
Content-Type: image/jpeg
```

**Nếu lỗi:**
- `404 Not Found` → File không tồn tại trong GridFS
- `400 Bad Request` → Image ID không hợp lệ
- `500 Internal Server Error` → Lỗi server

### Bước 5: Kiểm tra Browser Console

Mở browser → F12 → Console, tìm lỗi:
- `Failed to load resource` → URL không đúng
- `404` → File không tìm thấy
- `CORS error` → CORS chưa cấu hình

### Bước 6: Kiểm tra Network Tab

1. Mở browser → F12 → Network
2. Reload trang
3. Tìm request đến `/api/files/...`
4. Xem:
   - Status code (phải là 200)
   - Response (phải là binary/image)
   - Request URL (phải đúng)

---

## Các lỗi thường gặp

### Lỗi 1: Image ID rỗng

**Triệu chứng:** `image: ""` trong database

**Nguyên nhân:**
- Upload thất bại
- Multer không nhận được file
- GridFS upload error

**Cách sửa:**
- Kiểm tra backend logs khi upload
- Kiểm tra `req.file` có tồn tại không
- Kiểm tra GridFS connection

### Lỗi 2: Image ID có nhưng không lấy được

**Triệu chứng:** `image: "67abc123..."` nhưng không hiển thị

**Nguyên nhân:**
- File không tồn tại trong GridFS
- Image ID không hợp lệ
- Route `/api/files/:fileId` không hoạt động

**Cách sửa:**
```bash
# Kiểm tra file có trong GridFS không
docker exec -it mongodb-mongos mongosh
use recipe-share
db.fs.files.findOne({_id: ObjectId("67abc123...")})
```

### Lỗi 3: URL không đúng

**Triệu chứng:** Browser tìm file ở `localhost:3000/api/files/...` thay vì `localhost:5000`

**Nguyên nhân:**
- Backend trả về relative URL `/api/files/...`
- Frontend hiểu là relative từ frontend domain

**Cách sửa:**
- Backend phải trả về full URL: `http://localhost:5000/api/files/...`

---

## Script tự động kiểm tra

Chạy script test:

```bash
cd ~/cloud/recept_food/cloud-master/backend
node scripts/test-image-upload.js
```

Script sẽ:
1. Test MongoDB connection
2. Test GridFS bucket
3. List files trong GridFS
4. Test upload/download
5. Show recipes với images và URLs

---

## Quick Debug Commands

```bash
# 1. Xem recipes có image không
docker exec -it mongodb-mongos mongosh recipe-share --eval "db.recipes.find({}, {title: 1, image: 1}).limit(3)"

# 2. Xem files trong GridFS
docker exec -it mongodb-mongos mongosh recipe-share --eval "db.fs.files.find().limit(3)"

# 3. Test lấy file (thay FILE_ID bằng ID thực tế)
curl -I http://localhost:5000/api/files/FILE_ID

# 4. Xem backend logs
# Trong terminal đang chạy backend, xem logs khi upload
```

