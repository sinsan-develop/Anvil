import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {current0076NegativeContract} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {
 current0076NegativeLinuxApprovalContract,use0076NegativeLinuxProtectedStageInput,verify0076NegativeLinuxApproval,
 type NegativeLinuxApprovalReadPorts,type NegativeLinuxApprovalSelection,
} from '../../../scripts/qa-ix01-0076-negative-linux-approval.ts';
import {load0076NegativeLinuxR9} from '../../../scripts/qa-ix01-0076-negative-linux-r9.ts';

const sourceRoot=new URL('../../../',import.meta.url);
const manifestPath='docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv';
const desiredDependencies=current0076NegativeLinuxApprovalContract.dependencyPaths;
const protectedSourcePaths=current0076NegativeLinuxApprovalContract.protectedSourcePaths;
const r9Bytes=new Uint8Array(Buffer.from(readFileSync(new URL(current0076NegativeContract.parserPath,sourceRoot),'utf8').replaceAll('\r\n','\n'),'utf8'));
const trackedDependencyBytes=desiredDependencies.map(path=>new Uint8Array(readFileSync(new URL(path,sourceRoot))));
const manifestBytes=new Uint8Array(Buffer.from(readFileSync(new URL(manifestPath,sourceRoot),'utf8').replaceAll('\r\n','\n'),'utf8'));
const manifestRows=readCurrentSchemaManifest(manifestBytes);
const sqlBytes=manifestRows.map(row=>new Uint8Array(readFileSync(new URL(row.path,sourceRoot))));

let sequence=80;
function fixture(patch:{plan?:Record<string,unknown>;approval?:Record<string,unknown>;graph?:Record<string,unknown>;sourceIndex?:number;sourceBytes?:Uint8Array;omitSourceIndex?:number;sqlIndex?:number;sqlBytes?:Uint8Array;now?:number;monotonic?:readonly number[];loseCurrent?:boolean;foreignCustody?:boolean;reply?:'PROXY'|'ACCESSOR';badGraphPath?:boolean;graphTotalOverflow?:boolean}={}){
 const attemptId='e7000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),sourceHead='a'.repeat(40),issuedAt=2_000_000,expiresAt=2_600_000;
 const graphDependencyBytes:Uint8Array[]=trackedDependencyBytes.map(value=>new Uint8Array(value)),dependencyBytes:Uint8Array[]=graphDependencyBytes.map(value=>new Uint8Array(value));
 if(patch.sourceIndex!==undefined)dependencyBytes[patch.sourceIndex]=patch.sourceBytes??new Uint8Array([0]);
 const graphSources=new Map<string,Uint8Array>();for(const path of current0076NegativeContract.graphPaths)graphSources.set(path,path===current0076NegativeContract.parserPath?r9Bytes:new Uint8Array(readFileSync(new URL(path,sourceRoot))));
 for(const [index,path] of desiredDependencies.entries())graphSources.set(path,graphDependencyBytes[index]!);
 let rows=[...graphSources].map(([path,bytes])=>({path,bytes:bytes.byteLength,sha256:contentHash(bytes)})).sort((a,b)=>a.path.localeCompare(b.path));
 if(patch.badGraphPath)rows=[{...rows[0]!,path:'/absolute/not-owned'},...rows.slice(1)].sort((a,b)=>a.path.localeCompare(b.path));
 if(patch.graphTotalOverflow)rows=[...rows,...Array.from({length:17},(_,index)=>({path:'zz-overflow-'+String(index).padStart(2,'0'),bytes:16777216,sha256:String((index%9)+1).repeat(64)}))].sort((a,b)=>a.path.localeCompare(b.path));
 const graph=Object.freeze({schemaVersion:1,sourceHead,files:Object.freeze(rows.map(Object.freeze)),...patch.graph}),graphRaw=canonicalJson(graph),graphHash=contentHash(graphRaw);
 const namespace=Object.freeze({container:'anvil-ix01-0076-negative-'+attemptId.replaceAll('-',''),database:'ix01_0076_negative_'+attemptId.replaceAll('-',''),receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none'});
 const plan=Object.freeze({schemaVersion:1,purpose:current0076NegativeContract.purpose,attemptId,sourceHead,graphHash,issuedAt,expiresAt,namespace,
  sourceManifestHash:contentHash(canonicalJson(manifestRows)),sourceSha256:current0076NegativeContract.sourceSha256,executionSha256:current0076NegativeContract.executionSha256,
  sentinelSqlHash:current0076NegativeContract.sentinelSqlHash,catalogSqlHash:current0076NegativeContract.catalogSqlHash,...patch.plan});
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw),approvalId='e7100000-0000-4000-8000-'+String(sequence).padStart(12,'0');
 const approval=Object.freeze({schemaVersion:1,purpose:current0076NegativeContract.purpose+'_APPROVAL',decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE',approvalId,attemptId,sourceHead,planHash,graphHash,issuedAt,expiresAt,...patch.approval});
 const approvalRaw=canonicalJson(approval),approvalHash=contentHash(approvalRaw);
 const selection=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_APPROVAL_SELECTION' as const,attemptId,sourceHead,planHash,approvalHash,graphHash}) satisfies NegativeLinuxApprovalSelection;
 const receipt=namespace.receipt,custody=Object.freeze(Object.create(null)),foreign=Object.freeze(Object.create(null));
 const paths=Object.freeze([receipt+'-plan.json',receipt+'-approval.json',receipt+'-graph.json',...protectedSourcePaths,manifestPath]);
 const payloads=[new Uint8Array(Buffer.from(planRaw)),new Uint8Array(Buffer.from(approvalRaw)),new Uint8Array(Buffer.from(graphRaw)),...dependencyBytes,new Uint8Array(r9Bytes),manifestBytes];
 const observations=Object.freeze(paths.map((path,index)=>Object.freeze({path,bytes:payloads[index]!,custody:patch.foreignCustody&&index===paths.length-1?foreign:custody,fileIdentity:Object.freeze(Object.create(null)),closed:true as const}))
  .filter((_,index)=>index!==patch.omitSourceIndex!+3));
 const deliveredSql:Uint8Array[]=sqlBytes.map(value=>new Uint8Array(value));if(patch.sqlIndex!==undefined)deliveredSql[patch.sqlIndex]=new Uint8Array(patch.sqlBytes??[0]);
 const sourceObservations=Object.freeze(manifestRows.map((row,index)=>Object.freeze({path:row.path,bytes:deliveredSql[index]!,custody,fileIdentity:Object.freeze(Object.create(null)),closed:true as const})));
 let reply:readonly typeof observations[number][]=observations;if(patch.reply==='PROXY')reply=new Proxy(observations,{});if(patch.reply==='ACCESSOR'){
  const accessor=[...observations] as typeof observations[number][];Object.defineProperty(accessor,'0',{get:()=>observations[0],enumerable:true,configurable:false});reply=Object.freeze(accessor);
 }
 let reads=0,current=0,mono=0,wall=patch.now??2_100_000,monoOffset=0;const recipient=Object.freeze(Object.create(null));
 const ports=Object.freeze({recipient,now(this:object){assert.equal(this,recipient);return wall;},monotonic(this:object){assert.equal(this,recipient);return patch.monotonic?.[mono++]??100+current+monoOffset;},
  assertCurrent(this:object,found:Readonly<NegativeLinuxApprovalSelection>){assert.equal(this,recipient);assert.equal(found,selection);current++;if(patch.loseCurrent&&current>1)throw Error('lost');},
  async read(this:object,found:readonly string[]){assert.equal(this,recipient);reads++;if(reads===1){assert.deepEqual(found,paths);return reply;}assert.deepEqual(found,manifestRows.map(row=>row.path));return sourceObservations;}}) satisfies NegativeLinuxApprovalReadPorts;
 return{selection,ports,paths,advance(ms:number){wall+=ms;monoOffset+=ms;},get reads(){return reads;},get current(){return current;}};
}

test('동일 보호 custody의 전체 local import closure·R9·고정 TSV·전체 130 SQL을 SOURCE_ONLY로 검산한다',async()=>{
 const h=fixture(),result=await verify0076NegativeLinuxApproval(h.selection,h.ports);
 assert.equal(h.reads,2);assert(h.current>=2);assert.equal(manifestRows.length,130);assert.deepEqual(result,{schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_APPROVAL_VERIFIED',attemptId:h.selection.attemptId,
  sourceHead:h.selection.sourceHead,planHash:h.selection.planHash,approvalHash:h.selection.approvalHash,graphHash:h.selection.graphHash,
  dependencyHashes:desiredDependencies.map((path,index)=>({path,bytes:trackedDependencyBytes[index]!.byteLength,sha256:contentHash(trackedDependencyBytes[index]!)})),
  evidence:'PROTECTED_READ_SOURCE_ONLY',runtimeVerified:false,executionAuthorized:false});
 let retained:any,retainedR9:Uint8Array|undefined;const count=await use0076NegativeLinuxProtectedStageInput(result,async(input,_fresh,protectedR9)=>{retained=input;retainedR9=protectedR9;assert.equal(contentHash(protectedR9),current0076NegativeContract.parserSourceSha256);assert.equal(input.planRaw.length>0,true);assert.equal(input.historicalTsv.byteLength,15807);assert.equal(input.sql.length,130);
  const loaded=await load0076NegativeLinuxR9(protectedR9,input);assert.deepEqual(loaded.legacy.daemonInfoArgs(),['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}']);return input.sql.length;});
 assert.equal(count,130);assert(retained.historicalTsv.every((value:number)=>value===0));assert(retained.sql.every((row:{bytes:Uint8Array})=>row.bytes.every(value=>value===0)));assert(retainedR9!.every(value=>value===0));
 await assert.rejects(use0076NegativeLinuxProtectedStageInput(result,async()=>0));
});

test('다른 목적·위조 selection·만료는 보호 read 전에 거절한다',async()=>{
 for(const mutate of [
  (s:Readonly<NegativeLinuxApprovalSelection>)=>Object.freeze({...s,purpose:'IX01_CURRENT_TC01'}),
  (s:Readonly<NegativeLinuxApprovalSelection>)=>Object.freeze({...s,planHash:'0'.repeat(64)}),
 ]){const h=fixture();await assert.rejects(verify0076NegativeLinuxApproval(mutate(h.selection) as NegativeLinuxApprovalSelection,h.ports));assert.equal(h.reads,0);}
 const expired=fixture({now:2_600_000});await assert.rejects(verify0076NegativeLinuxApproval(expired.selection,expired.ports));assert.equal(expired.reads,1);
});

test('approval 결박·graph source 바이트·동일 custody·후행 current가 다르면 fail closed다',async()=>{
 for(const [h,expectedReads] of [
  [fixture({approval:{decision:'ALLOW_ONE_RUN'}}),1],
  [fixture({sourceIndex:2,sourceBytes:new Uint8Array([9])}),1],
  [fixture({omitSourceIndex:desiredDependencies.indexOf('scripts/qa-ix01-0076-negative-linux-docker.ts')}),1],
  [fixture({sqlIndex:129,sqlBytes:new Uint8Array([9])}),2],
  [fixture({foreignCustody:true}),1],
  [fixture({loseCurrent:true}),1],
  [fixture({badGraphPath:true}),1],
  [fixture({graphTotalOverflow:true}),1],
 ] as const){
  await assert.rejects(verify0076NegativeLinuxApproval(h.selection,h.ports));assert.equal(h.reads,expectedReads);
 }
});

test('wall 정체 mono equality 만료와 reply Proxy/accessor를 승인 projection으로 읽지 않는다',async()=>{
 for(const h of [fixture({monotonic:[100,500100]}),fixture({reply:'PROXY'}),fixture({reply:'ACCESSOR'})]){
  await assert.rejects(verify0076NegativeLinuxApproval(h.selection,h.ports));assert.equal(h.reads,1);
 }
});

test('검증 뒤 원 기한이 만료되면 보호 input callback 0으로 projection을 단회 소진한다',async()=>{
 const h=fixture(),result=await verify0076NegativeLinuxApproval(h.selection,h.ports);h.advance(500_000);let callbacks=0;
 await assert.rejects(use0076NegativeLinuxProtectedStageInput(result,async()=>{callbacks++;return 0;}));assert.equal(callbacks,0);
 await assert.rejects(use0076NegativeLinuxProtectedStageInput(result,async()=>0));
});
