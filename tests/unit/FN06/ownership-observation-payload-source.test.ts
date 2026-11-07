import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
const m=await import(new URL('../../../apps/connector/runtime/ownership-observation-payload-source.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const now=Date.now(),request={protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',installationId:id(1),projectId:id(2),executionId:id(3),executionGeneration:1,registrationRef:ref(4),publicKeyFingerprint:'a'.repeat(64),observerRef:ref(5),anchorRef:ref(6),preparationRef:ref(7),requestRef:ref(8),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,nonce:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',requestedAt:new Date(now-100).toISOString(),expiresAt:new Date(now+9000).toISOString()};
 const processRef={runId:id(20),generation:1,jobId:id(21),pid:100,startTicks:'638960000000000001',executableHash:'c'.repeat(64)},facts={processRef,state:'PREPARED',everResumed:false,active:1,processes:[{pid:100,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false};
 return{request,processRef,facts,observedAt:new Date(now).toISOString()};
}
function build(f:ReturnType<typeof fixture>){assert.equal(typeof m.buildOwnershipObservationPayloadSource,'function');return m.buildOwnershipObservationPayloadSource(f.request,f.facts,f.processRef,f.observedAt);}
const reject=(f:ReturnType<typeof fixture>)=>assert.throws(()=>build(f),{message:'OWNERSHIP_OBSERVATION_PAYLOAD_SOURCE_UNAVAILABLE'});
test('기존domain+실NUL/불변JSON·독립hash와서명없는SOURCE결과',()=>{
 const f=fixture(),v=build(f),report=JSON.parse(v.reportJson),bytes=Buffer.from(v.unsignedBytesBase64,'base64'),prefix=Buffer.from('ANVIL_OWNERSHIP_OBSERVATION_V1\0','ascii');
 assert(bytes.subarray(0,prefix.length).equals(prefix));assert.equal(bytes[prefix.length-1],0);assert.equal(bytes.subarray(prefix.length).toString('utf8'),v.reportJson);
 const expected='{"active":1,"everResumed":false,"fileSandboxVerified":false,"killOnClose":false,"processRef":{"executableHash":"'+ 'c'.repeat(64)+'","generation":1,"jobId":"10000000-0000-4000-8000-000000000021","pid":100,"runId":"10000000-0000-4000-8000-000000000020","startTicks":"638960000000000001"},"processes":[{"executableHash":"'+ 'c'.repeat(64)+'","inJob":true,"pid":100,"startTicks":"638960000000000001"}],"state":"PREPARED"}';
 assert.equal(v.factsJson,expected);assert.equal(report.factsHash,createHash('sha256').update(expected).digest('hex'));
 assert.equal(v.purpose,'OWNERSHIP_OBSERVATION_PAYLOAD_SOURCE_ONLY');assert.equal(v.signature,null);
 for(const k of ['serverRequestAuthenticated','nativeFactsVerified','signingAuthorized','executionAuthorized','dispatchPerformed'])assert.equal(v[k],false);assert(Object.isFrozen(v));
 const before=v.reportJson;f.request.nonce='changed';f.facts.processes[0]!.pid=999;assert.equal(v.reportJson,before);assert.equal(JSON.parse(v.factsJson).processes[0].pid,100);
});
test('CURRENT는별도head/RUNNING이필수이며PREPARED를승격하지않음',()=>{
 const f=fixture();Object.assign(f.request,{phase:'CURRENT',expectedHeadRef:ref(9)});reject(f);
 f.facts.state='RUNNING';f.facts.everResumed=true;const v=build(f);assert.equal(JSON.parse(v.reportJson).phase,'CURRENT');assert.equal(v.nativeFactsVerified,false);
 const missing=fixture();Object.assign(missing.request,{phase:'CURRENT'});missing.facts.state='RUNNING';missing.facts.everResumed=true;reject(missing);
});
test('원process불일치·member/count·sandbox/권한추가와잘못된request거절',()=>{
 for(const mode of ['PROCESS','MEMBER','COUNT','SANDBOX','EXTRA','REQUEST']){const f=fixture();if(mode==='PROCESS')f.processRef={...f.processRef,pid:101};if(mode==='MEMBER')f.facts.processes[0]!.startTicks='638960000000000002';if(mode==='COUNT')f.facts.active=2;if(mode==='SANDBOX')f.facts.fileSandboxVerified=true;if(mode==='EXTRA')Object.assign(f.facts,{executionAuthorized:true});if(mode==='REQUEST')f.request.purpose='HOST_TRUST_REGISTRATION';reject(f);}
});
test('미래/이전관측·만료와원래10초상한초과거절',()=>{
 for(const mode of ['FUTURE','BEFORE','EXPIRED','TTL']){const f=fixture();if(mode==='FUTURE')f.observedAt=new Date(Date.now()+1000).toISOString();if(mode==='BEFORE')f.observedAt=new Date(Date.parse(f.request.requestedAt)-1).toISOString();if(mode==='EXPIRED')f.request.expiresAt=new Date(Date.now()-1).toISOString();if(mode==='TTL')f.request.expiresAt=new Date(Date.now()+11000).toISOString();reject(f);}
});
test('getter/array prototype iterator를소비하지않고data-only복사',()=>{
 const f=fixture();let called=0;const prototype=Object.create(Array.prototype);Object.defineProperty(prototype,Symbol.iterator,{get(){called++;throw Error('ITERATOR_EXECUTED');}});Object.setPrototypeOf(f.facts.processes,prototype);build(f);assert.equal(called,0);
 const g=fixture();Object.defineProperty(g.request,'nonce',{enumerable:true,get(){called++;return 'bad';}});reject(g);assert.equal(called,0);
});
