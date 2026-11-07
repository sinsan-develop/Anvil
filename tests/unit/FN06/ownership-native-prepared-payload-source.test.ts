import assert from 'node:assert/strict';
import {test} from 'node:test';
const m=await import(new URL('../../../apps/connector/runtime/ownership-native-prepared-payload-source.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const now=Date.now(),selection:Record<string,string>={};
 for(const k of ['installationId','projectId','executionId','userId','clientId','humanSessionId','rootId','runId','preparationId','authorizationReceiptId','policyId','registrationId','observerId'])selection[k]=id(1);
 Object.assign(selection,{installationId:id(1),projectId:id(2),executionId:id(3),registrationId:id(4),observerId:id(5),preparationId:id(7),runId:id(20)});
 for(const k of ['executionGeneration','controlGeneration','credentialGeneration','processGeneration','preparationVersion','authorizationReceiptVersion','policyVersion','registrationVersion','observerVersion'])selection[k]='1';
 for(const k of ['preparationHash','authorizationReceiptHash','policyHash','registrationHash','observerHash','publicKeyFingerprint','hostHash','workerHash'])selection[k]='a'.repeat(64);
 selection.workerHash='c'.repeat(64);selection.issuedAt=new Date(now-1000).toISOString();selection.expiresAt=new Date(now+60000).toISOString();
 const processRef={runId:id(20),generation:1,jobId:id(21),pid:100,startTicks:((BigInt(now-1)+11644473600000n)*10000n).toString(),executableHash:'c'.repeat(64)};
 const envelope={purpose:'NATIVE_PREPARED_FACTS_SOURCE_ONLY',selection,processRef,facts:{processRef,state:'PREPARED',everResumed:false,active:1,processes:[{pid:100,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false},observedAt:new Date(now).toISOString(),expiresAt:new Date(now+30000).toISOString(),nativeFactsVerified:false,serverRequestAuthenticated:false,signingAuthorized:false,preparationAuthorized:false,executionAuthorized:false,dispatchPerformed:false,signature:null};
 const request={protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',installationId:id(1),projectId:id(2),executionId:id(3),executionGeneration:1,registrationRef:ref(4),publicKeyFingerprint:'a'.repeat(64),observerRef:ref(5),anchorRef:ref(6),preparationRef:ref(7),requestRef:ref(8),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,nonce:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',requestedAt:new Date(now-100).toISOString(),expiresAt:new Date(now+9000).toISOString()};
 return{envelope,request};
}
function build(f:ReturnType<typeof fixture>,raw=JSON.stringify(f.envelope)){assert.equal(typeof m.buildOwnershipNativePreparedPayloadSource,'function');return m.buildOwnershipNativePreparedPayloadSource(f.request,raw);}
const reject=(f:ReturnType<typeof fixture>,raw?:string)=>assert.throws(()=>build(f,raw),{message:'OWNERSHIP_NATIVE_PREPARED_PAYLOAD_SOURCE_UNAVAILABLE'});
test('native후보원선택을request와대조해unsignedSOURCE로만소비',()=>{
 const f=fixture(),v=build(f),report=JSON.parse(v.reportJson);assert.equal(report.projectId,id(2));assert.equal(report.preparationRef.id,id(7));assert.equal(report.phase,'BOOTSTRAP_PREPARED');assert.equal(JSON.parse(v.factsJson).processRef.runId,id(20));
 assert.equal(v.signature,null);for(const k of ['serverRequestAuthenticated','nativeFactsVerified','signingAuthorized','executionAuthorized','dispatchPerformed'])assert.equal(v[k],false);
});
test('project/세대/fullref/worker정체성이다르면같은facts여도거절',()=>{
 for(const key of ['projectId','executionGeneration','registrationVersion','preparationHash','observerId','workerHash','runId']){const f=fixture();f.envelope.selection[key]=key.endsWith('Hash')?'b'.repeat(64):key.endsWith('Id')?id(99):'2';reject(f);}
 const process=fixture();process.envelope.processRef={...process.envelope.processRef,generation:2};reject(process);
 const fingerprint=fixture();fingerprint.request.publicKeyFingerprint='b'.repeat(64);reject(fingerprint);
});
test('PREPAREDsource는CURRENT/RUNNING보고로승격할수없고권위/서명추가거절',()=>{
 const current=fixture();Object.assign(current.request,{phase:'CURRENT',expectedHeadRef:ref(9)});current.envelope.facts.state='RUNNING';current.envelope.facts.everResumed=true;reject(current);
 for(const key of ['nativeFactsVerified','serverRequestAuthenticated','signingAuthorized','preparationAuthorized','executionAuthorized','dispatchPerformed']){const f=fixture();Object.assign(f.envelope,{[key]:true});reject(f);}
 const signed=fixture();Object.assign(signed.envelope,{signature:'not-allowed'});reject(signed);
});
test('두원기한/관측순서·정확wire/중복키/크기상한거절',()=>{
 for(const mode of ['FUTURE','EXPIRED','REQUEST_WIDER','SOURCE_WIDER','BEFORE_ISSUED']){const f=fixture();if(mode==='FUTURE')f.envelope.observedAt=new Date(Date.now()+1000).toISOString();if(mode==='EXPIRED')f.envelope.expiresAt=new Date(Date.now()-1).toISOString();if(mode==='REQUEST_WIDER')f.envelope.expiresAt=new Date(Date.now()+1000).toISOString();if(mode==='SOURCE_WIDER')f.envelope.expiresAt=new Date(Date.now()+90000).toISOString();if(mode==='BEFORE_ISSUED')f.envelope.selection.issuedAt=new Date(Date.now()+100).toISOString();reject(f);}
 const extra=fixture();Object.assign(extra.envelope,{extra:true});reject(extra);const duplicate=fixture();reject(duplicate,'{"purpose":"OTHER",'+JSON.stringify(duplicate.envelope).slice(1));reject(fixture(),' '.repeat(2*1024*1024+1));
});
test('request accessor를실행하지않고거절',()=>{
 const f=fixture();let called=0;Object.defineProperty(f.request,'nonce',{enumerable:true,get(){called++;return 'bad';}});reject(f);assert.equal(called,0);
});
test('native FILETIME 생성범위를보존',()=>{
 for(const ticks of ['1','2650467744000000000',((BigInt(Date.now()+60000)+11644473600000n)*10000n).toString(),((BigInt(Date.now()-60000)+11644473600000n)*10000n).toString()]){
  const f=fixture();f.envelope.processRef.startTicks=ticks;f.envelope.facts.processes[0]!.startTicks=ticks;reject(f);
 }
 const precise=fixture();const subMs=((BigInt(Date.parse(precise.envelope.observedAt))+11644473600000n)*10000n+9999n).toString();
 precise.envelope.processRef.startTicks=subMs;precise.envelope.facts.processes[0]!.startTicks=subMs;build(precise);
});
test('native uintPID계약을보존',()=>{const f=fixture();f.envelope.processRef.pid=4294967296;f.envelope.facts.processes[0]!.pid=4294967296;reject(f);});
test('native 단일root계약을보존',()=>{const f=fixture();f.envelope.facts.active=2;f.envelope.facts.processes.push({...f.envelope.facts.processes[0]!,pid:101});reject(f);});
