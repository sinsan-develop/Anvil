import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const mod:any=await import('../../../apps/server/modules/executions/execution-understanding.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333',sid='44444444-4444-4444-8444-444444444444';
const ref=(n=1)=>({id:pid,version:n,contentHash:String(n).repeat(64)}),scope={projectId:pid,executionId:eid,executionGeneration:1};
const codes=['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'];
for(const mode of ['port','expiry'])test('이해 검토 이력은 읽는 동안 '+mode+' 변경 시 성공을 반환하지 않는다',async()=>{
 const f=fixture(),read=f.store.list;f.store.list=async(...args:any[])=>{const result=await read(...args);if(mode==='port')f.store.transport='REAL';else f.advance();return result;};await assert.rejects(f.list());assert.deepEqual(f.entries(),[]);assert.deepEqual(f.commands(),[]);
});
test('앱 시계가 DB보다 느려도 COMMIT 뒤 DB 세션 유효시간을 넘긴 이력은 반환하지 않는다',async t=>{
 let elapsed=1000;t.mock.method(performance,'now',()=>elapsed);
 const f=fixture(10000),query=f.db.query,read=f.store.list;f.clock(new Date(Date.parse(f.until)-50).toISOString());
 f.store.list=async(...args:any[])=>{const result=await read(...args);f.clock(new Date(Date.parse(f.until)-10).toISOString());return result;};
 f.db.query=async(sql:string,p?:any[])=>{const result=await query(sql,p);if(sql==='COMMIT')elapsed+=100;return result;};
 await assert.rejects(f.list(),/AUTH_REQUIRED/);assert.deepEqual(f.entries(),[]);assert.deepEqual(f.commands(),[]);
});
function fixture(sessionWindowMs=3600000){
 assert.equal(typeof mod.ProjectUnderstandingReviews,'function');
 const token='t'.repeat(43),csrf='c'.repeat(43),at=new Date().toISOString(),until=new Date(Date.now()+sessionWindowMs).toISOString();
 let entries:any[]=[],commands:any[]=[],checkpoint:any,control=2,revoked=false,clock=at,failed=false,changeOnSecond=false,currentCalls=0;
 const rules=[{ruleId:'understanding',subjectRef:{kind:'HUMAN',userId:pid},operations:['reviewUnderstanding'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:until}];
 const policy=()=>({rules,reason:'합성 검토 정책',reviewRefs:[]});
 const db:any={query:async(sql:string,p:any[]=[])=>{
  if(sql==='BEGIN'){checkpoint=structuredClone({entries,commands});return{rows:[]};}if(sql==='COMMIT')return{rows:[]};if(sql==='ROLLBACK'){({entries,commands}=checkpoint);return{rows:[]};}
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return{rows:[{id:sid,uid:pid,client_id:cid,current_generation:3,credential_generation:3,user_status:'ACTIVE',user_revoked_at:null,client_revoked_at:null,revoked_at:null,idle_expires_at:new Date(until),absolute_expires_at:new Date(until),csrf_digest:createHash('sha256').update(csrf).digest('hex'),reauth_until:null,server_owner:false}]};
  if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:pid,participation:'OWNER',archived_at:null}]};
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:pid,client_id:cid,generation:control,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:revoked?[]:[{id:pid,head_version:1,rules_json:rules,reason:policy().reason,review_refs:[],content_hash:contentHash(canonicalJson(policy())),created_at:new Date(at)}]};
  if(sql.startsWith('SELECT operation,request_hash,result_ref'))return{rows:commands.filter(c=>c.command_key===p[2])};
  if(sql.startsWith('SELECT clock_timestamp()')||sql.startsWith('SELECT transaction_timestamp()'))return{rows:[{at:new Date(clock)}]};
  if(sql.startsWith('INSERT INTO anvil.commands')){commands.push({operation:p[4],command_key:p[5],request_hash:p[6],result_ref:JSON.parse(p[14])});return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')||sql.startsWith('INSERT INTO anvil.audit_events')||sql.startsWith('SELECT set_config'))return{rows:[]};
  throw Error('UNEXPECTED_SQL '+sql);
 },release:()=>{}};
 const current:any={transport:'SYNTHETIC_ONLY',scope,bundleRef:ref(),responseRef:ref(2),subjectBindingRef:ref(3),basisRefs:[ref(4)],latestInstructionRefs:[],requiredPartRefs:[ref(5)],receivedPartRefs:[ref(5)],responsePartRefs:[ref(6)],criteria:codes.map(code=>({code,sourceRefs:[ref(4)],responsePartRefs:[ref(6)]})),sourceState:'AVAILABLE',responseSubject:'EXTERNAL_AGENT',checkedAt:at,expiresAt:until};
 const store:any={transport:'SYNTHETIC_ONLY',current:async(tx:any,_actor:any,s:any)=>{assert.equal(tx,db);assert.deepEqual(s,scope);currentCalls++;if(changeOnSecond&&currentCalls%2===0)current.basisRefs=[ref(7)];return structuredClone(current);},list:async(tx:any,s:any)=>{assert.equal(tx,db);assert.deepEqual(s,scope);return structuredClone(entries);},append:async(tx:any,s:any,entry:any)=>{assert.equal(tx,db);assert.deepEqual(s,scope);entries.push(structuredClone(entry));if(failed)throw Error('STORAGE_FAILURE');}};
 const access=new AccessRepository({connect:async()=>db} as any,{installationId:pid,key:randomBytes(32)}),service=new mod.ProjectUnderstandingReviews(access,store);
 const request=()=>({schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:cid,controlGeneration:2,operation:'reviewUnderstanding',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{bundleRef:ref(),responseRef:ref(2),subjectBindingRef:ref(3),criteriaVersion:1,items:codes.map(code=>({code,sourceRefs:[ref(4)],responsePartRefs:[ref(6)],judgement:'MATCH',reason:'원문과 응답 부분을 직접 대조'})),reason:'사람의 별도 이해 검토'}});
 return{service,store,current,request,rules,db,until,clock:(v:string)=>{clock=v;},run:(r=request())=>service.command(token,csrf,r),list:()=>service.list(token,scope),accepted:(r:any)=>access.authenticated(token,null,(tx,actor)=>service.requireAccepted(tx,actor,scope,r)),entries:()=>entries,commands:()=>commands,stale:()=>{control=3;},revoke:()=>{revoked=true;},fail:()=>{failed=true;},change:()=>{changeOnSecond=true;},advance:()=>{clock=until;},token,csrf};
}
test('HUMAN 6항목은 불변 순번·원 요청·현재 근거·영수증과 저장하고 실행 성공으로 승격하지 않는다',async()=>{
 const f=fixture(),request=f.request(),result=await f.run(request);assert.equal(result.status,'APPLIED');assert.equal(result.data.snapshot.outcome,'ACCEPTED');assert.equal(result.data.snapshot.executionAuthorized,false);assert.equal(result.data.snapshot.dispatchPerformed,false);
 assert.equal(f.entries().length,1);assert.equal(f.entries()[0].ref.contentHash,contentHash(canonicalJson(f.entries()[0].snapshot)));assert.equal(f.entries()[0].snapshot.reviewer.humanSessionId,sid);assert.equal((await f.list()).items.length,1);
 const evidence:any=await f.accepted(result.data.ref);assert.deepEqual(evidence.ref,result.data.ref);assert.equal(evidence.executionAuthorized,false);
});
test('후속 부적합은 옛 수용을 무효화하고 새 명시 MATCH만 최신 근거가 된다',async()=>{
 const f=fixture(),first=await f.run(),negative=f.request();negative.payload.items[2]!.judgement='MISMATCH';await f.run(negative);await assert.rejects(f.accepted(first.data.ref),/UNDERSTANDING_LATEST_ACCEPTANCE_REQUIRED/);
 assert.equal(f.entries()[1].snapshot.previousRef.contentHash,first.data.ref.contentHash);const third=await f.run();assert.equal(third.data.ref.version,3);const accepted:any=await f.accepted(third.data.ref);assert.deepEqual(accepted.ref,third.data.ref);
});
test('현재 bundle·session·응답·basis·필수 부분 누락과 격리는 옛 수용/새 검토를 열지 않는다',async()=>{
 for(const mutation of [(c:any)=>{c.bundleRef=ref(7);},(c:any)=>{c.subjectBindingRef=ref(7);},(c:any)=>{c.responseRef=ref(7);},(c:any)=>{c.basisRefs=[ref(7)];c.criteria.forEach((i:any)=>{i.sourceRefs=[ref(7)];});},(c:any)=>{c.receivedPartRefs=[];},(c:any)=>{c.sourceState='QUARANTINED';}]){
  const f=fixture(),first=await f.run();mutation(f.current);await assert.rejects(f.accepted(first.data.ref),/UNDERSTANDING_/);await assert.rejects(f.run(),/UNDERSTANDING_/);assert.equal(f.entries().length,1);
 }
});
test('누락/중복/임의 code·부분·출처·자기 판정·비밀 본문 입력은 거절한다',async()=>{
 for(const mutation of [(r:any)=>r.payload.items.pop(),(r:any)=>{r.payload.items[5]=r.payload.items[0];},(r:any)=>{r.payload.items[0].sourceRefs=[ref(7)];},(r:any)=>{r.payload.items[0].responsePartRefs=[ref(7)];},(r:any)=>{r.payload.reviewer={kind:'AGENT'};},(r:any)=>{r.payload.items[0].judgement='ACCEPTED';},(r:any)=>{r.payload.reason='api_key=abcdefghijk123456789';}]){const f=fixture(),r=f.request();mutation(r);await assert.rejects(f.run(r));assert.equal(f.entries().length,0);}
 const f=fixture();f.current.responseSubject='HUMAN';await assert.rejects(f.run(),/UNDERSTANDING_/);
});
test('현재 로그인/제어/명시 정책만 받고 정책 회수·DENY·옛 제어·CSRF 오류는 저장0이다',async()=>{
 for(const mode of ['CONTROL','REVOKED','DENY','CSRF']){const f=fixture();if(mode==='CONTROL')f.stale();if(mode==='REVOKED')f.revoke();if(mode==='DENY')f.rules[0]!.disposition='DENY';await assert.rejects(mode==='CSRF'?f.service.command(f.token,'x'.repeat(43),f.request()):f.run());assert.equal(f.entries().length,0);}
});
test('같은 명령은 원 결과·기한만 재조회하고 다른 hash는 충돌, append 오류는 영수증까지 rollback한다',async()=>{
 const f=fixture(),r=f.request(),first=await f.run(r);assert.deepEqual(await f.run(r),first);assert.equal(f.entries().length,1);r.payload.reason='다른 이유';await assert.rejects(f.run(r),/IDEMPOTENCY_CONFLICT/);
 const g=fixture();g.fail();await assert.rejects(g.run());assert.equal(g.entries().length,0);assert.equal(g.commands().length,0);
});
test('await 중 원 요청·근거 변경과 최종 기한 만료는 새 저장을 만들지 않는다',async()=>{
 const f=fixture(),r=f.request(),raw=canonicalJson(r),current=f.store.current;f.store.current=async(...args:any[])=>{r.payload.reason='외부 변조';return current(...args);};await f.run(r);assert.equal(f.entries()[0].snapshot.requestHash,contentHash(raw));
 const g=fixture();g.change();await assert.rejects(g.run(),/UNDERSTANDING_/);assert.equal(g.entries().length,0);
 const h=fixture(),read=h.store.list;h.store.list=async(...args:any[])=>{const rows=await read(...args);h.advance();return rows;};await assert.rejects(h.run(),/UNDERSTANDING_/);assert.equal(h.entries().length,0);
});
