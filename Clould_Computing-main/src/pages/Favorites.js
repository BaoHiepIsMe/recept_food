import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Favorites() {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchFavorites();
  }, [user, navigate]);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const res = await api.get('/recipes/favorites');
      setRecipes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (recipeId) => {
    try {
      await api.delete(`/recipes/${recipeId}/favorite`);
      fetchFavorites();
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-red-600 mb-2">
          ❤️ My Favorite Recipes
        </h1>
        <p className="text-gray-600">Recipes you've saved for later</p>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Loading favorites...</p>
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-lg">
          <span className="text-6xl mb-4 block">💔</span>
          <p className="text-2xl text-gray-500 mb-2">No favorites yet</p>
          <p className="text-gray-400">Start exploring recipes and add them to your favorites!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <div
              key={recipe._id}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-red-100"
            >
              {recipe.image ? (
                <div className="h-48 overflow-hidden">
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-red-200 to-pink-200 flex items-center justify-center">
                  <span className="text-6xl">🍳</span>
                </div>
              )}

              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h2 className="text-2xl font-bold text-gray-800 flex-1">{recipe.title}</h2>
                  <button
                    onClick={() => handleRemoveFavorite(recipe._id)}
                    className="ml-2 text-2xl text-red-500 hover:text-red-600 transition"
                    title="Remove from favorites"
                  >
                    ❤️
                  </button>
                </div>

                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  <strong className="text-orange-600">Ingredients:</strong> {recipe.ingredients}
                </p>
                <p className="text-gray-700 text-sm mb-4 line-clamp-3">{recipe.instructions}</p>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>By {recipe.author || 'Anonymous'}</span>
                  <span>{new Date(recipe.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

