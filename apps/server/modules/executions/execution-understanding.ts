import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectMember,projectReplay,recordProjectDenial,type ProjectCommand} from '../access/project-command.ts';
import {isApprovalRef} from '../approvals/approval-input.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';

export const understandingCodes=['PURPOSE_REASON','BASELINE_AUTHORITY','DECISIONS_REASON','CURRENT_POSITION','ACTUAL_GAPS','NEXT_ACTION'] as const;
type Code=typeof understandingCodes[number];
interface Scope{projectId:string;executionId:string;executionGeneration:number}
interface Item{code:Code;sourceRefs:Ref[];responsePartRefs:Ref[];judgement:'MATCH'|'MISMATCH'|'INSUFFICIENT';reason:string}
interface Input{bundleRef:Ref;responseRef:Ref;subjectBindingRef:Ref;criteriaVersion:1;items:Item[];reason:string}
interface Current{transport:'SYNTHETIC_ONLY';scope:Scope;bundleRef:Ref;responseRef:Ref;subjectBindingRef:Ref;basisRefs:Ref[];latestInstructionRefs:{kind:'CONVERSATION';id:string;contentHash:string}[];
 requiredPartRefs:Ref[];receivedPartRefs:Ref[];responsePartRefs:Ref[];criteria:{code:Code;sourceRefs:Ref[];responsePartRefs:Ref[]}[];sourceState:'AVAILABLE';responseSubject:'EXTERNAL_AGENT';checkedAt:string;expiresAt:string}
interface Reviewer{kind:'HUMAN';userId:string;clientId:string;humanSessionId:string;credentialGeneration:number;controlGeneration:number}
interface Snapshot{scope:Scope;sequence:number;previousRef:Ref|null;request:ProjectCommand;requestHash:string;reviewer:Reviewer;policyRef:Ref;currentBinding:Omit<Current,'checkedAt'|'expiresAt'>;input:Input;outcome:'ACCEPTED'|'NOT_ACCEPTED';recordedAt:string;executionAuthorized:false;dispatchPerformed:false}
export interface UnderstandingRecord{ref:Ref;snapshot:Snapshot}
/** 내부 합성 제공자만. 같은 AccessRepository transaction의 잠금/현재 원문 대조/불변 append를 소비해야 한다.
 * 실제 응답·부분 수신·현재 source 제공자와 PG 저장을 구현한 것으로 간주하지 않는다. HTTP caller가 주입할 수 없다. */
export interface SyntheticUnderstandingStore{readonly transport:'SYNTHETIC_ONLY';current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope):Promise<Current>;
 list(db:PoolClient,scope:Scope):Promise<UnderstandingRecord[]>;append(db:PoolClient,scope:Scope,record:UnderstandingRecord,createdCommandId:string):Promise<void>}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const bad=(code='UNDERSTANDING_INPUT_INVALID',status=412):never=>{throw new AuthFailure(code,status);};
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const refs=(v:unknown,required=true):v is Ref[]=>arrayV1(v,200)&&(!required||v.length>0)&&v.every(refV1)&&new Set(v.map(canonicalJson)).size===v.length;
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>20000)bad();assertKnowledgeTextSafe(v as string);};
function scopeOf(v:unknown):Scope{if(!recordV1(v,['projectId','executionId','executionGeneration'])||!uuidV1(v.projectId)||!uuidV1(v.executionId)||!positive(v.executionGeneration))return bad();return cloneV1(v) as Scope;}
function readInput(v:unknown):Input{
 if(!recordV1(v,['bundleRef','responseRef','subjectBindingRef','criteriaVersion','items','reason'])||!refV1(v.bundleRef)||!refV1(v.responseRef)||!refV1(v.subjectBindingRef)||v.criteriaVersion!==1||!arrayV1(v.items,6)||v.items.length!==6) return bad();
 text(v.reason);const seen=new Set<string>();
 for(const i of v.items){if(!recordV1(i,['code','sourceRefs','responsePartRefs','judgement','reason'])||!understandingCodes.includes(i.code)||seen.has(i.code)||!refs(i.sourceRefs)||!refs(i.responsePartRefs)||!['MATCH','MISMATCH','INSUFFICIENT'].includes(i.judgement))return bad();text(i.reason);seen.add(i.code);}
 return cloneV1(v) as Input;
}
export function readUnderstandingReviewCommand(v:unknown):ProjectCommand{
 if(!recordV1(v,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||v.schemaVersion!==1||!uuidV1(v.projectId)||!uuidV1(v.commandId)||!uuidV1(v.clientId)||!positive(v.controlGeneration)||v.operation!=='reviewUnderstanding'||!uuidV1(v.targetId)||!positive(v.expectedVersion)||!arrayV1(v.baselineRefs,0)||v.approvalRef!==null&&!isApprovalRef(v.approvalRef)||Buffer.byteLength(canonicalJson(v))>2*1024*1024)return bad();
 readInput(v.payload);return cloneV1(v) as unknown as ProjectCommand;
}
function matches(input:Input,c:Current|Snapshot['currentBinding']){
 if(!same(input.bundleRef,c.bundleRef)||!same(input.responseRef,c.responseRef)||!same(input.subjectBindingRef,c.subjectBindingRef))bad('UNDERSTANDING_SUBJECT_CHANGED');
 for(const item of input.items){const criterion=c.criteria.find(v=>v.code===item.code);if(!criterion||!same(item.sourceRefs,criterion.sourceRefs)||!same(item.responsePartRefs,criterion.responsePartRefs))bad('UNDERSTANDING_EVIDENCE_MISMATCH');}
}
function currentShape(raw:unknown,scope:Scope,at:string){
 if(!isoV1(at)||!recordV1(raw,['transport','scope','bundleRef','responseRef','subjectBindingRef','basisRefs','latestInstructionRefs','requiredPartRefs','receivedPartRefs','responsePartRefs','criteria','sourceState','responseSubject','checkedAt','expiresAt'])||raw.transport!=='SYNTHETIC_ONLY'||!same(scopeOf(raw.scope),scope)||!refV1(raw.bundleRef)||!refV1(raw.responseRef)||!refV1(raw.subjectBindingRef)||!refs(raw.basisRefs)||!arrayV1(raw.latestInstructionRefs,200)||!raw.latestInstructionRefs.every(v=>recordV1(v,['kind','id','contentHash'])&&v.kind==='CONVERSATION'&&refV1({id:v.id,version:1,contentHash:v.contentHash}))||!refs(raw.requiredPartRefs)||!refs(raw.receivedPartRefs)||!refs(raw.responsePartRefs)||!arrayV1(raw.criteria,6)||raw.criteria.length!==6||raw.sourceState!=='AVAILABLE'||raw.responseSubject!=='EXTERNAL_AGENT'||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>Date.parse(at)||Date.parse(at)-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=Date.parse(at))return bad('UNDERSTANDING_CURRENT_REQUIRED');
 const c=cloneV1(raw) as Current,seen=new Set<string>();
 if(!c.requiredPartRefs.every(r=>c.receivedPartRefs.some(v=>same(r,v))))bad('UNDERSTANDING_REQUIRED_PART_MISSING');
 for(const i of c.criteria){if(!recordV1(i,['code','sourceRefs','responsePartRefs'])||!understandingCodes.includes(i.code)||seen.has(i.code)||!refs(i.sourceRefs)||!i.sourceRefs.every(r=>c.basisRefs.some(v=>same(r,v)))||!refs(i.responsePartRefs)||!i.responsePartRefs.every(r=>c.responsePartRefs.some(v=>same(r,v))))bad('UNDERSTANDING_CURRENT_REQUIRED');seen.add(i.code);}
 const {checkedAt:_,expiresAt:__,...binding}=c;return{c,binding};
}
export function readUnderstandingHistory(raw:unknown,scope:Scope):UnderstandingRecord[]{
 if(!arrayV1(raw,1000)||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)return bad('UNDERSTANDING_HISTORY_INVALID',503);
 let previous:UnderstandingRecord|null=null;
 const commands=new Set<string>();
 for(const entry of raw){const s=entry?.snapshot,r=s?.reviewer;
  if(!recordV1(entry,['ref','snapshot'])||!refV1(entry.ref)||!recordV1(s,['scope','sequence','previousRef','request','requestHash','reviewer','policyRef','currentBinding','input','outcome','recordedAt','executionAuthorized','dispatchPerformed'])||!same(scopeOf(s.scope),scope)||s.sequence!==(previous?.snapshot.sequence??0)+1||entry.ref.version!==s.sequence||previous&&entry.ref.id!==previous.ref.id||!same(s.previousRef,previous?.ref??null)||entry.ref.contentHash!==hash(s)||!refV1(s.policyRef)||!recordV1(r,['kind','userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||r.kind!=='HUMAN'||!uuidV1(r.userId)||!uuidV1(r.clientId)||!uuidV1(r.humanSessionId)||!positive(r.credentialGeneration)||!positive(r.controlGeneration)||!isoV1(s.recordedAt)||previous&&Date.parse(s.recordedAt)<Date.parse(previous.snapshot.recordedAt)||s.executionAuthorized!==false||s.dispatchPerformed!==false)bad('UNDERSTANDING_HISTORY_INVALID',503);
  const request=readUnderstandingReviewCommand(s.request),input=readInput(s.input);
  if(request.projectId!==scope.projectId||request.targetId!==scope.executionId||request.expectedVersion!==scope.executionGeneration||request.clientId!==r.clientId||request.controlGeneration!==r.controlGeneration||s.requestHash!==hash(request)||!same(request.payload,input)||commands.has(request.commandId)||s.outcome!==(input.items.every(i=>i.judgement==='MATCH')?'ACCEPTED':'NOT_ACCEPTED'))bad('UNDERSTANDING_HISTORY_INVALID',503);
  currentShape({...s.currentBinding,checkedAt:s.recordedAt,expiresAt:new Date(Date.parse(s.recordedAt)+1).toISOString()},scope,s.recordedAt);matches(input,s.currentBinding);commands.add(request.commandId);previous=entry;
 }
 return cloneV1(raw) as UnderstandingRecord[];
}
/** 명시 HUMAN 검토 저장/조회와 WORK 선행 대조. 합성 서비스만이며 권한·실행 성공을 발급하지 않는다. */
export class ProjectUnderstandingReviews{
 readonly access:AccessRepository;readonly store:SyntheticUnderstandingStore;
 constructor(access:AccessRepository,store:SyntheticUnderstandingStore){this.access=access;this.store=store;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||['current','list','append'].some(k=>typeof(this.store as any)[k]!=='function'))bad('SYNTHETIC_UNDERSTANDING_STORE_REQUIRED');}
 async #current(db:PoolClient,actor:AuthenticatedIdentity,scope:Scope){this.#port();const raw=cloneV1(await this.store.current(db,actor,cloneV1(scope))),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))bad('UNDERSTANDING_CLOCK_INVALID',503);return{...currentShape(raw,scope,at.toISOString()),at:at.toISOString()};}
 async command(token:string,csrf:string,raw:ProjectCommand){
  const request=readUnderstandingReviewCommand(raw),scope=scopeOf({projectId:request.projectId,executionId:request.targetId,executionGeneration:request.expectedVersion}),input=readInput(request.payload);
  try{return await this.access.authenticated(token,csrf,async(db,actor)=>{
   this.#port();await currentProjectController(db,actor,request);let policy=await authorizeMaterial(db,actor,request);
   if(!actor.authSession||!uuidV1(actor.authSession.id))return bad('UNDERSTANDING_HUMAN_REQUIRED');
   const replay=await projectReplay(db,actor,request);if(replay!==undefined)return replay;
   const before=await this.#current(db,actor,scope);matches(input,before.c);
   const entries=readUnderstandingHistory(await this.store.list(db,cloneV1(scope)),scope),previous=entries.at(-1)??null;if(entries.length>=1000)bad('UNDERSTANDING_HISTORY_FULL');
   await currentProjectController(db,actor,request);policy=await authorizeMaterial(db,actor,request);
   const final=await this.#current(db,actor,scope);
   if(!same(before.binding,final.binding)||Date.parse(final.at)>=Math.min(Date.parse(before.c.expiresAt),Date.parse(final.c.expiresAt),policy.validUntil,Date.parse(actor.authSession.idleExpiresAt),Date.parse(actor.authSession.absoluteExpiresAt)))bad('UNDERSTANDING_CURRENT_CHANGED');
   matches(input,final.c);
   const snapshot:Snapshot={scope,sequence:entries.length+1,previousRef:previous?.ref??null,request,requestHash:hash(request),reviewer:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId,humanSessionId:actor.authSession.id,credentialGeneration:actor.credentialGeneration,controlGeneration:request.controlGeneration},policyRef:policy.ref,currentBinding:final.binding,input,outcome:input.items.every(i=>i.judgement==='MATCH')?'ACCEPTED':'NOT_ACCEPTED',recordedAt:final.at,executionAuthorized:false,dispatchPerformed:false};
   const record={ref:{id:previous?.ref.id??randomUUID(),version:snapshot.sequence,contentHash:hash(snapshot)},snapshot};readUnderstandingHistory([...entries,record],scope);
   const receipt=await persistProjectReceipt(db,actor,request,record.ref,{status:'SYNTHETIC_UNDERSTANDING_REVIEWED',snapshot},policy.ref,'EXPLICIT_HUMAN_UNDERSTANDING_REVIEW');
   await this.store.append(db,cloneV1(scope),cloneV1(record),receipt.id);return receipt.result;
  });}catch(error){await recordProjectDenial(this.access,token,request.projectId,error);throw error;}
 }
 async list(token:string,rawScope:unknown){
  const scope=scopeOf(rawScope);let deadline=0,monotonicDeadline=0;
  const result=await this.access.authenticated(token,null,async(db,actor)=>{
   this.#port();const session=actor.authSession;if(!session||!uuidV1(session.id))return bad('UNDERSTANDING_HUMAN_REQUIRED');
   const now=async()=>{const mark=performance.now(),at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return bad('UNDERSTANDING_CLOCK_INVALID',503);return{at:at.getTime(),mark};};
   const start=await now();deadline=Math.min(start.at+30000,Date.parse(session.idleExpiresAt),Date.parse(session.absoluteExpiresAt));
   if(!Number.isFinite(deadline)||start.at>=deadline)bad('AUTH_REQUIRED',401);monotonicDeadline=start.mark+deadline-start.at;
   await projectMember(db,actor,scope.projectId,true);const items=readUnderstandingHistory(await this.store.list(db,cloneV1(scope)),scope);this.#port();
   const final=await now();if(final.at>=deadline)bad('AUTH_REQUIRED',401);monotonicDeadline=Math.min(monotonicDeadline,final.mark+deadline-final.at);
   return{transport:'SYNTHETIC_ONLY',scope,items,currentness:'NOT_RECHECKED',executionAuthorized:false,dispatchPerformed:false};
  });
  // authenticated의 COMMIT·connection release도 반환 전 유한 조회 창 안이어야 한다.
  this.#port();if(performance.now()>=monotonicDeadline)bad('AUTH_REQUIRED',401);return result;
 }
 /** 상위 서버 현재 사실 resolver의 동일 transaction용 선행 대조. 이 결과만으로 WORK 허가를 만들지 않는다. */
 async requireAccepted(db:PoolClient,actor:AuthenticatedIdentity,rawScope:unknown,expectedRef:unknown){
  const scope=scopeOf(rawScope);if(!refV1(expectedRef))bad('UNDERSTANDING_LATEST_ACCEPTANCE_REQUIRED');this.#port();await projectMember(db,actor,scope.projectId,true);
  const before=await this.#current(db,actor,scope),entries=readUnderstandingHistory(await this.store.list(db,cloneV1(scope)),scope),latest=entries.at(-1);
  if(!latest||!same(latest.ref,expectedRef)||latest.snapshot.outcome!=='ACCEPTED'||!same(latest.snapshot.currentBinding,before.binding))return bad('UNDERSTANDING_LATEST_ACCEPTANCE_REQUIRED');
  const final=await this.#current(db,actor,scope);if(!same(before.binding,final.binding)||Date.parse(final.at)>=Math.min(Date.parse(before.c.expiresAt),Date.parse(final.c.expiresAt)))bad('UNDERSTANDING_CURRENT_CHANGED');
  return{transport:'SYNTHETIC_ONLY' as const,ref:cloneV1(latest.ref),scope,currentBinding:cloneV1(final.binding),checkedAt:final.at,executionAuthorized:false as const,dispatchPerformed:false as const};
 }
}
