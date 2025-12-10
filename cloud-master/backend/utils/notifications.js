import { supabase } from '../config/supabase.js';

/**
 * Create a notification
 * @param {string} userId - The user who will receive the notification
 * @param {string} actorId - The user who performed the action
 * @param {string} type - 'recipe_like', 'recipe_comment', 'blog_like', 'blog_comment'
 * @param {string} targetType - 'recipe' or 'blog'
 * @param {string} targetId - recipe_id or blog_id
 */
export async function createNotification(userId, actorId, type, targetType, targetId) {
  try {
    // Don't create notification if user is notifying themselves
    if (userId === actorId) {
      return;
    }

    // Use service role or anon key - notifications are created by system
    // We need to bypass RLS for insert, so we'll use a service role key if available
    // For now, we'll use the regular client and let RLS handle it
    // Note: You may need to create a service role function or use a different approach
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        actor_id: actorId,
        type: type,
        target_type: targetType,
        target_id: targetId
      });

    if (error) {
      console.error('Error creating notification:', error);
      // Don't throw - notifications are not critical
    }
  } catch (error) {
    console.error('Error in createNotification:', error);
    // Don't throw - notifications are not critical
  }
}

