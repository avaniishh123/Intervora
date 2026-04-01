# Intervora – AI-Powered Interview Practice Platform

Intervora is an AI-powered interview practice platform designed to simulate real-world job interviews, evaluate candidate responses, and provide detailed feedback. It is built primarily for candidates preparing for technical roles and leverages Google Gemini AI as its core intelligence engine.

---

## Overview

Intervora enables users to experience realistic interview environments through multiple simulation modes, real-time feedback, and performance analytics. It combines AI-driven evaluation, coding environments, and interactive UI elements to enhance interview preparation.

---

## Tech Stack

### Frontend

* React 18 + TypeScript
* Vite
* Zustand
* Socket.io-client
* React Three Fiber (3D avatar)
* Monaco Editor (code challenges)
* Chart.js

### Backend

* Node.js + Express + TypeScript
* MongoDB + Mongoose
* Socket.io
* JWT Authentication
* Google Gemini AI SDK
* Multer (file uploads)

### Infrastructure

* Vercel (hosting)
* MongoDB Atlas
* AWS S3 (file storage)
* GitHub Actions (CI/CD)
* Docker support

---

## Interview Modes

* **Resume-Based**
  Upload a resume and receive personalized interview questions based on experience.

* **JD-Based**
  Paste a job description to generate role-specific questions.

* **General**
  Standard interview questions based on selected role categories.

* **Panel Interview**
  Multi-interviewer simulation environment.

* **Company Interview**
  Company-specific interview simulations.

* **Simulation Interview**
  Task-based evaluation (coding, analysis, etc.).

* **Hybrid Interview**
  Combines real interviewer interaction with AI evaluation, including waiting room and panel system.

* **Contest Mode**
  Competitive interview challenges with live leaderboard.

---

## Core Features

### Candidate-Facing

* 3D animated avatar interviewer
* Voice recording with real-time transcription
* Integrated Monaco Editor (Python, JavaScript, Java, C++)
* Mentor Mode using CAR (Context-Action-Result) framework
* Per-question scoring (0–100) with detailed AI feedback
* Strengths and improvement suggestions
* Sentiment analysis (confidence, clarity, professionalism)
* Session recording with video playback
* Performance charts and analytics
* Global and role-based leaderboard
* Session history with past reports
* Resume analysis with skill extraction and JD matching
* Interview proctoring overlay

---

### Admin-Facing

* User management (view, edit, suspend/activate)
* Session analytics with filters
* Data export (CSV, JSON, Excel)
* System monitoring and error tracking

---

## Backend Services

* **geminiService** – AI-based question generation and answer evaluation
* **ResumeAnalyzer** – Resume parsing and skill extraction
* **CodeExecutor** – Sandboxed code execution
* **CodeValidator** – Code quality validation
* **SimulationEvaluator** – Task-based evaluation engine
* **HybridEvaluationService** – Hybrid interview scoring
* **LeaderboardService** – Ranking system
* **PerformanceAnalyzer** – Generates detailed reports
* **RecordingService** – Handles session recordings
* **ragService** – Retrieval-Augmented Generation for contextual AI responses
* **AnalyticsService** – Platform analytics
* **ExportService** – Data export functionality

---

## Simulation Task Categories

Pre-built task banks are available for:

* Coding
* Coding QA
* AI / ML
* Data Science
* DevOps
* Cloud Computing
* Cybersecurity

---

## Security

* JWT-based authentication
* bcrypt password hashing
* Rate limiting
* CORS configuration
* Input sanitization
* File upload restrictions
* HTTPS enforcement

---

## Routing

The application includes 30+ routes covering:

* Authentication
* All interview modes
* Admin panel
* Hybrid sessions
* Contest system
* Reporting and analytics

All routes are protected using role-based access control via ProtectedRoute.

---

## Architecture Diagram Explanation

<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/572bc3a0-f930-4d5d-b844-a845e65eb71e" />


1. **User Interaction Layer**
   Candidates interact via a React-based frontend with features like 3D avatar, voice input, and coding editor, sending requests through REST APIs and WebSockets.

2. **Frontend Layer**
   Built with React, TypeScript, and Socket.io, it handles UI rendering, real-time updates, code editor, and performance visualization.

3. **Backend Orchestration Layer**
   Node.js + Express manages authentication (JWT), routing, and coordinates multiple services like evaluation, resume parsing, and leaderboard management.

4. **AI Processing Layer (Gemini AI)**
   Backend communicates with Google Gemini AI for generating interview questions, evaluating answers, scoring, and providing feedback.

5. **Data & Storage Layer**
   MongoDB Atlas stores user data, sessions, and analytics, while AWS S3 handles file storage like resumes and recordings.

6. **Infrastructure & Admin Layer**
   Vercel hosts the frontend, Docker and GitHub Actions manage deployment, and the admin dashboard provides analytics, monitoring, and user control.



## Some Glimpses of Website

<img width="931" height="451" alt="image" src="https://github.com/user-attachments/assets/c5ffba64-1f35-4da8-ac19-732a94f2cdb9" />
<img width="1054" height="826" alt="Screenshot 2026-03-31 092148" src="https://github.com/user-attachments/assets/d0df4d02-fa53-48ec-a80b-52be918930c3" />
<img width="671" height="916" alt="Screenshot 2026-03-31 092202" src="https://github.com/user-attachments/assets/af338813-6fba-4eda-99be-848cd3094a50" />
<img width="1024" height="639" alt="image" src="https://github.com/user-attachments/assets/e31eed30-7d5a-429b-8965-16d9c2062ff8" />


## Project Showcase

Check out the live project and demo:

Website → https://intervora-mpgf.vercel.app
Demo Video → https://drive.google.com/file/d/1I_0GMYF-jv5pz8HYEMIAITaIR-1uOx1r/view?usp=sharing


## Authentication Note

* The platform uses **JWT-based authentication** with access tokens expiring every **15 minutes**.
* Upon expiration, tokens are refreshed, which may occasionally cause a **slight delay during re-login (~1 minute)** depending on backend cold starts or network conditions.

---

## Future Improvements

* **Hybrid Interview Enhancements**

  * Strengthening real-time human + AI interaction using WebSockets
  * Improving interviewer panel communication and responsiveness

* **Simulation Interview Upgrades**

  * Integrating fully **real-time Monaco code editor execution**
  * Enhancing evaluation accuracy for coding and system design tasks
  * Making simulations more **realistic and industry-aligned**

* **Performance & Scalability**

  * Optimizing backend response times
  * Reducing authentication latency during token refresh
  * Improving concurrency handling for large-scale users

* **AI Enhancements**

  * More advanced answer evaluation using context-aware reasoning
  * Better feedback personalization using RAG pipelines


## Summary

Intervora is a comprehensive interview preparation platform that combines AI-driven question generation, real-time evaluation, multi-mode simulations, and competitive elements. It delivers a highly interactive experience through a modern React frontend enhanced with a 3D avatar interviewer and robust backend services.
