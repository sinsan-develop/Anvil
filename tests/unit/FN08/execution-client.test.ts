import assert from 'node:assert/strict';
import test from 'node:test';
import {generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {verifyExecutionChallengeRequest,verifyExecutionProof} from '../../../apps/server/modules/executions/execution-proof.ts';
const m:any=await import('../../../apps/connector/runtime/execution-client.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v)),initial='2026-10-19T12:00:00.000Z';
function fixture(mode:'EXECUTION'|'RECOVERY'='EXECUTION'){
 const id=randomUUID(),eid=randomUUID(),ref={id,version:1,contentHash:'a'.repeat(64)},key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const scope={mode,projectId:id,connectorId:id,executionId:eid,executionGeneration:1,grantRef:ref,credentialGeneration:1};let clock=Date.parse(initial),challengeCalls=0,performCalls=0,signCalls=0,fault='',incomplete=false,tail=Promise.resolve(),lateResolve:(()=>void)|undefined;
 const streams=new Map<string,any[]>(),issued=new Map<string,any>(),context=()=>({transport:'SYNTHETIC_ONLY',...scope,scopeDigest:'b'.repeat(64),publicKeyFingerprint:publicKeyFingerprint(spki),grantExpiresAt:'2026-10-19T12:01:00.000Z'});
 const store:any={transport:'SYNTHETIC_ONLY',exclusive:async(s:any,fn:any)=>{const prior=tail;let release!:()=>void;tail=new Promise(r=>release=r);await prior;let rows=streams.get(s.requestKey);if(!rows){rows=[];streams.set(s.requestKey,rows);}try{return await fn({read:async()=>({complete:!incomplete,events:structuredClone(rows)}),appendAndSync:async(e:any)=>{if(fault==='sync'&&e.snapshot.state==='CHALLENGE_ATTEMPTED'){incomplete=true;throw Error('PRIVATE_TOKEN_SYNC');}rows!.push(structuredClone(e));}});}finally{release();}}};
 const authority:any={transport:'SYNTHETIC_ONLY',current:async(v:any)=>({transport:'SYNTHETIC_ONLY',scope:structuredClone(scope),requestKey:v.requestKey,target:structuredClone(v.target),checkedAt:new Date(clock).toISOString(),expiresAt:context().grantExpiresAt})};
 const signer:any={transport:'SYNTHETIC_ONLY',sign:async(_purpose:string,bytes:Buffer)=>{signCalls++;return sign('sha256',bytes,{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');}};
 const transport:any={transport:'SYNTHETIC_ONLY',challenge:async(_s:any,request:any,signature:string)=>{
  challengeCalls++;assert.equal([...streams.values()].flat().at(-1).snapshot.state,'CHALLENGE_ATTEMPTED');verifyExecutionChallengeRequest(spki,signature,request,request,context(),new Date(clock));if(fault==='challenge')throw Error('PRIVATE_TOKEN_CHALLENGE_LOST');
  const challenge={id:randomUUID(),requestId:request.requestId,purpose:'EXECUTION_REQUEST',grantRef:ref,credentialGeneration:1,scopeDigest:context().scopeDigest,serverNonce:randomBytes(32).toString('base64url'),clientNonce:request.clientNonce,issuedAt:new Date(clock).toISOString(),expiresAt:new Date(clock+30000).toISOString()};
  issued.set(challenge.id,{challenge,request});if(fault==='expired')clock+=31000;const out={ref:{id:challenge.id,version:1,contentHash:'c'.repeat(64)},challenge,credentialIssued:false,nonceConsumed:false,executionAuthorized:false,dispatchPerformed:false};if(fault==='challengeMismatch')out.challenge.clientNonce=randomBytes(32).toString('base64url');return out;
 },perform:async(_s:any,operation:any,challengeRef:any,proof:any,signature:string,bodyRaw:string)=>{
  performCalls++;assert.equal([...streams.values()].flat().at(-1).snapshot.state,'REQUEST_ATTEMPTED');const x=issued.get(challengeRef.id),expected={requestId:x.request.requestId,...x.request.target,grantRef:ref,credentialGeneration:1,serverNonce:x.challenge.serverNonce};verifyExecutionProof(spki,signature,mode==='RECOVERY'?'EXECUTION_RECOVERY_REQUEST_PROOF':'EXECUTION_REQUEST_PROOF',proof,expected,context(),{issuedAt:x.challenge.issuedAt,expiresAt:x.challenge.expiresAt},new Date(clock));assert.equal(proof.bodyHash,hash(JSON.parse(bodyRaw)));
  if(fault==='perform')throw Error('PRIVATE_TOKEN_RESPONSE_LOST');if(fault==='timeout')await new Promise<void>(r=>lateResolve=r);
  if(operation.kind==='PERMIT')return{transport:'SYNTHETIC_ONLY',proofResultRef:ref,permit:{transport:'SYNTHETIC_ONLY',key:{projectId:id,executionId:eid,executionGeneration:1,commandId:id},envelopeHash:JSON.parse(bodyRaw).envelopeHash,grantRef:ref,permitRef:ref,checkedAt:new Date(clock).toISOString(),expiresAt:new Date(clock+10000).toISOString(),executionAuthorized:false,dispatchPerformed:false},nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  const events=JSON.parse(bodyRaw).events,snapshot={execution:{projectId:id,executionId:eid,executionGeneration:1},highestContiguous:1,maxSequence:1,contiguousDigest:hash({previous:hash([]),eventHash:hash(events[0])}),gaps:[],storedCount:1,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false,recordedAt:new Date(clock).toISOString()};if(fault==='unsafeAck')snapshot.writerReleaseVerified=true;
  return{transport:'SYNTHETIC_ONLY',proofResultRef:ref,ack:{ref:{id,version:1,contentHash:hash(snapshot)},snapshot},nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
 }};
 const body={envelopeHash:'d'.repeat(64),localAttemptRef:ref,sourceObservationRefs:[ref],osOwnershipRef:ref},permit={kind:'PERMIT',commandId:id,bodyRaw:canonicalJson(body)};
 const event={projectId:id,executionId:eid,executionGeneration:1,sequence:1,eventId:randomUUID(),type:'UNKNOWN',commandId:id,envelopeHash:'d'.repeat(64),localRecordRef:ref,processRef:null,occurredAt:initial,reasonCode:'PROVIDER_RESPONSE_LOST'},observations={kind:'OBSERVATIONS',commandId:null,bodyRaw:canonicalJson({events:[event],batchHash:hash([event])})};
 const make=()=>{assert.equal(typeof m.SyntheticExecutionClient,'function');return new m.SyntheticExecutionClient(store,authority,signer,transport,{clock:()=>clock,timeoutMs:20});};
 return{scope,body,permit,observations,make,store,authority,signer,transport,streams,counts:()=>[challengeCalls,performCalls,signCalls],fault:(v:string)=>fault=v,advance:(ms:number)=>clock+=ms,releaseLate:()=>lateResolve?.(),incomplete:()=>incomplete=true};
}
test('client는 서명 전후 정확 요청과 두 전송시도를 sync하고 재시작/동시 재조회는 같은 결과·nonce를 보존한다',async()=>{
 const f=fixture(),[a,b]=await Promise.all([f.make().execute(f.scope,f.permit),f.make().execute(f.scope,f.permit)]);assert.deepEqual(a,b);assert.equal(a.state,'RESPONSE_RECORDED');assert.deepEqual(f.counts(),[1,1,2]);
 const rows=[...f.streams.values()][0];assert(rows);assert.deepEqual(rows.map((e:any)=>e.snapshot.state),['PREPARED','CHALLENGE_ATTEMPTED','CHALLENGE_RECEIVED','REQUEST_ATTEMPTED','RESPONSE_RECORDED']);f.advance(120000);assert.deepEqual(await f.make().execute(f.scope,f.permit),a);assert.deepEqual(f.counts(),[1,1,2]);assert.equal(a.executionAuthorized,false);
});
test('challenge 또는 본요청 응답유실은 UNKNOWN이며 같은/다른 본문으로 새 nonce·자동 재전송을 만들지 않는다',async()=>{
 for(const fault of ['challenge','perform']){const f=fixture();f.fault(fault);const a=await f.make().execute(f.scope,f.permit);assert.equal(a.state,'UNKNOWN');const counts=f.counts();assert.deepEqual(await f.make().execute(f.scope,f.permit),a);assert.deepEqual(f.counts(),counts);await assert.rejects(f.make().execute(f.scope,{...f.permit,bodyRaw:canonicalJson({...f.body,localAttemptRef:{...f.body.localAttemptRef,version:2}})}));assert.deepEqual(f.counts(),counts);}
});
test('시도 sync 불명/불완전·변조 기록은 전송 없이 보존하고 원문 오류를 숨긴다',async()=>{
 const f=fixture();f.fault('sync');await assert.rejects(f.make().execute(f.scope,f.permit),(e:Error)=>!e.message.includes('PRIVATE_TOKEN'));assert.deepEqual(f.counts().slice(0,2),[0,0]);await assert.rejects(f.make().execute(f.scope,f.permit));assert.deepEqual(f.counts().slice(0,2),[0,0]);
 const g=fixture();await g.make().execute(g.scope,g.permit);const rows=[...g.streams.values()][0];assert(rows);rows[0].snapshot.payload.scope.credentialGeneration=2;await assert.rejects(g.make().execute(g.scope,g.permit));assert.deepEqual(g.counts(),[1,1,2]);
});
test('만료/다른 clientNonce challenge는 proof를 전송하지 않고 유한 timeout 뒤 늦은 응답도 UNKNOWN을 바꾸지 않는다',async()=>{
 for(const fault of ['expired','challengeMismatch']){const f=fixture();f.fault(fault);assert.equal((await f.make().execute(f.scope,f.permit)).state,'UNKNOWN');assert.equal(f.counts()[1],0);}
 const f=fixture();f.fault('timeout');const a=await f.make().execute(f.scope,f.permit);assert.equal(a.state,'UNKNOWN');f.releaseLate();await Promise.resolve();assert.deepEqual(await f.make().execute(f.scope,f.permit),a);assert.equal(f.counts()[1],1);
});
test('실행/회수 관측의 정확 ACK를 보존하되 spool 삭제·writer 회수나 실행 완료로 승격하지 않는다',async()=>{
 for(const mode of ['EXECUTION','RECOVERY'] as const){const f=fixture(mode),out=await f.make().execute(f.scope,f.observations);assert.equal(out.state,'RESPONSE_RECORDED');assert.equal(out.ackAudited,false);assert.equal(out.writerReleaseVerified,false);assert.equal(out.dispatchPerformed,false);assert.equal(out.response.ack.snapshot.highestContiguous,1);}
 const f=fixture();f.fault('unsafeAck');assert.equal((await f.make().execute(f.scope,f.observations)).state,'UNKNOWN');assert.equal(f.counts()[1],1);
});
test('비합성/없는 필수 port·비밀 자유필드·회수 permit은 저장/전송하지 않는다',async()=>{
 const f=fixture();assert.equal(typeof m.SyntheticExecutionClient,'function');for(const port of ['store','authority','signer','transport'] as const){const ports=[f.store,f.authority,f.signer,f.transport],i=['store','authority','signer','transport'].indexOf(port);ports[i]={...ports[i],transport:'REAL'};assert.throws(()=>new m.SyntheticExecutionClient(...ports,{clock:()=>Date.parse(initial),timeoutMs:20}));}
 await assert.rejects(f.make().execute(f.scope,{...f.permit,bodyRaw:canonicalJson({...f.body,message:'PRIVATE_TOKEN'})}));const recovery=fixture('RECOVERY');await assert.rejects(recovery.make().execute(recovery.scope,recovery.permit));assert.equal(f.streams.size,0);assert.equal(recovery.streams.size,0);
});
test('서명 뒤 축소된 현재 기한이 시도 sync 중 지나면 perform0·UNKNOWN을 보존한다',async()=>{
 const f=fixture(),sign=f.signer.sign,current=f.authority.current,exclusive=f.store.exclusive;let shortened=false;
 f.signer.sign=async(...args:any[])=>{const out=await sign(...args);if(args[0]==='EXECUTION_REQUEST_PROOF')shortened=true;return out;};
 f.authority.current=async(v:any)=>({...await current(v),expiresAt:shortened?'2026-10-19T12:00:05.000Z':'2026-10-19T12:01:00.000Z'});
 f.store.exclusive=(s:any,fn:any)=>exclusive(s,(tx:any)=>fn({...tx,appendAndSync:async(e:any)=>{await tx.appendAndSync(e);if(e.snapshot.state==='REQUEST_ATTEMPTED')f.advance(6000);}}));
 const out=await f.make().execute(f.scope,f.permit);assert.equal(out.state,'UNKNOWN');assert.equal(f.counts()[1],0);assert.equal([...f.streams.values()][0]?.at(-1).snapshot.state,'UNKNOWN');
});
test('제출 seq2가 ACK의 gap2에 남아 있으면 정상 hash라도 UNKNOWN/INVALID_RESPONSE이며 자동 재전송0이다',async()=>{
 const f=fixture(),body=JSON.parse(f.observations.bodyRaw);body.events[0].sequence=2;body.batchHash=hash(body.events);const operation={...f.observations,bodyRaw:canonicalJson(body)},perform=f.transport.perform;
 f.transport.perform=async(...args:any[])=>{const out=await perform(...args);Object.assign(out.ack.snapshot,{highestContiguous:1,maxSequence:3,gaps:[{from:2,to:2}],storedCount:2});out.ack.ref.contentHash=hash(out.ack.snapshot);return out;};
 const first=await f.make().execute(f.scope,operation);assert.equal(first.state,'UNKNOWN');assert.equal(first.reason,'INVALID_RESPONSE');assert.deepEqual(await f.make().execute(f.scope,operation),first);assert.equal(f.counts()[1],1);
});
