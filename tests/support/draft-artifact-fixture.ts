import assert from 'node:assert/strict';
import type { Pool, PoolClient } from 'pg';
import { createHash } from 'node:crypto';
import { AccessRepository, AuthFailure } from '../../apps/server/modules/access/repository.ts';
import { canonicalJson, contentHash } from '../../contracts/canonical.ts';
import { DraftArtifacts } from '../../apps/server/modules/projects/draft-artifacts.ts';
import type { DraftArtifactFilePort, DraftFileSpec, DraftCopySpec } from '../../apps/server/modules/projects/draft-artifact-files.ts';
import type { DraftArtifactRef, DraftUploadCommand } from '../../contracts/draft-artifacts.ts';
export const draftId = (n: number) => `af010000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
const graph = { nodes: [{ nodeId: 'H01', name: '사용자 확인', purpose: '합성 명시 판단', kind: 'HUMAN', position: { x: 0, y: 0 }, role: 'USER', inputs: [], outputs: [], taskScope: { included: ['자료 검토'], excluded: [] }, completionCriteria: ['명시 확인'], approvalBoundary: ['사용자 확인'], mode: 'CASE_BY_CASE', limitPolicyRef: null, recordRequirements: ['판단 보존'] }], edges: [], entryNodeId: 'H01', terminalNodeIds: ['H01'] };
export function draftArtifactFixture(options: { empty?: boolean } = {}) {
  const owner = draftId(1), clientId = draftId(2), did = draftId(3), sessionId = draftId(4), token = 't'.repeat(43), csrf = 'c'.repeat(43);
  const input = { name: '합성 원본', purpose: '명시 원문 선택', desiredOutcome: '동일 바이트 귀속', sourceMode: 'EMPTY' as const, methodologySelection: { kind: 'CONFIRMED_REFERENCE' as const, versionRef: { id: draftId(8), version: 1, contentHash: contentHash(canonicalJson(graph)) } }, artifactRefs: [] as DraftArtifactRef[] };
  const initial = () => ({ drafts: options.empty ? [] : [{ id: did, owner_user_id: owner, client_id: clientId, version: 1, step: 2, input_json: structuredClone(input), consumed_project_id: null }], uploads: [] as any[], artifacts: [] as any[], creations: [] as any[], commands: [] as any[], projects: [] as any[], selections: [] as any[], adoptions: [] as any[], quotaBytes: 0, quotaCount: 0, audit: [] as any[] });
  let state: any = initial(), active = false, snapshot: any = null, failCommit = false;
  const queries: string[] = [], events: string[] = [], fileBodies = new Map<string, Buffer>(), projectBodies = new Map<string, Buffer>();
  const control = { actor: owner, client: clientId, active: true, projectRead: true, rejectNextCommitAfter: '', onFiles: null as null | (() => void), fileFailure: '', sqlFailure: null as null | { at: string; code: string; message: string } };
  const draft = (id = did) => state.drafts.find((d: any) => d.id === id);
  const current = (d: any, version: number) => { if (d.consumed_project_id) throw new AuthFailure('DRAFT_ALREADY_CONSUMED', 412); if (Number(d.version) !== version) throw new AuthFailure('VERSION_CONFLICT', 409); };
  const quota = (bytes: number, count: number) => { if (state.quotaBytes + bytes > 524288000 || state.quotaCount + count > 200) throw new AuthFailure('DRAFT_QUOTA_EXCEEDED', 413); state.quotaBytes += bytes; state.quotaCount += count; };
  function query(sql: string, p: any[] = []): any {
    queries.push(sql); const rows = (v: any[]) => ({ rows: v, rowCount: v.length });
    if (sql === 'BEGIN') { assert(!active); active = true; snapshot = structuredClone(state); events.push('BEGIN'); return rows([]); }
    assert(active, '진짜 AccessRepository transaction 안에서만 DB double을 소비한다');
    if (sql === 'COMMIT') { if (failCommit) { failCommit = false; throw Error('SYNTHETIC_COMMIT_LOST'); } active = false; snapshot = null; events.push('COMMIT'); return rows([]); }
    if (sql === 'ROLLBACK') { state = snapshot; active = false; snapshot = null; events.push('ROLLBACK'); return rows([]); }
    if (control.rejectNextCommitAfter && sql.includes(control.rejectNextCommitAfter)) { failCommit = true; control.rejectNextCommitAfter = ''; }
    if (sql.includes('FROM anvil.auth_sessions s JOIN anvil.users u')) { assert.equal(p[0], sha(token)); return rows([{ id: sessionId, uid: control.actor, client_id: control.client, server_owner: false, user_status: control.active ? 'ACTIVE' : 'DISABLED', credential_generation: 1, current_generation: 1, csrf_digest: sha(csrf), revoked_at: null, user_revoked_at: null, client_revoked_at: null, idle_expires_at: new Date(Date.now()+600000), absolute_expires_at: new Date(Date.now()+600000), reauth_until: null }]); }
    if (control.sqlFailure && sql.includes(control.sqlFailure.at)) { const fault=control.sqlFailure; control.sqlFailure=null; throw Object.assign(Error(fault.message),{code:fault.code}); }
    if (sql.includes('fn01_lock_owner')) return rows([{ value: null }]);
    if (sql.includes('fn01_reserve_upload')) {
      const x = JSON.parse(p[4]), cmd = x.command; current(draft(p[3]), cmd.expectedVersion); assert.equal(cmd.clientId, clientId);
      if (state.uploads.filter((u: any) => u.draft_id === p[3] && u.state !== 'REJECTED').length >= 20) throw new AuthFailure('DRAFT_QUOTA_EXCEEDED', 413);
      quota(cmd.payload.bytes*2, 2);
      const u = { id: x.id, draft_id: p[3], actor_id: p[1], client_id: p[2], external_command_id: cmd.commandId, expected_version: cmd.expectedVersion, request_hash: x.requestHash, request_json: cmd, artifact_id: x.artifactId, server_command_id: x.serverCommandId, receipt_id: x.receiptId, operation_id: x.operationId, ref_json: { ...cmd.payload, artifactId: x.artifactId }, state: 'RESERVED', attempt: 0, result_json: null };
      state.uploads.push(u); events.push('RESERVED'); return rows([{ value: structuredClone(u) }]);
    }
    if (sql.includes('fn01_abort_upload')) {
      const u=state.uploads.find((x:any)=>x.draft_id===p[3]&&x.actor_id===p[1]&&x.client_id===p[2]&&x.external_command_id===p[4]&&x.request_hash===p[5]);
      if(u&&!['FINALIZED','REJECTED'].includes(u.state)){if(u.attempt===0){state.quotaBytes-=u.ref_json.bytes*2;state.quotaCount-=2;u.state='REJECTED';}else u.state='UNKNOWN';}return rows([]);
    }
    if (sql.includes('fn01_claim_intent')) { const u = (p[3] === 'UPLOAD' ? state.uploads : state.creations).find((x: any) => x.id === p[4]); current(draft(u.draft_id), u.expected_version); assert.equal(u.request_hash, p[5]); u.attempt++; return rows([{ value: u.attempt }]); }
    if (sql.includes('fn01_finalize_upload')) {
      const u = state.uploads.find((x: any) => x.id === p[3]); current(draft(u.draft_id), u.expected_version); assert.equal(u.attempt, p[5]); const inspection = JSON.parse(p[6]), status = inspection.state === 'SUSPECTED' ? 'QUARANTINED' : 'READY';
      const result = { scopeKind: 'DRAFT', draftId: u.draft_id, commandId: u.external_command_id, clientId: u.client_id, version: u.expected_version, status: 'APPLIED', data: { artifactRef: u.ref_json, status: 'ARTIFACT_'+status, inspection } };
      state.artifacts.push({ id: u.artifact_id, draft_id: u.draft_id, project_id: null, bytes: u.ref_json.bytes, content_hash: u.ref_json.contentHash, media_type: u.ref_json.mediaType, storage_key: `draft-blobs/${u.draft_id}/${u.artifact_id}`, state: status, created_by: u.actor_id, client_id: u.client_id, command_id: u.server_command_id, inspection_json: inspection, upload_intent_id: u.id });
      state.commands.push({ id: u.server_command_id, operation: 'uploadProjectDraftArtifact', draft_id: u.draft_id, actor_id: u.actor_id, client_id: u.client_id, command_id: u.external_command_id, request_hash: u.request_hash, result_ref: result });
      u.state = 'FINALIZED'; u.result_json = result; state.audit.push({ id: u.server_command_id }); events.push('FINALIZED'); return rows([{ value: structuredClone(result) }]);
    }
    if (sql.includes('fn01_unknown_intent')) { const u = (p[3] === 'UPLOAD' ? state.uploads : state.creations).find((x: any) => x.id === p[4]); if (u && u.attempt === p[5] && !['FINALIZED','COMMITTED'].includes(u.state)) u.state = 'UNKNOWN'; return rows([]); }
    if (sql.includes('fn01_record_selection')) { const refs = JSON.parse(p[7]); state.selections.push({ draftId: p[3], version: p[4], refs, commandId: p[5], receiptId: p[6] }); return rows([]); }
    if (sql.includes('fn01_reserve_creation')) {
      const x = JSON.parse(p[4]), d = draft(p[3]); current(d, x.request.draftVersion);
      if (state.creations.some((r: any) => r.draft_id === p[3] && r.expected_version === d.version && r.state !== 'COMMITTED')) throw new AuthFailure('IDEMPOTENCY_CONFLICT', 409);
      const refs = structuredClone(d.input_json.artifactRefs); quota(refs.reduce((n: number, r: any) => n+r.bytes, 0), refs.length);
      const r = { id: x.id, draft_id: p[3], actor_id: p[1], client_id: p[2], external_command_id: x.request.commandId, expected_version: d.version, request_hash: x.requestHash, target_project_id: x.targetProjectId, refs_json: refs, sources_json: refs.map((ref: any) => ({ ref, uploadId: state.uploads.find((u: any) => u.artifact_id === ref.artifactId).id })), state: 'RESERVED', attempt: 0, result_json: null };
      state.creations.push(r); return rows([{ value: structuredClone(r) }]);
    }
    if (sql.includes('fn01_copies_verified')) { const r = state.creations.find((x: any) => x.id === p[3]); current(draft(r.draft_id), r.expected_version); assert.equal(r.attempt, p[5]); r.state = 'COPIES_VERIFIED'; return rows([]); }
    if (sql.includes('fn01_commit_creation')) {
      const r = state.creations.find((x: any) => x.id === p[3]); current(draft(r.draft_id), r.expected_version); assert.equal(r.state, 'COPIES_VERIFIED'); assert.equal(r.attempt, p[6]);
      for (const ref of r.refs_json) { const art = state.artifacts.find((x: any) => x.id === ref.artifactId); assert.equal(art.state, 'READY'); state.adoptions.push({ artifactId: art.id, commandId: art.command_id, projectId: r.target_project_id }); art.draft_id = null; art.project_id = r.target_project_id; art.storage_key = `blobs/${r.target_project_id}/${art.id}`; }
      state.quotaBytes -= r.refs_json.reduce((n: number, ref: any) => n+ref.bytes,0); state.quotaCount -= r.refs_json.length; r.state = 'COMMITTED'; return rows([]);
    }
    if (sql.includes('fn01_creation_result')) { state.creations.find((x: any) => x.id === p[3]).result_json = JSON.parse(p[4]); return rows([]); }
    if (sql.includes('fn01_release_duplicates')) { const u=state.uploads.find((x:any)=>x.artifact_id===p[4]); if(!u.reclaimed){state.quotaBytes-=u.ref_json.bytes*2;state.quotaCount-=2;u.reclaimed=true;} return rows([]); }
    if (sql.startsWith('SELECT * FROM anvil.project_drafts')) return rows(state.drafts.filter((x: any) => x.id === p[0] && x.owner_user_id === p[1]).map((x:any)=>structuredClone(x)));
    if (sql.startsWith('SELECT * FROM anvil.draft_upload_intents')) return rows(state.uploads.filter((u:any)=>u.draft_id===p[0]&&u.actor_id===p[1]&&(!sql.includes("state<>'REJECTED'")||u.state!=='REJECTED')&&(p.length<3||u.client_id===p[2]&&u.external_command_id===p[3])).map((x:any)=>structuredClone(x)));
    if (sql.startsWith('SELECT * FROM anvil.draft_creation_intents')) return rows(state.creations.filter((r:any)=>r.draft_id===p[0]&&r.actor_id===p[1]&&r.client_id===p[2]&&r.external_command_id===p[3]).map((x:any)=>structuredClone(x)));
    if (sql.startsWith('SELECT a.*,u.id AS upload_intent_id')) return rows(state.artifacts.filter((x:any)=>x.id===p[0]).map((x:any)=>structuredClone(x)));
    if (sql.startsWith('SELECT draft_id FROM anvil.draft_upload_intents')) return rows(state.uploads.filter((x:any)=>x.id===p[0]).map((x:any)=>({draft_id:x.draft_id})));
    if (sql.startsWith('SELECT * FROM anvil.artifacts')) return rows(state.artifacts.filter((x:any)=>x.id===p[0]&&x.project_id===p[1]).map((x:any)=>structuredClone(x)));
    if (sql.includes('FROM anvil.commands WHERE draft_id=')) return rows(state.commands.filter((x:any)=>x.draft_id===p[0]&&x.actor_id===p[1]&&x.command_id===p[2]&&(!sql.includes("operation='saveProjectDraft'")||x.operation==='saveProjectDraft')).map((x:any)=>structuredClone(x)));
    if (sql.includes("c.operation='createProjectDraft'")) return rows(state.commands.filter((x:any)=>x.actor_id===p[0]&&x.command_id===p[1]&&x.operation==='createProjectDraft').map((x:any)=>structuredClone(x)));
    if (sql.startsWith('INSERT INTO anvil.project_drafts')) { assert.equal(sql,'INSERT INTO anvil.project_drafts(id,owner_user_id,client_id,step,input_json) VALUES($1,$2,$3,1,$4) RETURNING *');assert.equal(p.length,4);assert.match(p[0],/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);assert(!draft(p[0]));assert.equal(p[1],control.actor);assert.equal(p[2],control.client);const d={id:p[0],owner_user_id:p[1],client_id:p[2],version:1,step:1,input_json:JSON.parse(p[3]),consumed_project_id:null};state.drafts.push(d);return rows([structuredClone(d)]); }
    if (sql.startsWith('UPDATE anvil.project_drafts SET version=')) {const d=state.drafts.find((x:any)=>x.id===p[0]);d.version++;d.step=p[1];d.input_json=JSON.parse(p[2]);return rows([structuredClone(d)]);}
    if (sql.startsWith('UPDATE anvil.project_drafts SET consumed_')) {state.drafts.find((x:any)=>x.id===p[0]).consumed_project_id=p[1];return rows([]);}
    if (sql.startsWith('INSERT INTO anvil.commands')) {const project=sql.includes("'PROJECT'");state.commands.push(project?{id:p[0],project_id:p[1],actor_id:p[2],client_id:p[3],operation:'createProject',command_id:p[4],request_hash:p[5],result_ref:null}:{id:p[0],draft_id:p[1],actor_id:p[2],client_id:p[3],operation:p[4],command_id:p[5],request_hash:p[6],result_ref:JSON.parse(p[9])});return rows([]);}
    if (sql.startsWith('UPDATE anvil.commands SET result_ref')){state.commands.find((x:any)=>x.id===p[0]).result_ref=JSON.parse(p[1]);return rows([]);}
    if (sql.startsWith('UPDATE anvil.commands SET authorization_')||sql.startsWith('INSERT INTO anvil.authorization_receipts'))return rows([]);
    if (sql.startsWith('INSERT INTO anvil.draft_audit_events')||sql.startsWith('INSERT INTO anvil.audit_events')){state.audit.push({sql,values:p});return rows([]);}
    if (sql.includes("set_config('anvil.actor_id'"))return rows([]);
    if (sql.includes('FROM anvil.form_definitions'))return rows([]);
    if (sql.includes('FROM anvil.methodology_definitions'))return rows([{scope:'USER_COMMON',graph_json:graph,content_hash:input.methodologySelection.versionRef.contentHash}]);
    if (sql.includes('FROM anvil.methodology_reviews'))return rows([{accepted:true}]);
    if (sql.includes('FROM anvil.content_reviews'))return rows([{outcome:'ACCEPTED'}]);
    if (sql.startsWith('SELECT name,purpose,graph_json FROM anvil.methodology_versions'))return rows([{name:'합성 사람 방법론',purpose:'원문 선택 검수',graph_json:graph}]);
    if (sql.startsWith('INSERT INTO anvil.projects(')){state.projects.push({id:p[0],name:p[1],purpose:p[2],desired_outcome:p[3],version:1,created_at:new Date(),updated_at:new Date()});return rows([]);}
    if (sql.startsWith('INSERT INTO anvil.project_members')){Object.assign(state.projects.find((x:any)=>x.id===p[0]),{participation:'OWNER',owner:p[1]});return rows([]);}
    if (sql.startsWith('INSERT INTO anvil.project_control')){Object.assign(state.projects.find((x:any)=>x.id===p[0]),{actor_id:p[1],client_id:p[2],generation:1,controller_status:'ACTIVE'});return rows([]);}
    if (sql.startsWith('INSERT INTO anvil.project_methodologies')){Object.assign(state.projects.find((x:any)=>x.id===p[1]),{application_id:p[0],application_version:1,snapshot_hash:p[6]});return rows([]);}
    if (sql.startsWith('SELECT p.*,m.participation')||sql.startsWith('SELECT p.id,p.archived_at'))return rows(control.projectRead?state.projects.filter((x:any)=>x.id===p[0]&&x.owner===p[1]).map((x:any)=>structuredClone(x)):[]);
    if(sql.startsWith('SELECT b.*,c.operation'))return rows([]);
    throw Error('UNEXPECTED_SYNTHETIC_QUERY: '+sql.slice(0,100));
  }
  const pool={async connect(){return{query:async(sql:string,p:any[]=[])=>query(sql,p),release(){assert(!active);}} as unknown as PoolClient;}} as unknown as Pool;
  const access=new AccessRepository(pool,{installationId:draftId(5),key:Buffer.alloc(32,7)});
  const outside=()=>{assert(!active,'파일 I/O 전에 예약 transaction을 끝내야 한다');control.onFiles?.();};
  const check=(bytes:Buffer|undefined,ref:DraftArtifactRef)=>{assert(bytes,'원문 누락');assert.equal(bytes.length,ref.bytes);assert.equal(contentHash(bytes),ref.contentHash);return Buffer.from(bytes);};
  const files:DraftArtifactFilePort={
    async upload(spec:DraftFileSpec,bytes:Buffer){outside();events.push('FILE_UPLOAD');assert(state.uploads.some((u:any)=>u.id===spec.intentId),'durable 예약 선행');if(control.fileFailure==='UPLOAD')throw Error('SYNTHETIC_PARTIAL_WRITE');const old=fileBodies.get(spec.ref.artifactId);if(old)check(old,spec.ref);else fileBodies.set(spec.ref.artifactId,Buffer.from(bytes));},
    async readDraft(spec){outside();return check(fileBodies.get(spec.ref.artifactId),spec.ref);},
    async readProject(_projectId,ref){outside();return check(projectBodies.get(ref.artifactId),ref);},
    async copy(spec:DraftCopySpec){outside();events.push('FILE_COPY');if(control.fileFailure==='COPY')throw Error('SYNTHETIC_COPY_LOST');projectBodies.set(spec.ref.artifactId,check(fileBodies.get(spec.ref.artifactId),spec.ref));},
    async verifyCopy(spec){outside();check(projectBodies.get(spec.ref.artifactId),spec.ref);},
    async reclaimDraft(spec){outside();check(projectBodies.get(spec.ref.artifactId),spec.ref);if(control.fileFailure==='RECLAIM')throw Error('SYNTHETIC_RECLAIM_LOST');fileBodies.delete(spec.ref.artifactId);},
  };
  const service=new DraftArtifacts(access,undefined,files);
  const command=(bytes:Buffer, n=20):DraftUploadCommand=>({schemaVersion:1,commandId:draftId(n),clientId,expectedVersion:Number(draft().version),payload:{bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain;charset=utf-8'}});
  return{access,service,files,control,token,csrf,owner,clientId,did,input,command,queries,events,fileBodies,projectBodies,state:()=>state,draft,active:()=>active};
}
