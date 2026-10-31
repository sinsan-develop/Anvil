import { AccessRepository, AuthFailure } from '../access/repository.ts';
import { ProjectListCodec, projectListFilter } from './service.ts';
import { randomUUID } from 'node:crypto';
import { DraftArtifacts } from './draft-artifacts.ts';
import { readDraftArtifactRefs, type DraftArtifactRef } from '../../../../contracts/draft-artifacts.ts';
import type { PoolClient } from 'pg';
import type { AuthenticatedIdentity } from '../access/repository.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { selectDraftMethodology } from './draft-methodology.ts';
import { requirePreparedForms } from '../methodologies/content-review.ts';
import { draftMethodologyState, requireDraftConfirmation, writeDraftReview, type DraftOperation } from './draft-review.ts';
import{readSourceDeclaration}from'./source-declaration.ts';
import{sourceDeclarationView,storeSourceDeclaration,readSourceDeclarationRecord}from'./source-declaration-records.ts';

export interface DraftInput { name: string; purpose: string; desiredOutcome: string; sourceMode: 'EMPTY' | 'EXISTING'; methodologySelection?: unknown; artifactRefs?: unknown[]; sourceDeclaration?: unknown }
export interface DraftCreate extends DraftInput { schemaVersion: 1; commandId: string; clientId: string; targetId: null; expectedVersion: 0 }
export interface DraftSave { schemaVersion: 1; commandId: string; clientId: string; expectedVersion: number; step: number; input: DraftInput }
export interface ProjectCreate { schemaVersion: 1; commandId: string; clientId: string; draftId: string; draftVersion: number }

function integer(value: string | number): number {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 1) throw Error('STORED_VERSION_INVALID');
  return result;
}
export class ProjectsRepository {
  #access: AccessRepository;
  #cursor: ProjectListCodec;
  readonly artifacts: DraftArtifacts;
  constructor(access: AccessRepository, artifacts = new DraftArtifacts(access)) { this.artifacts = artifacts; this.#access = access; this.#cursor = new ProjectListCodec(value => access.signProjectCursor(value)); }
  async #draftInput(db: PoolClient, owner: string, input: DraftInput, artifactRefs: DraftArtifactRef[] = []) {
    if(!['EMPTY','EXISTING'].includes(input.sourceMode)||input.sourceMode==='EMPTY'&&input.sourceDeclaration!==undefined)throw new AuthFailure('SOURCE_DECLARATION_INPUT_INVALID',422);
    const sourceDeclaration=input.sourceMode==='EXISTING'?readSourceDeclaration(input.sourceDeclaration):null;
    if (canonicalJson(readDraftArtifactRefs(input.artifactRefs ?? [])) !== canonicalJson(artifactRefs)) throw new AuthFailure('DRAFT_ARTIFACT_REFS_INVALID', 422);
    const methodologySelection = await selectDraftMethodology(db, owner, input.methodologySelection);
    return { name: input.name, purpose: input.purpose, desiredOutcome: input.desiredOutcome, sourceMode: input.sourceMode,...(sourceDeclaration?{sourceDeclaration}:{}),methodologySelection, artifactRefs };
  }
  #draftView(row: { id: string; version: string; step: number; input_json: unknown }) { return { draftId: row.id, version: integer(row.version), step: row.step, input: row.input_json }; }
  async #draftCommand(db: PoolClient, identity: AuthenticatedIdentity, draftId: string, operation: string, request: DraftCreate | DraftSave | ProjectCreate | DraftOperation, result: unknown) {
    const id = randomUUID(), receiptId = randomUUID(), operationId = randomUUID();
    const draftResult=result as{version?:number;input?:DraftInput};
    const declaration=['createProjectDraft','saveProjectDraft'].includes(operation)&&draftResult.input?.sourceMode==='EXISTING'?sourceDeclarationView(draftId,draftResult.version!,draftResult.input.sourceDeclaration):null;
    if(declaration)result={...(result as object),sourceDeclaration:declaration};
    const requestHash = contentHash(canonicalJson(request));
    const scopeDigest = contentHash(canonicalJson({ kind: 'DRAFT', draftId, operation, actorId: identity.actorId, clientId: identity.clientId, requestHash }));
    await db.query("INSERT INTO anvil.commands(id,scope_kind,scope_id,draft_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,expected_version,result_ref,completed_at) VALUES($1,'DRAFT',$2,$2,$3,$4,$5,$6,$7,$8,'APPLIED',$9,$10,now())", [id, draftId, identity.actorId, identity.clientId, operation, request.commandId, requestHash, operationId, 'draftVersion' in request ? request.draftVersion : request.expectedVersion, JSON.stringify(result)]);
    await db.query("INSERT INTO anvil.authorization_receipts(id,scope_kind,scope_id,command_id,subject_ref,scope_digest) VALUES($1,'DRAFT',$2,$3,$4,$5)", [receiptId, draftId, id, JSON.stringify({ kind: 'HUMAN', userId: identity.actorId }), scopeDigest]);
    await db.query('UPDATE anvil.commands SET authorization_receipt_id=$2 WHERE id=$1', [id, receiptId]);
    await db.query("INSERT INTO anvil.draft_audit_events(draft_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,operation,outcome,reason_code) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,$6,$7,'APPLIED','OWNED_DRAFT_ONLY' FROM anvil.draft_audit_events WHERE draft_id=$1", [draftId, randomUUID(), JSON.stringify({ kind: 'HUMAN', userId: identity.actorId }), identity.clientId, id, operationId, operation]);
    if(declaration)await storeSourceDeclaration(db,identity,draftId,declaration.ref.version,declaration.declaration,id);
    if (['createProjectDraft','saveProjectDraft'].includes(operation)) await this.artifacts.snapshot(db, identity, draftId, draftResult.version!, id, receiptId, draftResult.input?.artifactRefs ?? []);
    return result;
  }
  async createDraft(token: string, csrf: string, request: DraftCreate) {
    return this.#access.authenticated(token, csrf, async (db, identity) => {
      await this.artifacts.lockOwner(db, identity);
      if (request.clientId !== identity.clientId) throw new AuthFailure('CLIENT_SCOPE_MISMATCH', 403);
      const previous = (await db.query("SELECT c.request_hash,c.result_ref,d.client_id FROM anvil.commands c JOIN anvil.project_drafts d ON d.id=c.draft_id WHERE c.actor_id=$1 AND c.operation='createProjectDraft' AND c.command_id=$2", [identity.actorId, request.commandId])).rows[0];
      if (previous) {
        if (previous.client_id !== identity.clientId) throw new AuthFailure('CLIENT_SCOPE_MISMATCH', 403);
        if (previous.request_hash !== contentHash(canonicalJson(request))) throw new AuthFailure('IDEMPOTENCY_CONFLICT', 409);
        return previous.result_ref;
      }
      const input = await this.#draftInput(db, identity.actorId, request), id = randomUUID();
      const row = (await db.query('INSERT INTO anvil.project_drafts(id,owner_user_id,client_id,step,input_json) VALUES($1,$2,$3,1,$4) RETURNING *', [id, identity.actorId, identity.clientId, JSON.stringify(input)])).rows[0];
      return this.#draftCommand(db, identity, id, 'createProjectDraft', request, { ...this.#draftView(row), methodologyState: await draftMethodologyState(db, row) });
    });
  }
  async getDraft(token: string, draftId: string) {
    return this.#access.authenticated(token, null, async (db, identity) => {
      const row = (await db.query('SELECT * FROM anvil.project_drafts WHERE id=$1 AND owner_user_id=$2', [draftId, identity.actorId])).rows[0];
      if (!row) throw new AuthFailure('NOT_FOUND', 404);
      await this.artifacts.guardSnapshot(db, identity, draftId, row.input_json);
      const declaration=row.input_json?.sourceMode==='EXISTING'?await readSourceDeclarationRecord(db,row.id,integer(row.version)):null;
      if(declaration&&canonicalJson(declaration.declaration)!==canonicalJson(row.input_json.sourceDeclaration))throw new AuthFailure('SOURCE_DECLARATION_INTEGRITY_FAILED',503);
      return { ...this.#draftView(row), storedArtifacts: await this.artifacts.projection(db, identity, draftId), ...(declaration?{sourceDeclaration:declaration}:{}),editable: row.client_id === identity.clientId && !row.consumed_project_id, consumedProjectId: row.consumed_project_id, methodologyState: await draftMethodologyState(db, row) };
    });
  }
  async saveDraft(token: string, csrf: string, draftId: string, request: DraftSave) {
    const replay = await this.#access.authenticated(token, csrf, async (db, identity) => {
      await this.artifacts.lockOwner(db, identity);
      const row = (await db.query('SELECT * FROM anvil.project_drafts WHERE id=$1 AND owner_user_id=$2 FOR UPDATE', [draftId, identity.actorId])).rows[0];
      if (!row) throw new AuthFailure('NOT_FOUND', 404);
      if (request.clientId !== identity.clientId || row.client_id !== identity.clientId) throw new AuthFailure('CLIENT_SCOPE_MISMATCH', 403);
      const previous = (await db.query("SELECT request_hash,result_ref FROM anvil.commands WHERE draft_id=$1 AND actor_id=$2 AND operation='saveProjectDraft' AND command_id=$3", [draftId, identity.actorId, request.commandId])).rows[0];
      if (!previous) return null;
      if (previous.request_hash !== contentHash(canonicalJson(request))) throw new AuthFailure('IDEMPOTENCY_CONFLICT', 409);
      await this.artifacts.guardSnapshot(db, identity, draftId, previous.result_ref.input);
      return { result: previous.result_ref };
    });
    if (replay) return replay.result;
    const verified = await this.artifacts.prepareSelection(token, csrf, draftId, request.expectedVersion, request.clientId, request.input.artifactRefs ?? []);
    return this.#access.authenticated(token, csrf, async (db, identity) => {
      await this.artifacts.lockOwner(db, identity);
      const row = (await db.query('SELECT * FROM anvil.project_drafts WHERE id=$1 AND owner_user_id=$2 FOR UPDATE', [draftId, identity.actorId])).rows[0];
      if (!row) throw new AuthFailure('NOT_FOUND', 404);
      if (request.clientId !== identity.clientId || row.client_id !== identity.clientId) throw new AuthFailure('CLIENT_SCOPE_MISMATCH', 403);
      const previous = (await db.query("SELECT request_hash,result_ref FROM anvil.commands WHERE draft_id=$1 AND actor_id=$2 AND operation='saveProjectDraft' AND command_id=$3", [draftId, identity.actorId, request.commandId])).rows[0];
      if (previous) {
        if (previous.request_hash !== contentHash(canonicalJson(request))) throw new AuthFailure('IDEMPOTENCY_CONFLICT', 409);
        await this.artifacts.guardSnapshot(db, identity, draftId, previous.result_ref.input);
        return previous.result_ref;
      }
      if (row.consumed_project_id) throw new AuthFailure('DRAFT_ALREADY_CONSUMED', 412);
      if (integer(row.version) !== request.expectedVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
      const refs = await this.artifacts.validateSelection(db, identity, row, request.input.artifactRefs ?? [], verified);
      const input = await this.#draftInput(db, identity.actorId, request.input, refs);
      const updated = (await db.query('UPDATE anvil.project_drafts SET version=version+1,step=$2,input_json=$3,updated_at=now() WHERE id=$1 RETURNING *', [draftId, request.step, JSON.stringify(input)])).rows[0];
      return this.#draftCommand(db, identity, draftId, 'saveProjectDraft', request, { ...this.#draftView(updated), methodologyState: await draftMethodologyState(db, updated) });
    });
  }
  async draftOperation(token: string, csrf: string, draftId: string, request: DraftOperation) {
    return this.#access.authenticated(token, csrf, async (db, identity) => {
      await this.artifacts.lockOwner(db, identity);
      const draft = (await db.query('SELECT * FROM anvil.project_drafts WHERE id=$1 AND owner_user_id=$2 FOR UPDATE', [draftId, identity.actorId])).rows[0];
      if (!draft) throw new AuthFailure('NOT_FOUND', 404);
      if (request.clientId !== identity.clientId || draft.client_id !== identity.clientId) throw new AuthFailure('CLIENT_SCOPE_MISMATCH', 403);
      if (request.targetId !== draftId) throw new AuthFailure('INPUT_INVALID', 400);
      const previous = (await db.query('SELECT operation,request_hash,result_ref FROM anvil.commands WHERE draft_id=$1 AND actor_id=$2 AND command_id=$3', [draftId, identity.actorId, request.commandId])).rows;
      if (previous.length) {
        if (previous.length !== 1 || previous[0].operation !== request.operation || previous[0].request_hash !== contentHash(canonicalJson(request))) throw new AuthFailure('IDEMPOTENCY_CONFLICT', 409);
        return previous[0].result_ref;
      }
      if (draft.consumed_project_id) throw new AuthFailure('DRAFT_ALREADY_CONSUMED', 412);
      if (Number(draft.version) !== request.expectedVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
      return writeDraftReview(db, identity, draft, request, result => this.#draftCommand(db, identity, draftId, request.operation, request, result));
    });
  }
  async createProject(token: string, csrf: string, raw: ProjectCreate) {
    const request=JSON.parse(canonicalJson(raw)) as ProjectCreate;
    const creation = await this.artifacts.prepareCreation(token, csrf, request);
    if (creation.state === 'COMMITTED') return creation.result_json;
    const created = await this.#access.authenticated(token, csrf, async (db, identity) => {
      await this.artifacts.lockOwner(db, identity);
      const draft = (await db.query('SELECT * FROM anvil.project_drafts WHERE id=$1 AND owner_user_id=$2 FOR UPDATE', [request.draftId, identity.actorId])).rows[0];
      if (!draft) throw new AuthFailure('NOT_FOUND', 404);
      if (request.clientId !== identity.clientId || draft.client_id !== identity.clientId) throw new AuthFailure('CLIENT_SCOPE_MISMATCH', 403);
      const previous = (await db.query("SELECT operation,request_hash,result_ref FROM anvil.commands WHERE draft_id=$1 AND actor_id=$2 AND command_id=$3", [draft.id, identity.actorId, request.commandId])).rows;
      if (previous.length) {
        if (previous.length !== 1 || previous[0].operation !== 'createProject' || previous[0].request_hash !== contentHash(canonicalJson(request))) throw new AuthFailure('IDEMPOTENCY_CONFLICT', 409);
        await this.artifacts.guardSnapshot(db, identity, draft.id, { artifactRefs: creation.refs_json });
        return previous[0].result_ref;
      }
      if (draft.consumed_project_id) throw new AuthFailure('DRAFT_ALREADY_CONSUMED', 409);
      if (integer(draft.version) !== request.draftVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
      await this.artifacts.guardSnapshot(db, identity, draft.id, draft.input_json);
      const input = await this.#draftInput(db, identity.actorId, draft.input_json, creation.refs_json);
      const declaration=input.sourceMode==='EXISTING'?await readSourceDeclarationRecord(db,draft.id,integer(draft.version)):null;
      if(declaration&&canonicalJson(declaration.declaration)!==canonicalJson(input.sourceDeclaration))throw new AuthFailure('SOURCE_DECLARATION_INTEGRITY_FAILED',503);
      if (![input.name, input.purpose, input.desiredOutcome].every(value => typeof value === 'string' && !!value.trim())) throw new AuthFailure('PROJECT_PURPOSE_REQUIRED', 422);
      const selected = input.methodologySelection;
      if (!selected) throw new AuthFailure('METHODOLOGY_CONFIRMATION_REQUIRED', 422);
      const dedicated = selected.kind === 'NEW_PROJECT_DRAFT' ? await requireDraftConfirmation(db, draft) : null;
      const ref = selected.kind === 'CONFIRMED_REFERENCE' ? selected.versionRef : { id: randomUUID(), version: 1, contentHash: dedicated!.ref.contentHash };
      const method = selected.kind === 'NEW_PROJECT_DRAFT' ? { name: selected.name, purpose: selected.purpose, graph_json: selected.graph } : (await db.query('SELECT name,purpose,graph_json FROM anvil.methodology_versions WHERE definition_id=$1 AND version=$2 AND content_hash=$3', [ref.id, ref.version, ref.contentHash])).rows[0];
      if (!method) throw new AuthFailure('METHODOLOGY_SOURCE_NOT_READY', 422);
      await requirePreparedForms(db, identity.actorId, method.graph_json);
      const projectId = creation.target_project_id, applicationId = randomUUID(), commandId = randomUUID(), receiptId = randomUUID(), operationId = randomUUID();
      const snapshot = { name: method.name, purpose: method.purpose, graph: method.graph_json, sourceRef: ref, ...(dedicated ? { draftConfirmationRef: { draftRef: dedicated.ref, confirmationId: dedicated.confirmation!.id } } : {}) };
      const snapshotHash = contentHash(canonicalJson(snapshot));
      await db.query("SELECT set_config('anvil.actor_id',$1,true),set_config('anvil.creation_draft_id',$2,true)", [identity.actorId, draft.id]);
      await db.query('INSERT INTO anvil.projects(id,name,purpose,desired_outcome) VALUES($1,$2,$3,$4)', [projectId, input.name, input.purpose, input.desiredOutcome]);
      await db.query("INSERT INTO anvil.project_members(project_id,user_id,participation) VALUES($1,$2,'OWNER')", [projectId, identity.actorId]);
      await db.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation) VALUES($1,$2,$3,1)', [projectId, identity.actorId, identity.clientId]);
      const targetRef = { id: projectId, version: 1 }, scopeDigest = contentHash(canonicalJson({ operation: 'createProject', draftId: draft.id, draftVersion: request.draftVersion, projectId, actorId: identity.actorId, clientId: identity.clientId, requestHash: contentHash(canonicalJson(request)) }));
      await db.query("INSERT INTO anvil.commands(id,scope_kind,scope_id,project_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,expected_version,control_generation,completed_at) VALUES($1,'PROJECT',$2,$2,$3,$4,'createProject',$5,$6,$7,'APPLIED',$8,0,1,now())", [commandId, projectId, identity.actorId, identity.clientId, request.commandId, contentHash(canonicalJson(request)), operationId, receiptId]);
      await db.query("INSERT INTO anvil.authorization_receipts(id,scope_kind,scope_id,command_id,subject_ref,scope_digest) VALUES($1,'PROJECT',$2,$3,$4,$5)", [receiptId, projectId, commandId, JSON.stringify({ kind: 'HUMAN', userId: identity.actorId, clientId: identity.clientId }), scopeDigest]);
      if (dedicated && selected.kind === 'NEW_PROJECT_DRAFT') {
        await db.query("INSERT INTO anvil.methodology_definitions(id,scope,project_id,name,purpose,head_version) VALUES($1,'PROJECT',$2,$3,$4,1)", [ref.id, projectId, method.name, method.purpose]);
        await db.query('INSERT INTO anvil.methodology_versions(definition_id,version,name,purpose,graph_json,content_hash,origin_ref_json,reason,created_by) VALUES($1,1,$2,$3,$4,$5,$6,$7,$8)', [ref.id, method.name, method.purpose, JSON.stringify(method.graph_json), ref.contentHash, JSON.stringify({ kind: 'DRAFT_CONFIRMED_SOURCE', draftRef: dedicated.ref, confirmationId: dedicated.confirmation!.id, sourceRefs: selected.sourceRefs }), '확정한 생성 초안의 프로젝트 전용 원본', identity.actorId]);
      }
      await db.query('INSERT INTO anvil.project_methodologies(id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8)', [applicationId, projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(snapshot), snapshotHash, identity.actorId]);
      await db.query("INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,command_id,operation_id,target_ref,outcome,reason_code,scope_digest,source_kind) VALUES($1,1,$2,$3,$4,$5,$6,$7,'APPLIED','FIRST_PROJECT_FROM_OWNED_DRAFT',$8,'HUMAN_COMMAND')", [projectId, randomUUID(), JSON.stringify({ kind: 'HUMAN', userId: identity.actorId }), identity.clientId, commandId, operationId, JSON.stringify(targetRef), scopeDigest]);
      await this.artifacts.commitCreation(db, identity, creation, commandId);
      await db.query('UPDATE anvil.project_drafts SET consumed_project_id=$2,updated_at=now() WHERE id=$1', [draft.id, projectId]);
      if(declaration)await db.query('INSERT INTO anvil.project_source_declarations(project_id,declaration_id,declaration_version,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6)',[projectId,declaration.ref.id,declaration.ref.version,identity.actorId,identity.clientId,commandId]);
      const result = await this.#detail(db, identity, projectId);
      await db.query('UPDATE anvil.commands SET result_ref=$2 WHERE id=$1', [commandId, JSON.stringify(result)]);
      const completed = await this.#draftCommand(db, identity, draft.id, 'createProject', request, result);
      await this.artifacts.completeCreation(db, identity, creation, completed);
      await this.artifacts.adoptProjectQuota(db,identity,creation,commandId);
      return completed;
    }).catch(error=>this.artifacts.creationFailure(creation,error));
    await this.artifacts.reclaim(token, csrf, creation);
    return created;
  }
  async list(token: string, raw: Record<string, unknown>) {
    return this.#access.authenticated(token, null, async (db, identity) => {
      let filter: ReturnType<typeof projectListFilter>, position: { at: string; id: string } | undefined;
      try {
        filter = projectListFilter(raw);
        if (raw.cursor) position = this.#cursor.read(String(raw.cursor), identity.actorId, filter);
      } catch { throw new AuthFailure('CURSOR_OR_FILTER_INVALID', 400); }
      const pattern = '%' + filter.query.replace(/[\\%_]/g, '\\$&') + '%';
      const result = await db.query(`SELECT p.id,p.name,p.purpose,p.version,to_char(p.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS at
        FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id
        WHERE m.user_id=$1 AND m.revoked_at IS NULL AND ((p.archived_at IS NOT NULL)=$2)
          AND (p.name ILIKE $3 OR p.purpose ILIKE $3)
          AND ($4::timestamptz IS NULL OR (p.updated_at,p.id)<($4::timestamptz,$5::uuid))
        ORDER BY p.updated_at DESC,p.id DESC LIMIT $6`, [identity.actorId, filter.archived, pattern, position?.at ?? null, position?.id ?? null, filter.limit + 1]);
      const hasMore = result.rows.length > filter.limit, selected = result.rows.slice(0, filter.limit);
      const items = selected.map(row => ({ id: row.id, name: row.name, purpose: row.purpose, version: integer(row.version), updatedAt: row.at }));
      const last = selected.at(-1);
      return { items, nextCursor: hasMore && last ? this.#cursor.create(identity.actorId, filter, { id: last.id, at: last.at }) : null, hasMore, observedAt: new Date().toISOString(), baselineVersion: null };
    });
  }
  async detail(token: string, projectId: string) {
    return this.#access.authenticated(token, null, (db, identity) => this.#detail(db, identity, projectId));
  }
  async #detail(db: PoolClient, identity: AuthenticatedIdentity, projectId: string) {
      const row = (await db.query(`SELECT p.*,m.participation,pc.actor_id,pc.client_id,pc.generation,pc.revoked_at AS control_revoked_at,
        cu.status AS controller_status,cu.revoked_at AS controller_revoked_at,cc.revoked_at AS controller_client_revoked_at,
        pp.id AS policy_id,pm.id AS application_id,pm.application_version,pm.snapshot_hash FROM anvil.projects p JOIN anvil.project_members m ON m.project_id=p.id
        LEFT JOIN anvil.project_control pc ON pc.project_id=p.id
        LEFT JOIN anvil.users cu ON cu.id=pc.actor_id LEFT JOIN anvil.clients cc ON cc.id=pc.client_id AND cc.user_id=pc.actor_id
        LEFT JOIN anvil.permission_policies pp ON pp.project_id=p.id
        LEFT JOIN LATERAL (SELECT id,application_version,snapshot_hash FROM anvil.project_methodologies WHERE project_id=p.id ORDER BY application_version DESC LIMIT 1) pm ON true
        WHERE p.id=$1 AND m.user_id=$2 AND m.revoked_at IS NULL`, [projectId, identity.actorId])).rows[0];
      if (!row) throw new AuthFailure('NOT_FOUND', 404);
      const activeControl = !!row.generation && !row.control_revoked_at && row.controller_status === 'ACTIVE' && !row.controller_revoked_at && !row.controller_client_revoked_at;
      const sourceBinding=(await db.query('SELECT b.*,c.operation,c.actor_id,c.client_id command_client FROM anvil.project_source_declarations b JOIN anvil.commands c ON c.id=b.command_id AND c.project_id=b.project_id WHERE b.project_id=$1',[projectId])).rows[0];
      const sourceDeclaration=sourceBinding&&row.participation==='OWNER'?await readSourceDeclarationRecord(db,sourceBinding.declaration_id,integer(sourceBinding.declaration_version)):null;
      if(sourceBinding&&(sourceBinding.operation!=='createProject'||sourceBinding.actor_id!==sourceBinding.created_by||sourceBinding.command_client!==sourceBinding.client_id))throw new AuthFailure('SOURCE_DECLARATION_INTEGRITY_FAILED',503);
      return {
        id: row.id, name: row.name, purpose: row.purpose, desiredOutcome: row.desired_outcome, version: integer(row.version),
        createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), currentMethodologyRef: row.application_id ? { id: row.application_id, version: integer(row.application_version), contentHash: row.snapshot_hash } : null, baselineRef: null,
        sourceMode:sourceBinding?'EXISTING':'EMPTY',sourceDeclaration,
        readinessIssues: [...(sourceBinding?[{code:'SOURCE_DECLARATION_UNVERIFIED'}]:[]),...(!row.application_id ? [{ code: 'METHODOLOGY_CONNECTION_PENDING' }] : []), ...(!row.policy_id ? [{ code: 'PERMISSION_POLICY_UNCONFIGURED' }] : [])],
        viewerPermissions: ['READ_PROJECT'], participation: row.participation,
        controlState: { actorId: row.actor_id ?? null, clientId: row.client_id ?? null, generation: row.generation ? integer(row.generation) : null, status: activeControl ? row.actor_id === identity.actorId && row.client_id === identity.clientId ? 'HELD' : 'OTHER_CLIENT' : 'UNASSIGNED' },
      };
  }
}
