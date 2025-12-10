import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

// Get comments for a recipe (with replies and likes)
router.get('/', async (req, res) => {
  try {
    const recipeId = req.params.recipeId || req.params.id;
    
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
      // Ignore auth errors, just proceed without user
    }
    
    // Get all comments (including replies)
    const { data: comments, error } = await supabase
      .from('comments')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch comments' });
    }

    // Get author info
    const authorIds = [...new Set((comments || []).map(c => c.author_id))];
    let authorMap = {};
    
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .in('id', authorIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          authorMap[profile.id] = {
            id: profile.id,
            name: profile.name,
            avatar: profile.avatar || ''
          };
        });
      }
    }

    // Get comment likes
    const commentIds = (comments || []).map(c => c.id);
    let likesMap = {};
    let userLikesSet = new Set();
    
    if (commentIds.length > 0) {
      const { data: likes } = await supabase
        .from('comment_likes')
        .select('comment_id, user_id')
        .in('comment_id', commentIds);
      
      if (likes) {
        likes.forEach(like => {
          if (!likesMap[like.comment_id]) {
            likesMap[like.comment_id] = [];
          }
          likesMap[like.comment_id].push(like.user_id);
          if (userId && like.user_id === userId) {
            userLikesSet.add(like.comment_id);
          }
        });
      }
    }

    // Separate top-level comments and replies
    const topLevelComments = (comments || []).filter(c => !c.parent_id);
    const repliesMap = {};
    (comments || []).forEach(comment => {
      if (comment.parent_id) {
        if (!repliesMap[comment.parent_id]) {
          repliesMap[comment.parent_id] = [];
        }
        repliesMap[comment.parent_id].push(comment);
      }
    });

    // Format comments with replies
    const formatComment = (comment) => ({
      _id: comment.id,
      text: comment.text,
      author_id: comment.author_id,
      parent_id: comment.parent_id || null,
      author: authorMap[comment.author_id] || { id: comment.author_id, name: 'Anonymous', avatar: '' },
      likes: likesMap[comment.id]?.length || 0,
      isLiked: userId ? userLikesSet.has(comment.id) : false,
      createdAt: comment.created_at,
      replies: (repliesMap[comment.id] || []).map(formatComment)
    });

    const formattedComments = topLevelComments.map(formatComment);

    res.json(formattedComments);
  } catch (error) {
    console.error('Error in GET /comments:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Create comment (or reply)
router.post('/', authenticate, async (req, res) => {
  try {
    const recipeId = req.params.recipeId || req.params.id;
    const { text, parentId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    // Use authenticated client for insert (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    const commentData = {
      recipe_id: recipeId,
      author_id: req.user.id,
      text: text.trim()
    };

    if (parentId) {
      commentData.parent_id = parentId;
    }

    const { data: comment, error } = await authClient
      .from('comments')
      .insert(commentData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return res.status(400).json({ message: error.message || 'Failed to create comment' });
    }

    // Get author info
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, avatar')
      .eq('id', req.user.id)
      .single();

    const formattedComment = {
      _id: comment.id,
      text: comment.text,
      author_id: comment.author_id,
      parent_id: comment.parent_id || null,
      author: profile ? {
        id: profile.id,
        name: profile.name,
        avatar: profile.avatar || ''
      } : { id: req.user.id, name: req.user.name || 'Anonymous', avatar: '' },
      likes: 0,
      isLiked: false,
      createdAt: comment.created_at,
      replies: []
    };

    // Create notification for recipe owner
    if (comment.recipe_id) {
      const { data: recipe } = await supabase
        .from('recipes')
        .select('author_id')
        .eq('id', comment.recipe_id)
        .single();

      if (recipe && recipe.author_id) {
        const { createNotification } = await import('../utils/notifications.js');
        await createNotification(recipe.author_id, req.user.id, 'recipe_comment', 'recipe', comment.recipe_id);
      }
    }

    res.status(201).json(formattedComment);
  } catch (error) {
    console.error('Error in POST /comments:', error);
    res.status(400).json({ message: error.message || 'Failed to create comment' });
  }
});

// Delete comment
router.delete('/:commentId', authenticate, async (req, res) => {
  try {
    const commentId = req.params.commentId;

    // Check if comment exists and user owns it
    const { data: comment, error: checkError } = await supabase
      .from('comments')
      .select('*')
      .eq('id', commentId)
      .single();

    if (checkError || !comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.author_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Use authenticated client for delete (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    const { error } = await authClient
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return res.status(500).json({ message: error.message || 'Failed to delete comment' });
    }

    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error('Error in DELETE /comments/:id:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Like/Unlike comment
router.post('/:commentId/like', authenticate, async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const userId = req.user.id;

    // Check if like already exists
    const { data: existing, error: checkError } = await supabase
      .from('comment_likes')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .maybeSingle();

    // Use authenticated client (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    if (existing) {
      // Unlike
      const { error } = await authClient
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', userId);

      if (error) throw error;
      res.json({ message: 'Comment unliked', isLiked: false });
    } else {
      // Like
      const { error } = await authClient
        .from('comment_likes')
        .insert({ comment_id: commentId, user_id: userId });

      if (error) throw error;

      // Create notification for comment owner
      const { data: comment } = await supabase
        .from('comments')
        .select('author_id, recipe_id, blog_id')
        .eq('id', commentId)
        .single();

      if (comment && comment.author_id) {
        const { createNotification } = await import('../utils/notifications.js');
        if (comment.recipe_id) {
          await createNotification(comment.author_id, userId, 'recipe_comment', 'recipe', comment.recipe_id);
        } else if (comment.blog_id) {
          await createNotification(comment.author_id, userId, 'blog_comment', 'blog', comment.blog_id);
        }
      }

      res.json({ message: 'Comment liked', isLiked: true });
    }
  } catch (error) {
    console.error('Error in POST /comments/:id/like:', error);
    res.status(500).json({ message: error.message || 'Failed to like/unlike comment' });
  }
});

export default router;

