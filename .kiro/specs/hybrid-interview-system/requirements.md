# Requirements Document

## Introduction

The Hybrid AI Interview System extends the existing AI Interview Maker platform with three unified interview modes: **AI Interview** (existing, AI-driven), **Human Interview** (a real person acts as interviewer via a dedicated panel), and **Contest Mode** (timed, multi-user competitive sessions with leaderboard). All modes share a consistent real-time interaction lifecycle enforced via WebSockets, a strict turn-taking contract (question delivered → mic unlocks → candidate answers → explicit submit), and a common AI evaluation engine. All new code is strictly additive — no existing files are modified.

---

## Glossary

- **Hybrid_System**: The new unified interview platform encompassing AI, Human, and Contest modes.
- **AI_Interviewer**: The existing Gemini-powered question generator and evaluator.
- **Human_Interviewer**: A real person who sends questions through the Interviewer Panel UI.
- **Candidate**: The user being interviewed or competing in a contest.
- **Interviewer_Panel**: A new dedicated UI page accessible only to users with the `interviewer` role, used to send questions and monitor candidate responses in Human Interview mode.
- **Contest_Session**: A timed interview session where multiple Candidates answer the same questions simultaneously under enforced constraints.
- **Leaderboard**: A ranked list of Contest participants updated dynamically after scoring.
- **Evaluation_Engine**: The AI service that scores each Candidate response on technical accuracy, clarity, depth, and confidence.
- **Hybrid_Session**: A MongoDB document that extends session tracking to support Human Interview and Contest modes.
- **Turn_Gate**: The system state that blocks Candidate microphone and text input until the current question has been fully delivered.
- **TTS**: Text-to-Speech, used to narrate questions aloud to the Candidate.
- **STT**: Speech-to-Text, used to transcribe Candidate spoken answers.
- **Socket_Namespace**: A Socket.io namespace dedicated to the Hybrid_System (`/hybrid-interview`), separate from the existing `/interview` namespace.

---

## Requirements

### Requirement 1: Mode Selection and Session Initialization

**User Story:** As a Candidate, I want to choose between AI Interview, Human Interview, and Contest Mode before starting, so that I can participate in the appropriate interview format.

#### Acceptance Criteria

1. THE Hybrid_System SHALL provide a new session setup page at `/hybrid/setup` that presents three mode options: AI Interview, Human Interview, and Contest Mode.
2. WHEN a Candidate selects AI Interview mode, THE Hybrid_System SHALL create a Hybrid_Session with `mode: "ai"` and redirect the Candidate to `/hybrid/interview/:sessionId`.
3. WHEN a Candidate selects Human Interview mode, THE Hybrid_System SHALL create a Hybrid_Session with `mode: "human"` and redirect the Candidate to `/hybrid/interview/:sessionId`.
4. WHEN a Candidate selects Contest Mode, THE Hybrid_System SHALL create or join a Contest_Session with `mode: "contest"` and redirect the Candidate to `/hybrid/contest/:contestId`.
5. IF a Candidate attempts to access `/hybrid/interview/:sessionId` without a valid authenticated JWT, THEN THE Hybrid_System SHALL redirect the Candidate to `/login`.
6. THE Hybrid_System SHALL store each Hybrid_Session in MongoDB with fields: `sessionId`, `mode`, `candidateId`, `interviewerId` (nullable), `contestId` (nullable), `status`, `startTime`, `endTime`, `messages`, `evaluations`, and `metadata`.

---

### Requirement 2: Human Interview Mode — Interviewer Panel

**User Story:** As a Human_Interviewer, I want a dedicated panel to send questions to the Candidate in real time, so that I can conduct a live interview without the AI generating questions.

#### Acceptance Criteria

1. THE Hybrid_System SHALL provide an Interviewer_Panel page at `/hybrid/interviewer/:sessionId` accessible only to authenticated users with the `interviewer` role.
2. IF a user without the `interviewer` role attempts to access `/hybrid/interviewer/:sessionId`, THEN THE Hybrid_System SHALL return a 403 response and redirect to `/dashboard`.
3. WHEN the Human_Interviewer submits a question via the Interviewer_Panel, THE Hybrid_System SHALL emit a `hybrid:question` event over the Socket_Namespace to the Candidate's session room within 500ms of submission.
4. THE Hybrid_System SHALL display the Human_Interviewer's typed question in the Interviewer_Panel's sent-questions log immediately upon submission, before the Candidate receives it.
5. WHILE a Candidate is answering a question, THE Hybrid_System SHALL display the Candidate's live transcript in the Interviewer_Panel in real time via the Socket_Namespace.
6. THE Hybrid_System SHALL prevent the Human_Interviewer's input channel from being routed to the Candidate's answer field under all circumstances.
7. WHEN the Human_Interviewer ends the session via the Interviewer_Panel, THE Hybrid_System SHALL emit a `hybrid:session:end` event and update the Hybrid_Session status to `"completed"`.

---

### Requirement 3: Question Delivery and Turn Gate

**User Story:** As a Candidate, I want the microphone and answer input to be locked until the question has been fully delivered, so that I cannot accidentally submit input before the question is complete.

#### Acceptance Criteria

1. WHEN a `hybrid:question` event is received by the Candidate's client, THE Hybrid_System SHALL set the Turn_Gate state to `"locked"`, disabling both the microphone and the text answer input.
2. WHILE the Turn_Gate state is `"locked"`, THE Hybrid_System SHALL display a visual indicator to the Candidate showing that the question is being delivered.
3. WHERE TTS is enabled, WHEN the TTS engine begins narrating the question, THE Hybrid_System SHALL keep the Turn_Gate state as `"locked"` until the TTS `onend` event fires.
4. WHEN the TTS `onend` event fires (or, where TTS is disabled, immediately after the `hybrid:question` event is rendered), THE Hybrid_System SHALL set the Turn_Gate state to `"open"`, enabling the microphone and text answer input.
5. THE Hybrid_System SHALL NOT auto-submit the Candidate's answer under any circumstance; the Candidate SHALL explicitly trigger submission via a dedicated submit action.
6. IF the Candidate attempts to submit an empty answer, THEN THE Hybrid_System SHALL display a validation message and SHALL NOT emit an answer submission event.

---

### Requirement 4: Voice Input Lifecycle

**User Story:** As a Candidate using voice mode, I want the microphone to activate only after the question is fully delivered and deactivate cleanly upon submission, so that my speech is captured accurately without cross-contamination.

#### Acceptance Criteria

1. WHEN the Turn_Gate state transitions to `"open"` and the Candidate has selected voice response mode, THE Hybrid_System SHALL activate the STT engine and begin capturing speech.
2. WHILE the STT engine is active, THE Hybrid_System SHALL display a live transcript of the Candidate's speech in the answer input field in real time.
3. WHEN the Human_Interviewer or AI_Interviewer begins delivering a new question (Turn_Gate transitions to `"locked"`), THE Hybrid_System SHALL immediately stop the STT engine and discard any in-progress interim transcript.
4. THE Hybrid_System SHALL NOT restart the STT engine while the Turn_Gate state is `"locked"`.
5. WHEN the Candidate explicitly submits their answer, THE Hybrid_System SHALL stop the STT engine and freeze the transcript before emitting the answer submission event.
6. IF the STT engine encounters a `not-allowed` error, THEN THE Hybrid_System SHALL display an error message and fall back to text input mode without crashing.

---

### Requirement 5: Real-Time Communication via WebSockets

**User Story:** As a system operator, I want all interviewer actions, candidate responses, timers, and session state changes to be synchronized in real time, so that both parties always see a consistent view of the session.

#### Acceptance Criteria

1. THE Hybrid_System SHALL use a dedicated Socket.io namespace `/hybrid-interview` that is separate from the existing `/interview` namespace.
2. WHEN a Hybrid_Session is created, THE Hybrid_System SHALL create a Socket.io room identified by `sessionId` within the `/hybrid-interview` namespace.
3. THE Hybrid_System SHALL authenticate every Socket.io connection to `/hybrid-interview` using the same JWT middleware used by the existing `/interview` namespace.
4. WHEN the Human_Interviewer emits `hybrid:question`, THE Hybrid_System SHALL broadcast the event exclusively to the room matching the `sessionId` and SHALL NOT broadcast to other rooms.
5. WHEN the Candidate emits `hybrid:answer:submit`, THE Hybrid_System SHALL broadcast the event to the Human_Interviewer's socket in the same room within 200ms.
6. WHEN a session timer tick occurs in Contest Mode, THE Hybrid_System SHALL broadcast a `hybrid:timer:tick` event to all sockets in the contest room every 1 second.
7. IF a socket disconnects and reconnects within 30 seconds, THEN THE Hybrid_System SHALL restore the socket to its previous session room and resend the current session state.

---

### Requirement 6: AI Evaluation Engine

**User Story:** As a Candidate, I want my answers to be evaluated on technical accuracy, clarity, depth, and confidence after each submission, so that I receive structured feedback without disrupting the live interview flow.

#### Acceptance Criteria

1. WHEN the Candidate submits an answer, THE Evaluation_Engine SHALL score the answer on four dimensions: technical accuracy (0–100), clarity (0–100), depth (0–100), and confidence (0–100), and compute a weighted composite score.
2. THE Evaluation_Engine SHALL return evaluation results within 15 seconds of receiving the answer submission event.
3. THE Evaluation_Engine SHALL store the evaluation result in the Hybrid_Session's `evaluations` array in MongoDB, linked to the corresponding `questionId`.
4. WHEN the Evaluation_Engine completes scoring, THE Hybrid_System SHALL emit a `hybrid:evaluation:result` event to the Candidate's socket containing the composite score, per-dimension scores, and textual feedback.
5. THE Evaluation_Engine SHALL NOT block or delay the delivery of the next question; evaluation SHALL run asynchronously relative to question delivery.
6. IF the Evaluation_Engine fails to return a result within 15 seconds, THEN THE Hybrid_System SHALL emit a `hybrid:evaluation:timeout` event to the Candidate and record a null evaluation in the database.
7. WHERE Human Interview mode is active, THE Hybrid_System SHALL also emit the `hybrid:evaluation:result` event to the Human_Interviewer's socket so the interviewer can see the AI score in real time.

---

### Requirement 7: Contest Mode — Session Constraints

**User Story:** As a Contest participant, I want to compete in a timed interview session with enforced rules, so that the contest is fair and consistent for all participants.

#### Acceptance Criteria

1. WHEN a Contest_Session is created, THE Hybrid_System SHALL set a configurable contest duration (default: 30 minutes) and a fixed question set shared by all Candidates in the contest.
2. WHILE a Contest_Session is active, THE Hybrid_System SHALL enforce the following constraints: no session pausing, no question skipping, and automatic answer submission when the per-question timer expires.
3. WHEN the per-question timer expires in Contest Mode, THE Hybrid_System SHALL emit a `hybrid:answer:auto-submit` event with the Candidate's current answer text (which may be empty) and mark the submission as `auto-submitted: true` in the database.
4. THE Hybrid_System SHALL display a countdown timer to each Candidate showing both the per-question time remaining and the total contest time remaining.
5. WHEN the contest duration expires, THE Hybrid_System SHALL automatically end the Contest_Session for all Candidates simultaneously by emitting `hybrid:session:end` to the contest room.
6. IF a Candidate disconnects during a Contest_Session and does not reconnect within 30 seconds, THEN THE Hybrid_System SHALL mark that Candidate's session as `"abandoned"` and exclude them from the final leaderboard.

---

### Requirement 8: Contest Mode — Leaderboard

**User Story:** As a Contest participant, I want to see a dynamically updated leaderboard after the contest ends, so that I can compare my performance against other participants.

#### Acceptance Criteria

1. WHEN the Contest_Session ends, THE Hybrid_System SHALL compute each Candidate's final score as the sum of all composite evaluation scores divided by the number of questions answered.
2. THE Hybrid_System SHALL rank Candidates by final score in descending order; ties SHALL be broken by total completion time in ascending order (faster completion ranks higher).
3. WHEN rankings are computed, THE Hybrid_System SHALL emit a `hybrid:leaderboard:update` event to all sockets in the contest room containing the ranked list of Candidates with their scores and completion times.
4. THE Hybrid_System SHALL persist the contest leaderboard to MongoDB in a new `ContestLeaderboard` collection with fields: `contestId`, `rankings` (array of `{ candidateId, username, finalScore, completionTimeMs, rank }`), and `createdAt`.
5. THE Hybrid_System SHALL provide a REST endpoint `GET /api/hybrid/contest/:contestId/leaderboard` that returns the persisted leaderboard for a given contest.
6. WHEN a Candidate views the leaderboard page at `/hybrid/contest/:contestId/leaderboard`, THE Hybrid_System SHALL highlight the viewing Candidate's own row in the rankings table.

---

### Requirement 9: Role Separation and Input Isolation

**User Story:** As a system designer, I want strict separation between interviewer and candidate input channels, so that there is no risk of cross-contamination between roles.

#### Acceptance Criteria

1. THE Hybrid_System SHALL assign each authenticated socket connection a role (`"candidate"`, `"interviewer"`, or `"contestant"`) derived from the user's JWT claims at connection time.
2. THE Hybrid_System SHALL reject any `hybrid:question` event emitted from a socket with role `"candidate"` or `"contestant"` and SHALL emit a `hybrid:error` event back to that socket.
3. THE Hybrid_System SHALL reject any `hybrid:answer:submit` event emitted from a socket with role `"interviewer"` and SHALL emit a `hybrid:error` event back to that socket.
4. WHILE TTS is playing a question, THE Hybrid_System SHALL suppress any STT activation attempts on the Candidate's client, ensuring no audio overlap.
5. THE Hybrid_System SHALL maintain separate UI panels for the Human_Interviewer and the Candidate; the Interviewer_Panel SHALL NOT render the Candidate's answer input, and the Candidate's interview page SHALL NOT render the Interviewer_Panel's question input.

---

### Requirement 10: Data Persistence and Schema

**User Story:** As a developer, I want all session interactions stored in a structured MongoDB schema, so that sessions are auditable, reportable, and scalable.

#### Acceptance Criteria

1. THE Hybrid_System SHALL define a new `HybridSession` Mongoose model with the following top-level fields: `sessionId` (UUID), `mode` (`"ai"` | `"human"` | `"contest"`), `candidateId`, `interviewerId` (nullable), `contestId` (nullable), `status` (`"waiting"` | `"active"` | `"completed"` | `"abandoned"`), `startTime`, `endTime`, `messages`, `evaluations`, and `metadata`.
2. THE `messages` array in the HybridSession model SHALL store each message with fields: `messageId`, `senderRole`, `content`, `timestamp`, and `deliveryStatus`.
3. THE `evaluations` array in the HybridSession model SHALL store each evaluation with fields: `questionId`, `technicalScore`, `clarityScore`, `depthScore`, `confidenceScore`, `compositeScore`, `feedback`, and `evaluatedAt`.
4. THE Hybrid_System SHALL create MongoDB indexes on `candidateId`, `contestId`, `status`, and `startTime` for the `HybridSession` collection to support efficient querying.
5. THE Hybrid_System SHALL provide a REST endpoint `GET /api/hybrid/sessions/:sessionId` that returns the full HybridSession document for authenticated users who are participants in that session.
6. FOR ALL HybridSession documents, THE Hybrid_System SHALL ensure that `startTime` is less than or equal to `endTime` when `status` is `"completed"` or `"abandoned"` (temporal consistency invariant).
