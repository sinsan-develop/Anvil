import Fastify, { type FastifyServerOptions } from 'fastify';
import { readFile } from 'node:fs/promises';
import type { ServerOptions as HttpsOptions } from 'node:https';
import { registerAccessRoutes, type AccessRoutesOptions } from './modules/access/routes.ts';
import { AuthFailure } from './modules/access/repository.ts';
import { registerProjectRoutes } from './modules/projects/routes.ts';
import { registerDocumentRoutes } from './modules/documents/routes.ts';
import { registerMethodologyRoutes } from './modules/methodologies/routes.ts';
import { registerCommonMethodologyWrites } from './modules/methodologies/common-write.ts';
import { registerProjectFileRoutes } from './modules/documents/project-files.ts';
import { enforceConnectorCredentialScope } from './http/connector-auth.ts';
import { registerConnectorRegistrationRoutes } from './modules/connections/registration-routes.ts';
import { registerSourceReadRoutes } from './modules/connections/source-read-routes.ts';
import type {SyntheticHumanExecutionPorts} from './modules/executions/project-runtime-commands.ts';
import {registerProviderClaimHistoryRoutes} from './modules/executions/provider-session-claim-history-routes.ts';
import {registerUnderstandingHistoryRoutes} from './modules/executions/understanding-history-routes.ts';
import { registerControlHandoffRoutes, type ControlHandoffRoutesOptions } from './modules/control-handoff/routes.ts';

export function buildApp(options: FastifyServerOptions & { https?: HttpsOptions } = {}, webRoot?: URL, access?: AccessRoutesOptions, syntheticExecution?:SyntheticHumanExecutionPorts, controlHandoff?: ControlHandoffRoutesOptions) {
  const app = Fastify({ ...options, logger: false, bodyLimit: 2 * 1024 * 1024, ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } } });
  app.addHook('onRequest',async request=>enforceConnectorCredentialScope(request));
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    return payload;
  });
  app.get('/api/v1/health', async () => ({ status: 'ok', scope: 'process', version: '0.1.0' }));
  if (access) { registerAccessRoutes(app, access); registerProjectRoutes(app, access, syntheticExecution); registerDocumentRoutes(app, access); registerMethodologyRoutes(app, access); registerCommonMethodologyWrites(app, access); registerProjectFileRoutes(app, access); registerConnectorRegistrationRoutes(app,access); registerSourceReadRoutes(app,access); registerProviderClaimHistoryRoutes(app,access); }
  if(access)registerUnderstandingHistoryRoutes(app,access,syntheticExecution?.understandingHistory);
  if (controlHandoff?.enabled === true) registerControlHandoffRoutes(app, controlHandoff);
  if (webRoot) {
    app.get('/', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(new URL('index.html', webRoot))));
    app.get<{ Params: { name: string } }>('/assets/:name', async (request, reply) => {
      const { name } = request.params;
      if (!/^[a-zA-Z0-9_-]+\.(js|css)$/.test(name)) return reply.callNotFound();
      try {
        const body = await readFile(new URL('assets/' + name, webRoot));
        return reply.type(name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8').send(body);
      } catch { return reply.callNotFound(); }
    });
  }
  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    code: 'NOT_FOUND', message: '대상을 찾을 수 없습니다', requestId: request.id,
    targetId: null, retryDisposition: 'not-retryable', details: {},
  }));
  app.setErrorHandler((error, request, reply) => {
    const declared = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 0;
    const status = declared >= 400 && declared < 500 ? declared : 503;
    return reply.code(status).send({
      code: error instanceof AuthFailure ? error.message : status === 413 ? 'PAYLOAD_TOO_LARGE' : status >= 500 ? 'STORAGE_FAILED' : 'INPUT_INVALID',
      message: '요청을 처리하지 못했습니다', requestId: request.id, targetId: null,
      retryDisposition: status >= 500 ? 'reconcile-first' : 'not-retryable', details: {},
    });
  });
  return app;
}
