import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as state from '../../../apps/server/modules/knowledge/knowledge-state.ts';

const ref={id:'10000000-0000-4000-8000-000000000001',version:2,contentHash:'a'.repeat(64)};
const view={ref,entry:{kind:'CONSTITUTION'},state:'CONFIRMED',headVersion:2,confirmation:{eventId:'20000000-0000-4000-8000-000000000002'},currentConfirmationValid:true};
test('헌법 적용은 확정·현재 버전·최신 검토의 실제 상태를 구분하고 과거 적용을 지우지 않는다',()=>{
  const inspect=(state as any).constitutionEligibility;
  assert.equal(typeof inspect,'function','프로젝트 헌법의 현재 사용 가능 판정이 필요하다');
  assert.deepEqual(inspect(view),{usable:true,reasons:[]});
  assert.deepEqual(inspect({...view,headVersion:3,state:'SUPERSEDED'}),{usable:false,reasons:['SUPERSEDED']});
  assert.deepEqual(inspect({...view,state:'EXCLUDED'}),{usable:false,reasons:['EXCLUDED']});
  assert.deepEqual(inspect({...view,currentConfirmationValid:false}),{usable:false,reasons:['REVIEW_NOT_CURRENT']});
  assert.deepEqual(inspect({...view,confirmation:null,state:'PROPOSED',currentConfirmationValid:false}),{usable:false,reasons:['NOT_CONFIRMED']});
  assert.deepEqual(inspect({...view,entry:{kind:'FACT'}}),{usable:false,reasons:['NOT_CONSTITUTION']});
});
test('별도 적용 입력은 확인·정확 버전·확정 사건·이유만 수용하고 자동 실행 필드를 거절한다',()=>{
  const read=(state as any).readConstitutionApplication;
  assert.equal(typeof read,'function','헌법 적용 입력 검사 필요');
  const input={versionRef:ref,confirmationId:view.confirmation.eventId,reason:'이 프로젝트의 기준으로 별도 적용',acknowledged:true};
  assert.deepEqual(read(input),input);
  for(const bad of [{...input,acknowledged:false},{...input,reason:' '},{...input,confirmationId:'invalid'},{...input,agentDelivery:true},{...input,versionRef:{...ref,version:0}}])assert.throws(()=>read(bad),{message:'CONSTITUTION_INPUT_INVALID'});
});
