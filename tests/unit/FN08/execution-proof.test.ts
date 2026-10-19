import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { publicKeyFingerprint } from '../../../apps/server/modules/connections/registration-proof.ts';
const m:any=await import('../../../apps/server/modules/executions/execution-proof.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const at='2026-10-19T12:00:00.000Z',uuid=()=>randomUUID(),ref=()=>({id:uuid(),version:1,contentHash:'a'.repeat(64)});
function fixture(mode='EXECUTION'){
 assert.equal(typeof m.verifyExecutionProof,'function');
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const context={transport:'SYNTHETIC_ONLY',mode,projectId:uuid(),connectorId:uuid(),executionId:uuid(),executionGeneration:1,grantRef:ref(),scopeDigest:'b'.repeat(64),credentialGeneration:2,publicKeyFingerprint:publicKeyFingerprint(spki),grantExpiresAt:'2026-10-19T12:10:00.000Z'};
 const base='/api/v1/connectors/'+context.connectorId+'/executions/'+context.executionId+(mode==='RECOVERY'?'/recovery':'');
 const target={method:'POST',path:base+(mode==='RECOVERY'?'/observations':'/receipts'),queryHash:contentHash('{}'),bodyHash:contentHash('{"sequence":1}')};
 const request={requestId:uuid(),...target,grantRef:context.grantRef,credentialGeneration:2,serverNonce:Buffer.alloc(32,1).toString('base64url')};
 const exchange={requestId:uuid(),grantRef:context.grantRef,credentialGeneration:2,scopeDigest:context.scopeDigest,serverNonce:request.serverNonce,clientNonce:Buffer.alloc(32,2).toString('base64url'),expiresAt:'2026-10-19T12:01:00.000Z'};
 const challenge={issuedAt:at,expiresAt:'2026-10-19T12:00:30.000Z'};
 const kind=(exchange=false)=>(mode==='RECOVERY'?'EXECUTION_RECOVERY_':'EXECUTION_')+(exchange?'CREDENTIAL_EXCHANGE':'REQUEST_PROOF');
 const signature=(kind:string,payload:any,der=false,privateKey=key.privateKey)=>sign('sha256',m.executionProofBytes(kind,payload),{key:privateKey,dsaEncoding:der?'der':'ieee-p1363'}).toString('base64url');
 return{key,spki,context,base,target,request,exchange,challenge,kind,signature};
}
test('기존 P256 키 codec으로 실행/회수 purpose의 정확 요청·교환 서명만 검사하고 실행/nonce소비 성공은 표시하지 않는다',()=>{
 for(const mode of ['EXECUTION','RECOVERY']){const f=fixture(mode);for(const isExchange of [false,true]){
  const p=isExchange?f.exchange:f.request,kind=f.kind(isExchange),challenge=isExchange?{issuedAt:at,expiresAt:f.exchange.expiresAt}:f.challenge;
  const result=m.verifyExecutionProof(f.spki,f.signature(kind,p),kind,p,p,f.context,challenge,new Date(at));
  assert.deepEqual(result,{signatureVerified:true,nonceConsumed:false,currentAuthorityVerified:false,executionAuthorized:false,dispatchPerformed:false});
 }}
});
test('다른 key·DER·purpose·nonce/본문/세대/grant 변경을 유효 권한으로 승격하지 않는다',()=>{
 const f=fixture(),kind=f.kind(),sig=f.signature(kind,f.request),other=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 for(const [signature,payload,expected,context]of [
  [f.signature(kind,f.request,false,other.privateKey),f.request,f.request,f.context],
  [f.signature(kind,f.request,true),f.request,f.request,f.context],
  [sig,{...f.request,serverNonce:Buffer.alloc(32,3).toString('base64url')},f.request,f.context],
  [sig,{...f.request,bodyHash:'c'.repeat(64)},f.request,f.context],
  [sig,f.request,f.request,{...f.context,credentialGeneration:3}],
  [sig,f.request,f.request,{...f.context,grantRef:ref()}],
  [sig,f.request,f.request,{...f.context,mode:'RECOVERY'}],
  [sig,f.request,f.request,{...f.context,publicKeyFingerprint:'c'.repeat(64)}]
 ])assert.throws(()=>m.verifyExecutionProof(f.spki,signature,kind,payload,expected,context,f.challenge,new Date(at)),/EXECUTION_PROOF_INVALID/);
 assert.throws(()=>m.executionProofBytes('HOST_PROOF',f.request),/EXECUTION_PROOF_INVALID/);
});
test('현재 grant·서버 challenge의 유한 수명과 발급전/기한경과를 검사한다',()=>{
 const f=fixture(),kind=f.kind(),sig=f.signature(kind,f.request);
 for(const [context,challenge,now]of [
  [f.context,f.challenge,new Date(f.challenge.expiresAt)],
  [f.context,{issuedAt:at,expiresAt:'2026-10-19T12:00:30.001Z'},new Date(at)],
  [f.context,{issuedAt:'2026-10-19T12:00:01.000Z',expiresAt:f.challenge.expiresAt},new Date(at)],
  [{...f.context,grantExpiresAt:at},f.challenge,new Date(at)],
  [f.context,{...f.challenge,expiresAt:null},new Date(at)],
  [f.context,f.challenge,new Date(NaN)]
 ])assert.throws(()=>m.verifyExecutionProof(f.spki,sig,kind,f.request,f.request,context,challenge,now));
});
test('회수 경로는 dispatch/자료조회/다른 실행과 percent·query/path 혼합을 거절한다',()=>{
 const f=fixture('RECOVERY'),kind=f.kind();
 for(const path of [f.base+'/commands',f.base+'/commands/'+uuid()+'/materials/'+uuid(),f.base+'/commands/'+uuid()+'/permit',f.base.replace(f.context.executionId,uuid())+'/observations',f.base+'/%6f bservations',f.base+'/observations?x=1']){
  const p={...f.request,path};assert.throws(()=>m.verifyExecutionProof(f.spki,f.signature(kind,p),kind,p,p,f.context,f.challenge,new Date(at)));
 }
});
test('challenge 발급 요청은 독립 purpose·±30초와 exact clientNonce/target에 결박한다',()=>{
 const f=fixture(),payload={requestId:uuid(),purpose:'EXECUTION_REQUEST',grantRef:f.context.grantRef,credentialGeneration:2,target:f.target,clientNonce:Buffer.alloc(32,4).toString('base64url'),issuedAt:at};
 const bytes=m.executionChallengeRequestBytes('EXECUTION',payload),signature=sign('sha256',bytes,{key:f.key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 assert.equal(m.verifyExecutionChallengeRequest(f.spki,signature,payload,payload,f.context,new Date(at)).nonceConsumed,false);
 for(const now of ['2026-10-19T12:00:30.001Z','2026-10-19T11:59:29.999Z'])assert.throws(()=>m.verifyExecutionChallengeRequest(f.spki,signature,payload,payload,f.context,new Date(now)));
 assert.throws(()=>m.verifyExecutionChallengeRequest(f.spki,signature,payload,{...payload,clientNonce:Buffer.alloc(32,5).toString('base64url')},f.context,new Date(at)));
 assert.notDeepEqual(bytes,m.executionProofBytes(f.kind(),f.request));
});
test('query/body hash는 중복·미지원 키와 중복 JSON 속성을 거절하고 허용 쿼리만 canonical한다',()=>{
 const f=fixture(),path=f.base+'/commands';
 const a=m.executionTarget('GET',path,[['waitMs','10000'],['afterCursor','signed_cursor']],null);
 const b=m.executionTarget('GET',path,[['afterCursor','signed_cursor'],['waitMs','10000']],null);
 assert.deepEqual(a,b);assert.equal(a.queryHash,contentHash(canonicalJson({afterCursor:'signed_cursor',waitMs:10000})));assert.equal(a.bodyHash,contentHash('null'));
 for(const query of [[['waitMs','10001']],[['waitMs','1'],['waitMs','1']],[['ignored','1']],[['waitMs','01']]])assert.throws(()=>m.executionTarget('GET',path,query,null));
 assert.throws(()=>m.executionTarget('POST',f.base+'/receipts',[], '{"a":1,"a":2}'));
 assert.throws(()=>m.executionTarget('GET',path,[], '{}'));
 assert.throws(()=>m.executionTarget('POST',f.base+'/receipts',[], 'x'.repeat(2*1024*1024+1)));
});
test('부가 필드·getter·잘못된 key/nonce는 비밀 원문 없이 같은 오류로 거절한다',()=>{
 const f=fixture(),kind=f.kind(),sig=f.signature(kind,f.request);
 for(const p of [{...f.request,credential:'av3ct1_secret'},{...f.request,serverNonce:'abc'},Object.defineProperty({...f.request},'serverNonce',{enumerable:true,get(){throw Error('SHOULD_NOT_READ_SECRET');}})])assert.throws(()=>m.verifyExecutionProof(f.spki,sig,kind,p,f.request,f.context,f.challenge,new Date(at)),(e:Error)=>e.message==='EXECUTION_PROOF_INVALID');
 assert.throws(()=>m.verifyExecutionProof('not-a-key',sig,kind,f.request,f.request,f.context,f.challenge,new Date(at)),(e:Error)=>e.message==='EXECUTION_PROOF_INVALID');
});
test('경로·query 끝의 개행/제어문자를 정규식의 끝 일치로 무시하지 않는다',()=>{
 const f=fixture();
 for(const ending of ['\n','\r','\r\n','\u2028','\u2029']){
  assert.throws(()=>m.executionTarget('GET',f.base+'/commands'+ending,[],null));
  assert.throws(()=>m.executionTarget('GET',f.base+'/commands',[['waitMs','1'+ending]],null));
  assert.throws(()=>m.executionTarget('GET',f.base+'/commands',[['afterCursor','cursor'+ending]],null));
 }
});
