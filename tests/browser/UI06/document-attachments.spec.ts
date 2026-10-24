import {test,expect,type Page} from '@playwright/test';
import {contentHash,canonicalJson} from '../../../contracts/canonical.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',did='33333333-3333-4333-8333-333333333333',aid='44444444-4444-4444-8444-444444444444',iid='55555555-5555-4555-8555-555555555555',bid='66666666-6666-4666-8666-666666666666';
const at='2026-10-21T04:00:00Z',body='기존 문서 본문',attachmentText='보관한 첨부 원문',csrf='C'.repeat(43),formRef={id:did,version:1,contentHash:'a'.repeat(64)};
const artifact=(id:string,text:string)=>({artifactId:id,bytes:Buffer.byteLength(text),contentHash:contentHash(Buffer.from(text)),mediaType:'text/plain;charset=utf-8'});
const original=artifact(bid,body),attachment=artifact(aid,attachmentText),prior=artifact(uid,'기존 첨부');
async function fixture(page:Page,mode='NORMAL',expectedAttachments=[prior,attachment]){
 const unknown:string[]=[],errors:string[]=[],writes:any[]=[],uploads:any[]=[],reads:number[]=[];let saved:any=null,uploaded:any=null;
 await page.route('**/*',r=>{unknown.push(r.request().method()+' '+r.request().url());return r.abort();});await installWorkspaceBundle(page);
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'합성 첨부 QA'},clientId:uid,csrfToken:csrf}}));
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,name:'문서 첨부',purpose:'원문 보존',participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:1,status:'HELD'},readinessIssues:[]}}));
 const candidate={id:iid,originalRef:attachment,intendedFormRef:null,status:'READY',parserVersion:'UTF8_IDENTITY_1',extractedContentRef:attachment,losses:[],issues:[],createdAt:at};
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{
  const req=r.request(),url=new URL(req.url()),p=url.pathname,b='/api/v1/projects/'+pid+'/';let json:any;
  const receipt=(c:any,data:any,version:number|null,targetId:string)=>({operationId:aid,commandId:c.commandId,projectId:pid,status:'APPLIED',targetId,version,data,evidenceRefs:[],warnings:[],serverReceivedAt:at});
  if(p===b+'documents')json={items:[{id:did,title:'원본 문서',headVersion:saved?2:1,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at};
  else if(p.startsWith(b+'documents/'+did+'/versions/')){
   const version=Number(p.split('/').pop());reads.push(version);const content=version===1?{body:original,attachments:[prior],sections:[],sourceRefs:[]}:saved.payload.content;
   json={id:did,version,title:'원본 문서',formRef,stageNodeRef:null,stageBinding:null,contentHash:contentHash(canonicalJson({title:'원본 문서',formRef,stageNodeRef:null,content})),confirmed:false,content,validation:{validForConfirmation:true,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[{criterionId:'REQ',title:'원문',reviewCriteria:['원문 대조']}]},contentReviews:[]};
  }else if(p===b+'imports')json={items:[{...candidate,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:at};
  else if(p===b+'imports/'+iid){if(mode==='DENIED')return r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}});json={...candidate,selections:[]};}
  else if(p===b+'files'&&req.method()==='POST'){
   const c=JSON.parse(req.headers()['x-anvil-command']!);uploads.push(c);expect(req.headers()['x-anvil-csrf']).toBe(csrf);expect(req.postDataBuffer()!.toString('utf8')).toBe(body);uploaded={artifactId:iid,...c.payload};json=receipt(c,{status:'ARTIFACT_READY',artifactRef:uploaded},null,iid);
  }else if(p===b+'commands'&&req.method()==='POST'){
   const c=req.postDataJSON();writes.push(c);expect(c.operation).toBe('saveDocumentDraft');expect(c.expectedVersion).toBe(1);expect(c.payload.content.attachments).toEqual(expectedAttachments);expect(c.payload.formRef).toEqual(formRef);saved=c;
   if(mode==='LOST'&&writes.length===1)return r.abort('connectionreset');
   json=receipt(c,{status:'DRAFT',ref:{id:did,version:2,contentHash:contentHash(canonicalJson({title:c.payload.title,formRef,stageNodeRef:null,content:c.payload.content}))}},2,did);
  }else if(p.startsWith(b+'files/'))return r.fulfill({contentType:'application/octet-stream',body:Buffer.from(p.endsWith(aid)?mode==='HASH'?'変造':attachmentText:p.endsWith(uid)?'기존 첨부':body)});
  else{unknown.push(req.method()+' '+p);return r.abort();}return r.fulfill({json});
 });
 await page.goto('/#/projects/'+pid+'/documents');await page.getByRole('button',{name:'원본 문서 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전에서 편집',exact:true}).click();
 return{unknown,errors,writes,uploads,reads,getSaved:()=>saved};
}
async function select(page:Page){await page.getByRole('button',{name:'첨부할 보관 원본 조회',exact:true}).click();await page.getByRole('button',{name:'첨부 원문 1 확인',exact:true}).click();}
for(const mode of ['NORMAL','LOST'])test(mode+' 첨부 선택/제외는 참조만 바꾸고 별도 저장/고정 재조회까지 보존한다',async({page})=>{
 const f=await fixture(page,mode);await select(page);await expect(page.getByRole('region',{name:'확인한 첨부 원문',exact:true})).toContainText(attachmentText);
 await page.getByRole('button',{name:'이 원본을 문서에 첨부',exact:true}).click();await expect(page.getByLabel('문서 본문 편집',{exact:true})).toHaveValue(body);expect(f.writes).toHaveLength(0);expect(f.uploads).toHaveLength(0);
 await page.getByRole('button',{name:'첨부 2 제외',exact:true}).click();await expect(page.getByRole('button',{name:'첨부 2 제외',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'첨부 1 제외',exact:true})).toBeVisible();
 await select(page);await page.getByRole('button',{name:'이 원본을 문서에 첨부',exact:true}).click();await page.getByLabel('문서 변경 이유',{exact:true}).fill('첨부를 별도로 보존');await page.getByRole('button',{name:'새 초안 버전 저장',exact:true}).click();
 if(mode==='LOST'){await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(page.getByRole('button',{name:'첨부 2 제외',exact:true})).toBeDisabled();await page.getByRole('button',{name:'같은 저장 명령 결과 확인',exact:true}).click();}
 await expect(page.getByText('초안 버전 2 저장 확인',{exact:true})).toBeVisible();await expect(page.getByLabel('문서 원문',{exact:true})).toHaveText(body);expect(f.reads).toContain(2);expect(f.getSaved().payload.content.attachments).toEqual([prior,attachment]);expect(f.uploads).toHaveLength(1);
 if(mode==='LOST'){expect(f.writes).toHaveLength(2);expect(f.writes[1]).toEqual(f.writes[0]);}else expect(f.writes).toHaveLength(1);
 await page.reload();await page.getByRole('button',{name:'원본 문서 열기',exact:true}).click();await page.getByRole('button',{name:'이 버전에서 편집',exact:true}).click();
 const editor=page.getByRole('region',{name:'문서 첨부 작성',exact:true});await expect(editor).toContainText(prior.artifactId);await expect(editor).toContainText(attachment.artifactId);await expect(editor.getByRole('button',{name:'첨부 2 제외',exact:true})).toBeVisible();await expect(page.getByLabel('문서 본문 편집',{exact:true})).toHaveValue(body);
 expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
for(const mode of ['DENIED','HASH'])test(mode+' 원문은 첨부되지 않고 본문/기존첨부/저장명령을 보존한다',async({page})=>{
 const f=await fixture(page,mode);await select(page);await expect(page.getByRole('alert')).toContainText(mode==='DENIED'?'PERMISSION_DENIED':'ARTIFACT_INTEGRITY_FAILED');await expect(page.getByRole('button',{name:'이 원본을 문서에 첨부',exact:true})).toHaveCount(0);await expect(page.getByLabel('문서 본문 편집',{exact:true})).toHaveValue(body);await expect(page.getByRole('button',{name:'첨부 1 제외',exact:true})).toBeVisible();expect(f.writes).toEqual([]);expect(f.uploads).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
test('고정 저장첨부 원문은 확인 후 열고 재조회 거절 때 앞선 원문을 숨긴다',async({page})=>{
 const f=await fixture(page);await page.getByRole('button',{name:'저장 첨부 1 원문 열기',exact:true}).click();
 await expect(page.getByRole('region',{name:'고정 저장첨부 원문',exact:true})).toContainText('기존 첨부');expect(f.writes).toEqual([]);expect(f.uploads).toEqual([]);
 await page.route('**/api/v1/projects/'+pid+'/documents/'+did+'/versions/1',r=>r.fulfill({status:403,json:{code:'PERMISSION_DENIED'}}));
 await page.getByRole('button',{name:'저장 첨부 1 원문 열기',exact:true}).click();await expect(page.getByRole('alert')).toContainText('PERMISSION_DENIED');await expect(page.getByRole('region',{name:'고정 저장첨부 원문',exact:true})).toHaveCount(0);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);expect(f.writes).toEqual([]);
});
test('저장첨부 원문 변조는 hash 오류로 숨기고 쓰기를 만들지 않는다',async({page})=>{
 const f=await fixture(page);await page.route('**/api/v1/projects/'+pid+'/files/'+uid,r=>r.fulfill({contentType:'application/octet-stream',body:Buffer.from('바뀐원문')}));await page.getByRole('button',{name:'저장 첨부 1 원문 열기',exact:true}).click();await expect(page.getByRole('alert')).toContainText('ARTIFACT_INTEGRITY_FAILED');await expect(page.getByRole('region',{name:'고정 저장첨부 원문',exact:true})).toHaveCount(0);expect(f.writes).toEqual([]);expect(f.uploads).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});

for(const mode of ['NORMAL','LOST'])test('ATTACHMENT_ORDER_'+mode+' 문서 첨부 순서를 저장·재조회하고 과거 버전과 미확인 명령을 보존한다',async({page})=>{
 const f=await fixture(page,mode,[attachment,prior]);await select(page);await page.getByRole('button',{name:'이 원본을 문서에 첨부',exact:true}).click();
 const editor=page.getByRole('region',{name:'문서 첨부 작성',exact:true});
 await expect(editor.getByRole('button',{name:'첨부 1 위로',exact:true})).toBeDisabled();await expect(editor.getByRole('button',{name:'첨부 2 아래로',exact:true})).toBeDisabled();
 await editor.getByRole('button',{name:'첨부 2 위로',exact:true}).click();
 await expect(editor.getByRole('listitem').nth(0)).toContainText(attachment.artifactId);await expect(editor.getByRole('listitem').nth(1)).toContainText(prior.artifactId);
 expect(f.writes).toEqual([]);expect(f.uploads).toEqual([]);
 await page.getByLabel('문서 변경 이유',{exact:true}).fill('시안 읽는 순서 변경');await page.getByRole('button',{name:'새 초안 버전 저장',exact:true}).click();
 if(mode==='LOST'){
  await expect(page.getByRole('alert')).toContainText('CONNECTION_LOST');await expect(editor.getByRole('button',{name:'첨부 1 아래로',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'같은 저장 명령 결과 확인',exact:true}).click();
 }
 await expect(page.getByText('초안 버전 2 저장 확인',{exact:true})).toBeVisible();expect(f.getSaved().payload.content.attachments).toEqual([attachment,prior]);expect(f.reads).toContain(2);
 if(mode==='LOST'){expect(f.writes).toHaveLength(2);expect(f.writes[1]).toEqual(f.writes[0]);}else expect(f.writes).toHaveLength(1);
 await page.reload();await page.getByRole('button',{name:'원본 문서 열기',exact:true}).click();
 const stored=page.getByRole('region',{name:'저장된 문서 첨부',exact:true});await expect(stored.getByRole('listitem').nth(0)).toContainText(attachment.artifactId);await expect(stored.getByRole('listitem').nth(1)).toContainText(prior.artifactId);
 await page.getByRole('button',{name:'이 버전에서 편집',exact:true}).click();await expect(editor.getByRole('listitem').nth(0)).toContainText(attachment.artifactId);await expect(page.getByLabel('문서 본문 편집',{exact:true})).toHaveValue(body);
 const old=await page.evaluate(async path=>{const r=await fetch(path);return r.json();},'/api/v1/projects/'+pid+'/documents/'+did+'/versions/1');expect(old.content.attachments).toEqual([prior]);
 expect(f.uploads).toHaveLength(1);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
