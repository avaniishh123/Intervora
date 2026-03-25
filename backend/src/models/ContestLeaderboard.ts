import mongoose, { Document, Schema } from 'mongoose';

export interface IRanking {
  candidateId: mongoose.Types.ObjectId;
  username: string;
  finalScore: number;
  completionTimeMs: number;
  rank: number;
}

export interface IContestLeaderboard extends Document {
  contestId: string;
  rankings: IRanking[];
  createdAt: Date;
}

const RankingSchema = new Schema<IRanking>({
  candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  finalScore: { type: Number, min: 0, max: 100, required: true },
  completionTimeMs: { type: Number, required: true },
  rank: { type: Number, required: true },
}, { _id: false });

const ContestLeaderboardSchema = new Schema<IContestLeaderboard>(
  {
    contestId: { type: String, required: true, unique: true, index: true },
    rankings: [RankingSchema],
  },
  {
    timestamps: true,
    toJSON: { transform: (_doc, ret: any) => { delete ret.__v; return ret; } },
  }
);

const ContestLeaderboard = mongoose.model<IContestLeaderboard>('ContestLeaderboard', ContestLeaderboardSchema);
export default ContestLeaderboard;
