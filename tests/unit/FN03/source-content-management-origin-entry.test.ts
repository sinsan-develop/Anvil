import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {contentHash} from '../../../contracts/canonical.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {readManagementOriginSchemaManifest} from '../../integration/FN03/source-content-management-origin-schema.ts';
import {createManagementOriginEntry,createManagementOriginTc01Entry,managementOriginTc01EntryContract,managementOriginEntryContract,type ManagementOriginEntryInput,type ManagementOriginEntryPorts} from '../../../scripts/qa-fn03-source-content-management-origin-entry.ts';

const id=(n:number)=>`9c000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function load(){
 const cwd=fileURLToPath(new URL('../../../',import.meta.url)),git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:16*1024*1024}),blob=(path:string)=>git(['cat-file','blob','b0b55fe0:'+path]);
 const historicalTsv=blob(currentProfile.manifest),rows=readManagementOriginSchemaManifest(historicalTsv),batch=git(['cat-file','--batch'],rows.map(r=>'b0b55fe0:'+r.path).join('\n')+'\n');let cursor=0;
 const sql=rows.map(r=>{const end=batch.indexOf(10,cursor),m=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(batch.subarray(cursor,end).toString('ascii'));assert(m);const start=end+1;cursor=start+Number(m[1]);assert.equal(batch[cursor++],10);return{id:r.id,path:r.path,bytes:Buffer.from(batch.subarray(start,cursor-1))};});assert.equal(cursor,batch.length);
 const sources={forms:blob(currentProfile.forms),standard:blob(currentProfile.standard),methods:blob(currentProfile.methods)},forms=buildOfficialForms(sources.forms,sources.standard),method=buildBuiltinMethodologies(sources.methods,forms.forms)[0]!;
 return{historicalTsv,sql,sources,legacyBytes:blob(currentProfile.legacy),methodologyRef:{id:method.id,version:method.version,contentHash:method.contentHash}};
}
let cached:ReturnType<typeof load>|undefined;
function harness(fault='',integrated=false){
 const source=cached??=load(),at=Date.parse('2026-11-21T00:00:00Z'),trace:string[]=[];let time=at,mono=0;
 const runtime={sourceHead:'7'.repeat(40),entry:managementOriginEntryContract.entry,nodeSha256:currentProfile.nodeHash,sourceClosureSha256:'8'.repeat(64),packageLockSha256:'9'.repeat(64),installedDependenciesSha256:'a'.repeat(64)};
 const contract=integrated?managementOriginTc01EntryContract:managementOriginEntryContract;
 const plan={schemaVersion:1,purpose:contract.purpose,profile:contract.profile,attemptId:id(1),sourceHead:runtime.sourceHead,issuedAt:at,expiresAt:at+1800000,artifactRoot:integrated?'/tmp/fn03-tc01-'+id(1):resolve('/tmp/anvil-v3-fn03-management-'+id(1)),receiptRoot:'/home/daon/.local/share/anvil-v3-qa-receipts/'+(integrated?'fn03-tc01-':'fn03-management-')+id(1),subnet:'172.18.0.16/28',runtime};
 const planRaw=JSON.stringify(plan),planHash=contentHash(Buffer.from(planRaw)),approval={schemaVersion:1,purpose:plan.purpose+'_RUN_APPROVAL',profile:plan.profile,decision:'ALLOW_ONE_RUN',approvalId:id(2),attemptId:plan.attemptId,planHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt},approvalRaw=JSON.stringify(approval),approvalHash=contentHash(Buffer.from(approvalRaw));
 const binding={attemptId:plan.attemptId,approvalId:approval.approvalId,planHash,approvalHash,sourceHead:plan.sourceHead,issuedAt:at,expiresAt:plan.expiresAt,artifactRoot:plan.artifactRoot,subnet:plan.subnet,...(integrated?{purpose:contract.purpose,profile:contract.profile}:{})};
 const input:ManagementOriginEntryInput={packet:{planRaw,planHash,approvalRaw,approvalHash},isolated:{binding,receiptRoot:plan.receiptRoot,historicalTsv:source.historicalTsv,legacyBytes:source.legacyBytes,sources:source.sources,passwords:{bootstrap:'b'.repeat(64),app:'c'.repeat(64),migrator:'d'.repeat(64)},fixture:{artifactRoot:binding.artifactRoot,access:{installationId:id(3),key:Buffer.alloc(32,7)},origin:'https://anvil.invalid',actorId:id(4),loginName:'fn03-isolated-fixture',password:'Synthetic fixture only 123!',credentialGeneration:1,methodologyRef:source.methodologyRef,ids:{draftCommandId:id(6),createCommandId:id(7),policyCommandId:id(8),ruleId:id(9),managementCommandId:id(10),deniedCommandId:id(11),readCommandId:id(12)},policyExpiresAt:new Date(at+300000).toISOString(),managementPayload:{}}},sql:source.sql.map(f=>({...f,bytes:Buffer.from(f.bytes)}))};
 const expectedBinding={...binding};
 const ports:ManagementOriginEntryPorts={now:()=>time,monotonic:()=>mono,assertCurrent(b){assert.deepEqual(b,expectedBinding);trace.push('CURRENT');},assertPreparedRuntime(b,r){assert.deepEqual(b,expectedBinding);assert.deepEqual(r,runtime);trace.push('RUNTIME');if(fault==='runtime')throw Error('PRIVATE_RUNTIME');if(fault==='late-runtime')mono=1800000;if(fault==='swap')ports.command=()=>{throw Error('REPLACED');};},
  async consume(b){assert.deepEqual(b,expectedBinding);trace.push('CLAIM');if(fault==='claim')throw Error('PRIVATE_DUPLICATE');if(fault==='false-claim')return false as never;if(fault==='text-claim')return 'PRIVATE' as never;if(fault==='late-claim')mono=1800000;if(fault==='mutate-input'){input.isolated.binding.subnet='172.19.0.32/28';input.sql[0]!.bytes.fill(0);}},
  command(c){trace.push('COMMAND');assert.equal(c.file,'/usr/bin/docker');assert.equal(c.shell,false);assert.equal(c.maxBuffer,65536);assert(c.timeoutMs>0&&c.timeoutMs<=10000);assert.deepEqual(c.argv,['--config',plan.receiptRoot+'/docker-config','--host','unix:///var/run/docker.sock','info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}']);throw Error('PRIVATE_STOP_AFTER_FIRST_COMMAND');},
  async wait(){trace.push('WAIT');throw Error('UNEXPECTED');},async openPool(){trace.push('POOL');throw Error('UNEXPECTED');},async closePool(){trace.push('CLOSE');throw Error('UNEXPECTED');},async prepareArtifactRoot(){trace.push('ROOT');throw Error('UNEXPECTED');},
 };
 return{input,ports,trace,expire(){time=plan.expiresAt;},plan};
}

test('승인 packet이 없으면 원 runtime/자원 포트를 호출하지 않는다',async()=>{
 const calls:string[]=[];
 const ports=new Proxy({}, {get(_target,key){calls.push(String(key));throw Error('PRIVATE');}});
 const entry=createManagementOriginEntry(ports as never);
 assert.equal((await entry.run(undefined)).status,'STOPPED');
 assert.deepEqual(calls,[]);
});

test('실제 고정 132 bytes와 원 runtime→claim→첫 명령 연결, 불명 뒤 후속0',async()=>{
 const h=harness(),entry=createManagementOriginEntry(h.ports);assert.equal(h.trace.length,0);
 const result=await entry.run(h.input);assert.equal(result.status,'STOPPED');assert.equal(result.stage,'START');
 assert.deepEqual(h.trace.filter(v=>!['CURRENT','RUNTIME'].includes(v)),['CLAIM','COMMAND']);assert(h.trace.indexOf('RUNTIME')<h.trace.indexOf('CLAIM'));
 assert(!JSON.stringify(result).includes('PRIVATE'));const count=h.trace.length;assert.equal((await entry.run(h.input)).reason,'ATTEMPT_CONSUMED');assert.equal(h.trace.length,count);
 assert(h.input.isolated.fixture.access.key.every(n=>n===7));
});

test('서로 다른 승인/commit·구 목적·runtime 부재·오염 SQL은 효과 전 거절',async()=>{
 for(const fault of ['approval','head','purpose','runtime','sql']){
  const h=harness();
  if(fault==='approval')h.input.packet.approvalHash='f'.repeat(64);
  if(fault==='sql')h.input.sql[131]!.bytes[0]=h.input.sql[131]!.bytes[0]!^1;
  if(['head','purpose','runtime'].includes(fault)){
   const p=JSON.parse(h.input.packet.planRaw);if(fault==='head')p.runtime.sourceHead='0'.repeat(40);if(fault==='purpose')p.purpose='IX01_CURRENT_TC01';if(fault==='runtime')delete p.runtime.installedDependenciesSha256;
   h.input.packet.planRaw=JSON.stringify(p);h.input.packet.planHash=contentHash(Buffer.from(h.input.packet.planRaw));
  }
  assert.equal((await createManagementOriginEntry(h.ports).run(h.input)).stage,'ENTRY');assert.deepEqual(h.trace,[]);
 }
});

test('현재 runtime 미확인·기한·포트 교체는 claim과 Docker 전에 거절',async()=>{
 for(const fault of ['runtime','late-runtime','swap','expired']){
  const h=harness(fault);if(fault==='expired')h.expire();const result=await createManagementOriginEntry(h.ports).run(h.input);
  assert.equal(result.stage,'ENTRY');assert(!h.trace.includes('CLAIM'));assert(!h.trace.includes('COMMAND'));assert(!JSON.stringify(result).includes('PRIVATE'));
 }
});

test('배타 기록 중복/불명과 정착 뒤 기한 초과에는 첫 명령도0',async()=>{
 for(const fault of ['claim','late-claim','false-claim','text-claim']){
  const h=harness(fault),entry=createManagementOriginEntry(h.ports),result=await entry.run(h.input);
  assert.equal(result.stage,'CLAIM');assert.deepEqual(h.trace.filter(v=>!['CURRENT','RUNTIME'].includes(v)),['CLAIM']);
  const count=h.trace.length;await entry.run(h.input);assert.equal(h.trace.length,count);
 }
});

test('비동기 claim 뒤 caller 입력 변경은 소유 snapshot/원 132 bytes를 바꾸지 않는다',async()=>{
 const h=harness('mutate-input');const result=await createManagementOriginEntry(h.ports).run(h.input);
 assert.equal(result.stage,'START');assert.deepEqual(h.trace.filter(v=>!['CURRENT','RUNTIME'].includes(v)),['CLAIM','COMMAND']);
});


test('통합 entry는 별도 factory이며 legacy packet을 첫 포트 전에 거절한다',async()=>{
 const module=await import('../../../scripts/qa-fn03-source-content-management-origin-entry.ts');
 assert.equal(typeof module.createManagementOriginTc01Entry,'function');
 const h=harness();const r=await module.createManagementOriginTc01Entry(h.ports).run(h.input);
 assert.equal(r.status,'STOPPED');assert.equal(r.stage,'ENTRY');assert.deepEqual(h.trace,[]);
});


test('통합 exact packet→전용 namespace 첫 명령, 교차 purpose/profile/path/hash는 효과0',async()=>{
 const h=harness('',true);const result=await createManagementOriginTc01Entry(h.ports).run(h.input);
 assert.equal(result.stage,'START');assert.deepEqual(h.trace.filter(x=>!['CURRENT','RUNTIME'].includes(x)),['CLAIM','COMMAND']);
 for(const fault of ['legacy-factory','purpose','profile','root','receipt','entry','binding','approval-profile','plan-hash','approval-hash','root-parent','root-relative']){
  const x=harness('',true),plan=JSON.parse(x.input.packet.planRaw),approval=JSON.parse(x.input.packet.approvalRaw);
  if(fault==='purpose')plan.purpose=managementOriginEntryContract.purpose;
  if(fault==='profile')plan.profile=managementOriginEntryContract.profile;
  if(fault==='root')plan.artifactRoot=resolve('/tmp/anvil-v3-fn03-management-'+id(1));
  if(fault==='root-parent')plan.artifactRoot='/other/fn03-tc01-'+id(1);if(fault==='root-relative')plan.artifactRoot='tmp/fn03-tc01-'+id(1);
  if(fault==='receipt')plan.receiptRoot='/tmp/fn03-tc01-'+id(1);
  if(fault==='entry')plan.runtime.entry='scripts/other.ts';
  if(fault==='approval-profile')approval.profile=managementOriginEntryContract.profile;
  x.input.packet.planRaw=JSON.stringify(plan);x.input.packet.planHash=contentHash(Buffer.from(x.input.packet.planRaw));approval.planHash=x.input.packet.planHash;
  x.input.packet.approvalRaw=JSON.stringify(approval);x.input.packet.approvalHash=contentHash(Buffer.from(x.input.packet.approvalRaw));
  Object.assign(x.input.isolated.binding,{planHash:x.input.packet.planHash,approvalHash:x.input.packet.approvalHash,artifactRoot:plan.artifactRoot});
  x.input.isolated.receiptRoot=plan.receiptRoot;
  if(fault==='binding')x.input.isolated.binding.profile=managementOriginEntryContract.profile;
  if(fault==='plan-hash')x.input.packet.planHash='f'.repeat(64);if(fault==='approval-hash')x.input.packet.approvalHash='f'.repeat(64);
  const r=await (fault==='legacy-factory'?createManagementOriginEntry:createManagementOriginTc01Entry)(x.ports).run(x.input);
  assert.equal(r.stage,'ENTRY',fault);assert.deepEqual(x.trace,[],fault);
 }
});
