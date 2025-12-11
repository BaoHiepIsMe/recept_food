import mongoose from 'mongoose';
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
      // Fix read preference for single-member replica sets (config-rs)
      readPreference: 'primary',
      // Set read preference mode for all operations
      readPreferenceSecondary: false,
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

// Close connections gracefully
export const closeConnections = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.close();
  }
};

export default connectDB;
