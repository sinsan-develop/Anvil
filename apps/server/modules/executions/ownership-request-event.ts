import {randomBytes,randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {checkOwnershipEventAppendV1,ownershipRequestFromEventV1,readOwnershipEventV1,readOwnershipHeadV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';

const fail=():never=>{throw Error('OWNERSHIP_REQUEST_PLAN_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hash=(v:unknown)=>contentHash(canonicalJson(v));

/** 서버 내부 조립만 수행한다. 입력은 authenticated project lock 아래 읽은 원 기록이어야 한다.
 * current policy/registration/writer/slot 검사·원자 저장·COMMIT·송신을 수행하거나 증명하지 않는다.
 * 반환 PLAN을 확정된 요청/실행 권한으로 노출하지 않는다. 기본 route 등록은 없다. */
export function planOwnershipObservationRequest(value:unknown){
 try{
  if(!recordV1(value,['preparation','tail','anchor','head','authorityExpiresAt','nowMs']))return fail();
  const v=cloneV1(value),now=v.nowMs;
  if(!Number.isSafeInteger(now)||!Number.isSafeInteger(now+10000)||!isoV1(v.authorityExpiresAt)||Date.parse(v.authorityExpiresAt)<=now)return fail();
  const prep=readOwnershipEventV1(v.preparation),tail=readOwnershipEventV1(v.tail),p=prep.snapshot,t=tail.snapshot;
  if(p.kind!=='PREPARATION_GRANTED'||!same(p.scope,t.scope)||!same(p.subject,t.subject)||!same(p.registrationRef,t.registrationRef)||Date.parse(p.at)>now||Date.parse(t.at)>now||Date.parse(p.expiresAt)<=now||Date.parse(t.expiresAt)<=now)return fail();
  const a=v.anchor;
  if(!recordV1(a,['ref','snapshot'])||!refV1(a.ref)||a.ref.version!==1||!recordV1(a.snapshot,['schemaVersion','purpose','transport','scope','processRef','observerRef','recordedAt','expiresAt','state','fileSandboxVerified','executionAuthorized','dispatchPerformed'])||hash(a.snapshot)!==a.ref.contentHash)return fail();
  const s=a.snapshot;
  if(s.schemaVersion!==1||s.purpose!=='PROCESS_OWNERSHIP_ANCHOR'||s.transport!=='SYNTHETIC_ONLY'||s.state!=='BOUND'||s.fileSandboxVerified!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||!recordV1(s.scope,['projectId','executionId','executionGeneration','sessionBindingRef','roleBindingRef','executorRegistrationRef'])||s.scope.projectId!==p.scope.projectId||s.scope.executionId!==p.scope.executionId||s.scope.executionGeneration!==p.scope.executionGeneration||!refV1(s.scope.sessionBindingRef)||!refV1(s.scope.roleBindingRef)||!same(s.scope.executorRegistrationRef,p.registrationRef)||!same(s.observerRef,p.payload.observerRef)||!isoV1(s.recordedAt)||!isoV1(s.expiresAt)||Date.parse(s.recordedAt)<Date.parse(p.at)||Date.parse(s.recordedAt)>now||Date.parse(s.expiresAt)>Date.parse(p.expiresAt)||Date.parse(s.expiresAt)<=now)return fail();
  if(!recordV1(s.processRef,['runId','generation','jobId','pid','startTicks','executableHash'])||s.processRef.runId!==p.payload.runId||s.processRef.generation!==p.payload.processGeneration||s.processRef.executableHash!==p.payload.workerHash)return fail();
  const head=v.head===null?null:readOwnershipHeadV1(v.head),phase=head?'CURRENT' as const:'BOOTSTRAP_PREPARED' as const;
  if(!head){if(!same(tail.ref,prep.ref))return fail();}
  else{
   // BINDING payload는 원 anchor를 가리키며 preparationRef를 중복 보관하지 않는다.
   const preparationMatches=t.kind==='BINDING_RECORDED'||same(t.payload.preparationRef,prep.ref);
   if(!same(head.snapshot.scope,p.scope)||head.snapshot.state!=='ACTIVE'||!same(head.snapshot.anchorRef,a.ref)||!same(head.snapshot.currentEventRef,tail.ref)||Date.parse(head.snapshot.updatedAt)>now||Date.parse(head.snapshot.expiresAt)<=now||!preparationMatches||!same(t.payload.anchorRef,a.ref))return fail();
  }
  const end=Math.min(now+10000,Date.parse(v.authorityExpiresAt),Date.parse(p.expiresAt),Date.parse(t.expiresAt),Date.parse(s.expiresAt),head?Date.parse(head.snapshot.expiresAt):Infinity);
  if(!Number.isSafeInteger(end)||end<=now)return fail();
  const requestedAt=new Date(now).toISOString(),expiresAt=new Date(end).toISOString();
  const request={protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',...cloneV1(p.scope),registrationRef:cloneV1(p.registrationRef),publicKeyFingerprint:p.payload.publicKeyFingerprint,observerRef:cloneV1(p.payload.observerRef),anchorRef:cloneV1(a.ref),preparationRef:cloneV1(prep.ref),phase,expectedHeadRef:head?.ref??null,nonce:randomBytes(32).toString('base64url'),requestedAt,expiresAt};
  // 새 관측 권위는 원 준비 receipt에서만 가져오고 tail의 사건 receipt를 재사용하지 않는다.
  const snapshot={...cloneV1(p),sequence:t.sequence+1,previousRef:tail.ref,kind:'OBSERVATION_REQUESTED',payload:{request,processRef:cloneV1(s.processRef)},at:requestedAt,expiresAt};
  const event=checkOwnershipEventAppendV1(tail,{ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot},now);
  return{purpose:'OWNERSHIP_REQUEST_EVENT_PLAN' as const,event,request:ownershipRequestFromEventV1(event),candidateAnchor:head?null:cloneV1(a),executionAuthorized:false as const,dispatchPerformed:false as const};
 }catch{return fail();}
}
