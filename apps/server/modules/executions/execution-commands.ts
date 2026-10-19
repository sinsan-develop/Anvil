import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { readExecutionIntentV1, type ExecutionIntentV1 } from '../../../../contracts/runtime/execution-intent-v1.ts';
import { readDispatchEnvelopeV1 } from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import { readServerExecutionFactV1, type ServerExecutionFactV1 } from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import { cloneV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AccessRepository, AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { currentProjectController, persistProjectReceipt, projectReplay, recordProjectDenial, type ProjectCommand } from '../access/project-command.ts';
import { ProjectExecutionBudget, type BudgetClaim } from './execution-budget.ts';
import { authorizeRuntimePolicy, ProjectLimitPolicies } from './runtime-policy.ts';
import { planSyntheticExecutionGrant } from './execution-grants.ts';

type Reservation = Awaited<ReturnType<ProjectExecutionBudget['planReservation']>>;
interface QueueBasis { intent: ExecutionIntentV1; claim: BudgetClaim }
/** 서버 내부 전용 port. 실제 provider나 환경변수 fallback은 없으며 HTTP caller fact를 받지 않는다.
 * basis는 정확 준비·options/맥락을 검증하고, current는 같은 transaction에서 모든 현재 근거를 새로 대조한다.
 * P1에서는 합성 구현만 연결한다. 이 interface의 구현 자체가 실제 관측 증거는 아니다.
 */
export interface SyntheticQueueResolver {
  readonly transport: 'SYNTHETIC_ONLY';
  basis(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand): Promise<QueueBasis>;
  current(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, basis: QueueBasis, reservation: Reservation): Promise<ServerExecutionFactV1>;
}
interface InitialQueueInput {
  preparationRef: VersionRef; executionId: string; executionGeneration: number; permissionPolicyRef: VersionRef; budgetPolicyRef: VersionRef;
  operation: 'START_SESSION'; payload: {contextBundleRef: VersionRef; optionsRef: VersionRef};
}
const same = (a:unknown,b:unknown) => canonicalJson(a) === canonicalJson(b);
function input(request: ProjectCommand): InitialQueueInput {
  const bad=():never=>{throw new AuthFailure('EXECUTION_QUEUE_INPUT_INVALID',422);};
  try {
    if (!recordV1(request,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])
      ||request.schemaVersion!==1||!uuidV1(request.projectId)||!uuidV1(request.commandId)||!uuidV1(request.clientId)||!Number.isSafeInteger(request.controlGeneration)||request.controlGeneration<1
      ||request.operation!=='queueExecutionCommand'||request.targetId!==null||request.expectedVersion!==0||!Array.isArray(request.baselineRefs)||request.baselineRefs.length) return bad();
    const p=request.payload;
    if (!recordV1(p,['preparationRef','executionId','executionGeneration','permissionPolicyRef','budgetPolicyRef','operation','payload'])
      ||!refV1(p.preparationRef)||!uuidV1(p.executionId)||!Number.isSafeInteger(p.executionGeneration)||Number(p.executionGeneration)<1||!refV1(p.permissionPolicyRef)||!refV1(p.budgetPolicyRef)
      ||p.operation!=='START_SESSION'||!recordV1(p.payload,['contextBundleRef','optionsRef'])||!refV1(p.payload.contextBundleRef)||!refV1(p.payload.optionsRef)
      ||Buffer.byteLength(canonicalJson(request))>2*1024*1024) return bad();
    return cloneV1(p) as unknown as InitialQueueInput;
  } catch { return bad(); }
}

/** 최초 합성 실행의 원자 저장 소비자. 제공자를 명시 주입해야 하며 production HTTP에는 아직 등록하지 않는다.
 * 응답 APPLIED는 SYNTHETIC_QUEUE_STORED다. 실제 실행 허가/OS 소유·wire 성공을 표시하지 않는다.
 * 후속 SEND_INSTRUCTION/회수·credential·wire fence는 별도 남은 C2/C3 구현이다.
 */
export class ProjectInitialExecutionQueue {
  readonly access: AccessRepository;
  readonly resolver: SyntheticQueueResolver;
  readonly budgets: ProjectExecutionBudget;
  readonly policies: Pick<ProjectLimitPolicies,'resolveCurrent'>;
  constructor(access:AccessRepository,resolver:SyntheticQueueResolver,budgets=new ProjectExecutionBudget(),policies:Pick<ProjectLimitPolicies,'resolveCurrent'>=new ProjectLimitPolicies()) {
    if(!resolver||resolver.transport!=='SYNTHETIC_ONLY'||typeof resolver.basis!=='function'||typeof resolver.current!=='function')throw new AuthFailure('SYNTHETIC_PROVIDER_REQUIRED',412);
    this.access=access;this.resolver=resolver;this.budgets=budgets;this.policies=policies;
  }
  async command(token:string,csrf:string,request:ProjectCommand) {
    const p=input(request);
    request=cloneV1(request);
    try {
      return await this.access.authenticated(token,csrf,async(db,actor)=>{
        if(this.resolver.transport!=='SYNTHETIC_ONLY')throw new AuthFailure('SYNTHETIC_PROVIDER_REQUIRED',412);
        if(!actor.authSession||!uuidV1(actor.authSession.id)||!isoV1(actor.authSession.idleExpiresAt)||!isoV1(actor.authSession.absoluteExpiresAt))throw new AuthFailure('EXECUTION_HUMAN_SESSION_REQUIRED',412);
        await currentProjectController(db,actor,request);
        const raw=cloneV1(await this.resolver.basis(db,actor,cloneV1(request)));
        if(!recordV1(raw,['intent','claim']))throw new AuthFailure('EXECUTION_BASIS_INVALID',503);
        const basis:QueueBasis={intent:readExecutionIntentV1(raw.intent),claim:raw.claim};
        const c=basis.claim;
        if(basis.intent.projectId!==request.projectId||!same(basis.intent.budgetPolicyRef,p.budgetPolicyRef)||!same(basis.intent.contextBundleRef,p.payload.contextBundleRef)
          ||c.projectId!==request.projectId||c.executionId!==p.executionId||c.executionGeneration!==p.executionGeneration||c.commandId!==request.commandId
          ||c.operation!=='START_SESSION'||!same(c.assignmentRef,basis.intent.assignmentRef)||!same(c.policyRef,p.budgetPolicyRef))throw new AuthFailure('EXECUTION_BASIS_MISMATCH',409);
        const policyInput={executionId:p.executionId,executionGeneration:p.executionGeneration,permissionPolicyRef:p.permissionPolicyRef,budgetPolicyRef:p.budgetPolicyRef,sourceScopes:basis.intent.sourceScopes};
        // 초기 queue는 authorizeExecution과 queue의 명시 범위를 모두 요구한다. 새 권한을 문자열 AUTO로 암묵 발급하지 않는다.
        let executionPolicy=await authorizeRuntimePolicy(db,actor,{...request,operation:'authorizeExecution'},policyInput,this.policies);
        let policy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.policies);
        const replay=await projectReplay(db,actor,request);if(replay!==undefined)return replay;
        // 만료만으로 미확인 writer를 회수하지 않는다. project 잠금 아래 보수적으로 한 실행만 저장한다.
        if((await db.query('SELECT id FROM anvil.writer_claims WHERE project_id=$1 AND reclaimed_at IS NULL FOR UPDATE',[request.projectId])).rows.length)throw new AuthFailure('EXECUTION_WRITER_UNAVAILABLE',409);
        if((await db.query('SELECT id FROM anvil.executions WHERE project_id=$1 AND id=$2 FOR UPDATE',[request.projectId,p.executionId])).rows.length)throw new AuthFailure('EXECUTION_ALREADY_EXISTS',409);
        const reservation=await this.budgets.planReservation(db,actor,c);
        if(reservation.record.snapshot.state!=='RESERVED'||reservation.record.ref.version!==1||!same(reservation.record.snapshot.claim,c))throw new AuthFailure('EXECUTION_RESERVATION_INVALID',409);
        const fact=readServerExecutionFactV1(await this.resolver.current(db,actor,cloneV1(request),cloneV1(basis),cloneV1(reservation)));
        if(fact.projectId!==request.projectId||fact.executionId!==p.executionId||fact.executionGeneration!==p.executionGeneration||!same(fact.intent,basis.intent)
          ||!same(fact.preparationRef,p.preparationRef)||!same(fact.permissionPolicyRef,p.permissionPolicyRef)||!same(fact.budgetReservationRef,reservation.record.ref)
          ||fact.subject.userId!==actor.actorId||fact.subject.clientId!==actor.clientId||fact.subject.humanSessionId!==actor.authSession.id||fact.subject.controlGeneration!==request.controlGeneration||fact.subject.credentialGeneration!==actor.credentialGeneration)throw new AuthFailure('EXECUTION_FACT_BINDING_MISMATCH',409);
        executionPolicy=await authorizeRuntimePolicy(db,actor,{...request,operation:'authorizeExecution'},policyInput,this.policies);
        policy=await authorizeRuntimePolicy(db,actor,request,policyInput,this.policies);
        const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
        if(!(at instanceof Date)||!Number.isFinite(at.getTime()))throw new AuthFailure('EXECUTION_CLOCK_INVALID',503);
        // 권한/예산 기한을 provider의 더 긴 주장으로 늘릴 수 없다.
        fact.expires.permissionPolicy=new Date(Math.min(Date.parse(fact.expires.permissionPolicy),executionPolicy.validUntil,policy.validUntil)).toISOString();
        fact.expires.humanSession=new Date(Math.min(Date.parse(fact.expires.humanSession),Date.parse(actor.authSession.idleExpiresAt),Date.parse(actor.authSession.absoluteExpiresAt))).toISOString();
        const grant=planSyntheticExecutionGrant(fact,at.toISOString());
        // receipt → envelope → receipt hash 순환을 만들지 않는다. 불변 queue intent를 먼저 저장하고,
        // 실제 receipt id/scope hash로 봉투를 만든 뒤 같은 transaction의 execution_commands에 결박한다.
        const queueIntent={transport:'SYNTHETIC_ONLY',executionId:p.executionId,executionGeneration:p.executionGeneration,state:'SYNTHETIC_QUEUED',grantRef:grant.ref,
          reservationRef:reservation.record.ref,executorRegistrationRef:fact.registration.ref,operation:'START_SESSION',payload:p.payload,
          humanSessionId:actor.authSession.id,sourceScopes:basis.intent.sourceScopes,budgetPolicyRef:p.budgetPolicyRef,
          queuedAt:at.toISOString(),executionAuthorized:false,dispatchPerformed:false};
        const commandRef={id:randomUUID(),version:1,contentHash:contentHash(canonicalJson(queueIntent))};
        const receipt=await persistProjectReceipt(db,actor,request,commandRef,{status:'SYNTHETIC_QUEUE_STORED',snapshot:queueIntent,executionAuthorized:false,dispatchPerformed:false},policy.policyRef,'EXPLICIT_SYNTHETIC_QUEUE_ONLY');
        const authorizationRef=receipt.authorizationReceiptRef;
        const unsigned={schemaVersion:1,commandId:request.commandId,issuedAt:at.toISOString(),expiresAt:grant.snapshot.expiresAt,executorRegistrationRef:fact.registration.ref,
          context:{projectId:request.projectId,assignmentId:basis.intent.assignmentRef.id,executionId:p.executionId,executionGeneration:p.executionGeneration,connectionRef:basis.intent.connectionRef,
            environmentRef:basis.intent.environmentRef,authorizationReceiptRef:authorizationRef,capabilityRef:basis.intent.capabilityRef,budgetRef:reservation.record.ref,sourceScopes:basis.intent.sourceScopes},operation:'START_SESSION',payload:p.payload};
        const envelope=readDispatchEnvelopeV1({...unsigned,envelopeHash:contentHash(canonicalJson(unsigned))},at.getTime());
        const snapshot={...queueIntent,envelope};
        await db.query('INSERT INTO anvil.executions(project_id,id,generation,transport,state,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [request.projectId,p.executionId,p.executionGeneration,'SYNTHETIC_ONLY','SYNTHETIC_QUEUED',actor.actorId,actor.clientId,receipt.id]);
        await db.query('INSERT INTO anvil.execution_grants(project_id,id,version,execution_id,generation,content_hash,snapshot_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [request.projectId,grant.ref.id,1,p.executionId,p.executionGeneration,grant.ref.contentHash,JSON.stringify(grant.snapshot),actor.actorId,actor.clientId,receipt.id]);
        const b=reservation.record;
        await db.query('INSERT INTO anvil.usage_reservations(project_id,reservation_id,version,server_sequence,command_id,content_hash,snapshot_json,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [request.projectId,b.ref.id,b.ref.version,b.snapshot.sequence,request.commandId,b.ref.contentHash,JSON.stringify(b.snapshot),receipt.id]);
        await db.query('INSERT INTO anvil.writer_claims(project_id,id,execution_id,generation,grant_id,grant_version,scope_json,expires_at,ownership_state,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [request.projectId,randomUUID(),p.executionId,p.executionGeneration,grant.ref.id,1,JSON.stringify(basis.intent.sourceScopes),grant.snapshot.expiresAt,'SYNTHETIC_CLAIM',receipt.id]);
        await db.query('INSERT INTO anvil.execution_commands(project_id,id,version,execution_id,generation,grant_id,grant_version,content_hash,envelope_hash,snapshot_json,authorization_ref,created_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [request.projectId,commandRef.id,1,p.executionId,p.executionGeneration,grant.ref.id,1,commandRef.contentHash,envelope.envelopeHash,JSON.stringify(snapshot),JSON.stringify(authorizationRef),receipt.id]);
        await db.query('INSERT INTO anvil.delivery_outbox(id,project_id,command_id,kind,destination_ref,payload_ref,state,scope_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [randomUUID(),request.projectId,receipt.id,'EXECUTION_SYNTHETIC_ONLY',JSON.stringify({transport:'SYNTHETIC_ONLY',registrationRef:fact.registration.ref,executionId:p.executionId,generation:p.executionGeneration}),
            JSON.stringify({commandRef,grantRef:grant.ref,envelopeHash:envelope.envelopeHash}),'HELD_SYNTHETIC_ONLY',grant.snapshot.scopeDigest]);
        return receipt.result;
      });
    } catch(error) { await recordProjectDenial(this.access,token,request.projectId,error);throw error; }
  }
}
