import { Schema, model } from 'mongoose';

interface CallSessionShape {
  caller: Schema.Types.ObjectId;
  callee: Schema.Types.ObjectId;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'missed';
  startedAt: Date;
  answeredAt?: Date;
  endedAt?: Date;
}

const schema = new Schema<CallSessionShape>({
  caller: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  callee: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['audio', 'video'], required: true },
  status: { type: String, enum: ['ringing', 'accepted', 'rejected', 'ended', 'missed'], default: 'ringing' },
  startedAt: { type: Date, default: Date.now },
  answeredAt: Date,
  endedAt: Date
}, { timestamps: true });

schema.index({ caller: 1, startedAt: -1 });
schema.index({ callee: 1, startedAt: -1 });
export const CallSession = model<CallSessionShape>('CallSession', schema);
