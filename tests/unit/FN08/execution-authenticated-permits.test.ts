import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {executionChallengeRequestBytes,executionProofBytes,executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
import {SyntheticExecutionChallenges} from '../../../apps/server/modules/executions/execution-challenges.ts';
import {SyntheticStartReceiver} from '../../../apps/connector/runtime/execution-start-receiver.ts';
import {SyntheticExecutionClient} from '../../../apps/connector/runtime/execution-client.ts';
const m:any=await import('../../../apps/server/modules/executions/execution-authenticated-permits.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v)),at='2026-10-19T12:00:00.000Z',until='2026-10-19T12:01:00.000Z';
function fixture(){
 const id=randomUUID(),eid=randomUUID(),ref={id,version:1,contentHash:'a'.repeat(64)},key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url'),fp=publicKeyFingerprint(spki);
 const scope={mode:'EXECUTION' as const,projectId:id,connectorId:id,executionId:eid,executionGeneration:1,grantRef:ref,credentialGeneration:1};
 const context={transport:'SYNTHETIC_ONLY',...scope,scopeDigest:'b'.repeat(64),publicKeyFingerprint:fp,grantExpiresAt:until};
 const sourceScopes=[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}];
 const fact={schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:id,executionId:eid,executionGeneration:1,subject:{userId:id,clientId:eid,humanSessionId:eid,controlGeneration:1,credentialGeneration:1},agentSession:{sessionRef:ref,roleBindingRef:ref,credentialGeneration:1},registration:{ref,connectorId:id,generation:1,hostPublicKeyFingerprint:fp},intent:{projectId:id,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:ref,sourceScopes,mode:'CONTEXT_REVIEW',reason:'합성 permit 연결'},preparationRef:ref,permissionPolicyRef:ref,budgetReservationRef:ref,basisRefs:[ref],latestInstructionRefs:[],understandingReviewRef:null,checks:Object.fromEntries(['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'].map(n=>[n,{state:n==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:n==='understanding'?[]:[ref]}])),writerState:'OWNED',expires:Object.fromEntries(['humanSession','permissionPolicy','registration','budget','automaticScope'].map(n=>[n,until])),checkedAt:at,executionAuthorized:false,dispatchPerformed:false};
 const unsigned={schemaVersion:1,commandId:id,issuedAt:at,expiresAt:until,executorRegistrationRef:ref,context:{projectId:id,assignmentId:id,executionId:eid,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes},operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}},envelope={...unsigned,envelopeHash:hash(unsigned)};
 const queue={transport:'SYNTHETIC_ONLY',executionId:eid,executionGeneration:1,state:'SYNTHETIC_QUEUED',grantRef:ref,reservationRef:ref,executorRegistrationRef:ref,operation:'START_SESSION',payload:unsigned.payload,humanSessionId:eid,sourceScopes,budgetPolicyRef:ref,queuedAt:at,executionAuthorized:false,dispatchPerformed:false};
 const basis={fact,grantRef:ref,grantExpiresAt:until,commandRef:{id:eid,version:1,contentHash:hash(queue)},commandSnapshot:{...queue,envelope},authorizationReceiptRef:ref};
 const request={envelopeHash:envelope.envelopeHash,localAttemptRef:ref,sourceObservationRefs:[ref],osOwnershipRef:ref};
 let state:any={challenges:[],results:[],permits:[]},clock=at,fault='',tail=Promise.resolve(),connections=0;
 const store:any={transport:'SYNTHETIC_ONLY',transaction:async(_s:any,body:any)=>{const prior=tail;let unlock!:()=>void;tail=new Promise(r=>unlock=r);await prior;connections++;const draft=structuredClone(state);
  try{const tx={challenges:{clock:async()=>clock,current:async()=>({context:structuredClone(context),spki,checkedAt:clock}),read:async()=>({complete:true,events:structuredClone(draft.challenges)}),append:async(v:any)=>{draft.challenges.push(structuredClone(v));if(fault==='nonce')throw Error('PRIVATE_TOKEN_NONCE');},recordResult:async()=>{if(fault==='result')throw Error('PRIVATE_TOKEN_RESULT');const r={id:randomUUID(),version:1,contentHash:'c'.repeat(64)};draft.results.push(r);return r;}},
   permits:{clock:async()=>clock,current:async()=>structuredClone({...basis,fact:{...basis.fact,writerState:fault==='current'&&draft.permits.length?'UNKNOWN':'OWNED',checkedAt:clock}}),read:async()=>({complete:true,permits:structuredClone(draft.permits)}),append:async(v:any)=>{draft.permits.push(structuredClone(v));if(fault==='permit')throw Error('PRIVATE_TOKEN_PERMIT');}}};const result=await body(tx);state=draft;return result;}finally{unlock();}
 }};
 const challengeStore:any={transport:'SYNTHETIC_ONLY',transaction:(s:any,body:any)=>store.transaction(s,(tx:any)=>body(tx.challenges))};
 async function issue(body=request,path='/api/v1/connectors/'+id+'/executions/'+eid+'/commands/'+id+'/permit'){
  const raw=canonicalJson(body),target=executionTarget('POST',path,[],raw),p={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:ref,credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:clock};
  const issued=await new SyntheticExecutionChallenges(challengeStore).issue(scope,p,sign('sha256',executionChallengeRequestBytes('EXECUTION',p),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));
  const proof={requestId:p.requestId,...target,grantRef:ref,credentialGeneration:1,serverNonce:issued.challenge.serverNonce},signature=sign('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');return{issued,proof,signature,raw};
 }
 const make=()=>{assert.equal(typeof m.SyntheticAuthenticatedPermits,'function');return new m.SyntheticAuthenticatedPermits(store);},run=(p:any)=>make().consume(scope,id,p.issued.ref,p.proof,p.signature,p.raw);
 return{scope,id,request,envelope,issue,make,run,challengeStore,signer:{transport:'SYNTHETIC_ONLY' as const,sign:async(_purpose:string,bytes:Buffer)=>sign('sha256',bytes,{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')},state:()=>state,connections:()=>connections,fault:(s:string)=>fault=s,advance:(n:number)=>clock=new Date(Date.parse(clock)+n).toISOString()};
}
test('실제 P256 서명/nonce와 같은 transaction의 정확 permit 1개만 소비하고 재조회는 기한을 연장하지 않는다',async()=>{
 const f=fixture(),p=await f.issue(),before=f.connections(),[a,b]=await Promise.all([f.run(p),f.run(p)]);assert.deepEqual(a,b);assert.equal(f.connections()-before,2);assert.equal(a.permit.expiresAt,'2026-10-19T12:00:30.000Z');
 f.advance(31000);assert.deepEqual(await f.run(p),a);assert.equal(f.state().permits.length,1);assert.equal(f.state().results.length,1);assert.equal(f.state().challenges.length,2);assert.equal(a.permit.executionAuthorized,false);assert.equal(a.permit.dispatchPerformed,false);
});
test('permit/result/nonce/현재writer 실패는 nonce와 permit 전체를 rollback하고 비밀 오류를 숨긴다',async()=>{
 for(const fault of ['permit','result','nonce','current']){const f=fixture(),p=await f.issue();f.fault(fault);await assert.rejects(f.run(p),(e:Error)=>!e.message.includes('PRIVATE_TOKEN'));assert.equal(f.state().permits.length,0);assert.equal(f.state().results.length,0);assert.equal(f.state().challenges.length,1);}
});
test('다른 body·서명·경로·회수 scope로는 permit을 얻지 못한다',async()=>{
 const f=fixture(),p=await f.issue(),s=f.make();
 for(const [scope,signature,raw] of [[f.scope,Buffer.alloc(64).toString('base64url'),p.raw],[{...f.scope,mode:'RECOVERY'},p.signature,p.raw],[f.scope,p.signature,canonicalJson({...f.request,envelopeHash:'f'.repeat(64)})]])await assert.rejects(s.consume(scope,f.id,p.issued.ref,p.proof,signature,raw));
 assert.equal(f.state().permits.length,0);assert.equal(f.state().results.length,0);
 const g=fixture(),q=await g.issue(g.request,'/api/v1/connectors/'+g.id+'/executions/'+g.scope.executionId+'/observations');await assert.rejects(g.run(q));assert.equal(g.state().results.length,0);
});
test('이미 소비한 명령에 새 challenge/시도로 permit을 재발급하거나 새 nonce를 소비하지 않는다',async()=>{
 for(const changed of [false,true]){const f=fixture(),p=await f.issue(),first=await f.run(p),q=await f.issue(changed?{...f.request,localAttemptRef:{...f.request.localAttemptRef,version:2}}:f.request);await assert.rejects(f.run(q));assert.equal(f.state().permits.length,1);assert.equal(f.state().results.length,1);assert.equal(f.state().challenges.length,3);assert.equal(first.permit.expiresAt,'2026-10-19T12:00:30.000Z');}
});
test('소비 완료 journal에서 permit이 없으면 사후 생성하지 않고 불완전 상태로 거절한다',async()=>{
 const f=fixture(),p=await f.issue();await f.run(p);f.state().permits.splice(0);await assert.rejects(f.run(p));assert.equal(f.state().permits.length,0);assert.equal(f.state().results.length,1);assert.equal(f.state().challenges.length,2);
});
test('실행기 sync된 시도→서명/nonce/서버permit→permitRef sync 뒤에만 합성 wire1회를 연결한다',async()=>{
 const f=fixture(),events:any[]=[];let sends=0;
 const store:any={transport:'SYNTHETIC_ONLY',exclusive:async(_s:any,fn:any)=>fn({read:async()=>({complete:true,events:structuredClone(events)}),appendAndSync:async(e:any)=>{events.push(structuredClone(e));}})};
 const authority:any={transport:'SYNTHETIC_ONLY',consume:async(_e:any,attempt:any)=>{assert.deepEqual(attempt,events[1].ref);const p=await f.issue({...f.request,localAttemptRef:attempt});return f.make().consumeForReceiver(f.scope,f.id,p.issued.ref,p.proof,p.signature,p.raw);}};
 const wire:any={transport:'SYNTHETIC_ONLY',send:async()=>{assert.equal(events[2].snapshot.state,'PERMIT_RECORDED');assert.deepEqual(events[2].snapshot.permitRef,f.state().permits[0].ref);assert.deepEqual(f.state().permits[0].snapshot.request.localAttemptRef,events[1].ref);sends++;return{transport:'SYNTHETIC_ONLY',responseRef:f.request.osOwnershipRef};}};
 const receiver=new SyntheticStartReceiver(store,authority,wire,{context:f.envelope.context as any,executorRegistrationRef:f.envelope.executorRegistrationRef,grantRef:f.scope.grantRef},()=>Date.parse(at));
 await receiver.receive(f.envelope);assert.equal((await receiver.start(f.envelope)).state,'RESPONSE_RECORDED');assert.equal(sends,1);await receiver.start(f.envelope);assert.equal(sends,1);assert.equal(f.state().permits.length,1);assert.equal(f.state().results.length,1);
});

test('내구 요청 client가 실제 서명 challenge/permit 클래스로 연결되며 서버 COMMIT 뒤 응답유실도 자동 재전송하지 않는다',async()=>{
 for(const lost of [false,true]){
  const f=fixture(),events:any[]=[],localStore:any={transport:'SYNTHETIC_ONLY',exclusive:async(_scope:any,fn:any)=>fn({read:async()=>({complete:true,events:structuredClone(events)}),appendAndSync:async(e:any)=>{events.push(structuredClone(e));}})};
  const authority:any={transport:'SYNTHETIC_ONLY',current:async(v:any)=>({...v,transport:'SYNTHETIC_ONLY',checkedAt:at,expiresAt:until})};
  const transport:any={transport:'SYNTHETIC_ONLY',challenge:(scope:any,request:any,signature:string)=>{assert.equal(events.at(-1).snapshot.state,'CHALLENGE_ATTEMPTED');return new SyntheticExecutionChallenges(f.challengeStore).issue(scope,request,signature);},perform:async(scope:any,operation:any,challengeRef:any,proof:any,signature:string,bodyRaw:string)=>{assert.equal(events.at(-1).snapshot.state,'REQUEST_ATTEMPTED');assert.equal(operation.kind,'PERMIT');const out=await f.make().consume(scope,operation.commandId,challengeRef,proof,signature,bodyRaw);if(lost)throw Error('PRIVATE_RESPONSE_AFTER_COMMIT');return out;}};
  const make=()=>new SyntheticExecutionClient(localStore,authority,f.signer,transport,{clock:()=>Date.parse(at),timeoutMs:1000}),operation={kind:'PERMIT',commandId:f.id,bodyRaw:canonicalJson(f.request)};
  const first=await make().execute(f.scope,operation);assert.equal(first.state,lost?'UNKNOWN':'RESPONSE_RECORDED');assert.equal(f.state().permits.length,1);assert.equal(f.state().results.length,1);assert.equal(f.state().challenges.length,2);const connections=f.connections();assert.deepEqual(await make().execute(f.scope,operation),first);assert.equal(f.connections(),connections);assert.equal(first.executionAuthorized,false);assert.equal(first.dispatchPerformed,false);assert(!JSON.stringify(first).includes('PRIVATE'));
 }
});
