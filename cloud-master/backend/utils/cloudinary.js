import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';

/**
 * Upload file to Cloudinary
 * @param {Object} file - Multer file object
 * @param {string} folder - Folder name in Cloudinary (e.g., 'avatars', 'recipes', 'blogs')
 * @returns {Promise<string>} - Cloudinary URL
 */
export const uploadToCloudinary = async (file, folder = 'uploads') => {
  try {
    return new Promise((resolve, reject) => {
      // Convert buffer to stream
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `recipe-share/${folder}`,
          resource_type: 'auto', // Auto-detect image, video, etc.
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            // Return secure URL
            resolve(result.secure_url);
          }
        }
      );

      // Pipe file buffer to Cloudinary
      const readable = new Readable();
      readable.push(file.buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  } catch (error) {
    console.error('Cloudinary upload failed:', error);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} url - Cloudinary URL
 * @returns {Promise<void>}
 */
export const deleteFromCloudinary = async (url) => {
  try {
    // Extract public_id from URL
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1) {
      throw new Error('Invalid Cloudinary URL');
    }

    // Get public_id (everything after /upload/)
    const publicIdParts = urlParts.slice(uploadIndex + 2); // Skip 'upload' and version
    let publicId = publicIdParts.join('/');
    
    // Remove file extension
    publicId = publicId.replace(/\.[^/.]+$/, '');

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'not found') {
      console.warn(`File not found in Cloudinary: ${publicId}`);
    } else if (result.result === 'ok') {
      console.log(`File deleted from Cloudinary: ${publicId}`);
    }
  } catch (error) {
    console.error('Cloudinary delete failed:', error);
    // Don't throw - deletion failures are not critical
  }
};

/**
 * Get optimized image URL from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @param {Object} options - Transformation options
 * @returns {string} - Optimized URL
 */
export const getOptimizedImageUrl = (url, options = {}) => {
  if (!url || !url.includes('cloudinary.com')) {
    return url; // Return as is if not a Cloudinary URL
  }

  // If URL already has transformations, return as is
  if (url.includes('/image/upload/')) {
    return url;
  }

  // Add transformations
  const transformations = [];
  
  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  
  if (transformations.length === 0) {
    transformations.push('q_auto', 'f_auto');
  }

  // Insert transformations into URL
  const insertIndex = url.indexOf('/image/upload/') + '/image/upload/'.length;
  return url.slice(0, insertIndex) + transformations.join(',') + '/' + url.slice(insertIndex);
};

