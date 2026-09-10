import { Schema, model } from 'mongoose';

interface RefreshTokenShape {
  user: Schema.Types.ObjectId;
  jti: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const schema = new Schema<RefreshTokenShape>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  jti: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: Date
}, { timestamps: { createdAt: true, updatedAt: false } });

export const RefreshToken = model<RefreshTokenShape>('RefreshToken', schema);
