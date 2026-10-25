import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {criteriaFixture,criteriaRef} from '../../unit/FN12/result-criteria-fixture.ts';
import {newManualResultReport} from '../../../apps/web/src/features/session-detail/manual-result-report.ts';
import {resultSubmissionKey} from '../../../apps/web/src/features/session-detail/result-submission-write-api.ts';

const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui05-manual-cancel-20261025-01');
test('UI05 미저장 작성만 확인 후 취소하고 새 binding으로 다시 작성하며 진행 중·다른 입력을 보존한다',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI05_MANUAL_CANCEL_DOM_QA,'1','Main에 등록한 수동 QA만 실행');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 QA root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const bundled=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,
  lib:{entry:resolve('tests/browser/UI05/manual-report-cancel-dom-harness.tsx'),name:'AnvilManualCancelQA',formats:['iife']}}});
 const outputs=Array.isArray(bundled)?bundled:[bundled];assert.equal(outputs.length,1);const output=outputs[0];assert(output&&typeof output==='object'&&'output'in output&&Array.isArray(output.output));assert.equal(output.output.length,1);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const {assignment}=criteriaFixture(),session={user:{id:assignment.snapshot.confirmedBy.userId},clientId:assignment.projectId,csrfToken:'A'.repeat(43)},key=resultSubmissionKey(session,assignment.projectId,assignment.ref),other=newManualResultReport(assignment,session),otherDrafts:any={};
 for(const [name,s,a]of [['assignment',session,{...assignment,ref:criteriaRef(83)}],['user',{...session,user:{id:criteriaRef(84).id}},assignment],['client',{...session,clientId:criteriaRef(85).id},assignment]]as const)otherDrafts[resultSubmissionKey(s,a.projectId,a.ref)]={...other,bindingId:name,risks:name};
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(5000);const errors:string[]=[],unexpected:string[]=[];
  page.on('pageerror',e=>errors.push(e.name));await page.route('**/*',route=>{if(route.request().url()==='https://anvil.invalid:3830/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});unexpected.push(route.request().url());return route.abort();});
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(seed=>{(window as any).__manualCancelSeed=seed;},{assignment,session,drafts:otherDrafts,buffer:null});await page.addScriptTag({content:chunk.code});
  const start=page.getByRole('button',{name:'미완료 결과 직접 작성',exact:true}),cancel=page.getByRole('button',{name:'미저장 결과 작성 취소',exact:true});
  await start.click();const fill=async(label:string,value:string)=>page.getByLabel(label,{exact:true}).fill(value),ref=criteriaRef(99);
  await fill('보고 실행 ID',ref.id);await fill('보고 실행 버전','1');await fill('보고 실행 해시',ref.contentHash);await fill('미실행 조건 ID 1','save');await fill('미실행 시험 ID 1','SAVE-01');await fill('미실행 사유 1','DB 접속 미확인');await fill('보고 위험','확인 전');await fill('보고 복구 방법','기존 자료 보존');
  await page.getByRole('button',{name:'명령 결과 추가',exact:true}).click();
  for(const kind of ['프로필','작업위치','호스트'])for(const [field,value]of [['ID',ref.id],['버전','1'],['해시',ref.contentHash]]as const)await fill(`명령 1 ${kind} ${field}`,value);
  await fill('명령 인수 1','node\n--version');await page.getByLabel('명령 1 출력 참조 입력',{exact:true}).check();
  for(const [field,value]of [['ID',ref.id],['버전','1'],['해시',ref.contentHash]]as const)await fill(`명령 1 출력 ${field}`,value);
  await page.getByRole('button',{name:'명령 1 증거 추가',exact:true}).click();await fill('명령 1 증거 1 내용 해시',ref.contentHash);
  await page.getByRole('button',{name:'변경 파일 추가',exact:true}).click();await fill('변경 파일 상대경로 1','apps/task.ts');await page.getByLabel('변경 파일 1 diff 참조 입력',{exact:true}).check();await fill('변경 파일 1 diff ID',ref.id);
  await page.getByRole('button',{name:'시험 결과 추가',exact:true}).click();await fill('시험 실제 결과 1','아직 미확인');await page.getByRole('button',{name:'시험 1 증거 추가',exact:true}).click();await fill('시험 1 증거 1 내용 해시',ref.contentHash);
  await page.getByRole('button',{name:'산출물 참조 추가',exact:true}).click();await fill('보고 산출물 ID 1',ref.id);
  const snapshot=await page.evaluate(()=>(window as any).__manualCancelQA.drafts),original=snapshot[key];
  await page.evaluate(()=>{(window as any).__manualCancelQA.show(false);});await page.getByText('다른 화면',{exact:true}).waitFor();await page.evaluate(()=>{(window as any).__manualCancelQA.show(true);});await cancel.waitFor();assert.deepEqual(await page.evaluate(()=>(window as any).__manualCancelQA.drafts),snapshot);
  let prompt='';page.once('dialog',async d=>{prompt=d.message();await d.dismiss();});await cancel.click();assert.match(prompt,/미저장/);assert.deepEqual(await page.evaluate(()=>(window as any).__manualCancelQA.drafts),snapshot);
  page.once('dialog',d=>d.accept());await cancel.click();await start.waitFor();assert.deepEqual(await page.evaluate(()=>(window as any).__manualCancelQA.drafts),{...otherDrafts,[key]:null});assert.deepEqual(await page.evaluate(()=>(window as any).__manualCancelQA.calls),[]);
  await start.click();await cancel.waitFor();const fresh=await page.evaluate(()=>(window as any).__manualCancelQA.drafts[(window as any).__manualCancelQA.key]);assert.notEqual(fresh.bindingId,original.bindingId);assert.equal(fresh.executionId,'');assert.equal(fresh.rows[0].reason,'');assert.equal(await page.getByLabel('명령 인수 1',{exact:true}).count(),0);
  // 지연된 함수형 변경은 새 입력 또는 교체된 작성본을 지우지 못한다.
  for(const replacement of [{...fresh,risks:'새 입력'},{...fresh,bindingId:'replacement'}]){
   await page.evaluate(()=>{(window as any).__manualCancelQA.defer=true;});page.once('dialog',d=>d.accept());await cancel.click();
   await page.evaluate(value=>{(window as any).__manualCancelQA.replace(value);},replacement);await page.waitForFunction(value=>(window as any).__manualCancelQA.drafts[(window as any).__manualCancelQA.key].risks===value.risks&& (window as any).__manualCancelQA.drafts[(window as any).__manualCancelQA.key].bindingId===value.bindingId,replacement);
   await page.evaluate(()=>{(window as any).__manualCancelQA.queued();});await page.evaluate(()=>new Promise<void>(r=>setTimeout(r,0)));assert.deepEqual(await page.evaluate(()=>(window as any).__manualCancelQA.drafts[(window as any).__manualCancelQA.key]),replacement);
  }
  await page.evaluate(()=>{(window as any).__manualCancelQA.occupy(true);});await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='미저장 결과 작성 취소'&&b.disabled));assert(await cancel.isDisabled());await page.evaluate(()=>{(window as any).__manualCancelQA.occupy(false);});
  // 유효한 작성본으로 실제 제어 조회·준비를 거친 뒤 취소가 차단된다.
  const valid={...fresh,executionId:ref.id,executionVersion:'1',executionHash:ref.contentHash,rows:[{criterionId:'save',testId:'SAVE-01',reason:'미확인'}],rollback:'기존 자료 보존'};
  await page.evaluate(value=>{(window as any).__manualCancelQA.replace(value);},valid);await page.getByRole('button',{name:'작성 보고 검사·등록 준비',exact:true}).click();await page.waitForFunction(()=>(window as any).__manualCancelQA.pending);assert(await cancel.isDisabled());
  await page.evaluate(()=>{(window as any).__manualCancelQA.release();});await page.waitForFunction(()=>(window as any).__manualCancelQA.buffer!==null);assert(await cancel.isDisabled());
  assert.deepEqual(await page.evaluate(()=>(window as any).__manualCancelQA.drafts),{...otherDrafts,[key]:valid});assert.equal(await page.evaluate(()=>(window as any).__manualCancelQA.calls.filter((c:any)=>c.method==='POST').length),0);assert.equal(await page.evaluate(()=>(window as any).__manualCancelQA.buffer.pending),null);
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await context.close();}
});
