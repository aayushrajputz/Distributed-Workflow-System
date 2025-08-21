# 🚀 Workflow Management System with Integrated SaaS API Platform

A comprehensive workflow management system enhanced with a complete SaaS API platform for exposing functionality through secure, managed APIs.

## ✨ **Integrated Features**

### **Core Workflow Management**
- ✅ **Real-time Notes Collaboration** - Multi-user editing with Socket.io
- ✅ **Task Management** - Complete workflow and task tracking
- ✅ **User Authentication** - JWT-based secure authentication
- ✅ **MongoDB Integration** - Document-based data storage

### **SaaS API Platform** (NEW)
- ✅ **API Key Management** - Secure generation, storage, and management
- ✅ **Public API Endpoints** - RESTful APIs with rate limiting
- ✅ **Usage Analytics** - Comprehensive tracking and reporting
- ✅ **Rate Limiting** - Configurable per API key (100 requests/hour default)
- ✅ **Real-time Dashboard** - Modern Next.js UI with charts and analytics
- ✅ **Security Best Practices** - API key hashing, input validation, CORS

## 🏗️ **Architecture**

![Flowchart](./A_flowchart_diagram_depicts_a_distributed_workflow.png)

```
Workflow Management System
├── Backend (Node.js + Express + MongoDB)
│   ├── Original Features: Notes, Tasks, Real-time collaboration
│   ├── NEW: API Key management
│   ├── NEW: Public API endpoints (/api/v1/*)
│   ├── NEW: Usage analytics and logging
│   └── NEW: Rate limiting middleware
│
└── Frontend (Next.js + TypeScript + Tailwind)
    ├── Original Features: Dashboard, Workflows, Tasks
    ├── NEW: API Keys management page
    ├── NEW: Analytics dashboard with charts
    └── NEW: Integrated metrics in main dashboard
```

## 🚀 **Quick Start**

### **1. Backend Setup**
```bash
cd backend
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB connection and secrets

# Start the server
npm run dev
```

### **2. Frontend Setup**
```bash
cd frontend
npm install

# Start the development server
npm run dev
```

### **3. Access the Application**
- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api/docs

### **4. Login**
Use the demo credentials or register a new account:
- **Demo Email**: `demo@example.com`
- **Demo Password**: `DemoPass123!`

## 📊 **New API Platform Features**

### **API Key Management**
Navigate to `/api-keys` in the dashboard to:
- Create new API keys with custom permissions
- View usage statistics per key
- Regenerate or revoke keys
- Monitor rate limits and performance

### **Analytics Dashboard**
Navigate to `/analytics` to view:
- Request volume trends
- Success/error rates
- Response time metrics
- Top endpoints usage
- Real-time activity logs

### **Public API Endpoints**
Access your notes programmatically:

```bash
# Get notes
curl -H "X-API-Key: sk_your_api_key_here" \
     http://localhost:5000/api/v1/notes

# Create a note
curl -X POST \
     -H "X-API-Key: sk_your_api_key_here" \
     -H "Content-Type: application/json" \
     -d '{"title":"API Note","content":"Created via API"}' \
     http://localhost:5000/api/v1/notes

# Get analytics
curl -H "X-API-Key: sk_your_api_key_here" \
     http://localhost:5000/api/v1/analytics

# Check API status
curl -H "X-API-Key: sk_your_api_key_here" \
     http://localhost:5000/api/v1/status
```

## 🔐 **Security Features**

### **API Key Security**
- Keys are hashed using HMAC-SHA256 before storage
- Prefixed with `sk_` for easy identification
- Only displayed once upon creation
- Secure regeneration process

### **Rate Limiting**
- Configurable per API key (default: 100 requests/hour)
- Rate limit headers in responses
- Automatic cleanup of old rate limit records

### **Authentication**
- JWT tokens for dashboard access
- API key authentication for public endpoints
- Input validation and sanitization
- CORS protection

## 📈 **Usage Analytics**

The system tracks comprehensive usage analytics:
- **Request Counts** - Total API requests per user/key
- **Response Times** - Average response times per endpoint
- **Success Rates** - Success vs error rates
- **Endpoint Usage** - Most popular endpoints
- **Daily Trends** - Usage patterns over time
- **Error Tracking** - Failed requests and error types

## 🛠️ **API Endpoints**

### **Dashboard API (JWT Auth)**
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/keys` - Get API keys
- `POST /api/keys` - Create API key
- `GET /api/analytics/dashboard` - Get analytics data

### **Public API (API Key Auth)**
- `GET /api/v1/notes` - Get user notes
- `POST /api/v1/notes` - Create note
- `GET /api/v1/notes/:id` - Get specific note
- `PUT /api/v1/notes/:id` - Update note
- `DELETE /api/v1/notes/:id` - Delete note
- `GET /api/v1/analytics` - Get analytics
- `GET /api/v1/status` - Get API status

## 🔧 **Environment Variables**

Create a `.env` file in the backend directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/workflow_management

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d

# API Keys
API_KEY_SECRET=your-api-key-secret-for-hashing
API_KEY_LENGTH=32

# Server
PORT=5000
NODE_ENV=development

# CORS
CLIENT_URL=http://localhost:3000
```

## 📁 **Project Structure**

```
workflow-management-system/
├── backend/                    # Node.js + Express + MongoDB
│   ├── controllers/           # Route handlers
│   │   ├── authController.js  # Authentication
│   │   ├── noteController.js  # Notes management
│   │   ├── apiKeyController.js # API key management (NEW)
│   │   ├── analyticsController.js # Analytics (NEW)
│   │   └── publicApiController.js # Public API (NEW)
│   ├── middleware/            # Custom middleware
│   │   ├── auth.js           # JWT authentication
│   │   ├── apiKeyAuth.js     # API key authentication (NEW)
│   │   ├── rateLimiter.js    # Rate limiting (NEW)
│   │   └── usageLogger.js    # Usage logging (NEW)
│   ├── models/               # MongoDB models
│   │   ├── User.js          # User model
│   │   ├── Note.js          # Note model
│   │   ├── ApiKey.js        # API key model (NEW)
│   │   └── UsageLog.js      # Usage log model (NEW)
│   ├── routes/              # API routes
│   │   ├── auth.js         # Auth routes
│   │   ├── notes.js        # Notes routes
│   │   ├── apiKeys.js      # API key routes (NEW)
│   │   ├── analytics.js    # Analytics routes (NEW)
│   │   └── publicApi.js    # Public API routes (NEW)
│   └── server.js           # Main server file
│
├── frontend/                  # Next.js + TypeScript + Tailwind
│   ├── app/                  # App router pages
│   │   ├── dashboard/       # Dashboard pages
│   │   ├── api-keys/        # API key management (NEW)
│   │   ├── analytics/       # Analytics dashboard (NEW)
│   │   └── login/          # Login page (NEW)
│   ├── components/          # React components
│   │   ├── ui/             # UI components
│   │   └── sidebar.tsx     # Navigation (UPDATED)
│   └── lib/                # Utilities
│       └── api.ts          # API client (ENHANCED)
│
└── README.md               # This file
```

## 🧪 **Testing the API**

### **1. Register and Login**
```bash
# Register a new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","password":"TestPass123!"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123!"}'
```

### **2. Create API Key**
```bash
# Create API key (use JWT token from login)
curl -X POST http://localhost:5000/api/keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test API Key","permissions":["read","write"]}'
```

### **3. Use Public API**
```bash
# Test public API endpoints
curl -H "X-API-Key: sk_your_api_key_here" \
     http://localhost:5000/api/v1/status
```

## 🚀 **Deployment**

The system is ready for production deployment with:
- Environment-based configuration
- Security best practices
- Rate limiting and monitoring
- Comprehensive error handling
- Usage analytics and logging

## 📞 **Support**

- **API Documentation**: http://localhost:5000/api/docs
- **Health Check**: http://localhost:5000/health
- **Frontend**: http://localhost:3000

---

**🎉 The workflow management system now includes a complete SaaS API platform, allowing you to expose your notes and workflow functionality through secure, managed APIs with comprehensive analytics and monitoring!**
