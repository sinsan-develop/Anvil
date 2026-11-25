import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {readSubnetWindowsFinalReadinessResult} from '../../../scripts/qa-ix01-subnet-observation-windows-readiness-result.ts';
import {create0076BenignFdProofCollectionWindowsInvocation,create0076BenignFdProofWindowsInvocation} from '../../../scripts/qa-ix01-0076-benign-fd-proof-windows-entry.ts';

const epoch=1800000000000,attemptId='22222222-2222-4222-8222-222222222222',approvalId='33333333-3333-4333-8333-333333333333';
const approvalHash='c'.repeat(64),planHash='b'.repeat(64),sourceHash='d'.repeat(64),graphHash='e'.repeat(64),finalSourceHash='ad2254c843f97ff420eee2d35cf6968783f199694ee5b6404bdde69dd74cd3d8';
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const sshPrefix=Object.freeze(['-T','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','ClearAllForwardings=yes',
 '-o','UpdateHostKeys=no','-o','AddKeysToAgent=no','-o','VerifyHostKeyDNS=no','-o','ForwardAgent=no','-o','ForwardX11=no','-o','ForwardX11Trusted=no','-o','Tunnel=no',
 '-o','ProxyCommand=none','-o','ProxyJump=none','-o','PermitLocalCommand=no','-o','LocalCommand=none','-o','ControlMaster=no','-o','ControlPath=none','-o','ControlPersist=no','-o','RequestTTY=no','-o','RemoteCommand=none',
 '-o','ConnectionAttempts=1','-o','ConnectTimeout=8','-o','ServerAliveInterval=3','-o','ServerAliveCountMax=2','-o','LogLevel=ERROR','WSL-server']);
function collectionCommand(stdinSha256:string){const sourceRoot='/home/daon/anvil-ix01-0076-negative-'+attemptId.replaceAll('-','')+'-qa',launcher=sourceRoot+'/scripts/qa-ix01-0076-negative-linux-fd-proof-launcher.ts';
 const remote="cd '"+sourceRoot+"' && exec /usr/bin/env -i /opt/node-v24.22.1-linux-x64/bin/node '"+launcher+"' --collect "+attemptId+' '+planHash+' '+approvalHash+' '+stdinSha256;
 return Object.freeze({file:String.raw`C:\Windows\System32\OpenSSH\ssh.exe`,args:Object.freeze([...sshPrefix,remote]),options:Object.freeze({cwd:String.raw`C:\Windows\System32`,env:Object.freeze({}),shell:false,windowsHide:true,stdio:Object.freeze(['pipe','pipe','ignore'] as const)})});}
const evidence=()=>Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_FD_PROOF_PROTECTED_START' as const,attemptId,approvalId,
 approvalRef:Object.freeze({id:approvalId,version:1,contentHash:approvalHash}),approvalHash,sourceHead:'a'.repeat(40),planHash,sourceHash,graphHash,issuedAt:epoch,expiresAt:epoch+10000,
 nodePath:'/opt/node-v24.22.1-linux-x64/bin/node' as const,nodeHash:'f'.repeat(64),launcherHash:'1'.repeat(64),issuerHash:'2'.repeat(64),entryHash:'3'.repeat(64),systemHash:'4'.repeat(64),loadedSourceRef:Object.freeze({id:'44444444-4444-4444-8444-444444444444',version:1,contentHash:'5'.repeat(64)})});
function readinessWire(){return Buffer.from(canonicalJson({schemaVersion:1,code:'COMPARISON_ONLY',readiness:'UNCONFIRMED',reason:'DEFAULT_SCOPE_ENV_AND_TRUST_UNCONFIRMED',
 binding:{attemptId,approvalHash,planHash,sourceHash:finalSourceHash,issuedAt:epoch,expiresAt:epoch+10000},files:[
  {role:'SSH_IMAGE',state:'PRESENT',metadata:'MATCHED',bytes:3,sha256:'6'.repeat(64),aclHash:'7'.repeat(64)},
  {role:'USER_CONFIG',state:'PRESENT',metadata:'MATCHED',bytes:100,sha256:'8'.repeat(64),aclHash:'7'.repeat(64),text:'ALIAS_SUBSET'},
  {role:'SYSTEM_CONFIG',state:'ABSENT',metadata:'MATCHED'},
  {role:'USER_TRUST',state:'PRESENT',metadata:'MATCHED',bytes:100,sha256:'9'.repeat(64),aclHash:'7'.repeat(64),text:'SUBSET_ONLY'},
  {role:'USER_TRUST_2',state:'ABSENT',metadata:'MATCHED'},{role:'SYSTEM_TRUST',state:'ABSENT',metadata:'MATCHED'},{role:'SYSTEM_TRUST_2',state:'ABSENT',metadata:'MATCHED'},
  {role:'LEDGER_PARENT',state:'PRESENT',metadata:'MATCHED',aclHash:'7'.repeat(64)}],alias:{schemaVersion:1,status:'ALIAS_SUBSET',code:'CONFIG_CLASSIFIED',alias:'WSL-server',readiness:'UNCONFIRMED',userKind:'ROOT_LITERAL',fields:[{key:'user',role:'USER_CONFIG',line:1}]}})+'\n');}
class Child extends EventEmitter{stdin=new EventEmitter();stdout=new EventEmitter();constructor(){super();this.on('error',()=>{});this.stdin.on('error',()=>{});this.stdout.on('error',()=>{});}}
function fixture(mode='normal',transport:'RUN'|'COLLECT'='RUN',collectionOverride:Record<string,unknown>={}){
 const protectedBytes=Buffer.from(canonicalJson(evidence())),readiness=readinessWire(),comparison=readSubnetWindowsFinalReadinessResult(readiness,{attemptId,approvalHash,planHash,sourceHash:finalSourceHash,issuedAt:epoch,expiresAt:epoch+10000});
 assert.equal(comparison.status,'COMPARISON_ONLY');if(comparison.status!=='COMPARISON_ONLY')throw Error('FIXTURE');
 const baseDecision=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_BENIGN_FD_PROOF_WINDOWS_RELEASE' as const,attemptId,approvalRef:evidence().approvalRef,sourceHead:evidence().sourceHead,approvalHash,planHash,sourceHash,graphHash,
  issuedAt:epoch,expiresAt:epoch+10000,stdinSha256:sha(protectedBytes),readinessOutputSha256:comparison.outputSha256,readinessMetadataSha256:comparison.metadataSha256,readinessIdentity:comparison.identity});
 const launcherArgv=Object.freeze(['--collect',attemptId,planHash,approvalHash,baseDecision.stdinSha256] as const),decision=transport==='RUN'?baseDecision:Object.freeze({...baseDecision,purpose:'IX01_0076_BENIGN_FD_PROOF_WINDOWS_COLLECTION_RELEASE' as const,mode:'--collect' as const,launcherArgv,commandHash:sha(canonicalJson(collectionCommand(baseDecision.stdinSha256))),...collectionOverride});
 let wall=epoch,mono=1,opens=0,spawns=0,sends=0;const phases:string[]=[],recipient=Object.freeze({});
 const authority=Object.freeze({recipient,decision,now:()=>wall,monotonic:()=>mono,assertCurrent(this:object,phase:string,found:unknown,ready:unknown,binding:unknown){assert.equal(this,recipient);phases.push(phase);assert.equal(found,decision);assert.deepEqual(ready,comparison);if(mode===phase)throw Error('LOST');if(phase==='CARRIER_REVIEW')assert(binding&&typeof binding==='object');}});
 const portsFactory=(review:(binding:unknown)=>unknown)=>{const timers=new Map<number,()=>void>();let serial=0;return Object.freeze({clock:{now:()=>wall,monotonic:()=>mono,setTimeout(fn:()=>void){const id=++serial;timers.set(id,fn);return id;},clearTimeout(id:unknown){timers.delete(id as number);}},platform:()=> 'win32',review,
  openExclusive(){opens++;return Object.freeze({});},write(_token:object,bytes:Uint8Array,offset:number){return bytes.byteLength-offset;},flush(){return true;},close(){return true;},confirmClosed(){return true;},
  spawn(){spawns++;return new Child();},end(raw:object,bytes:Uint8Array){sends++;assert.deepEqual(Buffer.from(bytes),protectedBytes);const child=raw as Child,stdinHash=sha(bytes),intentDigest=sha(canonicalJson({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_FD_PROOF_LAUNCH_INTENT',attemptId,approvalRef:evidence().approvalRef,approvalHash,planHash,graphHash,stdinHash,issuedAt:epoch,expiresAt:epoch+10000}));
   const result=transport==='RUN'?{status:'IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS',attemptId,approvalRef:evidence().approvalRef,intentDigest,observation:{path:'/usr/bin/sleep',dev:8,ino:9,sha256:'a'.repeat(64)},runtimeVerified:false,executionAuthorized:false,pgAuthorized:false}
    :{schemaVersion:1,purpose:'IX01_0076_BENIGN_SAME_FD_COLLECTION_V1',evidence:'SOURCE_COLLECTION_CANDIDATE_ONLY',status:'IX01_0076_BENIGN_SAME_FD_COLLECTION_CANDIDATE_NOT_RUNTIME_PASS',path:`/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-fd-proof-${attemptId}-collection-v1.json`,attemptId,approvalRef:evidence().approvalRef,sourceHead:evidence().sourceHead,approvalHash,planHash,sourceHash,graphHash,issuedAt:epoch,expiresAt:epoch+10000,
     intent:{path:`/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-fd-proof-${attemptId}-intent-v1.json`,raw:canonicalJson({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_FD_PROOF_LAUNCH_INTENT',attemptId,approvalRef:evidence().approvalRef,approvalHash,planHash,graphHash,stdinHash,issuedAt:epoch,expiresAt:epoch+10000}),sha256:intentDigest},observation:{path:'/usr/bin/sleep',dev:8,ino:9,sha256:'a'.repeat(64)},terminal:{schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_SAME_FD_TERMINAL_V1',attemptId,issuedAt:epoch,expiresAt:epoch+10000,child:{exitCode:null,signal:'SIGTERM',closeConfirmed:true},sourceFd:{closeConfirmed:true}},collectionSource:'PRIVATE_LAUNCH_CLOSURE',comparisonOnly:true,nativeEnableEligible:false,durableStored:false,runtimeVerified:false,executionAuthorized:false,pgAuthorized:false};
   child.stdin.emit('finish');child.stdout.emit('data',Buffer.from(canonicalJson(result)+'\n'));child.stdout.emit('end');child.emit('exit',0,null);child.emit('close',0,null);}});};
 const invocation=transport==='RUN'?create0076BenignFdProofWindowsInvocation(authority as any,portsFactory):create0076BenignFdProofCollectionWindowsInvocation(authority as any,portsFactory);
 return{invocation,readiness,protectedBytes,phases,decision,comparison,advance(ms:number){wall+=ms;mono+=ms;},get opens(){return opens;},get spawns(){return spawns;},get sends(){return sends;}};
}

test('IX01 benign Windows entry: 원 readiness 비교와 외부 release current 뒤 기존 carrier를 단회 호출한다',async()=>{
 const f=fixture(),result=await f.invocation.run(f.readiness,f.protectedBytes);assert.equal(result.status,'IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS');
 assert.equal(result.runtimeVerified,false);assert.equal(result.executionAuthorized,false);assert.equal(result.pgAuthorized,false);assert.deepEqual(f.phases.slice(0,2),['PREPARE','READINESS']);assert.equal(f.phases.at(-1),'RESULT');assert(f.phases.slice(2,-1).length>=4);assert(f.phases.slice(2,-1).every(phase=>phase==='CARRIER_REVIEW'));assert.equal(f.opens,1);assert.equal(f.spawns,1);assert.equal(f.sends,1);
 assert.equal((await f.invocation.run(f.readiness,f.protectedBytes)).status,'UNKNOWN');assert.equal(f.spawns,1);
});

test('IX01 benign Windows entry: readiness·stdin·release current 불일치는 원장과 child 전에 닫힌다',async()=>{
 for(const mode of ['PREPARE','READINESS','CARRIER_REVIEW']){const f=fixture(mode);assert.equal((await f.invocation.run(f.readiness,f.protectedBytes)).status,'UNKNOWN',mode);assert.equal(f.spawns,0,mode);assert.equal(f.sends,0,mode);}
 const changedReadiness=fixture(),badReadiness=Buffer.from(changedReadiness.readiness);badReadiness[10]=badReadiness[10]!^1;assert.equal((await changedReadiness.invocation.run(badReadiness,changedReadiness.protectedBytes)).status,'UNKNOWN');assert.equal(changedReadiness.opens,0);
 const changedInput=fixture(),badInput=Buffer.from(changedInput.protectedBytes);badInput[10]=badInput[10]!^1;assert.equal((await changedInput.invocation.run(changedInput.readiness,badInput)).status,'UNKNOWN');assert.equal(changedInput.opens,0);
 const expired=fixture();expired.advance(10000);assert.equal((await expired.invocation.run(expired.readiness,expired.protectedBytes)).status,'UNKNOWN');assert.equal(expired.opens,0);
 const resultLost=fixture('RESULT');assert.equal((await resultLost.invocation.run(resultLost.readiness,resultLost.protectedBytes)).status,'UNKNOWN');assert.equal(resultLost.spawns,1);assert.equal(resultLost.sends,1);
 assert.equal((await resultLost.invocation.run(resultLost.readiness,resultLost.protectedBytes)).status,'UNKNOWN');assert.equal(resultLost.spawns,1);
});

test('IX01 benign Windows entry: raw JSON은 release authority가 아니며 생성만으로 효과가 없다',async()=>{
 const f=fixture();assert.equal(f.opens,0);assert.equal(f.spawns,0);assert.equal(f.sends,0);
 assert.throws(()=>create0076BenignFdProofWindowsInvocation(f.decision as any,()=>{throw Error('SHOULD_NOT_RUN');}));
});

test('IX01 benign Windows entry: exact collection release만 --collect carrier를 단회 호출하고 기존 run 타입은 유지한다',async()=>{
 const f=fixture('normal','COLLECT'),result=await f.invocation.run(f.readiness,f.protectedBytes);assert.equal(result.status,'IX01_0076_BENIGN_SAME_FD_COLLECTION_CANDIDATE_NOT_RUNTIME_PASS');
 if(result.status==='IX01_0076_BENIGN_SAME_FD_COLLECTION_CANDIDATE_NOT_RUNTIME_PASS'){assert.equal(result.collectionSource,'PRIVATE_LAUNCH_CLOSURE');assert.equal(result.comparisonOnly,true);assert.equal(result.nativeEnableEligible,false);assert.equal(result.runtimeVerified,false);assert.equal(result.executionAuthorized,false);assert.equal(result.pgAuthorized,false);}
 assert.equal(f.opens,1);assert.equal(f.spawns,1);assert.equal(f.sends,1);assert.equal((await f.invocation.run(f.readiness,f.protectedBytes)).status,'UNKNOWN');assert.equal(f.spawns,1);
 const run=fixture(),runResult=await run.invocation.run(run.readiness,run.protectedBytes);assert.equal(runResult.status,'IX01_0076_BENIGN_SAME_FD_OBSERVATION_CANDIDATE_NOT_RUNTIME_PASS');
});

test('IX01 benign Windows entry: 교차 mode·command·current·readiness·late 결과는 collection 효과와 재호출 없이 닫힌다',async()=>{
 const old=fixture();assert.throws(()=>create0076BenignFdProofCollectionWindowsInvocation(Object.freeze({...old.decision}) as any,()=>{throw Error('SHOULD_NOT_RUN');}));assert.equal(old.opens,0);
 assert.throws(()=>fixture('normal','COLLECT',{launcherArgv:Object.freeze(['--run',attemptId,planHash,approvalHash,sha(Buffer.from(canonicalJson(evidence())))])}));
 assert.throws(()=>fixture('normal','COLLECT',{launcherArgv:['--collect',attemptId,planHash,approvalHash,sha(Buffer.from(canonicalJson(evidence())))]}));
 const wrongCommand=fixture('normal','COLLECT',{commandHash:'0'.repeat(64)});assert.equal((await wrongCommand.invocation.run(wrongCommand.readiness,wrongCommand.protectedBytes)).status,'UNKNOWN');assert.equal(wrongCommand.opens,0);assert.equal(wrongCommand.spawns,0);
 const badReadiness=fixture('normal','COLLECT'),changed=Buffer.from(badReadiness.readiness);changed[10]=changed[10]!^1;assert.equal((await badReadiness.invocation.run(changed,badReadiness.protectedBytes)).status,'UNKNOWN');assert.equal(badReadiness.opens,0);
 for(const phase of ['PREPARE','READINESS','CARRIER_REVIEW']){const lost=fixture(phase,'COLLECT');assert.equal((await lost.invocation.run(lost.readiness,lost.protectedBytes)).status,'UNKNOWN',phase);assert.equal(lost.spawns,0,phase);}
 const late=fixture('RESULT','COLLECT');assert.equal((await late.invocation.run(late.readiness,late.protectedBytes)).status,'UNKNOWN');assert.equal(late.spawns,1);assert.equal((await late.invocation.run(late.readiness,late.protectedBytes)).status,'UNKNOWN');assert.equal(late.spawns,1);
});
