import {ArtifactStore,type ProjectNamespaceProof} from '../../storage/artifact-store.ts';
import {ProjectStorageQuota} from './project-storage-quota.ts';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AccessRepository, AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { readDraftArtifactRefs as parseRefs, type DraftArtifactRef, type DraftUploadCommand, type DraftUploadReceipt, type DraftStoredArtifact } from '../../../../contracts/draft-artifacts.ts';
import { projectMember } from '../access/project-command.ts';
import { inspectArtifact, assertStoredArtifactReadable } from '../../storage/sensitive-inspection.ts';
import { StoredDraftArtifactFiles, type DraftArtifactFilePort, type DraftFileSpec, type DraftCopySpec } from './draft-artifact-files.ts';

interface DraftRow { id: string; owner_user_id: string; client_id: string; version: string | number; consumed_project_id: string | null; input_json: { artifactRefs?: unknown[] } }
interface UploadIntent { id: string; draft_id: string; actor_id: string; client_id: string; external_command_id: string; expected_version: number; request_hash: string; request_json: DraftUploadCommand; ref_json: DraftArtifactRef; state: string; server_command_id: string; operation_id: string; receipt_id: string; attempt: number; result_json: DraftUploadReceipt | null }
interface ArtifactRow { id: string; draft_id: string | null; project_id: string | null; bytes: string | number; content_hash: string; media_type: string; state: string; inspection_json: unknown; storage_key: string; command_id: string; upload_intent_id: string }
export interface VerifiedDraftSelection { draftId: string; version: number; refs: DraftArtifactRef[]; entries: { ref: DraftArtifactRef; uploadId: string }[] }
export interface CreationPlan { id: string; draft_id: string; target_project_id: string; expected_version: number; request_hash: string; refs_json: DraftArtifactRef[]; sources_json: { ref: DraftArtifactRef; uploadId: string }[]; state: string; attempt: number; result_json: unknown }
const fail = (code: string, status = 409): never => { throw new AuthFailure(code, status); };
function readDraftArtifactRefs(value: unknown) { try { return parseRefs(value); } catch { return fail('DRAFT_ARTIFACT_REFS_INVALID', 422); } }
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
function refOf(a: ArtifactRow): DraftArtifactRef { return { artifactId: a.id, bytes: Number(a.bytes), contentHash: a.content_hash, mediaType: a.media_type }; }
export class DraftArtifacts {
  readonly files: DraftArtifactFilePort | null;
  #access: AccessRepository;
  #proofs = new WeakSet<VerifiedDraftSelection>();
  #namespaceProofs=new WeakMap<CreationPlan,ProjectNamespaceProof>();
  #quota:ProjectStorageQuota;
  #active = new Set<string>();
  constructor(access: AccessRepository, root?: string, files?: DraftArtifactFilePort) { this.#access = access;this.#quota=new ProjectStorageQuota(access,root?new ArtifactStore(root):undefined); this.files = files ?? (root ? new StoredDraftArtifactFiles(root) : null); }
  #storage() { if (!this.files) return fail('ARTIFACT_STORAGE_UNCONFIGURED', 412); return this.files; }
  async #reserve(db: PoolClient, sql: string, values: unknown[]) {
    try { return await db.query(sql, values); }
    catch (error) {
      const e = error as { code?: string; message?: string };
      if (e.code === 'P0001' && e.message === 'FN01_PENDING_CREATION_CONFLICT') fail('DRAFT_CREATION_IN_PROGRESS', 409);
      if (e.code === 'P0001' && e.message === 'FN01_COMMAND_CONFLICT') fail('IDEMPOTENCY_CONFLICT', 409);
      if (e.code === 'P0001' && e.message === 'FN01_DRAFT_QUOTA_EXCEEDED') fail('DRAFT_QUOTA_EXCEEDED', 413);
      throw error;
    }
  }
  /** attempt=0은 아직 어떤 파일 writer도 시작되지 않았다는 durable 증거다. */
  async abortUpload(token: string, csrf: string, draftId: string, command: DraftUploadCommand) {
    const requestHash = contentHash(canonicalJson({ operation: 'uploadProjectDraftArtifact', draftId, command }));
    await this.#access.authenticated(token, csrf, async (db, actor) => {
      await this.lockOwner(db, actor); await this.#draft(db, actor, draftId, command.clientId);
      await db.query('SELECT anvil.fn01_abort_upload($1,$2,$3,$4,$5,$6)', [actor.authSession!.id, actor.actorId, actor.clientId, draftId, command.commandId, requestHash]);
    });
  }
  async lockOwner(db: PoolClient, actor: AuthenticatedIdentity) {
    if (!actor.authSession) fail('AUTH_REQUIRED', 401);
    await db.query('SELECT anvil.fn01_lock_owner($1,$2,$3)', [actor.authSession!.id, actor.actorId, actor.clientId]);
  }
  async #draft(db: PoolClient, actor: AuthenticatedIdentity, id: string, writeClient?: string): Promise<DraftRow> {
    const d = (await db.query('SELECT * FROM anvil.project_drafts WHERE id=$1 AND owner_user_id=$2 FOR UPDATE', [id, actor.actorId])).rows[0] as DraftRow | undefined;
    if (!d) return fail('NOT_FOUND', 404);
    if (writeClient !== undefined && (writeClient !== actor.clientId || d.client_id !== actor.clientId)) fail('CLIENT_SCOPE_MISMATCH', 403);
    return d;
  }
  #current(d: DraftRow, version: number) { if (d.consumed_project_id) fail('DRAFT_ALREADY_CONSUMED', 412); if (Number(d.version) !== version) fail('VERSION_CONFLICT'); }
  async #artifact(db: PoolClient, id: string): Promise<ArtifactRow> {
    const row = (await db.query('SELECT a.*,u.id AS upload_intent_id FROM anvil.artifacts a JOIN anvil.draft_upload_intents u ON u.artifact_id=a.id AND u.server_command_id=a.command_id WHERE a.id=$1', [id])).rows[0];
    if (!row) return fail('NOT_FOUND', 404); return row;
  }
  async #visible(db: PoolClient, actor: AuthenticatedIdentity, draftId: string, ref: DraftArtifactRef, allowQuarantine = false) {
    const row = await this.#artifact(db, ref.artifactId);
    if (!same(refOf(row), ref)) fail('ARTIFACT_INTEGRITY_FAILED', 503);
    const original = (await db.query('SELECT draft_id FROM anvil.draft_upload_intents WHERE id=$1', [row.upload_intent_id])).rows[0];
    if (original?.draft_id !== draftId) fail('NOT_FOUND', 404);
    if (row.project_id) await projectMember(db, actor, row.project_id);
    else if (row.draft_id !== draftId) fail('NOT_FOUND', 404);
    if (row.state !== 'READY' && !(allowQuarantine && row.state === 'QUARANTINED' && !row.project_id)) fail('NOT_FOUND', 404);
    const key = row.project_id ? `blobs/${row.project_id}/${row.id}` : `draft-blobs/${draftId}/${row.id}`;
    if (row.storage_key !== key) fail('ARTIFACT_INTEGRITY_FAILED', 503);
    return row;
  }
  /** 원 snapshot을 바꾸지 않고 현재 접근이 거절되면 전체 응답을 닫는다. */
  async guardSnapshot(db: PoolClient, actor: AuthenticatedIdentity, draftId: string, input: { artifactRefs?: unknown[] }) {
    for (const ref of readDraftArtifactRefs(input.artifactRefs ?? [])) await this.#visible(db, actor, draftId, ref);
  }
  async projection(db: PoolClient, actor: AuthenticatedIdentity, draftId: string): Promise<DraftStoredArtifact[]> {
    if (!this.files) return [];
    const intents = (await db.query("SELECT * FROM anvil.draft_upload_intents WHERE draft_id=$1 AND actor_id=$2 AND state<>'REJECTED' ORDER BY id", [draftId, actor.actorId])).rows as UploadIntent[];
    const result: DraftStoredArtifact[] = [];
    for (const u of intents) {
      if (u.state === 'FINALIZED') {
        const row = await this.#visible(db, actor, draftId, u.ref_json, true);
        result.push({ commandId: u.external_command_id, expectedVersion: Number(u.expected_version), state: 'FINALIZED', ref: u.ref_json, artifactState: row.state as 'READY' | 'QUARANTINED', projectId: row.project_id });
      } else result.push({ commandId: u.external_command_id, expectedVersion: Number(u.expected_version), state: u.state as DraftStoredArtifact['state'], ref: u.ref_json, artifactState: null, projectId: null });
    }
    return result;
  }
  async reserveUpload(token: string, csrf: string, draftId: string, command: DraftUploadCommand): Promise<UploadIntent> {
    return this.#access.authenticated(token, csrf, async (db, actor) => {
      this.#storage(); await this.lockOwner(db, actor); const draft = await this.#draft(db, actor, draftId, command.clientId);
      const requestHash = contentHash(canonicalJson({ operation: 'uploadProjectDraftArtifact', draftId, command }));
      const old = (await db.query('SELECT * FROM anvil.draft_upload_intents WHERE draft_id=$1 AND actor_id=$2 AND client_id=$3 AND external_command_id=$4 FOR UPDATE', [draftId, actor.actorId, actor.clientId, command.commandId])).rows[0] as UploadIntent | undefined;
      if (old) {
        if (old.request_hash !== requestHash) fail('IDEMPOTENCY_CONFLICT');
        if (old.state === 'FINALIZED') { await this.#visible(db, actor, draftId, old.ref_json, true); return old; }
        this.#current(draft, command.expectedVersion);
        if (old.state === 'REJECTED') fail('DRAFT_UPLOAD_REJECTED', 412);
        return old;
      }
      this.#current(draft, command.expectedVersion);
      const args = { id: randomUUID(), artifactId: randomUUID(), serverCommandId: randomUUID(), receiptId: randomUUID(), operationId: randomUUID(), requestHash, command };
      return (await this.#reserve(db, 'SELECT anvil.fn01_reserve_upload($1,$2,$3,$4,$5::jsonb) AS value', [actor.authSession!.id, actor.actorId, actor.clientId, draftId, JSON.stringify(args)])).rows[0].value;
    });
  }
  async finishUpload(token: string, csrf: string, draftId: string, command: DraftUploadCommand, bytes: Buffer): Promise<DraftUploadReceipt> {
    if (bytes.length !== command.payload.bytes || contentHash(bytes) !== command.payload.contentHash) { await this.abortUpload(token, csrf, draftId, command).catch(() => {}); fail('ARTIFACT_BYTES_MISMATCH', 409); }
    const u = await this.reserveUpload(token, csrf, draftId, command), files = this.#storage();
    if (u.state === 'FINALIZED') {
      const row = await this.#access.authenticated(token, csrf, async (db, actor) => { await this.lockOwner(db, actor); await this.#draft(db, actor, draftId, command.clientId); return this.#visible(db, actor, draftId, u.ref_json, true); });
      const raw = row.project_id ? await files.readProject(row.project_id, u.ref_json) : await files.readDraft({ draftId, intentId: u.id, ref: u.ref_json });
      if (!raw.equals(bytes) || !u.result_json || !same(inspectArtifact(raw), row.inspection_json)) fail('ARTIFACT_INTEGRITY_FAILED', 503);
      // 파일 조회 뒤에도 현재 회원/격리·원 client를 다시 확인한 다음 불변 receipt를 반환한다.
      return this.#access.authenticated(token, csrf, async (db, actor) => { await this.lockOwner(db, actor); await this.#draft(db, actor, draftId, command.clientId); await this.#visible(db, actor, draftId, u.ref_json, true); return u.result_json!; });
    }
    if (this.#active.has(u.id)) fail('DRAFT_UPLOAD_IN_PROGRESS');
    this.#active.add(u.id);
    try {
      u.attempt = await this.#access.authenticated(token, csrf, async (db, actor) => (await db.query('SELECT anvil.fn01_claim_intent($1,$2,$3,$4,$5,$6) AS value', [actor.authSession!.id, actor.actorId, actor.clientId, 'UPLOAD', u.id, u.request_hash])).rows[0].value);
      await files.upload({ draftId, intentId: u.id, ref: u.ref_json }, bytes);
      const raw = await files.readDraft({ draftId, intentId: u.id, ref: u.ref_json });
      if (!raw.equals(bytes)) fail('ARTIFACT_INTEGRITY_FAILED', 503);
      const inspection = inspectArtifact(raw);
      return await this.#access.authenticated(token, csrf, async (db, actor) => {
        await this.lockOwner(db, actor); const draft = await this.#draft(db, actor, draftId, command.clientId); this.#current(draft, command.expectedVersion);
        return (await db.query('SELECT anvil.fn01_finalize_upload($1,$2,$3,$4,$5,$6,$7::jsonb) AS value', [actor.authSession!.id, actor.actorId, actor.clientId, u.id, u.request_hash, u.attempt, JSON.stringify(inspection)])).rows[0].value;
      });
    } catch (error) {
      // 상태 기록 자체가 불가해도 durable RESERVED와 예약을 삭제/재발급하지 않는다.
      await this.#access.authenticated(token, csrf, async (db, actor) => { await this.lockOwner(db, actor); await db.query('SELECT anvil.fn01_unknown_intent($1,$2,$3,$4,$5,$6)', [actor.authSession!.id, actor.actorId, actor.clientId, 'UPLOAD', u.id, u.attempt]); }).catch(() => {});
      throw error;
    } finally { this.#active.delete(u.id); }
  }
  async read(token: string, draftId: string, artifactId: string): Promise<Buffer> {
    const row = await this.#access.authenticated(token, null, async (db, actor) => {
      await this.#draft(db, actor, draftId); const a = await this.#artifact(db, artifactId);
      if (a.draft_id !== draftId || a.project_id) fail('NOT_FOUND', 404);
      return this.#visible(db, actor, draftId, refOf(a));
    });
    const bytes = await this.#storage().readDraft({ draftId, intentId: row.upload_intent_id, ref: refOf(row) }); assertStoredArtifactReadable(row, bytes);
    await this.#access.authenticated(token, null, async (db, actor) => { await this.#draft(db, actor, draftId); const now = await this.#visible(db, actor, draftId, refOf(row)); if (now.project_id) fail('NOT_FOUND', 404); });
    return bytes;
  }
  async prepareSelection(token: string, csrf: string, draftId: string, version: number, clientId: string, input: unknown): Promise<VerifiedDraftSelection> {
    const refs = readDraftArtifactRefs(input), files = refs.length ? this.#storage() : null;
    const entries = await this.#access.authenticated(token, csrf, async (db, actor) => {
      await this.lockOwner(db, actor); const draft = await this.#draft(db, actor, draftId, clientId); this.#current(draft, version);
      const entries: VerifiedDraftSelection['entries'] = [];
      for (const ref of [...refs].sort((a, b) => a.artifactId.localeCompare(b.artifactId))) {
        const row = await this.#visible(db, actor, draftId, ref); if (row.project_id) fail('NOT_FOUND', 404);
        entries.push({ ref, uploadId: row.upload_intent_id });
      }
      return entries;
    });
    for (const entry of entries) { const raw = await files!.readDraft({ draftId, intentId: entry.uploadId, ref: entry.ref }); if (inspectArtifact(raw).state === 'SUSPECTED') fail('ARTIFACT_QUARANTINED', 412); }
    const proof = { draftId, version, refs, entries }; this.#proofs.add(proof); return proof;
  }
  async validateSelection(db: PoolClient, actor: AuthenticatedIdentity, draft: DraftRow, input: unknown, proof?: VerifiedDraftSelection) {
    const refs = readDraftArtifactRefs(input);
    if (refs.length && (!proof || !this.#proofs.has(proof) || proof.draftId !== draft.id || proof.version !== Number(draft.version) || !same(proof.refs, refs))) fail('ARTIFACT_VERIFICATION_REQUIRED', 412);
    for (const ref of [...refs].sort((a, b) => a.artifactId.localeCompare(b.artifactId))) { const row = await this.#visible(db, actor, draft.id, ref); if (row.project_id || proof?.entries.find(e => e.ref.artifactId === ref.artifactId)?.uploadId !== row.upload_intent_id) fail('NOT_FOUND', 404); }
    return refs;
  }
  async snapshot(db: PoolClient, actor: AuthenticatedIdentity, draftId: string, version: number, commandId: string, receiptId: string, refs: unknown) {
    await db.query('SELECT anvil.fn01_record_selection($1,$2,$3,$4,$5,$6,$7,$8::jsonb)', [actor.authSession!.id, actor.actorId, actor.clientId, draftId, version, commandId, receiptId, JSON.stringify(readDraftArtifactRefs(refs))]);
  }
  async prepareCreation(token: string, csrf: string, raw: { draftId: string; draftVersion: number; clientId: string; commandId: string }): Promise<CreationPlan> {
    const request=JSON.parse(canonicalJson(raw)) as typeof raw;
    const requestHash = contentHash(canonicalJson(request));
    const plan = await this.#access.authenticated(token, csrf, async (db, actor) => {
      await this.lockOwner(db, actor); const draft = await this.#draft(db, actor, request.draftId, request.clientId);
      const old = (await db.query('SELECT * FROM anvil.draft_creation_intents WHERE draft_id=$1 AND actor_id=$2 AND client_id=$3 AND external_command_id=$4 FOR UPDATE', [draft.id, actor.actorId, actor.clientId, request.commandId])).rows[0] as CreationPlan | undefined;
      if (old) { if (old.request_hash !== requestHash) fail('IDEMPOTENCY_CONFLICT'); await this.guardSnapshot(db, actor, draft.id, { artifactRefs: old.refs_json }); if (old.state === 'COMMITTED') { await projectMember(db, actor, old.target_project_id); return old; } }
      this.#current(draft, request.draftVersion);
      const refs = readDraftArtifactRefs(draft.input_json.artifactRefs ?? []); if (refs.length) this.#storage();
      await this.guardSnapshot(db, actor, draft.id, draft.input_json);
      if (old) return old;
      return (await this.#reserve(db, 'SELECT anvil.fn01_reserve_creation($1,$2,$3,$4,$5::jsonb) AS value', [actor.authSession!.id, actor.actorId, actor.clientId, draft.id, JSON.stringify({ id: randomUUID(), targetProjectId: randomUUID(), request, requestHash })])).rows[0].value as CreationPlan;
    });
    if (plan.state === 'COMMITTED') return plan;
    if (this.#active.has(plan.id)) fail('DRAFT_CREATION_IN_PROGRESS'); this.#active.add(plan.id);
    try {
      plan.attempt = await this.#access.authenticated(token, csrf, async (db, actor) => (await db.query('SELECT anvil.fn01_claim_intent($1,$2,$3,$4,$5,$6) AS value', [actor.authSession!.id, actor.actorId, actor.clientId, 'CREATION', plan.id, requestHash])).rows[0].value);
      if(this.files?.beginNamespace&&this.files.verifyNamespace)await this.files.beginNamespace(plan.target_project_id,plan.id);
      for (const entry of plan.sources_json) {
        const spec: DraftCopySpec = { draftId: plan.draft_id, intentId: entry.uploadId, creationId: plan.id, projectId: plan.target_project_id, ref: entry.ref };
        const raw = await this.#storage().readDraft(spec); if (inspectArtifact(raw).state === 'SUSPECTED') fail('ARTIFACT_QUARANTINED', 412);
        await this.#storage().copy(spec); await this.#storage().verifyCopy(spec);
      }
      await this.#access.authenticated(token, csrf, async (db, actor) => {
        await this.lockOwner(db, actor); const draft = await this.#draft(db, actor, plan.draft_id, request.clientId); this.#current(draft, request.draftVersion); await this.guardSnapshot(db, actor, draft.id, { artifactRefs: plan.refs_json });
        await db.query('SELECT anvil.fn01_copies_verified($1,$2,$3,$4,$5,$6)', [actor.authSession!.id, actor.actorId, actor.clientId, plan.id, requestHash, plan.attempt]);
      });
      const result={...plan,state:'COPIES_VERIFIED'};
      if(this.files?.beginNamespace&&this.files.verifyNamespace){const proof=await this.files.verifyNamespace(plan.target_project_id,plan.id,plan.refs_json);this.#namespaceProofs.set(result,proof);}
      return result;
    } catch (error) {
      await this.#access.authenticated(token, csrf, async (db, actor) => { await this.lockOwner(db, actor); await db.query('SELECT anvil.fn01_unknown_intent($1,$2,$3,$4,$5,$6)', [actor.authSession!.id, actor.actorId, actor.clientId, 'CREATION', plan.id, plan.attempt]); }).catch(() => {});
      if(this.files?.beginNamespace&&this.files.verifyNamespace)return fail('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);
      throw error;
    } finally { this.#active.delete(plan.id); }
  }
  async commitCreation(db: PoolClient, actor: AuthenticatedIdentity, plan: CreationPlan, projectCommandId: string) {
    await db.query('SELECT anvil.fn01_commit_creation($1,$2,$3,$4,$5,$6,$7)', [actor.authSession!.id, actor.actorId, actor.clientId, plan.id, plan.request_hash, projectCommandId, plan.attempt]);
  }
  creationFailure(plan:CreationPlan,error:unknown):never{
    // 실제 namespace/copy 확인 이후에는 운영 COMMIT 결과 불명도 새 생성으로 재시도하지 않는다.
    if(this.#namespaceProofs.has(plan))return fail('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);
    throw error;
  }
  async adoptProjectQuota(db:PoolClient,actor:AuthenticatedIdentity,plan:CreationPlan,projectCommandId:string){
    const proof=this.#namespaceProofs.get(plan);
    // 원래 root 없는 metadata 생성은 보존하되 검증 계정으로 승격하지 않는다.
    if(!proof)return;
    await this.#quota.adoptCreation(db,actor,plan,{serverCommandId:projectCommandId},proof);
  }
  async completeCreation(db: PoolClient, actor: AuthenticatedIdentity, plan: CreationPlan, result: unknown) {
    await db.query('SELECT anvil.fn01_creation_result($1,$2,$3,$4,$5::jsonb)', [actor.authSession!.id, actor.actorId, actor.clientId, plan.id, JSON.stringify(result)]);
  }
  async reclaim(token: string, csrf: string, plan: CreationPlan) {
    // 마지막 transaction 이후의 정확 중복 회수다. 실패는 원 결과/주 원문을 취소하지 않는다.
    for (const entry of plan.sources_json) {
      try {
        await this.#access.authenticated(token, csrf, async (db, actor) => { await this.lockOwner(db, actor); await this.#draft(db, actor, plan.draft_id, actor.clientId); const row = await this.#visible(db, actor, plan.draft_id, entry.ref); if (row.project_id !== plan.target_project_id) fail('NOT_FOUND', 404); });
        const spec = { draftId: plan.draft_id, intentId: entry.uploadId, creationId: plan.id, projectId: plan.target_project_id, ref: entry.ref };
        await this.#storage().reclaimDraft(spec);
        await this.#access.authenticated(token, csrf, async (db, actor) => { await this.lockOwner(db, actor); const row = await this.#visible(db, actor, plan.draft_id, entry.ref); if (row.project_id !== plan.target_project_id) fail('NOT_FOUND', 404); await db.query('SELECT anvil.fn01_release_duplicates($1,$2,$3,$4,$5)', [actor.authSession!.id, actor.actorId, actor.clientId, plan.id, entry.ref.artifactId]); });
      } catch { /* UNKNOWN/권한 회수/회수 실패는 예약과 원자료를 보존한다. */ }
    }
  }
}
