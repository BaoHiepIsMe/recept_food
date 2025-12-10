# Build phase
FROM node:18-alpine as build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Serve phase
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html

# Expose port frontend
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
