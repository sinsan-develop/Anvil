import { verify } from 'node:crypto';
import { canonicalJson, contentHash, parseWireJson } from '../../../../contracts/canonical.ts';
import { arrayV1, cloneV1, hashV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { canonicalBase64, publicKeyFingerprint, readHostPublicKey } from '../connections/registration-proof.ts';

type Mode='EXECUTION'|'RECOVERY';
type ProofKind='EXECUTION_CREDENTIAL_EXCHANGE'|'EXECUTION_REQUEST_PROOF'|'EXECUTION_RECOVERY_CREDENTIAL_EXCHANGE'|'EXECUTION_RECOVERY_REQUEST_PROOF';
const proofKinds:readonly string[]=['EXECUTION_CREDENTIAL_EXCHANGE','EXECUTION_REQUEST_PROOF','EXECUTION_RECOVERY_CREDENTIAL_EXCHANGE','EXECUTION_RECOVERY_REQUEST_PROOF'];
const invalid=():never=>{throw new AuthFailure('EXECUTION_PROOF_INVALID',412);};
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
/** 이 결과는 서명 문법/정확 binding뿐이다. nonce 소비·현재 DB/OS 허가·실행 성공은 별도다. */
const verified=()=>({signatureVerified:true as const,nonceConsumed:false as const,currentAuthorityVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const});
function copy(value:unknown){const text=canonicalJson(value);if(Buffer.byteLength(text)>2*1024*1024)return invalid();return JSON.parse(text);}
function target(value:unknown){
 if(!recordV1(value,['method','path','queryHash','bodyHash'])||!hashV1(value.queryHash)||!hashV1(value.bodyHash))return invalid();
 route(value.method,value.path);return cloneV1(value);
}
function route(method:unknown,path:unknown){
 if(typeof path!=='string'||typeof method!=='string'||!['GET','POST'].includes(method))return invalid();
 const p=/^\/api\/v1\/connectors\/([^/]+)\/executions\/([^/]+)(\/recovery)?(\/.*)$/.exec(path);
 if(!p||!uuidV1(p[1])||!uuidV1(p[2]))return invalid();
 const mode:Mode=p[3]?'RECOVERY':'EXECUTION',suffix=p[4]!;
 const command=/^\/commands\/([^/]+)\/(permit|materials\/([^/]+))$/.exec(suffix);
 const allowed=mode==='RECOVERY'
  ?method==='GET'&&suffix==='/stop-instruction'||method==='POST'&&['/credential-exchange','/observations','/stop-receipts','/heartbeat'].includes(suffix)
  :method==='GET'&&suffix==='/commands'||method==='POST'&&['/credential-exchange','/receipts','/observations','/heartbeat','/provider-session-claims'].includes(suffix)
   ||!!command&&uuidV1(command[1])&&(command[2]==='permit'?method==='POST':method==='GET'&&uuidV1(command[3]));
 if(!allowed)return invalid();
 return{mode,connectorId:p[1],executionId:p[2],suffix};
}
/** 실제 HTTP adapter가 명시된 query와 parseWireJson 본문을 hash할 때 쓰는 순수 경계. listener를 만들지 않는다. */
export function executionTarget(method:unknown,path:unknown,query:unknown,bodyRaw:unknown){
 try{
  const r=route(method,path),q:Record<string,string|number>={};
  if(!arrayV1(query,2))return invalid();
  for(const pair of query){
   if(!arrayV1(pair,2)||pair.length!==2||typeof pair[0]!=='string'||typeof pair[1]!=='string'||Object.hasOwn(q,pair[0]))return invalid();
   const [key,value]=pair as [string,string];
   if(method!=='GET'||r.mode!=='EXECUTION'||r.suffix!=='/commands')return invalid();
   if(key==='waitMs'){if(!/^(0|[1-9][0-9]{0,4})$/.test(value)||Number(value)>10000)return invalid();q[key]=Number(value);}
   else if(key==='afterCursor'){if(!/^[A-Za-z0-9_.-]{1,4096}$/.test(value))return invalid();q[key]=value;}
   else return invalid();
  }
  if(method==='GET'&&bodyRaw!==null||method==='POST'&&(typeof bodyRaw!=='string'||Buffer.byteLength(bodyRaw)>2*1024*1024))return invalid();
  if(r.suffix==='/provider-session-claims'&&Buffer.byteLength(bodyRaw as string)>16384)return invalid();
  const body=method==='GET'?null:parseWireJson(bodyRaw as string);
  return{method,path,queryHash:contentHash(canonicalJson(q)),bodyHash:contentHash(canonicalJson(body))};
 }catch{return invalid();}
}
function proof(kind:unknown,value:unknown){
 if(typeof kind!=='string'||!proofKinds.includes(kind))return invalid();const p=copy(value);
 const exchange=kind.endsWith('CREDENTIAL_EXCHANGE');
 if(exchange){
  if(!recordV1(p,['requestId','grantRef','credentialGeneration','scopeDigest','serverNonce','clientNonce','expiresAt'])||!hashV1(p.scopeDigest)||!isoV1(p.expiresAt))return invalid();
  canonicalBase64(p.clientNonce,32);
 }else{
  if(!recordV1(p,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce']))return invalid();
  target({method:p.method,path:p.path,queryHash:p.queryHash,bodyHash:p.bodyHash});
 }
 if(!uuidV1(p.requestId)||!refV1(p.grantRef)||!positive(p.credentialGeneration))return invalid();canonicalBase64(p.serverNonce,32);return p;
}
/** purpose를 서명 원문 밖의 caller 설명으로 두지 않고 canonical wrapper 안에 결박한다. */
export function executionProofBytes(kind:ProofKind,value:unknown):Buffer {
 try{return Buffer.from(canonicalJson({purpose:kind,request:proof(kind,value)}),'utf8');}catch{return invalid();}
}
function challengeRequest(value:unknown){
 const p=copy(value);
 if(!recordV1(p,['requestId','purpose','grantRef','credentialGeneration','target','clientNonce','issuedAt'])||!uuidV1(p.requestId)
  ||!['CREDENTIAL_EXCHANGE','EXECUTION_REQUEST'].includes(p.purpose)||!refV1(p.grantRef)||!positive(p.credentialGeneration)||!isoV1(p.issuedAt))return invalid();
 target(p.target);canonicalBase64(p.clientNonce,32);return p;
}
export function executionChallengeRequestBytes(mode:Mode,value:unknown):Buffer {
 try{if(!['EXECUTION','RECOVERY'].includes(mode))return invalid();return Buffer.from(canonicalJson({purpose:mode==='RECOVERY'?'EXECUTION_RECOVERY_CHALLENGE_REQUEST':'EXECUTION_CHALLENGE_REQUEST',request:challengeRequest(value)}),'utf8');}catch{return invalid();}
}
function context(value:unknown,now:Date){
 const c=copy(value);
 if(!recordV1(c,['transport','mode','projectId','connectorId','executionId','executionGeneration','grantRef','scopeDigest','credentialGeneration','publicKeyFingerprint','grantExpiresAt'])
  ||c.transport!=='SYNTHETIC_ONLY'||!['EXECUTION','RECOVERY'].includes(c.mode)||!uuidV1(c.projectId)||!uuidV1(c.connectorId)||!uuidV1(c.executionId)||!positive(c.executionGeneration)
  ||!refV1(c.grantRef)||!hashV1(c.scopeDigest)||!positive(c.credentialGeneration)||!hashV1(c.publicKeyFingerprint)||!isoV1(c.grantExpiresAt)
  ||!(now instanceof Date)||!Number.isFinite(now.getTime())||Date.parse(c.grantExpiresAt)<=now.getTime())return invalid();return c;
}
function exactSubject(p:any,c:any){if(!same(p.grantRef,c.grantRef)||p.credentialGeneration!==c.credentialGeneration)return invalid();}
function exactRoute(t:any,c:any,exchange:boolean){
 const r=route(t.method,t.path);
 if(r.mode!==c.mode||r.connectorId!==c.connectorId||r.executionId!==c.executionId||(r.suffix==='/credential-exchange')!==exchange)return invalid();
}
function signature(spki:unknown,sig:unknown,bytes:Buffer,fingerprint:string){
 if(publicKeyFingerprint(spki)!==fingerprint||!verify('sha256',bytes,{key:readHostPublicKey(spki),dsaEncoding:'ieee-p1363'},canonicalBase64(sig,64)))return invalid();
}
/** key/context/expected는 현재 서버 저장소에서 공급해야 한다. 이 함수는 그 출처를 인증하거나 nonce를 소비하지 않는다. */
export function verifyExecutionProof(spki:unknown,sig:unknown,kind:ProofKind,value:unknown,expected:unknown,serverContext:unknown,challenge:unknown,now:Date){
 try{
  const c=context(serverContext,now),p=proof(kind,value),basis=proof(kind,expected),exchange=kind.endsWith('CREDENTIAL_EXCHANGE');
  const expectedKind=(c.mode==='RECOVERY'?'EXECUTION_RECOVERY_':'EXECUTION_')+(exchange?'CREDENTIAL_EXCHANGE':'REQUEST_PROOF');
  if(kind!==expectedKind||!same(p,basis)||!recordV1(challenge,['issuedAt','expiresAt'])||!isoV1(challenge.issuedAt)||!isoV1(challenge.expiresAt))return invalid();
  const start=Date.parse(challenge.issuedAt),end=Date.parse(challenge.expiresAt);
  if(start>now.getTime()||end<=now.getTime()||end<=start||end-start>(exchange?120000:30000)||end>Date.parse(c.grantExpiresAt))return invalid();
  exactSubject(p,c);
  if(exchange){if(p.scopeDigest!==c.scopeDigest||p.expiresAt!==challenge.expiresAt)return invalid();}
  else exactRoute(p,c,false);
  signature(spki,sig,executionProofBytes(kind,p),c.publicKeyFingerprint);return verified();
 }catch{return invalid();}
}
export function verifyExecutionChallengeRequest(spki:unknown,sig:unknown,value:unknown,expected:unknown,serverContext:unknown,now:Date){
 try{
  const c=context(serverContext,now),p=challengeRequest(value),basis=challengeRequest(expected);
  if(!same(p,basis)||Math.abs(Date.parse(p.issuedAt)-now.getTime())>30000)return invalid();
  exactSubject(p,c);exactRoute(p.target,c,p.purpose==='CREDENTIAL_EXCHANGE');
  signature(spki,sig,executionChallengeRequestBytes(c.mode,p),c.publicKeyFingerprint);return verified();
 }catch{return invalid();}
}
