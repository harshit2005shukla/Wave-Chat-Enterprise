import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Conversation } from '../models/Conversation.js';
import { Message } from '../models/Message.js';
import { Status } from '../models/Status.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/stats', asyncHandler(async (_req, res) => {
  const [users, activeUsers, conversations, messages, statuses] = await Promise.all([
    User.countDocuments(), User.countDocuments({ isActive: true }), Conversation.countDocuments(),
    Message.countDocuments(), Status.countDocuments({ expiresAt: { $gt: new Date() } })
  ]);
  res.json({ users, activeUsers, conversations, messages, activeStatuses: statuses, generatedAt: new Date() });
}));

export default router;
