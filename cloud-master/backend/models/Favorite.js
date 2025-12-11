import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema({
  userId: { type: String, required: true, ref: 'User' },
  recipeId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Recipe' },
  createdAt: { type: Date, default: Date.now }
});

favoriteSchema.index({ userId: 1, recipeId: 1 }, { unique: true });
// Shard key
favoriteSchema.index({ userId: 1 });

export default mongoose.model('Favorite', favoriteSchema);

