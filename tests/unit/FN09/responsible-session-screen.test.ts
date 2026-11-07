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
const memoryModules=new Map<string,Promise<string>>();
function memoryTsxUrl(url:URL):Promise<string> {
  const cached=memoryModules.get(url.href);if(cached)return cached;
  const pending=(async()=>{
    const compiled=(await transformWithOxc(await readFile(url,'utf8'),fileURLToPath(url),{lang:'tsx'})).code;
    let code='',offset=0;
    for(const match of compiled.matchAll(/(from\s*['"])([^'"]+)(['"])/g)) {
      const start=match[1]!,path=match[2]!,end=match[3]!,resolved=path.startsWith('.')?new URL(path,url):pathToFileURL(require.resolve(path));
      const target=resolved.pathname.endsWith('.tsx')?await memoryTsxUrl(resolved):resolved.href;
      code+=compiled.slice(offset,match.index)+start+target+end;offset=match.index+match[0].length;
    }
    return 'data:text/javascript;base64,'+Buffer.from(code+compiled.slice(offset)).toString('base64');
  })();
  memoryModules.set(url.href,pending);return pending;
}
const {WorkspaceResponsibleSessions,ProviderClaimHistoryPanel,ProviderClaimHistoryRow}=await import(await memoryTsxUrl(sourceUrl));
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
test('provider 이력 패널은 명시 조회 버튼·예약/사용불가 구분만 표시하고 자동 호출/쓰기0이다',()=>{
 assert.equal(typeof ProviderClaimHistoryPanel,'function');let calls=0;const html=renderToStaticMarkup(createElement(ProviderClaimHistoryPanel,{client:new ApiClient(async()=>{calls++;throw Error('NO_FETCH');}),projectId:pid,sessionRef:ref,subjectKey:'human-current',onAuthenticationLost:()=>{calls++;}}));assert.equal(calls,0);assert.ok(html.includes('공급자 세션 기록 조회'));assert.ok(html.includes('현재 사용 가능성: 미확인'));assert.ok(html.includes('THREAD'));assert.ok(!html.includes('새 SEND'));assert.ok(!html.includes('READY'));
});
test('provider 기록 행은 TURN을 THREAD로 오표시하지 않고 원 결과 버튼에 정확 query를 유지한다',()=>{
 assert.equal(typeof ProviderClaimHistoryRow,'function');let calls=0,selected:unknown=null;
 for(const kind of ['THREAD','TURN']){const item={query:{projectId:pid,agentSessionId:pid,executionId:pid,generation:1,commandId:pid,kind,requestIdDigest:'b'.repeat(64),claimHash:ref.contentHash},receipt:{claimRef:ref,recordedAt:'2026-10-22T05:00:00.000Z'}},props={item,pending:false,onSelect:(q:unknown)=>{calls++;selected=q;}};const before=calls,html=renderToStaticMarkup(createElement(ProviderClaimHistoryRow,props));assert(html.includes(kind+' · 수신 기록'));assert(html.includes('이 기록의 원 결과 확인'));assert(!html.includes('READY'));assert.equal(calls,before);const row=ProviderClaimHistoryRow(props),button=row.props.children.find((c:any)=>c?.type==='button');button.props.onClick();assert.strictEqual(selected,item.query);}
 assert.equal(calls,2);
});
