import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {publicKeyFingerprint} from '../connections/registration-proof.ts';
import {SyntheticExecutionChallenges,type SyntheticChallengeScope,type SyntheticChallengeTransaction} from './execution-challenges.ts';
import {executionTarget} from './execution-proof.ts';
import {readSyntheticRecoveryRecord} from './execution-recovery.ts';
import {readSyntheticStopCommandRecord} from './execution-stop.ts';

type Binding={target:ReturnType<typeof executionTarget>;stopRef:Ref|null;envelopeHash:string|null;expiresAt:string};
export interface SyntheticRecoveryStopInstructionStore{
 readonly transport:'SYNTHETIC_ONLY';
 /** 현재 회수 허가/등록/정확 중지 선택과 nonce·원결과를 한 tx에서 잠그고 저장한다.
  * instructions.current는 {recovery,stop|null,authorityState,hostTrustState,recoveryPathState,checkedAt,expiresAt}다.
  * historical record 검사는 현재 authority의 근거가 아니다. P1의 합성 제공자만 허용한다. */
 transaction<T>(scope:SyntheticChallengeScope,body:(tx:{challenges:SyntheticChallengeTransaction;instructions:{current():Promise<unknown>};results:{bind(ref:Ref,binding:Binding):Promise<void>;read(ref:Ref):Promise<Binding|null>}})=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const reject=():never=>{throw new AuthFailure('RECOVERY_STOP_INSTRUCTION_REJECTED',412);};
/** 서명된 회수 요청에 저장된 graceful stop 봉투만 반환한다. 실제 credential/HTTP/OS/Agent는 없다. */
export class SyntheticRecoveryStopInstructions{
 readonly store:SyntheticRecoveryStopInstructionStore;
 constructor(store:SyntheticRecoveryStopInstructionStore){this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function')reject();}
 async read(rawScope:unknown,rawChallengeRef:unknown,rawProof:unknown,signature:unknown){
  try{
   this.#port();if(!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='RECOVERY'||!uuidV1(rawScope.projectId)||!uuidV1(rawScope.connectorId)||!uuidV1(rawScope.executionId)||!positive(rawScope.executionGeneration)||!positive(rawScope.credentialGeneration)||!refV1(rawScope.grantRef)||!refV1(rawChallengeRef)||rawChallengeRef.version!==1||typeof signature!=='string'||signature.length>128)return reject();
   const scope=cloneV1(rawScope) as unknown as SyntheticChallengeScope,challengeRef=cloneV1(rawChallengeRef) as Ref,proof=cloneV1(rawProof),target=executionTarget('GET','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/recovery/stop-instruction',[],null),execution={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration};
   if(!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},target))return reject();
   return await this.store.transaction(cloneV1(scope),async tx=>{
    const selection=async()=>{
     this.#port();const raw=cloneV1(await tx.instructions.current()),challenge=cloneV1(await tx.challenges.current()),now=await tx.challenges.clock();this.#port();
     if(!isoV1(now)||!recordV1(raw,['recovery','stop','authorityState','hostTrustState','recoveryPathState','checkedAt','expiresAt'])||raw.authorityState!=='VERIFIED_CURRENT'||raw.hostTrustState!=='TRUSTED'||raw.recoveryPathState!=='VERIFIED_CURRENT'||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=Date.parse(now))return reject();
     const recovery=readSyntheticRecoveryRecord(raw.recovery,execution),r=recovery.snapshot,c:any=challenge.context;
     if(!same(recovery.ref,scope.grantRef)||!isoV1(challenge.checkedAt)||Date.parse(challenge.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(challenge.checkedAt)>30000||c?.transport!=='SYNTHETIC_ONLY'||c.mode!=='RECOVERY'||!same(c.grantRef,scope.grantRef)||c.projectId!==scope.projectId||c.executionId!==scope.executionId||c.executionGeneration!==scope.executionGeneration||c.connectorId!==scope.connectorId||c.credentialGeneration!==scope.credentialGeneration||c.scopeDigest!==r.scopeDigest||c.publicKeyFingerprint!==r.binding.registration.hostPublicKeyFingerprint||r.binding.registration.connectorId!==scope.connectorId||!isoV1(c.grantExpiresAt)||Date.parse(c.grantExpiresAt)>Date.parse(r.expiresAt)||Date.parse(r.plannedAt)>Date.parse(now))return reject();
     if(publicKeyFingerprint(challenge.spki)!==c.publicKeyFingerprint)return reject();
     let deadline=Math.min(Date.parse(raw.expiresAt),Date.parse(r.expiresAt),Date.parse(c.grantExpiresAt)),instruction:null|{commandRef:Ref;envelope:ReturnType<typeof readDispatchEnvelopeV1>}=null;
     if(raw.stop!==null){
      const stop=readSyntheticStopCommandRecord(raw.stop,execution),s=stop.snapshot,b=s.currentBinding,rb=r.binding,envelope=readDispatchEnvelopeV1(s.envelope,Date.parse(now));
      if(b.grantKind==='EXECUTION'?!same(b.grantRef,rb.originalGrantRef):!same(b.grantRef,recovery.ref)||!same(b.grantSubject,(({kind:_,...subject})=>subject)(r.reviewer)))return reject();
      if(!same(b.executorRegistrationRef,rb.registration.ref)||!same(b.sessionBindingRef,rb.responsibleSessionRef)||!same(b.context.sourceScopes,rb.sourceScopes)||!same(b.permissionPolicyRef,rb.permissionPolicyRef)||!same(b.budgetPolicyRef,rb.budgetPolicyRef))return reject();
      deadline=Math.min(deadline,Date.parse(envelope.expiresAt));instruction={commandRef:cloneV1(stop.ref),envelope};
     }
     if(deadline<=Date.parse(now))return reject();return{instruction,deadline,now};
    };
    const bindingFor=(value:Awaited<ReturnType<typeof selection>>,expiresAt:string):Binding=>({target,stopRef:value.instruction?.commandRef??null,envelopeHash:value.instruction?.envelope.envelopeHash??null,expiresAt});
    const challenges=new SyntheticExecutionChallenges({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{if(!same(s,scope))return reject();return fn({...tx.challenges,recordResult:async value=>{
     const ref=cloneV1(await tx.challenges.recordResult(value)),selected=await selection(),journal=await tx.challenges.read(),entry=journal.events.find(e=>same(e.ref,challengeRef));
     if(!journal.complete||!entry||entry.snapshot.request.purpose!=='EXECUTION_REQUEST')return reject();const expiresAt=new Date(Math.min(selected.deadline,Date.parse(entry.snapshot.publicChallenge.expiresAt))).toISOString();if(Date.parse(expiresAt)<=Date.parse(selected.now))return reject();await tx.results.bind(ref,bindingFor(selected,expiresAt));return ref;
    }});}});
    const before=await challenges.consume(scope,challengeRef,proof,signature),binding=cloneV1(await tx.results.read(before.resultRef));
    if(!recordV1(binding,['target','stopRef','envelopeHash','expiresAt'])||!isoV1(binding.expiresAt))return reject();
    const final=await challenges.consume(scope,challengeRef,proof,signature),selected=await selection();this.#port();
    if(!same(before,final)||before.nonceConsumed!==true||before.credentialIssued!==false||before.executionAuthorized!==false||before.dispatchPerformed!==false||!same(binding,bindingFor(selected,binding.expiresAt))||Date.parse(binding.expiresAt)>selected.deadline||Date.parse(binding.expiresAt)<=Date.parse(selected.now))return reject();
    return{transport:'SYNTHETIC_ONLY' as const,proofResultRef:cloneV1(before.resultRef),instruction:cloneV1(selected.instruction),expiresAt:binding.expiresAt,cacheControl:'no-store' as const,nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const,writerReleaseVerified:false as const};
   });
  }catch{return reject();}
 }
}
