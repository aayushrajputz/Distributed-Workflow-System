# 🚀 Workflow Management System with Integrated SaaS API Platform

A comprehensive workflow management system enhanced with a complete SaaS API platform for exposing functionality through secure, managed APIs.

## ✨ **Integrated Features**

### **Core Workflow Management**
- ✅ **Real-time Notes Collaboration** - Multi-user editing with Socket.io
- ✅ **Task Management** - Complete workflow and task tracking
- ✅ **User Authentication** - JWT-based secure authentication
- ✅ **MongoDB Atlas Integration** - Cloud-based data storage

### **SaaS API Platform** (NEW)
- ✅ **API Key Management** - Secure generation, storage, and management
- ✅ **Public API Endpoints** - RESTful APIs with rate limiting
- ✅ **Usage Analytics** - Comprehensive tracking and reporting
- ✅ **Rate Limiting** - Configurable per API key (100 requests/hour default)
- ✅ **Real-time Dashboard** - Modern Next.js UI with charts and analytics
- ✅ **Security Best Practices** - API key hashing, input validation, CORS

## 🏗️ **Project Structure**

```
project/
├── 📁 backend/                    # Node.js + Express + MongoDB Atlas
│   ├── controllers/               # Route handlers (enhanced with API features)
│   ├── middleware/                # Auth, rate limiting, usage logging
│   ├── models/                    # MongoDB models (User, Note, ApiKey, UsageLog)
│   ├── routes/                    # API routes (auth, notes, API keys, analytics)
│   ├── config/                    # Database and configuration
│   └── server.js                  # Main server file
│
└── 📁 frontend/                   # Next.js + TypeScript + Tailwind
    ├── app/                       # App router pages
    │   ├── dashboard/             # Main dashboard
    │   ├── api-keys/              # API key management (NEW)
    │   ├── analytics/             # Analytics dashboard (NEW)
    │   └── login/                 # Authentication (NEW)
    ├── components/                # React components
    └── lib/                       # API client and utilities
```

## 🚀 **Quick Start**

### **1. Backend Setup**
```bash
cd backend
npm install
npm run dev
```

### **2. Frontend Setup**
```bash
cd frontend
npm install
npm run dev
```

### **3. Access the Application**
- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api/docs

## 🔧 **Environment Configuration**

The backend uses MongoDB Atlas. Make sure your `.env` file in the backend directory contains:

```env
# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://workflow_user:aayush001@cluster1.2imlkaz.mongodb.net/workflow_management_system?retryWrites=true&w=majority&appName=Cluster1

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d

# API Key Configuration
API_KEY_SECRET=your-api-key-secret-for-hashing
API_KEY_LENGTH=32

# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

## 📊 **New API Platform Features**

### **API Key Management**
- Navigate to `/api-keys` in the dashboard
- Create, regenerate, and monitor API keys
- View usage statistics per key
- Configure permissions and rate limits

### **Analytics Dashboard**
- Navigate to `/analytics` for comprehensive insights
- Request volume trends and success rates
- Response time metrics and endpoint usage
- Real-time activity monitoring

### **Public API Endpoints**
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

- **API Key Hashing**: Keys stored securely with HMAC-SHA256
- **Rate Limiting**: Configurable per API key (default: 100 requests/hour)
- **Usage Tracking**: Every API request logged with comprehensive metrics
- **Permission System**: Read/write/admin permissions per API key
- **Input Validation**: Comprehensive validation on all endpoints

## 🧪 **Testing the System**

1. **Start both backend and frontend**
2. **Register/Login** at http://localhost:3000
3. **Create API Keys** in the dashboard
4. **Test Public API** endpoints with your API key
5. **Monitor Usage** in the analytics dashboard

## 📈 **What You Can Do Now**

1. **Manage API Keys** - Create, regenerate, and monitor API keys
2. **Expose Your Notes** - Allow external access to your notes system
3. **Track Usage** - Monitor who's using your API and how
4. **Rate Limiting** - Control access with configurable limits
5. **Analytics** - View detailed usage analytics and trends
6. **Secure Access** - All API access is authenticated and logged

---

**🎉 Your workflow management system now includes enterprise-grade API management capabilities while maintaining all existing functionality!** 🚀
