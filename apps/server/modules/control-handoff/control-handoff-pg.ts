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
}
export interface ControlHandoffPgSource {
  forSession(token: string, csrf: string, projectId: string): ControlHandoffPgSession;
}
export interface ControlHandoffPgOptions { pool: Pool; access: AccessRepository; enabled?: boolean }

/** 실제 연결은 enabled=true를 명시하고 transaction을 호출한 때에만 시작한다. */
export function createControlHandoffPgSource(options: ControlHandoffPgOptions): ControlHandoffPgSource {
  const enabled = options.enabled === true;
  return { forSession(token, csrf, projectId) {
    if (!enabled) {
      const transaction = async <T>(): Promise<T> => noConnection();
      return { requestPort: { sourceMode: 'NOT_CONNECTED', transaction },
        readPort: { sourceMode: 'NOT_CONNECTED', transaction },
        summaryPort: { sourceMode: 'NOT_CONNECTED', transaction } };
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
          || error instanceof HandoffSummaryStoreFailure
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
        run(context => work(context.summaryTransaction())) }
    };
  } };
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
