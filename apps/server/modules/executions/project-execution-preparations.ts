import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { arrayV1, hashV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { readSourceScopesV1, type SourceScopeV1 } from '../../../../contracts/runtime/source-scope-v1.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, reserveRegisteredPreparationReceiptIds, projectMember, type ProjectCommand } from '../access/project-command.ts';
import type { ProjectAssignmentConfirmations } from '../assignments/project-assignment-confirmations.ts';
import type { ProjectAssignmentDrafts } from '../assignments/project-assignment-drafts.ts';
import type { ResponsibleSessions } from '../assignments/responsible-sessions.ts';
import type { ProjectContexts } from '../context/project-contexts.ts';
import type { ProjectConnectionCandidates } from '../connections/project-candidates.ts';
import { readExecutionPreparationInput, compileExecutionPreparationOptions } from './preparation-input.ts';
import type { ExecutionPreparationIntentV1 } from '../../../../contracts/runtime/execution-intent-v1.ts';
import { ProjectConnectionDefinitions } from '../connections/project-connection-definitions.ts';
import { ProjectEnvironments } from '../connections/project-environments.ts';
import { ProjectStorageQuota } from '../projects/project-storage-quota.ts';

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
  readonly #registeredDefinitions:ProjectConnectionDefinitions|null;
  readonly #registeredEnvironments:ProjectEnvironments|null;
  readonly #registeredQuota:ProjectStorageQuota|null;
  constructor(assignments:Pick<ProjectAssignmentConfirmations,'read'>,drafts:Pick<ProjectAssignmentDrafts,'current'>,
    sessions:Pick<ResponsibleSessions,'readBinding'>,contexts:Pick<ProjectContexts,'read'>,candidates:Pick<ProjectConnectionCandidates,'read'>,
    registered?:{definitions:ProjectConnectionDefinitions;environments:ProjectEnvironments;quota:ProjectStorageQuota}) {
    this.assignments=assignments;this.drafts=drafts;this.sessions=sessions;this.contexts=contexts;this.candidates=candidates;
    this.#registeredDefinitions=registered?.definitions instanceof ProjectConnectionDefinitions?registered.definitions:null;
    this.#registeredEnvironments=registered?.environments instanceof ProjectEnvironments?registered.environments:null;
    this.#registeredQuota=registered?.quota instanceof ProjectStorageQuota?registered.quota:null;
  }
  async #registeredOptions(db:PoolClient,actor:AuthenticatedIdentity,input:ExecutionPreparationIntentV1,fresh:boolean) {
    if (!('connectionKind' in input) || !this.#registeredDefinitions || !this.#registeredEnvironments) throw new AuthFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
    const definition=await ProjectConnectionDefinitions.prototype.read.call(this.#registeredDefinitions,db,actor,input.projectId,input.connectionRef.id,input.connectionRef.version);
    if (definition.projectId!==input.projectId || !same(definition.ref,input.connectionRef) || !same(definition.definition.environmentRef,input.environmentRef)) throw new AuthFailure('EXECUTION_PREPARATION_SOURCE_MISMATCH',409);
    const environment=await ProjectEnvironments.prototype.read.call(this.#registeredEnvironments,db,actor,input.projectId,input.environmentRef.id,input.environmentRef.version);
    if (environment.projectId!==input.projectId || !same(environment.ref,input.environmentRef)) throw new AuthFailure('EXECUTION_PREPARATION_SOURCE_MISMATCH',409);
    if (fresh && (!definition.currentStatus.configurationCurrent || environment.current.configurationCurrentness!=='MATCHED')) throw new AuthFailure('EXECUTION_PREPARATION_SOURCE_NOT_CURRENT',412);
    return compileExecutionPreparationOptions(definition.definition);
  }
  /** 원 결과를 변경하지 않는 같은 Tx replay 검산이다. 후보 분기는 기존 반환을 보존한다. */
  async verifyRegisteredReplay(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,result:unknown):Promise<void> {
    const input=readExecutionPreparationInput(request.payload);if (!('connectionKind' in input)) return;
    const raw=result as {data?:{status?:unknown;ref?:VersionRef;snapshot?:unknown}};
    if (raw?.data?.status!=='EXECUTION_PREPARED' || !refV1(raw.data.ref)) throw new AuthFailure('EXECUTION_PREPARATION_INTEGRITY_FAILED',503);
    const original=await this.read(db,actor,request.projectId,raw.data.ref.id,raw.data.ref.version);
    if (!same(original.ref,raw.data.ref) || !same(original.snapshot,raw.data.snapshot) || !same(original.snapshot.intent,input)) throw new AuthFailure('EXECUTION_PREPARATION_INTEGRITY_FAILED',503);
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
    const registered='connectionKind' in input;
    if(registered?binding.snapshot.connectionKind!=='REGISTERED_DEFINITION'||binding.snapshot.connectionReadiness!=='REGISTERED_DEFINITION_ONLY':Object.hasOwn(binding.snapshot,'connectionKind')||binding.snapshot.connectionReadiness!=='CANDIDATE_ONLY')throw new AuthFailure('EXECUTION_BINDING_MISMATCH',409);
    const head=(await db.query('SELECT binding_id,version,content_hash FROM anvil.role_bindings WHERE project_id=$1 AND role_id=$2 ORDER BY version DESC LIMIT 1',[request.projectId,binding.snapshot.roleRef.id])).rows[0];
    if(!head||!same(input.roleBindingRef,{id:head.binding_id,version:Number(head.version),contentHash:head.content_hash}))throw new AuthFailure('VERSION_CONFLICT',409);
    const context=await this.contexts.read(db,actor,request.projectId,input.contextBundleRef.id,input.contextBundleRef.version);
    if(context.projectId!==request.projectId||!same(context.ref,input.contextBundleRef)||!same(context.manifest.assignmentRef,input.assignmentRef)
      ||context.manifest.ready!==false||context.manifest.executionAuthorized!==false||context.manifest.dispatchPerformed!==false)throw new AuthFailure('EXECUTION_CONTEXT_MISMATCH',409);
    const options=registered?await this.#registeredOptions(db,actor,input,true):null;
    if(!registered)for(const [candidateRef,kind] of [[input.connectionRef,'CONNECTION_CANDIDATE'],[input.environmentRef,'ENVIRONMENT_CANDIDATE']] as const) {
      const candidate=await this.candidates.read(db,actor,request.projectId,candidateRef.id,candidateRef.version);
      const row=(await db.query('SELECT head_version FROM anvil.connection_candidates WHERE project_id=$1 AND id=$2 FOR SHARE',[request.projectId,candidateRef.id])).rows[0];
      if(!same(candidate.ref,candidateRef)||candidate.expired||candidate.candidate.kind!==kind||Number(row?.head_version)!==candidateRef.version)throw new AuthFailure('EXECUTION_CANDIDATE_NOT_CURRENT',412);
    }
    let allowed:SourceScopeV1[];
    try{allowed=readSourceScopesV1(assignment.snapshot.definition.allowedScopes);}catch{throw new AuthFailure('EXECUTION_SOURCE_SCOPE_UNVERIFIED',412);}
    if(!withinScope(input.sourceScopes,allowed))throw new AuthFailure('EXECUTION_SOURCE_SCOPE_EXCEEDED',403);
    const missingConditions:string[]=registered?unresolved.map(code=>code==='CONNECTION_CANDIDATE_ONLY'?'CONNECTION_DEFINITION_ONLY':code==='ENVIRONMENT_CANDIDATE_ONLY'?'ENVIRONMENT_DEFINITION_ONLY':code):[...unresolved];
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
    const snapshot={intent:input,basisRefs,latestInstructionRefs,checkedAt:at,missingConditions,authorizationState:'NOT_AUTHORIZED',preparedBy:{kind:'HUMAN',userId:actor.actorId},executionAuthorized:false,dispatchPerformed:false,...(options?{options}:{})};
    if(Buffer.byteLength(canonicalJson(snapshot),'utf8')>2*1024*1024)throw new AuthFailure('EXECUTION_PREPARATION_TOO_LARGE',422);
    const ref={id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(snapshot))};
    if(registered&&!this.#registeredQuota)throw new AuthFailure('SOURCE_VERIFIER_NOT_CONNECTED',412);
    const receiptIds=registered?reserveRegisteredPreparationReceiptIds():undefined;
    const quotaLease=registered?await ProjectStorageQuota.prototype.reserveRegisteredPreparation.call(this.#registeredQuota!,db,actor,request,ref,snapshot,policyRef,receiptIds!):null;
    const receipt=await persistProjectReceipt(db,actor,request,ref,{status:'EXECUTION_PREPARED',snapshot},policyRef,'EXPLICIT_PREPARATION_NOT_AUTHORIZATION',receiptIds);
    await db.query('INSERT INTO anvil.execution_preparations(project_id,id,version,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[request.projectId,ref.id,ref.version,ref.contentHash,JSON.stringify(snapshot),actor.actorId,actor.clientId,receipt.id]);
    if(quotaLease){
      await ProjectStorageQuota.prototype.settleRegisteredPreparation.call(this.#registeredQuota!,db,actor,quotaLease,receipt);
      const finalOptions=await this.#registeredOptions(db,actor,input,true);
      if(!same(finalOptions,options))throw new AuthFailure('EXECUTION_PREPARATION_SOURCE_MISMATCH',409);
    }
    return receipt.result;
  }
  async read(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,id:string,version:number) {
    await projectMember(db,actor,projectId);
    if(!uuidV1(id)||version!==1)throw new AuthFailure('INPUT_INVALID',400);
    const row=(await db.query(select+'WHERE p.project_id=$1 AND p.id=$2 AND p.version=$3',[projectId,id,version])).rows[0];
    if(!row)throw new AuthFailure('NOT_FOUND',404);
    let original:{projectId:string;ref:VersionRef;snapshot:Record<string,any>;currentness:'NOT_RECHECKED'};
    try {
      const snapshot=row.snapshot_json,ref={id,version,contentHash:row.content_hash};
      const intent=readExecutionPreparationInput(snapshot?.intent),registered='connectionKind' in intent;
      const required=registered?unresolved.map(code=>code==='CONNECTION_CANDIDATE_ONLY'?'CONNECTION_DEFINITION_ONLY':code==='ENVIRONMENT_CANDIDATE_ONLY'?'ENVIRONMENT_DEFINITION_ONLY':code):[...unresolved];
      const codes=[...required,'REQUIRED_CONTEXT_MISSING','CURRENT_CONTEXT_CHANGED','UNDERSTANDING_NOT_REVIEWED'];
      if(!refV1(ref)||!recordV1(snapshot,['intent','basisRefs','latestInstructionRefs','checkedAt','missingConditions','authorizationState','preparedBy','executionAuthorized','dispatchPerformed',...(registered?['options']:[])])
        ||readExecutionPreparationInput(snapshot.intent).projectId!==projectId||!arrayV1(snapshot.basisRefs,200)||!snapshot.basisRefs.every(refV1)||!isoV1(snapshot.checkedAt)
        ||!arrayV1(snapshot.latestInstructionRefs,200)||!snapshot.latestInstructionRefs.every(instructionRef)
        ||!arrayV1(snapshot.missingConditions,codes.length)||new Set(snapshot.missingConditions).size!==snapshot.missingConditions.length
        ||snapshot.missingConditions.some(code=>!codes.includes(code))||required.some(code=>!snapshot.missingConditions.includes(code))
        ||snapshot.authorizationState!=='NOT_AUTHORIZED'||snapshot.executionAuthorized!==false||snapshot.dispatchPerformed!==false
        ||!same(snapshot.preparedBy,{kind:'HUMAN',userId:row.created_by})||row.command_actor!==row.created_by||row.command_client!==row.client_id
        ||row.operation!=='prepareExecution'||row.state!=='APPLIED'||row.result_ref?.status!=='APPLIED'||row.result_ref?.projectId!==projectId
        ||row.result_ref?.data?.status!=='EXECUTION_PREPARED'||!same(row.result_ref.data.ref,ref)||!same(row.result_ref.data.snapshot,snapshot)
        ||contentHash(canonicalJson(snapshot))!==ref.contentHash)throw Error();
      if(registered && (!recordV1(snapshot.options,['format','mediaType','body','utf8Bytes','contentHash']) || snapshot.options.format!==intent.optionsFormat || snapshot.options.mediaType!=='application/json' || typeof snapshot.options.body!=='string' || !snapshot.options.body.isWellFormed() || snapshot.options.utf8Bytes!==Buffer.byteLength(snapshot.options.body,'utf8') || snapshot.options.contentHash!==contentHash(snapshot.options.body))) throw Error();
      if(Buffer.byteLength(canonicalJson(snapshot),'utf8')>2*1024*1024) throw Error();
      original={projectId,ref,snapshot:structuredClone(snapshot),currentness:'NOT_RECHECKED'};
    }catch{throw new AuthFailure('EXECUTION_PREPARATION_INTEGRITY_FAILED',503);}
    const intent=readExecutionPreparationInput(original.snapshot.intent);
    if('connectionKind' in intent){
      const options=await this.#registeredOptions(db,actor,intent,false);
      if(!same(options,original.snapshot.options))throw new AuthFailure('EXECUTION_PREPARATION_INTEGRITY_FAILED',503);
    }
    return original;
  }
}
