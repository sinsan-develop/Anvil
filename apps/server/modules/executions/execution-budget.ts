import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { arrayV1, cloneV1, isoV1, recordV1, refV1, uuidV1 } from '../../../../contracts/runtime/validation-v1.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember } from '../access/project-command.ts';
import { ProjectLimitPolicies, readLimitPolicyInput, type LimitPolicyRecord } from './runtime-policy.ts';

export interface BudgetCost { amount: number; currency: string }
export interface BudgetUnits { attempts: number; calls: number; spoolBytes: number; cost: BudgetCost | null; costStatus: 'VERIFIED_NO_CHARGE' | 'FINITE_CAP' | 'OBSERVED' | 'UNKNOWN' }
export interface BudgetClaim {
  projectId: string; executionId: string; executionGeneration: number; commandId: string; assignmentRef: VersionRef;
  stageRef: { applicationRef: VersionRef; nodeId: string }; policyRef: VersionRef;
  operation: 'START_SESSION' | 'SEND_INSTRUCTION'; demand: BudgetUnits;
}
type BudgetState = 'RESERVED' | 'DISPATCHED' | 'UNKNOWN' | 'SETTLED' | 'CANCELLED';
export interface BudgetRecord {
  ref: VersionRef;
  snapshot: { sequence: number; claim: BudgetClaim; state: BudgetState; usage: BudgetUnits | null; previousRef: VersionRef | null;
    checkedAt: string; evidenceRef: VersionRef | null; executionAuthorized: false; dispatchPerformed: false };
}
type CheckedPolicy = Pick<LimitPolicyRecord,'projectId'|'ref'> & { snapshot: Pick<LimitPolicyRecord['snapshot'],'scope'|'state'|'limits'|'decidedAt'|'expiresAt'> };
interface Decimal { coefficient: bigint; scale: number }
const fail = (code: string, status = 412): never => { throw new AuthFailure(code, status); };
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const safeInt = (v: unknown, min=0): v is number => Number.isSafeInteger(v) && Number(v) >= min;
const amount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
function decimal(value: number): Decimal {
  const [mantissa, exponent='0'] = value.toString().split('e'), [whole, fraction=''] = mantissa!.split('.');
  let coefficient=BigInt(whole!+fraction), scale=fraction.length-Number(exponent);
  if(scale<0){coefficient*=10n**BigInt(-scale);scale=0;}
  while(scale>0&&coefficient%10n===0n){coefficient/=10n;scale--;}
  return {coefficient,scale};
}
function addDecimal(a: Decimal,b: Decimal): Decimal { const scale=Math.max(a.scale,b.scale);return {coefficient:a.coefficient*10n**BigInt(scale-a.scale)+b.coefficient*10n**BigInt(scale-b.scale),scale}; }
function decimalText(value: Decimal) {
  let {coefficient,scale}=value;while(scale>0&&coefficient%10n===0n){coefficient/=10n;scale--;}
  const text=coefficient.toString().padStart(scale+1,'0');return scale?text.slice(0,-scale)+'.'+text.slice(-scale):text;
}
function compareDecimal(a: Decimal,b: Decimal){const scale=Math.max(a.scale,b.scale),left=a.coefficient*10n**BigInt(scale-a.scale),right=b.coefficient*10n**BigInt(scale-b.scale);return left<right?-1:left>right?1:0;}
function unitsValid(value: unknown): value is BudgetUnits {
  return recordV1(value,['attempts','calls','spoolBytes','cost','costStatus'])&&safeInt(value.attempts)&&safeInt(value.calls)&&safeInt(value.spoolBytes)
    &&['VERIFIED_NO_CHARGE','FINITE_CAP','OBSERVED','UNKNOWN'].includes(value.costStatus)
    &&(value.cost===null||recordV1(value.cost,['amount','currency'])&&amount(value.cost.amount)&&typeof value.cost.currency==='string'&&/^[A-Z]{3}$/.test(value.cost.currency));
}
function readClaim(value: unknown): BudgetClaim {
  let input: any;try{const text=canonicalJson(value);if(Buffer.byteLength(text)>2*1024*1024)throw Error();input=JSON.parse(text);}catch{return fail('BUDGET_INPUT_INVALID',422);}
  if(input?.demand&&[undefined,'UNKNOWN'].includes(input.demand.costStatus))return fail('BUDGET_COST_UNVERIFIED');
  if(!recordV1(input,['projectId','executionId','executionGeneration','commandId','assignmentRef','stageRef','policyRef','operation','demand'])
    ||!uuidV1(input.projectId)||!uuidV1(input.executionId)||!uuidV1(input.commandId)||!safeInt(input.executionGeneration,1)||!refV1(input.assignmentRef)||!refV1(input.policyRef)
    ||!recordV1(input.stageRef,['applicationRef','nodeId'])||!refV1(input.stageRef.applicationRef)||typeof input.stageRef.nodeId!=='string'||!input.stageRef.nodeId.trim()
    ||!['START_SESSION','SEND_INSTRUCTION'].includes(input.operation)||!unitsValid(input.demand)||!safeInt(input.demand.calls,1)
    ||input.demand.attempts!==(input.operation==='START_SESSION'?1:0)
    ||(input.demand.costStatus==='VERIFIED_NO_CHARGE'?input.demand.cost!==null:input.demand.costStatus!=='FINITE_CAP'||input.demand.cost===null))return fail('BUDGET_INPUT_INVALID',422);
  return input as BudgetClaim;
}
function checkedPolicy(policy: CheckedPolicy, at: string, claim?: BudgetClaim, requireActive=true) {
  if(!isoV1(at)||!uuidV1(policy?.projectId)||!refV1(policy?.ref)||!isoV1(policy?.snapshot?.decidedAt)||!isoV1(policy?.snapshot?.expiresAt))return fail('BUDGET_POLICY_INVALID',422);
  const p=policy.snapshot;
  readLimitPolicyInput({limits:p.limits,scope:p.scope,reason:'서버 내부 현재 예산 검사',policyBaseVersion:policy.ref.version-1});
  if(p.scope.projectId!==policy.projectId||p.scope.kind!=='PROJECT'||claim&&claim.projectId!==policy.projectId)return fail('BUDGET_SCOPE_MISMATCH',422);
  if(claim&&!same(policy.ref,claim.policyRef))return fail('BUDGET_POLICY_NOT_CURRENT',409);
  if(!['APPLIED','REVOKED'].includes(p.state)||p.state==='APPLIED'&&(Date.parse(p.expiresAt)<=Date.parse(p.decidedAt)||Date.parse(p.expiresAt)-Date.parse(p.decidedAt)>p.limits.maxElapsedMs))return fail('BUDGET_POLICY_INVALID',422);
  const issues=[...(p.state!=='APPLIED'?['BUDGET_POLICY_REVOKED']:[]),...(Date.parse(at)<Date.parse(p.decidedAt)?['BUDGET_POLICY_NOT_YET_VALID']:[]),...(Date.parse(at)>=Date.parse(p.expiresAt)?['BUDGET_POLICY_EXPIRED']:[])];
  if(requireActive&&issues.length)return fail(issues[0]!);
  return {...p,issues};
}
function transitionAllowed(before: BudgetState,after: BudgetState) {
  return before==='RESERVED'&&['DISPATCHED','UNKNOWN','CANCELLED'].includes(after)
    ||before==='DISPATCHED'&&['UNKNOWN','SETTLED'].includes(after)||before==='UNKNOWN'&&after==='SETTLED';
}
/** 서버가 읽은 불변 이력을 검사한다. 이 문법/hash 검사는 관측 출처·현재 권한을 대신하지 않는다. */
function ledger(value: BudgetRecord[],projectId?: string) {
  const heads=new Map<string,BudgetRecord>(),firsts=new Map<string,BudgetRecord>();let priorTime=-Infinity;
  try {
    if(!arrayV1(value,10000)||Buffer.byteLength(canonicalJson(value))>16*1024*1024)throw Error();
    for(let n=0;n<value.length;n++){
      const record=value[n]!,s=record.snapshot;
      if(!recordV1(record,['ref','snapshot'])||!refV1(record.ref)||!recordV1(s,['sequence','claim','state','usage','previousRef','checkedAt','evidenceRef','executionAuthorized','dispatchPerformed'])
        ||s.sequence!==n+1||!isoV1(s.checkedAt)||Date.parse(s.checkedAt)<priorTime||s.executionAuthorized!==false||s.dispatchPerformed!==false
        ||contentHash(canonicalJson(s))!==record.ref.contentHash)throw Error();
      const c=readClaim(s.claim);if(projectId&&c.projectId!==projectId)throw Error();
      const previous=heads.get(record.ref.id);
      if(!previous){
        if(record.ref.version!==1||s.previousRef!==null||s.state!=='RESERVED'||s.usage!==null||s.evidenceRef!==null||firsts.has(c.commandId))throw Error();
        firsts.set(c.commandId,record);
      }else{
        if(record.ref.version!==previous.ref.version+1||!same(s.previousRef,previous.ref)||!same(s.claim,previous.snapshot.claim)
          ||!transitionAllowed(previous.snapshot.state,s.state)||!refV1(s.evidenceRef)
          ||(s.state==='SETTLED'?!unitsValid(s.usage):s.usage!==null))throw Error();
        if(s.state==='SETTLED'&&(s.usage!.costStatus==='FINITE_CAP'||s.usage!.costStatus==='UNKNOWN'
          ||(s.usage!.costStatus==='VERIFIED_NO_CHARGE'?s.usage!.cost!==null:s.usage!.cost===null)
          ||c.demand.cost&&(s.usage!.cost===null||s.usage!.costStatus!=='OBSERVED'||s.usage!.cost.currency!==c.demand.cost.currency)))throw Error();
      }
      heads.set(record.ref.id,record);priorTime=Date.parse(s.checkedAt);
    }
  }catch{return fail('BUDGET_LEDGER_INTEGRITY_FAILED',503);}
  return {heads,firsts,priorTime};
}
interface Totals { attempts: bigint; calls: bigint; spoolBytes: bigint; costs: Map<string,Decimal> }
const emptyTotals=(): Totals=>({attempts:0n,calls:0n,spoolBytes:0n,costs:new Map()});
function add(t: Totals,u: BudgetUnits){t.attempts+=BigInt(u.attempts);t.calls+=BigInt(u.calls);t.spoolBytes+=BigInt(u.spoolBytes);if(u.cost)t.costs.set(u.cost.currency,addDecimal(t.costs.get(u.cost.currency)??{coefficient:0n,scale:0},decimal(u.cost.amount)));}
function totalView(t: Totals){const number=(v:bigint)=>v<=BigInt(Number.MAX_SAFE_INTEGER)?Number(v):v.toString();const costs=[...t.costs].sort(([a],[b])=>a.localeCompare(b)).map(([currency,sum])=>({currency,amount:decimalText(sum)}));return{attempts:number(t.attempts),calls:number(t.calls),spoolBytes:number(t.spoolBytes),cost:costs.length===1?costs[0]:null,costs};}
function summarize(heads: Map<string,BudgetRecord>,stage?: BudgetClaim['stageRef']) {
  const used=emptyTotals(),reserved=emptyTotals(),live=new Set<string>();let unknown=0,stageAttempts=0n;
  for(const r of heads.values()){
    const s=r.snapshot;if(s.state==='CANCELLED')continue;
    const u=s.state==='SETTLED'?s.usage!:s.claim.demand;add(s.state==='SETTLED'?used:reserved,u);
    if(stage&&same(s.claim.stageRef,stage))stageAttempts+=BigInt(u.attempts);
    if(s.state!=='SETTLED')live.add(s.claim.executionId+':'+s.claim.executionGeneration);
    if(s.state==='UNKNOWN')unknown++;
  }
  return {used,reserved,live,unknown,stageAttempts};
}
function availability(heads: Map<string,BudgetRecord>,policy: CheckedPolicy,claim: BudgetClaim,addClaim: boolean) {
  const t=summarize(heads,claim.stageRef),limits=policy.snapshot.limits;
  if(t.unknown)return fail('BUDGET_USAGE_UNKNOWN');
  const more=addClaim?claim.demand:{attempts:0,calls:0,spoolBytes:0,cost:null};
  if(t.stageAttempts+BigInt(more.attempts)>BigInt(limits.maxAttempts))return fail('BUDGET_ATTEMPTS_EXHAUSTED');
  if(t.used.calls+t.reserved.calls+BigInt(more.calls)>BigInt(limits.maxCalls))return fail('BUDGET_CALLS_EXHAUSTED');
  if(t.used.spoolBytes+t.reserved.spoolBytes+BigInt(more.spoolBytes)>BigInt(limits.maxSpoolBytes))return fail('BUDGET_SPOOL_EXHAUSTED');
  if(addClaim)t.live.add(claim.executionId+':'+claim.executionGeneration);
  if(t.live.size>limits.maxConcurrentAssignments)return fail('BUDGET_CONCURRENCY_EXHAUSTED');
  const costs=new Map(t.used.costs);for(const [currency,cost]of t.reserved.costs)costs.set(currency,addDecimal(costs.get(currency)??{coefficient:0n,scale:0},cost));
  if(more.cost)costs.set(more.cost.currency,addDecimal(costs.get(more.cost.currency)??{coefficient:0n,scale:0},decimal(more.cost.amount)));
  if(costs.size){
    if(limits.maxCost===undefined||limits.currency===undefined)return fail('BUDGET_COST_LIMIT_REQUIRED');
    if([...costs.keys()].some(currency=>currency!==limits.currency))return fail('BUDGET_CURRENCY_MISMATCH');
    if(compareDecimal(costs.get(limits.currency)!,decimal(limits.maxCost))>0)return fail('BUDGET_COST_EXHAUSTED');
  }
}
function newRecord(events: BudgetRecord[],id: string,version: number,snapshot: Omit<BudgetRecord['snapshot'],'sequence'>): BudgetRecord {
  const value={...snapshot,sequence:events.length+1},record={ref:{id,version,contentHash:contentHash(canonicalJson(value))},snapshot:value};
  ledger([...events,record],snapshot.claim.projectId);return cloneV1(record);
}
/** 순수 예약 계획. DB 현재 정책/이력·행 잠금·원자 저장과 실제 실행 권한은 별도 소비자가 보장해야 한다. */
export function reserveExecutionBudget(events: BudgetRecord[],policy: CheckedPolicy,value: BudgetClaim,at: string): BudgetRecord {
  const claim=readClaim(value);checkedPolicy(policy,at,claim);const state=ledger(events,claim.projectId);
  if(Date.parse(at)<state.priorTime)return fail('BUDGET_TIME_CONFLICT',409);
  const original=state.firsts.get(claim.commandId);
  if(original){if(!same(original.snapshot.claim,claim))return fail('BUDGET_IDEMPOTENCY_CONFLICT',409);return cloneV1(original);}
  availability(state.heads,policy,claim,true);
  return newRecord(events,randomUUID(),1,{claim,state:'RESERVED',usage:null,previousRef:null,checkedAt:at,evidenceRef:null,executionAuthorized:false,dispatchPerformed:false});
}
/** 예약 해제는 전송 전 사실, 정산은 실제 완전 관측 ref를 호출자가 먼저 검증해야 한다. 추정/불명은 UNKNOWN이다. */
export function advanceExecutionBudget(events: BudgetRecord[],ref: VersionRef,next: BudgetState,evidence: {evidenceRef: VersionRef;usage: BudgetUnits|null},at: string): BudgetRecord {
  const state=ledger(events);if(!refV1(ref)||!isoV1(at)||!recordV1(evidence,['evidenceRef','usage'])||!refV1(evidence.evidenceRef))return fail('BUDGET_INPUT_INVALID',422);
  const previous=state.heads.get(ref.id);if(!previous||!same(previous.ref,ref))return fail('BUDGET_VERSION_CONFLICT',409);
  if(Date.parse(at)<state.priorTime)return fail('BUDGET_TIME_CONFLICT',409);
  if(!transitionAllowed(previous.snapshot.state,next)||next==='SETTLED'&&!unitsValid(evidence.usage)||next!=='SETTLED'&&evidence.usage!==null)return fail('BUDGET_TRANSITION_INVALID',422);
  const cost=previous.snapshot.claim.demand.cost;
  if(next==='SETTLED'&&(evidence.usage!.costStatus==='FINITE_CAP'||evidence.usage!.costStatus==='UNKNOWN'
    ||(evidence.usage!.costStatus==='VERIFIED_NO_CHARGE'?evidence.usage!.cost!==null:evidence.usage!.cost===null)
    ||cost&&(evidence.usage!.cost===null||evidence.usage!.costStatus!=='OBSERVED'||evidence.usage!.cost.currency!==cost.currency)))return fail('BUDGET_COST_OBSERVATION_REQUIRED');
  return newRecord(events,ref.id,ref.version+1,{...previous.snapshot,state:next,usage:next==='SETTLED'?cloneV1(evidence.usage):null,previousRef:cloneV1(ref),evidenceRef:cloneV1(evidence.evidenceRef),checkedAt:at});
}
export function inspectExecutionBudget(events: BudgetRecord[],policy: CheckedPolicy,at: string){
  const p=checkedPolicy(policy,at,undefined,false),t=summarize(ledger(events,policy.projectId).heads);
  return {used:totalView(t.used),reserved:totalView(t.reserved),liveExecutions:t.live.size,unknownReservations:t.unknown,policyIssues:p.issues,executionAuthorized:false as const,dispatchPerformed:false as const};
}
export function recheckExecutionBudgetDelivery(events: BudgetRecord[],policy: CheckedPolicy,ref: VersionRef,at: string): BudgetRecord {
  if(!refV1(ref))return fail('BUDGET_INPUT_INVALID',422);const state=ledger(events,policy.projectId),record=state.heads.get(ref.id);
  if(!record||!same(record.ref,ref))return fail('BUDGET_VERSION_CONFLICT',409);
  checkedPolicy(policy,at,record.snapshot.claim);if(Date.parse(at)<state.priorTime)return fail('BUDGET_TIME_CONFLICT',409);
  if(record.snapshot.state!=='RESERVED')return fail('BUDGET_DELIVERY_STATE_INVALID');availability(state.heads,policy,record.snapshot.claim,false);return cloneV1(record);
}

/** DB 현재성/잠금과 전체 이력을 소비하는 비실행 계획기. 결과는 저장·grant·wire permit이 아니다.
 * 후속 queue 소비자는 같은 transaction에서 원자적으로 명령/예약을 저장하고, wire 전 다시 검사해야 한다.
 */
export class ProjectExecutionBudget {
  readonly policies: Pick<ProjectLimitPolicies,'resolveCurrent'> & Partial<Pick<ProjectLimitPolicies,'read'>>;
  constructor(policies: Pick<ProjectLimitPolicies,'resolveCurrent'> & Partial<Pick<ProjectLimitPolicies,'read'>> = new ProjectLimitPolicies()){this.policies=policies;}
  /** 선택한 정책 원문과 서버 보관 원장만 조회한다. 현재 적용/가용성·실제 공급자 과금/실행 허가가 아니다. */
  async readUsage(db:PoolClient,actor:AuthenticatedIdentity,projectId:string,rawRef:VersionRef){
    if(!uuidV1(projectId)||!refV1(rawRef))return fail('BUDGET_INPUT_INVALID',422);const selected=cloneV1(rawRef);
    await projectMember(db,actor,projectId);if(typeof this.policies.read!=='function')return fail('BUDGET_POLICY_READER_UNAVAILABLE',503);
    const policy=await this.policies.read(db,actor,projectId,selected.id,selected.version);
    if(policy.projectId!==projectId||!same(policy.ref,selected)||contentHash(canonicalJson(policy.snapshot))!==selected.contentHash)return fail('BUDGET_POLICY_BINDING_INVALID',503);
    const events=await this.#read(db,projectId),observedAt=await this.#clock(db);if(events.some(e=>Date.parse(e.snapshot.checkedAt)>Date.parse(observedAt)))return fail('BUDGET_TIME_CONFLICT',503);
    const summary=inspectExecutionBudget(events,policy,observedAt);await projectMember(db,actor,projectId);
    return{projectId,policy:cloneV1(policy),summary,ledgerScope:'PROJECT_ALL_POLICIES' as const,ledgerRowCount:events.length,ledgerLastRef:events.at(-1)?.ref??null,observedAt,sourceAssurance:'SERVER_STORED_LEDGER_ONLY' as const,currentPolicyVerified:false as const,providerChargesVerified:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }
  async #lock(db: PoolClient,actor: AuthenticatedIdentity,projectId: string){
    if(!uuidV1(projectId))return fail('BUDGET_INPUT_INVALID',422);
    const member=await projectMember(db,actor,projectId,true);if(member.archived_at)return fail('PROJECT_ARCHIVED');
  }
  async #read(db: PoolClient,projectId: string): Promise<BudgetRecord[]> {
    const rows=(await db.query('SELECT project_id,reservation_id,version,content_hash,snapshot_json,server_sequence,command_id FROM anvil.usage_reservations WHERE project_id=$1 ORDER BY server_sequence LIMIT 10001',[projectId])).rows;
    if(rows.length>10000)return fail('BUDGET_LEDGER_BOUND_EXCEEDED');
    const events=rows.map(r=>{
      if(r.project_id!==projectId||Number(r.server_sequence)!==r.snapshot_json?.sequence||r.command_id!==r.snapshot_json?.claim?.commandId)return fail('BUDGET_LEDGER_INTEGRITY_FAILED',503);
      return {ref:{id:r.reservation_id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json} as BudgetRecord;
    });
    ledger(events,projectId);return events;
  }
  async #clock(db: PoolClient){
    const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
    if(!(at instanceof Date)||!Number.isFinite(at.getTime()))return fail('BUDGET_CLOCK_INVALID',503);return at.toISOString();
  }
  async planReservation(db: PoolClient,actor: AuthenticatedIdentity,value: BudgetClaim){
    const claim=readClaim(value);await this.#lock(db,actor,claim.projectId);
    const policy=await this.policies.resolveCurrent(db,actor,claim.projectId,claim.policyRef,{kind:'PROJECT',projectId:claim.projectId});
    const events=await this.#read(db,claim.projectId),checkedAt=await this.#clock(db),record=reserveExecutionBudget(events,policy,claim,checkedAt);
    return {record,policyRef:cloneV1(policy.ref),checkedAt,persisted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }
  async checkDelivery(db: PoolClient,actor: AuthenticatedIdentity,projectId: string,ref: VersionRef){
    if(!refV1(ref))return fail('BUDGET_INPUT_INVALID',422);await this.#lock(db,actor,projectId);
    const events=await this.#read(db,projectId),current=ledger(events,projectId).heads.get(ref.id);
    if(!current||!same(current.ref,ref))return fail('BUDGET_VERSION_CONFLICT',409);
    const policy=await this.policies.resolveCurrent(db,actor,projectId,current.snapshot.claim.policyRef,{kind:'PROJECT',projectId});
    const checkedAt=await this.#clock(db),record=recheckExecutionBudgetDelivery(events,policy,ref,checkedAt);
    return {record,policyRef:cloneV1(policy.ref),checkedAt,persisted:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }
}
