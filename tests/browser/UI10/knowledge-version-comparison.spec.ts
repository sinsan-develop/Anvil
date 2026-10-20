import {test,expect,type Page} from '@playwright/test';
import {installWorkspaceBundle} from '../UI04/bundle.ts';
import {knowledgeVersionPair,comparisonProject as pid,comparisonUser as uid,comparisonId as kid} from '../../unit/FN05/knowledge-version-comparison-fixture.ts';
async function fixture(page:Page,mode:'NORMAL'|'DENIED'|'DELAY'='NORMAL'){
 await installWorkspaceBundle(page);const pair=knowledgeVersionPair(),unknown:string[]=[],writes:string[]=[],errors:string[]=[];let reads=0,release:()=>void=()=>{};
 page.on('request',r=>{if(r.method()!=='GET')writes.push(r.method());if(new URL(r.url()).origin!=='https://localhost:3830')unknown.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/v1/**',r=>{unknown.push(new URL(r.request().url()).pathname);return r.fulfill({status:503,json:{code:'UNEXPECTED_QA_API'}});});
 await page.route('**/api/v1/session',r=>r.fulfill({json:{user:{id:uid,displayName:'버전 비교 QA'},clientId:uid,csrfToken:'C'.repeat(43)}}));
 await page.route(`**/api/v1/projects/${pid}/conversations?*`,r=>r.fulfill({json:{items:[],hasMore:false,nextCursor:null,observedAt:'2026-10-20T00:02:00.000Z'}}));
 await page.route(`**/api/v1/projects/${pid}/knowledge?*`,r=>r.fulfill({json:{items:[{versionRef:pair.after.ref,title:pair.after.entry.title,kind:'FACT',sourceRefs:[],reasonSnippet:pair.after.entry.reason,state:'PROPOSED'}],hasMore:false,nextCursor:null,searchScope:'TITLE_REASON',observedAt:'2026-10-20T00:02:00.000Z'}}));
 await page.route(`**/api/v1/projects/${pid}/knowledge/${kid}/versions/2`,r=>r.fulfill({json:pair.after}));
 await page.route(`**/api/v1/projects/${pid}/knowledge/${kid}/versions/1`,async r=>{reads++;if(mode==='DELAY')await new Promise<void>(r=>release=r);if(mode==='DENIED')return r.fulfill({status:403,json:{code:'KNOWLEDGE_READ_DENIED'}});return r.fulfill({json:pair.before});});
 await page.goto(`/#/projects/${pid}/knowledge`);await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();return{pair,unknown,writes,errors,get reads(){return reads;},release:()=>release()};
}
test('보관 지식은 정정 전후 제목·본문·판단 이유를 비교하고 원문·상태는 변경하지 않는다',async({page})=>{
 const f=await fixture(page);expect(f.reads).toBe(0);await page.getByRole('button',{name:'앞 버전과 보관 원문 비교',exact:true}).click();const panel=page.getByRole('region',{name:'보관 지식 버전 비교',exact:true});await expect(panel.getByLabel('제목 변경 전',{exact:true})).toHaveText('앞 제목');await expect(panel.getByLabel('제목 변경 후',{exact:true})).toHaveText('정정 제목');await expect(panel.getByLabel('판단 이유 변경 전',{exact:true})).toHaveText('앞 판단 이유');await expect(panel.getByLabel('본문 변경 후',{exact:true})).toContainText('<script>window.KNOWLEDGE_HISTORY_EXECUTED=1</script>');await expect(page.getByLabel('보관 지식 원문',{exact:true})).toHaveText(f.pair.after.body);expect(await page.evaluate(()=> (window as any).KNOWLEDGE_HISTORY_EXECUTED)).toBeUndefined();await page.getByRole('button',{name:'보관 버전 비교 닫기',exact:true}).click();await expect(panel).toHaveCount(0);expect(f.reads).toBe(1);expect(f.writes).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
test('보관 앞 버전 조회 거절은 비교 성공이나 변경없음으로 대체하지 않는다',async({page})=>{
 const f=await fixture(page,'DENIED');await page.getByRole('button',{name:'앞 버전과 보관 원문 비교',exact:true}).click();await expect(page.getByRole('alert')).toContainText('KNOWLEDGE_READ_DENIED');await expect(page.getByLabel('본문 변경 후',{exact:true})).toHaveCount(0);expect(f.writes).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
test('보관 지식 비교를 닫은 뒤 늦은 앞 버전 응답이 비교를 다시 열지 않는다',async({page})=>{
 await page.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=async(input,init)=>{const response=await original(input,init);if(String(input).endsWith('/knowledge/44444444-4444-4444-8444-444444444444/versions/1')){const json=response.json.bind(response);response.json=async()=>{const value=await json();setTimeout(()=>{(window as any).KNOWLEDGE_COMPARISON_CONSUMED=true;},0);return value;};}return response;};});
 const f=await fixture(page,'DELAY');await page.getByRole('button',{name:'앞 버전과 보관 원문 비교',exact:true}).click();await expect.poll(()=>f.reads).toBe(1);await page.getByRole('button',{name:'보관 버전 비교 닫기',exact:true}).click();const response=page.waitForResponse(r=>r.url().endsWith('/versions/1'));f.release();await(await response).finished();await expect.poll(()=>page.evaluate(()=>(window as any).KNOWLEDGE_COMPARISON_CONSUMED)).toBe(true);await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));await expect(page.getByRole('region',{name:'보관 지식 버전 비교',exact:true})).toHaveCount(0);await expect(page.getByLabel('보관 지식 원문',{exact:true})).toHaveText(f.pair.after.body);expect(f.writes).toEqual([]);expect(f.unknown).toEqual([]);expect(f.errors).toEqual([]);
});
