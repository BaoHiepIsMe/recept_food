# Sử dụng Node.js image
FROM node:18-alpine

# Tạo thư mục làm việc
WORKDIR /app

# Copy package và cài dependencies
COPY package*.json ./
RUN npm install

# Copy toàn bộ mã nguồn
COPY . .

# Expose port của backend (ví dụ 5000)
EXPOSE 5000

# Chạy server
CMD ["npm", "start"]
