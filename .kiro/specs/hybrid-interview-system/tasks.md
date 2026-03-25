# Tasks — Hybrid AI Interview System

All tasks are strictly additive. No existing files were modified.

## Status Key
- [x] Done
- [ ] Pending (manual step required)

---

## Backend

- [x] `backend/src/models/HybridSession.ts` — Mongoose model with messages, evaluations, indexes
- [x] `backend/src/models/ContestLeaderboard.ts` — Contest rankings model
- [x] `backend/src/services/HybridEvaluationService.ts` — Four-dimension AI evaluation (wraps geminiService)
- [x] `backend/src/socket/hybridSocket.ts` — `/hybrid-interview` Socket.io namespace
- [x] `backend/src/controllers/HybridController.ts` — REST controller (createSession, getSession, createContest, getLeaderboard)
- [x] `backend/src/routes/hybridRoutes.ts` — Express router at `/api/hybrid`
- [x] `backend/src/hybridBootstrap.ts` — Self-contained bootstrap module

- [ ] **MANUAL**: Add one line to `backend/src/server.ts` after the existing route registrations:
  ```typescript
  import './hybridBootstrap';
  ```

---

## Frontend

- [x] `frontend/src/types/hybrid.types.ts` — Shared TypeScript types
- [x] `frontend/src/hooks/useHybridSocket.ts` — Socket.io hook for `/hybrid-interview` namespace
- [x] `frontend/src/hooks/useTurnGate.ts` — Turn Gate state machine hook
- [x] `frontend/src/styles/HybridSetup.css`
- [x] `frontend/src/styles/HybridInterview.css`
- [x] `frontend/src/styles/InterviewerPanel.css`
- [x] `frontend/src/styles/Contest.css`
- [x] `frontend/src/styles/ContestLeaderboard.css`
- [x] `frontend/src/pages/HybridSetupPage.tsx` — Mode selection at `/hybrid/setup`
- [x] `frontend/src/pages/HybridInterviewPage.tsx` — Candidate interview page
- [x] `frontend/src/pages/InterviewerPanelPage.tsx` — Human interviewer panel
- [x] `frontend/src/pages/ContestPage.tsx` — Contest session with dual timers
- [x] `frontend/src/pages/ContestLeaderboardPage.tsx` — Post-contest rankings

- [ ] **MANUAL**: Add these routes to `frontend/src/App.tsx` inside the `<Routes>` block:
  ```tsx
  // Hybrid Interview System routes
  const HybridSetupPage = lazy(() => import('./pages/HybridSetupPage'));
  const HybridInterviewPage = lazy(() => import('./pages/HybridInterviewPage'));
  const InterviewerPanelPage = lazy(() => import('./pages/InterviewerPanelPage'));
  const ContestPage = lazy(() => import('./pages/ContestPage'));
  const ContestLeaderboardPage = lazy(() => import('./pages/ContestLeaderboardPage'));

  // Add inside <Routes>:
  <Route path="/hybrid/setup" element={<ProtectedRoute><HybridSetupPage /></ProtectedRoute>} />
  <Route path="/hybrid/interview/:sessionId" element={<ProtectedRoute><HybridInterviewPage /></ProtectedRoute>} />
  <Route path="/hybrid/interviewer/:sessionId" element={<ProtectedRoute><InterviewerPanelPage /></ProtectedRoute>} />
  <Route path="/hybrid/contest/:contestId" element={<ProtectedRoute><ContestPage /></ProtectedRoute>} />
  <Route path="/hybrid/contest/:contestId/leaderboard" element={<ProtectedRoute><ContestLeaderboardPage /></ProtectedRoute>} />
  ```

---

## Notes

- The `uuid` package is already a transitive dependency in most Node projects. If missing: `npm install uuid` + `npm install -D @types/uuid` in `backend/`.
- The `interviewer` role must be assigned to users in MongoDB for the Interviewer Panel role guard to work. The existing `User` model's `role` field accepts any string — set `role: "interviewer"` directly in the DB or extend the signup flow.
- Contest sessions store their `sessionId` in `localStorage` under key `contest_session_<contestId>` — `HybridSetupPage` should set this after creating the session (see note in ContestPage).
