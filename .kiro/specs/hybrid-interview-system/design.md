# Design Document — Hybrid AI Interview System

## Overview

The Hybrid AI Interview System is a strictly additive extension to the existing AI Interview Maker platform. It introduces three unified interview modes (AI, Human, Contest) sharing a common real-time WebSocket backbone, a dedicated MongoDB schema, an AI evaluation engine, and a clean role-separated UI. No existing files are modified.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (React)                             │
│                                                                     │
│  /hybrid/setup          HybridSetupPage.tsx                        │
│  /hybrid/interview/:id  HybridInterviewPage.tsx  ◄──┐              │
│  /hybrid/interviewer/:id InterviewerPanelPage.tsx ◄──┤  useHybrid  │
│  /hybrid/contest/:id    ContestPage.tsx           ◄──┤  Socket.ts  │
│  /hybrid/contest/:id/leaderboard  ContestLeaderboardPage.tsx        │
│                                                     │              │
│  Hooks: useHybridSocket.ts, useTurnGate.ts          │              │
└─────────────────────────────────────────────────────┼──────────────┘
                                                      │ Socket.io
                                                      │ /hybrid-interview
┌─────────────────────────────────────────────────────┼──────────────┐
│                        SERVER (Node/Express)         │              │
│                                                      │              │
│  hybridRoutes.ts  ──►  HybridController.ts          │              │
│                              │                       │              │
│                    HybridEvaluationService.ts        │              │
│                              │                       │              │
│                    hybridSocket.ts  ◄────────────────┘              │
│                              │                                      │
│                    HybridSession model (MongoDB)                    │
│                    ContestLeaderboard model (MongoDB)               │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- The `/hybrid-interview` Socket.io namespace is completely separate from the existing `/interview` namespace — zero coupling.
- `hybridSocket.ts` reuses `socketAuthMiddleware` from `./socketAuth` (import only, no modification).
- `HybridEvaluationService` wraps `geminiService` (import only) to add the four-dimension scoring layer.
- All new REST routes are mounted at `/api/hybrid` in a new `hybridRoutes.ts` file registered in `server.ts` via a one-line additive import.

---

## New File Structure (all additive)

```
backend/src/
  models/
    HybridSession.ts          ← new Mongoose model
    ContestLeaderboard.ts     ← new Mongoose model
  socket/
    hybridSocket.ts           ← new Socket.io namespace handler
  controllers/
    HybridController.ts       ← new REST controller
  services/
    HybridEvaluationService.ts ← new evaluation service
  routes/
    hybridRoutes.ts           ← new Express router

frontend/src/
  pages/
    HybridSetupPage.tsx
    HybridInterviewPage.tsx
    InterviewerPanelPage.tsx
    ContestPage.tsx
    ContestLeaderboardPage.tsx
  hooks/
    useHybridSocket.ts
    useTurnGate.ts
  styles/
    HybridSetup.css
    HybridInterview.css
    InterviewerPanel.css
    Contest.css
    ContestLeaderboard.css
  types/
    hybrid.types.ts
```

---

## MongoDB Schema

### HybridSession Model (`backend/src/models/HybridSession.ts`)

```typescript
interface IHybridMessage {
  messageId: string;          // UUID
  senderRole: 'ai' | 'human_interviewer' | 'candidate';
  content: string;
  timestamp: Date;
  deliveryStatus: 'sent' | 'delivered' | 'read';
}

interface IHybridEvaluation {
  questionId: string;
  technicalScore: number;     // 0–100
  clarityScore: number;       // 0–100
  depthScore: number;         // 0–100
  confidenceScore: number;    // 0–100
  compositeScore: number;     // weighted average
  feedback: string;
  evaluatedAt: Date;
}

interface IHybridSession {
  sessionId: string;          // UUID, indexed
  mode: 'ai' | 'human' | 'contest';
  candidateId: ObjectId;      // ref: User, indexed
  interviewerId?: ObjectId;   // ref: User, nullable
  contestId?: string;         // indexed, nullable
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  startTime: Date;            // indexed
  endTime?: Date;
  messages: IHybridMessage[];
  evaluations: IHybridEvaluation[];
  metadata: {
    jobRole?: string;
    questionSet?: string[];   // for contest mode: fixed question IDs
    contestDurationMs?: number;
    perQuestionTimeLimitMs?: number;
    autoSubmitted?: boolean;
  };
}
```

Indexes: `candidateId`, `contestId`, `status`, `startTime`

Invariant enforced at application layer: when `status` is `"completed"` or `"abandoned"`, `endTime >= startTime`.

### ContestLeaderboard Model (`backend/src/models/ContestLeaderboard.ts`)

```typescript
interface IRanking {
  candidateId: ObjectId;      // ref: User
  username: string;
  finalScore: number;         // 0–100
  completionTimeMs: number;
  rank: number;
}

interface IContestLeaderboard {
  contestId: string;          // indexed, unique
  rankings: IRanking[];
  createdAt: Date;
}
```

---

## Socket Event Catalog (`/hybrid-interview` namespace)

All events are scoped to a Socket.io room identified by `sessionId` (or `contestId` for contest-wide events).

### Client → Server

| Event | Payload | Emitter Role | Description |
|---|---|---|---|
| `hybrid:session:join` | `{ sessionId, role }` | any | Join session room after connect |
| `hybrid:question` | `{ sessionId, questionId, text }` | interviewer | Human sends a question |
| `hybrid:answer:submit` | `{ sessionId, questionId, answer, autoSubmitted? }` | candidate / contestant | Submit answer |
| `hybrid:session:end` | `{ sessionId }` | interviewer | End the session |
| `hybrid:transcript:live` | `{ sessionId, text }` | candidate | Live STT transcript stream |

### Server → Client

| Event | Payload | Recipient | Description |
|---|---|---|---|
| `hybrid:question` | `{ questionId, text, turnGate: 'locked' }` | candidate | New question delivered |
| `hybrid:turn:open` | `{ questionId }` | candidate | Turn gate unlocked — mic may activate |
| `hybrid:evaluation:result` | `{ questionId, scores, compositeScore, feedback }` | candidate + interviewer | AI evaluation complete |
| `hybrid:evaluation:timeout` | `{ questionId }` | candidate | Evaluation timed out |
| `hybrid:timer:tick` | `{ questionTimeRemaining, contestTimeRemaining }` | contestant | 1-second timer tick |
| `hybrid:answer:auto-submit` | `{ questionId, answer, autoSubmitted: true }` | server-internal | Timer expired, auto-submit |
| `hybrid:leaderboard:update` | `{ rankings[] }` | all in contest room | Rankings after contest ends |
| `hybrid:session:end` | `{ sessionId, reason }` | all in session room | Session terminated |
| `hybrid:transcript:live` | `{ text }` | interviewer | Candidate live transcript relay |
| `hybrid:error` | `{ code, message }` | offending socket | Role violation or bad event |

---

## Turn Gate State Machine

```
         hybrid:question received
                  │
                  ▼
           ┌─────────────┐
           │   LOCKED    │◄──────────────────────────────┐
           │  (mic off,  │                               │
           │  input off) │                               │
           └──────┬──────┘                               │
                  │ TTS onend fires                       │
                  │ (or TTS disabled: immediately)        │
                  ▼                                       │
           ┌─────────────┐   hybrid:question received    │
           │    OPEN     │───────────────────────────────┘
           │  (mic on,   │
           │  input on)  │
           └──────┬──────┘
                  │ candidate submits (or timer expires in contest)
                  ▼
           ┌─────────────┐
           │  SUBMITTED  │
           │  (mic off,  │
           │  input off) │
           └─────────────┘
```

State is managed client-side by `useTurnGate.ts`. The server enforces role-level event rejection as a second layer of protection.

---

## Backend Components

### `hybridSocket.ts`

Registers the `/hybrid-interview` namespace on the existing `io` instance (passed in from `server.ts`). Reuses `socketAuthMiddleware` unchanged.

```typescript
// Key responsibilities:
// 1. Apply socketAuthMiddleware to /hybrid-interview namespace
// 2. On connection: derive role from socket.user.role (JWT claim)
// 3. On hybrid:session:join: socket.join(sessionId), restore state if reconnect
// 4. On hybrid:question: validate role === 'interviewer', broadcast to room
// 5. On hybrid:answer:submit: validate role !== 'interviewer', trigger async evaluation
// 6. On hybrid:session:end: update HybridSession.status, emit to room
// 7. On disconnect: if contest + >30s absence → mark abandoned
// 8. Contest timer: setInterval per contest room, emit hybrid:timer:tick every 1s
//    auto-submit when per-question timer hits 0
```

Role mapping from JWT `role` claim:
- `"interviewer"` → socket role `"interviewer"`
- `"user"` in contest session → `"contestant"`
- `"user"` in ai/human session → `"candidate"`

### `HybridController.ts`

REST endpoints only. No socket logic.

```
POST   /api/hybrid/sessions              → createSession
GET    /api/hybrid/sessions/:sessionId   → getSession
POST   /api/hybrid/contest               → createContest
GET    /api/hybrid/contest/:contestId/leaderboard → getLeaderboard
```

### `HybridEvaluationService.ts`

Wraps `geminiService.evaluateAnswer` and adds the four-dimension scoring layer.

```typescript
interface HybridEvaluationResult {
  technicalScore: number;
  clarityScore: number;
  depthScore: number;
  confidenceScore: number;
  compositeScore: number;   // 0.4*technical + 0.2*clarity + 0.2*depth + 0.2*confidence
  feedback: string;
}

// evaluateAnswer(questionText, answerText, sessionContext): Promise<HybridEvaluationResult>
// Runs async — does not block question delivery
// Times out after 15s → emits hybrid:evaluation:timeout
```

### `hybridRoutes.ts`

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware'; // import only
import HybridController from '../controllers/HybridController';

const router = Router();
router.use(authMiddleware);
router.post('/sessions', HybridController.createSession);
router.get('/sessions/:sessionId', HybridController.getSession);
router.post('/contest', HybridController.createContest);
router.get('/contest/:contestId/leaderboard', HybridController.getLeaderboard);
export default router;
```

One line added to `server.ts` (additive):
```typescript
import hybridRoutes from './routes/hybridRoutes';
// ...
app.use('/api/hybrid', hybridRoutes);
```

And one line to initialize the hybrid namespace:
```typescript
import { initializeHybridNamespace } from './socket/hybridSocket';
// ...
initializeHybridNamespace(io);
```

---

## Frontend Components

### `useHybridSocket.ts`

Connects to `/hybrid-interview` namespace. Exposes:
- `joinSession(sessionId, role)` — emits `hybrid:session:join`
- `sendQuestion(text)` — emits `hybrid:question` (interviewer only)
- `submitAnswer(questionId, answer)` — emits `hybrid:answer:submit`
- `onQuestion(cb)` — registers listener for `hybrid:question`
- `onEvaluationResult(cb)` — registers listener for `hybrid:evaluation:result`
- `onTimerTick(cb)` — registers listener for `hybrid:timer:tick`
- `onLeaderboardUpdate(cb)` — registers listener for `hybrid:leaderboard:update`
- `onSessionEnd(cb)` — registers listener for `hybrid:session:end`
- `onLiveTranscript(cb)` — registers listener for `hybrid:transcript:live`
- `sendLiveTranscript(text)` — emits `hybrid:transcript:live`

### `useTurnGate.ts`

Manages the Turn Gate state machine client-side.

```typescript
type TurnGateState = 'locked' | 'open' | 'submitted';

interface UseTurnGateReturn {
  state: TurnGateState;
  lock: () => void;       // called when hybrid:question arrives
  open: () => void;       // called when TTS onend fires
  submit: () => void;     // called when candidate submits
  reset: () => void;      // called between questions
}
```

Integrates with `useVoiceMode.setAiSpeaking`:
- `lock()` → calls `setAiSpeaking(true)` (mic blocked)
- `open()` → calls `setAiSpeaking(false)` (mic activates if voice mode)

### Page Components

**`HybridSetupPage.tsx`** (`/hybrid/setup`)
- Three mode cards: AI Interview, Human Interview, Contest Mode
- On select: POST `/api/hybrid/sessions` or `/api/hybrid/contest`, redirect to appropriate page

**`HybridInterviewPage.tsx`** (`/hybrid/interview/:sessionId`)
- Renders question display, answer input (text or voice), submit button
- Uses `useTurnGate` to lock/unlock input
- Uses `useVoiceMode` for STT (reused unchanged)
- Uses `useHybridSocket` for real-time events
- Shows evaluation feedback panel after each submission
- Visual indicators: "Question Incoming..." (locked), "Your Turn" (open), "Submitted" (submitted)

**`InterviewerPanelPage.tsx`** (`/hybrid/interviewer/:sessionId`)
- Question input textarea + Send button
- Sent questions log (read-only)
- Live candidate transcript panel (read-only, relayed via `hybrid:transcript:live`)
- AI evaluation scores panel (receives `hybrid:evaluation:result`)
- End Session button
- Role guard: redirects to `/dashboard` if JWT role ≠ `"interviewer"`

**`ContestPage.tsx`** (`/hybrid/contest/:contestId`)
- Same layout as `HybridInterviewPage` but with dual countdown timers
- No pause button, no skip button
- Auto-submit on per-question timer expiry (handled server-side, UI shows countdown)

**`ContestLeaderboardPage.tsx`** (`/hybrid/contest/:contestId/leaderboard`)
- Rankings table with rank, username, score, completion time
- Highlights the current user's row
- Fetches from `GET /api/hybrid/contest/:contestId/leaderboard`

---

## REST API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/hybrid/sessions` | JWT | Create a new HybridSession |
| `GET` | `/api/hybrid/sessions/:sessionId` | JWT (participant) | Get session document |
| `POST` | `/api/hybrid/contest` | JWT | Create a new Contest |
| `GET` | `/api/hybrid/contest/:contestId/leaderboard` | JWT | Get contest leaderboard |

### POST `/api/hybrid/sessions` — Request Body
```json
{
  "mode": "ai" | "human" | "contest",
  "jobRole": "string",
  "contestId": "string (optional, for contest mode)"
}
```

### POST `/api/hybrid/sessions` — Response
```json
{
  "sessionId": "uuid",
  "mode": "ai",
  "status": "waiting",
  "redirectUrl": "/hybrid/interview/:sessionId"
}
```

---

## Frontend Routing (additive additions to `App.tsx`)

```tsx
// New routes to add in App.tsx (additive):
<Route path="/hybrid/setup" element={<HybridSetupPage />} />
<Route path="/hybrid/interview/:sessionId" element={<HybridInterviewPage />} />
<Route path="/hybrid/interviewer/:sessionId" element={<InterviewerPanelPage />} />
<Route path="/hybrid/contest/:contestId" element={<ContestPage />} />
<Route path="/hybrid/contest/:contestId/leaderboard" element={<ContestLeaderboardPage />} />
```

---

## Correctness Properties (for Property-Based Testing)

1. **Turn Gate Isolation**: For any sequence of `hybrid:question` and `hybrid:answer:submit` events, the Turn Gate state machine must never be in `"open"` state while a `hybrid:question` event is in-flight or TTS is active.

2. **Role Enforcement**: For any socket event `e` emitted by a socket with role `r`, if `e` is `hybrid:question` and `r ≠ "interviewer"`, the server must emit `hybrid:error` and must NOT broadcast the question to the room.

3. **No Auto-Submit in Non-Contest Mode**: For any `HybridSession` with `mode ≠ "contest"`, no message in `messages` array shall have `autoSubmitted: true`.

4. **Temporal Consistency**: For any `HybridSession` with `status ∈ {"completed", "abandoned"}`, `endTime >= startTime` must hold.

5. **Leaderboard Rank Uniqueness**: For any `ContestLeaderboard` document, all `rank` values in the `rankings` array must be unique positive integers forming a contiguous sequence starting at 1.

6. **Evaluation Score Bounds**: For any `IHybridEvaluation`, all four dimension scores and `compositeScore` must be in the range [0, 100].

7. **Composite Score Formula**: For any `IHybridEvaluation`, `compositeScore = 0.4 * technicalScore + 0.2 * clarityScore + 0.2 * depthScore + 0.2 * confidenceScore` (within floating-point tolerance of 0.01).

8. **Contest Tie-Breaking**: For any two contestants `A` and `B` in a `ContestLeaderboard` where `A.finalScore === B.finalScore`, `A.rank < B.rank` if and only if `A.completionTimeMs < B.completionTimeMs`.

9. **Mic Isolation**: In any voice-mode session, the STT engine must not be in an active state while `TurnGate.state === "locked"`. (Verified via `useVoiceMode.isListening === false` whenever `useTurnGate.state === "locked"`.)

10. **Session Room Isolation**: A `hybrid:question` event emitted to room `sessionId_A` must never be received by a socket in room `sessionId_B` where `sessionId_A ≠ sessionId_B`.

---

## Reconnection Handling

Mirrors the existing `reconnectionHandler.ts` pattern (import only):
- On `hybrid:session:join` with an existing `sessionId`, the server checks if the socket's user was previously in that room.
- If the user reconnects within 30 seconds, the server re-joins the socket to the room and emits the current session state snapshot.
- If the user is a contestant and reconnects after 30 seconds, the session is marked `"abandoned"` and they are excluded from the leaderboard.

---

## Security Considerations

- All socket connections to `/hybrid-interview` are authenticated via the existing `socketAuthMiddleware` (JWT verification).
- Role is derived exclusively from the JWT payload — clients cannot self-assign roles.
- `hybrid:question` events from non-interviewer sockets are rejected server-side with `hybrid:error`.
- `hybrid:answer:submit` events from interviewer sockets are rejected server-side with `hybrid:error`.
- The Interviewer Panel page performs a client-side role check (redirect to `/dashboard`) AND the server enforces the same check at the socket level.
- Session documents are only accessible to authenticated users who are participants (`candidateId` or `interviewerId` matches JWT `userId`).
