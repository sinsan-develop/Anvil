import {test,expect} from '@playwright/test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
const pid='32b5f276-13e6-4d8a-b93f-27a15d21c788',uid='51c0439f-791e-4bb5-8471-70938d6afaf1',at='2026-10-24T00:00:00.000Z';
const sourceId='a6f20000-0000-4000-8000-000000000093',appId='a6f20000-0000-4000-8000-000000000094';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(){
 const node={nodeId:'N1',name:'설계',purpose:'고정 설계 정의',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['설계'],excluded:['운영']},completionCriteria:['내용 대조'],approvalBoundary:['사용자 확정'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['기록']};
 const second={...node,nodeId:'N2',name:'구현',purpose:'고정 구현 정의',position:{x:250,y:0},kind:'AGENT',role:'STAGE_OWNER'};
 const graph={nodes:[node,second],edges:[{edgeId:'E1',fromNodeId:'N1',toNodeId:'N2',kind:'SEQUENCE',reason:'확정 뒤 구현',condition:null}],entryNodeId:'N1',terminalNodeIds:['N2']};
 const snapshot={name:'목록에서 확인한 개발절차',purpose:'고정 정의 탐색',graph,sourceRef:{id:sourceId,version:1,contentHash:hash(graph)}};
 const ref={id:appId,version:2,contentHash:hash(snapshot)};
 const summary={id:pid,name:'Anvil QA',purpose:'사용자 절차대로 개발',version:1,updatedAt:at};
 const project={...summary,desiredOutcome:'프로젝트 지식 보존',createdAt:at,currentMethodologyRef:ref,baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[],viewerPermissions:['READ_PROJECT'],participation:'VIEWER',controlState:{actorId:uid,clientId:uid,generation:1,status:'OTHER_CLIENT'}};
 return{summary,project,application:{projectId:pid,applicationRef:ref,snapshot,observedAt:at,executionState:'NOT_CONNECTED'}};
}
for(const mode of ['NORMAL','EMPTY','DENIED','INTEGRITY','LATE','PARENT'])test('PROJECT_METHODOLOGY_'+mode,async({page})=>{
 const f=fixture(),unknown:string[]=[],writes:string[]=[],errors:string[]=[],reads:string[]=[];let listCalls=0,release=()=>{};
 const gate=new Promise<void>(resolve=>release=resolve);
 await page.addInitScript(id=>{(globalThis as any).__projectMethodConsumed=0;const original=globalThis.fetch;globalThis.fetch=async(...args)=>{const response=await original(...args);if(new URL(String(args[0]),location.href).pathname===`/api/v1/projects/${id}`){const json=response.json.bind(response);response.json=async()=>{const v=await json();(globalThis as any).__projectMethodConsumed++;return v;};}return response;};},pid);
 await installWorkspaceBundle(page);await page.route('**/api/v1/**',r=>{unknown.push(r.request().url());return r.abort();});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'조회자 QA'},clientId:uid,csrfToken:'A'.repeat(43)}}));
 await page.route(/\/api\/v1\/projects(?:\?|$)/,async r=>{listCalls++;if(mode==='PARENT'&&listCalls>1)await gate;return r.fulfill({json:{items:[f.summary],hasMore:false,nextCursor:null,observedAt:at,baselineVersion:null}});});
 await page.route(`**/api/v1/projects/${pid}`,async r=>{reads.push('PROJECT');if(mode==='LATE')await gate;return mode==='DENIED'?r.fulfill({status:403,json:{code:'PROJECT_ACCESS_DENIED'}}):r.fulfill({json:mode==='EMPTY'?{...f.project,currentMethodologyRef:null}:f.project});});
 await page.route(`**/api/v1/projects/${pid}/methodology-application`,r=>{reads.push('APPLICATION');return r.fulfill({json:mode==='INTEGRITY'?{...f.application,snapshot:{...f.application.snapshot,purpose:'변조'}}:f.application});});
 page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');const region=page.getByRole('region',{name:'Anvil QA 고정 개발절차',exact:true});
 await expect(region.getByRole('button',{name:'Anvil QA 절차 참조 조회',exact:true})).toBeVisible();expect(reads).toEqual([]);
 await region.getByRole('button',{name:'Anvil QA 절차 참조 조회',exact:true}).click();
 if(mode==='LATE'){
  await expect.poll(()=>reads.length).toBe(1);await region.getByRole('button',{name:'절차 참조 조회 닫기',exact:true}).click();release();
  await expect.poll(()=>page.evaluate(()=>(globalThis as any).__projectMethodConsumed)).toBe(1);await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));
  await expect(region.getByRole('button',{name:'현재 적용 절차 원문 보기',exact:true})).toHaveCount(0);await expect(region.getByRole('alert')).toHaveCount(0);expect(reads).toEqual(['PROJECT']);
 }else if(mode==='DENIED'){
  await expect(region.getByRole('alert')).toContainText('PROJECT_ACCESS_DENIED');await expect(region.getByRole('button',{name:'현재 적용 절차 원문 보기',exact:true})).toHaveCount(0);await expect(region.getByText('조회한 프로젝트 원본에 적용 참조 없음 · 실제 실행 상태는 미확인입니다.',{exact:true})).toHaveCount(0);expect(reads).toEqual(['PROJECT']);
 }else if(mode==='EMPTY'){
  await expect(region).toContainText('조회한 프로젝트 원본에 적용 참조 없음');expect(reads).toEqual(['PROJECT']);
 }else{
  await expect(region.getByText(f.application.applicationRef.contentHash,{exact:false})).toBeVisible();expect(reads).toEqual(['PROJECT']);
  await region.getByRole('button',{name:'현재 적용 절차 원문 보기',exact:true}).click();const original=region.getByRole('region',{name:'현재 적용 절차 원문',exact:true});
  if(mode==='INTEGRITY'){await expect(original.getByRole('alert')).toContainText('METHODOLOGY_APPLICATION_INTEGRITY_FAILED');await expect(original).not.toContainText('고정 설계 정의');}
  else{
   await expect(original.getByRole('heading',{name:f.application.snapshot.name,exact:true})).toBeVisible();await expect(original).toContainText('현재 단계 진행·도구 배정·권한·실제 실행은 확인하지 않습니다.');
   await original.getByRole('combobox',{name:'적용본 단계 선택',exact:true}).selectOption('N2');await expect(original.getByRole('region',{name:'고정 적용 단계 상세',exact:true})).toContainText('고정 구현 정의');
   if(mode==='PARENT'){await page.getByRole('button',{name:'목록 새로고침',exact:true}).click();await expect.poll(()=>listCalls).toBe(2);await expect(original).toHaveCount(0);release();await expect(region.getByRole('button',{name:'Anvil QA 절차 참조 조회',exact:true})).toBeEnabled();await expect(region.getByRole('button',{name:'현재 적용 절차 원문 보기',exact:true})).toHaveCount(0);}
  }
  expect(reads).toEqual(['PROJECT','APPLICATION']);
 }
 expect(writes).toEqual([]);expect(unknown).toEqual([]);expect(errors).toEqual([]);
});
