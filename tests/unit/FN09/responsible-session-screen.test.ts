import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { newResponsibleSessionBuffer } from '../../../apps/web/src/features/workspace/responsible-session-api.ts';
const require=createRequire(import.meta.url);
// TSX만 메모리에서 변환한다. 파일/서버/DOM/DB/외부 Agent 생성이 아니다.
const sourceUrl=new URL('../../../apps/web/src/features/workspace/WorkspaceResponsibleSessions.tsx',import.meta.url);
const compiled=(await transformWithOxc(await readFile(sourceUrl,'utf8'),fileURLToPath(sourceUrl),{lang:'tsx'})).code;
const code=compiled.replace(/(from\s*['"])([^'"]+)(['"])/g,(_match,start,path,end)=>start+(path.startsWith('.')?new URL(path,sourceUrl).href:pathToFileURL(require.resolve(path)).href)+end);
const {WorkspaceResponsibleSessions}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const pid='11111111-1111-4111-8111-111111111111',ref={id:pid,version:1,contentHash:'a'.repeat(64)},session:any={user:{id:pid},clientId:pid,csrfToken:'a'.repeat(43)};
const confirmed:any={projectId:pid,ref,snapshot:{contentConfirmed:true,executionAuthorized:false,dispatchPerformed:false}};
function render(buffer:any,owner=true) {
  let effects=0;const html=renderToStaticMarkup(createElement(WorkspaceResponsibleSessions,{client:new ApiClient(async()=>{effects++;throw Error('UNEXPECTED_FETCH');}),confirmed,session,buffer,onChange:()=>{effects++;},owner,busy:false,run:()=>{effects++;}}));assert.equal(effects,0);return html;
}
test('원문 조회가 없어도 미확인 명령ID/불확실 상태를 숨기지 않고 자동 호출하지 않는다',()=>{
  const b=newResponsibleSessionBuffer(confirmed,session,1);
  b.pending={schemaVersion:1,projectId:pid,commandId:'22222222-2222-4222-8222-222222222222',clientId:pid,controlGeneration:1,operation:'defineProjectRole',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{kind:'COORDINATOR'}};b.uncertain=true;
  const text=render(b);assert(text.includes(b.pending.commandId));assert(text.includes('결과 미확인'));assert(!text.includes('저장 영수증 확인'));
});
test('다른주체 보관 입력은 경고만 표시하고 원 명령/내용을 노출하지 않는다',()=>{
  const b=newResponsibleSessionBuffer(confirmed,session,1);b.ownerClientId='22222222-2222-4222-8222-222222222222';b.reason='다른주체비공개입력';
  const text=render(b);assert(text.includes('다른 임무·주체'));assert(!text.includes(b.reason));assert(!text.includes('새 실행 준비 저장 완료'));
});
