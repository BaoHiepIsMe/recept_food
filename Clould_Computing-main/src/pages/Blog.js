import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// Blog Comment Item Component (similar to RecipeDetail)
function BlogCommentItem({ 
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
  blogId 
}) {
  const isReplying = replyingTo === comment._id;

  return (
    <div className={`p-4 bg-gray-50 rounded-lg border border-gray-200 ${comment.parent_id ? 'ml-8 mt-2' : ''}`}>
      <div className="flex items-start gap-3">
        {comment.author?.avatar ? (
          <img
            src={comment.author.avatar}
            alt={comment.author.name}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {comment.author?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
        <div className="flex-1">
          <div className="bg-gray-100 rounded-2xl px-4 py-2 inline-block">
            <p className="font-semibold text-gray-800 text-sm mb-1">
              {comment.author?.name || 'Anonymous'}
            </p>
            <p className="text-gray-700 text-sm">{comment.text}</p>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-4 mt-1 ml-2 text-xs">
            <button
              onClick={() => onLike(comment._id)}
              disabled={!user}
              className={`flex items-center gap-1 transition hover:opacity-80 ${
                !user ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span className={comment.isLiked === true ? 'text-red-500' : 'text-gray-500'}>
                {comment.isLiked === true ? '❤️' : '🤍'}
              </span>
              <span className={comment.isLiked === true ? 'text-red-500 font-medium' : 'text-gray-500'}>
                {comment.likes || 0}
              </span>
            </button>
            {!comment.parent_id && user && (
              <button
                onClick={() => onReply(comment._id)}
                className="text-gray-500 hover:text-purple-600 transition font-medium"
              >
                Reply
              </button>
            )}
            {user && (user.id === comment.author_id || user.id === comment.author?.id) && (
              <button
                onClick={() => onDelete(comment._id)}
                className="text-red-500 hover:text-red-700 transition font-medium"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Reply Form */}
      {isReplying && user && (
        <form onSubmit={(e) => onSubmitReply(e, comment._id)} className="mt-2 ml-10">
          <div className="flex items-start gap-2">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div className="flex-1">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Viết phản hồi..."
                rows="1"
                className="w-full p-2 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (replyText.trim()) {
                      onSubmitReply(e, comment._id);
                    }
                  }
                }}
              />
            </div>
          </div>
        </form>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-2">
          {comment.replies.map((reply) => (
            <BlogCommentItem
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
              blogId={blogId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Blog() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [commentTexts, setCommentTexts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [blogComments, setBlogComments] = useState({});
  const [showComments, setShowComments] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [expandedContent, setExpandedContent] = useState({});

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    recipeId: '',
    image: null,
    imagePreview: null,
  });

  const [recipes, setRecipes] = useState([]);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchBlogs();
    fetchRecipes();
  }, [user]);

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/blogs');
      setBlogs(res.data || []);
      // Initialize comment counts (we'll fetch actual counts later if needed)
      if (res.data && res.data.length > 0) {
        const countsMap = {};
        res.data.forEach(blog => {
          countsMap[blog._id] = 0; // Will be updated when comments are loaded
        });
        setCommentCounts(countsMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlogComments = async (blogId) => {
    try {
      const res = await api.get(`/blogs/${blogId}/comments`);
      const comments = res.data || [];
      setBlogComments(prev => ({ ...prev, [blogId]: comments }));
      // Update comment count
      const totalComments = comments.reduce((count, comment) => {
        return count + 1 + (comment.replies?.length || 0);
      }, 0);
      setCommentCounts(prev => ({ ...prev, [blogId]: totalComments }));
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const toggleComments = async (blogId) => {
    const isShowing = showComments[blogId];
    setShowComments(prev => ({ ...prev, [blogId]: !isShowing }));
    
    // Load comments if showing for the first time
    if (!isShowing && !blogComments[blogId]) {
      await fetchBlogComments(blogId);
    }
  };

  const handleLikeBlog = async (blogId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await api.post(`/blogs/${blogId}/like`);
      fetchBlogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBlog = async (blogId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    if (!window.confirm('Bạn có chắc chắn muốn xóa blog này không?')) {
      return;
    }

    try {
      await api.delete(`/blogs/${blogId}`);
      fetchBlogs();
      // Also clear comments if they were loaded
      setBlogComments(prev => {
        const newComments = { ...prev };
        delete newComments[blogId];
        return newComments;
      });
      setShowComments(prev => {
        const newShow = { ...prev };
        delete newShow[blogId];
        return newShow;
      });
    } catch (err) {
      console.error(err);
      if (err.response?.status === 403) {
        alert('Bạn không có quyền xóa blog này');
      } else {
        alert('Lỗi khi xóa blog');
      }
    }
  };

  const handleCommentSubmit = async (e, blogId) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    const text = commentTexts[blogId] || '';
    if (!text.trim()) return;

    try {
      setSubmitting(true);
      await api.post(`/blogs/${blogId}/comments`, { text });
      setCommentTexts(prev => ({ ...prev, [blogId]: '' }));
      await fetchBlogComments(blogId);
    } catch (err) {
      console.error(err);
      alert('Error posting comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (e, blogId, parentId) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!replyText.trim()) return;

    try {
      setSubmitting(true);
      await api.post(`/blogs/${blogId}/comments`, { text: replyText, parentId });
      setReplyText('');
      setReplyingTo(null);
      await fetchBlogComments(blogId);
    } catch (err) {
      console.error(err);
      alert('Error posting reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (blogId, commentId) => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      await api.post(`/blogs/${blogId}/comments/${commentId}/like`);
      await fetchBlogComments(blogId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (blogId, commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.delete(`/blogs/${blogId}/comments/${commentId}`);
      await fetchBlogComments(blogId);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecipes = async () => {
    try {
      const res = await api.get('/recipes/my');
      setRecipes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        image: file,
        imagePreview: URL.createObjectURL(file),
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('content', formData.content);
      if (formData.recipeId) {
        data.append('recipeId', formData.recipeId);
      }
      if (formData.image) {
        data.append('image', formData.image);
      }

      await api.post('/blogs', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      resetForm();
      fetchBlogs();
    } catch (err) {
      console.error(err);
      alert('Error creating blog post');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      recipeId: '',
      image: null,
      imagePreview: null,
    });
    setShowForm(false);
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-2">
            ✍️ Food Blog
          </h1>
          <p className="text-gray-600">Share your culinary stories and experiences</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-pink-600 transition shadow-lg"
        >
          {showForm ? 'Cancel' : '+ Write Blog Post'}
        </button>
      </div>

      {/* Blog Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 border border-purple-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Create New Blog Post</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Related Recipe (Optional)
              </label>
              <select
                name="recipeId"
                value={formData.recipeId}
                onChange={handleInputChange}
                className="w-full p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <option value="">Select a recipe...</option>
                {recipes.map((recipe) => (
                  <option key={recipe._id} value={recipe._id}>
                    {recipe.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
              <textarea
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                rows="10"
                className="w-full p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                placeholder="Share your story, tips, or experience about this dish..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full p-3 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              {formData.imagePreview && (
                <img
                  src={formData.imagePreview}
                  alt="Preview"
                  className="mt-4 w-48 h-48 object-cover rounded-lg border border-purple-300"
                />
              )}
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg hover:bg-purple-600 transition"
              >
                Publish Blog Post
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Blogs List */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <p className="mt-4 text-gray-600">Loading blog posts...</p>
        </div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
          <span className="text-6xl mb-4 block">📝</span>
          <p className="text-2xl text-gray-500 mb-2">No blog posts yet</p>
          <p className="text-gray-400">Be the first to share your culinary story!</p>
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl mx-auto">
          {blogs.map((blog) => (
            <article
              id={`blog-${blog._id}`}
              key={blog._id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              <div className="p-4">
                {/* Header: Avatar, Name, Time */}
                <div className="flex items-center gap-3 mb-3">
                  {blog.author?.avatar ? (
                    <img
                      src={blog.author.avatar}
                      alt={blog.author.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {blog.author?.name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-sm">
                      {blog.author?.name || 'Anonymous'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(blog.createdAt).toLocaleDateString('vi-VN', {
                        day: 'numeric',
                        month: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                      {blog.recipe && (
                        <span className="ml-2 text-purple-600">• 📖 {blog.recipe.title}</span>
                      )}
                    </p>
                  </div>
                  {/* Delete button - only show if user is the author */}
                  {user && blog.author?.id === user.id && (
                    <button
                      onClick={() => handleDeleteBlog(blog._id)}
                      className="ml-auto p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition"
                      title="Xóa blog"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-lg font-semibold text-gray-900 mb-3">{blog.title}</h2>

                {/* Content with "Xem thêm" */}
                <div className="mb-3">
                  <p className={`text-gray-800 whitespace-pre-wrap leading-relaxed ${
                    !expandedContent[blog._id] ? 'line-clamp-2' : ''
                  }`}>
                    {blog.content}
                  </p>
                  {blog.content && blog.content.length > 150 && (
                    <button
                      onClick={() => setExpandedContent(prev => ({
                        ...prev,
                        [blog._id]: !prev[blog._id]
                      }))}
                      className="text-gray-500 hover:text-purple-600 text-sm font-medium mt-1"
                    >
                      {expandedContent[blog._id] ? 'Thu gọn' : 'Xem thêm'}
                    </button>
                  )}
                </div>
              </div>

              {/* Blog Image */}
              {blog.image && (
                <div className="w-full">
                  <img
                    src={blog.image}
                    alt={blog.title}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}

              <div className="px-4 pb-4">

                {/* Actions Bar - Like and Comment buttons */}
                <div className="border-t border-gray-200 pt-2 pb-2 mt-2">
                  <div className="flex items-center justify-around">
                    {/* Like Button */}
                    <button
                      onClick={() => handleLikeBlog(blog._id)}
                      disabled={!user}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                        !user ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
                      }`}
                    >
                      <span className={blog.isLiked === true ? 'text-red-500 text-lg' : 'text-gray-500 text-lg'}>
                        {blog.isLiked === true ? '❤️' : '🤍'}
                      </span>
                      <span className={`text-sm font-medium ${
                        blog.isLiked === true ? 'text-red-500' : 'text-gray-600'
                      }`}>
                        {blog.likes || 0}
                      </span>
                    </button>

                    {/* Comment Button */}
                    <button
                      onClick={() => toggleComments(blog._id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition font-medium"
                    >
                      <span className="text-lg">💬</span>
                      <span className="text-sm">{commentCounts[blog._id] || 0}</span>
                    </button>
                  </div>
                </div>

                {/* Comments Section - Only show when toggled */}
                {showComments[blog._id] && (
                  <div className="border-t border-gray-200 pt-3 mt-2">
                    {/* Add Comment Form */}
                    {user ? (
                      <form onSubmit={(e) => handleCommentSubmit(e, blog._id)} className="mb-6">
                        <div className="flex items-start gap-3">
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                              {user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                          )}
                          <div className="flex-1">
                            <textarea
                              value={commentTexts[blog._id] || ''}
                              onChange={(e) => setCommentTexts(prev => ({ ...prev, [blog._id]: e.target.value }))}
                              placeholder="Write a comment..."
                              rows="2"
                              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                            />
                            <div className="flex justify-end mt-2">
                              <button
                                type="submit"
                                disabled={submitting || !(commentTexts[blog._id] || '').trim()}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition ${
                                  submitting || !(commentTexts[blog._id] || '').trim()
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-purple-500 hover:bg-purple-600'
                                }`}
                              >
                                {submitting ? 'Posting...' : 'Post'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-gray-600 text-sm">
                          Please{' '}
                          <button
                            onClick={() => navigate('/login')}
                            className="text-purple-600 hover:text-purple-700 font-semibold"
                          >
                            login
                          </button>{' '}
                          to post a comment
                        </p>
                      </div>
                    )}

                    {/* Comments List */}
                    {blogComments[blog._id] && blogComments[blog._id].length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        <p>Chưa có bình luận nào. Hãy là người đầu tiên!</p>
                      </div>
                    ) : (
                      blogComments[blog._id] && (
                        <div className="space-y-3">
                          {blogComments[blog._id].map((comment) => (
                            <BlogCommentItem
                              key={comment._id}
                              comment={comment}
                              user={user}
                              onReply={(commentId) => setReplyingTo(commentId)}
                              onLike={(commentId) => handleLikeComment(blog._id, commentId)}
                              onDelete={(commentId) => handleDeleteComment(blog._id, commentId)}
                              replyingTo={replyingTo}
                              replyText={replyText}
                              setReplyText={setReplyText}
                              onSubmitReply={(e, parentId) => handleReplySubmit(e, blog._id, parentId)}
                              submitting={submitting}
                              blogId={blog._id}
                            />
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

