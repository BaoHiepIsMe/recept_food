import express from 'express';
import { authenticate } from '../middleware/auth.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

const router = express.Router();

// Get user's notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Get actor profiles
    const actorIds = [...new Set(notifications.map(n => n.actorId))];
    let actorMap = {};
    
    if (actorIds.length > 0) {
      const actors = await User.find({ _id: { $in: actorIds } })
        .select('_id name email avatar')
        .lean();
      
      actors.forEach(actor => {
        actorMap[actor._id] = {
          id: actor._id,
          name: actor.name || 'Someone',
          avatar: actor.avatar ? `/api/files/${actor.avatar}` : ''
        };
      });
    }

    // Format notifications
    const formattedNotifications = notifications.map(notif => ({
      _id: notif._id.toString(),
      type: notif.type,
      targetType: notif.targetType,
      targetId: notif.targetId.toString ? notif.targetId.toString() : notif.targetId,
      actor: actorMap[notif.actorId] || { id: notif.actorId, name: 'Someone', avatar: '' },
      read: notif.read,
      createdAt: notif.createdAt
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

    const count = await Notification.countDocuments({ 
      userId, 
      read: false 
    });

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

    // Check if notification belongs to user
    const notif = await Notification.findOne({ 
      _id: notificationId, 
      userId 
    });

    if (!notif) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Update to read
    notif.read = true;
    await notif.save();

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

    await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error in PUT /notifications/read-all:', error);
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
});

export default router;
