import { Schema, model } from 'mongoose';

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'system';
interface MessageShape {
  conversation: Schema.Types.ObjectId;
  sender: Schema.Types.ObjectId;
  clientId: string;
  type: MessageType;
  ciphertext: string;
  iv: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaMime?: string;
  mediaSize?: number;
  replyTo?: Schema.Types.ObjectId;
  deliveredTo: Schema.Types.ObjectId[];
  readBy: Schema.Types.ObjectId[];
  editedAt?: Date;
  deletedForEveryoneAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<MessageShape>({
  conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  clientId: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'video', 'audio', 'document', 'system'], required: true },
  ciphertext: { type: String, required: true },
  iv: { type: String, required: true },
  mediaUrl: String,
  mediaName: String,
  mediaMime: String,
  mediaSize: Number,
  replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
  deliveredTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  editedAt: Date,
  deletedForEveryoneAt: Date
}, { timestamps: true });

schema.index({ conversation: 1, createdAt: -1 });
schema.index({ sender: 1, clientId: 1 }, { unique: true });
export const Message = model<MessageShape>('Message', schema);
