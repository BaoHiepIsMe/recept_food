import express from 'express';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import Blog from '../models/Blog.js';
import BlogLike from '../models/BlogLike.js';
import Comment from '../models/Comment.js';
import CommentLike from '../models/CommentLike.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Recipe from '../models/Recipe.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { createNotification } from '../utils/notifications.js';
import { publishEvent } from '../utils/eventPublisher.js';
import blogCommentRoutes from './blogCommentRoutes.js';

const router = express.Router();

// Use memory storage for multer (better for GridFS)
const upload = multer({ storage: multer.memoryStorage() });

// Get all blogs (with likes)
router.get('/', async (req, res) => {
  try {
    // Try to get user from token if available
    let userId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      }
    } catch (err) {
      // Ignore auth errors
    }

    const blogs = await Blog.find()
      .sort({ createdAt: -1 })
      .populate('authorId', 'name email avatar')
      .populate('recipeId', 'title')
      .lean();

    const blogIds = blogs.map(b => b._id.toString());

    // Get blog likes
    let likesMap = {};
    let userLikesSet = new Set();
    
    if (blogIds.length > 0) {
      const likes = await BlogLike.find({ blogId: { $in: blogIds } }).lean();
      
      likes.forEach(like => {
        const blogId = like.blogId.toString();
        if (!likesMap[blogId]) {
          likesMap[blogId] = [];
        }
        likesMap[blogId].push(like.userId);
        if (userId && like.userId === userId) {
          userLikesSet.add(blogId);
        }
      });
    }

    const formattedBlogs = blogs.map(blog => ({
      _id: blog._id.toString(),
      title: blog.title,
      content: blog.content,
      image: blog.image || '',
      author: blog.authorId ? {
        id: blog.authorId._id?.toString() || blog.authorId.toString(),
        name: blog.authorId.name || 'Anonymous',
        avatar: blog.authorId.avatar || ''
      } : { id: '', name: 'Anonymous', avatar: '' },
      recipe: blog.recipeId ? {
        _id: blog.recipeId._id.toString(),
        title: blog.recipeId.title
      } : null,
      likes: likesMap[blog._id.toString()]?.length || 0,
      isLiked: userId ? userLikesSet.has(blog._id.toString()) : false,
      createdAt: blog.createdAt
    }));

    res.json(formattedBlogs);
  } catch (error) {
    console.error('Error in GET /blogs:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Get user's blogs
router.get('/my', authenticate, async (req, res) => {
  try {
    const blogs = await Blog.find({ authorId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('recipeId', 'title')
      .lean();

    const user = await User.findById(req.user.id).lean();
    const author = user ? {
      id: user._id?.toString() || user.toString(),
      name: user.name || 'Me',
      avatar: user.avatar || ''
    } : { id: req.user.id, name: req.user.name || 'Me', avatar: '' };

    const formattedBlogs = blogs.map(blog => ({
      _id: blog._id.toString(),
      title: blog.title,
      content: blog.content,
      image: blog.image || '',
      author: author,
      recipe: blog.recipeId ? {
        _id: blog.recipeId._id.toString(),
        title: blog.recipeId.title
      } : null,
      createdAt: blog.createdAt
    }));

    res.json(formattedBlogs);
  } catch (error) {
    console.error('Error in GET /blogs/my:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Create blog
router.post('/', authenticate, upload.single('image'), async (req, res) => {
  try {
    const { title, content, recipeId } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    let imageUrl = '';
    
    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file, 'blogs');
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(400).json({ message: 'Failed to upload image: ' + (error.message || 'Unknown error') });
      }
    }

    const blogData = {
      title: title.trim(),
      content: content.trim(),
      authorId: req.user.id,
      image: imageUrl,
      recipeId: recipeId || null
    };

    const blog = new Blog(blogData);
    await blog.save();

    // Get author and recipe info
    const user = await User.findById(req.user.id).lean();
    let recipeInfo = null;
    if (blog.recipeId) {
      const recipe = await Recipe.findById(blog.recipeId).lean();
      if (recipe) {
        recipeInfo = {
          _id: recipe._id.toString(),
          title: recipe.title
        };
      }
    }

    const formattedBlog = {
      _id: blog._id.toString(),
      title: blog.title,
      content: blog.content,
      image: imageUrl,
      author: user ? {
        id: user._id?.toString() || user.toString(),
        name: user.name || 'Anonymous',
        avatar: user.avatar || ''
      } : { id: req.user.id, name: req.user.name || 'Anonymous', avatar: '' },
      recipe: recipeInfo,
      createdAt: blog.createdAt
    };

    res.status(201).json(formattedBlog);
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(400).json({ message: error.message || 'Failed to create blog' });
  }
});

// Update blog
router.put('/:id', authenticate, upload.single('image'), async (req, res) => {
  try {
    const blogId = req.params.id;

    // Check if blog exists and user owns it
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    if (blog.authorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { title, content, recipeId } = req.body;
    if (title) blog.title = title.trim();
    if (content) blog.content = content.trim();
    if (recipeId !== undefined) blog.recipeId = recipeId || null;

    // Upload new image if provided
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (blog.image) {
          try {
            await deleteFromCloudinary(blog.image);
          } catch (err) {
            console.log('Could not delete old image:', err.message);
          }
        }
        
        blog.image = await uploadToCloudinary(req.file, 'blogs');
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(400).json({ message: 'Failed to upload image: ' + (error.message || 'Unknown error') });
      }
    }

    await blog.save();

    // Get author and recipe info
    const user = await User.findById(req.user.id).lean();
    let recipeInfo = null;
    if (blog.recipeId) {
      const recipe = await Recipe.findById(blog.recipeId).lean();
      if (recipe) {
        recipeInfo = {
          _id: recipe._id.toString(),
          title: recipe.title
        };
      }
    }

    const formattedBlog = {
      _id: blog._id.toString(),
      title: blog.title,
      content: blog.content,
      image: blog.image || '',
      author: user ? {
        id: user._id?.toString() || user.toString(),
        name: user.name || 'Anonymous',
        avatar: user.avatar || ''
      } : { id: req.user.id, name: req.user.name || 'Anonymous', avatar: '' },
      recipe: recipeInfo,
      createdAt: blog.createdAt
    };

    res.json(formattedBlog);
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(400).json({ message: error.message || 'Failed to update blog' });
  }
});

// Delete blog
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const blogId = req.params.id;

    // Check if blog exists and user owns it
    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    // Only the author can delete their blog
    if (blog.authorId.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not authorized. Only the blog author can delete this blog.' });
    }

    // Delete image from Cloudinary if exists
    if (blog.image) {
      try {
        await deleteFromCloudinary(blog.image);
      } catch (err) {
        console.log('Could not delete image:', err.message);
      }
    }

    // Find all comments for this blog
    const comments = await Comment.find({ blogId }).select('_id').lean();
    const commentIds = comments.map(c => c._id);

    // Delete blog likes
    await BlogLike.deleteMany({ blogId });

    // Delete comment likes (for all comments of this blog)
    if (commentIds.length > 0) {
      await CommentLike.deleteMany({ commentId: { $in: commentIds } });
    }

    // Delete comments
    await Comment.deleteMany({ blogId });

    // Delete notifications related to this blog
    await Notification.deleteMany({ 
      targetType: 'blog',
      targetId: blogId 
    });

    // Delete the blog
    await Blog.findByIdAndDelete(blogId);

    console.log(`✅ Blog ${blogId} deleted by user ${req.user.id}`);
    res.json({ message: 'Blog deleted successfully' });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({ message: error.message || 'Failed to delete blog' });
  }
});

// Like/Unlike blog
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const blogId = req.params.id;
    const userId = req.user.id;

    // Check if like already exists
    const existing = await BlogLike.findOne({ blogId, userId });

    if (existing) {
      // Unlike
      await BlogLike.findByIdAndDelete(existing._id);
      res.json({ message: 'Blog unliked', isLiked: false });
    } else {
      // Like
      const blogLike = new BlogLike({ blogId, userId });
      await blogLike.save();

      // Create notification for blog owner
      const blog = await Blog.findById(blogId).lean();
      if (blog && blog.authorId && blog.authorId !== userId) {
        await createNotification(blog.authorId, userId, 'blog_like', 'blog', blogId);
      }

      res.json({ message: 'Blog liked', isLiked: true });
    }
  } catch (error) {
    console.error('Error in POST /blogs/:id/like:', error);
    res.status(500).json({ message: error.message || 'Failed to like/unlike blog' });
  }
});

// Mount comment routes BEFORE /:id route to avoid conflicts
router.use('/:id/comments', blogCommentRoutes);

export default router;
