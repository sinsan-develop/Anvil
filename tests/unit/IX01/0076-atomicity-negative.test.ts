import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {run0076AtomicityNegativeStage,current0076NegativeContract as contract,type NegativeStageInput,type NegativeStagePorts,type NegativeCommandObservation,type NegativeOwnedTarget} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';

function load(){
 const cwd=fileURLToPath(new URL('../../../',import.meta.url));
 const git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:16*1024*1024});
 const tsv=git(['cat-file','blob','HEAD:docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv']);
 const rows=readCurrentSchemaManifest(tsv),batch=git(['cat-file','--batch'],rows.map(r=>'HEAD:'+r.path).join('\n')+'\n');let cursor=0;
 const sql=rows.map(row=>{
  const end=batch.indexOf(10,cursor),head=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(batch.subarray(cursor,end).toString('ascii'));assert(head);
  const start=end+1;cursor=start+Number(head[1]);assert.equal(batch[cursor++],10);
  return{id:row.id,path:row.path,bytes:Buffer.from(batch.subarray(start,cursor-1))};
 });assert.equal(cursor,batch.length);return{tsv,rows,sql};
}
let cached:ReturnType<typeof load>|undefined;
const attemptId='b6000000-0000-4000-8000-000000000001',approvalId='b6000000-0000-4000-8000-000000000002';
const clone=<T>(v:T):T=>JSON.parse(canonicalJson(v));
function harness(mode=''){
 const data=cached??=load(),at=Date.parse('2026-11-24T00:00:00.000Z');let wall=at,mono=100,active=true;
 const graph={schemaVersion:1,sourceHead:'8'.repeat(40),files:contract.graphPaths.map(path=>{
  const bytes=readFileSync(new URL('../../../'+path,import.meta.url));return{path,bytes:bytes.length,sha256:contentHash(bytes)};
 })};
 const namespace={container:'anvil-ix01-0076-negative-'+attemptId.replaceAll('-',''),database:'ix01_0076_negative_'+attemptId.replaceAll('-',''),receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none'};
 const graphRaw=canonicalJson(graph);
 const plan={schemaVersion:1,purpose:contract.purpose,attemptId,sourceHead:graph.sourceHead,graphHash:contentHash(graphRaw),issuedAt:at,expiresAt:at+1800000,namespace,
  sourceManifestHash:contentHash(canonicalJson(data.rows)),sourceSha256:contract.sourceSha256,executionSha256:contract.executionSha256,sentinelSqlHash:contract.sentinelSqlHash,catalogSqlHash:contract.catalogSqlHash};
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw);
 const approval={schemaVersion:1,purpose:contract.purpose+'_APPROVAL',decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE',approvalId,attemptId,sourceHead:plan.sourceHead,planHash,graphHash:plan.graphHash,issuedAt:at,expiresAt:plan.expiresAt};
 const approvalRaw=canonicalJson(approval);
 const input:NegativeStageInput={planRaw,planHash,approvalRaw,approvalHash:contentHash(approvalRaw),graphRaw,historicalTsv:Buffer.from(data.tsv),sql:data.sql.map(r=>({...r,bytes:Buffer.from(r.bytes)}))};
 const trace:string[]=[],claims=new Set<string>(),ledger:{id:string;checksum:string}[]=[];
 const replaced=['connection_definition_capacity','native_preparation_capacity','quota_adopt_creation','quota_complete_before_source'].map((name,i)=>({name,oid:String(100+i),owner:'anvil_v3_migrator',definitionHash:contentHash(name+' original definition'),aclHash:contentHash(name+' original ACL')}));
 let target:NegativeOwnedTarget|undefined,sentinel:any=null,catalogReads=0,targetInstalls=0,installed=0,afterFailure=false,delivered:Buffer|undefined;
 const observation=(owner:Readonly<NegativeOwnedTarget>,sqlHash:string,kind:NegativeCommandObservation['kind']='SETTLED'):NegativeCommandObservation=>({scopeHash:contentHash(canonicalJson(owner)),sqlHash,kind,exitStatus:kind==='SETTLED'?0:kind==='DDL_REJECTED'?3:null,signal:null,sqlState:kind==='DDL_REJECTED'?'42723':null,statementEndLine:kind==='DDL_REJECTED'?2343:null});
 const currentCatalog=()=>{
  const value={schemaVersion:1,purpose:'IX01_0076_NEGATIVE_CATALOG',database:namespace.database,sessionUser:'anvil_v3_migrator',currentUser:'anvil_v3_migrator',tableCount:0,firstTable:false,lateFunction:false,lastTrigger:false,functionCount:sentinel?1:0,triggerCount:0,sentinel:clone(sentinel),replaced:clone(replaced),ledger:[...ledger].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};
  if(afterFailure){
   if(mode==='PARTIAL_TABLE'){value.tableCount=1;value.firstTable=true;}
   if(mode==='PARTIAL_FUNCTION'){value.functionCount=2;value.lateFunction=true;}
   if(mode==='PARTIAL_TRIGGER'){value.triggerCount=1;value.lastTrigger=true;}
   if(mode==='PARTIAL_ACL')value.replaced[0]!.aclHash=contentHash('changed ACL');
   if(mode==='PARTIAL_DEFINITION')value.replaced[0]!.definitionHash=contentHash('changed original definition');
   if(mode==='SENTINEL_REPLACED')value.sentinel.oid='999';
   if(mode==='WRONG_LEDGER')value.ledger.push({id:contract.sourceId,checksum:contract.sourceSha256});
  }
  return value;
 };
 const ports:NegativeStagePorts={
  now:()=>wall,monotonic:()=>mono,
  assertCurrent(binding,owned){assert.equal(binding.purpose,contract.purpose);assert.equal(binding.attemptId,attemptId);assert.deepEqual(binding.namespace,namespace);if(owned){assert(target);assert.deepEqual(owned,target);}if(!active)throw Error('현재 owner 상실');},
  async claim(binding){trace.push('CLAIM');if(claims.has(binding.attemptId))return'DUPLICATE';claims.add(binding.attemptId);return mode==='CLAIM_UNKNOWN'?'UNKNOWN':'CLAIMED';},
  async prepare(binding){trace.push('PREPARE');target={schemaVersion:1,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET',attemptId:binding.attemptId,sourceHead:binding.sourceHead,planHash:binding.planHash,graphHash:binding.graphHash,namespace:clone(binding.namespace),containerId:'c'.repeat(64)};return target;},
  async install(owner,raw,row,ms){
   assert(ms>0&&ms<=30000);assert.equal(contentHash(raw),row.sha256);assert.equal(raw.byteLength,row.bytes);trace.push('SQL:'+row.id);
   if(row.id!==contract.sourceId){assert.deepEqual(Buffer.from(raw),data.sql[installed]!.bytes);installed++;return observation(owner,row.sha256);}
   targetInstalls++;assert.equal(installed,106);assert.equal(ledger.length,106);assert(sentinel);assert.equal(catalogReads,2);
   delivered=Buffer.from(raw);assert.equal(row.sourceSha256,contract.sourceSha256);assert.equal(row.sha256,contract.executionSha256);
   assert.equal(row.transformation,'0076_MOVE_COMMIT_TO_END_V1');assert.match(delivered.toString('utf8'),/COMMIT;\n$/);
   assert.notDeepEqual(delivered,data.sql[106]!.bytes);afterFailure=true;
   if(mode==='THROW')throw Error('합성 DDL receiver 유실');
   if(mode==='LATE'){wall+=600001;mono+=600001;}
   if(mode==='OWNER_LOST')active=false;
   const observed=observation(owner,row.sha256,mode==='UNEXPECTED_SUCCESS'?'SETTLED':mode==='UNKNOWN'?'UNKNOWN':'DDL_REJECTED');
   if(mode==='WRONG_LINE')observed.statementEndLine=2344;
   if(mode==='WRONG_STATE')observed.sqlState='42710';
   if(mode==='CROSS_TARGET')observed.scopeHash='0'.repeat(64);
   if(mode==='CROSS_SQL')observed.sqlHash=contract.sourceSha256;
   return observed;
  },
  async appendLedger(owner,row,ms){assert(ms>0&&ms<=10000);assert.notEqual(row.id,contract.sourceId);assert.equal(installed,ledger.length+1);assert.equal(row.sha256,data.rows[ledger.length]!.sha256);trace.push('LEDGER:'+row.id);ledger.push({id:row.id,checksum:row.sha256});return observation(owner,contentHash("INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+row.id+"','"+row.sha256+"');"));},
  async sentinel(owner,sql,ms){assert.equal(sql,contract.sentinelSql);assert(ms>0&&ms<=10000);trace.push('SENTINEL');assert.equal(catalogReads,1);assert.equal(sentinel,null);
   if(mode==='SENTINEL_UNKNOWN')return observation(owner,contentHash(sql),'UNKNOWN');
   sentinel={signature:contract.signature,oid:'500',owner:'anvil_v3_migrator',sourceHash:contentHash('SELECT NULL::jsonb'),definitionHash:contentHash('private sentinel definition'),aclHash:contentHash('private sentinel ACL'),appExecute:false,publicExecute:false,securityDefiner:false,language:'sql',volatility:'v',config:['search_path=pg_catalog']};return observation(owner,contentHash(sql));},
  async catalog(owner,sql,ms){assert.equal(sql,contract.catalogSql);assert(ms>0&&ms<=10000);trace.push('CATALOG');catalogReads++;return{scopeHash:contentHash(canonicalJson(owner)),sqlHash:contentHash(sql),exitStatus:0,signal:null,raw:canonicalJson(currentCatalog())};},
 };
 return{data,input,plan,approval,graph,trace,ledger,ports,state:()=>({catalogReads,targetInstalls,installed,delivered}),advance:(ms:number)=>{wall+=ms;mono+=ms;}};
}

test('0076 negative stage는 실제 receiver 기본값이나 기존 성공 runner 권위를 만들지 않는다',async()=>{
 const result=await run0076AtomicityNegativeStage({} as any);
 assert.equal(result.status,'STOPPED');assert.equal(result.reason,'RECEIVER_UNAVAILABLE');
 assert.equal(result.runtimeVerified,false);assert.equal(result.executionAuthorized,false);
 assert.equal(contract.purpose,'IX01_0076_ATOMICITY_NEGATIVE_STAGE');
});

test('명시 negative stage는 실제 교정 bytes→마지막 함수 42723→catalog 동일·원장0을 합성 검산한다',async()=>{
 const h=harness(),result=await run0076AtomicityNegativeStage(h.input,h.ports);
 assert.equal(result.status,'OBSERVATIONS_MATCHED');assert.equal(result.reason,null);assert.equal(result.evidence,'SOURCE_STAGE_ONLY');assert.equal(result.runtimeVerified,false);
 assert.equal(result.priorInstalled,106);assert.equal(result.priorLedgered,106);assert.equal(result.expectedSqlState,'42723');assert.equal(result.statementEndLine,2343);
 assert.equal(result.catalogBeforeHash,result.catalogAfterHash);assert.equal(result.targetDispatched,true);
 assert.equal(h.state().targetInstalls,1);assert.equal(h.state().catalogReads,3);assert.equal(h.ledger.some(r=>r.id===contract.sourceId),false);
 assert.deepEqual(h.trace.slice(-5),['CATALOG','SENTINEL','CATALOG','SQL:'+contract.sourceId,'CATALOG']);
 assert.equal(contentHash(h.state().delivered!),contract.executionSha256);assert.equal(contentHash(h.data.sql[106]!.bytes),contract.sourceSha256);
 const again=await run0076AtomicityNegativeStage(h.input,h.ports);assert.equal(again.status,'STOPPED');assert.equal(again.reason,'CLAIM_UNCONFIRMED');assert.equal(h.state().targetInstalls,1);
});

test('각 원 객체·후기 함수/trigger·기존 ACL/정의·sentinel·원장 부분정착은 성공으로 바뀌지 않는다',async()=>{
 for(const mode of ['PARTIAL_TABLE','PARTIAL_FUNCTION','PARTIAL_TRIGGER','PARTIAL_ACL','PARTIAL_DEFINITION','SENTINEL_REPLACED','WRONG_LEDGER']){
  const h=harness(mode),result=await run0076AtomicityNegativeStage(h.input,h.ports);
  assert.equal(result.status,'STOPPED',mode);assert.equal(result.runtimeVerified,false);assert.equal(h.state().targetInstalls,1);assert.equal(h.state().catalogReads,3);
  assert.equal(h.ledger.some(r=>r.id===contract.sourceId),false);assert.equal(h.trace.filter(v=>v==='SQL:'+contract.sourceId).length,1);
 }
});

test('예상 DDL 성공/다른 오류·행/대상·SQL 또는 불명/늦음/owner 상실은 사후 probe·원장·재시도0이다',async()=>{
 for(const mode of ['UNEXPECTED_SUCCESS','WRONG_LINE','WRONG_STATE','CROSS_TARGET','CROSS_SQL','UNKNOWN','THROW','LATE','OWNER_LOST']){
  const h=harness(mode),result=await run0076AtomicityNegativeStage(h.input,h.ports);
  assert.equal(result.status,'STOPPED',mode);assert.equal(h.state().targetInstalls,1);assert.equal(h.state().catalogReads,2,mode);
  assert.equal(h.ledger.length,106);assert.equal(h.trace.at(-1),'SQL:'+contract.sourceId);assert.equal(result.catalogAfterHash,undefined);
 }
 const h=harness('SENTINEL_UNKNOWN');assert.equal((await run0076AtomicityNegativeStage(h.input,h.ports)).status,'STOPPED');assert.equal(h.state().targetInstalls,0);assert.equal(h.state().catalogReads,1);
});

test('새 목적/시도/graph/원·실행SHA/sentinel·probe 결박이 없으면 claim보다 먼저 효과0이다',async()=>{
 const changes=[
  (h:ReturnType<typeof harness>)=>{h.plan.purpose='IX01_CURRENT_TC01' as any;},
  (h:ReturnType<typeof harness>)=>{h.plan.attemptId='bad';},
  (h:ReturnType<typeof harness>)=>{(h.plan as Record<string,unknown>).sourceSha256=contract.executionSha256;},
  (h:ReturnType<typeof harness>)=>{(h.plan as Record<string,unknown>).executionSha256=contract.sourceSha256;},
  (h:ReturnType<typeof harness>)=>{h.plan.sentinelSqlHash='0'.repeat(64);},
  (h:ReturnType<typeof harness>)=>{h.plan.catalogSqlHash='0'.repeat(64);},
  (h:ReturnType<typeof harness>)=>{h.plan.namespace.container='anvil-ix01-current-tc01-pg-20261108-a14';},
  (h:ReturnType<typeof harness>)=>{h.graph.files.pop();},
 ];
 for(const change of changes){
  const h=harness();change(h);const graphRaw=canonicalJson(h.graph);h.plan.graphHash=contentHash(graphRaw);
  const planRaw=canonicalJson(h.plan),planHash=contentHash(planRaw),approvalRaw=canonicalJson({...h.approval,planHash,graphHash:h.plan.graphHash});
  const input={...h.input,graphRaw,planRaw,planHash,approvalRaw,approvalHash:contentHash(approvalRaw)};
  assert.equal((await run0076AtomicityNegativeStage(input,h.ports)).status,'STOPPED');assert.deepEqual(h.trace,[]);
 }
 const h=harness(),source=h.input.sql[106]!.bytes;source[0]=source[0]!^1;
 assert.equal((await run0076AtomicityNegativeStage(h.input,h.ports)).status,'STOPPED');assert.deepEqual(h.trace,[]);
});

test('입력 검산 뒤 await 중 원 source·배열을 바꿔도 처음 소유한 교정 실행만 전달한다',async()=>{
 const h=harness(),claim=h.ports.claim;let release!:()=>void;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 h.ports.claim=async b=>{await gate;return claim(b);};
 const pending=run0076AtomicityNegativeStage(h.input,h.ports);
 h.input.sql[106]!.bytes.fill(0);h.input.historicalTsv.fill(0);release();
 assert.equal((await pending).status,'OBSERVATIONS_MATCHED');assert.equal(contentHash(h.state().delivered!),contract.executionSha256);
});
