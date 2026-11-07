import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resultFixture} from './result-view-fixture.ts';
const mod:any=await import('../../../apps/web/src/features/session-detail/unexecuted-reports.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('미실행 보고는 조건/시험 exact 쌍의 원보고만 연결하고 중복 위치와 원문을 보존한다',()=>{
 assert.equal(typeof mod.inspectUnexecutedReports,'function','미실행 보고 탐색 미구현');const f=resultFixture(),u=[...f.entry.snapshot.manifest.unexecuted,{criterionId:'C1',testId:'T1',reason:'다른 미실행 이유'},{criterionId:'C2',testId:'T1',reason:'별도 조건'}],tests=[{...f.entry.snapshot.manifest.testResults[0],status:'PASS',actual:'수행자 성공 주장'},...f.entry.snapshot.manifest.testResults],before=JSON.stringify({u,tests});
 const v=mod.inspectUnexecutedReports(u,tests);assert.deepEqual(v.rows.map((r:any)=>r.index),[0,1,2]);assert.deepEqual(v.rows[0].testReports.map((r:any)=>[r.index,r.value.status]),[[0,'PASS'],[1,'NOT_EXECUTED']]);assert.deepEqual(v.rows[2].testReports,[]);assert.equal(v.testReportsIncomplete,false);assert.equal(JSON.stringify({u,tests}),before);v.rows[0].value.reason='표시 복사만 수정';assert.equal(u[0]!.reason,'실제 Agent 미연결');
});
test('목록/행 형식 미확인은 누락 위치를 남기며 정상 미실행이나 수행완료로 보정하지 않는다',()=>{
 assert.equal(typeof mod.inspectUnexecutedReports,'function');for(const raw of [null,{},Array(201).fill({})]){const v=mod.inspectUnexecutedReports(raw,[]);assert.equal(v.listInvalid,true);assert.deepEqual(v.rows,[]);}
 const f=resultFixture(),v=mod.inspectUnexecutedReports([f.entry.snapshot.manifest.unexecuted[0],{criterionId:'C1',testId:'T1',reason:''},{criterionId:'C1',testId:'T1',reason:'사유',extra:true}],f.entry.snapshot.manifest.testResults.concat({broken:true} as any));assert.deepEqual(v.invalidIndices,[1,2]);assert.equal(v.rows.length,1);assert.equal(v.testReportsIncomplete,true);assert.equal(v.rows[0].testReports[0].value.status,'NOT_EXECUTED');
});
