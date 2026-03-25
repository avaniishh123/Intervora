import mongoose, { Document, Schema } from 'mongoose';
import { Question, Evaluation } from '../types/gemini.types';

/**
 * Session question interface - stores question, answer, and evaluation
 */
export interface ISessionQuestion {
  question: Question;
  answer: string;
  evaluation: Evaluation;
  timeSpent: number; // in seconds
  timestamp: Date;
}

/**
 * Performance report interface
 */
export interface IPerformanceReport {
  overallScore: number;
  categoryScores: {
    technical: number;
    behavioral: number;
    communication: number;
  };
  wordCountMetrics: {
    average: number;
    total: number;
    perQuestion: number[];
  };
  sentimentAnalysis: {
    overall: string;
    confidence: number;
    clarity: number;
    professionalism: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  carFrameworkScore?: number;
}

/**
 * Session metadata interface
 */
export interface ISessionMetadata {
  mentorModeEnabled: boolean;
  jobDescription?: string;
  resumeUsed?: boolean;
  resumeAnalysis?: any; // Resume analysis data from Gemini
  duration?: number; // Duration in minutes
  totalQuestions?: number; // Total questions for this session based on duration
}

/**
 * Session document interface
 */
export interface ISession extends Document {
  userId: mongoose.Types.ObjectId;
  jobRole: string;
  mode: 'resume-based' | 'jd-based' | 'general';
  status: 'in-progress' | 'completed' | 'abandoned';
  startTime: Date;
  endTime?: Date;
  questions: ISessionQuestion[];
  performanceReport?: IPerformanceReport;
  recordingUrl?: string;
  transcriptUrl?: string;
  metadata: ISessionMetadata;
  
  // Methods
  start(): Promise<void>;
  addQuestion(questionData: ISessionQuestion): Promise<void>;
  complete(report: IPerformanceReport): Promise<void>;
  abandon(): Promise<void>;
}

/**
 * Session schema definition
 */
const SessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    jobRole: {
      type: String,
      required: [true, 'Job role is required'],
      trim: true,
      minlength: [2, 'Job role must be at least 2 characters'],
      maxlength: [100, 'Job role cannot exceed 100 characters']
    },
    mode: {
      type: String,
      enum: {
        values: ['resume-based', 'jd-based', 'general'],
        message: 'Mode must be resume-based, jd-based, or general'
      },
      required: [true, 'Interview mode is required']
    },
    status: {
      type: String,
      enum: {
        values: ['in-progress', 'completed', 'abandoned'],
        message: 'Status must be in-progress, completed, or abandoned'
      },
      default: 'in-progress'
    },
    startTime: {
      type: Date,
      default: Date.now,
      required: true
    },
    endTime: {
      type: Date,
      default: undefined
    },
    questions: [{
      question: {
        type: Schema.Types.Mixed,
        required: true
      },
      answer: {
        type: String,
        required: true
      },
      evaluation: {
        type: Schema.Types.Mixed,
        required: true
      },
      timeSpent: {
        type: Number,
        required: true,
        min: 0
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
    performanceReport: {
      type: Schema.Types.Mixed,
      default: undefined
    },
    recordingUrl: {
      type: String,
      default: undefined
    },
    transcriptUrl: {
      type: String,
      default: undefined
    },
    metadata: {
      mentorModeEnabled: {
        type: Boolean,
        default: false
      },
      jobDescription: {
        type: String,
        default: undefined
      },
      resumeUsed: {
        type: Boolean,
        default: false
      },
      resumeAnalysis: {
        type: Schema.Types.Mixed,
        default: undefined
      }
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Create indexes for better query performance
SessionSchema.index({ userId: 1, status: 1 });
SessionSchema.index({ userId: 1, createdAt: -1 });
SessionSchema.index({ status: 1 });
SessionSchema.index({ jobRole: 1 });
SessionSchema.index({ startTime: -1 });

/**
 * Instance method: Start the session
 */
SessionSchema.methods.start = async function(): Promise<void> {
  this.status = 'in-progress';
  this.startTime = new Date();
  await this.save();
};

/**
 * Instance method: Add a question with answer and evaluation
 */
SessionSchema.methods.addQuestion = async function(questionData: ISessionQuestion): Promise<void> {
  this.questions.push(questionData);
  await this.save();
};

/**
 * Instance method: Complete the session with performance report
 */
SessionSchema.methods.complete = async function(report: IPerformanceReport): Promise<void> {
  this.status = 'completed';
  this.endTime = new Date();
  this.performanceReport = report;
  await this.save();
};

/**
 * Instance method: Abandon the session
 */
SessionSchema.methods.abandon = async function(): Promise<void> {
  this.status = 'abandoned';
  this.endTime = new Date();
  await this.save();
};

/**
 * Session model
 */
const Session = mongoose.model<ISession>('Session', SessionSchema);

export default Session;
