import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1} from '../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
import type {SentProcessSelection,SyntheticSentProcessArchive} from './sent-process-evidence.ts';

/** 내부 source 계약만. 실제 서버/RPC/fresh producer는 기본 미등록이며 HTTP 입력으로 채택하지 않는다. */
export interface SyntheticOwnershipCurrentSource {transport:'SYNTHETIC_ONLY';resolve(selection:SentProcessSelection,signal:AbortSignal):Promise<unknown>}
const fail=():never=>{throw Error('SENT_CURRENT_ARCHIVE_UNAVAILABLE');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
/** 응답 목적 전/후 두 조회의 명시적 합성 투영이다. fact.osFence/writerState를 수정하지 않는다.
 * 기존 consumer의 별도 서버 현재성/OS observer 검사를 생략하거나 실제 권한을 생성하지 않는다. */
export class SyntheticSentProcessCurrentArchive implements SyntheticSentProcessArchive {
 readonly transport='SYNTHETIC_ONLY' as const;
 #source:SyntheticOwnershipCurrentSource|null;#clock:()=>number;#timeout:number;#calls=0;#selection:string|null=null;
 #requests=new Set<string>();#observations=new Set<string>();#last:Record<string,any>|null=null;
 constructor(source:SyntheticOwnershipCurrentSource|null,options:{clock:()=>number;timeoutMs:number}){this.#source=source;this.#clock=options.clock;this.#timeout=options.timeoutMs;if(typeof this.#clock!=='function'||!Number.isSafeInteger(this.#timeout)||this.#timeout<1||this.#timeout>10000)return fail();}
 #now(){const n=this.#clock();if(!Number.isSafeInteger(n)||!Number.isFinite(new Date(n).getTime()))return fail();return n;}
 async readCurrent(value:SentProcessSelection,signal:AbortSignal){
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
  try{
   const source=this.#source,resolve=source?.resolve;if(!source||source.transport!=='SYNTHETIC_ONLY'||typeof resolve!=='function'||!(signal instanceof AbortSignal)||signal.aborted||this.#calls>=2)return fail();
   const s=cloneV1(value),started=this.#now(),end=started+this.#timeout;
   if(!recordV1(s,['envelope','parentThreadClaimRef','attemptRef','permitRef','ownershipEvidenceRef','instructionContentHash','preSendBindingHash'])||!(['parentThreadClaimRef','attemptRef','permitRef','ownershipEvidenceRef'] as const).every(k=>refV1(s[k]))||!hashV1(s.instructionContentHash)||!hashV1(s.preSendBindingHash))return fail();
   const e=readDispatchEnvelopeV1(s.envelope,started);if(e.operation!=='SEND_INSTRUCTION')return fail();
   const selected=hash(s);if(this.#selection!==null&&this.#selection!==selected)return fail();this.#selection=selected;this.#calls++;
   const guard=()=>{if(signal.aborted||controller.signal.aborted||this.#source!==source||source.transport!=='SYNTHETIC_ONLY'||source.resolve!==resolve||this.#now()>=end)return fail();};guard();
   const cancelled=new Promise<never>((_,reject)=>{abort=()=>{controller.abort();reject(Error('SENT_CURRENT_ARCHIVE_UNAVAILABLE'));};signal.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,this.#timeout);});
   const raw=await Promise.race([Promise.resolve().then(()=>{guard();return resolve.call(source,cloneV1(s),controller.signal);}),cancelled]);guard();const v=cloneV1(raw);
   if(!recordV1(v,['purpose','transport','archive','requestRef','observationRef','headRef','missingEvidence','currentAuthorityVerified','writerReleaseVerified','fileSandboxVerified','executionAuthorized','dispatchPerformed'])||v.purpose!=='SYNTHETIC_OWNERSHIP_CURRENT_BASIS_ONLY'||v.transport!=='SYNTHETIC_ONLY'||!['currentAuthorityVerified','writerReleaseVerified','fileSandboxVerified','executionAuthorized','dispatchPerformed'].every(k=>v[k]===false)||!['requestRef','observationRef','headRef'].every(k=>refV1(v[k]))||!Array.isArray(v.missingEvidence)||v.missingEvidence.length>20||new Set(v.missingEvidence).size!==v.missingEvidence.length||!['ACTUAL_CURRENT_AUTHORITY_PROVIDER','VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE','SOURCE_WRITE_SANDBOX'].every(k=>v.missingEvidence.includes(k)))return fail();
   if(this.#requests.has(v.requestRef.id)||this.#observations.has(v.observationRef.id))return fail();
   const a=v.archive;if(!recordV1(a,['anchor','binding','anchorHeadRef','bindingHeadRef','revoked','readAt','expiresAt'])||a.revoked!==false||!isoV1(a.readAt)||!isoV1(a.expiresAt)||Date.parse(a.readAt)<started||Date.parse(a.readAt)>this.#now()||Date.parse(a.expiresAt)<=this.#now()||Date.parse(a.expiresAt)<=Date.parse(a.readAt))return fail();
   for(const name of ['anchor','binding']){const r=a[name];if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||hash(r.snapshot)!==r.ref.contentHash)return fail();}
   if(!same(a.anchor.ref,s.ownershipEvidenceRef)||!same(a.anchorHeadRef,a.anchor.ref)||!same(a.bindingHeadRef,a.binding.ref))return fail();
   const p=a.anchor.snapshot,b=a.binding.snapshot;
   if(!recordV1(p,['schemaVersion','purpose','transport','scope','processRef','observerRef','recordedAt','expiresAt','state','fileSandboxVerified','executionAuthorized','dispatchPerformed'])||p.schemaVersion!==1||p.purpose!=='PROCESS_OWNERSHIP_ANCHOR'||p.transport!=='SYNTHETIC_ONLY'||p.state!=='BOUND'||p.fileSandboxVerified!==false||p.executionAuthorized!==false||p.dispatchPerformed!==false||!refV1(p.observerRef)||!recordV1(p.scope,['projectId','executionId','executionGeneration','sessionBindingRef','roleBindingRef','executorRegistrationRef'])||p.scope.projectId!==e.context.projectId||p.scope.executionId!==e.context.executionId||p.scope.executionGeneration!==e.context.executionGeneration||!same(p.scope.sessionBindingRef,e.payload.sessionBindingRef)||!same(p.scope.executorRegistrationRef,e.executorRegistrationRef)||!refV1(p.scope.roleBindingRef))return fail();
   if(!recordV1(b,['schemaVersion','purpose','transport','ownershipEvidenceRef','scope','commandId','envelopeHash','parentThreadClaimRef','attemptRef','permitRef','instructionContentHash','preSendBindingHash','recordedAt','expiresAt'])||b.schemaVersion!==1||b.purpose!=='SENT_PROCESS_BINDING'||b.transport!=='SYNTHETIC_ONLY'||!same(b.scope,p.scope)||!same(b.ownershipEvidenceRef,a.anchor.ref)||b.commandId!==e.commandId||b.envelopeHash!==e.envelopeHash||!same(b.parentThreadClaimRef,s.parentThreadClaimRef)||!same(b.attemptRef,s.attemptRef)||!same(b.permitRef,s.permitRef)||b.instructionContentHash!==s.instructionContentHash||b.preSendBindingHash!==s.preSendBindingHash)return fail();
   for(const r of [p,b])if(!isoV1(r.recordedAt)||!isoV1(r.expiresAt)||Date.parse(r.recordedAt)>this.#now()||Date.parse(r.expiresAt)<=this.#now()||Date.parse(r.expiresAt)<=Date.parse(r.recordedAt))return fail();
   if(Date.parse(b.recordedAt)<Date.parse(p.recordedAt)||this.#last&&(!same(a.anchor,this.#last.anchor)||!same(a.binding,this.#last.binding)||v.headRef.id!==this.#last.headRef.id||v.headRef.version<=this.#last.headRef.version))return fail();
   const expiresAt=Math.min(end,Date.parse(e.expiresAt),Date.parse(a.expiresAt),Date.parse(p.expiresAt),Date.parse(b.expiresAt));guard();if(this.#now()>=expiresAt)return fail();
   this.#requests.add(v.requestRef.id);this.#observations.add(v.observationRef.id);this.#last=cloneV1({anchor:a.anchor,binding:a.binding,headRef:v.headRef});
   return cloneV1({...a,expiresAt:new Date(expiresAt).toISOString()});
  }catch{return fail();}finally{controller.abort();if(timer)clearTimeout(timer);signal instanceof AbortSignal&&signal.removeEventListener('abort',abort);}
 }
}
