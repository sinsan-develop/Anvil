import assert from 'node:assert/strict';
import {test} from 'node:test';

const pid='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const artifact={artifactId:id,bytes:20,contentHash:'a'.repeat(64),mediaType:'text/plain;charset=utf-8'};
const entry=()=>({kind:'HYPOTHESIS',title:'본문 소비 가설',contentRef:artifact,sourceRefs:[{kind:'ARTIFACT',id,contentHash:'a'.repeat(64)}],reason:'원문과 가설을 구분한다',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]});
const load=()=>import('../../../apps/server/modules/knowledge/knowledge-entry.ts').catch(()=>null);
test('지식 초안은 원문 출처·가설·이유를 바꾸지 않고 임의 확정이나 다른 프로젝트를 거절한다',async()=>{
  const module=await load();assert.ok(module,'지식 입력 검증 구현이 필요하다');
  const input=entry();assert.deepEqual(module.readKnowledgeEntry(input,pid),input);
  assert.deepEqual(input,entry());
  for(const bad of [{...input,state:'CONFIRMED'},{...input,reason:''},{...input,kind:'AGENT_CONFIRMED'},{...input,scope:{...input.scope,projectId:id}},{...input,sourceRefs:[{kind:'ARTIFACT',id,contentHash:'a'.repeat(64),path:'/tmp/secret'}]}])assert.throws(()=>module.readKnowledgeEntry(bad,pid));
});
test('미연결 단계·실행 출처와 중복·잘못된 출처를 검증된 지식으로 저장하지 않는다',async()=>{
  const module=await load();assert.ok(module,'지식 입력 검증 구현이 필요하다');
  for(const input of [{...entry(),scope:{projectId:pid,stageRefs:[{id}],taskRefs:[]}},{...entry(),relatedRefs:[{kind:'EXECUTION',id}]},{...entry(),sourceRefs:[{kind:'USER_INSTRUCTION',id,contentHash:'a'.repeat(64)}]},{...entry(),sourceRefs:[entry().sourceRefs[0],entry().sourceRefs[0]]},{...entry(),contentRef:{...artifact,bytes:-1}}])assert.throws(()=>module.readKnowledgeEntry(input,pid));
});
test('알려진 비밀 의심 문구는 검색/본문 노출 경로에서 값을 포함하지 않는 거절로 멈춘다',async()=>{
  const module=await load();assert.ok(module&&typeof module.assertKnowledgeTextSafe==='function','비밀 의심 노출 차단이 필요하다');
  module.assertKnowledgeTextSafe('API 키는 별도 보호 저장소를 사용한다');
  for(const text of ['-----BEGIN PRIVATE KEY-----\nsynthetic-only','token=synthetic-not-a-real-token','Bearer synthetic-not-a-real-token-123456789'])assert.throws(()=>module.assertKnowledgeTextSafe(text),(e:unknown)=>e instanceof Error&&e.message==='KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED');
});
