# Hệ Thống Event-Driven UI Update

## 🎯 Mục Đích
Thay vì polling liên tục (refresh mỗi 3 giây), UI chỉ refresh khi có thay đổi dữ liệu thực sự từ backend (CRUD operations).

## 🏗️ Kiến Trúc

### 1. **Backend Servers (EC2 Instances)**
- **A, B, C**: Backend phân tán + Database sharding
- **D**: Backend tổng + Database tổng  
- **E**: Frontend server

### 2. **Server Badge (A/B/C/D/E)**
- Hiển thị server đang xử lý request
- Tự động kiểm tra health mỗi 5 giây
- Chỉ component badge re-render, không ảnh hưởng UI
- Click badge để kiểm tra ngay lập tức

**Màu sắc:**
- 🔵 A: Blue (#3B82F6)
- 🟢 B: Green (#10B981)
- 🟠 C: Orange (#F59E0B)
- 🟣 D: Purple (#8B5CF6) - Main Backend
- 🩷 E: Pink (#EC4899) - Frontend

### 3. **Event-Driven System**

#### API Interceptor (`api.js`)
```javascript
// Khi có CRUD operation (POST/PUT/PATCH/DELETE)
window.dispatchEvent(new CustomEvent('dataChanged', { 
  detail: { method, url, timestamp } 
}));
```

#### Components Listen to Event
```javascript
useEffect(() => {
  const handleDataChange = (event) => {
    fetchData(); // Chỉ refresh khi có thay đổi
  };
  
  window.addEventListener('dataChanged', handleDataChange);
  
  return () => {
    window.removeEventListener('dataChanged', handleDataChange);
  };
}, []);
```

## 📝 Các Thay Đổi

### ✅ Files Đã Sửa:

1. **`src/components/ServerBadge.js`** (Mới)
   - Component riêng cho badge A/B/C/D/E
   - Health check mỗi 5 giây
   - Không làm re-render UI khác

2. **`src/components/Layout.js`** (Khôi phục)
   - Sử dụng `<ServerBadge />` component
   - Loại bỏ logic health check

3. **`src/api.js`**
   - Thêm event dispatcher cho CRUD operations
   - Track server ID từ response headers

4. **`src/pages/Home.js`**
   - ❌ Loại bỏ: `setInterval` polling mỗi 3 giây
   - ✅ Thêm: Event listener `dataChanged`

5. **`src/pages/MyRecipes.js`**
   - ❌ Loại bỏ: `setInterval` polling
   - ✅ Thêm: Event listener `dataChanged`

6. **`src/pages/Favorites.js`**
   - ✅ Thêm: Event listener `dataChanged`

7. **`src/pages/Blog.js`**
   - ❌ Loại bỏ: `setInterval` polling mỗi 3 giây
   - ✅ Thêm: Event listener `dataChanged`

8. **`src/pages/RecipeDetail.js`**
   - ❌ Loại bỏ: `setInterval` polling mỗi 3 giây
   - ✅ Thêm: Event listener `dataChanged`

## 🚀 Lợi Ích

### 1. **Hiệu Suất Tốt Hơn**
- ❌ Trước: API call mỗi 3 giây (liên tục)
- ✅ Sau: API call chỉ khi có CRUD operation

### 2. **UX Tốt Hơn**
- ❌ Trước: UI flash/reload liên tục mỗi 3 giây
- ✅ Sau: UI chỉ update khi có thay đổi thực sự

### 3. **Badge Server Độc Lập**
- ❌ Trước: Health check làm reload toàn bộ Layout
- ✅ Sau: Chỉ badge A/B/C/D/E thay đổi màu

### 4. **Giảm Load Backend**
- ❌ Trước: 20+ requests/minute (polling từ mỗi page)
- ✅ Sau: Chỉ request khi cần thiết

## 🔄 Flow Hoạt Động

```
User Action (Create/Update/Delete)
    ↓
API Request (POST/PUT/PATCH/DELETE)
    ↓
Backend Response
    ↓
API Interceptor detects CRUD
    ↓
Dispatch 'dataChanged' event
    ↓
All pages listening → Refresh data
    ↓
UI updates with new data
```

## 🛠️ Backend Requirements

Backend cần trả về header `x-server-id` trong response:

```javascript
// Backend (Express.js example)
app.use((req, res, next) => {
  res.setHeader('x-server-id', 'BE1-EC2-A-Shard-A'); // hoặc B, C, D
  next();
});
```

## 📊 So Sánh

| Tính Năng | Trước (Polling) | Sau (Event-Driven) |
|-----------|----------------|-------------------|
| API Calls | ~20/minute | Chỉ khi CRUD |
| UI Flashing | Có (mỗi 3s) | Không |
| Performance | Thấp | Cao |
| Server Load | Cao | Thấp |
| User Experience | Kém | Tốt |
| Badge Update | Reload UI | Chỉ badge |

## ✅ Kết Luận

Hệ thống mới:
- ✅ Badge A/B/C/D/E thay đổi độc lập (không reload UI)
- ✅ UI chỉ refresh khi có CRUD từ backend
- ✅ Không có polling liên tục
- ✅ Hiệu suất cao hơn
- ✅ UX mượt mà hơn
- ✅ 100% chỉ thay đổi Frontend
