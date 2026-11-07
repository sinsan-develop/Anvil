import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {build} from 'vite';
import {chromium} from '@playwright/test';
import {criteriaFixture,criteriaHash,criteriaId} from '../../unit/FN12/result-criteria-fixture.ts';
import {resultFixture} from '../../unit/UI05/result-view-fixture.ts';

const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui05-review-unsent-20261025-01');
test('UI05 미전송 검수 준비만 확인 후 해제하고 입력·binding 보존 및 전송/경쟁 상태를 보호한다',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI05_REVIEW_UNSENT_DOM_QA,'1','Main에 등록한 수동 QA만 실행');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 QA root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const bundled=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI05/result-review-unsent-dom-harness.tsx'),name:'AnvilReviewUnsentQA',formats:['iife']}}});
 const outputs=Array.isArray(bundled)?bundled:[bundled];assert.equal(outputs.length,1);const output=outputs[0];assert(output&&typeof output==='object'&&'output'in output&&Array.isArray(output.output));assert.equal(output.output.length,1);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const f=criteriaFixture(),r=resultFixture(),session={user:{id:criteriaId(6),displayName:'합성'},clientId:criteriaId(8),csrfToken:'A'.repeat(43)},at='2026-10-20T00:00:00.000Z';
 r.entry.snapshot.scope.projectId=f.assignment.projectId;r.entry.snapshot.scope.assignmentRef=f.assignment.ref;r.entry.snapshot.manifest.assignmentRef=f.assignment.ref;r.entry.snapshot.manifestHash=criteriaHash(r.entry.snapshot.manifest);r.entry.ref.contentHash=criteriaHash(r.entry.snapshot);
 const snapshot={assignmentRef:f.assignment.ref,baselineRefs:f.d.baselineRefs,items:f.input.items.map((i:any)=>({criterionId:i.criterionId,testId:i.testId,kind:i.kind,environmentRef:i.environmentRef,required:true}))},ref={id:criteriaId(9),version:1,contentHash:criteriaHash(snapshot)},flags={registryStored:true,reviewStored:false,completionAccepted:false,executionAuthorized:false,dispatchPerformed:false},criteria={projectId:f.assignment.projectId,ref,snapshot,input:f.input,sourceBindings:f.input.items.map((i:any)=>({criterionId:i.criterionId,sources:i.sources})),createdBy:session.user.id,registeredAt:at,...flags,observedAt:at},list={projectId:f.assignment.projectId,assignmentRef:f.assignment.ref,items:[{ref,createdBy:session.user.id,registeredAt:at,conditionCount:2,...flags}],hasMore:false,selectionState:'NOT_SELECTED',observedAt:at};
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(5000);const errors:string[]=[],unexpected:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{if(route.request().url()==='https://anvil.invalid:3830/')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});unexpected.push(route.request().url());return route.abort();});
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(seed=>{(window as any).__reviewUnsentSeed=seed;},{assignment:f.assignment,result:r.entry,criteria,list,session,reviewId:criteriaId(30),operationId:criteriaId(31)});await page.addScriptTag({content:chunk.code});
  async function open(){await page.getByRole('button',{name:'보관 기준 목록 조회',exact:true}).click();await page.getByRole('button',{name:'보관 기준 원문 '+ref.id+' v1',exact:true}).click();await page.getByRole('region',{name:'결과 검수 기록',exact:true}).waitFor();}
  const editor=page.getByRole('region',{name:'결과 검수 기록',exact:true}),back=editor.getByRole('button',{name:'미전송 검수 저장 준비 해제',exact:true});
  const rowReason=(index:number)=>editor.locator('fieldset').nth(index-1).getByRole('textbox'),totalReason=editor.locator(':scope > label > textarea');
  const value=()=>page.evaluate(()=>(window as any).__reviewUnsentQA.buffers[(window as any).__reviewUnsentQA.key]);
  const replace=async(v:any)=>{await page.evaluate(value=>(window as any).__reviewUnsentQA.replace(value),v);};
  const posts=()=>page.evaluate(()=>(window as any).__reviewUnsentQA.calls.filter((c:any)=>c.method==='POST'));
  await open();await editor.getByRole('button',{name:'검수 판정 작성',exact:true}).click();await editor.getByLabel('검수 총판정',{exact:true}).selectOption('REWORK');
  for(const index of [1,2]){await editor.getByLabel('조건 판정 '+index,{exact:true}).selectOption(index===1?'REWORK':'BLOCKED');await rowReason(index).fill('행 이유 '+index);}
  await totalReason.fill('전체 보완 이유');await editor.getByRole('button',{name:'검수 기록 저장 준비',exact:true}).click();await editor.getByRole('button',{name:'검수 기록 명시 저장',exact:true}).waitFor();const original=await value();assert(original.pending);assert.deepEqual(await posts(),[]);
  // RED는 이 버튼이 빠져 작성으로 돌아가지 못하는 실제 화면에서 실패해야 한다.
  assert.equal(await back.count(),1,'미전송 검수 저장 준비 해제 버튼이 필요하다');
  let prompt='';page.once('dialog',async dialog=>{prompt=dialog.message();await dialog.dismiss();});await back.click();assert.match(prompt,/미전송/);assert.match(prompt,/서버/);assert.deepEqual(await value(),original);assert(await editor.getByLabel('검수 총판정',{exact:true}).isDisabled());
  page.once('dialog',dialog=>dialog.accept());await back.click();await page.waitForFunction(()=>(window as any).__reviewUnsentQA.buffers[(window as any).__reviewUnsentQA.key]?.pending===null);assert.deepEqual(await value(),{...original,pending:null,dirty:true});assert.deepEqual(await posts(),[]);
  assert.equal(await editor.locator('fieldset').count(),2);assert.equal(await rowReason(2).inputValue(),'행 이유 2');assert.equal(await totalReason.inputValue(),'전체 보완 이유');assert(await rowReason(2).isEnabled());assert(await totalReason.isEnabled());
  await rowReason(1).fill('수정 이유');await editor.getByRole('button',{name:'검수 기록 저장 준비',exact:true}).click();await back.waitFor();const revised=await value();assert.notEqual(revised.pending.command.commandId,original.pending.command.commandId);assert.equal(revised.pending.command.payload.items[0].reason,'수정 이유');assert.equal(revised.bindingId,original.bindingId);
  // confirm 도중 unmount 또는 동일 key의 작성본 교체는 해제를 무효화한다.
  await page.evaluate(()=>{const qa=(window as any).__reviewUnsentQA;(window as any).__nativeConfirm=window.confirm;window.confirm=()=>{qa.show(false);return true;};});await back.click();assert.deepEqual(await value(),revised);await page.evaluate(()=>{const w=window as any;window.confirm=w.__nativeConfirm;w.__reviewUnsentQA.show(true);});await open();
  await page.evaluate(()=>{const qa=(window as any).__reviewUnsentQA;window.confirm=()=>{qa.replace({...qa.buffers[qa.key],bindingId:'replacement'});return true;};});await back.click();assert.deepEqual(await value(),{...revised,bindingId:'replacement'});await page.evaluate(()=>{window.confirm=(window as any).__nativeConfirm;});await replace(revised);
  // 지연된 함수형 updater는 같은 binding의 명령 내용/ID/참조·입력이 바뀌어도 건드리지 않는다.
  const mutations=[(v:any)=>({...v,bindingId:'other'}),(v:any)=>({...v,reason:'새 입력'}),(v:any)=>({...v,pending:{...v.pending,command:{...v.pending.command,commandId:criteriaId(77)}}}),(v:any)=>({...v,pending:{...v.pending,command:{...v.pending.command,payload:{...v.pending.command.payload,reason:'다른 명령'}}}}),(v:any)=>({...v,resultRef:{...v.resultRef,version:2}}),(v:any)=>({...v,criteriaRef:{...v.criteriaRef,contentHash:'b'.repeat(64)}}),(v:any)=>({...v,ownerUserId:criteriaId(88)}),(v:any)=>({...v,ownerClientId:criteriaId(89)}),(v:any)=>({...v,uncertain:true}),(v:any)=>({...v,failure:{code:'VERSION_CONFLICT',status:409}}),(v:any)=>({...v,stored:{ref,snapshot:{sameAsSubmitter:false}}})];
  for(const mutate of mutations){await replace(revised);await page.evaluate(()=>(window as any).__reviewUnsentQA.defer=true);page.once('dialog',dialog=>dialog.accept());await back.click();const changed=mutate(structuredClone(revised));await replace(changed);await page.evaluate(()=>(window as any).__reviewUnsentQA.queued());await page.evaluate(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));assert.deepEqual(await value(),changed);}
  await replace(revised);const key=await page.evaluate(()=>(window as any).__reviewUnsentQA.key),otherKey=key+':other';await page.evaluate(({key,value})=>(window as any).__reviewUnsentQA.put(key,value),{key:otherKey,value:{...revised,bindingId:'other-buffer'}});page.once('dialog',dialog=>dialog.accept());await back.click();assert.deepEqual(await page.evaluate(key=>(window as any).__reviewUnsentQA.buffers[key],otherKey),{...revised,bindingId:'other-buffer'});
  // 저장 중에는 해제 불가, 응답 유실 뒤에는 같은 명령 재확인만 유지한다.
  await replace(revised);await page.evaluate(()=>(window as any).__reviewUnsentQA.mode='DELAY');await editor.getByRole('button',{name:'검수 기록 명시 저장',exact:true}).click();await page.waitForFunction(()=>(window as any).__reviewUnsentQA.pending);assert.equal(await back.count(),0);await page.evaluate(()=>{const qa=(window as any).__reviewUnsentQA;qa.mode='LOSS';qa.release();});await editor.getByRole('alert').filter({hasText:'CONNECTION_LOST'}).waitFor();const uncertain=await value();assert(uncertain.uncertain);assert.equal(await back.count(),0);assert.deepEqual(uncertain.pending,revised.pending);
  await page.evaluate(()=>(window as any).__reviewUnsentQA.mode='NORMAL');await editor.getByRole('button',{name:'같은 검수 기록 명령 재확인',exact:true}).click();await editor.getByRole('article',{name:'검수 기록 원문',exact:true}).waitFor();assert.equal(await back.count(),0);const commands=await posts();assert.equal(commands.length,2);assert.deepEqual(commands[0].body,revised.pending.command);assert.deepEqual(commands[1].body,revised.pending.command);
  assert.deepEqual(await page.evaluate(()=>(window as any).__reviewUnsentQA.unexpected),[]);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await context.close();}
});
