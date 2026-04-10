/**
 * LiveSession — MongoDB-backed model for Human-Based Interview sessions.
 * Persists across server restarts (unlike the in-memory HybridRoom).
 */
import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ILiveParticipant {
  id: string;
  name: string;
  role: 'interviewer' | 'candidate';
  joinedAt: Date;
  leftAt?: Date;
}

export interface ILiveEvalCriteria {
  technicalSkills: number;       // 0-10
  communicationSkills: number;   // 0-10
  problemSolving: number;        // 0-10
  culturalFit: number;           // 0-10
  overallImpression: number;     // 0-10
}

export interface ILiveReport {
  submittedAt: Date;
  candidateName: string;
  jobRole: string;
  durationMinutes: number;
  criteria: ILiveEvalCriteria;
  overallScore: number;          // computed average * 10
  strengths: string;
  improvements: string;
  recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire';
  additionalNotes: string;
  reportId: string;              // unique shareable ID
}

export interface IInviteToken {
  token: string;           // crypto-random hex token
  email: string;           // recipient email
  name: string;            // recipient display name
  usedAt?: Date;           // set when token is consumed
  expiresAt: Date;         // 7 days from creation
}

export interface ILiveSession extends Document {
  sessionId: string;
  jobRole: string;
  durationMinutes: number;       // 5 | 15 | 25 | 40
  hostId: string;                // userId of interviewer
  hostName: string;
  hostEmail: string;
  status: 'waiting' | 'active' | 'ended' | 'reported';
  participants: ILiveParticipant[];
  inviteTokens: IInviteToken[];  // tokenized invite links
  maxParticipants: number;       // default 10
  startedAt?: Date;
  endedAt?: Date;
  scheduledEndAt?: Date;
  report?: ILiveReport;
  createdAt: Date;
}

const InviteTokenSchema = new Schema<IInviteToken>({
  token:     { type: String, required: true },
  email:     { type: String, required: true },
  name:      { type: String, required: true },
  usedAt:    { type: Date },
  expiresAt: { type: Date, required: true },
}, { _id: false });

const LiveParticipantSchema = new Schema<ILiveParticipant>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['interviewer', 'candidate'], required: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date },
}, { _id: false });

const LiveEvalCriteriaSchema = new Schema<ILiveEvalCriteria>({
  technicalSkills: { type: Number, min: 0, max: 10, required: true },
  communicationSkills: { type: Number, min: 0, max: 10, required: true },
  problemSolving: { type: Number, min: 0, max: 10, required: true },
  culturalFit: { type: Number, min: 0, max: 10, required: true },
  overallImpression: { type: Number, min: 0, max: 10, required: true },
}, { _id: false });

const LiveReportSchema = new Schema<ILiveReport>({
  submittedAt: { type: Date, default: Date.now },
  candidateName: { type: String, required: true },
  jobRole: { type: String, required: true },
  durationMinutes: { type: Number, required: true },
  criteria: { type: LiveEvalCriteriaSchema, required: true },
  overallScore: { type: Number, required: true },
  strengths: { type: String, default: '' },
  improvements: { type: String, default: '' },
  recommendation: {
    type: String,
    enum: ['strong_hire', 'hire', 'maybe', 'no_hire'],
    required: true,
  },
  additionalNotes: { type: String, default: '' },
  reportId: { type: String, default: () => uuidv4(), unique: true },
}, { _id: false });

const LiveSessionSchema = new Schema<ILiveSession>(
  {
    sessionId: { type: String, default: () => uuidv4(), unique: true, index: true },
    jobRole: { type: String, required: true },
    durationMinutes: { type: Number, enum: [5, 15, 25, 40], required: true },
    hostId: { type: String, required: true, index: true },
    hostName: { type: String, required: true },
    hostEmail: { type: String, required: true },
    status: {
      type: String,
      enum: ['waiting', 'active', 'ended', 'reported'],
      default: 'waiting',
    },
    participants: [LiveParticipantSchema],
    inviteTokens: { type: [InviteTokenSchema], default: [] },
    maxParticipants: { type: Number, default: 10 },
    startedAt: { type: Date },
    endedAt: { type: Date },
    scheduledEndAt: { type: Date },
    report: { type: LiveReportSchema },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    toJSON: { transform: (_doc, ret: any) => { delete ret.__v; return ret; } },
  }
);

// TTL index: auto-delete sessions older than 7 days
LiveSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
LiveSessionSchema.index({ 'report.reportId': 1 }, { sparse: true });

const LiveSession = mongoose.model<ILiveSession>('LiveSession', LiveSessionSchema);
export default LiveSession;
