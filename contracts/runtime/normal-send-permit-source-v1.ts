import {canonicalJson,contentHash} from '../canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from './validation-v1.ts';
import {executionFactChecks,readServerExecutionFactV1} from './server-execution-fact-v1.ts';

export const normalSendPermitRepresentation='SEND_PERMIT_SOURCE_V1' as const;
export interface NormalPermitRequestV1 {envelopeHash:string;localAttemptRef:Ref;sourceObservationRefs:Ref[];osOwnershipRef:Ref;representation?:typeof normalSendPermitRepresentation}
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const bad=():never=>{throw Error('NORMAL_SEND_PERMIT_SOURCE_INVALID');};
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&recordV1(v,Object.keys(v));
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
/** 선택값도 원 signed body의 일부다. 구형 4키의 보관 해시를 재작성하지 않는다. */
export function readNormalPermitRequestV1(raw:unknown):NormalPermitRequestV1{
 const keys=['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'];
 if(!(recordV1(raw,keys)||recordV1(raw,[...keys,'representation'])&&raw.representation===normalSendPermitRepresentation)||
  !hashV1(raw.envelopeHash)||!refV1(raw.localAttemptRef)||!refV1(raw.osOwnershipRef)||
  !arrayV1(raw.sourceObservationRefs,200)||!raw.sourceObservationRefs.length||!raw.sourceObservationRefs.every(refV1)||
  new Set(raw.sourceObservationRefs.map(canonicalJson)).size!==raw.sourceObservationRefs.length)return bad();
 return cloneV1(raw) as unknown as NormalPermitRequestV1;
}
export function normalSendPermitSourceEligible(f:unknown):boolean{
 return object(f)&&object(f.intent)&&f.intent.mode==='CONTEXT_REVIEW'&&arrayV1(f.intent.sourceScopes,200)&&
  f.intent.sourceScopes.every(s=>object(s)&&arrayV1(s.targets,200)&&s.targets.every(t=>object(t)&&t.access==='READ'));
}
/** 보호 응답의 원 permit fullref를 검산한다. 입력을 서버 권위/현재성의 생산자로 승격하지 않는다. */
export function readNormalSendPermitSourceV1(raw:unknown,expected:{scope:unknown;request:NormalPermitRequestV1;permit:{ref:Ref;commandId:string;envelopeHash:string;issuedAt:string;expiresAt:string};proofResultRef:Ref}){
 if(!recordV1(raw,['kind','permitSnapshot'])||raw.kind!=='NORMAL_SEND_PERMIT_SOURCE_V1'||Buffer.byteLength(canonicalJson(raw))>2097152)return bad();
 const s=raw.permitSnapshot,p=expected.permit,scope=expected.scope;
 const keys=['scope','commandId','commandRef','request','requestHash','proofRef','authorizationReceiptRef','bindingHash','currentFact','reservationRef','state','issuedAt','expiresAt','commandExpiresAt','grantExpiresAt','proofExpiresAt','executionAuthorized','dispatchPerformed'];
 if(!recordV1(s,keys)||!recordV1(scope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||
  scope.mode!=='EXECUTION'||![scope.projectId,scope.connectorId,scope.executionId].every(uuidV1)||!refV1(scope.grantRef)||!positive(scope.executionGeneration)||!positive(scope.credentialGeneration)||
  p.ref.version!==1||hash(s)!==p.ref.contentHash||!same(s.scope,scope)||s.commandId!==p.commandId||
  s.state!=='NORMAL_INSTRUCTION_PERMITTED'||s.executionAuthorized!==true||s.dispatchPerformed!==false||
  ![s.commandRef,s.proofRef,s.authorizationReceiptRef,s.reservationRef].every(x=>refV1(x)&&x.version===1)||!same(s.proofRef,expected.proofResultRef)||
  s.issuedAt!==p.issuedAt||s.expiresAt!==p.expiresAt||![s.issuedAt,s.expiresAt,s.commandExpiresAt,s.grantExpiresAt,s.proofExpiresAt].every(isoV1))return bad();
 const request=readNormalPermitRequestV1(s.request);
 if(request.localAttemptRef.version!==1||request.representation!==normalSendPermitRepresentation||!same(request,expected.request)||request.envelopeHash!==p.envelopeHash||s.requestHash!==hash(request))return bad();
 const f=s.currentFact;
 if(!object(f)||f.transport!=='NORMAL_PROTECTED'||!recordV1(f.agentSession,['sessionRef','roleBindingRef','bindingGeneration'])||!positive(f.agentSession.bindingGeneration)||
  !recordV1(f.executionCredentialReservation,['id','generation'])||!uuidV1(f.executionCredentialReservation.id)||!positive(f.executionCredentialReservation.generation)||!normalSendPermitSourceEligible(f))return bad();
 const {executionCredentialReservation:_,...shape}=f,ag=f.agentSession;
 const fact=readServerExecutionFactV1({...shape,transport:'SYNTHETIC_ONLY',agentSession:{sessionRef:ag.sessionRef,roleBindingRef:ag.roleBindingRef,credentialGeneration:ag.bindingGeneration}});
 const {checkedAt:__,expires:___,...binding}=f;
 if(s.bindingHash!==hash({scope,commandRef:s.commandRef,authorizationReceiptRef:s.authorizationReceiptRef,reservationRef:s.reservationRef,fact:binding})||
  fact.projectId!==scope.projectId||fact.executionId!==scope.executionId||fact.executionGeneration!==scope.executionGeneration||fact.registration.connectorId!==scope.connectorId||
  f.executionCredentialReservation.generation!==scope.credentialGeneration||fact.writerState!=='OWNED'||executionFactChecks.some(k=>k!=='understanding'&&fact.checks[k].state!=='VERIFIED_CURRENT'))return bad();
 const refs=[...new Map(fact.intent.sourceScopes.map(v=>[canonicalJson(v.observationRef),v.observationRef])).values()];
 const issued=Date.parse(s.issuedAt),expires=Date.parse(s.expiresAt),checked=Date.parse(fact.checkedAt);
 if(!same(refs,request.sourceObservationRefs)||!fact.checks.osFence.evidenceRefs.some(r=>same(r,request.osOwnershipRef))||checked>issued||issued-checked>30000||expires<=issued||
  expires>Math.min(issued+30000,Date.parse(s.commandExpiresAt),Date.parse(s.grantExpiresAt),Date.parse(s.proofExpiresAt),checked+30000,...Object.values(fact.expires).map(Date.parse)))return bad();
 return cloneV1(raw);
}
