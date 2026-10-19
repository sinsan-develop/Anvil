import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {executionChallengeRequestBytes,executionProofBytes,executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
import {SyntheticExecutionChallenges} from '../../../apps/server/modules/executions/execution-challenges.ts';
const m:any=await import('../../../apps/server/modules/executions/execution-authenticated-observations.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const at='2026-10-19T12:00:00.000Z',hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(mode:'EXECUTION'|'RECOVERY'='EXECUTION'){
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url'),ref={id:randomUUID(),version:1,contentHash:'a'.repeat(64)};
 const scope={mode,projectId:randomUUID(),connectorId:randomUUID(),executionId:randomUUID(),executionGeneration:1,grantRef:ref,credentialGeneration:1};
 const context={transport:'SYNTHETIC_ONLY',...scope,scopeDigest:'b'.repeat(64),publicKeyFingerprint:publicKeyFingerprint(spki),grantExpiresAt:'2026-10-19T12:10:00.000Z'};
 const path='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+(mode==='RECOVERY'?'/recovery':'')+'/observations';
 let state:any={challenges:[],results:[],events:[],ack:null},fault='',gate=Promise.resolve(),transactions=0;
 const store:any={transport:'SYNTHETIC_ONLY',transaction:async(_scope:any,body:any)=>{
  const prior=gate;let unlock!:()=>void;gate=new Promise(r=>unlock=r);await prior;transactions++;const draft=structuredClone(state);
  try{const tx={challenges:{clock:async()=>at,current:async()=>({context:structuredClone(context),spki,checkedAt:at}),read:async()=>({complete:true,events:structuredClone(draft.challenges)}),append:async(v:any)=>{draft.challenges.push(structuredClone(v));if(fault==='challenge')throw Error('PRIVATE_TOKEN_CHALLENGE');},recordResult:async()=>{if(fault==='result')throw Error('PRIVATE_TOKEN_RESULT');const r={id:randomUUID(),version:1,contentHash:'c'.repeat(64)};draft.results.push(r);return r;}},
   observations:{clock:async()=>at,current:async()=>{if(fault==='current'&&draft.events.length)throw Error('PRIVATE_TOKEN_CURRENT');return{transport:'SYNTHETIC_ONLY',scope:structuredClone(_scope),operation:'SYNC_OBSERVATIONS',authorityRef:ref,checkedAt:at,expiresAt:context.grantExpiresAt};},read:async()=>({complete:true,events:structuredClone(draft.events),ack:structuredClone(draft.ack)}),append:async(v:any)=>{draft.events.push(structuredClone(v));if(fault==='event')throw Error('PRIVATE_TOKEN_EVENT');},saveAck:async(v:any)=>{draft.ack=structuredClone(v);if(fault==='ack')throw Error('PRIVATE_TOKEN_ACK');}}};
   const result=await body(tx);state=draft;return result;
  }finally{unlock();}
 }};
 const challengeStore:any={transport:'SYNTHETIC_ONLY',transaction:(s:any,fn:any)=>store.transaction(s,(tx:any)=>fn(tx.challenges))};
 const event={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:1,sequence:1,eventId:randomUUID(),type:'UNKNOWN',commandId:randomUUID(),envelopeHash:'e'.repeat(64),localRecordRef:ref,processRef:null,occurredAt:at,reasonCode:'PROVIDER_RESPONSE_LOST'};
 const batch={events:[event],batchHash:hash([event])},raw=canonicalJson(batch);
 async function issue(target=executionTarget('POST',path,[],raw)){
  const p={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:ref,credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:at};
  const issued=await new SyntheticExecutionChallenges(challengeStore).issue(scope,p,sign('sha256',executionChallengeRequestBytes(mode,p),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));
  const proof={requestId:p.requestId,...p.target,grantRef:ref,credentialGeneration:1,serverNonce:issued.challenge.serverNonce};
  const signature=sign('sha256',executionProofBytes(mode==='RECOVERY'?'EXECUTION_RECOVERY_REQUEST_PROOF':'EXECUTION_REQUEST_PROOF',proof),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');return{issued,proof,signature};
 }
 const make=()=>{assert.equal(typeof m.SyntheticAuthenticatedObservations,'function');return new m.SyntheticAuthenticatedObservations(store);};
 return{scope,path,batch,raw,issue,make,store,state:()=>state,transactions:()=>transactions,fault:(v:string)=>fault=v};
}
test('서명된 정확 관측 요청은 nonce·결과·관측·ACK를 한 transaction에 저장하고 응답유실 재조회/동시 요청은 효과1개다',async()=>{
 for(const mode of ['EXECUTION','RECOVERY'] as const){const f=fixture(mode),p=await f.issue(),service=f.make(),before=f.transactions();const run=()=>service.ingest(f.scope,p.issued.ref,p.proof,p.signature,f.raw);
  const [a,b]=await Promise.all([run(),run()]);assert.deepEqual(a,b);assert.deepEqual(await run(),a);assert.equal(f.transactions()-before,3);
  assert.equal(f.state().results.length,1);assert.equal(f.state().challenges.length,2);assert.equal(f.state().events.length,1);assert.equal(a.ack.snapshot.highestContiguous,1);assert.equal(a.nonceConsumed,true);assert.equal(a.executionAuthorized,false);assert.equal(a.dispatchPerformed,false);assert.equal(a.ack.snapshot.writerReleaseVerified,false);
 }
});
test('result/challenge/event/ACK/current 실패는 nonce 소비까지 함께 rollback하고 원문 오류를 숨긴다',async()=>{
 for(const fault of ['result','challenge','event','ack','current']){const f=fixture(),p=await f.issue();f.fault(fault);await assert.rejects(f.make().ingest(f.scope,p.issued.ref,p.proof,p.signature,f.raw),(e:Error)=>!e.message.includes('PRIVATE_TOKEN'));
  assert.equal(f.state().challenges.length,1);assert.equal(f.state().results.length,0);assert.equal(f.state().events.length,0);assert.equal(f.state().ack,null);
 }
});
test('다른 body·허용되지만 다른 route의 서명으로 관측을 저장하지 않는다',async()=>{
 const f=fixture(),p=await f.issue();await assert.rejects(f.make().ingest(f.scope,p.issued.ref,p.proof,p.signature,canonicalJson({...f.batch,batchHash:'f'.repeat(64)})));assert.equal(f.state().results.length,0);
 const g=fixture(),q=await g.issue(executionTarget('POST',g.path.replace('/observations','/heartbeat'),[],g.raw));await assert.rejects(g.make().ingest(g.scope,q.issued.ref,q.proof,q.signature,g.raw));assert.equal(g.state().events.length,0);assert.equal(g.state().results.length,0);
});
test('서명·nonce·scope 세대 불일치와 중복 JSON 필드는 쓰기 전에 거절한다',async()=>{
 const f=fixture(),p=await f.issue();
 for(const [scope,proof,sig,raw] of [[f.scope,p.proof,Buffer.alloc(64).toString('base64url'),f.raw],[f.scope,{...p.proof,serverNonce:randomBytes(32).toString('base64url')},p.signature,f.raw],[{...f.scope,executionGeneration:2},p.proof,p.signature,f.raw],[f.scope,p.proof,p.signature,'{"events":[],"events":[],"batchHash":"x"}']])await assert.rejects(f.make().ingest(scope,p.issued.ref,proof,sig,raw));
 assert.equal(f.state().results.length,0);assert.equal(f.state().events.length,0);
});
test('현재 port가 합성이 아니거나 필수 transaction이 없으면 실제 fallback을 만들지 않는다',()=>{
 assert.equal(typeof m.SyntheticAuthenticatedObservations,'function');for(const store of [undefined,{transport:'REAL',transaction:async()=>null},{transport:'SYNTHETIC_ONLY'}])assert.throws(()=>new m.SyntheticAuthenticatedObservations(store),/AUTHENTICATED_OBSERVATION_REJECTED/);
});
test('정확히 서명됐더라도 잘못된 batch는 소비/관측/ACK 전부 rollback한다',async()=>{
 const f=fixture(),raw=canonicalJson({...f.batch,batchHash:'f'.repeat(64)}),p=await f.issue(executionTarget('POST',f.path,[],raw));await assert.rejects(f.make().ingest(f.scope,p.issued.ref,p.proof,p.signature,raw));
 assert.equal(f.state().results.length,0);assert.equal(f.state().challenges.length,1);assert.equal(f.state().ack,null);
});
