import mongoose from 'mongoose';

const blogLikeSchema = new mongoose.Schema({
  blogId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Blog' },
  userId: { type: String, required: true, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

blogLikeSchema.index({ blogId: 1, userId: 1 }, { unique: true });

export default mongoose.model('BlogLike', blogLikeSchema);

