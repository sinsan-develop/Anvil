import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readKnowledgeEntry} from '../../../apps/server/modules/knowledge/knowledge-entry.ts';

const pid='11111111-1111-4111-8111-111111111111';
const ref={id:'22222222-2222-4222-8222-222222222222',version:2,contentHash:'a'.repeat(64)};
const stage={applicationRef:ref,nodeId:'design'};
const task={planRef:ref,taskCode:'UI10'};
const entry=(stageRefs:unknown[]=[],taskRefs:unknown[]=[])=>({kind:'FACT',title:'고정 원문 관련성',contentRef:{artifactId:ref.id,bytes:5,contentHash:'b'.repeat(64),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'프로젝트 내부 참조',scope:{projectId:pid,stageRefs,taskRefs},relatedRefs:[]});

test('정확 단계·업무 참조를 복제해 보존하고 기존 공통 JSON을 바꾸지 않는다',()=>{
  const input=entry([stage],[task]),result=readKnowledgeEntry(input,pid);
  assert.deepEqual(result,input);assert.notEqual(result.scope.stageRefs,input.scope.stageRefs);
  assert.deepEqual(readKnowledgeEntry(entry(),pid),entry());
});
test('관련성 200개 경계는 수용하고 초과·중복·추가키·잘못된 고정 참조는 거절한다',()=>{
  const stages=Array.from({length:200},(_,i)=>({...stage,nodeId:`stage-${i}`}));
  assert.equal(readKnowledgeEntry(entry(stages),pid).scope.stageRefs.length,200);
  for(const value of [entry(stages,[task]),entry([stage,stage]),entry([],[task,task]),entry([{...stage,path:'/tmp'}]),entry([{...stage,nodeId:'\ud800'}]),entry([{...stage,nodeId:''}]),entry([{...stage,applicationRef:{...ref,version:0}}]),entry([],[{...task,taskCode:'\ud800'}]),entry([],[{...task,planRef:{...ref,contentHash:'x'}}])])assert.throws(()=>readKnowledgeEntry(value,pid));
});
test('목적·헌법은 프로젝트 공통이며 실행 관련참조는 계속 거절한다',()=>{
  for(const kind of ['PURPOSE','CONSTITUTION']){
    assert.deepEqual(readKnowledgeEntry({...entry(),kind},pid),{...entry(),kind});
    assert.throws(()=>readKnowledgeEntry({...entry([stage]),kind},pid));
    assert.throws(()=>readKnowledgeEntry({...entry([],[task]),kind},pid));
  }
  assert.throws(()=>readKnowledgeEntry({...entry(),relatedRefs:[ref]},pid));
});
