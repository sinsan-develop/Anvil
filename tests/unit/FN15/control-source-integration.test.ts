import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { requestControl, type ControlRequestBundle, type ControlRequestCommand,
  type ControlRequestStorePort, type ControlRequestStoreObservation,
  type ControlRequestTransaction, type StoredControlRequestCommand,
  type ControlRequestReceipt, type ControlRequestAudit } from '../../../apps/server/modules/control-handoff/control-request-store.ts';
import { readControlRequest, listControlRequests,
  type ControlRequestReadPort, type ControlRequestReadTransaction } from '../../../apps/server/modules/control-handoff/control-request-read.ts';
import { prepareControlHandoff, readControlHandoffSummary,
  type HandoffSummaryPort, type HandoffSummaryTransaction,
  type HandoffSummaryBundle, type StoredHandoffCommand,
  type HandoffReceipt, type HandoffAudit } from '../../../apps/server/modules/control-handoff/control-handoff-summary-store.ts';
import type { ControlRequestRecord } from '../../../apps/server/modules/control-handoff/control-request-snapshot.ts';
import type { HandoffSummaryRecord, HandoffCategory } from '../../../apps/server/modules/control-handoff/control-handoff-summary.ts';
import { baseControl, controller, controllerClient, copy, evidenceRef, now, observation,
  prepareCommandId, projectId, requestId, requester, requesterClient } from './control-handoff-summary-fixture.ts';

type RequestRef = ControlRequestRecord['requestRef'];
type SummaryRef = HandoffSummaryRecord['summaryRef'];
interface Rows {
  requests: Map<string, ControlRequestRecord>;
  requestCommands: Map<string, StoredControlRequestCommand>;
  requestReceipts: ControlRequestReceipt[];
  requestAudits: ControlRequestAudit[];
  summaries: HandoffSummaryRecord[];
  summaryCommands: Map<string, StoredHandoffCommand>;
  summaryReceipts: HandoffReceipt[];
  summaryAudits: HandoffAudit[];
}
const emptyRows = (): Rows => ({ requests: new Map(), requestCommands: new Map(),
  requestReceipts: [], requestAudits: [], summaries: [], summaryCommands: new Map(),
  summaryReceipts: [], summaryAudits: [] });
const requestCommandId = '77777777-7777-4777-8777-000000000001';
const requestExpiresAt = '2026-10-25T09:00:20.000Z';
const requestCommand = (): ControlRequestCommand => ({ schemaVersion: 1,
  operation: 'requestControl', commandId: requestCommandId, projectId, clientId: requesterClient,
  payload: { targetActorRef: { userId: requester },
    targetClientRef: { userId: requester, clientId: requesterClient },
    baseControl: copy(baseControl), reason: '  원본 인수 사유  ', expiresAt: requestExpiresAt } });
const pending = () => ({ status: 'SYNTHETIC_OBSERVED' as const, observedAt: now,
  reasonCode: 'SYNTHETIC_REFS', refs: [{ projectId, ref: copy(evidenceRef) }] });
const empty = () => ({ status: 'EMPTY_SYNTHETIC' as const, observedAt: now,
  reasonCode: 'SYNTHETIC_EMPTY', refs: [] });

/** 세 API가 같은 committed rows를 소비한다. 실제 DB나 권한 생산자를 흉내 내지 않는다. */
class SourceRepository {
  rows: Rows = emptyRows();
  current = observation(requester, requesterClient);
  transactions = 0;
  observes = 0;
  collections = 0;
  failAt: 'summaryReceipt' | null = null;
  unknownCommit = false;
  onObserve: ((count: number) => void) | null = null;
  readonly values: Record<HandoffCategory, unknown> = {
    activeExecutions: empty(), pendingCommands: pending(),
    pendingApprovals: empty(), sourceCheckpointRefs: empty()
  };

  private async transaction<T>(work: (rows: Rows) => Promise<T>): Promise<T> {
    this.transactions++;
    const staged = copy(this.rows);
    const result = await work(staged);
    this.rows = staged;
    if (this.unknownCommit) throw new Error('COMMIT_OUTCOME_UNKNOWN');
    return result;
  }
  private observe = async (): Promise<ControlRequestStoreObservation> => {
    this.observes++;
    this.onObserve?.(this.observes);
    return copy(this.current);
  };
  private requestBundle(rows: Rows, commandId: string): ControlRequestBundle {
    const command = rows.requestCommands.get(commandId) ?? null;
    return copy({ request: command ? rows.requests.get(command.requestRef.id) ?? null : null,
      command, receipts: rows.requestReceipts.filter(row => row.commandId === commandId),
      audits: rows.requestAudits.filter(row => row.commandId === commandId) });
  }
  private requestByRef(rows: Rows, ref: RequestRef): ControlRequestBundle | null {
    const command = [...rows.requestCommands.values()].find(row => row.requestRef.id === ref.id);
    return command ? this.requestBundle(rows, command.commandId) : null;
  }
  private summaryBundle(rows: Rows, commandId: string): HandoffSummaryBundle {
    const command = rows.summaryCommands.get(commandId) ?? null;
    return copy({ summary: command ? rows.summaries.find(row =>
      row.summaryRef.id === command.summaryRef.id && row.summaryRef.version === command.summaryRef.version) ?? null : null,
      command, receipts: rows.summaryReceipts.filter(row => row.commandId === commandId),
      audits: rows.summaryAudits.filter(row => row.commandId === commandId) });
  }
  private summaryByRef(rows: Rows, ref: SummaryRef): HandoffSummaryBundle {
    const command = [...rows.summaryCommands.values()].find(row =>
      row.summaryRef.id === ref.id && row.summaryRef.version === ref.version);
    return this.summaryBundle(rows, command?.commandId ?? '');
  }
  readonly requestPort: ControlRequestStorePort = { sourceMode: 'TEST_FAKE',
    transaction: async <T>(work: (tx: ControlRequestTransaction) => Promise<T>) =>
      this.transaction(rows => work({
        observe: this.observe,
        lockCommand: async id => copy(rows.requestCommands.get(id) ?? null),
        allocateRequestId: async () => requestId,
        insertRequest: async row => { rows.requests.set(row.requestRef.id, copy(row)); },
        insertCommand: async row => { rows.requestCommands.set(row.commandId, copy(row)); },
        insertReceipt: async row => { rows.requestReceipts.push(copy(row)); },
        insertAudit: async row => { rows.requestAudits.push(copy(row)); },
        readBundle: async id => this.requestBundle(rows, id)
      }))
  };
  readonly readPort: ControlRequestReadPort = { sourceMode: 'TEST_FAKE',
    transaction: async <T>(work: (tx: ControlRequestReadTransaction) => Promise<T>) =>
      this.transaction(rows => work({
        observe: this.observe,
        readBundleByRef: async ref => this.requestByRef(rows, ref),
        listRows: async query => [...rows.requests.values()]
          .filter(row => row.snapshot.projectId === query.projectId
            && (query.view === 'CONTROLLER' || row.snapshot.requestedBy.actorId === query.actorId))
          .sort((a, b) => b.snapshot.createdAt.localeCompare(a.snapshot.createdAt)
            || b.requestRef.id.localeCompare(a.requestRef.id))
          .filter(row => query.after === null || row.snapshot.createdAt < query.after.createdAt
            || (row.snapshot.createdAt === query.after.createdAt
              && row.requestRef.id < query.after.requestRef.id))
          .slice(0, query.limit).map(row => ({ requestRef: copy(row.requestRef),
            createdAt: row.snapshot.createdAt, projectId: row.snapshot.projectId,
            requestedBy: copy(row.snapshot.requestedBy) }))
      }))
  };
  readonly summaryPort: HandoffSummaryPort = { sourceMode: 'TEST_FAKE',
    transaction: async <T>(work: (tx: HandoffSummaryTransaction) => Promise<T>) =>
      this.transaction(rows => work({
        observe: this.observe,
        readRequestBundleByRef: async ref => this.requestByRef(rows, ref),
        lockCommand: async id => copy(rows.summaryCommands.get(id) ?? null),
        lockRequestVersion: async ref => rows.summaries.filter(row => row.summaryRef.id === ref.id).length,
        collect: async category => { this.collections++; return copy(this.values[category]); },
        insertSummary: async row => { rows.summaries.push(copy(row)); },
        insertCommand: async row => { rows.summaryCommands.set(row.commandId, copy(row)); },
        insertReceipt: async row => {
          if (this.failAt === 'summaryReceipt') throw new Error('INJECTED_WRITE_FAILURE');
          rows.summaryReceipts.push(copy(row));
        },
        insertAudit: async row => { rows.summaryAudits.push(copy(row)); },
        readSummaryBundle: async id => this.summaryBundle(rows, id),
        readSummaryBundleByRef: async ref => this.summaryByRef(rows, ref)
      }))
  };
}

async function created(): Promise<{ repo: SourceRepository; requestRef: RequestRef }> {
  const repo = new SourceRepository();
  const result = await requestControl(requestCommand(), repo.requestPort);
  return { repo, requestRef: result.requestRef };
}
const prepareCommand = (requestRef: RequestRef) => ({ schemaVersion: 1,
  operation: 'prepareControlHandoff', commandId: prepareCommandId, projectId,
  clientId: controllerClient, payload: { requestRef: copy(requestRef) } });

test('SELF 저장 원문을 보호 조회·목록과 현재 제어자 요약 생성·보호 조회가 같은 저장소에서 소비한다', async () => {
  const { repo, requestRef } = await created();
  const original = copy(repo.rows.requests.get(requestId));
  assert.ok(original);
  assert.equal(original.snapshot.reason, requestCommand().payload.reason);
  assert.equal(requestRef.contentHash, contentHash(canonicalJson(original.snapshot)));
  assert.deepEqual([repo.rows.requests.size, repo.rows.requestCommands.size,
    repo.rows.requestReceipts.length, repo.rows.requestAudits.length], [1, 1, 1, 1]);
  const own = await readControlRequest({ projectId, requestRef }, repo.readPort);
  assert.equal(own.snapshot.reason, original.snapshot.reason);
  const listed = await listControlRequests({ projectId, view: 'OWN', limit: 1 }, repo.readPort);
  assert.deepEqual(listed.items.map(item => item.requestRef), [requestRef]);
  assert.equal(JSON.stringify(listed).includes(original.snapshot.reason), false);

  repo.current = observation(controller, controllerClient);
  const controllerRead = await readControlRequest({ projectId, requestRef }, repo.readPort);
  assert.deepEqual(controllerRead.requestRef, requestRef);
  const beforeControl = copy(repo.current.access.control);
  const prepared = await prepareControlHandoff(prepareCommand(requestRef), repo.summaryPort);
  const summary = await readControlHandoffSummary({ projectId, requestRef,
    summaryRef: prepared.summaryRef }, repo.summaryPort);
  assert.equal(summary.body.safetyState, 'WAITING');
  assert.equal(summary.body.pendingCommands.refs[0]?.ref.contentHash, evidenceRef.contentHash);
  assert.deepEqual(summary.body.requestRef, requestRef);
  assert.equal(prepared.summaryRef.contentHash, contentHash(canonicalJson(summary.body)));
  assert.ok(summary.body.gaps.includes('REAL_COLLECTOR_NOT_CONNECTED'));
  assert.ok(summary.body.gaps.includes('TARGET_ELIGIBILITY_UNVERIFIED'));
  assert.equal(summary.body.acceptanceEnabled, false);
  assert.equal(summary.executionAuthorized, false);
  assert.equal(summary.controlTransferred, false);
  assert.deepEqual([repo.rows.summaries.length, repo.rows.summaryCommands.size,
    repo.rows.summaryReceipts.length, repo.rows.summaryAudits.length], [1, 1, 1, 1]);
  assert.deepEqual(repo.rows.requests.get(requestId), original);
  assert.deepEqual(repo.current.access.control, beforeControl);
});

test('타인과 회수된 client는 원문·요약을 받지 않고 중간 실패는 요약 4종을 모두 rollback한다', async () => {
  const { repo, requestRef } = await created();
  repo.current = observation(controller, controllerClient);
  const prepared = await prepareControlHandoff(prepareCommand(requestRef), repo.summaryPort);
  const readInput = { projectId, requestRef, summaryRef: prepared.summaryRef };
  repo.current = observation('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await assert.rejects(readControlRequest({ projectId, requestRef }, repo.readPort));
  await assert.rejects(readControlHandoffSummary(readInput, repo.summaryPort));
  repo.current = observation(controller, controllerClient);
  repo.observes = 0;
  repo.onObserve = count => { if (count === 2) repo.current.access.identity.clientRevokedAt = now; };
  await assert.rejects(readControlHandoffSummary(readInput, repo.summaryPort));
  repo.onObserve = null;
  repo.current = observation(controller, controllerClient);
  const before = copy(repo.rows);
  repo.failAt = 'summaryReceipt';
  const next = { ...prepareCommand(requestRef), commandId: '88888888-8888-4888-8888-000000000002' };
  await assert.rejects(prepareControlHandoff(next, repo.summaryPort));
  assert.deepEqual(repo.rows, before);
  assert.deepEqual(repo.current.access.control,
    { projectId, ...baseControl, revokedAt: null });
});

test('응답 불명은 자동 재실행하지 않고 원 commandId를 보존하며 명시 replay는 새 요약을 만들지 않는다', async () => {
  const repo = new SourceRepository();
  repo.unknownCommit = true;
  await assert.rejects(requestControl(requestCommand(), repo.requestPort), error => {
    assert.equal((error as {commandId?: string}).commandId, requestCommandId);
    return true;
  });
  assert.equal(repo.transactions, 1);
  assert.equal(repo.rows.requests.size, 1);
  repo.unknownCommit = false;
  const replay = await requestControl(requestCommand(), repo.requestPort);
  assert.equal(repo.rows.requests.size, 1);
  repo.current = observation(controller, controllerClient);
  const first = await prepareControlHandoff(prepareCommand(replay.requestRef), repo.summaryPort);
  const collected = repo.collections;
  const again = await prepareControlHandoff(prepareCommand(replay.requestRef), repo.summaryPort);
  assert.deepEqual(again, first);
  assert.equal(repo.collections, collected);
  assert.equal(repo.rows.summaries.length, 1);
  repo.unknownCommit = true;
  const transactions = repo.transactions;
  const next = { ...prepareCommand(replay.requestRef), commandId: '88888888-8888-4888-8888-000000000003' };
  await assert.rejects(prepareControlHandoff(next, repo.summaryPort), error => {
    assert.equal((error as {commandId?: string}).commandId, next.commandId);
    return true;
  });
  assert.equal(repo.transactions, transactions + 1);
  assert.equal(repo.rows.summaries.length, 2);
});
