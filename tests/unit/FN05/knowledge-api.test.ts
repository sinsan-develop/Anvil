import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const load=()=>import('../../../apps/web/src/features/knowledge/api.ts').catch(()=>null);
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',kid='44444444-4444-4444-8444-444444444444';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)};
test('지식 저장은 원문 업로드 뒤 명시 초안만 쓰고 단절 뒤 같은 저장 명령으로 재확인한다',async()=>{
  const m=await load();assert.ok(m,'지식 Web 연결이 필요하다');
  const b=m.newKnowledge(pid,session,1);Object.assign(b,{title:'결정 이유',kind:'DECISION',body:'원문을 보존한다',reason:'도구 변경에도 이유 유지'});b.pending=await m.prepareKnowledge(b,session);
  const writes:any[]=[];const client=new ApiClient(async(input,init)=>{
    const upload=String(input).endsWith('/files'),c=upload?JSON.parse(new Headers(init?.headers).get('x-anvil-command')!):JSON.parse(String(init?.body));writes.push(c);
    if(!upload&&writes.length===2)throw Error('lost');
    const ref=upload?{artifactId:aid,...c.payload}:{id:kid,version:1,contentHash:contentHash(canonicalJson(c.payload.entry))};
    return new Response(JSON.stringify({operationId:kid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId:upload?aid:kid,version:upload?null:1,data:upload?{status:'ARTIFACT_READY',artifactRef:ref}:{status:'PROPOSED',ref,entry:c.payload.entry},evidenceRefs:[],warnings:[],serverReceivedAt:'2026-10-16T05:00:00Z'}),{headers:{'content-type':'application/json'}});
  });
  await assert.rejects(m.sendKnowledge(client,b,session,p=>b.pending=p,()=>true),ApiError);assert.ok(b.pending.save);
  const result=await m.sendKnowledge(client,b,session,p=>b.pending=p,()=>true);assert.equal(result.id,kid);assert.equal(writes.length,3);assert.deepEqual(writes[1],writes[2]);assert.deepEqual(writes[1].payload.entry.sourceRefs,[{kind:'ARTIFACT',id:aid,contentHash:contentHash(Buffer.from(b.body))}]);
  let calls=0;const never=new ApiClient(async()=>{calls++;throw Error();});
  await assert.rejects(m.sendKnowledge(never,b,{...session,clientId:kid},()=>{},()=>true),ApiError);
  await assert.rejects(m.sendKnowledge(never,b,session,()=>{},()=>false),ApiError);assert.equal(calls,0);
});
test('지식 조회는 정확 버전·원문 hash를 대조하고 가짜 확정/변조 본문을 노출하지 않는다',async()=>{
  const m=await load();assert.ok(m,'지식 조회 연결이 필요하다');const body='가설 원문';
  const entry={kind:'HYPOTHESIS',title:'가설',contentRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'미확정',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]};
  const ref={id:kid,version:1,contentHash:contentHash(canonicalJson(entry))},view={ref,entry,body,state:'PROPOSED',appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:'미확정',actorRef:{kind:'HUMAN',userId:uid},recordedAt:'2026-10-16T05:00:00Z'}]};
  const client=(v:unknown)=>new ApiClient(async()=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}}));
  assert.equal((await m.readKnowledge(client(view),pid,ref)).body,body);
  for(const bad of [{...view,body:'changed'},{...view,state:'CONFIRMED'},{...view,appliedAsConstitution:true},{...view,ref:{...ref,version:2}}])await assert.rejects(m.readKnowledge(client(bad),pid,ref),ApiError);
});
test('지식 검색은 빈 결과와 잘못된 목록/다음 페이지를 구분한다',async()=>{
  const m=await load();assert.ok(m,'검색 연결이 필요하다');
  const page={items:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:'2026-10-16T05:00:00Z'},client=(v:unknown)=>new ApiClient(async()=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}}));
  assert.deepEqual((await m.searchKnowledge(client(page),pid)).items,[]);
  for(const bad of [{...page,items:null,nextCursor:'fake'},{...page,hasMore:true,nextCursor:null},{...page,searchScope:'ALL_PROJECTS',nextCursor:'fake'}])await assert.rejects(m.searchKnowledge(client(bad),pid),ApiError);
});
