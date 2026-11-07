import {test,expect} from '@playwright/test';
import {contentHash,canonicalJson} from '../../../contracts/canonical.ts';
import {pngFixture} from '../../unit/FN03/png-preview-fixture.ts';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {readFile} from 'node:fs/promises';
const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',did='33333333-3333-4333-8333-333333333333',aid='44444444-4444-4444-8444-444444444444',bid='66666666-6666-4666-8666-666666666666',at='2026-10-21T10:00:00Z';
for(const mode of ['NORMAL','HASH','DENIED','LATE','DECODE'])test('PNG_SCREEN '+mode,async({page})=>{
 const png=pngFixture({badDeflate:mode==='DECODE'}),body='시안 설명',formRef={id:did,version:1,contentHash:'a'.repeat(64)},artifact={artifactId:aid,bytes:png.length,contentHash:contentHash(png),mediaType:'image/png'},textRef={artifactId:bid,bytes:Buffer.byteLength(body),contentHash:contentHash(Buffer.from(body)),mediaType:'text/plain;charset=utf-8'},content={body:textRef,attachments:[artifact],sections:[],sourceRefs:[]};
 const doc={id:did,version:1,title:'저장 화면 시안',formRef,stageNodeRef:null,stageBinding:null,contentHash:contentHash(canonicalJson({title:'저장 화면 시안',formRef,stageNodeRef:null,content})),confirmed:false,content,validation:{validForConfirmation:true,issues:[]},statusHistory:[],contentReviewCriteria:{criteriaVersion:1,formRef,items:[{criterionId:'REQ',title:'시안',reviewCriteria:['대조']}]},contentReviews:[]};
 const unknown:string[]=[],errors:string[]=[],writes:string[]=[];let reads=0,release:()=>void=()=>{};
 await page.route('**/*',r=>{unknown.push(r.request().url());return r.abort();});await installWorkspaceBundle(page);
 await page.route('https://localhost:3830/',async r=>r.fulfill({contentType:'text/html',body:await readFile('apps/web/dist/index.html'),headers:{'content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}}));
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());if(!r.url().startsWith('data:image/png;base64,')&&new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'합성 PNG QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route('**/api/v1/projects/'+pid,r=>r.fulfill({json:{id:pid,name:'시안',purpose:'이미지 확인',participation:'OWNER',controlState:{actorId:uid,clientId:uid,generation:1,status:'HELD'},readinessIssues:[]}}));
 await page.route('**/api/v1/projects/'+pid+'/**',async r=>{const p=new URL(r.request().url()).pathname,b='/api/v1/projects/'+pid+'/';
  if(p===b+'documents')return r.fulfill({json:{items:[{id:did,title:doc.title,headVersion:1,confirmedVersion:null,updatedAt:at}],hasMore:false,nextCursor:null,observedAt:at}});
  if(p===b+'documents/'+did+'/versions/1')return r.fulfill({json:doc});
  if(p===b+'files/'+bid)return r.fulfill({contentType:'application/octet-stream',body});
  if(p===b+'files/'+aid){reads++;if(mode==='LATE')await new Promise<void>(resolve=>release=resolve);if(mode==='DENIED')return r.fulfill({status:403,json:{code:'ACCESS_DENIED'}});return r.fulfill({contentType:'application/octet-stream',body:mode==='HASH'?pngFixture({width:2}):png});}
  unknown.push(p);return r.abort();
 });
 if(mode==='LATE')await page.addInitScript(id=>{const previous=window.fetch;window.fetch=async(...args:Parameters<typeof fetch>)=>{const r=await previous(...args);if(String(args[0]).endsWith('/files/'+id))(window as any).__pngArrived=true;return r;};},aid);
 await page.goto('/#/projects/'+pid+'/documents');await page.getByRole('button',{name:'저장 화면 시안 열기',exact:true}).click();
 const view=page.getByRole('region',{name:'저장된 문서 첨부',exact:true}),image=view.getByRole('img',{name:'저장 첨부 1 PNG 시안',exact:true});expect(reads).toBe(0);await view.getByRole('button',{name:'저장 첨부 1 PNG 시안 열기',exact:true}).click();
 if(mode==='NORMAL'){await expect(image).toBeVisible();await expect.poll(()=>image.evaluate((i:HTMLImageElement)=>i.complete&&i.naturalWidth===1&&i.naturalHeight===1)).toBe(true);await expect(image).toHaveAttribute('src','data:image/png;base64,'+png.toString('base64'));expect(await image.evaluate((i:HTMLImageElement)=>{const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const c=canvas.getContext('2d')!;c.drawImage(i,0,0);return[...c.getImageData(0,0,1,1).data];})).toEqual([255,0,0,255]);await expect(view).toContainText('PNG 1 × 1');await view.getByRole('button',{name:'저장 첨부 원문 닫기',exact:true}).click();await expect(image).toHaveCount(0);}
 else if(mode==='LATE'){await expect.poll(()=>reads).toBe(1);await view.getByRole('button',{name:'저장 첨부 원문 닫기',exact:true}).click();const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/files/'+aid));release();await response;await expect.poll(()=>page.evaluate(()=>(window as any).__pngArrived)).toBe(true);await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));await expect(image).toHaveCount(0);await expect(view.getByRole('status')).toHaveCount(0);
 }else await expect(view.getByRole('alert')).toContainText(mode==='HASH'?'ARTIFACT_INTEGRITY_FAILED':mode==='DENIED'?'ARTIFACT_READ_FAILED':'DOCUMENT_PNG_DECODE_FAILED');
 await expect(view.locator('script,iframe,object,embed')).toHaveCount(0);if(mode!=='NORMAL')await expect(image).toHaveCount(0);expect(reads).toBe(1);expect({unknown,errors,writes}).toEqual({unknown:[],errors:[],writes:[]});
});
