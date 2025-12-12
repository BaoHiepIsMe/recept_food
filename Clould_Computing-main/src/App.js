import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import websocketService from './services/websocket';
import Layout from './components/Layout';
import Home from './pages/Home';
import Favorites from './pages/Favorites';
import MyRecipes from './pages/MyRecipes';
import Blog from './pages/Blog';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import RecipeDetail from './pages/RecipeDetail';
import './App.css';

function App() {
  useEffect(() => {
    // Connect to WebSocket PubSub server
    websocketService.connect();
    
    // Listen for ANY data changes
    const unsubscribe = websocketService.on('*', ({ channel, data }) => {
      console.log(`🔔 Global event received: ${channel}`, data);
      
      // Dispatch browser event for backward compatibility
      window.dispatchEvent(new CustomEvent('dataChanged', { 
        detail: { 
          channel,
          ...data,
          timestamp: Date.now()
        } 
      }));
    });
    
    return () => {
      unsubscribe();
      websocketService.disconnect();
    };
  }, []);

  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/recipe/:id" element={<RecipeDetail />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/my-recipes" element={<MyRecipes />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;
