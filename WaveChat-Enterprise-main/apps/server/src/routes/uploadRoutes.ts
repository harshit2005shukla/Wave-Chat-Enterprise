import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const router = Router();
const serverRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const uploadDir = path.join(serverRoot, env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

const allowed = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/webm',
  'application/pdf', 'text/plain', 'application/zip', 'application/octet-stream',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => allowed.has(file.mimetype) ? cb(null, true) : cb(new AppError(415, 'Unsupported file type'))
});

router.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) throw new AppError(400, 'File is required');
  res.status(201).json({
    file: {
      url: `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      mime: req.file.mimetype,
      size: req.file.size
    }
  });
});

export default router;
