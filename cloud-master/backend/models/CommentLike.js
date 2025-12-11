import mongoose from 'mongoose';

const commentLikeSchema = new mongoose.Schema({
  commentId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Comment' },
  userId: { type: String, required: true, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

commentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

export default mongoose.model('CommentLike', commentLikeSchema);

