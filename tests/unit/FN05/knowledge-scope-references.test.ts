import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {ProjectKnowledge} from '../../../apps/server/modules/knowledge/knowledge.ts';
const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const actor={actorId:id,clientId:id} as any;
const graph={nodes:[{nodeId:'N1',name:'검토',purpose:'고정 기준',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['검토'],excluded:[]},completionCriteria:['기록'],approvalBoundary:['사람 승인'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
const snapshot={name:'과거 적용본',purpose:'관련성만',graph,sourceRef:{id,version:1,contentHash:contentHash(canonicalJson(graph))}};
const row={id,project_id:pid,application_version:2,snapshot_json:snapshot,snapshot_hash:contentHash(canonicalJson(snapshot)),source_definition_id:id,source_version:1,source_hash:snapshot.sourceRef.contentHash};
const applicationRef={id,version:2,contentHash:row.snapshot_hash};
const load=async()=>{const m=await import(new URL('../../../apps/server/modules/knowledge/knowledge-scope.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof m.verifyKnowledgeScope,'function','실제 고정 참조 대조가 필요하다');return m.verifyKnowledgeScope;};
test('과거 고정 적용본은 최신으로 치환하지 않고 프로젝트·버전·hash·노드를 대조한다',async()=>{
  const verify=await load(),calls:unknown[]=[];
  const db={query:async(sql:string,args:unknown[])=>{calls.push(args);assert.ok(sql.includes('project_methodologies'));return{rows:[row]};}};
  await verify(db,pid,{projectId:pid,stageRefs:[{applicationRef,nodeId:'N1'}],taskRefs:[]},async()=>{throw Error('unexpected');});
  assert.deepEqual(calls,[[pid,id,2]]);
  for(const changed of [{...applicationRef,contentHash:'b'.repeat(64)},applicationRef]){
    await assert.rejects(verify(db,pid,{projectId:pid,stageRefs:[{applicationRef:changed,nodeId:changed===applicationRef?'missing':'N1'}],taskRefs:[]},async()=>null));
  }
  for(const rows of [[],[{...row,project_id:id}],[{...row,snapshot_json:{...snapshot,name:'변조'}}]])await assert.rejects(verify({query:async()=>({rows})},pid,{projectId:pid,stageRefs:[{applicationRef,nodeId:'N1'}],taskRefs:[]},async()=>null));
});
test('업무는 정확 계획 조회 결과의 고정 ref와 실제 코드만 수용한다',async()=>{
  const verify=await load(),scope={projectId:pid,stageRefs:[],taskRefs:[{planRef:applicationRef,taskCode:'UI10'}]},calls:unknown[]=[];
  await verify({},pid,scope,async(ref:any)=>{calls.push(ref);return{ref:applicationRef,tasks:[{taskCode:'UI10'}]};});assert.deepEqual(calls,[applicationRef]);
  for(const result of [{ref:{...applicationRef,version:3},tasks:[{taskCode:'UI10'}]},{ref:applicationRef,tasks:[{taskCode:'FN05'}]}])await assert.rejects(verify({},pid,scope,async()=>result));
  await assert.rejects(verify({},pid,scope,async()=>{throw Error('denied');}));
});
test('동일 코드가 둘인 보관 초안은 관련 업무를 식별할 수 없어 거절한다',async()=>{
 const verify=await load();await assert.rejects(verify({},pid,{projectId:pid,stageRefs:[],taskRefs:[{planRef:applicationRef,taskCode:'UI10'}]},async()=>({ref:applicationRef,tasks:[{taskCode:'UI10',title:'첫 업무'},{taskCode:'UI10',title:'다른 업무'}]})),(e:any)=>e.message==='KNOWLEDGE_SCOPE_AMBIGUOUS');
});
test('기존 saveKnowledge는 없는 고정 적용 참조를 영수증·저장 이전에 거절한다',async()=>{
  const writes:string[]=[];const db={query:async(sql:string)=>{if(sql.startsWith('INSERT'))writes.push(sql);return{rows:[]};}};
  const entry={kind:'FACT',title:'관측',reason:'관련성',sourceRefs:[],contentRef:{artifactId:id,bytes:6,contentHash:'a'.repeat(64),mediaType:'text/plain;charset=utf-8'},scope:{projectId:pid,stageRefs:[{applicationRef,nodeId:'N1'}],taskRefs:[]},relatedRefs:[]};
  await assert.rejects(new ProjectKnowledge({originalText:async()=>'내용'} as any).save(db as any,actor,{projectId:pid,targetId:null,expectedVersion:0,payload:{entry}} as any,applicationRef),(e:any)=>e.message==='KNOWLEDGE_SCOPE_NOT_FOUND');
  assert.deepEqual(writes,[]);
});
