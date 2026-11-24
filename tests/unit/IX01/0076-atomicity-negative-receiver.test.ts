import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {currentSchemaExecutionBaseline} from '../../integration/IX01/current-schema-installation.ts';
import {
 current0076NegativeContract as contract,load0076NegativeFailureParser,run0076AtomicityNegativeStage,
 type NegativeCommandObservation,type NegativeOwnedTarget,type NegativeStageInput,type NegativeStagePorts,
} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {
 create0076AtomicityNegativeReceiver,load0076NegativeReceiverGraph,
 type NegativeReceiverPorts,
} from '../../../scripts/qa-ix01-0076-atomicity-negative-receiver.ts';

const root=new URL('../../../',import.meta.url);
const receiverPath='scripts/qa-ix01-0076-atomicity-negative-receiver.ts';
const source=(path:string)=>readFileSync(new URL(path,root));
const original=source('db/migrations/0076_native_first_receive.sql.pending');
const commit=Buffer.from('COMMIT;\n','ascii'),commitOffset=384546;
assert.deepEqual(original.subarray(commitOffset,commitOffset+commit.length),commit);
const corrected=Buffer.concat([original.subarray(0,commitOffset),original.subarray(commitOffset+commit.length),commit]);
assert.equal(contentHash(original),contract.sourceSha256);assert.equal(contentHash(corrected),contract.executionSha256);
const row=currentSchemaExecutionBaseline({id:contract.sourceId,path:'db/migrations/0076_native_first_receive.sql.pending',sha256:contract.sourceSha256,bytes:original.length});
const r9Bytes=Buffer.from(source(contract.parserPath).toString('utf8').replaceAll('\r\n','\n'),'utf8');
const parserCapability=await load0076NegativeFailureParser(r9Bytes);
const receiverSource=source(receiverPath);
const sourceHead='8'.repeat(40),attemptId='d7000000-0000-4000-8000-000000000001',approvalId='d7000000-0000-4000-8000-000000000002';
const graphFiles=[...contract.graphPaths,receiverPath].sort().map(path=>{const bytes=path===contract.parserPath?r9Bytes:source(path);return{path,bytes:bytes.length,sha256:contentHash(bytes)};});
const graphRaw=canonicalJson({schemaVersion:1,sourceHead,files:graphFiles});
const graphCapability=load0076NegativeReceiverGraph(graphRaw,receiverSource);
const namespace=Object.freeze({container:'anvil-ix01-0076-negative-'+attemptId.replaceAll('-',''),database:'ix01_0076_negative_'+attemptId.replaceAll('-',''),receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none' as const});
const at=Date.parse('2026-11-25T00:00:00.000Z');

function observation(owner:Readonly<NegativeOwnedTarget>,sqlHash:string,kind:'SETTLED'|'UNKNOWN'='SETTLED'):NegativeCommandObservation{
 return Object.freeze({scopeHash:contentHash(canonicalJson(owner)),sqlHash,kind,exitStatus:kind==='SETTLED'?0:null,signal:null,sqlState:null,statementEndLine:null});
}
function isolated(mode:'DDL'|'SETTLED'|'UNKNOWN'|'THROW'|'LATE'|'PENDING'|'FORGED'|'SCHEDULE_THROW'|'SYNC_EXPIRE'|'VALIDATION_29900'|'VALIDATION_EXPIRE'|'CLOCK_REVERSE'|'AFTER_SCHEDULE_EXPIRE'|'BEFORE_EXECUTE_EXPIRE'|'RESULT_EQUAL'='DDL'){
 let wall=at,mono=100,receiverCalls=0,baseInstalls=0,clockReads=0,scheduleCalls=0,scheduledMs=0;const timers=new Set<()=>void>();
 const prepared={schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET' as const,attemptId,sourceHead,planHash:'9'.repeat(64),graphHash:contentHash(graphRaw),namespace:{...namespace},containerId:'b'.repeat(64)};
 const binding=Object.freeze({purpose:contract.purpose,attemptId,sourceHead,planHash:prepared.planHash,approvalHash:'a'.repeat(64),approvalId,graphHash:prepared.graphHash,issuedAt:at,expiresAt:at+30000,namespace});
 const target=Object.freeze({...prepared,namespace});
 const base:NegativeStagePorts={
  now:()=>{if(clockReads++===1){if(mode==='VALIDATION_29900'){wall+=29900;mono+=29900;}if(mode==='VALIDATION_EXPIRE'){wall+=30000;mono+=30000;}if(mode==='CLOCK_REVERSE'){wall-=1;mono-=1;}}return wall;},monotonic:()=>mono,assertCurrent(){},async claim(){return'CLAIMED';},async prepare(){return prepared;},
  async install(owner,_raw,installedRow){baseInstalls++;return observation(owner,installedRow.sha256);},
  async appendLedger(){throw Error('unused');},async sentinel(){throw Error('unused');},async catalog(){throw Error('unused');},
 };
 const recipient=Object.freeze(Object.create(null));
 const receiver:NegativeReceiverPorts={
  recipient,
  schedule(callback,ms){scheduleCalls++;scheduledMs=ms;assert(ms>0&&ms<=30000);if(mode==='SCHEDULE_THROW')throw Error('synthetic schedule unavailable');if(mode==='SYNC_EXPIRE')callback();if(mode==='AFTER_SCHEDULE_EXPIRE'){wall+=ms;mono+=ms;}if(mode==='BEFORE_EXECUTE_EXPIRE')queueMicrotask(()=>{wall+=ms;mono+=ms;});timers.add(callback);return()=>{timers.delete(callback);};},
  async execute(this:object,request,signal){receiverCalls++;assert.equal(this,recipient);assert.equal(signal.aborted,false);assert.equal(request.attemptId,attemptId);assert.equal(request.targetHash,contentHash(canonicalJson(target)));assert.equal(request.graphHash,contentHash(graphRaw));assert.equal(request.receiverSourceHash,contentHash(receiverSource));assert.equal(contentHash(request.sql),contract.executionSha256);
   if(mode==='PENDING')return new Promise(()=>{});if(mode==='THROW')throw Error('synthetic receiver unknown');if(mode==='LATE'){wall+=30001;mono+=30001;}if(mode==='RESULT_EQUAL'){wall+=request.timeoutMs;mono+=request.timeoutMs;}
   if(mode==='SETTLED')return Object.freeze({kind:'SETTLED'});if(mode==='UNKNOWN')return Object.freeze({kind:'UNKNOWN'});if(mode==='FORGED')return Object.freeze({kind:'DDL_REJECTED',sqlState:'42723',statementEndLine:2343}) as never;
   return Object.freeze({kind:'DDL_FAILURE',error:{status:3,signal:null,stderr:'psql:<stdin>:2343: ERROR:  42723: PRIVATE SQL discarded'}});
  },
 };
 const adapter=create0076AtomicityNegativeReceiver(graphCapability,parserCapability,base,receiver);
 adapter.assertCurrent(binding,null);const ownerPromise=adapter.prepare(binding);adapter.assertCurrent(binding,null);
 const connect=async()=>{assert.equal(await ownerPromise,prepared);adapter.assertCurrent(binding,target);};
 return{adapter,binding,target,connect,get receiverCalls(){return receiverCalls;},get baseInstalls(){return baseInstalls;},get scheduleCalls(){return scheduleCalls;},get scheduledMs(){return scheduledMs;},expire(){for(const callback of [...timers])callback();},get timers(){return timers;}};
}

test('adapter는 prepare owner가 아닌 실제 stage target 참조를 캡처하고 0076만 목적 receiver로 보낸다',async()=>{
 const h=isolated();await h.connect();
 const prior={id:'0001_prior',path:'db/migrations/0001_prior.sql',sha256:'1'.repeat(64),bytes:1};
 assert.equal((await h.adapter.install(h.target,new Uint8Array([1]),prior,1000)).kind,'SETTLED');assert.equal(h.baseInstalls,1);assert.equal(h.receiverCalls,0);
 const result=await h.adapter.install(h.target,corrected,row,30000);
 assert.deepEqual(result,{scopeHash:contentHash(canonicalJson(h.target)),sqlHash:contract.executionSha256,kind:'DDL_REJECTED',exitStatus:3,signal:null,sqlState:'42723',statementEndLine:2343});
 assert.equal(h.receiverCalls,1);assert.equal(h.timers.size,0);
 assert.equal((await h.adapter.install(h.target,corrected,row,30000)).kind,'UNKNOWN');assert.equal(h.receiverCalls,1);
});

test('cross target·원본 SQL·직접 위조 결과와 current 교체는 fail closed다',async()=>{
 for(const scenario of ['CROSS','ORIGINAL','FORGED'] as const){
  const h=isolated(scenario==='FORGED'?'FORGED':'DDL');await h.connect();
  if(scenario==='CROSS')assert.throws(()=>h.adapter.assertCurrent(h.binding,Object.freeze({...h.target,namespace:h.target.namespace})));
  else{const result=await h.adapter.install(h.target,scenario==='ORIGINAL'?original:corrected,row,30000);assert.equal(result.kind,'UNKNOWN');assert.equal(h.receiverCalls,scenario==='FORGED'?1:0);}
 }
});

test('timeout·throw·late·UNKNOWN은 retry나 사후 query 없이 UNKNOWN이다',async()=>{
 for(const mode of ['THROW','LATE','UNKNOWN'] as const){const h=isolated(mode);await h.connect();assert.equal((await h.adapter.install(h.target,corrected,row,30000)).kind,'UNKNOWN');assert.equal(h.receiverCalls,1);assert.equal((await h.adapter.install(h.target,corrected,row,30000)).kind,'UNKNOWN');assert.equal(h.receiverCalls,1);}
 const h=isolated('PENDING');await h.connect();const pending=h.adapter.install(h.target,corrected,row,30000);for(let i=0;i<20&&h.receiverCalls===0;i++)await Promise.resolve();assert.equal(h.receiverCalls,1);h.expire();assert.equal((await pending).kind,'UNKNOWN');assert.equal(h.timers.size,0);
 for(const mode of ['SCHEDULE_THROW','SYNC_EXPIRE'] as const){const blocked=isolated(mode);await blocked.connect();assert.equal((await blocked.adapter.install(blocked.target,corrected,row,30000)).kind,'UNKNOWN');assert.equal(blocked.receiverCalls,0,mode);}
});

test('원 install deadline은 검산 시간까지 포함하고 wall·monotonic equality와 역행을 만료로 닫는다',async()=>{
 const bounded=isolated('VALIDATION_29900');await bounded.connect();assert.equal((await bounded.adapter.install(bounded.target,corrected,row,30000)).kind,'DDL_REJECTED');assert.equal(bounded.scheduledMs,100);assert.equal(bounded.receiverCalls,1);
 for(const mode of ['VALIDATION_EXPIRE','CLOCK_REVERSE','AFTER_SCHEDULE_EXPIRE','BEFORE_EXECUTE_EXPIRE'] as const){const h=isolated(mode);await h.connect();assert.equal((await h.adapter.install(h.target,corrected,row,30000)).kind,'UNKNOWN',mode);assert.equal(h.receiverCalls,0,mode);assert.equal(h.scheduleCalls,mode==='VALIDATION_EXPIRE'||mode==='CLOCK_REVERSE'?0:1,mode);}
 const result=isolated('RESULT_EQUAL');await result.connect();assert.equal((await result.adapter.install(result.target,corrected,row,30000)).kind,'UNKNOWN');assert.equal(result.receiverCalls,1);assert.equal((await result.adapter.install(result.target,corrected,row,30000)).kind,'UNKNOWN');assert.equal(result.receiverCalls,1);
});

test('실제 negative stage 한 번은 106건을 base에 전달하고 0076만 receiver로 결박한다',async()=>{
 const tsv=Buffer.from(source('docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv').toString('utf8').replaceAll('\r\n','\n'),'utf8');
 const rows=readCurrentSchemaManifest(tsv),sql=rows.map(found=>({id:found.id,path:found.path,bytes:source(found.path)}));
 const plan={schemaVersion:1,purpose:contract.purpose,attemptId,sourceHead,graphHash:contentHash(graphRaw),issuedAt:at,expiresAt:at+1800000,namespace,
  sourceManifestHash:contentHash(canonicalJson(rows)),sourceSha256:contract.sourceSha256,executionSha256:contract.executionSha256,sentinelSqlHash:contract.sentinelSqlHash,catalogSqlHash:contract.catalogSqlHash};
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw),approval={schemaVersion:1,purpose:contract.purpose+'_APPROVAL',decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE',approvalId,attemptId,sourceHead,planHash,graphHash:plan.graphHash,issuedAt:at,expiresAt:plan.expiresAt},approvalRaw=canonicalJson(approval);
 const input:NegativeStageInput={planRaw,planHash,approvalRaw,approvalHash:contentHash(approvalRaw),graphRaw,historicalTsv:new Uint8Array(tsv),sql};
 let baseInstalls=0,receiverCalls=0,sentinelValue:Record<string,unknown>|null=null;const ledger:{id:string;checksum:string}[]=[];
 const replaced=['connection_definition_capacity','native_preparation_capacity','quota_adopt_creation','quota_complete_before_source'].map((name,i)=>({name,oid:String(100+i),owner:'anvil_v3_migrator',definitionHash:contentHash(name+' definition'),aclHash:contentHash(name+' ACL')}));
 const base:NegativeStagePorts={
  now:()=>at,monotonic:()=>100,assertCurrent(){},async claim(){return'CLAIMED';},
  async prepare(binding){return{schemaVersion:1,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET',attemptId:binding.attemptId,sourceHead:binding.sourceHead,planHash:binding.planHash,graphHash:binding.graphHash,namespace:{...binding.namespace},containerId:'c'.repeat(64)};},
  async install(owner,_bytes,installedRow){baseInstalls++;return observation(owner,installedRow.sha256);},
  async appendLedger(owner,ledgerRow){ledger.push({id:ledgerRow.id,checksum:ledgerRow.sha256});return observation(owner,contentHash("INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+ledgerRow.id+"','"+ledgerRow.sha256+"');"));},
  async sentinel(owner,statement){sentinelValue={signature:contract.signature,oid:'500',owner:'anvil_v3_migrator',sourceHash:contentHash('SELECT NULL::jsonb'),definitionHash:contentHash('sentinel definition'),aclHash:contentHash('sentinel ACL'),appExecute:false,publicExecute:false,securityDefiner:false,language:'sql',volatility:'v',config:['search_path=pg_catalog']};return observation(owner,contentHash(statement));},
  async catalog(owner,statement){const value={schemaVersion:1,purpose:'IX01_0076_NEGATIVE_CATALOG',database:namespace.database,sessionUser:'anvil_v3_migrator',currentUser:'anvil_v3_migrator',tableCount:0,firstTable:false,lateFunction:false,lastTrigger:false,functionCount:sentinelValue?1:0,triggerCount:0,sentinel:sentinelValue,replaced,ledger:[...ledger].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};return{scopeHash:contentHash(canonicalJson(owner)),sqlHash:contentHash(statement),exitStatus:0,signal:null,raw:canonicalJson(value)};},
 };
 const recipient=Object.freeze(Object.create(null));
 const receiver:NegativeReceiverPorts={recipient,schedule(callback){const id=setTimeout(callback,30000);return()=>clearTimeout(id);},async execute(this:object){receiverCalls++;assert.equal(this,recipient);return{kind:'DDL_FAILURE',error:{status:3,signal:null,stderr:'psql:<stdin>:2343: ERROR:  42723: PRIVATE SQL discarded'}};}};
 const result=await run0076AtomicityNegativeStage(input,create0076AtomicityNegativeReceiver(graphCapability,parserCapability,base,receiver));
 assert.equal(result.status,'OBSERVATIONS_MATCHED');assert.equal(result.priorInstalled,106);assert.equal(result.priorLedgered,106);assert.equal(baseInstalls,106);assert.equal(receiverCalls,1);assert.equal(ledger.some(found=>found.id===contract.sourceId),false);
});
