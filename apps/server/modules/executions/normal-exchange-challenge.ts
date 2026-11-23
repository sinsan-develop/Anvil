import type {NormalUnderstandingReadAcquisition} from './normal-understanding-read-acquisition.ts';
import type {NormalUnderstandingReadResult} from './normal-understanding-read-result.ts';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {TextDecoder} from 'node:util';
import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {recheckExecutionBudgetDelivery} from './execution-budget.ts';
import {canonicalBase64} from '../connections/registration-proof.ts';
import {executionChallengeRequestBytes,verifyNormalExchangeRequest,verifyNormalCommandChallengeRequest,normalUnderstandingRangeChallengeBytes,verifyNormalUnderstandingRangeChallenge,normalUnderstandingRangeTarget} from './execution-proof.ts';
import {normalRequestBearerDigest,requestCredential,requestChallengeStats} from './normal-request-challenge.ts';

export interface NormalExchangeOptions {pool:Pick<Pool,'connect'>}
const fail=(code:string,status:number):never=>{throw new AuthFailure(code,status);};
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const signedInputHash=(request:unknown,range=false)=>createHash('sha256').update(range?normalUnderstandingRangeChallengeBytes(request):executionChallengeRequestBytes('EXECUTION',request)).digest('hex');
const nonceDigest=(nonce:unknown)=>createHash('sha256').update(canonicalBase64(nonce,32)).digest('hex');
type Purpose='CREDENTIAL_EXCHANGE'|'EXECUTION_REQUEST';
function decode(body:unknown,purpose:Purpose,range=false){
 if(!recordV1(body,['requestId','purpose','grantRef','credentialGeneration','target','clientNonce','issuedAt','signature'])
   ||body.purpose!==purpose)return fail('INPUT_INVALID',400);
 try{
  const {signature,...value}=body;
  canonicalBase64(signature,64);
  const bytes=range?normalUnderstandingRangeChallengeBytes(value):executionChallengeRequestBytes('EXECUTION',value);
  return {request:JSON.parse(bytes.toString('utf8')).request,signature};
 }catch{return fail('INPUT_INVALID',400);}
}
export async function readCurrent(db:PoolClient,project:string,connector:string,execution:string,request:any){
 const args=[project,connector,execution,request.grantRef.id,request.grantRef.version,request.grantRef.contentHash,request.credentialGeneration];
 const rows=(await db.query('SELECT * FROM anvil.normal_exchange_current($1,$2,$3,$4,$5,$6,$7)',args)).rows;
 const c=rows[0],b=c?.binding;
 if(rows.length!==1||!(c.observed_at instanceof Date)||!(c.deadline instanceof Date)||!Number.isFinite(c.observed_at.getTime())
  ||!Number.isFinite(c.deadline.getTime())||c.deadline<=c.observed_at||!recordV1(b,['transport','mode','projectId','connectorId','executionId','executionGeneration','grantRef','scopeDigest','credentialGeneration','publicKeyFingerprint'])
  ||b.transport!=='NORMAL_PROTECTED'||b.mode!=='EXECUTION'||b.projectId!==project||b.connectorId!==connector||b.executionId!==execution
  ||!Number.isSafeInteger(b.executionGeneration)||Number(b.executionGeneration)<1||!same(b.grantRef,request.grantRef)||b.credentialGeneration!==request.credentialGeneration
  ||!hashV1(b.scopeDigest)||!hashV1(b.publicKeyFingerprint))return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED',412);
 const budget=(await db.query('SELECT project_id,reservation_id,version,content_hash,snapshot_json,server_sequence,command_id FROM anvil.usage_reservations WHERE project_id=$1 ORDER BY server_sequence LIMIT 10001',[project])).rows;
 if(budget.length>10000||c.budget_policy?.projectId!==project||digest(c.budget_policy.snapshot)!==c.budget_policy.ref?.contentHash)
  return fail('EXECUTION_CHALLENGE_BUDGET_INVALID',412);
 const ledger=budget.map(row=>{
  if(row.project_id!==project||Number(row.server_sequence)!==row.snapshot_json?.sequence||row.command_id!==row.snapshot_json?.claim?.commandId)
   return fail('EXECUTION_CHALLENGE_BUDGET_INVALID',412);
  return {ref:{id:row.reservation_id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json};
 });
 const reserved=recheckExecutionBudgetDelivery(ledger,c.budget_policy,c.budget_ref,c.observed_at.toISOString());
 if(reserved.snapshot.claim.executionId!==execution||reserved.snapshot.claim.executionGeneration!==b.executionGeneration)
  return fail('EXECUTION_CHALLENGE_BUDGET_INVALID',412);
 const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
 if(!(at instanceof Date)||!Number.isFinite(at.getTime())||at<c.observed_at||at>=c.deadline)return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED',412);
 return {binding:b,spki:c.spki,now:at,deadline:c.deadline as Date};
}
export function original(row:any,binding:unknown,purpose:Purpose='CREDENTIAL_EXCHANGE',credentialRef?:unknown){return originalValue(row,binding,purpose,credentialRef,false);}
export function originalRange(row:any,binding:any,credentialRef:unknown){return originalValue(row,binding,'EXECUTION_REQUEST',credentialRef,true);}
export function originalRangeResult(row:any,binding:any,credentialRef:unknown){return originalValue(row,binding,'EXECUTION_REQUEST',credentialRef,false,true);}
function originalValue(row:any,binding:any,purpose:Purpose,credentialRef:unknown,range:boolean,rangeResult=false){
 const s=row.snapshot_json,p=s?.publicChallenge,request=s?.request;
 const discovery=purpose==='EXECUTION_REQUEST'&&request?.target?.method==='GET'&&request.target.path==='/api/v1/connectors/'+(binding as any)?.connectorId+'/executions/'+(binding as any)?.executionId+'/understanding-response-read';
 const resultPrefix='/api/v1/connectors/'+(binding as any)?.connectorId+'/executions/'+(binding as any)?.executionId+'/understanding-response-read/';
 const resultId=purpose==='EXECUTION_REQUEST'&&request?.target?.method==='POST'&&typeof request.target.path==='string'&&request.target.path.startsWith(resultPrefix)&&request.target.path.endsWith('/result')?request.target.path.slice(resultPrefix.length,-'/result'.length):'';
 const result=uuidV1(resultId)&&request.target.path===resultPrefix+resultId+'/result';
 if(range&&(!same(request?.target,normalUnderstandingRangeTarget(binding.connectorId,binding.executionId))||!refV1(s?.understandingRangeRequestRef)||s.understandingRangeRequestRef.version!==1))return fail('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
 if(discovery&&!refV1(s?.understandingRequestRef))return fail('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
 if(rangeResult&&!result)return fail('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
 const marker=rangeResult?s?.understandingRangeResultBinding:s?.understandingResultBinding;
 if(result&&((rangeResult?(!recordV1(marker,['rangeRequestRef','acquisitionRef','sourceRequestRef','sourceResultRef','selectionHash'])||!['rangeRequestRef','acquisitionRef','sourceRequestRef','sourceResultRef'].every(k=>refV1(marker[k])&&marker[k].version===1)||!hashV1(marker.selectionHash)):
  (!recordV1(marker,['requestRef','acquisitionRef'])||!refV1(marker.requestRef)||marker.requestRef.version!==1||!refV1(marker.acquisitionRef)||marker.acquisitionRef.version!==1))
  ||(rangeResult?marker.rangeRequestRef.id:marker.requestRef.id)!==resultId||request.target.queryHash!==digest({})||!hashV1(request.target.bodyHash)||request.target.bodyHash===digest(null)))return fail('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
 if(!recordV1(s,['sequence','binding','request','requestHash','signedInputHash','serverNonceDigest','publicChallenge','previousRef','consumption',...(purpose==='EXECUTION_REQUEST'?['credentialRef']:[]),...(discovery?['understandingRequestRef']:[]),...(result?[rangeResult?'understandingRangeResultBinding':'understandingResultBinding']:[]),...(range?['understandingRangeRequestRef']:[])])
  ||(purpose==='EXECUTION_REQUEST'&&(!refV1(credentialRef)||!same(s.credentialRef,credentialRef)))
  ||s.previousRef!==null||s.consumption!==null||!Number.isSafeInteger(s.sequence)||Number(s.sequence)<1
  ||!same(s.binding,binding)||row.content_hash!==digest(s)||s.requestHash!==digest(request)
  ||!recordV1(p,['id','requestId','purpose','grantRef','credentialGeneration','scopeDigest','serverNonce','clientNonce','issuedAt','expiresAt'])
  ||!uuidV1(row.id)||p.id!==row.id||p.purpose!==purpose||request.purpose!==purpose||p.requestId!==request.requestId||p.clientNonce!==request.clientNonce
  ||!same(p.grantRef,request.grantRef)||p.credentialGeneration!==request.credentialGeneration||p.scopeDigest!==s.binding.scopeDigest
  ||!isoV1(p.issuedAt)||!isoV1(p.expiresAt)||Date.parse(p.expiresAt)<=Date.parse(p.issuedAt)||Date.parse(p.expiresAt)>Date.parse(p.issuedAt)+(purpose==='EXECUTION_REQUEST'?30000:120000))
  return fail('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
 if(s.signedInputHash!==signedInputHash(request,range)||s.serverNonceDigest!==nonceDigest(p.serverNonce))return fail('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
 return {ref:{id:row.id,version:1,contentHash:row.content_hash},challenge:p,credentialIssued:false,nonceConsumed:false,executionAuthorized:false,dispatchPerformed:false};
}
async function bootstrapReservation(db:PoolClient,b:any){
 const rows=(await db.query(`SELECT ec.id,ec.version,ec.content_hash,ec.snapshot_json,
  anvil.normal_credential_row_matches(ec) AS reservation_matches
  FROM anvil.execution_credentials ec WHERE ec.project_id=$1 AND ec.grant_id=$2 AND ec.grant_version=$3 AND ec.credential_generation=$4 AND ec.version=1 LIMIT 2`,
 [b.projectId,b.grantRef.id,b.grantRef.version,b.credentialGeneration])).rows;
 const row=rows[0],s=row?.snapshot_json;
 if(rows.length!==1||row.reservation_matches!==true||!uuidV1(row.id)||(row.version!==1&&row.version!=='1')||row.content_hash!==digest(s)
  ||!recordV1(s,['transport','state','grantRef','executionId','executionGeneration','credentialGeneration','registrationRef','commandId','scopeDigest','reservedAt','expiresAt','credentialIssued'])
  ||s.transport!=='NORMAL_PROTECTED'||s.state!=='RESERVED_NO_TOKEN'||s.credentialIssued!==false||!same(s.grantRef,b.grantRef)
  ||s.executionId!==b.executionId||s.executionGeneration!==b.executionGeneration||s.credentialGeneration!==b.credentialGeneration
  ||s.scopeDigest!==b.scopeDigest||!refV1(s.registrationRef)||!uuidV1(s.commandId)||!isoV1(s.reservedAt)||!isoV1(s.expiresAt)||s.expiresAt<=s.reservedAt)
  return fail('EXECUTION_BOOTSTRAP_RESERVATION_INVALID',412);
 return {registrationRef:s.registrationRef,reservationRef:{id:row.id,version:1,contentHash:row.content_hash},expiresAt:s.expiresAt};
}
async function issue(pool:Pick<Pool,'connect'>,connector:string,execution:string,body:unknown,bearerDigest?:string,understandingSource?:NormalUnderstandingReadAcquisition,resultSource?:NormalUnderstandingReadResult,signal?:AbortSignal,rangeSource?:NormalUnderstandingReadAcquisition,rangeResultSource?:NormalUnderstandingReadResult){
 const rangePath='/api/v1/connectors/'+connector+'/executions/'+execution+'/understanding-response-read/range';
 const requestedRange=(body as any)?.target?.path===rangePath;
 const range=requestedRange&&!!bearerDigest&&rangeSource?.pool===pool;
 if(requestedRange&&!range)return fail('NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE',503);
 const purpose:Purpose=bearerDigest?'EXECUTION_REQUEST':'CREDENTIAL_EXCHANGE';
 const {request,signature}=decode(body,purpose,range),ref=request.grantRef;
 if(!refV1(ref))return fail('INPUT_INVALID',400);
 // 원 HUMAN/GET와 같은 DB 목적 저장소가 없으면 새 경로의 nonce를 발행하지 않는다. SELECT는 닫혀 있다.
 const understanding='/api/v1/connectors/'+connector+'/executions/'+execution+'/understanding-response-read';
 const discovery=request.target.path===understanding&&request.target.method==='GET'&&!!bearerDigest&&understandingSource?.pool===pool;
 const resultId=request.target.method==='POST'&&request.target.path.startsWith(understanding+'/')&&request.target.path.endsWith('/result')?request.target.path.slice(understanding.length+1,-'/result'.length):'';
 resultSource??=rangeResultSource;
 const metadataResult=!!bearerDigest&&resultSource?.pool===pool&&uuidV1(resultId)&&request.target.path===understanding+'/'+resultId+'/result';
 if((request.target.path===understanding||request.target.path.startsWith(understanding+'/'))&&!discovery&&!range)
  if(!metadataResult)return fail('NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE',503);
 if((metadataResult||range)&&(!signal||signal.aborted))return fail(range?'NORMAL_UNDERSTANDING_RANGE_DENIED':'NORMAL_UNDERSTANDING_RESULT_DENIED',412);
 const wallStart=Date.now(),tickStart=performance.now();
 let db:PoolClient;try{db=await pool.connect();}catch(error){if(range)return fail('NORMAL_UNDERSTANDING_RANGE_UNKNOWN',503);if(metadataResult)return fail('NORMAL_UNDERSTANDING_RESULT_UNKNOWN',503);throw error;}
 let committing=false,committed=false,noneRollback=false,discard:Error|undefined;
 const scoped=discovery||metadataResult||range,monoStart=range?tickStart:performance.now();
 try{
  await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'");
  const credential=bearerDigest?await requestCredential(db,bearerDigest,connector,execution,request):null;
  const scope=credential?[{project_id:credential.project}]:(await db.query("SELECT project_id FROM anvil.execution_grants WHERE id=$1 AND version=$2 AND content_hash=$3 AND execution_id=$4 AND snapshot_json->>'transport'='NORMAL_PROTECTED' AND snapshot_json#>>'{binding,registration,connectorId}'=$5 LIMIT 2",[ref.id,ref.version,ref.contentHash,execution,connector])).rows;
  if(scope.length!==1||!uuidV1(scope[0].project_id))return fail('NOT_FOUND',404);
  const project=scope[0].project_id,keys=[project,ref.id,ref.version];
  const current=await readCurrent(db,project,connector,execution,request);
  const reservation=credential?null:await bootstrapReservation(db,current.binding);
  let deadline=Math.min(current.deadline.getTime(),credential?.expiresAt??Infinity);
  const checkRange=()=>{if(!range)return;const remaining=Math.min(30000,deadline-current.now.getTime()),w=Date.now(),m=performance.now();
   if(signal?.aborted||rangeSource?.pool!==pool||!Number.isFinite(remaining)||!Number.isFinite(w)||!Number.isFinite(m)||w<wallStart||m<monoStart||w>=wallStart+remaining||m>=monoStart+remaining)return fail('NORMAL_UNDERSTANDING_RANGE_EXPIRED',412);};
  checkRange();
  if(current.now.getTime()>=deadline)return fail('EXECUTION_CREDENTIAL_EXPIRED',412);
  const rows=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND version=1 AND (request_id=$4 OR client_nonce=$5) LIMIT 2',[...keys,request.requestId,request.clientNonce])).rows;
  const replay=rows.find(row=>row.snapshot_json?.request?.requestId===request.requestId);
  const identical=replay&&same(replay.snapshot_json.request,request);
  if(identical&&metadataResult){
   if(replay.snapshot_json?.understandingRangeResultBinding){if(rangeResultSource?.pool!==pool)return fail('NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE',503);resultSource=rangeResultSource;}
   else if(resultSource?.purpose!=='FN09_DISCOVERY_METADATA')return fail('NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE',503);
  }
  const checked=identical?(range?originalRange(replay,current.binding,credential?.ref):metadataResult&&resultSource?.purpose==='FN09_FIXED_RANGE_SELECTION'?originalRangeResult(replay,current.binding,credential?.ref):original(replay,current.binding,purpose,credential?.ref)):null;
  const verifyRequest=range?verifyNormalUnderstandingRangeChallenge:credential?verifyNormalCommandChallengeRequest:verifyNormalExchangeRequest;
  verifyRequest(current.spki,signature,request,current.binding,checked?new Date(checked.challenge.issuedAt):current.now);
  if(rows.length>1||replay&&!identical)return fail('IDEMPOTENCY_CONFLICT',409);
  if(rows.length&&!replay)return fail('EXECUTION_CHALLENGE_CLIENT_NONCE_REUSED',409);
  const human=range?await rangeSource!.rangeCurrent(db,bearerDigest!,current.binding,request.requestId,checked?replay.snapshot_json.understandingRangeRequestRef:null):discovery?await understandingSource!.current(db,bearerDigest!,current.binding,request.requestId,checked?replay.snapshot_json.understandingRequestRef:null):null;
  if((discovery||range)&&!human){noneRollback=true;discard=new Error('NORMAL_UNDERSTANDING_DISCOVERY_ROLLBACK_UNKNOWN');if((await db.query('ROLLBACK')).command!=='ROLLBACK')return fail(range?'NORMAL_UNDERSTANDING_RANGE_UNKNOWN':'NORMAL_UNDERSTANDING_DISCOVERY_UNKNOWN',503);discard=undefined;return {transport:'NORMAL_PROTECTED',status:'NONE',challenge:null,nonceConsumed:false,executionAuthorized:false,dispatchPerformed:false};}
  if(human){deadline=Math.min(deadline,Date.parse(human.expiresAt));if(current.now.getTime()>=deadline)return fail(range?'NORMAL_UNDERSTANDING_RANGE_EXPIRED':'NORMAL_UNDERSTANDING_DISCOVERY_EXPIRED',412);}
  checkRange();
  // 두 목적이 공존할 때 body 없는 challenge는 원 GET marker로만 선택한다. 실패 뒤 다른 목적을 시도하지 않는다.
  if(metadataResult&&!checked&&resultSource?.purpose==='FN09_DISCOVERY_METADATA'&&rangeResultSource?.pool===pool){
   const origins=(await db.query(`SELECT snapshot_json AS result_origin FROM anvil.execution_challenges
    WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND version=1 AND snapshot_json->'binding'=$5::jsonb AND snapshot_json->'credentialRef'=$6::jsonb
     AND ((snapshot_json ? 'understandingRequestRef' AND snapshot_json#>>'{understandingRequestRef,id}'=$4)
      OR (snapshot_json ? 'understandingRangeRequestRef' AND snapshot_json#>>'{understandingRangeRequestRef,id}'=$4)) LIMIT 2`,[...keys,resultId,JSON.stringify(current.binding),JSON.stringify(credential!.ref)])).rows;
   if(origins.length!==1)return fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   const origin=origins[0]?.result_origin,metadata=!!origin&&Object.hasOwn(origin,'understandingRequestRef'),selected=!!origin&&Object.hasOwn(origin,'understandingRangeRequestRef');
   if(metadata===selected)return fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);if(selected)resultSource=rangeResultSource;
  }
  const resultBasis=metadataResult?await resultSource!.challengeBasis(db,bearerDigest!,current.binding,credential!.ref,request.target,current.now):null;
  if(resultBasis){deadline=Math.min(deadline,Date.parse(resultBasis.deadline));
   if(current.now.getTime()>=deadline)return fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   if(checked)await resultSource!.validateChallenge(db,bearerDigest!,current.binding,credential!.ref,replay,current.now);
  }
  let result=checked;
  if(!result){
   const stats=credential?await requestChallengeStats(db,keys,credential.ref,current.now):(await db.query(`SELECT count(*) FILTER (WHERE version=1)::int AS total,
     count(*) FILTER (WHERE version=1 AND snapshot_json->'publicChallenge'->>'purpose'='CREDENTIAL_EXCHANGE' AND (snapshot_json->'publicChallenge'->>'issuedAt')::timestamptz>$4::timestamptz-interval '1 minute')::int AS recent,
     COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3`,[...keys,current.now])).rows[0];
   if(!stats||![stats.total,stats.recent,stats.sequence].every(Number.isSafeInteger)||stats.recent<0||stats.total<stats.recent||stats.sequence<=stats.total)return fail('EXECUTION_CHALLENGE_LEDGER_INVALID',503);
   if(stats.total>=10000)return fail('EXECUTION_CHALLENGE_LIFETIME_LIMIT',429);
   if(stats.recent>=(credential?60:5))return fail('EXECUTION_CHALLENGE_RATE_LIMIT',429);
   const challenge={id:randomUUID(),requestId:request.requestId,purpose:request.purpose,grantRef:ref,credentialGeneration:request.credentialGeneration,
    scopeDigest:current.binding.scopeDigest,serverNonce:randomBytes(32).toString('base64url'),clientNonce:request.clientNonce,
    issuedAt:current.now.toISOString(),expiresAt:new Date(Math.min(current.now.getTime()+(credential?30000:120000),deadline)).toISOString()};
   const candidate={sequence:stats.sequence,...(human?(range?{understandingRangeRequestRef:human.requestRef}:{understandingRequestRef:human.requestRef}):{}),...(credential?{credentialRef:credential.ref}:{}),binding:current.binding,request,requestHash:digest(request),signedInputHash:signedInputHash(request,range),serverNonceDigest:nonceDigest(challenge.serverNonce),publicChallenge:challenge,previousRef:null,consumption:null};
   const bound=metadataResult?await resultSource!.bindChallenge(db,bearerDigest!,current.binding,credential!.ref,{id:challenge.id,content_hash:digest(candidate),snapshot_json:candidate},current.now):null;
   const snapshot=bound?.snapshot_json??candidate,content=bound?.content_hash??digest(snapshot);
   if(metadataResult&&signal?.aborted)return fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);checkRange();
   if(credential)await db.query("SELECT set_config('anvil.normal_request_verified',txid_current()::text||':'||$1||':'||$2||':'||$3,true)",[content,credential.ref.contentHash,bearerDigest]);
   else await db.query("SELECT set_config('anvil.normal_challenge_verified',txid_current()::text||':'||$1,true)",[content]);
   const inserted=await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,$6,$7)',[project,challenge.id,ref.id,ref.version,stats.sequence,content,JSON.stringify(snapshot)]);
   if(inserted.rowCount!==1)return fail('EXECUTION_CHALLENGE_WRITE_FAILED',503);
   result=range?originalRange({id:challenge.id,content_hash:content,snapshot_json:snapshot},current.binding,credential?.ref):metadataResult&&resultSource?.purpose==='FN09_FIXED_RANGE_SELECTION'?originalRangeResult({id:challenge.id,content_hash:content,snapshot_json:snapshot},current.binding,credential?.ref):original({id:challenge.id,content_hash:content,snapshot_json:snapshot},current.binding,purpose,credential?.ref);
  }
  const final=await readCurrent(db,project,connector,execution,request);
  if(credential&&bearerDigest){
   const last=await requestCredential(db,bearerDigest,connector,execution,request);
   if(last.project!==project||!same(last.ref,credential.ref)||last.expiresAt!==credential.expiresAt||final.now.getTime()>=last.expiresAt)
    return fail('EXECUTION_CREDENTIAL_CURRENT_CHANGED',412);
  }
  const expiry=Date.parse(result.challenge.expiresAt);
  if(!same(final.binding,current.binding)||final.spki!==current.spki||final.now<current.now||Math.min(final.deadline.getTime(),credential?.expiresAt??Infinity)<expiry
    ||Date.parse(result.challenge.issuedAt)>current.now.getTime()||(!checked&&final.now.getTime()>=expiry))
    return fail('EXECUTION_CHALLENGE_CURRENT_BINDING_REQUIRED',412);
  if(human){const finalHuman=range?await rangeSource!.rangeCurrent(db,bearerDigest!,final.binding,request.requestId,human.requestRef):await understandingSource!.current(db,bearerDigest!,final.binding,request.requestId,human.requestRef);
   if(!finalHuman||!same(finalHuman.context,human.context)||range&&!same((finalHuman as any).selection,(human as any).selection)||Date.parse(finalHuman.expiresAt)<expiry||final.now.getTime()>=expiry)return fail(range?'NORMAL_UNDERSTANDING_RANGE_EXPIRED':'NORMAL_UNDERSTANDING_DISCOVERY_EXPIRED',412);}
  if(resultBasis){
   const stored=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=1 AND content_hash=$5',[...keys,result.ref.id,result.ref.contentHash])).rows;
   if(stored.length!==1)return fail('NORMAL_UNDERSTANDING_RESULT_UNKNOWN',503);
   const last=await resultSource!.validateChallenge(db,bearerDigest!,final.binding,credential!.ref,stored[0],final.now);
   if(!same(last.source,resultBasis)||final.now.getTime()>=expiry)return fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  }
  let bootstrapBinding:unknown;
  if(reservation){
   const last=await bootstrapReservation(db,final.binding);
   const end=Math.min(expiry,final.deadline.getTime(),Date.parse(last.expiresAt));
   if(!same(last,reservation)||end<=final.now.getTime())return fail('EXECUTION_BOOTSTRAP_RESERVATION_INVALID',412);
   const b=final.binding;
   bootstrapBinding={projectId:b.projectId,connectorId:b.connectorId,executionId:b.executionId,executionGeneration:b.executionGeneration,
    grantRef:b.grantRef,credentialGeneration:b.credentialGeneration,scopeDigest:b.scopeDigest,registrationRef:last.registrationRef,
    reservationRef:last.reservationRef,publicKeyFingerprint:b.publicKeyFingerprint,checkedAt:final.now.toISOString(),expiresAt:new Date(end).toISOString()};
  }
  const monoEnd=monoStart+Math.min(deadline,Date.parse(result.challenge.expiresAt))-current.now.getTime();
  const rangeEnd=wallStart+Math.min(deadline,Date.parse(result.challenge.expiresAt))-current.now.getTime();
  if((metadataResult||range)&&(signal?.aborted||!Number.isFinite(monoEnd)||performance.now()<monoStart||performance.now()>=monoEnd||range&&(Date.now()<wallStart||Date.now()>=rangeEnd)))return fail(range?'NORMAL_UNDERSTANDING_RANGE_EXPIRED':'NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  committing=true;
  const completion=await db.query('COMMIT');
  if(completion?.command!=='COMMIT')throw new Error('EXECUTION_CHALLENGE_COMMIT_UNKNOWN');
  committing=false;committed=true;
  if((metadataResult||range)&&(signal?.aborted||performance.now()<monoStart||performance.now()>=monoEnd||range&&(rangeSource?.pool!==pool||Date.now()<wallStart||Date.now()>=rangeEnd)))return fail(range?'NORMAL_UNDERSTANDING_RANGE_DELIVERY_UNKNOWN':'NORMAL_UNDERSTANDING_RESULT_DELIVERY_UNKNOWN',503);
  return reservation?{...result,bootstrapBinding}:result;
 }catch(error){
  if(committed){if(error instanceof AuthFailure)throw error;return fail('NORMAL_UNDERSTANDING_RESULT_UNKNOWN',503);}
  if(committing)discard=new Error('EXECUTION_CHALLENGE_COMMIT_UNKNOWN');
  let rollbackUnknown=noneRollback;
  try{
   if(!noneRollback){const ended=await db.query('ROLLBACK');
    if(scoped&&ended?.command!=='ROLLBACK'){rollbackUnknown=true;discard??=new Error('EXECUTION_CHALLENGE_ROLLBACK_UNKNOWN');}}
  }catch{rollbackUnknown=true;discard??=new Error('EXECUTION_CHALLENGE_ROLLBACK_UNKNOWN');}
  if(scoped&&rollbackUnknown)return fail(range?'NORMAL_UNDERSTANDING_RANGE_UNKNOWN':metadataResult?'NORMAL_UNDERSTANDING_RESULT_UNKNOWN':'NORMAL_UNDERSTANDING_DISCOVERY_UNKNOWN',503);
  if(committing)return fail('EXECUTION_CHALLENGE_COMMIT_UNKNOWN',503);
  if(noneRollback)return fail('NORMAL_UNDERSTANDING_DISCOVERY_UNKNOWN',503);
  if(discovery&&!(error instanceof AuthFailure)){if(error instanceof Error&&/^NORMAL_UNDERSTANDING_DISCOVERY_(DENIED|EXPIRED)$/.test(error.message))return fail(error.message,412);return fail('NORMAL_UNDERSTANDING_DISCOVERY_UNKNOWN',503);}
  if(metadataResult&&!(error instanceof AuthFailure)){if(error instanceof Error&&/^NORMAL_UNDERSTANDING_RANGE_RESULT_(DENIED|EXPIRED)$/.test(error.message))return fail(error.message,412);if(error instanceof Error&&error.message==='PROJECT_STORAGE_QUOTA_EXCEEDED')return fail(error.message,409);if(error instanceof Error&&error.message==='PROJECT_STORAGE_QUOTA_UNVERIFIED')return fail(error.message,412);if(error instanceof Error&&error.message==='NORMAL_UNDERSTANDING_RESULT_DENIED')return fail(error.message,412);return fail('NORMAL_UNDERSTANDING_RESULT_UNKNOWN',503);}
  if(range&&!(error instanceof AuthFailure)){if(error instanceof Error&&/^NORMAL_UNDERSTANDING_RANGE_(DENIED|EXPIRED)$/.test(error.message))return fail(error.message,412);if(error instanceof Error&&error.message==='PROJECT_STORAGE_QUOTA_EXCEEDED')return fail(error.message,409);if(error instanceof Error&&error.message==='PROJECT_STORAGE_QUOTA_UNVERIFIED')return fail(error.message,412);return fail('NORMAL_UNDERSTANDING_RANGE_UNKNOWN',503);}
  throw error;
 }finally{db.release(discard);}
}
/** 고정 목적 내부 조립이다. app/main 또는 기존 HTTP register에서는 호출하지 않는다. */
export function issueNormalUnderstandingRangeChallenge(pool:Pick<Pool,'connect'>,connector:string,execution:string,body:unknown,token:string,source:NormalUnderstandingReadAcquisition,signal:AbortSignal){
 if(!uuidV1(connector)||!uuidV1(execution)||!hashV1(token)||source.pool!==pool||!same((body as any)?.target,normalUnderstandingRangeTarget(connector,execution)))return fail('INPUT_INVALID',400);
 return issue(pool,connector,execution,body,token,undefined,undefined,signal,source);
}
export function registerNormalExchangeChallenge(app:FastifyInstance,options:NormalExchangeOptions,requestOptions?:{origin:string;understanding?:NormalUnderstandingReadAcquisition;understandingResult?:NormalUnderstandingReadResult;understandingRange?:NormalUnderstandingReadAcquisition;understandingRangeResult?:NormalUnderstandingReadResult}){
 const origin=requestOptions?new URL(requestOptions.origin):null;
 if(origin&&(origin.protocol!=='https:'||origin.origin!==requestOptions!.origin))throw Error('EXECUTION_CHALLENGE_ORIGIN_INVALID');
 app.register(async scope=>{
  scope.removeContentTypeParser('application/json');
  scope.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit:16384},(_req,buf,done)=>{
   try{done(null,parseWireJson(new TextDecoder('utf-8',{fatal:true}).decode(buf as Buffer)));}catch{done(new AuthFailure('INPUT_INVALID',400),undefined);}
  });
  scope.post<{Params:{cid:string;eid:string}}>('/api/v1/connectors/:cid/executions/:eid/challenges',{bodyLimit:16384},async(r,reply)=>{
   const {cid,eid}=r.params,path='/api/v1/connectors/'+cid+'/executions/'+eid+'/challenges';
   if(!uuidV1(cid)||!uuidV1(eid)||r.raw.method!=='POST'||r.raw.url!==path)return reply.callNotFound();
   const commandChallenge=!!origin&&(r.body as {purpose?:unknown}|null)?.purpose==='EXECUTION_REQUEST';
   const names=r.raw.rawHeaders.filter((_,i)=>i%2===0).map(h=>h.toLowerCase());
   if(['host','content-type','content-length'].some(h=>names.filter(n=>n===h).length>1)
    ||[...(commandChallenge?[]:['authorization']),'cookie','origin','x-anvil-csrf','content-encoding'].some(h=>names.includes(h)||r.headers[h]!==undefined))
    throw new AuthFailure('EXECUTION_CHALLENGE_HEADER_REJECTED',403);
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(r.headers['content-type']??''))throw new AuthFailure('INPUT_INVALID',400);
   try{return await issue(options.pool,cid,eid,r.body,commandChallenge?normalRequestBearerDigest(r,origin!.host):undefined,requestOptions?.understanding,requestOptions?.understandingResult,r.signal,requestOptions?.understandingRange,requestOptions?.understandingRangeResult);}catch(error){
    if(error instanceof AuthFailure&&error.message==='NOT_FOUND')return reply.callNotFound();
    throw error;
   }
  });
 });
}
