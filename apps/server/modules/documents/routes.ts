import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AccessRoutesOptions } from '../access/routes.ts';
import { AuthFailure } from '../access/repository.ts';
import { FormsRepository } from './repository.ts';

function token(request: FastifyRequest): string {
  const matches = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith('__Host-anvil.sid='));
  return matches.length === 1 ? matches[0]!.slice('__Host-anvil.sid='.length) : '';
}
export function registerDocumentRoutes(app: FastifyInstance, options: AccessRoutesOptions) {
  const forms = new FormsRepository(options.repository), host = new URL(options.origin).host;
  app.register(async routes => {
    routes.addHook('onRequest', async request => { if (request.headers.host !== host) throw new AuthFailure('ORIGIN_INVALID', 403); });
    routes.get('/api/v1/forms', { schema: { querystring: { type: 'object', additionalProperties: false, properties: {} } } }, request => forms.list(token(request)));
    routes.get<{ Params: { id: string; version: string } }>('/api/v1/forms/:id/versions/:version', { schema: { params: {
      type: 'object', additionalProperties: false, required: ['id', 'version'], properties: {
        id: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' },
        version: { type: 'string', pattern: '^[1-9][0-9]{0,14}$' },
      },
    } } }, request => forms.version(token(request), request.params.id, Number(request.params.version)));
  });
}
