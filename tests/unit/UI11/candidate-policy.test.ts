import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {materialRules} from '../../../apps/server/modules/access/project-command.ts';
const m:any=await import('../../../apps/web/src/features/connections/candidate-policy-api.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333',session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},expiresAt='2099-10-20T02:00:00.000Z';
const rule=(ruleId='DOC',operations=['saveDocumentDraft'])=>({ruleId,subjectRef:{kind:'HUMAN',userId:uid},operations,targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'DENY',limitPolicyRef:null,expiresAt});
function policy(){const value={rules:[rule()],reason:'기존 규칙 보존',reviewRefs:[]};return{ref:{id,version:1,contentHash:contentHash(canonicalJson(value))},...value,createdAt:'2026-10-20T00:00:00.000Z'};}
function fn(name:string,...args:any[]){assert.equal(typeof m[name],'function');return m[name](...args);}
function buffer(base:any=null){const b=fn('newCandidatePolicyBuffer',pid,session,2,base);b.draft={...b.draft,operations:['registerConnection'],disposition:'REQUIRE_APPROVAL',expiresAt,reason:'본인 후보 저장 정책',acknowledged:true};return b;}
function client(base:any,calls:any[],generation=2,send?:(command:any)=>Response){return new ApiClient(async(url,init)=>{calls.push([String(url),init]);if(String(url).endsWith('/permission-policy'))return Response.json({configured:base!==null,policy:base});if(String(url)==='/api/v1/projects/'+pid)return Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation}});assert.equal(init?.method,'POST');const c=JSON.parse(String(init?.body));if(send)return send(c);return Response.json({operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:base?.ref.id??id,version:c.expectedVersion+1,data:{status:'POLICY_SAVED',ref:{id:base?.ref.id??id,version:c.expectedVersion+1,contentHash:contentHash(canonicalJson(c.payload))}},serverReceivedAt:'2026-10-20T00:00:00.000Z'});});}
test('현재정책 읽기는 생성0이고 원문hash/미설정·configured 짝을 검사한다',async()=>{
 const p=policy(),calls:any[]=[];assert.deepEqual(await fn('readCandidatePermissionPolicy',client(p,calls),pid),p);assert.equal(calls.length,1);assert.equal(calls[0][1].method,'GET');assert.equal(await fn('readCandidatePermissionPolicy',client(null,[]),pid),null);
 for(const value of [{configured:false,policy:p},{configured:true,policy:null},{configured:true,policy:{...p,reason:'바뀐 원문'}}])await assert.rejects(fn('readCandidatePermissionPolicy',new ApiClient(async()=>Response.json(value)),pid));
});
test('준비는 본인 후보 두 행동만 바꾸고 다른 기존 규칙을 그대로 동결하며 POST0이다',async()=>{
 const p=policy(),before=structuredClone(p),b=buffer(p),calls:any[]=[];const next=await fn('prepareCandidatePolicy',client(p,calls),b,session);assert.equal(next.pending.operation,'savePermissionPolicy');assert.equal(next.pending.expectedVersion,1);assert.equal(next.pending.targetId,id);assert.deepEqual(next.pending.payload.rules[0],p.rules[0]);assert.deepEqual(next.pending.payload.rules[1],{ruleId:b.draft.ruleId,subjectRef:{kind:'HUMAN',userId:uid},operations:['registerConnection'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'REQUIRE_APPROVAL',limitPolicyRef:null,expiresAt});assert.equal(next.pending.approvalRef,null);assert.equal(next.pendingHash,contentHash(canonicalJson(next.pending)));assert.equal(b.pending,null);assert.deepEqual(p,before);assert.equal(calls.filter(c=>c[1]?.method==='POST').length,0);
});
test('기존 후보 전용 규칙만 명시 개정하며 혼합·다른 주체 규칙은 교체하지 않는다',async()=>{
 const p=policy();p.rules.push(rule('CANDIDATE',['registerConnection']));p.ref.contentHash=contentHash(canonicalJson({rules:p.rules,reason:p.reason,reviewRefs:[]}));const b=buffer(p);b.draft.replaceRuleId='CANDIDATE';b.draft.ruleId='CANDIDATE';b.draft.disposition='AUTO';const next=await fn('prepareCandidatePolicy',client(p,[]),b,session);assert.equal(next.pending.payload.rules.length,2);assert.deepEqual(next.pending.payload.rules[0],p.rules[0]);assert.equal(next.pending.payload.rules[1].disposition,'AUTO');
 for(const replaceRuleId of ['DOC','NO_SUCH_RULE']){const x=buffer(p);x.draft.replaceRuleId=replaceRuleId;x.draft.ruleId=replaceRuleId;await assert.rejects(fn('prepareCandidatePolicy',client(p,[]),x,session));}
});
test('다른client·미확인/동결·미확인행동·비밀·기한·확인누락·현재버전/세대 변경은 거절한다',async()=>{
 for(const mutate of [(b:any)=>b.ownerClientId=id,(b:any)=>b.uncertain=true,(b:any)=>b.pending={},(b:any)=>b.draft.operations=['authorizeExecution'],(b:any)=>b.draft.operations=[],(b:any)=>b.draft.reason='password=must-not-send',(b:any)=>b.draft.expiresAt='2020-01-01T00:00:00.000Z',(b:any)=>b.draft.acknowledged=false,(b:any)=>b.draft.acknowledged=1]){const b=buffer();mutate(b);await assert.rejects(fn('prepareCandidatePolicy',client(null,[]),b,session));}
 await assert.rejects(fn('prepareCandidatePolicy',client(policy(),[]),buffer(),session));await assert.rejects(fn('prepareCandidatePolicy',client(null,[],3),buffer(),session));
});
test('별도 전송만 정확 명령을 보내고 같은ID/본문 재확인 및 올바른 결과hash를 검사한다',async()=>{
 const calls:any[]=[],api=client(null,calls),b=await fn('prepareCandidatePolicy',api,buffer(),session);const a=await fn('sendCandidatePolicy',api,b,session,()=>true),again=await fn('sendCandidatePolicy',api,b,session,()=>true);assert.deepEqual(a,again);const writes=calls.filter(c=>c[1]?.method==='POST');assert.equal(writes.length,2);assert.equal(writes[0][1].body,writes[1][1].body);assert.equal(writes[0][1].credentials,'same-origin');assert.equal(writes[0][1].headers['Idempotency-Key'],b.pending.commandId);
 const bad=structuredClone(b);bad.pending.payload.reason='원문 변경';await assert.rejects(fn('sendCandidatePolicy',api,bad,session,()=>true));
 await assert.rejects(fn('sendCandidatePolicy',client(null,[],2,c=>Response.json({operationId:id,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:id,version:1,data:{status:'POLICY_SAVED',ref:{id,version:1,contentHash:'a'.repeat(64)}},serverReceivedAt:'2026-10-20T00:00:00Z'})),b,session,()=>true));
});
test('이탈 후 전송0·유실은 미확인이고 늦은 결과는 다른 버퍼를 덮지 않는다',async()=>{
 const api=client(null,[]),b=await fn('prepareCandidatePolicy',api,buffer(),session);let writes=0;await assert.rejects(fn('sendCandidatePolicy',client(null,[],2,()=>{writes++;return Response.json({});}),b,session,()=>false));assert.equal(writes,0);
 await assert.rejects(fn('sendCandidatePolicy',client(null,[],2,()=>{throw Error('transport');}),b,session,()=>true),{code:'CONNECTION_LOST'});
 const changed=structuredClone(b);changed.draft.reason='새 입력';assert.equal(fn('settleCandidatePolicyBuffer',changed,b,{...b,pending:null,resultRef:{id,version:1,contentHash:'a'.repeat(64)}}),changed);const uncertain={...b,uncertain:true};assert.equal(fn('settleCandidatePolicyBuffer',uncertain,b,{...b,pending:null}),uncertain);
});
test('화면의 두 후보 행동·세 처리는 기존 서버 규칙 계약에 맞고 실행/다른 주체는 여전히 거절된다',async()=>{
 for(const operation of ['registerConnection','saveEnvironment'])for(const disposition of ['AUTO','REQUIRE_APPROVAL','DENY']){const b=buffer();b.draft.operations=[operation];b.draft.disposition=disposition;const next=await fn('prepareCandidatePolicy',client(null,[]),b,session);assert.deepEqual(materialRules(next.pending.payload.rules,pid,uid),next.pending.payload.rules);}
 const wrong=rule('OTHER',['registerConnection']);wrong.subjectRef.userId=id;assert.throws(()=>materialRules([wrong],pid,uid),/POLICY_INPUT_INVALID/);assert.throws(()=>materialRules([rule('RUNTIME',['authorizeExecution'])],pid,uid),/POLICY_SCOPE_NOT_READY/);
});
