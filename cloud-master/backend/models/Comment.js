import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
  blogId: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog' },
  authorId: { type: String, required: true, ref: 'User' },
  text: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment' },
  createdAt: { type: Date, default: Date.now }
});

// Ensure either recipeId or blogId is present, but not both
commentSchema.pre('validate', function(next) {
  if ((this.recipeId && this.blogId) || (!this.recipeId && !this.blogId)) {
    next(new Error('Comment must have either recipeId or blogId, but not both'));
  } else {
    next();
  }
});

commentSchema.index({ recipeId: 1 });
commentSchema.index({ blogId: 1 });
commentSchema.index({ parentId: 1 });

export default mongoose.model('Comment', commentSchema);
