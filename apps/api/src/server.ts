import cors from '@fastify/cors';
import { type AppDatabase, getDb } from '@mn/db';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export async function buildServer(db?: AppDatabase): Promise<FastifyInstance> {
  const database = db ?? (await getDb());
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  // Restrict CORS to the known web origin(s) rather than reflecting any origin.
  const allowed = new Set(
    (process.env.WEB_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  await app.register(cors, {
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
  });
  registerRoutes(app, database);
  app.setErrorHandler((err: Error, _req, reply) => {
    app.log.error(err);
    reply.code(500).send({ error: err.message });
  });
  return app;
}
