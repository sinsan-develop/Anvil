import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import type {PoolClient} from 'pg';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {authorizeMaterial,materialRules,type ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {policyEditorOperations,type PolicyEditorProfile} from '../../../apps/web/src/features/connections/policy-editor-profile.ts';
import * as policyApi from '../../../apps/web/src/features/connections/candidate-policy-api.ts';

const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const session={user:{id:uid},clientId:uid,csrfToken:'C'.repeat(43)},expiry='2099-01-01T00:00:00.000Z';
const additions=[['defineSourceContentPolicy','소스 내용 정책 관리 저장'],['readSourceContentPolicyManagementOrigin','소스 내용 정책 관리 출처 내부 조회']] as const;
const ops=additions.map(([op])=>op),hash=(v:unknown)=>contentHash(canonicalJson(v));
const preserved={ruleId:'KEEP',subjectRef:{kind:'HUMAN',userId:uid},operations:['registerConnection'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'DENY',limitPolicyRef:null,expiresAt:expiry};
function policy(rules:Record<string,any>[]){const body={rules,reason:'기존 정책 보존',reviewRefs:[]};return {...body,ref:{id,version:1,contentHash:hash(body)},createdAt:'2026-11-20T00:00:00.000Z'};}
function fixture(){
 let stored=policy([preserved]);const calls:{url:string;method:string;body:any}[]=[];
 const client=new ApiClient(async(url,init)=>{
  const method=init?.method??'GET';calls.push({url:String(url),method,body:init?.body?JSON.parse(String(init.body)):null});
  if(String(url).endsWith('/permission-policy'))return Response.json({configured:true,policy:stored});
  if(String(url)===`/api/v1/projects/${pid}`)return Response.json({id:pid,participation:'OWNER',controlState:{status:'HELD',actorId:uid,clientId:uid,generation:2}});
  assert.equal(method,'POST');assert.equal(String(url),`/api/v1/projects/${pid}/commands`);
  const command=JSON.parse(String(init?.body));assert.equal(command.operation,'savePermissionPolicy');
  stored={...command.payload,ref:{id,version:command.expectedVersion+1,contentHash:hash(command.payload)},createdAt:'2026-11-20T00:00:00.000Z'};
  return Response.json({operationId:id,commandId:command.commandId,projectId:pid,status:'APPLIED',targetId:id,version:stored.ref.version,data:{status:'POLICY_SAVED',ref:stored.ref},serverReceivedAt:stored.createdAt});
 });
 return {client,calls,buffer:policyApi.newCandidatePolicyBuffer(pid,session,2,stored,'PROJECT_MATERIAL')};
}

test('고정 기존 표에서 PROJECT_MATERIAL 두 목적만 추가, 모든 다른 프로필·기본값 불변',async()=>{
 const raw=execFileSync('git',['show','3820600d:apps/web/src/features/connections/policy-editor-profile.ts'],{encoding:'utf8'});
 const before=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(raw)).toString('base64'));
 const expected=before.policyEditorOperations;
 assert.deepEqual(policyEditorOperations.PROJECT_MATERIAL.filter(([op])=>ops.includes(op as typeof ops[number])),additions);
 assert.deepEqual(policyEditorOperations.PROJECT_MATERIAL.filter(([op])=>!ops.includes(op as typeof ops[number])),expected.PROJECT_MATERIAL);
 for(const profile of Object.keys(policyEditorOperations) as PolicyEditorProfile[]){
  if(profile!=='PROJECT_MATERIAL')assert.deepEqual(policyEditorOperations[profile],expected[profile]);
  const b=policyApi.newCandidatePolicyBuffer(pid,session,2,null,profile);
  assert.deepEqual(b.draft.operations,[]);assert.equal(b.draft.disposition,'DENY');assert.equal(b.draft.acknowledged,false);assert.equal(b.pending,null);
 }
});

test('명시 두 목적×세 처리는 같은 PROJECT/HUMAN/null 한도로 round-trip, 준비 POST0',async()=>{
 for(const operation of ops)for(const disposition of ['AUTO','DENY','REQUIRE_APPROVAL'] as const){
  const f=fixture(),b=f.buffer;b.draft={...b.draft,operations:[operation],disposition,expiresAt:expiry,reason:'선택 목적만',acknowledged:true};
  const next=await policyApi.prepareCandidatePolicy(f.client,b,session),rules=(next.pending!.payload as any).rules;
  assert.equal(f.calls.some(c=>c.method==='POST'),false);assert.deepEqual(rules[0],preserved);
  assert.deepEqual(rules[1],{ruleId:b.draft.ruleId,subjectRef:{kind:'HUMAN',userId:uid},operations:[operation],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition,limitPolicyRef:null,expiresAt:expiry});
  assert.deepEqual(materialRules(rules,pid,uid),rules);
  const result=await policyApi.sendCandidatePolicy(f.client,next,session,()=>true),loaded=await policyApi.readCandidatePermissionPolicy(f.client,pid);
  assert.deepEqual(loaded!.ref,result);assert.deepEqual(loaded!.rules,rules);assert.equal(f.calls.filter(c=>c.method==='POST').length,1);
  assert.equal(policyApi.editablePermissionRule(loaded!.rules[1]!,pid,uid,'PROJECT_MATERIAL'),true);
 }
});

test('다른 프로필·다른 주체·EXECUTION/LIMIT는 편집 불가, 관리 실행의 DENY/REQUIRE_APPROVAL은 계속 거절',async()=>{
 for(const operation of ops){
  for(const profile of Object.keys(policyEditorOperations) as PolicyEditorProfile[]){if(profile==='PROJECT_MATERIAL')continue;
   const f=fixture(),b=policyApi.newCandidatePolicyBuffer(pid,session,2,null,profile);b.draft={...b.draft,operations:[operation],disposition:'AUTO',expiresAt:expiry,reason:'범위 밖',acknowledged:true};
   await assert.rejects(policyApi.prepareCandidatePolicy(f.client,b,session));assert.equal(f.calls.length,0);
  }
  const rule={ruleId:'MANAGEMENT',subjectRef:{kind:'HUMAN',userId:uid},operations:[operation],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:expiry};
  for(const changed of [{...rule,subjectRef:{kind:'HUMAN',userId:id}},{...rule,targetScopes:[{kind:'EXECUTION',projectId:pid}]},{...rule,limitPolicyRef:{id,version:1,contentHash:'a'.repeat(64)}}])assert.equal(policyApi.editablePermissionRule(changed,pid,uid,'PROJECT_MATERIAL'),false);
  for(const disposition of ['AUTO','DENY','REQUIRE_APPROVAL']){
   const p=policy([{...rule,disposition}]),db={query:async()=>({rows:[{id,head_version:1,rules_json:p.rules,reason:p.reason,review_refs:[],content_hash:p.ref.contentHash,created_at:new Date(p.createdAt)}]})} as unknown as PoolClient;
   const command:ProjectCommand={schemaVersion:1,projectId:pid,commandId:id,clientId:uid,controlGeneration:2,operation,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}};
   const run=()=>authorizeMaterial(db,{actorId:uid,clientId:uid,serverOwner:false,credentialGeneration:1,reauthUntil:null},command);
   if(disposition==='AUTO')assert.equal((await run()).approvalRequired,false);else await assert.rejects(run(),/PROJECT_OPERATION_DENIED/);
  }
 }
});

test('기존 연결 화면의 실제 자료 정책 패널 SSR에 두 명시 옵션만 노출하며 렌더 요청·선택0',async()=>{
 const entry=fileURLToPath(new URL('../../../apps/web/src/features/connections/CandidatePolicyPanel.tsx',import.meta.url));
 const result:any=await build({configFile:false,envDir:false,publicDir:false,logLevel:'silent',define:{'process.env.NODE_ENV':JSON.stringify('development')},build:{write:false,minify:false,lib:{entry:'virtual:management-policy',name:'ManagementPolicyMemory',formats:['iife']},rolldownOptions:{output:{codeSplitting:false}}},plugins:[{name:'management-policy-memory',resolveId(id){if(id.endsWith('virtual:management-policy'))return '\0management-policy';},load(id){if(id==='\0management-policy')return `import * as React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {CandidatePolicyPanel} from ${JSON.stringify(entry)};export {React,renderToStaticMarkup,CandidatePolicyPanel};`;}}]});
 const chunk=(Array.isArray(result)?result[0]:result).output.find((v:any)=>v.type==='chunk');assert.ok(chunk);
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'MessageChannel'),OriginalChannel=globalThis.MessageChannel,channels:MessageChannel[]=[];
 class OwnedChannel extends OriginalChannel{constructor(){super();channels.push(this);}}
 Object.defineProperty(globalThis,'MessageChannel',{value:OwnedChannel,writable:true,configurable:true});
 try{
  const ui=new Function(chunk.code+';return ManagementPolicyMemory;')(),f=fixture();let changed=0;
  const html=ui.renderToStaticMarkup(ui.React.createElement(ui.CandidatePolicyPanel,{client:f.client,projectId:pid,session,buffer:f.buffer,profile:'PROJECT_MATERIAL',onChange:()=>{changed++;},onAuthenticationLost:()=>assert.fail('인증 변경0')}));
  for(const [,label] of additions)assert.ok(html.includes(`aria-label="자료 정책 행동: ${label}"`));
  assert.doesNotMatch(html,/<input[^>]* checked/);assert.equal(f.calls.length,0);assert.equal(changed,0);
  const parent=readFileSync(new URL('../../../apps/web/src/features/connections/ConnectionsPage.tsx',import.meta.url),'utf8');
  assert.match(parent,/<CandidatePolicyPanel profile="PROJECT_MATERIAL"[^\n]*buffer=\{materialPolicyBuffer\}/);
 }finally{for(const channel of channels){channel.port1.close();channel.port2.close();}if(descriptor)Object.defineProperty(globalThis,'MessageChannel',descriptor);else Reflect.deleteProperty(globalThis,'MessageChannel');}
});
