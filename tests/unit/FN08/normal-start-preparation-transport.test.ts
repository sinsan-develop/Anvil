import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readNormalStartPreparationRequest,readNormalStartPreparationResult,readNormalStartPreparationResultProof,normalStartPreparationResultPath,normalStartPreparationRequestRef,matchNormalStartPreparationResult,encodeNormalStartPreparationFrame,readNormalStartPreparationResultHeaders,normalStartPreparationHeaders} from '../../../contracts/runtime/normal-start-preparation-v1.ts';
const id=(n:number)=>'b8000000-0000-4000-8000-'+String(n).padStart(12,'0'),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(){
 const request={schemaVersion:1,purpose:'NORMAL_START_PREPARATION_REQUEST_V1',requestId:id(1),attemptId:id(2),installationId:id(3),projectId:id(4),registrationRef:ref(5),connectorRef:ref(6),windowRef:ref(7),receiveSessionRef:ref(8),profileRef:ref(9),
  hostPublicKeyFingerprint:'b'.repeat(64),authBindingHash:'c'.repeat(64),localReceiveAttemptId:id(10),actorId:id(11),clientId:id(12),humanSessionId:id(13),credentialGeneration:1,controlGeneration:1,
  admissionRef:ref(14),claimRef:ref(15),normalCommandId:id(16),normalRequestHash:'d'.repeat(64),executionId:id(17),executionGeneration:1,executionPreparationRef:ref(18),writerNoneRef:ref(19),serverNonce:Buffer.alloc(32,2).toString('base64url'),issuedAt:'2026-11-24T00:00:00.000Z',expiresAt:'2026-11-24T00:00:10.000Z'};
 const requestRef=normalStartPreparationRequestRef(request),basisSnapshot={schemaVersion:1,purpose:'NORMAL_START_PREPARATION_PROTECTED_BASIS_V1',basisId:id(20),requestRef,attemptId:request.attemptId,objectRef:ref(21),sourceRef:ref(22),writerNoneRef:request.writerNoneRef,osFenceRef:ref(23),issuedAt:request.issuedAt,expiresAt:request.expiresAt,executionAuthorized:false,dispatchPerformed:false};
 const preparationBasis={ref:{id:id(20),version:1,contentHash:contentHash(canonicalJson(basisSnapshot))},snapshot:basisSnapshot};
 const snapshot={schemaVersion:1,purpose:'NORMAL_START_PREPARATION_PEER_RECEIPT_V1',receiptId:id(24),requestRef,attemptId:request.attemptId,outcome:'PREPARED',preparationBasis,issuedAt:request.issuedAt,expiresAt:request.expiresAt,executionAuthorized:false,dispatchPerformed:false};
 const result={schemaVersion:1,purpose:'NORMAL_START_PREPARATION_RESULT_V1',requestRef,receipt:{ref:{id:id(24),version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot}};
 const proof={schemaVersion:1,purpose:'NORMAL_START_PREPARATION_RESULT_PROOF_V1',requestRef,attemptId:request.attemptId,installationId:request.installationId,projectId:request.projectId,registrationRef:request.registrationRef,connectorRef:request.connectorRef,windowRef:request.windowRef,receiveSessionRef:request.receiveSessionRef,hostPublicKeyFingerprint:request.hostPublicKeyFingerprint,serverNonce:request.serverNonce,
  target:{method:'POST',path:normalStartPreparationResultPath(request.receiveSessionRef.id),queryHash:contentHash(canonicalJson({})),bodyHash:contentHash(canonicalJson(result))},issuedAt:request.issuedAt,expiresAt:'2026-11-24T00:00:02.000Z'};
 return{request,result,proof};
}

test('normal 준비 전송은 기존 native phase와 별도 exact 목적 parser만 갖는다',()=>{
 assert.equal(normalStartPreparationResultPath('b8000000-0000-4000-8000-000000000001'),'/api/v1/native-first-receive/sessions/b8000000-0000-4000-8000-000000000001/normal-start-preparation-result');
 for(const read of [readNormalStartPreparationRequest,readNormalStartPreparationResult,readNormalStartPreparationResultProof])assert.throws(()=>read({schemaVersion:1,purpose:'NATIVE_FIRST_RECEIVE_PROOF'}));
});

test('전용 frame·receipt·proof는 exact original refs/nonce/10초·2초 및 목적 보호 basis를 결박한다',()=>{
 const f=fixture(),frame=encodeNormalStartPreparationFrame(f.request);
 assert.equal(frame.readUInt32BE(0),frame.length-4);assert(frame.length<=8192);assert.deepEqual(JSON.parse(frame.subarray(4).toString('utf8')),f.request);
 assert.deepEqual(matchNormalStartPreparationResult(f.request,f.result,f.proof),f);
 assert.equal(frame.includes(Buffer.from('Z'.repeat(42)+'A')),false);
 for(const change of [{serverNonce:'A'.repeat(42)+'B'},{expiresAt:'2026-11-24T00:00:10.001Z'},{receiveCredential:'Z'.repeat(42)+'A'},{purpose:'NATIVE_FIRST_RECEIVE_DELIVERY'}])assert.throws(()=>readNormalStartPreparationRequest({...f.request,...change}));
 assert.throws(()=>readNormalStartPreparationResultProof({...f.proof,expiresAt:'2026-11-24T00:00:02.001Z'}));
 assert.throws(()=>matchNormalStartPreparationResult(f.request,f.result,{...f.proof,serverNonce:Buffer.alloc(32,5).toString('base64url')}));
});

test('peer UNKNOWN·무근거 PREPARED·다른 목적/alias 근거와 REJECTED의 근거 첨부를 거절한다',()=>{
 for(const mode of ['UNKNOWN','missing','legacy','alias','owned','reject-with-basis']){
  const f=fixture(),r=f.result.receipt.snapshot;
  if(mode==='UNKNOWN')r.outcome='UNKNOWN';
  if(mode==='missing')(r as any).preparationBasis=null;
  if(mode==='legacy')r.preparationBasis.snapshot.purpose='NATIVE_PREPARATION_AUTHORITY';
  if(mode==='alias')r.preparationBasis.snapshot.objectRef=f.request.claimRef;
  if(mode==='owned')(r.preparationBasis.snapshot as any).ownedWriterRef=ref(29);
  if(mode==='reject-with-basis')r.outcome='REJECTED';
  r.preparationBasis&&(r.preparationBasis.ref.contentHash=contentHash(canonicalJson(r.preparationBasis.snapshot)));
  f.result.receipt.ref.contentHash=contentHash(canonicalJson(r));f.proof.target.bodyHash=contentHash(canonicalJson(f.result));
  assert.throws(()=>matchNormalStartPreparationResult(f.request,f.result,f.proof),mode);
 }
 const f=fixture();f.result.receipt.snapshot.outcome='REJECTED';(f.result.receipt.snapshot as any).preparationBasis=null;f.result.receipt.ref.contentHash=contentHash(canonicalJson(f.result.receipt.snapshot));
 f.proof.target.bodyHash=contentHash(canonicalJson(f.result));assert.equal(matchNormalStartPreparationResult(f.request,f.result,f.proof).result.receipt.snapshot.outcome,'REJECTED');
});

test('새 proof header는 old header·중복·query/path 우회·비정규 base64와 과대 본문을 수용하지 않는다',()=>{
 const f=fixture(),p=normalStartPreparationHeaders.proof,s=normalStartPreparationHeaders.signature,encoded=Buffer.from(canonicalJson(f.proof)).toString('base64url'),sig=Buffer.alloc(64,1).toString('base64url');
 assert.deepEqual(readNormalStartPreparationResultHeaders({[p]:encoded,[s]:sig},[p,encoded,s,sig]),{proof:f.proof,signature:sig});
 for(const raw of [[p,encoded,p,encoded,s,sig],[p,encoded,s,sig,'x-anvil-native-receive-proof',encoded]])assert.throws(()=>readNormalStartPreparationResultHeaders({[p]:encoded,[s]:sig},raw));
 assert.throws(()=>readNormalStartPreparationResultHeaders({[p]:encoded+'=',[s]:sig},[p,encoded+'=',s,sig]));
 for(const path of [f.proof.target.path+'?x=1',f.proof.target.path.replace('/sessions/','/sessions/%2f')])assert.throws(()=>readNormalStartPreparationResultProof({...f.proof,target:{...f.proof.target,path}}));
 assert.throws(()=>readNormalStartPreparationRequest({...f.request,extra:'x'.repeat(8192)}));
});

test('실제 등록 route는 명시 body/header를 검사하고 producer 미구성에서 DB/ACK/새 frame0이다',async()=>{
 const {default:Fastify}=await import('fastify'),{NativeFirstReceiveService}=await import('../../../apps/server/modules/executions/native-first-receive-service.ts'),{registerNativeFirstReceiveRoutes}=await import('../../../apps/server/modules/executions/native-first-receive-routes.ts');
 let calls=0;const service=new NativeFirstReceiveService({installationId:id(3),authenticated:async()=>{calls++;throw Error();},pool:{connect:async()=>{calls++;throw Error();}}} as any,undefined,Date.now,null,undefined,'https://anvil.example');
 const app=Fastify();registerNativeFirstReceiveRoutes(app,{enabled:true,service},{origin:'https://anvil.example'} as any);
 const f=fixture(),headers={host:'anvil.example','content-type':'application/json',authorization:'AnvilReceive '+'Z'.repeat(42)+'A',[normalStartPreparationHeaders.proof]:Buffer.from(canonicalJson(f.proof)).toString('base64url'),[normalStartPreparationHeaders.signature]:Buffer.alloc(64,1).toString('base64url')};
 try{
  for(const [change,url,status]of [[{},f.proof.target.path,503],[{cookie:'__Host-anvil.sid='+'A'.repeat(43)},f.proof.target.path,403],[{origin:'https://anvil.example'},f.proof.target.path,403],[{authorization:'Bearer '+'Z'.repeat(43)},f.proof.target.path,401],[{'x-anvil-native-receive-proof':headers[normalStartPreparationHeaders.proof]},f.proof.target.path,400],[{},f.proof.target.path+'?x=1',400]] as const){
   const response=await app.inject({method:'POST',url,headers:{...headers,...change},payload:canonicalJson(f.result)});assert.equal(response.statusCode,status);assert.equal(response.headers['cache-control'],'no-store');
   assert.equal(response.body.includes('Z'.repeat(42)+'A'),false);assert.equal(response.body.includes('publicKeySpki'),false);
  }
  for(const payload of [JSON.stringify(f.result),canonicalJson(f.result)+'\n',canonicalJson(f.result).replace('{','{"schemaVersion":1,'),Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(canonicalJson(f.result))])]){
   const response=await app.inject({method:'POST',url:f.proof.target.path,headers,payload});assert.equal(response.statusCode,400);assert.equal(response.headers['cache-control'],'no-store');
  }
  const over=await app.inject({method:'POST',url:f.proof.target.path,headers,payload:'x'.repeat(8193)});assert.equal(over.statusCode,413);
  assert.equal(calls,0);
 }finally{await app.close();}
});
