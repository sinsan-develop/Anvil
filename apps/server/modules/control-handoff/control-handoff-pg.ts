import { readOwnControlHandoffHistoryRows } from '../backups/control-handoff-history-inventory.ts';
import { readDocumentInventoryInput } from '../backups/document-inventory-input.ts';
import { notificationSessionDeadline } from '../notifications/notification-input.ts';
import { currentAccess, checkStable } from './control-request-read.ts';
import { contentHash } from '../../../../contracts/canonical.ts';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { canonicalJson } from '../../../../contracts/canonical.ts';
import { uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AccessRepository, AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import type { ControlRequestStoreObservation, ControlRequestStorePort,
  ControlRequestTransaction, ControlRequestBundle, StoredControlRequestCommand } from './control-request-store.ts';
import { ControlRequestStoreFailure } from './control-request-store.ts';
import type { ControlRequestReadPort, ControlRequestReadTransaction } from './control-request-read.ts';
import { ControlRequestReadFailure } from './control-request-read.ts';
import type { HandoffSummaryPort, HandoffSummaryTransaction, HandoffSummaryBundle,
  StoredHandoffCommand } from './control-handoff-summary-store.ts';
import { HandoffSummaryStoreFailure } from './control-handoff-summary-store.ts';
import type { ControlRequestRecord } from './control-request-snapshot.ts';
import type { HandoffSummaryRecord } from './control-handoff-summary.ts';
import type { ControlDiscoveryReadPort, ControlDiscoveryReadTransaction } from './control-discovery-read.ts';
import { ControlDiscoveryFailure } from './control-discovery-read.ts';

type Row = Record<string, unknown>;
type RequestRef = ControlRequestRecord['requestRef'];
type SummaryRef = HandoffSummaryRecord['summaryRef'];
const migrationId = '0041_control_handoff_source';
const migrationChecksum = 'c6bd081fc7a70f8eaa68ac673cce6f8e41549d98f2c3e5bb3c22833874b0e522';
const schemaQuery = `SELECT (to_regclass('anvil.control_handoff_source_requests') IS NOT NULL
  AND to_regclass('anvil.control_handoff_source_summaries') IS NOT NULL
  AND to_regclass('anvil.control_handoff_source_commands') IS NOT NULL
  AND to_regclass('anvil.control_handoff_source_receipts') IS NOT NULL
  AND to_regclass('anvil.control_handoff_source_audits') IS NOT NULL) AS ready`;

export class ControlHandoffPgFailure extends AuthFailure {
  readonly code: 'CONTROL_REQUEST_NOT_CONNECTED' | 'FN15_SOURCE_FAILED';
  constructor(code: 'CONTROL_REQUEST_NOT_CONNECTED' | 'FN15_SOURCE_FAILED') {
    super(code, 503); this.name = 'ControlHandoffPgFailure';
    this.code = code;
  }
}
const noConnection = (): never => { throw new ControlHandoffPgFailure('CONTROL_REQUEST_NOT_CONNECTED'); };
const safeRow = (value: unknown): Row | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
const first = (result: { rows: readonly unknown[] }): Row | null => safeRow(result.rows[0]);
const iso = (value: unknown): string => {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
  return date.toISOString();
};
const integer = (value: unknown): number => {
  const number = typeof value === 'string' && /^[0-9]+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || Number(number) < 0) throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
  return Number(number);
};
const json = <T>(value: unknown): T => {
  try { return JSON.parse(typeof value === 'string' ? value : canonicalJson(value)) as T; }
  catch { throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED'); }
};
const text = (value: unknown): string => {
  if (typeof value !== 'string') throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
  return value;
};
const refFromRequest = (row: Row): RequestRef => ({ id: text(row.id),
  version: integer(row.version), contentHash: text(row.content_hash) });
const refFromSummary = (row: Row): SummaryRef => ({ id: text(row.request_id),
  version: integer(row.version), contentHash: text(row.content_hash) });

function requestRecord(row: Row): ControlRequestRecord {
  return { requestRef: refFromRequest(row), snapshot: json(row.snapshot_json),
    metadata: json(row.metadata_json) };
}
function requestCommand(row: Row): StoredControlRequestCommand {
  return { schemaVersion: 1, operation: 'requestControl', commandId: text(row.command_id),
    commandHash: text(row.command_hash), payloadHash: text(row.payload_hash),
    projectId: text(row.project_id), actorId: text(row.actor_id), clientId: text(row.client_id),
    baseControl: json(row.base_control_json),
    requestRef: { id: text(row.request_id), version: integer(row.request_version),
      contentHash: text(row.request_hash) }, createdAt: iso(row.created_at) };
}
function summaryCommand(row: Row): StoredHandoffCommand {
  return { schemaVersion: 1, operation: 'prepareControlHandoff', commandId: text(row.command_id),
    commandHash: text(row.command_hash), payloadHash: text(row.payload_hash),
    projectId: text(row.project_id), actorId: text(row.actor_id), clientId: text(row.client_id),
    requestRef: { id: text(row.request_id), version: integer(row.request_version),
      contentHash: text(row.request_hash) },
    summaryRef: { id: text(row.request_id), version: integer(row.summary_version),
      contentHash: text(row.summary_hash) }, baseControl: json(row.base_control_json),
    createdAt: iso(row.created_at) };
}
function summaryRecord(row: Row): HandoffSummaryRecord {
  return { summaryRef: refFromSummary(row), body: json(row.body_json), metadata: json(row.metadata_json) };
}

export interface ControlHandoffPgSession {
  requestPort: ControlRequestStorePort;
  readPort: ControlRequestReadPort;
  summaryPort: HandoffSummaryPort;
  discoveryPort: ControlDiscoveryReadPort;
}
export interface ControlHandoffPgSource {
  forSession(token: string, csrf: string, projectId: string): ControlHandoffPgSession;
}
export interface ControlHandoffPgOptions { pool: Pool; access: AccessRepository; enabled?: boolean }

type HistoryIdentity=Readonly<{actorId:string;clientId:string;credentialGeneration:number;sessionId:string}>;
type HistoryConstraint=Readonly<{expectedIdentity:HistoryIdentity;deadlineMonotonicMs:number}>;
type HistoryEnvelope=Readonly<{inventory:Record<string,any>;readConstraints:Readonly<{identity:HistoryIdentity;deadlineMonotonicMs:number;metadataCharge:number}>}>;
const historySources=new WeakMap<object,Readonly<{pool:Pool;access:AccessRepository;enabled:boolean;read:(token:string,csrf:string,value:unknown,signal:AbortSignal,constraint:HistoryConstraint)=>Promise<Record<string,unknown>>}>>();
/** 생성 구성 결박만 확인한다. 인증/OWNER proof를 발급하지 않는다. */
export function assertControlHandoffHistorySourceBinding(source:unknown,rootAccess:AccessRepository):void{
 const r=source!==null&&(typeof source==='object'||typeof source==='function')?historySources.get(source as object):undefined;
 if(!r||!(rootAccess instanceof AccessRepository)||r.access!==rootAccess||r.pool!==rootAccess.pool||r.access.pool!==r.pool)throw new AuthFailure('INPUT_INVALID',400);
}
export async function readControlHandoffHistoryForComposition(source:unknown,rootAccess:AccessRepository,token:string,csrf:string,value:unknown,signal:AbortSignal,constraint:HistoryConstraint):Promise<HistoryEnvelope>{
 assertControlHandoffHistorySourceBinding(source,rootAccess);
 const invalid=():never=>{throw new AuthFailure('INPUT_INVALID',400);};
 const data=(v:unknown,keys:string[])=>{if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return invalid();const d=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(d).length!==keys.length||Reflect.ownKeys(d).some(k=>typeof k!=='string'||!keys.includes(k)))return invalid();const out:Record<string,any>={};for(const k of keys){if(!Object.hasOwn(d[k]??{},'value'))return invalid();out[k]=d[k]!.value;}return out;};
 const c=data(constraint,['expectedIdentity','deadlineMonotonicMs']),i=data(c.expectedIdentity,['actorId','clientId','credentialGeneration','sessionId']);
 if(!uuidV1(i.actorId)||!uuidV1(i.clientId)||!uuidV1(i.sessionId)||!Number.isSafeInteger(i.credentialGeneration)||i.credentialGeneration<1||typeof c.deadlineMonotonicMs!=='number'||!Number.isFinite(c.deadlineMonotonicMs)||!(signal instanceof AbortSignal))return invalid();
 const fixed=Object.freeze({expectedIdentity:Object.freeze({...i})as HistoryIdentity,deadlineMonotonicMs:c.deadlineMonotonicMs});
 const record=historySources.get(source as object)!;if(!record.enabled)throw new ControlHandoffPgFailure('CONTROL_REQUEST_NOT_CONNECTED');
 const result=await record.read(token,csrf,value,signal,fixed)as unknown as HistoryEnvelope;assertControlHandoffHistorySourceBinding(source,rootAccess);return result;
}

/** 실제 연결은 enabled=true를 명시하고 transaction을 호출한 때에만 시작한다. */
export function createControlHandoffPgSource(options: ControlHandoffPgOptions): ControlHandoffPgSource & {readOwnHistoryInventory(token:string,csrf:string,value:unknown,signal:AbortSignal):Promise<Record<string,unknown>>} {
  const enabled = options.enabled === true;
  const source:ControlHandoffPgSource & {readOwnHistoryInventory(token:string,csrf:string,value:unknown,signal:AbortSignal):Promise<Record<string,unknown>>} = { readOwnHistoryInventory(token,csrf,value,signal){
    if(!enabled)return Promise.reject(new ControlHandoffPgFailure('CONTROL_REQUEST_NOT_CONNECTED'));
    return readOwnHistoryFromFactory(options.pool,options.access,token,csrf,value,signal);
  }, forSession(token, csrf, projectId) {
    if (!enabled) {
      const transaction = async <T>(): Promise<T> => noConnection();
      return { requestPort: { sourceMode: 'NOT_CONNECTED', transaction },
        readPort: { sourceMode: 'NOT_CONNECTED', transaction },
        summaryPort: { sourceMode: 'NOT_CONNECTED', transaction },
        discoveryPort: { sourceMode: 'NOT_CONNECTED', transaction } };
    }
    const signer = { sign: (message: string) => options.access.signControlRequestCursor(message),
      verify: (message: string, signature: string) => options.access.verifyControlRequestCursor(message, signature) };
    async function run<T>(work: (context: PgContext) => Promise<T>): Promise<T> {
      if (!uuidV1(projectId)) return noConnection();
      const db = await options.pool.connect();
      let prepared = false;
      try {
        await db.query('BEGIN');
        const schema = first(await db.query(schemaQuery));
        if (schema?.ready !== true) return noConnection();
        const migration = first(await db.query(
          'SELECT id,checksum FROM anvil.schema_migrations WHERE id=$1', [migrationId]));
        if (migration?.id !== migrationId || migration.checksum !== migrationChecksum) return noConnection();
        prepared = true;
        const identity = await options.access.authenticateInTransaction(db, token, csrf);
        const result = await work(new PgContext(db, projectId, identity));
        await db.query('COMMIT');
        return result;
      } catch (error) {
        await db.query('ROLLBACK').catch(() => {});
        if (!prepared) return noConnection();
        if (error instanceof AuthFailure
          && ((error.message === 'AUTH_REQUIRED' && error.statusCode === 401)
            || (error.message === 'CSRF_INVALID' && error.statusCode === 403))) throw error;
        if (error instanceof ControlRequestStoreFailure || error instanceof ControlRequestReadFailure
          || error instanceof HandoffSummaryStoreFailure || error instanceof ControlDiscoveryFailure
          || error instanceof ControlHandoffPgFailure) throw error;
        throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
      } finally { db.release(); }
    }
    return {
      requestPort: { sourceMode: 'POSTGRES_SOURCE', transaction: async <T>(work: (tx: ControlRequestTransaction) => Promise<T>) =>
        run(context => work(context.requestTransaction())) },
      readPort: { sourceMode: 'POSTGRES_SOURCE', signer,
        transaction: async <T>(work: (tx: ControlRequestReadTransaction) => Promise<T>) =>
          run(context => work(context.readTransaction())) },
      summaryPort: { sourceMode: 'POSTGRES_SOURCE', transaction: async <T>(work: (tx: HandoffSummaryTransaction) => Promise<T>) =>
        run(context => work(context.summaryTransaction())) },
      discoveryPort: { sourceMode: 'POSTGRES_SOURCE', transaction: async <T>(work: (tx: ControlDiscoveryReadTransaction) => Promise<T>) =>
        run(context => work(context.discoveryTransaction())) }
    };
  } };
  const fixedPool=options.pool,fixedAccess=options.access;
  historySources.set(source,Object.freeze({pool:fixedPool,access:fixedAccess,enabled,read:(token:string,csrf:string,value:unknown,signal:AbortSignal,constraint:HistoryConstraint)=>readOwnHistoryFromFactory(fixedPool,fixedAccess,token,csrf,value,signal,constraint)}));
  return source;
}

class PgContext {
  private pendingRequest: ControlRequestRecord | null = null;
  private pendingSummary: HandoffSummaryRecord | null = null;
  private lockedCommandId: string | null = null;
  private readonly db: PoolClient;
  private readonly projectId: string;
  private readonly identity: AuthenticatedIdentity;
  constructor(db: PoolClient, projectId: string, identity: AuthenticatedIdentity) {
    this.db = db; this.projectId = projectId; this.identity = identity;
  }
  private rememberCommand(id: string): void {
    if (!uuidV1(id) || (this.lockedCommandId !== null && this.lockedCommandId !== id))
      throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
    this.lockedCommandId = id;
  }

  /** helper가 잠근 user/session/client 다음에 project→member→control을 잠그고 DB 시각을 읽는다. */
  async observe(): Promise<ControlRequestStoreObservation> {
    const session = this.identity.authSession;
    if (!session) throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
    const project = first(await this.db.query(
      'SELECT id,archived_at FROM anvil.projects WHERE id=$1 FOR UPDATE', [this.projectId]));
    const member = first(await this.db.query(
      'SELECT project_id,user_id,participation,revoked_at FROM anvil.project_members WHERE project_id=$1 AND user_id=$2 FOR UPDATE',
      [this.projectId, this.identity.actorId]));
    const control = first(await this.db.query(
      'SELECT project_id,actor_id,client_id,generation,version,revoked_at FROM anvil.project_control WHERE project_id=$1 FOR UPDATE',
      [this.projectId]));
    const clock = first(await this.db.query('SELECT clock_timestamp() AS at'));
    const participation = member?.participation;
    return { project: project ? { id: text(project.id),
      archivedAt: project.archived_at === null ? null : iso(project.archived_at) } : null,
      access: { projectId: this.projectId, now: iso(clock?.at),
        identity: { actorId: this.identity.actorId, clientId: this.identity.clientId,
          credentialGeneration: this.identity.credentialGeneration,
          currentCredentialGeneration: this.identity.credentialGeneration,
          sessionRevokedAt: null, idleExpiresAt: session.idleExpiresAt,
          absoluteExpiresAt: session.absoluteExpiresAt, userActive: true,
          userRevokedAt: null, clientUserId: this.identity.actorId, clientRevokedAt: null,
          reauthUntil: this.identity.reauthUntil?.toISOString() ?? null },
        member: member && (participation === 'OWNER' || participation === 'HANDOFF_ELIGIBLE')
          ? { projectId: text(member.project_id), userId: text(member.user_id),
            participation, revokedAt: member.revoked_at === null ? null : iso(member.revoked_at) } : null,
        control: control ? { projectId: text(control.project_id), actorId: text(control.actor_id),
          clientId: text(control.client_id), generation: integer(control.generation),
          version: integer(control.version), revokedAt: control.revoked_at === null ? null : iso(control.revoked_at) } : null } };
  }

  private async commandRow(commandId: string): Promise<Row | null> {
    return first(await this.db.query(
      'SELECT * FROM anvil.control_handoff_source_commands WHERE command_id=$1 FOR UPDATE', [commandId]));
  }
  private async requestRow(ref: RequestRef): Promise<Row | null> {
    return first(await this.db.query(
      'SELECT * FROM anvil.control_handoff_source_requests WHERE project_id=$1 AND id=$2 AND version=$3 AND content_hash=$4 FOR UPDATE',
      [this.projectId, ref.id, ref.version, ref.contentHash]));
  }
  private async summaryRow(ref: SummaryRef): Promise<Row | null> {
    return first(await this.db.query(
      'SELECT * FROM anvil.control_handoff_source_summaries WHERE project_id=$1 AND request_id=$2 AND version=$3 AND content_hash=$4 FOR UPDATE',
      [this.projectId, ref.id, ref.version, ref.contentHash]));
  }
  private async requestBundle(commandId: string): Promise<ControlRequestBundle> {
    const row = await this.commandRow(commandId);
    if (!row || row.operation !== 'requestControl' || row.project_id !== this.projectId)
      return { request: null, command: null, receipts: [], audits: [] };
    const command = requestCommand(row);
    const request = await this.requestRow(command.requestRef);
    const receipt = first(await this.db.query(
      'SELECT body_json FROM anvil.control_handoff_source_receipts WHERE project_id=$1 AND command_id=$2 FOR UPDATE',
      [this.projectId, commandId]));
    const audit = first(await this.db.query(
      'SELECT body_json FROM anvil.control_handoff_source_audits WHERE project_id=$1 AND command_id=$2 FOR UPDATE',
      [this.projectId, commandId]));
    return { request: request ? requestRecord(request) : null, command,
      receipts: receipt ? [json(receipt.body_json)] : [], audits: audit ? [json(audit.body_json)] : [] };
  }
  private async requestBundleByRef(ref: RequestRef): Promise<ControlRequestBundle | null> {
    const row = first(await this.db.query(
      'SELECT source_command_id FROM anvil.control_handoff_source_requests WHERE project_id=$1 AND id=$2 AND version=$3 AND content_hash=$4',
      [this.projectId, ref.id, ref.version, ref.contentHash]));
    return row ? this.requestBundle(text(row.source_command_id)) : null;
  }
  private async summaryBundle(commandId: string): Promise<HandoffSummaryBundle> {
    const row = await this.commandRow(commandId);
    if (!row || row.operation !== 'prepareControlHandoff' || row.project_id !== this.projectId)
      return { summary: null, command: null, receipts: [], audits: [] };
    const command = summaryCommand(row);
    const summary = await this.summaryRow(command.summaryRef);
    const receipt = first(await this.db.query(
      'SELECT body_json FROM anvil.control_handoff_source_receipts WHERE project_id=$1 AND command_id=$2 FOR UPDATE',
      [this.projectId, commandId]));
    const audit = first(await this.db.query(
      'SELECT body_json FROM anvil.control_handoff_source_audits WHERE project_id=$1 AND command_id=$2 FOR UPDATE',
      [this.projectId, commandId]));
    return { summary: summary ? summaryRecord(summary) : null, command,
      receipts: receipt ? [json(receipt.body_json)] : [], audits: audit ? [json(audit.body_json)] : [] };
  }
  private async summaryBundleByRef(ref: SummaryRef): Promise<HandoffSummaryBundle> {
    const row = first(await this.db.query(
      'SELECT source_command_id FROM anvil.control_handoff_source_summaries WHERE project_id=$1 AND request_id=$2 AND version=$3 AND content_hash=$4',
      [this.projectId, ref.id, ref.version, ref.contentHash]));
    if (!row) throw new HandoffSummaryStoreFailure('HANDOFF_NOT_FOUND', null);
    return this.summaryBundle(text(row.source_command_id));
  }

  requestTransaction(): ControlRequestTransaction {
    return { observe: () => this.observe(),
      lockCommand: async id => {
        this.rememberCommand(id);
        const row = await this.commandRow(id);
        if (row && row.operation !== 'requestControl') throw new ControlRequestStoreFailure('CONTROL_REQUEST_COMMAND_CONFLICT', id);
        return row ? requestCommand(row) : null;
      },
      allocateRequestId: async () => randomUUID(),
      insertRequest: async record => {
        if (!this.lockedCommandId) throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
        this.pendingRequest = record;
        const s = record.snapshot;
        await this.db.query(`INSERT INTO anvil.control_handoff_source_requests
          (project_id,id,version,content_hash,snapshot_json,metadata_json,requested_by,client_id,source_command_id,created_at,expires_at)
          VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11)`,
        [s.projectId, s.id, s.version, record.requestRef.contentHash, canonicalJson(s),
          canonicalJson(record.metadata), s.requestedBy.actorId, s.requestedBy.clientId,
          this.lockedCommandId, s.createdAt, s.expiresAt]);
      },
      insertCommand: async command => {
        const s = this.pendingRequest?.snapshot;
        if (!s || command.commandId !== this.lockedCommandId)
          throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
        const wire = { schemaVersion: 1, operation: 'requestControl', commandId: command.commandId,
          projectId: command.projectId, clientId: command.clientId,
          payload: { targetActorRef: s.targetActorRef, targetClientRef: s.targetClientRef,
            baseControl: s.baseControl, reason: s.reason, expiresAt: s.expiresAt } };
        await this.db.query(`INSERT INTO anvil.control_handoff_source_commands
          (command_id,project_id,operation,actor_id,client_id,request_id,request_version,request_hash,
            summary_version,summary_hash,base_control_json,command_json,command_hash,payload_hash,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)`,
        [command.commandId, command.projectId, command.operation, command.actorId, command.clientId,
          command.requestRef.id, command.requestRef.version, command.requestRef.contentHash,
          null, null, canonicalJson(command.baseControl), canonicalJson(wire),
          command.commandHash, command.payloadHash, command.createdAt]);
      },
      insertReceipt: async receipt => {
        await this.db.query('INSERT INTO anvil.control_handoff_source_receipts (command_id,project_id,body_json) VALUES($1,$2,$3::jsonb)',
          [receipt.commandId, receipt.projectId, canonicalJson(receipt)]);
      },
      insertAudit: async audit => {
        await this.db.query('INSERT INTO anvil.control_handoff_source_audits (command_id,project_id,body_json) VALUES($1,$2,$3::jsonb)',
          [audit.commandId, audit.projectId, canonicalJson(audit)]);
      },
      readBundle: id => this.requestBundle(id) };
  }

  readTransaction(): ControlRequestReadTransaction {
    return { observe: () => this.observe(), readBundleByRef: async ref => {
      const bundle = await this.requestBundleByRef(ref);
      if (!bundle) throw new ControlRequestReadFailure('CONTROL_REQUEST_NOT_FOUND');
      return bundle;
    },
      listRows: async query => {
        const after = query.after;
        const result = await this.db.query(`SELECT project_id,id,version,content_hash,created_at,requested_by,client_id
          FROM anvil.control_handoff_source_requests WHERE project_id=$1
            AND ($2='CONTROLLER' OR requested_by=$3)
            AND ($4::timestamptz IS NULL OR created_at<$4 OR (created_at=$4 AND id<$5))
          ORDER BY created_at DESC,id DESC LIMIT $6`,
        [query.projectId, query.view, query.actorId, after?.createdAt ?? null,
          after?.requestRef.id ?? null, query.limit]);
        return result.rows.map((value: unknown) => {
          const row = safeRow(value);
          if (!row) throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
          return { requestRef: refFromRequest(row), createdAt: iso(row.created_at),
            projectId: text(row.project_id), requestedBy: { actorId: text(row.requested_by),
              clientId: text(row.client_id) } };
        });
      } };
  }

  discoveryTransaction(): ControlDiscoveryReadTransaction {
    return { observe: () => this.observe(),
      readRequestBundleByRef: async ref => {
        const bundle = await this.requestBundleByRef(ref);
        if (!bundle) throw new ControlRequestReadFailure('CONTROL_REQUEST_NOT_FOUND');
        return bundle;
      },
      readHeadSummaryRef: async ref => {
        const row = first(await this.db.query(`SELECT project_id,request_id,request_version,request_hash,version,content_hash
          FROM anvil.control_handoff_source_summaries
          WHERE project_id=$1 AND request_id=$2 AND request_version=$3 AND request_hash=$4
          ORDER BY version DESC LIMIT 1`,
        [this.projectId, ref.id, ref.version, ref.contentHash]));
        return row ? { projectId: text(row.project_id),
          requestRef: { id: text(row.request_id), version: integer(row.request_version),
            contentHash: text(row.request_hash) },
          summaryRef: { id: text(row.request_id), version: integer(row.version),
            contentHash: text(row.content_hash) } } : null;
      } };
  }

  summaryTransaction(): HandoffSummaryTransaction {
    return { observe: () => this.observe(), readRequestBundleByRef: async ref => {
      const bundle = await this.requestBundleByRef(ref);
      if (!bundle) throw new HandoffSummaryStoreFailure('HANDOFF_REQUEST_INVALID', null);
      return bundle;
    },
      lockCommand: async id => {
        this.rememberCommand(id);
        const row = await this.commandRow(id);
        if (row && row.operation !== 'prepareControlHandoff') throw new HandoffSummaryStoreFailure('HANDOFF_COMMAND_CONFLICT', id);
        return row ? summaryCommand(row) : null;
      },
      lockRequestVersion: async ref => {
        const request = await this.requestRow(ref);
        if (!request) throw new HandoffSummaryStoreFailure('HANDOFF_REQUEST_INVALID', null);
        const row = first(await this.db.query(`SELECT version FROM anvil.control_handoff_source_summaries
          WHERE project_id=$1 AND request_id=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE`,
          [this.projectId, ref.id]));
        return row ? integer(row.version) : 0;
      },
      collect: async () => null,
      insertSummary: async record => {
        if (!this.lockedCommandId) throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
        this.pendingSummary = record;
        const body = record.body;
        await this.db.query(`INSERT INTO anvil.control_handoff_source_summaries
          (project_id,request_id,request_version,request_hash,version,content_hash,body_json,metadata_json,
            source_command_id,observed_at,valid_until)
          VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11)`,
        [body.projectId, record.summaryRef.id, body.requestRef.version, body.requestRef.contentHash,
          record.summaryRef.version, record.summaryRef.contentHash, canonicalJson(body),
          canonicalJson(record.metadata), this.lockedCommandId, body.observedAt, body.validUntil]);
      },
      insertCommand: async command => {
        if (!this.pendingSummary || this.pendingSummary.summaryRef.contentHash !== command.summaryRef.contentHash)
          throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
        if (command.commandId !== this.lockedCommandId) throw new ControlHandoffPgFailure('FN15_SOURCE_FAILED');
        const wire = { schemaVersion: 1, operation: 'prepareControlHandoff', commandId: command.commandId,
          projectId: command.projectId, clientId: command.clientId, payload: { requestRef: command.requestRef } };
        await this.db.query(`INSERT INTO anvil.control_handoff_source_commands
          (command_id,project_id,operation,actor_id,client_id,request_id,request_version,request_hash,
            summary_version,summary_hash,base_control_json,command_json,command_hash,payload_hash,created_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15)`,
        [command.commandId, command.projectId, command.operation, command.actorId, command.clientId,
          command.requestRef.id, command.requestRef.version, command.requestRef.contentHash,
          command.summaryRef.version, command.summaryRef.contentHash, canonicalJson(command.baseControl),
          canonicalJson(wire), command.commandHash, command.payloadHash, command.createdAt]);
      },
      insertReceipt: async receipt => {
        await this.db.query('INSERT INTO anvil.control_handoff_source_receipts (command_id,project_id,body_json) VALUES($1,$2,$3::jsonb)',
          [receipt.commandId, receipt.projectId, canonicalJson(receipt)]);
      },
      insertAudit: async audit => {
        await this.db.query('INSERT INTO anvil.control_handoff_source_audits (command_id,project_id,body_json) VALUES($1,$2,$3::jsonb)',
          [audit.commandId, audit.projectId, canonicalJson(audit)]);
      },
      readSummaryBundle: id => this.summaryBundle(id),
      readSummaryBundleByRef: ref => this.summaryBundleByRef(ref) };
  }
}

/** 이 factory가 캡처한 실제 pool/access/gate만 사용한다. 기존 forSession transaction은 바꾸지 않는다. */
async function readOwnHistoryFromFactory(pool:Pool,access:AccessRepository,token:string,csrf:string,value:unknown,signal:AbortSignal,constraint?:HistoryConstraint):Promise<Record<string,unknown>>{
 const request=readDocumentInventoryInput(value),started=performance.now();let authDeadline=Infinity,metadataUsed=0,identity:AuthenticatedIdentity|undefined,firstAccess:ReturnType<typeof currentAccess>|undefined,fingerprint:string|undefined;
 const fail=(code='CONTROL_HANDOFF_HISTORY_INVENTORY_STORAGE_FAILED',status=503):never=>{throw new AuthFailure(code,status);},hash=(v:unknown)=>contentHash(canonicalJson(v));
 const remaining=()=>Math.floor(Math.min(request.limits.deadlineMs-(performance.now()-started),authDeadline-performance.now(),constraint?constraint.deadlineMonotonicMs-performance.now():Infinity,2147483647));
 const check=()=>{if(signal.aborted)fail('CONTROL_HANDOFF_HISTORY_INVENTORY_CANCELLED',409);if(remaining()<1)fail('CONTROL_HANDOFF_HISTORY_INVENTORY_DEADLINE',413);};
 const charge=(bytes:number)=>{if(!Number.isSafeInteger(bytes)||bytes<0||metadataUsed>request.limits.metadataBytes-bytes)fail('CONTROL_HANDOFF_HISTORY_INVENTORY_LIMIT',413);metadataUsed+=bytes;};
 async function acquire():Promise<PoolClient>{check();const pending=pool.connect();return new Promise((resolve,reject)=>{let done=false;const clean=()=>{clearTimeout(timer);signal.removeEventListener('abort',stop);},stop=()=>{if(done)return;done=true;clean();reject(new AuthFailure('CONTROL_HANDOFF_HISTORY_INVENTORY_CONNECTION_UNKNOWN',503));},timer=setTimeout(stop,remaining());signal.addEventListener('abort',stop,{once:true});pending.then(db=>{if(done){try{db.release(new Error('CONTROL_HANDOFF_HISTORY_LATE_CONNECTION'));}catch{/* 기한 뒤 회수 불명: 앞선503을 정상으로 바꾸지 않는다. */}return;}done=true;clean();resolve(db);},()=>{if(done)return;done=true;clean();reject(new AuthFailure('CONTROL_HANDOFF_HISTORY_INVENTORY_STORAGE_FAILED',503));});if(signal.aborted)stop();});}
 async function phase(rr:boolean){const db=await acquire();let released=false,startedTransaction=false,inTransaction=false,unknown=false;
  const discard=()=>{if(released)return;released=true;try{db.release(new Error('CONTROL_HANDOFF_HISTORY_INVENTORY_OUTCOME_UNKNOWN'));}catch{unknown=true;}};
  async function tracked<T>(pending:Promise<T>,cleanup=false):Promise<T>{return new Promise((resolve,reject)=>{let done=false;const clean=()=>{clearTimeout(timer);if(!cleanup)signal.removeEventListener('abort',stop);},stop=()=>{if(done)return;done=true;unknown=true;clean();discard();reject(new AuthFailure('CONTROL_HANDOFF_HISTORY_INVENTORY_QUERY_UNKNOWN',503));},timer=setTimeout(stop,Math.max(1,remaining()));if(!cleanup)signal.addEventListener('abort',stop,{once:true});pending.then(v=>{if(done)return;done=true;clean();resolve(v);},e=>{if(done)return;done=true;clean();reject(e);});if(remaining()<1||!cleanup&&signal.aborted)stop();});}
  async function q(sql:string,values:unknown[]=[]):Promise<{rows:any[]}>{check();if(inTransaction){await tracked(db.query("SELECT set_config('statement_timeout',$1,true)",[String(Math.max(1,remaining()))]));check();}const result=await tracked(db.query(sql,values));check();return result;}
  const gate=async()=>{const found=await q(schemaQuery);if(found.rows.length!==1||found.rows[0]?.ready!==true)fail('CONTROL_REQUEST_NOT_CONNECTED');const m=await q('SELECT id,checksum FROM anvil.schema_migrations WHERE id=$1',[migrationId]);if(m.rows.length!==1||m.rows[0]?.id!==migrationId||m.rows[0]?.checksum!==migrationChecksum)fail('CONTROL_REQUEST_NOT_CONNECTED');};
  try{check();startedTransaction=true;await tracked(db.query(rr?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN ISOLATION LEVEL READ COMMITTED'));inTransaction=true;await gate();const clockBefore=performance.now();let a:AuthenticatedIdentity;if(!rr){a=await access.authenticateInTransaction({query:q}as unknown as PoolClient,token,csrf);if(constraint&&(a.actorId!==constraint.expectedIdentity.actorId||a.clientId!==constraint.expectedIdentity.clientId||a.credentialGeneration!==constraint.expectedIdentity.credentialGeneration||a.authSession?.id!==constraint.expectedIdentity.sessionId))fail('AUTH_REQUIRED',401);if(identity&&(a.actorId!==identity.actorId||a.clientId!==identity.clientId||a.credentialGeneration!==identity.credentialGeneration||a.authSession?.id!==identity.authSession?.id))fail('AUTH_REQUIRED',401);identity??=a;}else{if(!identity)fail();a=identity!;}
   const p=(await q('SELECT id,archived_at FROM anvil.projects WHERE id=$1',[request.projectId])).rows,m=(await q('SELECT project_id,user_id,participation,revoked_at FROM anvil.project_members WHERE project_id=$1 AND user_id=$2',[request.projectId,a.actorId])).rows,control=(await q('SELECT project_id,actor_id,client_id,generation,version,revoked_at FROM anvil.project_control WHERE project_id=$1',[request.projectId])).rows,clock=(await q('SELECT clock_timestamp() AS at')).rows;if(p.length!==1||m.length!==1||p[0].id!==request.projectId||p[0].archived_at!==null||m[0].participation!=='OWNER'||m[0].user_id!==a.actorId||m[0].project_id!==request.projectId||m[0].revoked_at!==null)fail('NOT_FOUND',404);if(clock.length!==1||!(clock[0].at instanceof Date))fail();authDeadline=Math.min(authDeadline,notificationSessionDeadline(a,clock[0].at,clockBefore));const observation={project:{id:request.projectId,archivedAt:null},access:{projectId:request.projectId,now:clock[0].at.toISOString(),identity:{actorId:a.actorId,clientId:a.clientId,credentialGeneration:a.credentialGeneration,currentCredentialGeneration:a.credentialGeneration,sessionRevokedAt:null,idleExpiresAt:a.authSession!.idleExpiresAt,absoluteExpiresAt:a.authSession!.absoluteExpiresAt,userActive:true,userRevokedAt:null,clientUserId:a.actorId,clientRevokedAt:null,reauthUntil:a.reauthUntil?.toISOString()??null},member:{projectId:request.projectId,userId:a.actorId,participation:'OWNER',revokedAt:null},control:control.length===1?{projectId:control[0].project_id,actorId:control[0].actor_id,clientId:control[0].client_id,generation:integer(control[0].generation),version:integer(control[0].version),revokedAt:control[0].revoked_at===null?null:iso(control[0].revoked_at)}:null}},seen=currentAccess(observation,request.projectId);if(firstAccess)checkStable(firstAccess,seen,'OWN');else firstAccess=seen;
   let snapshot:string|undefined;if(rr){const state=(await q("SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot")).rows;if(state.length!==1||state[0].isolation!=='repeatable read'||state[0].read_only!=='on'||typeof state[0].snapshot!=='string'||!/^\d+:\d+:[\d,]*$/.test(state[0].snapshot))fail();snapshot=state[0].snapshot;}else{const state=(await q("SELECT current_setting('transaction_isolation') AS isolation")).rows;if(state.length!==1||state[0].isolation!=='read committed')fail();}
   const packet=await readOwnControlHandoffHistoryRows({query:q,check,charge,remaining:()=>request.limits.metadataBytes-metadataUsed},request.projectId,a.actorId);if(fingerprint!==undefined&&fingerprint!==packet.fingerprint)fail('CONTROL_HANDOFF_HISTORY_INVENTORY_CHANGED');fingerprint??=packet.fingerprint;if(rr){const state=(await q("SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot")).rows;if(state.length!==1||state[0].snapshot!==snapshot||state[0].isolation!=='repeatable read'||state[0].read_only!=='on')fail();}check();await tracked(db.query(rr?'ROLLBACK':'COMMIT'));inTransaction=false;startedTransaction=false;released=true;db.release();return packet;
  }catch(error){if(!released){if(startedTransaction){try{await tracked(db.query('ROLLBACK'),true);inTransaction=false;startedTransaction=false;}catch{unknown=true;}}if(unknown)discard();else{released=true;try{db.release();}catch{unknown=true;}}}if(unknown)fail();if(error instanceof AuthFailure&&['AUTH_REQUIRED','CSRF_INVALID','NOT_FOUND','CONTROL_REQUEST_NOT_CONNECTED'].includes(error.message))throw error;if(error instanceof AuthFailure&&error.message.startsWith('CONTROL_HANDOFF_HISTORY_INVENTORY_'))throw error;return fail();}
 }
 try{check();await phase(false);const packet=await phase(true);await phase(false);const projection=packet.projection,result:any={...projection,scope:'OWN_CONTROL_REQUEST_AND_SYNTHETIC_SUMMARY_HISTORY_ONLY',inventoryHash:hash(projection),controlGenerationTransitions:'NOT_RECORDED',currentAuthorityVerification:'NOT_PERFORMED',blobVerification:'NOT_PERFORMED',fullProjectCoverage:false,restorable:false,authorizationRestoration:false,executionAuthorized:false,dispatchPerformed:false,controlTransferred:false,atomicSnapshotVerified:false,usage:{metadataBytes:0,inputBytes:0,fileCount:0}};check();for(let i=0;i<17;i++){const n=Buffer.byteLength(canonicalJson(result));check();if(metadataUsed+n>request.limits.metadataBytes)fail('CONTROL_HANDOFF_HISTORY_INVENTORY_LIMIT',413);if(result.usage.metadataBytes===n){check();if(constraint){const metadataCharge=metadataUsed+n,deadlineMonotonicMs=Math.min(started+request.limits.deadlineMs,authDeadline,constraint.deadlineMonotonicMs);if(!Number.isSafeInteger(metadataCharge)||!identity?.authSession||!Number.isFinite(deadlineMonotonicMs))fail();const resultEnvelope=Object.freeze({inventory:result,readConstraints:Object.freeze({identity:Object.freeze({actorId:identity!.actorId,clientId:identity!.clientId,credentialGeneration:identity!.credentialGeneration,sessionId:identity!.authSession!.id}),deadlineMonotonicMs,metadataCharge})});check();return resultEnvelope;}return result;}result.usage.metadataBytes=n;}return fail();}catch(error){if(error instanceof AuthFailure&&['AUTH_REQUIRED','CSRF_INVALID','NOT_FOUND','CONTROL_REQUEST_NOT_CONNECTED'].includes(error.message))throw error;if(error instanceof AuthFailure&&error.message.startsWith('CONTROL_HANDOFF_HISTORY_INVENTORY_'))throw error;return fail();}
}
