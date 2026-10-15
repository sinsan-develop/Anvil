import { randomUUID } from 'node:crypto';
import { canonicalJson, contentHash, parseWireJson } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { AuthFailure, AccessRepository } from '../access/repository.ts';
import { validateMethodologyGraph } from './service.ts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AccessRoutesOptions } from '../access/routes.ts';
import { persistCommonReceipt, type UserCommonCommand } from '../access/common-command.ts';
import { writeCommonForm } from '../documents/common-write.ts';
import { writeCommonFormReview } from '../documents/content-review.ts';

type CommonCommand = UserCommonCommand;
function fields(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) throw new AuthFailure('INPUT_INVALID', 400);
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AuthFailure('INPUT_INVALID', 400);
  return value;
}
export class CommonMethodologyWriter {
  access: AccessRepository;
  constructor(access: AccessRepository) { this.access = access; }
  async execute(token: string, csrf: string, request: CommonCommand) {
    return this.access.authenticated(token, csrf, async (db, actor) => {
      if (request.clientId !== actor.clientId) throw new AuthFailure('CLIENT_SCOPE_MISMATCH', 403);
      const requestHash = contentHash(canonicalJson(request));
      const previous = (await db.query("SELECT request_hash,result_ref,client_id FROM anvil.commands WHERE scope_kind='USER_COMMON' AND actor_id=$1 AND command_id=$2", [actor.actorId, request.commandId])).rows[0];
      if (previous) {
        if (previous.client_id !== actor.clientId) throw new AuthFailure('CLIENT_SCOPE_MISMATCH', 403);
        if (previous.request_hash !== requestHash) throw new AuthFailure('IDEMPOTENCY_CONFLICT', 409);
        return previous.result_ref;
      }
      if (request.operation === 'copyForm' || request.operation === 'saveFormDraft') return writeCommonForm(db, actor, request);
      if (request.operation === 'recordContentReview' || request.operation === 'confirmForm') return writeCommonFormReview(db, actor, request);
      const payload = request.payload;
      if (payload.scope !== 'USER_COMMON') throw new AuthFailure('COMMON_SCOPE_REQUIRED', 403);
      let id = request.targetId, version: number, name: string, purpose: string, graph: unknown, origin: unknown;
      const reason = text(payload.reason, 20_000);
      if (request.operation === 'copyMethodology') {
        fields(payload, ['sourceRef', 'name', 'scope', 'reason']);
        if (id !== null || request.expectedVersion !== 0 || !isVersionRef(payload.sourceRef)) throw new AuthFailure('INPUT_INVALID', 400);
        const ref = payload.sourceRef;
        const source = (await db.query("SELECT v.* FROM anvil.methodology_versions v JOIN anvil.methodology_definitions d ON d.id=v.definition_id WHERE d.id=$1 AND v.version=$2 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3)", [ref.id, ref.version, actor.actorId])).rows[0];
        if (!source) throw new AuthFailure('NOT_FOUND', 404);
        if (source.content_hash !== ref.contentHash || contentHash(canonicalJson(source.graph_json)) !== ref.contentHash) throw new AuthFailure('SOURCE_VERSION_CONFLICT', 409);
        id = randomUUID(); version = 1; name = text(payload.name); purpose = source.purpose; graph = source.graph_json;
        origin = { kind: 'COPY', parentRef: ref };
      } else {
        fields(payload, ['name', 'purpose', 'scope', 'graph', 'reason']);
        name = text(payload.name); purpose = text(payload.purpose, 20_000); graph = payload.graph;
        if (id === null) {
          if (request.expectedVersion !== 0) throw new AuthFailure('VERSION_CONFLICT', 409);
          id = randomUUID(); version = 1; origin = { kind: 'USER_AUTHORED' };
        } else {
          const current = (await db.query("SELECT d.scope,d.owner_user_id,d.head_version,v.content_hash FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=d.head_version WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$2) FOR UPDATE OF d", [id, actor.actorId])).rows[0];
          if (!current) throw new AuthFailure('NOT_FOUND', 404);
          if (current.scope !== 'USER_COMMON') throw new AuthFailure('SYSTEM_IMMUTABLE', 403);
          const head = Number(current.head_version);
          if (!Number.isSafeInteger(head) || head >= Number.MAX_SAFE_INTEGER) throw new AuthFailure('VERSION_LIMIT', 412);
          if (head !== request.expectedVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
          version = head + 1; origin = { kind: 'REVISION', parentRef: { id, version: head, contentHash: current.content_hash } };
        }
      }
      const forms = (await db.query("SELECT v.definition_id AS id,v.version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1", [actor.actorId])).rows.map(row => ({ id: row.id, version: Number(row.version), contentHash: row.content_hash }));
      const validation = validateMethodologyGraph(graph, forms);
      if (validation.issues.some(issue => issue.code === 'INPUT_INVALID')) throw new AuthFailure('GRAPH_INPUT_INVALID', 422);
      const graphHash = contentHash(canonicalJson(graph));
      await db.query("SELECT set_config('anvil.actor_id',$1,true)", [actor.actorId]);
      if (version === 1) await db.query("INSERT INTO anvil.methodology_definitions(id,scope,owner_user_id,name,purpose,head_version) VALUES($1,'USER_COMMON',$2,$3,$4,1)", [id, actor.actorId, name, purpose]);
      await db.query('INSERT INTO anvil.methodology_versions(definition_id,version,name,purpose,graph_json,content_hash,origin_ref_json,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, version, name, purpose, JSON.stringify(graph), graphHash, JSON.stringify(origin), reason, actor.actorId]);
      if (version > 1) await db.query('UPDATE anvil.methodology_definitions SET head_version=$2 WHERE id=$1', [id, version]);
      return persistCommonReceipt(db, actor, request, { id, version, contentHash: graphHash }, validation);
    });
  }
}
export function registerCommonMethodologyWrites(app: FastifyInstance, options: AccessRoutesOptions) {
  const writer = new CommonMethodologyWriter(options.repository), host = new URL(options.origin).host;
  const id = { type: 'string', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' };
  app.register(async routes => {
    routes.removeContentTypeParser('application/json');
    routes.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, raw, done) => { try { done(null, parseWireJson(String(raw))); } catch { done(Object.assign(Error('INPUT_INVALID'), { statusCode: 400 }), undefined); } });
    routes.addHook('onRequest', async request => {
      if (request.headers.host !== host || request.headers.origin !== options.origin || !/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) throw new AuthFailure('ORIGIN_INVALID', 403);
    });
    routes.post<{ Body: CommonCommand }>('/api/v1/user-common/commands', { schema: { body: { type: 'object', additionalProperties: false,
      required: ['schemaVersion', 'commandId', 'operation', 'targetId', 'expectedVersion', 'clientId', 'payload'], properties: {
        schemaVersion: { const: 1 }, commandId: id, operation: { enum: ['copyMethodology', 'saveMethodologyDraft', 'copyForm', 'saveFormDraft', 'recordContentReview', 'confirmForm'] }, targetId: { anyOf: [id, { type: 'null' }] },
        expectedVersion: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER }, clientId: id, payload: { type: 'object' },
      } } } }, request => writer.execute(sessionToken(request), csrfToken(request), request.body));
  });
}
function sessionToken(request: FastifyRequest) {
  const cookies = (request.headers.cookie ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith('__Host-anvil.sid='));
  return cookies.length === 1 ? cookies[0]!.slice('__Host-anvil.sid='.length) : '';
}
function csrfToken(request: FastifyRequest) {
  const csrf = request.headers['x-anvil-csrf'];
  if (typeof csrf !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(csrf)) throw new AuthFailure('CSRF_INVALID', 403);
  return csrf;
}
