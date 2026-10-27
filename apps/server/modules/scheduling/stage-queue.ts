import {ProjectApprovals} from '../approvals/project-approvals.ts';
import {readApprovalRef,assertApprovalCandidate} from '../approvals/approval-input.ts';
import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectMember,type ProjectCommand} from '../access/project-command.ts';
import {ProjectMethodologies} from '../methodologies/project-methodologies.ts';
import {ProjectLimitPolicies} from '../executions/runtime-policy.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import type {MethodologyGraph} from '../../../../contracts/methodologies.ts';
import {validateMethodologyGraph} from '../methodologies/service.ts';
export const stageQueueOperations=['startStage','cancelQueuedRequest'] as const;
type NodeRef={applicationRef:RuntimeRefV1;nodeId:string};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
function fail(code='STAGE_QUEUE_INPUT_INVALID',status=422):never{throw new AuthFailure(code,status);}
function nodeRef(v:unknown):v is NodeRef{return recordV1(v,['applicationRef','nodeId'])&&refV1(v.applicationRef)&&typeof v.nodeId==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(v.nodeId);}
function reason(v:unknown){if(typeof v!=='string'||!v.trim()||v.length>20000||!v.isWellFormed())fail();try{assertKnowledgeTextSafe(v);}catch{fail('STAGE_QUEUE_SENSITIVE');}}
function startInput(raw:unknown){
 if(!recordV1(raw,['stageRef','methodologyApplicationRef','mode','startNodeRef','endBoundaryRef','baselineRefs','budgetRef','reason'])||!nodeRef(raw.stageRef)||!nodeRef(raw.startNodeRef)||!nodeRef(raw.endBoundaryRef)||!refV1(raw.methodologyApplicationRef)||!refV1(raw.budgetRef)||!['AUTO','CASE_BY_CASE'].includes(raw.mode)||!arrayV1(raw.baselineRefs,200)||!raw.baselineRefs.length||!raw.baselineRefs.every(refV1)||new Set(raw.baselineRefs.map(canonicalJson)).size!==raw.baselineRefs.length||Buffer.byteLength(canonicalJson(raw))>2097152)fail();
 reason(raw.reason);for(const n of [raw.stageRef,raw.startNodeRef,raw.endBoundaryRef])if(!same(n.applicationRef,raw.methodologyApplicationRef))fail('STAGE_APPLICATION_MISMATCH',409);if(!same(raw.stageRef,raw.startNodeRef))fail();return cloneV1(raw);
}
const query=`SELECT q.*,c.result_ref,c.operation,c.operation_id command_operation_id,c.state,c.command_id command_external_id,c.actor_id command_actor,c.client_id command_client,c.control_generation,c.expected_version,c.policy_ref,c.payload_ref,c.request_hash,c.approval_consumption_id,c.scope_kind command_scope_kind,c.scope_id command_scope_id,ar.subject_ref authorization_subject_ref,ar.policy_ref authorization_policy_ref,ar.approval_decision_ref authorization_approval_decision,ar.scope_digest authorization_scope_digest,a.scope_digest audit_scope_digest,a.outcome audit_outcome,a.source_kind audit_source_kind,a.actor_ref audit_actor_ref,a.client_ref audit_client_ref,a.target_ref audit_target_ref,a.policy_ref audit_policy_ref,a.approval_ref audit_approval_ref,(SELECT count(*) FROM anvil.audit_events ac WHERE ac.command_id=c.id AND ac.project_id=c.project_id) audit_count FROM anvil.queue_requests q JOIN anvil.commands c ON c.project_id=q.project_id AND c.id=q.command_id  LEFT JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id LEFT JOIN anvil.audit_events a ON a.project_id=c.project_id AND a.command_id=c.id AND a.operation_id=c.operation_id `;
/** 승인된 단계 시작 요청의 WAITING 저장만 담당한다. scheduler/슬롯·writer/Agent dispatch는 연결하지 않는다. */
export class ProjectStageQueue{
 readonly applications:Pick<ProjectMethodologies,'readApplication'>;readonly budgets:Pick<ProjectLimitPolicies,'resolveCurrent'>;
 constructor(ports:{applications?:Pick<ProjectMethodologies,'readApplication'>;budgets?:Pick<ProjectLimitPolicies,'resolveCurrent'>}={}){this.applications=ports.applications??new ProjectMethodologies();this.budgets=ports.budgets??new ProjectLimitPolicies();}
 async #clock(db:PoolClient){const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(at instanceof Date)||!Number.isFinite(at.getTime()))fail('STAGE_QUEUE_CLOCK_INVALID',503);return at.toISOString();}
 async #authorize(db:PoolClient,actor:AuthenticatedIdentity,r:ProjectCommand,expected:RuntimeRefV1){
  if(!refV1(expected)||r.baselineRefs.length)fail('STAGE_QUEUE_INPUT_INVALID');
  if(r.operation==='cancelQueuedRequest'&&r.approvalRef!==null)fail('STAGE_QUEUE_APPROVAL_NOT_CONNECTED',412);
  if(r.approvalRef!==null)readApprovalRef(r.approvalRef);
  await currentProjectController(db,actor,r);const p=await authorizeMaterial(db,actor,r),at=await this.#clock(db),s=actor.authSession;
  if(!same(p.ref,expected)||!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt)||Math.min(p.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt))<=Date.parse(at))fail('STAGE_QUEUE_CURRENT_REQUIRED',409);return at;
 }
 async #view(db:PoolClient,actor:AuthenticatedIdentity,row:any,projectId:string){
  try{const s=row.snapshot_json,ref={id:row.request_id,version:Number(row.version),contentHash:row.content_hash};
   if(!uuidV1(projectId)||row.project_id!==projectId||!refV1(ref)||!uuidV1(row.command_id)||!recordV1(s,['projectId','requestId','version','sequence','state','input','assignmentRef','readinessIssues','queuedAt','cancelledAt','cancelledBy','cancellationReason','requestedBy','previousRef','slotReserved','writerReservationPerformed','executionAuthorized','dispatchPerformed'])||s.projectId!==projectId||s.requestId!==ref.id||s.version!==ref.version||s.sequence!==Number(row.sequence)||!Number.isSafeInteger(s.sequence)||s.sequence<1||hash(s)!==ref.contentHash||!['WAITING','CANCELLED'].includes(s.state)||s.assignmentRef!==null||s.slotReserved!==false||s.writerReservationPerformed!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||!arrayV1(s.readinessIssues,20)||!s.readinessIssues.length||!s.readinessIssues.every((v:unknown)=>typeof v==='string'&&/^[A-Z_]{1,80}$/.test(v))||!isoV1(s.queuedAt)||!recordV1(s.requestedBy,['kind','userId','clientId'])||s.requestedBy.kind!=='HUMAN'||!uuidV1(s.requestedBy.userId)||!uuidV1(s.requestedBy.clientId))throw Error();
   startInput(s.input);
   if(s.state==='WAITING'&&(ref.version!==1||s.previousRef!==null||s.cancelledAt!==null||s.cancelledBy!==null||s.cancellationReason!==null)||s.state==='CANCELLED'&&(ref.version!==2||!refV1(s.previousRef)||s.previousRef.id!==ref.id||s.previousRef.version!==1||!isoV1(s.cancelledAt)||s.cancelledAt<s.queuedAt||!recordV1(s.cancelledBy,['kind','userId','clientId'])||s.cancelledBy.kind!=='HUMAN'||!uuidV1(s.cancelledBy.userId)||!uuidV1(s.cancelledBy.clientId)))throw Error();
   if(s.state==='CANCELLED')reason(s.cancellationReason);
   const r=row.result_ref;if(r?.status!=='APPLIED'||r.commandId!==row.command_external_id||!uuidV1(row.command_operation_id)||r.operationId!==row.command_operation_id||r.projectId!==projectId||r.targetId!==ref.id||r.version!==ref.version||!same(r.data?.ref,ref)||!same(r.data?.snapshot,s)||r.data?.queueState!==s.state)throw Error();
   let approvalRef=null;
   const operation=s.state==='WAITING'?'startStage':'cancelQueuedRequest',payload=operation==='startStage'?s.input:{requestRef:s.previousRef,reason:s.cancellationReason};
   const command:ProjectCommand={schemaVersion:1,projectId,commandId:row.command_external_id,clientId:row.command_client,controlGeneration:Number(row.control_generation),operation,targetId:operation==='startStage'?null:ref.id,expectedVersion:ref.version-1,baselineRefs:[],approvalRef:null,payload};
   if(row.approval_consumption_id!==null){
    if(operation!=='startStage')throw Error();
    const a=readApprovalRef(row.audit_approval_ref),v=await new ProjectApprovals().readStageStartConsumption(db,actor,projectId,a.requestId),used=v.consumption;
    if(!used||v.storedStatus!=='CONSUMED'||v.currentVersion!==3||v.decision?.decision!=='APPROVE'||v.decision.id!==a.decisionId||v.request.scopeDigest!==a.scopeDigest||used.id!==row.approval_consumption_id||used.serverCommandId!==row.command_id||used.commandId!==row.command_external_id||used.requestHash!==row.request_hash||!same(used.policyRef,row.policy_ref)||row.authorization_approval_decision!==a.decisionId||!same(row.payload_ref,{kind:'ONE_TIME_APPROVAL_SCOPE',payloadHash:hash(payload),scopeDigest:a.scopeDigest}))throw Error();
    approvalRef=a;command.approvalRef=a;assertApprovalCandidate(v.request.details,command,row.command_actor,projectId);
   }else if(row.payload_ref!==null||row.audit_approval_ref!=null||row.authorization_approval_decision!=null)throw Error();
   const scope=hash({projectId,actorId:row.command_actor,clientId:row.command_client,controlGeneration:Number(row.control_generation),requestHash:row.request_hash,policyRef:row.policy_ref,targetRef:ref});
   const human=operation==='startStage'?s.requestedBy:s.cancelledBy;
   if(!uuidV1(command.commandId)||!uuidV1(command.clientId)||!Number.isSafeInteger(command.controlGeneration)||command.controlGeneration<1||row.operation!==operation||row.state!=='APPLIED'||Number(row.expected_version)!==command.expectedVersion||row.command_scope_kind!=='PROJECT'||row.command_scope_id!==projectId||human.userId!==row.command_actor||human.clientId!==row.command_client||row.request_hash!==hash(command)||!refV1(row.policy_ref)||!same(row.authorization_subject_ref,human)||!same(row.authorization_policy_ref,row.policy_ref)||row.authorization_scope_digest!==scope||row.audit_scope_digest!==scope||Number(row.audit_count)!==1||row.audit_outcome!=='APPLIED'||row.audit_source_kind!=='HUMAN_COMMAND'||!same(row.audit_actor_ref,{kind:'HUMAN',userId:row.command_actor})||row.audit_client_ref!==row.command_client||!same(row.audit_target_ref,ref)||!same(row.audit_policy_ref,row.policy_ref))throw Error();
   return{ref,snapshot:cloneV1(s)};
  }catch{fail('STAGE_QUEUE_LEDGER_INVALID',503);}
 }
 async start(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand,policyRef:RuntimeRefV1){
  const r=cloneV1(raw),input=startInput(r.payload);if(r.operation!=='startStage'||r.targetId!==null||r.expectedVersion!==0)fail();
  await this.#authorize(db,actor,r,policyRef);
  const app=await this.applications.readApplication(db,actor,r.projectId);if(app.projectId!==r.projectId||!app.applicationRef||!app.snapshot||!same(app.applicationRef,input.methodologyApplicationRef)||hash(app.snapshot)!==app.applicationRef.contentHash)fail('STAGE_APPLICATION_NOT_CURRENT',409);
  const graph=app.snapshot.graph as MethodologyGraph;if(validateMethodologyGraph(graph,[]).issues.some(i=>i.code==='INPUT_INVALID'))fail('STAGE_GRAPH_INVALID',503);const nodes=new Map(graph.nodes.map(n=>[n.nodeId,n])),start=nodes.get(input.startNodeRef.nodeId),end=nodes.get(input.endBoundaryRef.nodeId);if(!start||!end)fail('STAGE_NODE_NOT_FOUND',409);
  if(input.mode==='AUTO'&&start.mode!=='AUTO'||input.mode==='CASE_BY_CASE'&&start.nodeId!==end.nodeId)fail('STAGE_MODE_BOUNDARY_INVALID',412);
  const visited=new Set<string>(),pending=[start.nodeId];while(pending.length){const id=pending.pop()!;if(visited.has(id))continue;visited.add(id);if(visited.size>200)fail();for(const e of graph.edges)if(e.fromNodeId===id&&!visited.has(e.toNodeId))pending.push(e.toNodeId);}if(!visited.has(end.nodeId))fail('STAGE_END_UNREACHABLE',412);
  const budget=await this.budgets.resolveCurrent(db,actor,r.projectId,input.budgetRef,{kind:'PROJECT',projectId:r.projectId});
  const at=await this.#authorize(db,actor,r,policyRef);if(!same(budget.ref,input.budgetRef)||budget.snapshot.state!=='APPLIED'||!isoV1(budget.snapshot.expiresAt)||Date.parse(budget.snapshot.expiresAt)<=Date.parse(at))fail('LIMIT_POLICY_EXPIRED',412);
  const sequence=Number((await db.query('SELECT COALESCE(MAX(sequence),0)+1 AS sequence FROM anvil.stage_runs WHERE project_id=$1',[r.projectId])).rows[0]?.sequence);if(!Number.isSafeInteger(sequence)||sequence<1)fail('STAGE_QUEUE_SEQUENCE_INVALID',503);
  const id=randomUUID(),snapshot={projectId:r.projectId,requestId:id,version:1,sequence,state:'WAITING',input,assignmentRef:null,readinessIssues:['ASSIGNMENT_BINDING_UNVERIFIED','BASELINE_STATE_UNVERIFIED','EXECUTION_STATE_UNVERIFIED','DISPATCH_NOT_CONNECTED'],queuedAt:at,cancelledAt:null,cancelledBy:null,cancellationReason:null,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},previousRef:null,slotReserved:false,writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false},ref={id,version:1,contentHash:hash(snapshot)};
  if(r.approvalRef!==null)await db.query("SELECT set_config('anvil.stage_start_payload',$1,true)",[canonicalJson(r.payload)]);
  const receipt=await persistProjectReceipt(db,actor,r,ref,{queueState:'WAITING',snapshot},policyRef,'EXPLICIT_STAGE_QUEUE_WAITING');
  await db.query('INSERT INTO anvil.stage_runs(project_id,id,sequence,input_json,created_by,client_id,command_id,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[r.projectId,id,sequence,JSON.stringify(input),actor.actorId,actor.clientId,receipt.id,at]);
  await db.query('INSERT INTO anvil.queue_requests(project_id,request_id,version,sequence,content_hash,snapshot_json,command_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[r.projectId,id,1,sequence,ref.contentHash,JSON.stringify(snapshot),receipt.id]);return receipt.result;
 }
 async cancel(db:PoolClient,actor:AuthenticatedIdentity,raw:ProjectCommand,policyRef:RuntimeRefV1){
  const r=cloneV1(raw),p=r.payload;if(r.operation!=='cancelQueuedRequest'||!recordV1(p,['requestRef','reason'])||!refV1(p.requestRef)||r.targetId!==p.requestRef.id||r.expectedVersion!==p.requestRef.version)fail();reason(p.reason);
  const at=await this.#authorize(db,actor,r,policyRef),rows=(await db.query(query+'WHERE q.project_id=$1 AND q.request_id=$2 ORDER BY q.version DESC LIMIT 1',[r.projectId,p.requestRef.id])).rows;if(!rows.length)fail('NOT_FOUND',404);const prior=await this.#view(db,actor,rows[0],r.projectId);if(!same(prior.ref,p.requestRef)||prior.snapshot.state!=='WAITING')fail('QUEUE_REQUEST_NOT_CANCELLABLE',409);
  const snapshot:Record<string,any>={...prior.snapshot,version:2,state:'CANCELLED',cancelledAt:at,cancelledBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId},cancellationReason:p.reason,previousRef:prior.ref},ref={id:prior.ref.id,version:2,contentHash:hash(snapshot)};
  const receipt=await persistProjectReceipt(db,actor,r,ref,{queueState:'CANCELLED',snapshot},policyRef,'EXPLICIT_UNSTARTED_QUEUE_CANCELLATION');
  await db.query('INSERT INTO anvil.queue_requests(project_id,request_id,version,sequence,content_hash,snapshot_json,command_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[r.projectId,ref.id,2,snapshot.sequence,ref.contentHash,JSON.stringify(snapshot),receipt.id]);return receipt.result;
 }
 async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string){
  if(!uuidV1(projectId))fail('INPUT_INVALID',400);await projectMember(db,actor,projectId,true);
  const rows=(await db.query(`SELECT head.* FROM (SELECT DISTINCT ON (q.request_id) q.*,c.result_ref,c.operation,c.operation_id command_operation_id,c.state,c.command_id command_external_id,c.actor_id command_actor,c.client_id command_client,c.control_generation,c.expected_version,c.policy_ref,c.payload_ref,c.request_hash,c.approval_consumption_id,c.scope_kind command_scope_kind,c.scope_id command_scope_id,ar.subject_ref authorization_subject_ref,ar.policy_ref authorization_policy_ref,ar.approval_decision_ref authorization_approval_decision,ar.scope_digest authorization_scope_digest,a.scope_digest audit_scope_digest,a.outcome audit_outcome,a.source_kind audit_source_kind,a.actor_ref audit_actor_ref,a.client_ref audit_client_ref,a.target_ref audit_target_ref,a.policy_ref audit_policy_ref,a.approval_ref audit_approval_ref,(SELECT count(*) FROM anvil.audit_events ac WHERE ac.command_id=c.id AND ac.project_id=c.project_id) audit_count FROM anvil.queue_requests q JOIN anvil.commands c ON c.project_id=q.project_id AND c.id=q.command_id  LEFT JOIN anvil.authorization_receipts ar ON ar.id=c.authorization_receipt_id AND ar.command_id=c.id AND ar.scope_kind='PROJECT' AND ar.scope_id=c.project_id LEFT JOIN anvil.audit_events a ON a.project_id=c.project_id AND a.command_id=c.id AND a.operation_id=c.operation_id WHERE q.project_id=$1 ORDER BY q.request_id,q.version DESC) head WHERE head.snapshot_json->>\'state\'=\'WAITING\' ORDER BY head.sequence LIMIT 201`,[projectId])).rows;
  if(rows.length>200)fail('QUEUE_VIEW_LIMIT_EXCEEDED',413);const items=[];for(const row of rows){const v=await this.#view(db,actor,row,projectId);items.push({requestRef:v.ref,state:v.snapshot.state,sequence:v.snapshot.sequence,reasonCodes:v.snapshot.readinessIssues,blockedBy:[],reservedBudgetRef:null});}if(new Set(items.map(i=>i.requestRef.id)).size!==items.length||new Set(items.map(i=>i.sequence)).size!==items.length)fail('STAGE_QUEUE_LEDGER_INVALID',503);
  await projectMember(db,actor,projectId,true);return{projectId,items,selection:'WAITING_ONLY',cancelledHistoryOmitted:true,observedAt:await this.#clock(db),writerReservationPerformed:false,executionAuthorized:false,dispatchPerformed:false};
 }
}
