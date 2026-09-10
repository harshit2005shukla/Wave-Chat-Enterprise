import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: error.flatten() });
  }
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message, details: error.details });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ error: 'A record with this value already exists' });
  }
  console.error(error);
  return res.status(500).json({ error: 'Internal server error' });
};
