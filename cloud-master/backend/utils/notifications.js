import Notification from '../models/Notification.js';

/**
 * Create a notification
 * @param {string} userId - The user who will receive the notification
 * @param {string} actorId - The user who performed the action
 * @param {string} type - 'recipe_like', 'recipe_comment', 'blog_like', 'blog_comment', 'comment_like', 'comment_reply'
 * @param {string} targetType - 'recipe', 'blog', or 'comment'
 * @param {string|ObjectId} targetId - recipe_id, blog_id, or comment_id
 */
export async function createNotification(userId, actorId, type, targetType, targetId) {
  try {
    // Don't create notification if user is notifying themselves
    if (userId === actorId) {
      return;
    }

    const notification = new Notification({
      userId,
      actorId,
      type,
      targetType,
      targetId
    });

    await notification.save();
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw - notifications are not critical
  }
}
