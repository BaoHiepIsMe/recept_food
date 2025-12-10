import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Notifications from './Notifications';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-3xl">🍳</span>
              <span className="text-2xl font-bold text-orange-600">RecipeShare</span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center space-x-1">
              <Link
                to="/"
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  isActive('/')
                    ? 'bg-orange-500 text-white'
                    : 'text-gray-700 hover:bg-orange-100'
                }`}
              >
                Home
              </Link>
              {user && (
                <>
                  <Link
                    to="/favorites"
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      isActive('/favorites')
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-700 hover:bg-orange-100'
                    }`}
                  >
                    ❤️ Favorites
                  </Link>
                  <Link
                    to="/my-recipes"
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      isActive('/my-recipes')
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-700 hover:bg-orange-100'
                    }`}
                  >
                    📝 My Recipes
                  </Link>
                  <Link
                    to="/blog"
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      isActive('/blog')
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-700 hover:bg-orange-100'
                    }`}
                  >
                    ✍️ Blog
                  </Link>
                </>
              )}
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Notifications />
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 px-4 py-2 rounded-lg hover:bg-orange-100 transition"
                  >
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {user.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="hidden md:block text-gray-700 font-medium">
                      {user.name || 'User'}
                    </span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link
                    to="/login"
                    className="px-4 py-2 text-gray-700 hover:text-orange-600 font-medium transition"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden border-t border-gray-200">
          <div className="px-4 py-2 space-y-1">
            <Link
              to="/"
              className={`block px-4 py-2 rounded-lg ${
                isActive('/') ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-orange-100'
              }`}
            >
              Home
            </Link>
            {user && (
              <>
                <Link
                  to="/favorites"
                  className={`block px-4 py-2 rounded-lg ${
                    isActive('/favorites')
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-700 hover:bg-orange-100'
                  }`}
                >
                  ❤️ Favorites
                </Link>
                <Link
                  to="/my-recipes"
                  className={`block px-4 py-2 rounded-lg ${
                    isActive('/my-recipes')
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-700 hover:bg-orange-100'
                  }`}
                >
                  📝 My Recipes
                </Link>
                <Link
                  to="/blog"
                  className={`block px-4 py-2 rounded-lg ${
                    isActive('/blog')
                      ? 'bg-orange-500 text-white'
                      : 'text-gray-700 hover:bg-orange-100'
                  }`}
                >
                  ✍️ Blog
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

