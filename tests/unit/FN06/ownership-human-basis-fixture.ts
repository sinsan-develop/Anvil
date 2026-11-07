import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readOwnershipHumanPolicyRegistrationBasis} from '../../../apps/server/modules/executions/ownership-human-basis.ts';
import {ownershipArchiveFixture} from './ownership-archive-fixture.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
export async function ownershipHumanBasisFixture(options:{humanCredentialGeneration?:number;disposition?:'AUTO'|'REQUIRE_APPROVAL'}={}){
 const f=await ownershipArchiveFixture(),prep=f.requestBasis().preparation,s=prep.snapshot,now=new Date(f.requestBasis().nowMs),end=new Date(now.getTime()+60000),row=f.authRow;
 s.subject.credentialGeneration=options.humanCredentialGeneration??1;row.credential_generation=s.subject.credentialGeneration;row.current_generation=s.subject.credentialGeneration;
 const rules=[{ruleId:'prepare',subjectRef:{kind:'HUMAN',userId:s.subject.userId},operations:['prepareOwnershipAnchor','registerConnector'],targetScopes:[{kind:'PROJECT',projectId:s.scope.projectId}],disposition:(options.disposition??'AUTO') as string,limitPolicyRef:null,expiresAt:end.toISOString()}];
 const policy={id:s.payload.policyRef.id,head_version:1,rules_json:rules,reason:'synthetic',review_refs:[],content_hash:'',created_at:new Date(now.getTime()-1)};
 const updatePolicy=()=>{policy.content_hash=hash({rules:policy.rules_json,reason:policy.reason,reviewRefs:policy.review_refs});s.payload.policyRef={id:policy.id,version:1,contentHash:policy.content_hash};};updatePolicy();
 const scope={kind:'HOST_TRUST_REGISTRATION',installationId:s.scope.installationId,projectId:s.scope.projectId,subject:{kind:'HUMAN',userId:s.subject.userId,clientId:s.subject.clientId,credentialGeneration:s.subject.credentialGeneration,controlGeneration:s.subject.controlGeneration},policyRef:s.payload.policyRef,expectedHostFingerprint:s.payload.publicKeyFingerprint,hostLabel:'synthetic',expiresAt:end.toISOString(),credentialScope:'REGISTRATION_STATUS_ONLY',grants:[]};
 const registration={id:s.registrationRef.id,project_id:s.scope.projectId,version:4,state:'ISSUED',requested_by:s.subject.userId,client_id:s.subject.clientId,session_id:s.subject.humanSessionId,credential_generation:s.subject.credentialGeneration,control_generation:1,revoked_at:null,connector_revoked_at:null,connector_status:'TRUSTED',owner_user_id:s.subject.userId,connector_client_id:s.subject.clientId,connector_credential_generation:s.subject.credentialGeneration,host_fingerprint:scope.expectedHostFingerprint,expected_host_fingerprint:scope.expectedHostFingerprint,observed_host_fingerprint:scope.expectedHostFingerprint,public_key_spki:f.publicKeySpki,scope_json:scope,scope_digest:hash(scope),policy_ref:s.payload.policyRef,expires_at:end};
 const updateRegistration=()=>{registration.scope_digest=hash(registration.scope_json);s.registrationRef={id:registration.id,version:registration.version,contentHash:hash({registrationId:registration.id,version:registration.version,state:registration.state,scopeDigest:registration.scope_digest})};};updateRegistration();
 const control={actor_id:row.uid,client_id:row.client_id,generation:1,revoked_at:null},member={id:s.scope.projectId,participation:'OWNER',archived_at:null};
 let missingPolicy=false,missingRegistration=false,late=false;const calls:string[]=[];
 const db={async query(sql:string,args:any[]=[]){calls.push(sql);
  if(sql.includes('FROM anvil.auth_sessions')){assert.deepEqual(args,[createHash('sha256').update(f.authToken).digest('hex')]);return{rows:[row]};}
  if(sql.includes('clock_timestamp()'))return{rows:[{at:late?end:now,transaction_id:'77'}]};
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members')){assert.deepEqual(args,[s.scope.projectId,row.uid]);assert.match(sql,/FOR UPDATE/);return{rows:[member]};}
  if(sql.includes('FROM anvil.project_control')){assert.deepEqual(args,[s.scope.projectId]);return{rows:[control]};}
  if(sql.includes('FROM anvil.permission_policies')){assert.deepEqual(args,[s.scope.projectId]);return{rows:missingPolicy?[]:[policy]};}
  if(sql.includes('FROM anvil.connector_registrations')){assert.deepEqual(args,[s.scope.projectId,s.registrationRef.id]);assert.match(sql,/FOR SHARE OF r,h/);return{rows:missingRegistration?[]:[registration]};}
  throw Error('UNEXPECTED_QUERY');
 },release(){throw Error('CALLER_OWNS_CONNECTION');}} as unknown as PoolClient;
 const read=async()=>{prep.ref.contentHash=hash(prep.snapshot);return readOwnershipHumanPolicyRegistrationBasis(db,f.access,f.authToken,f.csrf,prep);};
 return{read,db,access:f.access,token:f.authToken,csrf:f.csrf,now,row,prep,policy,rules,scope,registration,control,member,calls,signObservation:f.signed,updatePolicy,updateRegistration,noPolicy(){missingPolicy=true;},noRegistration(){missingRegistration=true;},late(){late=true;}};
}
