import assert from 'node:assert/strict';
import test from 'node:test';
import {reworkFixture} from './result-rework-input-fixture.ts';
import {criteriaHash as hash,criteriaId as id} from './result-criteria-fixture.ts';
import {ProjectResultReworkPreparation} from '../../../apps/server/modules/results/project-result-rework-preparation.ts';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {ProjectListCodec} from '../../../apps/server/modules/projects/service.ts';
import {canonicalJson} from '../../../contracts/canonical.ts';
const mod:any=await import('../../../apps/server/modules/results/project-result-reworks.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){const f=reworkFixture(),pid=f.sources.assignment.projectId,at=f.now,actor:any={actorId:id(6),clientId:id(24),authSession:{id:id(31),idleExpiresAt:'2099-10-20T01:00:00.000Z',absoluteExpiresAt:'2099-10-20T02:00:00.000Z'}},request:any={schemaVersion:1,projectId:pid,commandId:id(32),clientId:actor.clientId,controlGeneration:1,operation:'requestRework',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:f.input},rule={ruleId:'REWORK_DRAFT',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['requestRework'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-10-20T01:00:00.000Z'},policy:any={id:id(33),head_version:1,rules_json:[rule],reason:'보완 초안 기록만',review_refs:[],created_at:new Date(at),content_hash:hash({rules:[rule],reason:'보완 초안 기록만',reviewRefs:[]})},policyRef={id:policy.id,version:1,contentHash:policy.content_hash},rows:any[]=[],commands=new Map<string,any>(),receipts=new Map<string,any>(),audits=new Map<string,number>(),nonmatchingAudits=new Map<string,number>(),calls:string[]=[];let member=true,controlled=true,head:any=policy,bindingHead:any=f.sources.binding.ref;
 const db:any={query:async(sql:string,p:any[]=[])=>{calls.push(sql);if(sql.includes('JOIN anvil.project_members'))return{rows:member?[{id:pid,participation:'OWNER',archived_at:null}]:[]};if(sql.includes('FROM anvil.project_control'))return{rows:controlled?[{actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null}]:[]};if(sql.includes('FROM anvil.permission_policies'))return{rows:head?[head]:[]};if(sql.includes('transaction_timestamp()')||sql.includes('clock_timestamp()'))return{rows:[{at:new Date(at)}]};if(sql==='SELECT id FROM anvil.projects WHERE id=$1 FOR UPDATE')return{rows:[{id:pid}]};if(sql.includes('FROM anvil.role_bindings WHERE'))return{rows:[{binding_id:bindingHead.id,version:bindingHead.version,content_hash:bindingHead.contentHash}]};
 if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return{rows:[...commands.values()].filter(c=>p[0]===pid&&c.actor_id===p[1]&&c.original_command_id===p[2]).map(c=>({operation:c.operation,request_hash:c.request_hash,result_ref:structuredClone(c.result_ref)}))};
 if(sql.startsWith('INSERT INTO anvil.commands')){commands.set(p[0],{source_operation_id:p[7],operation:p[4],actor_id:p[2],client_id:p[3],original_command_id:p[5],request_hash:p[6],state:'APPLIED',expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),result_ref:JSON.parse(p[14]),authorization_receipt_id:p[8]});return{rows:[]};}if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){receipts.set(p[0],{subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6]});return{rows:[]};}if(sql.startsWith('INSERT INTO anvil.audit_events')){if(p[4])audits.set(p[4],1);return{rows:[]};}if(sql.startsWith('SELECT set_config'))return{rows:[]};
 if(sql.startsWith('INSERT INTO anvil.result_rework_drafts')){rows.push({project_id:p[0],id:p[1],result_id:p[2],review_id:p[3],binding_id:p[4],binding_version:p[5],content_hash:p[6],snapshot_json:JSON.parse(p[7]),created_by:p[8],client_id:p[9],command_id:p[10],created_at:new Date(p[11])});return{rows:[],rowCount:1};}
 if(sql.includes('FROM anvil.result_rework_drafts v'))return{rows:rows.filter(r=>r.project_id===p[0]&&r.id===p[1]).map(r=>{const c=structuredClone(commands.get(r.command_id)),ar=structuredClone(receipts.get(c.authorization_receipt_id));return{...structuredClone(r),...c,command_client_id:c.client_id,receipt_subject:ar.subject_ref,receipt_policy_ref:ar.policy_ref,scope_digest:ar.scope_digest,approval_decision_ref:ar.approval_decision_ref,audit_count:audits.get(r.command_id)??0,...(sql.includes('AS audit_total')?{audit_total:(audits.get(r.command_id)??0)+(nonmatchingAudits.get(r.command_id)??0)}:{})};})};throw Error('UNEXPECTED_QUERY:'+sql);}};
 const read=(key:keyof typeof f.sources)=>async()=>structuredClone(f.sources[key]),sessions:any={readRole:read('role'),readBinding:read('binding'),methods:{readApplication:async()=>({applicationRef:structuredClone(f.sources.assignment.snapshot.definition.taskRef.applicationRef)})},drafts:{current:async()=>{}}},preparation=new ProjectResultReworkPreparation({assignments:{read:read('assignment')},results:{read:read('result')},criteria:{read:read('criteria')},reviews:{read:read('review')},sessions} as any);
 return{...f,pid,actor,request,policy,policyRef,db,rows,calls,commands,receipts,audits,nonmatchingAudits,preparation,sessions,member:(v:boolean)=>member=v,controlled:(v:boolean)=>controlled=v,policyHead:(v:any)=>head=v,bindingHead:(v:any)=>bindingHead=v};}
function service(f:ReturnType<typeof fixture>){assert.equal(typeof mod.ProjectResultReworks,'function','불변 보완 초안 저장 미구현');return new mod.ProjectResultReworks(f.preparation,f.sessions);}
test('이전 보완 페이지는 서명된 사용자/원제출 cursor로만 이동하고 손상·다른주체·만료는 거절한다',async()=>{
 const f=fixture(),s=service(f);assert.equal(typeof s.page,'function','보완 이전 페이지 미구현');const codec=new ProjectListCodec(v=>hash('REWORK_PAGE_TEST:'+v)),query=f.db.query,archived:any[]=[];
 f.db.query=async(sql:string,p:any[])=>{if(sql.includes('FROM anvil.result_rework_drafts WHERE')&&sql.includes('cursor_at')){assert.match(sql,/\(created_at,id\)</);return{rows:archived.filter(r=>p[2]===null||r.cursor_at<p[2]||r.cursor_at===p[2]&&r.id<p[3]).slice(0,21)};}return query(sql,p);};
 for(let n=0;n<22;n++){const saved=await s.save(f.db,f.actor,{...f.request,commandId:id(100+n)},f.policyRef);archived.push({id:saved.data.ref.id,content_hash:saved.data.ref.contentHash,cursor_at:f.now});}archived.sort((a,b)=>b.id.localeCompare(a.id));
 const first=await s.page(f.db,f.actor,f.pid,f.sources.result.ref.id,{},codec);assert.equal(first.items.length,20);assert.equal(first.hasMore,true);assert.equal(typeof first.nextCursor,'string');const second=await s.page(f.db,f.actor,f.pid,f.sources.result.ref.id,{cursor:first.nextCursor},codec);assert.equal(second.items.length,2);assert.equal(second.hasMore,false);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.items,...second.items].map(v=>v.ref.id)).size,22);
 for(const cursor of [first.nextCursor+'x',codec.create(f.actor.actorId,{query:'OTHER_RESULT',archived:false,limit:20},{at:f.now,id:archived[19].id}),codec.create(f.actor.actorId,{query:canonicalJson({kind:'RESULT_REWORK_DRAFTS',projectId:f.pid,resultRef:f.sources.result.ref}),archived:false,limit:20},{at:f.now,id:archived[19].id},new Date('2000-01-01'))])await assert.rejects(s.page(f.db,f.actor,f.pid,f.sources.result.ref.id,{cursor},codec));
 await assert.rejects(s.page(f.db,{...f.actor,actorId:id(99)},f.pid,f.sources.result.ref.id,{cursor:first.nextCursor},codec));await assert.rejects(s.page(f.db,f.actor,f.pid,f.sources.result.ref.id,{execute:true},codec));
});
test('불변 예약 표의 SELECT/INSERT 전용 권한을 넓히지 않고 프로젝트 잠금 안에서 최신예약을 검사한다',async()=>{const f=fixture(),query=f.db.query;f.db.query=async(sql:string,p:any[])=>{if(sql.includes('FROM anvil.role_bindings WHERE')&&/FOR SHARE|FOR UPDATE/.test(sql))throw Object.assign(Error('role_bindings UPDATE privilege required'),{code:'42501'});return query(sql,p);};const saved=await service(f).save(f.db,f.actor,f.request,f.policyRef);assert.equal(saved.data.reworkStored,true);assert(f.calls.includes('SELECT id FROM anvil.projects WHERE id=$1 FOR UPDATE'));});
function listFixture(){const f=fixture(),query=f.db.query;let listed:any[]=[],revoke=false;f.db.query=async(sql:string,p:any[])=>{if(sql.startsWith('SELECT id,content_hash FROM anvil.result_rework_drafts')){assert.match(sql,/ORDER BY created_at DESC,id DESC LIMIT 21$/);assert.deepEqual(p,[f.pid,f.sources.result.ref.id]);if(revoke)f.member(false);return{rows:structuredClone(listed)};}return query(sql,p);};return{...f,listed:(rows:any[])=>listed=rows,revokeDuringList:()=>revoke=true};}
test('보완 목록은 저장기록20/추가존재만 반환하고 최신예약 변경도 현재배정으로 승격하지 않는다',async()=>{const f=listFixture(),s=service(f);assert.equal(typeof s.list,'function','보관 보완 metadata 목록 미구현');const ids:any[]=[];for(let n=0;n<21;n++){const saved=await s.save(f.db,f.actor,{...f.request,commandId:id(100+n)},f.policyRef);ids.push({id:saved.data.ref.id,content_hash:saved.data.ref.contentHash});}f.listed(ids);f.bindingHead({...f.sources.binding.ref,version:2});const before=f.calls.filter(c=>c.startsWith('INSERT')).length,v=await s.list(f.db,f.actor,f.pid,f.sources.result.ref.id);assert.equal(v.selectionState,'NOT_SELECTED');assert.equal(v.items.length,20);assert.equal(v.hasMore,true);assert.deepEqual(v.resultRef,f.sources.result.ref);assert.deepEqual(v.items[0].responsibleBindingRef,f.sources.binding.ref);assert.deepEqual(v.items[0].stageSessionRef,f.sources.binding.snapshot.sessionRef);assert.equal(v.items[0].reworkStored,true);for(const key of ['currentBindingVerified','currentAuthorityVerified','completionAccepted','formalFailureCounted','executionAuthorized','dispatchPerformed'])assert.equal(v.items[0][key],false);assert.equal(f.calls.filter(c=>c.startsWith('INSERT')).length,before);});
test('보완 목록의 빈 상태·위조hash·다른 원제출·중복·조회중 멤버회수는 구분/거절한다',async()=>{const f=listFixture(),s=service(f);assert.equal(typeof s.list,'function');const empty=await s.list(f.db,f.actor,f.pid,f.sources.result.ref.id);assert.deepEqual(empty.items,[]);assert.equal(empty.hasMore,false);const saved=await s.save(f.db,f.actor,f.request,f.policyRef),row={id:saved.data.ref.id,content_hash:saved.data.ref.contentHash};for(const rows of [[{...row,content_hash:'0'.repeat(64)}],[row,row]]){f.listed(rows);await assert.rejects(s.list(f.db,f.actor,f.pid,f.sources.result.ref.id));}f.listed([row]);f.sources.result.ref.contentHash='1'.repeat(64);await assert.rejects(s.list(f.db,f.actor,f.pid,f.sources.result.ref.id));f.sources.result.ref.contentHash=f.input.resultRef.contentHash;f.revokeDuringList();await assert.rejects(s.list(f.db,f.actor,f.pid,f.sources.result.ref.id));});
test('정확 미달/잔여·원문·예약session과 HUMAN 요청을 저장 조회하되 새 배정/실행으로 승격하지 않는다',async()=>{const f=fixture(),s=service(f),saved=await s.save(f.db,f.actor,f.request,f.policyRef),v=await s.read(f.db,f.actor,f.pid,saved.data.ref.id);assert.equal(saved.data.status,'RESULT_REWORK_DRAFT_STORED');assert.equal(v.reworkStored,true);assert.deepEqual(v.snapshot.input,f.input);assert.deepEqual(v.snapshot.stageSessionRef,f.sources.binding.snapshot.sessionRef);assert.deepEqual(v.snapshot.remainingMissingItems,['denied']);assert.equal(v.currentBindingVerified,false);assert.equal(v.executionAuthorized,false);assert.equal(v.formalFailureCounted,false);assert.equal(f.rows.length,1);assert.equal(f.calls.filter(c=>c.startsWith('INSERT INTO anvil.agent_sessions')).length,0);assert.equal(f.calls.filter(c=>c.startsWith('INSERT INTO anvil.audit_events')).length,1);});
test('현재 제어/별도정책·기한/최신예약·현재임무가 없으면 보완 초안을 저장하지 않는다',async()=>{for(const alter of [(f:any)=>f.member(false),(f:any)=>f.controlled(false),(f:any)=>f.policyHead(null),(f:any)=>f.actor.authSession.idleExpiresAt='2020-01-01T00:00:00.000Z',(f:any)=>f.bindingHead({...f.sources.binding.ref,version:2}),(f:any)=>f.sessions.drafts.current=async()=>{throw Error('DRAFT_CHANGED');},(f:any)=>f.sessions.methods.readApplication=async()=>({applicationRef:{...f.sources.assignment.snapshot.definition.taskRef.applicationRef,version:2}})]){const f=fixture();alter(f);await assert.rejects(service(f).save(f.db,f.actor,f.request,f.policyRef));assert.equal(f.rows.length,0);}});
test('옛 보완 기록은 현재예약 변경 뒤에도 읽기만 하며 손상/재해시된 다른scope와 비멤버는 거절한다',async()=>{const f=fixture(),s=service(f),saved=await s.save(f.db,f.actor,f.request,f.policyRef);f.bindingHead({...f.sources.binding.ref,version:2});assert.equal((await s.read(f.db,f.actor,f.pid,saved.data.ref.id)).reworkStored,true);f.rows[0].snapshot_json.stageSessionRef.id=id(99);f.rows[0].content_hash=hash(f.rows[0].snapshot_json);await assert.rejects(s.read(f.db,f.actor,f.pid,saved.data.ref.id));f.member(false);await assert.rejects(s.read(f.db,f.actor,f.pid,saved.data.ref.id));});

function replayFixture(){
 const f=fixture(),reworks=service(f),transactions:{db:unknown;csrf:string|null}[]=[];
 const access={authenticated:async(_token:string,csrf:string|null,work:(db:typeof f.db,actor:typeof f.actor)=>Promise<unknown>)=>{
  transactions.push({db:f.db,csrf});return work(f.db,f.actor);
 }} as ConstructorParameters<typeof ProjectPolicyRepository>[0];
 const policies=new ProjectPolicyRepository(access);
 const command=(input=f.request)=>policies.command('session','csrf',input,(db,actor,policy)=>reworks.save(db,actor,input,policy),
  (db,actor,original,result,policy)=>reworks.verifyReplay(db,actor,original,result,policy));
 const writes=()=>f.calls.filter(sql=>/^(INSERT|UPDATE|DELETE) /.test(sql)).length;
 return {...f,transactions,command,writes};
}

test('보완 초안 동일 명령은 같은 인증 거래에서 과거 원자료를 검산해 원 영수증만 반환한다',async()=>{
 const f=replayFixture(),saved=await f.command();
 f.bindingHead({...f.sources.binding.ref,version:2});
 f.sessions.drafts.current=async()=>{throw Error('현재 임무 읽기 금지');};
 f.sessions.methods.readApplication=async()=>{throw Error('현재 방법론 읽기 금지');};
 const reason='새 허용 정책 head';
 f.policyHead({...f.policy,head_version:2,reason,content_hash:hash({rules:f.policy.rules_json,reason,reviewRefs:[]})});
 const before=f.calls.length,writes=f.writes(),transactions=f.transactions.length;
 assert.deepEqual(await f.command(),saved);
 assert.deepEqual(f.transactions.slice(transactions),[{db:f.db,csrf:'csrf'}]);
 const replay=f.calls.slice(before),history=replay.findIndex(q=>q.includes('FROM anvil.result_rework_drafts v'));
 assert.ok(history>replay.findIndex(q=>q.includes('SELECT operation,request_hash,result_ref FROM anvil.commands')));
 assert.match(replay[history]!,/FROM anvil.audit_events all_audits WHERE all_audits\.command_id=c\.id AND all_audits\.project_id=c\.project_id\) AS audit_total,/);
 assert.ok(replay.findLastIndex(q=>q.includes('JOIN anvil.permission_policy_versions'))>history,'역사 검산 뒤 현재 정책 재확인');
 assert.ok(!replay.some(q=>q.includes('FROM anvil.role_bindings WHERE')));
 assert.equal(f.writes(),writes);assert.equal(f.rows.length,1);
});

test('원 보완 또는 근거가 없거나 다른 명령 영수증이면 재확인은 503과 추가 저장 0으로 닫힌다',async(t)=>{
 const cases={
  DRAFT_MISSING:(f:ReturnType<typeof replayFixture>)=>{f.rows.length=0;},
  AUDIT_MISSING:(f:ReturnType<typeof replayFixture>)=>{f.audits.clear();},
  AUDIT_DUPLICATE:(f:ReturnType<typeof replayFixture>)=>{f.audits.set(f.rows[0].command_id,2);},
  AUDIT_NONMATCHING_SIBLING:(f:ReturnType<typeof replayFixture>)=>{f.nonmatchingAudits.set(f.rows[0].command_id,1);},
  SOURCE_MISSING:(f:ReturnType<typeof replayFixture>)=>{f.preparation.readers.reviews.read=async()=>{throw new AuthFailure('NOT_FOUND',404);};},
  AUTH_RECEIPT:(f:ReturnType<typeof replayFixture>)=>{f.receipts.values().next().value.scope_digest='1'.repeat(64);},
  WRONG_ORIGINAL:(f:ReturnType<typeof replayFixture>,second:any)=>{f.commands.get(f.rows[0].command_id).result_ref=second;},
  RESULT_PROJECTION:(f:ReturnType<typeof replayFixture>)=>{f.commands.get(f.rows[0].command_id).result_ref.warnings=['UNVERIFIED'];},
  PREVIOUS_READ:(f:ReturnType<typeof replayFixture>)=>{
   const query=f.db.query;
   f.db.query=async(sql:string,p:any[])=>{
    const result=await query(sql,p);
    if(sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))result.rows[0].result_ref.operationId=id(200);
    return result;
   };
  }
 };
 for(const [name,alter] of Object.entries(cases))await t.test(name,async()=>{
  const f=replayFixture();await f.command();
  const second=name==='WRONG_ORIGINAL'?await f.command({...f.request,commandId:id(199)}):undefined;
  alter(f,second);const writes=f.writes();
  await assert.rejects(f.command(),{message:'RESULT_REWORK_LEDGER_INVALID',statusCode:503});
  assert.equal(f.writes(),writes);
 });
});

test('보완 재확인은 공통 같은 명령 입력·현재 제어·현재 정책 검사를 유지한다',async()=>{
 const f=replayFixture();await f.command();
 const historyCount=()=>f.calls.filter(q=>q.includes('FROM anvil.result_rework_drafts v')).length;
 const before=historyCount();
 await assert.rejects(f.command({...f.request,payload:{...f.request.payload,reason:'다른 보완 이유'}}),{message:'IDEMPOTENCY_CONFLICT',statusCode:409});
 f.controlled(false);
 await assert.rejects(f.command(),{message:'PROJECT_CONTROL_REQUIRED',statusCode:403});
 f.controlled(true);f.policyHead(null);
 await assert.rejects(f.command(),{message:'PERMISSION_POLICY_UNCONFIGURED',statusCode:412});
 assert.equal(historyCount(),before);assert.equal(f.rows.length,1);assert.equal(f.commands.size,1);
});

test('보완 재확인 도중 회원 접근을 잃으면 보호 404를 유지한다',async(t)=>{
 for(const boundary of ['BEFORE_SOURCES','AFTER_SOURCES'])await t.test(boundary,async()=>{
  const f=replayFixture();await f.command();const query=f.db.query,writes=f.writes();let inHistory=false,clocks=0;
  f.db.query=async(sql:string,p:any[])=>{
   if(sql.includes('FROM anvil.result_rework_drafts v')){
    inHistory=true;
    if(boundary==='BEFORE_SOURCES')f.member(false);
   }
   if(inHistory&&boundary==='AFTER_SOURCES'&&sql.includes('clock_timestamp()')&&++clocks===2)f.member(false);
   return query(sql,p);
  };
  await assert.rejects(f.command(),{message:'NOT_FOUND',statusCode:404});
  assert.equal(f.writes(),writes);
 });
});
