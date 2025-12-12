// ============================================
// middleware/eventEmitter.js - Auto emit events after CRUD
// ============================================
import { publishEvent } from '../utils/eventPublisher.js';

/**
 * Middleware to automatically emit events after successful CRUD operations
 * Usage: router.post('/', authenticate, emitEvent('recipe:created'), handler);
 */
export const emitAfterResponse = (eventName, getDataFn) => {
  return (req, res, next) => {
    // Override res.json to emit event after response
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Send response first
      originalJson(data);
      
      // Then emit event asynchronously (don't block response)
      setImmediate(async () => {
        try {
          const eventData = getDataFn ? getDataFn(req, data) : data;
          await publishEvent(eventName, eventData);
        } catch (err) {
          console.error(`Failed to emit ${eventName}:`, err);
        }
      });
      
      return res;
    };
    
    next();
  };
};

/**
 * Helper to create event emitter for common patterns
 */
export const createEventEmitter = (entityType) => {
  return {
    created: emitAfterResponse(`${entityType}:created`, (req, data) => ({
      [`${entityType}Id`]: data._id,
      [entityType]: data,
      authorId: req.user?.id
    })),
    
    updated: emitAfterResponse(`${entityType}:updated`, (req, data) => ({
      [`${entityType}Id`]: req.params.id || data._id,
      [entityType]: data,
      authorId: req.user?.id
    })),
    
    deleted: emitAfterResponse(`${entityType}:deleted`, (req, data) => ({
      [`${entityType}Id`]: req.params.id,
      authorId: req.user?.id
    }))
  };
};

export default emitAfterResponse;
