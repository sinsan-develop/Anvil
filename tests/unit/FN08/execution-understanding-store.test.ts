import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m:any=await import('../../../apps/server/modules/executions/execution-understanding-store.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333',sid='44444444-4444-4444-8444-444444444444';
const ref=(n=1)=>({id:pid,version:n,contentHash:String(n).repeat(64)}),scope={projectId:pid,executionId:eid,executionGeneration:1},at='2026-10-19T12:00:00.000Z',hash=(v:unknown)=>contentHash(canonicalJson(v));
function entry(){
 const codes=['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'],criteria=codes.map(code=>({code,sourceRefs:[ref(4)],responsePartRefs:[ref(6)]}));
 const input={bundleRef:ref(),responseRef:ref(2),subjectBindingRef:ref(3),criteriaVersion:1,items:criteria.map(i=>({...i,judgement:'MATCH',reason:'원문 대조'})),reason:'별도 검토'};
 const request={schemaVersion:1,projectId:pid,commandId:eid,clientId:cid,controlGeneration:2,operation:'reviewUnderstanding',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:input};
 const snapshot={scope,sequence:1,previousRef:null,request,requestHash:hash(request),reviewer:{kind:'HUMAN',userId:pid,clientId:cid,humanSessionId:sid,credentialGeneration:3,controlGeneration:2},policyRef:ref(),currentBinding:{transport:'SYNTHETIC_ONLY',scope,bundleRef:ref(),responseRef:ref(2),subjectBindingRef:ref(3),basisRefs:[ref(4)],latestInstructionRefs:[],requiredPartRefs:[ref(5)],receivedPartRefs:[ref(5)],responsePartRefs:[ref(6)],criteria,sourceState:'AVAILABLE',responseSubject:'EXTERNAL_AGENT'},input,outcome:'ACCEPTED',recordedAt:at,executionAuthorized:false,dispatchPerformed:false};
 return{ref:{id:pid,version:1,contentHash:hash(snapshot)},snapshot};
}
function row(){const e=entry(),c=e.snapshot.request,r=e.snapshot.reviewer,scopeDigest=hash({projectId:pid,actorId:r.userId,clientId:r.clientId,controlGeneration:c.controlGeneration,requestHash:hash(c),policyRef:e.snapshot.policyRef,targetRef:e.ref});return{project_id:pid,execution_id:eid,generation:1,id:e.ref.id,version:1,content_hash:e.ref.contentHash,snapshot_json:e.snapshot,created_by:pid,client_id:cid,command_id:sid,command_actor:pid,command_client:cid,command_key:eid,operation:'reviewUnderstanding',state:'APPLIED',request_hash:hash(c),policy_ref:e.snapshot.policyRef,authorization_subject:{kind:'HUMAN',userId:pid,clientId:cid},authorization_policy:e.snapshot.policyRef,authorization_scope:scopeDigest,audit_scope:scopeDigest,audit_outcome:'APPLIED',audit_source:'HUMAN_COMMAND',result_ref:{projectId:pid,status:'APPLIED',targetId:e.ref.id,version:1,data:{ref:e.ref,status:'SYNTHETIC_UNDERSTANDING_REVIEWED',snapshot:e.snapshot}}};}
test('PG 이해검토 adapter는 같은 전달 client만 소비하고 별도 연결/transaction·실제 사실 fallback이 없다',async()=>{
 assert.equal(typeof m.SyntheticPgUnderstandingStore,'function');let calls=0;const db:any={query:async(sql:string,p:any[])=>{calls++;assert(!/BEGIN|COMMIT|ROLLBACK/.test(sql));assert.deepEqual(p,[pid,eid,1]);return{rows:[row()]};}},actor:any={actorId:pid};
 const facts:any={transport:'SYNTHETIC_ONLY',current:async(client:any,a:any,s:any)=>{assert.equal(client,db);assert.equal(a,actor);assert.deepEqual(s,scope);s.executionGeneration=99;return{synthetic:true};}},store=new m.SyntheticPgUnderstandingStore(facts);
 assert.deepEqual(await store.current(db,actor,scope),{synthetic:true});assert.equal(scope.executionGeneration,1);assert.deepEqual(await store.list(db,scope),[entry()]);assert.equal(calls,1);
 for(const bad of [undefined,{transport:'REAL',current:async()=>null},{transport:'SYNTHETIC_ONLY'}])assert.throws(()=>new m.SyntheticPgUnderstandingStore(bad));
});
test('원 요청·영수증·감사·행 scope/hash 변조는 저장 이력으로 읽지 않는다',async()=>{
 for(const mutate of [(r:any)=>{r.command_actor=cid;},(r:any)=>{r.audit_scope='f'.repeat(64);},(r:any)=>{r.snapshot_json.input.reason='변조';},(r:any)=>{r.result_ref.data.ref=ref(9);},(r:any)=>{r.execution_id=cid;},(r:any)=>{r.command_key=cid;}]){assert.equal(typeof m.SyntheticPgUnderstandingStore,'function');const r=row();mutate(r);const store=new m.SyntheticPgUnderstandingStore({transport:'SYNTHETIC_ONLY',current:async()=>null});await assert.rejects(store.list({query:async()=>({rows:[r]})},scope));}
});
test('append는 scope·전체 순번/history/hash를 확인한 후 exact created command와 한 INSERT만 쓴다',async()=>{
 assert.equal(typeof m.SyntheticPgUnderstandingStore,'function');const store=new m.SyntheticPgUnderstandingStore({transport:'SYNTHETIC_ONLY',current:async()=>null}),queries:string[]=[];
 const db:any={query:async(sql:string,p:any[])=>{queries.push(sql);if(sql.startsWith('SELECT'))return{rows:[]};assert(sql.startsWith('INSERT INTO anvil.understanding_reviews'));assert.deepEqual(p,[pid,eid,1,pid,1,entry().ref.contentHash,canonicalJson(entry().snapshot),pid,cid,sid]);return{rowCount:1,rows:[]};}};
 await store.append(db,scope,entry(),sid);assert.equal(queries.length,2);
 const invalid=structuredClone(entry());invalid.snapshot.scope.executionGeneration=2;await assert.rejects(store.append(db,scope,invalid,sid));assert.equal(queries.length,3);
});
test('새 SQL은 합성 이력·정확 명령/로그인/제어/정책·역방향 원자 결박과 불변 보호의 파일 계약이다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0019_understanding_reviews.sql',import.meta.url),'utf8');
 for(const fragment of ['CREATE TABLE anvil.understanding_reviews','UNDERSTANDING_HISTORY_IMMUTABLE','UNDERSTANDING_EXACT_HUMAN_RECEIPT_REQUIRED','UNDERSTANDING_COMMAND_REVERSE_ATOMIC_REQUIRED','DEFERRABLE INITIALLY DEFERRED','anvil.auth_sessions','anvil.project_control','anvil.permission_policy_versions','REVOKE UPDATE,DELETE','responseSubject','EXTERNAL_AGENT'])assert(sql.includes(fragment),fragment);
 assert(!/SECURITY DEFINER|ALTER TABLE|UPDATE anvil\.|DELETE FROM/i.test(sql));
});
test('직접 DML도 한 실행 전체 이력2MiB 한도를 누락하지 않는다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0019_understanding_reviews.sql',import.meta.url),'utf8');assert(sql.includes('UNDERSTANDING_HISTORY_QUOTA_REQUIRED'));assert(sql.includes('jsonb_agg'));assert(sql.includes("'snapshot',NEW.snapshot_json"));
});
test('독립 검토 I1/I2: 일반 DELETE는 OLD를 반환하고 reason의 JSON 문자열 타입을 고정한다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0019_understanding_reviews.sql',import.meta.url),'utf8');assert(sql.includes("IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;"));assert(sql.includes("jsonb_typeof(input->'reason') IS DISTINCT FROM 'string'"));assert(sql.includes("jsonb_typeof(item->'reason') IS DISTINCT FROM 'string'"));
});
test('실제 42601의 PLpgSQL IF 내 CASE 판정식은 SQL 표현식 괄호로 구분한다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0019_understanding_reviews.sql',import.meta.url),'utf8');assert(sql.includes("OR s->>'outcome' IS DISTINCT FROM (CASE WHEN"));assert(sql.includes("THEN 'ACCEPTED' ELSE 'NOT_ACCEPTED' END)"));
});
test('실제 boolean→json 연산 오류는 containment 양쪽 JSON 추출을 괄호로 구분한다',async()=>{
 const sql=await readFile(new URL('../../../db/migrations/0019_understanding_reviews.sql',import.meta.url),'utf8');for(const expression of ["(binding->'receivedPartRefs') @> (binding->'requiredPartRefs')","(binding->'basisRefs') @> (item->'sourceRefs')","(binding->'responsePartRefs') @> (item->'responsePartRefs')"])assert(sql.includes(expression));
});
