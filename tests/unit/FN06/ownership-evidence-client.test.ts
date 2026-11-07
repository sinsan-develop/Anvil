import assert from 'node:assert/strict';
import {test} from 'node:test';
const m=await import(new URL('../../../apps/connector/runtime/ownership-evidence-client.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(){
 const now=Date.now(),selection:Record<string,string>={};
 for(const k of ['installationId','projectId','executionId','userId','clientId','humanSessionId','rootId','runId','preparationId','authorizationReceiptId','policyId','registrationId','observerId'])selection[k]='70000000-0000-4000-8000-000000000001';
 for(const k of ['executionGeneration','controlGeneration','credentialGeneration','processGeneration','preparationVersion','authorizationReceiptVersion','policyVersion','registrationVersion','observerVersion'])selection[k]='1';
 for(const k of ['preparationHash','authorizationReceiptHash','policyHash','registrationHash','observerHash','publicKeyFingerprint','hostHash','workerHash'])selection[k]='a'.repeat(64);
 selection.issuedAt=new Date(now-1000).toISOString();selection.expiresAt=new Date(now+60000).toISOString();
 const profile=()=>({purpose:'OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY',selection:structuredClone(selection),policyDisposition:'AUTO',registrationScope:'REGISTRATION_STATUS_ONLY',grants:[],checkedAt:new Date().toISOString(),expiresAt:new Date(now+30000).toISOString(),processCreationAuthorized:false,preparationAuthorized:false,executionAuthorized:false,dispatchPerformed:false,missingEvidence:['AUTHENTICATED_NATIVE_CHANNEL','RETAINED_PROCESS_JOB_FACTORY','OBSERVATION_SIGNER']});
 return{selection,profile};
}
function read(selection:unknown,port:unknown=null,options:unknown={}){assert.equal(typeof m.readOwnershipEvidencePreparationSource,'function','읽기전용 준비client SOURCE가 필요하다');return m.readOwnershipEvidencePreparationSource(selection,port,options);}
const reject=(promise:Promise<unknown>)=>assert.rejects(promise,{message:'OWNERSHIP_EVIDENCE_CLIENT_SOURCE_UNAVAILABLE'});
test('동일원선택두번조회/최소기한/sourcefalse·기본미등록',async()=>{
 const f=fixture();let calls=0;const expected=structuredClone(f.selection),p1=f.profile(),p2=f.profile();p2.expiresAt=new Date(Date.now()+20000).toISOString();
 const result=await read(f.selection,async(s:any)=>{calls++;assert.deepEqual(s,expected);assert(Object.isFrozen(s));return calls===1?p1:p2;});
 assert.equal(calls,2);assert.equal(result.expiresAt,p2.expiresAt);assert.equal(result.purpose,'OWNERSHIP_EVIDENCE_PREPARATION_CLIENT_SOURCE_ONLY');assert.equal(result.serverAuthenticated,false);assert.equal(result.processCreationAuthorized,false);assert.equal(result.dispatchPerformed,false);assert(Object.isFrozen(result));
 await reject(read(f.selection));
});
test('입력검사/취소를port호출전에확인하고호출중원선택변경을고정',async()=>{
 const f=fixture();let calls=0;const port=async()=>{calls++;return f.profile();};
 await reject(read({...f.selection,extra:'bad'},port));const aborted=new AbortController();aborted.abort();await reject(read(f.selection,port,{signal:aborted.signal}));assert.equal(calls,0);
 const original=structuredClone(f.selection),p=f.profile();const result=await read(f.selection,async(s:any)=>{calls++;f.selection.projectId='changed';assert.deepEqual(s,original);return p;});assert.equal(result.selection.projectId,original.projectId);assert.equal(calls,2);
});
test('옛선택/권한승격/역행관측/미확인삭제·port오류를거절',async()=>{
 for(const mode of ['SELECTION','AUTHORITY','CLOCK','MISSING','THROW']){const f=fixture();let calls=0;const first=f.profile();first.checkedAt=new Date(Date.now()-100).toISOString();await reject(read(f.selection,async()=>{calls++;if(calls===1)return first;const p=f.profile();if(mode==='SELECTION')p.selection.processGeneration='2';if(mode==='AUTHORITY')p.dispatchPerformed=true;if(mode==='CLOCK')p.checkedAt=new Date(Date.now()-500).toISOString();if(mode==='MISSING')p.missingEvidence=[];if(mode==='THROW')throw Error('private detail');return p;}));assert.equal(calls,2);}
});
test('각읽기무응답/외부취소를유한거절하고늦은응답은다음호출을만들지않음',async()=>{
 for(const target of [1,2]){const f=fixture();let calls=0,finish!:(v:unknown)=>void;const work=read(f.selection,async()=>{calls++;return calls===target?new Promise(r=>{finish=r;}):f.profile();},{timeoutMs:25});
  await Promise.race([reject(work),new Promise((_,no)=>setTimeout(()=>no(Error('CLIENT_DID_NOT_SETTLE')),500))]);assert.equal(calls,target);finish(f.profile());await new Promise(r=>setTimeout(r,5));assert.equal(calls,target);
 }
 const f=fixture(),controller=new AbortController();let calls=0;const work=read(f.selection,()=>{calls++;controller.abort();return new Promise(()=>{});},{timeoutMs:100,signal:controller.signal});await reject(work);assert.equal(calls,1);
});
test('원기한을caller timeout으로연장하지않고첫응답의짧은기한을후속대기에유지',async()=>{
 const f=fixture();let calls=0;const p=f.profile();p.expiresAt=new Date(Date.now()+40).toISOString();
 await reject(read(f.selection,async()=>{calls++;if(calls===1)return p;return new Promise(()=>{});},{timeoutMs:1000}));assert.equal(calls,2);
 for(const timeoutMs of [0,10001,NaN]){let invoked=0;await reject(read(f.selection,async()=>{invoked++;return f.profile();},{timeoutMs}));assert.equal(invoked,0);}
});
