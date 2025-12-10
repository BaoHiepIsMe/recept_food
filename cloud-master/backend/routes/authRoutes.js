import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads (temporary storage before uploading to Supabase)
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
const uploadToSupabase = async (file, folder = 'avatars', userToken = null) => {
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

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    // Sign up with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name
        },
        emailRedirectTo: undefined // Disable email confirmation for now
      }
    });

    if (authError) {
      console.error('Supabase signup error:', authError);
      return res.status(400).json({ message: authError.message });
    }

    if (!authData.user) {
      return res.status(400).json({ message: 'Failed to create user' });
    }

    // Wait a bit for trigger to create profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if profile exists, if not create it manually
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (!profile) {
      // Create profile manually if trigger didn't work
      const { data: newProfile, error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          name: name,
          email: email
        })
        .select()
        .single();

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Continue anyway, profile might be created by trigger later
      } else {
        profile = newProfile;
      }
    }

    // Try to get session - if email confirmation is required, session might be null
    let session = authData.session;
    
    if (!session) {
      // Try to sign in to get session
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        // If email confirmation is required, return success but no session
        return res.status(201).json({
          message: 'User created successfully. Please check your email to confirm your account.',
          user: {
            id: authData.user.id,
            name: profile?.name || name,
            email: authData.user.email
          },
          requiresEmailConfirmation: true
        });
      }

      session = sessionData.session;
    }

    if (!session) {
      return res.status(400).json({ 
        message: 'Account created but session could not be established. Please try logging in.' 
      });
    }

    res.status(201).json({
      token: session.access_token,
      user: {
        id: authData.user.id,
        name: profile?.name || name,
        email: authData.user.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ message: error.message || 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(401).json({ message: error.message || 'Invalid credentials' });
    }

    if (!data || !data.session || !data.user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get profile - handle case where profile might not exist
    let profile = null;
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.log('Profile not found, creating one...');
      // Profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          email: data.user.email
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
        // Continue anyway with default name
      } else {
        profile = newProfile;
      }
    } else {
      profile = profileData;
    }

    res.json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        name: profile?.name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
        email: data.user.email
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
    const userId = req.user.id;

    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    // Get counts
    const { count: recipeCount } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId);

    const { count: favoriteCount } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { count: blogCount } = await supabase
      .from('blogs')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId);

    res.json({
      ...profile,
      recipeCount: recipeCount || 0,
      favoriteCount: favoriteCount || 0,
      blogCount: blogCount || 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update profile
router.put('/profile', authenticate, upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, bio } = req.body;
    const updateData = { name, bio };
    
    // Upload avatar to Supabase Storage if provided
    if (req.file) {
      try {
        // Get user token from request
        const token = req.headers.authorization?.split(' ')[1];
        const avatarUrl = await uploadToSupabase(req.file, 'avatars', token);
        updateData.avatar = avatarUrl;
      } catch (error) {
        console.error('Avatar upload error:', error);
        return res.status(400).json({ message: 'Failed to upload avatar: ' + (error.message || 'Unknown error') });
      }
    }

    // Update profile - use authenticated client
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;
    
    const { data, error } = await authClient
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return res.status(400).json({ message: error.message || 'Failed to update profile' });
    }

    res.json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
