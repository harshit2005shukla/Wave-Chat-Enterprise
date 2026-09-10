import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { z } from 'zod';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../services/tokenService.js';
import { env } from '../config/env.js';

const router = Router();
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use E.164 format, for example +919876543210');

async function issueTokens(user: any) {
  const jti = crypto.randomUUID();
  const accessToken = signAccessToken(String(user._id), user.role);
  const refreshToken = signRefreshToken(String(user._id), jti);
  await RefreshToken.create({
    user: user._id,
    jti,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000)
  });
  return { accessToken, refreshToken };
}

router.post('/register', asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2).max(80),
    phone,
    password: z.string().min(8).max(128),
    publicKeyJwk: z.record(z.any()).optional()
  }).parse(req.body);
  const exists = await User.exists({ phone: body.phone });
  if (exists) throw new AppError(409, 'Phone number is already registered');
  const user = await User.create({
    name: body.name,
    phone: body.phone,
    passwordHash: await bcrypt.hash(body.password, 12),
    publicKeyJwk: body.publicKeyJwk
  });
  const tokens = await issueTokens(user);
  res.status(201).json({ user: user.toJSON(), ...tokens });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const body = z.object({ phone, password: z.string().min(1), publicKeyJwk: z.record(z.any()).optional() }).parse(req.body);
  const user = await User.findOne({ phone: body.phone }).select('+passwordHash');
  if (!user || !user.isActive || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new AppError(401, 'Invalid phone number or password');
  }
  if (body.publicKeyJwk) user.publicKeyJwk = body.publicKeyJwk;
  await user.save();
  const tokens = await issueTokens(user);
  const safe = user.toObject() as any; delete safe.passwordHash; delete safe.__v;
  res.json({ user: safe, ...tokens });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
  let payload;
  try { payload = verifyRefreshToken(refreshToken); } catch { throw new AppError(401, 'Invalid or expired refresh token'); }
  const stored = await RefreshToken.findOne({ jti: payload.jti, user: payload.sub, revokedAt: { $exists: false } });
  if (!stored || stored.tokenHash !== hashToken(refreshToken) || stored.expiresAt <= new Date()) {
    throw new AppError(401, 'Refresh token has been revoked');
  }
  stored.revokedAt = new Date(); await stored.save();
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new AppError(401, 'Account unavailable');
  const tokens = await issueTokens(user);
  res.json(tokens);
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
  try {
    const payload = verifyRefreshToken(refreshToken);
    await RefreshToken.updateOne({ jti: payload.jti }, { revokedAt: new Date() });
  } catch { /* idempotent logout */ }
  res.status(204).send();
}));

export default router;
