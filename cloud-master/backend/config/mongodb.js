import mongoose from 'mongoose';
import { MongoClient, GridFSBucket } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ Missing MONGODB_URI in .env file');
  throw new Error('Missing MONGODB_URI environment variable. Please check your .env file.');
}

// MongoDB connection with sharding support
// Supports both MongoDB Atlas and MongoDB Community Edition (sharded cluster)
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // For sharded clusters, these options help with connection stability
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    // Detect if connected to sharded cluster
    const isSharded = mongoose.connection.db?.admin().command({ isMaster: 1 }).then(result => result.msg === 'isdbgrid').catch(() => false);
    
    if (MONGODB_URI.includes('mongodb.net')) {
      console.log('✅ Connected to MongoDB Atlas');
    } else {
      console.log('✅ Connected to MongoDB (Community Edition)');
    }
    
    // Log connection info
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    console.log(`📦 Database: ${dbName}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    console.error('💡 Check your MONGODB_URI in .env file');
    process.exit(1);
  }
};

// GridFS setup for file storage
let gridFSBucket = null;
let mongoClient = null;

export const getGridFSBucket = async () => {
  if (!gridFSBucket) {
    try {
      mongoClient = new MongoClient(MONGODB_URI);
      await mongoClient.connect();
      const db = mongoClient.db();
      gridFSBucket = new GridFSBucket(db, { bucketName: 'files' });
      console.log('✅ GridFS bucket initialized');
    } catch (error) {
      console.error('❌ GridFS initialization error:', error);
      throw error;
    }
  }
  return gridFSBucket;
};

// Close connections gracefully
export const closeConnections = async () => {
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
};

export default connectDB;
