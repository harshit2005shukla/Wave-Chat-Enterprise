import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { directKeyFor, requireConversationMember } from '../services/conversationService.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ members: req.user!._id })
    .populate('members', 'name phone avatarUrl about publicKeyJwk isOnline lastSeenAt')
    .populate('createdBy', 'name')
    .sort({ lastMessageAt: -1, updatedAt: -1 });
  res.json({ conversations });
}));

router.post('/direct', asyncHandler(async (req, res) => {
  const { userId } = z.object({ userId: z.string().min(1) }).parse(req.body);
  if (userId === String(req.user!._id)) throw new AppError(400, 'Cannot create a direct chat with yourself');
  const peer = await User.findById(userId).select('name phone avatarUrl about publicKeyJwk isOnline lastSeenAt');
  if (!peer || !peer.isActive) throw new AppError(404, 'User not found');
  const directKey = directKeyFor(String(req.user!._id), userId);
  let conversation = await Conversation.findOne({ directKey });
  if (!conversation) {
    conversation = await Conversation.create({
      type: 'direct', members: [req.user!._id, peer._id], admins: [], createdBy: req.user!._id, directKey
    });
  }
  await conversation.populate('members', 'name phone avatarUrl about publicKeyJwk isOnline lastSeenAt');
  res.status(201).json({ conversation });
}));

router.post('/group', asyncHandler(async (req, res) => {
  const body = z.object({
    title: z.string().trim().min(2).max(120),
    memberIds: z.array(z.string().min(1)).min(1).max(255),
    wrappedKeys: z.array(z.object({
      user: z.string().min(1), wrappedKey: z.string().min(1), iv: z.string().min(1), wrapperPublicKeyJwk: z.record(z.any())
    })).min(2)
  }).parse(req.body);
  const members = [...new Set([String(req.user!._id), ...body.memberIds])];
  const count = await User.countDocuments({ _id: { $in: members }, isActive: true });
  if (count !== members.length) throw new AppError(400, 'One or more group members are invalid');
  const wrappedUsers = new Set(body.wrappedKeys.map(k => k.user));
  if (members.some(id => !wrappedUsers.has(id))) throw new AppError(400, 'A wrapped group key is required for every member');
  const conversation = await Conversation.create({
    type: 'group', title: body.title, members, admins: [req.user!._id], createdBy: req.user!._id,
    wrappedKeys: body.wrappedKeys
  });
  await conversation.populate('members', 'name phone avatarUrl about publicKeyJwk isOnline lastSeenAt');
  res.status(201).json({ conversation });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const conversation = await requireConversationMember(req.params.id, String(req.user!._id));
  await conversation.populate('members', 'name phone avatarUrl about publicKeyJwk isOnline lastSeenAt');
  res.json({ conversation });
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const conversation = await requireConversationMember(req.params.id, String(req.user!._id));
  if (conversation.type !== 'group' || !conversation.admins.some(id => String(id) === String(req.user!._id))) {
    throw new AppError(403, 'Only group administrators can update the group');
  }
  const patch = z.object({ title: z.string().trim().min(2).max(120).optional(), avatarUrl: z.string().url().or(z.literal('')).optional() }).parse(req.body);
  Object.assign(conversation, patch); await conversation.save();
  res.json({ conversation });
}));

router.post('/:id/members', asyncHandler(async (req, res) => {
  const conversation = await requireConversationMember(req.params.id, String(req.user!._id));
  if (conversation.type !== 'group' || !conversation.admins.some(id => String(id) === String(req.user!._id))) {
    throw new AppError(403, 'Only group administrators can add members');
  }
  const body = z.object({ userId: z.string().min(1), wrappedKey: z.string().min(1), iv: z.string().min(1), wrapperPublicKeyJwk: z.record(z.any()) }).parse(req.body);
  const user = await User.findById(body.userId);
  if (!user || !user.isActive) throw new AppError(404, 'User not found');
  if (!conversation.members.some(id => String(id) === body.userId)) conversation.members.push(user._id as any);
  conversation.wrappedKeys = conversation.wrappedKeys.filter(k => String(k.user) !== body.userId);
  conversation.wrappedKeys.push({ user: user._id as any, wrappedKey: body.wrappedKey, iv: body.iv, wrapperPublicKeyJwk: body.wrapperPublicKeyJwk });
  await conversation.save();
  res.json({ conversation });
}));

router.delete('/:id/members/:userId', asyncHandler(async (req, res) => {
  const conversation = await requireConversationMember(req.params.id, String(req.user!._id));
  const isSelf = req.params.userId === String(req.user!._id);
  const isAdmin = conversation.admins.some(id => String(id) === String(req.user!._id));
  if (conversation.type !== 'group' || (!isSelf && !isAdmin)) throw new AppError(403, 'Not allowed');
  conversation.members = conversation.members.filter(id => String(id) !== req.params.userId);
  conversation.admins = conversation.admins.filter(id => String(id) !== req.params.userId);
  conversation.wrappedKeys = conversation.wrappedKeys.filter(k => String(k.user) !== req.params.userId);
  await conversation.save();
  res.status(204).send();
}));

export default router;
