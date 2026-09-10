import { Router } from 'express';
import mongoose from 'mongoose';
const router = Router();
router.get('/', (_req, res) => res.json({
  status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded',
  database: mongoose.connection.readyState,
  uptimeSeconds: Math.round(process.uptime()),
  timestamp: new Date().toISOString()
}));
export default router;
