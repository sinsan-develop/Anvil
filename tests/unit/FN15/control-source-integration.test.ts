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


/** 실제 SQL을 실행하지 않는 fixed-row 대역. production Repo→검토leaf→receipt/context를 소비한다. */
async function ordinaryDocumentFixture(role='HANDOFF_ELIGIBLE'){
 const {ProjectPolicyRepository}=await import('../../../apps/server/modules/access/project-command.ts'),grant=await import('../../../apps/server/modules/control-handoff/control-grant.ts');
 const uuid=(n:number)=>'aaaaaaaa-aaaa-4aaa-8aaa-'+String(n).padStart(12,'0'),ref=(n:number)=>({id:uuid(n),version:1,contentHash:'a'.repeat(64)}),actor=Object.freeze({actorId:requester,clientId:requesterClient,credentialGeneration:3,serverOwner:false,reauthUntil:null,authSession:Object.freeze({id:uuid(90),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'})});
 const requestRef=ref(1),prior=grant.createControlAcceptanceChain({projectId,command:{schemaVersion:1,operation:'acceptControl',commandId:uuid(2),projectId,clientId:actor.clientId,payload:{requestRef,summaryVersion:1,reason:'앞 수락'}},requestRef,summaryRef:ref(3),before:baseControl,targetActorId:actor.actorId,recordedAt:now,ids:{acceptance:uuid(4),revocation:uuid(5),grant:uuid(6),receipt:uuid(7),audit:uuid(8)}}),control=prior.result.nextControl;
 const form={items:[{itemId:'scope',title:'범위',reviewCriteria:'명확한 범위'}]},formRef={id:uuid(10),version:1,contentHash:contentHash(canonicalJson(form))},targetRef=ref(11),command={schemaVersion:1 as const,projectId,commandId:uuid(12),clientId:actor.clientId,controlGeneration:control.generation,operation:'recordContentReview',targetId:targetRef.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{targetKind:'DOCUMENT',targetRef,criteriaVersion:1,items:[{criterionId:'scope',outcome:'ACCEPTED',evidenceRefs:[],reason:'확인'}],outcome:'ACCEPTED',reason:'실제 문서 검토'}};
 const logs:{sql:string;args:unknown[]}[]=[],contexts:unknown[]=[];let context:Record<string,unknown>|null=null,deny=false,hasGrant=true;
 const db={query:async(sql:string,args:unknown[]=[])=>{logs.push({sql,args});
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:projectId,participation:role,archived_at:null}]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{project_id:projectId,actor_id:actor.actorId,client_id:actor.clientId,generation:control.generation,version:control.version,revoked_at:null}]};
  if(sql.includes('FROM anvil.control_handoffs'))return{rows:hasGrant?[{project_id:projectId,next_generation:control.generation,content_hash:prior.acceptance.ref.contentHash,bundle_json:prior,grant_rows:[prior.grant,prior.revocation],command_rows:[{command:prior.command,result:prior.result,commandHash:grant.controlHash(prior.command),resultHash:grant.controlHash(prior.result)}],receipt_rows:[prior.receipt],audit_rows:[prior.audit],revoked_count:'0'}]:[]};
  if(sql.includes('FROM anvil.permission_policies p JOIN')){const snapshot={rules:[{ruleId:'document',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['saveDocumentDraft','recordContentReview','confirmDocument','proposeDocumentChange'],targetScopes:[{kind:'PROJECT',projectId}],disposition:deny?'DENY':'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'원 명시정책',reviewRefs:[]};return{rows:[{id:uuid(20),head_version:1,rules_json:snapshot.rules,content_hash:grant.controlHash(snapshot),reason:snapshot.reason,review_refs:[],created_at:new Date(now)}]};}
  if(sql.includes('FROM anvil.documents d JOIN'))return{rows:[{head_version:1,content_hash:targetRef.contentHash,form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,definition_json:form,author_ref_json:{kind:'HUMAN',userId:actor.actorId}}]};
  if(sql.includes('transaction_timestamp()')||sql.includes('clock_timestamp()'))return{rows:[{at:new Date(now)}]};
  if(sql.includes("set_config('anvil.fn15_document_context'")){const index=sql.indexOf("set_config('anvil.fn15_document_context'");const parameter=/\$(\d+)/.exec(sql.slice(index));assert.ok(parameter);context=args[Number(parameter[1])-1]?JSON.parse(String(args[Number(parameter[1])-1])):null;contexts.push(context);return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.content_reviews')){if(role==='HANDOFF_ELIGIBLE'){assert.ok(context,'목적 context 없이 문서 쓰기0');assert.equal(context.sessionId,actor.authSession.id);assert.equal(context.credentialGeneration,actor.credentialGeneration);assert.equal(context.purpose,'FN15_ORDINARY_DOCUMENT_WRITE');assert.deepEqual(context.request,command);}return{rows:[],rowCount:1};}
  if(sql.includes('FROM anvil.commands')||sql.startsWith('INSERT INTO anvil.commands')||sql.startsWith('INSERT INTO anvil.authorization_receipts')||sql.startsWith('INSERT INTO anvil.audit_events')||sql.includes('set_config('))return{rows:[],rowCount:1};
  throw Error('UNMODELED_DOCUMENT_SQL');
 }};
 const access={authenticated:async<T>(_token:string,_csrf:string|null,work:(db:never,actor:never)=>Promise<T>)=>work(db as never,actor as never)},repo=new ProjectPolicyRepository(access as never);
 return{repo,db,actor,command,targetRef,logs,contexts,deny(){deny=true;},missingGrant(){hasGrant=false;}};
}

test('HE DOCUMENT는 actual Repo→검토leaf→원 receipt→실session 목적context→문서 INSERT를 연결한다',async()=>{
 const f=await ordinaryDocumentFixture(),{writeDocumentReview}=await import('../../../apps/server/modules/documents/project-content-review.ts');
 const result=await f.repo.command('memory-token','memory-csrf',f.command as never,(db,actor,policy)=>writeDocumentReview(db,actor,f.command as never,policy))as {status:string};assert.equal(result.status,'APPLIED');assert.equal(f.contexts.length,1);assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.content_reviews')).length,1);
});

test('HE의 다형 검토는 DOCUMENT/envelope만 허용하고 다른domain·불일치는 material0, Owner 기존분기는 보존한다',async()=>{
 const f=await ordinaryDocumentFixture();let materials=0;
 for(const targetKind of ['METHODOLOGY','WORK_PLAN','KNOWLEDGE'])await assert.rejects(()=>f.repo.command('memory','csrf',{...f.command,payload:{...f.command.payload,targetKind}}as never,async()=>{materials++;return{};}));
 for(const command of [{...f.command,targetId:projectId},{...f.command,expectedVersion:2},{...f.command,payload:{...f.command.payload,targetRef:{...f.targetRef,contentHash:'bad'}}}])await assert.rejects(()=>f.repo.command('memory','csrf',command as never,async()=>{materials++;return{};}));assert.equal(materials,0);
 const owner=await ordinaryDocumentFixture('OWNER');await owner.repo.command('memory','csrf',{...owner.command,payload:{...owner.command.payload,targetKind:'METHODOLOGY'}}as never,async()=>{materials++;return{};});assert.equal(materials,1);
});


test('문서 목적context는 원요청/actor/session/Tx 변조·중복소비·callback 종료 재사용을 IO 전에 거절한다',async()=>{
 const {persistProjectReceipt}=await import('../../../apps/server/modules/access/project-command.ts');
 for(const mode of ['request','operation','actor','session','db','twice','ended','failed']){
  const f=await ordinaryDocumentFixture();let attempted=0;
  const persist=(db:Parameters<typeof persistProjectReceipt>[0],actor:Parameters<typeof persistProjectReceipt>[1],request:Parameters<typeof persistProjectReceipt>[2])=>persistProjectReceipt(db,actor,request,f.targetRef,{},null,'MEMORY_TEST');
  if(mode==='ended'||mode==='failed'){
   if(mode==='failed')await assert.rejects(f.repo.command('memory','csrf',f.command as never,async()=>{throw Error('MATERIAL_FAILED');}));
   else await f.repo.command('memory','csrf',f.command as never,async()=>({}));
   const before=f.logs.length;await assert.rejects(persist(f.db as never,f.actor as never,f.command as never),/DOCUMENT_CONTEXT_INVALID/);assert.equal(f.logs.length,before);continue;
  }
  await assert.rejects(f.repo.command('memory','csrf',f.command as never,async(db,actor)=>{
   if(mode==='twice'){await persist(db,actor,f.command as never);const before=f.logs.length;try{await persist(db,actor,f.command as never);}finally{assert.equal(f.logs.length,before);}return{};}
   const request=mode==='request'?{...f.command,payload:{...f.command.payload,reason:'변조'}}:mode==='operation'?{...f.command,operation:'indexDesignDocument'}:f.command;
   const suppliedActor=mode==='actor'?{...actor}:mode==='session'?{...actor,authSession:{...actor.authSession!}}:actor;
   const suppliedDb=mode==='db'?{query:async()=>{attempted++;throw Error('CROSS_DB_IO');}}:db;
   const before=f.logs.length;try{await persist(suppliedDb as never,suppliedActor as never,request as never);}finally{assert.equal(f.logs.length,before);}
   return{};
  }),/DOCUMENT_CONTEXT_INVALID/);
  assert.equal(attempted,0);assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.commands')).length,mode==='twice'?1:0);
 }
});

test('HE 문서의 누락물리grant/명시DENY는 material0이며 Owner 검토는 기존 세GUC와 원 INSERT를 유지한다',async()=>{
 for(const mode of ['grant','deny']){const f=await ordinaryDocumentFixture();if(mode==='grant')f.missingGrant();else f.deny();let calls=0;await assert.rejects(f.repo.command('memory','csrf',f.command as never,async()=>{calls++;return{};}));assert.equal(calls,0);assert.equal(f.contexts.length,0);}
 const f=await ordinaryDocumentFixture('OWNER'),{writeDocumentReview}=await import('../../../apps/server/modules/documents/project-content-review.ts');await f.repo.command('memory','csrf',f.command as never,(db,actor,policy)=>writeDocumentReview(db,actor,f.command as never,policy));assert.equal(f.contexts.length,0);assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.content_reviews')).length,1);assert.ok(f.logs.some(x=>x.sql.includes("set_config('anvil.command_id'")&&!x.sql.includes('anvil.fn15_document_context')));
});
