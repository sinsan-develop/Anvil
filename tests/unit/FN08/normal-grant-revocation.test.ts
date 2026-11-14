import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const mod:any=await import('../../../apps/server/modules/executions/normal-grant-revocation.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
export const hash=(v:unknown)=>contentHash(canonicalJson(v));
export function revocationFixture(origin?:{grant:any;db:any}){
 const at=Date.now(),pid=origin?.grant.project_id??randomUUID(),eid=origin?.grant.execution_id??randomUUID(),cid=randomUUID(),sid=randomUUID(),uid=randomUUID(),oldUser=origin?.grant.snapshot_json.binding.subject.userId??randomUUID();
 const ref={id:randomUUID(),version:1,contentHash:'a'.repeat(64)},token='t'.repeat(43),csrf='c'.repeat(43);
 const budgetRef=origin?.grant.snapshot_json.binding.intent.budgetPolicyRef??ref;
 const sourceScopes=origin?.grant.snapshot_json.binding.intent.sourceScopes??[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}];
 const rules:any[]=[{ruleId:'REVOKE',subjectRef:{kind:'HUMAN',userId:uid},operations:['revokeExecutionGrant'],targetScopes:[{kind:'EXECUTION',projectId:pid,executionId:eid,executionGeneration:1,sourceScopes}],disposition:'AUTO',limitPolicyRef:budgetRef,expiresAt:new Date(at+3600000).toISOString()}];
 const policy=()=>({rules,reason:'현재 OWNER의 회수 정책',reviewRefs:[]}),policyRef=()=>({...ref,contentHash:hash(policy())});
 const fact={projectId:pid,executionId:eid,executionGeneration:1,transport:'NORMAL_PROTECTED',subject:{userId:oldUser,clientId:randomUUID(),humanSessionId:randomUUID(),credentialGeneration:1,controlGeneration:1},intent:{sourceScopes}};
 const g:any=origin?{...structuredClone(origin.grant),current_generation:1}:{project_id:pid,id:randomUUID(),version:1,execution_id:eid,generation:1,current_generation:1,snapshot_json:{kind:'EXECUTION',state:'GRANTED',transport:'NORMAL_PROTECTED',binding:fact,allowedOperations:['START_SESSION','SEND_INSTRUCTION','REQUEST_STOP'],expiresAt:new Date(at+60000).toISOString(),plannedAt:new Date(at-1000).toISOString(),executionAuthorized:false,dispatchPerformed:false}};
 const seal=()=>{const s=g.snapshot_json;s.factHash=hash(s.binding);s.scopeDigest=hash({binding:s.binding,allowedOperations:s.allowedOperations,expiresAt:s.expiresAt});g.content_hash=hash(s);};if(!origin)seal();
 const state={clock:at,control:2,authGeneration:3,quotaCount:0,quotaBytes:0,policy:true,budget:true,failed:false,lost:false,badTag:false,discarded:0,grantReads:0,afterWrite:()=>{},entries:[] as any[],commands:[] as any[],auth:[] as any[],audits:[] as any[]};
 let checkpoint:any,commandKey:string|undefined,lock=Promise.resolve();
 const rows=(values:any[])=>({rows:values});
 const db:any={release(error?:Error){if(error)state.discarded++;},async query(sql:string,p:any[]=[]){
  if(sql==='BEGIN'){checkpoint=structuredClone({entries:state.entries,commands:state.commands,auth:state.auth,audits:state.audits});commandKey=undefined;return rows([]);}
  if(sql==='COMMIT'){if(state.badTag){Object.assign(state,checkpoint);return{command:'ROLLBACK',rows:[]};}checkpoint=null;if(state.lost)throw Error('RAM_COMMIT_RESPONSE_LOST');return{command:'COMMIT',rows:[]};}
  if(sql==='ROLLBACK'){if(checkpoint)Object.assign(state,checkpoint);return rows([]);}
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return rows([{id:sid,uid,client_id:cid,current_generation:state.authGeneration,credential_generation:state.authGeneration,user_status:'ACTIVE',user_revoked_at:null,client_revoked_at:null,revoked_at:null,idle_expires_at:new Date(at+3600000),absolute_expires_at:new Date(at+3600000),csrf_digest:createHash('sha256').update(csrf).digest('hex'),reauth_until:null,server_owner:false}]);
  if(sql.startsWith('SELECT p.id,p.archived_at'))return rows([{id:pid,participation:'OWNER',archived_at:null}]);
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return rows([{actor_id:uid,client_id:cid,generation:state.control,revoked_at:null}]);
  if(sql.includes('FROM anvil.permission_policies'))return rows(state.policy?[{id:ref.id,head_version:1,rules_json:rules,reason:policy().reason,review_refs:[],content_hash:policyRef().contentHash,created_at:new Date(at)}]:[]);
  if(origin&&sql.includes('FROM anvil.limit_policy_versions'))return origin.db.query(sql,p);
  if(sql.startsWith('SELECT g.*')&&sql.includes('FROM anvil.execution_grants')){state.grantReads++;assert.deepEqual(p,[pid,eid,g.id,1]);return rows([structuredClone(g)]);}
  if(sql.startsWith('SELECT id,version,content_hash FROM anvil.execution_grant_revocations'))return rows(state.entries.filter(r=>r.created_command_id!==commandKey));
  if(sql.startsWith('SELECT count(*)'))return rows([{count:state.entries.length+state.quotaCount,total:state.quotaBytes+state.entries.reduce((n,r)=>n+Buffer.byteLength(canonicalJson(r)),0)}]);
  if(sql.startsWith('SELECT operation,request_hash,result_ref'))return rows(state.commands.filter(c=>c.command_key===p[2]));
  if(sql.startsWith('SELECT clock_timestamp()')||sql.startsWith('SELECT transaction_timestamp()'))return rows([{at:new Date(state.clock),transaction_id:'17'}]);
  if(sql.startsWith('SELECT set_config')){if(sql.includes('anvil.command_id'))commandKey=p[2];return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.commands')){state.commands.push({id:p[0],operation:p[4],command_key:p[5],request_hash:p[6],result_ref:JSON.parse(p[14])});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){state.auth.push(structuredClone(p));return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.audit_events')){state.audits.push(structuredClone(p));return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.execution_grant_revocations')){state.entries.push({id:p[1],version:1,content_hash:p[6],snapshot_json:JSON.parse(p[7]),created_command_id:p[10]});state.afterWrite();if(state.failed)throw Error('RAM_STORAGE_FAILURE');return{rowCount:1,rows:[]};}
  throw Error('UNEXPECTED_SQL '+sql);
 }};
 const access=new AccessRepository({connect:async()=>{const before=lock;let release=()=>{};lock=new Promise<void>(r=>release=r);await before;return{query:db.query,release:(e?:Error)=>{db.release(e);release();}};}} as any,{installationId:pid,key:randomBytes(32)});
 const policies:any={async resolveCurrent(){if(!state.budget)throw Error('LIMIT_POLICY_REVOKED');return{ref:budgetRef,snapshot:{expiresAt:new Date(at+3600000).toISOString()}};}};
 const request=()=>({schemaVersion:1 as const,projectId:pid,commandId:randomUUID(),clientId:cid,controlGeneration:2,operation:'revokeExecutionGrant',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{grantRef:{id:g.id,version:1,contentHash:g.content_hash},permissionPolicyRef:policyRef(),budgetPolicyRef:budgetRef,reason:'허가 저장을 회수한다'}});
 const run=(q=request())=>{assert.equal(typeof mod.NormalGrantRevocations,'function','normal 회수 생산자가 필요하다');return new mod.NormalGrantRevocations(access,policies).command(token,csrf,q);};
 return{pid,eid,cid,sid,uid,oldUser,at,g,seal,state,rules,policyRef,request,run,access,db,token,csrf,policies};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
test('다른 OWNER가 ACTIVE/EXPIRED normal grant를 회수하고 같은 원영수증을 재조회한다',async()=>{
 for(const expired of [false,true]){const f=revocationFixture();if(expired){f.g.snapshot_json.expiresAt=new Date(f.at-1).toISOString();f.seal();}const q=f.request(),r=await f.run(q);
  assert.equal(r.status,'APPLIED');assert.equal(r.data.status,'NORMAL_GRANT_REVOCATION_STORED');assert.equal(r.data.snapshot.state,'NORMAL_REVOCATION_STORED');assert.equal(r.data.snapshot.transport,'NORMAL_PROTECTED');
  assert.equal(r.data.snapshot.requestedBy.userId,f.uid);assert.equal(r.data.snapshot.currentBinding.grantSubject.userId,f.oldUser);assert.equal(r.data.snapshot.currentBinding.grantState,expired?'EXPIRED':'ACTIVE');
  for(const k of ['revocationEffectiveVerified','credentialRevocationVerified','writerReleaseVerified','executionAuthorized','dispatchPerformed']){assert.equal(r.data[k],false);assert.equal(r.data.snapshot[k],false);}
  assert.deepEqual(await f.run(q),r);assert.equal(f.state.entries.length,1);assert.equal(f.state.commands.length,1);await assert.rejects(f.run(),/GRANT_ALREADY_REVOKED/);
 }
});
test('원 grant hash/fact/scope/fullref/세대 및 현재 정책·제어 위반은 회수행 0이다',async()=>{
 for(const mode of ['HASH','FACT','DIGEST','SUBJECT','SCOPE','VERSION','GENERATION','REF','CONTROL','POLICY','DENY','APPROVAL','BUDGET']){const f=revocationFixture(),q=f.request();
  if(mode==='HASH')f.g.content_hash='b'.repeat(64);if(mode==='FACT'){f.g.snapshot_json.factHash='b'.repeat(64);f.g.content_hash=hash(f.g.snapshot_json);q.payload.grantRef.contentHash=f.g.content_hash;}
  if(mode==='DIGEST'){f.g.snapshot_json.scopeDigest='b'.repeat(64);f.g.content_hash=hash(f.g.snapshot_json);q.payload.grantRef.contentHash=f.g.content_hash;}
  if(mode==='SUBJECT'){f.g.snapshot_json.binding.subject.userId='bad';f.seal();q.payload.grantRef.contentHash=f.g.content_hash;}if(mode==='SCOPE'){f.g.snapshot_json.binding.intent.sourceScopes=[];f.seal();q.payload.grantRef.contentHash=f.g.content_hash;}
  if(mode==='VERSION')f.g.version=2;if(mode==='GENERATION')f.g.current_generation=2;if(mode==='REF')q.payload.grantRef.contentHash='c'.repeat(64);if(mode==='CONTROL')f.state.control=3;if(mode==='POLICY')f.state.policy=false;if(mode==='BUDGET')f.state.budget=false;
  if(mode==='DENY'||mode==='APPROVAL'){f.rules[0].disposition=mode==='DENY'?'DENY':'REQUIRE_APPROVAL';q.payload.permissionPolicyRef=f.policyRef();}
  await assert.rejects(f.run(q),mode);assert.equal(f.state.entries.length,0,mode);assert.equal(f.state.commands.length,0,mode);
 }
});
test('부분쓰기 rollback, 저장중 정책철회 및 COMMIT 불명은 새 성공으로 변환하지 않는다',async()=>{
 for(const mode of ['WRITE','POLICY','CONTROL','IDENTITY','DEADLINE','TAG','LOST']){const f=revocationFixture(),q=f.request();f.state.failed=mode==='WRITE';f.state.badTag=mode==='TAG';f.state.lost=mode==='LOST';f.state.afterWrite=()=>{if(mode==='POLICY')f.state.policy=false;if(mode==='CONTROL')f.state.control=3;if(mode==='IDENTITY')f.state.authGeneration=4;if(mode==='DEADLINE')f.state.clock+=31000;};
  await assert.rejects(f.run(q));assert.equal(f.state.entries.length,mode==='LOST'?1:0,mode);
  if(mode==='TAG'||mode==='LOST')assert.equal(f.state.discarded,1);
  if(mode==='LOST'){const original=structuredClone(f.state.commands[0].result_ref);f.state.lost=false;assert.deepEqual(await f.run(q),original);assert.equal(f.state.entries.length,1);}
 }
});
test('동시 중복은 하나만 저장하고 같은 명령의 다른 내용은 충돌한다',async()=>{const f=revocationFixture(),q=f.request();const results=await Promise.allSettled([f.run(q),f.run(q)]);assert(results.every(r=>r.status==='fulfilled'));assert.equal(f.state.entries.length,1);q.payload.reason='다른 내용';await assert.rejects(f.run(q),/IDEMPOTENCY_CONFLICT/);});
test('정규 synthetic 생산자의 원영수증은 normal replay에서 표식/시각을 바꾸지 않는다',async()=>{
 const {ProjectExecutionGrantRevocations}=await import('../../../apps/server/modules/executions/execution-grant-revocation.ts');
 const f=revocationFixture();f.g.snapshot_json.transport='SYNTHETIC_ONLY';f.seal();const q=f.request();
 const port:any={transport:'SYNTHETIC_ONLY',async current(_db:any,_actor:any,scope:any){return{transport:'SYNTHETIC_ONLY',scope,grantRef:q.payload.grantRef,grantKind:'EXECUTION',grantSubject:f.g.snapshot_json.binding.subject,grantState:'ACTIVE',sourceScopes:f.g.snapshot_json.binding.intent.sourceScopes,permissionPolicyRef:q.payload.permissionPolicyRef,budgetPolicyRef:q.payload.budgetPolicyRef,checkedAt:new Date(f.state.clock).toISOString(),expiresAt:new Date(f.state.clock+30000).toISOString()};},async append(_db:any,_scope:any,entry:any,cid:string){f.state.entries.push({...entry,created_command_id:cid});}};
 const original=await new ProjectExecutionGrantRevocations(f.access,port,f.policies).command(f.token,f.csrf,q as any);
 assert.equal((original as any).data.status,'SYNTHETIC_GRANT_REVOCATION_STORED');f.state.clock+=31000;
 assert.deepEqual(await f.run(q),original);assert.equal(f.state.entries.length,1);
 f.state.policy=false;await assert.rejects(f.run(q));assert.equal(f.state.entries.length,1);
});
test('기존 receipt의 혼합 표식/참값은 거절하고 세대별 100건/2MiB 한도를 유지한다',async()=>{
 for(const kind of ['STATUS','TRANSPORT','STATE','FLAG']){const f=revocationFixture(),q=f.request();await f.run(q);const d=f.state.commands[0].result_ref.data;
  if(kind==='STATUS')d.status='OTHER';if(kind==='TRANSPORT')d.snapshot.transport='SYNTHETIC_ONLY';if(kind==='STATE')d.snapshot.state='SYNTHETIC_REVOCATION_STORED';if(kind==='FLAG')d.dispatchPerformed=true;
  d.ref.contentHash=hash(d.snapshot);await assert.rejects(f.run(q));assert.equal(f.state.entries.length,1);
 }
 for(const bytes of [false,true]){const f=revocationFixture();if(bytes)f.state.quotaBytes=2097152;else f.state.quotaCount=100;await assert.rejects(f.run(),/GRANT_REVOCATION_TOO_LARGE/);assert.equal(f.state.entries.length,0);}
});

}
