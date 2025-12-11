import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Comment from '../models/Comment.js';
import CommentLike from '../models/CommentLike.js';
import User from '../models/User.js';
import Recipe from '../models/Recipe.js';
import { createNotification } from '../utils/notifications.js';

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
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      }
    } catch (err) {
      // Ignore auth errors, just proceed without user
    }
    
    // Get all comments (including replies)
    const comments = await Comment.find({ recipeId })
      .sort({ createdAt: 1 })
      .populate('authorId', 'name email avatar')
      .lean();

    // Get comment likes
    const commentIds = comments.map(c => c._id.toString());
    let likesMap = {};
    let userLikesSet = new Set();
    
    if (commentIds.length > 0) {
      const likes = await CommentLike.find({ commentId: { $in: commentIds } }).lean();
      
      likes.forEach(like => {
        const commentId = like.commentId.toString();
        if (!likesMap[commentId]) {
          likesMap[commentId] = [];
        }
        likesMap[commentId].push(like.userId);
        if (userId && like.userId === userId) {
          userLikesSet.add(commentId);
        }
      });
    }

    // Separate top-level comments and replies
    const topLevelComments = comments.filter(c => !c.parentId);
    const repliesMap = {};
    comments.forEach(comment => {
      if (comment.parentId) {
        const parentId = comment.parentId.toString();
        if (!repliesMap[parentId]) {
          repliesMap[parentId] = [];
        }
        repliesMap[parentId].push(comment);
      }
    });

    // Format comments with replies
    const formatComment = (comment) => {
      const authorId = typeof comment.authorId === 'object' ? comment.authorId._id || comment.authorId : comment.authorId;
      const authorName = typeof comment.authorId === 'object' ? (comment.authorId.name || 'Anonymous') : 'Anonymous';
      const authorAvatar = typeof comment.authorId === 'object' && comment.authorId.avatar 
        ? comment.authorId.avatar : '';
      
      return {
        _id: comment._id.toString(),
        text: comment.text,
        author_id: authorId,
        parent_id: comment.parentId ? comment.parentId.toString() : null,
        author: {
          id: authorId,
          name: authorName,
          avatar: authorAvatar
        },
        likes: likesMap[comment._id.toString()]?.length || 0,
        isLiked: userId ? userLikesSet.has(comment._id.toString()) : false,
        createdAt: comment.createdAt,
        replies: (repliesMap[comment._id.toString()] || []).map(formatComment)
      };
    };

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

    const commentData = {
      recipeId,
      authorId: req.user.id,
      text: text.trim()
    };

    if (parentId) {
      commentData.parentId = parentId;
    }

    const comment = new Comment(commentData);
    await comment.save();

    // Populate author
    await comment.populate('authorId', 'name email avatar');

    const user = await User.findById(req.user.id).lean();
    const formattedComment = {
      _id: comment._id.toString(),
      text: comment.text,
      author_id: comment.authorId,
      parent_id: comment.parentId ? comment.parentId.toString() : null,
      author: user ? {
        id: user._id,
        name: user.name || 'Anonymous',
        avatar: user.avatar || ''
      } : { id: req.user.id, name: req.user.name || 'Anonymous', avatar: '' },
      likes: 0,
      isLiked: false,
      createdAt: comment.createdAt,
      replies: []
    };

    // Create notification for recipe owner
    if (comment.recipeId) {
      const recipe = await Recipe.findById(comment.recipeId).lean();
      if (recipe && recipe.authorId && recipe.authorId !== req.user.id) {
        await createNotification(recipe.authorId, req.user.id, 'recipe_comment', 'recipe', comment.recipeId.toString());
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
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.authorId !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Comment.findByIdAndDelete(commentId);

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
    const existing = await CommentLike.findOne({ commentId, userId });

    if (existing) {
      // Unlike
      await CommentLike.findByIdAndDelete(existing._id);
      res.json({ message: 'Comment unliked', isLiked: false });
    } else {
      // Like
      const commentLike = new CommentLike({ commentId, userId });
      await commentLike.save();

      // Create notification for comment owner
      const comment = await Comment.findById(commentId).lean();
      if (comment && comment.authorId && comment.authorId !== userId) {
        if (comment.recipeId) {
          await createNotification(comment.authorId, userId, 'comment_like', 'recipe', comment.recipeId.toString());
        } else if (comment.blogId) {
          await createNotification(comment.authorId, userId, 'comment_like', 'blog', comment.blogId.toString());
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
