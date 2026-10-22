import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {advanceOwnershipHeadV1,checkOwnershipEventAppendV1} from '../../../contracts/runtime/ownership-ledger-v1.ts';
import {planOwnershipObservationRequest} from '../../../apps/server/modules/executions/ownership-request-event.ts';
import {ownershipPreparationReceiptFixture} from './ownership-preparation-receipt-fixture.ts';
const m=await import(new URL('../../../apps/server/modules/executions/ownership-request-issuer.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v)),id=(n:number)=>`50000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function fixture(current:boolean|'BINDING'=false){
 const f=await ownershipPreparationReceiptFixture(),p=f.prep.snapshot,scope=p.scope;
 const ref=(n:number)=>({id:id(n),version:1,contentHash:String(n%10).repeat(64)});
 const snapshot={schemaVersion:1,purpose:'PROCESS_OWNERSHIP_ANCHOR',transport:'SYNTHETIC_ONLY',scope:{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,sessionBindingRef:ref(11),roleBindingRef:ref(12),executorRegistrationRef:p.registrationRef},processRef:{runId:p.payload.runId,generation:p.payload.processGeneration,jobId:id(13),pid:100,startTicks:'638960000000000001',executableHash:p.payload.workerHash},observerRef:p.payload.observerRef,recordedAt:p.at,expiresAt:p.expiresAt,state:'BOUND',fileSandboxVerified:false,executionAuthorized:false,dispatchPerformed:false};
 const evidence:any={purpose:'OWNERSHIP_SYNTHETIC_PREPARED_INPUTS',transport:'SYNTHETIC_ONLY',scope,preparationRef:f.prep.ref,writer:{claim:'SYNTHETIC_NONE',generation:1,evidenceRef:ref(14),predecessorRef:null,reclaimRef:null},candidate:{anchor:{ref:{id:id(15),version:1,contentHash:hash(snapshot)},snapshot},sourceRef:ref(16),rootId:p.payload.rootId,hostHash:p.payload.hostHash,workerHash:p.payload.workerHash,runId:p.payload.runId,processGeneration:p.payload.processGeneration},checkedAt:f.now.toISOString(),expiresAt:new Date(f.now.getTime()+20000).toISOString(),executionAuthorized:false,dispatchPerformed:false};
 const rows:any[]=[{project_id:scope.projectId,execution_id:scope.executionId,execution_generation:scope.executionGeneration,event_id:f.prep.ref.id,version:1,sequence:1,project_sequence:1,content_hash:f.prep.ref.contentHash,snapshot_json:p}];
 let head:any=null;
 const append=(e:any)=>rows.push({project_id:scope.projectId,execution_id:scope.executionId,execution_generation:scope.executionGeneration,event_id:e.ref.id,version:1,sequence:e.snapshot.sequence,project_sequence:rows.length+1,content_hash:e.ref.contentHash,snapshot_json:e.snapshot});
 if(current){const planned=planOwnershipObservationRequest({preparation:f.prep,tail:f.prep,anchor:evidence.candidate.anchor,head:null,authorityExpiresAt:evidence.expiresAt,nowMs:f.now.getTime()});append(planned.event);
  const next=(previous:any,n:number,kind:string,payload:any)=>{const s={...previous.snapshot,sequence:previous.snapshot.sequence+1,previousRef:previous.ref,kind,payload};return checkOwnershipEventAppendV1(previous,{ref:{id:id(n),version:1,contentHash:hash(s)},snapshot:s},f.now.getTime());};
  const accepted=next(planned.event,30,'OBSERVATION_ACCEPTED',{requestRef:planned.event.ref,observationRef:ref(31),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,anchorRef:evidence.candidate.anchor.ref,preparationRef:f.prep.ref});append(accepted);
  const adopt=next(accepted,32,'ANCHOR_ADOPTED',{anchorRef:evidence.candidate.anchor.ref,preparationRef:f.prep.ref,observationEventRef:accepted.ref,expectedHeadRef:null});append(adopt);head=advanceOwnershipHeadV1(null,adopt,id(33),f.now.getTime());
  if(current==='BINDING'){const binding=next(adopt,34,'BINDING_RECORDED',{anchorRef:evidence.candidate.anchor.ref,bindingRef:ref(35),expectedHeadRef:head.ref});append(binding);head=advanceOwnershipHeadV1(head,binding,head.ref.id,f.now.getTime());}
 }
 let staged:any[]=[],fault='',connects=0,releases:boolean[]=[],commits=0,rolled=0,evidenceReads=0,clockMs=f.now.getTime();
 const sqls:string[]=[];
 const db:any={async query(sql:string,args:any[]=[]){sqls.push(sql);
  if(sql==='BEGIN'){staged=[];if(fault==='BEGIN_PORT_CHANGE')port.transport='REAL';return{rows:[]};}
  if(sql.startsWith('SET LOCAL'))return{rows:[]};
  if(sql==='COMMIT'){rows.push(...staged);staged=[];commits++;if(fault==='COMMIT_LOST'||fault==='COMMIT_LOST_RELEASE')throw Error('private detail');return{rows:[]};}
  if(sql==='ROLLBACK'){rolled++;if(fault==='ROLLBACK_LOST')throw Error('private detail');staged=[];return{rows:[]};}
  if(sql.includes('FROM anvil.execution_ownership_events')&&sql.includes("kind='PREPARATION_GRANTED'")){assert.deepEqual(args,[scope.projectId]);return{rows:[fault==='SLOT'?{...rows[0],event_id:id(99)}:rows[0]]};}
  if(sql.includes('FROM anvil.execution_ownership_events')&&sql.includes('ORDER BY sequence DESC')){assert.deepEqual(args,[scope.projectId,scope.executionId,scope.executionGeneration]);return{rows:[([...rows,...staged]).at(-1)]};}
  if(sql.startsWith('SELECT * FROM anvil.execution_ownership_events')&&sql.includes('event_id=$4')){assert.deepEqual(args,[scope.projectId,scope.executionId,scope.executionGeneration,f.prep.ref.id,1]);return{rows:[rows[0]]};}
  if(sql.includes('MAX(project_sequence)')){assert.deepEqual(args,[scope.projectId]);return{rows:[{next_sequence:rows.length+staged.length+1}]};}
  if(sql.includes('FROM anvil.execution_ownership_heads')){assert.deepEqual(args,[scope.projectId,scope.executionId,scope.executionGeneration]);return{rows:head?[{id:head.ref.id,head_generation:head.ref.version,content_hash:head.ref.contentHash,snapshot_json:head.snapshot}]:[]};}
  if(sql.startsWith('INSERT INTO anvil.execution_ownership_events')){if(fault==='WRITE'||fault==='ROLLBACK_LOST')throw Error('private detail');const [pid,eid,generation,eventId,version,sequence,projectSequence,contentHash,snapshotJson,candidateJson]=args;assert.equal(pid,scope.projectId);assert.equal(eid,scope.executionId);assert.equal(generation,scope.executionGeneration);staged.push({project_id:pid,execution_id:eid,execution_generation:generation,event_id:eventId,version,sequence,project_sequence:projectSequence,content_hash:contentHash,snapshot_json:JSON.parse(snapshotJson),candidate_anchor_json:candidateJson===null?null:JSON.parse(candidateJson)});if(fault==='FINAL_SESSION')Object.assign(f.row,{revoked_at:f.now});return{rows:[],rowCount:1};}
  if(sql.includes('clock_timestamp()'))return{rows:[{at:new Date(clockMs),transaction_id:'77'}]};
  return f.db.query(sql,args);
 },release(discard=false){releases.push(discard);if(fault==='RELEASE'||fault==='COMMIT_LOST_RELEASE')throw Error('synthetic private release detail');}};
 const pool={async connect(){connects++;return db;}},port:any={transport:'SYNTHETIC_ONLY',async current(connection:any,s:any,r:any){assert.equal(connection,db);assert.deepEqual(s,scope);assert.deepEqual(r,f.prep.ref);evidenceReads++;const v=structuredClone(evidence);if(fault==='PORT_CHANGE')port.transport='REAL';if(fault==='FINAL_WRITER'&&evidenceReads>1)v.writer.generation++;if(fault==='EVIDENCE_TICK'){clockMs++;v.checkedAt=new Date(clockMs).toISOString();}if(fault==='EVIDENCE_EXPIRED'&&evidenceReads>1)clockMs+=30000;if(fault==='FINAL_SHRINK'&&evidenceReads>1)v.expiresAt=new Date(clockMs+1000).toISOString();return v;}};
 const last=rows.at(-1),input={preparationRef:f.prep.ref,expectedTailRef:{id:last.event_id,version:1,contentHash:last.content_hash},expectedHeadRef:head?.ref??null};
 const issue=async(options:any={})=>{assert.equal(typeof m.SyntheticPgOwnershipRequestIssuer,'function','원자 발행 source가 필요하다');const store=new m.SyntheticPgOwnershipRequestIssuer(pool,f.access,options.absent?null:port);return store.issue(f.token,f.csrf,scope,{...input,...options.input},options.signal);};
 return{...f,scope,evidence,rows,input,head,port,issue,fault(v:string){fault=v;},stats:()=>({connects,releases,commits,rolled,evidenceReads,staged:staged.length}),sqls};
}
test('공급자 부재는 연결 전에 거절하고 bare NONE/실권한·미회수 주장은 저장하지 않는다',async()=>{
 const absent=await fixture();await assert.rejects(absent.issue({absent:true}),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(absent.stats().connects,0);
 for(const mutate of [(f:any)=>f.evidence.writer.claim='NONE',(f:any)=>f.evidence.executionAuthorized=true,(f:any)=>f.evidence.writer.predecessorRef=f.evidence.writer.evidenceRef,(f:any)=>f.evidence.candidate.rootId=id(98),(f:any)=>f.evidence.transport='REAL']){const f=await fixture();mutate(f);await assert.rejects(f.issue(),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(f.rows.length,1);assert.equal(f.stats().commits,0);}
});
test('원 AUTO reader·slot/tail을 소비해 서버 nonce/request를 원자 저장한 뒤 합성 결과만 반환한다',async()=>{
 const f=await fixture(),v=await f.issue();assert.equal(v.purpose,'SYNTHETIC_OWNERSHIP_REQUEST_COMMIT_ONLY');assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.equal(v.observationRequestAuthorized,false);assert.deepEqual(v.missingEvidence,['VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE']);assert.equal(v.request.phase,'BOOTSTRAP_PREPARED');assert.match(v.request.nonce,/^[A-Za-z0-9_-]{43}$/);assert.deepEqual(v.request.preparationRef,f.prep.ref);assert.deepEqual(v.request.requestRef.id,f.rows[1].event_id);assert.deepEqual(f.rows[1].snapshot_json.previousRef,f.prep.ref);assert.equal(f.rows[1].sequence,2);assert.equal(f.rows[1].project_sequence,2);assert.deepEqual(f.rows[1].candidate_anchor_json,f.evidence.candidate.anchor);assert.equal(f.stats().commits,1);assert.deepEqual(f.stats().releases,[false]);assert(f.calls.filter(s=>s.includes('FROM anvil.auth_sessions')).length>=4);
 await assert.rejects(f.issue(),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(f.rows.length,2,'동일 옛 tail로 재발행하지 않는다');
});
test('잘못된 tail/slot·최종 권한/후보 변화·취소는 저장을 rollback한다',async()=>{
 for(const fault of ['SLOT','WRITE','FINAL_SESSION','FINAL_WRITER','PORT_CHANGE']){const f=await fixture();f.fault(fault);await assert.rejects(f.issue(),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(f.rows.length,1);assert.equal(f.stats().commits,0);assert.equal(f.stats().staged,0);}
 const wrong=await fixture();await assert.rejects(wrong.issue({input:{expectedTailRef:{...wrong.prep.ref,contentHash:'f'.repeat(64)}}}),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(wrong.rows.length,1);
 const cancelled=await fixture();const c=new AbortController();c.abort();await assert.rejects(cancelled.issue({signal:c.signal}),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(cancelled.stats().connects,0);
});
test('COMMIT 적용 뒤 응답 손실은 UNKNOWN·연결폐기이며 자동 재발행하지 않는다',async()=>{
 const f=await fixture();f.fault('COMMIT_LOST');await assert.rejects(f.issue(),{message:'OWNERSHIP_REQUEST_COMMIT_UNKNOWN'});assert.equal(f.rows.length,2);assert.deepEqual(f.stats().releases,[true]);f.fault('');await assert.rejects(f.issue(),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(f.rows.length,2);
 const rollback=await fixture();rollback.fault('ROLLBACK_LOST');await assert.rejects(rollback.issue(),{message:'OWNERSHIP_REQUEST_ROLLBACK_UNCONFIRMED'});assert.deepEqual(rollback.stats().releases,[true]);
});
test('CURRENT는 원 head/anchor를 유지하고 bootstrap 후보를 다시 저장하지 않는다',async()=>{
 for(const current of [true,'BINDING'] as const){const f=await fixture(current),v=await f.issue(),length=current===true?5:6;assert.equal(v.request.phase,'CURRENT');assert.deepEqual(v.request.expectedHeadRef,f.head.ref);assert.deepEqual(v.request.anchorRef,f.evidence.candidate.anchor.ref);assert.equal(f.rows.length,length);assert.equal(f.rows.at(-1).candidate_anchor_json,null);assert.equal(f.rows.at(-1).sequence,length);assert.equal(f.rows.at(-1).project_sequence,length);}
 const wrong=await fixture(true);await assert.rejects(wrong.issue({input:{expectedHeadRef:{...wrong.head.ref,version:2}}}),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(wrong.rows.length,4);
});
test('BEGIN 적용 뒤 공급자 변경에도 열린 transaction을 반환하지 않는다',async()=>{
 const f=await fixture();f.fault('BEGIN_PORT_CHANGE');await assert.rejects(f.issue(),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(f.stats().rolled,1,'BEGIN 응답 뒤 검사 실패도 rollback해야 한다');assert.equal(f.stats().commits,0);
});
test('근거 조회 동안 전진한 DB 시각으로 최신 응답을 검사하고 최종 만료는 거절한다',async()=>{
 const tick=await fixture();tick.fault('EVIDENCE_TICK');const v=await tick.issue();assert.equal(v.purpose,'SYNTHETIC_OWNERSHIP_REQUEST_COMMIT_ONLY');assert.equal(v.request.requestedAt,new Date(tick.now.getTime()+1).toISOString());
 const expired=await fixture();expired.fault('EVIDENCE_EXPIRED');await assert.rejects(expired.issue(),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(expired.rows.length,1);assert.equal(expired.stats().commits,0);
});
test('COMMIT 뒤 release 오류도 원문을 숨기고 저장 불확정을 유지한다',async()=>{
 for(const mode of ['RELEASE','COMMIT_LOST_RELEASE']){const f=await fixture();f.fault(mode);await assert.rejects(f.issue(),{message:'OWNERSHIP_REQUEST_COMMIT_UNKNOWN'});assert.equal(f.rows.length,2);assert.equal(f.stats().commits,1);}
});
test('최종 근거 기한이 줄어 저장 요청의 수명을 감당하지 못하면 발행하지 않는다',async()=>{
 const f=await fixture();f.fault('FINAL_SHRINK');await assert.rejects(f.issue(),{message:'OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE'});assert.equal(f.rows.length,1);assert.equal(f.stats().commits,0);
});
