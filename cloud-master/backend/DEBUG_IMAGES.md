# 🔍 Hướng Dẫn Debug Vấn Đề Hình Ảnh

## ✅ Đã sửa

Backend đã được cập nhật để trả về **full URL** thay vì relative path:
- Từ: `/api/files/{fileId}`
- Thành: `http://localhost:5000/api/files/{fileId}`

## 🔍 Các bước kiểm tra

### Bước 1: Kiểm tra Backend đã restart chưa

Backend phải restart để áp dụng thay đổi. Nếu dùng `nodemon`, nó sẽ tự động restart.

**Kiểm tra logs:**
```
✅ Connected to MongoDB (Community Edition)
📦 Database: recipe-share
✅ GridFS bucket initialized
🚀 Server running on port 5000
```

### Bước 2: Kiểm tra Recipe có image ID không

```bash
# Vào mongosh
docker exec -it mongodb-mongos mongosh

# Trong mongosh:
use recipe-share
db.recipes.find({}, {title: 1, image: 1}).limit(3)
```

**Kết quả mong đợi:**
```javascript
{
  _id: ObjectId("..."),
  title: "salad",
  image: "67abc123def456..."  // ← Phải có image ID
}
```

**Nếu `image: ""`** → Chưa upload được, xem Bước 3.

### Bước 3: Kiểm tra GridFS có file không

```bash
# Trong mongosh:
db.fs.files.find().limit(3)
```

**Kết quả mong đợi:**
```javascript
{
  _id: ObjectId("67abc123..."),
  filename: "recipes/1234567890-image.jpg",
  contentType: "image/jpeg",
  length: 12345,
  uploadDate: ISODate("...")
}
```

**Nếu không có file** → Upload thất bại, xem Bước 4.

### Bước 4: Test Upload Image

1. Mở browser: `http://localhost:3000`
2. Đăng nhập
3. Vào "My Recipes"
4. Click "Add Recipe"
5. Chọn image và submit
6. Xem backend logs trong terminal

**Backend logs phải có:**
```
✅ GridFS bucket initialized
Image upload error: ... (nếu có lỗi)
```

### Bước 5: Test API Response

```bash
# Lấy một recipe
curl http://localhost:5000/api/recipes | jq '.[0].image'
```

**Kết quả mong đợi:**
```json
"http://localhost:5000/api/files/67abc123def456..."
```

**Nếu vẫn là `/api/files/...`** → Backend chưa restart hoặc code chưa được cập nhật.

### Bước 6: Test Lấy File

```bash
# Lấy image ID từ Bước 2, ví dụ: 67abc123...
curl -I http://localhost:5000/api/files/67abc123...
```

**Kết quả mong đợi:**
```
HTTP/1.1 200 OK
Content-Type: image/jpeg
Content-Length: 12345
```

**Nếu 404** → File không tồn tại trong GridFS.

### Bước 7: Kiểm tra Browser Console

1. Mở browser: `http://localhost:3000`
2. F12 → Console
3. Reload trang
4. Tìm lỗi:
   - `Failed to load resource` → URL không đúng
   - `404` → File không tìm thấy
   - `CORS error` → CORS chưa cấu hình

### Bước 8: Kiểm tra Network Tab

1. F12 → Network
2. Reload trang
3. Tìm request đến `/api/files/...`
4. Xem:
   - **Request URL**: Phải là `http://localhost:5000/api/files/...`
   - **Status**: Phải là `200 OK`
   - **Type**: Phải là `image/jpeg` hoặc `image/png`

---

## 🐛 Các lỗi thường gặp

### Lỗi 1: Image ID rỗng trong database

**Triệu chứng:** `image: ""` trong database

**Nguyên nhân:**
- Upload thất bại
- Multer không nhận được file
- GridFS upload error

**Cách sửa:**
1. Kiểm tra backend logs khi upload
2. Kiểm tra `req.file` có tồn tại không
3. Kiểm tra GridFS connection

**Debug:**
```bash
# Xem backend logs khi upload
# Phải thấy: "Image upload error: ..." nếu có lỗi
```

### Lỗi 2: Image ID có nhưng không lấy được

**Triệu chứng:** `image: "67abc123..."` nhưng không hiển thị

**Nguyên nhân:**
- File không tồn tại trong GridFS
- Image ID không hợp lệ
- Route `/api/files/:fileId` không hoạt động

**Cách sửa:**
```bash
# Kiểm tra file có trong GridFS không
docker exec -it mongodb-mongos mongosh recipe-share
db.fs.files.findOne({_id: ObjectId("67abc123...")})
```

**Nếu không tìm thấy** → File chưa được upload vào GridFS.

### Lỗi 3: URL vẫn là relative path

**Triệu chứng:** API vẫn trả về `/api/files/...` thay vì `http://localhost:5000/api/files/...`

**Nguyên nhân:**
- Backend chưa restart
- Code chưa được cập nhật

**Cách sửa:**
1. Restart backend: `Ctrl+C` rồi `npm run dev`
2. Kiểm tra file đã được sửa chưa

---

## 🧪 Script Test Tự Động

Chạy script test:

```bash
cd ~/cloud/recept_food/cloud-master/backend
node scripts/test-image-upload.js
```

Script sẽ:
1. ✅ Test MongoDB connection
2. ✅ Test GridFS bucket
3. ✅ List files trong GridFS
4. ✅ Show recipes với images và URLs
5. ✅ Test download file

---

## 📋 Quick Debug Checklist

```bash
# 1. Xem recipes có image không
docker exec -it mongodb-mongos mongosh recipe-share --eval "db.recipes.find({}, {title: 1, image: 1}).limit(3)"

# 2. Xem files trong GridFS
docker exec -it mongodb-mongos mongosh recipe-share --eval "db.fs.files.find().limit(3)"

# 3. Test API response (phải có full URL)
curl http://localhost:5000/api/recipes | jq '.[0].image'

# 4. Test lấy file (thay FILE_ID bằng ID thực tế)
curl -I http://localhost:5000/api/files/FILE_ID

# 5. Xem backend logs khi upload
# Trong terminal đang chạy backend
```

---

## ✅ Sau khi sửa

1. **Restart backend** (nếu chưa tự động)
2. **Test upload image mới** → Phải có full URL trong response
3. **Reload frontend** → Images phải hiển thị

---

## 🎯 Kết quả mong đợi

Sau khi sửa:
- ✅ Backend trả về: `http://localhost:5000/api/files/67abc123...`
- ✅ Browser load được image từ `localhost:5000`
- ✅ Images hiển thị đúng trên frontend

