import assert from 'node:assert/strict';
import {test} from 'node:test';
const file='../../../apps/web/src/features/session-detail/reported-changes.ts';
const change={path:'src/task.ts',kind:'MODIFIED',diffRef:null,beforeHash:null,afterHash:null};
test('변경 보고는 원문 위치·중복·null 근거와 원입력을 보존한다',async()=>{
 const {inspectReportedChanges}=await import(file),raw=[change,{...change,kind:'DELETED',beforeHash:'a'.repeat(64)}],before=structuredClone(raw),r=inspectReportedChanges(raw);
 assert.equal(r.listInvalid,false);assert.deepEqual(r.invalidIndices,[]);assert.deepEqual(r.rows.map((v:any)=>v.index),[0,1]);assert.deepEqual(r.rows.map((v:any)=>v.value),raw);assert.notEqual(r.rows[0].value,raw[0]);assert.deepEqual(raw,before);
});
test('잘못된 경로·추가 완료주장·변조hash는 정상행으로 보정하지 않고 위치를 남긴다',async()=>{
 const {inspectReportedChanges}=await import(file);
 const raw=[change,...['/tmp/x','D:\\x','a/../x','a//x'].map(path=>({...change,path})),{...change,accepted:true},{...change,afterHash:'변조'}];
 const r=inspectReportedChanges(raw);assert.equal(r.rows.length,1);assert.deepEqual(r.invalidIndices,[1,2,3,4,5,6]);
 assert.equal(inspectReportedChanges(null).listInvalid,true);assert.equal(inspectReportedChanges(Array(201).fill(change)).listInvalid,true);
});
