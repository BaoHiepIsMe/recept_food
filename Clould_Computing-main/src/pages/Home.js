import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchRecipes = async (query = '') => {
    try {
      setLoading(true);
      const endpoint = query ? `/recipes/search?q=${query}` : '/recipes';
      const res = await api.get(endpoint);
      setRecipes(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
    
    // Real-time polling: refresh every 3 seconds
    const interval = setInterval(() => {
      fetchRecipes(search);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [search]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchRecipes(search);
  };

  const handleRecipeClick = (recipeId) => {
    navigate(`/recipe/${recipeId}`);
  };

  return (
    <div>
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-yellow-600 mb-4">
          🍳 Discover Amazing Recipes
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Share your favorite recipes and discover new culinary adventures
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search recipes by name or ingredients..."
              className="flex-grow p-4 rounded-xl border-2 border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-400 text-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="submit"
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-yellow-600 transition shadow-lg"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Recipes Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Loading recipes...</p>
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-2xl text-gray-500 mb-4">🍲 No recipes found</p>
          <p className="text-gray-400">Try a different search term or add a new recipe!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <div
              key={recipe._id}
              onClick={() => handleRecipeClick(recipe._id)}
              className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-orange-100 group cursor-pointer"
            >
              {/* Recipe Image */}
              {recipe.image ? (
                <div className="h-48 overflow-hidden">
                  <img
                    src={recipe.image}
                    alt={recipe.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="h-48 bg-gradient-to-br from-orange-200 to-yellow-200 flex items-center justify-center">
                  <span className="text-6xl">🍳</span>
                </div>
              )}

              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-3">{recipe.title}</h2>

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

