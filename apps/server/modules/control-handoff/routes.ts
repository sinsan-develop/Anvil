import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseWireJson } from '../../../../contracts/canonical.ts';
import { hashV1, recordV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { requestControl, ControlRequestStoreFailure } from './control-request-store.ts';
import { readControlRequest, listControlRequests, ControlRequestReadFailure } from './control-request-read.ts';
import { prepareControlHandoff, readControlHandoffSummary,
  HandoffSummaryStoreFailure } from './control-handoff-summary-store.ts';
import type { ControlHandoffPgSource } from './control-handoff-pg.ts';

export interface ControlHandoffRoutesOptions {
  origin: string;
  source: ControlHandoffPgSource;
  enabled?: boolean;
}
type ProjectParams = { projectId: string };
type RequestParams = ProjectParams & { requestId: string; requestVersion: string };
type SummaryParams = RequestParams & { summaryVersion: string };
const fail = (code: string, statusCode: number): never => { throw new AuthFailure(code, statusCode); };
const validProject = (value: string): string => uuidV1(value) ? value : fail('INPUT_INVALID', 400);
const exactVersion = (value: string): number => value === '1' ? 1 : fail('INPUT_INVALID', 400);
const summaryVersion = (value: string): number =>
  /^(?:[1-9][0-9]*)$/.test(value) && Number.isSafeInteger(Number(value))
    ? Number(value) : fail('INPUT_INVALID', 400);
const validHash = (value: unknown): string => hashV1(value) ? value : fail('INPUT_INVALID', 400);

function sessionToken(request: FastifyRequest): string {
  const values = (request.headers.cookie ?? '').split(';').map(value => value.trim())
    .filter(value => value.startsWith('__Host-anvil.sid='));
  const token = values.length === 1 ? values[0]?.slice('__Host-anvil.sid='.length) : undefined;
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
    ? token : fail('AUTH_REQUIRED', 401);
}
function csrfToken(request: FastifyRequest): string {
  const csrf = request.headers['x-anvil-csrf'];
  return typeof csrf === 'string' && /^[A-Za-z0-9_-]{43}$/.test(csrf)
    ? csrf : fail('CSRF_INVALID', 403);
}
function exactBody(value: unknown, operation: 'requestControl' | 'prepareControlHandoff',
  projectId: string): void {
  if (!recordV1(value, ['schemaVersion', 'operation', 'commandId', 'projectId', 'clientId', 'payload'])
    || value.schemaVersion !== 1 || value.operation !== operation || !uuidV1(value.commandId)
    || !uuidV1(value.clientId) || value.projectId !== projectId) fail('INPUT_INVALID', 400);
}
function requestRef(params: RequestParams, hash: unknown) {
  return { id: validProject(params.requestId), version: exactVersion(params.requestVersion),
    contentHash: validHash(hash) };
}
function plainQuery(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.getOwnPropertySymbols(value).length > 0) return fail('INPUT_INVALID', 400);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(item => !item.enumerable || !('value' in item)))
    return fail('INPUT_INVALID', 400);
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}
function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!recordV1(value, keys)) return fail('INPUT_INVALID', 400);
  return value;
}
function query(value: unknown, keys: readonly string[]): Record<string, unknown> {
  return exactObject(plainQuery(value), keys);
}
function listQuery(value: unknown): { view: 'OWN' | 'CONTROLLER'; limit?: number; cursor?: string } {
  const input = plainQuery(value);
  if (!recordV1(input, ['view']) && !recordV1(input, ['view', 'limit'])
    && !recordV1(input, ['view', 'cursor']) && !recordV1(input, ['view', 'limit', 'cursor']))
    return fail('INPUT_INVALID', 400);
  if (input.view !== 'OWN' && input.view !== 'CONTROLLER') return fail('INPUT_INVALID', 400);
  const result: { view: 'OWN' | 'CONTROLLER'; limit?: number; cursor?: string } = { view: input.view };
  if (input.limit !== undefined) {
    if (typeof input.limit !== 'string' || !/^[1-9][0-9]*$/.test(input.limit)
      || Number(input.limit) > 200) return fail('INPUT_INVALID', 400);
    result.limit = Number(input.limit);
  }
  if (input.cursor !== undefined) {
    if (typeof input.cursor !== 'string' || !input.cursor
      || Buffer.byteLength(input.cursor, 'utf8') > 4096) return fail('INPUT_INVALID', 400);
    result.cursor = input.cursor;
  }
  return result;
}

const errorShape = (error: unknown): { code: string; status: number; commandId: string | null } => {
  if (error instanceof Error && 'code' in error && error.code === 'FST_ERR_CTP_BODY_TOO_LARGE'
    && 'statusCode' in error && error.statusCode === 413)
    return { code: 'PAYLOAD_TOO_LARGE', status: 413, commandId: null };
  if (error instanceof AuthFailure &&
    ((error.message === 'AUTH_REQUIRED' && error.statusCode === 401)
      || (error.message === 'CSRF_INVALID' && error.statusCode === 403)
      || (error.message === 'ORIGIN_INVALID' && error.statusCode === 403)
      || (error.message === 'INPUT_INVALID' && error.statusCode === 400)))
    return { code: error.message, status: error.statusCode, commandId: null };
  if (error instanceof ControlRequestStoreFailure || error instanceof ControlRequestReadFailure
    || error instanceof HandoffSummaryStoreFailure) {
    const code = error.code;
    const commandId = 'commandId' in error && typeof error.commandId === 'string' ? error.commandId : null;
    if (code.endsWith('_NOT_CONNECTED')) return { code: 'NOT_CONNECTED', status: 503, commandId };
    if (code.endsWith('_NOT_FOUND')) return { code: 'NOT_FOUND', status: 404, commandId: null };
    if (code.endsWith('_ACCESS_DENIED') || code.endsWith('_READ_DENIED'))
      return { code: 'ACCESS_DENIED', status: 403, commandId: null };
    if (code.endsWith('_INPUT_INVALID') || code.endsWith('_COMMAND_INVALID'))
      return { code: 'INPUT_INVALID', status: 400, commandId: null };
    if (code.endsWith('_COMMAND_CONFLICT') || code.endsWith('_VERSION_INVALID'))
      return { code: 'CONFLICT', status: 409, commandId };
    if (code === 'CONTROL_REQUEST_CURSOR_INVALID') return { code: 'INPUT_INVALID', status: 400, commandId: null };
    if (code === 'HANDOFF_REQUEST_INVALID') return { code: 'CONFLICT', status: 409, commandId };
    return { code: 'STORAGE_FAILED', status: 503, commandId };
  }
  return { code: 'STORAGE_FAILED', status: 503, commandId: null };
};

/** 기본 미등록이다. 명시 옵션이 없는 buildApp은 이 함수를 호출하지 않는다. */
export function registerControlHandoffRoutes(app: FastifyInstance, options: ControlHandoffRoutesOptions): void {
  if (options.enabled !== true) return;
  const allowed = new URL(options.origin);
  if (allowed.protocol !== 'https:' || allowed.origin !== options.origin) throw Error('AUTH_ORIGIN_INVALID');
  app.register(async scoped => {
    scoped.removeContentTypeParser('application/json');
    scoped.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, raw, done) => {
      try { done(null, parseWireJson(String(raw))); }
      catch { done(new AuthFailure('INPUT_INVALID', 400), undefined); }
    });
    scoped.addHook('onRequest', async request => {
      if (request.headers.host !== allowed.host) fail('ORIGIN_INVALID', 403);
      if (request.method !== 'GET' && (request.headers.origin !== options.origin
        || !/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')))
        fail('ORIGIN_INVALID', 403);
      if (request.method === 'GET' && request.headers.origin !== undefined
        && request.headers.origin !== options.origin) fail('ORIGIN_INVALID', 403);
      // 모든 FN15 endpoint에서 cookie와 CSRF를 확인한다. 세션 진위는 같은 PG transaction에서 확인한다.
      sessionToken(request);
      csrfToken(request);
    });
    scoped.setErrorHandler((error, request, reply) => {
      const { code, status, commandId } = errorShape(error);
      return reply.code(status).send({ code, message: '요청을 처리하지 못했습니다', requestId: request.id,
        targetId: null, retryDisposition: status >= 500 ? 'reconcile-first' : 'not-retryable',
        details: commandId ? { commandId } : {} });
    });
    const base = '/api/v1/projects/:projectId/control-requests';
    const version = `${base}/:requestId/versions/:requestVersion`;
    scoped.post<{ Params: ProjectParams; Body: unknown }>(base, async (request, reply) => {
      const projectId = validProject(request.params.projectId);
      exactBody(request.body, 'requestControl', projectId);
      const ports = options.source.forSession(sessionToken(request), csrfToken(request), projectId);
      return reply.code(201).send(await requestControl(request.body, ports.requestPort));
    });
    scoped.get<{ Params: ProjectParams; Querystring: unknown }>(base, async request => {
      const projectId = validProject(request.params.projectId);
      const input = listQuery(request.query);
      const ports = options.source.forSession(sessionToken(request), csrfToken(request), projectId);
      return listControlRequests({ projectId, ...input }, ports.readPort);
    });
    scoped.get<{ Params: RequestParams; Querystring: unknown }>(version, async request => {
      const projectId = validProject(request.params.projectId);
      const fields = query(request.query, ['contentHash']);
      const ref = requestRef(request.params, fields.contentHash);
      const ports = options.source.forSession(sessionToken(request), csrfToken(request), projectId);
      return readControlRequest({ projectId, requestRef: ref }, ports.readPort);
    });
    scoped.post<{ Params: RequestParams; Body: unknown }>(`${version}/handoff-summaries`, async (request, reply) => {
      const projectId = validProject(request.params.projectId);
      exactBody(request.body, 'prepareControlHandoff', projectId);
      const body = exactObject(request.body, ['schemaVersion', 'operation', 'commandId', 'projectId', 'clientId', 'payload']);
      const payload = exactObject(body.payload, ['requestRef']);
      const ref = exactObject(payload.requestRef, ['id', 'version', 'contentHash']);
      if (ref.id !== request.params.requestId || ref.version !== exactVersion(request.params.requestVersion)
        || !hashV1(ref.contentHash)) fail('INPUT_INVALID', 400);
      const ports = options.source.forSession(sessionToken(request), csrfToken(request), projectId);
      return reply.code(201).send(await prepareControlHandoff(request.body, ports.summaryPort));
    });
    scoped.get<{ Params: SummaryParams; Querystring: unknown }>(`${version}/handoff-summaries/:summaryVersion`, async request => {
      const projectId = validProject(request.params.projectId);
      const fields = query(request.query, ['requestHash', 'summaryHash']);
      const ref = requestRef(request.params, fields.requestHash);
      const summaryRef = { id: ref.id, version: summaryVersion(request.params.summaryVersion),
        contentHash: validHash(fields.summaryHash) };
      const ports = options.source.forSession(sessionToken(request), csrfToken(request), projectId);
      return readControlHandoffSummary({ projectId, requestRef: ref, summaryRef }, ports.summaryPort);
    });
  });
}
