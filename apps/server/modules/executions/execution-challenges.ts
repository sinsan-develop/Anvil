import { randomBytes, randomUUID, verify } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { cloneV1, hashV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure } from '../access/repository.ts';
import { canonicalBase64, publicKeyFingerprint, readHostPublicKey } from '../connections/registration-proof.ts';
import { executionChallengeRequestBytes, executionProofBytes, verifyExecutionChallengeRequest, verifyExecutionProof } from './execution-proof.ts';

interface Scope {mode:'EXECUTION'|'RECOVERY';projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:VersionRef;credentialGeneration:number}
interface Entry {ref:VersionRef;snapshot:{sequence:number;binding:any;request:any;requestHash:string;publicChallenge:any;previousRef:VersionRef|null;consumption:null|{proofHash:string;resultRef:VersionRef;consumedAt:string}}}
export type SyntheticChallengeScope=Scope;
export type SyntheticChallengeEntry=Entry;
/** 이 port는 같은 grant를 잠그고 read·result·append·rollback을 한 transaction에서 처리해야 한다.
 * 현재 P1에는 합성 구현만 주입한다. 실제 SQL/현재 HUMAN·host 제공자 없이 HTTP/실제 실행에 연결하지 않는다.
 */
export interface SyntheticChallengeTransaction {
 current():Promise<{context:unknown;spki:unknown;checkedAt:string}>;
 clock():Promise<string>;
 read():Promise<{complete:boolean;events:Entry[]}>;
 append(value:Entry):Promise<void>;
 recordResult(value:{challengeRef:VersionRef;requestId:string;proofHash:string}):Promise<VersionRef>;
}
export interface SyntheticChallengeStore {
 transport:'SYNTHETIC_ONLY';
 transaction<T>(scope:Scope,body:(tx:SyntheticChallengeTransaction)=>Promise<T>):Promise<T>;
}
const fail=(code:string,status=412):never=>{throw new AuthFailure(code,status);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hash=(value:unknown)=>contentHash(canonicalJson(value));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const scopeKeys=['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'];
function readScope(value:unknown):Scope{
 if(!recordV1(value,scopeKeys)||!['EXECUTION','RECOVERY'].includes(value.mode)||!uuidV1(value.projectId)||!uuidV1(value.connectorId)||!uuidV1(value.executionId)
  ||!positive(value.executionGeneration)||!refV1(value.grantRef)||!positive(value.credentialGeneration))return fail('EXECUTION_CHALLENGE_SCOPE_INVALID',422);
 return cloneV1(value) as unknown as Scope;
}
function binding(c:any){const {grantExpiresAt:_,...value}=c;return value;}
function subset(b:any,scope:Scope){return scopeKeys.every(key=>same(b[key],(scope as any)[key]));}
function rawSignature(spki:unknown,sig:unknown,bytes:Buffer,fingerprint:string){
 try{if(publicKeyFingerprint(spki)!==fingerprint||!verify('sha256',bytes,{key:readHostPublicKey(spki),dsaEncoding:'ieee-p1363'},canonicalBase64(sig,64)))throw Error();}
 catch{return fail('EXECUTION_PROOF_INVALID');}
}
function readJournal(value:unknown,scope:Scope,now:string){
 const bad=()=>fail('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
 if(!recordV1(value,['complete','events'])||value.complete!==true)return fail('EXECUTION_CHALLENGE_LEDGER_INCOMPLETE',503);
 if(!Array.isArray(value.events)||value.events.length>20000||Buffer.byteLength(canonicalJson(value))>32*1024*1024)return bad();
 const heads=new Map<string,Entry>(),originals=new Map<string,Entry>(),nonces=new Set<string>();let last=-Infinity;
 for(let i=0;i<value.events.length;i++){
  const e=value.events[i],s=e?.snapshot,p=s?.publicChallenge;
  if(!recordV1(e,['ref','snapshot'])||!refV1(e.ref)||!recordV1(s,['sequence','binding','request','requestHash','publicChallenge','previousRef','consumption'])
   ||s.sequence!==i+1||e.ref.contentHash!==hash(s)||!hashV1(s.requestHash)||s.requestHash!==hash(s.request)
   ||!recordV1(s.binding,['transport','mode','projectId','connectorId','executionId','executionGeneration','grantRef','scopeDigest','credentialGeneration','publicKeyFingerprint'])
   ||s.binding.transport!=='SYNTHETIC_ONLY'||!hashV1(s.binding.scopeDigest)||!hashV1(s.binding.publicKeyFingerprint)
   ||!scopeKeys.filter(k=>k!=='credentialGeneration').every(k=>same(s.binding[k],(scope as any)[k]))||!positive(s.binding.credentialGeneration)
   ||!recordV1(p,['id','requestId','purpose','grantRef','credentialGeneration','scopeDigest','serverNonce','clientNonce','issuedAt','expiresAt'])
   ||p.id!==e.ref.id||p.requestId!==s.request.requestId||p.purpose!==s.request.purpose||!same(p.grantRef,s.binding.grantRef)||p.credentialGeneration!==s.binding.credentialGeneration
   ||p.scopeDigest!==s.binding.scopeDigest||p.clientNonce!==s.request.clientNonce||!isoV1(p.issuedAt)||!isoV1(p.expiresAt)||Date.parse(p.issuedAt)>Date.parse(now)
   ||Date.parse(p.expiresAt)<=Date.parse(p.issuedAt)||Date.parse(p.expiresAt)-Date.parse(p.issuedAt)>(p.purpose==='CREDENTIAL_EXCHANGE'?120000:30000))return bad();
  try{executionChallengeRequestBytes(s.binding.mode,s.request);canonicalBase64(p.serverNonce,32);}catch{return bad();}
  const entry=cloneV1(e) as unknown as Entry,previous=heads.get(e.ref.id),eventTime=s.consumption?.consumedAt??p.issuedAt;
  if(!isoV1(eventTime)||Date.parse(eventTime)<last||Date.parse(eventTime)>Date.parse(now))return bad();last=Date.parse(eventTime);
  if(!previous){
   if(e.ref.version!==1||s.previousRef!==null||s.consumption!==null||originals.has(p.requestId)||nonces.has(p.clientNonce))return bad();
   originals.set(p.requestId,entry);nonces.add(p.clientNonce);
  }else{
   if(e.ref.version!==2||previous.snapshot.consumption!==null||!same(s.previousRef,previous.ref)
    ||!same({...s,sequence:0,previousRef:null,consumption:null},{...previous.snapshot,sequence:0,previousRef:null,consumption:null})
    ||!recordV1(s.consumption,['proofHash','resultRef','consumedAt'])||!hashV1(s.consumption.proofHash)||!refV1(s.consumption.resultRef)
    ||Date.parse(s.consumption.consumedAt)>=Date.parse(p.expiresAt))return bad();
  }
  heads.set(e.ref.id,entry);
 }
 return{events:cloneV1(value.events) as Entry[],heads,originals,nonces,last};
}
/** 합성 저장 경계의 발급/소비 서비스. 운영 DB adapter/credential/실제 wire fallback은 없다. */
export class SyntheticExecutionChallenges {
 readonly store:SyntheticChallengeStore;
 constructor(store:SyntheticChallengeStore){if(!store||store.transport!=='SYNTHETIC_ONLY'||typeof store.transaction!=='function')fail('SYNTHETIC_CHALLENGE_STORE_REQUIRED');this.store=store;}
 async #current(tx:SyntheticChallengeTransaction,scope:Scope){
  if(this.store.transport!=='SYNTHETIC_ONLY')return fail('SYNTHETIC_CHALLENGE_STORE_REQUIRED');
  const raw=cloneV1(await tx.current()),now=await tx.clock(),c:any=raw.context;
  if(!isoV1(now)||!isoV1(raw.checkedAt)||Date.parse(raw.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(raw.checkedAt)>30000
   ||!recordV1(c,['transport','mode','projectId','connectorId','executionId','executionGeneration','grantRef','scopeDigest','credentialGeneration','publicKeyFingerprint','grantExpiresAt'])
   ||!subset(c,scope)||c.transport!=='SYNTHETIC_ONLY'||!hashV1(c.scopeDigest)||!hashV1(c.publicKeyFingerprint)||!isoV1(c.grantExpiresAt)||Date.parse(c.grantExpiresAt)<=Date.parse(now))return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED');
  try{if(publicKeyFingerprint(raw.spki)!==c.publicKeyFingerprint)throw Error();}catch{return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED');}
  return{context:c,spki:raw.spki,now};
 }
 #issued(e:Entry){return{ref:cloneV1(e.ref),challenge:cloneV1(e.snapshot.publicChallenge),credentialIssued:false as const,nonceConsumed:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};}
 #consumed(e:Entry){return{resultRef:cloneV1(e.snapshot.consumption!.resultRef),nonceConsumed:true as const,credentialIssued:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};}
 async issue(value:Scope,payload:unknown,sig:unknown){
  const scope=readScope(value),bytes=executionChallengeRequestBytes(scope.mode,payload),request=JSON.parse(bytes.toString()).request,requestHash=hash(request);
  return this.store.transaction(scope,async tx=>{
   const current=await this.#current(tx,scope),journal=readJournal(await tx.read(),scope,current.now);
   rawSignature(current.spki,sig,bytes,current.context.publicKeyFingerprint);
   const original=journal.originals.get(request.requestId);
   if(original){if(original.snapshot.requestHash!==requestHash)return fail('IDEMPOTENCY_CONFLICT',409);if(!same(original.snapshot.binding,binding(current.context)))return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED');return this.#issued(original);}
   verifyExecutionChallengeRequest(current.spki,sig,request,request,current.context,new Date(current.now));
   if(journal.nonces.has(request.clientNonce))return fail('EXECUTION_CHALLENGE_CLIENT_NONCE_REUSED',409);
   if(journal.originals.size>=10000)return fail('EXECUTION_CHALLENGE_LIFETIME_LIMIT',429);
   const exchange=request.purpose==='CREDENTIAL_EXCHANGE';
   const recent=[...journal.originals.values()].filter(e=>e.snapshot.publicChallenge.purpose===request.purpose&&Date.parse(e.snapshot.publicChallenge.issuedAt)>Date.parse(current.now)-60000
    &&(exchange||e.snapshot.binding.credentialGeneration===scope.credentialGeneration));
   if(recent.length>=(exchange?5:60))return fail('EXECUTION_CHALLENGE_RATE_LIMIT',429);
   if(!exchange&&[...journal.heads.values()].some(e=>e.snapshot.publicChallenge.purpose==='EXECUTION_REQUEST'&&e.snapshot.binding.credentialGeneration===scope.credentialGeneration
    &&e.snapshot.consumption===null&&Date.parse(e.snapshot.publicChallenge.expiresAt)>Date.parse(current.now)))return fail('EXECUTION_CHALLENGE_ACTIVE',409);
   const id=randomUUID(),publicChallenge={id,requestId:request.requestId,purpose:request.purpose,grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,scopeDigest:current.context.scopeDigest,
    serverNonce:randomBytes(32).toString('base64url'),clientNonce:request.clientNonce,issuedAt:current.now,expiresAt:new Date(Math.min(Date.parse(current.now)+(exchange?120000:30000),Date.parse(current.context.grantExpiresAt))).toISOString()};
   const snapshot={sequence:journal.events.length+1,binding:binding(current.context),request,requestHash,publicChallenge,previousRef:null,consumption:null};
   const entry:Entry={ref:{id,version:1,contentHash:hash(snapshot)},snapshot};
   readJournal({complete:true,events:[...journal.events,entry]},scope,current.now);
   const final=await this.#current(tx,scope);
   if(!same(binding(final.context),snapshot.binding)||Date.parse(final.now)>=Date.parse(publicChallenge.expiresAt))return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED');
   await tx.append(cloneV1(entry));return this.#issued(entry);
  });
 }
 async consume(value:Scope,challengeRef:VersionRef,payload:unknown,sig:unknown){
  const scope=readScope(value);if(!refV1(challengeRef)||challengeRef.version!==1)return fail('EXECUTION_CHALLENGE_REFERENCE_INVALID',422);challengeRef=cloneV1(challengeRef);
  return this.store.transaction(scope,async tx=>{
   const current=await this.#current(tx,scope),journal=readJournal(await tx.read(),scope,current.now),head=journal.heads.get(challengeRef.id);
   const original=head&&journal.originals.get(head.snapshot.publicChallenge.requestId);
   if(!head||!original||!same(original.ref,challengeRef))return fail('EXECUTION_CHALLENGE_NOT_FOUND',404);
   if(!same(head.snapshot.binding,binding(current.context)))return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED');
   const p=head.snapshot.publicChallenge,exchange=p.purpose==='CREDENTIAL_EXCHANGE';
   const kind=((scope.mode==='RECOVERY'?'EXECUTION_RECOVERY_':'EXECUTION_')+(exchange?'CREDENTIAL_EXCHANGE':'REQUEST_PROOF')) as Parameters<typeof executionProofBytes>[0];
   const bytes=executionProofBytes(kind,payload),request=JSON.parse(bytes.toString()).request,proofHash=hash(request);
   rawSignature(current.spki,sig,bytes,current.context.publicKeyFingerprint);
   if(head.snapshot.consumption){if(head.snapshot.consumption.proofHash!==proofHash)return fail('IDEMPOTENCY_CONFLICT',409);return this.#consumed(head);}
   const expected=exchange?{requestId:p.requestId,grantRef:p.grantRef,credentialGeneration:p.credentialGeneration,scopeDigest:p.scopeDigest,serverNonce:p.serverNonce,clientNonce:p.clientNonce,expiresAt:p.expiresAt}
    :{requestId:p.requestId,...head.snapshot.request.target,grantRef:p.grantRef,credentialGeneration:p.credentialGeneration,serverNonce:p.serverNonce};
   verifyExecutionProof(current.spki,sig,kind,request,expected,current.context,{issuedAt:p.issuedAt,expiresAt:p.expiresAt},new Date(current.now));
   const rawResult=await tx.recordResult({challengeRef:cloneV1(original.ref),requestId:p.requestId,proofHash});if(!refV1(rawResult))return fail('EXECUTION_CHALLENGE_RESULT_INVALID',503);
   const resultRef=cloneV1(rawResult);
   const final=await this.#current(tx,scope);if(!same(binding(final.context),head.snapshot.binding)||Date.parse(final.now)>=Date.parse(p.expiresAt))return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED');
   const snapshot={...head.snapshot,sequence:journal.events.length+1,previousRef:head.ref,consumption:{proofHash,resultRef:cloneV1(resultRef),consumedAt:final.now}},entry:Entry={ref:{id:head.ref.id,version:2,contentHash:hash(snapshot)},snapshot};
   readJournal({complete:true,events:[...journal.events,entry]},scope,final.now);await tx.append(cloneV1(entry));return this.#consumed(entry);
  });
 }
}
