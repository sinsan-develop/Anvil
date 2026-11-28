import type {PoolClient} from 'pg';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember} from '../access/project-command.ts';
import {notificationSessionDeadline} from '../notifications/notification-input.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {verifyArtifactBytes,type ArtifactByteReader} from './artifact-byte-verification.ts';
import {readDocumentInventoryInput} from './document-inventory-input.ts';
import {checkDocumentSystemFormHistoryRows,readDocumentSystemFormHistoryRows} from './document-inventory.ts';
import {readWorkPlanDocumentHistoryRow} from './work-plan-inventory.ts';
import type {DocumentConfirmationSnapshot,DocumentSystemFormSnapshot,DocumentWorkPlanSnapshot} from './full-backup-history-verification.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code='FN16_D2_SNAPSHOT_INVALID',status=503):never=>{throw new AuthFailure(code,status);};

/** 내부 승인 백업 job의 실제 보호 입력 공급자 자리다. 등록된 기본 공급자는 아직 없다. */
export interface FullBackupDocumentAdmission {
 readCurrent(db:Pick<PoolClient,'query'>,actor:AuthenticatedIdentity,scope:Readonly<{projectId:string;documentRef:RuntimeRefV1;confirmationId?:string;workPlanRef?:RuntimeRefV1}>):Promise<unknown>;
}

/** 보호 입장 범위에서 문서 BODY와 원 관계를 수집한다. 현재 권한을 발급하지 않는다. */
export async function collectDocumentBodySnapshot(
 access:Pick<AccessRepository,'authenticated'|'pool'>,token:string,csrf:string,
 raw:unknown,admission:FullBackupDocumentAdmission|null,artifactReader:ArtifactByteReader,signal:AbortSignal){
 const inputKeys=['projectId','limits','documentRef'];
 if(!recordV1(raw,inputKeys)&&!recordV1(raw,[...inputKeys,'confirmationId'])&&!recordV1(raw,[...inputKeys,'workPlanRef']))return fail('INPUT_INVALID',400);
 const confirmationId=Object.hasOwn(raw,'confirmationId')&&uuidV1(raw.confirmationId)?raw.confirmationId:undefined;
 const workPlanRef=Object.hasOwn(raw,'workPlanRef')&&refV1(raw.workPlanRef)?cloneV1(raw.workPlanRef):undefined;
 if((Object.hasOwn(raw,'confirmationId')&&!confirmationId)||(Object.hasOwn(raw,'workPlanRef')&&!workPlanRef)
  ||!refV1(raw.documentRef)||typeof csrf!=='string')return fail('INPUT_INVALID',400);
 const {projectId,limits}=readDocumentInventoryInput({projectId:raw.projectId,limits:raw.limits});
 const documentRef=cloneV1(raw.documentRef);
 if(!admission||typeof admission.readCurrent!=='function')return fail('FN16_D2_SNAPSHOT_ADMISSION_UNAVAILABLE',412);
 const readAdmission=admission.readCurrent;
 let deadline=performance.now()+limits.deadlineMs;
 function remaining(){
  if(signal.aborted)return fail('FN16_D2_SNAPSHOT_CANCELLED',409);
  const ms=Math.floor(deadline-performance.now());
  if(ms<1)return fail('FN16_D2_SNAPSHOT_DEADLINE',413);
  return ms;
 }
 async function query(db:Pick<PoolClient,'query'>,sql:string,args:unknown[]=[]){
  const ms=Math.min(remaining(),2147483647);
  const timeout=(await db.query("SELECT set_config('statement_timeout',$1,true) AS ms",[String(ms)])).rows;
  if(timeout.length!==1||timeout[0]?.ms!==String(ms))return fail();
  remaining();
  const result=await db.query(sql,args);
  remaining();
  return result;
 }
 function port(db:PoolClient):Pick<PoolClient,'query'>{
  return {query:((sql:string,args?:unknown[])=>query(db,sql,args)) as PoolClient['query']};
 }
 async function owner(db:Pick<PoolClient,'query'>,actor:AuthenticatedIdentity){
  const membership=await projectMember(db as PoolClient,actor,projectId);
  if(membership.id!==projectId||membership.archived_at!==null||membership.participation!=='OWNER')return fail('NOT_FOUND',404);
 }
 async function readCapturedRows(db:Pick<PoolClient,'query'>,formRef:RuntimeRefV1){
  if(confirmationId)return {kind:'FN16_D2_DOCUMENT_CONFIRMATION_SNAPSHOT_V4' as const,
   rows:await readDocumentSystemFormHistoryRows(db,projectId,documentRef,formRef,limits.metadataBytes,confirmationId)};
  if(!workPlanRef)return {kind:'FN16_D2_DOCUMENT_SYSTEM_FORM_SNAPSHOT_V3' as const,
   rows:await readDocumentSystemFormHistoryRows(db,projectId,documentRef,formRef,limits.metadataBytes)};
  let budget=limits.metadataBytes;
  // 각 원행 query의 PG 투영 바이트를 같은 예산에서 차감한다.
  const metered={query:(async(sql:string,args?:unknown[])=>{
   const result=await db.query(sql,args);
   for(const row of result.rows){
    const size=Number(row.row_bytes);
    if(!Number.isSafeInteger(size)||size<1||size>budget)return fail('FN16_D2_SNAPSHOT_LIMIT',413);
    budget-=size;
   }
   return result;
  }) as PoolClient['query']};
  const rows=await readDocumentSystemFormHistoryRows(metered,projectId,documentRef,formRef,limits.metadataBytes);
  if(rows.systemForm.definition.form_code!=='AF04')return fail();
  const workPlanVersion=await readWorkPlanDocumentHistoryRow(db,projectId,workPlanRef,documentRef,budget);
  return {kind:'FN16_D2_DOCUMENT_WORK_PLAN_SNAPSHOT_V5' as const,rows:{...rows,workPlanVersion}};
 }
 type Snapshot=DocumentSystemFormSnapshot|DocumentConfirmationSnapshot|DocumentWorkPlanSnapshot;
 async function rc(previous?:{snapshot:Snapshot;binding:unknown}){
  remaining();
  return access.authenticated(token,csrf,async(db,a)=>{
   const scoped=port(db),session=a.authSession;
   if(!session||!uuidV1(session.id)||!uuidV1(a.actorId)||!uuidV1(a.clientId)
    ||!Number.isSafeInteger(a.credentialGeneration)||a.credentialGeneration<1)return fail('AUTH_REQUIRED',401);
   const before=performance.now();
   const settings=(await scoped.query("SELECT current_setting('transaction_isolation') AS isolation,clock_timestamp() AS at")).rows;
   if(settings.length!==1||settings[0]?.isolation!=='read committed'||!(settings[0].at instanceof Date))return fail();
   deadline=Math.min(deadline,notificationSessionDeadline(a,settings[0].at,before));
   await owner(scoped,a);
   const controls=(await scoped.query('SELECT actor_id,client_id,generation,version,revoked_at FROM anvil.project_control WHERE project_id=$1',[projectId])).rows;
   const control=controls[0];
   if(controls.length!==1||control?.actor_id!==a.actorId||control.client_id!==a.clientId||control.revoked_at!==null
    ||![control.generation,control.version].every(v=>/^[1-9][0-9]*$/.test(String(v))&&Number.isSafeInteger(Number(v))))
    return fail('PROJECT_CONTROL_REQUIRED',403);
   if(admission!.readCurrent!==readAdmission)return fail('FN16_D2_SNAPSHOT_ADMISSION_UNAVAILABLE',412);
   const anchor=performance.now();
   const at=(await scoped.query('SELECT clock_timestamp() AS at')).rows;
   if(at.length!==1||!(at[0]?.at instanceof Date)||!Number.isFinite(at[0].at.getTime()))return fail();
   const scope={projectId,documentRef:cloneV1(documentRef),...(confirmationId?{confirmationId}:{}),...(workPlanRef?{workPlanRef:cloneV1(workPlanRef)}:{})};
   const evidence=await Reflect.apply(readAdmission,admission,[scoped,a,scope]);
   const refs=['jobRef','reservationRef','policyRef','targetProtectedRef','retentionPolicyRef','encryptionKeyRef','verificationPolicyRef','formRef'];
   const purpose=workPlanRef?'FN16_D2_DOCUMENT_WORK_PLAN_ADMISSION_V5':
    confirmationId?'FN16_D2_DOCUMENT_CONFIRMATION_ADMISSION_V4':'FN16_D2_DOCUMENT_SYSTEM_FORM_ADMISSION_V3';
   if(!recordV1(evidence,['purpose','projectId','documentRef','actorId','clientId','sessionId','credentialGeneration','controlGeneration','expiresAt',
    ...refs,...(confirmationId?['confirmationId']:[]),...(workPlanRef?['workPlanRef']:[])])
    ||evidence.purpose!==purpose||evidence.projectId!==projectId||!same(evidence.documentRef,documentRef)
    ||(confirmationId&&evidence.confirmationId!==confirmationId)
    ||(workPlanRef&&(!refV1(evidence.workPlanRef)||!same(evidence.workPlanRef,workPlanRef)))
    ||evidence.actorId!==a.actorId||evidence.clientId!==a.clientId||evidence.sessionId!==session.id
    ||evidence.credentialGeneration!==a.credentialGeneration||evidence.controlGeneration!==Number(control.generation)
    ||!refs.every(k=>refV1(evidence[k]))||!isoV1(evidence.expiresAt)||admission!.readCurrent!==readAdmission)
    return fail('FN16_D2_SNAPSHOT_ADMISSION_DENIED',403);
   deadline=Math.min(deadline,anchor+Date.parse(evidence.expiresAt)-at[0].at.getTime());
   remaining();
   const binding=[a.actorId,a.clientId,session.id,a.credentialGeneration,Number(control.generation),Number(control.version),cloneV1(evidence)];
   const formRef=cloneV1(evidence.formRef as RuntimeRefV1);
   if(previous&&!same(previous.binding,binding))return fail('FN16_D2_SNAPSHOT_AUTH_CHANGED',403);
   if(previous){
    const current=await readCapturedRows(scoped,formRef);
    if(current.kind!==previous.snapshot.kind||!same(current.rows,previous.snapshot.rows))return fail();
   }
   remaining();
   return {actor:a,binding,formRef,jobRef:cloneV1(evidence.jobRef as RuntimeRefV1)};
  });
 }
 async function snapshotObservation(db:Pick<PoolClient,'query'>){
  const rows=(await db.query("SELECT current_setting('transaction_isolation') AS isolation,current_setting('transaction_read_only') AS read_only,pg_current_snapshot()::text AS snapshot,clock_timestamp() AS at")).rows;
  const observation=rows[0];
  if(rows.length!==1||observation?.isolation!=='repeatable read'||observation.read_only!=='on'
   ||typeof observation.snapshot!=='string'||observation.snapshot.length>128*1024||!/^\d+:\d+:[\d,]*$/.test(observation.snapshot)
   ||!(observation.at instanceof Date)||!Number.isFinite(observation.at.getTime()))return fail();
  return {snapshot:observation.snapshot,at:observation.at.toISOString()};
 }
 async function collect(actor:AuthenticatedIdentity,jobRef:RuntimeRefV1,formRef:RuntimeRefV1):Promise<Snapshot>{
  const db=await access.pool.connect();
  let begin=false,rollback=false,releaseError:Error|undefined;
  try{
   remaining();
   begin=true;
   if((await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')).command!=='BEGIN')return fail();
   const scoped=port(db),start=await snapshotObservation(scoped);
   const rls=(await scoped.query("SELECT set_config('anvil.actor_id',$1,true) AS actor_id,set_config('anvil.client_id',$2,true) AS client_id",[actor.actorId,actor.clientId])).rows;
   if(rls.length!==1||rls[0]?.actor_id!==actor.actorId||rls[0]?.client_id!==actor.clientId)return fail();
   await owner(scoped,actor);
   const captured=await readCapturedRows(scoped,formRef);
   const end=await snapshotObservation(scoped);
   if(end.snapshot!==start.snapshot||end.at<start.at)return fail();
   rollback=true;
   if((await db.query('ROLLBACK')).command!=='ROLLBACK')return fail('FN16_D2_SNAPSHOT_CLEANUP_UNKNOWN');
   remaining();
   return {...captured,projectId,jobRef,documentRef,observation:{snapshot:start.snapshot,startedAt:start.at,finishedAt:end.at}};
  }catch(error){
   if(begin&&!rollback){
    try{if((await db.query('ROLLBACK')).command!=='ROLLBACK')throw Error();}
    catch{releaseError=new Error('FN16_D2_SNAPSHOT_CLEANUP_UNKNOWN');return fail(releaseError.message);}
   }else if(rollback&&error instanceof AuthFailure&&error.message==='FN16_D2_SNAPSHOT_CLEANUP_UNKNOWN')releaseError=error;
   else if(rollback&&!(error instanceof AuthFailure)){releaseError=new Error('FN16_D2_SNAPSHOT_CLEANUP_UNKNOWN');return fail(releaseError.message);}
   throw error;
  }finally{db.release(releaseError);}
 }
 let body:Buffer|undefined,snapshotBytes:Buffer|undefined;
 try{
  const start=await rc(),snapshot=await collect(start.actor,start.jobRef,start.formRef);
  const snapshotText=canonicalJson(snapshot);
  if(Buffer.byteLength(snapshotText)>limits.metadataBytes)return fail('FN16_D2_SNAPSHOT_LIMIT',413);
  snapshotBytes=Buffer.from(snapshotText,'utf8');
  const {version,link,artifact:bodyRow,origin,systemForm}=snapshot.rows;
  const {body:artifact}=checkDocumentSystemFormHistoryRows(projectId,documentRef,{version,link,artifact:bodyRow,origin,systemForm});
  if(artifact.bytes>limits.inputBytes)return fail('FN16_D2_SNAPSHOT_LIMIT',413);
  const bytes=Buffer.alloc(artifact.bytes);
  body=bytes;
  let offset=0;
  // 기존 정확 길이·EOF·digest·marker·close 검산을 재사용하며, 동일 read의 소유 복사본만 보유한다.
  await verifyArtifactBytes({projectId,artifactId:artifact.artifactId,bytes:artifact.bytes,contentHash:artifact.contentHash,
   maxBytes:limits.inputBytes,deadlineMs:remaining()},{
   async open(ref,s){
    remaining();
    const handle=await artifactReader.open(ref,s);
    return {
     async read(max,signal){
      remaining();
      const chunk=await handle.read(max,signal);
      if(chunk instanceof Uint8Array&&chunk.byteLength<=max&&offset+chunk.byteLength<=bytes.length){
       bytes.set(chunk,offset);
       offset+=chunk.byteLength;
       return bytes.subarray(offset-chunk.byteLength,offset);
      }
      return chunk;
     },
     close:()=>handle.close()
    };
   }
  },signal);
  remaining();
  if(offset!==bytes.length||contentHash(bytes)!==artifact.contentHash)return fail();
  await rc({snapshot,binding:start.binding});
  remaining();
  const snapshotHash=contentHash(snapshotBytes);
  remaining();
  const coverage=snapshot.kind==='FN16_D2_DOCUMENT_WORK_PLAN_SNAPSHOT_V5'?'DOCUMENT_BODY_DRAFT_ORIGIN_SYSTEM_FORM_AND_WORK_PLAN_LINK' as const:
   snapshot.kind==='FN16_D2_DOCUMENT_CONFIRMATION_SNAPSHOT_V4'
   ?'DOCUMENT_BODY_DRAFT_ORIGIN_SYSTEM_FORM_AND_CONFIRMATION' as const:'DOCUMENT_BODY_DRAFT_ORIGIN_AND_SYSTEM_FORM' as const;
  return {snapshot,snapshotBytes,body:bytes,snapshotHash,coverage,restorable:false as const,executionAuthorized:false as const};
 }catch(error){
  body?.fill(0);
  snapshotBytes?.fill(0);
  if(error instanceof AuthFailure&&/^(FN16_D2_|ARTIFACT_BYTES_|DOCUMENT_INVENTORY_|WORK_PLAN_INVENTORY_|NOT_FOUND$|AUTH_REQUIRED$|CSRF_INVALID$|PROJECT_CONTROL_REQUIRED$)/.test(error.message))
   throw new AuthFailure(error.message,error.statusCode);
  return fail();
 }
}
