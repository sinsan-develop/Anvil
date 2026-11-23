import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectReplay,type ProjectCommand} from '../access/project-command.ts';
import {readUnderstandingReviewCommand} from './execution-understanding.ts';

export interface NormalUnderstandingReviewOptions{mode:'NORMAL_PROTECTED';purpose:'FN09_NORMAL_FIRST_REVIEW'}
export function readNormalUnderstandingReviewOptions(value:NormalUnderstandingReviewOptions):Readonly<NormalUnderstandingReviewOptions>{
 const fail=():never=>{throw Error('NORMAL_UNDERSTANDING_REVIEW_CONFIGURATION_INVALID');};
 if(!value||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return fail();
 const fields=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(fields).length!==2||!fields.mode||!fields.purpose||![fields.mode,fields.purpose].every(d=>'value'in d&&d.enumerable)
  ||fields.mode.value!=='NORMAL_PROTECTED'||fields.purpose.value!=='FN09_NORMAL_FIRST_REVIEW')return fail();
 return Object.freeze({mode:'NORMAL_PROTECTED',purpose:'FN09_NORMAL_FIRST_REVIEW'});
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const failure=(code='NORMAL_UNDERSTANDING_REVIEW_UNKNOWN',status=503):never=>{throw new AuthFailure(code,status);};
const originalAuthenticated=AccessRepository.prototype.authenticated,originalAuthenticate=AccessRepository.prototype.authenticateInTransaction;
const scalarRefs=['bundleRef','preparationRef','grantRef','startCommandRef','manifestRef','roleBindingRef','agentSessionRef','roleRef','subjectBindingRef','requestRef','responseRef'];
const refArrays=['basisRefs','requiredPartRefs','receivedPartRefs','deliveryReceiptRefs','responsePartRefs'];
const basisKeys=[...scalarRefs,...refArrays,'latestInstructionRefs','status','subjectBindingState','reviewAvailable','scope','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'];
function identity(a:AuthenticatedIdentity){if(!(a.reauthUntil instanceof Date)||!Number.isFinite(a.reauthUntil.getTime()))return failure('REAUTHENTICATION_REQUIRED',412);return hash({actorId:a.actorId,clientId:a.clientId,credentialGeneration:a.credentialGeneration,serverOwner:a.serverOwner,authSession:a.authSession,reauthUntil:a.reauthUntil.toISOString()});}
function basis(raw:unknown,q:ProjectCommand,at:number){
 const v=cloneV1(raw),input=q.payload;
 if(!recordV1(v,basisKeys)||v.status!=='SOURCE_BASIS_ONLY'||v.subjectBindingState!=='VERIFIED'||v.reviewAvailable!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false
  ||!recordV1(v.scope,['projectId','executionId','executionGeneration'])||!same(v.scope,{projectId:q.projectId,executionId:q.targetId,executionGeneration:q.expectedVersion})
  ||scalarRefs.some(k=>!refV1(v[k]))||refArrays.some(k=>!arrayV1(v[k],200)||!v[k].length||v[k].some((r:unknown)=>!refV1(r))||new Set(v[k].map(canonicalJson)).size!==v[k].length)
  ||!same(v.subjectBindingRef,v.roleBindingRef)||!same(v.subjectBindingRef,input.subjectBindingRef)||!same(v.bundleRef,input.bundleRef)||!same(v.responseRef,input.responseRef)
  ||v.requestRef.version!==1||v.responseRef.version!==1||v.responsePartRefs.some((r:any)=>r.version!==1)||!same(v.requiredPartRefs,v.receivedPartRefs)||v.deliveryReceiptRefs.length!==v.requiredPartRefs.length
  ||!arrayV1(v.latestInstructionRefs,200)||v.latestInstructionRefs.some((r:unknown)=>!recordV1(r,['kind','id','contentHash'])||r.kind!=='CONVERSATION'||!refV1({id:r.id,version:1,contentHash:r.contentHash}))
  ||new Set(v.latestInstructionRefs.map(canonicalJson)).size!==v.latestInstructionRefs.length
  ||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>at||Date.parse(v.expiresAt)<=at||Date.parse(v.expiresAt)-Date.parse(v.checkedAt)>30000||at-Date.parse(v.checkedAt)>30000
  ||Buffer.byteLength(canonicalJson(v))>2097152)return failure();
 for(const item of input.items as any[]){if(!item.sourceRefs.every((r:unknown)=>v.basisRefs.some((b:unknown)=>same(r,b)))||!item.responsePartRefs.every((r:unknown)=>v.responsePartRefs.some((b:unknown)=>same(r,b))))failure('UNDERSTANDING_EVIDENCE_MISMATCH',412);}
 return v;
}
function stable(v:Record<string,any>){const {checkedAt:_,expiresAt:__,...rest}=v;return rest;}
function binding(v:Record<string,any>,q:ProjectCommand){return {transport:'NORMAL_PROTECTED',scope:v.scope,bundleRef:v.bundleRef,responseRef:v.responseRef,subjectBindingRef:v.subjectBindingRef,
 basisRefs:v.basisRefs,latestInstructionRefs:v.latestInstructionRefs,requiredPartRefs:v.requiredPartRefs,receivedPartRefs:v.receivedPartRefs,responsePartRefs:v.responsePartRefs,
 criteria:(q.payload.items as any[]).map(({judgement:_,reason:__,...item})=>item),sourceState:'AVAILABLE',responseSubject:'EXTERNAL_AGENT',sourceBasis:stable(v)};}
function record(raw:any,q:ProjectCommand,actor:AuthenticatedIdentity){
 const v=cloneV1(raw),s=v?.snapshot,r=s?.reviewer;
 if(!recordV1(v,['ref','snapshot'])||!refV1(v.ref)||v.ref.version!==1||!recordV1(s,['scope','sequence','previousRef','request','requestHash','reviewer','policyRef','currentBinding','input','outcome','recordedAt','executionAuthorized','dispatchPerformed'])
  ||!same(s.request,q)||s.requestHash!==hash(q)||!same(s.input,q.payload)||s.sequence!==1||s.previousRef!==null||!same(s.scope,{projectId:q.projectId,executionId:q.targetId,executionGeneration:q.expectedVersion})
  ||!recordV1(r,['kind','userId','clientId','humanSessionId','credentialGeneration','controlGeneration'])||r.kind!=='HUMAN'||r.userId!==actor.actorId||r.clientId!==actor.clientId||!uuidV1(r.humanSessionId)||!Number.isSafeInteger(r.credentialGeneration)||r.credentialGeneration<1||r.controlGeneration!==q.controlGeneration
  ||!refV1(s.policyRef)||!isoV1(s.recordedAt)||s.executionAuthorized!==false||s.dispatchPerformed!==false||v.ref.contentHash!==hash(s)
  ||s.outcome!==((q.payload.items as any[]).every(i=>i.judgement==='MATCH')?'ACCEPTED':'NOT_ACCEPTED')||s.currentBinding?.transport!=='NORMAL_PROTECTED')return failure();
 const ground=s.currentBinding.sourceBasis,valid=basis({...ground,checkedAt:s.recordedAt,expiresAt:new Date(Date.parse(s.recordedAt)+1).toISOString()},q,Date.parse(s.recordedAt));
 if(!same(s.currentBinding,binding(valid,q)))return failure();return v;
}

/** 기존 HUMAN transaction과 app INSERT만 소비한다. 원문/실행 권위나 합성 current 제공자를 받지 않는다. */
export class NormalUnderstandingReviews{
 readonly #access:AccessRepository;
 constructor(access:AccessRepository){this.#access=access;}
 async command(token:string,csrf:string,raw:ProjectCommand){
  const q=readUnderstandingReviewCommand(raw);let wall=Date.now(),mono=performance.now(),end=wall+30000,monoEnd=mono+30000;
  const check=()=>{const w=Date.now(),m=performance.now();if(w<wall||m<mono||w>=end||m>=monoEnd||Object.getPrototypeOf(this.#access)!==AccessRepository.prototype
   ||Object.hasOwn(this.#access,'authenticated')||Object.hasOwn(this.#access,'authenticateInTransaction')||AccessRepository.prototype.authenticated!==originalAuthenticated||AccessRepository.prototype.authenticateInTransaction!==originalAuthenticate)return failure();wall=w;mono=m;};
  try{check();const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
   const s=actor.authSession,id=identity(actor),query=db.query;let tx='',lastAt=-Infinity,clockWall=wall,clockMono=mono;
   if(!s||!uuidV1(s.id)||!(actor.reauthUntil instanceof Date)||!Number.isFinite(actor.reauthUntil.getTime()))return failure('REAUTHENTICATION_REQUIRED',412);
   const clock=async()=>{check();if(db.query!==query||identity(actor)!==id)return failure();const beforeWall=wall,beforeMono=mono;
    const rows=(await db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id')).rows;check();const row=rows.length===1?rows[0]:null;
    if(db.query!==query||identity(actor)!==id||!(row?.at instanceof Date)||!Number.isFinite(row.at.getTime())||row.at.getTime()<lastAt||typeof row.transaction_id!=='string'||!/^[1-9][0-9]*$/.test(row.transaction_id)||tx&&row.transaction_id!==tx)return failure();
    tx=row.transaction_id;lastAt=row.at.getTime();clockWall=beforeWall;clockMono=beforeMono;const remaining=Math.min(Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),actor.reauthUntil!.getTime())-lastAt;
    if(!Number.isFinite(remaining)||remaining<=0)return failure('REAUTHENTICATION_REQUIRED',412);end=Math.min(end,beforeWall+remaining);monoEnd=Math.min(monoEnd,beforeMono+remaining);check();return lastAt;};
   await clock();await currentProjectController(db,actor,q);await clock();let policy=await authorizeMaterial(db,actor,q);const policyAt=await clock(),policyRemaining=policy.validUntil-policyAt;
   if(policyRemaining<=0)return failure('PROJECT_OPERATION_DENIED',403);end=Math.min(end,clockWall+policyRemaining);monoEnd=Math.min(monoEnd,clockMono+policyRemaining);check();const policyRef=cloneV1(policy.ref);
   const inspect=async()=>{check();const selection={purpose:'NORMAL_REVIEW_BASIS',projectId:q.projectId,executionId:q.targetId,executionGeneration:q.expectedVersion,responseRef:q.payload.responseRef,controlGeneration:q.controlGeneration};
    const startWall=wall,startMono=mono,rows=(await db.query('SELECT anvil.fn09_normal_understanding_metadata_current($1,$2,$3,$4,$5,$6) AS projection',[s.id,actor.actorId,actor.clientId,JSON.stringify(selection),JSON.stringify(policyRef),tx])).rows;
    const at=await clock(),v=basis(rows.length===1?rows[0]?.projection:null,q,at),remain=Math.min(Date.parse(v.expiresAt),policy.validUntil)-at;
    if(remain<=0)return failure('UNDERSTANDING_CURRENT_CHANGED',412);end=Math.min(end,startWall+remain);monoEnd=Math.min(monoEnd,startMono+remain);check();return v;};
   const replay:any=await projectReplay(db,actor,q);await clock();
   if(replay!==undefined){
    if(!recordV1(replay,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])||!uuidV1(replay.operationId)||!isoV1(replay.serverReceivedAt)||!arrayV1(replay.evidenceRefs,0)||!arrayV1(replay.warnings,0))return failure();
    const v=record({ref:replay.data?.ref,snapshot:replay.data?.snapshot},q,actor);
    if(replay.status!=='APPLIED'||replay.projectId!==q.projectId||replay.commandId!==q.commandId||replay.targetId!==v.ref.id||replay.version!==1||!same(replay.data,{ref:v.ref,status:'NORMAL_UNDERSTANDING_REVIEWED',snapshot:v.snapshot}))return failure();
    const selection={purpose:'NORMAL_REVIEW_REPLAY',projectId:q.projectId,executionId:q.targetId,executionGeneration:q.expectedVersion,commandId:q.commandId,requestHash:hash(q),controlGeneration:q.controlGeneration};
    const rows=(await db.query('SELECT anvil.fn09_normal_understanding_metadata_current($1,$2,$3,$4,$5,$6) AS projection',[s.id,actor.actorId,actor.clientId,JSON.stringify(selection),JSON.stringify(policyRef),tx])).rows;
    if(rows.length!==1||!same(rows[0]?.projection,replay))return failure();
    if(identity(await this.#access.authenticateInTransaction(db,token,csrf))!==id)return failure();await currentProjectController(db,actor,q);const currentPolicy=await authorizeMaterial(db,actor,q,true);
    if(!same(currentPolicy.ref,policyRef)||currentPolicy.approvalRequired!==policy.approvalRequired)return failure('PROJECT_OPERATION_DENIED',403);await clock();check();return replay;
   }
   const first=await inspect();
   const prior=(await db.query('SELECT id FROM anvil.understanding_reviews WHERE project_id=$1 AND execution_id=$2 AND generation=$3 LIMIT 2',[q.projectId,q.targetId,q.expectedVersion])).rows;
   if(prior.length)return failure('UNDERSTANDING_NORMAL_FIRST_REQUIRED',412);
   if(identity(await this.#access.authenticateInTransaction(db,token,csrf))!==id)return failure();await clock();await currentProjectController(db,actor,q);policy=await authorizeMaterial(db,actor,q);if(!same(policy.ref,policyRef))return failure('UNDERSTANDING_CURRENT_CHANGED',412);
   const final=await inspect();if(!same(stable(first),stable(final)))return failure('UNDERSTANDING_CURRENT_CHANGED',412);
   const at=await clock(),snapshot={scope:final.scope,sequence:1,previousRef:null,request:q,requestHash:hash(q),reviewer:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId,humanSessionId:s.id,credentialGeneration:actor.credentialGeneration,controlGeneration:q.controlGeneration},policyRef,currentBinding:binding(final,q),input:q.payload,
    outcome:(q.payload.items as any[]).every(i=>i.judgement==='MATCH')?'ACCEPTED':'NOT_ACCEPTED',recordedAt:new Date(at).toISOString(),executionAuthorized:false,dispatchPerformed:false};
   const v=record({ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot},q,actor);
   if(Buffer.byteLength(canonicalJson([v]))>2097152)return failure('UNDERSTANDING_HISTORY_QUOTA_REQUIRED',422);
   check();const receipt=await persistProjectReceipt(db,actor,q,v.ref,{status:'NORMAL_UNDERSTANDING_REVIEWED',snapshot},policyRef,'EXPLICIT_HUMAN_UNDERSTANDING_REVIEW');check();
   const written=await db.query('INSERT INTO anvil.understanding_reviews(project_id,execution_id,generation,id,version,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[q.projectId,q.targetId,q.expectedVersion,v.ref.id,1,v.ref.contentHash,JSON.stringify(snapshot),actor.actorId,actor.clientId,receipt.id]);check();if(written.rowCount!==1)return failure();
   if(identity(await this.#access.authenticateInTransaction(db,token,csrf))!==id)return failure();await currentProjectController(db,actor,q);const afterPolicy=await authorizeMaterial(db,actor,q,true);if(!same(afterPolicy.ref,policyRef)||afterPolicy.approvalRequired!==policy.approvalRequired)return failure('UNDERSTANDING_CURRENT_CHANGED',412);
   const after=await inspect();if(!same(stable(final),stable(after)))return failure('UNDERSTANDING_CURRENT_CHANGED',412);await clock();check();return receipt.result;
  });check();return result;
  }catch(error){if(error instanceof AuthFailure&&error.statusCode<500)throw error;
   if(error instanceof Error&&'code'in error&&error.code==='P0001'){
    if(['PROJECT_OPERATION_DENIED','PROJECT_CONTROL_REQUIRED'].includes(error.message))return failure(error.message,403);
    if(['UNDERSTANDING_NORMAL_CURRENT_REQUIRED','NORMAL_UNDERSTANDING_REQUEST_CURRENT_REQUIRED','NORMAL_UNDERSTANDING_REQUEST_EXPIRED','REAUTHENTICATION_REQUIRED'].includes(error.message))return failure(error.message,412);
   }
   return failure();}
 }
}
