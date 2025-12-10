import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Helper function to upload file to Supabase Storage
const uploadToSupabase = async (file, folder = 'blogs', userToken = null) => {
  try {
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const fileBuffer = fs.readFileSync(file.path);
    
    // Use authenticated client if token provided
    let client = supabase;
    if (userToken) {
      const { getAuthClient } = await import('../config/supabase.js');
      client = getAuthClient(userToken);
    }
    
    const { data, error } = await client.storage
      .from('recipe-share')
      .upload(filePath, fileBuffer, {
        contentType: file.mimetype,
        upsert: false
      });

    // Delete local file
    fs.unlinkSync(file.path);

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('recipe-share')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    // Clean up local file if upload fails
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
};

// Get all blogs (with likes)
router.get('/', async (req, res) => {
  try {
    // Try to get user from token if available
    let userId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
      }
    } catch (err) {
      // Ignore auth errors
    }

    const { data: blogs, error } = await supabase
      .from('blogs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blogs:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch blogs' });
    }

    // Get blog likes
    const blogIds = (blogs || []).map(b => b.id);
    let likesMap = {};
    let userLikesSet = new Set();
    
    if (blogIds.length > 0) {
      const { data: likes } = await supabase
        .from('blog_likes')
        .select('blog_id, user_id')
        .in('blog_id', blogIds);
      
      if (likes) {
        likes.forEach(like => {
          if (!likesMap[like.blog_id]) {
            likesMap[like.blog_id] = [];
          }
          likesMap[like.blog_id].push(like.user_id);
          if (userId && like.user_id === userId) {
            userLikesSet.add(like.blog_id);
          }
        });
      }
    }

    // Get author profiles and recipes separately
    const authorIds = [...new Set((blogs || []).map(b => b.author_id))];
    const recipeIds = [...new Set((blogs || []).filter(b => b.recipe_id).map(b => b.recipe_id))];
    
    let authorMap = {};
    let recipeMap = {};
    
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .in('id', authorIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          authorMap[profile.id] = {
            name: profile.name,
            avatar: profile.avatar || ''
          };
        });
      }
    }

    if (recipeIds.length > 0) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, title')
        .in('id', recipeIds);
      
      if (recipes) {
        recipes.forEach(recipe => {
          recipeMap[recipe.id] = {
            _id: recipe.id,
            title: recipe.title
          };
        });
      }
    }

    const formattedBlogs = (blogs || []).map(blog => ({
      _id: blog.id,
      title: blog.title,
      content: blog.content,
      image: blog.image || '',
      author: authorMap[blog.author_id] || { name: 'Anonymous', avatar: '' },
      recipe: blog.recipe_id ? (recipeMap[blog.recipe_id] || null) : null,
      likes: likesMap[blog.id]?.length || 0,
      isLiked: userId ? userLikesSet.has(blog.id) : false,
      createdAt: blog.created_at
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
    const { data: blogs, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('author_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my blogs:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch blogs' });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar')
      .eq('id', req.user.id)
      .single();

    const author = profile ? {
      name: profile.name,
      avatar: profile.avatar || ''
    } : { name: req.user.name || 'Me', avatar: '' };

    // Get recipes if needed
    const recipeIds = [...new Set((blogs || []).filter(b => b.recipe_id).map(b => b.recipe_id))];
    let recipeMap = {};
    
    if (recipeIds.length > 0) {
      const { data: recipes } = await supabase
        .from('recipes')
        .select('id, title')
        .in('id', recipeIds);
      
      if (recipes) {
        recipes.forEach(recipe => {
          recipeMap[recipe.id] = {
            _id: recipe.id,
            title: recipe.title
          };
        });
      }
    }

    const formattedBlogs = (blogs || []).map(blog => ({
      _id: blog.id,
      title: blog.title,
      content: blog.content,
      image: blog.image || '',
      author: author,
      recipe: blog.recipe_id ? (recipeMap[blog.recipe_id] || null) : null,
      createdAt: blog.created_at
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
    const blogData = {
      title,
      content,
      author_id: req.user.id,
      image: '',
      recipe_id: recipeId || null
    };
    
    // Upload image to Supabase Storage if provided
    if (req.file) {
      try {
        // Get user token from request
        const token = req.headers.authorization?.split(' ')[1];
        blogData.image = await uploadToSupabase(req.file, 'blogs', token);
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(400).json({ message: 'Failed to upload image: ' + (error.message || 'Unknown error') });
      }
    }
    
    // Use authenticated client for insert (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;
    
    const { data: blog, error } = await authClient
      .from('blogs')
      .insert(blogData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating blog:', error);
      return res.status(400).json({ message: error.message || 'Failed to create blog' });
    }

    // Get author and recipe info
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar')
      .eq('id', req.user.id)
      .single();

    let recipeInfo = null;
    if (blog.recipe_id) {
      const { data: recipe } = await supabase
        .from('recipes')
        .select('id, title')
        .eq('id', blog.recipe_id)
        .single();
      
      if (recipe) {
        recipeInfo = {
          _id: recipe.id,
          title: recipe.title
        };
      }
    }

    const formattedBlog = {
      _id: blog.id,
      title: blog.title,
      content: blog.content,
      image: blog.image || '',
      author: profile ? {
        name: profile.name,
        avatar: profile.avatar || ''
      } : { name: req.user.name || 'Anonymous', avatar: '' },
      recipe: recipeInfo,
      createdAt: blog.created_at
    };

    res.status(201).json(formattedBlog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update blog
router.put('/:id', authenticate, upload.single('image'), async (req, res) => {
  try {
    const blogId = req.params.id;

    // Check if blog exists and user owns it
    const { data: existingBlog, error: checkError } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', blogId)
      .single();

    if (checkError || !existingBlog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    if (existingBlog.author_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { title, content, recipeId } = req.body;
    const updateData = {
      title,
      content,
      recipe_id: recipeId || null
    };

    // Upload new image if provided
    if (req.file) {
      try {
        // Get user token from request
        const token = req.headers.authorization?.split(' ')[1];
        updateData.image = await uploadToSupabase(req.file, 'blogs', token);
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(400).json({ message: 'Failed to upload image: ' + (error.message || 'Unknown error') });
      }
    }

    // Use authenticated client for update (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;
    
    const { data: blog, error } = await authClient
      .from('blogs')
      .update(updateData)
      .eq('id', blogId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating blog:', error);
      return res.status(400).json({ message: error.message || 'Failed to update blog' });
    }

    // Get author and recipe info
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, avatar')
      .eq('id', req.user.id)
      .single();

    let recipeInfo = null;
    if (blog.recipe_id) {
      const { data: recipe } = await supabase
        .from('recipes')
        .select('id, title')
        .eq('id', blog.recipe_id)
        .single();
      
      if (recipe) {
        recipeInfo = {
          _id: recipe.id,
          title: recipe.title
        };
      }
    }

    const formattedBlog = {
      _id: blog.id,
      title: blog.title,
      content: blog.content,
      image: blog.image || '',
      author: profile ? {
        name: profile.name,
        avatar: profile.avatar || ''
      } : { name: req.user.name || 'Anonymous', avatar: '' },
      recipe: recipeInfo,
      createdAt: blog.created_at
    };

    res.json(formattedBlog);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete blog
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const blogId = req.params.id;

    // Check if blog exists and user owns it
    const { data: blog, error: checkError } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', blogId)
      .single();

    if (checkError || !blog) {
      return res.status(404).json({ message: 'Blog not found' });
    }

    if (blog.author_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Use authenticated client for delete (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;
    
    const { error } = await authClient
      .from('blogs')
      .delete()
      .eq('id', blogId);

    if (error) {
      console.error('Error deleting blog:', error);
      return res.status(500).json({ message: error.message || 'Failed to delete blog' });
    }

    res.json({ message: 'Blog deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Like/Unlike blog
router.post('/:id/like', authenticate, async (req, res) => {
  try {
    const blogId = req.params.id;
    const userId = req.user.id;

    // Use authenticated client (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    // Check if like already exists
    const { data: existing, error: checkError } = await authClient
      .from('blog_likes')
      .select('id')
      .eq('blog_id', blogId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Unlike
      const { error } = await authClient
        .from('blog_likes')
        .delete()
        .eq('blog_id', blogId)
        .eq('user_id', userId);

      if (error) throw error;
      res.json({ message: 'Blog unliked', isLiked: false });
    } else {
      // Like
      const { error } = await authClient
        .from('blog_likes')
        .insert({ blog_id: blogId, user_id: userId });

      if (error) throw error;

      // Create notification for blog owner
      const { data: blog } = await supabase
        .from('blogs')
        .select('author_id')
        .eq('id', blogId)
        .single();

      if (blog && blog.author_id) {
        const { createNotification } = await import('../utils/notifications.js');
        await createNotification(blog.author_id, userId, 'blog_like', 'blog', blogId);
      }

      res.json({ message: 'Blog liked', isLiked: true });
    }
  } catch (error) {
    console.error('Error in POST /blogs/:id/like:', error);
    res.status(500).json({ message: error.message || 'Failed to like/unlike blog' });
  }
});

// Mount comment routes BEFORE /:id route to avoid conflicts
import blogCommentRoutes from './blogCommentRoutes.js';
router.use('/:id/comments', blogCommentRoutes);

export default router;
