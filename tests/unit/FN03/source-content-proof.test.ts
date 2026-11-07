import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateKeyPairSync,sign,type KeyObject} from 'node:crypto';
import {proofBytes} from '../../../apps/server/modules/connections/registration-proof.ts';
import {readSourceReadPreflightV1} from '../../../contracts/runtime/source-read-observation-v1.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {sourceContentPreflightProofBytesV1,sourceContentChallengeProofBytesV1} from '../../../contracts/runtime/source-content-exchange-v1.ts';
import {readSourceContentScopeV1,sourceContentReportProofBytesV1} from '../../../contracts/runtime/source-content-report-v1.ts';

const subject=await import(new URL('../../../apps/server/modules/connections/source-content-proof.ts',import.meta.url).href).catch(error=>{
 if(error.code==='ERR_MODULE_NOT_FOUND')return {};
 throw error;
});
function verifier(name:string):(...args:unknown[])=>Record<string,unknown>{
 assert.equal(typeof subject[name],'function','서명 검산 함수 부재');
 return subject[name];
}
const id=(n:number)=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const zero=Date.parse('2026-10-23T05:00:00.000Z');
const at=(offset:number)=>new Date(zero+offset).toISOString();
const hash=(value:unknown)=>contentHash(canonicalJson(value));
function memoryKey(){
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const der=keys.publicKey.export({format:'der',type:'spki'});
 return {...keys,spki:der.toString('base64url'),fingerprint:contentHash(der)};
}
function signature(bytes:Buffer,key:KeyObject){
 return sign('sha256',bytes,{key,dsaEncoding:'ieee-p1363'}).toString('base64url');
}
function fixture(){
 const key=memoryKey(),blobHash=contentHash(Buffer.from([13,10]));
 const scope=readSourceContentScopeV1({
  protocolVersion:1,purpose:'SOURCE_DOCUMENT_CONTENT_HASH',installationId:id(1),projectId:id(2),
  sourceRootRef:ref(3),connectorRef:ref(4),registrationRef:ref(5),observerRef:ref(6),
  hostFingerprint:key.fingerprint,pathHintHash:contentHash('D:\\Synthetic'),userId:id(7),clientId:id(8),
  credentialGeneration:2,controlGeneration:3,basePolicyRef:ref(9),contentPolicyRef:ref(10),
  targets:[{relativePath:'src/main.ts',documentRef:ref(11),documentBlobRef:{artifactId:id(12),bytes:2,contentHash:blobHash,mediaType:'text/plain'}}],
  limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576},
  requestedAt:at(0),expiresAt:at(600000),reason:'합성 서명 검산',
 });
 const requestRef={...ref(13),contentHash:hash(scope)};
 const exchange={scope,requestRef,publicKeyFingerprint:key.fingerprint};
 const preflight={
  protocolVersion:1,purpose:'SOURCE_CONTENT_PREFLIGHT',installationId:scope.installationId,projectId:scope.projectId,
  connectorRef:scope.connectorRef,registrationRef:scope.registrationRef,observerRef:scope.observerRef,requestRef,
  scopeDigest:requestRef.contentHash,publicKeyFingerprint:key.fingerprint,clientNonce:Buffer.alloc(32,7).toString('base64url'),expiresAt:at(120000),
 };
 const challenge={...preflight,purpose:'SOURCE_CONTENT_EXCHANGE',serverNonce:Buffer.alloc(32,8).toString('base64url'),issuedAt:at(1000),expiresAt:at(61000)};
 const context={scope,declaredPathHint:'D:\\Synthetic',requestRef,observationRequestRef:ref(14),
  observationNonce:Buffer.alloc(32,9).toString('base64url'),issuedAt:at(1000),observeBefore:at(61000),receivedAt:at(4000)};
 const facts={kind:'REGULAR_FILE',volumeSerialHex:'0000000000000001',fileIdHex:'1'.repeat(32),reparse:false,
  linkCountDecimal:'1',sizeBytesDecimal:'2',lastWriteFileTimeDecimal:'134056692030000000'};
 const unsigned={
  protocolVersion:1,purpose:'SOURCE_CONTENT_REPORT',commandId:id(15),installationId:scope.installationId,projectId:scope.projectId,
  requestRef,scopeDigest:requestRef.contentHash,observationRequestRef:context.observationRequestRef,observationNonce:context.observationNonce,
  connectorRef:scope.connectorRef,registrationRef:scope.registrationRef,observerRef:scope.observerRef,hostFingerprint:key.fingerprint,
  observedAt:at(2000),finishedAt:at(3000),
  root:{state:'OBSERVED',facts:{declaredRootRef:scope.sourceRootRef,kind:'DIRECTORY',canonicalPath:'D:\\Synthetic',
   volumeSerialHex:facts.volumeSerialHex,fileIdHex:'2'.repeat(32),reparse:false},reasonCode:null},
  files:[{relativePath:'src/main.ts',documentRef:ref(11),state:'HASHED',
   facts:{...facts,blobHash,bytesReadDecimal:'2',eof:true,identityBeforeHash:hash(facts),identityAfterHash:hash(facts)},reasonCode:null}],
  localEvidence:{kind:'NATIVE_CONTENT_HASH_REPORT',observerRef:scope.observerRef,ownedProcessRef:ref(16),
   observationRequestRef:context.observationRequestRef,completed:true},
 };
 const report={...unsigned,reportHash:hash(unsigned),signature:Buffer.alloc(64,1).toString('base64url')};
 const preflightBytes=sourceContentPreflightProofBytesV1(preflight,exchange,zero+1000);
 const challengeBytes=sourceContentChallengeProofBytesV1(challenge,preflight,exchange,zero+1000);
 const reportBytes=sourceContentReportProofBytesV1(report,context);
 report.signature=signature(reportBytes,key.privateKey);
 return {key,scope,exchange,preflight,challenge,context,report,preflightBytes,challengeBytes,reportBytes,
  signedPreflight:{payload:preflight,signature:signature(preflightBytes,key.privateKey)},
  signedChallenge:{payload:challenge,signature:signature(challengeBytes,key.privateKey)}};
}
function onlyMathematics(result:Record<string,unknown>){
 assert.deepEqual(result,{signatureValid:true,registrationVerified:false,observationVerified:false,
  currentAuthorityVerified:false,executionAuthorized:false,linkAuthorized:false});
 assert.equal(Object.isFrozen(result),true);
}
const invalid=/^Error: SOURCE_CONTENT_SIGNATURE_INVALID$/;
test('preflight의 원 NUL domain과 bytes를 실제 P256으로 검산한다',()=>{
 const f=fixture(),before=canonicalJson(f.signedPreflight);
 assert.deepEqual(f.preflightBytes,Buffer.concat([Buffer.from('ANVIL_SOURCE_CONTENT_PREFLIGHT_V1\0','ascii'),Buffer.from(canonicalJson(f.preflight))]));
 onlyMathematics(verifier('verifySourceContentPreflightSignature')(f.key.spki,f.signedPreflight,f.exchange,zero+1000));
 assert.equal(canonicalJson(f.signedPreflight),before);
});
test('challenge의 원 preflight와 고유 domain을 실제 P256으로 검산한다',()=>{
 const f=fixture();
 assert.deepEqual(f.challengeBytes,Buffer.concat([Buffer.from('ANVIL_SOURCE_CONTENT_EXCHANGE_V1\0','ascii'),Buffer.from(canonicalJson(f.challenge))]));
 onlyMathematics(verifier('verifySourceContentChallengeSignature')(f.key.spki,f.signedChallenge,f.preflight,f.exchange,zero+1000));
});
test('report의 서버 context와 원 hash bytes만 검산하고 관측 권위는 false다',()=>{
 const f=fixture(),before=canonicalJson(f.report);
 assert.ok(f.reportBytes.subarray(0,31).includes(Buffer.from('ANVIL_SOURCE_CONTENT_REPORT_V1')));
 assert.equal(f.reportBytes.includes(Buffer.from('canonicalPath')),false);
 onlyMathematics(verifier('verifySourceContentReportSignature')(f.key.spki,f.report,f.context));
 assert.equal(canonicalJson(f.report),before);
});
test('다른 키와 fingerprint가 같지 않은 교환 또는 report는 고정 오류다',()=>{
 const f=fixture(),other=memoryKey();
 assert.throws(()=>verifier('verifySourceContentPreflightSignature')(other.spki,f.signedPreflight,f.exchange,zero+1000),invalid);
 assert.throws(()=>verifier('verifySourceContentChallengeSignature')(other.spki,f.signedChallenge,f.preflight,f.exchange,zero+1000),invalid);
 assert.throws(()=>verifier('verifySourceContentReportSignature')(other.spki,f.report,f.context),invalid);
 assert.throws(()=>verifier('verifySourceContentPreflightSignature')(f.key.spki,f.signedPreflight,{...f.exchange,publicKeyFingerprint:'f'.repeat(64)},zero+1000),invalid);
});
test('P384와 RSA 및 비정규 SPKI는 서명 성공 자료로 대체하지 않는다',()=>{
 const f=fixture(),read=verifier('verifySourceContentPreflightSignature');
 const p384=generateKeyPairSync('ec',{namedCurve:'secp384r1'}).publicKey.export({format:'der',type:'spki'});
 const rsa=generateKeyPairSync('rsa',{modulusLength:1024}).publicKey.export({format:'der',type:'spki'});
 const valid=Buffer.from(f.key.spki,'base64url');
 for(const spki of [p384.toString('base64url'),rsa.toString('base64url'),f.key.spki+'=',Buffer.concat([valid,Buffer.from([0])]).toString('base64url'),'AA',null]){
  assert.throws(()=>read(spki,f.signedPreflight,f.exchange,zero+1000),invalid);
 }
});
test('서명 길이와 canonical base64 및 원 signature 변조를 거절한다',()=>{
 const f=fixture(),read=verifier('verifySourceContentPreflightSignature');
 const changed=Buffer.from(f.signedPreflight.signature,'base64url');changed[0]=changed[0]!^1;
 for(const sig of ['',Buffer.alloc(63).toString('base64url'),Buffer.alloc(65).toString('base64url'),
  f.signedPreflight.signature+'=','A'.repeat(85)+'B',changed.toString('base64url')]){
  assert.throws(()=>read(f.key.spki,{...f.signedPreflight,signature:sig},f.exchange,zero+1000),invalid);
 }
 const bytes=Buffer.from(f.signedPreflight.signature,'base64url');
 assert.throws(()=>read(f.key.spki,{...f.signedPreflight,signature:bytes.toString('base64')},f.exchange,zero+1000),invalid);
});
test('다른 domain과 목적의 서명을 같은 키로 교차 사용할 수 없다',()=>{
 const f=fixture(),sig=signature(Buffer.from(canonicalJson(f.preflight)),f.key.privateKey);
 assert.throws(()=>verifier('verifySourceContentPreflightSignature')(f.key.spki,{...f.signedPreflight,signature:sig},f.exchange,zero+1000),invalid);
 assert.throws(()=>verifier('verifySourceContentPreflightSignature')(f.key.spki,f.signedChallenge,f.exchange,zero+1000),invalid);
 assert.throws(()=>verifier('verifySourceContentChallengeSignature')(f.key.spki,{...f.signedChallenge,signature:f.signedPreflight.signature},f.preflight,f.exchange,zero+1000),invalid);
 assert.throws(()=>verifier('verifySourceContentReportSignature')(f.key.spki,{...f.report,signature:f.signedPreflight.signature},f.context),invalid);
});
test('유효하게 다시 봉인한 본문도 원 서명을 재사용하지 못한다',()=>{
 const f=fixture();
 const preflight={...f.preflight,clientNonce:Buffer.alloc(32,10).toString('base64url')};
 assert.throws(()=>verifier('verifySourceContentPreflightSignature')(f.key.spki,{...f.signedPreflight,payload:preflight},f.exchange,zero+1000),invalid);
 const {signature:sig,reportHash,...unsigned}=f.report;
 const next={...unsigned,files:[{...unsigned.files[0]!,facts:{...unsigned.files[0]!.facts,blobHash:'f'.repeat(64)}}]};
 assert.throws(()=>verifier('verifySourceContentReportSignature')(f.key.spki,{...next,reportHash:hash(next),signature:sig},f.context),invalid);
});
test('원 nonce와 fullref 및 만료 검사는 수학적 서명으로 우회하지 못한다',()=>{
 const f=fixture();
 assert.throws(()=>verifier('verifySourceContentChallengeSignature')(f.key.spki,f.signedChallenge,{...f.preflight,clientNonce:Buffer.alloc(32,11).toString('base64url')},f.exchange,zero+1000),invalid);
 assert.throws(()=>verifier('verifySourceContentPreflightSignature')(f.key.spki,f.signedPreflight,{...f.exchange,requestRef:ref(99)},zero+1000),invalid);
 for(const now of [zero-1,zero+120000,NaN,zero+0.1]){
  assert.throws(()=>verifier('verifySourceContentPreflightSignature')(f.key.spki,f.signedPreflight,f.exchange,now),invalid);
 }
 assert.throws(()=>verifier('verifySourceContentReportSignature')(f.key.spki,f.report,{...f.context,receivedAt:f.context.observeBefore}),invalid);
 assert.throws(()=>verifier('verifySourceContentReportSignature')(f.key.spki,f.report,{...f.context,observationNonce:Buffer.alloc(32,12).toString('base64url')}),invalid);
});
test('getter와 Proxy를 실행하지 않으며 caller 변이는 다음 호출에서 재검산한다',()=>{
 const f=fixture(),read=verifier('verifySourceContentPreflightSignature');let traps=0;
 const getter={payload:f.preflight};Object.defineProperty(getter,'signature',{enumerable:true,get(){traps++;return f.signedPreflight.signature;}});
 assert.throws(()=>read(f.key.spki,getter,f.exchange,zero+1000),invalid);
 const proxy=new Proxy(f.signedPreflight,{getOwnPropertyDescriptor(){traps++;throw Error('노출 금지');}});
 assert.throws(()=>read(f.key.spki,proxy,f.exchange,zero+1000),invalid);
 const context={...f.exchange,scope:new Proxy(f.scope,{getPrototypeOf(){traps++;throw Error('노출 금지');}})};
 assert.throws(()=>read(f.key.spki,f.signedPreflight,context,zero+1000),invalid);
 assert.equal(traps,0);
 const result=read(f.key.spki,f.signedPreflight,f.exchange,zero+1000);
 f.preflight.observerRef={...ref(99)};
 onlyMathematics(result);
 assert.throws(()=>read(f.key.spki,f.signedPreflight,f.exchange,zero+1000),invalid);
});
test('기존 등록과 SOURCE_READ의 유효 원문 서명도 CONTENT에 재사용하지 못한다',()=>{
 const f=fixture();
 const host={
  protocolVersion:1,installationId:id(1),registrationId:id(5),scopeDigest:f.exchange.requestRef.contentHash,
  publicKeyFingerprint:f.key.fingerprint,serverNonce:Buffer.alloc(32,11).toString('base64url'),
  clientNonce:Buffer.alloc(32,12).toString('base64url'),expiresAt:at(61000),
 };
 const read=readSourceReadPreflightV1({
  protocolVersion:1,purpose:'SOURCE_READ_PREFLIGHT',installationId:id(1),projectId:id(2),
  connectorId:id(4),registrationId:id(5),connectorGeneration:1,grantRef:ref(90),
  scopeDigest:'a'.repeat(64),publicKeyFingerprint:f.key.fingerprint,
  clientNonce:Buffer.alloc(32,13).toString('base64url'),expiresAt:at(61000),
 });
 const signatures=[
  signature(proofBytes(host),f.key.privateKey),
  signature(Buffer.from(canonicalJson(read)),f.key.privateKey),
 ];
 for(const sig of signatures){
  assert.throws(()=>verifier('verifySourceContentPreflightSignature')(f.key.spki,{...f.signedPreflight,signature:sig},f.exchange,zero+1000),invalid);
  assert.throws(()=>verifier('verifySourceContentReportSignature')(f.key.spki,{...f.report,signature:sig},f.context),invalid);
 }
 const wholeReportSignature=signature(Buffer.from(canonicalJson(f.report)),f.key.privateKey);
 assert.throws(()=>verifier('verifySourceContentReportSignature')(f.key.spki,{...f.report,signature:wholeReportSignature},f.context),invalid);
});
test('서명된 실패 관측 보고도 보관 시각으로 검산하며 OS 성공을 만들지 않는다',()=>{
 const f=fixture(),{signature:oldSignature,reportHash,...unsigned}=f.report;
 const failed={
  ...unsigned,files:[{...unsigned.files[0],state:'CHANGED',facts:null,reasonCode:'IDENTITY_CHANGED'}],
  localEvidence:{...unsigned.localEvidence,completed:false},
 };
 const report={...failed,reportHash:hash(failed),signature:oldSignature};
 report.signature=signature(sourceContentReportProofBytesV1(report,f.context),f.key.privateKey);
 onlyMathematics(verifier('verifySourceContentReportSignature')(f.key.spki,report,f.context));
});
