import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {projectMember,persistProjectReceipt,reserveActivationReceiptIds,type ProjectCommand} from '../access/project-command.ts';
import type {VersionRef} from '../../../../contracts/generated-types.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isVersionRef} from '../../../../contracts/references.ts';
import {readApprovalRef} from '../approvals/approval-input.ts';
import {ProjectDocuments} from '../documents/project-documents.ts';
import {ProjectDesignChanges} from './design-changes.ts';
import {ProjectWorkPlans} from './work-plans.ts';
import {readStoredDesignActivationRelations} from './design-activation-stored-relations.ts';
import {readDesignActivationInput,assertDesignActivationTarget} from './design-activation-input.ts';
import {createBaselineActivationRecord,readBaselineActivationRecord,activationSame as same,activationUuid,activationUnavailable,type BaselineActivationRecord} from './baseline-activation-record.ts';
export type ActivationRelations=Awaited<ReturnType<typeof readStoredDesignActivationRelations>>;
async function owner(db:PoolClient,actor:AuthenticatedIdentity,pid:string){if(!activationUuid(pid))throw new AuthFailure('NOT_FOUND',404);let m;try{m=await projectMember(db,actor,pid,true);}catch(e){if(e instanceof AuthFailure)throw e;throw activationUnavailable();}if(m.participation!=='OWNER'||m.archived_at)throw new AuthFailure('NOT_FOUND',404);}
function stored(row:any):BaselineActivationRecord{return readBaselineActivationRecord({ref:{id:row.id,version:Number(row.generation),contentHash:row.content_hash},snapshot:row.snapshot_json});}
/** project 잠금은 동일 transaction의 신규 적용을 직렬화한다. 실제 OS writer 안전의 증거가 아니다. */
async function state(db:PoolClient,pid:string){
 try{
  const pointers=(await db.query(`SELECT a.id,a.generation,a.snapshot_json,CASE WHEN anvil.fn04_activation_history_valid(a.project_id,a.id) THEN a.content_hash ELSE NULL END content_hash,p.activation_ref
   FROM anvil.baseline_activation_current p LEFT JOIN anvil.baseline_activations a ON a.project_id=p.project_id AND a.id=p.activation_id WHERE p.project_id=$1`,[pid])).rows;
  const recent=(await db.query(`SELECT a.id,a.generation,a.snapshot_json,CASE WHEN anvil.fn04_activation_history_valid(a.project_id,a.id) THEN a.content_hash ELSE NULL END content_hash FROM anvil.baseline_activations a WHERE a.project_id=$1 ORDER BY a.generation DESC LIMIT 2`,[pid])).rows;
  if(!pointers.length){if(recent.length)throw Error();return null;}
  if(pointers.length!==1||!recent.length)throw Error();const current=stored(pointers[0]);if(!same(pointers[0].activation_ref,current.ref)||current.snapshot.projectId!==pid)throw Error();
  const records=recent.map(stored).sort((a,b)=>b.ref.version-a.ref.version);if(!same(records[0]?.ref,current.ref))throw Error();return current;
 }catch{throw activationUnavailable();}
}
/** 두 GET의 pointer/latest/fixed는 READ COMMITTED에서도 한 SQL statement의 동일 snapshot을 사용한다. */
async function readSnapshot(db:PoolClient,pid:string,id:string|null=null,generation:number|null=null){
 try{const rows=(await db.query(`/* fn04_activation_snapshot */ WITH pointer AS(SELECT activation_id,activation_ref FROM anvil.baseline_activation_current WHERE project_id=$1),latest AS(SELECT id,generation,content_hash FROM anvil.baseline_activations WHERE project_id=$1 ORDER BY generation DESC LIMIT 1)
 SELECT EXISTS(SELECT 1 FROM latest) history_exists,(SELECT activation_ref FROM pointer) pointer_ref,
 (SELECT jsonb_build_object('id',id,'version',generation,'contentHash',content_hash) FROM latest) latest_ref,
 (SELECT jsonb_build_object('id',a.id,'generation',a.generation,'snapshot_json',a.snapshot_json,'content_hash',CASE WHEN anvil.fn04_activation_history_valid(a.project_id,a.id) THEN a.content_hash ELSE NULL END) FROM pointer p LEFT JOIN anvil.baseline_activations a ON a.project_id=$1 AND a.id=p.activation_id) current_row,
 (SELECT jsonb_build_object('id',a.id,'generation',a.generation,'snapshot_json',a.snapshot_json,'content_hash',CASE WHEN anvil.fn04_activation_history_valid(a.project_id,a.id) THEN a.content_hash ELSE NULL END) FROM anvil.baseline_activations a WHERE a.project_id=$1 AND a.id=$2 AND a.generation=$3) fixed_row,
 transaction_timestamp() observed_at`,[pid,id,generation])).rows;
 if(rows.length!==1||typeof rows[0].history_exists!=='boolean'||!(rows[0].observed_at instanceof Date))throw Error();const row=rows[0];
 if(!row.history_exists){if(row.pointer_ref!==null||row.current_row!==null||row.latest_ref!==null||row.fixed_row!==null)throw Error();return{current:null,fixed:null,observedAt:row.observed_at.toISOString()};}
 if(!row.current_row||!row.pointer_ref||!row.latest_ref)throw Error();const current=stored(row.current_row);if(current.snapshot.projectId!==pid||!same(current.ref,row.pointer_ref)||!same(current.ref,row.latest_ref))throw Error();
 const fixed=row.fixed_row===null?null:stored(row.fixed_row);if(fixed&&(fixed.snapshot.projectId!==pid||fixed.ref.id!==id||fixed.ref.version!==generation))throw Error();return{current,fixed,observedAt:row.observed_at.toISOString()};
 }catch{throw activationUnavailable();}
}
export function assertProductionDesignActivationReady(_relations:ActivationRelations):never{
 // §6의 실제 영향 완전성/OS writer 회수 공급자는 아직 없다. 빈 gap/합성 row/무이력도 통과시킬 수 없다.
 throw new AuthFailure('DESIGN_ACTIVATION_NOT_READY',412);
}
interface ReservedIds{serverCommandId:string;consumptionId:string}
interface ReceiptPort{reserve:()=>ReservedIds;persist:(value:{record:BaselineActivationRecord;serverCommandId:string;consumptionId:string;reservation:ReservedIds})=>Promise<{result:any;id:string;consumptionId?:string}>}
/** 서버 내부 저장 단계. HTTP/DTO/생산 생성자에 port를 노출하지 않는다. 호출자의 단일 transaction 안에서만 실행한다. */
export async function applyBaselineActivationInTransaction({db,actor,command:c,policyRef,relations,receiptPort}:{db:PoolClient;actor:AuthenticatedIdentity;command:ProjectCommand;policyRef:VersionRef;relations:ActivationRelations;receiptPort:ReceiptPort}){
 await owner(db,actor,c.projectId);const input=readDesignActivationInput(c.payload);assertDesignActivationTarget(input,c.targetId,c.expectedVersion);
 if(c.operation!=='activateDesignChange'||c.clientId!==actor.clientId||!same(input,relations.input)||!isVersionRef(policyRef))throw new AuthFailure('APPROVAL_CANDIDATE_MISMATCH',409);
 const previous=await state(db,c.projectId),wanted=previous?[previous.ref]:[];
 if(!same(c.baselineRefs,wanted)||previous&&!same(previous.snapshot.approvedDesignRef,relations.change.beforeRef)||previous&&!Number.isSafeInteger(previous.ref.version+1))throw new AuthFailure('VERSION_CONFLICT',409);
 const approvalRef=readApprovalRef(c.approvalRef),reserved=receiptPort.reserve();if(!activationUuid(reserved.serverCommandId)||!activationUuid(reserved.consumptionId))throw activationUnavailable();
 const activatedAt=(await db.query('SELECT transaction_timestamp() AS at')).rows[0]?.at;if(!(activatedAt instanceof Date))throw activationUnavailable();
 const record=createBaselineActivationRecord({schemaVersion:1,purpose:'DESIGN_BASELINE_ACTIVATION',projectId:c.projectId,activationId:randomUUID(),generation:(previous?.ref.version??0)+1,previousActivationRef:previous?.ref??null,changeRef:input.changeRef,impactRef:input.impactRef,approvedDesignRef:input.approvedDesignRef,confirmedPlanRef:input.confirmedPlanRef,candidatePayloadHash:contentHash(canonicalJson(input)),approvalRef,approvalConsumptionId:reserved.consumptionId,commandId:c.commandId,policyRef,controlGeneration:c.controlGeneration,recordedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},activatedAt:activatedAt.toISOString()});
 // consume→authorize가 원pointer를 재검사하는 동안 아직 pointer를 진행시키지 않는다.
 const receipt=await receiptPort.persist({record,...reserved,reservation:reserved});if(receipt.id!==reserved.serverCommandId)throw activationUnavailable();
 await db.query(`INSERT INTO anvil.baseline_activations(project_id,id,generation,content_hash,snapshot_json,previous_activation_id,command_id,approval_consumption_id,created_by,client_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[c.projectId,record.ref.id,record.ref.version,record.ref.contentHash,JSON.stringify(record.snapshot),previous?.ref.id??null,receipt.id,reserved.consumptionId,actor.actorId,actor.clientId,record.snapshot.activatedAt]);
 for(const item of relations.impact.items as any[])if(item.state==='AFFECTED'&&item.targetRef?.kind==='PLAN_TASK'){const t=item.targetRef;await db.query(`INSERT INTO anvil.baseline_activation_rechecks(project_id,activation_id,plan_id,plan_version,plan_hash,task_code,impact_ref) VALUES($1,$2,$3,$4,$5,$6,$7)`,[c.projectId,record.ref.id,t.versionRef.id,t.versionRef.version,t.versionRef.contentHash,t.localCode,JSON.stringify(input.impactRef)]);}
 const updated=previous?await db.query(`UPDATE anvil.baseline_activation_current SET activation_id=$2,activation_ref=$3 WHERE project_id=$1 AND activation_ref=$4`,[c.projectId,record.ref.id,JSON.stringify(record.ref),JSON.stringify(previous.ref)]):await db.query(`INSERT INTO anvil.baseline_activation_current(project_id,activation_id,activation_ref) VALUES($1,$2,$3)`,[c.projectId,record.ref.id,JSON.stringify(record.ref)]);
 if(updated.rowCount!==1)throw new AuthFailure('VERSION_CONFLICT',409);return receipt.result;
}
export class ProjectBaselineActivations{
 #documents:ProjectDocuments;constructor(documents=new ProjectDocuments()){this.#documents=documents;}
 async current(db:PoolClient,actor:AuthenticatedIdentity,pid:string){await owner(db,actor,pid);const view=await readSnapshot(db,pid),value=view.current;return{projectId:pid,current:value?{state:'PRESENT' as const,activationRef:value.ref,designRef:value.snapshot.approvedDesignRef,planRef:value.snapshot.confirmedPlanRef}:{state:'NONE' as const},observedAt:view.observedAt,executionAuthorized:false as const,dispatchPerformed:false as const};}
 async read(db:PoolClient,actor:AuthenticatedIdentity,pid:string,id:string,generation:number){
  await owner(db,actor,pid);if(!activationUuid(id)||!Number.isSafeInteger(generation)||generation<1)throw new AuthFailure('NOT_FOUND',404);const view=await readSnapshot(db,pid,id,generation);if(!view.fixed)throw new AuthFailure('NOT_FOUND',404);if(!view.current)throw activationUnavailable();return{projectId:pid,...view.fixed,currentActivationRef:view.current.ref,isCurrent:same(view.current.ref,view.fixed.ref),observedAt:view.observedAt,executionAuthorized:false as const,dispatchPerformed:false as const};
 }
 async assertCandidateCurrent(db:PoolClient,actor:AuthenticatedIdentity,pid:string,scope:{targetRef:VersionRef|null;expectedVersion:number;baselineRefs:unknown[]},payload:unknown){
  await owner(db,actor,pid);const input=readDesignActivationInput(payload);if(!same(scope.targetRef,input.changeRef)||scope.expectedVersion!==input.changeRef.version)throw new AuthFailure('APPROVAL_TARGET_CHANGED',409);
  const changes=new ProjectDesignChanges(this.#documents),plans=new ProjectWorkPlans(this.#documents),relations=await readStoredDesignActivationRelations(input,{change:id=>changes.read(db,actor,pid,id),document:(id,v)=>this.#documents.version(db,actor,pid,id,v),proposal:id=>this.#documents.proposal(db,actor,pid,id),plan:(id,v)=>plans.read(db,actor,pid,id,v),decision:(id,v)=>plans.decision(db,actor,pid,id,v)});
  // 기존 관계 parser가 미확인이라고 남긴 documentHead는 실제 현재 행을 따로 잠가 검사한다.
  const head=(await db.query('SELECT head_version,confirmed_version FROM anvil.documents WHERE project_id=$1 AND id=$2 FOR SHARE',[pid,input.approvedDesignRef.id])).rows[0];if(Number(head?.head_version)!==input.approvedDesignRef.version||Number(head?.confirmed_version)!==input.approvedDesignRef.version)throw new AuthFailure('APPROVAL_TARGET_CHANGED',409);
  const current=await state(db,pid);if(!same(scope.baselineRefs,current?[current.ref]:[])||current&&!same(current.snapshot.approvedDesignRef,relations.change.beforeRef))throw new AuthFailure('VERSION_CONFLICT',409);return relations;
 }
 async activate(db:PoolClient,actor:AuthenticatedIdentity,c:ProjectCommand,policyRef:VersionRef){
  const input=readDesignActivationInput(c.payload),relations=await this.assertCandidateCurrent(db,actor,c.projectId,{targetRef:input.changeRef,expectedVersion:c.expectedVersion,baselineRefs:c.baselineRefs},input);
  assertProductionDesignActivationReady(relations);
  // 미래의 별도 실제 안전 선행이 채워져도 같은 내부 routine/한 transaction을 소비한다. 현재는 위에서 항상412다.
  return applyBaselineActivationInTransaction({db,actor,command:c,policyRef,relations,receiptPort:{reserve:()=>reserveActivationReceiptIds(this.#documents),persist:async({record,reservation})=>persistProjectReceipt(db,actor,c,record.ref,{status:'DESIGN_BASELINE_ACTIVATED',snapshot:record.snapshot,executionAuthorized:false,dispatchPerformed:false},policyRef,'DESIGN_BASELINE_ACTIVATED',reservation)}});
 }
}
