import test from 'node:test';import assert from 'node:assert/strict';
import {buildApp} from '../../../apps/server/app.ts';
import {ProjectResultReviews} from '../../../apps/server/modules/results/project-result-reviews.ts';
import {ProjectResultReviewSources} from '../../../apps/server/modules/results/project-result-review-sources.ts';
import {ProjectMethodologies} from '../../../apps/server/modules/methodologies/project-methodologies.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readNextActionBasis} from '../../../apps/web/src/features/session-detail/next-action-basis-api.ts';
import {nextActionFixture} from '../UI05/next-action-basis-fixture.ts';
const m:any=await import('../../../apps/server/modules/scheduling/project-next-action-basis.ts').catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(outcome:'REWORK'|'BLOCKED'='REWORK'){
 const f=nextActionFixture(outcome),actor:any={actorId:f.id(90),clientId:f.id(91),credentialGeneration:1,serverOwner:false,reauthUntil:null,authSession:{id:f.id(92),idleExpiresAt:'2026-10-20T00:10:00.000Z',absoluteExpiresAt:'2026-10-20T12:00:00.000Z'}},calls:string[]=[];let member=true,afterApplication=()=>{};
 const db:any={query:async(sql:string,args:any[])=>{calls.push(sql);if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date('2026-10-20T00:00:00.000Z')}]};assert(sql.includes('JOIN anvil.project_members'));assert.deepEqual(args,[f.pid,actor.actorId]);return{rows:member?[{id:f.pid,participation:'OWNER',archived_at:null}]:[]};}};
 const bound=(d:any,a:any,pid:string)=>{assert.equal(d,db);assert.deepEqual(a,actor);assert.equal(pid,f.pid);};
 const reviews={read:async(d:any,a:any,pid:string,id:string)=>{bound(d,a,pid);assert.equal(id,f.review.ref.id);return structuredClone(f.review);}};
 const sources={read:async(d:any,a:any,pid:string,id:string)=>{bound(d,a,pid);assert.equal(id,f.result.ref.id);return{projectId:pid,result:structuredClone(f.result),assignment:structuredClone(f.assignment)};}};
 const applications={readApplication:async(d:any,a:any,pid:string)=>{bound(d,a,pid);afterApplication();return structuredClone(f.application);}};
 return{...f,db,actor,calls,ports:{reviews,sources,applications},member:(v:boolean)=>member=v,afterApplication:(fn:()=>void)=>afterApplication=fn};
}
test('서버 원검수·원제출/확정임무·현재방법론을 같은 tx에서 대조하고 보완/사람판단만 안내한다',async()=>{
 for(const outcome of ['REWORK','BLOCKED'] as const){const f=fixture(outcome),value=await new m.ProjectNextActionBasis(f.ports).read(f.db,f.actor,f.pid,f.review.ref.id),v=value.basis;assert.equal(value.validUntil,f.actor.authSession.idleExpiresAt);
  assert.equal(v.action,outcome==='REWORK'?'REVIEW_REWORK_FOR_SELECTED_STAGE':'WAIT_HUMAN_UNBLOCK_DECISION');assert.deepEqual(v.reviewRef,f.review.ref);assert.deepEqual(v.resultRef,f.result.ref);assert.equal(v.nodeId,'review');assert.equal(v.sourceAssurance,'SERVER_STORED_REVIEW_WITH_CURRENT_METHODOLOGY');assert.equal(v.resultTransport,'SYNTHETIC_ONLY');
  for(const flag of ['completionAccepted','runtimeStateVerified','automaticTransitionPerformed','executionAuthorized','dispatchPerformed'])assert.equal(v[flag],false);
  const membership=f.calls.filter(q=>q.includes('JOIN anvil.project_members'));assert.equal(membership.length,2);assert(membership.every(q=>q.includes('FOR UPDATE OF p,m')));assert(f.calls.every(q=>q.startsWith('SELECT')));
 }
});
test('변조/다른귀속/현재방법론 변경·판정승격은 근거로 채택하지 않는다',async()=>{
 for(const mutate of [(f:any)=>f.review.snapshot.input.outcome='ACCEPTED',(f:any)=>f.review.completionAccepted=true,(f:any)=>f.review.snapshot.input.resultRef.contentHash='f'.repeat(64),(f:any)=>f.assignment.projectId=f.id(99),(f:any)=>f.assignment.ref.contentHash='f'.repeat(64),(f:any)=>f.application.applicationRef.id=f.id(99),(f:any)=>f.application.snapshot.graph.nodes[0].name='손상',(f:any)=>f.review.observedAt='bad-time']){
  const f=fixture();mutate(f);await assert.rejects(new m.ProjectNextActionBasis(f.ports).read(f.db,f.actor,f.pid,f.review.ref.id));
 }
});
test('잘못된 입력은 DB 전 거절하고 조회중 회수·제공자 실패는 이전 근거로 대체하지 않는다',async()=>{
 const bad=fixture();await assert.rejects(new m.ProjectNextActionBasis(bad.ports).read(bad.db,bad.actor,'../project',bad.review.ref.id));assert.equal(bad.calls.length,0);
 const revoked=fixture();revoked.afterApplication(()=>revoked.member(false));await assert.rejects(new m.ProjectNextActionBasis(revoked.ports).read(revoked.db,revoked.actor,revoked.pid,revoked.review.ref.id));
 const failed=fixture();failed.ports.applications.readApplication=async()=>{throw Error('METHOD_READER_FAILED');};await assert.rejects(new m.ProjectNextActionBasis(failed.ports).read(failed.db,failed.actor,failed.pid,failed.review.ref.id),/METHOD_READER_FAILED/);
});
test('최종 적용본 교체와 인증 기한 경과는 최초 근거가 정상이어도 결과를 내보내지 않는다',async()=>{
 const changed=fixture();let n=0;changed.ports.applications.readApplication=async()=>{const value=structuredClone(changed.application);if(++n===2)value.applicationRef.id=changed.id(99);return value;};await assert.rejects(new m.ProjectNextActionBasis(changed.ports).read(changed.db,changed.actor,changed.pid,changed.review.ref.id),/METHODOLOGY_APPLICATION_CHANGED/);
 const expired=fixture(),query=expired.db.query;let clocks=0;expired.db.query=async(sql:string,args:any[])=>{if(sql==='SELECT clock_timestamp() AS at'&&++clocks===2)return{rows:[{at:new Date('2026-10-20T00:10:00.000Z')}]};return query(sql,args);};await assert.rejects(new m.ProjectNextActionBasis(expired.ports).read(expired.db,expired.actor,expired.pid,expired.review.ref.id),/AUTH_REQUIRED/);
});
test('인증된 새 GET는 기존 원 reader를 통해 근거만 반환하고 COMMIT 뒤 만료도 거절한다',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-10-20T00:00:00.000Z')});const f=fixture();let late=false,auth=0;
 t.mock.method(ProjectResultReviews.prototype,'read',f.ports.reviews.read as any);t.mock.method(ProjectResultReviewSources.prototype,'read',f.ports.sources.read as any);t.mock.method(ProjectMethodologies.prototype,'readApplication',f.ports.applications.readApplication as any);
 const repository:any={signProjectCursor:()=>'',signMethodCursor:()=>'',authenticated:async(token:string,csrf:any,body:any)=>{auth++;assert.equal(token,'a'.repeat(43));assert.equal(csrf,null);const v=await body(f.db,f.actor);if(late)t.mock.timers.tick(600001);return v;}},app=buildApp({},undefined,{repository,origin:'https://localhost:3830'}),url=`/api/v1/projects/${f.pid}/result-reviews/${f.review.ref.id}/next-action-basis`;
 try{const r=await app.inject({method:'GET',url,headers:{host:'localhost:3830',cookie:'__Host-anvil.sid='+'a'.repeat(43)}});assert.equal(r.statusCode,200,r.body);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.json().action,'REVIEW_REWORK_FOR_SELECTED_STAGE');assert.equal(r.json().completionAccepted,false);assert.equal(Object.hasOwn(r.json(),'validUntil'),false);assert.equal(auth,1);
  const client=new ApiClient(async(path,options)=>{assert.equal(options?.method,'GET');assert.equal(options.credentials,'same-origin');const response=await app.inject({method:'GET',url:String(path),headers:{host:'localhost:3830',cookie:'__Host-anvil.sid='+'a'.repeat(43)}});return new Response(response.body,{status:response.statusCode,headers:{'content-type':String(response.headers['content-type'])}});});
  const displayed=await readNextActionBasis(client,f.result,f.assignment,f.review,()=>true);assert.equal(displayed?.nodeId,'review');assert.equal(displayed?.completionAccepted,false);assert.equal(displayed?.sourceAssurance,'SERVER_STORED_REVIEW_WITH_CURRENT_METHODOLOGY');
  late=true;const expired=await app.inject({method:'GET',url,headers:{host:'localhost:3830',cookie:'__Host-anvil.sid='+'a'.repeat(43)}});assert.equal(expired.statusCode,401);assert(!expired.body.includes('SERVER_STORED_REVIEW_WITH_CURRENT_METHODOLOGY'));
 }finally{await app.close();}
});
test('신규 근거 GET는 익명·중복쿠키/Bearer·다른host·추가query를 DB 전에 거절한다',async()=>{
 const f=fixture();let auth=0;const repository:any={signProjectCursor:()=>'',signMethodCursor:()=>'',authenticated:async()=>{auth++;throw Error('FORBIDDEN_DB');}},app=buildApp({},undefined,{repository,origin:'https://localhost:3830'}),url=`/api/v1/projects/${f.pid}/result-reviews/${f.review.ref.id}/next-action-basis`,cookie='__Host-anvil.sid='+'a'.repeat(43);
 try{for(const [path,headers,status]of [[url,{host:'localhost:3830'},401],[url,{host:'localhost:3830',cookie:cookie+'; '+cookie},401],[url,{host:'other.invalid',cookie},403],[url,{host:'localhost:3830',cookie,authorization:'Bearer av3ex1_'+'a'.repeat(43)},403],[url+'?execute=true',{host:'localhost:3830',cookie},400]] as const){const r=await app.inject({method:'GET',url:path,headers});assert.equal(r.statusCode,status,r.body);assert(!r.body.includes('FORBIDDEN_DB'));}assert.equal(auth,0);
 }finally{await app.close();}
});
