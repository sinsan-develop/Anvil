import {test,expect,type Page} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {conversationChangeFixture} from '../../unit/UI07/stored-change-conversation-fixture.ts';
async function fixture(page:Page,late=false){
 const f=conversationChangeFixture(),s=f.selection,unknown:string[]=[],writes:string[]=[],errors:string[]=[];let denied=false,release=()=>{},arrived=()=>{};const pending=new Promise<void>(r=>release=r),requested=new Promise<void>(r=>arrived=r);
 await page.addInitScript(()=>{const json=Response.prototype.json;Response.prototype.json=async function(){const v=await json.call(this);if(this.url.includes('/messages/'))(window as any).messageConsumed=1;return v;};const digest=crypto.subtle.digest.bind(crypto.subtle);(window as any).hashes={started:0,pending:0};crypto.subtle.digest=async(...args:Parameters<SubtleCrypto['digest']>)=>{(window as any).hashes.started++;(window as any).hashes.pending++;try{return await digest(...args);}finally{(window as any).hashes.pending--;}};});
 await installWorkspaceBundle(page);await page.route('**/api/v1/**',r=>{unknown.push(r.request().url());return r.abort();});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:s.userId,displayName:'변경 원문 QA'},clientId:s.clientId,csrfToken:'C'.repeat(43)}}));
 await page.route(`**/api/v1/projects/${s.projectId}/design-changes/${s.changeRef.id}?*`,r=>r.fulfill({json:f.page}));
 await page.route(`**/api/v1/projects/${s.projectId}/conversations?*`,r=>r.fulfill({json:{items:[{id:s.conversationId,headSequence:1,targetRoleRef:null,updatedAt:f.conversation.recordedAt,integrity:'NOT_RECHECKED'}],hasMore:false,nextCursor:null,observedAt:f.conversation.recordedAt}}));
 await page.route(`**/api/v1/projects/${s.projectId}/conversations/${s.conversationId}/messages/${s.source.id}`,async r=>{arrived();if(late)await pending;if(denied)return r.fulfill({status:403,json:{code:'FORBIDDEN'}});return r.fulfill({json:f.conversation});});
 page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`/#/projects/${s.projectId}/changes`);await page.getByLabel('변경 요청 ID',{exact:true}).fill(s.changeRef.id);await page.getByRole('button',{name:'변경 요청 조회',exact:true}).click();await page.getByText('요청 출처 참조·원문',{exact:true}).click();await page.getByRole('button',{name:'변경 대화 출처 1 원문 보기',exact:true}).click();
 return {...f,unknown,writes,errors,requested,release,deny:()=>{denied=true;}};
}
test('보관 변경의 대화 원문은 명시 선택·hash검사 후 텍스트로 열고 거절 뒤 숨긴다',async({page})=>{
 const f=await fixture(page),choose=page.getByRole('button',{name:'대화 '+f.selection.conversationId+'에서 원문 확인',exact:true});await choose.click();await expect(page.getByLabel('변경 근거 대화 원문',{exact:true})).toHaveText(f.conversation.body);expect(await page.evaluate(()=>(window as any).SOURCE_EXECUTED)).toBeUndefined();f.deny();await choose.click();await expect(page.getByRole('alert')).toContainText('FORBIDDEN');await expect(page.getByLabel('변경 근거 대화 원문',{exact:true})).toHaveCount(0);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});
test('닫은 변경 대화 원문은 최종JSON과두hash소비뒤에도 되살아나지 않는다',async({page})=>{
 const f=await fixture(page,true);await page.getByRole('button',{name:'대화 '+f.selection.conversationId+'에서 원문 확인',exact:true}).click();await f.requested;const before=await page.evaluate(()=>(window as any).hashes.started);await page.getByRole('button',{name:'변경 대화 출처 닫기',exact:true}).click();f.release();await page.waitForFunction(n=>(window as any).messageConsumed===1&&(window as any).hashes.started>=n+2&&(window as any).hashes.pending===0,before);await page.evaluate(()=>new Promise<void>(r=>setTimeout(r,0)));await expect(page.getByLabel('변경 대화 출처 원문',{exact:true})).toHaveCount(0);await expect(page.getByLabel('변경 근거 대화 원문',{exact:true})).toHaveCount(0);expect(f.writes).toEqual([]);expect(f.errors).toEqual([]);expect(f.unknown).toEqual([]);
});
