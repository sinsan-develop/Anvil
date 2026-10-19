import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const mod:any=await import('../../../apps/server/modules/executions/execution-recovery.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const pid='11111111-1111-4111-8111-111111111111',eid='22222222-2222-4222-8222-222222222222',cid='33333333-3333-4333-8333-333333333333',sid='44444444-4444-4444-8444-444444444444',ref={id:pid,version:1,contentHash:'a'.repeat(64)},hash=(v:unknown)=>contentHash(canonicalJson(v)),scope={projectId:pid,executionId:eid,executionGeneration:1};
function fixture(){
 assert.equal(typeof mod.ProjectExecutionRecovery,'function');const at=Date.now(),token='t'.repeat(43),csrf='c'.repeat(43);let clock=at,reauthUntil:Date|null=new Date(at+300000),control=2,revoked=false,failed=false,change=false,calls=0,entries:any[]=[],commands:any[]=[],checkpoint:any;
 const scopes=[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}],rules=[{ruleId:'recovery',subjectRef:{kind:'HUMAN',userId:pid},operations:['authorizeExecutionRecovery'],targetScopes:[{kind:'EXECUTION',...scope,sourceScopes:scopes}],disposition:'AUTO',limitPolicyRef:ref,expiresAt:new Date(at+3600000).toISOString()}];
 const policy=()=>({rules,reason:'합성 회수 전용 정책',reviewRefs:[]}),policyRef=()=>({...ref,contentHash:hash(policy())});
 const current:any={transport:'SYNTHETIC_ONLY',scope:structuredClone(scope),originalGrantRef:ref,originalGrantState:'REVOKED',lastServerAck:{sequence:8,batchRef:ref},processIdentity:{state:'UNKNOWN'},responsibleSessionRef:ref,registration:{ref,connectorId:pid,generation:1,hostPublicKeyFingerprint:'b'.repeat(64)},sourceScopes:scopes,permissionPolicyRef:policyRef(),budgetPolicyRef:ref,hostTrustState:'TRUSTED',recoveryPathState:'VERIFIED_CURRENT',checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+60000).toISOString()};
 const db:any={query:async(sql:string,p:any[]=[])=>{
  if(sql==='BEGIN'){checkpoint=structuredClone({entries,commands});return{rows:[]};}if(sql==='COMMIT')return{rows:[]};if(sql==='ROLLBACK'){({entries,commands}=checkpoint);return{rows:[]};}
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return{rows:[{id:sid,uid:pid,client_id:cid,current_generation:3,credential_generation:3,user_status:'ACTIVE',user_revoked_at:null,client_revoked_at:null,revoked_at:null,idle_expires_at:new Date(at+3600000),absolute_expires_at:new Date(at+3600000),csrf_digest:createHash('sha256').update(csrf).digest('hex'),reauth_until:reauthUntil,server_owner:false}]};
  if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:pid,participation:'OWNER',archived_at:null}]};if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:pid,client_id:cid,generation:control,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies'))return{rows:revoked?[]:[{id:pid,head_version:1,rules_json:rules,reason:policy().reason,review_refs:[],content_hash:policyRef().contentHash,created_at:new Date(at)}]};
  if(sql.startsWith('SELECT operation,request_hash,result_ref'))return{rows:commands.filter(c=>c.command_key===p[2])};if(sql.startsWith('SELECT clock_timestamp()')||sql.startsWith('SELECT transaction_timestamp()'))return{rows:[{at:new Date(clock)}]};
  if(sql.startsWith('INSERT INTO anvil.commands')){commands.push({operation:p[4],command_key:p[5],request_hash:p[6],result_ref:JSON.parse(p[14])});return{rows:[]};}if(sql.startsWith('INSERT INTO anvil.authorization_receipts')||sql.startsWith('INSERT INTO anvil.audit_events')||sql.startsWith('SELECT set_config'))return{rows:[]};throw Error('UNEXPECTED_SQL '+sql);
 },release:()=>{}};
 const store:any={transport:'SYNTHETIC_ONLY',current:async(tx:any,_actor:any,s:any)=>{assert.equal(tx,db);assert.deepEqual(s,scope);calls++;if(change&&calls===2)current.lastServerAck={sequence:9,batchRef:ref};return structuredClone(current);},append:async(tx:any,s:any,record:any,commandId:string)=>{assert.equal(tx,db);assert.deepEqual(s,scope);assert.equal(typeof commandId,'string');entries.push(structuredClone(record));if(failed)throw Error('STORAGE_FAILURE');}};
 const policies:any={resolveCurrent:async()=>({ref,snapshot:{expiresAt:new Date(at+3600000).toISOString()}})},access=new AccessRepository({connect:async()=>db} as any,{installationId:pid,key:randomBytes(32)}),service=new mod.ProjectExecutionRecovery(access,store,policies);
 const request=()=>({schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:cid,controlGeneration:2,operation:'authorizeExecutionRecovery',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{lastServerAck:structuredClone(current.lastServerAck),processIdentity:structuredClone(current.processIdentity),permissionPolicyRef:policyRef(),budgetPolicyRef:ref,purpose:'RECOVER_OBSERVATIONS_AND_REQUEST_GRACEFUL_STOP',reason:'원 실행 회수 뒤 남은 사건과 중지 지시 회수'}});
 return{current,rules,store,policies,request,run:(r=request())=>service.command(token,csrf,r),entries:()=>entries,commands:()=>commands,reauth:(v:Date|null)=>reauthUntil=v,stale:()=>control=3,revoke:()=>revoked=true,fail:()=>failed=true,change:()=>change=true,advance:(ms:number)=>clock=at+ms,at};
}
test('회수된 원 grant의 같은 실행/ACK/미확인 process를 별도 HUMAN 재인증·정책으로 저장하고 작업 권한을 열지 않는다',async()=>{
 const f=fixture(),r=f.request(),result=await f.run(r),s=result.data.snapshot;assert.equal(result.status,'APPLIED');assert.equal(result.data.status,'SYNTHETIC_RECOVERY_STORED');assert.equal(s.kind,'RECOVERY');assert.deepEqual(s.allowedOperations,['SYNC_OBSERVATIONS','READ_STOP_INSTRUCTION','REPORT_STOP','HEARTBEAT']);assert.equal(s.binding.originalGrantState,'REVOKED');assert.equal(s.reviewer.humanSessionId,sid);assert.equal(Date.parse(s.expiresAt),f.at+60000);assert.equal(s.executionAuthorized,false);assert.equal(s.dispatchPerformed,false);assert.equal(s.writerReleaseVerified,false);assert.equal(f.entries().length,1);assert.equal(f.entries()[0].ref.contentHash,hash(s));assert.deepEqual(await f.run(r),result);assert.equal(f.entries().length,1);assert.equal(f.current.lastServerAck.sequence,8);
});
test('현재 재인증/제어·회수 명시정책 없거나 DENY/다른 권한·승인 필요이면 새 계획은0이다',async()=>{
 for(const mode of ['REAUTH','EXPIRED','CONTROL','POLICY','DENY','OTHER_OPERATION','APPROVAL']){const f=fixture();if(mode==='REAUTH')f.reauth(null);if(mode==='EXPIRED')f.reauth(new Date(f.at));if(mode==='CONTROL')f.stale();if(mode==='POLICY')f.revoke();if(mode==='DENY')f.rules[0]!.disposition='DENY';if(mode==='OTHER_OPERATION')f.rules[0]!.operations=['authorizeExecution'];if(mode==='APPROVAL')f.rules[0]!.disposition='REQUIRE_APPROVAL';await assert.rejects(f.run());assert.equal(f.entries().length,0);assert.equal(f.commands().length,0);}
});
test('원 grant 만료는 회수 자체를 막지 않지만 host신뢰/경로·현재 ACK/process/scope 불일치는 거절한다',async()=>{
 const accepted=fixture();accepted.current.originalGrantState='EXPIRED';accepted.current.processIdentity={state:'KNOWN',ref};assert.equal((await accepted.run()).data.snapshot.binding.processIdentity.state,'KNOWN');
 for(const mutate of [(f:any)=>f.current.hostTrustState='REVOKED',(f:any)=>f.current.recoveryPathState='UNVERIFIED',(f:any)=>f.current.scope.executionGeneration=2,(f:any)=>f.current.registration.hostPublicKeyFingerprint='bad',(f:any)=>f.current.checkedAt=new Date(f.at-30001).toISOString()]){const f=fixture();mutate(f);await assert.rejects(f.run());assert.equal(f.entries().length,0);}
 const f=fixture(),r=f.request();r.payload.lastServerAck.sequence=9;await assert.rejects(f.run(r));assert.equal(f.entries().length,0);const g=fixture(),q=g.request();q.payload.processIdentity={state:'KNOWN',ref};await assert.rejects(g.run(q));
});
test('동일 명령은 원 기한/결과만 재조회하고 다른 hash는 충돌, 저장실패와 await중 현재변경은 모두 rollback한다',async()=>{
 const f=fixture(),r=f.request(),first=await f.run(r);assert.deepEqual(await f.run(r),first);r.payload.reason='다른 이유';await assert.rejects(f.run(r),/IDEMPOTENCY_CONFLICT/);const g=fixture();g.fail();await assert.rejects(g.run());assert.equal(g.entries().length,0);assert.equal(g.commands().length,0);const h=fixture();h.change();await assert.rejects(h.run());assert.equal(h.entries().length,0);
 const i=fixture(),append=i.store.append;i.store.append=async(...args:any[])=>{await append(...args);i.advance(60000);};await assert.rejects(i.run());assert.equal(i.entries().length,0);assert.equal(i.commands().length,0);
});
test('caller 변조·일반자료/START권한 추가·비밀이유·비합성 port는 현재 회수계약을 넓히지 못한다',async()=>{
 for(const mutate of [(r:any)=>r.payload.allowedOperations=['START_SESSION'],(r:any)=>r.payload.lastServerAck.batchRef=null,(r:any)=>r.payload.processIdentity={state:'KNOWN',pid:123},(r:any)=>r.payload.reason='api_key=abcdefghijk123456789']){const f=fixture(),r=f.request();mutate(r);await assert.rejects(f.run(r));assert.equal(f.entries().length,0);}
 const f=fixture(),r=f.request(),raw=hash(r),read=f.store.current;f.store.current=async(...args:any[])=>{r.payload.reason='외부 변조';return read(...args);};await f.run(r);assert.equal(f.entries()[0].snapshot.requestHash,raw);const g=fixture();g.store.transport='REAL';await assert.rejects(g.run());assert.equal(g.entries().length,0);
});
test('마지막 정책 읽기 중 현재 자료 기한이 지나면 영수증과 회수 계획을 함께 rollback한다',async()=>{
 const f=fixture(),resolve=f.policies.resolveCurrent;let calls=0;f.policies.resolveCurrent=async(...args:any[])=>{const result=await resolve(...args);if(++calls===3)f.advance(60000);return result;};await assert.rejects(f.run());assert.equal(f.entries().length,0);assert.equal(f.commands().length,0);
});
test('마지막 current/정책의 더 짧은 기한이나 최종 await 뒤 30초 초과 current는 저장 기한을 늘리지 못한다',async()=>{
 for(const mode of ['SHORT_CURRENT','STALE_AFTER_POLICY','SHORT_POLICY']){const f=fixture(),read=f.store.current,resolve=f.policies.resolveCurrent;let reads=0,policies=0;
  f.store.current=async(...args:any[])=>{const result=await read(...args);if(++reads===3&&mode==='SHORT_CURRENT')result.expiresAt=new Date(f.at+10000).toISOString();return result;};
  f.policies.resolveCurrent=async(...args:any[])=>{const result=await resolve(...args);if(++policies===3){if(mode==='STALE_AFTER_POLICY')f.advance(31000);if(mode==='SHORT_POLICY')result.snapshot.expiresAt=new Date(f.at+10000).toISOString();}return result;};
  await assert.rejects(f.run(),mode);assert.equal(f.entries().length,0);assert.equal(f.commands().length,0);
 }
});
