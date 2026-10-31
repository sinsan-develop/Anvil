import Fastify from 'fastify';
import {registerProjectRoutes} from '../../../apps/server/modules/projects/routes.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID,createHash} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import * as storeMod from '../../../apps/server/modules/executions/execution-stop-store.ts';
import {ProjectStopRequestHistory} from '../../../apps/server/modules/checkpoints/project-stop-request-history.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function baseFixture(){
 assert.equal(typeof storeMod.SyntheticPgStopCommandStore,'function');const id=randomUUID(),ref={id,version:1,contentHash:'a'.repeat(64)},reservationRef={...ref,version:2},authorizationRef={id:randomUUID(),version:1,contentHash:'b'.repeat(64)},scope={projectId:id,executionId:id,executionGeneration:1},actor:any={actorId:id,clientId:id},at='2026-10-19T12:00:00.000Z',expiresAt='2026-10-19T12:00:30.000Z',subject={userId:id,clientId:id,humanSessionId:id,credentialGeneration:1,controlGeneration:2};
 const context={projectId:id,assignmentId:id,executionId:id,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:reservationRef,sourceScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}]},binding={transport:'SYNTHETIC_ONLY',scope,grantRef:ref,grantKind:'EXECUTION',grantExpiresAt:'2026-10-19T12:01:00.000Z',grantSubject:subject,grantAllowedOperations:['REQUEST_STOP'],sessionBindingRef:ref,stopScopeRef:ref,executorRegistrationRef:ref,context,ownershipRef:ref,targetState:'VERIFIED_CURRENT',permissionPolicyRef:ref,budgetPolicyRef:ref,budgetReservationRef:reservationRef};
 const request={schemaVersion:1,projectId:id,commandId:randomUUID(),clientId:id,controlGeneration:2,operation:'requestExecutionStop',targetId:id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{grantRef:ref,sessionBindingRef:ref,stopScopeRef:ref,permissionPolicyRef:ref,budgetPolicyRef:ref,reason:'합성 중지'}},intent={transport:'SYNTHETIC_ONLY',state:'STOP_REQUEST_STORED',scope,requestHash:hash(request),requestedBy:subject,currentBinding:binding,reason:request.payload.reason,requestedAt:at,expiresAt,executionAuthorized:false,dispatchPerformed:false,writerReleaseVerified:false};
 const unsigned={schemaVersion:1,commandId:request.commandId,issuedAt:at,expiresAt,executorRegistrationRef:ref,context:{...context,authorizationReceiptRef:authorizationRef},operation:'REQUEST_STOP',payload:{sessionBindingRef:ref,stopScopeRef:ref}},record:any={ref:{id:randomUUID(),version:1,contentHash:hash(intent)},snapshot:{...intent,request,envelope:{...unsigned,envelopeHash:hash(unsigned)}}},receiptDigest=authorizationRef.contentHash;
 const destination={transport:'SYNTHETIC_ONLY',registrationRef:ref,executionId:id,generation:1,grantKind:'EXECUTION'},payload={commandRef:record.ref,grantRef:ref,envelopeHash:record.snapshot.envelope.envelopeHash},scopeDigest=hash({scope,commandRef:record.ref,grantRef:ref,envelopeHash:record.snapshot.envelope.envelopeHash});
 const row:any={project_id:id,id:record.ref.id,version:1,execution_id:id,generation:1,grant_id:id,grant_version:1,content_hash:record.ref.contentHash,envelope_hash:record.snapshot.envelope.envelopeHash,snapshot_json:record.snapshot,authorization_ref:authorizationRef,command_actor:id,command_client:id,command_key:request.commandId,operation:'requestExecutionStop',state:'APPLIED',request_hash:hash(request),policy_ref:ref,authorization_id:authorizationRef.id,authorization_subject:{kind:'HUMAN',userId:id,clientId:id},authorization_policy:ref,authorization_scope:receiptDigest,audit_scope:receiptDigest,audit_outcome:'APPLIED',audit_source:'HUMAN_COMMAND',outbox_kind:'EXECUTION_STOP_SYNTHETIC_ONLY',outbox_state:'HELD_SYNTHETIC_ONLY',destination_ref:destination,payload_ref:payload,outbox_scope:scopeDigest,result_ref:{projectId:id,status:'APPLIED',targetId:record.ref.id,version:1,data:{status:'SYNTHETIC_STOP_STORED',ref:record.ref,snapshot:intent}}};
 // 실제 receipt scopeDigest는 request/target에 결박한다. fixture의 봉투도 그 실제 값으로 갱신한다.
 const authDigest=hash({projectId:id,actorId:id,clientId:id,controlGeneration:2,requestHash:hash(request),policyRef:ref,targetRef:record.ref});authorizationRef.contentHash=authDigest;row.authorization_scope=authDigest;row.audit_scope=authDigest;record.snapshot.envelope.envelopeHash=hash(unsigned);row.envelope_hash=record.snapshot.envelope.envelopeHash;payload.envelopeHash=row.envelope_hash;row.outbox_scope=hash({scope,commandRef:record.ref,grantRef:ref,envelopeHash:row.envelope_hash});
 let count=0,total=0;const inserts:any[]=[],queries:string[]=[],db:any={query:async(sql:string,p:any[]=[])=>{queries.push(sql);if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id,participation:'OWNER',archived_at:null}]};if(sql.startsWith('SELECT count('))return{rows:[{count,total}]};if(sql.startsWith('SELECT e.*'))return{rows:[structuredClone(row)]};if(sql.startsWith('INSERT INTO anvil.execution_commands')||sql.startsWith('INSERT INTO anvil.delivery_outbox')){inserts.push({sql,p:structuredClone(p)});return{rows:[],rowCount:1};}throw Error('UNEXPECTED_SQL');}},facts:any={transport:'SYNTHETIC_ONLY',current:async(tx:any,a:any,s:any)=>{assert.equal(tx,db);assert.equal(a,actor);assert.deepEqual(s,scope);return{...structuredClone(binding),checkedAt:at,expiresAt};}},store=new storeMod.SyntheticPgStopCommandStore(facts);
 return{store,db,actor,scope,record,row,queries,inserts,facts,quota:(c:number,t:number)=>{count=c;total=t;}};
}

const sign=(s:string)=>createHash('sha256').update('synthetic-stop-pages:'+s).digest('hex');
function pagesFixture(count=42){
 const base=baseFixture(),pid=base.scope.projectId,clock={at:new Date('2026-10-31T00:00:00.000Z')},records:any[]=[],calls:{sql:string;p:any[]}[]=[];
 const actor:any={...base.actor,clientId:randomUUID(),credentialGeneration:1,authSession:{id:randomUUID(),idleExpiresAt:'2026-10-31T01:00:00.000Z',absoluteExpiresAt:'2026-10-31T12:00:00.000Z'}};
 const resultRef={id:randomUUID(),version:1,contentHash:'c'.repeat(64)},executionSnapshot={historical:true},executionRef={id:base.scope.executionId,version:base.scope.executionGeneration,contentHash:hash(executionSnapshot)},assignmentRef={id:pid,version:1,contentHash:'a'.repeat(64)};
 const parent:any={projectId:pid,resultRef,sourceState:'HISTORICAL_REFERENCE_ONLY',execution:{transport:'SYNTHETIC_ONLY',scope:{projectId:pid,executionRef,assignmentRef},snapshot:executionSnapshot}};
 function append(n:number,seq=n,requestedAt?:string){const row=structuredClone(base.row),s=row.snapshot_json;if(requestedAt){s.requestedAt=requestedAt;s.expiresAt=new Date(Date.parse(requestedAt)+30000).toISOString();s.envelope.issuedAt=requestedAt;s.envelope.expiresAt=s.expiresAt;s.currentBinding.grantExpiresAt=new Date(Date.parse(requestedAt)+60000).toISOString();}s.request.commandId=randomUUID();s.envelope.commandId=s.request.commandId;s.requestHash=hash(s.request);row.id=String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';const{request:_,envelope:__,...intent}=s,ref={id:row.id,version:1,contentHash:hash(intent)};row.content_hash=ref.contentHash;row.command_key=s.request.commandId;row.request_hash=s.requestHash;row.created_command_id=randomUUID();
 const digest=hash({projectId:pid,actorId:s.requestedBy.userId,clientId:s.requestedBy.clientId,controlGeneration:s.requestedBy.controlGeneration,requestHash:s.requestHash,policyRef:s.currentBinding.permissionPolicyRef,targetRef:ref});s.envelope.context.authorizationReceiptRef.contentHash=digest;row.authorization_ref.contentHash=digest;row.authorization_scope=digest;row.audit_scope=digest;const{envelopeHash:___,...unsigned}=s.envelope;s.envelope.envelopeHash=hash(unsigned);row.envelope_hash=s.envelope.envelopeHash;row.payload_ref={commandRef:ref,grantRef:s.currentBinding.grantRef,envelopeHash:s.envelope.envelopeHash};row.outbox_scope=hash({scope:base.scope,commandRef:ref,grantRef:s.currentBinding.grantRef,envelopeHash:s.envelope.envelopeHash});row.result_ref={projectId:pid,status:'APPLIED',targetId:ref.id,version:1,data:{status:'SYNTHETIC_STOP_STORED',ref,snapshot:intent}};row.audit_sequence=seq;row.audit_count=1;records.push(row);return row;}
 for(let n=1;n<=count;n++)append(n);
 let member=true;const hooks={after:()=>{}};
 const metadata=(r:any)=>({id:r.id,version:r.version,content_hash:r.content_hash,requested_at:r.snapshot_json.requestedAt,audit_sequence:r.audit_sequence,audit_count:r.audit_count});
 const db:any={query:async(sql:string,p:any[]=[])=>{calls.push({sql,p:structuredClone(p)});if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:member?[{id:pid,participation:'OWNER',archived_at:null}]:[]};if(sql.startsWith('SELECT clock_timestamp() AS at')&&!sql.includes('stop-page'))return{rows:[{at:new Date(clock.at)}]};
 if(sql.includes('stop-page-metadata')){const all=records.filter(r=>r.project_id===p[0]&&r.execution_id===p[1]&&r.generation===p[2]);const visible=all.filter(r=>r.snapshot_json.requestedAt<=p[8]&&(p[3]===null||r.snapshot_json.requestedAt<p[3]||r.snapshot_json.requestedAt===p[3]&&r.id<=p[4])&&(p[5]===null||r.audit_sequence<=p[5])&&(p[6]===null||r.snapshot_json.requestedAt<p[6]||r.snapshot_json.requestedAt===p[6]&&r.id<p[7])).sort((a,b)=>b.snapshot_json.requestedAt.localeCompare(a.snapshot_json.requestedAt)||b.id.localeCompare(a.id));hooks.after();return{rows:[{at:new Date(clock.at),max_sequence:Math.max(0,...records.map(r=>r.audit_sequence)),invalid_count:all.filter(r=>r.audit_count!==1||!Number.isSafeInteger(r.audit_sequence)||r.audit_sequence<1).length,stop_rows:visible.slice(0,21).map(metadata)}]};}
 if(sql.includes('stop-page-upper'))return{rows:records.filter(r=>r.project_id===p[0]&&r.execution_id===p[1]&&r.generation===p[2]&&r.id===p[3]).map(metadata)};
 if(sql.startsWith('SELECT e.*'))return{rows:records.filter(r=>r.project_id===p[0]&&r.execution_id===p[1]&&r.generation===p[2]&&r.id===p[3]&&r.version===p[4]&&r.content_hash===p[5]).flatMap(r=>r.audit_count===0?[]:Array.from({length:r.audit_count},()=>structuredClone(r)))};
 throw Error('UNMODELED_MEMORY_SQL:'+sql.slice(0,100));}};
 return{db,actor,pid,resultRef,parent,clock,records,calls,hooks,append,member:(v:boolean)=>member=v,service:new ProjectStopRequestHistory({read:async()=>structuredClone(parent)})};
}
test('과거21번째 요청은 실제 보관 reader를 통해 보호 페이지로 읽고 이전 cursor로 왕복한다',async()=>{
 const f=pagesFixture(),service:any=f.service;
 const first=await service.page(f.db,f.actor,f.pid,f.resultRef.id,{},sign);assert.equal(first.items.length,20);assert.equal(first.hasMore,true);assert(first.pageCursor);assert(first.nextCursor);
 const second=await service.page(f.db,f.actor,f.pid,f.resultRef.id,{cursor:first.nextCursor},sign);assert.equal(second.items.length,20);assert(!first.items.some((r:any)=>r.ref.id===second.items[0].ref.id));
 const back=await service.page(f.db,f.actor,f.pid,f.resultRef.id,{cursor:first.pageCursor},sign);assert.deepEqual(back.items,first.items);assert.equal(back.cursorExpiresAt,first.cursorExpiresAt);assert.equal(back.executionAuthorized,false);
 assert(f.calls.every(c=>c.sql.startsWith('SELECT')));
});

test('빈 고정 탐색/append 상한·동률시각·MAX_SAFE 감사순번은 유한 조회를 유지한다',async()=>{
 const empty=pagesFixture(0),a=await empty.service.page(empty.db,empty.actor,empty.pid,empty.resultRef.id,{},sign);assert.equal(a.snapshotUpper,null);assert.equal(a.snapshotMaxAuditSequence,0);empty.append(1);assert.deepEqual((await empty.service.page(empty.db,empty.actor,empty.pid,empty.resultRef.id,{cursor:a.pageCursor},sign)).items,[]);
 const f=pagesFixture(),first=await f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{},sign);f.append(999,99);const second=await f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{cursor:first.nextCursor!},sign);assert(!second.items.some(r=>r.ref.id.startsWith('00000999')));assert.equal(second.snapshotMaxAuditSequence,first.snapshotMaxAuditSequence);
 const exact=pagesFixture(1);exact.records[0].audit_sequence=Number.MAX_SAFE_INTEGER;const v=await exact.service.page(exact.db,exact.actor,exact.pid,exact.resultRef.id,{},sign);assert.equal(v.snapshotMaxAuditSequence,Number.MAX_SAFE_INTEGER);assert.equal(v.items.length,1);
 assert(f.calls.filter(c=>c.sql.includes('stop-page-metadata')).every(c=>c.sql.includes('LIMIT 21')&&!c.sql.includes('snapshot_json)')));
});
test('cursor는 현재 user/client/session/fullref·서명 namespace와 최초 기한을 결박한다',async()=>{
 for(const kind of ['CLIENT','USER','SESSION','CREDENTIAL','RESULT','NAMESPACE','TAMPER','EXPIRED','EXTEND','BEFORE']){
 const f=pagesFixture(),first=await f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{},sign);let cursor=first.pageCursor,signer=sign;
 if(kind==='CLIENT')f.actor.clientId=randomUUID();if(kind==='USER')f.actor.actorId=randomUUID();if(kind==='SESSION')f.actor.authSession.id=randomUUID();if(kind==='CREDENTIAL')f.actor.credentialGeneration=2;if(kind==='RESULT')f.parent.resultRef.contentHash='f'.repeat(64);
 if(kind==='NAMESPACE')signer=(s:string)=>sign('another:'+s);if(kind==='TAMPER')cursor=cursor.slice(0,-1)+(cursor.endsWith('a')?'b':'a');if(kind==='EXPIRED')f.clock.at=new Date(first.cursorExpiresAt);
 if(kind==='EXTEND'||kind==='BEFORE'){const v=JSON.parse(Buffer.from(cursor.split('.')[0]!,'base64url').toString());if(kind==='EXTEND')v.expiresAt=new Date(Date.parse(v.issuedAt)+1800001).toISOString();else v.before={requestedAt:v.snapshotUpper.requestedAt,id:'ffffffff-ffff-4fff-8fff-ffffffffffff'};const b=Buffer.from(canonicalJson(v)).toString('base64url');cursor=b+'.'+sign(b);}
 await assert.rejects(f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{cursor},signer),(e:any)=>e.statusCode===400,kind);
 }
});
test('원행/proof 누락·중복·outbox 변조·상한 손상과 unsafe 순번은 skip하지 않는다',async()=>{
 for(const kind of ['MISSING_AUDIT','DUPLICATE_AUDIT','OUTBOX','UPPER_MISSING','HASH','UNSAFE']){
 const f=pagesFixture(),first=await f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{},sign),row=f.records.at(-1)!;
 if(kind==='MISSING_AUDIT')row.audit_count=0;if(kind==='DUPLICATE_AUDIT')row.audit_count=2;if(kind==='OUTBOX')row.outbox_state='READY';if(kind==='UPPER_MISSING')f.records.pop();if(kind==='HASH')row.content_hash='f'.repeat(64);if(kind==='UNSAFE')row.audit_sequence=Number.MAX_SAFE_INTEGER+1;
 await assert.rejects(f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{cursor:first.pageCursor},sign),(e:any)=>e.statusCode===503,kind);
 }
});
test('조회 중 권한회수·세션 만료·cursor 만료/30초 처리초과를 성공으로 반환하지 않는다',async()=>{
 for(const kind of ['MEMBER','SESSION','CURSOR','REQUEST']){
 const f=pagesFixture();if(kind==='SESSION')f.actor.authSession.idleExpiresAt='2026-10-31T00:00:01.000Z';if(kind==='CURSOR')f.actor.authSession.idleExpiresAt='2026-10-31T00:01:00.000Z';
 const first=await f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{},sign);
 f.hooks.after=()=>{if(kind==='MEMBER')f.member(false);else if(kind==='SESSION')f.clock.at=new Date('2026-10-31T00:00:01.000Z');else if(kind==='CURSOR')f.clock.at=new Date(first.cursorExpiresAt);else f.clock.at=new Date('2026-10-31T00:00:31.000Z');};
 // DB 시각 진행도 요청 처리예산의 근거다. 실제 대기/DB는 쓰지 않는다.
 await assert.rejects(f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{cursor:first.pageCursor},sign),(e:any)=>kind==='MEMBER'?e.statusCode===404:kind==='SESSION'||kind==='CURSOR'?e.statusCode===401:e.statusCode===412,kind);
 }
});

test('실제 Fastify 새 GET은 page/signer를 선택하고 기존 GET·raw query·host/Bearer/auth를 보존한다',async()=>{
 const f=pagesFixture(1),app=Fastify(),proto=ProjectStopRequestHistory.prototype,oldPage=proto.page,oldRead=proto.read,calls:string[]=[];let signed='',denied=false;
 const repository:any={signProjectCursor:(v:string)=>{signed=v;return sign(v);},authenticated:async(_token:any,_csrf:any,fn:any)=>{if(denied){const e:any=Error('AUTH_REQUIRED');e.statusCode=401;throw e;}return fn(f.db,f.actor);}};
 try{proto.page=async(_db:any,_actor:any,_pid:any,_id:any,_q:any,signer:any)=>{calls.push('page');signer('probe');return{cursorExpiresAt:'2026-10-31T00:30:00.000Z',observedAt:'2026-10-31T00:00:00.000Z',marker:'page'} as any;};proto.read=async()=>{calls.push('read');return{marker:'read'} as any;};registerProjectRoutes(app,{repository,origin:'https://anvil-synthetic.invalid'});
 const base=`/api/v1/projects/${f.pid}/results/${f.resultRef.id}`,headers={host:'anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+'S'.repeat(43)};
 const next=await app.inject({method:'GET',url:base+'/stop-request-pages',headers});assert.equal(next.statusCode,200,next.body);assert.equal(next.json().marker,'page');assert.equal(signed,'RESULT_STOP_REQUEST_PAGE_V1:probe');
 const old=await app.inject({method:'GET',url:base+'/stop-requests',headers});assert.equal(old.statusCode,200);assert.equal(old.json().marker,'read');
 for(const query of ['?unknown=1','?cursor=','?cursor=a&cursor=b']){const r=await app.inject({method:'GET',url:base+'/stop-request-pages'+query,headers});assert.equal(r.statusCode,400,r.body);}
 for(const q of ['?cursor=x','?unknown=1','?cursor=a&cursor=b'])assert.equal((await app.inject({method:'GET',url:base+'/stop-requests'+q,headers})).statusCode,400);
 for(const patch of [{host:'other.invalid'},{authorization:'Bearer synthetic'},{origin:'https://other.invalid'}])assert.equal((await app.inject({method:'GET',url:base+'/stop-request-pages',headers:{...headers,...patch}})).statusCode,403);
 denied=true;assert.equal((await app.inject({method:'GET',url:base+'/stop-request-pages',headers})).statusCode,401);assert.deepEqual(calls,['page','read']);
 }finally{proto.page=oldPage;proto.read=oldRead;await app.close();}
});

test('최초 부모 보호조회 대기 중 정상 append는 t0 고정범위 밖으로 제외하고 성공한다',async()=>{
 const f=pagesFixture(),old=f.service.sources.read;f.service.sources.read=async(...args:any[])=>{const next=new Date(f.clock.at.getTime()+1);f.append(999,999,next.toISOString());f.clock.at=next;return Reflect.apply(old,f.service.sources,args);};
 const page=await f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{},sign);assert.equal(page.items.length,20);assert(!page.items.some(r=>r.ref.id.startsWith('00000999')));assert(page.snapshotUpper!.requestedAt<=page.cursorIssuedAt);
});

test('authenticated 본문 뒤 늦은 확정응답은 route 최종30초 한도에서 거절한다 (실 COMMIT 아님)',async()=>{
 const f=pagesFixture(1),value=await f.service.page(f.db,f.actor,f.pid,f.resultRef.id,{},sign),app=Fastify(),proto=ProjectStopRequestHistory.prototype,old=proto.page,descriptor=Object.getOwnPropertyDescriptor(performance,'now');let now=0;
 try{proto.page=async()=>structuredClone(value);Object.defineProperty(performance,'now',{configurable:true,value:()=>now});const repository:any={signProjectCursor:sign,authenticated:async(_t:any,_c:any,fn:any)=>{const result=await fn(f.db,f.actor);now=31000;return result;}};registerProjectRoutes(app,{repository,origin:'https://anvil-synthetic.invalid'});const result=await app.inject({method:'GET',url:`/api/v1/projects/${f.pid}/results/${f.resultRef.id}/stop-request-pages`,headers:{host:'anvil-synthetic.invalid',cookie:'__Host-anvil.sid='+'S'.repeat(43)}});assert.equal(result.statusCode,412,result.body);assert.equal(result.json().message??result.json().code,'RESULT_STOP_HISTORY_LIMIT');
 }finally{proto.page=old;if(descriptor)Object.defineProperty(performance,'now',descriptor);else Reflect.deleteProperty(performance,'now');await app.close();}
});
