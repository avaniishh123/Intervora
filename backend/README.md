# AI Interview Maker Backend v2.0

Enhanced backend with Google Gemini AI integration, TypeScript, and comprehensive interview features.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB or PostgreSQL
- Google Gemini API key

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env and add your configuration
# - GEMINI_API_KEY
# - JWT_SECRET
# - DATABASE_URL
```

### Development

```bash
# Run in development mode with hot reload
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic (Gemini AI, etc.)
│   ├── models/         # Database models
│   ├── middleware/     # Express middleware
│   ├── utils/          # Helper functions
│   ├── config/         # Configuration files
│   └── server.ts       # Main entry point
├── dist/               # Compiled JavaScript (generated)
├── .env.example        # Environment variables template
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

## 🔧 Configuration

See `.env.example` for all available configuration options.

## 📡 API Endpoints

- `GET /health` - Health check
- `GET /api` - API information
- `/api/auth` - Authentication endpoints
- `/api/sessions` - Interview session management
- `/api/gemini` - Gemini AI operations
- `/api/resume` - Resume upload and analysis
- `/api/coding` - Coding challenges
- `/api/admin` - Admin dashboard

## 🧪 Testing

```bash
npm test
```

## 📝 License

ISC
