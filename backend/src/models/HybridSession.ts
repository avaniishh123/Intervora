import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IHybridMessage {
  messageId: string;
  senderRole: 'ai' | 'human_interviewer' | 'candidate';
  content: string;
  timestamp: Date;
  deliveryStatus: 'sent' | 'delivered' | 'read';
}

export interface IHybridEvaluation {
  questionId: string;
  technicalScore: number;
  clarityScore: number;
  depthScore: number;
  confidenceScore: number;
  compositeScore: number;
  feedback: string;
  evaluatedAt: Date;
}

export interface IHybridSessionMetadata {
  jobRole?: string;
  questionSet?: string[];
  contestDurationMs?: number;
  perQuestionTimeLimitMs?: number;
  autoSubmitted?: boolean;
}

export interface IHybridSession extends Document {
  sessionId: string;
  mode: 'ai' | 'human' | 'contest';
  candidateId: mongoose.Types.ObjectId;
  interviewerId?: mongoose.Types.ObjectId;
  contestId?: string;
  status: 'waiting' | 'active' | 'completed' | 'abandoned';
  startTime: Date;
  endTime?: Date;
  messages: IHybridMessage[];
  evaluations: IHybridEvaluation[];
  metadata: IHybridSessionMetadata;
}

const HybridMessageSchema = new Schema<IHybridMessage>({
  messageId: { type: String, default: () => uuidv4() },
  senderRole: { type: String, enum: ['ai', 'human_interviewer', 'candidate'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  deliveryStatus: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' },
}, { _id: false });

const HybridEvaluationSchema = new Schema<IHybridEvaluation>({
  questionId: { type: String, required: true },
  technicalScore: { type: Number, min: 0, max: 100, required: true },
  clarityScore: { type: Number, min: 0, max: 100, required: true },
  depthScore: { type: Number, min: 0, max: 100, required: true },
  confidenceScore: { type: Number, min: 0, max: 100, required: true },
  compositeScore: { type: Number, min: 0, max: 100, required: true },
  feedback: { type: String, required: true },
  evaluatedAt: { type: Date, default: Date.now },
}, { _id: false });

const HybridSessionSchema = new Schema<IHybridSession>(
  {
    sessionId: { type: String, default: () => uuidv4(), unique: true, index: true },
    mode: { type: String, enum: ['ai', 'human', 'contest'], required: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    interviewerId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    contestId: { type: String, default: undefined, index: true },
    status: {
      type: String,
      enum: ['waiting', 'active', 'completed', 'abandoned'],
      default: 'waiting',
    },
    startTime: { type: Date, default: Date.now, index: true },
    endTime: { type: Date, default: undefined },
    messages: [HybridMessageSchema],
    evaluations: [HybridEvaluationSchema],
    metadata: {
      jobRole: String,
      questionSet: [String],
      contestDurationMs: Number,
      perQuestionTimeLimitMs: Number,
      autoSubmitted: Boolean,
    },
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: any) => { delete ret.__v; return ret; } },
  }
);

HybridSessionSchema.index({ candidateId: 1, status: 1 });
HybridSessionSchema.index({ contestId: 1, status: 1 });
HybridSessionSchema.index({ startTime: -1 });

const HybridSession = mongoose.model<IHybridSession>('HybridSession', HybridSessionSchema);
export default HybridSession;
