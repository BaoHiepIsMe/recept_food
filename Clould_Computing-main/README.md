# RecipeShare - Modern Recipe Sharing Platform

A beautiful, modern web application for sharing and discovering recipes.

## Features

- 🏠 **Home Page**: Browse all recipes with search functionality
- ❤️ **Favorites**: Save your favorite recipes
- 📝 **My Recipes**: Manage your own recipes (Create, Read, Update, Delete) with image upload
- ✍️ **Blog**: Share your culinary stories and experiences
- 👤 **Profile**: Manage your personal information
- 🔐 **Authentication**: Secure login and registration

## Tech Stack

- **Frontend**: React, React Router, Tailwind CSS, Axios
- **Backend**: Node.js, Express, MongoDB, Mongoose
- **Authentication**: JWT
- **File Upload**: Multer

## Setup Instructions

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file in the root directory:
```
REACT_APP_API_URL=http://localhost:5000/api
```

3. Start the development server:
```bash
npm start
```

The app will run on `http://localhost:3000`

### Backend Setup

1. Navigate to backend directory:
```bash
cd ../cloud-master/backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```
MONGO_URI=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your-secret-key-change-this-in-production
```

4. Create `uploads` directory for file uploads:
```bash
mkdir uploads
```

5. Start the server:
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The API will run on `http://localhost:5000`

## Project Structure

```
Clould_Computing-main/
├── src/
│   ├── components/
│   │   └── Layout.js          # Navigation and layout
│   ├── pages/
│   │   ├── Home.js            # Home page with all recipes
│   │   ├── Favorites.js      # Favorite recipes
│   │   ├── MyRecipes.js      # User's recipes management
│   │   ├── Blog.js           # Blog posts
│   │   ├── Login.js          # Login page
│   │   ├── Register.js       # Registration page
│   │   └── Profile.js        # User profile
│   ├── context/
│   │   └── AuthContext.js    # Authentication context
│   ├── api.js                # API configuration
│   └── App.js                # Main app component with routing

cloud-master/backend/
├── models/
│   ├── User.js               # User model
│   ├── Recipe.js             # Recipe model
│   └── Blog.js               # Blog model
├── routes/
│   ├── authRoutes.js         # Authentication routes
│   ├── recipeRoutes.js       # Recipe routes
│   └── blogRoutes.js        # Blog routes
├── middleware/
│   └── auth.js               # Authentication middleware
└── server.js                 # Express server
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Recipes
- `GET /api/recipes` - Get all recipes
- `GET /api/recipes/search?q=query` - Search recipes
- `GET /api/recipes/my` - Get user's recipes (authenticated)
- `GET /api/recipes/favorites` - Get favorite recipes (authenticated)
- `POST /api/recipes` - Create recipe (authenticated)
- `PUT /api/recipes/:id` - Update recipe (authenticated)
- `DELETE /api/recipes/:id` - Delete recipe (authenticated)
- `POST /api/recipes/:id/favorite` - Toggle favorite (authenticated)
- `DELETE /api/recipes/:id/favorite` - Remove favorite (authenticated)

### Blogs
- `GET /api/blogs` - Get all blogs
- `GET /api/blogs/my` - Get user's blogs (authenticated)
- `POST /api/blogs` - Create blog (authenticated)
- `PUT /api/blogs/:id` - Update blog (authenticated)
- `DELETE /api/blogs/:id` - Delete blog (authenticated)

## Notes

- Make sure MongoDB is running and accessible
- Update the `MONGO_URI` in backend `.env` with your MongoDB connection string
- The `uploads` directory will be created automatically when the server starts
- Images are served from `/uploads` endpoint
