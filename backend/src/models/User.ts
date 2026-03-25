import mongoose, { Document, Schema } from 'mongoose';

/**
 * User profile interface
 */
export interface IUserProfile {
  name: string;
  resumeUrl?: string;
  resumeAnalysis?: any; // Resume analysis from Gemini
  totalSessions: number;
  averageScore: number;
}

/**
 * User document interface
 */
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: 'candidate' | 'admin';
  profile: IUserProfile;
  createdAt: Date;
}

/**
 * User schema definition
 */
const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address'
      ]
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false // Don't include password hash in queries by default
    },
    role: {
      type: String,
      enum: {
        values: ['candidate', 'admin'],
        message: 'Role must be either candidate or admin'
      },
      default: 'candidate'
    },
    profile: {
      name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [100, 'Name cannot exceed 100 characters']
      },
      resumeUrl: {
        type: String,
        default: undefined
      },
      resumeAnalysis: {
        type: Schema.Types.Mixed,
        default: undefined
      },
      totalSessions: {
        type: Number,
        default: 0,
        min: [0, 'Total sessions cannot be negative']
      },
      averageScore: {
        type: Number,
        default: 0,
        min: [0, 'Average score cannot be negative'],
        max: [100, 'Average score cannot exceed 100']
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Create indexes for better query performance
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });

/**
 * User model
 */
const User = mongoose.model<IUser>('User', UserSchema);

export default User;
