import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AccessRepository, AuthFailure } from './repository.ts';
import { parseWireJson } from '../../../../contracts/canonical.ts';

export interface AccessRoutesOptions { repository: AccessRepository; origin: string }
const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
function body(properties: Record<string, unknown>) { return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }; }
function sessionToken(request: FastifyRequest) {
  const found = (request.headers.cookie ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith('__Host-anvil.sid='));
  return found.length === 1 ? found[0]!.slice('__Host-anvil.sid='.length) : '';
}
function csrfToken(request: FastifyRequest) {
  const csrf = request.headers['x-anvil-csrf'];
  if (typeof csrf !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new AuthFailure('CSRF_INVALID', 403);
  return csrf;
}
export function registerAccessRoutes(app: FastifyInstance, options: AccessRoutesOptions) {
  const allowed = new URL(options.origin);
  if (allowed.protocol !== 'https:' || allowed.origin !== options.origin) throw Error('AUTH_ORIGIN_INVALID');
  app.register(async auth => {
    auth.removeContentTypeParser('application/json');
    auth.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, raw, done) => {
      try { done(null, parseWireJson(String(raw))); }
      catch { done(Object.assign(Error('INPUT_INVALID'), { statusCode: 400 }), undefined); }
    });
    auth.addHook('onRequest', async request => {
      if (request.headers.host !== allowed.host) throw new AuthFailure('ORIGIN_INVALID', 403);
      if (request.method !== 'GET' && (request.headers.origin !== options.origin || !/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? ''))) throw new AuthFailure('ORIGIN_INVALID', 403);
    });
    auth.get('/api/v1/auth/setup', () => options.repository.setup());
    auth.get('/api/v1/session', request => options.repository.session(sessionToken(request)));
    auth.post<{ Body: { bootstrapSecret: string; loginName: string; displayName: string; password: string; commandId: string } }>('/api/v1/auth/setup/claim', {
      schema: { body: body({ bootstrapSecret: { ...text(43), pattern: '^[A-Za-z0-9_-]{43}$' }, loginName: text(128), displayName: text(120), password: { ...text(128), minLength: 15 }, commandId: { ...text(36), pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' } }) },
    }, request => options.repository.claimOwner(request.body));
    auth.post<{ Body: { loginName: string; password: string; clientLabel: string } }>('/api/v1/auth/login', { schema: { body: body({ loginName: text(128), password: text(128), clientLabel: text(120) }) } }, async (request, reply) => {
      const { token, ...result } = await options.repository.login(request.body.loginName, request.body.password, request.body.clientLabel, request.ip);
      reply.header('set-cookie', `__Host-anvil.sid=${token}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
      return result;
    });
    auth.post('/api/v1/auth/logout', { schema: { body: body({}) } }, async (request, reply) => {
      const csrf = csrfToken(request);
      await options.repository.logout(sessionToken(request), csrf);
      return reply.header('set-cookie', '__Host-anvil.sid=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0').code(204).send();
    });
    auth.post<{ Body: { password: string } }>('/api/v1/auth/reauthenticate', { schema: { body: body({ password: text(128) }) } }, async (request, reply) => {
      const { token, ...result } = await options.repository.reauthenticate(sessionToken(request), csrfToken(request), request.body.password, request.ip);
      const maxAge = Math.max(0, Math.floor((Date.parse(result.absoluteExpiresAt) - Date.now()) / 1000));
      reply.header('set-cookie', `__Host-anvil.sid=${token}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`);
      return result;
    });
    auth.post<{ Body: { currentPassword: string; newPassword: string; commandId: string } }>('/api/v1/auth/password', { schema: { body: body({ currentPassword: text(128), newPassword: { ...text(128), minLength: 15 }, commandId: { ...text(36), pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' } }) } }, async (request, reply) => {
      await options.repository.changePassword(sessionToken(request), csrfToken(request), request.body, request.ip);
      return reply.header('set-cookie', '__Host-anvil.sid=; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=0').code(204).send();
    });
  });
}
