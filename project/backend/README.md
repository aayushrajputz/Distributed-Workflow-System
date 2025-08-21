# Distributed Notes Collaboration System - Backend

A real-time collaborative notes system built with Node.js, Express, MongoDB Atlas, and Socket.io.

## Features

- 🔐 **User Authentication** - JWT-based auth with bcrypt password hashing
- 📝 **Notes CRUD** - Full create, read, update, delete operations
- 🤝 **Real-time Collaboration** - Multiple users can edit notes simultaneously
- 🔒 **Role-based Sharing** - Owner can grant read/write access to others
- 🌐 **Distributed Sync** - Notes sync across all connected clients
- 🚀 **Production Ready** - Configured for Railway, Render, and Heroku

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **Real-time**: Socket.io
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Security**: helmet, cors, rate-limiting

## Quick Start

### 1. Installation

```bash
cd backend
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `MONGODB_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `CLIENT_URL` - Frontend URL for CORS

### 3. Development

```bash
npm run dev
```

Server will start at `http://localhost:5000`

### 4. Production

```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile

### Notes
- `GET /api/notes` - Get user's notes (with pagination, search, tags)
- `GET /api/notes/:id` - Get specific note
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note

### Sharing
- `POST /api/notes/:id/share` - Share note with user
- `GET /api/notes/:id/collaborators` - Get note collaborators
- `PUT /api/notes/:id/share/:userId` - Update collaborator permission
- `DELETE /api/notes/:id/share/:userId` - Remove collaborator
- `GET /api/notes/shared` - Get notes shared with current user

## Socket.io Events

### Client to Server
- `join-note` - Join note room for real-time editing
- `content-change` - Send content changes
- `cursor-position` - Send cursor position
- `save-note` - Save note changes
- `typing-start/stop` - Typing indicators

### Server to Client
- `joined-note` - Confirmation of joining note room
- `content-changed` - Receive content changes from others
- `cursor-updated` - Receive cursor positions
- `note-saved` - Note save confirmation
- `user-joined/left` - User presence updates
- `user-typing` - Typing indicators

## Deployment

### Railway

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

### Render

1. Create new Web Service on Render
2. Connect GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables

### Heroku

1. Install Heroku CLI
2. Create Heroku app:
```bash
heroku create your-app-name
```
3. Set environment variables:
```bash
heroku config:set MONGODB_URI=your-mongodb-uri
heroku config:set JWT_SECRET=your-jwt-secret
```
4. Deploy:
```bash
git push heroku main
```

## MongoDB Atlas Setup

1. Create MongoDB Atlas account
2. Create new cluster
3. Create database user
4. Whitelist IP addresses (0.0.0.0/0 for production)
5. Get connection string and add to `MONGODB_URI`

## Security Features

- Helmet.js for security headers
- CORS protection
- Rate limiting (100 requests per 15 minutes)
- JWT token authentication
- Password hashing with bcrypt
- Input validation and sanitization
- MongoDB injection protection

## Project Structure

```
backend/
├── config/          # Database and JWT configuration
├── controllers/     # Route handlers
├── middleware/      # Custom middleware
├── models/          # MongoDB schemas
├── routes/          # API routes
├── sockets/         # Socket.io handlers
├── utils/           # Utility functions
├── .env.example     # Environment variables template
├── .gitignore       # Git ignore rules
├── package.json     # Dependencies and scripts
└── server.js        # Main server file
```

## Development Scripts

- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## License

MIT License - see LICENSE file for details
