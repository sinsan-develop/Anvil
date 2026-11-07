import assert from 'node:assert/strict';
import {test} from 'node:test';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import {readDesignActivationInput,assertDesignActivationTarget} from '../../../apps/server/modules/traceability/design-activation-input.ts';

const ref=(suffix:string)=>({id:`a6f30000-0000-4000-8000-${suffix.padStart(12,'0')}`,version:2,contentHash:'a'.repeat(64)});
const input=()=>({changeRef:ref('1'),impactRef:ref('2'),approvedDesignRef:ref('3'),confirmedPlanRef:ref('4'),reason:'  승인된 설계와 개정 계획 적용\n'});
const invalid=(call:()=>unknown)=>assert.throws(call,(error:unknown)=>error instanceof AuthFailure&&error.statusCode===422&&error.message==='DESIGN_ACTIVATION_INPUT_INVALID');

test('FN04 적용 입력은 정확한 다섯 필드를 복사하고 이유 원문을 보존한다',()=>{
  const source=input(),before=structuredClone(source),parsed=readDesignActivationInput(source);
  assert.deepEqual(parsed,before);assert.deepEqual(source,before);assert.notEqual(parsed,source);
  source.changeRef.contentHash='b'.repeat(64);source.impactRef.version=3;
  source.approvedDesignRef.id=ref('5').id;source.confirmedPlanRef.contentHash='c'.repeat(64);source.reason='수정';
  assert.deepEqual(parsed,before);
});

test('FN04 적용 입력은 중복 승인 필드와 알 수 없는 필드를 거절한다',()=>{
  for(const extra of [{approvalRef:null},{scopeDigest:'a'.repeat(64)},{extra:true}])invalid(()=>readDesignActivationInput({...input(),...extra}));
});

test('FN04 적용 입력은 필수 다섯 필드 중 하나라도 없으면 거절한다',()=>{
  for(const field of ['changeRef','impactRef','approvedDesignRef','confirmedPlanRef','reason']){
    const value:Record<string,unknown>={...input()};delete value[field];invalid(()=>readDesignActivationInput(value));
  }
  for(const value of [null,undefined,[],true,'payload'])invalid(()=>readDesignActivationInput(value));
});

for(const field of ['changeRef','impactRef','approvedDesignRef','confirmedPlanRef'] as const){
  test(`FN04 적용 입력은 ${field}의 불완전하거나 잘못된 fullref를 거절한다`,()=>{
    for(const bad of [null,{},ref('x'),{...ref('1'),version:0},{...ref('1'),version:1.5},{...ref('1'),version:Number.MAX_SAFE_INTEGER+1},{...ref('1'),contentHash:'A'.repeat(64)},{...ref('1'),contentHash:'a'.repeat(63)},{...ref('1'),extra:true},{id:ref('1').id,version:2}]){
      invalid(()=>readDesignActivationInput({...input(),[field]:bad}));
    }
  });
}

test('FN04 적용 입력은 비공백 이유와 기존 UTF-16 길이·문자열 계약을 검사한다',()=>{
  for(const reason of ['', ' \t\n', null, 3, '\ud800', 'a'.repeat(20_001)])invalid(()=>readDesignActivationInput({...input(),reason}));
  assert.equal(readDesignActivationInput({...input(),reason:'가'.repeat(20_000)}).reason.length,20_000);
  assert.equal(readDesignActivationInput({...input(),reason:'😀'.repeat(10_000)}).reason.length,20_000);
});

test('FN04 적용 대상은 changeRef의 id와 version에 일치한다',()=>{
  const parsed=readDesignActivationInput(input());
  assert.equal(assertDesignActivationTarget(parsed,parsed.changeRef.id,2),undefined);
});

test('FN04 적용 대상의 다른 id·null 또는 다른 version을 입력 오류로 거절한다',()=>{
  const parsed=readDesignActivationInput(input());
  for(const target of [null,ref('9').id])invalid(()=>assertDesignActivationTarget(parsed,target,2));
  for(const version of [0,1,3,2.5,NaN])invalid(()=>assertDesignActivationTarget(parsed,parsed.changeRef.id,version));
});

test('FN04 적용 입력은 참조 사이에 새로운 상이성 제약을 만들지 않는다',()=>{
  const shared=ref('1'),value={changeRef:shared,impactRef:shared,approvedDesignRef:shared,confirmedPlanRef:shared,reason:'기존 형식 검사'};
  assert.deepEqual(readDesignActivationInput(value),value);
});
