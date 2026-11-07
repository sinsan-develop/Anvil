import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,hashV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {readSyntheticResultExecutionReference} from './result-execution-reference.ts';
import type {ResultEvidenceScope} from './result-evidence.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const invalid=():never=>{throw new AuthFailure('RESULT_EXECUTION_SOURCE_INVALID',503);};
/** 호출자가 인증/프로젝트 조회권한·필요 잠금을 확보한 동일 tx에서만 사용한다.
 * 원 START 명령/receipt/audit를 읽으며 현재 실행 허가나 외부 Agent 관측을 발행하지 않는다. */
export async function readPgResultExecution(db:PoolClient,rawScope:ResultEvidenceScope){
 try{
  if(!recordV1(rawScope,['projectId','assignmentRef','executionRef'])||!uuidV1(rawScope.projectId)||!refV1(rawScope.assignmentRef)||!refV1(rawScope.executionRef))return invalid();
  const scope=cloneV1(rawScope),rows=(await db.query(`SELECT to_jsonb(e) AS execution,to_jsonb(q) AS queued,to_jsonb(g) AS grant,to_jsonb(c) AS command,to_jsonb(ar) AS receipt,
   (SELECT count(*)::int FROM anvil.audit_events a WHERE a.project_id=c.project_id AND a.command_id=c.id AND a.operation_id=c.operation_id AND a.outcome='APPLIED' AND a.source_kind='HUMAN_COMMAND' AND a.scope_digest=ar.scope_digest) AS audit_count
   FROM anvil.executions e JOIN anvil.execution_commands q ON q.project_id=e.project_id AND q.execution_id=e.id AND q.generation=e.generation
   JOIN anvil.execution_grants g ON g.project_id=q.project_id AND g.id=q.grant_id AND g.version=q.grant_version AND g.execution_id=e.id AND g.generation=e.generation
   JOIN anvil.commands c ON c.project_id=q.project_id AND c.id=q.created_command_id
   JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id
   WHERE e.project_id=$1 AND e.id=$2 AND e.generation=$3 AND q.snapshot_json->>'operation'='START_SESSION' LIMIT 2`,[scope.projectId,scope.executionRef.id,scope.executionRef.version])).rows;
  if(rows.length!==1)return invalid();const{execution:e,queued:q,grant:g,command:c,receipt:ar,audit_count}=rows[0];
  if(!e||!q||!g||!c||!ar||audit_count!==1||e.project_id!==scope.projectId||e.id!==scope.executionRef.id||Number(e.generation)!==scope.executionRef.version||e.transport!=='SYNTHETIC_ONLY'||e.state!=='SYNTHETIC_QUEUED'
   ||q.project_id!==scope.projectId||g.project_id!==scope.projectId||q.execution_id!==e.id||g.execution_id!==e.id||Number(q.generation)!==Number(e.generation)||Number(g.generation)!==Number(e.generation)||q.grant_id!==g.id||Number(q.grant_version)!==Number(g.version)||q.envelope_hash!==q.snapshot_json?.envelope?.envelopeHash
   ||c.project_id!==scope.projectId||c.scope_kind!=='PROJECT'||c.scope_id!==scope.projectId||c.operation!=='queueExecutionCommand'||c.state!=='APPLIED'||c.expected_version!==0||!uuidV1(c.id)||!uuidV1(c.actor_id)||!uuidV1(c.client_id)||!hashV1(c.request_hash)||!refV1(c.policy_ref)||!Number.isSafeInteger(Number(c.control_generation))||Number(c.control_generation)<1
   ||[e.command_id,g.command_id,q.created_command_id].some(id=>id!==c.id)||[e.created_by,g.created_by].some(id=>id!==c.actor_id)||[e.client_id,g.client_id].some(id=>id!==c.client_id)||c.approval_consumption_id!==null||c.payload_ref!==null
   ||ar.id!==c.authorization_receipt_id||ar.command_id!==c.id||ar.scope_kind!=='PROJECT'||ar.scope_id!==scope.projectId||ar.approval_decision_ref!==null||!same(ar.policy_ref,c.policy_ref)||!same(ar.subject_ref,{kind:'HUMAN',userId:c.actor_id,clientId:c.client_id}))return invalid();
  const command={ref:{id:q.id,version:Number(q.version),contentHash:q.content_hash},snapshot:q.snapshot_json},grant={ref:{id:g.id,version:Number(g.version),contentHash:g.content_hash},snapshot:g.snapshot_json};
  const historical=readSyntheticResultExecutionReference({projectId:scope.projectId,assignmentRef:scope.assignmentRef,executionId:scope.executionRef.id,executionGeneration:scope.executionRef.version},{command,grant});
  const f=grant.snapshot.binding,s=command.snapshot,{envelope:_,...intent}=s,result=c.result_ref,receiptRef={id:ar.id,version:1,contentHash:ar.scope_digest};
  if(!same(historical.scope,scope)||!same(q.authorization_ref,receiptRef)||!same(s.envelope.context.authorizationReceiptRef,receiptRef)||s.envelope.commandId!==c.command_id
   ||f.subject.userId!==c.actor_id||f.subject.clientId!==c.client_id||f.subject.controlGeneration!==Number(c.control_generation)||!same(f.permissionPolicyRef,c.policy_ref)
   ||ar.scope_digest!==hash({projectId:scope.projectId,actorId:c.actor_id,clientId:c.client_id,controlGeneration:Number(c.control_generation),requestHash:c.request_hash,policyRef:c.policy_ref,targetRef:command.ref})
   ||result?.status!=='APPLIED'||result.projectId!==scope.projectId||result.targetId!==command.ref.id||result.version!==1||!same(result.data?.ref,command.ref)||result.data?.status!=='SYNTHETIC_QUEUE_STORED'||!same(result.data?.snapshot,intent)||result.data?.executionAuthorized!==false||result.data?.dispatchPerformed!==false)return invalid();
  return historical;
 }catch{return invalid();}
}
