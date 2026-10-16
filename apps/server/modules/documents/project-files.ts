import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AccessRoutesOptions } from '../access/routes.ts';
import { AuthFailure } from '../access/repository.ts';
import { authorizeMaterial, currentProjectController, persistProjectReceipt, projectMember, projectReplay, recordProjectDenial, type ProjectCommand } from '../access/project-command.ts';
import { ArtifactStore } from '../../storage/artifact-store.ts';
import { parseWireJson,canonicalJson } from '../../../../contracts/canonical.ts';
import{inspectArtifact,assertStoredArtifactReadable}from'../../storage/sensitive-inspection.ts';
import{isApprovalRef}from'../approvals/approval-input.ts';

const uuid = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', validId = new RegExp(uuid);
const mediaTypes = ['text/plain;charset=utf-8', 'text/markdown;charset=utf-8', 'application/octet-stream', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/html;charset=utf-8', 'image/svg+xml', 'image/png', 'image/jpeg'];
function object(value: unknown, keys: string[]): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(','); }
function token(request: FastifyRequest) { const cookies = (request.headers.cookie ?? '').split(';').map(item => item.trim()).filter(item => item.startsWith('__Host-anvil.sid=')); return cookies.length === 1 ? cookies[0]!.slice('__Host-anvil.sid='.length) : ''; }
function csrf(request: FastifyRequest) { const value = request.headers['x-anvil-csrf']; if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new AuthFailure('CSRF_INVALID', 403); return value; }
function uploadContext(raw: unknown, projectId: string): ProjectCommand {
  let value: unknown;
  try { if (typeof raw !== 'string' || raw.length > 8000) throw Error(); value = parseWireJson(raw); } catch { throw new AuthFailure('INPUT_INVALID', 400); }
  if (!object(value, ['schemaVersion', 'projectId', 'commandId', 'clientId', 'controlGeneration', 'operation', 'targetId', 'expectedVersion', 'baselineRefs', 'approvalRef', 'payload']) || value.schemaVersion !== 1 || value.projectId !== projectId
    || typeof value.commandId !== 'string' || !validId.test(value.commandId) || typeof value.clientId !== 'string' || !validId.test(value.clientId) || !Number.isSafeInteger(value.controlGeneration) || Number(value.controlGeneration) < 1
    || value.operation !== 'uploadArtifact' || value.targetId !== null || value.expectedVersion !== 0 || !Array.isArray(value.baselineRefs) || value.baselineRefs.length || !(value.approvalRef===null||isApprovalRef(value.approvalRef))
    || !object(value.payload, ['mediaType', 'bytes', 'contentHash']) || !mediaTypes.includes(String(value.payload.mediaType)) || !Number.isSafeInteger(value.payload.bytes) || Number(value.payload.bytes) < 0 || Number(value.payload.bytes) > 20 * 1024 * 1024 || typeof value.payload.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.payload.contentHash)) throw new AuthFailure('INPUT_INVALID', 400);
  return value as unknown as ProjectCommand;
}
export function registerProjectFileRoutes(app: FastifyInstance, options: AccessRoutesOptions) {
  const store = options.artifactRoot ? new ArtifactStore(options.artifactRoot) : null, host = new URL(options.origin).host;
  const contexts = new WeakMap<FastifyRequest, ProjectCommand>();
  app.register(async files => {
    files.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: 20 * 1024 * 1024 }, (_request, body, done) => done(null, body));
    files.addHook('onRequest', async request => {
      if (request.headers.host !== host || request.method === 'POST' && (request.headers.origin !== options.origin || request.headers['content-type'] !== 'application/octet-stream')) throw new AuthFailure('ORIGIN_INVALID', 403);
      if (request.method === 'POST') {
        const projectId = (request.params as { projectId: string }).projectId;
        if (!validId.test(projectId)) throw new AuthFailure('INPUT_INVALID', 400);
        const context = uploadContext(request.headers['x-anvil-command'], projectId);
        if (request.headers['idempotency-key'] !== undefined && request.headers['idempotency-key'] !== context.commandId) throw new AuthFailure('INPUT_INVALID', 400);
        // 큰 본문 수신 전 검사하며 실제 저장 직전에도 현재 허가를 다시 검사한다.
        try { await options.repository.authenticated(token(request), csrf(request), async (db, actor) => { await currentProjectController(db, actor, context); await authorizeMaterial(db, actor, context); }); }
        catch (error) { await recordProjectDenial(options.repository, token(request), projectId, error); throw error; }
        contexts.set(request, context);
      }
    });
    files.post<{ Params: { projectId: string }; Body: Buffer }>('/api/v1/projects/:projectId/files', { bodyLimit: 20 * 1024 * 1024, schema: { params: { type: 'object', required: ['projectId'], additionalProperties: false, properties: { projectId: { type: 'string', pattern: uuid } } } } }, async (request, reply) => {
      const context = contexts.get(request)!;
      if (!Buffer.isBuffer(request.body) || request.body.length !== context.payload.bytes || createHash('sha256').update(request.body).digest('hex') !== context.payload.contentHash) throw new AuthFailure('ARTIFACT_BYTES_MISMATCH', 422);
      const result = await options.repository.authenticated(token(request), csrf(request), async (db, actor) => {
        await currentProjectController(db, actor, context); const policy = await authorizeMaterial(db, actor, context);
        const previous = await projectReplay(db, actor, context);
        if (!store) throw new AuthFailure('ARTIFACT_STORAGE_UNCONFIGURED', 412);
        if (previous !== undefined) {
          const ref = previous?.data?.artifactRef;
          const row = ref ? (await db.query("SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2 AND content_hash=$3 AND bytes=$4 AND media_type=$5", [ref.artifactId, context.projectId, ref.contentHash, ref.bytes,ref.mediaType])).rows[0] : null;
          if (!row) throw new AuthFailure('ARTIFACT_RECEIPT_INVALID', 503);
          if(row.storage_key!==`blobs/${context.projectId}/${ref.artifactId}`)throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED',503);
          const raw=await store.read(context.projectId,ref.artifactId,ref);
          if(row.state==='QUARANTINED'){if(previous.data.status!=='ARTIFACT_QUARANTINED'||canonicalJson(previous.data.inspection??null)!==canonicalJson(row.inspection_json)||canonicalJson(inspectArtifact(raw))!==canonicalJson(row.inspection_json))throw new AuthFailure('ARTIFACT_RECEIPT_INVALID',503);}
          else{assertStoredArtifactReadable(row,raw);if(previous.data.status!=='ARTIFACT_READY'||row.inspection_json!=null&&canonicalJson(previous.data.inspection??null)!==canonicalJson(row.inspection_json))throw new AuthFailure('ARTIFACT_RECEIPT_INVALID',503);}
          return previous;
        }
        const artifactId = randomUUID(), storageKey = await store.put(context.projectId, artifactId, request.body);
        const ref = { artifactId, contentHash: context.payload.contentHash as string, bytes: request.body.length, mediaType: context.payload.mediaType as string };
        const inspection=inspectArtifact(request.body),state=inspection.state==='SUSPECTED'?'QUARANTINED':'READY';
        const receipt = await persistProjectReceipt(db, actor, context, ref, { status: state==='QUARANTINED'?'ARTIFACT_QUARANTINED':'ARTIFACT_READY',inspection }, policy.ref, state==='QUARANTINED'?'SENSITIVE_ARTIFACT_QUARANTINED':'EXPLICIT_PROJECT_FILE_UPLOAD');
        await db.query("INSERT INTO anvil.artifacts(id,project_id,bytes,content_hash,media_type,storage_key,state,created_by,client_id,command_id,inspection_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [artifactId, context.projectId, ref.bytes, ref.contentHash, ref.mediaType, storageKey,state,actor.actorId, actor.clientId, receipt.id,JSON.stringify(inspection)]);
        return receipt.result;
      });
      return reply.code(201).send(result);
    });
    files.get<{ Params: { projectId: string; artifactId: string } }>('/api/v1/projects/:projectId/files/:artifactId', { schema: { params: { type: 'object', required: ['projectId', 'artifactId'], additionalProperties: false, properties: { projectId: { type: 'string', pattern: uuid }, artifactId: { type: 'string', pattern: uuid } } } } }, async (request, reply) => {
      const result = await options.repository.authenticated(token(request), null, async (db, actor) => {
        await projectMember(db, actor, request.params.projectId);
        const row = (await db.query("SELECT * FROM anvil.artifacts WHERE id=$1 AND project_id=$2", [request.params.artifactId, request.params.projectId])).rows[0];
        if (!row) throw new AuthFailure('NOT_FOUND', 404);
        if(row.state==='QUARANTINED')throw new AuthFailure('ARTIFACT_QUARANTINED',412);
        if (!store) throw new AuthFailure('ARTIFACT_STORAGE_UNCONFIGURED', 412);
        if (row.storage_key !== `blobs/${request.params.projectId}/${request.params.artifactId}`) throw new AuthFailure('ARTIFACT_INTEGRITY_FAILED', 503);
        const bytes=await store.read(request.params.projectId, request.params.artifactId, { bytes: Number(row.bytes), contentHash: row.content_hash });assertStoredArtifactReadable(row,bytes);return bytes;
      });
      return reply.header('content-disposition', `attachment; filename="artifact-${request.params.artifactId}.bin"`).type('application/octet-stream').send(result);
    });
  });
}
