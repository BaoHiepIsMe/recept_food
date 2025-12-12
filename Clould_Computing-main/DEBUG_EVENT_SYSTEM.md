# Hướng Dẫn Kiểm Tra Event-Driven System

## 🧪 Các Bước Kiểm Tra:

### 1. Mở Browser Console (F12)

### 2. Thử Thêm Recipe Mới:
- Vào trang "My Recipes"
- Click "Add Recipe"
- Nhập thông tin và Submit
- **Kiểm tra console phải thấy:**
  ```
  🔄 CRUD operation detected: {method: "POST", url: "/recipes", status: 200}
  📢 dataChanged event dispatched
  Data changed, refreshing my recipes: {method: "POST", url: "/recipes", timestamp: ...}
  ```

### 3. Thử Sửa Recipe:
- Click "Edit" một recipe
- Sửa thông tin và Submit
- **Kiểm tra console phải thấy:**
  ```
  🔄 CRUD operation detected: {method: "PUT", url: "/recipes/...", status: 200}
  📢 dataChanged event dispatched
  Data changed, refreshing my recipes: {method: "PUT", url: "/recipes/...", timestamp: ...}
  ```

### 4. Thử Xóa Recipe:
- Click "Delete" một recipe
- **Kiểm tra console phải thấy:**
  ```
  🔄 CRUD operation detected: {method: "DELETE", url: "/recipes/...", status: 200}
  📢 dataChanged event dispatched
  Data changed, refreshing my recipes: {method: "DELETE", url: "/recipes/...", timestamp: ...}
  ```

### 5. Kiểm Tra UI Refresh:
- ✅ Sau khi thêm/sửa/xóa, danh sách recipe phải tự động update
- ✅ Không cần F5 hay click lại
- ✅ Nếu bạn đang ở trang Home, nó cũng phải refresh

## 🐛 Nếu Không Hoạt Động:

### A. Event không dispatch:
- Check console có log `🔄 CRUD operation detected` không?
- Nếu không có → Backend không trả về response thành công
- Nếu có nhưng không có `📢 dataChanged event dispatched` → Có lỗi trong api.js

### B. Event dispatch nhưng UI không refresh:
- Check console có log `Data changed, refreshing...` không?
- Nếu không có → Event listener chưa được đăng ký
- Nếu có nhưng UI không đổi → Fetch function có lỗi

### C. Backend response error:
- Check Network tab trong DevTools
- Xem API call có status 200 không?
- Check response có data đúng không?

## 📝 Checklist:

- [ ] Mở F12 Console
- [ ] Thêm recipe mới → Thấy logs + UI update
- [ ] Sửa recipe → Thấy logs + UI update
- [ ] Xóa recipe → Thấy logs + UI update
- [ ] Thêm blog → Thấy logs + UI update
- [ ] Thêm comment → Thấy logs + UI update
- [ ] Like recipe/blog → Thấy logs + UI update
- [ ] Add to favorites → Thấy logs + UI update

## 🔍 Debug Tips:

### Kiểm tra Event Listener:
```javascript
// Paste vào console:
window.addEventListener('dataChanged', (e) => {
  console.log('✅ Event received:', e.detail);
});
```

### Kiểm tra Manual Dispatch:
```javascript
// Paste vào console:
window.dispatchEvent(new CustomEvent('dataChanged', { 
  detail: { method: 'TEST', url: '/test', timestamp: Date.now() } 
}));
```

Nếu thấy log `✅ Event received` → Event system hoạt động!
