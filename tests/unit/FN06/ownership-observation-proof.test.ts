import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateKeyPairSync,sign} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
const m=await import(new URL('../../../apps/server/modules/executions/ownership-observation-proof.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function verify(...args:any[]){assert.equal(typeof m.verifyOwnershipObservationProofV1,'function','관측 서명 검증이 필요하다');return m.verifyOwnershipObservationProofV1(...args);}
// Existing unit-test P256 pattern only: ephemeral synthetic key, never persisted/registered or used by a host.
const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url');
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:String(n%10).repeat(64)});
function fixture(current=false){
 const process={runId:id(20),generation:1,jobId:id(21),pid:100,startTicks:'638960000000000001',executableHash:'c'.repeat(64)};
 const facts={processRef:process,state:current?'RUNNING':'PREPARED',everResumed:current,active:1,processes:[{pid:100,startTicks:process.startTicks,inJob:true,executableHash:process.executableHash}],killOnClose:false,fileSandboxVerified:false};
 const expected={protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',installationId:id(1),projectId:id(2),executionId:id(3),executionGeneration:1,registrationRef:ref(4),publicKeyFingerprint:publicKeyFingerprint(spki),observerRef:ref(5),anchorRef:ref(6),preparationRef:ref(7),requestRef:ref(8),phase:current?'CURRENT':'BOOTSTRAP_PREPARED',expectedHeadRef:current?ref(9):null,nonce:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',requestedAt:'2026-10-23T00:00:00.000Z',expiresAt:'2026-10-23T00:00:10.000Z'};
 const report={...expected,factsHash:contentHash(canonicalJson(facts)),observedAt:'2026-10-23T00:00:00.001Z'},now=Date.parse(report.observedAt);
 const signed=(value:unknown,domain=true,der=false)=>sign('sha256',Buffer.concat([domain?Buffer.from('ANVIL_OWNERSHIP_OBSERVATION_V1\0','ascii'):Buffer.alloc(0),Buffer.from(canonicalJson(value))]),{key:key.privateKey,dsaEncoding:der?'der':'ieee-p1363'}).toString('base64url');
 return{process,facts,expected,report,now,signed};
}
test('합성 P256 서명을 실제 검사하되 실행·관측 권한을 만들지 않는다',()=>{
 for(const current of [false,true]){const f=fixture(current),r=verify(spki,f.signed(f.report),f.report,f.expected,f.facts,f.process,f.now);assert.equal(r.purpose,'OWNERSHIP_SIGNATURE_ONLY');assert.equal(r.executionAuthorized,false);assert.equal(r.dispatchPerformed,false);assert.deepEqual(r.report,f.report);assert.deepEqual(r.facts,f.facts);assert.notEqual(r.report,f.report);}
});
test('등록용/무prefix/DER·변조·잘못된 키 형식은 비밀 없는 고정 오류로 거절한다',()=>{
 const f=fixture(),sig=f.signed(f.report),bad=Buffer.from(sig,'base64url');bad[0]=bad[0]!^1;
 for(const [pk,s] of [[spki,f.signed(f.report,false)],[spki,f.signed(f.report,true,true)],[spki,bad.toString('base64url')],[spki,sig+'='],[spki,Buffer.alloc(64).toString('base64url')],['not-a-key',sig],[spki+'=',sig],[spki,'aZhA47aTCmTeqsUuG11Qv9O-wRQnDqHPJBskAelZ_LrUpG3s2z632jdVeYDW7u-Fc2pdIq6c1W7BQ3TmFTiAeQ']])assert.throws(()=>verify(pk,s,f.report,f.expected,f.facts,f.process,f.now),{message:'OWNERSHIP_OBSERVATION_PROOF_INVALID'});
});
test('유효 서명만으로 다른 원요청·facts·원process·만료를 수용하지 않는다',()=>{
 const f=fixture(),sig=f.signed(f.report);
 const otherFingerprint={...f.report,publicKeyFingerprint:'e'.repeat(64)},otherExpected={...f.expected,publicKeyFingerprint:'e'.repeat(64)};
 assert.throws(()=>verify(spki,f.signed(otherFingerprint),otherFingerprint,otherExpected,f.facts,f.process,f.now),{message:'OWNERSHIP_OBSERVATION_PROOF_INVALID'});
 for(const [r,e,facts,p,now] of [[{...f.report,projectId:id(99)},f.expected,f.facts,f.process,f.now],[f.report,{...f.expected,requestRef:ref(99)},f.facts,f.process,f.now],[f.report,{...f.expected,publicKeyFingerprint:'e'.repeat(64)},f.facts,f.process,f.now],[f.report,f.expected,{...f.facts,fileSandboxVerified:true},f.process,f.now],[f.report,f.expected,f.facts,{...f.process,jobId:id(99)},f.now],[f.report,f.expected,f.facts,f.process,Date.parse(f.report.expiresAt)]])assert.throws(()=>verify(spki,r===f.report?sig:f.signed(r),r,e,facts,p,now),{message:'OWNERSHIP_OBSERVATION_PROOF_INVALID'});
});
