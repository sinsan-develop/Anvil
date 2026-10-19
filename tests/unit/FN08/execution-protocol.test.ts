import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { canonicalJson } from '../../../contracts/canonical.ts';
import { publicKeyFingerprint } from '../../../apps/server/modules/connections/registration-proof.ts';
import { executionChallengeRequestBytes, executionProofBytes } from '../../../apps/server/modules/executions/execution-proof.ts';
const m:any=await import('../../../apps/server/modules/executions/execution-challenges.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
function fixture(mode:'EXECUTION'|'RECOVERY'='EXECUTION'){
 assert.equal(typeof m.SyntheticExecutionChallenges,'function');
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url'),id=()=>randomUUID();
 const ref={id:id(),version:1,contentHash:'a'.repeat(64)};
 const context={transport:'SYNTHETIC_ONLY',mode,projectId:id(),connectorId:id(),executionId:id(),executionGeneration:1,grantRef:ref,scopeDigest:'b'.repeat(64),credentialGeneration:2,publicKeyFingerprint:publicKeyFingerprint(spki),grantExpiresAt:'2026-10-19T12:10:00.000Z'};
 const scope={mode,projectId:context.projectId,connectorId:context.connectorId,executionId:context.executionId,executionGeneration:1,grantRef:ref,credentialGeneration:2};
 const base='/api/v1/connectors/'+context.connectorId+'/executions/'+context.executionId+(mode==='RECOVERY'?'/recovery':'');
 let at='2026-10-19T12:00:00.000Z',events:any[]=[],effects=0,fail=false,complete=true,mutateResult=false,revokeOnResult=false,resultRef:any=null,gate=Promise.resolve();
 const storage:any={transport:'SYNTHETIC_ONLY',transaction:async(_scope:any,body:any)=>{let release!:()=>void;const prior=gate;gate=new Promise<void>(r=>release=r);await prior;const saved=structuredClone(events),before=effects;
  try{return await body({current:async()=>{if(mutateResult&&resultRef)resultRef.contentHash='e'.repeat(64);if(revokeOnResult&&resultRef)context.credentialGeneration++;return{context:structuredClone(context),spki,checkedAt:at};},clock:async()=>at,read:async()=>({complete,events:structuredClone(events)}),append:async(value:any)=>{events.push(structuredClone(value));if(fail)throw Error('SYNTHETIC_STORAGE_FAILURE');},recordResult:async()=>{effects++;resultRef={id:id(),version:1,contentHash:'c'.repeat(64)};return resultRef;}});}
  catch(error){events=saved;effects=before;throw error;}finally{release();}
 }};
 const service=new m.SyntheticExecutionChallenges(storage);
 const request=(purpose='EXECUTION_REQUEST')=>({requestId:id(),purpose,grantRef:ref,credentialGeneration:2,target:{method:'POST',path:base+(purpose==='CREDENTIAL_EXCHANGE'?'/credential-exchange':'/observations'),queryHash:'c'.repeat(64),bodyHash:'d'.repeat(64)},clientNonce:Buffer.from(id().replaceAll('-','').padEnd(32,'a').slice(0,32)).toString('base64url'),issuedAt:at});
 const issue=(p=request())=>service.issue(scope,p,sign('sha256',executionChallengeRequestBytes(mode,p),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));
 const proof=(challenge:any,p:any)=>p.purpose==='CREDENTIAL_EXCHANGE'?{requestId:p.requestId,grantRef:ref,credentialGeneration:2,scopeDigest:context.scopeDigest,serverNonce:challenge.serverNonce,clientNonce:p.clientNonce,expiresAt:challenge.expiresAt}:{requestId:p.requestId,...p.target,grantRef:ref,credentialGeneration:2,serverNonce:challenge.serverNonce};
 const consume=(issued:any,p:any)=>{const value=proof(issued.challenge,p),kind=(mode==='RECOVERY'?'EXECUTION_RECOVERY_':'EXECUTION_')+(p.purpose==='CREDENTIAL_EXCHANGE'?'CREDENTIAL_EXCHANGE':'REQUEST_PROOF');return service.consume(scope,issued.ref,value,sign('sha256',executionProofBytes(kind as any,value),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));};
 return{service,storage,context,scope,request,issue,consume,proof,events:()=>events,effects:()=>effects,at:(n:number)=>at=new Date(Date.parse(at)+n).toISOString(),fail:()=>fail=true,incomplete:()=>complete=false,mutateResult:()=>mutateResult=true,revokeOnResult:()=>revokeOnResult=true};
}
test('합성 challenge는 같은 transaction에 정확 발급을 기록하고 동일 request/hash 재조회는 nonce/기한을 새로 만들지 않는다',async()=>{
 const f=fixture(),p=f.request('CREDENTIAL_EXCHANGE'),a=await f.issue(p);f.at(60000);const b=await f.issue(p);
 assert.deepEqual(a,b);assert.equal(f.events().length,1);assert.equal(a.challenge.expiresAt,'2026-10-19T12:02:00.000Z');assert.equal(a.credentialIssued,false);
 await assert.rejects(f.issue({...p,clientNonce:Buffer.alloc(32,9).toString('base64url')}),/IDEMPOTENCY_CONFLICT/);
});
test('정확 proof의 첫 소비·결과ref·불변 전이는 원자적이고 응답유실 재조회는 효과를 반복하지 않는다',async()=>{
 for(const mode of ['EXECUTION','RECOVERY'] as const){const f=fixture(mode),p=f.request(),issued=await f.issue(p),a=await f.consume(issued,p);f.at(40000);const b=await f.consume(issued,p);
  assert.deepEqual(a,b);assert.equal(f.effects(),1);assert.equal(f.events().length,2);assert.equal(a.nonceConsumed,true);assert.equal(a.dispatchPerformed,false);
 }
});
test('동시 같은 proof는 효과1개이며 저장실패는 발급·소비·효과를 모두 rollback한다',async()=>{
 const f=fixture(),p=f.request(),issued=await f.issue(p);const results=await Promise.all([f.consume(issued,p),f.consume(issued,p)]);assert.deepEqual(results[0],results[1]);assert.equal(f.effects(),1);
 const failed=fixture(),p2=failed.request(),issued2=await failed.issue(p2);failed.fail();await assert.rejects(failed.consume(issued2,p2),/SYNTHETIC_STORAGE_FAILURE/);assert.equal(failed.effects(),0);assert.equal(failed.events().length,1);
 const failedIssue=fixture();failedIssue.fail();await assert.rejects(failedIssue.issue(),/SYNTHETIC_STORAGE_FAILURE/);assert.equal(failedIssue.events().length,0);
});
test('살아있는 요청 challenge1개·교환 분당5개와 clientNonce 중복을 거절한다',async()=>{
 const f=fixture(),p=f.request();await f.issue(p);await assert.rejects(f.issue(),/CHALLENGE_ACTIVE/);f.at(30001);const p2=f.request();await f.issue(p2);
 const exchange=fixture();for(let n=0;n<5;n++)await exchange.issue(exchange.request('CREDENTIAL_EXCHANGE'));await assert.rejects(exchange.issue(exchange.request('CREDENTIAL_EXCHANGE')),/RATE_LIMIT/);
 const nonce=fixture(),n=nonce.request('CREDENTIAL_EXCHANGE');await nonce.issue(n);await assert.rejects(nonce.issue({...n,requestId:randomUUID()}),/CLIENT_NONCE_REUSED/);
});
test('만료 첫소비·바뀐 현재 세대/등록키·불완전 이력은 거절하고 과거 기록은 보존한다',async()=>{
 const expired=fixture(),p=expired.request(),issued=await expired.issue(p);expired.at(30000);await assert.rejects(expired.consume(issued,p));assert.equal(expired.effects(),0);
 const changed=fixture(),p2=changed.request(),issued2=await changed.issue(p2);changed.context.credentialGeneration++;await assert.rejects(changed.consume(issued2,p2));assert.equal(changed.events().length,1);
 const unknown=fixture();unknown.incomplete();await assert.rejects(unknown.issue(),/LEDGER_INCOMPLETE/);assert.equal(unknown.events().length,0);
});
test('현재 참조·nonce·body 불일치와 다른 hash 소비는 기존 소비 결과를 바꾸지 않는다',async()=>{
 const f=fixture(),p=f.request(),issued=await f.issue(p);await f.consume(issued,p);const before=canonicalJson(f.events());
 await assert.rejects(f.consume(issued,{...p,target:{...p.target,bodyHash:'e'.repeat(64)}}),/IDEMPOTENCY_CONFLICT/);assert.equal(canonicalJson(f.events()),before);assert.equal(f.effects(),1);
 const g=fixture(),p2=g.request(),issued2=await g.issue(p2);await assert.rejects(g.consume({...issued2,ref:{...issued2.ref,contentHash:'f'.repeat(64)}},p2));assert.equal(g.effects(),0);
});
test('저장 port가 await 중 반환 객체를 바꿔도 처음 받은 결과ref를 보존한다',async()=>{
 const f=fixture(),p=f.request(),issued=await f.issue(p);f.mutateResult();const result=await f.consume(issued,p);
 assert.equal(result.resultRef.contentHash,'c'.repeat(64));assert.equal(f.events()[1].snapshot.consumption.resultRef.contentHash,'c'.repeat(64));
});
test('요청 분당60개와 지연 중 현재세대 변경은 저장 효과를 늘리지 않는다',async()=>{
 const f=fixture();for(let n=0;n<60;n++){const p=f.request(),issued=await f.issue(p);await f.consume(issued,p);}
 assert.equal(f.effects(),60);await assert.rejects(f.issue(),/RATE_LIMIT/);assert.equal(f.events().length,120);
 f.at(60000);await f.issue();assert.equal(f.events().length,121);
 const changed=fixture(),p=changed.request(),issued=await changed.issue(p);changed.revokeOnResult();await assert.rejects(changed.consume(issued,p),/CURRENT_BINDING_REQUIRED/);assert.equal(changed.effects(),0);assert.equal(changed.events().length,1);
});
