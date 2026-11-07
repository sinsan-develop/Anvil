import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {currentProjectController,currentPolicy} from '../access/project-command.ts';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {canonicalBase64,proofBytes,publicKeyFingerprint,verifyHostProof} from './registration-proof.ts';
import type {HostProofPayload} from './registration-proof.ts';
import {registrationRef,connectorRef} from './project-registrations.ts';

const exact=(v:unknown,keys:string):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===keys.split(',').sort().join(',');
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const equal=(a:string,b:string)=>/^[0-9a-f]{64}$/.test(a)&&/^[0-9a-f]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
type Outcome={value:unknown}|{failure:string;status:number};
type Basis={row:any;now:Date;validUntil:number};
export class ConnectorRegistrationProtocol {
 readonly access:AccessRepository;
 constructor(access:AccessRepository){this.access=access;}
 async #transaction(body:(db:PoolClient)=>Promise<Outcome>){
  const db=await this.access.pool.connect();let result:Outcome;
  try{await db.query('BEGIN');result=await body(db);await db.query('COMMIT');}catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{db.release();}
  if('failure'in result)throw new AuthFailure(result.failure,result.status);return result.value;
 }
 async #basis(db:PoolClient,id:string,requireReauth=true):Promise<Basis>{
  if(!uuid(id))throw new AuthFailure('CONNECTOR_PROTOCOL_INPUT_INVALID',422);
  const hint=(await db.query('SELECT requested_by,client_id,session_id FROM anvil.connector_registrations WHERE id=$1',[id])).rows[0];if(!hint)throw new AuthFailure('NOT_FOUND',404);
  // HUMAN command와 같은 user/session/client → project/control → policy → registration 순서다.
  const session=(await db.query('SELECT u.id,u.credential_generation,s.reauth_until FROM anvil.users u JOIN anvil.auth_sessions s ON s.user_id=u.id JOIN anvil.clients cl ON cl.id=s.client_id AND cl.user_id=u.id WHERE u.id=$1 AND s.id=$2 AND cl.id=$3 FOR UPDATE OF u,s,cl',[hint.requested_by,hint.session_id,hint.client_id])).rows[0];if(!session)throw new AuthFailure('CONNECTOR_BASIS_NOT_CURRENT',412);
  const initial=(await db.query('SELECT project_id,control_generation FROM anvil.connector_registrations WHERE id=$1',[id])).rows[0];if(!initial)throw new AuthFailure('NOT_FOUND',404);
  await currentProjectController(db,{actorId:hint.requested_by,clientId:hint.client_id,credentialGeneration:Number(session.credential_generation),reauthUntil:session.reauth_until,serverOwner:false},{projectId:initial.project_id,clientId:hint.client_id,controlGeneration:Number(initial.control_generation)} as any);
  const policy=await currentPolicy(db,initial.project_id),row=(await db.query('SELECT r.*,h.generation,h.status connector_status,h.public_key_spki FROM anvil.connector_registrations r JOIN anvil.connectors h ON h.id=r.connector_id AND h.project_id=r.project_id WHERE r.id=$1 FOR UPDATE OF r,h',[id])).rows[0];
  const now=(await db.query('SELECT clock_timestamp() at')).rows[0].at as Date;
  if(!row||!policy||canonicalJson(policy.ref)!==canonicalJson(row.policy_ref)||contentHash(canonicalJson(row.scope_json))!==row.scope_digest||row.scope_json.kind!=='HOST_TRUST_REGISTRATION'||row.scope_json.credentialScope!=='REGISTRATION_STATUS_ONLY'||canonicalJson(row.scope_json.grants)!=='[]'||row.scope_json.installationId!==this.access.installationId)throw new AuthFailure('CONNECTOR_BASIS_NOT_CURRENT',412);
  const scope=row.scope_json,created=(await db.query('SELECT result_ref FROM anvil.commands WHERE project_id=$1 AND id=$2',[row.project_id,row.created_command_id])).rows[0]?.result_ref?.data;
  if(!created||canonicalJson(created.scope)!==canonicalJson(scope)||created.scopeDigest!==row.scope_digest||scope.projectId!==row.project_id||scope.expectedHostFingerprint!==row.expected_host_fingerprint||scope.expiresAt!==row.expires_at.toISOString()||scope.subject?.kind!=='HUMAN'||scope.subject.userId!==row.requested_by||scope.subject.clientId!==row.client_id||scope.subject.credentialGeneration!==Number(row.credential_generation)||scope.subject.controlGeneration!==Number(row.control_generation)||canonicalJson(scope.policyRef)!==canonicalJson(row.policy_ref))throw new AuthFailure('CONNECTOR_REGISTRATION_INTEGRITY_FAILED',503);
  if(!(await db.query('SELECT anvil.connector_basis_current($1,$2) ok',[id,requireReauth])).rows[0].ok)throw new AuthFailure('CONNECTOR_BASIS_NOT_CURRENT',412);
  const rules=policy.rules.filter(rule=>rule.subjectRef.userId===row.requested_by&&rule.targetScopes.some(s=>s.projectId===row.project_id)&&rule.operations.includes('registerConnector')&&Date.parse(rule.expiresAt)>now.getTime());
  if(!rules.length||rules.some(r=>r.disposition==='DENY'))throw new AuthFailure('CONNECTOR_BASIS_NOT_CURRENT',412);
  return{row,now,validUntil:Math.min(...rules.map(r=>Date.parse(r.expiresAt)))};
 }
 async #event(db:PoolClient,b:Basis,reason:string,outcome='APPLIED'){
  const id=randomUUID(),r=b.row;
  const state=({ENROLLED:'CHALLENGED',PROVED:'PROVED_WAITING_CONFIRMATION',ISSUED:'ISSUED'} as Record<string,string>)[reason]??r.state;
  await db.query("INSERT INTO anvil.audit_events(project_id,server_sequence,event_id,actor_ref,client_ref,target_ref,policy_ref,outcome,reason_code,scope_digest,source_kind) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,$6,$7,$8,$9,'CONNECTOR_PROTOCOL' FROM anvil.audit_events WHERE project_id=$1",[r.project_id,id,JSON.stringify({kind:'CONNECTOR',connectorId:r.connector_id,registrationId:r.id}),r.client_id,JSON.stringify(registrationRef({...r,version:Number(r.version)+1,state})),JSON.stringify(r.policy_ref),outcome,reason,r.scope_digest]);
  await db.query("SELECT set_config('anvil.connector_registration_id',$1,true),set_config('anvil.connector_event_id',$2,true)",[r.id,id]);
 }
 #pending(b:Basis){if(b.row.revoked_at||['REVOKED','REJECTED'].includes(b.row.state)||b.row.connector_status==='REVOKED'||b.row.expires_at.getTime()<=b.now.getTime())throw new AuthFailure('CONNECTOR_REGISTRATION_NOT_PENDING',412);if(Number(b.row.failed_attempts)>=5)throw new AuthFailure('CONNECTOR_PROOF_ATTEMPT_LIMIT',412);}
 async #failure(db:PoolClient,b:Basis,code:string,challengeId?:string):Promise<Outcome>{
  if(Number(b.row.failed_attempts)<5){await this.#event(db,b,'PROOF_DENIED','DENIED');await db.query('UPDATE anvil.connector_registrations SET version=version+1,failed_attempts=failed_attempts+1 WHERE id=$1',[b.row.id]);if(challengeId)await db.query('UPDATE anvil.connector_registration_challenges SET failed_attempts=failed_attempts+1 WHERE id=$1 AND registration_id=$2 AND consumed_at IS NULL AND failed_attempts<5',[challengeId,b.row.id]);}
  return{failure:code,status:412};
 }
 async #newChallenge(db:PoolClient,b:Basis,purpose:string,clientNonce:string,preflightDigest:string|null=null){
  const r=b.row,payload:HostProofPayload={protocolVersion:1,installationId:this.access.installationId,registrationId:r.id,scopeDigest:r.scope_digest,publicKeyFingerprint:r.expected_host_fingerprint,serverNonce:randomBytes(32).toString('base64url'),clientNonce,expiresAt:new Date(Math.min(b.now.getTime()+120000,r.expires_at.getTime(),b.validUntil)).toISOString()},id=randomUUID();
  proofBytes(payload);await db.query('INSERT INTO anvil.connector_registration_challenges(id,project_id,registration_id,purpose,payload_json,expires_at,preflight_digest) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,r.project_id,r.id,purpose,JSON.stringify(payload),payload.expiresAt,preflightDigest]);return{id,payload};
 }
 #view(row:any,generation=Number(row.generation)){return{registrationRef:registrationRef(row),connectorRef:connectorRef(row,generation),scopeDigest:row.scope_digest,grants:[],executionAuthorized:false};}
 async enroll(value:unknown){
  if(!exact(value,'registrationId,oneTimeCode,observedHostFingerprint,clientNonce,connectorVersion,publicKeySpki')||!uuid(value.registrationId)||typeof value.connectorVersion!=='string'||!/^[A-Za-z0-9._+-]{1,80}$/.test(value.connectorVersion))throw new AuthFailure('CONNECTOR_PROTOCOL_INPUT_INVALID',422);
  canonicalBase64(value.oneTimeCode,32);canonicalBase64(value.clientNonce,32);const observed=publicKeyFingerprint(value.publicKeySpki),requestHash=contentHash(canonicalJson({...value,oneTimeCode:contentHash(value.oneTimeCode)}));
  return this.#transaction(async db=>{
   const b=await this.#basis(db,value.registrationId),r=b.row;this.#pending(b);
   if(observed!==value.observedHostFingerprint||observed!==r.expected_host_fingerprint||!equal(contentHash(value.oneTimeCode),r.code_digest))return this.#failure(db,b,'CONNECTOR_HOST_OR_CODE_MISMATCH');
   if(r.state==='CHALLENGED'&&r.enroll_request_hash===requestHash){const challenge=(await db.query("SELECT id,payload_json FROM anvil.connector_registration_challenges WHERE registration_id=$1 AND purpose='HOST_PROOF' AND consumed_at IS NULL AND expires_at>$2",[r.id,b.now])).rows[0];if(!challenge)throw new AuthFailure('CONNECTOR_CHALLENGE_EXPIRED',412);return{value:{status:'HOST_PROOF_REQUIRED',...this.#view(r),challenge:{id:challenge.id,payload:challenge.payload_json}}};}
   if(r.state!=='CREATED'||r.code_consumed_at)return{failure:'CONNECTOR_ENROLLMENT_ALREADY_USED',status:409};
   await this.#event(db,b,'ENROLLED');const challenge=await this.#newChallenge(db,b,'HOST_PROOF',value.clientNonce);
   await db.query('UPDATE anvil.connectors SET public_key_spki=$2,connector_version=$3 WHERE id=$1',[r.connector_id,value.publicKeySpki,value.connectorVersion]);
   await db.query("UPDATE anvil.connector_registrations SET version=version+1,state='CHALLENGED',code_consumed_at=$2,enroll_request_hash=$3,observed_host_fingerprint=$4 WHERE id=$1",[r.id,b.now,requestHash,observed]);
   return{value:{status:'HOST_PROOF_REQUIRED',...this.#view({...r,version:Number(r.version)+1,state:'CHALLENGED'}),challenge}};
  });
 }
 async prove(id:string,value:unknown){
  if(!exact(value,'challengeId,payload,signature')||!uuid(value.challengeId))throw new AuthFailure('CONNECTOR_PROTOCOL_INPUT_INVALID',422);proofBytes(value.payload);canonicalBase64(value.signature,64);
  return this.#transaction(async db=>{
   const b=await this.#basis(db,id),r=b.row;this.#pending(b);if(r.state!=='CHALLENGED')throw new AuthFailure('CONNECTOR_PROOF_NOT_PENDING',412);
   const challenge=(await db.query("SELECT * FROM anvil.connector_registration_challenges WHERE registration_id=$1 AND id=$2 AND purpose='HOST_PROOF' FOR UPDATE",[id,value.challengeId])).rows[0];
   if(!challenge||challenge.consumed_at||Number(challenge.failed_attempts)>=5)return this.#failure(db,b,'CONNECTOR_CHALLENGE_NOT_PENDING');
   try{verifyHostProof(r.public_key_spki,value.signature,value.payload,challenge.payload_json,b.now);}catch{return this.#failure(db,b,'HOST_PROOF_INVALID',challenge.id);}
   await this.#event(db,b,'PROVED');await db.query('UPDATE anvil.connector_registration_challenges SET consumed_at=$2,proof_signature=$3 WHERE id=$1',[challenge.id,b.now,value.signature]);
   await db.query("UPDATE anvil.connector_registrations SET version=version+1,state='PROVED_WAITING_CONFIRMATION',proofed_at=$2 WHERE id=$1",[id,b.now]);
   return{value:{status:'PROVED_WAITING_CONFIRMATION',...this.#view({...r,version:Number(r.version)+1,state:'PROVED_WAITING_CONFIRMATION'}),observedHostFingerprint:r.observed_host_fingerprint}};
  });
 }
 async exchange(id:string,value:unknown){
  if(!exact(value,'kind,payload,signature')&&!exact(value,'kind,challengeId,payload,signature')||!['CHALLENGE','ISSUE'].includes(value.kind))throw new AuthFailure('CONNECTOR_PROTOCOL_INPUT_INVALID',422);
  if(value.kind==='CHALLENGE'&&!exact(value,'kind,payload,signature')||value.kind==='ISSUE'&&(!exact(value,'kind,challengeId,payload,signature')||!uuid(value.challengeId)))throw new AuthFailure('CONNECTOR_PROTOCOL_INPUT_INVALID',422);
  proofBytes(value.payload);canonicalBase64(value.signature,64);
  return this.#transaction(async db=>{
   const b=await this.#basis(db,id),r=b.row;
   if(r.state==='ISSUED')return{failure:'ALREADY_ISSUED_RECONCILE',status:409};this.#pending(b);if(r.state!=='CONFIRMED')throw new AuthFailure('CONNECTOR_HUMAN_CONFIRMATION_REQUIRED',412);
   if(value.kind==='CHALLENGE'){
    const original=(await db.query("SELECT payload_json FROM anvil.connector_registration_challenges WHERE registration_id=$1 AND purpose='HOST_PROOF' AND consumed_at IS NOT NULL",[id])).rows[0];if(!original)throw new AuthFailure('CONNECTOR_HOST_PROOF_REQUIRED',412);
    const expected={...original.payload_json,clientNonce:value.payload.clientNonce,expiresAt:r.expires_at.toISOString()};
    if(expected.clientNonce===original.payload_json.clientNonce)return this.#failure(db,b,'CONNECTOR_FRESH_CLIENT_NONCE_REQUIRED');
    try{verifyHostProof(r.public_key_spki,value.signature,value.payload,expected,b.now);}catch{return this.#failure(db,b,'HOST_PROOF_INVALID');}
    const preflight=contentHash(canonicalJson(value.payload)),previous=(await db.query("SELECT * FROM anvil.connector_registration_challenges WHERE registration_id=$1 AND purpose='EXCHANGE' FOR UPDATE",[id])).rows[0];
    if(previous){if(previous.preflight_digest!==preflight||previous.consumed_at||previous.expires_at.getTime()<=b.now.getTime())throw new AuthFailure('CONNECTOR_EXCHANGE_RECONCILE_REQUIRED',412);return{value:{status:'EXCHANGE_PROOF_REQUIRED',...this.#view(r),challenge:{id:previous.id,payload:previous.payload_json}}};}
    await this.#event(db,b,'EXCHANGE_CHALLENGE');const challenge=await this.#newChallenge(db,b,'EXCHANGE',expected.clientNonce,preflight);await db.query('UPDATE anvil.connector_registrations SET version=version+1 WHERE id=$1',[id]);
    return{value:{status:'EXCHANGE_PROOF_REQUIRED',...this.#view({...r,version:Number(r.version)+1}),challenge}};
   }
   const challenge=(await db.query("SELECT * FROM anvil.connector_registration_challenges WHERE registration_id=$1 AND id=$2 AND purpose='EXCHANGE' FOR UPDATE",[id,value.challengeId])).rows[0];
   if(!challenge||challenge.consumed_at||Number(challenge.failed_attempts)>=5)return this.#failure(db,b,'CONNECTOR_CHALLENGE_NOT_PENDING');
   try{verifyHostProof(r.public_key_spki,value.signature,value.payload,challenge.payload_json,b.now);}catch{return this.#failure(db,b,'HOST_PROOF_INVALID',challenge.id);}
   const credential='av3ct1_'+randomBytes(32).toString('base64url'),credentialId=randomUUID(),expiresAt=new Date(Math.min(b.now.getTime()+900000,b.validUntil)).toISOString();
   await this.#event(db,b,'ISSUED');await db.query("INSERT INTO anvil.connector_credentials(id,project_id,connector_id,registration_id,generation,token_digest,scope,scope_digest,issued_at,expires_at) VALUES($1,$2,$3,$4,$5,$6,'REGISTRATION_STATUS_ONLY',$7,$8,$9)",[credentialId,r.project_id,r.connector_id,r.id,r.generation,contentHash(credential),r.scope_digest,b.now,expiresAt]);
   await db.query('UPDATE anvil.connector_registration_challenges SET consumed_at=$2,proof_signature=$3 WHERE id=$1',[challenge.id,b.now,value.signature]);
   await db.query("UPDATE anvil.connector_registrations SET version=version+1,state='ISSUED',issued_at=$2 WHERE id=$1",[id,b.now]);await db.query("UPDATE anvil.connectors SET status='TRUSTED' WHERE id=$1",[r.connector_id]);
   return{value:{status:'ISSUED',...this.#view({...r,version:Number(r.version)+1,state:'ISSUED'}),scope:'REGISTRATION_STATUS_ONLY',credentialId,credential,expiresAt}};
  });
 }
 async status(connectorId:string,token:string){
  if(!uuid(connectorId)||!/^av3ct1_[A-Za-z0-9_-]{43}$/.test(token))throw new AuthFailure('CONNECTOR_CREDENTIAL_INVALID',401);
  try{return await this.#transaction(async db=>{
   const hint=(await db.query('SELECT connector_id,registration_id FROM anvil.connector_credentials WHERE token_digest=$1',[contentHash(token)])).rows[0];if(!hint)throw new AuthFailure('CONNECTOR_CREDENTIAL_INVALID',401);if(hint.connector_id!==connectorId)throw new AuthFailure('NOT_FOUND',404);
   const b=await this.#basis(db,hint.registration_id,false),r=b.row,credential=(await db.query('SELECT * FROM anvil.connector_credentials WHERE registration_id=$1 AND token_digest=$2 FOR UPDATE',[r.id,contentHash(token)])).rows[0];
   if(!credential||credential.revoked_at||r.revoked_at||r.state!=='ISSUED'||r.connector_status!=='TRUSTED'||credential.scope!=='REGISTRATION_STATUS_ONLY'||credential.scope_digest!==r.scope_digest||Number(credential.generation)!==Number(r.generation)||credential.expires_at.getTime()<=b.now.getTime())throw new AuthFailure('CONNECTOR_CREDENTIAL_INVALID',401);
   return{value:{connectorId,registrationId:r.id,generation:Number(r.generation),status:'REGISTERED_STATUS_ONLY',scope:'REGISTRATION_STATUS_ONLY',publicKeyFingerprint:r.expected_host_fingerprint,expiresAt:credential.expires_at.toISOString(),grants:[],executionAuthorized:false,observedAt:b.now.toISOString()}};
  });}catch(error){if(error instanceof AuthFailure&&[403,409,412].includes(error.statusCode))throw new AuthFailure('CONNECTOR_CREDENTIAL_INVALID',401);throw error;}
 }
}
