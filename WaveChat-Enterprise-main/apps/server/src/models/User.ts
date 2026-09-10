import { Schema, model, type HydratedDocument } from 'mongoose';

export type UserRole = 'user' | 'moderator' | 'admin';
export interface UserShape {
  name: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  about: string;
  publicKeyJwk?: Record<string, unknown>;
  lastSeenAt?: Date;
  isOnline: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export type IUser = HydratedDocument<UserShape>;

const schema = new Schema<UserShape>({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  phone: { type: String, required: true, unique: true, index: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user', index: true },
  avatarUrl: String,
  about: { type: String, default: 'Available', maxlength: 160 },
  publicKeyJwk: { type: Schema.Types.Mixed },
  lastSeenAt: Date,
  isOnline: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
}, { timestamps: true, toJSON: { transform(_doc, ret) { delete ret.passwordHash; delete ret.__v; return ret; } } });

export const User = model<UserShape>('User', schema);
