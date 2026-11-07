import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {isAbsolute,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const pid='a6f20380-0000-4000-8000-000000000001',otherPid='a6f20380-0000-4000-8000-000000000002',uid='a6f20380-0000-4000-8000-000000000003';
const ownIds=['a6f20380-0000-4000-8000-000000000011','a6f20380-0000-4000-8000-000000000012','a6f20380-0000-4000-8000-000000000013'];
const commonIds=['a6f20380-0000-4000-8000-000000000021','a6f20380-0000-4000-8000-000000000022','a6f20380-0000-4000-8000-000000000023'];
type List='own'|'common';
async function fixture(page:Page,save=false){
 const dist=process.env.ANVIL_UI03_PROJECT_PAGINATION_DIST;if(!dist||!isAbsolute(dist))throw Error('CURRENT_VERIFIED_WEB_DIST_REQUIRED');
 const errors:string[]=[],unknown:string[]=[],writes:string[]=[],offOrigin:string[]=[],requests:{list:List;cursor:string|null;project:string|null}[]=[];
 const commands:unknown[]=[],savedReads:number[]=[];let saveDraft:unknown=null,saved:unknown=null,releaseSave=()=>{};const saveWait=new Promise<void>(done=>{releaseSave=done;});
 const visits=new Map<string,number>();let fail:{list:List;cursor:string|null}|null=null,hold:{list:List;cursor:string|null;wait:Promise<void>}|null=null;
 page.on('pageerror',e=>errors.push(e.name));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')offOrigin.push(new URL(r.url()).origin);});
 await page.route('**/*',r=>new URL(r.request().url()).origin==='https://localhost:3830'?r.fallback():r.abort('blockedbyclient'));
 await page.route('https://localhost:3830/**',async r=>{const path=new URL(r.request().url()).pathname;if(path.startsWith('/api/'))return r.fallback();if(r.request().method()!=='GET'||path!=='/'&&!/^\/assets\/[A-Za-z0-9_.-]+$/.test(path))return r.abort('blockedbyclient');const name=path==='/'?'index.html':path.slice(1),file=resolve(dist,name);if(!file.startsWith(resolve(dist)+sep))throw Error('ASSET_PATH_OUTSIDE_DIST');return r.fulfill({body:await readFile(pathToFileURL(file)),contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'});});
 await page.route('**/api/v1/**',r=>{unknown.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'목록 이동 QA'},clientId:uid,csrfToken:'A'.repeat(43)}}));
 await page.route('**/api/v1/auth/setup',r=>r.fulfill({json:{setupRequired:false,policyVersion:1}}));
 await page.route('**/api/v1/forms',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-26T00:00:00.000Z',baselineVersion:null}}));
 await page.route(/\/api\/v1\/projects\/[0-9a-f-]+$/,r=>{const id=new URL(r.request().url()).pathname.split('/').at(-1);return r.fulfill({json:{id,currentMethodologyRef:null,participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:1,status:'HELD'}}});});
 await page.route(/\/api\/v1\/(?:projects\/[0-9a-f-]+\/)?methodologies(?:\?.*)?$/,async r=>{
  const url=new URL(r.request().url()),project=url.pathname.match(/projects\/([0-9a-f-]+)\//)?.[1]??null,list:List=project?'own':'common',cursor=url.searchParams.get(project?'afterId':'cursor');requests.push({list,cursor,project});
  if(project)expect(url.searchParams.get('limit')).toBe('20');
  if(hold?.list===list&&hold.cursor===cursor){const wait=hold.wait;hold=null;await wait;}
  if(fail?.list===list&&fail.cursor===cursor){fail=null;return r.fulfill({status:503,json:{code:'QA_PAGE_UNAVAILABLE'}});}
  const index=cursor===null?0:list==='own'?ownIds.indexOf(cursor)+1:Number(cursor.replace('common-',''));
  if(index<0||index>2)throw Error('UNEXPECTED_PAGE_CURSOR');const key=[list,project,index].join(':'),visit=(visits.get(key)??0)+1;visits.set(key,visit);
  const item={ref:{id:(list==='own'?ownIds:commonIds)[index],version:1,contentHash:'a'.repeat(64)},name:`${list==='own'?'전용':'원본'} ${project===otherPid?'다른 ':''}${index+1} 조회${visit}`,purpose:'이전 이동 재조회 확인',scope:list==='own'?'PROJECT':'USER_COMMON'};
  return r.fulfill({json:project?{projectId:project,items:[item],hasMore:index<2,nextAfterId:index<2?ownIds[index]:null,observedAt:'2026-10-26T00:00:00.000Z',applicationTransition:'EXECUTION_STATE_UNVERIFIED'}:{items:[{...item,status:'DRAFT',sourceAvailable:false,systemCode:null}],hasMore:index<2,nextCursor:index<2?`common-${index+1}`:null,observedAt:'2026-10-26T00:00:00.000Z',baselineVersion:null}});
 });
 if(save){
  const forms=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
  const builtin=buildBuiltinMethodologies(await readFile(new URL('../../../docs/design/기본방법론_상세검토안.md',import.meta.url)),forms.forms)[0]!;
  saveDraft={name:'저장 중 목록 보존',purpose:'저장 완료 시 최신 원본 페이지 유지',scope:'PROJECT',reason:'콜백 경합 회귀 확인',graph:structuredClone(builtin.graph)};
  await page.route(`**/api/v1/projects/${pid}/commands`,async r=>{
   const command=r.request().postDataJSON();commands.push(command);expect(r.request().method()).toBe('POST');expect(command.operation).toBe('saveMethodologyDraft');expect(command.projectId).toBe(pid);expect(command.clientId).toBe(uid);expect(command.controlGeneration).toBe(1);expect(command.targetId).toBe(null);expect(command.expectedVersion).toBe(0);expect(command.payload).toEqual(saveDraft);
   const ref={id:ownIds[0],version:1,contentHash:contentHash(canonicalJson(command.payload.graph))};
   saved={projectId:pid,headVersion:1,ref,name:command.payload.name,purpose:command.payload.purpose,scope:'PROJECT',systemCode:null,graph:command.payload.graph,confirmation:null,contentReviews:[],validation:validateMethodologyGraph(command.payload.graph,forms.forms.map(form=>form.ref)),runtimeReadiness:'PROJECT_BINDINGS_REQUIRED',applicationTransition:'EXECUTION_STATE_UNVERIFIED'};
   await saveWait;return r.fulfill({json:{commandId:command.commandId,projectId:pid,status:'APPLIED',operationId:uid,targetId:ref.id,version:1,data:{ref,status:'DRAFT'},serverReceivedAt:'2026-10-26T00:00:00.000Z'}});
  });
  await page.route(`**/api/v1/projects/${pid}/methodologies/${ownIds[0]}/versions/1`,r=>{expect(saved).not.toBeNull();savedReads.push(1);return r.fulfill({json:saved});});
 }
 await page.goto(`/#/projects/${pid}/methodologies`);await expect(page.getByRole('button',{name:'전용 1 조회1 v1 열기',exact:true})).toBeEnabled();
 return{errors,unknown,writes,offOrigin,requests,commands,savedReads,saveDraft,releaseSave:()=>releaseSave(),failOnce:(list:List,cursor:string|null)=>{fail={list,cursor};},holdNext:(list:List,cursor:string|null)=>{let release!:()=>void;const wait=new Promise<void>(done=>{release=done;});hold={list,cursor,wait};return release;}};
}
const previous=(page:Page,list:List)=>page.getByRole('button',{name:list==='own'?'전용 방법론 이전 목록':'복사 원본 이전 목록',exact:true});
const next=(page:Page,list:List)=>page.getByRole('button',{name:list==='own'?'전용 방법론 다음 목록':'복사 원본 다음 목록',exact:true});
async function ready(page:Page){await expect(page.getByRole('status').filter({hasText:'방법론 원본 조회 중'})).toHaveCount(0);}
function clean(s:Awaited<ReturnType<typeof fixture>>){expect(s.errors).toEqual([]);expect(s.unknown).toEqual([]);expect(s.writes).toEqual([]);expect(s.offOrigin).toEqual([]);}

test('전용·복사 원본은 세 페이지를 독립 왕복하며 이전 cursor를 GET으로 재조회한다',async({page})=>{
 const s=await fixture(page);await expect(previous(page,'own')).toBeDisabled();await expect(previous(page,'common')).toBeDisabled();
 await next(page,'own').click();await ready(page);await next(page,'own').click();await ready(page);await expect(next(page,'own')).toBeDisabled();
 await next(page,'common').click();await ready(page);await next(page,'common').click();await ready(page);await expect(next(page,'common')).toBeDisabled();
 await previous(page,'own').click();await ready(page);await expect(page.getByRole('button',{name:/전용 2 조회\d+ v1 열기/})).toBeEnabled();await expect(next(page,'common')).toBeDisabled();
 await previous(page,'own').click();await ready(page);await expect(previous(page,'own')).toBeDisabled();await expect(previous(page,'common')).toBeEnabled();
 await previous(page,'common').click();await ready(page);await previous(page,'common').click();await ready(page);await expect(previous(page,'common')).toBeDisabled();
 expect(s.requests.filter(r=>r.list==='own').map(r=>r.cursor)).toEqual([null,ownIds[0],ownIds[1],ownIds[1],ownIds[1],ownIds[0],null,null,null]);
 expect(s.requests.filter(r=>r.list==='common').map(r=>r.cursor)).toEqual([null,null,null,'common-1','common-2','common-2','common-2','common-1',null]);clean(s);
});
test('이전·다음 조회 실패는 성공 이력을 보존하고 같은 cursor 재시도 후 돌아간다',async({page})=>{
 const s=await fixture(page);await next(page,'own').click();await ready(page);await next(page,'own').click();await ready(page);s.failOnce('own',ownIds[0]!);
 await previous(page,'own').click();await expect(page.getByRole('alert').filter({hasText:'이전 목록은 현재 자료로 간주하지 않습니다.'})).toBeVisible();
 await page.getByRole('button',{name:'방법론 목록 다시 조회',exact:true}).click();await ready(page);await expect(page.getByRole('button',{name:/전용 2 조회\d+ v1 열기/})).toBeEnabled();
 await previous(page,'own').click();await ready(page);await expect(previous(page,'own')).toBeDisabled();
 s.failOnce('common','common-1');await next(page,'common').click();await expect(page.getByRole('alert').filter({hasText:'이전 목록은 현재 자료로 간주하지 않습니다.'})).toBeVisible();
 await page.getByRole('button',{name:'방법론 목록 다시 조회',exact:true}).click();await ready(page);await previous(page,'common').click();await ready(page);await expect(previous(page,'common')).toBeDisabled();
 expect(s.requests.filter(r=>r.list==='own').slice(3,5).map(r=>r.cursor)).toEqual([ownIds[0],ownIds[0]]);clean(s);
});
test('페이지 pending에는 두 목록의 이전·다음을 잠그고 전체 갱신은 이력과 목록을 초기화한다',async({page})=>{
 const s=await fixture(page);await page.getByRole('button',{name:'새 방법론 작성',exact:true}).click();await page.getByLabel('방법론 이름',{exact:true}).fill('미저장 입력 보존');
 await next(page,'own').click();await ready(page);await next(page,'common').click();await ready(page);const release=s.holdNext('own',null);
 try{await previous(page,'own').click();for(const list of ['own','common'] as const){await expect(previous(page,list)).toBeDisabled();await expect(next(page,list)).toBeDisabled();}}finally{release();}
 await ready(page);await expect(page.getByLabel('방법론 이름',{exact:true})).toHaveValue('미저장 입력 보존');await page.getByRole('button',{name:'전용 방법론 목록 갱신',exact:true}).click();await ready(page);
 await expect(previous(page,'own')).toBeDisabled();await expect(previous(page,'common')).toBeDisabled();await expect(page.getByLabel('방법론 이름',{exact:true})).toHaveValue('미저장 입력 보존');clean(s);
});
test('프로젝트 전환은 목록 이력을 재사용하지 않고 늦은 이전 프로젝트 응답을 폐기한다',async({page})=>{
 const s=await fixture(page);const release=s.holdNext('own',ownIds[0]!);
 try{await next(page,'own').click();await expect(next(page,'own')).toBeDisabled();await expect.poll(()=>s.requests.some(r=>r.list==='own'&&r.cursor===ownIds[0])).toBe(true);await page.evaluate(id=>{location.hash=`#/projects/${id}/methodologies`;},otherPid);await expect(page.getByRole('button',{name:'전용 다른 1 조회1 v1 열기',exact:true})).toBeEnabled();}finally{release();}
 await ready(page);await expect(previous(page,'own')).toBeDisabled();await expect(previous(page,'common')).toBeDisabled();await expect(page.getByRole('button',{name:/전용 2 조회\d+ v1 열기/})).toHaveCount(0);clean(s);
});
test('지연 저장 완료는 저장 중 이동한 최신 복사 원본 cursor와 이전 이력을 보존한다',async({page})=>{
 const s=await fixture(page,true);await page.getByRole('button',{name:'새 방법론 작성',exact:true}).click();await expect(page.getByLabel('방법론 이름',{exact:true})).toHaveValue('');
 page.once('dialog',async dialog=>{expect(dialog.message()).toBe('미저장 방법론 입력을 가져온 새 초안으로 바꿀까요? 서버 원본은 보존합니다.');await dialog.accept();});
 await page.getByLabel('방법론 초안 JSON 가져오기',{exact:true}).setInputFiles({name:'method.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(s.saveDraft))});await expect(page.getByLabel('방법론 이름',{exact:true})).toHaveValue('저장 중 목록 보존');
 await next(page,'own').click();await ready(page);await next(page,'own').click();await ready(page);await next(page,'common').click();await ready(page);
 try{
  await page.getByRole('button',{name:'전용본 새 버전 저장',exact:true}).click();await expect.poll(()=>s.commands.length).toBe(1);await expect(page.getByText('서버 저장·재조회를 확인하고 있습니다.',{exact:true})).toBeVisible();
  await next(page,'common').click();await ready(page);await expect(page.getByRole('button',{name:/원본 3 조회\d+ 전용 복사 원본/})).toBeEnabled();await expect(previous(page,'common')).toBeEnabled();await expect(next(page,'common')).toBeDisabled();
 }finally{s.releaseSave();}
 await expect(page.getByText('서버 저장·재조회 확인 · 버전 1',{exact:true})).toBeVisible();await ready(page);
 await expect(page.getByRole('button',{name:/원본 3 조회\d+ 전용 복사 원본/})).toBeEnabled();await expect(next(page,'common')).toBeDisabled();await expect(previous(page,'common')).toBeEnabled();await expect(previous(page,'own')).toBeDisabled();
 expect(s.requests.filter(r=>r.list==='common').at(-1)?.cursor).toBe('common-2');await previous(page,'common').click();await ready(page);await expect(page.getByRole('button',{name:/원본 2 조회\d+ 전용 복사 원본/})).toBeEnabled();await previous(page,'common').click();await ready(page);await expect(previous(page,'common')).toBeDisabled();
 expect(s.commands).toHaveLength(1);expect(s.savedReads).toEqual([1]);expect(s.writes).toEqual(['POST']);expect(s.errors).toEqual([]);expect(s.unknown).toEqual([]);expect(s.offOrigin).toEqual([]);
});