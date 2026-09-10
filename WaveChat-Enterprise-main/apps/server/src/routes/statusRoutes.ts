import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { Status } from '../models/Status.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

router.get('/feed', asyncHandler(async (req, res) => {
  const statuses = await Status.find({
    expiresAt: { $gt: new Date() },
    $or: [{ owner: req.user!._id }, { audience: req.user!._id }]
  }).populate('owner', 'name avatarUrl publicKeyJwk').sort({ createdAt: -1 }).limit(200);
  res.json({ statuses });
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = z.object({
    type: z.enum(['text', 'image', 'video']), ciphertext: z.string().min(1), iv: z.string().min(1),
    mediaUrl: z.string().optional(), background: z.string().max(40).optional(),
    audience: z.array(z.string().min(1)).max(1000).default([]),
    wrappedKeys: z.array(z.object({ user: z.string(), wrappedKey: z.string(), iv: z.string(), wrapperPublicKeyJwk: z.record(z.any()) })).min(1)
  }).parse(req.body);
  const allowed = new Set([String(req.user!._id), ...body.audience]);
  if (body.wrappedKeys.some(k => !allowed.has(k.user))) throw new AppError(400, 'Invalid wrapped status key');
  const status = await Status.create({ owner: req.user!._id, ...body, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  await status.populate('owner', 'name avatarUrl publicKeyJwk');
  res.status(201).json({ status });
}));

router.post('/:id/view', asyncHandler(async (req, res) => {
  const status = await Status.findOne({ _id: req.params.id, expiresAt: { $gt: new Date() } });
  if (!status) throw new AppError(404, 'Status not found');
  const allowed = String(status.owner) === String(req.user!._id) || status.audience.some(id => String(id) === String(req.user!._id));
  if (!allowed) throw new AppError(403, 'Status is not visible to you');
  if (!status.viewedBy.some(v => String(v.user) === String(req.user!._id))) {
    status.viewedBy.push({ user: req.user!._id as any, viewedAt: new Date() }); await status.save();
  }
  res.status(204).send();
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = await Status.findOneAndDelete({ _id: req.params.id, owner: req.user!._id });
  if (!deleted) throw new AppError(404, 'Status not found');
  res.status(204).send();
}));
export default router;
