// ============================================
// utils/eventPublisher.js - Redis PubSub Event Publisher
// ============================================
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Redis Publisher Client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true // Không block app startup nếu Redis chưa sẵn sàng
});

// Event handlers
redis.on('connect', () => {
  console.log('✅ Redis Publisher connected');
});

redis.on('ready', () => {
  console.log('✅ Redis Publisher ready');
});

redis.on('error', (err) => {
  console.error('❌ Redis Publisher error:', err.message);
  // Don't throw - allow app to continue without Redis
});

redis.on('close', () => {
  console.log('⚠️  Redis Publisher connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis Publisher reconnecting...');
});

// Connect to Redis (non-blocking)
redis.connect().catch(err => {
  console.error('❌ Failed to connect to Redis:', err.message);
  console.log('⚠️  App will continue without Redis PubSub. Events will not be published.');
});

/**
 * Publish event to Redis channel
 * @param {string} channel - Event channel name (e.g., 'recipe:created', 'notification:created')
 * @param {object} data - Event data to publish
 * @returns {Promise<void>}
 */
export const publishEvent = async (channel, data) => {
  // Check if Redis is ready before publishing
  if (redis.status !== 'ready') {
    // If connecting, wait a bit
    if (redis.status === 'connecting') {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (redis.status !== 'ready') {
        return; // Still not ready, skip publishing
      }
    } else {
      return; // Not connected, skip publishing silently
    }
  }

  try {
    const message = JSON.stringify({
      ...data,
      timestamp: Date.now(),
      serverId: process.env.SERVER_ID || 'unknown'
    });

    await redis.publish(channel, message);
    console.log(`📢 Published event: ${channel}`);
  } catch (err) {
    // Log error but don't throw - don't break the main request flow
    console.error(`❌ Failed to publish to ${channel}:`, err.message);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  if (redis.status === 'ready') {
    console.log('🛑 Closing Redis Publisher connection...');
    await redis.quit();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (redis.status === 'ready') {
    console.log('🛑 Closing Redis Publisher connection...');
    await redis.quit();
  }
  process.exit(0);
});
