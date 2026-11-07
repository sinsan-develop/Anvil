import test from 'node:test';
import assert from 'node:assert/strict';
const mod:any=await import('../../../apps/web/src/features/session-detail/reported-tests.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const report=(status='PASS')=>({criterionId:'FLOW',testId:'FLOW-01',baselineRefs:[],expected:'정상 저장',actual:'제출자가 쓴 내용',status,evidence:[]});
test('보고시험의다섯상태와중복ID·원문순서를합격판정없이보존한다',()=>{
 assert.equal(typeof mod.inspectReportedTests,'function');const input=['PASS','FAIL','NOT_EXECUTED','BLOCKED','NOT_APPLICABLE','PASS'].map(report),before=structuredClone(input),v=mod.inspectReportedTests(input);assert.deepEqual(v,{rows:input.map((value,index)=>({index,value})),invalidIndices:[],listInvalid:false});v.rows[0]!.value.actual='선택화면 임시';assert.deepEqual(input,before);
});
test('부적합보고를정상행으로보정하지않으며과다목록은잘라서완료처럼보이지않는다',()=>{
 assert.equal(typeof mod.inspectReportedTests,'function');for(const bad of[null,{...report(),actual:{}},{...report(),status:'SKIPPED'},{...report(),extra:true},{...report(),evidence:[{sourceKind:'VERIFIED'}]}]){const v=mod.inspectReportedTests([report(),bad,report('BLOCKED')]);assert.deepEqual(v.invalidIndices,[1]);assert.deepEqual(v.rows.map((r:any)=>[r.index,r.value.status]),[[0,'PASS'],[2,'BLOCKED']]);}assert.deepEqual(mod.inspectReportedTests(Array.from({length:201},()=>report())),{rows:[],invalidIndices:[],listInvalid:true});
});
test('근거출처·환경·시각은선언원문으로만보존하고잘못된ref는미확인으로남긴다',()=>{
 const ref={id:'a6f30000-0000-4000-8000-000000000091',version:2,contentHash:'a'.repeat(64)},item={...report('FAIL'),baselineRefs:[ref],evidence:[{sourceKind:'REVIEWER_CONFIRMED',ref,contentHash:'b'.repeat(64),environmentRef:{...ref,version:3},recordedAt:'2026-10-20T00:00:00.000Z'}]};const v=mod.inspectReportedTests([item]);assert.deepEqual(v.rows,[{index:0,value:item}]);const bad=structuredClone(item);bad.evidence[0]!.environmentRef.contentHash='bad';assert.deepEqual(mod.inspectReportedTests([bad]).invalidIndices,[0]);
});
