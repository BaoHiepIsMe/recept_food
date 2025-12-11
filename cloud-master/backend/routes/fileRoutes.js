import express from 'express';
import { getFileFromGridFS } from '../utils/gridfs.js';
import mongoose from 'mongoose';

const router = express.Router();

// Serve files from GridFS
router.get('/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({ message: 'Invalid file ID' });
    }

    const downloadStream = await getFileFromGridFS(fileId);
    
    downloadStream.on('error', (error) => {
      if (error.code === 'ENOENT' || error.message.includes('FileNotFound')) {
        return res.status(404).json({ message: 'File not found' });
      }
      console.error('GridFS stream error:', error);
      res.status(500).json({ message: error.message });
    });

    // Set content type from GridFS metadata
    downloadStream.on('file', (file) => {
      if (file.contentType) {
        res.set('Content-Type', file.contentType);
      }
      // Set cache headers
      res.set('Cache-Control', 'public, max-age=31536000');
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('File serve error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
