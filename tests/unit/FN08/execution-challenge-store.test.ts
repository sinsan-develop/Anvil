import assert from 'node:assert/strict';
import test from 'node:test';
const m:any=await import('../../../apps/server/modules/executions/execution-challenge-store.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
test('PG challenge store에는 합성 key 제공자가 필수이며 실제 credential/환경 fallback을 만들지 않는다',()=>{
 assert.equal(typeof m.SyntheticPgChallengeStore,'function');
 const pool={connect:async()=>{throw Error('SHOULD_NOT_CONNECT');}};
 for(const key of [undefined,{transport:'REAL',key:async()=>null},{transport:'SYNTHETIC_ONLY'}])assert.throws(()=>new m.SyntheticPgChallengeStore(pool,key),/SYNTHETIC_HOST_KEYS_REQUIRED/);
 const store=new m.SyntheticPgChallengeStore(pool,{transport:'SYNTHETIC_ONLY',key:async()=>{throw Error('NOT_CONNECTED');}});assert.equal(store.transport,'SYNTHETIC_ONLY');
});
test('잘못된 scope는 DB 연결 전에 거절하며 이 port는 아직 실제 회수 grant를 꾸며 내지 않는다',async()=>{
 let calls=0;const store=new m.SyntheticPgChallengeStore({connect:async()=>{calls++;throw Error('SHOULD_NOT_CONNECT');}},{transport:'SYNTHETIC_ONLY',key:async()=>null});
 for(const value of [null,{}, {mode:'RECOVERY'}])await assert.rejects(store.transaction(value,async()=>null));assert.equal(calls,0);
});

test('FN09 normal 전용 target은 유효 P256 합성 issue/verifier 및 옛 영수증 재확인에서 append/result0',async()=>{
 const {generateKeyPairSync,randomUUID,sign}=await import('node:crypto');
 const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
 const {publicKeyFingerprint}=await import('../../../apps/server/modules/connections/registration-proof.ts');
 const proof=await import('../../../apps/server/modules/executions/execution-proof.ts');
 const {SyntheticExecutionChallenges,readConsumedExecutionRequest}=await import('../../../apps/server/modules/executions/execution-challenges.ts');
 const hash=(v:unknown)=>contentHash(canonicalJson(v)),ref=()=>({id:randomUUID(),version:1,contentHash:'a'.repeat(64)}),now='2030-01-01T00:00:00.000Z';
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const scope={mode:'EXECUTION' as const,projectId:randomUUID(),connectorId:randomUUID(),executionId:randomUUID(),executionGeneration:1,grantRef:ref(),credentialGeneration:1};
 const binding={transport:'SYNTHETIC_ONLY',...scope,scopeDigest:'b'.repeat(64),publicKeyFingerprint:publicKeyFingerprint(spki)},context={...binding,grantExpiresAt:'2030-01-01T00:01:00.000Z'};
 let events:any[]=[],append=0,results=0;
 const service=new SyntheticExecutionChallenges({transport:'SYNTHETIC_ONLY',async transaction(_scope,body){return body({current:async()=>({context,spki,checkedAt:now}),clock:async()=>now,read:async()=>({complete:true,events}),append:async()=>{append++;},recordResult:async()=>{results++;return ref();}});}});
 const base='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/understanding-response-read';
 for(const method of ['GET','POST'] as const){
  events=[];const target=proof.executionTarget(method,method==='GET'?base:base+'/'+randomUUID()+'/result',[],method==='GET'?null:'{}');
  const request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:scope.grantRef,credentialGeneration:1,target,clientNonce:Buffer.alloc(32,1).toString('base64url'),issuedAt:now};
  const signature=sign('sha256',proof.executionChallengeRequestBytes('EXECUTION',request),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  await assert.rejects(service.issue(scope,request,signature),/EXECUTION_PROOF_INVALID/);assert.equal(append,0);
  assert.throws(()=>proof.verifyExecutionChallengeRequest(spki,signature,request,request,context,new Date(now)),/EXECUTION_PROOF_INVALID/);
  const p={id:randomUUID(),requestId:request.requestId,purpose:request.purpose,grantRef:scope.grantRef,credentialGeneration:1,scopeDigest:binding.scopeDigest,serverNonce:Buffer.alloc(32,2).toString('base64url'),clientNonce:request.clientNonce,issuedAt:now,expiresAt:'2030-01-01T00:00:30.000Z'};
  const payload={requestId:request.requestId,...target,grantRef:scope.grantRef,credentialGeneration:1,serverNonce:p.serverNonce};
  const sig=sign('sha256',proof.executionProofBytes('EXECUTION_REQUEST_PROOF',payload),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
  assert.throws(()=>proof.verifyExecutionProof(spki,sig,'EXECUTION_REQUEST_PROOF',payload,payload,context,{issuedAt:now,expiresAt:p.expiresAt},new Date(now)),/EXECUTION_PROOF_INVALID/);
  const snapshot={sequence:1,binding,request,requestHash:hash(request),publicChallenge:p,previousRef:null,consumption:null};
  const original={ref:{id:p.id,version:1,contentHash:hash(snapshot)},snapshot};events=[original];
  await assert.rejects(service.issue(scope,request,signature),/EXECUTION_CHALLENGE_LEDGER_INVALID/);
  const resultRef=ref(),consumed={...snapshot,sequence:2,previousRef:original.ref,consumption:{proofHash:hash(payload),resultRef,consumedAt:now}};
  events.push({ref:{id:p.id,version:2,contentHash:hash(consumed)},snapshot:consumed});
  await assert.rejects(service.consume(scope,original.ref,payload,sig),/EXECUTION_CHALLENGE_LEDGER_INVALID/);
  assert.throws(()=>readConsumedExecutionRequest({complete:true,events},scope,resultRef,target,now,p.expiresAt,binding.publicKeyFingerprint),/EXECUTION_CHALLENGE_LEDGER_INVALID/);
  assert.equal(append,0);assert.equal(results,0);
  assert.throws(()=>proof.executionTarget(method,base.replace('/understanding-response-read','/recovery/understanding-response-read')+(method==='POST'?'/'+randomUUID()+'/result':''),[],method==='GET'?null:'{}'),/EXECUTION_PROOF_INVALID/);
 }
});
