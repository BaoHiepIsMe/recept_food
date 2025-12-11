import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth.js';
import User from '../models/User.js';
import multer from 'multer';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

const router = express.Router();

// Use memory storage for multer (better for GridFS)
const upload = multer({ storage: multer.memoryStorage() });

// Register
router.post('/register', upload.single('avatar'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user exists
    const existingUser = await User.findById(email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upload avatar to Cloudinary if provided
    let avatarUrl = '';
    if (req.file) {
      try {
        avatarUrl = await uploadToCloudinary(req.file, 'avatars');
      } catch (error) {
        console.error('Avatar upload error:', error);
        return res.status(400).json({ message: 'Failed to upload avatar: ' + error.message });
      }
    }

    // Create user (use email as _id for sharding)
    const user = new User({
      _id: email,
      name,
      email,
      password: hashedPassword,
      avatar: avatarUrl
    });

    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: avatarUrl
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: error.message || 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await User.findById(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || '',
        bio: user.bio
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: error.message || 'Login failed' });
  }
});

// Get profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get counts
    const Recipe = (await import('../models/Recipe.js')).default;
    const Favorite = (await import('../models/Favorite.js')).default;
    const Blog = (await import('../models/Blog.js')).default;

    const recipeCount = await Recipe.countDocuments({ authorId: user._id });
    const favoriteCount = await Favorite.countDocuments({ userId: user._id });
    const blogCount = await Blog.countDocuments({ authorId: user._id });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || '',
      bio: user.bio,
      recipeCount,
      favoriteCount,
      blogCount
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update profile
router.put('/profile', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    const { name, bio } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;

    if (req.file) {
      try {
        // Delete old avatar from Cloudinary if exists
        if (user.avatar) {
          try {
            await deleteFromCloudinary(user.avatar);
          } catch (err) {
            // Ignore delete errors
            console.log('Could not delete old avatar:', err.message);
          }
        }
        
        user.avatar = await uploadToCloudinary(req.file, 'avatars');
      } catch (error) {
        console.error('Avatar upload error:', error);
        return res.status(400).json({ message: 'Failed to upload avatar: ' + error.message });
      }
    }

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar || '',
      bio: user.bio
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
