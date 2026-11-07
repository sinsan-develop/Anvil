import {resolve} from 'node:path';
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
 const logs:{sql:string;args:unknown[]}[]=[],contexts:unknown[]=[];let context:Record<string,unknown>|null=null,deny=false,hasGrant=true,grantRevoked=false;
 let extra:((sql:string,args:unknown[])=>{rows:any[];rowCount?:number}|undefined)|null=null;
 const db={query:async(sql:string,args:unknown[]=[])=>{logs.push({sql,args});
  const modeled=extra?.(sql,args);if(modeled!==undefined)return modeled;
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:projectId,participation:role,archived_at:null}]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{project_id:projectId,actor_id:actor.actorId,client_id:actor.clientId,generation:control.generation,version:control.version,revoked_at:null}]};
  if(sql.includes('FROM anvil.control_handoffs'))return{rows:hasGrant?[{project_id:projectId,next_generation:control.generation,content_hash:prior.acceptance.ref.contentHash,bundle_json:prior,grant_rows:[prior.grant,prior.revocation],command_rows:[{command:prior.command,result:prior.result,commandHash:grant.controlHash(prior.command),resultHash:grant.controlHash(prior.result)}],receipt_rows:[prior.receipt],audit_rows:[prior.audit],revoked_count:grantRevoked?'1':'0'}]:[]};
  if(sql.includes('FROM anvil.permission_policies p JOIN')){const snapshot={rules:[{ruleId:'document',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['saveDocumentDraft','recordContentReview','confirmDocument','proposeDocumentChange','importDocument'],targetScopes:[{kind:'PROJECT',projectId}],disposition:deny?'DENY':'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'원 명시정책',reviewRefs:[]};return{rows:[{id:uuid(20),head_version:1,rules_json:snapshot.rules,content_hash:grant.controlHash(snapshot),reason:snapshot.reason,review_refs:[],created_at:new Date(now)}]};}
  if(sql.includes('FROM anvil.documents d JOIN'))return{rows:[{head_version:1,content_hash:targetRef.contentHash,form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,definition_json:form,author_ref_json:{kind:'HUMAN',userId:actor.actorId}}]};
  if(sql.includes('transaction_timestamp()')||sql.includes('clock_timestamp()'))return{rows:[{at:new Date(now)}]};
  if(sql.includes("set_config('anvil.fn15_document_context'")){const index=sql.indexOf("set_config('anvil.fn15_document_context'");const parameter=/\$(\d+)/.exec(sql.slice(index));assert.ok(parameter);context=args[Number(parameter[1])-1]?JSON.parse(String(args[Number(parameter[1])-1])):null;contexts.push(context);return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.content_reviews')){if(role==='HANDOFF_ELIGIBLE'){assert.ok(context,'목적 context 없이 문서 쓰기0');assert.equal(context.sessionId,actor.authSession.id);assert.equal(context.credentialGeneration,actor.credentialGeneration);assert.equal(context.purpose,'FN15_ORDINARY_DOCUMENT_WRITE');assert.deepEqual(context.request,command);}return{rows:[],rowCount:1};}
  if(sql.includes('FROM anvil.commands')||sql.startsWith('INSERT INTO anvil.commands')||sql.startsWith('INSERT INTO anvil.authorization_receipts')||sql.startsWith('INSERT INTO anvil.audit_events')||sql.includes('set_config('))return{rows:[],rowCount:1};
  throw Error('UNMODELED_DOCUMENT_SQL');
 }};
 const access={authenticated:async<T>(_token:string,_csrf:string|null,work:(db:never,actor:never)=>Promise<T>)=>work(db as never,actor as never)},repo=new ProjectPolicyRepository(access as never);
 return{repo,db,actor,command,targetRef,logs,contexts,setQuery(value:typeof extra){extra=value;},deny(){deny=true;},missingGrant(){hasGrant=false;},revokeGrant(){grantRevoked=true;}};
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


async function importSelectionFixture(role='HANDOFF_ELIGIBLE',mediaType='text/plain;charset=utf-8',bytes=Buffer.from('원문\r\n그대로')){
 const f=await ordinaryDocumentFixture(role),{ProjectDocuments}=await import('../../../apps/server/modules/documents/project-documents.ts'),{ArtifactStore}=await import('../../../apps/server/storage/artifact-store.ts');
 const id=(n:number)=>'bbbbbbbb-bbbb-4bbb-8bbb-'+String(n).padStart(12,'0'),file={artifactId:id(1),bytes:bytes.length,contentHash:contentHash(bytes),mediaType},definition={items:[{itemId:'body',title:'본문',required:true}]},form={id:id(2),version:1,contentHash:contentHash(canonicalJson(definition))};
 class MemoryStore extends ArtifactStore{reads=0;constructor(){super(resolve('MEMORY_ONLY_NOT_CREATED'));}override async read(pid:string,aid:string,expected:{bytes:number;contentHash:string}){this.reads++;assert.equal(pid,projectId);assert.equal(aid,file.artifactId);assert.equal(expected.bytes,bytes.length);assert.equal(expected.contentHash,contentHash(bytes));return Buffer.from(bytes);}}
 const store=new MemoryStore(),documents=new ProjectDocuments(undefined,store);let candidate:any=null,receipt:any=null;
 f.setQuery((sql,args)=>{
  if(sql.includes('FROM anvil.artifacts WHERE'))return{rows:args[0]===file.artifactId&&args[1]===projectId&&args[2]===file.contentHash&&args[3]===file.bytes&&args[4]===file.mediaType?[{id:file.artifactId,project_id:projectId,state:'READY',storage_key:`blobs/${projectId}/${file.artifactId}`,inspection_json:null}]:[]};
  if(sql.includes('FROM anvil.form_definitions d JOIN'))return{rows:args[0]===form.id&&args[1]===form.version?[{definition_json:definition,content_hash:form.contentHash}]:[]};
  if(sql.startsWith('INSERT INTO anvil.commands')){receipt=JSON.parse(String(args[14]));return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.document_imports')){if(role==='HANDOFF_ELIGIBLE'){assert.equal(f.contexts.length,1,'actual import INSERT에는 원session private context가 있어야 한다');assert.deepEqual((f.contexts[0]as any).request,f.command);}candidate=JSON.parse(String(args[6]));assert.deepEqual(candidate,receipt.data.candidate);assert.equal(args[7],contentHash(canonicalJson(candidate)));return{rows:[],rowCount:1};}
  if(sql.startsWith('SELECT candidate_json,content_hash,created_at FROM anvil.document_imports'))return{rows:candidate&&args[0]===projectId&&args[1]===candidate.id?[{candidate_json:candidate,content_hash:contentHash(canonicalJson(candidate)),created_at:new Date(now)}]:[]};
  if(sql.startsWith('SELECT document_id,version,created_at,created_by FROM anvil.document_import_selections'))return{rows:[]};
  if(sql.startsWith('INSERT INTO anvil.document_import_selections')){assert.equal(args[1],projectId);assert.equal(args[2],candidate.id);assert.equal(args[3],receipt.targetId);assert.equal(args[4],receipt.version);assert.equal(receipt.data.importCandidateRef,candidate.id);if(role==='HANDOFF_ELIGIBLE'){assert.equal(f.contexts.length,2);assert.deepEqual((f.contexts[1]as any).request,f.command);}return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.documents')||sql.startsWith('INSERT INTO anvil.document_versions')||sql.startsWith('INSERT INTO anvil.document_artifact_links')||sql.startsWith('INSERT INTO anvil.document_version_events'))return{rows:[],rowCount:1};
  return undefined;
 });
 Object.assign(f.command,{operation:'importDocument',targetId:null,expectedVersion:0,payload:{fileRef:file,intendedFormRef:form,sourceRefs:[]}});
 const imported=()=>f.repo.command('memory','csrf',f.command as never,(db,actor,policy)=>documents.import(db,actor,f.command as never,policy));
 const select=()=>{Object.assign(f.command,{commandId:id(4),operation:'saveDocumentDraft',payload:{title:'원문 선택',formRef:form,stageNodeRef:null,content:{body:file,attachments:[],sections:[{itemId:'body',anchor:'line:1'}],sourceRefs:[]},importCandidateRef:candidate.id,reason:'명시 선택'}});return f.repo.command('memory','csrf',f.command as never,(db,actor,policy)=>documents.save(db,actor,f.command as never,policy));};
 return{...f,file,form,store,documents,imported,select,candidate:()=>candidate,editCandidate:(edit:(value:any)=>void)=>edit(candidate)};
}

test('import 연결: actual Repo→ProjectDocuments/Artifact reader→원 후보 receipt/context→명시 READY 선택 INSERT',async()=>{
 const f=await importSelectionFixture(),r:any=await f.imported();assert.equal(r.data.candidate.status,'READY');assert.deepEqual(r.data.candidate.originalRef,f.file);assert.equal(f.store.reads,1);const selected:any=await f.select();assert.equal(selected.data.status,'DRAFT');assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_imports')).length,1);assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_import_selections')).length,1);assert.equal(f.contexts.length,2);
});


test('import 연결: FAILED/UNSUPPORTED 원후보는 보존하고 선택은 READY만, Owner는 기존 context0을 유지한다',async()=>{
 for(const [media,bytes,status]of [['application/pdf',Buffer.from('미지원 원본'),'UNSUPPORTED'],['text/plain;charset=utf-8',Buffer.from([0xff]),'FAILED']]as const){const f=await importSelectionFixture('HANDOFF_ELIGIBLE',media,bytes),r:any=await f.imported();assert.equal(r.data.candidate.status,status);assert.equal(r.data.candidate.extractedContentRef,null);assert.deepEqual(r.data.candidate.originalRef,f.file);assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_imports')).length,1);await assert.rejects(f.select());assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_import_selections')).length,0);}
 for(const status of ['FAILED','UNSUPPORTED']){const f=await importSelectionFixture();await f.imported();f.editCandidate(c=>{c.status=status;c.extractedContentRef=null;});await assert.rejects(f.select(),/IMPORT_NOT_READY/);assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_import_selections')).length,0);}
 const owner=await importSelectionFixture('OWNER');await owner.imported();await owner.select();assert.equal(owner.contexts.length,0);assert.equal(owner.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_import_selections')).length,1);
});

test('import 연결: 다른project/file/hash/form·원Artifact 누락/선택혼용·DENY/회수grant는 후보/선택 쓰기0',async()=>{
 for(const mode of ['project','file','hash','bytes','form','source','target','version','deny','grant','revoked','client','generation']){
  const f=await importSelectionFixture();if(mode==='deny')f.deny();else if(mode==='grant')f.missingGrant();else if(mode==='revoked')f.revokeGrant();else if(mode==='client')Object.assign(f.command,{clientId:requestId});else if(mode==='generation')f.command.controlGeneration--;else if(mode==='project')f.command.projectId=requestId;else if(mode==='target')f.command.targetId=requestId;else if(mode==='version')f.command.expectedVersion=1;else{const p=f.command.payload as any;if(mode==='file')p.fileRef={...p.fileRef,artifactId:requestId};if(mode==='hash')p.fileRef={...p.fileRef,contentHash:'f'.repeat(64)};if(mode==='bytes')p.fileRef={...p.fileRef,bytes:p.fileRef.bytes+1};if(mode==='form')p.intendedFormRef={...p.intendedFormRef,contentHash:'f'.repeat(64)};if(mode==='source')p.sourceRefs=[{}];}
  await assert.rejects(f.imported(),mode);assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_imports')).length,0,mode);
 }
 for(const mode of ['form','original','missing']){const f=await importSelectionFixture();await f.imported();f.editCandidate(c=>{if(mode==='form')c.intendedFormRef={...c.intendedFormRef,contentHash:'f'.repeat(64)};else if(mode==='original')c.originalRef={...c.originalRef,mediaType:'text/markdown;charset=utf-8'};else c.originalRef={...c.originalRef,artifactId:requestId};});await assert.rejects(f.select());assert.equal(f.logs.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_import_selections')).length,0,mode);}
});

test('import 연결: private context는 다른DB/session·원request변조·중복·종료후 재사용을 목적IO전에 거절한다',async()=>{
 const {persistProjectReceipt}=await import('../../../apps/server/modules/access/project-command.ts');
 for(const mode of ['request','actor','session','db','twice','ended','failed']){const f=await importSelectionFixture();const persist=(db:Parameters<typeof persistProjectReceipt>[0],actor:Parameters<typeof persistProjectReceipt>[1],request:Parameters<typeof persistProjectReceipt>[2])=>persistProjectReceipt(db,actor,request,f.file,{},null,'MEMORY_IMPORT');
  if(mode==='ended'||mode==='failed'){if(mode==='failed')await assert.rejects(f.repo.command('memory','csrf',f.command as never,async()=>{throw Error('MATERIAL_FAILED');}));else await f.repo.command('memory','csrf',f.command as never,async()=>({}));const before=f.logs.length;await assert.rejects(persist(f.db as never,f.actor as never,f.command as never),/DOCUMENT_CONTEXT_INVALID/);assert.equal(f.logs.length,before);continue;}
  await assert.rejects(f.repo.command('memory','csrf',f.command as never,async(db,actor)=>{if(mode==='twice'){await persist(db,actor,f.command as never);const before=f.logs.length;try{await persist(db,actor,f.command as never);}finally{assert.equal(f.logs.length,before);}return{};}const request=mode==='request'?{...f.command,payload:{...f.command.payload,sourceRefs:[{}]}}:f.command,suppliedActor=mode==='actor'?{...actor}:mode==='session'?{...actor,authSession:{...actor.authSession!}}:actor,suppliedDb=mode==='db'?{query:async()=>{throw Error('CROSS_DB_IO0');}}:db;const before=f.logs.length;try{await persist(suppliedDb as never,suppliedActor as never,request as never);}finally{assert.equal(f.logs.length,before);}return{};}),/DOCUMENT_CONTEXT_INVALID/);
 }
});


/** 인증/DB/파일만 메모리이며 실제 upload handler·Repo·승인·quota를 소비한다. */
async function uploadApprovalFixture(t:import('node:test').TestContext,requireApproval=true){
 const f=await ordinaryDocumentFixture(),{AccessRepository,AuthFailure}=await import('../../../apps/server/modules/access/repository.ts'),{ProjectPolicyRepository}=await import('../../../apps/server/modules/access/project-command.ts'),{ProjectApprovals}=await import('../../../apps/server/modules/approvals/project-approvals.ts'),{ArtifactStore}=await import('../../../apps/server/storage/artifact-store.ts'),{registerProjectFileRoutes}=await import('../../../apps/server/modules/documents/project-files.ts'),{default:Fastify}=await import('fastify');
 type Row=Record<string,any>;const id=(n:number)=>'cccccccc-cccc-4ccc-8ccc-'+String(n).padStart(12,'0'),h=(v:unknown)=>contentHash(canonicalJson(v));
 const rules=[{ruleId:'upload',subjectRef:{kind:'HUMAN',userId:f.actor.actorId},operations:['uploadArtifact'],targetScopes:[{kind:'PROJECT',projectId}],disposition:requireApproval?'REQUIRE_APPROVAL':'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'},{ruleId:'approval',subjectRef:{kind:'HUMAN',userId:f.actor.actorId},operations:['requestApproval','decideApproval'],targetScopes:[{kind:'PROJECT',projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],policy={rules,reason:'유효 명시정책 모델',reviewRefs:[]},policyRef={id:id(1),version:1,contentHash:h(policy)};
 let state:{commands:Row[];receipts:Row[];audits:Row[];requests:Row[];decisions:Row[];consumptions:Row[];artifacts:Row[];reservations:Row[];account:Row}={commands:[],receipts:[],audits:[],requests:[],decisions:[],consumptions:[],artifacts:[],reservations:[],account:{coverage_state:'VERIFIED',generation:'1',used_bytes:'0',held_bytes:'0'}};
 const bodies=new Map<string,Buffer>();let puts=0,reads=0,verifies=0,failAt='',loseCommit=false;const trace:string[]=[];const errors:unknown[]=[];
 class MemoryAccess extends AccessRepository{constructor(){super({}as never,{installationId:id(2),key:Buffer.alloc(32)});}override async authenticated<T>(_token:string,_csrf:string|null,work:(db:import('pg').PoolClient,actor:import('../../../apps/server/modules/access/repository.ts').AuthenticatedIdentity)=>Promise<T>){const before=structuredClone(state);trace.push('BEGIN');let committed=false;try{const v=await work(f.db as never,f.actor);trace.push('COMMIT');committed=true;if(loseCommit){loseCommit=false;throw Error('COMMIT_REPLY_LOST');}return v;}catch(e){errors.push(e);if(!committed)state=before;trace.push('ROLLBACK');throw e;}}}
 const access=new MemoryAccess(),repo=new ProjectPolicyRepository(access),approvals=new ProjectApprovals();
 const commandRow=(id:unknown)=>state.commands.find(c=>c.id===id);
 f.setQuery((sql,args)=>{trace.push(sql);
  if(sql.includes('FROM anvil.permission_policies p JOIN'))return{rows:[{id:policyRef.id,head_version:1,rules_json:rules,content_hash:policyRef.contentHash,reason:policy.reason,review_refs:[],created_at:new Date(now)}]};
  if(sql.startsWith('SELECT anvil.assert_approval_notification_capacity(')||sql.startsWith('INSERT INTO anvil.notifications'))return{rows:[],rowCount:1};
  if(sql.startsWith('SELECT action_scope_json,created_by,client_id,request_json'))return{rows:state.requests.filter(r=>r.project_id===args[0]&&r.id===args[1])};
  if(sql.startsWith('SELECT 1 FROM anvil.approval_requests'))return{rows:state.requests.filter(r=>r.project_id===args[0]&&r.candidate_command_id===args[1]),rowCount:state.requests.filter(r=>r.project_id===args[0]&&r.candidate_command_id===args[1]).length};
  if(sql.startsWith('SELECT 1 FROM anvil.commands'))return{rows:[],rowCount:0};
  if(sql.startsWith('INSERT INTO anvil.approval_requests')){const context=f.contexts.at(-1)as any;assert.equal(context?.request.operation,'requestApproval','요청 실제session context 누락');state.requests.push({id:args[0],project_id:args[1],version:1,candidate_command_id:args[2],action_scope_json:JSON.parse(String(args[3])),scope_digest:args[4],details_json:JSON.parse(String(args[5])),required_decider_ref:JSON.parse(String(args[6])),status:'PENDING',expires_at:new Date(String(args[7])),created_by:args[8],client_id:args[9],command_id:args[10],policy_ref:JSON.parse(String(args[11])),content_hash:args[12],request_json:JSON.parse(String(args[13])),created_at:new Date(String(args[14]))});return{rows:[],rowCount:1};}
  if(sql.includes('FROM anvil.approval_requests r JOIN anvil.commands'))return{rows:state.requests.filter(r=>r.project_id===args[0]&&r.id===args[1]).map(r=>{const c=commandRow(r.command_id)!;return{...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,result_ref:c.result_ref};})};
  if(sql.includes('FROM anvil.approval_decisions d JOIN anvil.commands'))return{rows:state.decisions.filter(r=>r.project_id===args[0]&&r.request_id===args[1]).map(r=>{const c=commandRow(r.command_id)!;return{...r,operation:c.operation,actor_id:c.actor_id,command_client:c.client_id,expected_version:c.expected_version,result_ref:c.result_ref};})};
  if(sql.includes('FROM anvil.approval_consumptions ac JOIN anvil.commands'))return{rows:state.consumptions.filter(r=>r.project_id===args[0]&&r.decision_id===args[1]).map(r=>{const c=commandRow(r.command_id)!,a=state.receipts.find(a=>a.id===c.authorization_receipt_id)!;return{...r,candidate_command_id:c.command_id,request_hash:c.request_hash,actor_id:c.actor_id,client_id:c.client_id,control_generation:c.control_generation,policy_ref:c.policy_ref,payload_ref:c.payload_ref,state:c.state,result_ref:c.result_ref,operation:c.operation,expected_version:c.expected_version,approval_consumption_id:c.approval_consumption_id,approval_decision_ref:a.approval_decision_ref};})};
  if(sql.startsWith('INSERT INTO anvil.approval_decisions')){assert.equal((f.contexts.at(-1)as any)?.request.operation,'decideApproval','결정 실제session context 누락');state.decisions.push({id:args[0],project_id:args[1],request_id:args[2],request_version:args[3],scope_digest:args[4],decision:args[5],reason:args[6],decided_by:args[7],client_id:args[8],control_generation:args[9],decided_at:new Date(String(args[10])),command_id:args[11],content_hash:args[12],decision_json:JSON.parse(String(args[13]))});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.approval_consumptions')){if(failAt==='consume')throw Error('CONSUME_REPLY_UNKNOWN');assert.equal((f.contexts.at(-1)as any)?.request.operation,'uploadArtifact');assert(!state.consumptions.some(r=>r.decision_id===args[2]));state.consumptions.push({id:args[0],project_id:args[1],decision_id:args[2],command_id:args[3],scope_digest:args[4],policy_id:args[5],policy_version:args[6],consumed_at:new Date(now)});return{rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE anvil.approval_requests SET status=')){const r=state.requests.find(r=>r.project_id===args[0]&&r.id===args[1]);if(!r)return{rows:[],rowCount:0};if(sql.includes("status='CONSUMED'")){if(r.status!=='APPROVED'||r.version!==2)return{rows:[],rowCount:0};r.status='CONSUMED';r.version=3;}else{if(r.status!=='PENDING'||r.version!==args[3])return{rows:[],rowCount:0};r.status=args[2];r.version++;}return{rows:[],rowCount:1};}
  if(sql.includes('FROM anvil.commands WHERE scope_kind'))return{rows:state.commands.filter(c=>c.project_id===args[0]&&c.actor_id===args[1]&&c.command_id===args[2])};
  if(sql.startsWith('INSERT INTO anvil.commands')){if(failAt==='receipt')throw Error('RECEIPT_UNKNOWN');state.commands.push({id:args[0],project_id:args[1],actor_id:args[2],client_id:args[3],operation:args[4],command_id:args[5],request_hash:args[6],operation_id:args[7],state:'APPLIED',authorization_receipt_id:args[8],approval_consumption_id:args[9],expected_version:args[10],control_generation:args[11],policy_ref:JSON.parse(String(args[12])),payload_ref:args[13]===null?null:JSON.parse(String(args[13])),result_ref:JSON.parse(String(args[14]))});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){state.receipts.push({id:args[0],project_id:args[1],command_id:args[2],subject_ref:JSON.parse(String(args[3])),policy_ref:JSON.parse(String(args[4])),scope_digest:args[5],approval_decision_ref:args[6]});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.audit_events')){state.audits.push({command_id:args[4],scope_digest:args[10]});return{rows:[],rowCount:1};}
  if(sql.includes('quota_existing')){const q=JSON.parse(String(args[4])),rows=state.reservations.filter(r=>r.external_command_id===q.commandId);if(!rows.length)return{rows:[{value:null}]};const r=rows[0];assert(r);assert.equal(r.command_hash,h(q));if(r.phase==='SETTLED'){assert(commandRow(r.server_command_id));return{rows:[{value:{replay:true}}]};}if(r.phase!=='RESERVED')throw new AuthFailure('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);return{rows:[{value:structuredClone(r.plan_json)}]};}
  if(sql.includes('quota_account'))return{rows:[structuredClone(state.account)]};
  if(sql.includes('quota_reserve')){const p=JSON.parse(String(args[4])),rows=p.parts.map((x:any,i:number)=>({id:id(100+i),project_id:p.request.projectId,actor_id:f.actor.actorId,client_id:f.actor.clientId,external_command_id:p.request.commandId,operation:p.request.operation,command_hash:p.commandHash,part_key:x.key,part_kind:x.kind,plan_json:p,plan_hash:p.planHash,reserved_bytes:x.reservedBytes,settled_bytes:'0',phase:'RESERVED',start_fence:'0',generation:'1',authorized_until:p.authorizedUntil}));state.reservations.push(...rows);state.account.held_bytes=rows.reduce((v:bigint,r:Row)=>v+BigInt(r.reserved_bytes),0n).toString();return{rows:[{value:structuredClone(rows)}]};}
  if(sql.includes('quota_start')){for(const r of state.reservations){r.phase='IO_STARTED';r.start_fence='1';}return{rows:[{value:structuredClone(state.reservations)}]};}
  if(sql.includes('quota_require_started')){assert(state.reservations.every(r=>r.phase==='IO_STARTED'&&r.start_fence==='1'));return{rows:[{value:true}]};}
  if(sql.startsWith('INSERT INTO anvil.artifacts')){assert.equal((f.contexts.at(-1)as any)?.request.operation,'uploadArtifact','실제 업로드callback context 누락');state.artifacts.push({id:args[0],project_id:args[1],bytes:args[2],content_hash:args[3],media_type:args[4],storage_key:args[5],state:args[6],created_by:args[7],client_id:args[8],command_id:args[9],inspection_json:JSON.parse(String(args[10]))});return{rows:[],rowCount:1};}
  if(sql.startsWith('SELECT * FROM anvil.artifacts WHERE'))return{rows:state.artifacts.filter(r=>r.id===args[0]&&r.project_id===args[1]&&r.content_hash===args[2]&&r.bytes===args[3]&&r.media_type===args[4])};
  if(sql.includes('quota_settle')){if(failAt==='settle')throw Error('SETTLE_UNKNOWN');const p=JSON.parse(String(args[4])),c=commandRow(p.facts.serverCommandId),ar=state.receipts.find(a=>a.id===p.facts.authorizationReceiptId);assert(c&&ar&&state.artifacts.some(a=>a.command_id===c.id));assert.equal(ar.scope_digest,p.facts.scopeDigest);for(const r of state.reservations){assert.equal(r.command_hash,c.request_hash);r.phase='SETTLED';r.settled_bytes=r.plan_json.parts[0].settledBytes;r.server_command_id=c.id;}state.account.used_bytes=state.reservations.reduce((n:bigint,r:Row)=>n+BigInt(r.settled_bytes),0n).toString();state.account.held_bytes='0';if(failAt==='commit')loseCommit=true;return{rows:[{value:true}]};}
  return undefined;
 });
 t.mock.method(ArtifactStore.prototype,'put',async(pid:string,aid:string,bytes:Buffer)=>{puts++;trace.push('MEMORY_PUT');bodies.set(aid,Buffer.from(bytes));if(failAt==='put')throw Error('PUT_REPLY_LOST');return`blobs/${pid}/${aid}`;});
 t.mock.method(ArtifactStore.prototype,'read',async(_pid:string,aid:string,expected:{bytes:number;contentHash:string})=>{reads++;const b=bodies.get(aid);assert(b);assert.equal(b.length,expected.bytes);assert.equal(contentHash(b),expected.contentHash);return Buffer.from(b);});
 t.mock.method(ArtifactStore.prototype,'verifyPublished',async(_pid:string,aid:string,expected:{bytes:number;contentHash:string})=>{verifies++;const b=bodies.get(aid);assert(b);assert.equal(b.length,expected.bytes);assert.equal(contentHash(b),expected.contentHash);if(failAt==='verify')throw Error('VERIFY_UNKNOWN');});
 const app=Fastify();registerProjectFileRoutes(app,{repository:access,origin:'https://upload.synthetic.invalid',artifactRoot:resolve('MEMORY_UPLOAD_NOT_CREATED')});await app.ready();t.after(()=>app.close());
 const bytes=Buffer.from('원본 파일 그대로'),command={...f.command,commandId:id(10),operation:'uploadArtifact',targetId:null,expectedVersion:0,payload:{bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain;charset=utf-8'}};
 const upload=(q:unknown=command,body=bytes)=>app.inject({method:'POST',url:`/api/v1/projects/${projectId}/files`,headers:{host:'upload.synthetic.invalid',origin:'https://upload.synthetic.invalid','content-type':'application/octet-stream','x-anvil-command':canonicalJson(q),'x-anvil-csrf':'c'.repeat(43),cookie:'__Host-anvil.sid='+'t'.repeat(43)},payload:body});
 const approve=async(choice:'APPROVE'|'REJECT'|'REQUEST_CHANGE'='APPROVE')=>{const scope={operation:'uploadArtifact',targetRef:null,expectedVersion:0,payloadHash:h(command.payload),baselineRefs:[],environmentRef:null,sourceScopes:[],limitsRef:null,requestedSubjectRef:{kind:'HUMAN',userId:f.actor.actorId,clientId:f.actor.clientId},controlGeneration:command.controlGeneration},details={candidateCommandId:command.commandId,reason:'파일 한 건 승인',risks:{data:'원문',security:'검사',cost:'한도',interruption:'중단',unverified:'실DB 미검증'},rollback:{method:'보존',limitations:'자동삭제0',evidenceRefs:[]},expiresAt:'2098-01-01T00:00:00.000Z',actionScope:scope},request={...command,operation:'requestApproval',commandId:id(11),payload:{details}};
 const requested:any=await repo.command('memory','csrf',request as never,(db,a,p)=>approvals.request(db,a,request as never,p)),decision={...command,commandId:id(12),operation:'decideApproval',targetId:requested.targetId,expectedVersion:1,payload:{requestId:requested.targetId,expectedVersion:1,scopeDigest:h(scope),decision:choice,reason:'별도 명시 승인'}};
 const decided:any=await repo.command('memory','csrf',decision as never,(db,a,p)=>approvals.decide(db,a,decision as never,p));return{requestId:requested.targetId,decisionId:decided.targetId,scopeDigest:h(scope)};};
 return{...f,access,repo,approvals,app,command,upload,approve,bytes,trace,errors,state:()=>state,files:()=>({puts,reads,verifies}),fail(value:string){failAt=value;},policyDeny(){rules[0]!.disposition='DENY';policyRef.contentHash=h(policy);},expire(){rules[0]!.expiresAt='2020-01-01T00:00:00.000Z';policyRef.contentHash=h(policy);},bodies};
}

test('upload 승인 연결: actual upload callback은 원session 목적context와 quota/receipt를 소비한다',async t=>{
 const f=await uploadApprovalFixture(t,false),r=await f.upload();assert.equal(r.statusCode,201,r.body+':'+f.errors.map(e=>String(e)).join('|'));assert.equal(r.json().data.status,'ARTIFACT_READY');assert.equal(f.files().puts,1);assert.equal(f.contexts.length,1);assert.equal(f.state().reservations[0]!.phase,'SETTLED');
});


test('upload 승인 연결: actual request→decision→원 upload 소비/정산→명시 replay는 원본검사 후 반환하고 재게시0이다',async t=>{
 const f=await uploadApprovalFixture(t),approval=await f.approve();f.command.approvalRef=approval as never;const first=await f.upload();assert.equal(first.statusCode,201,first.body+':'+f.errors.map(String).join('|'));assert.equal(f.state().requests[0]!.status,'CONSUMED');assert.equal(f.state().requests[0]!.version,3);assert.equal(f.state().consumptions.length,1);assert.equal(f.files().puts,1);const before=f.files(),again=await f.upload();assert.equal(again.statusCode,201,again.body);assert.deepEqual(again.json(),first.json());assert.equal(f.files().puts,1);assert(f.files().reads>before.reads);assert.equal(f.state().consumptions.length,1);assert.equal(f.state().account.held_bytes,'0');assert.equal(f.state().account.used_bytes,String(f.bytes.length));assert.deepEqual(f.contexts.map((c:any)=>c.request.operation),['requestApproval','decideApproval','uploadArtifact']);
});


test('upload 승인 연결: 거절/만료/DENY·구세대/client·회수grant·다른후보/bytes/hash/mediaType는 게시0이다',async t=>{
 for(const mode of ['reject','expired','deny','generation','client','revoked','candidate','bytes','hash','media']){const f=await uploadApprovalFixture(t),ref=await f.approve(mode==='reject'?'REJECT':'APPROVE');f.command.approvalRef=ref as never;let q:any=f.command,body=f.bytes;
  if(mode==='expired')f.expire();if(mode==='deny')f.policyDeny();if(mode==='revoked')f.revokeGrant();if(mode==='generation')q={...q,controlGeneration:q.controlGeneration-1};if(mode==='client')q={...q,clientId:requester};if(mode==='candidate')q={...q,commandId:requestId};if(mode==='bytes'){body=Buffer.from('다른 원본');q={...q,payload:{...q.payload,bytes:body.length,contentHash:contentHash(body)}};}if(mode==='hash')q={...q,payload:{...q.payload,contentHash:'f'.repeat(64)}};if(mode==='media')q={...q,payload:{...q.payload,mediaType:'text/markdown;charset=utf-8'}};
  const r=await f.upload(q,body);assert.notEqual(r.statusCode,201,mode);assert.equal(f.files().puts,0,mode);assert.equal(f.state().consumptions.length,0,mode);
 }
});

test('upload 승인 연결: START뒤 단계불명은 원command/예약을 보존하고 자동재게시하지 않는다',async t=>{
 for(const mode of ['put','verify','receipt','consume','settle','commit']){const f=await uploadApprovalFixture(t),ref=await f.approve();f.command.approvalRef=ref as never;const original=canonicalJson(f.command);f.fail(mode);const r=await f.upload();assert.equal(r.statusCode,503,mode+':'+r.body);assert.equal(f.files().puts,1,mode);assert.equal(canonicalJson(f.command),original);assert.equal(f.state().reservations.length,1);if(mode==='commit'){assert.equal(f.state().reservations[0]!.phase,'SETTLED');assert.equal(f.state().consumptions.length,1);}else{assert.equal(f.state().reservations[0]!.phase,'IO_STARTED');assert(BigInt(f.state().account.held_bytes)>0n);assert.equal(f.state().consumptions.length,0);} }
});

test('upload 승인 연결: replay는 storageKey/원bytes/inspection 변조를 성공으로 숨기지 않고 put/consume를 늘리지 않는다',async t=>{
 for(const mode of ['key','bytes','inspection']){const f=await uploadApprovalFixture(t),ref=await f.approve();f.command.approvalRef=ref as never;assert.equal((await f.upload()).statusCode,201);const artifact=f.state().artifacts[0]!;if(mode==='key')artifact.storage_key+='-변조';if(mode==='bytes')f.bodies.set(artifact.id,Buffer.from('변조'));if(mode==='inspection')artifact.inspection_json={...artifact.inspection_json,complete:true};const r=await f.upload();assert.notEqual(r.statusCode,201,mode);assert.equal(f.files().puts,1);assert.equal(f.state().consumptions.length,1);}
});

test('upload 승인 연결: 원auth wrapper의 Proxy/getter·다른op·다른DB/actor/session·원문변조/종료·중복은 거절한다',async t=>{
 const {persistProjectReceipt,currentGeneralProjectController}=await import('../../../apps/server/modules/access/project-command.ts');
 for(const mode of ['proxy','getter','operation','request','db','actor','session','twice','ended']){const f=await uploadApprovalFixture(t,false);let reads=0;const metadata={artifactId:requestId,...f.command.payload}as {artifactId:string;bytes:number;contentHash:string;mediaType:string};const persist=(db:Parameters<typeof persistProjectReceipt>[0],actor:Parameters<typeof persistProjectReceipt>[1],request:Parameters<typeof persistProjectReceipt>[2])=>persistProjectReceipt(db,actor,request,metadata,{},null,'MEMORY_UPLOAD');
  if(['proxy','getter','operation'].includes(mode)){const raw=mode==='proxy'?new Proxy(f.command,{get(){reads++;throw Error('GET0');}}):mode==='getter'?Object.defineProperty({...f.command},'operation',{get(){reads++;return'uploadArtifact';}}):{...f.command,operation:'detachDocumentSource'};const before=f.trace.length;await assert.rejects(f.repo.uploadTransaction('memory','csrf',raw as never,async()=>{throw Error('WORK0');}));assert.equal(reads,0);assert.equal(f.trace.length,before);continue;}
  if(mode==='ended'){await f.repo.uploadTransaction('memory','csrf',f.command as never,async(db,a)=>{await currentGeneralProjectController(db,a,f.command as never);});const before=f.logs.length;await assert.rejects(persist(f.db as never,f.actor as never,f.command as never),/DOCUMENT_CONTEXT_INVALID/);assert.equal(f.logs.length,before);continue;}
  await assert.rejects(f.repo.uploadTransaction('memory','csrf',f.command as never,async(db,a)=>{await currentGeneralProjectController(db,a,f.command as never);if(mode==='twice'){await persist(db,a,f.command as never);const before=f.logs.length;try{await persist(db,a,f.command as never);}finally{assert.equal(f.logs.length,before);}return;}
   const request=mode==='request'?{...f.command,payload:{...f.command.payload,bytes:1}}:f.command,client=mode==='db'?{query:async()=>{throw Error('CROSS_DB_IO0');}}:db,actor=mode==='actor'?{...a}:mode==='session'?{...a,authSession:{...a.authSession!}}:a;const before=f.logs.length;try{await persist(client as never,actor as never,request as never);}finally{assert.equal(f.logs.length,before);}
  }),/DOCUMENT_CONTEXT_INVALID/);
 }
});
