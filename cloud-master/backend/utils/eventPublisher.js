// ============================================
// utils/eventPublisher.js - Redis Publisher
// ============================================
import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => Math.min(times * 50, 2000)
});

redis.on('connect', () => {
  console.log('✅ Redis Publisher connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis Publisher error:', err);
});

/**
 * Publish event to Redis channel
 * @param {string} channel - Event channel name
 * @param {object} data - Event data
 */
export const publishEvent = async (channel, data) => {
  try {
    await redis.publish(channel, JSON.stringify(data));
    console.log(`📤 Published to ${channel}:`, data);
  } catch (err) {
    console.error(`❌ Failed to publish to ${channel}:`, err);
  }
};

export default redis;
