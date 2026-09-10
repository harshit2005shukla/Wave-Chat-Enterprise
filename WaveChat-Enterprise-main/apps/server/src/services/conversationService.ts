import { Types } from 'mongoose';
import { Conversation } from '../models/Conversation.js';
import { AppError } from '../utils/errors.js';

export async function requireConversationMember(conversationId: string, userId: string) {
  if (!Types.ObjectId.isValid(conversationId)) throw new AppError(400, 'Invalid conversation ID');
  const conversation = await Conversation.findOne({ _id: conversationId, members: userId });
  if (!conversation) throw new AppError(404, 'Conversation not found or access denied');
  return conversation;
}

export function directKeyFor(a: string, b: string) {
  return [a, b].sort().join(':');
}
