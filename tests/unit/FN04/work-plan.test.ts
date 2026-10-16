import assert from 'node:assert/strict';
import {test} from 'node:test';

const load=()=>import('../../../apps/server/modules/traceability/work-plan-card.ts');
const card=(taskCode='UI01')=>({taskCode,type:'SCREEN',title:'문서 조회',purpose:'원문과 현재 위치 확인',designRefs:[],screenRefs:[],ownerRole:'단계 책임자',inputs:['확정 설계'],outputs:['화면과 조회 결과'],included:['문서 조회'],excluded:['Agent 실행'],allowedFileRefs:['apps/web/src/documents.tsx'],startPrerequisites:[],acceptancePrerequisites:[],steps:['원문을 읽고 화면을 구현한다'],testCases:[{id:'TC01',kind:'NORMAL',steps:['문서 열기'],expected:'정확 원문 표시',environment:'WSL 개발 환경'},{id:'TC02',kind:'IMPORTANT_FAILURE',steps:['권한 없는 문서 열기'],expected:'본문을 노출하지 않음',environment:'WSL 개발 환경'},{id:'TC03',kind:'DIRECT_IMPACT',steps:['기존 목록 열기'],expected:'기존 목록 유지',environment:'WSL 개발 환경'}],acceptanceCriteria:['화면과 실제 원문 일치'],evidenceRequirements:['정확 버전과 시험 결과'],rollback:'이전 검증 commit으로 복구',recoveryNotes:'미완료 지점 보존'});

test('계획 카드는 착수와 연결검수 선행을 분리하고 누락을 완료로 숨기지 않는다',async()=>{
  const module=await load().catch(()=>null);assert.ok(module,'업무 카드 분석 구현이 필요하다');
  const first=card(),second={...card('FN01'),type:'FUNCTION',startPrerequisites:['UI01'],acceptancePrerequisites:['UI01']};
  const before=structuredClone([first,second]);const result=module.analyzeWorkPlanCards(before);
  assert.deepEqual(before,[first,second]);assert.equal(result.status,'DRAFT');assert.equal(result.dependencies.length,2);
  assert.ok(result.issues.some(i=>i.code==='DESIGN_LINK_MISSING'));assert.ok(result.issues.some(i=>i.code==='SCREEN_LINK_MISSING'));
  assert.equal('completed' in result,false);assert.equal('ready' in result,false);
});
test('순환·중복·누락된 검수 조건을 issues로 보존하되 가짜 실행 상태와 절대 경로는 거절한다',async()=>{
  const module=await load().catch(()=>null);assert.ok(module,'업무 카드 분석 구현이 필요하다');
  const a={...card(),startPrerequisites:['FN01'],testCases:[]},b={...card('FN01'),startPrerequisites:['UI01']};
  const result=module.analyzeWorkPlanCards([a,b,{...card(),purpose:''}]);
  for(const code of ['DUPLICATE_TASK_CODE','DEPENDENCY_CYCLE','TEST_COVERAGE_MISSING','CARD_TEXT_MISSING']) assert.ok(result.issues.some(i=>i.code===code),code);
  assert.throws(()=>module.analyzeWorkPlanCards([{...card(),status:'COMPLETED'}]));
  assert.throws(()=>module.analyzeWorkPlanCards([{...card(),allowedFileRefs:['../secret']} ]));
  assert.throws(()=>module.analyzeWorkPlanCards([{...card(),allowedFileRefs:['C:/secret']} ]));
});
