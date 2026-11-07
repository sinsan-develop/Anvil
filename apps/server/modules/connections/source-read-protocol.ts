import {randomBytes,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,type ProjectCommand} from '../access/project-command.ts';
import {sessionIsActive} from '../access/service.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceReadPreflightV1,readSourceReadChallengeV1,readSourceReadPermitV1,sourceReadBase64V1,type SourceReadPreflightV1} from '../../../../contracts/runtime/source-read-observation-v1.ts';
import {readSourceReadReportV1,type SourceReadReportV1,type SourceReadReportContextV1} from '../../../../contracts/runtime/source-read-report-v1.ts';
import {hasValidSourceReadSignature,verifySourceReadReportProof} from './source-read-proof.ts';
import {publicKeyFingerprint} from './registration-proof.ts';
import {SourceReadRecords,type SourceReadGrantRecord} from './source-read-records.ts';
import {ProjectRegistrationReads} from './project-registration-reads.ts';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const flags={executionAuthorized:false as const,agentDispatchPerformed:false as const,baselineConfirmed:false as const};
type Outcome={value:unknown}|{failure:string;status:number};
type Basis={record:SourceReadGrantRecord;key:string;now:Date;validUntil:number};
type Exchange={step:'CHALLENGE';preflight:SourceReadPreflightV1;signature:string}|{step:'ISSUE';challengeId:string;payload:ReturnType<typeof readSourceReadChallengeV1>;signature:string};
function readExchange(value:unknown):Exchange{
 try{
  if(recordV1(value,['step','preflight','signature'])&&value.step==='CHALLENGE'){sourceReadBase64V1(value.signature,64);return{step:'CHALLENGE',preflight:readSourceReadPreflightV1(value.preflight),signature:value.signature};}
  if(recordV1(value,['step','challengeId','payload','signature'])&&value.step==='ISSUE'&&uuidV1(value.challengeId)){sourceReadBase64V1(value.signature,64);return{step:'ISSUE',challengeId:value.challengeId,payload:readSourceReadChallengeV1(value.payload),signature:value.signature};}
 }catch{}
 throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
}
/** 별도 읽기 관측 교환. 기존 등록/status token·권한·실OS를 변경하지 않는다. */
export class SourceReadProtocol{
 readonly access:AccessRepository;readonly records:SourceReadRecords;
 constructor(access:AccessRepository){this.access=access;this.records=new SourceReadRecords(access.installationId);}
 async #transaction(body:(db:PoolClient)=>Promise<Outcome>,signal?:AbortSignal){
  const deadline=Date.now()+10000;
  const active=()=>{if(signal?.aborted)throw new AuthFailure('SOURCE_READ_CANCELLED',503);if(Date.now()>=deadline)throw new AuthFailure('SOURCE_READ_TIMEOUT',503);};
  active();
  // pool 입장도 유한하게 하고, 종료 뒤 도착한 client는 사용하지 않고 반환한다.
  const client=await new Promise<PoolClient>((resolve,reject)=>{
   let settled=false;
   const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
   const cancel=()=>{if(settled)return;settled=true;clean();reject(new AuthFailure('SOURCE_READ_CANCELLED',503));};
   const timer=setTimeout(()=>{if(settled)return;settled=true;clean();reject(new AuthFailure('SOURCE_READ_TIMEOUT',503));},Math.max(1,deadline-Date.now()));
   signal?.addEventListener('abort',cancel,{once:true});
   this.access.pool.connect().then(value=>{if(settled){value.release();return;}settled=true;clean();resolve(value);},error=>{if(settled)return;settled=true;clean();reject(error);});
   if(signal?.aborted)cancel();
  });
  let outcome:Outcome,unsafe:Error|undefined;
  const db=Object.create(client) as PoolClient;
  db.query=(async(text:string,values?:unknown[])=>{
   active();const query={text,values,query_timeout:Math.max(1,Math.min(5000,deadline-Date.now()))};
   try{return await client.query(query);}
   catch(e){unsafe=e instanceof Error?e:Error('SOURCE_READ_QUERY_FAILED');throw e;}
  }) as PoolClient['query'];
  try{
   await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'");await db.query("SET LOCAL lock_timeout='2s'");
   outcome=await body(db);active();await db.query('COMMIT');
  }catch(e){try{const rollback={text:'ROLLBACK',query_timeout:5000};await client.query(rollback);}catch(failure){unsafe=failure instanceof Error?failure:Error('SOURCE_READ_ROLLBACK_FAILED');}throw e;}
  finally{client.release(unsafe);}
  if('failure'in outcome)throw new AuthFailure(outcome.failure,outcome.status);return outcome.value as any;
 }
 async #hint(db:PoolClient,cid:string,gid:string){
  const rows=(await db.query('SELECT g.*,h.public_key_spki FROM anvil.source_read_grants g JOIN anvil.connectors h ON h.project_id=g.project_id AND h.id=g.connector_id AND h.registration_id=g.registration_id WHERE g.id=$1 AND g.connector_id=$2',[gid,cid])).rows;
  if(rows.length!==1)throw new AuthFailure('NOT_FOUND',404);return rows[0];
 }
 async #basis(db:PoolClient,hint:any):Promise<Basis>{
  // HUMAN mutation과 동일한 user/session/client → project/control → policy → root → registration → grant 순서다.
  const session=(await db.query('SELECT u.id,u.credential_generation,u.status user_status,u.revoked_at user_revoked_at,s.credential_generation session_generation,s.reauth_until,s.absolute_expires_at,s.idle_expires_at,s.revoked_at session_revoked_at,cl.revoked_at client_revoked_at FROM anvil.users u JOIN anvil.auth_sessions s ON s.user_id=u.id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=u.id WHERE u.id=$1 AND s.id=$2 AND cl.id=$3 FOR UPDATE OF u,s,cl',[hint.requested_by,hint.session_id,hint.client_id])).rows[0];
  if(!session)throw new AuthFailure('SOURCE_READ_BASIS_NOT_CURRENT',412);
  const actor={actorId:hint.requested_by,clientId:hint.client_id,credentialGeneration:Number(session.credential_generation),reauthUntil:session.reauth_until,serverOwner:false};
  const request={projectId:hint.project_id,clientId:hint.client_id,controlGeneration:Number(hint.control_generation),operation:'requestSourceReadObservation',approvalRef:null} as ProjectCommand;
  await currentProjectController(db,actor,request);
  const policy=await authorizeMaterial(db,actor,request,true);
  if(policy.approvalRequired)throw new AuthFailure('SOURCE_READ_BASIS_NOT_CURRENT',412);
  const head=(await db.query('SELECT head_version FROM anvil.source_roots WHERE project_id=$1 AND id=$2 FOR SHARE',[hint.project_id,hint.source_root_id])).rows[0];
  const registrations=(await db.query('SELECT r.*,h.public_key_spki,h.generation FROM anvil.connector_registrations r JOIN anvil.connectors h ON h.project_id=r.project_id AND h.id=r.connector_id AND h.registration_id=r.id WHERE r.project_id=$1 AND r.id=$2 FOR UPDATE OF r,h',[hint.project_id,hint.registration_id])).rows;
  const record=await this.records.load(db,hint.project_id,hint.id,true),s=record.scope,now=(await db.query('SELECT clock_timestamp() at')).rows[0]?.at;
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
  if(session.user_status!=='ACTIVE'||!sessionIsActive({idleExpiresAt:session.idle_expires_at,absoluteExpiresAt:session.absolute_expires_at,revokedAt:session.session_revoked_at,userRevokedAt:session.user_revoked_at,clientRevokedAt:session.client_revoked_at,credentialGeneration:Number(session.session_generation),currentCredentialGeneration:Number(session.credential_generation)},now))throw new AuthFailure('SOURCE_READ_BASIS_NOT_CURRENT',412);
  if(s.userId!==actor.actorId||s.clientId!==actor.clientId||s.credentialGeneration!==actor.credentialGeneration||!same(s.policyRef,policy.ref)||!head||Number(head.head_version)!==s.sourceRootRef.version||registrations.length!==1)throw new AuthFailure('SOURCE_READ_BASIS_NOT_CURRENT',412);
  const registration=await new ProjectRegistrationReads(this.access.installationId).read(db,actor,s.projectId,s.registrationRef.id),key=registrations[0].public_key_spki;
  if(!registration.basis.current||registration.state!=='ISSUED'||registration.connectorState!=='TRUSTED'||!same(registration.registrationRef,s.registrationRef)||!same(registration.connectorRef,s.connectorRef)||registration.expectedHostFingerprint!==s.hostFingerprint||publicKeyFingerprint(key)!==s.hostFingerprint)throw new AuthFailure('SOURCE_READ_BASIS_NOT_CURRENT',412);
  const reasons=await this.records.current(db,record,now);
  if(reasons.length)throw new AuthFailure(reasons.includes('EXPIRED')?'SOURCE_READ_EXPIRED':reasons.includes('EXCHANGE_ATTEMPT_LIMIT')?'SOURCE_READ_EXCHANGE_ATTEMPT_LIMIT':'SOURCE_READ_BASIS_NOT_CURRENT',412);
  return{record,key,now,validUntil:Math.min(policy.validUntil,record.row.expires_at.getTime(),Date.parse(registration.expiresAt),session.absolute_expires_at.getTime())};
 }
 async #event(db:PoolClient,b:Basis,reason:string,outcome='APPLIED',target:RuntimeRefV1=b.record.grantRef){
  const id=randomUUID(),s=b.record.scope;
  await db.query("INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,target_ref,policy_ref,outcome,reason_code,scope_digest,source_kind) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,$6,$7,$8,$9,'SOURCE_OBSERVATION_PROTOCOL' FROM anvil.audit_events WHERE project_id=$1",[s.projectId,id,JSON.stringify({kind:'CONNECTOR',connectorId:s.connectorRef.id,registrationId:s.registrationRef.id}),s.clientId,JSON.stringify(target),JSON.stringify(s.policyRef),outcome,reason,b.record.grantRef.contentHash]);
  await db.query("SELECT set_config('anvil.source_read_project_id',$1,true),set_config('anvil.source_read_grant_id',$2,true),set_config('anvil.source_read_event_id',$3,true)",[s.projectId,b.record.grantRef.id,id]);
 }
 async #failure(db:PoolClient,b:Basis,code:string):Promise<Outcome>{
  await this.#event(db,b,'SOURCE_READ_PROOF_DENIED','DENIED');
  await db.query('UPDATE anvil.source_read_grants SET exchange_failures=exchange_failures+1 WHERE project_id=$1 AND id=$2 AND exchange_failures<5',[b.record.scope.projectId,b.record.grantRef.id]);
  return{failure:code,status:412};
 }
 #preflight(b:Basis,clientNonce:string):SourceReadPreflightV1{const s=b.record.scope;return{protocolVersion:1,purpose:'SOURCE_READ_PREFLIGHT',installationId:s.installationId,projectId:s.projectId,connectorId:s.connectorRef.id,registrationId:s.registrationRef.id,connectorGeneration:s.connectorRef.version,grantRef:b.record.grantRef,scopeDigest:b.record.grantRef.contentHash,publicKeyFingerprint:s.hostFingerprint,clientNonce,expiresAt:s.expiresAt};}
 #challenge(b:Basis,row:any){
  try{
   const payload=readSourceReadChallengeV1(row.payload_json),preflight=this.#preflight(b,payload.clientNonce);
   if(!uuidV1(row.id)||row.project_id!==b.record.scope.projectId||row.grant_id!==b.record.grantRef.id||!(row.created_at instanceof Date)||!(row.expires_at instanceof Date)||!Number.isFinite(row.created_at.getTime())||!Number.isFinite(row.expires_at.getTime())||row.created_at.toISOString()!==payload.issuedAt||row.expires_at.toISOString()!==payload.expiresAt||row.created_at>b.now||row.created_at<new Date(b.record.scope.requestedAt)||row.expires_at.getTime()>b.validUntil||!Number.isInteger(row.failed_attempts)||row.failed_attempts<0||row.failed_attempts>5||row.preflight_digest!==contentHash(canonicalJson(preflight))||!same(payload,{...preflight,purpose:'SOURCE_READ_EXCHANGE',serverNonce:payload.serverNonce,issuedAt:payload.issuedAt,expiresAt:payload.expiresAt}))throw Error();
   return payload;
  }catch{throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);}
 }
 async exchange(cid:string,gid:string,value:unknown,signal?:AbortSignal){
  if(!uuidV1(cid)||!uuidV1(gid))throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
  const input=readExchange(value),payload=input.step==='CHALLENGE'?input.preflight:input.payload;
  return this.#transaction(async db=>{
   const hint=await this.#hint(db,cid,gid);
   // 무효 서명은 상태/실패횟수/감사를 만들지 않는다. 잠금 후 현재 key로 재검증한다.
   if(!hasValidSourceReadSignature(hint.public_key_spki,input.signature,payload))throw new AuthFailure('SOURCE_READ_PROOF_INVALID',412);
   const b=await this.#basis(db,hint),s=b.record.scope;
   if(!hasValidSourceReadSignature(b.key,input.signature,payload))throw new AuthFailure('SOURCE_READ_PROOF_INVALID',412);
   const credentials=(await db.query('SELECT * FROM anvil.source_read_credentials WHERE project_id=$1 AND grant_id=$2 FOR UPDATE',[s.projectId,gid])).rows;
   if(credentials.length)throw new AuthFailure('SOURCE_READ_EXCHANGE_RECONCILE_REQUIRED',409);
   const challenges=(await db.query('SELECT * FROM anvil.source_read_challenges WHERE project_id=$1 AND grant_id=$2 FOR UPDATE',[s.projectId,gid])).rows;
   if(challenges.length>1)throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
   if(challenges.length)this.#challenge(b,challenges[0]);
   if(input.step==='CHALLENGE'){
    if(!same(input.preflight,this.#preflight(b,input.preflight.clientNonce)))return this.#failure(db,b,'SOURCE_READ_PROOF_INVALID');
    const digest=contentHash(canonicalJson(input.preflight)),old=challenges[0];
    if(old){
     if(old.preflight_digest!==digest||old.consumed_at||old.expires_at<=b.now)throw new AuthFailure('SOURCE_READ_EXCHANGE_RECONCILE_REQUIRED',409);
     let payload;try{payload=readSourceReadChallengeV1(old.payload_json);}catch{throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);}
     const expected={...input.preflight,purpose:'SOURCE_READ_EXCHANGE',serverNonce:payload.serverNonce,issuedAt:old.created_at.toISOString(),expiresAt:old.expires_at.toISOString()};
     if(!same(payload,expected)||Date.parse(payload.issuedAt)>b.now.getTime())throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
     return{value:{status:'SOURCE_READ_EXCHANGE_PROOF_REQUIRED',grantRef:b.record.grantRef,scopeDigest:b.record.grantRef.contentHash,challenge:{id:old.id,payload},...flags}};
    }
    const payload=readSourceReadChallengeV1({...input.preflight,purpose:'SOURCE_READ_EXCHANGE',serverNonce:randomBytes(32).toString('base64url'),issuedAt:b.now.toISOString(),expiresAt:new Date(Math.min(b.now.getTime()+120000,b.validUntil)).toISOString()}),id=randomUUID();
    await this.#event(db,b,'SOURCE_READ_CHALLENGED');
    await db.query('INSERT INTO anvil.source_read_challenges(id,project_id,grant_id,preflight_digest,payload_json,created_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,s.projectId,gid,digest,JSON.stringify(payload),b.now,payload.expiresAt]);
    return{value:{status:'SOURCE_READ_EXCHANGE_PROOF_REQUIRED',grantRef:b.record.grantRef,scopeDigest:b.record.grantRef.contentHash,challenge:{id,payload},...flags}};
   }
   const challenge=challenges[0];
   if(!challenge||challenge.id!==input.challengeId||challenge.consumed_at||!same(input.payload,challenge.payload_json))return this.#failure(db,b,'SOURCE_READ_PROOF_INVALID');
   if(challenge.expires_at<=b.now||Date.parse(input.payload.issuedAt)>b.now.getTime())throw new AuthFailure('SOURCE_READ_EXPIRED',412);
   const expected={...this.#preflight(b,input.payload.clientNonce),purpose:'SOURCE_READ_EXCHANGE',serverNonce:input.payload.serverNonce,issuedAt:challenge.created_at.toISOString(),expiresAt:challenge.expires_at.toISOString()};
   if(!same(input.payload,expected))return this.#failure(db,b,'SOURCE_READ_PROOF_INVALID');
   const credential='av3sr1_'+randomBytes(32).toString('base64url'),id=randomUUID(),expiresAt=new Date(Math.min(b.now.getTime()+300000,b.validUntil)).toISOString();
   await this.#event(db,b,'SOURCE_READ_ISSUED');
   await db.query("INSERT INTO anvil.source_read_credentials(id,project_id,grant_id,connector_id,connector_generation,token_digest,scope,scope_digest,issued_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,'SOURCE_OBSERVE_READ_ONLY',$7,$8,$9)",[id,s.projectId,gid,cid,s.connectorRef.version,contentHash(credential),b.record.grantRef.contentHash,b.now,expiresAt]);
   await db.query('UPDATE anvil.source_read_challenges SET consumed_at=$3,proof_signature=$4 WHERE project_id=$1 AND id=$2 AND consumed_at IS NULL',[s.projectId,challenge.id,b.now,input.signature]);
   return{value:{status:'SOURCE_READ_ISSUED',grantRef:b.record.grantRef,scope:'SOURCE_OBSERVE_READ_ONLY',scopeDigest:b.record.grantRef.contentHash,credentialId:id,credential,expiresAt,...flags}};
  },signal);
 }
 async #credential(db:PoolClient,cid:string,gid:string,token:string,allowConsumed=false){
  const hints=(await db.query('SELECT * FROM anvil.source_read_credentials WHERE token_digest=$1',[contentHash(token)])).rows;
  if(hints.length!==1)throw new AuthFailure('SOURCE_READ_CREDENTIAL_INVALID',401);
  const h=hints[0];if(h.connector_id!==cid||h.grant_id!==gid)throw new AuthFailure('NOT_FOUND',404);
  const hint=await this.#hint(db,cid,gid);if(h.project_id!==hint.project_id)throw new AuthFailure('SOURCE_READ_CREDENTIAL_INVALID',401);
  const b=await this.#basis(db,hint),rows=(await db.query('SELECT * FROM anvil.source_read_credentials WHERE project_id=$1 AND grant_id=$2 FOR UPDATE',[hint.project_id,gid])).rows,c=rows[0];
  if(rows.length!==1||!uuidV1(c.id)||c.token_digest!==contentHash(token)||c.connector_id!==cid||c.project_id!==hint.project_id||c.grant_id!==gid||c.scope!=='SOURCE_OBSERVE_READ_ONLY'||c.scope_digest!==b.record.grantRef.contentHash||Number(c.connector_generation)!==b.record.scope.connectorRef.version||c.revoked_at||c.consumed_at&&!allowConsumed||!(c.issued_at instanceof Date)||!(c.expires_at instanceof Date)||!Number.isFinite(c.issued_at.getTime())||!Number.isFinite(c.expires_at.getTime())||c.issued_at>b.now||c.issued_at<new Date(b.record.scope.requestedAt)||c.expires_at<=c.issued_at||c.expires_at.getTime()-c.issued_at.getTime()>300000||c.expires_at.getTime()>b.validUntil)throw new AuthFailure('SOURCE_READ_CREDENTIAL_INVALID',401);
  if(c.expires_at<=b.now)throw new AuthFailure(allowConsumed?'SOURCE_READ_EXPIRED':'SOURCE_READ_CREDENTIAL_INVALID',allowConsumed?412:401);
  return{b,credential:c};
 }
 #tokenInput(cid:string,gid:string,token:string){if(!uuidV1(cid)||!uuidV1(gid)||typeof token!=='string'||!/^av3sr1_[A-Za-z0-9_-]{43}$/.test(token))throw new AuthFailure('SOURCE_READ_CREDENTIAL_INVALID',401);try{sourceReadBase64V1(token.slice(7),32);}catch{throw new AuthFailure('SOURCE_READ_CREDENTIAL_INVALID',401);}}
 async permit(cid:string,gid:string,token:string,signal?:AbortSignal){
  this.#tokenInput(cid,gid,token);
  return this.#transaction(async db=>{
   const{b,credential:c}=await this.#credential(db,cid,gid,token),r=b.record;
   return{value:readSourceReadPermitV1({protocolVersion:1,grantRef:r.grantRef,scopeDigest:r.grantRef.contentHash,scope:r.scope,root:{sourceRootRef:r.scope.sourceRootRef,pathHint:r.declaredPathHint,pathHintHash:r.scope.pathHintHash},issuedAt:c.issued_at.toISOString(),expiresAt:c.expires_at.toISOString(),serverNow:b.now.toISOString(),...flags},{scope:r.scope,grantRef:r.grantRef},b.now.getTime())};
  },signal);
 }
 #reportContext(b:Basis,c:any,receivedAt=b.now):SourceReadReportContextV1{return{scope:b.record.scope,grantRef:b.record.grantRef,credentialIssuedAt:c.issued_at.toISOString(),credentialExpiresAt:c.expires_at.toISOString(),receivedAt:receivedAt.toISOString()};}
 #readReport(value:unknown,context:SourceReadReportContextV1):SourceReadReportV1{
  try{return readSourceReadReportV1(value,context);}catch(e){const code=e instanceof Error?e.message:'';throw new AuthFailure(code==='SOURCE_READ_TIME_INVALID'?code:code==='SOURCE_READ_EXPIRED'?code:'SOURCE_READ_INPUT_INVALID',code==='SOURCE_READ_EXPIRED'?412:422);}
 }
 #receipt(b:Basis,id:string,report:SourceReadReportV1){
  const observedSummary={rootState:report.root.state,total:report.files.length,observed:0,missing:0,denied:0,changed:0,unverified:0};
  for(const file of report.files)observedSummary[({OBSERVED:'observed',MISSING:'missing',DENIED:'denied',CHANGED:'changed',UNVERIFIED:'unverified'} as const)[file.state]]++;
  return{status:'REPORT_STORED',grantRef:b.record.grantRef,scopeDigest:b.record.grantRef.contentHash,snapshotRef:{id,version:1,contentHash:report.contentHash},observedSummary,evidenceClass:'CONNECTOR_REPORTED',osVerification:'UNVERIFIED',...flags};
 }
 async report(cid:string,gid:string,token:string,value:unknown,signal?:AbortSignal){
  this.#tokenInput(cid,gid,token);
  return this.#transaction(async db=>{
   const{b,credential:c}=await this.#credential(db,cid,gid,token,true),s=b.record.scope,context=this.#reportContext(b,c);
   // TIME_INVALID422/서버기한을 먼저 보존한다. crypto wrapper로 모두412로 덮지 않는다.
   const report=this.#readReport(value,context);verifySourceReadReportProof(b.key,report,context);
   const rows=(await db.query('SELECT * FROM anvil.source_snapshots WHERE project_id=$1 AND grant_id=$2',[s.projectId,gid])).rows;
   if(rows.length>1)throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
   if(rows.length){
    const old=rows[0];
    try{
     if(!c.consumed_at||!uuidV1(old.id)||old.project_id!==s.projectId||old.grant_id!==gid||Number(old.version)!==1||old.source_root_id!==s.sourceRootRef.id||Number(old.source_root_version)!==s.sourceRootRef.version||old.connector_id!==cid||Number(old.generation)!==s.connectorRef.version||old.scope_digest!==b.record.grantRef.contentHash||old.evidence_class!=='CONNECTOR_REPORTED'||old.os_verification!=='UNVERIFIED'||!(old.received_at instanceof Date))throw Error();
     const stored=readSourceReadReportV1(old.report_json,this.#reportContext(b,c,old.received_at));
     if(stored.contentHash!==old.content_hash||stored.signature!==old.signature||stored.commandId!==old.report_command_id||stored.observedAt!==old.observed_at.toISOString()||stored.finishedAt!==old.finished_at.toISOString())throw Error();
     verifySourceReadReportProof(b.key,stored,this.#reportContext(b,c,old.received_at));
    }catch{throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);}
    if(old.content_hash!==report.contentHash||old.report_command_id!==report.commandId)throw new AuthFailure('SOURCE_READ_REPORT_CONFLICT',409);
    return{value:this.#receipt(b,old.id,old.report_json)};
   }
   if(c.consumed_at)throw new AuthFailure('SOURCE_READ_INTEGRITY_FAILED',503);
   const id=randomUUID(),ref={id,version:1,contentHash:report.contentHash};
   await this.#event(db,b,'SOURCE_READ_REPORT_STORED','APPLIED',ref);
   await db.query("INSERT INTO anvil.source_snapshots(project_id,id,version,grant_id,report_command_id,source_root_id,source_root_version,connector_id,generation,scope_digest,report_json,content_hash,signature,observed_at,finished_at,received_at,evidence_class,os_verification) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'CONNECTOR_REPORTED','UNVERIFIED')",[s.projectId,id,gid,report.commandId,s.sourceRootRef.id,s.sourceRootRef.version,cid,s.connectorRef.version,b.record.grantRef.contentHash,JSON.stringify(report),report.contentHash,report.signature,report.observedAt,report.finishedAt,b.now]);
   const consumed=await db.query('UPDATE anvil.source_read_credentials SET consumed_at=$3 WHERE project_id=$1 AND id=$2 AND consumed_at IS NULL',[s.projectId,c.id,b.now]);
   if(consumed.rowCount!==1)throw new AuthFailure('SOURCE_READ_REPORT_CONFLICT',409);
   return{value:this.#receipt(b,id,report)};
  },signal);
 }
}
