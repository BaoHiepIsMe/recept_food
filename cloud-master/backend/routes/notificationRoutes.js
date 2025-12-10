import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Use authenticated client (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    const { data: notifications, error } = await authClient
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch notifications' });
    }

    // Get actor profiles
    const actorIds = [...new Set((notifications || []).map(n => n.actor_id))];
    let actorMap = {};
    
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar')
        .in('id', actorIds);
      
      if (profiles) {
        profiles.forEach(profile => {
          actorMap[profile.id] = {
            id: profile.id,
            name: profile.name,
            avatar: profile.avatar || ''
          };
        });
      }
    }

    // Format notifications
    const formattedNotifications = (notifications || []).map(notif => ({
      _id: notif.id,
      type: notif.type,
      targetType: notif.target_type,
      targetId: notif.target_id,
      actor: actorMap[notif.actor_id] || { id: notif.actor_id, name: 'Someone', avatar: '' },
      read: notif.read,
      createdAt: notif.created_at
    }));

    res.json(formattedNotifications);
  } catch (error) {
    console.error('Error in GET /notifications:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Get unread count
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Use authenticated client (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    const { count, error } = await authClient
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch unread count' });
    }

    res.json({ count: count || 0 });
  } catch (error) {
    console.error('Error in GET /notifications/unread-count:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;

    // Use authenticated client (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    // Check if notification belongs to user
    const { data: notif, error: checkError } = await authClient
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('user_id', userId)
      .single();

    if (checkError || !notif) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Update to read
    const { error } = await authClient
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return res.status(500).json({ message: error.message || 'Failed to mark as read' });
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error in PUT /notifications/:id/read:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

// Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Use authenticated client (required by RLS)
    const token = req.headers.authorization?.split(' ')[1];
    const { getAuthClient } = await import('../config/supabase.js');
    const authClient = token ? getAuthClient(token) : supabase;

    const { error } = await authClient
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error marking all as read:', error);
      return res.status(500).json({ message: error.message || 'Failed to mark all as read' });
    }

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error in PUT /notifications/read-all:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

export default router;

