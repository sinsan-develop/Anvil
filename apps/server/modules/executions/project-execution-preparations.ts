import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { arrayV1, hashV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { readSourceScopesV1, type SourceScopeV1 } from '../../../../contracts/runtime/source-scope-v1.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import type { ProjectAssignmentConfirmations } from '../assignments/project-assignment-confirmations.ts';
import type { ProjectAssignmentDrafts } from '../assignments/project-assignment-drafts.ts';
import type { ResponsibleSessions } from '../assignments/responsible-sessions.ts';
import type { ProjectContexts } from '../context/project-contexts.ts';
import type { ProjectConnectionCandidates } from '../connections/project-candidates.ts';
import { readExecutionPreparationInput } from './preparation-input.ts';

const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const select='SELECT p.*,c.result_ref,c.operation,c.state,c.actor_id command_actor,c.client_id command_client FROM anvil.execution_preparations p JOIN anvil.commands c ON c.project_id=p.project_id AND c.id=p.command_id ';
const unresolved=['RESPONSIBLE_SESSION_RESERVED','CONNECTION_CANDIDATE_ONLY','ENVIRONMENT_CANDIDATE_ONLY','CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED','SOURCE_AUTHORIZATION_UNVERIFIED','HOST_OS_FENCE_UNVERIFIED'] as const;
const conditionCodes=[...unresolved,'REQUIRED_CONTEXT_MISSING','CURRENT_CONTEXT_CHANGED','UNDERSTANDING_NOT_REVIEWED'] as const;
const instructionRef=(value:unknown)=>recordV1(value,['kind','id','contentHash'])&&value.kind==='CONVERSATION'&&uuidV1(value.id)&&hashV1(value.contentHash);
function withinScope(requested:SourceScopeV1[],allowed:SourceScopeV1[]) {
  return requested.every(scope=>allowed.some(base=>same(scope.sourceRootRef,base.sourceRootRef)&&same(scope.mappingRef,base.mappingRef)
    &&same(scope.observationRef,base.observationRef)&&same(scope.baselineRef,base.baselineRef)
    &&scope.targets.every(target=>base.targets.some(item=>item.relativePath===target.relativePath&&item.kind===target.kind&&item.recursive===false&&item.access===target.access))));
}

/** 준비 저장은 실제 능력/예산/OS 허가가 아니다. 미연결 판정을 새 실행 허가로 승격하지 않는다. */
export class ProjectExecutionPreparations {
  readonly assignments:Pick<ProjectAssignmentConfirmations,'read'>;
  readonly drafts:Pick<ProjectAssignmentDrafts,'current'>;
  readonly sessions:Pick<ResponsibleSessions,'readBinding'>;
  readonly contexts:Pick<ProjectContexts,'read'>;
  readonly candidates:Pick<ProjectConnectionCandidates,'read'>;
  constructor(assignments:Pick<ProjectAssignmentConfirmations,'read'>,drafts:Pick<ProjectAssignmentDrafts,'current'>,
    sessions:Pick<ResponsibleSessions,'readBinding'>,contexts:Pick<ProjectContexts,'read'>,candidates:Pick<ProjectConnectionCandidates,'read'>) {
    this.assignments=assignments;this.drafts=drafts;this.sessions=sessions;this.contexts=contexts;this.candidates=candidates;
  }
  async save(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,policyRef:VersionRef) {
    if(request.operation!=='prepareExecution'||request.targetId!==null||request.expectedVersion!==0)throw new AuthFailure('VERSION_CONFLICT',409);
    if(request.baselineRefs.length)throw new AuthFailure('EXECUTION_PREPARATION_APPROVAL_NOT_CONNECTED',412);
    const input=readExecutionPreparationInput(request.payload);
    if(input.projectId!==request.projectId)throw new AuthFailure('EXECUTION_PROJECT_MISMATCH',422);
    await projectMember(db,actor,request.projectId,true);
    const assignment=await this.assignments.read(db,actor,request.projectId,input.assignmentRef.id,input.assignmentRef.version);
    if(assignment.projectId!==request.projectId||!same(assignment.ref,input.assignmentRef)||assignment.snapshot.contentConfirmed!==true
      ||assignment.snapshot.executionAuthorized!==false||assignment.snapshot.dispatchPerformed!==false)throw new AuthFailure('VERSION_CONFLICT',409);
    const draft=await this.drafts.current(db,actor,request.projectId,assignment.snapshot.draftRef);
    const binding=await this.sessions.readBinding(db,actor,request.projectId,input.roleBindingRef.id,input.roleBindingRef.version);
    if(binding.projectId!==request.projectId||!same(binding.ref,input.roleBindingRef)||!same(binding.snapshot.assignmentRef,input.assignmentRef)
      ||!same(binding.snapshot.connectionRef,input.connectionRef)||binding.snapshot.state!=='RESERVED'||binding.snapshot.externalSessionHandleRef!==null
      ||binding.snapshot.executionAuthorized!==false||binding.snapshot.dispatchPerformed!==false)throw new AuthFailure('EXECUTION_BINDING_MISMATCH',409);
    const head=(await db.query('SELECT binding_id,version,content_hash FROM anvil.role_bindings WHERE project_id=$1 AND role_id=$2 ORDER BY version DESC LIMIT 1',[request.projectId,binding.snapshot.roleRef.id])).rows[0];
    if(!head||!same(input.roleBindingRef,{id:head.binding_id,version:Number(head.version),contentHash:head.content_hash}))throw new AuthFailure('VERSION_CONFLICT',409);
    const context=await this.contexts.read(db,actor,request.projectId,input.contextBundleRef.id,input.contextBundleRef.version);
    if(context.projectId!==request.projectId||!same(context.ref,input.contextBundleRef)||!same(context.manifest.assignmentRef,input.assignmentRef)
      ||context.manifest.ready!==false||context.manifest.executionAuthorized!==false||context.manifest.dispatchPerformed!==false)throw new AuthFailure('EXECUTION_CONTEXT_MISMATCH',409);
    for(const [candidateRef,kind] of [[input.connectionRef,'CONNECTION_CANDIDATE'],[input.environmentRef,'ENVIRONMENT_CANDIDATE']] as const) {
      const candidate=await this.candidates.read(db,actor,request.projectId,candidateRef.id,candidateRef.version);
      const row=(await db.query('SELECT head_version FROM anvil.connection_candidates WHERE project_id=$1 AND id=$2 FOR SHARE',[request.projectId,candidateRef.id])).rows[0];
      if(!same(candidate.ref,candidateRef)||candidate.expired||candidate.candidate.kind!==kind||Number(row?.head_version)!==candidateRef.version)throw new AuthFailure('EXECUTION_CANDIDATE_NOT_CURRENT',412);
    }
    let allowed:SourceScopeV1[];
    try{allowed=readSourceScopesV1(assignment.snapshot.definition.allowedScopes);}catch{throw new AuthFailure('EXECUTION_SOURCE_SCOPE_UNVERIFIED',412);}
    if(!withinScope(input.sourceScopes,allowed))throw new AuthFailure('EXECUTION_SOURCE_SCOPE_EXCEEDED',403);
    const missingConditions:string[]=[...unresolved];
    if(context.manifest.missingRequired.length)missingConditions.push('REQUIRED_CONTEXT_MISSING');
    if(context.currentCheck.state!=='MATCHED_METADATA')missingConditions.push('CURRENT_CONTEXT_CHANGED');
    if(input.mode==='WORK')missingConditions.push('UNDERSTANDING_NOT_REVIEWED');
    const candidates:unknown[]=[draft.snapshot.basis.planRef,draft.snapshot.basis.designRef,draft.snapshot.basis.applicationRef,...context.manifest.baselineRefs];
    if(context.manifest.constitutionRef!==null)candidates.push(context.manifest.constitutionRef);
    if(!arrayV1(candidates,200)||!candidates.every(refV1))throw new AuthFailure('EXECUTION_BASIS_INVALID',503);
    const basisRefs=[...new Map((candidates as VersionRef[]).map(ref=>[canonicalJson(ref),ref])).values()];
    const latestInstructionRefs=structuredClone(context.manifest.latestInstructionRefs);
    if(!arrayV1(latestInstructionRefs,200)||!latestInstructionRefs.every(instructionRef))throw new AuthFailure('EXECUTION_BASIS_INVALID',503);
    const at=(await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const snapshot={intent:input,basisRefs,latestInstructionRefs,checkedAt:at,missingConditions,authorizationState:'NOT_AUTHORIZED',preparedBy:{kind:'HUMAN',userId:actor.actorId},executionAuthorized:false,dispatchPerformed:false};
    if(Buffer.byteLength(canonicalJson(snapshot),'utf8')>2*1024*1024)throw new AuthFailure('EXECUTION_PREPARATION_TOO_LARGE',422);
    const ref={id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))};
    const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'EXECUTION_PREPARED',snapshot},policyRef,'EXPLICIT_PREPARATION_NOT_AUTHORIZATION');
    await db.query('INSERT INTO anvil.execution_preparations(project_id,id,version,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[request.projectId,ref.id,ref.version,ref.contentHash,JSON.stringify(snapshot),actor.actorId,actor.clientId,receipt.id]);
    return receipt.result;
  }
  async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number) {
    await projectMember(db,actor,projectId);
    if(!uuidV1(id)||version!==1)throw new AuthFailure('INPUT_INVALID',400);
    const row=(await db.query(select+'WHERE p.project_id=$1 AND p.id=$2 AND p.version=$3',[projectId,id,version])).rows[0];
    if(!row)throw new AuthFailure('NOT_FOUND',404);
    try {
      const snapshot=row.snapshot_json,ref={id,version,contentHash:row.content_hash};
      if(!refV1(ref)||!recordV1(snapshot,['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed'])
        ||readExecutionPreparationInput(snapshot.intent).projectId!==projectId||!arrayV1(snapshot.basisRefs,200)||!snapshot.basisRefs.every(refV1)||!isoV1(snapshot.checkedAt)
        ||!arrayV1(snapshot.latestInstructionRefs,200)||!snapshot.latestInstructionRefs.every(instructionRef)
        ||!arrayV1(snapshot.missingConditions,conditionCodes.length)||new Set(snapshot.missingConditions).size!==snapshot.missingConditions.length
        ||snapshot.missingConditions.some(code=>!conditionCodes.includes(code))||unresolved.some(code=>!snapshot.missingConditions.includes(code))
        ||snapshot.authorizationState!=='NOT_AUTHORIZED'||snapshot.executionAuthorized!==false||snapshot.dispatchPerformed!==false
        ||!same(snapshot.preparedBy,{kind:'HUMAN',userId:row.created_by})||row.command_actor!==row.created_by||row.command_client!==row.client_id
        ||row.operation!=='prepareExecution'||row.state!=='APPLIED'||row.result_ref?.status!=='APPLIED'||row.result_ref?.projectId!==projectId
        ||row.result_ref?.data?.status!=='EXECUTION_PREPARED'||!same(row.result_ref.data.ref,ref)||!same(row.result_ref.data.snapshot,snapshot)
        ||contentHash(canonicalJson(snapshot))!==ref.contentHash)throw Error();
      return {projectId,ref,snapshot:structuredClone(snapshot),currentness:'NOT_RECHECKED' as const};
    }catch{throw new AuthFailure('EXECUTION_PREPARATION_INTEGRITY_FAILED',503);}
  }
}
