import { Schema, model } from 'mongoose';

export interface WrappedKey {
  user: Schema.Types.ObjectId;
  wrappedKey: string;
  iv: string;
  wrapperPublicKeyJwk: Record<string, unknown>;
}

interface ConversationShape {
  type: 'direct' | 'group';
  title?: string;
  avatarUrl?: string;
  members: Schema.Types.ObjectId[];
  admins: Schema.Types.ObjectId[];
  createdBy: Schema.Types.ObjectId;
  directKey?: string;
  wrappedKeys: WrappedKey[];
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const wrappedKeySchema = new Schema<WrappedKey>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  wrappedKey: { type: String, required: true },
  iv: { type: String, required: true },
  wrapperPublicKeyJwk: { type: Schema.Types.Mixed, required: true }
}, { _id: false });

const schema = new Schema<ConversationShape>({
  type: { type: String, enum: ['direct', 'group'], required: true, index: true },
  title: { type: String, trim: true, maxlength: 120 },
  avatarUrl: String,
  members: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
  admins: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  directKey: { type: String, sparse: true, unique: true },
  wrappedKeys: { type: [wrappedKeySchema], default: [] },
  lastMessageAt: Date
}, { timestamps: true });

schema.index({ members: 1, lastMessageAt: -1 });
export const Conversation = model<ConversationShape>('Conversation', schema);
