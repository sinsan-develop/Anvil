import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resolve} from 'node:path';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {knowledgeVersionPair,comparisonProject,comparisonUser} from '../../unit/FN05/knowledge-version-comparison-fixture.ts';
import {knowledgeCriterionIds} from '../../../apps/web/src/features/knowledge/review-view.ts';
// Main이 자원 등록·생성·정리한 root에서만 실행한다. 이 spec은 root/temp를 생성하지 않는다.
test('UI10 보호 원문 조회의 보관 검토 접힘·펼침과 버전 변경·원문403 경계를 보존한다',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI10_STORED_REVIEW_QA,'1');
 const root=resolve('D:/tmp/anvil-v3-stage-b/ui10-stored-review-details-20261026-01');assert.equal(resolve(process.env.ANVIL_UI10_STORED_REVIEW_ROOT??''),root);
 for(const key of ['TEMP','TMP'])assert.equal(resolve(process.env[key]??''),resolve(root,'temp'));
 const result=await build({configFile:false,logLevel:'error',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,lib:{entry:resolve('tests/browser/UI10/knowledge-stored-review-details-harness.tsx'),formats:['iife'],name:'StoredReviewQA'}}});
 const output=Array.isArray(result)?result[0]:result;assert(output&&'output'in output);const chunk=output.output.find(o=>o.type==='chunk');assert(chunk&&chunk.type==='chunk');
 const pair=knowledgeVersionPair(),criteria={criteriaVersion:1,knowledgeKind:'FACT',items:knowledgeCriterionIds.map((criterionId,n)=>({criterionId,title:'보관 기준 '+(n+1)}))};
 Object.assign(pair.after,{contentReviewCriteria:criteria,confirmation:null,currentConfirmationValid:false,contentReviews:[2,1].map(n=>({ref:{id:`77777777-7777-4777-8777-77777777777${n}`,targetRef:pair.after.ref,criteriaVersion:1,outcome:'REWORK'},criteria,items:criteria.items.map((i,index)=>({criterionId:i.criterionId,outcome:index===3?'NOT_EXECUTED':'REWORK',evidenceRefs:[],reason:`항목 ${index+1} 원문 <script>window.storedReviewUnsafe=1</script>`})).reverse(),reviewer:{kind:'HUMAN',userId:comparisonUser,sameAsTargetRecorder:n===1},sourceKind:'HUMAN_REVIEW',reason:'보관 총 이유 '+n,reviewedAt:`2026-10-20T00:00:0${n}.123Z`,serverSequence:n}))});
 const context=await chromium.launchPersistentContext(resolve(root,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage(),errors:string[]=[],unexpected:string[]=[];page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const path=new URL(r.request().url());if(path.origin==='https://localhost:3830'&&path.pathname==='/')return r.fulfill({contentType:'text/html',body:'<html><body><div id="root"></div></body></html>'});unexpected.push(r.request().url());return r.abort();});
  await page.goto('https://localhost:3830/');await page.evaluate(seed=>(window as any).__storedReviewSeed=seed,{...pair,projectId:comparisonProject,at:'2026-10-20T00:00:03.000Z',session:{user:{id:comparisonUser},clientId:comparisonUser,csrfToken:'C'.repeat(43)}});await page.addScriptTag({content:chunk.code});
  const panel=page.getByRole('region',{name:'보관 내용 검토',exact:true});assert.equal(await panel.count(),0);
  await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();await panel.waitFor();const reviews=panel.locator('details');assert.equal(await reviews.count(),2);assert.deepEqual(await reviews.evaluateAll(items=>items.map(el=>(el as HTMLDetailsElement).open)),[false,false]);
  const calls=await page.evaluate(()=>(window as any).__storedReviewQA.calls.length);await reviews.first().locator('summary').click();assert.equal(await reviews.first().evaluate(el=>(el as HTMLDetailsElement).open),true);assert.equal(await reviews.first().locator('li').count(),5);assert((await reviews.first().textContent())?.includes('미실행'));assert((await reviews.first().textContent())?.includes(pair.after.ref.contentHash));assert((await reviews.first().textContent())?.includes('항목 1 원문 <script>window.storedReviewUnsafe=1</script>'));assert.equal(await page.evaluate(()=>(window as any).storedReviewUnsafe),undefined);assert.equal(await page.evaluate(()=>(window as any).__storedReviewQA.calls.length),calls);
  await page.getByRole('button',{name:'앞 버전 원문 보기',exact:true}).click();await page.getByLabel('보관 지식 원문',{exact:true}).filter({hasText:pair.before.body}).waitFor();assert.equal(await panel.locator('details').count(),0);assert((await panel.textContent())?.includes('검토 메타데이터 미제공'));
  await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();await panel.locator('details').first().waitFor();assert.deepEqual(await panel.locator('details').evaluateAll(items=>items.map(el=>(el as HTMLDetailsElement).open)),[false,false]);await panel.locator('details').first().locator('summary').click();
  await page.evaluate(()=>(window as any).__storedReviewQA.denied=true);await page.getByRole('button',{name:'지식 원문 보기',exact:true}).click();await page.getByRole('alert').filter({hasText:'KNOWLEDGE_READ_DENIED'}).waitFor();assert.equal(await panel.count(),0);assert.equal(await page.getByLabel('보관 지식 원문',{exact:true}).count(),0);
  const qa=await page.evaluate(()=>(window as any).__storedReviewQA);assert.deepEqual(qa.unexpected,[]);assert.deepEqual(qa.changes,[]);assert(qa.calls.every((c:any)=>c.method==='GET'&&c.path.startsWith('/api/v1/')));assert.equal(qa.authLost,0);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await context.close();}
});
