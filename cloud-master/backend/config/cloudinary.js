import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Validate configuration
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.error('❌ Missing Cloudinary environment variables!');
  console.error('Please create a .env file with:');
  console.error('CLOUDINARY_CLOUD_NAME=your-cloud-name');
  console.error('CLOUDINARY_API_KEY=your-api-key');
  console.error('CLOUDINARY_API_SECRET=your-api-secret');
  throw new Error('Missing Cloudinary environment variables. Please check your .env file.');
}

// Configure Cloudinary
cloudinary.config(cloudinaryConfig);

console.log('✅ Cloudinary configured');
console.log(`   Cloud Name: ${cloudinaryConfig.cloud_name}`);
console.log(`   API Key: ${cloudinaryConfig.api_key.substring(0, 8)}...`);

// Test Cloudinary connection
export const testCloudinaryConnection = async () => {
  try {
    // Test connection by getting account details
    const result = await cloudinary.api.ping();
    console.log('✅ Cloudinary connection test successful');
    console.log(`   Status: ${result.status}`);
    return true;
  } catch (error) {
    console.error('❌ Cloudinary connection test failed:', error.message);
    console.error('💡 Please check your CLOUDINARY credentials in .env file');
    return false;
  }
};

export default cloudinary;

