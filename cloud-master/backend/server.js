import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/mongodb.js';
import { testCloudinaryConnection } from './config/cloudinary.js';
import recipeRoutes from './routes/recipeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import './utils/eventPublisher.js'; // Initialize Redis connection

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const SERVER_ID = process.env.SERVER_ID || 'BE1-MongoDB';

app.use((req, res, next) => {
  console.log(`[${SERVER_ID}] ${req.method} ${req.url}`);
  next();
});

// Add Server ID to all responses
app.use((req, res, next) => {
  res.setHeader('X-Server-ID', SERVER_ID);
  next();
});

// Connect to MongoDB
connectDB();

// Test Cloudinary connection
testCloudinaryConnection().catch(err => {
  console.error('⚠️  Cloudinary connection test error:', err.message);
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const isConnected = mongoose.default.connection.readyState === 1;
    
    // Test Cloudinary connection
    let cloudinaryStatus = 'unknown';
    try {
      const { testCloudinaryConnection } = await import('./config/cloudinary.js');
      cloudinaryStatus = await testCloudinaryConnection() ? 'connected' : 'disconnected';
    } catch (err) {
      cloudinaryStatus = 'error';
    }
    
    res.json({ 
      status: 'ok', 
      server: SERVER_ID, 
      database: isConnected ? 'connected' : 'disconnected',
      cloudinary: cloudinaryStatus
    });
  } catch (error) {
    res.json({ status: 'ok', server: SERVER_ID, database: 'error', error: error.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/notifications', notificationRoutes);

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
  console.log(`📦 Using MongoDB (Sharded Cluster)`);
  console.log(`☁️  Using Cloudinary for image storage`);
});
