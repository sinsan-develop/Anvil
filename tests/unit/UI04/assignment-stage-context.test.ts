import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { assignmentRevisionFixture } from '../FN09/assignment-revision-fixture.ts';
const compiler=await createServer({configFile:fileURLToPath(new URL('../../../apps/web/vite.config.ts',import.meta.url)),server:{middlewareMode:true,hmr:false,watch:null},optimizeDeps:{noDiscovery:true},logLevel:'silent'});
after(async()=>{await compiler.close();});
const {WorkspaceAssignments}=await compiler.ssrLoadModule('/src/features/workspace/WorkspaceAssignments.tsx');
function render(mode:string){
 const stored=assignmentRevisionFixture().previous,pid=stored.projectId,ref=stored.snapshot.definition.taskRef.applicationRef;
 const project={id:pid,currentMethodologyRef:{...ref,...(mode==='HASH'?{contentHash:'f'.repeat(64)}:mode==='VERSION'?{version:2}:{})},participation:'VIEWER',controlState:{status:'UNASSIGNED',actorId:null,clientId:null,generation:null}};
 const stage=mode==='NONE'?null:{applicationId:mode==='APPLICATION'?'22222222-2222-4222-8222-222222222222':ref.id,nodeId:mode==='NODE'?'N2':'N1',nodeName:'현재 단계'};
 const buffer={bindingId:pid,projectId:pid,ownerUserId:pid,ownerClientId:pid,controlGeneration:1,expectedDesignRef:stored.snapshot.basis.designRef,input:{baseRef:null,definition:stored.snapshot.definition,reason:stored.snapshot.reason},ref:stored.ref,pending:null,result:stored,dirty:false,uncertain:false,failure:null};
 const before=structuredClone({stored,project,stage,buffer});let calls=0,changes=0;
 const html=renderToStaticMarkup(createElement(WorkspaceAssignments,{client:new ApiClient(async()=>{calls++;throw Error('렌더 중 요청 금지');}),project,session:{user:{id:pid},clientId:pid,csrfToken:'C'.repeat(43)},stage,buffer,onChange:()=>{changes++;},onAuthenticationLost:()=>{throw Error('렌더 중 인증 변경 금지');}}));
 assert.equal(calls,0);assert.equal(changes,0);assert.deepEqual({stored,project,stage,buffer},before);return html;
}
test('보관 임무는 선택 단계·적용본 전체 참조와 일치할 때만 같은 단계로 표시한다',()=>{
 const html=render('MATCH');assert.match(html,/보관 임무는 현재 선택 단계와 참조가 일치합니다/);assert.match(html,/표시 대조일 뿐 현재 권한·실행 상태 확인이 아닙니다/);assert.match(html,/임무 고정 조건/);
});
test('다른 node·application·적용 버전·hash와 미선택은 원본 보존과 함께 구분한다',()=>{
 for(const mode of ['NODE','APPLICATION','VERSION','HASH']){const html=render(mode);assert.match(html,/보관 임무는 현재 선택 단계 또는 적용본과 다릅니다/);assert.doesNotMatch(html,/보관 임무는 현재 선택 단계와 참조가 일치합니다/);assert.match(html,/임무 고정 조건/);}
 const html=render('NONE');assert.match(html,/선택 단계 없음 · 보관 임무의 현재 단계 연계 미확인/);assert.match(html,/임무 고정 조건/);
});
