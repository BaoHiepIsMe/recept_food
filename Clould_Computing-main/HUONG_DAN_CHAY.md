# Hướng Dẫn Chạy Frontend

## Bước 1: Mở Terminal/PowerShell

Mở Terminal hoặc PowerShell và di chuyển đến thư mục frontend:
```bash
cd E:\Download\cloud\Clould_Computing-main
```

## Bước 2: Cài đặt Dependencies

Chạy lệnh sau để cài đặt tất cả các package cần thiết:
```bash
npm install
```

**Lưu ý:** Nếu gặp lỗi về Execution Policy trên PowerShell, chạy lệnh này trước:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

Hoặc mở PowerShell với quyền Administrator và chạy:
```powershell
Set-ExecutionPolicy RemoteSigned
```

## Bước 3: Tạo file .env (Tùy chọn)

Nếu backend chạy ở port khác hoặc URL khác, tạo file `.env` trong thư mục `Clould_Computing-main`:

**Windows (PowerShell):**
```powershell
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env
```

**Hoặc tạo thủ công:**
- Tạo file mới tên `.env` trong thư mục `Clould_Computing-main`
- Thêm dòng: `REACT_APP_API_URL=http://localhost:5000/api`

## Bước 4: Chạy Frontend

Sau khi cài đặt xong, chạy lệnh:
```bash
npm start
```

Frontend sẽ tự động mở trình duyệt tại `http://localhost:3000`

## Bước 5: Chạy Backend (Nếu chưa chạy)

Mở một terminal/PowerShell khác và chạy backend:

```bash
# Di chuyển đến thư mục backend
cd E:\Download\cloud\cloud-master\backend

# Cài đặt dependencies (nếu chưa cài)
npm install

# Tạo file .env với nội dung:
# MONGO_URI=your_mongodb_connection_string
# PORT=5000
# JWT_SECRET=your-secret-key

# Chạy backend
npm start
```

## Troubleshooting

### Lỗi: "npm is not recognized"
- Đảm bảo đã cài đặt Node.js: https://nodejs.org/
- Khởi động lại terminal sau khi cài Node.js

### Lỗi: "Cannot find module 'react-router-dom'"
- Chạy lại: `npm install`

### Lỗi: "Port 3000 is already in use"
- Đóng ứng dụng đang dùng port 3000
- Hoặc set biến môi trường: `set PORT=3001` (Windows) rồi chạy `npm start`

### Frontend không kết nối được với Backend
- Kiểm tra backend đã chạy chưa (http://localhost:5000/api/health)
- Kiểm tra file `.env` có đúng URL không
- Kiểm tra CORS trên backend đã bật chưa

## Các lệnh hữu ích

```bash
# Xem danh sách scripts có sẵn
npm run

# Build cho production
npm run build

# Chạy tests
npm test
```

