import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ApiError} from '../../../apps/web/src/api/client.ts';
const m:any=await import(new URL('../../../apps/web/src/features/design-trace/StoredPlanTraceCoverage.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const id=(n:number)=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:2,contentHash:'a'.repeat(64)});
function selection(){return {projectId:id(1),userId:id(2),clientId:id(3),planRef:ref(4),designRef:ref(5)};}
function value(){return {projectId:id(1),analysis:{designRef:ref(5),planRef:ref(4),planIssueCodes:[],projectScopeAuthenticated:false,sourceTextVerified:false,accepted:false,completionDetermined:false,storageMutationPerformed:false,executionAuthorized:false,status:'UNVERIFIED',reason:'PLAN_TRACE_COVERAGE_ONLY',unlinkedDesignItems:[{id:id(6),localCode:'D_SECRET_OLD'}],unlinkedScreenRegions:[],invalidTaskLinks:[],ungroundedTasks:[]}};}
function render(s=selection(),readState:any=null){assert.equal(typeof m.PlanTraceCoverageReadState,'function','보관 계획 누락 조회 상태 표시 미구현');return renderToStaticMarkup(createElement(m.PlanTraceCoverageReadState,{selection:s,readState}));}
test('현재 project/user/client/plan/design 문맥에 해당하는 읽기 결과만 표시한다',()=>{
 const s=selection(),readState={key:JSON.stringify(s),value:value(),error:null},html=render(s,readState);assert.match(html,/D_SECRET_OLD/);assert.match(html,/기능 완료·검수 합격·실행 허가가 아닙니다/);
 for(const next of [{...s,projectId:id(99)},{...s,userId:id(99)},{...s,clientId:id(99)},{...s,planRef:{...s.planRef,version:3}},{...s,designRef:{...s.designRef,contentHash:'b'.repeat(64)}}]){const result=render(next,readState);assert.match(result,/고정 계획·설계 연결 확인 중/);assert.doesNotMatch(result,/D_SECRET_OLD|입력 목록 내 누락 없음/);}
});
test('새 조회 대기와 읽기 오류는 앞선 결과로 대체하거나 원 오류 본문을 출력하지 않는다',()=>{
 assert.match(render(),/고정 계획·설계 연결 확인 중/);const s=selection(),error=new ApiError('AUTH_REQUIRED',401);error.message='PRIVATE_ERROR_BODY';const html=render(s,{key:JSON.stringify(s),value:value(),error});assert.match(html,/연결 분석 미확인/);assert.match(html,/AUTH_REQUIRED/);assert.doesNotMatch(html,/D_SECRET_OLD|PRIVATE_ERROR_BODY|입력 목록 내 누락 없음/);
});
