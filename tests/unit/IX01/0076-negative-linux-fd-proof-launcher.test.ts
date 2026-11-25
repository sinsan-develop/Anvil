import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import test from 'node:test';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {
 run0076NegativeLinuxFdProofLauncherForRam,
 create0076NegativeLinuxFdProofLauncherIntentSystemForRam,
 current0076NegativeLinuxFdProofCollectionContract,
 project0076NegativeLinuxFdProofCollectionCandidate,
 project0076NegativeLinuxFdProofCollectionCandidateForRam,
 project0076NegativeLinuxFdProofObservationCandidate,
 type NegativeLinuxFdProofLauncherCommand,
 type NegativeLinuxFdProofLauncherIntentPorts,
 type NegativeLinuxFdProofLauncherReceiptSystem,
 type NegativeLinuxFdProofLauncherIntentSystem,
} from '../../../scripts/qa-ix01-0076-negative-linux-fd-proof-launcher.ts';

const scriptPath='/source/scripts/qa-ix01-0076-negative-linux-fd-proof-launcher.ts';
const attemptId='00000000-0000-4000-8000-000000000711',approvalId='00000000-0000-4000-8000-000000000712';
function fixture(receiptMode:'MATCH'|'MISSING'|'CHANGED'='MATCH'){
 const evidence=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_FD_PROOF_PROTECTED_START' as const,attemptId,approvalId,
  approvalRef:Object.freeze({id:approvalId,version:1,contentHash:'e'.repeat(64)}),approvalHash:'e'.repeat(64),sourceHead:'a'.repeat(40),planHash:'b'.repeat(64),sourceHash:'c'.repeat(64),graphHash:'d'.repeat(64),
  issuedAt:1000,expiresAt:9000,nodePath:'/opt/node-v24.22.1-linux-x64/bin/node' as const,nodeHash:'f'.repeat(64),launcherHash:'1'.repeat(64),issuerHash:'2'.repeat(64),entryHash:'3'.repeat(64),systemHash:'4'.repeat(64),
  loadedSourceRef:Object.freeze({id:'00000000-0000-4000-8000-000000000713',version:1,contentHash:'5'.repeat(64)})});
 const stdin=new TextEncoder().encode(canonicalJson(evidence)),stdinHash=createHash('sha256').update(stdin).digest('hex');
 const command=Object.freeze<NegativeLinuxFdProofLauncherCommand>({platform:'linux',uid:1000,execPath:evidence.nodePath,scriptPath,execArgv:Object.freeze([]),envKeys:Object.freeze([]),
  argv:Object.freeze(['--run',attemptId,evidence.planHash,evidence.approvalHash,stdinHash]),stdin,now:()=>1000,monotonic:()=>10});
 const receiptRecipient=Object.freeze({}),recipient=Object.freeze({});let reads=0,settles=0;const order:string[]=[];
 const root=Object.freeze({kind:'DIRECTORY' as const,dev:1,ino:2,uid:1000,mode:0o40700});
 const receipt=Object.freeze<NegativeLinuxFdProofLauncherReceiptSystem>({recipient:receiptRecipient,read(this:object,path:string,maxBytes:number){assert.equal(this,receiptRecipient);assert.equal(path,`/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-fd-proof-${attemptId}-start.json`);assert.equal(maxBytes,32768);reads++;if(receiptMode==='MISSING')throw Error('missing');const result=new Uint8Array(stdin);if(receiptMode==='CHANGED')result[result.length-1]=result[result.length-1]!^1;return result;},rootIdentity(this:object){assert.equal(this,receiptRecipient);if(reads!==1)throw Error('not read');return root;}});
 const intent=Object.freeze<NegativeLinuxFdProofLauncherIntentSystem>({recipient,async settle(this:object,path:string,bytes:Uint8Array,current:()=>void){assert.equal(this,recipient);current();settles++;order.push('settled');
   assert.equal(path,`/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-fd-proof-${attemptId}-intent-v1.json`);assert(bytes.byteLength>0);return'SETTLED';}});
 return{command,evidence,stdin,receipt,intent,order,reads:()=>reads,settles:()=>settles};
}

test('exact CLI와 canonical approval stdin은 intent를 먼저 정착하지만 RAM 호출은 native evidence를 발급하지 않는다',async()=>{
 const h=fixture(),result=await run0076NegativeLinuxFdProofLauncherForRam(h.command,h.receipt,h.intent,scriptPath);
 assert.equal(result.status,'PROTECTED_START_EVIDENCE_UNAVAILABLE');assert.equal(result.nativeProviderSelected,false);assert.equal(result.effectsStarted,false);
 assert.deepEqual(h.order,['settled']);assert.equal(h.reads(),1);assert.equal(h.settles(),1);
});

test('argv 또는 protected stdin 불일치는 intent와 entry 전에 거절한다',async()=>{
 for(const mutate of [
  (h:ReturnType<typeof fixture>)=>Object.freeze({...h.command,argv:Object.freeze(['--run',attemptId,'0'.repeat(64),h.command.argv[3]!])}),
  (h:ReturnType<typeof fixture>)=>Object.freeze({...h.command,stdin:new TextEncoder().encode('{}')}),
  (h:ReturnType<typeof fixture>)=>{const raw=JSON.parse(new TextDecoder().decode(h.command.stdin));raw.sourceHead='9'.repeat(40);return Object.freeze({...h.command,stdin:new TextEncoder().encode(canonicalJson(raw))});},
 ]){const h=fixture(),result=await run0076NegativeLinuxFdProofLauncherForRam(mutate(h),h.receipt,h.intent,scriptPath);assert.equal(result.status,'UNKNOWN');assert.equal(h.settles(),0);}
});

test('protected receipt 누락·변조는 intent와 native entry 전에 중단한다',async()=>{
 for(const mode of ['MISSING','CHANGED'] as const){const h=fixture(mode),result=await run0076NegativeLinuxFdProofLauncherForRam(h.command,h.receipt,h.intent,scriptPath);assert.equal(result.status,'UNKNOWN',mode);assert.equal(h.reads(),1,mode);assert.equal(h.settles(),0,mode);}
});

test('intent는 pinned parent의 안정 신원만 재검산하고 close 불명 FD를 재close하지 않는다',async()=>{
 const recipient=Object.freeze({}),parent={kind:'DIRECTORY' as const,dev:1,ino:2,uid:1000,mode:0o40700,nlink:2,size:0,mtimeMs:1,ctimeMs:1},file={kind:'FILE' as const,dev:1,ino:3,uid:1000,mode:0o100600,nlink:1,size:0,mtimeMs:1,ctimeMs:1};
 let parentReads=0,written=new Uint8Array(),closeFile=0;const ports=Object.freeze<NegativeLinuxFdProofLauncherIntentPorts>({recipient,
  statPath(){parentReads++;return Object.freeze({...parent,size:parentReads,mtimeMs:parentReads,ctimeMs:parentReads});},realpath(){return'/home/daon/.local/share/anvil-v3-qa-receipts';},
  open(_path,flags){if(flags===(constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW))return 10;if(flags===(constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW|constants.O_SYNC))return 11;return 12;},
  statFd(_fd){if(_fd===10)return Object.freeze({...parent,size:9,mtimeMs:9,ctimeMs:9});return Object.freeze({...file,size:written.byteLength});},
  write(_fd,bytes,offset){written=bytes.slice();return bytes.byteLength-offset;},sync(){},read(_fd,bytes,offset){bytes.set(written.subarray(offset),offset);return written.byteLength-offset;},
  close(_fd){if(_fd===11){closeFile++;throw Error('close unknown');}},
 });
 const system=create0076NegativeLinuxFdProofLauncherIntentSystemForRam(ports),h=fixture(),result=await run0076NegativeLinuxFdProofLauncherForRam(h.command,h.receipt,system,scriptPath);
 assert.equal(result.status,'UNKNOWN');assert.equal(closeFile,1);
});

test('receipt 뒤 같은 경로의 다른 정상 directory identity는 O_EXCL intent create 전에 거절한다',async()=>{
 const h=fixture(),recipient=Object.freeze({});let opens=0;const changedParent={kind:'DIRECTORY' as const,dev:1,ino:99,uid:1000,mode:0o40700,nlink:2,size:0,mtimeMs:1,ctimeMs:1};
 const ports=Object.freeze<NegativeLinuxFdProofLauncherIntentPorts>({recipient,statPath(){return changedParent;},realpath(){return'/home/daon/.local/share/anvil-v3-qa-receipts';},open(){opens++;return 10;},statFd(){return changedParent;},write(){throw Error('write');},sync(){},read(){throw Error('read');},close(){}});
 const result=await run0076NegativeLinuxFdProofLauncherForRam(h.command,h.receipt,create0076NegativeLinuxFdProofLauncherIntentSystemForRam(ports),scriptPath);assert.equal(result.status,'UNKNOWN');assert.equal(opens,1);
});

test('성공 후보 projection은 원 attempt·approvalRef·intent digest와 file observation만 보존한다',()=>{
 const h=fixture(),result=Object.freeze({status:'SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED' as const,evidence:'SOURCE_CANDIDATE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const,path:'/usr/bin/sleep',dev:8,ino:9,sha256:'a'.repeat(64),
  terminal:Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1' as const,attemptId,issuedAt:1000,expiresAt:9000,
   child:Object.freeze({exitCode:null,signal:'SIGTERM' as const,closeConfirmed:true as const}),sourceFd:Object.freeze({closeConfirmed:true as const})})});
 const projected=project0076NegativeLinuxFdProofObservationCandidate(result,h.evidence,h.stdin);assert.equal(projected.status,'IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS');assert.equal(projected.attemptId,attemptId);assert.deepEqual(projected.approvalRef,h.evidence.approvalRef);assert.equal(projected.intentDigest.length,64);assert.deepEqual(projected.observation,{path:'/usr/bin/sleep',dev:8,ino:9,sha256:'a'.repeat(64)});
 assert.deepEqual(Object.keys(projected),['status','attemptId','approvalRef','intentDigest','observation','runtimeVerified','executionAuthorized','pgAuthorized']);
 const failed=Object.freeze({status:'UNKNOWN' as const,evidence:'SOURCE_CANDIDATE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const});assert.equal(project0076NegativeLinuxFdProofObservationCandidate(failed,h.evidence,h.stdin),failed);
});

test('별도 collection v1은 canonical intent와 proof terminal을 같은 원 승인·시도·기한에 결박하고 권위를 올리지 않는다',()=>{
 const h=fixture(),terminal=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1' as const,attemptId,issuedAt:1000,expiresAt:9000,
  child:Object.freeze({exitCode:null,signal:'SIGTERM' as const,closeConfirmed:true as const}),sourceFd:Object.freeze({closeConfirmed:true as const})});
 const result=Object.freeze({status:'SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED' as const,evidence:'SOURCE_CANDIDATE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const,
  path:'/usr/bin/sleep',dev:8,ino:9,sha256:'a'.repeat(64),terminal});
 assert.equal(project0076NegativeLinuxFdProofCollectionCandidate(result).status,'UNKNOWN');
 const collection=project0076NegativeLinuxFdProofCollectionCandidateForRam(result,h.evidence,h.stdin);assert.equal(collection.status,'IX01_0076_BENIGN_SAME_FD_COLLECTION_CANDIDATE_NOT_RUNTIME_PASS');
 assert.equal(collection.schemaVersion,1);assert.equal(collection.purpose,current0076NegativeLinuxFdProofCollectionContract.purpose);
 assert.equal(collection.path,`/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-fd-proof-${attemptId}-collection-v1.json`);
 assert.deepEqual(collection.approvalRef,h.evidence.approvalRef);assert.equal(collection.sourceHead,h.evidence.sourceHead);assert.equal(collection.planHash,h.evidence.planHash);assert.equal(collection.sourceHash,h.evidence.sourceHash);assert.equal(collection.graphHash,h.evidence.graphHash);
 const expectedIntent={schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_FD_PROOF_LAUNCH_INTENT',attemptId,approvalRef:h.evidence.approvalRef,approvalHash:h.evidence.approvalHash,
  planHash:h.evidence.planHash,graphHash:h.evidence.graphHash,stdinHash:createHash('sha256').update(h.stdin).digest('hex'),issuedAt:1000,expiresAt:9000};
 assert.equal(collection.intent.raw,canonicalJson(expectedIntent));assert.equal(collection.intent.sha256,createHash('sha256').update(collection.intent.raw).digest('hex'));
 assert.deepEqual(collection.terminal,terminal);assert.equal(collection.collectionSource,'SYNTHETIC_RAM_ONLY');assert.equal(collection.comparisonOnly,true);assert.equal(collection.nativeEnableEligible,false);assert.equal(collection.durableStored,false);
 assert.equal(collection.runtimeVerified,false);assert.equal(collection.executionAuthorized,false);assert.equal(collection.pgAuthorized,false);
});

test('교차 시도·기한 또는 불명 terminal은 collection 성공 데이터를 반환하지 않는다',()=>{
 const h=fixture(),success={status:'SYNTHETIC_SAME_FD_MECHANISM_VERIFIED_NOT_0076_AUTHORIZED' as const,evidence:'SOURCE_CANDIDATE_ONLY' as const,runtimeVerified:false as const,executionAuthorized:false as const,
  path:'/usr/bin/sleep',dev:8,ino:9,sha256:'a'.repeat(64)};
 for(const terminal of [
  Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1' as const,attemptId:'00000000-0000-4000-8000-000000000799',issuedAt:1000,expiresAt:9000,child:Object.freeze({exitCode:null,signal:'SIGTERM' as const,closeConfirmed:true as const}),sourceFd:Object.freeze({closeConfirmed:true as const})}),
  Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1' as const,attemptId,issuedAt:1000,expiresAt:8999,child:Object.freeze({exitCode:null,signal:'SIGTERM' as const,closeConfirmed:true as const}),sourceFd:Object.freeze({closeConfirmed:true as const})}),
  undefined,
 ]){const collection=project0076NegativeLinuxFdProofCollectionCandidateForRam(Object.freeze({...success,...(terminal?{terminal}: {})}),h.evidence,h.stdin);assert.deepEqual(collection,{status:'UNKNOWN',code:'IX01_0076_BENIGN_SAME_FD_COLLECTION_UNAVAILABLE',comparisonOnly:true,nativeEnableEligible:false,durableStored:false,runtimeVerified:false,executionAuthorized:false,pgAuthorized:false});}
 const terminal=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1' as const,attemptId,issuedAt:1000,expiresAt:9000,child:Object.freeze({exitCode:null,signal:'SIGTERM' as const,closeConfirmed:true as const}),sourceFd:Object.freeze({closeConfirmed:true as const})});
 const otherSource=Object.freeze({...h.evidence,sourceHead:'b'.repeat(40),sourceHash:'c'.repeat(64)});assert.equal(project0076NegativeLinuxFdProofCollectionCandidateForRam(Object.freeze({...success,terminal}),h.evidence,h.stdin,otherSource).status,'UNKNOWN');
});
