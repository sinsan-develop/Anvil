import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticExecutionRequestRouter} from '../../../apps/server/modules/executions/execution-routes.ts';
import {executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
const mod:any=await import('../../../apps/server/modules/executions/execution-credential-current.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',ref={id:pid,version:1,contentHash:'a'.repeat(64)},hash=(v:unknown)=>contentHash(canonicalJson(v)),at=Date.parse('2026-10-19T10:00:00.000Z');
function fixture(mode='EXECUTION'){
 assert.equal(typeof mod.SyntheticExecutionCredentialCurrent,'function');const token=(mode==='RECOVERY'?'av3er1_':'av3ex1_')+'s'.repeat(43),digest=createHash('sha256').update(token).digest('hex'),scope={mode,projectId:pid,connectorId:pid,executionId:eid,executionGeneration:2,grantRef:ref,credentialGeneration:3};
 const snapshot:any={transport:'SYNTHETIC_ONLY',state:'SYNTHETIC_BOUND_NO_AUTHORITY',purpose:mode==='RECOVERY'?'EXECUTION_RECOVERY_ONLY':'EXECUTION_DISPATCH_ONLY',scope,tokenDigest:digest,registrationRef:ref,publicKeyFingerprint:'b'.repeat(64),issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+(mode==='RECOVERY'?300000:900000)).toISOString(),credentialIssued:false,executionAuthorized:false,dispatchPerformed:false};
 const current:any={transport:'SYNTHETIC_ONLY',credential:{ref:{...ref,contentHash:hash(snapshot)},snapshot},credentialState:'VERIFIED_CURRENT',grantState:'ACTIVE',scope:structuredClone(scope),registrationRef:ref,publicKeyFingerprint:'b'.repeat(64),checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString()},seen:string[]=[];let clock=at,calls=0,after=()=>{};
 const store:any={transport:'SYNTHETIC_ONLY',transaction:async(key:string,fn:any)=>{seen.push(key);return fn({current:async()=>{calls++;if(calls===2)after();return structuredClone(current);},clock:async()=>new Date(clock).toISOString()});}},service=new mod.SyntheticExecutionCredentialCurrent(store),input={mode,connectorId:pid,executionId:eid,credential:token};
 return{service,store,current,snapshot,scope,token,digest,seen,input,run:()=>service.current(input),rehash:()=>current.credential.ref.contentHash=hash(snapshot),after:(fn:()=>void)=>after=fn,advance:(ms:number)=>clock=at+ms};
}
test('현재성 resolver는 합성 digest기록의 정확범위·현재상태·최단기한만 반환하고 토큰발급/원문전달을 하지 않는다',async()=>{
 const f=fixture(),v=await f.run();assert.deepEqual(f.seen,[f.digest]);assert(!f.seen.includes(f.token));assert.deepEqual(v.scope,f.scope);assert.equal(v.expiresAt,f.current.expiresAt);assert.equal(v.executionAuthorized,false);assert.equal(v.dispatchPerformed,false);assert(!JSON.stringify(v).includes(f.token));assert.deepEqual(Object.keys(v).sort(),['checkedAt','dispatchPerformed','executionAuthorized','expiresAt','scope','transport']);v.scope.executionGeneration=9;assert.equal(f.scope.executionGeneration,2);
});
test('회수·불명·다른실행/세대·등록·digest·실발급/권한 true와hash불일치는 현재credential로 반환하지 않는다',async()=>{
 for(const mutate of [(f:any)=>f.current.grantState='REVOKED',(f:any)=>f.current.credentialState='UNKNOWN',(f:any)=>f.current.scope.executionGeneration=9,(f:any)=>f.current.registrationRef={...ref,version:2},(f:any)=>f.current.publicKeyFingerprint='c'.repeat(64),(f:any)=>f.snapshot.tokenDigest='0'.repeat(64),(f:any)=>f.snapshot.credentialIssued=true,(f:any)=>f.snapshot.executionAuthorized=true,(f:any)=>f.current.credential.ref.contentHash='0'.repeat(64),(f:any)=>f.input.executionId=pid]){const f=fixture();mutate(f);if(f.current.credential.ref.contentHash!=='0'.repeat(64))f.rehash();await assert.rejects(f.run(),/EXECUTION_CREDENTIAL_NOT_CURRENT/);}
});
test('EXECUTION15분/RECOVERY5분·prefix/purpose·현재기한을 지키며 기존등록credential이나fallback은 거절한다',async()=>{
 for(const mode of ['EXECUTION','RECOVERY']){const f=fixture(mode);assert.deepEqual((await f.run()).scope,f.scope);f.snapshot.expiresAt=new Date(at+(mode==='RECOVERY'?300001:900001)).toISOString();f.rehash();await assert.rejects(f.run());}
 for(const prefix of ['av3ct1_','av3sr1_','av3er1_']){const f=fixture();f.input.credential=prefix+'s'.repeat(43);await assert.rejects(f.run());assert.equal(f.seen.length,0);}
 const f=fixture('RECOVERY');f.snapshot.purpose='EXECUTION_DISPATCH_ONLY';f.rehash();await assert.rejects(f.run());const g=fixture();g.store.transport='REAL';await assert.rejects(g.run());assert.throws(()=>new mod.SyntheticExecutionCredentialCurrent({transport:'SYNTHETIC_ONLY'}));
});
test('전후 current/등록·기한 변경과마지막 await중만료를 정상으로 반환하거나 자동 연장하지 않는다',async()=>{
 for(const change of [(f:any)=>f.current.credentialState='REVOKED',(f:any)=>f.current.registrationRef={...ref,version:4},(f:any)=>f.current.expiresAt=new Date(at+1000).toISOString(),(f:any)=>f.advance(30001)]){const f=fixture();f.after(()=>change(f));await assert.rejects(f.run());}
 const f=fixture();f.current.checkedAt=new Date(at-30001).toISOString();await assert.rejects(f.run());
});
test('최종 clock이 provider 실제 관측후31초라면 조회clock으로 checkedAt을 갱신해 통과시키지 않는다',async()=>{
 const f=fixture();f.current.expiresAt=new Date(at+120000).toISOString();const original=f.store.transaction;let n=0;
 f.store.transaction=(key:string,fn:any)=>original(key,(tx:any)=>fn({...tx,clock:async()=>new Date(at+(++n<3?29000:31000)).toISOString()}));
 await assert.rejects(f.run(),/EXECUTION_CREDENTIAL_NOT_CURRENT/);
});
test('기존 정규화 분기는 실제 새resolver를 주입해 scope를 선택하고 회수시 관측backend 호출 전 거절한다 (합성 in-process)',async()=>{
 const f=fixture(),calls:any[]=[],path='/api/v1/connectors/'+pid+'/executions/'+eid+'/observations',bodyRaw='{"events":[]}',target=executionTarget('POST',path,[],bodyRaw),result={transport:'SYNTHETIC_ONLY',executionAuthorized:false,dispatchPerformed:false};
 const router=new SyntheticExecutionRequestRouter({transport:'SYNTHETIC_ONLY',clock:()=>new Date(at).toISOString(),credentials:f.service,observations:{transport:'SYNTHETIC_ONLY',ingest:async(...args:any[])=>{calls.push(args);return result;}},permits:{transport:'SYNTHETIC_ONLY',consume:async()=>{throw Error('UNUSED');}},materials:{transport:'SYNTHETIC_ONLY',readWithDeadline:async()=>{throw Error('UNUSED');}},stopInstructions:{transport:'SYNTHETIC_ONLY',read:async()=>{throw Error('UNUSED');}}} as any);
 const request={method:'POST',path,query:[],bodyRaw,cookie:null,credential:f.token,challengeRef:ref,proof:{requestId:pid,...target,grantRef:ref,credentialGeneration:3,serverNonce:'n'.repeat(43)},signature:'a'.repeat(86)};
 assert.deepEqual((await router.handle(request)).data,result);assert.deepEqual(calls[0][0],f.scope);assert.equal(f.seen.length,2);assert(f.seen.every(v=>v===f.digest));calls.length=0;f.current.grantState='REVOKED';await assert.rejects(router.handle(request));assert.equal(calls.length,0);
 f.current.grantState='ACTIVE';f.current.expiresAt=new Date(at+120000).toISOString();const original=f.store.transaction;let n=0;f.store.transaction=(key:string,fn:any)=>original(key,(tx:any)=>fn({...tx,clock:async()=>new Date(at+(++n<3?29000:31000)).toISOString()}));await assert.rejects(router.handle(request));assert.equal(calls.length,0);
});
