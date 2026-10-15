import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthFailure } from '../access/repository.ts';
import type { AccessRoutesOptions } from '../access/routes.ts';
import { ProjectsRepository } from './repository.ts';

function token(request: FastifyRequest): string {
  const cookies = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith('__Host-anvil.sid='));
  return cookies.length === 1 ? cookies[0]!.slice('__Host-anvil.sid='.length) : '';
}
export function registerProjectRoutes(app: FastifyInstance, options: AccessRoutesOptions) {
  const repository = new ProjectsRepository(options.repository), host = new URL(options.origin).host;
  app.register(async projects => {
    projects.addHook('onRequest', async request => { if (request.headers.host !== host) throw new AuthFailure('ORIGIN_INVALID', 403); });
    projects.get<{ Querystring: Record<string, unknown> }>('/api/v1/projects', request => repository.list(token(request), request.query));
    projects.get<{ Params: { projectId: string } }>('/api/v1/projects/:projectId', { schema: { params: { type: 'object', properties: { projectId: { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' } }, required: ['projectId'], additionalProperties: false } } }, request => repository.detail(token(request), request.params.projectId));
  });
}
