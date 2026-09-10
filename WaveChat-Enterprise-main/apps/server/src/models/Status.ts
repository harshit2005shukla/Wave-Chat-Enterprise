import { Schema, model } from 'mongoose';

interface StatusWrappedKey {
  user: Schema.Types.ObjectId;
  wrappedKey: string;
  iv: string;
  wrapperPublicKeyJwk: Record<string, unknown>;
}
interface StatusShape {
  owner: Schema.Types.ObjectId;
  type: 'text' | 'image' | 'video';
  ciphertext: string;
  iv: string;
  mediaUrl?: string;
  background?: string;
  audience: Schema.Types.ObjectId[];
  wrappedKeys: StatusWrappedKey[];
  viewedBy: { user: Schema.Types.ObjectId; viewedAt: Date }[];
  expiresAt: Date;
  createdAt: Date;
}
const wrappedKeySchema = new Schema<StatusWrappedKey>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  wrappedKey: { type: String, required: true },
  iv: { type: String, required: true },
  wrapperPublicKeyJwk: { type: Schema.Types.Mixed, required: true }
}, { _id: false });
const schema = new Schema<StatusShape>({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['text', 'image', 'video'], required: true },
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  mediaUrl: String,
  background: String,
  audience: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  wrappedKeys: { type: [wrappedKeySchema], default: [] },
  viewedBy: [{ user: { type: Schema.Types.ObjectId, ref: 'User' }, viewedAt: { type: Date, default: Date.now } }],
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: { createdAt: true, updatedAt: false } });
schema.index({ audience: 1, createdAt: -1 });
export const Status = model<StatusShape>('Status', schema);
