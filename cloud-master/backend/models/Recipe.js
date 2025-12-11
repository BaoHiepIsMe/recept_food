import mongoose from 'mongoose';

const recipeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  ingredients: { type: String, required: true },
  instructions: { type: String, required: true },
  image: { type: String, default: '' }, // GridFS file ID or URL
  authorId: { type: String, required: true, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Shard key: authorId for distribution
recipeSchema.index({ authorId: 1, createdAt: -1 });

// Update updatedAt before saving
recipeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Recipe', recipeSchema);
