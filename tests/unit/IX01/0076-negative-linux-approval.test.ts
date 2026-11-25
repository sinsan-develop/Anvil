import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {current0076NegativeContract} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {
 current0076NegativeLinuxApprovalContract,verify0076NegativeLinuxApproval,
 type NegativeLinuxApprovalReadPorts,type NegativeLinuxApprovalSelection,
} from '../../../scripts/qa-ix01-0076-negative-linux-approval.ts';

let sequence=80;
function fixture(patch:{plan?:Record<string,unknown>;approval?:Record<string,unknown>;graph?:Record<string,unknown>;sourceIndex?:number;sourceBytes?:Uint8Array;now?:number;monotonic?:readonly number[];loseCurrent?:boolean;foreignCustody?:boolean;reply?:'PROXY'|'ACCESSOR';badGraphPath?:boolean;graphTotalOverflow?:boolean}={}){
 const attemptId='e7000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),sourceHead='a'.repeat(40),issuedAt=2_000_000,expiresAt=2_600_000;
 const graphDependencyBytes:Uint8Array[]=current0076NegativeLinuxApprovalContract.dependencyPaths.map((path,index)=>new Uint8Array(Buffer.from('dependency-'+index+'-'+path,'utf8'))),dependencyBytes:Uint8Array[]=graphDependencyBytes.map(value=>new Uint8Array(value));
 if(patch.sourceIndex!==undefined)dependencyBytes[patch.sourceIndex]=patch.sourceBytes??new Uint8Array([0]);
 let rows=[...current0076NegativeContract.graphPaths.map((path,index)=>({path,bytes:index+1,sha256:String(index+1).repeat(64).slice(0,64)})),
  ...current0076NegativeLinuxApprovalContract.dependencyPaths.map((path,index)=>({path,bytes:graphDependencyBytes[index]!.byteLength,sha256:contentHash(graphDependencyBytes[index]!)}))]
  .sort((a,b)=>a.path.localeCompare(b.path));
 if(patch.badGraphPath)rows=[{...rows[0]!,path:'/absolute/not-owned'},...rows.slice(1)].sort((a,b)=>a.path.localeCompare(b.path));
 if(patch.graphTotalOverflow)rows=[...rows,...Array.from({length:17},(_,index)=>({path:'zz-overflow-'+String(index).padStart(2,'0'),bytes:16777216,sha256:String((index%9)+1).repeat(64)}))].sort((a,b)=>a.path.localeCompare(b.path));
 const graph=Object.freeze({schemaVersion:1,sourceHead,files:Object.freeze(rows.map(Object.freeze)),...patch.graph}),graphRaw=canonicalJson(graph),graphHash=contentHash(graphRaw);
 const namespace=Object.freeze({container:'anvil-ix01-0076-negative-'+attemptId.replaceAll('-',''),database:'ix01_0076_negative_'+attemptId.replaceAll('-',''),receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none'});
 const plan=Object.freeze({schemaVersion:1,purpose:current0076NegativeContract.purpose,attemptId,sourceHead,graphHash,issuedAt,expiresAt,namespace,
  sourceManifestHash:'b'.repeat(64),sourceSha256:current0076NegativeContract.sourceSha256,executionSha256:current0076NegativeContract.executionSha256,
  sentinelSqlHash:current0076NegativeContract.sentinelSqlHash,catalogSqlHash:current0076NegativeContract.catalogSqlHash,...patch.plan});
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw),approvalId='e7100000-0000-4000-8000-'+String(sequence).padStart(12,'0');
 const approval=Object.freeze({schemaVersion:1,purpose:current0076NegativeContract.purpose+'_APPROVAL',decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE',approvalId,attemptId,sourceHead,planHash,graphHash,issuedAt,expiresAt,...patch.approval});
 const approvalRaw=canonicalJson(approval),approvalHash=contentHash(approvalRaw);
 const selection=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_APPROVAL_SELECTION' as const,attemptId,sourceHead,planHash,approvalHash,graphHash}) satisfies NegativeLinuxApprovalSelection;
 const receipt=namespace.receipt,custody=Object.freeze(Object.create(null)),foreign=Object.freeze(Object.create(null));
 const paths=Object.freeze([receipt+'-plan.json',receipt+'-approval.json',receipt+'-graph.json',...current0076NegativeLinuxApprovalContract.dependencyPaths]);
 const payloads=[new Uint8Array(Buffer.from(planRaw)),new Uint8Array(Buffer.from(approvalRaw)),new Uint8Array(Buffer.from(graphRaw)),...dependencyBytes];
 const observations=Object.freeze(paths.map((path,index)=>Object.freeze({path,bytes:payloads[index]!,custody:patch.foreignCustody&&index===paths.length-1?foreign:custody,fileIdentity:Object.freeze(Object.create(null)),closed:true as const})));
 let reply:readonly typeof observations[number][]=observations;if(patch.reply==='PROXY')reply=new Proxy(observations,{});if(patch.reply==='ACCESSOR'){
  const accessor=[...observations] as typeof observations[number][];Object.defineProperty(accessor,'0',{get:()=>observations[0],enumerable:true,configurable:false});reply=Object.freeze(accessor);
 }
 let reads=0,current=0,mono=0;const recipient=Object.freeze(Object.create(null));
 const ports=Object.freeze({recipient,now(this:object){assert.equal(this,recipient);return patch.now??2_100_000;},monotonic(this:object){assert.equal(this,recipient);return patch.monotonic?.[mono++]??100+current;},
  assertCurrent(this:object,found:Readonly<NegativeLinuxApprovalSelection>){assert.equal(this,recipient);assert.equal(found,selection);current++;if(patch.loseCurrent&&current>1)throw Error('lost');},
  async read(this:object,found:readonly string[]){assert.equal(this,recipient);assert.deepEqual(found,paths);reads++;return reply;}}) satisfies NegativeLinuxApprovalReadPorts;
 return{selection,ports,paths,get reads(){return reads;},get current(){return current;}};
}

test('동일 보호 read의 exact plan·approval·graph와 신규 의존 5개만 SOURCE_ONLY로 검산한다',async()=>{
 const h=fixture(),result=await verify0076NegativeLinuxApproval(h.selection,h.ports);
 assert.equal(h.reads,1);assert(h.current>=2);assert.deepEqual(result,{schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_APPROVAL_VERIFIED',attemptId:h.selection.attemptId,
  sourceHead:h.selection.sourceHead,planHash:h.selection.planHash,approvalHash:h.selection.approvalHash,graphHash:h.selection.graphHash,
  dependencyHashes:current0076NegativeLinuxApprovalContract.dependencyPaths.map((path,index)=>({path,bytes:Buffer.byteLength('dependency-'+index+'-'+path),sha256:contentHash(Buffer.from('dependency-'+index+'-'+path))})),
  evidence:'PROTECTED_READ_SOURCE_ONLY',runtimeVerified:false,executionAuthorized:false});
});

test('다른 목적·위조 selection·만료는 보호 read 전에 거절한다',async()=>{
 for(const mutate of [
  (s:Readonly<NegativeLinuxApprovalSelection>)=>Object.freeze({...s,purpose:'IX01_CURRENT_TC01'}),
  (s:Readonly<NegativeLinuxApprovalSelection>)=>Object.freeze({...s,planHash:'0'.repeat(64)}),
 ]){const h=fixture();await assert.rejects(verify0076NegativeLinuxApproval(mutate(h.selection) as NegativeLinuxApprovalSelection,h.ports));assert.equal(h.reads,0);}
 const expired=fixture({now:2_600_000});await assert.rejects(verify0076NegativeLinuxApproval(expired.selection,expired.ports));assert.equal(expired.reads,1);
});

test('approval 결박·graph source 바이트·동일 custody·후행 current가 다르면 fail closed다',async()=>{
 for(const h of [fixture({approval:{decision:'ALLOW_ONE_RUN'}}),fixture({sourceIndex:2,sourceBytes:new Uint8Array([9])}),fixture({foreignCustody:true}),fixture({loseCurrent:true}),fixture({badGraphPath:true}),fixture({graphTotalOverflow:true})]){
  await assert.rejects(verify0076NegativeLinuxApproval(h.selection,h.ports));assert.equal(h.reads,1);
 }
});

test('wall 정체 mono equality 만료와 reply Proxy/accessor를 승인 projection으로 읽지 않는다',async()=>{
 for(const h of [fixture({monotonic:[100,500100]}),fixture({reply:'PROXY'}),fixture({reply:'ACCESSOR'})]){
  await assert.rejects(verify0076NegativeLinuxApproval(h.selection,h.ports));assert.equal(h.reads,1);
 }
});
