import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const modulePath='../../../apps/server/modules/executions/normal-understanding-read-requests.ts';
const mod:any=await import(modulePath).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`af090102-0000-4000-8000-${String(n).padStart(12,'0')}`,hash=(v:unknown)=>contentHash(canonicalJson(v));
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(reauthMode='CURRENT'){
 const pid=id(1),uid=id(2),cid=id(3),sid=id(4),eid=id(5),token='t'.repeat(43),csrf='c'.repeat(43);
 const at=new Date(),until=new Date(at.getTime()+60000),calls:string[]=[];
 let state:any={commands:[],requests:[]},backup:any,control=1,denied=false,failInsert=false,loseCommit=false,changed=false,changeAfterInsert=false,swapQuery=false,basisMissing=false;
 let candidates=1,locates=0,changeSelection=false,preserveCommit=false;
 const rules:any[]=[{ruleId:'read-normal-understanding',subjectRef:{kind:'HUMAN',userId:uid},operations:['readNormalUnderstandingResponse'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:until.toISOString()}];
 const context={projectId:pid,executionId:eid,executionGeneration:1,grantRef:ref(10),registrationRef:ref(11),connectorId:id(12),credentialGeneration:1,
  startCommandId:id(13),startCommandRef:ref(14),assignmentRef:ref(15),preparationRef:ref(16),contextBundleRef:ref(17),sessionBindingRef:ref(18)};
 const request=()=>({schemaVersion:1 as const,projectId:pid,commandId:id(20),clientId:cid,controlGeneration:1,operation:'readNormalUnderstandingResponse',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{assignmentRef:ref(15),preparationRef:ref(16)}});
 const db:any={query:async(sql:string,p:any[]=[])=>{
  calls.push(sql);const rows=(v:any[])=>({rows:v,rowCount:v.length});
  if(sql==='BEGIN'){backup=structuredClone(state);return{...rows([]),command:'BEGIN'};}
  if(sql==='COMMIT'){if(loseCommit){if(preserveCommit)backup=structuredClone(state);throw Error('RAM_COMMIT_UNKNOWN');}return{...rows([]),command:'COMMIT'};}
  if(sql==='ROLLBACK'){state=backup;return{...rows([]),command:'ROLLBACK'};}
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return rows([{id:sid,uid,client_id:cid,current_generation:1,credential_generation:1,user_status:'ACTIVE',user_revoked_at:null,client_revoked_at:null,revoked_at:null,idle_expires_at:until,absolute_expires_at:until,csrf_digest:createHash('sha256').update(csrf).digest('hex'),reauth_until:reauthMode==='NONE'?null:reauthMode==='EXPIRED'?new Date(at.getTime()-1):new Date(until),server_owner:false}]);
  if(sql.startsWith('SELECT clock_timestamp()'))return rows([{at,transaction_id:'17'}]);
  if(sql.startsWith('SELECT transaction_timestamp()'))return rows([{at}]);
  if(sql.startsWith('SELECT p.id,p.archived_at'))return rows([{id:pid,participation:'OWNER',archived_at:null}]);
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return rows([{actor_id:uid,client_id:cid,generation:control,revoked_at:null}]);
  if(sql.includes('FROM anvil.permission_policies')){const body={rules:[...rules,...(denied?[{...rules[0],ruleId:'deny',disposition:'DENY'}]:[])],reason:'RAM',reviewRefs:[]};return rows([{id:id(30),head_version:1,rules_json:body.rules,content_hash:hash(body),reason:body.reason,review_refs:[],created_at:at}]);}
  if(sql.startsWith('SELECT e.id AS execution_id,e.generation')){
   assert.deepEqual(p.slice(0,3),[pid,uid,cid]);
   assert.deepEqual(p.slice(3).map(v=>JSON.parse(v)),[context.assignmentRef,context.preparationRef,{userId:uid,clientId:cid,humanSessionId:sid,credentialGeneration:1,controlGeneration:1}]);
   for(const token of ["e.transport='NORMAL_PROTECTED'","e.state='QUEUED'","='CONTEXT_REVIEW'",'binding,intent,assignmentRef','binding,preparationRef','binding,subject','expiresAt','newer.generation>e.generation','anvil.execution_grant_revocations','LIMIT 2'])assert.ok(sql.includes(token));
   assert.ok(!sql.includes('ORDER BY'));locates++;
   return rows(Array.from({length:candidates},(_,i)=>({execution_id:i||changeSelection&&locates>1?id(98):eid,generation:'1'})));
  }
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_request_basis')){if(swapQuery){const original=db.query;db.query=(...args:any[])=>original(...args);}return rows([{basis:basisMissing?null:{context:{...context,...(changed?{startCommandId:id(99)}:{})},observedAt:at.toISOString(),expiresAt:until.toISOString()}}]);}
  if(sql.startsWith('SELECT operation,request_hash,result_ref'))return rows(state.commands.filter((c:any)=>c.command_key===p[2]));
  if(sql.startsWith('SELECT * FROM anvil.fn09_normal_understanding_request_replay'))return rows(state.requests.filter((r:any)=>r.commandId===JSON.parse(p[3]).commandId));
  if(sql.startsWith('INSERT INTO anvil.commands')){state.commands.push({id:p[0],command_key:p[5],operation:p[4],request_hash:p[6],result_ref:JSON.parse(p[14])});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')||sql.startsWith('INSERT INTO anvil.audit_events')||sql.startsWith('SELECT set_config'))return rows([]);
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_request_insert')){if(failInsert)throw Error('RAM_INSERT_FAILED');const s=JSON.parse(p[7]),r=JSON.parse(p[6]);state.requests.push({id:r.id,content_hash:r.contentHash,snapshot_json:s,commandId:request().commandId,result_ref:state.commands.at(-1).result_ref,complete:true});if(changeAfterInsert)changed=true;return rows([{stored:r}]);}
  throw Error('UNEXPECTED_RAM_SQL');
 },release:()=>{calls.push('RELEASE');}};
 const pool={connect:async()=>db},access=new AccessRepository(pool as any,{installationId:id(40),key:Buffer.alloc(32,1)});
 const readiness=()=>new mod.NormalUnderstandingReadRequests(access).readiness(token,csrf,pid,{controlGeneration:1,...request().payload});
 return{clockAt:at.getTime(),access,db,pool,calls,request,token,csrf,pid,context,rules,readiness,candidates:(count:number)=>{candidates=count;},changeSelection:()=>{changeSelection=true;},run:()=>{assert.equal(typeof mod.NormalUnderstandingReadRequests,'function');return new mod.NormalUnderstandingReadRequests(access).command(token,csrf,request());},state:()=>state,deny:()=>{denied=true;},stale:()=>{control=2;},fail:()=>{failInsert=true;},unknown:(keep=false)=>{loseCommit=true;preserveCommit=keep;},recover:()=>{loseCommit=false;},change:()=>{changed=true;},lateChange:()=>{changeAfterInsert=true;},swap:()=>{swapQuery=true;},missing:()=>{basisMissing=true;}};
}
test('FN09 metadata request uses original Access transaction and stores waiting only; identical replay writes nothing',async()=>{
 const f=fixture(),first=await f.run();assert.equal(first.data.status,'NORMAL_UNDERSTANDING_METADATA_REQUESTED');assert.equal(first.data.state,'PENDING_SOURCE');assert.equal(first.data.sourceAvailable,false);assert.equal(first.data.selectionAvailable,false);
 const s=f.state().requests[0].snapshot_json;assert.equal(s.sourceScope,null);assert.deepEqual(s.context,f.context);assert.equal(s.request.operation,'readNormalUnderstandingResponse');assert.equal(f.calls.filter(s=>s==='COMMIT').length,1);
 const writes=f.calls.filter(s=>s.startsWith('INSERT')||s.includes('request_insert')).length;assert.deepEqual(await f.run(),first);assert.equal(f.calls.filter(s=>s.startsWith('INSERT')||s.includes('request_insert')).length,writes);
});

function fixedRangeFixture(){
 const f=fixture(),original=f.db.query;
 const selection={requestRef:ref(60),resultRef:ref(61),initConfirmationRef:ref(62),tailRef:ref(64),firstSequence:3,lastSequence:4,
  ranges:[{outputRef:ref(63),sequence:3,payloadDigest:'b'.repeat(64),textBlocks:1,textBytes:12},{outputRef:ref(64),sequence:4,payloadDigest:'c'.repeat(64),textBlocks:1,textBytes:14}]};
 const q={...f.request(),payload:{...f.request().payload,selection}};
 let charged=0n,backup=0n,storeCalls=0,current=false,afterStore=false,missing=false,cap=false,corrupt=false,preserveCommit=false;
 const projection=()=>({status:'METADATA_STORED',request:{projectId:f.pid,executionId:q.targetId,executionGeneration:1,assignmentRef:q.payload.assignmentRef,preparationRef:q.payload.preparationRef,requestRef:selection.requestRef},
  resultRef:selection.resultRef,currentness:'CURRENT',observedAt:new Date(f.clockAt-1000).toISOString(),expiresAt:new Date(f.clockAt+20000).toISOString(),selectionAvailable:false,
  metadata:{contextBundleRef:f.context.contextBundleRef,initConfirmationRef:selection.initConfirmationRef,tailRef:selection.tailRef,attribution:'SESSION_ONLY',wholeConversationComplete:false,ranges:selection.ranges}});
 f.db.query=async(sql:string,p:any[]=[])=>{
  if(sql==='BEGIN'||sql==='COMMIT'&&preserveCommit)backup=charged;if(sql==='ROLLBACK')charged=backup;
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_metadata_current')){
   f.calls.push(sql);if(missing||current)throw Object.assign(Error('NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED'),{code:'P0001'});return{rows:[{projection:projection()}]};
  }
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_request_insert')&&JSON.parse(p[3]).payload.selection){
   f.calls.push(sql);storeCalls++;if(cap)throw Object.assign(Error('PROJECT_STORAGE_QUOTA_EXCEEDED'),{code:'P0001'});
   const saved=f.state().commands.at(-1),snapshot=JSON.parse(p[7]),r=JSON.parse(p[6]);assert.equal(snapshot.purpose,'NORMAL_UNDERSTANDING_FIXED_RANGE_REQUEST');assert.deepEqual(snapshot.sourceScope,selection);
   assert.equal(r.contentHash,hash(snapshot));assert.deepEqual(saved.result_ref.data.snapshot,snapshot);
   // 기존 목적 SQL 원자 저장/정산의 RAM 대역이며 실제 SQL/lock/ACL을 증명하지 않는다.
   if(f.state().commands.some((c:any)=>c!==saved&&c.result_ref.data.snapshot?.sourceScope?.requestRef.id===selection.requestRef.id))throw Object.assign(Error('NORMAL_UNDERSTANDING_RANGE_PENDING'),{code:'P0001'});
   charged+=BigInt(Buffer.byteLength(canonicalJson(saved.result_ref)));if(afterStore)current=true;
   return{rows:[{stored:r}]};
  }
  if(sql.startsWith('SELECT * FROM anvil.fn09_normal_understanding_request_replay')&&JSON.parse(p[3]).payload.selection){
   f.calls.push(sql);const saved=f.state().commands.find((c:any)=>c.command_key===JSON.parse(p[3]).commandId);
   if(!saved)return{rows:[]};const snapshot=structuredClone(saved.result_ref.data.snapshot);if(corrupt)snapshot.sourceScope.lastSequence++;
   return{rows:[{id:saved.result_ref.data.ref.id,content_hash:saved.result_ref.data.ref.contentHash,snapshot_json:snapshot,result_ref:saved.result_ref,complete:!corrupt}]};
  }
  return original(sql,p);
 };
 return{...f,q,selection,runRange:(value:unknown=q)=>new mod.NormalUnderstandingReadRequests(f.access).command(f.token,f.csrf,value),
  charge:()=>charged,stores:()=>storeCalls,expire:()=>{current=true;},afterStore:()=>{afterStore=true;},cap:()=>{cap=true;},missing:()=>{missing=true;},corrupt:()=>{corrupt=true;},committedUnknown:()=>{preserveCommit=true;f.unknown(true);}};
}
test('FN09 fixed range saves only original metadata scope in C/A/U; same command reconfirmation has no extra charge or disclosure',async()=>{
 const f=fixedRangeFixture(),first=await f.runRange();assert.equal(first.data.status,'NORMAL_UNDERSTANDING_RANGE_REQUESTED');assert.equal(first.data.state,'PENDING_SOURCE');
 assert.equal(first.data.snapshot,undefined);assert.equal(first.data.sourceAvailable,false);assert.equal(first.data.selectionAvailable,false);assert.equal(f.state().requests.length,0);
 const charged=f.charge();f.expire();assert.deepEqual(await f.runRange(),first);assert.equal(f.charge(),charged);assert.equal(f.stores(),1);
 assert.equal(f.state().commands.length,1);assert.ok(!JSON.stringify(first).includes('sessionId'));
});

test('FN09 new fixed range caps selected text sum at 2MiB before any C/A/U or storage charge',async()=>{
 for(const extra of [0,1]){
  const f=fixedRangeFixture();f.selection.ranges[0]!.textBytes=1048576;f.selection.ranges[1]!.textBytes=1048576+extra;
  if(extra){await assert.rejects(f.runRange(),{message:'INPUT_INVALID',statusCode:422});assert.equal(f.state().commands.length,0);assert.equal(f.stores(),0);assert.equal(f.charge(),0n);assert.equal(f.calls.some(s=>s.startsWith('INSERT INTO')),false);}
  else{const saved=await f.runRange();assert.equal(saved.data.status,'NORMAL_UNDERSTANDING_RANGE_REQUESTED');assert.equal(f.stores(),1);assert.ok(f.charge()>0n);const charge=f.charge();assert.deepEqual(await f.runRange(),saved);assert.equal(f.stores(),1);assert.equal(f.charge(),charge);}
 }
});

test('FN09 exact historical fixed-range command replay retains old selected sum and adds zero writes or charge',async()=>{
 const f=fixedRangeFixture();await f.runRange();
 // 이전 구현이 저장한 완결 행을 RAM에 구성한다. SQL 역사 검산/정산은 별도 정적 시험으로 유지한다.
 f.selection.ranges[0]!.textBytes=1048576;f.selection.ranges[1]!.textBytes=1048577;
 const saved=f.state().commands[0],snapshot=saved.result_ref.data.snapshot;
 snapshot.request=structuredClone(f.q);snapshot.sourceScope=structuredClone(f.selection);
 const reference={...saved.result_ref.data.ref,contentHash:hash(snapshot)};
 saved.result_ref.data.ref=reference;saved.result_ref.data.requestRef=reference;saved.request_hash=hash(f.q);
 f.expire();const charge=f.charge(),before=f.calls.length,result=await f.runRange();
 assert.deepEqual(result.data.requestRef,reference);assert.equal(result.data.snapshot,undefined);assert.equal(f.stores(),1);assert.equal(f.charge(),charge);
 assert.equal(f.calls.slice(before).some(s=>s.startsWith('INSERT INTO')||s.startsWith('SELECT anvil.fn09_normal_understanding_metadata_current')),false);
});

test('FN09 fixed range fixture keeps metadata on its original DB clock after scheduler delay',async t=>{
 const f=fixedRangeFixture(),{rows}=await f.db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id');
 // 대기 이후 wall clock만 2초 진행해도 고정 DB 관측보다 미래인 metadata를 새로 만들면 안 된다.
 t.mock.method(Date,'now',()=>rows[0].at.getTime()+2000);
 const result=await f.runRange();assert.equal(result.data.status,'NORMAL_UNDERSTANDING_RANGE_REQUESTED');assert.equal(f.stores(),1);assert.ok(f.charge()>0n);
});
test('FN09 fixed range refuses skipped sequence, changed row/fullref and raw fields without adding a command',async()=>{
 for(const alter of [(s:any)=>{s.ranges[1].sequence=5;s.lastSequence=5;},(s:any)=>{s.ranges[0].payloadDigest='d'.repeat(64);},
  (s:any)=>{s.resultRef=ref(98);},(s:any)=>{s.ranges[0].outputRef=s.initConfirmationRef;},(s:any)=>{s.raw='forbidden';}]){
  const f=fixedRangeFixture(),q=structuredClone(f.q);alter(q.payload.selection);await assert.rejects(f.runRange(q));assert.equal(f.state().commands.length,0);assert.equal(f.charge(),0n);
 }
 const f=fixedRangeFixture();await f.runRange();const other=structuredClone(f.q);other.payload.selection.lastSequence=3;other.payload.selection.ranges.pop();
 await assert.rejects(f.runRange(other),{message:'IDEMPOTENCY_CONFLICT',statusCode:409});assert.equal(f.stores(),1);
});
test('FN09 fixed range current denial, unknown commit and partial charge never return pending success',async()=>{
 for(const alter of [(f:ReturnType<typeof fixedRangeFixture>)=>f.deny(),(f:ReturnType<typeof fixedRangeFixture>)=>f.stale(),
  (f:ReturnType<typeof fixedRangeFixture>)=>f.missing(),(f:ReturnType<typeof fixedRangeFixture>)=>f.cap(),
  (f:ReturnType<typeof fixedRangeFixture>)=>f.afterStore(),(f:ReturnType<typeof fixedRangeFixture>)=>f.unknown()]){
  const f=fixedRangeFixture();alter(f);await assert.rejects(f.runRange());assert.equal(f.state().commands.length,0);assert.equal(f.charge(),0n);assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);
 }
 const f=fixedRangeFixture();await f.runRange();f.corrupt();await assert.rejects(f.runRange());assert.equal(f.stores(),1);
});

test('FN09 fixed range serializes competing HUMAN commands and exact replay on the original transaction port',async()=>{
 for(const identical of [true,false]){
  const f=fixedRangeFixture();let tail=Promise.resolve();
  // RAM에서는 원 PoolClient 거래 전체를 직렬화한다. 실제 PG project FOR UPDATE/CAS는 정적 검산 및 별도 실행 대상이다.
  f.pool.connect=async()=>{const before=tail;let unlock!:()=>void;tail=new Promise<void>(resolve=>{unlock=resolve;});await before;return {query:f.db.query,release:()=>{f.db.release();unlock();}};};
  const second=structuredClone(f.q);if(!identical)second.commandId=id(90);
  const results=await Promise.allSettled([f.runRange(),f.runRange(second)]);
  assert.equal(results[0]!.status,'fulfilled');assert.equal(results[1]!.status,identical?'fulfilled':'rejected');
  if(identical)assert.deepEqual((results[0] as PromiseFulfilledResult<any>).value,(results[1] as PromiseFulfilledResult<any>).value);
  else assert.equal((results[1] as PromiseRejectedResult).reason.message,'NORMAL_UNDERSTANDING_RANGE_PENDING');
  assert.equal(f.state().commands.length,1);assert.equal(f.state().requests.length,0);assert.ok(f.charge()>0n);
  const charged=f.charge();assert.deepEqual(await f.runRange(),(results[0] as PromiseFulfilledResult<any>).value);assert.equal(f.charge(),charged);
 }
});

test('FN09 fixed range lost COMMIT response never publishes success or retries; explicit same command recheck adds zero charge',async()=>{
 const f=fixedRangeFixture();f.committedUnknown();
 await assert.rejects(f.runRange(),{message:'NORMAL_UNDERSTANDING_RANGE_OUTCOME_UNKNOWN',statusCode:503});
 assert.equal(f.state().commands.length,1);assert.equal(f.stores(),1);assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);
 const charged=f.charge();assert.ok(charged>0n);f.recover();f.expire();
 const saved=await f.runRange();assert.equal(saved.data.status,'NORMAL_UNDERSTANDING_RANGE_REQUESTED');assert.equal(saved.data.snapshot,undefined);
 assert.equal(f.stores(),1);assert.equal(f.state().commands.length,1);assert.equal(f.charge(),charged);
});

test('FN09 fixed range reaches the existing HUMAN POST and reconfirms only the same command without source text or private snapshot',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');const f=fixedRangeFixture(),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.test'});
 const url=`/api/v1/projects/${f.pid}/executions/${f.q.targetId}/understanding-response-read-requests`,headers={host:'anvil.test',origin:'https://anvil.test',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 try{
  const first=await app.inject({method:'POST',url,headers,payload:f.q});assert.equal(first.statusCode,200,first.body);assert.equal(first.headers['cache-control'],'no-store');
  assert.equal(first.json().data.status,'NORMAL_UNDERSTANDING_RANGE_REQUESTED');assert.equal(first.json().data.snapshot,undefined);
  const charge=f.charge();f.expire();const again=await app.inject({method:'POST',url,headers,payload:f.q});assert.equal(again.statusCode,200,again.body);assert.deepEqual(again.json(),first.json());assert.equal(f.charge(),charge);
  for(const patch of [{url:url+'?extra=1'},{headers:{...headers,authorization:'Bearer ignored'}},{headers:{...headers,origin:'https://outside.test'}},
   {headers:{host:headers.host,origin:headers.origin,cookie:headers.cookie}},{payload:{...f.q,targetId:id(99)}}]){
   const count=f.calls.length,r=await app.inject({method:'POST',url,headers,payload:f.q,...patch});assert.ok(r.statusCode>=400,r.body);assert.equal(f.calls.length,count);
  }
  const q=structuredClone(f.q);q.payload.selection.ranges[0]!.textBytes++;const bad=await app.inject({method:'POST',url,headers,payload:q});assert.equal(bad.statusCode,409,bad.body);
  assert.equal(f.stores(),1);assert.equal(f.state().requests.length,0);assert.ok(!first.body.includes('sessionId'));
 }finally{await app.close();}
});

test('FN09 UI04 range commands reach the real HUMAN POST; response loss after COMMIT recovers the same bytes with one storage charge',async()=>{
 const [{buildApp},{build},{fileURLToPath},{ApiClient}]=await Promise.all([
  import('../../../apps/server/app.ts'),import('vite'),import('node:url'),import('../../../apps/web/src/api/client.ts')]);
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/workspace/NormalUnderstandingDiscovery.tsx',import.meta.url));
 const built=await build({configFile:false,logLevel:'error',build:{write:false,lib:{entry,formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
 const output=Array.isArray(built)?built[0]:built;assert.ok(output&&'output'in output);
 const chunk=output.output.find(value=>value.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
 const code=chunk.code.replace(/(["'])(react(?:\/jsx-runtime)?)\1/g,(_match,_quote,name)=>JSON.stringify(import.meta.resolve(name)));
 const ui:typeof import('../../../apps/web/src/features/workspace/NormalUnderstandingDiscovery.tsx')=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const f=fixedRangeFixture(),query=f.db.query,now=new Date();
 // 기존 project 상세 GET도 실제 handler를 지나며, 빈 프로젝트의 두 조회만 같은 RAM PG에 보충한다.
 f.db.query=async(sql:string,params:any[]=[])=>{
  if(sql.startsWith('SELECT p.*,m.participation,pc.actor_id')){f.calls.push(sql);assert.deepEqual(params,[f.pid,id(2)]);return {rows:[{
   id:f.pid,name:'RAM FN09',purpose:'boundary',desired_outcome:'one request',version:1,created_at:now,updated_at:now,participation:'OWNER',
   actor_id:id(2),client_id:f.q.clientId,generation:1,control_version:1,controller_status:'ACTIVE',policy_id:id(30),setup_copy_records:0}]};}
  if(sql.startsWith('SELECT b.*,c.operation,c.actor_id,c.client_id command_client FROM anvil.project_source_declarations')){f.calls.push(sql);return {rows:[]};}
  return query(sql,params);
 };
 const app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.test'}),bodies:string[]=[],responses:any[]=[];let controlReads=0;
 const path=`/api/v1/projects/${f.pid}/executions/${f.q.targetId}/understanding-response-read-requests`;
 const transport:typeof fetch=async(input,options)=>{
  const url=String(input),method=options?.method;assert.equal(options?.credentials,'same-origin');assert.equal(options?.cache,'no-store');assert.equal(options?.redirect,'error');
  const headers=Object.fromEntries(new Headers(options?.headers));
  if(method==='GET'){assert.equal(url,`/api/v1/projects/${f.pid}`);controlReads++;}
  else {assert.equal(method,'POST');assert.equal(url,path);assert.equal(headers['x-anvil-csrf'],f.csrf);bodies.push(String(options?.body));}
  const response=await app.inject({method:method as 'GET'|'POST',url,headers:{...headers,host:'anvil.test',cookie:'__Host-anvil.sid='+f.token,...(method==='POST'?{origin:'https://anvil.test'}:{})},...(method==='POST'?{payload:String(options?.body)}:{})});
  assert.equal(response.statusCode,200,response.body);
  if(method==='POST'){
   responses.push(response.json());assert.equal(f.state().commands.length,1);assert.equal(f.stores(),1);
   assert.equal(f.calls.filter(sql=>sql==='COMMIT').length,controlReads+bodies.length);
   // 서버가 정상 COMMIT/응답한 다음 브라우저 transport에서만 응답을 잃는다. 서버 rollback/가짜 ACK는 사용하지 않는다.
   if(bodies.length===1)throw Error('RAM_RESPONSE_LOST_AFTER_COMMIT');
  }
  return new Response(response.body,{status:response.statusCode,headers:{'content-type':String(response.headers['content-type'])}});
 };
 const client=new ApiClient(transport),session={user:{id:id(2)},clientId:f.q.clientId,csrfToken:f.csrf},signal=new AbortController().signal;
 const origin={projectId:f.pid,executionId:f.q.targetId,executionGeneration:f.q.expectedVersion,assignmentRef:f.q.payload.assignmentRef,preparationRef:f.q.payload.preparationRef,requestRef:f.selection.requestRef};
 const {requestRef:_,...selection}=f.selection,draft={request:origin,contextBundleRef:f.context.contextBundleRef,...selection};
 const assignmentKey=canonicalJson(origin.assignmentRef),key=canonicalJson([origin.projectId,origin.executionId,origin.executionGeneration,f.q.payload]);
 const commands=ui.createNormalUnderstandingRangeCommands(client,session,f.pid,assignmentKey,()=>true);
 try{
  await assert.rejects(commands.request(draft,signal,()=>true),{code:'CONNECTION_LOST'});
  const charged=f.charge();assert.ok(charged>0n);assert.equal(bodies.length,1);assert.equal(controlReads,1);assert.equal(f.calls.includes('ROLLBACK'),false);
  await assert.rejects(commands.request(draft,signal,()=>true),{code:'NORMAL_UNDERSTANDING_RANGE_ORIGINAL_REQUIRED'});assert.equal(bodies.length,1);assert.equal(controlReads,1);
  f.expire();const restored=ui.createNormalUnderstandingRangeCommands(client,{...session,user:{...session.user}},f.pid,assignmentKey,()=>true);
  const requestRef=await restored.recover(key,signal);
  assert.equal(bodies.length,2);assert.equal(controlReads,2);assert.equal(bodies[1],bodies[0]);assert.equal(JSON.parse(bodies[1]!).commandId,JSON.parse(bodies[0]!).commandId);
  assert.deepEqual(JSON.parse(bodies[0]!),{...f.q,commandId:JSON.parse(bodies[0]!).commandId});assert.deepEqual(responses[1],responses[0]);assert.deepEqual(requestRef,responses[0].data.requestRef);
  assert.equal(f.stores(),1);assert.equal(f.state().commands.length,1);assert.equal(f.state().requests.length,0);assert.equal(f.charge(),charged);assert.equal(f.calls.includes('ROLLBACK'),false);
  assert.deepEqual(await restored.request(draft,signal,()=>true),requestRef);assert.equal(bodies.length,2);assert.equal(controlReads,2);
  assert.equal(responses[1].data.snapshot,undefined);assert.equal(responses[1].data.sourceAvailable,false);assert.equal(responses[1].data.selectionAvailable,false);
 }finally{await app.close();}
});
test('FN09 current DENY/control loss and REQUIRE_APPROVAL reject before request or receipt writes',async()=>{
 for(const alter of [(f:any)=>f.deny(),(f:any)=>f.stale(),(f:any)=>{f.rules[0].disposition='REQUIRE_APPROVAL';}]){const f=fixture();alter(f);await assert.rejects(f.run());assert.equal(f.calls.some(s=>s.startsWith('INSERT')||s.includes('request_insert')),false);}
});
test('FN09 receipt/request insertion failure rolls back; uncertain COMMIT never returns pending success or retries',async()=>{
 for(const alter of [(f:any)=>f.fail(),(f:any)=>f.unknown()]){const f=fixture();alter(f);await assert.rejects(f.run());assert.equal(f.state().requests.length,0);assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);assert.equal(f.calls.at(-1),'RELEASE');}
});
test('FN09 general project command cannot create or replay the dedicated request',async()=>{
 const f=fixture();await assert.rejects(new ProjectPolicyRepository(f.access).command(f.token,f.csrf,f.request()),/NORMAL_UNDERSTANDING_REQUEST_ROUTE_REQUIRED/);assert.deepEqual(f.calls,[]);
});
test('FN09 original stored source context must match on replay',async()=>{const f=fixture();await f.run();f.change();await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_REQUEST/);assert.equal(f.state().requests.length,1);});
test('FN09 missing stored basis/query replacement reject before writes; source change after insert rolls back',async()=>{
 for(const action of ['missing','swap','lateChange'] as const){const f=fixture();f[action]();await assert.rejects(f.run(),/NORMAL_UNDERSTANDING_REQUEST/);assert.equal(f.state().requests.length,0);assert.equal(f.calls.includes('COMMIT'),false);if(action!=='lateChange')assert.equal(f.calls.some(s=>s.startsWith('INSERT')),false);}
});

test('FN09 actual Access Date reauthentication is required and its expiry is bounded',async()=>{const f=fixture();assert.equal((await f.run()).data.state,'PENDING_SOURCE');for(const mode of ['NONE','EXPIRED']){const f=fixture(mode);await assert.rejects(f.run(),/REAUTHENTICATION_REQUIRED/);assert.equal(f.calls.some(s=>s.startsWith('INSERT')||s.includes('request_insert')),false);}});

test('FN09 actual buildApp inject reaches dedicated metadata request and blocks mixed identity/cross project/query',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');const f=fixture(),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.test'});
 const url='/api/v1/projects/'+f.pid+'/executions/'+f.request().targetId+'/understanding-response-read-requests',headers={host:'anvil.test',origin:'https://anvil.test',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 try{const response=await app.inject({method:'POST',url,headers,payload:f.request()});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().data.state,'PENDING_SOURCE');const writes=f.state().commands.length;for(const patch of [{url:url+'?next=1'},{headers:{...headers,authorization:'Bearer ignored'}},{payload:{...f.request(),projectId:id(99)}}]){const r=await app.inject({method:'POST',url,headers,payload:f.request(),...patch});assert.ok(r.statusCode>=400);assert.equal(f.state().commands.length,writes);}}finally{await app.close();}
});

test('FN09 readiness exposes only exact bound execution coordinates and writes no request or authorization',async()=>{
 const f=fixture(),value=await f.readiness(),{projectId,executionId,executionGeneration,assignmentRef,preparationRef}=f.context;
 assert.deepEqual(value,{projectId,executionId,executionGeneration,assignmentRef,preparationRef,observedAt:value.observedAt,expiresAt:value.expiresAt});
 assert.ok(Date.parse(value.expiresAt)>Date.parse(value.observedAt));
 assert.equal(f.calls.filter(s=>s.startsWith('SELECT anvil.fn09_normal_understanding_request_basis')).length,2);
 assert.equal(f.calls.filter(s=>s.startsWith('SELECT e.id AS execution_id')).length,2);
 assert.equal(f.calls.some(s=>s.startsWith('INSERT')||s.includes('request_insert')),false);
 assert.equal(f.state().requests.length,0);
});

test('FN09 readiness hides ambiguous, changed, absent, unauthorized and unconfirmed candidates',async()=>{
 for(const modify of [(f:ReturnType<typeof fixture>)=>f.candidates(0),(f:ReturnType<typeof fixture>)=>f.candidates(2),
  (f:ReturnType<typeof fixture>)=>f.changeSelection(),(f:ReturnType<typeof fixture>)=>f.missing(),(f:ReturnType<typeof fixture>)=>f.deny(),
  (f:ReturnType<typeof fixture>)=>f.stale(),(f:ReturnType<typeof fixture>)=>f.swap(),(f:ReturnType<typeof fixture>)=>f.unknown()]){
  const f=fixture();modify(f);await assert.rejects(f.readiness());
  assert.equal(f.calls.some(s=>s.startsWith('INSERT')||s.includes('request_insert')),false);
 }
});

test('FN09 HUMAN current metadata uses original authenticated transaction without creating a command',async()=>{
 const f=fixture(),requestRef=ref(60),request={requestRef,projectId:f.pid,executionId:f.context.executionId,executionGeneration:1,assignmentRef:f.context.assignmentRef,preparationRef:f.context.preparationRef};
 const original=f.db.query;let reads=0;
 f.db.query=async(sql:string,p:any[]=[])=>{
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_metadata_current')){
   reads++;assert.deepEqual(JSON.parse(p[3]),{...request,controlGeneration:1});assert.equal(p[5],'17');
   return {rows:[{projection:{status:'PENDING_SOURCE',request}}]};
  }
  return original(sql,p);
 };
 const result=await new mod.NormalUnderstandingReadRequests(f.access).current(f.token,f.csrf,{...request,controlGeneration:1});
 assert.deepEqual(result,{status:'PENDING_SOURCE',request});assert.equal(reads,2);
 assert.equal(f.calls.some(s=>s.startsWith('INSERT')||s.includes('request_insert')),false);
 assert.equal(f.calls.filter(s=>s==='COMMIT').length,1);
});

function rangeCurrentFixture(reauthMode='CURRENT'){
 const f=fixture(reauthMode),request={requestRef:ref(70),projectId:f.pid,executionId:f.context.executionId,executionGeneration:1,assignmentRef:f.context.assignmentRef,preparationRef:f.context.preparationRef};
 const selection={...request,controlGeneration:1},part={outputRef:ref(74),sequence:1,payloadDigest:'b'.repeat(64),blockIndex:0,kind:'ASSISTANT_TEXT',text:'한정 원문',textHash:contentHash('한정 원문')};
 const body={schemaVersion:1,kind:'FIXED_RANGE_SELECTION',attribution:'SESSION_ONLY',projectId:f.pid,executionId:request.executionId,executionGeneration:1,
  requestRef:request.requestRef,acquisitionRef:ref(71),sourceRequestRef:ref(72),sourceResultRef:ref(73),contextBundleRef:{...f.context.contextBundleRef,version:4},
  initConfirmationRef:ref(75),tailRef:part.outputRef,firstSequence:1,lastSequence:1,beforeRef:null,afterRef:null,parts:[part],wholeConversationComplete:false,executionAuthorized:false};
 const stored={status:'RANGE_STORED',request,resultRef:ref(76),responseRef:{...ref(77),contentHash:hash(body)},partRefs:[{...ref(78),contentHash:hash(part)}],
  currentness:'CURRENT',observedAt:new Date(f.clockAt-1).toISOString(),expiresAt:new Date(f.clockAt+20000).toISOString(),selectionAvailable:true,body};
 const original=f.db.query;let reads=0,project:(n:number)=>any=()=>structuredClone(stored);
 f.db.query=async(sql:string,p:any[]=[])=>{
  if(sql.startsWith('SELECT s.*,u.id AS uid')&&p[0]!==createHash('sha256').update(f.token).digest('hex')){f.calls.push(sql);return {rows:[]};}
  if(sql.startsWith('SELECT p.id,p.archived_at')&&p[0]!==f.pid){f.calls.push(sql);return {rows:[]};}
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_metadata_current')){f.calls.push(sql);assert.deepEqual(JSON.parse(p[3]),{...selection,purpose:'FIXED_RANGE_CURRENT'});assert.equal(p[5],'17');return {rows:[{projection:project(++reads)}]};}
  return original(sql,p);
 };
 return {...f,request,selection,stored,reads:()=>reads,projection:(fn:typeof project)=>{project=fn;},current:()=>new mod.NormalUnderstandingReadRequests(f.access).currentRange(f.token,f.csrf,selection)};
}

test('FN09 고정 범위 HUMAN current는 같은 인증 거래의 정착 원문만 반환하고 쓰기나 자동 선택을 하지 않는다',async()=>{
 const f=rangeCurrentFixture();assert.deepEqual(await f.current(),f.stored);assert.equal(f.reads(),2);assert.equal(f.calls.filter(s=>s==='COMMIT').length,1);
 assert.equal(f.calls.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)),false);
 for(const status of ['PENDING_SOURCE','CURRENT_UNAVAILABLE']){const f=rangeCurrentFixture();f.projection(()=>({status,request:f.request}));assert.deepEqual(await f.current(),{status,request:f.request});}
});

test('FN09 고정 범위 current는 원 로그인/CSRF·OWNER/control·AUTO 권한·재인증을 원문 RPC 전에 요구한다',async()=>{
 for(const mode of ['token','csrf','project','deny','control','approval','reauth-none','reauth-expired']){
  const f=rangeCurrentFixture(mode==='reauth-none'?'NONE':mode==='reauth-expired'?'EXPIRED':'CURRENT');let token=f.token,csrf=f.csrf,selection=f.selection;
  if(mode==='token')token='z'.repeat(43);if(mode==='csrf')csrf='z'.repeat(43);if(mode==='project')selection={...selection,projectId:id(99)};
  if(mode==='deny')f.deny();if(mode==='control')f.stale();if(mode==='approval')f.rules[0].disposition='REQUIRE_APPROVAL';
  await assert.rejects(new mod.NormalUnderstandingReadRequests(f.access).currentRange(token,csrf,selection));assert.equal(f.reads(),0);assert.equal(f.calls.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)),false);
 }
});

test('FN09 고정 범위 current는 오염·교체·부분정착·만료와 늦은 권한/COMMIT 불명을 원문 없이 거절한다',async()=>{
 const changes=[(v:any)=>{v.request.requestRef=ref(99);},(v:any)=>{v.body.requestRef=ref(99);},(v:any)=>{v.body.contextBundleRef=null;},
  (v:any)=>{v.body.parts[0].textHash='0'.repeat(64);},(v:any)=>{v.body.parts[0].kind='SYSTEM_INIT';},(v:any)=>{v.body.parts[0].blockIndex=1;},
  (v:any)=>{v.body.parts[0].text='\ud800';},(v:any)=>{v.body.parts.push({...v.body.parts[0]});},(v:any)=>{v.partRefs[0].contentHash='0'.repeat(64);},
  (v:any)=>{v.body.beforeRef=v.body.tailRef;},(v:any)=>{v.body.parts[0].outputRef=v.body.initConfirmationRef;},(v:any)=>{v.body.raw='not-public';},
  (v:any)=>{v.currentness='HISTORICAL';},(v:any)=>{v.expiresAt=new Date(0).toISOString();},(v:any)=>{v.body.executionAuthorized=true;}];
 for(const change of changes){const f=rangeCurrentFixture();f.projection(()=>{const v=structuredClone(f.stored);change(v);v.responseRef.contentHash=hash(v.body);return v;});
  await assert.rejects(f.current(),{message:'NORMAL_UNDERSTANDING_RANGE_UNKNOWN',statusCode:503});assert.equal(f.reads(),1);assert.equal(f.calls.includes('COMMIT'),false);}
 for(const mode of ['between','query','partial','database','commit','late-deny'] as const){const f=rangeCurrentFixture();
  if(mode==='commit')f.unknown();else f.projection(n=>{if(mode==='partial')throw Object.assign(Error('NORMAL_UNDERSTANDING_RANGE_INTEGRITY_FAILED'),{code:'P0001'});
   if(mode==='database')throw Error('PRIVATE_SQL_BODY');if(mode==='query'){const q=f.db.query;f.db.query=(...args:any[])=>q(...args);}if(mode==='late-deny')f.deny();
   const v=structuredClone(f.stored);if(mode==='between'&&n===2)v.resultRef=ref(99);return v;});
  await assert.rejects(f.current(),{message:mode==='late-deny'?'PROJECT_OPERATION_DENIED':'NORMAL_UNDERSTANDING_RANGE_UNKNOWN',statusCode:mode==='late-deny'?403:503});
  assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);assert.equal(f.calls.at(-1),'RELEASE');
 }
 for(const [code,statusCode]of [['NORMAL_UNDERSTANDING_RANGE_NOT_FOUND',404],['NORMAL_UNDERSTANDING_RANGE_CURRENT_REQUIRED',412],['PROJECT_OPERATION_DENIED',403],['REAUTHENTICATION_REQUIRED',412]] as const){
  const f=rangeCurrentFixture();f.projection(()=>{throw Object.assign(Error(code),{code:'P0001'});});await assert.rejects(f.current(),{message:code,statusCode});
 }
});

test('FN09 고정 범위 부재와 고아 quota/손상 purpose/후속 원장의 무결성 오류는 HUMAN HTTP에서 구별된다 · SQL 대역',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');
 for(const mode of ['absent','metadata-rid','quota-orphan','purpose-corrupt','v1-orphan','v2-orphan','receipt-orphan','body-orphan']){
  const absent=mode==='absent'||mode==='metadata-rid',f=rangeCurrentFixture();
  if(mode==='metadata-rid')f.state().commands.push({result_ref:{targetId:f.request.requestRef.id,data:{ref:f.request.requestRef,requestRef:f.request.requestRef,status:'NORMAL_UNDERSTANDING_METADATA_REQUESTED',snapshot:{purpose:'NORMAL_UNDERSTANDING_METADATA_DISCOVERY',request:{payload:{assignmentRef:f.request.assignmentRef,preparationRef:f.request.preparationRef}},sourceScope:null}}}});
  f.projection(()=>{throw Object.assign(Error(absent?'NORMAL_UNDERSTANDING_RANGE_NOT_FOUND':'NORMAL_UNDERSTANDING_RANGE_INTEGRITY_FAILED'),{code:'P0001'});});
  const app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.test'}),r=f.request,q=new URLSearchParams({controlGeneration:'1',executionGeneration:'1',requestVersion:'1',requestHash:r.requestRef.contentHash,assignmentId:r.assignmentRef.id,assignmentVersion:'1',assignmentHash:r.assignmentRef.contentHash,preparationId:r.preparationRef.id,preparationVersion:'1',preparationHash:r.preparationRef.contentHash});
  try{const response=await app.inject({method:'GET',url:`/api/v1/projects/${f.pid}/executions/${r.executionId}/understanding-response-read-requests/${r.requestRef.id}/range-current?${q}`,headers:{host:'anvil.test',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf}});
   assert.equal(response.statusCode,absent?404:503,mode);assert.equal(response.json().code,absent?'NORMAL_UNDERSTANDING_RANGE_NOT_FOUND':'NORMAL_UNDERSTANDING_RANGE_UNKNOWN');
   assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.body.includes(f.stored.resultRef.id),false);assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.reads(),1);
  }finally{await app.close();}
 }
});

test('FN09 고정 범위 실제 HUMAN GET의 전체 응답은 정확 2MiB 수용/+1 거절하고 혼합 채널은 SQL 전 차단한다',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');
 for(const extra of [0,1]){const f=rangeCurrentFixture(),v=f.stored;
  v.body.parts[0]!.text='';v.body.parts[0]!.textHash=contentHash('');v.responseRef.contentHash=hash(v.body);v.partRefs[0]!.contentHash=hash(v.body.parts[0]);
  const overhead=Buffer.byteLength(canonicalJson(v));v.body.parts[0]!.text='x'.repeat(2097152-overhead+extra);v.body.parts[0]!.textHash=contentHash(v.body.parts[0]!.text);
  v.partRefs[0]!.contentHash=hash(v.body.parts[0]);v.responseRef.contentHash=hash(v.body);assert.equal(Buffer.byteLength(canonicalJson(v)),2097152+extra);
  const app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.test'}),r=f.request;
  const query=new URLSearchParams({controlGeneration:'1',executionGeneration:'1',requestVersion:'1',requestHash:r.requestRef.contentHash,assignmentId:r.assignmentRef.id,assignmentVersion:'1',assignmentHash:r.assignmentRef.contentHash,preparationId:r.preparationRef.id,preparationVersion:'1',preparationHash:r.preparationRef.contentHash});
  const path=`/api/v1/projects/${f.pid}/executions/${r.executionId}/understanding-response-read-requests/${r.requestRef.id}/range-current`,url=path+'?'+query,headers={host:'anvil.test',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
  try{const reply=await app.inject({method:'GET',url,headers});assert.equal(reply.statusCode,extra?413:200,reply.body.slice(0,200));assert.equal(reply.headers['cache-control'],'no-store');
   if(!extra){assert.equal(Buffer.byteLength(reply.body),2097152);assert.deepEqual(reply.json(),v);assert.equal(f.reads(),2);}else{assert.equal(reply.json().code,'NORMAL_UNDERSTANDING_RANGE_RESPONSE_TOO_LARGE');assert.equal(f.reads(),1);assert.equal(f.calls.includes('COMMIT'),false);}
   const count=f.calls.length;
   for(const patch of [{method:'HEAD' as const},{url:url+'&extra=1'},{url:url+'&requestHash='+r.requestRef.contentHash},{url:url.replace('/range-current','/%72ange-current')},
    {headers:{...headers,authorization:'Bearer forbidden'}},{headers:{...headers,origin:'https://outside.test'}},{headers:{...headers,'content-length':'0'}},
    {headers:{host:headers.host,cookie:headers.cookie}},{url:url.replace('requestVersion=1','requestVersion=2')}]){const rejected=await app.inject({method:'GET',url,headers,...patch});assert.ok(rejected.statusCode>=400);}
   assert.equal(f.calls.length,count);assert.equal(f.calls.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)),false);
  }finally{await app.close();}
 }
});

test('FN09 고정 범위 current의 기한은 조회 전 wall/mono에 묶이고 정상 COMMIT 뒤 늦은 결과도 폐기한다',async t=>{
 for(const mode of ['query','commit']){const f=rangeCurrentFixture(),base=Date.now();let wall=base,mono=100,clocks=0;
  f.stored.expiresAt=new Date(f.clockAt+1000).toISOString();const original=f.db.query;
  f.db.query=async(sql:string,p:any[]=[])=>{const r=await original(sql,p);if(mode==='query'&&sql==='SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id'&&++clocks===4||mode==='commit'&&sql==='COMMIT'){wall+=1500;mono+=1500;}return r;};
  t.mock.method(Date,'now',()=>wall);t.mock.method(performance,'now',()=>mono);
  try{await assert.rejects(f.current(),{message:'NORMAL_UNDERSTANDING_RANGE_UNKNOWN',statusCode:503});assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);if(mode==='query')assert.equal(f.calls.includes('COMMIT'),false);}finally{t.mock.restoreAll();}
 }
});

function currentFixture(reauthMode='CURRENT'){
 const f=fixture(reauthMode),request={requestRef:ref(60),projectId:f.pid,executionId:f.context.executionId,executionGeneration:1,
  assignmentRef:f.context.assignmentRef,preparationRef:f.context.preparationRef};
 const selection={...request,controlGeneration:1},original=f.db.query;let readCount=0;
 const stored={status:'METADATA_STORED',request,resultRef:ref(61),currentness:'CURRENT',observedAt:new Date(Date.now()-500).toISOString(),
  expiresAt:new Date(Date.now()+25000).toISOString(),selectionAvailable:false,
  metadata:{contextBundleRef:f.context.contextBundleRef,initConfirmationRef:ref(62),tailRef:ref(63),attribution:'SESSION_ONLY',wholeConversationComplete:false,
   ranges:[{outputRef:ref(63),sequence:3,payloadDigest:'b'.repeat(64),textBlocks:1,textBytes:12}]}};
 let project:(n:number)=>unknown=()=>structuredClone(stored);
 f.db.query=async(sql:string,p:any[]=[])=>{
  if(sql.startsWith('SELECT s.*,u.id AS uid')&&p[0]!==createHash('sha256').update(f.token).digest('hex')){f.calls.push(sql);return {rows:[]};}
  if(sql.startsWith('SELECT p.id,p.archived_at')&&p[0]!==f.pid){f.calls.push(sql);return {rows:[]};}
  if(sql.startsWith('SELECT anvil.fn09_normal_understanding_metadata_current')){
   if(p[0]!==id(4)||p[1]!==id(2)||p[2]!==id(3))throw Object.assign(Error('NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED'),{code:'P0001'});
   f.calls.push(sql);assert.deepEqual(JSON.parse(p[3]),selection);assert.equal(p[5],'17');
   return {rows:[{projection:project(++readCount)}]};
  }
  return original(sql,p);
 };
 return {...f,selection,stored,request,reads:()=>readCount,projection:(fn:typeof project)=>{project=fn;},
  current:()=>new mod.NormalUnderstandingReadRequests(f.access).current(f.token,f.csrf,selection)};
}

test('FN09 current metadata returns only settled projection, preserves pending/unavailable, and never writes or retries',async()=>{
 for(const status of ['METADATA_STORED','PENDING_SOURCE','CURRENT_UNAVAILABLE']){
  const f=currentFixture();if(status!=='METADATA_STORED')f.projection(()=>({status,request:f.request}));
  const result=await f.current();assert.equal(result.status,status);assert.deepEqual(result.request,f.request);
  if(status==='METADATA_STORED'){
   assert.deepEqual(result.metadata,f.stored.metadata);assert.deepEqual(result.resultRef,f.stored.resultRef);
   assert.equal(result.selectionAvailable,false);assert.ok(Date.parse(result.expiresAt)<=Date.parse(f.stored.expiresAt));
  }else assert.deepEqual(Object.keys(result).sort(),['request','status']);
  assert.equal(f.reads(),2);assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);
  assert.equal(f.calls.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)||s.includes('set_config')||s.includes('_store(')),false);
 }
});

test('FN09 current metadata keeps original session, CSRF, project and effective policy; other session cannot claim stored request',async()=>{
 for(const mode of ['token','csrf','project','policy','session'] as const){
  const f=currentFixture();let token=f.token,csrf=f.csrf,selection=f.selection;
  if(mode==='token')token='x'.repeat(43);
  if(mode==='csrf')csrf='z'.repeat(43);
  if(mode==='project')selection={...selection,projectId:id(99)};
  if(mode==='policy')f.rules[0].expiresAt=new Date(0).toISOString();
  if(mode==='session'){
   const original=f.db.query;f.db.query=async(sql:string,p:any[]=[])=>{const result=await original(sql,p);
    return sql.startsWith('SELECT s.*,u.id AS uid')?{...result,rows:result.rows.map((row:any)=>({...row,id:id(94)}))}:result;};
  }
  const expected={token:['AUTH_REQUIRED',401],csrf:['CSRF_INVALID',403],project:['NOT_FOUND',404],policy:['PROJECT_OPERATION_DENIED',403],session:['NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED',412]}[mode];
  await assert.rejects(new mod.NormalUnderstandingReadRequests(f.access).current(token,csrf,selection),{message:expected[0],statusCode:expected[1]});
  assert.equal(f.reads(),0);assert.equal(f.calls.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)),false);
 }
});

test('FN09 current metadata binds database TTL to the pre-query wall and monotonic samples',async t=>{
 for(const mode of ['both','wall-only','mono-only','wall-backward','commit-late','within'] as const){
  const f=currentFixture(),base=Date.now();let wall=base,mono=100,clocks=0;
  f.stored.expiresAt=new Date(base+1000).toISOString();
  const original=f.db.query;
  f.db.query=async(sql:string,p:any[]=[])=>{
   const result=await original(sql,p);
   if(sql==='SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id'&&++clocks===4&&mode!=='commit-late'){
    // DB 원 시각 snapshot의 응답 수거 중 경과를 RAM에서 모사한다. sleep/DB 실행 없음.
    if(mode==='both'||mode==='wall-only')wall+=1500;
    if(mode==='both'||mode==='mono-only')mono+=1500;
    if(mode==='wall-backward')wall--;
    if(mode==='within'){wall+=100;mono+=100;}
   }
   if(sql==='COMMIT'&&mode==='commit-late'){wall+=1500;mono+=1500;}
   return result;
  };
  t.mock.method(Date,'now',()=>wall);t.mock.method(performance,'now',()=>mono);
  try{
   if(mode==='within'){const result=await f.current();assert.equal(result.status,'METADATA_STORED');assert.equal(result.expiresAt,f.stored.expiresAt);}
   else await assert.rejects(f.current(),{message:'NORMAL_UNDERSTANDING_METADATA_UNKNOWN',statusCode:503},mode);
   assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);assert.equal(f.calls.at(-1),'RELEASE');
   if(!['within','commit-late'].includes(mode)){assert.equal(f.reads(),1);assert.ok(!f.calls.includes('COMMIT'));}
  }finally{t.mock.restoreAll();}
 }
});

test('FN09 current metadata rejects wrong refs, extra raw values, expired projection and between-read corruption',async()=>{
 const changes=[(v:any)=>{v.request.requestRef=ref(99);},(v:any)=>{v.request.executionGeneration=2;},
  (v:any)=>{v.metadata.raw='fixture-only';},(v:any)=>{v.metadata.ranges[0].outputRef=ref(62);},
  (v:any)=>{v.metadata.ranges.push({...v.metadata.ranges[0]});},(v:any)=>{v.expiresAt=new Date(0).toISOString();},
  (v:any)=>{v.currentness='HISTORICAL';},(v:any)=>{v.selectionAvailable=true;}];
 for(const change of changes){const f=currentFixture();f.projection(()=>{const v=structuredClone(f.stored);change(v);return v;});
  await assert.rejects(f.current(),{message:'NORMAL_UNDERSTANDING_METADATA_UNKNOWN',statusCode:503});assert.equal(f.reads(),1);assert.ok(!f.calls.includes('COMMIT'));}
 const f=currentFixture();f.projection(n=>({...structuredClone(f.stored),resultRef:ref(n===1?61:98)}));
 await assert.rejects(f.current(),{message:'NORMAL_UNDERSTANDING_METADATA_UNKNOWN',statusCode:503});assert.equal(f.reads(),2);assert.ok(!f.calls.includes('COMMIT'));
});

test('FN09 current metadata preserves authority denials and suppresses unknown COMMIT, database failure or query replacement',async()=>{
 for(const alter of [(f:ReturnType<typeof currentFixture>)=>f.deny(),(f:ReturnType<typeof currentFixture>)=>f.stale(),
  (f:ReturnType<typeof currentFixture>)=>{f.rules[0].disposition='REQUIRE_APPROVAL';}]){
  const f=currentFixture();alter(f);await assert.rejects(f.current());assert.equal(f.reads(),0);
 }
 for(const mode of ['NONE','EXPIRED']){const f=currentFixture(mode);await assert.rejects(f.current(),{message:'REAUTHENTICATION_REQUIRED',statusCode:412});assert.equal(f.reads(),0);}
 for(const code of ['NORMAL_UNDERSTANDING_METADATA_NOT_FOUND','NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED','PROJECT_OPERATION_DENIED']){
  const f=currentFixture();f.projection(()=>{throw Object.assign(Error(code),{code:'P0001'});});
  await assert.rejects(f.current(),{message:code,statusCode:code.endsWith('NOT_FOUND')?404:code==='PROJECT_OPERATION_DENIED'?403:412});assert.equal(f.reads(),1);
 }
 for(const change of ['commit','database','query','late-deny'] as const){const f=currentFixture();
  if(change==='commit')f.unknown();
  else f.projection(()=>{if(change==='database')throw Error('fixture private error');if(change==='query'){const q=f.db.query;f.db.query=(...args:any[])=>q(...args);}else f.deny();return structuredClone(f.stored);});
  await assert.rejects(f.current(),{message:change==='late-deny'?'PROJECT_OPERATION_DENIED':'NORMAL_UNDERSTANDING_METADATA_UNKNOWN',statusCode:change==='late-deny'?403:503});
  assert.equal(f.calls.filter(s=>s==='BEGIN').length,1);assert.equal(f.calls.at(-1),'RELEASE');
 }
});

test('FN09 current metadata exact HUMAN GET uses existing app routing and rejects unbounded or mixed channels before SQL',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');const f=currentFixture(),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.test'});
 const query=new URLSearchParams({controlGeneration:'1',executionGeneration:'1',requestVersion:'1',requestHash:f.request.requestRef.contentHash,
  assignmentId:f.request.assignmentRef.id,assignmentVersion:'1',assignmentHash:f.request.assignmentRef.contentHash,
  preparationId:f.request.preparationRef.id,preparationVersion:'1',preparationHash:f.request.preparationRef.contentHash});
 const path=`/api/v1/projects/${f.pid}/executions/${f.request.executionId}/understanding-response-read-requests/${f.request.requestRef.id}/current`,url=path+'?'+query;
 const headers={host:'anvil.test',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 try{
  const response=await app.inject({method:'GET',url,headers});assert.equal(response.statusCode,200,response.body);assert.equal(response.headers['cache-control'],'no-store');
  assert.equal(response.json().status,'METADATA_STORED');assert.deepEqual(response.json().request,f.request);
  const count=f.calls.length;
  for(const patch of [{method:'HEAD' as const},{url:url+'&requestHash='+f.request.requestRef.contentHash},{url:url+'&extra=1'},
   {headers:{...headers,authorization:'Bearer fixture'}},{headers:{...headers,origin:'https://outside.test'}},
   {headers:{host:headers.host,cookie:headers.cookie}},{headers:{...headers,'content-length':'0'}},
   {url:url.replace('requestVersion=1','requestVersion=2')},{url:url.replace('executionGeneration=1','executionGeneration=0')}]){
   const rejected=await app.inject({method:'GET',url,headers,...patch});assert.ok(rejected.statusCode>=400,rejected.body);assert.ok(!rejected.body.includes(f.stored.resultRef.id));
  }
  assert.equal(f.calls.length,count);
  const beforeDenied=f.reads();
  f.projection(()=>{throw Object.assign(Error('fixture private permission detail'),{code:'42501'});});
  const unavailable=await app.inject({method:'GET',url,headers});
  assert.equal(unavailable.statusCode,503);assert.equal(unavailable.json().code,'NORMAL_UNDERSTANDING_METADATA_UNKNOWN');
  assert.ok(!unavailable.body.includes('fixture private permission detail'));assert.ok(!unavailable.body.includes(f.stored.resultRef.id));
  assert.equal(f.reads(),beforeDenied+1);assert.equal(f.calls.at(-1),'RELEASE');
 }finally{await app.close();}
});

test('FN09 readiness uses exact browser GET and excludes mixed channel, HEAD and repeated query',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');const f=fixture(),app=buildApp({},undefined,{repository:f.access,origin:'https://anvil.test'});
 const query=new URLSearchParams({controlGeneration:'1',assignmentId:f.context.assignmentRef.id,assignmentVersion:'1',assignmentHash:f.context.assignmentRef.contentHash,
  preparationId:f.context.preparationRef.id,preparationVersion:'1',preparationHash:f.context.preparationRef.contentHash});
 const url=`/api/v1/projects/${f.pid}/understanding-response-readiness?${query}`,
  headers={host:'anvil.test',cookie:'__Host-anvil.sid='+f.token,'x-anvil-csrf':f.csrf};
 try{
  const response=await app.inject({method:'GET',url,headers});assert.equal(response.statusCode,200,response.body);assert.equal(response.headers['cache-control'],'no-store');
  assert.equal(response.json().executionId,f.context.executionId);const queries=f.calls.length;
  for(const patch of [{method:'HEAD' as const},{url:url+'&controlGeneration=1'},{headers:{...headers,authorization:'Bearer ignored'}},
   {headers:{...headers,origin:'https://outside.test'}},{headers:{host:headers.host,cookie:headers.cookie}}]){
   const denied=await app.inject({method:'GET',url,headers,...patch});assert.ok(denied.statusCode>=400,denied.body);assert.ok(!denied.body.includes(f.context.executionId));
  }
  assert.equal(f.calls.length,queries);
  const scope=response.json(),raw=f.request(),request={...raw,targetId:scope.executionId,expectedVersion:scope.executionGeneration,
   payload:{assignmentRef:scope.assignmentRef,preparationRef:scope.preparationRef}};
  const posted=await app.inject({method:'POST',url:`/api/v1/projects/${f.pid}/executions/${scope.executionId}/understanding-response-read-requests`,
   headers:{...headers,origin:'https://anvil.test'},payload:request});
  assert.equal(posted.statusCode,200,posted.body);
  const receipt=posted.json(),{operationId,serverReceivedAt,data:{requestRef,expiresAt}}=receipt;
  assert.deepEqual(receipt,{operationId,commandId:request.commandId,projectId:f.pid,status:'APPLIED',targetId:requestRef.id,version:1,
   data:{ref:requestRef,status:'NORMAL_UNDERSTANDING_METADATA_REQUESTED',requestRef,state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt},
   evidenceRefs:[],warnings:[],serverReceivedAt});
  assert.equal(f.state().requests.length,1);
 }finally{await app.close();}
});
