import assert from 'node:assert/strict';
import {test} from 'node:test';
import {lstat,mkdir,realpath} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {build} from 'vite';
import {chromium,expect} from '@playwright/test';
import type {MethodologyGraph} from '../../../contracts/methodologies.ts';

const qaRoot=resolve('D:/Project/Anvil/.av3-data/ui03-duplicate-edge-20261025-01');
const node=(nodeId:string)=>({nodeId,name:nodeId,purpose:'편집 보존',kind:'HUMAN' as const,position:{x:0,y:0},role:'USER' as const,inputs:[],outputs:[],taskScope:{included:['합의'],excluded:['실행']},completionCriteria:['확인'],approvalBoundary:['사용자'],mode:'CASE_BY_CASE' as const,limitPolicyRef:null,recordRequirements:['이유']});
const graph:MethodologyGraph={nodes:['A','B','C','D'].map(node),entryNodeId:'A',terminalNodeIds:['D'],edges:[
 {edgeId:'E',fromNodeId:'A',toNodeId:'B',kind:'BRANCH',reason:'첫째 원문',condition:{fieldRef:{nodeId:'A',field:'REVIEW_OUTCOME'},operator:'EQ',value:'REWORK'}},
 {edgeId:'E',fromNodeId:'A',toNodeId:'C',kind:'SEQUENCE',reason:'둘째 원문',condition:null},
 {edgeId:'UNIQUE',fromNodeId:'C',toNodeId:'D',kind:'SEQUENCE',reason:'다른 연결 원문',condition:null}
]};
const seed={name:'중복 연결 보존',purpose:'원 입력 개별 보완',scope:'USER_COMMON',reason:'명시 편집',graph};

test('UI03 가져온 중복 ID 연결의 선택·수정·삭제는 한 항목만 바꾸고 나머지 미저장 초안을 보존한다',{timeout:60000},async()=>{
 assert.equal(process.env.ANVIL_UI03_DUPLICATE_EDGE_DOM_QA,'1','Main에 등록한 수동 QA만 실행');
 for(const name of ['TEMP','TMP'])assert.equal(resolve(process.env[name]??''),resolve(qaRoot,'temp'));
 const parent=dirname(qaRoot),info=await lstat(parent);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(parent)).toLowerCase(),parent.toLowerCase());
 try{await lstat(qaRoot);assert.fail('기존 QA root 재사용 금지');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}await mkdir(qaRoot);await mkdir(resolve(qaRoot,'temp'));
 const bundled=await build({configFile:false,logLevel:'warn',define:{'process.env.NODE_ENV':JSON.stringify('production')},build:{write:false,minify:false,sourcemap:false,
  lib:{entry:resolve('tests/browser/UI03/duplicate-edge-edit-dom-harness.tsx'),name:'AnvilDuplicateEdgeQA',formats:['iife']}}});
 const outputs=Array.isArray(bundled)?bundled:[bundled];assert.equal(outputs.length,1);const output=outputs[0];assert(output&&typeof output==='object'&&'output'in output&&Array.isArray(output.output));assert.equal(output.output.length,1);const chunk=output.output[0];assert(chunk?.type==='chunk');
 const context=await chromium.launchPersistentContext(resolve(qaRoot,'browser'),{channel:'msedge',headless:true,serviceWorkers:'block',timeout:15000,viewport:{width:1920,height:1080}});
 try{
  const page=context.pages()[0]??await context.newPage();page.setDefaultTimeout(5000);const errors:string[]=[],unexpected:string[]=[];
  page.on('pageerror',e=>errors.push(e.name));await page.route('**/*',route=>{if(route.request().url()==='https://anvil.invalid:3830/'&&route.request().method()==='GET')return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});unexpected.push(route.request().method()+' '+route.request().url());return route.abort();});
  await page.goto('https://anvil.invalid:3830/');await page.evaluate(value=>{(window as any).__duplicateEdgeSeed=value;},seed);await page.addScriptTag({content:chunk.code});
  const selection=page.getByLabel('편집할 연결',{exact:true}),reason=page.getByLabel('연결 이유',{exact:true}),kind=page.getByLabel('연결 유형',{exact:true});
  const current=async()=>await page.evaluate(()=>(window as any).__duplicateEdgeQA.buffer.graph) as MethodologyGraph;
  const original=await page.evaluate(()=>(window as any).__duplicateEdgeQA.original);
  await expect(selection).toBeVisible();assert.deepEqual(await current(),graph);assert.deepEqual(original.graph,graph);
  assert.deepEqual(await selection.locator('option').allTextContents(),['E: A → B','E: A → C','UNIQUE: C → D']);
  await selection.selectOption({index:1});await expect(reason).toHaveValue('둘째 원문');
  await reason.fill('둘째만 편집');await page.getByLabel('연결 출발 단계',{exact:true}).selectOption('B');await page.getByLabel('연결 도착 단계',{exact:true}).selectOption('A');
  const edited=structuredClone(graph);edited.edges[1]={...edited.edges[1]!,reason:'둘째만 편집',fromNodeId:'B',toNodeId:'A'};assert.deepEqual(await current(),edited);
  await kind.selectOption('REWORK');edited.edges[1]!.kind='REWORK';edited.edges[1]!.retryPolicy={maxAttempts:3,counting:'SAME_FAILURE_FINGERPRINT',onExhausted:'USER_DECISION'};assert.deepEqual(await current(),edited);
  await page.getByLabel('같은 실패의 최대 재작업 횟수',{exact:true}).fill('7');edited.edges[1]!.retryPolicy!.maxAttempts=7;assert.deepEqual(await current(),edited);
  await kind.selectOption('SEQUENCE');edited.edges[1]!.kind='SEQUENCE';delete edited.edges[1]!.retryPolicy;assert.deepEqual(await current(),edited);
  await page.getByLabel('연결 조건 형식',{exact:true}).selectOption('COMPARE');await page.getByLabel('연결 조건 판단 단계',{exact:true}).selectOption('C');await page.getByLabel('연결 조건 판단 필드',{exact:true}).selectOption('USER_DECISION');await page.getByLabel('연결 조건 비교 방식',{exact:true}).selectOption('NE');await page.getByLabel('연결 조건 비교 값',{exact:true}).fill('계속 판단');
  edited.edges[1]!.condition={fieldRef:{nodeId:'C',field:'USER_DECISION'},operator:'NE',value:'계속 판단'};assert.deepEqual(await current(),edited);
  const remove=page.getByRole('button',{name:'이 초안의 연결 제거',exact:true});let prompt='';page.once('dialog',async d=>{prompt=d.message();await d.dismiss();});await remove.click();assert.match(prompt,/선택 연결만/);assert.deepEqual(await current(),edited);
  page.once('dialog',d=>d.accept());await remove.click();const remaining={...graph,edges:[graph.edges[0]!,graph.edges[2]!]};assert.deepEqual(await current(),remaining);await expect(reason).toHaveValue('다른 연결 원문');
  // 마지막 선택 삭제 후 남은 유효 위치와 빈 배열을 확인한다.
  page.once('dialog',d=>d.accept());await remove.click();assert.deepEqual(await current(),{...graph,edges:[graph.edges[0]!]});await expect(reason).toHaveValue('첫째 원문');page.once('dialog',d=>d.accept());await remove.click();assert.deepEqual(await current(),{...graph,edges:[]});await expect(selection).toHaveCount(0);await expect(reason).toHaveCount(0);
  // 빈 배열 및 고유 ID에서도 추가한 마지막 연결이 선택되고 기존 항목은 그대로다.
  const add=page.getByRole('button',{name:'단계 연결 추가',exact:true});await add.click();let added=await current();assert.equal(added.edges.length,1);assert.match(added.edges[0]!.edgeId,/^E-/);await reason.fill('새 연결');await add.click();added=await current();assert.equal(added.edges.length,2);assert.equal(added.edges[0]!.reason,'새 연결');assert.notEqual(added.edges[0]!.edgeId,added.edges[1]!.edgeId);await expect(reason).toHaveValue('');await reason.fill('추가한 둘째');assert.equal((await current()).edges[0]!.reason,'새 연결');assert.equal((await current()).edges[1]!.reason,'추가한 둘째');
  await selection.selectOption({index:0});await expect(reason).toHaveValue('새 연결');await reason.fill('고유 첫째 수정');assert.equal((await current()).edges[1]!.reason,'추가한 둘째');
  const finalBuffer=await page.evaluate(()=>(window as any).__duplicateEdgeQA.buffer);assert.deepEqual({...finalBuffer,graph:original.graph},original);assert.deepEqual(await page.evaluate(()=>(window as any).__duplicateEdgeQA.original),original);assert.deepEqual(seed.graph,graph);assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 }finally{await context.close();}
});
