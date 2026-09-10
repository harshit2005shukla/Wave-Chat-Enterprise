import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { requireConversationMember } from '../services/conversationService.js';

const router = Router();
router.use(authenticate);

const messageBody = z.object({
  conversationId: z.string().min(1),
  clientId: z.string().uuid(),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'system']),
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  mediaUrl: z.string().optional(),
  mediaName: z.string().max(255).optional(),
  mediaMime: z.string().max(120).optional(),
  mediaSize: z.number().nonnegative().optional(),
  replyTo: z.string().optional()
});

router.get('/:conversationId', asyncHandler(async (req, res) => {
  await requireConversationMember(req.params.conversationId, String(req.user!._id));
  const { cursor, limit = '40' } = z.object({ cursor: z.string().optional(), limit: z.string().regex(/^\d+$/).optional() }).parse(req.query);
  const take = Math.min(Number(limit), 100);
  const query: any = { conversation: req.params.conversationId };
  if (cursor) query._id = { $lt: cursor };
  const messages = await Message.find(query)
    .populate('sender', 'name avatarUrl')
    .sort({ _id: -1 }).limit(take + 1);
  const hasMore = messages.length > take;
  const page = messages.slice(0, take).reverse();
  res.json({ messages: page, nextCursor: hasMore ? String(messages[take - 1]!._id) : null });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = messageBody.parse(req.body);
  await requireConversationMember(body.conversationId, String(req.user!._id));
  let message = await Message.findOne({ sender: req.user!._id, clientId: body.clientId });
  if (!message) {
    message = await Message.create({
      conversation: body.conversationId, sender: req.user!._id, clientId: body.clientId,
      type: body.type, ciphertext: body.ciphertext, iv: body.iv, mediaUrl: body.mediaUrl,
      mediaName: body.mediaName, mediaMime: body.mediaMime, mediaSize: body.mediaSize,
      replyTo: body.replyTo, deliveredTo: [req.user!._id], readBy: [req.user!._id]
    });
    await Conversation.updateOne({ _id: body.conversationId }, { lastMessageAt: message.createdAt });
  }
  await message.populate('sender', 'name avatarUrl');
  res.status(201).json({ message });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const body = z.object({ ciphertext: z.string().min(1), iv: z.string().min(1) }).parse(req.body);
  const message = await Message.findOne({ _id: req.params.id, sender: req.user!._id });
  if (!message) throw new AppError(404, 'Message not found');
  await requireConversationMember(String(message.conversation), String(req.user!._id));
  message.ciphertext = body.ciphertext; message.iv = body.iv; message.editedAt = new Date();
  await message.save();
  res.json({ message });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const message = await Message.findOne({ _id: req.params.id, sender: req.user!._id });
  if (!message) throw new AppError(404, 'Message not found');
  message.deletedForEveryoneAt = new Date();
  message.ciphertext = 'deleted'; message.iv = 'deleted';
  await message.save();
  res.status(204).send();
}));

export default router;
