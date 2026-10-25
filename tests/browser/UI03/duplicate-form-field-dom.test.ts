import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {build} from 'vite';
import {chromium,expect} from '@playwright/test';
import type {FormVersion} from '../../../apps/web/src/features/methodologies/forms-api.ts';

const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui03-duplicate-field-20261025-01');
const seed:FormVersion={ref:{id:'44444444-4444-4444-8444-444444444444',version:2,contentHash:'a'.repeat(64)},definition:{
 formCode:'QA-FORM',name:'반복 필드 정정',purpose:'중복 정의를 하나씩 확인',scope:'USER_COMMON',authorRole:'작성자',reviewerRole:'검토자',confirmerRole:'사용자',requiredInputs:['원문 보존'],
 authoringStandardRef:{id:'66666666-6666-4666-8666-666666666666',version:1,contentHash:'b'.repeat(64)},items:[
 {itemId:'ITEM-A',title:'반복 항목',required:true,valueType:'RECORDS',repeated:true,authoringRules:['작성 규칙 보존'],reviewCriteria:['검토 기준 보존'],fields:[
  {fieldId:'DUP',title:'첫째 원문',required:true,valueType:'TEXT'},
  {fieldId:'DUP',title:'둘째 <script>원문</script>',required:false,valueType:'TEXT'},
  {fieldId:'OTHER',title:'다른 필드',required:false,valueType:'TEXT'}]},
 {itemId:'ITEM-B',title:'다른 항목',required:false,valueType:'TEXT',repeated:false,fields:[],authoringRules:['다른 작성 규칙'],reviewCriteria:['다른 검토 기준']}
 ]},authoringStandard:{ref:{id:'66666666-6666-4666-8666-666666666666',version:1,contentHash:'b'.repeat(64)},content:'공통 작성 기준 원문'},validation:{formatOnly:true,contentReview:'NOT_PERFORMED',userAcceptance:'NOT_PERFORMED'}};

test('UI03 고정 양식 GET 뒤 중복 반복 필드의 동시 수정을 막고 확인한 정의 하나만 제거한다',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI03_DUPLICATE_FIELD_DOM_QA,'1','Main에 등록한 수동 QA만 실행');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 QA root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const bundled=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI03/duplicate-form-field-dom-harness.tsx'),name:'AnvilDuplicateFieldQA',formats:['iife']}}});
 const outputs=Array.isArray(bundled)?bundled:[bundled];assert.equal(outputs.length,1);const output=outputs[0];assert(output&&typeof output==='object'&&'output'in output&&Array.isArray(output.output));assert.equal(output.output.length,1);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(5000);const errors:string[]=[],unexpected:string[]=[];
  page.on('pageerror',e=>errors.push(e.name));await page.route('**/*',route=>{if(route.request().url()==='https://anvil.invalid:3830/'&&route.request().method()==='GET')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});unexpected.push(route.request().method()+' '+route.request().url());return route.abort();});
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(value=>{(window as any).__duplicateFieldSeed=value;},seed);await page.addScriptTag({content:chunk.code});
  const editor=page.getByRole('region',{name:'내 공통 양식 작업',exact:true});await expect(editor.getByRole('button',{name:'이 공통 양식 편집',exact:true})).toBeVisible();await editor.getByRole('button',{name:'이 공통 양식 편집',exact:true}).click();
  await editor.getByLabel('양식 개정 이유',{exact:true}).fill('선택한 중복만 정정');
  const state=async()=>await page.evaluate(()=>(window as any).__duplicateFieldQA.buffer),initial=await state();assert.deepEqual(initial.definition,seed.definition);
  const repair=editor.getByRole('region',{name:'중복 반복 필드 복구',exact:true}),select=repair.getByLabel('제거할 중복 반복 필드 정의',{exact:true}),remove=repair.getByRole('button',{name:'확인한 중복 필드 정의 하나만 제거',exact:true}),shown=repair.getByLabel('선택한 중복 반복 필드 정의',{exact:true});
  await expect(repair).toHaveCount(1);
  const duplicateTitles=editor.getByLabel('반복 필드 DUP',{exact:true}),duplicateRequired=editor.getByLabel('반복 필드 DUP 필수',{exact:true});
  await expect(duplicateTitles).toHaveCount(2);for(const input of await duplicateTitles.all())await expect(input).toBeDisabled();for(const input of await duplicateRequired.all())await expect(input).toBeDisabled();
  await expect(duplicateTitles.nth(1)).toHaveValue('둘째 <script>원문</script>');await expect(duplicateRequired.nth(1)).not.toBeChecked();assert.deepEqual(await state(),initial);
  await expect(remove).toBeDisabled();await select.selectOption('1');assert.deepEqual(JSON.parse(await shown.innerText()),seed.definition.items[0]!.fields[1]);await expect(shown).toContainText('<script>원문</script>');assert.equal(await repair.locator('script').count(),0);
  let prompt='';page.once('dialog',async d=>{prompt=d.message();await d.dismiss();});await remove.click();assert.match(prompt,/둘째/);assert.match(prompt,/2/);assert.deepEqual(await state(),initial);
  // 저장과 검토 명령이 남으면 선택한 복구도 잠긴다.
  for(const kind of ['save','review']){await page.evaluate(value=>(window as any).__duplicateFieldQA.lock(value),kind);await expect(remove).toBeDisabled();const locked=await state();await remove.evaluate((button:HTMLButtonElement)=>button.click());assert.deepEqual(await state(),locked);await page.evaluate(()=>(window as any).__duplicateFieldQA.lock(''));await select.selectOption('1');}
  page.once('dialog',d=>d.accept());await remove.click();const repaired=await state();
  assert.deepEqual(repaired,{...initial,definition:{...seed.definition,items:[{...seed.definition.items[0],fields:[seed.definition.items[0]!.fields[0],seed.definition.items[0]!.fields[2]]},seed.definition.items[1]]}});
  assert.deepEqual(await page.evaluate(()=>(window as any).__duplicateFieldQA.source),seed);await expect(repair).toHaveCount(0);
  // 마지막 같은 ID는 복구 선택에서 빠지고 정상 단일 필드 편집·이동·제거로 돌아간다.
  await editor.getByLabel('반복 필드 DUP',{exact:true}).fill('남은 필드 수정');await expect(editor.getByLabel('반복 필드 DUP 필수',{exact:true})).toBeEnabled();await editor.getByLabel('반복 필드 DUP 필수',{exact:true}).uncheck();
  await editor.getByRole('button',{name:'반복 필드 DUP 오른쪽 이동',exact:true}).click();assert.deepEqual((await state()).definition.items[0].fields,[seed.definition.items[0]!.fields[2],{...seed.definition.items[0]!.fields[0],title:'남은 필드 수정',required:false}]);
  page.once('dialog',d=>d.accept());await editor.getByRole('button',{name:'반복 필드 DUP 제거',exact:true}).click();assert.deepEqual((await state()).definition.items[0].fields,[seed.definition.items[0]!.fields[2]]);
  // 다른 버퍼/선택 항목으로 바뀐 뒤 과거 index 선택을 재사용하지 않는다.
  await page.evaluate(value=>(window as any).__duplicateFieldQA.replace(value),initial);await select.selectOption('0');
  await page.evaluate(value=>(window as any).__duplicateFieldQA.replace(value),{...initial,reason:'교체된 초안'});await expect(shown).toHaveCount(0);await expect(remove).toBeDisabled();
  await select.selectOption('1');await editor.getByRole('button',{name:'다른 항목 편집',exact:true}).click();await expect(repair).toHaveCount(0);await editor.getByRole('button',{name:'반복 항목 편집',exact:true}).click();await expect(shown).toHaveCount(0);await expect(remove).toBeDisabled();
  for(const kind of ['save','review','replace','mutate','user','hide']){
   await page.evaluate(value=>(window as any).__duplicateFieldQA.replace(value),initial);await select.selectOption('1');const before=await state(),replacement={...initial,reason:'확인 중 교체'};
   await page.evaluate(({kind,next})=>(window as any).__duplicateFieldQA.confirmWith(kind,next),{kind,next:replacement});await remove.click();
   const after=await state();if(kind==='replace')assert.deepEqual(after,replacement);else if(kind==='mutate'){assert.equal(after.definition.items[0].fields[1].title,'확인 중 원문 변경');assert.equal(after.definition.items[0].fields.length,3);}else assert.deepEqual(after.definition,before.definition);
   if(kind==='save'||kind==='review')await page.evaluate(()=>(window as any).__duplicateFieldQA.lock(''));
   if(kind==='user'){await page.evaluate(()=>(window as any).__duplicateFieldQA.user('22222222-2222-4222-8222-222222222222'));}
   if(kind==='hide')await expect(editor).toHaveCount(0);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.equal(await page.evaluate(()=>(window as any).__duplicateFieldQA.authLost),0);assert.deepEqual(await page.evaluate(()=>(window as any).__duplicateFieldQA.requests),[`GET /api/v1/forms/${seed.ref.id}/versions/${seed.ref.version}`]);
 }finally{await context.close();}
});
