// ============================================
// EC2 D - Server Tổng (PubSub Central)
// ============================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());

const server = createServer(app);

// Socket.IO server cho WebSocket
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,    // 60 seconds
  pingInterval: 25000,   // 25 seconds
  transports: ['websocket', 'polling']
});

// Redis PubSub
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

const subscriber = redis.duplicate();

// Subscribe to all data change events
const CHANNELS = [
  'recipe:created',
  'recipe:updated', 
  'recipe:deleted',
  'blog:created',
  'blog:updated',
  'blog:deleted',
  'comment:created',
  'comment:deleted',
  'favorite:added',
  'favorite:removed',
  'notification:created'
];

CHANNELS.forEach(channel => {
  subscriber.subscribe(channel, (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to ${channel}:`, err);
    } else {
      console.log(`✅ Subscribed to ${channel}`);
    }
  });
});

// Listen for Redis messages and broadcast to all clients
subscriber.on('message', (channel, message) => {
  try {
    const data = JSON.parse(message);
    console.log(`📢 Broadcasting ${channel}:`, data);
    
    // Broadcast to ALL connected frontend clients
    io.emit('dataChanged', {
      channel,
      data,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error('Error broadcasting message:', err);
  }
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} (Total: ${io.engine.clientsCount})`);
  
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id} (Reason: ${reason})`);
  });
  
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    role: 'pubsub-server',
    connectedClients: io.engine.clientsCount
  });
});

const PORT = process.env.PUBSUB_PORT || process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 PubSub Server running on port ${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
});
