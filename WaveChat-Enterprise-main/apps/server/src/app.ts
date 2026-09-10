import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import statusRoutes from './routes/statusRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));

  const serverRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const uploadDir = path.join(serverRoot, env.UPLOAD_DIR);
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use('/uploads', express.static(uploadDir, { maxAge: '1d', immutable: false }));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/statuses', statusRoutes);
  app.use('/api/uploads', uploadRoutes);
  app.use('/api/admin', adminRoutes);

  const webDist = path.resolve(serverRoot, '../web/dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((req, res, next) => req.method === 'GET' && !req.path.startsWith('/api/') ? res.sendFile(path.join(webDist, 'index.html')) : next());
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
