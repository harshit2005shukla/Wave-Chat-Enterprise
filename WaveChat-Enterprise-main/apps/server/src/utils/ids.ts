import { randomUUID } from 'node:crypto';
export const newIdempotencyKey = () => randomUUID();
