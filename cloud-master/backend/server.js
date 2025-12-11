import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/mongodb.js';
import recipeRoutes from './routes/recipeRoutes.js';
import authRoutes from './routes/authRoutes.js';
import blogRoutes from './routes/blogRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import fileRoutes from './routes/fileRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const SERVER_ID = process.env.SERVER_ID || 'BE1-MongoDB';

app.use((req, res, next) => {
  console.log(`[${SERVER_ID}] ${req.method} ${req.url}`);
  next();
});

// Connect to MongoDB
connectDB();

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const mongoose = await import('mongoose');
    const isConnected = mongoose.default.connection.readyState === 1;
    res.json({ 
      status: 'ok', 
      server: SERVER_ID, 
      database: isConnected ? 'connected' : 'disconnected' 
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
app.use('/api/files', fileRoutes);

app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
  console.log(`📦 Using MongoDB Atlas (Sharded Cluster)`);
});
