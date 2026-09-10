import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessPayload { sub: string; role: string; type: 'access' }
export interface RefreshPayload { sub: string; jti: string; type: 'refresh' }

export function signAccessToken(userId: string, role: string) {
  return jwt.sign({ sub: userId, role, type: 'access' } satisfies AccessPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn']
  });
}

export function signRefreshToken(userId: string, jti: string) {
  return jwt.sign({ sub: userId, jti, type: 'refresh' } satisfies RefreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
