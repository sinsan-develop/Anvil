import {generateKeyPairSync,sign} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {registrationRef,connectorRef} from '../../../apps/server/modules/connections/project-registrations.ts';
import {sourceReadFixture,a3Id,rehashReport} from './source-read-fixtures.ts';
import {sourceReadReportProofBytesV1} from '../../../contracts/runtime/source-read-report-v1.ts';
import {readSourceReadScopeV1} from '../../../contracts/runtime/source-read-observation-v1.ts';
export function protocolFixture(grantTtl=240000){
 const original=sourceReadFixture(),start=Date.now(),at=(ms:number)=>new Date(start+ms),time={now:at(0)};
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url'),fingerprint=publicKeyFingerprint(spki);
 const rules=[{ruleId:'read',subjectRef:{kind:'HUMAN',userId:original.scope.userId},operations:['registerConnector','requestSourceReadObservation','revokeSourceReadObservation'],targetScopes:[{kind:'PROJECT',projectId:original.scope.projectId}],disposition:'AUTO',limitPolicyRef:null,expiresAt:at(3600000).toISOString()}];
 const policy={id:original.scope.policyRef.id,head_version:1,rules_json:rules,reason:'합성 protocol 정책',review_refs:[],content_hash:contentHash(canonicalJson({rules,reason:'합성 protocol 정책',reviewRefs:[]})),created_at:at(-2000)},policyRef={id:policy.id,version:1,contentHash:policy.content_hash};
 const oldScope={kind:'HOST_TRUST_REGISTRATION',installationId:original.scope.installationId,projectId:original.scope.projectId,subject:{kind:'HUMAN',userId:original.scope.userId,clientId:original.scope.clientId,credentialGeneration:2,controlGeneration:3},policyRef,expectedHostFingerprint:fingerprint,hostLabel:'합성 host',expiresAt:at(600000).toISOString(),credentialScope:'REGISTRATION_STATUS_ONLY',grants:[]};
 const registration:any={id:original.scope.registrationRef.id,connector_id:original.scope.connectorRef.id,project_id:original.scope.projectId,requested_by:original.scope.userId,client_id:original.scope.clientId,session_id:a3Id(40),credential_generation:2,control_generation:3,version:7,state:'ISSUED',scope_json:oldScope,scope_digest:contentHash(canonicalJson(oldScope)),policy_ref:policyRef,expires_at:at(600000),created_at:at(-2000),proofed_at:at(-1500),issued_at:at(-1400),revoked_at:null,failed_attempts:0,expected_host_fingerprint:fingerprint,observed_host_fingerprint:fingerprint,host_fingerprint:fingerprint,public_key_spki:spki,generation:1,host_label:'합성 host',owner_user_id:original.scope.userId,host_client:original.scope.clientId,host_credential_generation:2,connector_state:'TRUSTED',host_revoked_at:null,created_operation:'registerConnector',created_actor:original.scope.userId,created_client:original.scope.clientId,created_state:'APPLIED'};
 registration.created_result={status:'APPLIED',data:{status:'REGISTRATION_CREATED',scope:oldScope,scopeDigest:registration.scope_digest,registrationRef:registrationRef({...registration,version:1,state:'CREATED'}),connectorRef:connectorRef(registration,1),oneTimeCode:null}};
 const source={declaration:{hostLabel:'合성 host',displayName:'합성 source',pathHint:original.permit.root.pathHint,reason:'합성 선언',connectorId:registration.connector_id},status:'DECLARED',authority:'USER_DECLARED',readiness:'UNVERIFIED',reason:'합성 등록'};
 const scope=readSourceReadScopeV1({...original.scope,sourceRootRef:{...original.scope.sourceRootRef,contentHash:contentHash(canonicalJson(source))},registrationRef:registrationRef(registration),connectorRef:connectorRef(registration,1),policyRef,hostFingerprint:fingerprint,requestedAt:at(-1000).toISOString(),expiresAt:at(grantTtl).toISOString()}),grantRef={...original.grantRef,contentHash:contentHash(canonicalJson(scope))};
 const grant:any={id:grantRef.id,project_id:scope.projectId,version:1,source_root_id:scope.sourceRootRef.id,source_root_version:1,source_root_hash:scope.sourceRootRef.contentHash,connector_id:scope.connectorRef.id,connector_generation:1,registration_id:scope.registrationRef.id,registration_version:scope.registrationRef.version,requested_by:scope.userId,client_id:scope.clientId,session_id:a3Id(40),credential_generation:2,control_generation:3,policy_ref:policyRef,scope_json:scope,scope_digest:grantRef.contentHash,created_command_id:a3Id(41),created_at:at(-1000),expires_at:at(240000),revoked_at:null,revoke_command_id:null,exchange_failures:0,created_operation:'requestSourceReadObservation',created_state:'APPLIED',created_actor:scope.userId,created_client:scope.clientId,created_expected_version:0,source_declaration_json:source.declaration,source_status:source.status,source_authority:source.authority,source_readiness:source.readiness,source_reason:source.reason,source_content_hash:scope.sourceRootRef.contentHash,source_head_version:1};
 grant.created_result={status:'APPLIED',targetId:grantRef.id,version:1,data:{status:'GRANT_RECORDED',ref:grantRef,grantRef,scopeDigest:grantRef.contentHash,storedState:'CREATED',scope,observationPermit:'NOT_ISSUED',executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false}};
 grant.expires_at=at(grantTtl);
 const preflight={...original.preflight,grantRef,scopeDigest:grantRef.contentHash,publicKeyFingerprint:fingerprint,expiresAt:scope.expiresAt};
 const stored:{challenge:any;credential:any;snapshot:any;current:boolean;viewer:boolean}={challenge:null,credential:null,snapshot:null,current:true,viewer:false};
 const writes:{sql:string;args:any[]}[]=[],transactions:string[]=[];let connects=0;
 const db:any={release(){},async query(input:string|{text:string;values?:any[]},args:any[]=[]){
  const sql=typeof input==='string'?input:input.text;if(typeof input!=='string')args=input.values??[];
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)){transactions.push(sql);return{rows:[]};}
  if(sql.startsWith('SET LOCAL'))return{rows:[]};
  if(sql.includes('FROM anvil.source_read_grants g JOIN anvil.connectors'))return{rows:args[0]===grant.id&&args[1]===grant.connector_id?[{...grant,public_key_spki:spki}]:[]};
  if(sql.includes('FROM anvil.users u JOIN anvil.auth_sessions'))return{rows:[{id:scope.userId,credential_generation:2,session_generation:2,user_status:'ACTIVE',user_revoked_at:null,session_revoked_at:null,client_revoked_at:null,reauth_until:at(60000),absolute_expires_at:at(3600000),idle_expires_at:at(1800000)}]};
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:scope.projectId,archived_at:null,participation:stored.viewer?'VIEWER':'OWNER'}]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:scope.userId,client_id:scope.clientId,generation:3,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies p JOIN'))return{rows:[policy]};
  if(sql.includes('SELECT head_version FROM anvil.source_roots'))return{rows:[{head_version:1}]};
  if(sql.includes('FROM anvil.connector_registrations r JOIN anvil.connectors h'))return{rows:[registration]};
  if(sql.includes('FROM anvil.source_read_grants g'))return{rows:[grant]};
  if(sql.includes('clock_timestamp()'))return{rows:[{at:time.now}]};
  if(sql.includes('source_read_basis_current')||sql.includes('connector_basis_current'))return{rows:[{ok:stored.current}]};
  if(sql.includes('FROM anvil.connector_credentials'))return{rows:[{issued_at:at(-1400),expires_at:at(600000),revoked_at:null}]};
  if(sql.includes('FROM anvil.source_read_challenges'))return{rows:stored.challenge?[stored.challenge]:[]};
  if(sql.includes('FROM anvil.source_read_credentials'))return{rows:stored.credential&&(!sql.includes('WHERE token_digest')||args[0]===stored.credential.token_digest)?[stored.credential]:[]};
  if(sql.includes('FROM anvil.source_snapshots'))return{rows:stored.snapshot?[stored.snapshot]:[]};
  if(sql.startsWith('SELECT EXISTS')&&sql.includes('FROM anvil.audit_events'))return{rows:[{ok:true}]};
  if(sql.startsWith('INSERT')||sql.startsWith('UPDATE')||sql.startsWith('SELECT set_config')){
   writes.push({sql,args});
   if(sql.startsWith('INSERT INTO anvil.source_read_challenges'))stored.challenge={id:args[0],project_id:args[1],grant_id:args[2],preflight_digest:args[3],payload_json:JSON.parse(args[4]),created_at:args[5],expires_at:new Date(args[6]),consumed_at:null,proof_signature:null,failed_attempts:0};
   if(sql.startsWith('UPDATE anvil.source_read_grants SET exchange_failures'))grant.exchange_failures++;
   if(sql.startsWith('UPDATE anvil.source_read_challenges SET consumed_at')){stored.challenge.consumed_at=args[2];stored.challenge.proof_signature=args[3];}
   if(sql.startsWith('INSERT INTO anvil.source_read_credentials'))stored.credential={id:args[0],project_id:args[1],grant_id:args[2],connector_id:args[3],connector_generation:args[4],token_digest:args[5],scope:'SOURCE_OBSERVE_READ_ONLY',scope_digest:args[6],issued_at:args[7],expires_at:new Date(args[8]),revoked_at:null,consumed_at:null};
   if(sql.startsWith('INSERT INTO anvil.source_snapshots'))stored.snapshot={project_id:args[0],id:args[1],version:1,grant_id:args[2],report_command_id:args[3],source_root_id:args[4],source_root_version:args[5],connector_id:args[6],generation:args[7],scope_digest:args[8],report_json:JSON.parse(args[9]),content_hash:args[10],signature:args[11],observed_at:new Date(args[12]),finished_at:new Date(args[13]),received_at:args[14],evidence_class:'CONNECTOR_REPORTED',os_verification:'UNVERIFIED'};
   if(sql.startsWith('UPDATE anvil.source_read_credentials SET consumed_at'))stored.credential.consumed_at=args[2];
   return{rows:[],rowCount:1};
  }
  throw Error('UNEXPECTED_SYNTHETIC_QUERY:'+sql.slice(0,80));
 }};
 const access:any={installationId:scope.installationId,pool:{async connect(){connects++;return db;}}};
 const signed=(payload:unknown)=>sign('sha256',Buffer.from(canonicalJson(payload)),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const report=(changes:Record<string,unknown>={})=>{const value=rehashReport({...original.report,grantRef,scopeDigest:grantRef.contentHash,connectorRef:scope.connectorRef,hostFingerprint:scope.hostFingerprint,observedAt:at(1000).toISOString(),finishedAt:at(2000).toISOString(),root:{...original.report.root,facts:{...original.report.root.facts,declaredRootRef:scope.sourceRootRef}},...changes}),context={scope,grantRef,credentialIssuedAt:stored.credential.issued_at.toISOString(),credentialExpiresAt:stored.credential.expires_at.toISOString(),receivedAt:time.now.toISOString()};return{...value,signature:sign('sha256',sourceReadReportProofBytesV1(value,context),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};};
 return{access,scope,grantRef,preflight,grant,registration,stored,writes,transactions,time,at,spki,signed,report,connects:()=>connects};
}
