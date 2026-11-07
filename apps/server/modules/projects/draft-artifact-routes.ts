import type { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthFailure } from '../access/repository.ts';
import { parseWireJson } from '../../../../contracts/canonical.ts';
import { draftArtifactLimits, draftUuid, validDraftUploadCommand, type DraftUploadCommand } from '../../../../contracts/draft-artifacts.ts';
import type { DraftArtifacts } from './draft-artifacts.ts';
function token(r: FastifyRequest) { const values = (r.headers.cookie ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith('__Host-anvil.sid=')); return values.length === 1 ? values[0]!.slice('__Host-anvil.sid='.length) : ''; }
function csrf(r: FastifyRequest) { const v = r.headers['x-anvil-csrf']; if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(v)) throw new AuthFailure('CSRF_INVALID', 403); return v; }
export function readDraftUploadHeader(raw: unknown): DraftUploadCommand {
  try { if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > draftArtifactLimits.headerBytes) throw Error(); const value = parseWireJson(raw); if (!validDraftUploadCommand(value)) throw Error(); return value; }
  catch { throw new AuthFailure('INPUT_INVALID', 400); }
}
export function registerDraftArtifactRoutes(app: FastifyInstance, origin: string, artifacts: DraftArtifacts) {
  const host = new URL(origin).host, commands = new WeakMap<FastifyRequest, DraftUploadCommand>();
  app.register(async files => {
    files.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: draftArtifactLimits.fileBytes }, (_r, body, done) => done(null, body));
    files.addHook('onRequest', async r => {
      if (r.headers.host !== host || r.method === 'POST' && (r.headers.origin !== origin || r.headers['content-type'] !== 'application/octet-stream')) throw new AuthFailure('ORIGIN_INVALID', 403);
      const { draftId, artifactId } = r.params as { draftId: string; artifactId?: string };
      if (!draftUuid(draftId) || artifactId !== undefined && !draftUuid(artifactId) || Object.keys(r.query as object).length) throw new AuthFailure('INPUT_INVALID', 400);
      if (r.method === 'POST') {
        if (r.raw.rawHeaders.filter((v, i) => i % 2 === 0 && v.toLowerCase() === 'x-anvil-command').length !== 1) throw new AuthFailure('INPUT_INVALID', 400);
        const command = readDraftUploadHeader(r.headers['x-anvil-command']);
        if (r.headers['idempotency-key'] !== undefined && r.headers['idempotency-key'] !== command.commandId) throw new AuthFailure('INPUT_INVALID', 400);
        if (r.headers['content-length'] !== undefined && Number(r.headers['content-length']) !== command.payload.bytes) throw new AuthFailure('ARTIFACT_BYTES_MISMATCH', 409);
        // 큰 본문 수신 전에 인증과 durable 예약을 commit한다.
        await artifacts.reserveUpload(token(r), csrf(r), draftId, command); commands.set(r, command);
      }
    });
    // onRequest에서 예약한 후 parser/연결 오류가 나도 미확정 상태를 방치하지 않는다.
    const interrupted = async (r: FastifyRequest) => {
      const command = commands.get(r); if (!command) return;
      await artifacts.abortUpload(token(r), csrf(r), (r.params as { draftId: string }).draftId, command).catch(() => {});
    };
    files.addHook('onError', async r => { await interrupted(r); });
    files.addHook('onRequestAbort', async r => { await interrupted(r); });
    files.post<{ Params: { draftId: string }; Body: Buffer }>('/api/v1/project-drafts/:draftId/files', { bodyLimit: draftArtifactLimits.fileBytes }, async (r, reply) => {
      if (!Buffer.isBuffer(r.body)) throw new AuthFailure('INPUT_INVALID', 400);
      return reply.code(201).send(await artifacts.finishUpload(token(r), csrf(r), r.params.draftId, commands.get(r)!, r.body));
    });
    files.get<{ Params: { draftId: string; artifactId: string } }>('/api/v1/project-drafts/:draftId/files/:artifactId', async (r, reply) => {
      const bytes = await artifacts.read(token(r), r.params.draftId, r.params.artifactId);
      return reply.header('cache-control', 'no-store').header('content-disposition', `attachment; filename="artifact-${r.params.artifactId}.bin"`).type('application/octet-stream').send(bytes);
    });
  });
}
