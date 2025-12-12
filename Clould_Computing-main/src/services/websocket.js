// ============================================
// src/services/websocket.js - WebSocket Client
// ============================================
import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  connect() {
    // Connect to EC2 D (PubSub Server)
    const PUBSUB_URL = process.env.REACT_APP_PUBSUB_URL || 'http://localhost:4000';
    
    this.socket = io(PUBSUB_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected to PubSub server');
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 WebSocket reconnected after ${attemptNumber} attempts`);
      this.connected = true;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error.message);
    });

    // Listen for dataChanged events from server
    this.socket.on('dataChanged', (payload) => {
      console.log('📥 Received dataChanged event:', payload);
      
      const { channel, data } = payload;
      
      // Notify all registered listeners
      if (this.listeners.has(channel)) {
        this.listeners.get(channel).forEach(callback => {
          callback(data);
        });
      }
      
      // Also notify generic listeners
      if (this.listeners.has('*')) {
        this.listeners.get('*').forEach(callback => {
          callback({ channel, data });
        });
      }
    });

    return this;
  }

  /**
   * Subscribe to specific channel
   * @param {string} channel - Channel name (e.g., 'recipe:created')
   * @param {function} callback - Callback function
   */
  on(channel, callback) {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, []);
    }
    this.listeners.get(channel).push(callback);
    
    console.log(`👂 Subscribed to ${channel}`);
    
    // Return unsubscribe function
    return () => this.off(channel, callback);
  }

  /**
   * Unsubscribe from channel
   */
  off(channel, callback) {
    if (this.listeners.has(channel)) {
      const callbacks = this.listeners.get(channel);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
      
      if (callbacks.length === 0) {
        this.listeners.delete(channel);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.listeners.clear();
      console.log('🔌 WebSocket disconnected');
    }
  }

  isConnected() {
    return this.connected;
  }
}

// Singleton instance
const websocketService = new WebSocketService();

export default websocketService;
