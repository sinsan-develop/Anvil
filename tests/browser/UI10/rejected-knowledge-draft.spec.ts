import {test,expect,type Page} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',aid='33333333-3333-4333-8333-333333333333',kid='44444444-4444-4444-8444-444444444444',at='2026-10-21T02:00:00Z';
async function setup(page:Page,correct:boolean,loss:boolean){
 const unknown:string[]=[],errors:string[]=[],actions:any[]=[],uploads:any[]=[];
 const body='기준 원문',entry={kind:'FACT',title:'기준 제목',contentRef:{artifactId:aid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},sourceRefs:[],reason:'기준 이유',scope:{projectId:pid,stageRefs:[],taskRefs:[]},relatedRefs:[]};
 const ref={id:kid,version:1,contentHash:contentHash(canonicalJson(entry))};let stored:any=null;
 const receipt=(c:any,data:any,targetId:string,version:number|null)=>({operationId:crypto.randomUUID(),commandId:c.commandId,projectId:pid,status:'APPLIED',targetId,version,data,evidenceRefs:[],warnings:[],serverReceivedAt:at});
 await page.route('**/api/v1/**',r=>{unknown.push(r.request().method()+' '+new URL(r.request().url()).pathname);return r.abort();});await installWorkspaceBundle(page);
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:1}}}));
 await page.route('**/api/v1/projects/'+pid+'/constitution?*',r=>r.fulfill({json:{current:null,history:[],hasMore:false,nextBeforeVersion:null,agentDelivery:'NOT_CONNECTED',compliance:'NOT_ASSESSED',observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/conversations?*',r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/knowledge?*',r=>r.fulfill({json:{items:correct?[{versionRef:ref,title:entry.title,kind:'FACT',sourceRefs:[],reasonSnippet:entry.reason,state:'PROPOSED'}]:[],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:at}}));
 await page.route('**/api/v1/projects/'+pid+'/knowledge/'+kid+'/versions/1',r=>r.fulfill({json:{ref,entry,body,state:'PROPOSED',headVersion:1,supersedesRef:null,appliedAsConstitution:false,redactionState:'NOT_REDACTED',sensitiveInspection:'KNOWN_PATTERNS_ONLY',agentDelivery:'NOT_CONNECTED',history:[{id:aid,kind:'PROPOSED',reason:entry.reason,actorRef:{kind:'HUMAN',userId:uid},recordedAt:at}]}}));
 await page.route('**/api/v1/projects/'+pid+'/files',r=>{const c=JSON.parse(r.request().headers()['x-anvil-command']!);uploads.push(c);expect(c.operation).toBe('uploadArtifact');const id=crypto.randomUUID();return r.fulfill({status:201,json:receipt(c,{status:'ARTIFACT_READY',artifactRef:{artifactId:id,...c.payload}},id,null)});});
 await page.route('**/api/v1/projects/'+pid+'/commands',r=>{
  const c=r.request().postDataJSON();actions.push(c);expect(c.operation).toBe(correct?'correctKnowledge':'saveKnowledge');
  if(loss&&actions.length===1)return r.abort();
  if(loss||actions.length===1)return r.fulfill({status:422,json:{code:'KNOWLEDGE_INPUT_INVALID'}});
  expect(c.commandId).not.toBe(actions[0].commandId);expect(c.payload.entry.title).toBe('고친 작성 제목');
  const next={id:kid,version:correct?2:1,contentHash:contentHash(canonicalJson(c.payload.entry))};
  stored=correct?{status:'PROPOSED',ref:next,entry:c.payload.entry,baseRef:ref,supersedesRef:ref,reason:c.payload.reason,changeSources:c.payload.sourceRefs,eventId:crypto.randomUUID()}:{status:'PROPOSED',ref:next,entry:c.payload.entry};
  return r.fulfill({json:receipt(c,stored,kid,next.version)});
 });
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.goto('/#/projects/'+pid+'/knowledge');
 if(correct){await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();await page.getByRole('button',{name:'이 버전에서 지식 정정',exact:true}).click();}
 else await page.getByRole('button',{name:'새 지식 작성',exact:true}).click();
 return{unknown,errors,actions,uploads,get stored(){return stored;},ref,entry};
}
for(const correct of [false,true])for(const loss of [false,true])test('REJECTED_DRAFT_'+(correct?'CORRECTION':'NEW')+'_'+(loss?'UNCERTAIN':'EDIT')+' 거절은 입력을 보존해 별도저장하고 미확인은 원명령만 확인한다',async({page})=>{
 const f=await setup(page,correct,loss),title=page.getByLabel(correct?'정정 지식 제목':'지식 제목',{exact:true}),body=page.getByLabel(correct?'정정 지식 원문':'지식 원문',{exact:true});
 await title.fill('작성 제목');await body.fill('보존할 작성 본문');await page.getByLabel(correct?'정정 지식 판단 이유':'지식 작성 이유',{exact:true}).fill('작성 이유');
 if(correct)await page.getByLabel('지식 정정 사유',{exact:true}).fill('새 사실로 정정');
 await page.getByRole('button',{name:correct?'지식 정정 저장':'지식 초안 저장',exact:true}).click();
 const reopen=page.getByRole('button',{name:correct?'거절 확인 후 정정 입력 계속 작성':'거절 확인 후 지식 입력 계속 작성',exact:true});
 await expect(page.getByRole('alert').filter({hasText:loss?'CONNECTION_LOST':'KNOWLEDGE_INPUT_INVALID'}).first()).toBeVisible();
 await expect(title).toBeDisabled();await expect(body).toHaveValue('보존할 작성 본문');
 if(loss){
  await expect(reopen).toHaveCount(0);await page.getByRole('button',{name:correct?'같은 정정 명령 결과 확인':'같은 지식 명령 결과 확인',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'KNOWLEDGE_INPUT_INVALID'}).first()).toBeVisible();await expect(reopen).toHaveCount(0);await expect(title).toBeDisabled();
  expect(f.actions).toHaveLength(2);expect(f.actions[1]).toEqual(f.actions[0]);expect(f.uploads).toHaveLength(1);
 }else{
  await expect(reopen).toBeVisible();page.once('dialog',d=>d.dismiss());await reopen.click();await expect(title).toBeDisabled();
  page.once('dialog',d=>d.accept());await reopen.click();await expect(title).toBeEnabled();await expect(title).toHaveValue('작성 제목');await expect(body).toHaveValue('보존할 작성 본문');await expect(page.getByRole('alert').filter({hasText:'KNOWLEDGE_INPUT_INVALID'})).toHaveCount(0);expect(f.actions).toHaveLength(1);
  await title.fill('고친 작성 제목');await page.getByRole('button',{name:correct?'지식 정정 저장':'지식 초안 저장',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:correct?'지식 정정 저장 확인':'지식 초안 저장 확인'})).toBeVisible();expect(f.actions).toHaveLength(2);expect(f.uploads).toHaveLength(2);
  expect(f.stored.entry.title).toBe('고친 작성 제목');if(correct){expect(f.actions[1].payload.baseRef).toEqual(f.ref);expect(f.entry.title).toBe('기준 제목');}
 }
 expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
