import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// Comment Item Component
function CommentItem({ 
  comment, 
  user, 
  onReply, 
  onLike, 
  onDelete, 
  replyingTo, 
  replyText, 
  setReplyText, 
  onSubmitReply, 
  submitting,
  recipeId 
}) {
  const isReplying = replyingTo === comment._id;

  return (
    <div className={`p-4 bg-gray-50 rounded-lg border border-gray-200 ${comment.parent_id ? 'ml-8 mt-2' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          {comment.author?.avatar ? (
            <img
              src={comment.author.avatar}
              alt={comment.author.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-semibold">
              {comment.author?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-800">
              {comment.author?.name || 'Anonymous'}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(comment.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        {user && (user.id === comment.author_id || user.id === comment.author?.id) && (
          <button
            onClick={() => onDelete(comment._id)}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Delete
          </button>
        )}
      </div>
      <p className="text-gray-700 mb-3">{comment.text}</p>
      
      {/* Actions */}
      <div className="flex items-center gap-4 text-sm">
        <button
          onClick={() => onLike(comment._id)}
          disabled={!user}
          className={`flex items-center gap-1 transition hover:opacity-80 ${
            !user ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <span className={comment.isLiked === true ? 'text-red-500' : 'text-gray-400'}>
            {comment.isLiked === true ? '❤️' : '🤍'}
          </span>
          <span className={comment.isLiked === true ? 'text-red-500' : 'text-gray-600'}>
            {comment.likes || 0}
          </span>
        </button>
        {!comment.parent_id && user && (
          <button
            onClick={() => onReply(comment._id)}
            className="text-gray-500 hover:text-orange-600 transition"
          >
            Reply
          </button>
        )}
      </div>

      {/* Reply Form */}
      {isReplying && user && (
        <form onSubmit={(e) => onSubmitReply(e, comment._id)} className="mt-4">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            rows="2"
            className="w-full p-3 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 mb-2"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !replyText.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
                submitting || !replyText.trim()
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {submitting ? 'Posting...' : 'Post Reply'}
            </button>
            <button
              type="button"
              onClick={() => {
                setReplyText('');
                onReply(null);
              }}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply._id}
              comment={reply}
              user={user}
              onReply={onReply}
              onLike={onLike}
              onDelete={onDelete}
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              onSubmitReply={onSubmitReply}
              submitting={submitting}
              recipeId={recipeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchRecipe();
    fetchComments();
    checkFavorite();
    
    // Real-time polling: refresh every 3 seconds
    const interval = setInterval(() => {
      fetchRecipe();
      fetchComments();
      if (user) {
        checkFavorite();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [id, user]);

  const fetchRecipe = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/recipes/${id}`);
      setRecipe(res.data);
    } catch (err) {
      console.error(err);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await api.get(`/recipes/${id}/comments`);
      setComments(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const checkFavorite = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/recipes/${id}/favorite/check`);
      setIsFavorite(res.data.isFavorite || false);
    } catch (err) {
      // Ignore if endpoint doesn't exist
    }
  };

  const handleFavorite = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await api.post(`/recipes/${id}/favorite`);
      // Fetch lại trạng thái từ server
      await checkFavorite();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!commentText.trim()) return;

    try {
      setSubmitting(true);
      await api.post(`/recipes/${id}/comments`, { text: commentText });
      setCommentText('');
      fetchComments();
    } catch (err) {
      console.error(err);
      alert('Error posting comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/recipes/${id}/comments/${commentId}`);
      fetchComments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplySubmit = async (e, parentId) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!replyText.trim()) return;

    try {
      setSubmitting(true);
      await api.post(`/recipes/${id}/comments`, { text: replyText, parentId });
      setReplyText('');
      setReplyingTo(null);
      fetchComments();
    } catch (err) {
      console.error(err);
      alert('Error posting reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await api.post(`/recipes/${id}/comments/${commentId}/like`);
      fetchComments();
    } catch (err) {
      console.error(err);
    }
  };

  const updateCommentLikes = (comments, commentId, isLiked) => {
    return comments.map(comment => {
      if (comment._id === commentId) {
        return {
          ...comment,
          likes: isLiked ? comment.likes + 1 : comment.likes - 1,
          isLiked: !comment.isLiked
        };
      }
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentLikes(comment.replies, commentId, isLiked)
        };
      }
      return comment;
    });
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        <p className="mt-4 text-gray-600">Loading recipe...</p>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl text-gray-500 mb-4">Recipe not found</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 text-gray-600 hover:text-orange-600 transition flex items-center gap-2"
      >
        ← Back
      </button>

      {/* Recipe Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-orange-100 mb-8">
        {/* Recipe Image */}
        {recipe.image ? (
          <div className="h-96 overflow-hidden">
            <img
              src={recipe.image}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="h-96 bg-gradient-to-br from-orange-200 to-yellow-200 flex items-center justify-center">
            <span className="text-9xl">🍳</span>
          </div>
        )}

        <div className="p-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-4xl font-bold text-gray-800 mb-4">{recipe.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>By {recipe.author || 'Anonymous'}</span>
                <span>•</span>
                <span>{new Date(recipe.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            {user ? (
              <button
                onClick={handleFavorite}
                className={`text-4xl transition transform hover:scale-110 ${
                  isFavorite === true ? 'text-red-500' : 'text-gray-300 hover:text-red-400'
                }`}
                title={isFavorite === true ? 'Remove from favorites' : 'Add to favorites'}
              >
                {isFavorite === true ? '❤️' : '🤍'}
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="text-4xl text-gray-300 hover:text-red-400 transition transform hover:scale-110"
                title="Login to add to favorites"
              >
                🤍
              </button>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-orange-600 mb-3">Ingredients</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{recipe.ingredients}</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-orange-600 mb-3">Instructions</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{recipe.instructions}</p>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-orange-100">
        <h2 className="text-3xl font-bold text-gray-800 mb-6">💬 Comments</h2>

        {/* Add Comment Form */}
        {user ? (
          <form onSubmit={handleCommentSubmit} className="mb-8">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              rows="3"
              className="w-full p-4 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3"
            />
            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              className={`px-6 py-3 rounded-lg font-semibold text-white transition ${
                submitting || !commentText.trim()
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        ) : (
          <div className="mb-8 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-gray-600">
              Please{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-orange-600 hover:text-orange-700 font-semibold"
              >
                login
              </button>{' '}
              to post a comment
            </p>
          </div>
        )}

        {/* Comments List */}
        {comments.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <p>No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <CommentItem
                key={comment._id}
                comment={comment}
                user={user}
                onReply={(commentId) => setReplyingTo(commentId)}
                onLike={handleLikeComment}
                onDelete={handleDeleteComment}
                replyingTo={replyingTo}
                replyText={replyText}
                setReplyText={setReplyText}
                onSubmitReply={handleReplySubmit}
                submitting={submitting}
                recipeId={id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

