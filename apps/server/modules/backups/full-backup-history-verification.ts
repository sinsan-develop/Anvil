import {types} from 'node:util';
import {canonicalJson,contentHash,parseJsonWithoutDuplicateKeys} from '../../../../contracts/canonical.ts';
import {hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import {readDocumentInventoryInput,type InventoryLimits} from './document-inventory-input.ts';
import {checkDocumentBodyHistoryRows,checkDocumentDraftHistoryRows,checkDocumentSystemFormHistoryRows,checkDocumentConfirmationHistoryRows,
 type DocumentBodyHistoryRows,type DocumentDraftHistoryRows,type DocumentSystemFormHistoryRows,type DocumentConfirmationHistoryRows} from './document-inventory.ts';
import {checkWorkPlanDocumentHistoryRow,checkWorkPlanRelationHistoryRows,type WorkPlanRelationHistoryRows} from './work-plan-inventory.ts';

const digest=(value:unknown)=>contentHash(canonicalJson(value));
const invalid=():never=>{throw Error('FN16_D2_DOCUMENT_HISTORY_INVALID');};

export interface DocumentBodySnapshot {
 kind:'FN16_D2_DOCUMENT_BODY_SNAPSHOT_V1';
 projectId:string;
 jobRef:RuntimeRefV1;
 documentRef:RuntimeRefV1;
 observation:{snapshot:string;startedAt:string;finishedAt:string};
 rows:DocumentBodyHistoryRows;
}
export interface DocumentDraftSnapshot extends Omit<DocumentBodySnapshot,'kind'|'rows'> {
 kind:'FN16_D2_DOCUMENT_DRAFT_SNAPSHOT_V2';
 rows:DocumentDraftHistoryRows;
}
export interface DocumentSystemFormSnapshot extends Omit<DocumentBodySnapshot,'kind'|'rows'> {
 kind:'FN16_D2_DOCUMENT_SYSTEM_FORM_SNAPSHOT_V3';
 rows:DocumentSystemFormHistoryRows;
}
export interface DocumentConfirmationSnapshot extends Omit<DocumentBodySnapshot,'kind'|'rows'> {
 kind:'FN16_D2_DOCUMENT_CONFIRMATION_SNAPSHOT_V4';
 rows:DocumentConfirmationHistoryRows;
}
export interface DocumentWorkPlanSnapshot extends Omit<DocumentBodySnapshot,'kind'|'rows'> {
 kind:'FN16_D2_DOCUMENT_WORK_PLAN_SNAPSHOT_V5';
 rows:DocumentSystemFormHistoryRows&{workPlanVersion:Record<string,unknown>};
}
export interface DocumentWorkPlanDesignSnapshot extends Omit<DocumentBodySnapshot,'kind'|'rows'> {
 kind:'FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_SNAPSHOT_V6';
 rows:DocumentWorkPlanSnapshot['rows']&{designDocument:DocumentSystemFormHistoryRows};
}

export interface DocumentWorkPlanRelationsSnapshot extends Omit<DocumentBodySnapshot,'kind'|'rows'> {
 kind:'FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_SNAPSHOT_V7';
 rows:DocumentWorkPlanDesignSnapshot['rows']&{workPlanRelations:WorkPlanRelationHistoryRows};
}

export interface DocumentBodyHistoryExpectation {
 projectId:string;
 jobRef:RuntimeRefV1;
 documentRef:RuntimeRefV1;
 snapshot:string;
 snapshotHash:string;
 confirmationId?:string;
 workPlanRef?:RuntimeRefV1;
 designDocumentRef?:RuntimeRefV1;
 planRelations?:true;
}

function historyExpectation(expected:Readonly<DocumentBodyHistoryExpectation>){
 const keys=['projectId','documentRef','jobRef','snapshot','snapshotHash'];
 if(types.isProxy(expected))return invalid();
 const hasConfirmation=recordV1(expected,[...keys,'confirmationId'])&&uuidV1(expected.confirmationId);
 const hasPlan=recordV1(expected,[...keys,'workPlanRef'])&&!types.isProxy(expected.workPlanRef)&&refV1(expected.workPlanRef);
 const hasRelations=recordV1(expected,[...keys,'workPlanRef','designDocumentRef','planRelations'])&&expected.planRelations===true;
 const hasDesign=(hasRelations||recordV1(expected,[...keys,'workPlanRef','designDocumentRef']))
  &&!types.isProxy(expected.workPlanRef)&&refV1(expected.workPlanRef)
  &&!types.isProxy(expected.designDocumentRef)&&refV1(expected.designDocumentRef);
 if((!hasConfirmation&&!hasPlan&&!hasDesign&&!recordV1(expected,keys))
  ||types.isProxy(expected.documentRef)||types.isProxy(expected.jobRef)||!refV1(expected.documentRef)||!refV1(expected.jobRef)
  ||!uuidV1(expected.projectId)||!hashV1(expected.snapshotHash)||typeof expected.snapshot!=='string'
  ||expected.snapshot.length>128*1024||!/^\d+:\d+:[\d,]*$/.test(expected.snapshot))return invalid();
 return {...expected,documentRef:Object.freeze({...expected.documentRef}),jobRef:Object.freeze({...expected.jobRef}),
  ...((hasPlan||hasDesign)&&expected.workPlanRef?{workPlanRef:Object.freeze({...expected.workPlanRef})}:{}),
  ...(hasDesign&&expected.designDocumentRef?{designDocumentRef:Object.freeze({...expected.designDocumentRef})}:{})};
}

const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')!.get!;
function boundedBytes(value:unknown,max:number){
 if(!types.isUint8Array(value))return invalid();
 const length=Number(Reflect.apply(byteLength,value,[]));
 if(length>max)return invalid();
 const bytes=Buffer.alloc(length);
 bytes.set(value);
 return bytes;
}

type HistoryBody=ReturnType<typeof checkDocumentBodyHistoryRows>;
/** 같은 산출물은 정확한 동일 선언에만 한 payload로 재사용한다. */
export function separateDesignHistoryBody(planBody:HistoryBody,designBody:HistoryBody){
 if(planBody.artifactId!==designBody.artifactId)return designBody;
 if(canonicalJson(planBody)!==canonicalJson(designBody))return invalid();
 return null;
}
function verifyBodyBytes(body:unknown,artifact:HistoryBody){
 const bytes=boundedBytes(body,artifact.bytes);
 try{
  if(bytes.length!==artifact.bytes||contentHash(bytes)!==artifact.contentHash||inspectArtifact(bytes).state!=='NO_KNOWN_MARKER')return invalid();
 }finally{bytes.fill(0);}
}
function verifyStoredHistory(wanted:Readonly<DocumentBodyHistoryExpectation>,snapshot:unknown,body:unknown,designBody:unknown,
 bodyLimit=40*1024*1024,fileLimit=2){
  const {confirmationId,workPlanRef,designDocumentRef,planRelations}=wanted;
  if(!recordV1(snapshot,['kind','projectId','jobRef','documentRef','observation','rows'])
   ||!['FN16_D2_DOCUMENT_BODY_SNAPSHOT_V1','FN16_D2_DOCUMENT_DRAFT_SNAPSHOT_V2','FN16_D2_DOCUMENT_SYSTEM_FORM_SNAPSHOT_V3',
    'FN16_D2_DOCUMENT_CONFIRMATION_SNAPSHOT_V4','FN16_D2_DOCUMENT_WORK_PLAN_SNAPSHOT_V5','FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_SNAPSHOT_V6','FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_SNAPSHOT_V7'].includes(snapshot.kind)
   ||(snapshot.kind==='FN16_D2_DOCUMENT_CONFIRMATION_SNAPSHOT_V4')!==Boolean(confirmationId)
   ||['FN16_D2_DOCUMENT_WORK_PLAN_SNAPSHOT_V5','FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_SNAPSHOT_V6','FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_SNAPSHOT_V7'].includes(snapshot.kind)!==Boolean(workPlanRef)
   ||['FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_SNAPSHOT_V6','FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_SNAPSHOT_V7'].includes(snapshot.kind)!==Boolean(designDocumentRef)
   ||(snapshot.kind==='FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_SNAPSHOT_V7')!==Boolean(planRelations)
   ||snapshot.projectId!==wanted.projectId||!refV1(snapshot.documentRef)
   ||!refV1(snapshot.jobRef)||canonicalJson(snapshot.jobRef)!==canonicalJson(wanted.jobRef)
   ||canonicalJson(snapshot.documentRef)!==canonicalJson(wanted.documentRef)
   ||!recordV1(snapshot.observation,['snapshot','startedAt','finishedAt'])||snapshot.observation.snapshot!==wanted.snapshot
   ||!isoV1(snapshot.observation.startedAt)||!isoV1(snapshot.observation.finishedAt)||snapshot.observation.finishedAt<snapshot.observation.startedAt
   ||digest(snapshot)!==wanted.snapshotHash)return invalid();
  const confirmation=confirmationId?checkDocumentConfirmationHistoryRows(wanted.projectId,wanted.documentRef,confirmationId,snapshot.rows):null;
  let workPlan:ReturnType<typeof checkWorkPlanDocumentHistoryRow>|null=null;
  let form:ReturnType<typeof checkDocumentSystemFormHistoryRows>|null=confirmation;
  let relations:ReturnType<typeof checkWorkPlanRelationHistoryRows>|null=null;
  let design:ReturnType<typeof checkDocumentSystemFormHistoryRows>|null=null;
  if(workPlanRef){
   if(!recordV1(snapshot.rows,['version','link','artifact','origin','systemForm','workPlanVersion',...(designDocumentRef?['designDocument']:[]),...(planRelations?['workPlanRelations']:[])]))return invalid();
   const {workPlanVersion,designDocument,workPlanRelations,...documentRows}=snapshot.rows;
   form=checkDocumentSystemFormHistoryRows(wanted.projectId,wanted.documentRef,documentRows);
   if(documentRows.systemForm.definition.form_code!=='AF04')return invalid();
   workPlan=checkWorkPlanDocumentHistoryRow(wanted.projectId,workPlanRef,wanted.documentRef,workPlanVersion,designDocumentRef);
   if(designDocumentRef){
    design=checkDocumentSystemFormHistoryRows(wanted.projectId,designDocumentRef,designDocument);
    if(designDocument.systemForm.definition.form_code!=='AF02')return invalid();
    if(planRelations)relations=checkWorkPlanRelationHistoryRows(wanted.projectId,workPlanRef,wanted.documentRef,designDocumentRef,workPlanVersion,workPlanRelations);
   }
  }else if(snapshot.kind==='FN16_D2_DOCUMENT_SYSTEM_FORM_SNAPSHOT_V3'){
   form=checkDocumentSystemFormHistoryRows(wanted.projectId,wanted.documentRef,snapshot.rows);
  }
  const origin=form??(snapshot.kind==='FN16_D2_DOCUMENT_DRAFT_SNAPSHOT_V2'?checkDocumentDraftHistoryRows(wanted.projectId,wanted.documentRef,snapshot.rows):null);
  const artifact=origin?.body??checkDocumentBodyHistoryRows(wanted.projectId,wanted.documentRef,snapshot.rows);
  const separate=design?separateDesignHistoryBody(artifact,design.body):null;
  if(artifact.bytes+(separate?.bytes??0)>bodyLimit||(separate?2:1)>fileLimit)return invalid();
  verifyBodyBytes(body,artifact);
  if(separate)verifyBodyBytes(designBody,separate);
  else if(design&&designBody!==null)return invalid();
  const result={projectId:wanted.projectId,
   jobRef:wanted.jobRef,documentRef:wanted.documentRef,snapshotHash:wanted.snapshotHash,artifact,
   bodyVerified:true as const,documentHistoryComplete:false as const,restorable:false as const,executionAuthorized:false as const};
  if(!origin)return {kind:'FN16_D2_DOCUMENT_BODY_VERIFICATION_V1' as const,...result};
  const draft={...result,commandProjectionRef:origin.commandProjectionRef,receiptProjectionRef:origin.receiptProjectionRef,auditProjectionRef:origin.auditProjectionRef};
  if(!form)return {kind:'FN16_D2_DOCUMENT_DRAFT_VERIFICATION_V2' as const,...draft};
  const systemForm={...draft,
   formRef:form.formRef,formProjectionHash:form.formProjectionHash,standardRef:form.standardRef,
   standardProjectionHash:form.standardProjectionHash,standardBodyVerified:false as const,formAuthorityVerified:false as const};
  if(workPlan){
   const relation={...systemForm,...workPlan,workPlanHistoryComplete:false as const,workPlanAuthorityVerified:false as const};
   if(design&&designDocumentRef){
    const designRelation={...relation,designDocumentRef,designArtifact:design.body,designBodyVerified:true as const,designDocumentHistoryComplete:false as const};
    return relations?{kind:'FN16_D2_DOCUMENT_WORK_PLAN_RELATIONS_VERIFICATION_V7' as const,...designRelation,...relations}
     :{kind:'FN16_D2_DOCUMENT_WORK_PLAN_DESIGN_VERIFICATION_V6' as const,...designRelation};
   }
   return {kind:'FN16_D2_DOCUMENT_WORK_PLAN_VERIFICATION_V5' as const,...relation};
  }
  if(!confirmation)return {kind:'FN16_D2_DOCUMENT_SYSTEM_FORM_VERIFICATION_V3' as const,...systemForm};
  return {kind:'FN16_D2_DOCUMENT_CONFIRMATION_VERIFICATION_V4' as const,...systemForm,
   confirmationId:confirmation.confirmationId,confirmationProjectionHash:confirmation.confirmationProjectionHash,
   selectedReviewProjections:confirmation.selectedReviewProjections};
}

/** 이미 판독한 내부 역사 객체의 원 관계와 BODY를 검산한다. */
export async function verifyDocumentBodyHistory(expected:Readonly<DocumentBodyHistoryExpectation>,
 read:()=>Promise<{snapshot:unknown;body:Uint8Array;designBody?:Uint8Array|null}>){
 try{
  const wanted=historyExpectation(expected);
  const {snapshot,body,designBody}=await read();
  return verifyStoredHistory(wanted,snapshot,body,designBody);
 }catch{return invalid();}
}

type DocumentHistoryReadbackScope=Omit<DocumentBodyHistoryExpectation,'snapshotHash'>;
type DocumentHistoryReadback=(scope:Readonly<DocumentHistoryReadbackScope>,limits:Readonly<InventoryLimits>,signal:AbortSignal)=>Promise<unknown>;

/** 보호 reader가 공급하는 독립 재조회 바이트만 검산한다. 저장소의 물리적 독립성은 호출자가 보장한다. */
export async function verifyDocumentBodyHistoryReadback(expected:Readonly<DocumentBodyHistoryExpectation>,
 limits:Readonly<InventoryLimits>,read:DocumentHistoryReadback){
 const started=performance.now();
 let snapshotBytes:Buffer|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const {snapshotHash,...scope}=historyExpectation(expected);
  const request=readDocumentInventoryInput({projectId:scope.projectId,limits});
  const remaining=()=>request.limits.deadlineMs-(performance.now()-started);
  if(remaining()<=0)return invalid();
  const controller=new AbortController();
  const timedOut=new Promise<never>((_,reject)=>{
   function arm(){
    const ms=remaining();
    if(ms<=0){
     reject();
     controller.abort();
     return;
    }
    // Node timer 범위를 넘는 유한 기한은 1ms로 줄어들지 않게 다시 예약한다.
    timer=setTimeout(arm,Math.min(Math.ceil(ms),2147483647));
   }
   arm();
  });
  const pending=Promise.resolve().then(()=>{
   if(remaining()<=0)return invalid();
   return read(Object.freeze(scope),request.limits,controller.signal);
  });
  // 이 경계는 바이트만 받는다. 취소를 무시한 reader의 후속 결과는 검산하지 않는다.
  const observed=await Promise.race([pending,timedOut]);
  if(remaining()<=0){controller.abort();return invalid();}
  if(types.isProxy(observed)||!recordV1(observed,['snapshotBytes','body',...(scope.designDocumentRef?['designBody']:[])]))return invalid();
  snapshotBytes=boundedBytes(observed.snapshotBytes,request.limits.metadataBytes);
  if(contentHash(snapshotBytes)!==snapshotHash)return invalid();
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(snapshotBytes);
  const snapshot=parseJsonWithoutDuplicateKeys(text);
  if(canonicalJson(snapshot)!==text)return invalid();
  const result=verifyStoredHistory({...scope,snapshotHash},snapshot,observed.body,observed.designBody,request.limits.inputBytes,request.limits.fileCount);
  if(remaining()<=0)return invalid();
  return result;
 }catch{return invalid();}
 finally{
  if(timer!==undefined)clearTimeout(timer);
  snapshotBytes?.fill(0);
 }
}
