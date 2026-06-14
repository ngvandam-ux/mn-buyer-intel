import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { type AppDatabase, getDb } from '@mn/db';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerBasicAuth } from './auth.js';
import { registerRoutes } from './routes.js';

const WEB_DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../web/dist');

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
    allowedHeaders: ['content-type', 'authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
  registerBasicAuth(app);
  registerRoutes(app, database);

  // Serve the built web SPA (single-origin deploy). Non-/api routes fall back to index.html
  // for client-side routing. In dev (no dist) this is skipped and Vite serves the web.
  if (existsSync(WEB_DIST)) {
    await app.register(fastifyStatic, { root: WEB_DIST });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' });
      return reply.sendFile('index.html');
    });
    app.log.info(`serving web SPA from ${WEB_DIST}`);
  }

  app.setErrorHandler((err: Error, _req, reply) => {
    app.log.error(err);
    reply.code(500).send({ error: err.message });
  });
  return app;
}
