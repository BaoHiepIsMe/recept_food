/**
 * Get full URL for image file
 * @param {string} fileId - GridFS file ID
 * @returns {string} - Full URL to access the file
 */
export const getImageUrl = (fileId) => {
  if (!fileId) return '';
  
  // If already a full URL, return as is
  if (fileId.startsWith('http://') || fileId.startsWith('https://')) {
    return fileId;
  }
  
  // Get base URL from environment or use default
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
  
  // Return full URL
  return `${baseUrl}/api/files/${fileId}`;
};

