import mongoose, { Document, Schema } from 'mongoose';

/**
 * Test case interface for coding challenges
 */
export interface ITestCase {
  input: any;
  expectedOutput: any;
  isHidden: boolean;
  description?: string;
}

/**
 * Coding challenge document interface
 */
export interface ICodingChallenge extends Document {
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  role: string;
  languages: string[];
  testCases: ITestCase[];
  starterCode: Record<string, string>;
  hints?: string[];
  timeLimit: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Coding challenge schema definition
 */
const CodingChallengeSchema = new Schema<ICodingChallenge>(
  {
    title: {
      type: String,
      required: [true, 'Challenge title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Challenge description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters']
    },
    difficulty: {
      type: String,
      enum: {
        values: ['easy', 'medium', 'hard'],
        message: 'Difficulty must be easy, medium, or hard'
      },
      required: [true, 'Difficulty level is required']
    },
    role: {
      type: String,
      required: [true, 'Target role is required'],
      trim: true,
      index: true
    },
    languages: {
      type: [String],
      required: [true, 'At least one programming language is required'],
      validate: {
        validator: function(v: string[]) {
          return v && v.length > 0;
        },
        message: 'At least one programming language must be specified'
      }
    },
    testCases: [{
      input: {
        type: Schema.Types.Mixed,
        required: true
      },
      expectedOutput: {
        type: Schema.Types.Mixed,
        required: true
      },
      isHidden: {
        type: Boolean,
        default: false
      },
      description: {
        type: String,
        default: undefined
      }
    }],
    starterCode: {
      type: Map,
      of: String,
      required: [true, 'Starter code is required'],
      validate: {
        validator: function(v: Map<string, string>) {
          return v && v.size > 0;
        },
        message: 'Starter code must be provided for at least one language'
      }
    },
    hints: {
      type: [String],
      default: []
    },
    timeLimit: {
      type: Number,
      default: 300,
      min: [60, 'Time limit must be at least 60 seconds'],
      max: [1800, 'Time limit cannot exceed 1800 seconds (30 minutes)']
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
CodingChallengeSchema.index({ role: 1, difficulty: 1 });
CodingChallengeSchema.index({ difficulty: 1 });

/**
 * Coding challenge model
 */
const CodingChallenge = mongoose.model<ICodingChallenge>('CodingChallenge', CodingChallengeSchema);

export default CodingChallenge;
