import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {build} from 'vite';
import {chromium,expect} from '@playwright/test';
import type {MethodologyGraph,MethodologyNode} from '../../../contracts/methodologies.ts';

const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui03-duplicate-node-20261025-01');
const formRef={id:'44444444-4444-4444-8444-444444444444',version:2,contentHash:'a'.repeat(64)};
function node(name:string,itemId:string,x:number):MethodologyNode{return {nodeId:'A',name,purpose:name+'의 목적',kind:'HUMAN',role:'USER',position:{x,y:0},
 inputs:[{itemId:'입력-'+itemId,formRef,required:true,reviewCriteria:['입력 대조']}],outputs:[{itemId:'출력-'+itemId,formRef,required:false,reviewCriteria:['출력 대조']}],
 taskScope:{included:[name+' 범위'],excluded:['실행']},completionCriteria:[name+' 확인'],approvalBoundary:['사용자'],mode:'CASE_BY_CASE',limitPolicyRef:formRef,recordRequirements:[name+' 기록']};}
const graph:MethodologyGraph={nodes:[node('첫째 정의','첫째',0),node('둘째 정의','둘째',240),{...node('다른 단계','다른',480),nodeId:'B'}],entryNodeId:'A',terminalNodeIds:['A','B'],edges:[
 {edgeId:'E',fromNodeId:'A',toNodeId:'B',kind:'BRANCH',reason:'조건 보존',condition:{fieldRef:{nodeId:'A',field:'USER_DECISION'},operator:'EQ',value:'계속'}}
]};
const seed={name:'중복 단계 보존',purpose:'단계 정의 하나씩 확인',scope:'PROJECT',reason:'명시 복구',graph};

test('UI03 실제 가져오기·양쪽 부모에서 중복 단계는 일반 편집을 막고 선택한 정의 하나만 확인 제거한다',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI03_DUPLICATE_NODE_DOM_QA,'1','Main에 등록한 수동 QA만 실행');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 QA root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const bundled=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,lib:{entry:resolve('tests/browser/UI03/duplicate-node-repair-dom-harness.tsx'),name:'AnvilDuplicateNodeQA',formats:['iife']}}});
 const outputs=Array.isArray(bundled)?bundled:[bundled];assert.equal(outputs.length,1);const output=outputs[0];assert(output&&typeof output==='object'&&'output'in output&&Array.isArray(output.output));assert.equal(output.output.length,1);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(5000);const errors:string[]=[],unexpected:string[]=[];
  page.on('pageerror',e=>errors.push(e.name));await page.route('**/*',route=>{if(route.request().url()==='https://anvil.invalid:3830/'&&route.request().method()==='GET')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});unexpected.push(route.request().method()+' '+route.request().url());return route.abort();});
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(value=>{(window as any).__duplicateNodeSeed=value;},seed);await page.addScriptTag({content:chunk.code});
  await page.getByLabel('방법론 초안 JSON 가져오기',{exact:true}).setInputFiles({name:'draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(seed))});
  const common=page.getByRole('region',{name:'프로젝트 방법론 편집',exact:true}),draft=page.getByRole('region',{name:'프로젝트 전용 방법론 편집',exact:true});
  await expect(common).toBeVisible();
  for(const [mode,parentEditor] of [['common',common],['draft',draft]] as const){
   const state=async()=>await page.evaluate(key=>(window as any).__duplicateNodeQA[key],mode);
   const initial=await state();assert.deepEqual(initial.graph,graph);
   const repair=parentEditor.getByRole('region',{name:'중복 단계 정의 복구',exact:true});
   await expect(repair).toBeVisible();
   await expect(parentEditor.getByLabel('단계 이름 편집',{exact:true})).toHaveCount(0);
   await expect(parentEditor.getByRole('button',{name:'이 초안의 단계 제거',exact:true})).toHaveCount(0);
   await expect(parentEditor.getByRole('region',{name:'방법론 단계 한도 선택',exact:true})).toHaveCount(0);
   // SVG 키보드 이동과 이동 버튼 모두 중복 ID 전체를 바꾸지 않는다.
   await parentEditor.getByRole('button',{name:'흐름도 단계 A: 둘째 정의',exact:true}).press('ArrowRight');
   await parentEditor.getByRole('button',{name:'선택 단계 오른쪽 이동',exact:true}).click();assert.deepEqual((await state()).graph,graph);
   const selection=repair.getByLabel('제거할 중복 단계 정의',{exact:true}),remove=repair.getByRole('button',{name:'확인한 중복 정의 하나만 제거',exact:true});
   await expect(remove).toBeDisabled();await selection.selectOption('1');
   const shown=repair.getByLabel('선택한 중복 단계 정의',{exact:true});assert.deepEqual(JSON.parse(await shown.innerText()),graph.nodes[1]);
   await expect(shown).toContainText('입력-둘째');await expect(shown).toContainText('출력-둘째');await expect(shown).not.toContainText('입력-첫째');
   let prompt='';page.once('dialog',async d=>{prompt=d.message();await d.dismiss();});await remove.click();assert.match(prompt,/둘째 정의/);assert.match(prompt,/2/);assert.deepEqual(await state(),initial);
   // 미리보기를 표시한 뒤 부모가 잠기면 복구 제거도 실행하지 못한다.
   await page.evaluate(key=>(window as any).__duplicateNodeQA[key==='common'?'lockCommon':'lockDraft'](true),mode);await expect(remove).toBeDisabled();
   const locked=await state();await remove.evaluate((button:HTMLButtonElement)=>button.click());assert.deepEqual(await state(),locked);
   await page.evaluate(key=>(window as any).__duplicateNodeQA[key==='common'?'lockCommon':'lockDraft'](false),mode);await expect(remove).toBeEnabled();
   page.once('dialog',d=>d.accept());await remove.click();
   const repaired=await state(),expectedGraph={...graph,nodes:[graph.nodes[0]!,graph.nodes[2]!]};assert.deepEqual(repaired.graph,expectedGraph);
   assert.deepEqual({...repaired,graph:initial.graph,...(mode==='common'?{preparationId:undefined}: {})},{...initial,...(mode==='common'?{preparationId:undefined}: {})});
   await expect(repair).toHaveCount(0);await expect(parentEditor.getByLabel('단계 이름 편집',{exact:true})).toHaveValue('첫째 정의');
   // 같은 ID 최후 한 개는 복구로 제거할 수 없고 기존 일반 편집으로 이어진다.
   await parentEditor.getByLabel('단계 이름 편집',{exact:true}).fill('남은 단계만 수정');
   const edited=await state();assert.equal(edited.graph.nodes.length,2);assert.equal(edited.graph.nodes[0].name,'남은 단계만 수정');assert.deepEqual(edited.graph.nodes[1],graph.nodes[2]);
   assert.deepEqual({...edited.graph,nodes:expectedGraph.nodes},expectedGraph);
   await expect(parentEditor.getByRole('button',{name:'이 초안의 단계 제거',exact:true})).toBeVisible();
   // 새 그래프가 들어오면 과거 배열 위치의 선택을 재사용하지 않는다.
   await page.evaluate(({key,next})=>(window as any).__duplicateNodeQA[key==='common'?'replaceCommon':'replaceDraft'](next),{key:mode,next:initial});
   await expect(repair).toBeVisible();await selection.selectOption('0');assert.deepEqual(JSON.parse(await shown.innerText()),graph.nodes[0]);
   await page.evaluate(({key,next})=>(window as any).__duplicateNodeQA[key==='common'?'replaceCommon':'replaceDraft'](next),{key:mode,next:{...initial,graph:{...graph,nodes:[graph.nodes[0],{...graph.nodes[1]!,purpose:'새 입력'},graph.nodes[2]]}}});
   await expect(shown).toHaveCount(0);await expect(remove).toBeDisabled();
   // 확인창 승인 직전 부모가 잠기거나 입력이 바뀌어도 과거 정의를 제거하지 않는다.
   await selection.selectOption('0');const beforeLock=await state();
   await page.evaluate(key=>(window as any).__duplicateNodeQA.confirmWithLock(key),mode);await remove.click();await expect(remove).toBeDisabled();assert.deepEqual((await state()).graph,beforeLock.graph);
   await page.evaluate(key=>(window as any).__duplicateNodeQA[key==='common'?'lockCommon':'lockDraft'](false),mode);await expect(remove).toBeEnabled();
   const replacement={...initial,graph:{...graph,nodes:[graph.nodes[0],graph.nodes[1],{...graph.nodes[2]!,purpose:'승인 중 새 입력'}]}};
   await page.evaluate(({key,next})=>(window as any).__duplicateNodeQA.confirmWithReplace(key,next),{key:mode,next:replacement});await remove.click();assert.deepEqual(await state(),replacement);await expect(shown).toHaveCount(0);await expect(remove).toBeDisabled();
   // 부모 전체를 떠난 뒤 닫힌 확인창의 옛 callback이 보존 중인 초안을 바꾸면 안 된다.
   await selection.selectOption('1');const beforeUnmount=await state();await page.evaluate(key=>(window as any).__duplicateNodeQA.confirmWithUnmount(key),mode);
   await remove.click();await expect(parentEditor).toHaveCount(0);assert.deepEqual(await state(),beforeUnmount);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.equal(await page.evaluate(()=>(window as any).__duplicateNodeQA.authLost),0);
  const requests=await page.evaluate(()=>(window as any).__duplicateNodeQA.requests) as string[];assert(requests.length>=2);assert(requests.every(request=>request==='GET /api/v1/forms'));
 }finally{await context.close();}
});
