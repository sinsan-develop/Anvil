import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AccessRoutesOptions } from '../access/routes.ts';
import { AuthFailure } from '../access/repository.ts';
import { MethodologiesRepository } from './repository.ts';

function token(request: FastifyRequest) {
  const values = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith('__Host-anvil.sid='));
  return values.length === 1 ? values[0]!.slice('__Host-anvil.sid='.length) : '';
}
export function registerMethodologyRoutes(app: FastifyInstance, options: AccessRoutesOptions) {
  const repository = new MethodologiesRepository(options.repository), host = new URL(options.origin).host;
  app.register(async routes => {
    routes.addHook('onRequest', async request => { if (request.headers.host !== host) throw new AuthFailure('ORIGIN_INVALID', 403); });
    routes.get<{ Querystring: Record<string, unknown> }>('/api/v1/methodologies', { schema: { querystring: { type: 'object', additionalProperties: false,
      properties: { scope: { enum: ['SYSTEM', 'USER_COMMON'] }, name: { type: 'string', maxLength: 200 }, status: { enum: ['DRAFT', 'CONFIRMED'] }, limit: { type: 'string', pattern: '^[1-9][0-9]{0,2}$' }, cursor: { type: 'string', minLength: 1, maxLength: 4096 } } } } }, request => repository.list(token(request), request.query));
    routes.get<{ Params: { id: string; version: string } }>('/api/v1/methodologies/:id/versions/:version', { schema: { params: { type: 'object', additionalProperties: false, required: ['id', 'version'], properties: {
      id: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' }, version: { type: 'string', pattern: '^[1-9][0-9]{0,14}$' },
    } } } }, request => repository.version(token(request), request.params.id, Number(request.params.version)));
  });
}
