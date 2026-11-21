import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {contentHash,canonicalJson} from '../../../contracts/canonical.ts';
import {currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {readManagementOriginSchemaManifest} from '../../integration/FN03/source-content-management-origin-schema.ts';
import {buildSourceContentPolicySnapshotCandidate} from '../../../apps/server/modules/documents/source-content-policy-definition.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {createManagementOriginTc01Entry} from '../../../scripts/qa-fn03-source-content-management-origin-entry.ts';
import {createTc01LocalEntryInput} from '../../../scripts/qa-fn03-tc01-local-entry-input.ts';
// 실행하지 않는 공개 tracked Git 원 바이트만 fixture로 읽는다. 대상 파일/설치/OS 포트 없음.
function originals(){
 const cwd=fileURLToPath(new URL('../../../',import.meta.url)),git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:32*1024*1024});
 const tsv=git(['cat-file','blob','2a464044:'+currentProfile.manifest]),rows=readManagementOriginSchemaManifest(tsv);
 const paths=[currentProfile.manifest,currentProfile.legacy,currentProfile.forms,currentProfile.standard,currentProfile.methods,...rows.map(r=>r.path)],batch=git(['cat-file','--batch'],paths.map(p=>'2a464044:'+p).join('\n')+'\n');let cursor=0;
 const files=paths.map(path=>{const end=batch.indexOf(10,cursor),match=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(batch.subarray(cursor,end).toString('ascii'));assert(match);const start=end+1;cursor=start+Number(match[1]);assert.equal(batch[cursor++],10);return{path,bytes:Buffer.from(batch.subarray(start,cursor-1))};});assert.equal(cursor,batch.length);return{files,rows};
}
let cached:ReturnType<typeof originals>|undefined;
function fixture(){
 const originalsData=cached??=originals(),files=originalsData.files.map(r=>({path:r.path,bytes:Buffer.from(r.bytes)}));
 const attemptId='bc000000-0000-4000-8000-000000000001',approvalId='bc000000-0000-4000-8000-000000000002';
 const runtime={sourceHead:'a'.repeat(40),entry:'scripts/qa-fn03-source-content-management-origin-entry.ts',nodeSha256:currentProfile.nodeHash,sourceClosureSha256:'b'.repeat(64),packageLockSha256:'c'.repeat(64),installedDependenciesSha256:'d'.repeat(64)};
 const plan={schemaVersion:1,purpose:'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1',attemptId,sourceHead:runtime.sourceHead,issuedAt:1000,expiresAt:1801000,artifactRoot:'/tmp/fn03-tc01-'+attemptId,receiptRoot:'/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+attemptId,subnet:'172.18.0.16/28',runtime};
 const planRaw=JSON.stringify(plan),planHash=contentHash(planRaw),approval={schemaVersion:1,purpose:plan.purpose+'_RUN_APPROVAL',profile:plan.profile,decision:'ALLOW_ONE_RUN',approvalId,attemptId,planHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt},approvalRaw=JSON.stringify(approval),approvalHash=contentHash(approvalRaw);
 const packet={planRaw,planHash,approvalRaw,approvalHash};const binding={attemptId,approvalId,planHash,approvalHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt,artifactRoot:plan.artifactRoot,subnet:plan.subnet,purpose:plan.purpose,profile:plan.profile};
 const trace:string[]=[],entropyBuffers:Uint8Array[]=[];let wall=1001,mono=0;
 const hooks={entropy:()=>{},held:()=>{},current:()=>{}};
 // 원 preload 형태의 RAM 모형이다. 한글 path를 막는 실제 preload 성공으로 주장하지 않는다.
 const held={binding,runtime,sourceRoot:'/home/daon/anvil-fn03-tc01-'+attemptId+'-qa',files,assertCurrent(){trace.push('held');hooks.held();return undefined;},dispose(){trace.push('held-dispose');}};
 const ports={now:()=>wall,monotonic:()=>mono,assertCurrent(b:Readonly<Record<string,unknown>>,r:Readonly<Record<string,unknown>>){assert.deepEqual({...b},binding);assert.deepEqual({...r},runtime);hooks.current();},fillSyntheticEntropy(target:Uint8Array){trace.push('entropy');entropyBuffers.push(target);for(let i=0;i<target.length;i++)target[i]=(i*13+7)%256;hooks.entropy();}};
 return{held,ports,packet,plan,binding,trace,files,entropyBuffers,hooks,rows:originalsData.rows,setTime(w:number,m:number){wall=w;mono=m;}};
}
const zero=(f:ReturnType<typeof fixture>)=>assert(f.entropyBuffers.every(b=>b.every(x=>x===0)));
const cleared=(input:any)=>{assert(input.isolated.fixture.access.key.every((b:number)=>b===0));assert(input.isolated.historicalTsv.every((b:number)=>b===0));assert(input.isolated.legacyBytes.every((b:number)=>b===0));assert(Object.values(input.isolated.sources).every((b:any)=>b.every((x:number)=>x===0)));assert(input.sql.every((r:any)=>r.bytes.every((x:number)=>x===0)));};
test('원 132 SQL·한글3문서·명시 RAM 자격을 기존 실제 entry 검산까지 전달, 소비 후 소거',async()=>{
 const f=fixture(),factory=createTc01LocalEntryInput(f.ports);assert.equal(f.trace.length,0);let captured:any,entryCurrent=0,other=0;
 const real=createManagementOriginTc01Entry({now:()=>1001,monotonic:()=>0,assertCurrent(){entryCurrent++;throw Error('RAM_STOP_BEFORE_EFFECT');},assertPreparedRuntime(){other++;},consume:async()=>{other++;},command(){other++;throw Error('NO_IO');},wait:async()=>{other++;},openPool:async()=>{other++;throw Error('NO_POOL');},closePool:async()=>{other++;},prepareArtifactRoot:async()=>{other++;}});
 await factory.withInput(f.held,f.packet,async input=>{
  captured=input;assert.equal(input.sql.length,132);assert.deepEqual(input.sql.map(r=>({id:r.id,path:r.path,bytes:r.bytes.length,sha256:contentHash(r.bytes)})),f.rows);assert.deepEqual(input.packet,f.packet);
  const forms=buildOfficialForms(Buffer.from(input.isolated.sources.forms),Buffer.from(input.isolated.sources.standard)),method=buildBuiltinMethodologies(Buffer.from(input.isolated.sources.methods),forms.forms).find(m=>m.systemCode==='SYS-M01')!;forms.standard.body.fill(0);
  assert.deepEqual(input.isolated.fixture.methodologyRef,{id:method.id,version:method.version,contentHash:method.contentHash});assert.equal(method.version,2);
  const v=input.isolated.fixture;assert.match(v.actorId,/^[a-f0-9-]{14}4[a-f0-9-]{4}[89ab]/);assert.equal(v.credentialGeneration,1);assert.equal(new Set(Object.values(v.ids as object)).size,7);assert.equal(v.origin,'https://anvil.invalid');assert.equal(v.policyExpiresAt,new Date(301001).toISOString());
  const payload=buildSourceContentPolicySnapshotCandidate(v.managementPayload,{projectId:f.binding.attemptId,actorId:v.actorId,sequence:1,recordedAt:new Date(1001).toISOString()});assert.equal(payload.executionAuthorized,false);assert.deepEqual((payload.snapshot as Record<string,unknown>).allowedOperations,['requestSourceContentHash']);
  const result=await real.run(input);assert.equal(result.status,'STOPPED');assert.equal(result.authority,'NOT_ISSUED');
 });assert.equal(entryCurrent,1,'실제 entry가 132·packet·fixture 형상 후 원 current에 도달');assert.equal(other,0);assert.deepEqual(f.trace,['held','entropy','held']);assert.equal(JSON.stringify(factory),'{}');zero(f);cleared(captured);assert(f.files[0]!.bytes.some(b=>b!==0));
 await assert.rejects(factory.withInput(f.held,f.packet,async()=>{}),{message:'FN03_TC01_LOCAL_ENTRY_INPUT_UNKNOWN'});assert.deepEqual(f.trace,['held','entropy','held']);
 await assert.rejects(createTc01LocalEntryInput(f.ports).withInput(f.held,f.packet,async()=>{}));assert.equal(f.entropyBuffers.length,1);
});
test('고정 원본 누락/변조/중복은 entropy·소비 전에 거절, 대체 경로0',async()=>{
 for(const mode of ['missing','sql','tsv','legacy','forms','duplicate'] as const){const f=fixture();
  if(mode==='missing')f.held.files=f.files.filter(r=>r.path!==currentProfile.methods);
  else if(mode==='duplicate')f.held.files=[...f.files,f.files[0]!];
  else{const path=mode==='sql'?f.rows[131]!.path:mode==='tsv'?currentProfile.manifest:mode==='legacy'?currentProfile.legacy:currentProfile.forms;const b=f.files.find(r=>r.path===path)!.bytes;b[0]=b[0]!^1;}
  let called=0;await assert.rejects(createTc01LocalEntryInput(f.ports).withInput(f.held,f.packet,async()=>{called++;}),{message:'FN03_TC01_LOCAL_ENTRY_INPUT_UNKNOWN'});assert.equal(called,0);assert.equal(f.entropyBuffers.length,0);
 }
});
test('다른 packet/바인딩·만료·getter/Proxy·미공급 포트는 entropy0',async()=>{
 for(const mode of ['packet','binding','expiry','getter','proxy','ports'] as const){const f=fixture();let gets=0;
  if(mode==='packet')f.packet.approvalRaw+=' ';
  if(mode==='binding')f.binding.purpose='OTHER';
  if(mode==='expiry')f.setTime(f.plan.expiresAt,0);
  if(mode==='getter')Object.defineProperty(f.held,'files',{get(){gets++;throw Error('PRIVATE');},enumerable:true});
  if(mode==='proxy')f.held=new Proxy(f.held,{get(){gets++;throw Error('PRIVATE');}});
  let called=0;await assert.rejects(createTc01LocalEntryInput(mode==='ports'?{} as never:f.ports).withInput(f.held,f.packet,async()=>{called++;}),{message:'FN03_TC01_LOCAL_ENTRY_INPUT_UNKNOWN'});assert.equal(called,0);assert.equal(gets,0);assert.equal(f.entropyBuffers.length,0);
 }
});
test('entropy 불명/중복·취소·소비 예외는 재시도0·사본/seed 소거',async()=>{
 for(const mode of ['throw','repeat','false','expired','consumer'] as const){const f=fixture(),factory=createTc01LocalEntryInput(f.ports);let captured:any,called=0;
  if(mode==='throw')f.hooks.entropy=()=>{throw Error('PRIVATE_ENTROPY');};
  if(mode==='repeat')f.hooks.entropy=()=>{f.entropyBuffers[0]!.fill(0);};
  if(mode==='false'){const original=f.ports.fillSyntheticEntropy;f.ports.fillSyntheticEntropy=((b:Uint8Array)=>{original(b);return false;}) as never;}
  if(mode==='expired')f.hooks.entropy=()=>f.setTime(f.plan.expiresAt,0);
  await assert.rejects(factory.withInput(f.held,f.packet,async input=>{called++;captured=input;throw Error('PRIVATE_CONSUMER');}),{message:'FN03_TC01_LOCAL_ENTRY_INPUT_UNKNOWN'});assert.equal(called,mode==='consumer'?1:0);zero(f);if(captured)cleared(captured);
  const calls=f.trace.length;await assert.rejects(factory.withInput(f.held,f.packet,async()=>{}));assert.equal(f.trace.length,calls);
 }
});
test('입력 사본·원 packet은 entropy callback 변경과 분리, 원 held의 현재성 재검산 유지',async()=>{
 const f=fixture();f.hooks.entropy=()=>{f.packet.planRaw='changed';f.files.find(r=>r.path===currentProfile.forms)!.bytes.fill(0);};let captured:any;
 await createTc01LocalEntryInput(f.ports).withInput(f.held,f.packet,async input=>{captured=input;assert.notEqual(input.packet.planRaw,'changed');assert.equal(contentHash(input.isolated.sources.forms),'622ffc6db4ccc26ae07c785c91b114467019b21571b728a71dea05d206816b13');});cleared(captured);zero(f);
 const g=fixture();let checks=0;g.hooks.held=()=>{if(++checks===2)throw Error('PRIVATE_CHANGED');};let calls=0;await assert.rejects(createTc01LocalEntryInput(g.ports).withInput(g.held,g.packet,async()=>{calls++;}));assert.equal(calls,0);zero(g);
});
test('진행 중 dispose/늦은 반환·raw 반환은 성공으로 표출하지 않고 cleanup을 막지 않는다',async()=>{
 const f=fixture(),factory=createTc01LocalEntryInput(f.ports);let captured:any,closed=0;
 await assert.rejects(factory.withInput(f.held,f.packet,async input=>{captured=input;try{factory.dispose();}finally{closed++;}}));assert.equal(closed,1);cleared(captured);zero(f);
 const g=fixture();await assert.rejects(createTc01LocalEntryInput(g.ports).withInput(g.held,g.packet,(async (input:unknown)=>input) as never));zero(g);
 const h=fixture();await assert.rejects(createTc01LocalEntryInput(h.ports).withInput(h.held,h.packet,async()=>{h.setTime(1001,1800000);}));zero(h);
});
