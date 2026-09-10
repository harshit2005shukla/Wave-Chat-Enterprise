import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

router.get('/me', asyncHandler(async (req, res) => res.json({ user: req.user!.toJSON() })));

router.patch('/me', asyncHandler(async (req, res) => {
  const patch = z.object({
    name: z.string().trim().min(2).max(80).optional(),
    about: z.string().trim().max(160).optional(),
    avatarUrl: z.string().url().or(z.literal('')).optional(),
    publicKeyJwk: z.record(z.any()).optional()
  }).parse(req.body);
  Object.assign(req.user!, patch);
  await req.user!.save();
  res.json({ user: req.user!.toJSON() });
}));

router.get('/search', asyncHandler(async (req, res) => {
  const { q = '' } = z.object({ q: z.string().max(80).optional() }).parse(req.query);
  if (q.trim().length < 2) return res.json({ users: [] });
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({
    _id: { $ne: req.user!._id }, isActive: true,
    $or: [{ name: { $regex: escaped, $options: 'i' } }, { phone: { $regex: escaped, $options: 'i' } }]
  }).select('name phone avatarUrl about publicKeyJwk isOnline lastSeenAt').limit(20);
  res.json({ users });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name phone avatarUrl about publicKeyJwk isOnline lastSeenAt');
  if (!user) throw new AppError(404, 'User not found');
  res.json({ user });
}));

export default router;
