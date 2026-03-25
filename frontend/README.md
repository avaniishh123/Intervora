# AI Interview Maker 2.0 - Frontend

React-based frontend application for the AI Interview Maker platform with Google Gemini AI integration.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client with interceptors
- **Socket.io Client** - Real-time communication
- **Zustand** - State management
- **React Hook Form** - Form handling
- **React Three Fiber** - 3D avatar rendering
- **Monaco Editor** - Code editor for coding challenges
- **Chart.js** - Performance visualizations
- **Canvas Confetti** - Celebration animations

## Project Structure

```
src/
├── components/     # Reusable React components
├── pages/          # Page components (routes)
├── services/       # API and Socket.io services
├── hooks/          # Custom React hooks
├── store/          # Zustand state management
├── types/          # TypeScript type definitions
├── utils/          # Helper functions and constants
├── App.tsx         # Main app component
└── main.tsx        # Application entry point
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your backend API URL:
```
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### Development

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Features

### Implemented

- ✅ Project structure with TypeScript
- ✅ Axios instance with JWT authentication interceptors
- ✅ Socket.io service for real-time communication
- ✅ Zustand store for authentication state
- ✅ Type definitions for all data models
- ✅ Utility functions and constants
- ✅ Environment configuration

### To Be Implemented

- ⏳ Authentication pages (Login/Signup)
- ⏳ Interview setup interface
- ⏳ 3D Avatar with React Three Fiber
- ⏳ Interview interaction components
- ⏳ Monaco Editor integration for coding challenges
- ⏳ Performance results and charts
- ⏳ Admin dashboard
- ⏳ Candidate dashboard
- ⏳ Leaderboard

## API Integration

The frontend communicates with the backend through:

1. **REST API** - HTTP requests via Axios
   - Authentication endpoints
   - Resume upload and analysis
   - Session management
   - Coding challenges
   - Admin operations

2. **WebSocket** - Real-time updates via Socket.io
   - Live question delivery
   - Answer evaluation results
   - Score updates
   - Session notifications

## Authentication Flow

1. User logs in → receives JWT access token and refresh token
2. Access token stored in localStorage
3. Axios interceptor adds token to all requests
4. On 401 error, interceptor attempts token refresh
5. If refresh fails, user redirected to login

## State Management

Using Zustand for lightweight state management:

- **authStore** - User authentication state
- Additional stores will be added as needed

## Development Guidelines

- Use TypeScript for all new files
- Follow React best practices and hooks patterns
- Use functional components with hooks
- Implement proper error handling
- Add loading states for async operations
- Ensure responsive design for all components
- Test components before committing

## Environment Variables

- `VITE_API_URL` - Backend API base URL
- `VITE_SOCKET_URL` - Socket.io server URL
- `VITE_ENV` - Environment (development/production)

## Next Steps

Refer to the implementation plan in `.kiro/specs/ai-interview-maker-gemini-enhancement/tasks.md` for upcoming tasks.
