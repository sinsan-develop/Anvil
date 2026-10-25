import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {createControlRequestSnapshot} from '../../../apps/server/modules/control-handoff/control-request-snapshot.ts';
import {createControlHandoffSummary} from '../../../apps/server/modules/control-handoff/control-handoff-summary.ts';
import {ControlApi,browserCanonical,wireHash} from '../../../apps/web/src/features/control-handoff/api.ts';
const projectId='11111111-1111-4111-8111-111111111111',actorId='22222222-2222-4222-8222-222222222222',clientId='33333333-3333-4333-8333-333333333333',other='44444444-4444-4444-8444-444444444444',id='55555555-5555-4555-8555-555555555555';
const session={user:{id:actorId,displayName:'사용자'},clientId,csrfToken:'c'.repeat(43)},now='2026-10-26T00:00:00.000Z',basis={actorId,clientId:other,generation:2,version:7};
const input={targetActorRef:{userId:actorId},targetClientRef:{userId:actorId,clientId},baseControl:basis,reason:'내 기기 인수',expiresAt:'2026-10-26T00:20:00.000Z'};
const request=createControlRequestSnapshot({id,projectId,requestedBy:{actorId,clientId},input,createdAt:now});
const fixed={projectId,...request,observedAt:now,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
const state={schemaVersion:1,projectId,observedAt:now,actorId,clientId,participation:'OWNER',control:{state:'OTHER_CLIENT',basis},executionAuthorized:false,controlTransferred:false};
function api(value:unknown,status=200,seen:{path:string;init:RequestInit}[]=[]){return new ControlApi(async(path,init)=>{seen.push({path:String(path),init:init??{}});return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});},session,projectId);}
test('브라우저 canonical/WebCrypto는 서버와 exact 동등하며 비 JSON 객체를 거절한다',async()=>{
 for(const value of [null,true,-0,0.125,{z:'한글🙂',a:[1,null,false]},request.snapshot]){assert.equal(browserCanonical(value),canonicalJson(value));assert.equal(await wireHash(value),contentHash(canonicalJson(value)));}
 for(const value of [NaN,Infinity,9007199254740992,'\ud800',new Date(),Object.defineProperty({},'a',{get(){throw Error('호출 금지');},enumerable:true}),[undefined]])assert.throws(()=>browserCanonical(value));
 const cycle:{self?:unknown}={};cycle.self=cycle;assert.throws(()=>browserCanonical(cycle));
});
test('현재 제어 명시 GET은 same-origin/CSRF이고 OFF·타인·손상 basis는 거절한다',async()=>{
 const seen:{path:string;init:RequestInit}[]=[];assert.deepEqual(await api(state,200,seen).state(),state);assert.equal(seen.length,1);assert.equal(seen[0]?.path,'/api/v1/projects/'+projectId+'/control-state');assert.equal(new Headers(seen[0]?.init.headers).get('X-Anvil-CSRF'),session.csrfToken);assert.equal(seen[0]?.init.credentials,'same-origin');assert.equal(seen[0]?.init.redirect,'error');
 for(const value of [{...state,projectId:other},{...state,actorId:other},{...state,control:{state:'OTHER_CLIENT',basis:{...basis,version:0}}},{...state,executionAuthorized:true},{...state,extra:true}])await assert.rejects(()=>api(value).state());
 for(const status of [401,403,404,409,412,503])await assert.rejects(()=>api({code:'NOT_CONNECTED'},status).state(),error=>error instanceof Error&&'status'in error&&error.status===status);
});
test('고정 원문은 ref/hash/SELF/input·만료를 대조하고 head NONE은 연결 실패와 다르다',async()=>{
 assert.deepEqual(await api(fixed).request(request.requestRef),fixed);
 for(const value of [{...fixed,snapshot:{...request.snapshot,reason:'변조'}},{...fixed,requestRef:{...request.requestRef,contentHash:'a'.repeat(64)}},{...fixed,projectId:other}])await assert.rejects(()=>api(value).request(request.requestRef));
 const wrong={...request.snapshot,targetClientRef:{userId:other,clientId}};const forged={...fixed,snapshot:wrong,requestRef:{...request.requestRef,contentHash:contentHash(canonicalJson(wrong))}};await assert.rejects(()=>api(forged).request(forged.requestRef));
 const head={schemaVersion:1,projectId,requestRef:request.requestRef,observedAt:now,head:{state:'NONE',summaryRef:null},executionAuthorized:false,controlTransferred:false};assert.equal((await api(head).head(request.requestRef)).head.state,'NONE');
 await assert.rejects(()=>api({...head,head:{state:'AVAILABLE',summaryRef:null}}).head(request.requestRef));
});
test('요약 원문 4범주·gaps·30초/요청만료·false flags와 최신 고정ref를 검증한다',async()=>{
 const summary=createControlHandoffSummary({projectId,requestRef:request.requestRef,version:1,controller:basis,baseControl:basis,observedAt:now,requestExpiresAt:input.expiresAt,collections:{activeExecutions:null,pendingCommands:null,pendingApprovals:null,sourceCheckpointRefs:null}});
 const result={projectId,requestRef:request.requestRef,summaryRef:summary.summaryRef,body:summary.body,observedAt:now,current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
 assert.deepEqual(await api(result).summary(request.requestRef,summary.summaryRef,input.expiresAt),result);assert.equal(summary.body.safetyState,'UNVERIFIED');
 for(const body of [{...summary.body,acceptanceEnabled:true},{...summary.body,gaps:[]},{...summary.body,validUntil:input.expiresAt},{...summary.body,baseControl:{...basis,version:8}}]){const ref={...summary.summaryRef,contentHash:contentHash(canonicalJson(body))};await assert.rejects(()=>api({...result,summaryRef:ref,body}).summary(request.requestRef,ref,input.expiresAt));}
});
test('POST는 고정 명령·Idempotency와 CSRF를 전달하고 receipt/commandHash가 다르면 불명이다',async()=>{
 const command={schemaVersion:1 as const,operation:'requestControl' as const,commandId:id,projectId,clientId,payload:input};const receipt={schemaVersion:1,commandId:id,commandHash:contentHash(canonicalJson(command)),projectId,actorId,clientId,requestRef:request.requestRef,outcome:'REQUEST_STORED'};
 const seen:{path:string;init:RequestInit}[]=[];await api({...request,receipt},201,seen).send(command);await api({...request,receipt},201,seen).send(command);assert.equal(seen.length,2);assert.equal(seen[0]?.init.body,seen[1]?.init.body);assert.deepEqual(JSON.parse(String(seen[0]?.init.body)),command);assert.equal(new Headers(seen[0]?.init.headers).get('Idempotency-Key'),id);assert.equal(new Headers(seen[0]?.init.headers).get('X-Anvil-CSRF'),session.csrfToken);
 await assert.rejects(()=>api({...request,receipt:{...receipt,commandHash:'a'.repeat(64)}},201).send(command));
 const offline=new ControlApi(async()=>{throw Error('offline');},session,projectId);await assert.rejects(()=>offline.send(command));
});

test('요청 목록과 현재 제어자의 prepare는 고정 요청을 소비하며 수락이나 수집본문을 보내지 않는다',async()=>{
 const row={requestRef:request.requestRef,createdAt:now,expiresAt:input.expiresAt,storedState:'PENDING',current:{expired:false,baseControlState:'MATCHED'},executionAuthorized:false,controlTransferred:false};
 const list={projectId,view:'OWN',limit:50,observedAt:now,items:[row],hasMore:false,nextCursor:null,executionAuthorized:false,controlTransferred:false};
 assert.deepEqual(await api(list).list('OWN'),list);await assert.rejects(()=>api({...list,items:[row,row]}).list('OWN'));await assert.rejects(()=>api({...list,nextCursor:'orphan'}).list('OWN'));
 const controller={...session,clientId:other};const command={schemaVersion:1 as const,operation:'prepareControlHandoff' as const,commandId:other,projectId,clientId:other,payload:{requestRef:request.requestRef}};
 const summary=createControlHandoffSummary({projectId,requestRef:request.requestRef,version:2,controller:basis,baseControl:basis,observedAt:now,requestExpiresAt:input.expiresAt,collections:{activeExecutions:null,pendingCommands:null,pendingApprovals:null,sourceCheckpointRefs:null}});
 const receipt={schemaVersion:1,commandId:other,commandHash:contentHash(canonicalJson(command)),projectId,actorId,clientId:other,requestRef:request.requestRef,summaryRef:summary.summaryRef,outcome:'SUMMARY_STORED'};
 const sent:{path:string;init:RequestInit}[]=[];const consumer=new ControlApi(async(path,init)=>{sent.push({path:String(path),init:init??{}});return Response.json({summaryRef:summary.summaryRef,body:summary.body,receipt},{status:201});},controller,projectId);
 await consumer.send(command);assert.equal(sent.length,1);assert.equal(sent[0]?.path,'/api/v1/projects/'+projectId+'/control-requests/'+id+'/versions/1/handoff-summaries');assert.deepEqual(JSON.parse(String(sent[0]?.init.body)).payload,{requestRef:request.requestRef});
 const head={schemaVersion:1,projectId,requestRef:request.requestRef,observedAt:now,head:{state:'AVAILABLE',summaryRef:summary.summaryRef},executionAuthorized:false,controlTransferred:false};assert.deepEqual(await api(head).head(request.requestRef),head);
});
test('전송 전 잘못된 SELF payload/ref·외부경로를 거절하고 중복 JSON 응답을 손상으로 구분한다',async()=>{
 let sent=0;const consumer=new ControlApi(async()=>{sent++;return Response.json({});},session,projectId);
 const command={schemaVersion:1 as const,operation:'requestControl' as const,commandId:id,projectId,clientId,payload:input};
 for(const payload of [{...input,baseControl:{...basis,version:0}},{...input,reason:''},{...input,expiresAt:'bad'},{...input,targetActorRef:{userId:other}}])await assert.rejects(()=>consumer.send({...command,payload}));
 assert.equal(sent,0);
 const malformed=new ControlApi(async()=>new Response('{"schemaVersion":1,"schemaVersion":1}',{headers:{'content-type':'application/json'}}),session,projectId);await assert.rejects(()=>malformed.state());
 const foreign=new ControlApi(async()=>{sent++;return Response.json({});},session,'../other');await assert.rejects(()=>foreign.state());assert.equal(sent,0);
});
