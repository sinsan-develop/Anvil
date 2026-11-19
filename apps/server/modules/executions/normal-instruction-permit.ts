import {readNormalPermitRequestV1,normalSendPermitSourceEligible,type NormalPermitRequestV1} from '../../../../contracts/runtime/normal-send-permit-source-v1.ts';
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {readNormalInstructionFact,readNormalInstructionRecord,type NormalInstructionCurrentSource} from './normal-instruction-command.ts';
import {NormalInstructionSource,readRegisteredInstructionBody} from './normal-instruction-source.ts';
import {recheckExecutionBudgetDelivery} from './execution-budget.ts';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {executionFactChecks} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionTarget,verifyNormalCommandPageProof} from './execution-proof.ts';
import {original,readCurrent} from './normal-exchange-challenge.ts';
import {normalRequestBearerDigest,requestCredential} from './normal-request-challenge.ts';

/** normal SEND 명령별 단발 허가. 외부 관측은 거래 밖이며 SDK 실행을 수행하지 않는다. */
function deny(code='EXECUTION_PERMIT_REJECTED',status=412):never{throw new AuthFailure(code,status);}
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
type Request=NormalPermitRequestV1;
type FactScope={projectId:string;executionId:string;executionGeneration:number;grantRef:Ref;instructionRef:Ref;partsRef:Ref;commandId:string;envelopeHash:string;observedAt:string};
export interface NormalInstructionPermitOptions{pool:Pick<Pool,'connect'>;current?:NormalInstructionCurrentSource;source:NormalInstructionSource}
const receiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','commandRef','envelopeHash','requestHash','observedAt','expiresAt'];
const permitKeys=['scope','commandId','commandRef','request','requestHash','proofRef','authorizationReceiptRef','bindingHash','currentFact','reservationRef','state','issuedAt','expiresAt','commandExpiresAt','grantExpiresAt','proofExpiresAt','executionAuthorized','dispatchPerformed'];

function readRequest(raw:unknown):Request{try{const request=readNormalPermitRequestV1(raw);if(request.localAttemptRef.version!==1)throw Error();return request;}catch{return deny('INPUT_INVALID',400);}}
async function boundedFact(source:NormalInstructionCurrentSource,scope:FactScope,outer:AbortSignal){
 const controller=new AbortController(),until=performance.now()+2000,observe=source.observe;let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=()=>controller.abort();outer.addEventListener('abort',stop,{once:true});
 try{
  if(outer.aborted||typeof observe!=='function')deny('EXECUTION_PERMIT_CURRENT_REQUIRED');
  const {commandId:_,envelopeHash:__,observedAt,...target}=scope;
  const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AuthFailure('EXECUTION_PERMIT_CURRENT_TIMEOUT',503)),2000);});
  const raw=await Promise.race([timeout,observe.call(source,Object.freeze(cloneV1(target)),observedAt,controller.signal)]);
  if(source.observe!==observe||outer.aborted||performance.now()>=until)deny('EXECUTION_PERMIT_CURRENT_TIMEOUT',503);
  if(!recordV1(raw,['fact','turnState','stageRef','demand','checkedAt','expiresAt'])||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt))deny('EXECUTION_PERMIT_CURRENT_INVALID');
  return cloneV1(raw);
 }finally{clearTimeout(timer);outer.removeEventListener('abort',stop);controller.abort();}
}
const stable=(f:any)=>{const {checkedAt:_,checks:__,expires:___,writerState:____,...rest}=f;return rest;};
function checkFact(raw:any,b:any,e:DispatchEnvelopeV1,request:Request,now:Date,grantBinding:unknown,record:any){
 const f=readNormalInstructionFact(raw?.fact),at=now.getTime(),s=record.snapshot;
 if(raw.turnState!=='IDLE'||!isoV1(raw.checkedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.checkedAt)>at||at-Date.parse(raw.checkedAt)>30000||Date.parse(raw.expiresAt)<=at||
  !same(stable(f),stable(grantBinding))||!same(stable(f),stable({...s.currentBinding.fact,checkedAt:s.queuedAt}))||f.writerState!=='OWNED'||
  f.projectId!==b.projectId||f.executionId!==b.executionId||f.executionGeneration!==b.executionGeneration||f.registration.connectorId!==b.connectorId||f.registration.hostPublicKeyFingerprint!==b.publicKeyFingerprint||
  executionFactChecks.some(n=>n!=='understanding'&&f.checks[n].state!=='VERIFIED_CURRENT')||Date.parse(f.checkedAt)>at||at-Date.parse(f.checkedAt)>30000||
  f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||f.intent.mode==='CONTEXT_REVIEW'&&f.intent.sourceScopes.some(s=>s.targets.some(t=>t.access!=='READ'))||
  !same(e.context.budgetRef,s.reservationRef)||!same(e.executorRegistrationRef,f.registration.ref)||!same((e.payload as any).sessionBindingRef,f.agentSession.sessionRef))deny('EXECUTION_PERMIT_CURRENT_AUTHORITY_REQUIRED');
 if(request.representation&&!normalSendPermitSourceEligible(f))deny('EXECUTION_PERMIT_REPRESENTATION_REJECTED');
 const refs=[...new Map(f.intent.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()];
 if(!same(refs,request.sourceObservationRefs)||!f.checks.osFence.evidenceRefs.some(r=>same(r,request.osOwnershipRef)))deny('EXECUTION_PERMIT_SOURCE_OS_MISMATCH');
 return f;
}
export function readNormalInstructionPermitLedger(raw:unknown,scope:any,now:string):any[]{
 const bad=():never=>deny('INSTRUCTION_PERMIT_LEDGER_INVALID');
 if(!recordV1(scope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||scope.mode!=='EXECUTION'||![scope.projectId,scope.connectorId,scope.executionId].every(uuidV1)||!refV1(scope.grantRef)||![scope.executionGeneration,scope.credentialGeneration].every(x=>Number.isSafeInteger(x)&&x>0)||!isoV1(now)||!recordV1(raw,['complete','permits'])||raw.complete!==true||!arrayV1(raw.permits,50)||Buffer.byteLength(canonicalJson(raw))>2097152) return bad();
 const ids=new Set(),commands=new Set(),proofs=new Set();
 for(const r of raw.permits){const s=r?.snapshot;
  if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||ids.has(r.ref.id)||r.ref.contentHash!==digest(s)||!recordV1(s,permitKeys)||s.state!=='NORMAL_INSTRUCTION_PERMITTED'||s.executionAuthorized!==true||s.dispatchPerformed!==false||![s.commandRef,s.proofRef,s.reservationRef,s.authorizationReceiptRef].every(refV1)||!uuidV1(s.commandId)||commands.has(s.commandId)||proofs.has(canonicalJson(s.proofRef))||!same(s.scope,scope)||![s.issuedAt,s.expiresAt,s.commandExpiresAt,s.grantExpiresAt,s.proofExpiresAt].every(isoV1)||Date.parse(s.issuedAt)>Date.parse(now)||Date.parse(s.expiresAt)<=Date.parse(s.issuedAt)||Date.parse(s.expiresAt)>Math.min(Date.parse(s.issuedAt)+30000,Date.parse(s.commandExpiresAt),Date.parse(s.grantExpiresAt),Date.parse(s.proofExpiresAt)))return bad();
  const request=readRequest(s.request),f=readNormalInstructionFact(s.currentFact),{checkedAt:_,expires:__,...fact}=f;
  if(s.requestHash!==digest(request)||s.bindingHash!==digest({scope,commandRef:s.commandRef,authorizationReceiptRef:s.authorizationReceiptRef,reservationRef:s.reservationRef,fact})||f.projectId!==scope.projectId||f.executionId!==scope.executionId||f.executionGeneration!==scope.executionGeneration||f.registration.connectorId!==scope.connectorId||f.executionCredentialReservation.generation!==scope.credentialGeneration||f.writerState!=='OWNED'||executionFactChecks.some(n=>n!=='understanding'&&f.checks[n].state!=='VERIFIED_CURRENT')||Date.parse(f.checkedAt)>Date.parse(s.issuedAt)||Date.parse(s.issuedAt)-Date.parse(f.checkedAt)>30000||Date.parse(s.expiresAt)>Math.min(Date.parse(f.checkedAt)+30000,...Object.values(f.expires).map(Date.parse)))return bad();
  if(request.representation&&!normalSendPermitSourceEligible(f))return bad();
  const sourceRefs=[...new Map(f.intent.sourceScopes.map(x=>[canonicalJson(x.observationRef),x.observationRef])).values()];
  if([s.commandRef,s.proofRef,s.reservationRef,s.authorizationReceiptRef].some(x=>x.version!==1)||!same(sourceRefs,request.sourceObservationRefs)||!f.checks.osFence.evidenceRefs.some(x=>same(x,request.osOwnershipRef))||f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||f.intent.mode==='CONTEXT_REVIEW'&&f.intent.sourceScopes.some(x=>x.targets.some(t=>t.access!=='READ')))return bad();
  ids.add(r.ref.id);commands.add(s.commandId);proofs.add(canonicalJson(s.proofRef));
 }
 return cloneV1(raw.permits);
}
async function ownBudget(db:PoolClient,pid:string,connector:string,execution:string,proof:any,record:any,now:Date,observation:any){
 const g=proof.grantRef,c=(await db.query('SELECT * FROM anvil.normal_exchange_current($1,$2,$3,$4,$5,$6,$7)',[pid,connector,execution,g.id,g.version,g.contentHash,proof.credentialGeneration])).rows;
 if(c.length!==1||c[0].budget_policy?.projectId!==pid||digest(c[0].budget_policy.snapshot)!==c[0].budget_policy.ref?.contentHash)deny();
 const rows=(await db.query('SELECT project_id,reservation_id,version,content_hash,snapshot_json,server_sequence,command_id FROM anvil.usage_reservations WHERE project_id=$1 ORDER BY server_sequence LIMIT 10001',[pid])).rows;
 if(rows.length>10000)deny();const ledger=rows.map(r=>{if(r.project_id!==pid||Number(r.server_sequence)!==r.snapshot_json?.sequence||r.command_id!==r.snapshot_json?.claim?.commandId)deny();return{ref:{id:r.reservation_id,version:Number(r.version),contentHash:r.content_hash},snapshot:r.snapshot_json};});
 const s=record.snapshot,r=recheckExecutionBudgetDelivery(ledger,c[0].budget_policy,s.reservationRef,now.toISOString()),claim=r.snapshot.claim,f=s.currentBinding.fact;
 if(claim.operation!=='SEND_INSTRUCTION'||claim.commandId!==s.request.commandId||claim.projectId!==pid||claim.executionId!==execution||claim.executionGeneration!==s.scope.executionGeneration||!same(claim.policyRef,f.intent.budgetPolicyRef)||!same(claim.assignmentRef,f.intent.assignmentRef)||claim.demand.attempts!==0||claim.demand.calls<1||s.reservationRef.id===f.budgetReservationRef.id||observation&&(!same(claim.stageRef,observation.stageRef)||!same(claim.demand,observation.demand)))deny('INSTRUCTION_PERMIT_RESERVATION_INVALID');return r;
}
async function instructionBody(o:NormalInstructionPermitOptions,db:PoolClient,token:string,connector:string,execution:string,proof:any,record:any){
 const source=o.source;
 if(!source||types.isProxy(source)||Object.getPrototypeOf(source)!==NormalInstructionSource.prototype||source.readRegistered!==readRegisteredInstructionBody||NormalInstructionSource.prototype.readRegistered!==readRegisteredInstructionBody)deny('EXECUTION_PERMIT_SOURCE_REQUIRED');
 const body=await readRegisteredInstructionBody.call(source,db,token,connector,execution,proof,record.snapshot.request.commandId,record.snapshot.currentBinding.materialManifestRef);
 if(o.source!==source||source.readRegistered!==readRegisteredInstructionBody||NormalInstructionSource.prototype.readRegistered!==readRegisteredInstructionBody)deny('EXECUTION_PERMIT_SOURCE_REQUIRED');return body;
}
async function readCommand(db:PoolClient,pid:string,execution:string,g:Ref,generation:number,command:string,now:Date){
 const rows=(await db.query('SELECT * FROM anvil.normal_instruction_record($1,$2,$3,$4)',[pid,execution,generation,command])).rows;
 if(rows.length!==1||rows[0].valid!==true)deny('EXECUTION_PERMIT_COMMAND_NOT_FOUND',404);
 const record=readNormalInstructionRecord({ref:rows[0].result_ref?.data?.ref,snapshot:rows[0].snapshot_json},{projectId:pid,executionId:execution,executionGeneration:generation}),e=readDispatchEnvelopeV1(record.snapshot.envelope,now.getTime());
 if(e.operation!=='SEND_INSTRUCTION'||e.commandId!==command||!same(record.snapshot.currentBinding.grantRef,g))deny();return{commandRef:record.ref,envelope:e,record};
}
type Packet={schemaVersion:1;challengeRef:Ref;proof:any;signature:string};
async function issue(o:NormalInstructionPermitOptions,connector:string,execution:string,command:string,tokenDigest:string,frame:Packet,
 target:ReturnType<typeof executionTarget>,request:Request,signal:AbortSignal,pre?:{scope:FactScope;fact:unknown}){
 const db=await o.pool.connect(),proof=frame.proof,g=proof.grantRef,c=frame.challengeRef;
 let committing=false,discard:Error|undefined;
 try{
  await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'");
  const cred=await requestCredential(db,tokenDigest,connector,execution,proof),pid=cred.project,keys=[pid,g.id,g.version];
  const current=await readCurrent(db,pid,connector,execution,proof),b=current.binding;
  const rows=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=1 AND content_hash=$5',[...keys,c.id,c.contentHash])).rows;
  if(rows.length!==1)deny();
  const old=rows[0],ch=original(old,b,'EXECUTION_REQUEST',cred.ref).challenge,at=current.now.getTime();
  if(!same(old.snapshot_json.request.target,target)||at<Date.parse(ch.issuedAt))deny();
  verifyNormalCommandPageProof(current.spki,frame.signature,proof,b,ch,target);
  const end=Math.min(cred.expiresAt,current.deadline.getTime(),Date.parse(ch.expiresAt));
  if(at>=end||signal.aborted)deny();
  const packetHash=digest({frame,target}),requestHash=digest(request);
  const previous=(await db.query(`SELECT v.content_hash AS vhash,v.snapshot_json AS consumed,r.id,r.content_hash,r.snapshot_json AS receipt
   FROM anvil.execution_challenges v LEFT JOIN anvil.execution_receipts r ON r.project_id=v.project_id AND r.challenge_id=v.id
   WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3 AND v.id=$4 AND v.version=2`,[...keys,c.id])).rows;
  if(previous.length>1)deny();
  const prior=previous[0],s=prior?.receipt;
  const m=await readCommand(db,pid,execution,g,b.executionGeneration,command,current.now);
  if(m.envelope.envelopeHash!==request.envelopeHash)deny('EXECUTION_PERMIT_COMMAND_BINDING_INVALID');
  const permitScope={mode:'EXECUTION',projectId:pid,connectorId:connector,executionId:execution,executionGeneration:b.executionGeneration,grantRef:cloneV1(g),credentialGeneration:b.credentialGeneration};
  const all=(await db.query('SELECT id,content_hash,snapshot_json,proof_result_id FROM anvil.execution_instruction_permits WHERE project_id=$1 AND execution_id=$2 AND generation=$3 ORDER BY id LIMIT 51',[pid,execution,b.executionGeneration])).rows;
  const ledger=readNormalInstructionPermitLedger({complete:true,permits:all.map(r=>({ref:{id:r.id,version:1,contentHash:r.content_hash},snapshot:r.snapshot_json}))},permitScope,current.now.toISOString()),existing=all.filter(r=>r.snapshot_json.commandId===command);
  const scope:FactScope={projectId:pid,executionId:execution,executionGeneration:b.executionGeneration,grantRef:cloneV1(g),instructionRef:m.record.snapshot.currentBinding.instructionRef,partsRef:m.record.snapshot.currentBinding.partsRef,commandId:command,envelopeHash:m.envelope.envelopeHash,observedAt:current.now.toISOString()};
  if(typeof o.current?.observe!=='function')deny('EXECUTION_PERMIT_CURRENT_REQUIRED');
  if(!pre){await db.query('ROLLBACK');return {needFact:scope} as const;}
  if(!same({...pre.scope,observedAt:scope.observedAt},scope))deny('EXECUTION_PERMIT_CURRENT_CHANGED');
  const grants=(await db.query('SELECT snapshot_json FROM anvil.execution_grants WHERE project_id=$1 AND id=$2 AND version=$3 AND content_hash=$4',[pid,g.id,g.version,g.contentHash])).rows;
  if(grants.length!==1||grants[0].snapshot_json?.transport!=='NORMAL_PROTECTED'||digest(grants[0].snapshot_json)!==g.contentHash)deny();
  const f=checkFact(pre.fact,b,m.envelope,request,current.now,grants[0].snapshot_json.binding,m.record);
  const reservation=await ownBudget(db,pid,connector,execution,proof,m.record,current.now,pre.fact),body=await instructionBody(o,db,tokenDigest,connector,execution,proof,m.record);
  if(prior){
   // 같은 packet 재조회: 현재 보호 근거를 재검산하고 원 영수증과 permit만 반환한다. 새 기록은 없다.
   if(!s||!uuidV1(prior.id)||prior.content_hash!==digest(s)||prior.vhash!==digest(prior.consumed)||!same(prior.consumed,{...old.snapshot_json,sequence:prior.consumed.sequence,previousRef:c,
     consumption:{consumedAt:s.observedAt,resultRef:{id:prior.id,version:1,contentHash:prior.content_hash},packetHash:s.packetHash}})||
    !recordV1(s,receiptKeys)||s.kind!=='NORMAL_INSTRUCTION_PERMIT'||!same(s.binding,b)||!same(s.credentialRef,cred.ref)||!same(s.challengeRef,c))deny();
   if(s.packetHash!==packetHash||!same(s.target,target)||s.requestId!==proof.requestId||s.requestHash!==requestHash)deny('IDEMPOTENCY_CONFLICT',409);
   if(!same(s.commandRef,m.commandRef)||s.envelopeHash!==request.envelopeHash||!isoV1(s.observedAt)||!isoV1(s.expiresAt)||Date.parse(s.observedAt)<Date.parse(ch.issuedAt)||Date.parse(s.expiresAt)<=Date.parse(s.observedAt)||Date.parse(s.expiresAt)>Math.min(Date.parse(ch.expiresAt),Date.parse(m.envelope.expiresAt)))deny();
   const row=existing[0],ps=row?.snapshot_json;
   if(!row||row.proof_result_id!==prior.id||row.content_hash!==digest(ps)||!recordV1(ps,permitKeys)||ps.state!=='NORMAL_INSTRUCTION_PERMITTED'||ps.commandId!==command||
     !same(ps.proofRef,{id:prior.id,version:1,contentHash:prior.content_hash})||Date.parse(ps.expiresAt)<=at)deny('EXECUTION_PERMIT_EXPIRED');
   if(ps.issuedAt!==s.observedAt||ps.expiresAt!==s.expiresAt||!same(ps.commandRef,m.commandRef)||!same(ps.request,request)||!same(ps.reservationRef,reservation.ref)||!same(ps.authorizationReceiptRef,m.envelope.context.authorizationReceiptRef)||!same(stable(ps.currentFact),stable(f)))deny();
   const replayLast=await readCurrent(db,pid,connector,execution,proof);if(!same(replayLast.binding,b)||replayLast.now<current.now||replayLast.now.getTime()>=Date.parse(ps.expiresAt)||signal.aborted)deny();
   await db.query('ROLLBACK');
   return {out:respond({id:prior.id,version:1,contentHash:prior.content_hash},{id:row.id,version:1,contentHash:row.content_hash},ps)} as const;
  }
  if(existing.length)deny('EXECUTION_PERMIT_ALREADY_ISSUED',409);
  if(ledger.length>=50)deny('INSTRUCTION_PERMIT_LIMIT',429);
  const expires=Math.min(end,at+30000,Date.parse(m.envelope.expiresAt),Date.parse((pre.fact as any).expiresAt),Date.parse(f.checkedAt)+30000,...Object.values(f.expires).map(v=>Date.parse(v)));
  if(expires<=at)deny('EXECUTION_PERMIT_EXPIRED');
  const issuedAt=current.now.toISOString(),expiresAt=new Date(expires).toISOString();
  const receipt={kind:'NORMAL_INSTRUCTION_PERMIT',binding:b,credentialRef:cred.ref,challengeRef:c,packetHash,target,requestId:proof.requestId,commandRef:m.commandRef,
   envelopeHash:m.envelope.envelopeHash,requestHash,observedAt:issuedAt,expiresAt};
  const receiptRef={id:randomUUID(),version:1,contentHash:digest(receipt)};

  const {checkedAt:_checked,expires:_expires,...factBinding}=f;
  const permit={scope:permitScope,commandId:command,commandRef:m.commandRef,request,requestHash,proofRef:receiptRef,authorizationReceiptRef:m.envelope.context.authorizationReceiptRef,reservationRef:reservation.ref,
   bindingHash:digest({scope:permitScope,commandRef:m.commandRef,authorizationReceiptRef:m.envelope.context.authorizationReceiptRef,reservationRef:reservation.ref,fact:factBinding}),
   currentFact:f,state:'NORMAL_INSTRUCTION_PERMITTED',issuedAt,expiresAt,commandExpiresAt:m.envelope.expiresAt,grantExpiresAt:grants[0].snapshot_json.expiresAt,proofExpiresAt:ch.expiresAt,executionAuthorized:true,dispatchPerformed:false};
  const permitRef={id:randomUUID(),version:1,contentHash:digest(permit)};
  readNormalInstructionPermitLedger({complete:true,permits:[...ledger,{ref:permitRef,snapshot:permit}]},permitScope,issuedAt);
  const seq=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
  if(!Number.isSafeInteger(seq)||seq<2||seq>20000)deny();
  const v2={...old.snapshot_json,sequence:seq,previousRef:c,consumption:{resultRef:receiptRef,packetHash,consumedAt:issuedAt}};
  // 0097은 기존 normal nonce 소비와 SEND 전용 영수증/permit의 동일 거래 완결을 검산한다.
  await db.query("SELECT set_config('anvil.normal_page_verified',txid_current()::text||':'||$1||':'||$2,true)",[receiptRef.contentHash,tokenDigest]);
  await db.query("SELECT set_config('anvil.normal_instruction_permit_verified',txid_current()::text||':'||$1||':'||$2,true)",[receiptRef.contentHash,tokenDigest]);
  if((await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,2,$3,$4,$5,$6,$7)',[pid,c.id,g.id,g.version,seq,digest(v2),JSON.stringify(v2)])).rowCount!==1)deny();
  if((await db.query('INSERT INTO anvil.execution_receipts(project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,1,$6,$7)',[pid,receiptRef.id,g.id,g.version,c.id,receiptRef.contentHash,JSON.stringify(receipt)])).rowCount!==1)deny();
  if((await db.query('INSERT INTO anvil.execution_instruction_permits(project_id,execution_id,generation,id,version,command_id,command_record_id,command_record_version,grant_id,grant_version,reservation_id,reservation_version,proof_result_id,proof_result_version,envelope_hash,content_hash,snapshot_json) VALUES($1,$2,$3,$4,1,$5,$6,1,$7,$8,$9,1,$10,1,$11,$12,$13)',
   [pid,execution,b.executionGeneration,permitRef.id,command,m.commandRef.id,g.id,g.version,reservation.ref.id,receiptRef.id,m.envelope.envelopeHash,permitRef.contentHash,JSON.stringify(permit)])).rowCount!==1)deny();
  // 마지막 await 뒤 credential·현재 권위·명령이 그대로인지 다시 확인한 뒤에만 확정한다.
  const lastCred=await requestCredential(db,tokenDigest,connector,execution,proof),last=await readCurrent(db,pid,connector,execution,proof);
  const again=await readCommand(db,pid,execution,g,b.executionGeneration,command,last.now);
  if(!same(lastCred,cred)||!same(last.binding,b)||last.spki!==current.spki||last.now<current.now||signal.aborted||!same(again,m)||
    last.deadline.getTime()<expires||last.now.getTime()>=expires)deny();
  await ownBudget(db,pid,connector,execution,proof,again.record,last.now,pre.fact);
  if(await instructionBody(o,db,tokenDigest,connector,execution,proof,again.record)!==body)deny('EXECUTION_PERMIT_CURRENT_CHANGED');
  const endAt=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
  if(!(endAt instanceof Date)||!Number.isFinite(endAt.getTime())||endAt<last.now||endAt.getTime()>=expires||signal.aborted)deny();
  checkFact(pre.fact,last.binding,again.envelope,request,endAt,grants[0].snapshot_json.binding,again.record);
  const response=respond(receiptRef,permitRef,permit);
  committing=true;
  if((await db.query('COMMIT')).command!=='COMMIT')throw Error();
  committing=false;return {out:response} as const;
 }catch(error){
  if(committing)discard=new Error('EXECUTION_PERMIT_COMMIT_UNKNOWN');
  try{await db.query('ROLLBACK');}catch{discard??=new Error('EXECUTION_PERMIT_ROLLBACK_UNKNOWN');}
  if(committing)deny('EXECUTION_PERMIT_COMMIT_UNKNOWN',503);
  throw error;
 }finally{db.release(discard);}
}
function respond(proofResultRef:Ref,permitRef:Ref,p:any){
 const response={transport:'NORMAL_PROTECTED',proofResultRef,permit:{ref:permitRef,commandId:p.commandId,envelopeHash:p.request.envelopeHash,issuedAt:p.issuedAt,expiresAt:p.expiresAt},
  cacheControl:'no-store',nonceConsumed:true,executionAuthorized:true,dispatchPerformed:false,
  ...(p.request.representation?{executionAuthority:{kind:'NORMAL_SEND_PERMIT_SOURCE_V1',permitSnapshot:cloneV1(p)}}:{})};
 if(Buffer.byteLength(canonicalJson(response))>2097152)deny('EXECUTION_PERMIT_RESPONSE_LIMIT',413);return response;
}

/** 호출자는 기존 normal HTTP parser를 통과한다. 이 함수도 DB credential/서명/원 명령을 다시 검산한다. */
export async function consumeNormalInstructionPermit(o:NormalInstructionPermitOptions,connector:string,execution:string,command:string,token:string,frame:Packet,target:ReturnType<typeof executionTarget>,raw:unknown,signal:AbortSignal){
 const request=readRequest(raw),first=await issue(o,connector,execution,command,token,frame,target,request,signal);
 if('out'in first)return first.out;
 const source=o.current!,observe=source.observe,fact=await boundedFact(source,first.needFact,signal);
 if(o.current!==source||source.observe!==observe)deny('EXECUTION_PERMIT_CURRENT_CHANGED');
 const second=await issue(o,connector,execution,command,token,frame,target,request,signal,{scope:first.needFact,fact});
 if(!('out'in second))deny('EXECUTION_PERMIT_CURRENT_CHANGED');return second.out;
}
