import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, ref: 'User' },
  actorId: { type: String, required: true, ref: 'User' },
  type: { 
    type: String, 
    required: true,
    enum: ['recipe_like', 'recipe_comment', 'blog_like', 'blog_comment', 'comment_like', 'comment_reply']
  },
  targetType: { type: String, required: true, enum: ['recipe', 'blog', 'comment'] },
  targetId: { type: mongoose.Schema.Types.Mixed, required: true },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
// Shard key
notificationSchema.index({ userId: 1 });

export default mongoose.model('Notification', notificationSchema);
