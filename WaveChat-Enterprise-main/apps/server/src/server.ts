import http from 'node:http';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { createSocketServer } from './socket/index.js';

async function main() {
  await connectDatabase();
  const app = createApp();
  const server = http.createServer(app);
  createSocketServer(server);
  server.listen(env.PORT, () => console.log(`[server] listening on http://localhost:${env.PORT}`));

  const shutdown = async (signal: string) => {
    console.log(`[server] received ${signal}; shutting down`);
    server.close(async () => { await disconnectDatabase(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(error => { console.error('[server] fatal startup error', error); process.exit(1); });
