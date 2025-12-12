import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle responses and track Server ID
api.interceptors.response.use(
  (response) => {
    // Extract Server ID from response header
    const serverId = response.headers['x-server-id'];
    if (serverId) {
      // Store in localStorage for persistence
      localStorage.setItem('currentServerId', serverId);
      // Dispatch custom event for components to listen
      window.dispatchEvent(new CustomEvent('serverIdUpdate', { detail: serverId }));
    }

    // Check if this is a CRUD operation (POST, PUT, PATCH, DELETE)
    const method = response.config.method?.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      // Dispatch data change event to trigger UI refresh
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { 
          method,
          url: response.config.url,
          timestamp: Date.now()
        } 
      }));
    }
    
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if not already on login/register page
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
