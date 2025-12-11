import { getGridFSBucket } from '../config/mongodb.js';
import { Readable } from 'stream';
import mongoose from 'mongoose';

/**
 * Upload file to GridFS
 * @param {Object} file - Multer file object
 * @param {string} folder - Folder name (e.g., 'avatars', 'recipes', 'blogs')
 * @returns {Promise<string>} - File ID (ObjectId as string)
 */
export const uploadToGridFS = async (file, folder = 'uploads') => {
  try {
    const bucket = await getGridFSBucket();
    const filename = `${folder}/${Date.now()}-${file.originalname}`;
    
    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          folder: folder
        }
      });
      
      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);
      
      readable.pipe(uploadStream);
      
      uploadStream.on('error', (error) => {
        console.error('GridFS upload error:', error);
        reject(error);
      });
      
      uploadStream.on('finish', () => {
        // Return file ID as string
        resolve(uploadStream.id.toString());
      });
    });
  } catch (error) {
    console.error('GridFS upload failed:', error);
    throw new Error(`GridFS upload failed: ${error.message}`);
  }
};

/**
 * Get file stream from GridFS
 * @param {string} fileId - File ID (ObjectId as string)
 * @returns {Promise<ReadableStream>} - File download stream
 */
export const getFileFromGridFS = async (fileId) => {
  try {
    const bucket = await getGridFSBucket();
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new Error('Invalid file ID format');
    }
    
    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    return downloadStream;
  } catch (error) {
    console.error('GridFS download failed:', error);
    throw new Error(`GridFS download failed: ${error.message}`);
  }
};

/**
 * Delete file from GridFS
 * @param {string} fileId - File ID (ObjectId as string)
 */
export const deleteFileFromGridFS = async (fileId) => {
  try {
    const bucket = await getGridFSBucket();
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new Error('Invalid file ID format');
    }
    
    await bucket.delete(new mongoose.Types.ObjectId(fileId));
  } catch (error) {
    console.error('GridFS delete failed:', error);
    throw new Error(`GridFS delete failed: ${error.message}`);
  }
};

/**
 * Get file metadata from GridFS
 * @param {string} fileId - File ID (ObjectId as string)
 * @returns {Promise<Object>} - File metadata
 */
export const getFileMetadata = async (fileId) => {
  try {
    const bucket = await getGridFSBucket();
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new Error('Invalid file ID format');
    }
    
    const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
    
    if (files.length === 0) {
      throw new Error('File not found');
    }
    
    return files[0];
  } catch (error) {
    console.error('GridFS metadata fetch failed:', error);
    throw new Error(`GridFS metadata fetch failed: ${error.message}`);
  }
};
