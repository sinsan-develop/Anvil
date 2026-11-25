import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {
 current0076NegativeContract,load0076NegativeFailureParser,run0076AtomicityNegativeStage,
 type NegativeOwnedTarget,type NegativeStageInput,
} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {
 create0076AtomicityNegativeReceiver,load0076NegativeReceiverGraph,type NegativeReceiverPorts,
} from '../../../scripts/qa-ix01-0076-atomicity-negative-receiver.ts';
import {
 create0076NegativeLinuxSchemaStage,
 type NegativeLinuxSchemaCommandPorts,type NegativeLinuxSchemaCommandRequest,type NegativeLinuxSchemaOwnerPorts,
} from '../../../scripts/qa-ix01-0076-negative-linux-schema-stage.ts';

const attemptId='12345678-1234-4123-8123-123456789abc';
const namespace=Object.freeze({container:'anvil-ix01-0076-negative-'+attemptId.replaceAll('-',''),database:'ix01_0076_negative_'+attemptId.replaceAll('-',''),
 receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none' as const});
const target=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET' as const,attemptId,sourceHead:'a'.repeat(40),planHash:'b'.repeat(64),
 graphHash:'c'.repeat(64),namespace,containerId:'d'.repeat(64)}) satisfies NegativeOwnedTarget;
const binding=Object.freeze({purpose:current0076NegativeContract.purpose,attemptId,sourceHead:target.sourceHead,planHash:target.planHash,approvalHash:'e'.repeat(64),
 approvalId:'87654321-4321-4321-8321-cba987654321',graphHash:target.graphHash,issuedAt:1_000,expiresAt:31_000,namespace});

async function harness(mode:'OK'|'UNKNOWN'|'PENDING'='OK'){
 let wall=2_000,mono=10,commands=0,currentCalls=0;const recipient=Object.freeze({}),requests:NegativeLinuxSchemaCommandRequest[]=[];
 let settleCommand:((value:Awaited<ReturnType<NegativeLinuxSchemaCommandPorts['execute']>>)=>void)|null=null;
 const owner:Object & NegativeLinuxSchemaOwnerPorts=Object.freeze({recipient,now(){return wall;},monotonic(){return mono;},assertCurrent(_binding:Parameters<NegativeLinuxSchemaOwnerPorts['assertCurrent']>[0],found:Parameters<NegativeLinuxSchemaOwnerPorts['assertCurrent']>[1]){currentCalls++;if(found!==null&&found!==target)throw Error('owner lost');},
  async claim(){return 'CLAIMED' as const;},async prepare(){return target;}});
 const command:NegativeLinuxSchemaCommandPorts=Object.freeze({recipient,async execute(request:NegativeLinuxSchemaCommandRequest){commands++;requests.push(request);
  assert.equal(request.database,namespace.database);assert.equal(request.role,'anvil_v3_migrator');assert.equal(request.purpose,'IX01_0076_NEGATIVE_LINUX_SCHEMA_COMMAND');
  if(mode==='UNKNOWN')return Object.freeze({kind:'UNKNOWN' as const});
  if(mode==='PENDING')return await new Promise<Awaited<ReturnType<NegativeLinuxSchemaCommandPorts['execute']>>>(resolve=>{settleCommand=resolve;});
  if(request.operation==='READ_CATALOG')return Object.freeze({kind:'ROWS' as const,status:0 as const,signal:null,raw:canonicalJson({ok:true})});
  return Object.freeze({kind:'SETTLED' as const,status:0 as const,signal:null});
 }});
 const ports=create0076NegativeLinuxSchemaStage(owner,command);
 ports.assertCurrent(binding,null);assert.equal(await ports.claim(binding),'CLAIMED');assert.equal(await ports.prepare(binding),target);ports.assertCurrent(binding,target);
 return{ports,requests,get commands(){return commands;},get currentCalls(){return currentCalls;},advance(ms:number){wall+=ms;mono+=ms;},settle(){settleCommand?.(Object.freeze({kind:'SETTLED',status:0,signal:null}));}};
}

test('base stage는 prior install, 원장, sentinel, catalog만 exact migrator 요청으로 연결하고 0076은 receiver에 남긴다',async()=>{
 const h=await harness();
 for(let index=0;index<106;index++){
  const id=String(index+1).padStart(4,'0')+'_prior_'+index,bytes=new TextEncoder().encode('SELECT '+index+';\n'),row=Object.freeze({id,path:'db/migrations/'+id+'.sql',bytes:bytes.length,sha256:contentHash(bytes)});
  assert.equal((await h.ports.install(target,bytes,row,5_000)).kind,'SETTLED');assert.equal((await h.ports.appendLedger(target,row,5_000)).kind,'SETTLED');
 }
 const pristine=await h.ports.catalog(target,current0076NegativeContract.catalogSql,5_000);assert.equal(pristine.raw,canonicalJson({ok:true}));
 const sentinel=await h.ports.sentinel(target,current0076NegativeContract.sentinelSql,5_000);assert.equal(sentinel.kind,'SETTLED');
 const catalog=await h.ports.catalog(target,current0076NegativeContract.catalogSql,5_000);assert.equal(catalog.raw,canonicalJson({ok:true}));
 const before=h.commands;
 const rejected=await h.ports.install(target,new Uint8Array(),Object.freeze({id:current0076NegativeContract.sourceId,path:'db/migrations/0076_native_first_receive.sql.pending',bytes:529020,
  sha256:current0076NegativeContract.executionSha256,sourceSha256:current0076NegativeContract.sourceSha256,sourceBytes:529020,transformation:'0076_MOVE_COMMIT_TO_END_V1'}),5_000);
 assert.equal(rejected.kind,'UNKNOWN');assert.equal(h.commands,before,'base는 0076 SQL을 실행하지 않는다');assert.equal(h.requests.filter(row=>row.operation==='INSTALL_PRIOR').length,106);
 assert.equal(h.requests.filter(row=>row.operation==='APPEND_LEDGER').length,106);assert(h.currentCalls>400);
});

test('command UNKNOWN, current 상실, 만료 뒤에는 후속 SQL이 없다',async()=>{
 const bytes=new TextEncoder().encode('SELECT 2;\n'),row=Object.freeze({id:'0002_second',path:'db/migrations/0002_second.sql',bytes:bytes.length,sha256:contentHash(bytes)}),h=await harness('UNKNOWN');
 assert.equal((await h.ports.install(target,bytes,row,5_000)).kind,'UNKNOWN');assert.equal(h.commands,1);
 assert.equal((await h.ports.appendLedger(target,row,5_000)).kind,'UNKNOWN');assert.equal(h.commands,1);
 const expired=await harness();expired.advance(30_000);
 assert.equal((await expired.ports.sentinel(target,current0076NegativeContract.sentinelSql,5_000)).kind,'UNKNOWN');assert.equal(expired.commands,0);
 await assert.rejects(expired.ports.catalog(target,current0076NegativeContract.catalogSql,5_000));assert.equal(expired.commands,0);
});

test('claim, prepare, SQL은 await 전 선점되고 경합 뒤 재시도나 후속 효과가 없다',async()=>{
 const deferred=<T>()=>{let resolve!:(value:T)=>void;return{promise:new Promise<T>(found=>{resolve=found;}),resolve};};
 {
  const gate=deferred<'CLAIMED'>(),recipient=Object.freeze({}),owner:NegativeLinuxSchemaOwnerPorts=Object.freeze({recipient,now(){return 2_000;},monotonic(){return 10;},assertCurrent(){},
   async claim(){return await gate.promise;},async prepare(){throw Error('must not prepare');}}),commands:NegativeLinuxSchemaCommandPorts=Object.freeze({recipient,async execute(){throw Error('must not execute');}}),ports=create0076NegativeLinuxSchemaStage(owner,commands);
  ports.assertCurrent(binding,null);const first=ports.claim(binding);assert.equal(await ports.claim(binding),'UNKNOWN');gate.resolve('CLAIMED');assert.equal(await first,'UNKNOWN');await assert.rejects(ports.prepare(binding));
 }
 {
  const gate=deferred<NegativeOwnedTarget>(),recipient=Object.freeze({}),owner:NegativeLinuxSchemaOwnerPorts=Object.freeze({recipient,now(){return 2_000;},monotonic(){return 10;},assertCurrent(){},
   async claim(){return'CLAIMED' as const;},async prepare(){return await gate.promise;}}),commands:NegativeLinuxSchemaCommandPorts=Object.freeze({recipient,async execute(){throw Error('must not execute');}}),ports=create0076NegativeLinuxSchemaStage(owner,commands);
  ports.assertCurrent(binding,null);assert.equal(await ports.claim(binding),'CLAIMED');const first=ports.prepare(binding);await assert.rejects(ports.prepare(binding));gate.resolve(target);await assert.rejects(first);
 }
 {
  const h=await harness('PENDING'),bytes=new TextEncoder().encode('SELECT 3;\n'),row=Object.freeze({id:'0003_third',path:'db/migrations/0003_third.sql',bytes:bytes.length,sha256:contentHash(bytes)});
  const first=h.ports.install(target,bytes,row,5_000);for(let index=0;index<10&&h.commands===0;index++)await Promise.resolve();assert.equal(h.commands,1);
  assert.equal((await h.ports.install(target,bytes,row,5_000)).kind,'UNKNOWN');h.settle();assert.equal((await first).kind,'UNKNOWN');
  assert.equal((await h.ports.appendLedger(target,row,5_000)).kind,'UNKNOWN');assert.equal(h.commands,1);
 }
});

test('실제 receiver와 negative stage 조립은 106+106, sentinel/catalog, 42723, 0076 원장0을 한 번만 관측한다',async()=>{
 const root=new URL('../../../',import.meta.url),source=(path:string)=>readFileSync(new URL(path,root)),receiverPath='scripts/qa-ix01-0076-atomicity-negative-receiver.ts',schemaPath='scripts/qa-ix01-0076-negative-linux-schema-stage.ts';
 const r9=Buffer.from(source(current0076NegativeContract.parserPath).toString('utf8').replaceAll('\r\n','\n'),'utf8'),parser=await load0076NegativeFailureParser(r9),receiverSource=source(receiverPath);
 const sourceHead='8'.repeat(40),stageAttempt='a7000000-0000-4000-8000-000000000001',approvalId='a7000000-0000-4000-8000-000000000002';
 const graphFiles=[...current0076NegativeContract.graphPaths,receiverPath,schemaPath].sort().map(path=>{const bytes=path===current0076NegativeContract.parserPath?r9:source(path);return{path,bytes:bytes.length,sha256:contentHash(bytes)};}),graphRaw=canonicalJson({schemaVersion:1,sourceHead,files:graphFiles});
 const graphCapability=load0076NegativeReceiverGraph(graphRaw,receiverSource),tsv=Buffer.from(source('docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv').toString('utf8').replaceAll('\r\n','\n'),'utf8');
 const rows=readCurrentSchemaManifest(tsv),sql=rows.map(found=>({id:found.id,path:found.path,bytes:source(found.path)})),stageNamespace=Object.freeze({container:'anvil-ix01-0076-negative-'+stageAttempt.replaceAll('-',''),database:'ix01_0076_negative_'+stageAttempt.replaceAll('-',''),receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+stageAttempt,network:'none' as const}),at=Date.parse('2026-11-25T00:00:00.000Z');
 const plan={schemaVersion:1,purpose:current0076NegativeContract.purpose,attemptId:stageAttempt,sourceHead,graphHash:contentHash(graphRaw),issuedAt:at,expiresAt:at+1_800_000,namespace:stageNamespace,
  sourceManifestHash:contentHash(canonicalJson(rows)),sourceSha256:current0076NegativeContract.sourceSha256,executionSha256:current0076NegativeContract.executionSha256,sentinelSqlHash:current0076NegativeContract.sentinelSqlHash,catalogSqlHash:current0076NegativeContract.catalogSqlHash};
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw),approvalRaw=canonicalJson({schemaVersion:1,purpose:current0076NegativeContract.purpose+'_APPROVAL',decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE',approvalId,attemptId:stageAttempt,sourceHead,planHash,graphHash:plan.graphHash,issuedAt:at,expiresAt:plan.expiresAt});
 const input:NegativeStageInput={planRaw,planHash,approvalRaw,approvalHash:contentHash(approvalRaw),graphRaw,historicalTsv:new Uint8Array(tsv),sql};
 const prepared=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET' as const,attemptId:stageAttempt,sourceHead,planHash,graphHash:plan.graphHash,namespace:stageNamespace,containerId:'f'.repeat(64)}),recipient=Object.freeze({});
 const ledger:{id:string;checksum:string}[]=[],operations:string[]=[];let sentinelValue:Record<string,unknown>|null=null,receiverCalls=0;
 const owner:NegativeLinuxSchemaOwnerPorts=Object.freeze({recipient,now(){return at;},monotonic(){return 100;},assertCurrent(){},async claim(){return'CLAIMED' as const;},async prepare(){return prepared;}});
 const replaced=['connection_definition_capacity','native_preparation_capacity','quota_adopt_creation','quota_complete_before_source'].map((name,index)=>({name,oid:String(100+index),owner:'anvil_v3_migrator',definitionHash:contentHash(name+' definition'),aclHash:contentHash(name+' ACL')}));
 const commands:NegativeLinuxSchemaCommandPorts=Object.freeze({recipient,async execute(request:NegativeLinuxSchemaCommandRequest){operations.push(request.operation);
  if(request.operation==='APPEND_LEDGER'){assert(request.row);ledger.push({id:request.row.id,checksum:request.row.sha256});return Object.freeze({kind:'SETTLED' as const,status:0 as const,signal:null});}
  if(request.operation==='CREATE_SENTINEL'){sentinelValue={signature:current0076NegativeContract.signature,oid:'500',owner:'anvil_v3_migrator',sourceHash:contentHash('SELECT NULL::jsonb'),definitionHash:contentHash('sentinel definition'),aclHash:contentHash('sentinel ACL'),appExecute:false,publicExecute:false,securityDefiner:false,language:'sql',volatility:'v',config:['search_path=pg_catalog']};return Object.freeze({kind:'SETTLED' as const,status:0 as const,signal:null});}
  if(request.operation==='READ_CATALOG'){const value={schemaVersion:1,purpose:'IX01_0076_NEGATIVE_CATALOG',database:stageNamespace.database,sessionUser:'anvil_v3_migrator',currentUser:'anvil_v3_migrator',tableCount:0,firstTable:false,lateFunction:false,lastTrigger:false,functionCount:sentinelValue?1:0,triggerCount:0,sentinel:sentinelValue,replaced,ledger:[...ledger].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};return Object.freeze({kind:'ROWS' as const,status:0 as const,signal:null,raw:canonicalJson(value)});}
  return Object.freeze({kind:'SETTLED' as const,status:0 as const,signal:null});
 }});
 const base=create0076NegativeLinuxSchemaStage(owner,commands),receiverRecipient=Object.freeze(Object.create(null)),receiver:NegativeReceiverPorts=Object.freeze({recipient:receiverRecipient,
  schedule(callback:()=>void,timeoutMs:number){const timer=setTimeout(callback,timeoutMs);return()=>clearTimeout(timer);},async execute(this:object,request:Parameters<NegativeReceiverPorts['execute']>[0]){receiverCalls++;assert.equal(this,receiverRecipient);assert.equal(contentHash(request.sql),current0076NegativeContract.executionSha256);return Object.freeze({kind:'DDL_FAILURE' as const,error:Object.freeze({status:3,signal:null,stderr:'psql:<stdin>:2343: ERROR:  42723: PRIVATE SQL discarded'})});}});
 const result=await run0076AtomicityNegativeStage(input,create0076AtomicityNegativeReceiver(graphCapability,parser,base,receiver));
 assert.equal(result.status,'OBSERVATIONS_MATCHED');assert.equal(result.priorInstalled,106);assert.equal(result.priorLedgered,106);assert.equal(receiverCalls,1);
 assert.equal(operations.filter(value=>value==='INSTALL_PRIOR').length,106);assert.equal(operations.filter(value=>value==='APPEND_LEDGER').length,106);assert.deepEqual(operations.slice(-4),['READ_CATALOG','CREATE_SENTINEL','READ_CATALOG','READ_CATALOG']);
 assert.equal(ledger.some(found=>found.id===current0076NegativeContract.sourceId),false);assert.equal(result.catalogBeforeHash,result.catalogAfterHash);assert.equal(result.expectedSqlState,'42723');assert.equal(result.statementEndLine,2343);
});
