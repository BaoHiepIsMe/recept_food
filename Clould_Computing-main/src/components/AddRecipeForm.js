import { useState } from "react";
import axios from "axios";
import api from '../api';

export default function AddRecipeForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !ingredients || !instructions) return alert("Please fill all fields!");

    try {
      setLoading(true);
      const res = await api.post("/recipes", {
        title,
        ingredients,
        instructions,
      });
      onAdd(res.data); // Cập nhật danh sách ở App.js
      setTitle("");
      setIngredients("");
      setInstructions("");
    } catch (err) {
      console.error(err);
      alert("Error adding recipe!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white shadow-md rounded-2xl p-6 mb-10 border border-orange-200"
    >
      <h2 className="text-2xl font-semibold text-orange-700 mb-4">📝 Add a New Recipe</h2>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="e.g. Spaghetti Bolognese"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">Ingredients</label>
        <textarea
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          className="w-full p-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
          rows="2"
          placeholder="e.g. Pasta, Beef, Tomato sauce..."
        ></textarea>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className="w-full p-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
          rows="3"
          placeholder="e.g. Boil pasta, cook beef, mix with sauce..."
        ></textarea>
      </div>

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-2 rounded-lg font-semibold text-white transition ${
          loading
            ? "bg-orange-300 cursor-not-allowed"
            : "bg-orange-500 hover:bg-orange-600"
        }`}
      >
        {loading ? "Adding..." : "Add Recipe"}
      </button>
    </form>
  );
}
