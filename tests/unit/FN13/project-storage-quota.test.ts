import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {PROJECT_STORAGE_CAP,ProjectStorageQuota,quotaBytes,type QuotaPart} from '../../../apps/server/modules/projects/project-storage-quota.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${n.toString().padStart(12,'0')}`;
const h=(v:unknown)=>contentHash(canonicalJson(v));
const request=():ProjectCommand=>({schemaVersion:1,projectId:id(1),commandId:id(2),clientId:id(3),controlGeneration:1,operation:'uploadArtifact',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{bytes:5,contentHash:h('body'),mediaType:'application/octet-stream'}});
const part=():QuotaPart=>({key:'body',kind:'ARTIFACT',id:id(4),bytes:'5',contentHash:h('body'),reservedBytes:'10',settledBytes:'5'});
const actor:AuthenticatedIdentity={actorId:id(5),clientId:id(3),serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:id(6),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
const policyRef={id:id(7),version:1,contentHash:''};
const rules=[{ruleId:'storage',subjectRef:{kind:'HUMAN',userId:actor.actorId},operations:['uploadArtifact','proposeDocumentChange','saveCheckpoint'],targetScopes:[{kind:'PROJECT',projectId:id(1)}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}];
const policy={rules,reason:'합성 정책',reviewRefs:[]};policyRef.contentHash=h(policy);
type Row=Record<string,any>;
/** 실제 인증은 대역이다. BEGIN/COMMIT/ROLLBACK 상태와 COMMIT 응답 유실을 별도로 모사한다. */
class MemoryAccess extends AccessRepository{
 state:{account:Row|null;rows:Row[];proof:Row|null}={account:{coverage_state:'VERIFIED',generation:'1',used_bytes:'0',held_bytes:'0'},rows:[],proof:null};
 identity=structuredClone(actor);checkpoint:Row|null=null;commits=0;expireAfterReserve=false;lostCommit=false;deny=false;now=new Date('2026-10-31T00:00:00.000Z');trace:string[]=[];serial:Promise<unknown>=Promise.resolve();
 constructor(){super({} as never,{installationId:id(9),key:Buffer.alloc(32)});}
 override async authenticated<T>(_token:string,_csrf:string|null,body:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>):Promise<T>{
  const previous=this.serial;let done!:()=>void;this.serial=new Promise<void>(r=>done=r);await previous;
  const before=structuredClone(this.state);this.trace.push('BEGIN');
  try{const v=await body(this.db(),this.identity);this.commits++;this.trace.push('COMMIT');if(this.lostCommit){this.lostCommit=false;throw Error('COMMIT_REPLY_LOST');}return v;}
  catch(e){if(this.trace.at(-1)!=='COMMIT')this.state=before;this.trace.push('ROLLBACK');throw e;}finally{done();}
 }
 db(){return {query:async(sql:string,args:unknown[]=[])=>{this.trace.push(sql);
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return {rows:this.deny?[]:[{id:id(1),archived_at:null,participation:'OWNER'}]};
  if(sql.includes('FROM anvil.project_control'))return {rows:[{actor_id:actor.actorId,client_id:actor.clientId,generation:1,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies p JOIN'))return {rows:[{id:policyRef.id,head_version:1,rules_json:rules,content_hash:policyRef.contentHash,reason:policy.reason,review_refs:[],created_at:new Date('2026-01-01Z')}]};
  if(sql.includes('clock_timestamp()'))return {rows:[{at:new Date(this.now)}]};
  if(sql.includes('FROM anvil.commands WHERE scope_kind'))return {rows:[]};
  if(sql.includes('FROM anvil.checkpoint_records'))return {rows:this.checkpoint?[structuredClone(this.checkpoint)]:[]};
  if(sql.includes('quota_existing')){const q=JSON.parse(args[4] as string),r=this.state.rows.find(r=>r.external_command_id===q.commandId&&r.actor_id===actor.actorId);if(!r)return {rows:[{value:null}]};if(r.command_hash!==h(q)||r.client_id!==q.clientId)throw new AuthFailure('IDEMPOTENCY_CONFLICT',409);if(r.phase!=='RESERVED')throw new AuthFailure('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);return {rows:[{value:structuredClone(r.plan_json)}]};}
  if(sql.includes('quota_account'))return {rows:this.state.account?[structuredClone(this.state.account)]:[]};
  if(sql.includes('quota_reserve')){
   const p=JSON.parse(args[4] as string),a=this.state.account;if(!a||a.coverage_state!=='VERIFIED')throw new AuthFailure('PROJECT_STORAGE_QUOTA_UNVERIFIED',412);
   const found=this.state.rows.filter(r=>r.external_command_id===p.request.commandId&&r.actor_id===actor.actorId);
   if(found.length){if(found[0]!.command_hash!==p.commandHash||found[0]!.plan_hash!==p.planHash||found[0]!.client_id!==p.request.clientId)throw new AuthFailure('IDEMPOTENCY_CONFLICT',409);return {rows:[{value:structuredClone(found)}]};}
   const total=p.parts.reduce((v:bigint,x:QuotaPart)=>v+BigInt(x.reservedBytes),0n);if(BigInt(a.used_bytes)+BigInt(a.held_bytes)+total>10737418240n)throw new AuthFailure('PROJECT_STORAGE_LIMIT_EXCEEDED',429);
   const rows=p.parts.map((x:QuotaPart,i:number)=>({id:id(100+i),project_id:p.request.projectId,actor_id:actor.actorId,client_id:actor.clientId,external_command_id:p.request.commandId,operation:p.request.operation,command_hash:p.commandHash,part_key:x.key,part_kind:x.kind,plan_json:p,plan_hash:p.planHash,reserved_bytes:x.reservedBytes,settled_bytes:'0',phase:'RESERVED',start_fence:'0',generation:a.generation,authorized_until:p.authorizedUntil}));
   a.held_bytes=(BigInt(a.held_bytes)+total).toString();this.state.rows.push(...rows);if(this.expireAfterReserve)this.now=new Date('2100-01-01Z');return {rows:[{value:structuredClone(rows)}]};
  }
  if(sql.includes('quota_start')){const p=JSON.parse(args[4] as string);const rows=this.state.rows.filter(r=>p.ids.includes(r.id));if(rows.length!==p.ids.length||rows.some(r=>r.phase!=='RESERVED'||r.generation!==this.state.account?.generation))throw new AuthFailure('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);for(const r of rows){r.phase='IO_STARTED';r.start_fence='1';}return {rows:[{value:structuredClone(rows)}]};}
  if(sql.includes('quota_require_started')){const p=JSON.parse(args[4] as string),rs=this.state.rows.filter(r=>p.ids.includes(r.id));if(rs.length!==p.ids.length||rs.some(r=>r.phase!=='IO_STARTED'||r.start_fence!=='1'||r.generation!==this.state.account?.generation))throw new AuthFailure('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN',503);return {rows:[{value:true}]};}
  if(sql.includes('quota_settle')){const p=JSON.parse(args[4] as string);if(!this.state.proof||h(p.facts)!==h(this.state.proof))throw new AuthFailure('PROJECT_STORAGE_QUOTA_INTEGRITY_FAILED',503);const a=this.state.account!;for(const r of this.state.rows.filter(r=>p.ids.includes(r.id))){const x=r.plan_json.parts.find((x:QuotaPart)=>x.key===r.part_key);a.held_bytes=(BigInt(a.held_bytes)-BigInt(r.reserved_bytes)).toString();a.used_bytes=(BigInt(a.used_bytes)+BigInt(x.settledBytes)).toString();r.phase='SETTLED';r.settled_bytes=x.settledBytes;}return {rows:[{value:true}]};}
  throw Error('UNMODELED_QUERY:'+sql);
 }} as unknown as PoolClient;}
}
const fixture=()=>{const access=new MemoryAccess(),quota=new ProjectStorageQuota(access);return {access,quota};};
const code=(expected:string)=>(e:unknown)=>e instanceof AuthFailure&&e.message===expected;
async function prepared(f:ReturnType<typeof fixture>,parts=[part()]){return f.quota.prepare('token','csrf',request(),async()=>parts);}
test('quota bytes are canonical exact decimals and never coerce unsafe input',()=>{for(const bad of [-1,1.5,Number.MAX_SAFE_INTEGER+1,NaN,Infinity,'01','-1','1.0',[],null])assert.throws(()=>quotaBytes(bad));assert.equal(quotaBytes('0'),0n);assert.equal(quotaBytes('10737418240'),10737418240n);});
test('reserve commits independently; rollback of later operation preserves held bytes',async()=>{const f=fixture(),p=await prepared(f),b=await f.quota.reserve('token','csrf',p);assert.equal(f.access.state.account!.held_bytes,'10');const s=await f.quota.start('token','csrf',b);await assert.rejects(f.access.authenticated('token','csrf',async db=>{await f.quota.requireStarted(db,actor,request(),s,[part()]);throw Error('operation rollback');}));assert.equal(f.access.state.rows[0]!.phase,'IO_STARTED');assert.equal(f.access.state.account!.held_bytes,'10');});
test('same exact reservation adds zero; simultaneous starts admit one writer only',async()=>{const f=fixture(),p=await prepared(f),b=await f.quota.reserve('token','csrf',p);await f.quota.reserve('token','csrf',p);assert.equal(f.access.state.account!.held_bytes,'10');const results=await Promise.allSettled([f.quota.start('token','csrf',b),f.quota.start('token','csrf',b)]);assert.equal(results.filter(v=>v.status==='fulfilled').length,1);assert.equal(f.access.state.account!.held_bytes,'10');});
test('unverified coverage and exact cap overflow fail closed before start',async()=>{const f=fixture(),p=await prepared(f);f.access.state.account=null;await assert.rejects(f.quota.reserve('token','csrf',p),code('PROJECT_STORAGE_QUOTA_UNVERIFIED'));f.access.state.account={coverage_state:'VERIFIED',generation:'1',used_bytes:'10737418231',held_bytes:'0'};await assert.rejects(f.quota.reserve('token','csrf',p),code('PROJECT_STORAGE_LIMIT_EXCEEDED'));f.access.state.account.used_bytes='10737418230';await f.quota.reserve('token','csrf',p);assert.equal(f.access.state.account.held_bytes,'10');});
test('COMMIT reply loss never returns a usable bundle and durable reservation remains',async()=>{const f=fixture(),p=await prepared(f);f.access.lostCommit=true;await assert.rejects(f.quota.reserve('token','csrf',p),code('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN'));assert.equal(f.access.state.account!.held_bytes,'10');assert.equal(f.access.state.rows[0]!.phase,'RESERVED');});
test('start COMMIT loss leaves durable started charge; time never releases it',async()=>{const f=fixture(),b=await f.quota.reserve('token','csrf',await prepared(f));f.access.lostCommit=true;await assert.rejects(f.quota.start('token','csrf',b),code('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN'));f.access.now=new Date('2100-01-01Z');assert.equal(f.access.state.rows[0]!.phase,'IO_STARTED');assert.equal(f.access.state.account!.held_bytes,'10');await assert.rejects(f.quota.start('token','csrf',b));});
test('fresh current authority and genuine per-instance bundles are required each phase',async()=>{const f=fixture(),p=await prepared(f);await assert.rejects(f.quota.reserve('token','csrf',structuredClone(p)),code('PROJECT_STORAGE_QUOTA_INPUT_INVALID'));f.access.deny=true;await assert.rejects(f.quota.reserve('token','csrf',p),code('NOT_FOUND'));assert.equal(f.access.state.rows.length,0);});
test('whole command and part plan conflict instead of adding another reservation',async()=>{const f=fixture();await f.quota.reserve('token','csrf',await prepared(f));const changed=request();changed.payload.mediaType='text/plain;charset=utf-8';await assert.rejects(f.quota.prepare('token','csrf',changed,async()=>[part()]),code('IDEMPOTENCY_CONFLICT'));assert.equal(f.access.state.account!.held_bytes,'10');});
test('prepare copies command and derived parts before returning; malformed part charge rejected',async()=>{const f=fixture(),raw=request(),parts=[{...part()}],p=await f.quota.prepare('token','csrf',raw,async()=>parts);raw.payload.bytes=99;parts[0]!.bytes='99';assert.equal(p.request.payload.bytes,5);assert.equal(p.parts[0]!.bytes,'5');assert(Object.isFrozen(p.request.payload));await assert.rejects(prepared(f,[{...part(),reservedBytes:'5'}]),code('PROJECT_STORAGE_QUOTA_INPUT_INVALID'));});
test('settlement requires exact receipt facts and shares operating rollback atomically',async()=>{const f=fixture(),s=await f.quota.start('token','csrf',await f.quota.reserve('token','csrf',await prepared(f)));const facts={serverCommandId:id(20),authorizationReceiptId:id(21),scopeDigest:h('scope')};await assert.rejects(f.access.authenticated('token','csrf',db=>f.quota.settle(db,actor,request(),s,facts)));assert.equal(f.access.state.account!.held_bytes,'10');f.access.state.proof=facts;await f.access.authenticated('token','csrf',db=>f.quota.settle(db,actor,request(),s,facts));assert.equal(f.access.state.account!.held_bytes,'0');assert.equal(f.access.state.account!.used_bytes,'5');assert.equal(f.access.state.rows[0]!.phase,'SETTLED');});
test('failure after reservation mutation is outcome unknown even when currentness error is known',async()=>{const f=fixture(),p=await prepared(f);f.access.expireAfterReserve=true;await assert.rejects(f.quota.reserve('token','csrf',p),code('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN'));assert.equal(f.access.state.rows.length,0);});
test('coverage generation fences new starts; foreign parts or fences cannot use a genuine bundle',async()=>{const f=fixture(),b=await f.quota.reserve('token','csrf',await prepared(f));f.access.state.account!.generation='2';await assert.rejects(f.quota.start('token','csrf',b));f.access.state.account!.generation='1';const s=await f.quota.start('token','csrf',b);await assert.rejects(f.quota.requireStarted(f.access.db(),actor,request(),s,[{...part(),id:id(99)}]),code('IDEMPOTENCY_CONFLICT'));f.access.state.rows[0]!.start_fence='0';await assert.rejects(f.quota.requireStarted(f.access.db(),actor,request(),s,[part()]));});
test('zero-byte artifact and checkpoint exact C obey distinct reservation accounting',async()=>{const f=fixture();const zero={...part(),bytes:'0',reservedBytes:'0',settledBytes:'0'};const zeroRequest=request();zeroRequest.payload.bytes=0;await f.quota.reserve('token','csrf',await f.quota.prepare('token','csrf',zeroRequest,async()=>[zero]));assert.equal(f.access.state.account!.held_bytes,'0');const c=request();c.commandId=id(90);c.operation='saveCheckpoint';c.targetId=id(92);c.expectedVersion=1;const x:QuotaPart={...part(),id:id(91),kind:'CHECKPOINT',bytes:'2097152',reservedBytes:'2097152',settledBytes:'2097152'};await f.quota.reserve('token','csrf',await f.quota.prepare('token','csrf',c,async()=>[x]));assert.equal(f.access.state.account!.held_bytes,'2097152');await assert.rejects(f.quota.prepare('token','csrf',c,async()=>[{...x,bytes:'2097153',reservedBytes:'2097153',settledBytes:'2097153'}]));});
test('upload declared bytes/hash cannot be replaced with a cheaper internally derived part',async()=>{const f=fixture();await assert.rejects(f.quota.prepare('token','csrf',request(),async()=>[{...part(),bytes:'0',reservedBytes:'0',settledBytes:'0'}]),code('PROJECT_STORAGE_QUOTA_INPUT_INVALID'));});
test('different current actor/client cannot reuse a prepared reservation or started bundle',async()=>{const f=fixture(),p=await prepared(f);f.access.identity={...actor,actorId:id(98)};await assert.rejects(f.quota.reserve('token','csrf',p),code('IDEMPOTENCY_CONFLICT'));assert.equal(f.access.state.rows.length,0);f.access.identity=structuredClone(actor);const b=await f.quota.reserve('token','csrf',p);f.access.identity={...actor,clientId:id(97)};await assert.rejects(f.quota.start('token','csrf',b));assert.equal(f.access.state.rows[0]!.phase,'RESERVED');});
test('checkpoint settle rejects a resealed same-C final snapshot with different planned preparedHash',async()=>{
 const f=fixture(),c=request();c.operation='saveCheckpoint';c.targetId=id(92);c.expectedVersion=1;
 const snapshot={recordedAt:'2026-10-31T00:00:00.000Z',preparedHash:h('준비'),claim:'합성 저장 자료'},recordText='동일 C 원문',correctHash=h(snapshot),bytes=String(Buffer.byteLength(canonicalJson(snapshot))+Buffer.byteLength(recordText));
 const p:QuotaPart={...part(),kind:'CHECKPOINT',bytes,reservedBytes:bytes,settledBytes:bytes,contentHash:'a'.repeat(64)};
 assert.notEqual(snapshot.preparedHash,p.contentHash);assert.equal(bytes,String(Buffer.byteLength(canonicalJson({...snapshot,preparedHash:p.contentHash}))+Buffer.byteLength(recordText)));assert.notEqual(correctHash,p.contentHash);
 const prepared=await f.quota.prepare('token','csrf',c,async()=>[p]);assert.equal(prepared.parts[0]!.contentHash,p.contentHash);
 const s=await f.quota.start('token','csrf',await f.quota.reserve('token','csrf',prepared));
 const facts={serverCommandId:id(20),authorizationReceiptId:id(21),scopeDigest:h('scope')};f.access.state.proof=facts;
 f.access.checkpoint={id:p.id,content_hash:correctHash,snapshot_json:snapshot,record_text:recordText};
 await assert.rejects(f.access.authenticated('token','csrf',db=>f.quota.settle(db,actor,c,s,facts)),code('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN'));
 assert.equal(f.access.state.rows[0]!.phase,'IO_STARTED');assert.equal(f.access.state.account!.held_bytes,bytes);assert.equal(f.access.state.account!.used_bytes,'0');
});
test('checkpoint settle accepts exact preparedHash and final H/C; corrupted final snapshot rejects',async()=>{
 for(const corrupted of [false,true]){
  const f=fixture(),c=request();c.operation='saveCheckpoint';c.targetId=id(92);c.expectedVersion=1;
  const snapshot={recordedAt:'2026-10-31T00:00:00.000Z',preparedHash:h('준비'),claim:'합성'},recordText='기록';
  const bytes=String(Buffer.byteLength(canonicalJson(snapshot))+Buffer.byteLength(recordText)),x:QuotaPart={...part(),kind:'CHECKPOINT',bytes,reservedBytes:bytes,settledBytes:bytes,contentHash:snapshot.preparedHash};
  const s=await f.quota.start('token','csrf',await f.quota.reserve('token','csrf',await f.quota.prepare('token','csrf',c,async()=>[x])));
  const facts={serverCommandId:id(20),authorizationReceiptId:id(21),scopeDigest:h('scope')};f.access.state.proof=facts;
  f.access.checkpoint={id:x.id,content_hash:h(snapshot),snapshot_json:corrupted?{...snapshot,claim:'변조'}:snapshot,record_text:recordText};
  const action=()=>f.access.authenticated('token','csrf',db=>f.quota.settle(db,actor,c,s,facts));
  if(corrupted){await assert.rejects(action(),code('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN'));assert.equal(f.access.state.rows[0]!.phase,'IO_STARTED');}
  else{await action();assert.equal(f.access.state.rows[0]!.phase,'SETTLED');assert.equal(f.access.state.account!.used_bytes,bytes);assert.equal(f.access.state.account!.held_bytes,'0');}
 }
});
test('settle after started reservation normalizes session/policy expiry separately to unknown and preserves R',async()=>{
 for(const expiry of ['SESSION','POLICY']){
  const f=fixture(),s=await f.quota.start('token','csrf',await f.quota.reserve('token','csrf',await prepared(f)));
  if(expiry==='SESSION')f.access.identity={...actor,authSession:{...actor.authSession!,idleExpiresAt:'2026-10-30T00:00:00.000Z'}};
  else{f.access.now=new Date('2099-01-01T00:00:00.000Z');f.access.identity={...actor,authSession:{...actor.authSession!,idleExpiresAt:'2100-01-01T00:00:00.000Z',absoluteExpiresAt:'2100-01-01T00:00:00.000Z'}};}
  await assert.rejects(f.access.authenticated('token','csrf',(db,current)=>f.quota.settle(db,current,request(),s,{serverCommandId:id(20),authorizationReceiptId:id(21),scopeDigest:h('scope')})),code('PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN'));
  assert.equal(f.access.state.rows[0]!.phase,'IO_STARTED');assert.equal(f.access.state.account!.held_bytes,'10');assert.equal(f.access.state.account!.used_bytes,'0');
 }
});
test('RESERVED recheck reuses exact ID/plan/earlier deadline and rederives source without extending it',async()=>{
 const f=fixture();f.access.identity={...actor,authSession:{...actor.authSession!,idleExpiresAt:'2030-01-01T00:00:00.000Z'}};const p=await prepared(f);await f.quota.reserve('token','csrf',p);
 f.access.identity={...actor,authSession:{...actor.authSession!,idleExpiresAt:'2040-01-01T00:00:00.000Z'}};let hint='';
 const second=await f.quota.prepare('token','csrf',request(),async(_db,_a,_q,existing)=>{hint=existing![0]!.id;return [{...part(),id:hint}];});assert.equal(hint,p.parts[0]!.id);assert.equal(second.planHash,p.planHash);assert.equal(second.authorizedUntil,'2030-01-01T00:00:00.000Z');await f.quota.reserve('token','csrf',second);assert.equal(f.access.state.account!.held_bytes,'10');
 await assert.rejects(f.quota.prepare('token','csrf',request(),async()=>[{...part(),id:id(99)}]),code('IDEMPOTENCY_CONFLICT'));assert.equal(f.access.state.account!.held_bytes,'10');
 f.access.now=new Date('2031-01-01T00:00:00.000Z');await assert.rejects(f.quota.prepare('token','csrf',request(),async(_d,_a,_r,old)=>old!),code('PROJECT_STORAGE_CURRENT_REQUIRED'));assert.equal(f.access.state.rows[0]!.phase,'RESERVED');
});

test('수락된 일반문서 예약은 원command 한정 account를 소비하고 public OWNER account로 우회하지 않는다',async()=>{
 const g=await import('../../../apps/server/modules/control-handoff/control-grant.ts'),f=fixture(),ordinary={...request(),controlGeneration:2},ref={id:id(50),version:1,contentHash:'a'.repeat(64)},accept={schemaVersion:1 as const,operation:'acceptControl' as const,commandId:id(51),projectId:id(1),clientId:actor.clientId,payload:{requestRef:ref,summaryVersion:1,reason:'수락'}};
 const chain=g.createControlAcceptanceChain({projectId:id(1),command:accept,requestRef:ref,summaryRef:ref,before:{actorId:id(52),clientId:id(53),generation:1,version:1},targetActorId:actor.actorId,recordedAt:'2026-10-30T00:00:00.000Z',ids:{acceptance:id(54),revocation:id(55),grant:id(56),receipt:id(57),audit:id(58)}}),original=f.access.db.bind(f.access);let accountCalls=0,publicCalls=0;
 f.access.db=()=>{const db=original();return{query:async(sql:string,args:unknown[]=[])=>{
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:id(1),archived_at:null,participation:'HANDOFF_ELIGIBLE'}]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:actor.actorId,client_id:actor.clientId,generation:2,version:2,revoked_at:null}]};
  if(sql.includes('FROM anvil.control_handoffs'))return{rows:[{project_id:id(1),next_generation:2,content_hash:chain.acceptance.ref.contentHash,bundle_json:chain,grant_rows:[chain.grant,chain.revocation],command_rows:[{command:accept,result:chain.result,commandHash:g.controlHash(accept),resultHash:g.controlHash(chain.result)}],receipt_rows:[chain.receipt],audit_rows:[chain.audit],revoked_count:'0'}]};
  if(sql.includes('fn15_ordinary_quota_account')){accountCalls++;assert.equal(args.length,5);assert.deepEqual(JSON.parse(String(args[4])),ordinary);return{rows:[structuredClone(f.access.state.account)]};}
  if(sql.includes('anvil.quota_account(')){publicCalls++;throw new AuthFailure('NOT_FOUND',404);}return db.query(sql,args);
 }}as ReturnType<MemoryAccess['db']>;};
 const p=await f.quota.prepare('token','csrf',ordinary,async()=>[part()]);await f.quota.reserve('token','csrf',p);assert.equal(accountCalls,1);assert.equal(publicCalls,0);assert.equal(f.access.state.account!.held_bytes,'10');
});

import {reserveRegisteredPreparationReceiptIds} from '../../../apps/server/modules/access/project-command.ts';
function registeredQuotaPortFixture(){
 const rawRef={id:id(82),version:1,contentHash:'a'.repeat(64)},at=new Date('2026-11-06T00:00:00.000Z');
 const who:AuthenticatedIdentity={...actor,reauthUntil:new Date('2026-11-06T00:01:00.000Z'),authSession:{id:id(83),idleExpiresAt:'2026-11-06T00:01:00.000Z',absoluteExpiresAt:'2026-11-06T00:01:00.000Z'}};
 const input={projectId:id(1),assignmentRef:rawRef,roleBindingRef:rawRef,contextBundleRef:rawRef,connectionRef:rawRef,environmentRef:rawRef,capabilityRef:rawRef,budgetPolicyRef:rawRef,
  sourceScopes:[{sourceRootRef:rawRef,mappingRef:null,observationRef:rawRef,baselineRef:rawRef,targets:[{relativePath:'src/file.ts',kind:'FILE',access:'READ',recursive:false}]}],mode:'CONTEXT_REVIEW',reason:'예약 목적 포트 검산',connectionKind:'REGISTERED_DEFINITION',optionsFormat:'CLAUDE_QUERY_DATA_V1'};
 const command:ProjectCommand={...request(),operation:'prepareExecution',payload:input};
 const body=canonicalJson({claudeQueryParams:{model:'선택 모델'}}),snapshot={intent:input,basisRefs:[],latestInstructionRefs:[],checkedAt:at.toISOString(),missingConditions:['CAPABILITY_UNVERIFIED','BUDGET_POLICY_UNVERIFIED'],authorizationState:'NOT_AUTHORIZED',preparedBy:{kind:'HUMAN',userId:who.actorId},executionAuthorized:false,dispatchPerformed:false,
  options:{format:'CLAUDE_QUERY_DATA_V1',mediaType:'application/json',body,utf8Bytes:Buffer.byteLength(body),contentHash:contentHash(body)}};
 const prepRef={id:id(84),version:1,contentHash:h(snapshot)},policy={...rawRef,id:id(85)};
 const receiptIds=reserveRegisteredPreparationReceiptIds();
 const result={operationId:receiptIds.operationId,projectId:command.projectId,commandId:command.commandId,status:'APPLIED',targetId:prepRef.id,version:1,data:{status:'EXECUTION_PREPARED',ref:prepRef,snapshot},evidenceRefs:[],warnings:[],serverReceivedAt:snapshot.checkedAt};
 const receipt={id:receiptIds.serverCommandId,result,authorizationReceiptRef:{...rawRef,id:receiptIds.authorizationReceiptId}};
 const modelPlan={request:command,actorId:who.actorId,parts:[{key:'registered_options',kind:'PREPARATION_OPTIONS',id:prepRef.id,bytes:'10000',contentHash:prepRef.contentHash,reservedBytes:'10000',settledBytes:'10000'}],commandHash:h(command),policyRef:policy,authorizedUntil:'2026-11-06T00:00:03.000Z',replay:false,canonicalPairs:{preparationSnapshot:canonicalJson(snapshot),resultRef:canonicalJson(result)},coverageGeneration:'1'},modelPlanHash=h(modelPlan);
 let rejectOther=false,tx='901',clock=at,changeAfterReserve=false,wrongReservation=false,settleError=false,expireAfterSettle=false,accessCalls=0,reserves=0,settles=0;
 const db:any={query:async(sql:string,args:any[])=>{
  if(sql.startsWith('SELECT txid_current()'))return{rows:[{transaction_id:tx,observed_at:clock}]};
  if(sql.includes('fn09_registered_prepare_reserve')){reserves++;if(rejectOther){const u=PROJECT_STORAGE_CAP-20n,held=0n,amount=10n,other=11n;assert(u+held+amount<=PROJECT_STORAGE_CAP);assert(u+held+amount+other>PROJECT_STORAGE_CAP);throw Object.assign(Error('PROJECT_STORAGE_LIMIT_EXCEEDED'),{code:'P0001'});}assert.equal(args[10],tx);assert.deepEqual(JSON.parse(args[8]),receiptIds);assert.equal(JSON.parse(args[9]).resultRef,canonicalJson(result));assert.equal(args[0],who.authSession!.id);assert.deepEqual(JSON.parse(args[4]),command);assert.deepEqual(JSON.parse(args[6]),snapshot);const original=tx;if(changeAfterReserve)tx='902';return{rows:[{reservation_id:wrongReservation?id(88):receiptIds.serverCommandId,transaction_id:original,preparation_hash:prepRef.contentHash,plan_hash:modelPlanHash,reserved_bytes:'10000',authorized_until:'2026-11-06T00:00:03.000Z'}]};}
  if(sql.includes('fn09_registered_prepare_settle')){settles++;assert.equal(args[9],tx);assert.equal(args[6],modelPlanHash);if(settleError)throw Error('정산 응답 유실');if(expireAfterSettle)clock=new Date('2026-11-06T00:00:03.000Z');return{rows:[{status:'SETTLED',reservation_id:wrongReservation?id(88):receiptIds.serverCommandId,transaction_id:tx,settled_bytes:'9999'}]};}
  throw Error('UNEXPECTED_REGISTERED_QUOTA_SQL');
 }};
 const quota=new ProjectStorageQuota({authenticated:async()=>{accessCalls++;throw Error('별도 인증 트랜잭션 금지');}} as any);
 return{db,who,command,prepRef,snapshot,policy,receipt,receiptIds,quota,modelPlan,modelPlanHash,rejectOther(){rejectOther=true;},get reserves(){return reserves;},get settles(){return settles;},get accessCalls(){return accessCalls;},wrongReservation(){wrongReservation=true;},replaceTx(){tx='902';},switchDuringReserve(){changeAfterReserve=true;},failSettle(){settleError=true;},expireSettle(){expireAfterSettle=true;}};
}

test('등록 준비 quota 내부 포트는 같은 원 Pool·actor·실제 txid의 private lease만 단발 정산한다',async()=>{
 const q=registeredQuotaPortFixture(),lease=await q.quota.reserveRegisteredPreparation(q.db,q.who,q.command,q.prepRef,q.snapshot,q.policy,q.receiptIds);
 assert.deepEqual(Object.keys(lease),[]);assert(Object.isFrozen(lease));
 await assert.rejects(q.quota.settleRegisteredPreparation(q.db,q.who,Object.freeze({}),q.receipt),/PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN/);
 await q.quota.settleRegisteredPreparation(q.db,q.who,lease,q.receipt);
 await assert.rejects(q.quota.settleRegisteredPreparation(q.db,q.who,lease,q.receipt),/PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN/);
 assert.equal(q.reserves,1);assert.equal(q.settles,1);assert.equal(q.accessCalls,0);
});

test('등록 준비 quota 포트의 Tx교체·교차actor·정산유실/기한은 재정산이나 별도Tx로 성공시키지 않는다',async()=>{
 const swapped=registeredQuotaPortFixture();swapped.switchDuringReserve();await assert.rejects(swapped.quota.reserveRegisteredPreparation(swapped.db,swapped.who,swapped.command,swapped.prepRef,swapped.snapshot,swapped.policy,swapped.receiptIds),/PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN/);assert.equal(swapped.settles,0);
 for(const mode of ['tx','actor','lost','expiry']){
  const q=registeredQuotaPortFixture(),lease=await q.quota.reserveRegisteredPreparation(q.db,q.who,q.command,q.prepRef,q.snapshot,q.policy,q.receiptIds);
  if(mode==='tx')q.replaceTx();if(mode==='lost')q.failSettle();if(mode==='expiry')q.expireSettle();
  await assert.rejects(q.quota.settleRegisteredPreparation(q.db,mode==='actor'?{...q.who}:q.who,lease,q.receipt));
  assert.equal(q.settles,mode==='lost'||mode==='expiry'?1:0);assert.equal(q.accessCalls,0);
  if(mode!=='actor'){await assert.rejects(q.quota.settleRegisteredPreparation(q.db,q.who,lease,q.receipt));assert.equal(q.settles,mode==='lost'||mode==='expiry'?1:0);}
 }
});
test('등록 준비 quota 예약은 원 발급 command 식별과 다른 예약 응답을 거절한다',async()=>{const q=registeredQuotaPortFixture();q.wrongReservation();await assert.rejects(q.quota.reserveRegisteredPreparation(q.db,q.who,q.command,q.prepRef,q.snapshot,q.policy,q.receiptIds),/PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN/);assert.equal(q.reserves,1);assert.equal(q.settles,0);assert.equal(q.accessCalls,0);});

test('등록 준비 Node 포트는 별도 O 초과 거절과 coverage 봉인 hash를 정산까지 보존한다',async()=>{const rejected=registeredQuotaPortFixture();rejected.rejectOther();await assert.rejects(rejected.quota.reserveRegisteredPreparation(rejected.db,rejected.who,rejected.command,rejected.prepRef,rejected.snapshot,rejected.policy,rejected.receiptIds),(e:any)=>e.message==='PROJECT_STORAGE_LIMIT_EXCEEDED'&&e.statusCode===429);assert.equal(rejected.reserves,1);assert.equal(rejected.settles,0);const q=registeredQuotaPortFixture();assert.notEqual(h({...q.modelPlan,coverageGeneration:'2'}),q.modelPlanHash);const lease=await q.quota.reserveRegisteredPreparation(q.db,q.who,q.command,q.prepRef,q.snapshot,q.policy,q.receiptIds);await q.quota.settleRegisteredPreparation(q.db,q.who,lease,q.receipt);assert.equal(q.settles,1);assert.equal(q.accessCalls,0);});

test('등록 준비 quota는 원 Session·정책이 유효하면 별도 재인증을 요구하지 않는다',async()=>{for(const reauthUntil of [null,new Date('2000-01-01T00:00:00.000Z')]){const q=registeredQuotaPortFixture();Object.assign(q.who,{reauthUntil});const lease=await q.quota.reserveRegisteredPreparation(q.db,q.who,q.command,q.prepRef,q.snapshot,q.policy,q.receiptIds);await q.quota.settleRegisteredPreparation(q.db,q.who,lease,q.receipt);assert.equal(q.reserves,1);assert.equal(q.settles,1);}});
