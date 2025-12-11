import mongoose from 'mongoose';

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  image: { type: String, default: '' }, // GridFS file ID or URL
  authorId: { type: String, required: true, ref: 'User' },
  recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

blogSchema.index({ authorId: 1, createdAt: -1 });

// Update updatedAt before saving
blogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Blog', blogSchema);
