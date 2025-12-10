export default function RecipeList({ recipes }) {
    if (recipes.length === 0)
      return <p className="text-center text-gray-500 mt-10">No recipes found 🍲</p>;
  
    return (
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
        {recipes.map((r) => (
          <div
            key={r._id}
            className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition p-4 border border-orange-100"
          >
            <h2 className="text-xl font-semibold text-orange-700 mb-2">{r.title}</h2>
            <p className="text-gray-600 text-sm mb-2">
              <strong>Ingredients:</strong> {r.ingredients}
            </p>
            <p className="text-gray-700 text-sm">{r.instructions}</p>
          </div>
        ))}
      </div>
    );
  }
  