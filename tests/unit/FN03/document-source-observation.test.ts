import test from 'node:test';
import assert from 'node:assert/strict';
import {readDocumentSourceLinkInput} from '../../../apps/server/modules/documents/document-source-link-history.ts';
import {ProjectDocumentSourceLinks} from '../../../apps/server/modules/documents/project-source-links.ts';
const ref={id:'11111111-1111-4111-8111-111111111111',version:1,contentHash:'a'.repeat(64)};
test('승인된 drift 선택은 v1 링크를 바꾸지 않는 별도 원입력이다',()=>{
 const payload={sourceLinkRef:ref,observedSnapshotRef:{...ref,id:'22222222-2222-4222-8222-222222222222'},choice:'KEEP_SERVER',reason:'서버 본문 보존'};
 assert.deepEqual(readDocumentSourceLinkInput('proposeDocumentSourceChange',payload),payload);assert.equal(ref.version,1);
});
test('기본 관측 공급자 부재는 초기 연결을 412로 닫고 SQL을 시작하지 않는다',async()=>{
 let queries=0;const service=new ProjectDocumentSourceLinks();
 await assert.rejects(async()=>Reflect.get(service,'link').call(service,{query:async()=>{queries++;throw Error('금지');}} as unknown as PoolClient,{} as AuthenticatedIdentity,{} as ProjectCommand,ref),{message:'DOCUMENT_SOURCE_OBSERVATION_UNAVAILABLE',statusCode:412});
 assert.equal(queries,0);
});

import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {DocumentSourceObservations,readDocumentObservation,sourceChoiceRecord,type ObservationScope,type ObservationLease} from '../../../apps/server/modules/documents/document-source-observation.ts';
import type {PoolClient} from 'pg';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import type {AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
const scope:ObservationScope={projectId:ref.id,documentRef:ref,sourceRootId:ref.id,relativePath:'a.md',actorId:ref.id,clientId:ref.id,humanSessionId:ref.id,controlGeneration:1};
const observed=()=>{const snapshot={scope,sourceRootRef:ref,sourceSnapshotRef:ref,blobHash:ref.contentHash,artifactRef:null,registrationRef:ref,connectorRef:ref,proofRef:ref,observedAt:'2026-11-03T00:00:00.000Z',expiresAt:'2099-11-03T00:00:00.000Z'};return {ref:{...ref,contentHash:contentHash(canonicalJson(snapshot))},snapshot};};
const lease=():ObservationLease=>({signal:new AbortController().signal,check(){},remaining:()=>1000,narrow(){},close(){}});
test('보호 관측은 원 문서/root/세션·정확 snapshot에 결박된다',()=>{
 assert.deepEqual(readDocumentObservation(observed(),scope,ref),observed());
 assert.throws(()=>readDocumentObservation(observed(),{...scope,clientId:'22222222-2222-4222-8222-222222222222'},ref),/DOCUMENT_SOURCE_OBSERVATION_INVALID/);
});
test('관측 Proxy와 중첩 getter는 실행하지 않고 거절한다',()=>{
 let calls=0;const value=observed(),proxy=new Proxy(value,{get(t,k,r){calls++;return Reflect.get(t,k,r);}});
 assert.throws(()=>readDocumentObservation(proxy,scope,ref));assert.equal(calls,0);
 Object.defineProperty(value.snapshot.sourceRootRef,'contentHash',{get(){calls++;return 'a'.repeat(64);},configurable:true});
 try{assert.throws(()=>readDocumentObservation(value,scope,ref));assert.equal(calls,0);}finally{Object.defineProperty(ref,'contentHash',{value:'a'.repeat(64),writable:true,configurable:true,enumerable:true});}
});
test('관측 await 뒤 원 포트 교체는 current 호출 전에 닫힌다',async()=>{
 let settle!:(v:unknown)=>void,currents=0;
 const port={read:()=>new Promise(r=>{settle=r;}),current:async()=>{currents++;return observed();}},service=new DocumentSourceObservations(port);
 const pending=service.observe({} as PoolClient,{} as AuthenticatedIdentity,scope,ref,lease());
 port.read=async()=>observed();settle(observed());await assert.rejects(pending,/DOCUMENT_SOURCE_OBSERVATION_UNAVAILABLE/);assert.equal(currents,0);
});
test('별도 선택 stream의 metadata 상한은 원 link version과 독립이다',()=>{
 const snapshot={projectId:ref.id,sourceLinkRef:ref,observation:observed(),choice:'KEEP_SERVER' as const,reason:'보존',previousRef:null,proposalId:null,importId:null,recordedAt:'2026-11-03T00:00:00.000Z'};
 assert.equal(sourceChoiceRecord(ref.id,3,snapshot).ref.version,3);assert.equal(ref.version,1);
 assert.throws(()=>sourceChoiceRecord(ref.id,4,{...snapshot,reason:'가'.repeat(23000)}),/DOCUMENT_SOURCE_EVENT_LIMIT/);
});
import {documentOperations} from '../../../apps/server/modules/access/project-command.ts';
test('원 프로젝트 정책 allowlist는 승인된 두 소스 명령을 실제로 허용한다',()=>{
 assert(documentOperations.some(x=>String(x)==='linkDocumentSource'));assert(documentOperations.some(x=>String(x)==='proposeDocumentSourceChange'));
});

import {sourceEventQuotaAccounting,type QuotaPart} from '../../../apps/server/modules/projects/project-storage-quota.ts';
import {sourceEventQuotaPart} from '../../../apps/server/modules/documents/document-source-observation.ts';
const quotaProjection=(size=40000)=>({link:{value:'a'.repeat(size)},record:{value:'b'.repeat(size)},candidate:null,proposal:null});
test('source quota 행별64KiB: 두 유효행 합계64KiB 초과는 10행 미래예약에서 허용한다',()=>{
 const projection=quotaProjection(),part=sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,7);
 const value=sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,7,[{kind:'SOURCE_EVENT',row:{snapshot_json:projection.link}},{kind:'SOURCE_EVENT',row:{snapshot_json:projection.record}}]);
 assert.equal(value.reservedBytes,String(4*Buffer.byteLength(canonicalJson(projection))+10*65536+14));assert.equal(value.actualBytes,String(Buffer.byteLength(canonicalJson({snapshot_json:projection.link}))+Buffer.byteLength(canonicalJson({snapshot_json:projection.record}))+7));
});
test('source quota 행별64KiB: 실제한행 초과는 합계예약에 여유가 있어도 거절한다',()=>{
 const projection=quotaProjection(1),part=sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,0);
 assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,[{kind:'SOURCE_EVENT',row:{snapshot_json:{value:'x'.repeat(65536)}}}]));
});
test('source quota 행별64KiB: 1행만 예약한 원형은 10행 future를 감당하지 못한다',()=>{
 const projection=quotaProjection(1),part:QuotaPart={...sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,0),bytes:'65536',reservedBytes:'65536'};
 assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,[projection.link]));
});
test('source quota 행별64KiB: actual row가 future 10slot보다 많으면 bytes 여유만으로 수용하지 않는다',()=>{
 const projection=quotaProjection(1),part=sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,0);
 assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,Array.from({length:11},()=>({kind:'SOURCE_EVENT',row:{snapshot_json:{value:'x'}}}))));
});

test('source quota 행별64KiB: 이전1행식이 맞아도 actual 한행 초과를 성공으로 만들지 않는다',()=>{
 const projection=quotaProjection(1),part:QuotaPart={...sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,0),bytes:'65536',reservedBytes:'65536'};
 assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,[{kind:'SOURCE_EVENT',row:{snapshot_json:{value:'x'.repeat(65536)}}}]));
});
test('source quota 행별64KiB: 이전1행식에서도 future slot 초과를 성공으로 만들지 않는다',()=>{
 const projection=quotaProjection(1),part:QuotaPart={...sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,0),bytes:'65536',reservedBytes:'65536'};
 assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,Array.from({length:11},()=>({kind:'SOURCE_EVENT',row:{snapshot_json:{value:'x'}}}))));
});

test('source quota 행별64KiB: exact 10행 상한·actual 합계·diff 2배는 중복 계상하지 않는다',()=>{
 const projection=quotaProjection(1),part=sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,7),row={snapshot_json:{value:'x'.repeat(65536-Buffer.byteLength(canonicalJson({snapshot_json:{value:''}})))}};
 assert.equal(Buffer.byteLength(canonicalJson(row)),65536);
 const value=sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,7,Array.from({length:10},()=>({kind:'SOURCE_EVENT',row})));
 assert.equal(value.recordCount,10);assert.equal(value.metadataBytes,'655360');assert.equal(value.actualBytes,'655367');assert.equal(value.reservedBytes,String(4*Buffer.byteLength(canonicalJson(projection))+655374));
 const preview=sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,7);assert.equal(preview.actualBytes,null);assert.equal(preview.recordCount,null);
});
test('source quota 행별64KiB: projection/actual Proxy·getter는 실행 전에 닫는다',()=>{
 const projection=quotaProjection(1),part=sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,0);let calls=0;
 const proxy=new Proxy(projection,{getPrototypeOf(t){calls++;return Reflect.getPrototypeOf(t);}});
 assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,proxy,0));assert.equal(calls,0);
 const row={};Object.defineProperty(row,'value',{enumerable:true,get(){calls++;return 'secret';}});
 assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,[row]));assert.equal(calls,0);
 const rows=new Proxy([{}],{get(t,k,r){calls++;return Reflect.get(t,k,r);}});
 assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,rows));assert.equal(calls,0);
});

import {AccessRepository,AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import {ProjectStorageQuota} from '../../../apps/server/modules/projects/project-storage-quota.ts';
import {ArtifactStore} from '../../../apps/server/storage/artifact-store.ts';
import {resolve} from 'node:path';
const qid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const qhash=(v:unknown)=>contentHash(canonicalJson(v));
const quotaActor:AuthenticatedIdentity={actorId:qid(1),clientId:qid(2),serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:qid(3),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
/** 인증/DB는 명시 메모리 모델이다. 실제 quota prepare/reserve/start와 private bundle은 제품 코드를 소비한다. */
class SourceQuotaMemoryAccess extends AccessRepository{
 rows:Record<string,unknown>[]=[];used=0n;held=0n;policyMode:'AUTO'|'DENY'|'NONE'|'OTHER'='AUTO';trace:string[]=[];projection:unknown;diffBytes=4;settles=0;
 constructor(){super({} as never,{installationId:qid(4),key:Buffer.alloc(32)});}
 override async authenticated<T>(_token:string,_csrf:string|null,body:(db:PoolClient,actor:AuthenticatedIdentity)=>Promise<T>){return body(this.db(),quotaActor);}
 db(){return{query:async(sql:string,args:unknown[]=[])=>{this.trace.push(sql);
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return{rows:[{id:qid(5),archived_at:null,participation:'OWNER'}]};
  if(sql.includes('FROM anvil.project_control'))return{rows:[{actor_id:quotaActor.actorId,client_id:quotaActor.clientId,generation:1,revoked_at:null}]};
  if(sql.includes('FROM anvil.permission_policies p JOIN')){if(this.policyMode==='NONE')return{rows:[]};const rules=[{ruleId:'source',subjectRef:{kind:'HUMAN',userId:this.policyMode==='OTHER'?qid(99):quotaActor.actorId},operations:['linkDocumentSource','proposeDocumentSourceChange'],targetScopes:[{kind:'PROJECT',projectId:qid(5)}],disposition:this.policyMode==='DENY'?'DENY':'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],policy={rules,reason:'합성 정책',reviewRefs:[]};return{rows:[{id:qid(6),head_version:1,rules_json:rules,content_hash:qhash(policy),reason:policy.reason,review_refs:[],created_at:new Date('2026-11-03T00:00:00.000Z')}]};}
  if(sql.includes('clock_timestamp()'))return{rows:[{at:new Date('2026-11-03T00:00:00.000Z')}]};
  if(sql.includes('FROM anvil.commands WHERE scope_kind'))return{rows:[]};
  if(sql.includes('quota_existing'))return{rows:[{value:null}]};
  if(sql.includes('quota_account'))return{rows:[{coverage_state:'VERIFIED',generation:'1',used_bytes:String(this.used),held_bytes:String(this.held)}]};
  if(sql.includes('quota_reserve')){const plan=JSON.parse(String(args[4])),part=plan.parts[0];this.rows=[{id:qid(7),project_id:plan.request.projectId,actor_id:quotaActor.actorId,client_id:quotaActor.clientId,external_command_id:plan.request.commandId,operation:plan.request.operation,command_hash:plan.commandHash,plan_hash:plan.planHash,part_key:part.key,part_kind:part.kind,reserved_bytes:part.reservedBytes,phase:'RESERVED',start_fence:'0',generation:'1'}];this.held=BigInt(part.reservedBytes);return{rows:[{value:structuredClone(this.rows)}]};}
  if(sql.includes('quota_start')){this.rows[0]!.phase='IO_STARTED';this.rows[0]!.start_fence='1';return{rows:[{value:structuredClone(this.rows)}]};}
  if(sql.includes('quota_require_started'))return{rows:[{value:this.rows[0]?.phase==='IO_STARTED'}]};
  if(sql.includes('document_source_quota_projection'))return{rows:[{projection:this.projection,record_projections:[{kind:'SOURCE_EVENT',row:{id:qid(11),snapshot_json:{model:'SOURCE_METADATA_ONLY'}}}],diff_bytes:String(this.diffBytes)}]};
  if(sql.includes('quota_settle')){const input=JSON.parse(String(args[4]));assert(input.sourceAccounting);this.used=BigInt(input.sourceAccounting.actualBytes);this.held=0n;this.rows[0]!.phase='SETTLED';this.settles++;return{rows:[{value:true}]};}
  throw Error('UNMODELED_SOURCE_QUOTA_QUERY');
 }} as unknown as PoolClient;}
}
/** constructor는 경로 문자열만 검사한다. 모든 IO method를 메모리로 override하며 super IO는 호출하지 않는다. */
class SourceQuotaMemoryStore extends ArtifactStore{
 puts=0;verifies=0;data=new Map<string,Buffer>();loseReply=false;holdPut:(()=>Promise<void>)|null=null;
 constructor(){super(resolve('SOURCE_QUOTA_MEMORY_ONLY_NOT_CREATED'));}
 override async put(pid:string,id:string,bytes:Buffer){this.puts++;this.data.set(id,Buffer.from(bytes));if(this.holdPut)await this.holdPut();if(this.loseReply)throw Error('MODEL_PUT_REPLY_LOST');return`blobs/${pid}/${id}`;}
 override async verifyPublished(_pid:string,id:string,expected:{bytes:number;contentHash:string}){this.verifies++;const bytes=this.data.get(id);assert(bytes);assert.equal(bytes.length,expected.bytes);assert.equal(contentHash(bytes),expected.contentHash);}
}
async function sourceQuotaFixture(mode:SourceQuotaMemoryAccess['policyMode']='AUTO',capture?:(access:SourceQuotaMemoryAccess,store:SourceQuotaMemoryStore)=>void){
 const access=new SourceQuotaMemoryAccess();access.policyMode=mode;const store=new SourceQuotaMemoryStore(),quota=new ProjectStorageQuota(access,store),bytes=Buffer.from('diff'),diffRef={artifactId:qid(8),bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'application/json;charset=utf-8'};
 const request:ProjectCommand={schemaVersion:1,projectId:qid(5),commandId:qid(9),clientId:quotaActor.clientId,controlGeneration:1,operation:'proposeDocumentSourceChange',targetId:ref.id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{sourceLinkRef:ref,observedSnapshotRef:ref,choice:'COLLECT_PROPOSAL',reason:'변경안 수집'}};
 const projection={link:null,record:{ref,snapshot:{proposalId:qid(10)}},candidate:null,proposal:{proposal:{id:qid(10),baseRef:ref,proposedContentRef:diffRef,diffRef,status:'PENDING'},content:{body:diffRef,attachments:[],sections:[],sourceRefs:[]},reason:'변경안 수집'}};
 access.projection=structuredClone(projection);capture?.(access,store);
 const part=sourceEventQuotaPart('proposeDocumentSourceChange',diffRef.artifactId,projection,bytes.length),prepared=await quota.prepare('model','model',request,async()=>[part]),reserved=await quota.reserve('model','model',prepared),bundle=await quota.start('model','model',reserved);
 return{access,store,quota,request,projection,diffRef,bytes,bundle};
}
test('source publish I1: 실제 발급bundle은 예정과 다른 artifactId를 IO 전에 거절한다',async()=>{
 const f=await sourceQuotaFixture();await assert.rejects(f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,{...f.diffRef,artifactId:qid(98)},f.bytes));assert.equal(f.store.puts,0);assert.equal(f.store.verifies,0);
});
test('source publish I1: 실제 발급bundle은 같은 길이의 다른 bytes/hash를 IO 전에 거절한다',async()=>{
 const f=await sourceQuotaFixture(),bytes=Buffer.from('evil');await assert.rejects(f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,{...f.diffRef,contentHash:contentHash(bytes)},bytes));assert.equal(f.store.puts,0);
});
test('source publish I1: 정상1회 게시 뒤 동일bundle 재호출은 IO를 늘리지 않는다',async()=>{
 const f=await sourceQuotaFixture();assert.equal(await f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,f.diffRef,f.bytes),`blobs/${f.request.projectId}/${f.diffRef.artifactId}`);await assert.rejects(f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,f.diffRef,f.bytes));assert.equal(f.store.puts,1);assert.equal(f.store.verifies,1);
});
test('source publish I1: 명시정책 부재/DENY/다른 HUMAN은 예약·게시를 시작하지 않는다',async()=>{
 for(const mode of ['NONE','DENY','OTHER'] as const){let captured:{access:SourceQuotaMemoryAccess;store:SourceQuotaMemoryStore}|undefined;await assert.rejects(sourceQuotaFixture(mode,(access,store)=>{captured={access,store};}),(error:unknown)=>error instanceof AuthFailure&&['PERMISSION_POLICY_UNCONFIGURED','PROJECT_OPERATION_DENIED'].includes(error.message));assert(captured);assert.equal(captured.store.puts,0);assert.equal(captured.access.trace.some(sql=>sql.includes('quota_reserve')),false);}
});

test('source publish I1: 동시 재호출은 첫 put 정착 전에도 추가 IO0이다',async()=>{
 const f=await sourceQuotaFixture();let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),held=new Promise<void>(r=>release=r);
 f.store.holdPut=async()=>{entered();await held;};const first=f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,f.diffRef,f.bytes);await started;
 await assert.rejects(f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,f.diffRef,f.bytes));assert.equal(f.store.puts,1);release();await first;assert.equal(f.store.verifies,1);
});
test('source publish I1: put 응답 유실은 held/원bundle을 보존하고 재게시하지 않는다',async()=>{
 const f=await sourceQuotaFixture();f.store.loseReply=true;const held=f.access.held;
 await assert.rejects(f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,f.diffRef,f.bytes),/PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN/);
 await assert.rejects(f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,f.diffRef,f.bytes));assert.equal(f.store.puts,1);assert.equal(f.store.verifies,0);assert.equal(f.access.held,held);assert.equal(f.access.rows[0]!.phase,'IO_STARTED');
});
test('source publish I1: caller alias 변경 뒤에도 원id/hash로 verify하고 원정산을 소비한다',async()=>{
 const f=await sourceQuotaFixture(),original=structuredClone(f.diffRef);let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>entered=r),held=new Promise<void>(r=>release=r);
 f.store.holdPut=async()=>{entered();await held;};const pending=f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,f.diffRef,f.bytes);await started;
 f.diffRef.artifactId=qid(98);f.diffRef.contentHash='f'.repeat(64);f.bytes.fill(0);release();
 assert.equal(await pending,`blobs/${f.request.projectId}/${original.artifactId}`);assert.equal(f.store.data.get(original.artifactId)?.toString(),'diff');
 await f.quota.settle(f.access.db(),quotaActor,f.request,f.bundle,{serverCommandId:qid(12),authorizationReceiptId:qid(13),scopeDigest:'a'.repeat(64)});
 assert.equal(f.access.settles,1);assert.equal(f.access.held,0n);assert(f.access.used>0n);assert.equal(f.store.puts,1);assert.equal(f.store.verifies,1);
});
test('source publish I1: 정산 collector의 다른 diffRef는 재게시/정산 성공으로 승격하지 않는다',async()=>{
 const f=await sourceQuotaFixture();await f.quota.publishSourceDiff(f.access.db(),quotaActor,f.request,f.bundle,f.projection,f.diffRef,f.bytes);
 const changed=structuredClone(f.projection);changed.proposal.proposal.diffRef.artifactId=qid(98);f.access.projection=changed;const held=f.access.held;
 await assert.rejects(f.quota.settle(f.access.db(),quotaActor,f.request,f.bundle,{serverCommandId:qid(12),authorizationReceiptId:qid(13),scopeDigest:'a'.repeat(64)}),/PROJECT_STORAGE_QUOTA_OUTCOME_UNKNOWN/);assert.equal(f.access.settles,0);assert.equal(f.access.held,held);assert.equal(f.store.puts,1);
});


function preservedProposal(){const art=(n:number)=>({artifactId:qid(n),bytes:1,contentHash:'a'.repeat(64),mediaType:'image/png'}),body={...art(1),mediaType:'text/plain;charset=utf-8'};return{proposal:{id:qid(2),baseRef:{id:qid(3),version:1,contentHash:'b'.repeat(64)},proposedContentRef:body,diffRef:{...art(4),mediaType:'application/json;charset=utf-8'},status:'PENDING'},content:{body,attachments:Array.from({length:200},(_,i)=>art(i+10)),sections:[],sourceRefs:[]},reason:'가'.repeat(20000)};}
test('source quota 단위정정: 기존 유효94692B proposal은 신규SourceEvent64KiB와 분리해 보존한다',()=>{
 const proposal=preservedProposal();assert.equal(Buffer.byteLength(canonicalJson(proposal)),94692);const projection={link:null,record:{value:'관측'},candidate:null,proposal},S=Buffer.byteLength(canonicalJson(projection)),part=sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,0);
 assert.equal(part.reservedBytes,String(4*S+10*65536));const actual=sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,[{kind:'PROPOSAL',row:{proposal_json:proposal.proposal,content_json:proposal.content,reason:proposal.reason}}]);assert(actual.actualBytes!==null&&BigInt(actual.actualBytes)>65536n);
});
test('source quota 단위정정: row 종류 COMMON·SourceEvent를 proposal로 위장한 row는 정산할 수 없다',()=>{
 const projection=quotaProjection(1),part=sourceEventQuotaPart('proposeDocumentSourceChange',ref.id,projection,0);for(const kind of ['COMMON','PROPOSAL'])assert.throws(()=>sourceEventQuotaAccounting('proposeDocumentSourceChange',part,projection,0,[{kind,row:{snapshot_json:{value:'관측'}}}]));
});


test('관측 기한종료는 원DB정착이 아니다: 인증callback 보존·종료후 query0·late결과 폐기',async()=>{
 let finishQuery!:(value:unknown)=>void,entered!:()=>void,queries=0,returned=false;const started=new Promise<void>(r=>entered=r),raw=new Promise(r=>finishQuery=r);let facade:PoolClient|undefined;
 const db={query:async()=>{queries++;entered();return await raw;}} as unknown as PoolClient;
 const source={read:async(owned:PoolClient)=>{facade=owned;await owned.query('SYNTHETIC_PENDING_QUERY');return observed();},current:async()=>observed()},service=new DocumentSourceObservations(source),short={...lease(),remaining:()=>5};
 class QueryOwnerMemoryAccess extends AccessRepository{constructor(){super({} as never,{installationId:qid(201),key:Buffer.alloc(32)});}override async authenticated<T>(_t:string,_c:string|null,body:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){try{return await body(db,quotaActor);}finally{returned=true;}}}
 const repository=new QueryOwnerMemoryAccess(),pending=repository.authenticated('model',null,(owned,a)=>service.observe(owned,a,scope,ref,short));void pending.catch(()=>{});
 await started;await new Promise<void>(r=>setTimeout(r,15));assert.equal(returned,false,'관측5ms 경과가 원query 정착이 아님');assert.equal(queries,1);
 await assert.rejects(facade!.query('SYNTHETIC_LATE_QUERY'));assert.equal(queries,1,'종료후 새 raw query 금지');assert.equal(returned,false);
 finishQuery({rows:[]});await assert.rejects(pending,/DOCUMENT_SOURCE_OBSERVATION_EXPIRED/);assert.equal(returned,true);assert.equal(queries,1);
});
