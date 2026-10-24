import test from 'node:test';
import assert from 'node:assert/strict';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',at='2026-10-25T00:00:00Z';
const graph={nodes:[{nodeId:'N1',name:'고정 단계',purpose:'보관 지식 관련성',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['설계'],excluded:[]},completionCriteria:['원문'],approvalBoundary:['사람'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
const docRef={id:uid,version:1,contentHash:'a'.repeat(64)},snapshot={name:'고정 방법론',purpose:'원문',graph,sourceRef:{...docRef,contentHash:contentHash(canonicalJson(graph))}},applicationRef={id:aid,version:2,contentHash:contentHash(canonicalJson(snapshot))};
const task={taskCode:'FN05',type:'FUNCTION',title:'고정 업무',purpose:'원문',designRefs:[],screenRefs:[],ownerRole:'단계책임자',inputs:[],outputs:[],included:[],excluded:[],allowedFileRefs:[],startPrerequisites:[],acceptancePrerequisites:[],steps:[],testCases:[],acceptanceCriteria:[],evidenceRequirements:[],rollback:'새정정',recoveryNotes:'원문보존'};
function fixture(kind:'STAGE'|'TASK',duplicate=false){
 const planSnapshot={documentRef:docRef,designRef:docRef,screenReviewRefs:[],tasks:duplicate?[task,{...task,title:'모호한 업무'}]:[task],dependencies:[],reason:'고정',issues:[],relationalProjection:duplicate?'ISSUES_ONLY':'STORED'},planRef={id:uid,version:3,contentHash:contentHash(canonicalJson(planSnapshot))},stageRef={applicationRef,nodeId:'N1'},taskRef={planRef,taskCode:'FN05'},scope={projectId:pid,stageRefs:[stageRef],taskRefs:[taskRef]},body='원문',entry={kind:'FACT',title:'관측',reason:'관련성',scope,sourceRefs:[],relatedRefs:[],contentRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(body),mediaType:'text/plain;charset=utf-8'}},ref={id:pid,version:1,contentHash:contentHash(canonicalJson(entry))};
 const knowledge={ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]};
 const project={id:pid,name:'프로젝트',purpose:'기록',desiredOutcome:'보존',version:1,createdAt:at,updatedAt:at,currentMethodologyRef:applicationRef,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:1}};
 return{knowledge,project,method:{projectId:pid,applicationRef,snapshot,observedAt:at,executionState:'NOT_CONNECTED'},plan:{ref:planRef,status:'DRAFT',...planSnapshot,executionEvidence:'NOT_CONNECTED',observedAt:at},selection:{projectId:pid,knowledgeRef:ref,source:kind==='STAGE'?{kind,reference:stageRef}:{kind,reference:taskRef}}};
}
const load=async()=>{const m=await import(new URL('../../../apps/web/src/features/knowledge/knowledge-scope-original.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});assert.equal(typeof m.readKnowledgeScopeOriginal,'function');return m.readKnowledgeScopeOriginal;};
function client(f:ReturnType<typeof fixture>,change=(key:string,v:any)=>v){const calls:string[]=[];return{calls,client:new ApiClient(async(path,init)=>{assert.equal(init?.method,'GET');const p=String(path);calls.push(p);return Response.json(change(p.includes('/knowledge/')?'knowledge':p.includes('/work-plans/')?'plan':p.endsWith('/methodology-application')?'method':'project',p.includes('/knowledge/')?f.knowledge:p.includes('/work-plans/')?f.plan:p.endsWith('/methodology-application')?f.method:f.project));})};}
test('정확 지식에 속한 업무만 고정 계획 원문으로 열고 현재 실행을 주장하지 않는다',async()=>{
 const fn=await load(),f=fixture('TASK'),c=client(f),v=await fn(c.client,f.selection,()=>true);assert.equal(v.kind,'TASK');assert.deepEqual(v.task,task);assert.deepEqual(v.ref,f.plan.ref);assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert.equal(c.calls.length,2);
});
test('현재 고정 적용본의 정확 노드만 열며 과거 scope를 현재 적용으로 치환하지 않는다',async()=>{
 const fn=await load(),f=fixture('STAGE'),c=client(f),v=await fn(c.client,f.selection,()=>true);assert.equal(v.kind,'STAGE');assert.deepEqual(v.node,graph.nodes[0]);assert.deepEqual(v.ref,applicationRef);assert.equal(c.calls.length,3);
 const changed=client(f,(key,v)=>key==='project'?{...v,currentMethodologyRef:{...applicationRef,version:3}}:v);await assert.rejects(fn(changed.client,f.selection,()=>true));assert.equal(changed.calls.length,2);
});
test('없는 선택·모호한 업무·변조 원문·조회 거절은 대체 성공이 아니다',async()=>{
 const fn=await load(),f=fixture('TASK');const absent=structuredClone(f.selection);(absent.source.reference as any).taskCode='FN99';const a=client(f);await assert.rejects(fn(a.client,absent,()=>true));assert.equal(a.calls.length,1);
 const dup=fixture('TASK',true);await assert.rejects(fn(client(dup).client,dup.selection,()=>true));
 await assert.rejects(fn(client(f,(key,v)=>key==='plan'?{...v,ref:{...v.ref,contentHash:'f'.repeat(64)}}:v).client,f.selection,()=>true));
 for(const status of [401,403,404,503])await assert.rejects(fn(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status})),f.selection,()=>true));
});
test('닫힌 조회는 후속 GET이나 늦은 채택을 하지 않으며 호출 뒤 참조 변조도 섞지 않는다',async()=>{
 const fn=await load(),f=fixture('TASK');let active=true;const c=client(f,(key,v)=>{if(key==='knowledge')active=false;return v;});assert.equal(await fn(c.client,f.selection,()=>active),null);assert.equal(c.calls.length,1);
 const d=client(f);const selection=structuredClone(f.selection),pending=fn(d.client,selection,()=>true);(selection.source.reference as any).taskCode='FN99';assert.deepEqual((await pending).task,task);
 const never=client(f);assert.equal(await fn(never.client,f.selection,()=>false),null);assert.equal(never.calls.length,0);
});
test('마지막 업무·단계 원문 응답에서 닫혀도 본문/hash 대조 후 결과를 채택하지 않는다',async()=>{
 const fn=await load();for(const kind of ['TASK','STAGE'] as const){const f=fixture(kind);let active=true;const c=client(f,(key,v)=>{if(key===(kind==='TASK'?'plan':'method'))active=false;return v;});assert.equal(await fn(c.client,f.selection,()=>active),null);assert.equal(c.calls.length,kind==='TASK'?2:3);}
});
