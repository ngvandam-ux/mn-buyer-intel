/**
 * Optional HTTP Basic Auth gate. Enabled only when BASIC_AUTH_USER and BASIC_AUTH_PASS
 * are both set (so dev stays open, prod fails closed). `/api/health` is always allowed so
 * platform health checks pass. Comparison is constant-time over SHA-256 digests.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const digest = (s: string): Buffer => createHash('sha256').update(s).digest();

export function registerBasicAuth(app: FastifyInstance): void {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) {
    app.log.warn('BASIC_AUTH_USER/PASS not set — API is OPEN (development mode)');
    return;
  }
  const expected = digest(`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`);

  app.addHook('onRequest', async (req, reply) => {
    // Gate the API only; the static SPA + health check load openly (the SPA then sends
    // credentials with each /api call).
    if (!req.url.startsWith('/api/') || req.url === '/api/health') return;
    const provided = digest(req.headers.authorization ?? '');
    if (!timingSafeEqual(provided, expected)) {
      // No WWW-Authenticate header on purpose: the SPA manages sign-in itself, and that
      // header would make the browser pop its own native Basic-Auth dialog (a confusing
      // second prompt). The SPA's AuthGate handles the 401.
      reply.code(401).send({ error: 'unauthorized' });
    }
  });
  app.log.info('Basic Auth gate enabled');
}
