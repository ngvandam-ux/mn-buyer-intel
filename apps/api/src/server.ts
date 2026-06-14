import cors from '@fastify/cors';
import { type AppDatabase, getDb } from '@mn/db';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerRoutes } from './routes.js';

export async function buildServer(db?: AppDatabase): Promise<FastifyInstance> {
  const database = db ?? (await getDb());
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  await app.register(cors, { origin: true });
  registerRoutes(app, database);
  app.setErrorHandler((err: Error, _req, reply) => {
    app.log.error(err);
    reply.code(500).send({ error: err.message });
  });
  return app;
}
