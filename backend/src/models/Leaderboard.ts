import mongoose, { Document, Schema } from 'mongoose';

/**
 * Leaderboard entry interface
 */
export interface ILeaderboard extends Document {
  userId: mongoose.Types.ObjectId;
  username: string;
  jobRole: string;
  averageScore: number;
  totalSessions: number;
  rank: number;
  updatedAt: Date;
}

/**
 * Leaderboard schema definition
 */
const LeaderboardSchema = new Schema<ILeaderboard>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
      index: true
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true
    },
    jobRole: {
      type: String,
      required: [true, 'Job role is required'],
      trim: true,
      index: true
    },
    averageScore: {
      type: Number,
      required: [true, 'Average score is required'],
      min: [0, 'Average score cannot be negative'],
      max: [100, 'Average score cannot exceed 100'],
      index: -1 // Descending index for ranking
    },
    totalSessions: {
      type: Number,
      required: [true, 'Total sessions is required'],
      min: [0, 'Total sessions cannot be negative'],
      default: 0
    },
    rank: {
      type: Number,
      required: [true, 'Rank is required'],
      min: [1, 'Rank must be at least 1']
    },
    updatedAt: {
      type: Date,
      default: Date.now
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

// Create compound indexes for efficient queries
LeaderboardSchema.index({ averageScore: -1, totalSessions: -1 }); // For ranking
LeaderboardSchema.index({ jobRole: 1, averageScore: -1 }); // For role-filtered leaderboard
LeaderboardSchema.index({ rank: 1 }); // For quick rank lookups

/**
 * Leaderboard model
 */
const Leaderboard = mongoose.model<ILeaderboard>('Leaderboard', LeaderboardSchema);

export default Leaderboard;
