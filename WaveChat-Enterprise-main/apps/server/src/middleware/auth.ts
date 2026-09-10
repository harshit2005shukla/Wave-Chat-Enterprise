import type { RequestHandler } from 'express';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { verifyAccessToken } from '../services/tokenService.js';

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) throw new AppError(401, 'Authentication required');
  let payload;
  try { payload = verifyAccessToken(token); } catch { throw new AppError(401, 'Invalid or expired access token'); }
  if (payload.type !== 'access') throw new AppError(401, 'Invalid token type');
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new AppError(401, 'Account is unavailable');
  req.user = user;
  next();
});

export const requireRole = (...roles: string[]): RequestHandler => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'Insufficient permissions'));
  next();
};
