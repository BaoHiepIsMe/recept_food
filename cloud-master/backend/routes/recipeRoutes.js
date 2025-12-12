import express from "express";
import { authenticate } from "../middleware/auth.js";
import multer from "multer";
import Recipe from "../models/Recipe.js";
import Favorite from "../models/Favorite.js";
import User from "../models/User.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { createNotification } from "../utils/notifications.js";
import { publishEvent } from "../utils/eventPublisher.js";
import commentRoutes from "./commentRoutes.js";

const router = express.Router();

// Use memory storage for multer (better for GridFS)
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Lấy tất cả công thức
router.get("/", async (req, res) => {
  try {
    const recipes = await Recipe.find()
      .sort({ createdAt: -1 })
      .populate('authorId', 'name email avatar')
      .lean();

    // Get user favorites if authenticated
    let favoriteIds = new Set();
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
        const favorites = await Favorite.find({ userId: decoded.userId }).lean();
        favoriteIds = new Set(favorites.map(f => f.recipeId.toString()));
      } catch (err) {
        // Ignore auth errors
      }
    }

    // Format recipes to match frontend expectations
    const formattedRecipes = recipes.map(recipe => ({
      _id: recipe._id.toString(),
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: recipe.authorId?.name || 'Anonymous',
      createdAt: recipe.createdAt,
      isFavorite: favoriteIds.has(recipe._id.toString())
    }));

    res.json(formattedRecipes);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch recipes' });
  }
});

// ✅ Tìm kiếm công thức theo tên hoặc nguyên liệu
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    // MongoDB text search
    const recipes = await Recipe.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { ingredients: { $regex: q, $options: 'i' } }
      ]
    })
      .sort({ createdAt: -1 })
      .populate('authorId', 'name email avatar')
      .lean();

    const formattedRecipes = recipes.map(recipe => ({
      _id: recipe._id.toString(),
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: recipe.authorId?.name || 'Anonymous',
      createdAt: recipe.createdAt
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
    const recipes = await Recipe.find({ authorId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('authorId', 'name email avatar')
      .lean();

    const user = await User.findById(req.user.id).lean();
    const authorName = user?.name || req.user.name || 'Me';

    const formattedRecipes = recipes.map(recipe => ({
      _id: recipe._id.toString(),
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: authorName,
      createdAt: recipe.createdAt
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
    const favorites = await Favorite.find({ userId: req.user.id }).lean();
    const recipeIds = favorites.map(f => f.recipeId);

    if (recipeIds.length === 0) {
      return res.json([]);
    }

    const recipes = await Recipe.find({ _id: { $in: recipeIds } })
      .sort({ createdAt: -1 })
      .populate('authorId', 'name email avatar')
      .lean();

    const formattedRecipes = recipes.map(recipe => ({
      _id: recipe._id.toString(),
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: recipe.authorId?.name || 'Anonymous',
      createdAt: recipe.createdAt
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

    let imageUrl = '';
    
    // Upload image to Cloudinary if provided
    if (req.file) {
      try {
        imageUrl = await uploadToCloudinary(req.file, 'recipes');
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(400).json({ message: 'Failed to upload image: ' + (error.message || 'Unknown error') });
      }
    }

    const recipe = new Recipe({
      title: title.trim(),
      ingredients: ingredients.trim(),
      instructions: instructions.trim(),
      authorId: req.user.id,
      image: imageUrl
    });

    await recipe.save();

    // Get author name
    const user = await User.findById(req.user.id).lean();
    const authorName = user?.name || req.user.name || 'Anonymous';

    const formattedRecipe = {
      _id: recipe._id.toString(),
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: imageUrl,
      author: authorName,
      createdAt: recipe.createdAt
    };

    // 🔥 Emit event to Redis PubSub
    await publishEvent('recipe:created', {
      recipeId: recipe._id.toString(),
      recipe: formattedRecipe,
      authorId: req.user.id
    });

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
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (recipe.authorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { title, ingredients, instructions } = req.body;
    if (title) recipe.title = title.trim();
    if (ingredients) recipe.ingredients = ingredients.trim();
    if (instructions) recipe.instructions = instructions.trim();

    // Upload new image if provided
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (recipe.image) {
          try {
            await deleteFromCloudinary(recipe.image);
          } catch (err) {
            console.log('Could not delete old image:', err.message);
          }
        }
        
        recipe.image = await uploadToCloudinary(req.file, 'recipes');
      } catch (error) {
        console.error('Image upload error:', error);
        return res.status(400).json({ message: 'Failed to upload image: ' + (error.message || 'Unknown error') });
      }
    }

    await recipe.save();

    // Get author name
    const user = await User.findById(req.user.id).lean();
    const authorName = user?.name || req.user.name || 'Anonymous';

    const formattedRecipe = {
      _id: recipe._id.toString(),
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: authorName,
      createdAt: recipe.createdAt
    };

    // 🔥 Emit event to Redis PubSub
    await publishEvent('recipe:updated', {
      recipeId: recipe._id.toString(),
      recipe: formattedRecipe,
      authorId: req.user.id
    });

    res.json(formattedRecipe);
  } catch (error) {
    console.error('Error updating recipe:', error);
    res.status(400).json({ message: error.message || 'Failed to update recipe' });
  }
});

// ✅ Xóa công thức
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const recipeId = req.params.id;

    // Check if recipe exists and user owns it
    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    if (recipe.authorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete image from Cloudinary if exists
    if (recipe.image) {
      try {
        await deleteFromCloudinary(recipe.image);
      } catch (err) {
        console.log('Could not delete image:', err.message);
      }
    }

    await Recipe.findByIdAndDelete(recipeId);

    // 🔥 Emit event to Redis PubSub
    await publishEvent('recipe:deleted', {
      recipeId: recipeId,
      authorId: req.user.id
    });

    res.json({ message: 'Recipe deleted' });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    res.status(500).json({ message: error.message || 'Failed to delete recipe' });
  }
});

// ✅ Thêm/xóa yêu thích
router.post("/:id/favorite", authenticate, async (req, res) => {
  try {
    const recipeId = req.params.id;
    const userId = req.user.id;

    // Check if favorite already exists
    const existing = await Favorite.findOne({ userId, recipeId });

    if (existing) {
      // Remove favorite
      await Favorite.findByIdAndDelete(existing._id);
      res.json({ message: 'Favorite removed', isFavorite: false });
    } else {
      // Add favorite
      const favorite = new Favorite({ userId, recipeId });
      await favorite.save();

      // Create notification for recipe owner
      const recipe = await Recipe.findById(recipeId).lean();
      if (recipe && recipe.authorId && recipe.authorId !== userId) {
        await createNotification(recipe.authorId, userId, 'recipe_like', 'recipe', recipeId);
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

    await Favorite.findOneAndDelete({ userId, recipeId });

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

    const favorite = await Favorite.findOne({ userId, recipeId });

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

    const recipe = await Recipe.findById(recipeId)
      .populate('authorId', 'name email avatar')
      .lean();

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    const formattedRecipe = {
      _id: recipe._id.toString(),
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: recipe.image || '',
      author: recipe.authorId?.name || 'Anonymous',
      createdAt: recipe.createdAt
    };

    res.json(formattedRecipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch recipe' });
  }
});

export default router;
