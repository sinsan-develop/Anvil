import type {Pool,PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,recordV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readOwnershipEventV1,readOwnershipHeadV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipPreparationReceiptBasis} from './ownership-preparation-receipt.ts';
import {planOwnershipObservationRequest} from './ownership-request-event.ts';

export interface SyntheticOwnershipPreparationEvidence {
 transport:'SYNTHETIC_ONLY';
 current(db:PoolClient,scope:unknown,preparationRef:unknown):Promise<unknown>;
}
const fail=():never=>{throw new AuthFailure('OWNERSHIP_REQUEST_ISSUER_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
function event(row:any,scope:any){
 if(!row||row.project_id!==scope.projectId||row.execution_id!==scope.executionId||Number(row.execution_generation)!==scope.executionGeneration)return fail();
 const v=readOwnershipEventV1({ref:{id:row.event_id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json});
 if(!same(v.snapshot.scope,scope)||Number(row.sequence)!==v.snapshot.sequence)return fail();return v;
}
function inputs(value:unknown,scope:any,prep:any,now:number){
 const v=cloneV1(value),p=prep.snapshot;
 if(!recordV1(v,['purpose','transport','scope','preparationRef','writer','candidate','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'])||v.purpose!=='OWNERSHIP_SYNTHETIC_PREPARED_INPUTS'||v.transport!=='SYNTHETIC_ONLY'||!same(v.scope,scope)||!same(v.preparationRef,prep.ref)||v.executionAuthorized!==false||v.dispatchPerformed!==false||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>now||now-Date.parse(v.checkedAt)>1000||Date.parse(v.expiresAt)<=now)return fail();
 const w=v.writer,c=v.candidate;
 // 합성 NONE은 실제 writer 부재/실회수 증명이 아니다. 일반 NONE을 수용하지 않는다.
 if(!recordV1(w,['claim','generation','evidenceRef','predecessorRef','reclaimRef'])||w.claim!=='SYNTHETIC_NONE'||!positive(w.generation)||!refV1(w.evidenceRef)||!((w.predecessorRef===null&&w.reclaimRef===null)||(refV1(w.predecessorRef)&&refV1(w.reclaimRef))))return fail();
 if(!recordV1(c,['anchor','sourceRef','rootId','hostHash','workerHash','runId','processGeneration'])||!refV1(c.sourceRef)||!['rootId','hostHash','workerHash','runId','processGeneration'].every(k=>same(c[k],p.payload[k])))return fail();
 return v;
}
/** 기본 미등록 합성 source. 실제 provider/provenance·OS·송신 권한을 만들지 않는다.
 * 미적용 SQL의 활성화/서버 COMMIT 기한 보장은 별도 미완료다. REQUIRE_APPROVAL은 기존 reader에서 거절한다. */
export class SyntheticPgOwnershipRequestIssuer {
 private pool:Pick<Pool,'connect'>;private access:AccessRepository;private evidence:SyntheticOwnershipPreparationEvidence|null;
 constructor(pool:Pick<Pool,'connect'>,access:AccessRepository,evidence:SyntheticOwnershipPreparationEvidence|null=null){this.pool=pool;this.access=access;this.evidence=evidence;}
 async issue(token:string,csrf:string,scopeValue:unknown,inputValue:unknown,signal?:AbortSignal){
  const port=this.evidence,access=this.access,current=port?.current;
  let db:PoolClient|undefined,begun=false,commitAttempted=false,committed=false,discard=false;
  const stable=()=>{if(signal?.aborted||this.evidence!==port||this.access!==access||port?.transport!=='SYNTHETIC_ONLY'||port.current!==current)return fail();};
  try{
   if(!port||port.transport!=='SYNTHETIC_ONLY'||typeof current!=='function')return fail();stable();
   const scope=cloneV1(scopeValue),input=cloneV1(inputValue);
   if(!recordV1(input,['preparationRef','expectedTailRef','expectedHeadRef'])||!refV1(input.preparationRef)||!refV1(input.expectedTailRef)||(input.expectedHeadRef!==null&&!refV1(input.expectedHeadRef)))return fail();
   if(!recordV1(scope,['installationId','projectId','executionId','executionGeneration'])||access.installationId!==scope.installationId)return fail();
   db=await this.pool.connect();stable();
   const query=async(sql:string,args:any[]=[])=>{stable();const r=await db!.query(sql,args);stable();return r;};
   begun=true;await query('BEGIN');
   await query("SET LOCAL statement_timeout='10000ms'");await query("SET LOCAL lock_timeout='2000ms'");
   const read=async()=>{stable();const r=await readOwnershipPreparationReceiptBasis(db!,access,token,csrf,scope,input.preparationRef);stable();return r;};
   const first=await read();
   const prep=event((await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 AND event_id=$4 AND version=$5',[scope.projectId,scope.executionId,scope.executionGeneration,input.preparationRef.id,input.preparationRef.version])).rows[0],scope);
   if(!same(prep.ref,input.preparationRef)||prep.snapshot.kind!=='PREPARATION_GRANTED')return fail();
   const slot=async()=>{const row=(await query("SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND kind='PREPARATION_GRANTED' ORDER BY project_sequence DESC LIMIT 1",[scope.projectId])).rows[0];if(!same(event(row,scope).ref,prep.ref))return fail();};
   const tail=async()=>event((await query('SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 ORDER BY sequence DESC LIMIT 1',[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0],scope);
   await slot();const prior=await tail();if(!same(prior.ref,input.expectedTailRef))return fail();
   const h=(await query('SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE',[scope.projectId,scope.executionId,scope.executionGeneration])).rows[0];
   const head=h?readOwnershipHeadV1({ref:{id:h.id,version:Number(h.head_generation),contentHash:h.content_hash},snapshot:h.snapshot_json}):null;
   if(!same(head?.ref??null,input.expectedHeadRef))return fail();
   const getInputs=async(floor:number)=>{stable();const raw=await current!.call(port,db!,scope,prep.ref);stable();const clock=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;if(!(clock instanceof Date)||!Number.isFinite(clock.getTime())||clock.getTime()<floor)return fail();return{value:inputs(raw,scope,prep,clock.getTime()),now:clock.getTime()};};
   const observedRead=await getInputs(Date.parse(first.checkedAt)),observed=observedRead.value;
   const plan=planOwnershipObservationRequest({preparation:prep,tail:prior,anchor:observed.candidate.anchor,head,authorityExpiresAt:new Date(Math.min(Date.parse(first.expiresAt),Date.parse(observed.expiresAt))).toISOString(),nowMs:observedRead.now});
   const n=Number((await query('SELECT COALESCE(MAX(project_sequence),0)+1 AS next_sequence FROM anvil.execution_ownership_events WHERE project_id=$1',[scope.projectId])).rows[0]?.next_sequence);
   if(!positive(n))return fail();
   const e=plan.event;
   const inserted=await query('INSERT INTO anvil.execution_ownership_events(project_id,execution_id,execution_generation,event_id,version,sequence,project_sequence,content_hash,snapshot_json,candidate_anchor_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)',[scope.projectId,scope.executionId,scope.executionGeneration,e.ref.id,e.ref.version,e.snapshot.sequence,n,e.ref.contentHash,canonicalJson(e.snapshot),plan.candidateAnchor===null?null:canonicalJson(plan.candidateAnchor)]);
   if(inserted.rowCount!==1)return fail();
   const last=await read();
   for(const k of ['scope','subject','preparationRef','policyRef','registrationRef','publicKeySpki','approvalRequired','intentRef','commandRef','authorizationReceiptRef','auditRef','approvalState'] as const)if(!same(first[k],last[k]))return fail();
   if(Date.parse(last.checkedAt)<observedRead.now)return fail();
   const finalRead=await getInputs(Date.parse(last.checkedAt)),finalInputs=finalRead.value;
   if(!same(observed.writer,finalInputs.writer)||!same(observed.candidate,finalInputs.candidate)||Date.parse(finalInputs.checkedAt)<Date.parse(observed.checkedAt))return fail();
   const deadline=Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt),Date.parse(observed.expiresAt),Date.parse(finalInputs.expiresAt),Date.parse(plan.request.expiresAt));
   if(Date.parse(plan.request.expiresAt)>deadline)return fail();
   await slot();if(!same((await tail()).ref,e.ref))return fail();
   // 보수적인 client elapsed 경계일 뿐 실제 PG deferred COMMIT 기한 보장은 아니다.
   const mark=performance.now();const clock=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;
   if(!(clock instanceof Date)||!Number.isFinite(clock.getTime())||clock.getTime()<finalRead.now||clock.getTime()-Date.parse(finalInputs.checkedAt)>1000||clock.getTime()>=deadline)return fail();
   commitAttempted=true;await query('COMMIT');committed=true;begun=false;
   if(clock.getTime()+Math.ceil(performance.now()-mark)>=deadline){discard=true;throw new AuthFailure('OWNERSHIP_REQUEST_COMMIT_UNKNOWN',412);}
   return{purpose:'SYNTHETIC_OWNERSHIP_REQUEST_COMMIT_ONLY' as const,event:cloneV1(e),request:cloneV1(plan.request),missingEvidence:['VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE'] as const,preparationAuthorized:false as const,observationRequestAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch{
   if(commitAttempted){discard=true;throw new AuthFailure('OWNERSHIP_REQUEST_COMMIT_UNKNOWN',412);}
   if(db&&begun&&!committed){try{await db.query('ROLLBACK');}catch{discard=true;throw new AuthFailure('OWNERSHIP_REQUEST_ROLLBACK_UNCONFIRMED',412);}}
   return fail();
  }finally{if(db){try{db.release(discard);}catch{throw new AuthFailure(commitAttempted?'OWNERSHIP_REQUEST_COMMIT_UNKNOWN':'OWNERSHIP_REQUEST_RELEASE_UNCONFIRMED',412);}}}
 }
}
