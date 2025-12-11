import mongoose from 'mongoose';
import { MongoClient, GridFSBucket } from 'mongodb';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI;

async function testImageUpload() {
  try {
    console.log('🔍 Testing Image Upload and Retrieval...\n');

    // 1. Test MongoDB Connection
    console.log('1️⃣ Testing MongoDB Connection...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // 2. Test GridFS Bucket
    console.log('2️⃣ Testing GridFS Bucket...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db();
    const bucket = new GridFSBucket(db, { bucketName: 'files' });
    console.log('✅ GridFS bucket initialized\n');

    // 3. List existing files
    console.log('3️⃣ Checking existing files in GridFS...');
    const files = await bucket.find({}).toArray();
    console.log(`Found ${files.length} files in GridFS:`);
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.filename} (ID: ${file._id})`);
    });
    console.log('');

    // 4. Test file upload (if you have a test image)
    console.log('4️⃣ Testing file upload...');
    const testImagePath = path.join(__dirname, '../test-image.jpg');
    
    if (fs.existsSync(testImagePath)) {
      const fileBuffer = fs.readFileSync(testImagePath);
      const uploadStream = bucket.openUploadStream('test/test-image.jpg', {
        contentType: 'image/jpeg'
      });
      
      uploadStream.end(fileBuffer);
      
      await new Promise((resolve, reject) => {
        uploadStream.on('finish', () => {
          console.log(`✅ File uploaded! ID: ${uploadStream.id}`);
          console.log(`   URL: http://localhost:5000/api/files/${uploadStream.id}`);
          resolve();
        });
        uploadStream.on('error', reject);
      });
    } else {
      console.log('⚠️  No test image found. Skipping upload test.');
      console.log('   Create a test image at: backend/test-image.jpg');
    }
    console.log('');

    // 5. Test file download
    if (files.length > 0) {
      console.log('5️⃣ Testing file download...');
      const testFileId = files[0]._id;
      const downloadStream = bucket.openDownloadStream(testFileId);
      
      let chunks = [];
      downloadStream.on('data', (chunk) => chunks.push(chunk));
      downloadStream.on('end', () => {
        console.log(`✅ File downloaded! Size: ${chunks.length} bytes`);
      });
      downloadStream.on('error', (err) => {
        console.error('❌ Download error:', err.message);
      });
      
      await new Promise((resolve) => {
        downloadStream.on('end', resolve);
        downloadStream.on('error', resolve);
      });
    } else {
      console.log('⚠️  No files to test download');
    }
    console.log('');

    // 6. Check recipes with images
    console.log('6️⃣ Checking recipes with images...');
    const Recipe = (await import('../models/Recipe.js')).default;
    const recipes = await Recipe.find({ image: { $ne: '' } }).limit(5).lean();
    console.log(`Found ${recipes.length} recipes with images:`);
    recipes.forEach((recipe, index) => {
      console.log(`  ${index + 1}. ${recipe.title}`);
      console.log(`     Image ID: ${recipe.image}`);
      console.log(`     URL: http://localhost:5000/api/files/${recipe.image}`);
      console.log(`     Test: curl http://localhost:5000/api/files/${recipe.image}`);
    });
    console.log('');

    await client.close();
    await mongoose.connection.close();
    console.log('✅ Test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testImageUpload();

