import type { Pool, PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { recordV1, uuidV1, refV1, hashV1, isoV1, cloneV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import type { ExecutionGrantRead } from '../context/read-access.ts';
import { projectNotArchived } from '../context/read-access.ts';
import { ProjectContexts, registeredStartContextRead as contextRead } from '../context/project-contexts.ts';
import { ProjectContextSources, registeredContextSourceResolve as sourceResolve } from '../context/context-sources.ts';
import { startContextBody } from './normal-initial-execution.ts';
import { startMaterialDescriptor, type NormalStartContextSource } from './normal-start-materials.ts';

type Scope = Parameters<NormalStartContextSource['contextBody']>[0];
type Marker = { db: PoolClient; query: PoolClient['query']; scope: Scope; active: boolean };
const markers = new WeakMap<object, Marker>();
const denied = () => new AuthFailure('EXECUTION_GRANT_READ_DENIED', 403);
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const digest = (v: unknown) => contentHash(canonicalJson(v));


/** 검증된 공급자 거래에서만 발급한다. 외부 mint API는 제공하지 않는다. */
export function registeredContextReadMatches(value: unknown, db?: PoolClient, projectId?: string, ref?: unknown): boolean {
 if (!value || typeof value !== 'object') return false;
 const m = markers.get(value);
 return !!m && m.active && m.db.query === m.query && (db === undefined || m.db === db) &&
  (projectId === undefined || m.scope.projectId === projectId) && (ref === undefined || same(m.scope.contextBundleRef, ref));
}

// 기존 0083 무결성 함수는 SELECT만 수행한다. 0084의 HUMAN 회원/control/잠금 경로는 호출하지 않는다.
// 현재 등록/회수/독립 credential 예약을 확인하고 원 command의 정확한 맥락 그룹을 가져온다.
const bindingSql = `SELECT g.id AS grant_id,g.version::int AS grant_version,g.content_hash AS grant_hash,g.snapshot_json AS grant,
 x.id AS command_record_id,x.snapshot_json->'envelope' AS envelope,x.envelope_hash,
 jsonb_build_object('id',d.id,'version',d.version,'contentHash',d.content_hash) AS manifest_ref,d.snapshot_json AS manifest,
 (SELECT jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',m.id,'version',m.version,'contentHash',m.content_hash),'snapshot',m.snapshot_json))
  FROM anvil.execution_materials m WHERE m.project_id=d.project_id AND m.manifest_id=d.id) AS materials,
 anvil.normal_start_material_complete(g.project_id,g.command_id) AS graph_valid,
 clock_timestamp() AS observed_at
 FROM anvil.execution_grants g
 JOIN anvil.execution_commands x ON x.project_id=g.project_id AND x.created_command_id=g.command_id
 JOIN anvil.execution_material_manifests d ON d.project_id=g.project_id AND d.created_command_id=g.command_id
 JOIN anvil.executions e ON e.project_id=g.project_id AND e.command_id=g.command_id AND e.id=g.execution_id AND e.generation=g.generation
 JOIN anvil.connectors h ON h.project_id=g.project_id AND h.id::text=g.snapshot_json#>>'{binding,registration,connectorId}'
 JOIN anvil.connector_registrations r ON r.project_id=g.project_id AND r.id=h.registration_id
 WHERE g.project_id=$1 AND g.execution_id=$2 AND g.generation=$3 AND d.command_id=$4
 AND g.version=1 AND g.snapshot_json->>'transport'='NORMAL_PROTECTED' AND g.snapshot_json->>'state'='GRANTED'
 AND x.execution_id=g.execution_id AND x.generation=g.generation AND x.grant_id=g.id AND x.grant_version=g.version
 AND d.execution_id=g.execution_id AND d.generation=g.generation AND d.grant_id=g.id AND d.grant_version=g.version
 AND d.snapshot_json#>'{groups,0,payloadRef}'=$5::jsonb AND d.snapshot_json#>'{groups,0,source,sourceBytes}'=to_jsonb($6::bigint)
 AND d.snapshot_json#>>'{groups,0,source,contentHash}'=$7
 AND e.transport='NORMAL_PROTECTED'
 AND NOT EXISTS(SELECT 1 FROM anvil.executions newer WHERE newer.project_id=g.project_id AND newer.id=g.execution_id AND newer.generation>g.generation)
 AND NOT EXISTS(SELECT 1 FROM anvil.execution_grant_revocations rv WHERE rv.project_id=g.project_id AND rv.grant_id=g.id AND rv.grant_version=g.version)
 AND anvil.normal_credential_reservation_valid(g.project_id,g.id,g.version)
 AND to_jsonb(d.credential_generation)=g.snapshot_json#>'{binding,executionCredentialReservation,generation}'
 AND h.status='TRUSTED' AND h.revoked_at IS NULL AND r.state='ISSUED' AND r.revoked_at IS NULL AND r.failed_attempts<5
 AND to_jsonb(h.generation)=g.snapshot_json#>'{binding,registration,generation}'
 AND jsonb_build_object('id',r.id,'version',r.version,'contentHash',
 anvil.execution_json_hash(jsonb_build_object('registrationId',r.id,'version',r.version,'state',r.state,'scopeDigest',r.scope_digest)))
 =g.snapshot_json#>'{binding,registration,ref}'
 AND h.host_fingerprint=g.snapshot_json#>>'{binding,registration,hostPublicKeyFingerprint}'
 AND h.host_fingerprint=r.expected_host_fingerprint AND h.host_fingerprint=r.observed_host_fingerprint
 AND r.expires_at>clock_timestamp()
 AND EXISTS(SELECT 1 FROM anvil.connector_credentials k WHERE k.project_id=g.project_id AND k.registration_id=r.id
  AND k.revoked_at IS NULL AND k.expires_at>clock_timestamp())
 LIMIT 2`;

function checkedScope(value: Scope): Scope {
 if (!recordV1(value, ['projectId','executionId','executionGeneration','commandId','contextBundleRef','sourceBytes','contentHash']) ||
  !uuidV1(value.projectId) || !uuidV1(value.executionId) || !uuidV1(value.commandId) ||
  !Number.isSafeInteger(value.executionGeneration) || value.executionGeneration < 1 || !refV1(value.contextBundleRef) ||
  value.contextBundleRef.version !== 1 || !Number.isSafeInteger(value.sourceBytes) || value.sourceBytes < 1 ||
  value.sourceBytes > 2 * 1024 * 1024 || !hashV1(value.contentHash)) throw denied();
 return Object.freeze(cloneV1(value));
}
function checkedBinding(rows: any[], scope: Scope) {
 const r = rows[0], g = r?.grant, b = g?.binding, e = r?.envelope;
 if (rows.length !== 1 || r.graph_valid !== true || !refV1({id:r.grant_id,version:r.grant_version,contentHash:r.grant_hash}) ||
  r.grant_version !== 1 || digest(g) !== r.grant_hash || g.transport !== 'NORMAL_PROTECTED' || g.state !== 'GRANTED' ||
  g.factHash !== digest(b) || g.scopeDigest !== digest({binding:b,allowedOperations:g.allowedOperations,expiresAt:g.expiresAt}) ||
  b.projectId !== scope.projectId || b.executionId !== scope.executionId || b.executionGeneration !== scope.executionGeneration ||
  !same(b.intent.contextBundleRef, scope.contextBundleRef) || !refV1(b.intent.assignmentRef) ||
  !(r.observed_at instanceof Date) || !Number.isFinite(r.observed_at.getTime()) || !isoV1(g.plannedAt) || !isoV1(g.expiresAt) ||
  Date.parse(g.plannedAt) > r.observed_at.getTime() || Date.parse(g.expiresAt) <= r.observed_at.getTime() ||
  e?.operation !== 'START_SESSION' || e.commandId !== scope.commandId || e.context?.projectId !== scope.projectId ||
  e.context?.executionId !== scope.executionId || e.context?.executionGeneration !== scope.executionGeneration ||
  e.envelopeHash !== r.envelope_hash) throw denied();
 const {envelopeHash, ...unsigned} = e;
 if (digest(unsigned) !== envelopeHash) throw denied();
 const grantRef = {id:r.grant_id,version:r.grant_version,contentHash:r.grant_hash};
 const descriptor = startMaterialDescriptor({command_record_id:r.command_record_id,manifest_ref:r.manifest_ref,manifest:r.manifest,materials:r.materials},
  {projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,
   connectorId:b.registration.connectorId,grantRef,credentialGeneration:b.executionCredentialReservation.generation},e);
 const group = descriptor.groups[0]!;
 if (group.kind !== 'CONTEXT_BUNDLE' || !same(group.payloadRef,scope.contextBundleRef) ||
  group.sourceBytes !== scope.sourceBytes || group.contentHash !== scope.contentHash ||
  Date.parse(r.manifest.expiresAt) <= r.observed_at.getTime()) throw denied();
 return {grantRef, assignmentRef:b.intent.assignmentRef, expires:Math.min(Date.parse(g.expiresAt),Date.parse(r.manifest.expiresAt))};
}

export interface RegisteredStartContextOptions {
 pool: Pick<Pool,'connect'>;
 contexts: ProjectContexts;
}

/** 자기 연결의 한 READ ONLY snapshot에서만 원문을 조립한다. 전달 허가는 기존 GET의 최종 거래가 판정한다. */
export class RegisteredStartContextSource implements NormalStartContextSource {
 readonly #options: RegisteredStartContextOptions;
 readonly #ports: RegisteredStartContextOptions;
 readonly #sources: ProjectContextSources;
 constructor(options: RegisteredStartContextOptions) {
  this.#options = options;
  this.#ports = Object.freeze({pool:options.pool,contexts:options.contexts});
  this.#sources = options.contexts.sources as ProjectContextSources;
 }
 #assertPorts() {
  const c = this.#ports.contexts, s = this.#sources;
  if (this.#options.pool !== this.#ports.pool || this.#options.contexts !== c ||
   !(c instanceof ProjectContexts) || Object.getPrototypeOf(c) !== ProjectContexts.prototype ||
   c.readRegisteredStartSource !== contextRead || ProjectContexts.prototype.readRegisteredStartSource !== contextRead ||
   !(s instanceof ProjectContextSources) || c.sources !== s || Object.getPrototypeOf(s) !== ProjectContextSources.prototype ||
   s.resolveRegistered !== sourceResolve || ProjectContextSources.prototype.resolveRegistered !== sourceResolve) throw denied();
 }

 async contextBody(value: Scope, signal: AbortSignal): Promise<string> {
  this.#assertPorts();
  const scope = checkedScope(value), controller = new AbortController();
  const onAbort = () => controller.abort();
  signal.addEventListener('abort',onAbort,{once:true});
  if (signal.aborted) controller.abort();
  const timer = setTimeout(onAbort,2000);
  let db: PoolClient | undefined, released = false, inflight = false, active = false, marker: Marker | undefined;
  const error = () => new AuthFailure('EXECUTION_MATERIAL_SOURCE_TIMEOUT',503);
  const release = (cause?: Error) => { if (db && !released) { released = true; db.release(cause); } };
  const bounded = async <T>(pending: Promise<T>): Promise<T> => {
   let abort = () => {};
   const stopped = new Promise<never>((_,fail) => { abort = () => fail(error()); controller.signal.addEventListener('abort',abort,{once:true}); });
   try { if (controller.signal.aborted) { pending.catch(() => {}); throw error(); } return await Promise.race([pending,stopped]); }
   finally { controller.signal.removeEventListener('abort',abort); }
  };
  try {
   if (controller.signal.aborted) throw error();
   const connection = this.#ports.pool.connect().then(client => {
    db = client;
    if (controller.signal.aborted) { release(error()); throw error(); }
    return client;
   });
   await bounded(connection);
   const query = async (sql: string, args?: unknown[]) => {
    if (released || controller.signal.aborted) throw error();
    inflight = true;
    try { this.#assertPorts(); const result = await bounded(db!.query(sql,args)); this.#assertPorts(); return result; }
    finally { if (!controller.signal.aborted) inflight = false; }
   };
   await query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); active = true;
   await query("SET LOCAL statement_timeout='1800ms'");
   const guarded = Object.freeze({query:async (sql: string,args?: unknown[]) => {
    if (!active || !/^SELECT\b/i.test(sql) || /;|\b(?:INSERT|UPDATE|DELETE|MERGE|FOR\s+(?:UPDATE|SHARE)|project_members|set_config)\b/i.test(sql)) throw denied();
    return query(sql,args);
   }}) as unknown as PoolClient;
   const rows = (await guarded.query(bindingSql,[scope.projectId,scope.executionId,scope.executionGeneration,scope.commandId,
    canonicalJson(scope.contextBundleRef),scope.sourceBytes,scope.contentHash])).rows;
   const binding = checkedBinding(rows,scope);
   await projectNotArchived(guarded,scope.projectId);
   const grant = Object.freeze({kind:'EXECUTION_GRANT',projectId:scope.projectId,executionId:scope.executionId,
    executionGeneration:scope.executionGeneration,grantRef:Object.freeze(binding.grantRef)});
   marker = {db:guarded,query:guarded.query,scope,active:true}; markers.set(grant,marker);
   this.#assertPorts();
   const ctx = await bounded(contextRead.call(this.#ports.contexts,guarded,grant as ExecutionGrantRead,scope.projectId,scope.contextBundleRef));
   this.#assertPorts();
   const body = startContextBody(ctx,{contextBundleRef:scope.contextBundleRef,assignmentRef:binding.assignmentRef});
   if (Buffer.byteLength(body,'utf8') !== scope.sourceBytes || contentHash(body) !== scope.contentHash) throw denied();
   const at = (await guarded.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
   if (!(at instanceof Date) || !Number.isFinite(at.getTime()) || at.getTime() >= binding.expires || at < rows[0].observed_at) throw denied();
   marker.active = false; active = false;
   await query('ROLLBACK');
   release();
   return body;
  } catch (cause) {
   if (marker) marker.active = false;
   if (db && !released) {
    if (inflight || controller.signal.aborted) release(error());
    else {
     try { await bounded(db.query('ROLLBACK')); release(); }
     catch { release(error()); }
    }
   }
   throw cause;
  } finally {
   active = false;
   if (marker) marker.active = false;
   clearTimeout(timer); signal.removeEventListener('abort',onAbort);
  }
 }
}
