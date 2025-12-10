import express from "express";
import { supabase } from "../config/supabase.js";
import { authenticate } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import commentRoutes from "./commentRoutes.js";

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
const uploadToSupabase = async (file, folder = 'recipes', userToken = null) => {
  try {
    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const fileBuffer = fs.readFileSync(file.path);
    
    // Use authenticated client if token provided, otherwise use service role
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

// ✅ Lấy tất cả công thức
router.get("/", async (req, res) => {
  try {
    // Get recipes first
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recipes:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch recipes' });
    }

    // Get author names separately
    const authorIds = [...new Set((recipes || []).map(r => r.author_id))];
    let authorMap = {};
    
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', authorIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          authorMap[profile.id] = profile.name;
        });
      }
    }

    // Format recipes to match frontend expectations
    const formattedRecipes = (recipes || []).map(recipe => ({
      _id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: authorMap[recipe.author_id] || 'Anonymous',
      createdAt: recipe.created_at,
      isFavorite: false
    }));

    // Check if user has favorited each recipe
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          const { data: favorites } = await supabase
            .from('favorites')
            .select('recipe_id')
            .eq('user_id', user.id);

          const favoriteIds = new Set(favorites?.map(f => f.recipe_id) || []);
          
          formattedRecipes.forEach(recipe => {
            recipe.isFavorite = favoriteIds.has(recipe._id);
          });
        }
      } catch (err) {
        // If token invalid, just return recipes without favorite status
      }
    }

    res.json(formattedRecipes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Tìm kiếm công thức theo tên hoặc nguyên liệu
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    // Supabase text search
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .or(`title.ilike.%${q}%,ingredients.ilike.%${q}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Search error:', error);
      return res.status(500).json({ message: error.message || 'Search failed' });
    }

    // Get author names
    const authorIds = [...new Set((recipes || []).map(r => r.author_id))];
    let authorMap = {};
    
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', authorIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          authorMap[profile.id] = profile.name;
        });
      }
    }

    const formattedRecipes = (recipes || []).map(recipe => ({
      _id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: authorMap[recipe.author_id] || 'Anonymous',
      createdAt: recipe.created_at
    }));

    res.json(formattedRecipes);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: error.message || 'Search failed' });
  }
});

// ✅ Lấy công thức của user
router.get("/my", authenticate, async (req, res) => {
  try {
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('author_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my recipes:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch recipes' });
    }

    // Get author name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', req.user.id)
      .single();

    const authorName = profile?.name || req.user.name || 'Me';

    const formattedRecipes = (recipes || []).map(recipe => ({
      _id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: authorName,
      createdAt: recipe.created_at
    }));

    res.json(formattedRecipes);
  } catch (error) {
    console.error('Error in /my recipes:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// ✅ Lấy công thức yêu thích
router.get("/favorites", authenticate, async (req, res) => {
  try {
    // Use authenticated client (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    const { data: favorites, error: favError } = await authClient
      .from('favorites')
      .select('recipe_id')
      .eq('user_id', req.user.id);

    if (favError) {
      console.error('Error fetching favorites:', favError);
      return res.status(500).json({ message: favError.message || 'Failed to fetch favorites' });
    }

    const recipeIds = (favorites || []).map(f => f.recipe_id);

    if (recipeIds.length === 0) {
      return res.json([]);
    }

    // Recipes can be fetched with anon client (public read)
    const { data: recipes, error } = await supabase
      .from('recipes')
      .select('*')
      .in('id', recipeIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching favorite recipes:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch recipes' });
    }

    // Get author names
    const authorIds = [...new Set((recipes || []).map(r => r.author_id))];
    let authorMap = {};
    
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', authorIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          authorMap[profile.id] = profile.name;
        });
      }
    }

    const formattedRecipes = (recipes || []).map(recipe => ({
      _id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: authorMap[recipe.author_id] || 'Anonymous',
      createdAt: recipe.created_at
    }));

    res.json(formattedRecipes);
  } catch (error) {
    console.error('Error in /favorites:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// ✅ Thêm mới công thức
router.post("/", authenticate, upload.single('image'), async (req, res) => {
  try {
    const { title, ingredients, instructions } = req.body;
    
    if (!title || !ingredients || !instructions) {
      return res.status(400).json({ message: 'Title, ingredients, and instructions are required' });
    }

    const recipeData = {
      title: title.trim(),
      ingredients: ingredients.trim(),
      instructions: instructions.trim(),
      author_id: req.user.id,
      image: ''
    };
    
    // Upload image to Supabase Storage if provided
    if (req.file) {
      try {
        // Get user token from request
        const token = req.headers.authorization?.split(' ')[1];
        recipeData.image = await uploadToSupabase(req.file, 'recipes', token);
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(400).json({ message: 'Failed to upload image: ' + (error.message || 'Unknown error') });
      }
    }
    
    // Use authenticated client for insert (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;
    
    const { data: recipe, error } = await authClient
      .from('recipes')
      .insert(recipeData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating recipe:', error);
      return res.status(400).json({ message: error.message || 'Failed to create recipe' });
    }

    if (!recipe) {
      return res.status(400).json({ message: 'Recipe was not created' });
    }

    // Get author name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', req.user.id)
      .single();

    const formattedRecipe = {
      _id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: profile?.name || req.user.name || 'Anonymous',
      createdAt: recipe.created_at
    };

    res.status(201).json(formattedRecipe);
  } catch (error) {
    console.error('Unexpected error in POST /recipes:', error);
    res.status(400).json({ message: error.message || 'Failed to create recipe' });
  }
});

// ✅ Cập nhật công thức
router.put("/:id", authenticate, upload.single('image'), async (req, res) => {
  try {
    const recipeId = req.params.id;

    // Check if recipe exists and user owns it
    const { data: existingRecipe, error: checkError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (checkError || !existingRecipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (existingRecipe.author_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { title, ingredients, instructions } = req.body;
    const updateData = {
      title,
      ingredients,
      instructions
    };

    // Upload new image if provided
    if (req.file) {
      try {
        // Get user token from request
        const token = req.headers.authorization?.split(' ')[1];
        updateData.image = await uploadToSupabase(req.file, 'recipes', token);
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(400).json({ message: 'Failed to upload image: ' + (error.message || 'Unknown error') });
      }
    }

    // Use authenticated client for update (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;
    
    const { data: recipe, error } = await authClient
      .from('recipes')
      .update(updateData)
      .eq('id', recipeId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating recipe:', error);
      return res.status(400).json({ message: error.message || 'Failed to update recipe' });
    }

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found after update' });
    }

    // Get author name
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', req.user.id)
      .single();

    const formattedRecipe = {
      _id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: profile?.name || req.user.name || 'Anonymous',
      createdAt: recipe.created_at
    };

    res.json(formattedRecipe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ✅ Xóa công thức
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const recipeId = req.params.id;

    // Check if recipe exists and user owns it
    const { data: recipe, error: checkError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (checkError || !recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (recipe.author_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Use authenticated client for delete (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;
    
    const { error } = await authClient
      .from('recipes')
      .delete()
      .eq('id', recipeId);

    if (error) {
      console.error('Error deleting recipe:', error);
      return res.status(500).json({ message: error.message || 'Failed to delete recipe' });
    }

    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Thêm/xóa yêu thích
router.post("/:id/favorite", authenticate, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user.id;

    // Use authenticated client for all operations (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    // Check if favorite already exists (must use authenticated client)
    const { data: existing, error: checkError } = await authClient
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking favorite:', checkError);
      return res.status(500).json({ message: checkError.message || 'Failed to check favorite' });
    }

    if (existing) {
      // Remove favorite
      const { error } = await authClient
        .from('favorites')
        .delete()
        .eq('user_id', userId)
        .eq('recipe_id', recipeId);

      if (error) {
        console.error('Error removing favorite:', error);
        throw error;
      }
      res.json({ message: 'Favorite removed', isFavorite: false });
    } else {
      // Add favorite
      const { error } = await authClient
        .from('favorites')
        .insert({ user_id: userId, recipe_id: recipeId });

      if (error) {
        console.error('Error adding favorite:', error);
        throw error;
      }

      // Create notification for recipe owner
      const { data: recipe } = await supabase
        .from('recipes')
        .select('author_id')
        .eq('id', recipeId)
        .single();

      if (recipe && recipe.author_id) {
        const { createNotification } = await import('../utils/notifications.js');
        await createNotification(recipe.author_id, userId, 'recipe_like', 'recipe', recipeId);
      }

      res.json({ message: 'Favorite added', isFavorite: true });
    }
  } catch (error) {
    console.error('Error in POST /:id/favorite:', error);
    res.status(500).json({ message: error.message || 'Failed to toggle favorite' });
  }
});

// ✅ Xóa yêu thích
router.delete("/:id/favorite", authenticate, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user.id;

    // Use authenticated client for delete (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    const { error } = await authClient
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId);

    if (error) {
      console.error('Error deleting favorite:', error);
      return res.status(500).json({ message: error.message || 'Failed to delete favorite' });
    }

    res.json({ message: 'Favorite removed' });
  } catch (error) {
    console.error('Error in DELETE /:id/favorite:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Mount comment routes BEFORE /:id route to avoid conflicts
router.use('/:id/comments', commentRoutes);

// Check if recipe is favorited (must be before /:id route)
router.get('/:id/favorite/check', authenticate, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user.id;

    // Use authenticated client (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    const { data: favorite, error } = await authClient
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .maybeSingle();

    if (error) {
      console.error('Error checking favorite:', error);
      return res.json({ isFavorite: false });
    }

    res.json({ isFavorite: !!favorite });
  } catch (error) {
    console.error('Error in GET /:id/favorite/check:', error);
    res.json({ isFavorite: false });
  }
});

// Get single recipe by ID (must be last to avoid conflicts)
router.get('/:id', async (req, res) => {
  try {
    const recipeId = req.params.id;

    const { data: recipe, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();

    if (error || !recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    // Get author name
    const authorIds = [recipe.author_id];
    let authorMap = {};
    
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', authorIds);
    
    if (profiles && profiles.length > 0) {
      profiles.forEach(profile => {
        authorMap[profile.id] = profile.name;
      });
    }

    const formattedRecipe = {
      _id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: authorMap[recipe.author_id] || 'Anonymous',
      createdAt: recipe.created_at
    };

    res.json(formattedRecipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch recipe' });
  }
});

export default router;
