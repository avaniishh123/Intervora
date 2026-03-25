import mongoose, { Document, Schema } from 'mongoose';

export interface ISimulationEvent {
  type: 'code_run' | 'code_submit' | 'hint_viewed' | 'tab_switch' | 'answer_change' | 'section_complete' | 'error_encountered';
  timestamp: Date;
  data?: any;
}

export interface ISimulationSubmission {
  taskId: string;
  taskType: string;
  content: any; // code string, explanation text, config JSON, etc.
  language?: string;
  attemptNumber: number;
  submittedAt: Date;
  testResults?: { passed: number; total: number; details: any[] };
  score?: number;
  aiFeedback?: string;
}

export interface ISimulationEvaluation {
  taskId: string;
  ruleBasedScore: number;
  aiScore: number;
  finalScore: number;
  correctness: number;
  efficiency: number;
  completionRate: number;
  timePerformance: number;
  reasoning: string;
  strengths: string[];
  weaknesses: string[];
  edgeCaseHandling: string;
  debuggingApproach: string;
}

export interface ISimulationReport {
  overallScore: number;
  sectionScores: Record<string, number>;
  strengths: string[];
  weaknesses: string[];
  behavioralObservations: string[];
  confidenceIndicators: string;
  hiringRecommendation: 'Strong Hire' | 'Hire' | 'Borderline' | 'No Hire';
  hiringRationale: string;
  candidateView: {
    summary: string;
    tips: string[];
    areasToImprove: string[];
  };
  recruiterView: {
    summary: string;
    riskFactors: string[];
    positiveSignals: string[];
  };
}

export interface ISimulationSession extends Document {
  userId: mongoose.Types.ObjectId;
  jobRole: string;
  duration: number; // minutes
  status: 'in-progress' | 'completed' | 'abandoned';
  startTime: Date;
  endTime?: Date;
  tasks: any[]; // task definitions loaded at session start
  submissions: ISimulationSubmission[];
  events: ISimulationEvent[];
  evaluations: ISimulationEvaluation[];
  report?: ISimulationReport;
  recordingUrl?: string;
  metadata: {
    totalTasks: number;
    completedTasks: number;
    totalRunCount: number;
    totalAttempts: number;
  };
}

const SimulationSessionSchema = new Schema<ISimulationSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobRole: { type: String, required: true, trim: true },
    duration: { type: Number, required: true, default: 15 },
    status: {
      type: String,
      enum: ['in-progress', 'completed', 'abandoned'],
      default: 'in-progress',
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    tasks: [{ type: Schema.Types.Mixed }],
    submissions: [{ type: Schema.Types.Mixed }],
    events: [{ type: Schema.Types.Mixed }],
    evaluations: [{ type: Schema.Types.Mixed }],
    report: { type: Schema.Types.Mixed },
    recordingUrl: { type: String },
    metadata: {
      totalTasks: { type: Number, default: 0 },
      completedTasks: { type: Number, default: 0 },
      totalRunCount: { type: Number, default: 0 },
      totalAttempts: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

SimulationSessionSchema.index({ userId: 1, status: 1 });
SimulationSessionSchema.index({ userId: 1, createdAt: -1 });

const SimulationSession = mongoose.model<ISimulationSession>('SimulationSession', SimulationSessionSchema);
export default SimulationSession;
