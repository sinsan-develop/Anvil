import assert from 'node:assert/strict';
import {test} from 'node:test';
import type {PoolClient} from 'pg';
import type {AccessRepository,AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {inspectArtifact} from '../../../apps/server/storage/sensitive-inspection.ts';
import {collectDocumentBodySnapshot} from '../../../apps/server/modules/backups/full-backup-snapshot-source.ts';
import {verifyDocumentBodyHistory} from '../../../apps/server/modules/backups/full-backup-history-verification.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const id=(n:number)=>`b2000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const pinned=(n:number)=>({id:id(n),version:1,contentHash:'b'.repeat(64)});
const hash=(value:unknown)=>contentHash(canonicalJson(value));
const projectId=id(1),documentId=id(2),bodyId=id(3),actorId=id(4),clientId=id(5),sessionId=id(6);
const at='2026-11-28T00:00:00.000Z';
const bytes=Buffer.from('공개 합성 문서');
const bodyRef={artifactId:bodyId,bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain'};
const formRef={id:id(7),version:1,contentHash:'a'.repeat(64)};
const content={body:bodyRef,attachments:[],sections:[],sourceRefs:[]};
const ref={id:documentId,version:1,contentHash:hash({title:'합성',formRef,stageNodeRef:null,content})};
const original={project_id:projectId,document_id:documentId,version:1,form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,
 stage_ref_json:null,body_artifact_id:bodyId,title:'합성',content_json:content,source_refs_json:[],content_hash:ref.contentHash,sections_json:[],
 author_ref_json:{kind:'HUMAN',userId:actorId},validation_json:{formatOnly:true},reason:'합성',client_id:clientId,command_id:id(8),created_at:at};
const artifact={id:bodyId,project_id:projectId,bytes:bytes.length,content_hash:bodyRef.contentHash,
 media_type:bodyRef.mediaType,state:'READY',inspection_json:inspectArtifact(bytes)};
const input={projectId,documentRef:ref,limits:{metadataBytes:65536,inputBytes:65536,fileCount:1,deadlineMs:10000}};

function fixture(mode='valid'){
 const trace:string[]=[];
 const person:AuthenticatedIdentity={actorId,clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,
  authSession:{id:sessionId,idleExpiresAt:'2026-11-28T00:01:00.000Z',absoluteExpiresAt:'2026-11-28T00:20:00.000Z'}};
 let rc=0,rr=0,obs=0;
 let liveRR=false;
 function db(scope:string){
  return {async query(sql:string,params:unknown[]=[]){
   assert(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|GRANT)\b/i.test(sql),'정상 운영 표 변경 0');
   if(sql.startsWith('BEGIN')){assert.equal(scope,'RR');assert.match(sql,/REPEATABLE READ READ ONLY/);liveRR=true;trace.push('RR:begin');return {command:'BEGIN',rows:[]};}
   if(sql==='ROLLBACK'){assert(liveRR);liveRR=false;trace.push('RR:rollback');return {command:mode==='rollback-unknown'?'UNKNOWN':'ROLLBACK',rows:[]};}
   if(sql.includes("'statement_timeout'")){assert(Number(params[0])>0&&Number(params[0])<=input.limits.deadlineMs);return {rows:[{ms:params[0]}]};}
   if(sql.includes('pg_current_snapshot')){assert(liveRR);obs++;return {rows:[{snapshot:obs>1&&mode==='snapshot-changed'?'4:15:':'4:14:',at:new Date(at),read_only:'on',isolation:'repeatable read'}]};}
   if(sql.includes('transaction_isolation'))return {rows:[{isolation:'read committed',at:new Date(at)}]};
   if(sql==='SELECT clock_timestamp() AS at')return {rows:[{at:new Date(at)}]};
   if(sql.includes("'anvil.actor_id'")){assert.equal(scope,'RR');assert.deepEqual(params,[actorId,clientId]);trace.push('RR:rls');return {rows:[{actor_id:actorId,client_id:clientId}]};}
   if(sql.includes('FROM anvil.projects p')){assert.deepEqual(params,[projectId,actorId]);assert(scope==='RR'?liveRR:!liveRR);return {rows:[{id:projectId,archived_at:null,participation:scope==='RC2'&&mode==='revoked'?'VIEWER':'OWNER'}]};}
   if(sql.includes('FROM anvil.project_control')){assert.equal(params[0],projectId);return {rows:[{actor_id:actorId,client_id:clientId,generation:1,version:1,revoked_at:null}]};}
   assert(sql.includes('FN16_D2_BODY')&&sql.includes('LIMIT 2')&&params[0]===projectId);
   const table=sql.match(/FROM anvil\.(\w+)/)?.[1];
   trace.push(`${scope}:${table}`);
   let row;
   if(table==='document_versions'){assert.deepEqual(params.slice(1,-1),[documentId,1,ref.contentHash]);row=original;}
   else if(table==='document_artifact_links'){assert.deepEqual(params.slice(1,-1),[documentId,1]);row={project_id:projectId,document_id:documentId,version:1,kind:'BODY',artifact_id:mode==='wrong-link'?id(30):bodyId};}
   else if(table==='artifacts'){assert.equal(params[1],bodyId);assert.match(sql,/draft_id IS NULL.*storage_key=/);row=scope==='RC2'&&mode==='current-artifact-change'?{...artifact,state:'QUARANTINED'}:artifact;}
   else throw Error('잘못된 조회');
   return {rows:[{inventory_data:structuredClone(row),row_bytes:Buffer.byteLength(JSON.stringify(row))}]};
  },release(error?:Error){trace.push(error?'RR:discard':'RR:release');}} as unknown as PoolClient;
 }
 const access:Pick<AccessRepository,'authenticated'|'pool'>={
  async authenticated<T>(_token:string,csrf:string|null,work:(db:PoolClient,a:AuthenticatedIdentity)=>Promise<T>){
   assert.equal(csrf,'synthetic-csrf');assert(!liveRR);const scope=`RC${++rc}`;
   trace.push(`${scope}:begin`);const value=await work(db(scope),person);trace.push(`${scope}:commit`);return value;
  },
  pool:{async connect(){rr++;assert.equal(rr,1);return db('RR');}} as unknown as AccessRepository['pool']
 };
 const reader={async open(expected:unknown){
  assert(!liveRR);
  assert.deepEqual(expected,{projectId,artifactId:bodyId,bytes:bytes.length,contentHash:bodyRef.contentHash});
  trace.push('body:open');
  let read=false;
  return {async read(){if(read)return Buffer.alloc(0);read=true;return mode==='wrong-body'?Buffer.alloc(bytes.length):Buffer.from(bytes);},
   async close(){trace.push('body:close');if(mode==='close-unknown')throw Error('합성 close 불명');}};
 }};
 const admission={async readCurrent(_db:Pick<PoolClient,'query'>,actor:AuthenticatedIdentity,scope:{projectId:string;documentRef:typeof ref}){
  assert.equal(actor,person);assert.deepEqual(scope,{projectId,documentRef:ref});assert(!liveRR);
  trace.push(`RC${rc}:admission`);
  if(mode==='policy-denied'||mode==='policy-revoked'&&rc===2)return null;
  return {purpose:'FN16_D2_DOCUMENT_BODY_ADMISSION_V1',projectId,documentRef:ref,actorId,clientId,sessionId,credentialGeneration:1,controlGeneration:1,
   jobRef:pinned(10),reservationRef:pinned(11),policyRef:pinned(mode==='new-policy'&&rc===2?19:12),targetProtectedRef:pinned(13),
   retentionPolicyRef:pinned(14),encryptionKeyRef:pinned(15),verificationPolicyRef:pinned(16),expiresAt:'2026-11-28T00:00:09.000Z'};
 }};
 const run=()=>collectDocumentBodySnapshot(access,'synthetic-token','synthetic-csrf',input,mode==='unconfigured'?null:admission,reader,new AbortController().signal);
 return {run,trace};
}

test('한 RR의 보관 문서·BODY 관계와 정확 바이트만 독립 재검산한다',async()=>{
 const f=fixture(),capture=await f.run();
 assert.deepEqual(f.trace,['RC1:begin','RC1:admission','RC1:commit','RR:begin','RR:rls','RR:document_versions','RR:document_artifact_links','RR:artifacts',
  'RR:rollback','RR:release','body:open','body:close','RC2:begin','RC2:admission','RC2:document_versions','RC2:document_artifact_links','RC2:artifacts','RC2:commit']);
 assert.deepEqual(capture.body,bytes);
 assert.equal(capture.coverage,'DOCUMENT_BODY_ONLY');
 const expected={projectId,documentRef:ref,jobRef:pinned(10),snapshot:'4:14:',snapshotHash:capture.snapshotHash};
 const independent=()=>({snapshot:JSON.parse(JSON.stringify(capture.snapshot)),body:Buffer.from(capture.body)});
 const result=await verifyDocumentBodyHistory(expected,async()=>independent());
 assert.deepEqual(result.documentRef,ref);
 assert.deepEqual(result.artifact,bodyRef);
 assert.equal(result.bodyVerified,true);
 assert.equal(result.documentHistoryComplete,false);
 assert.equal(result.restorable,false);
 assert.equal(result.executionAuthorized,false);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.body[0]=restored.body[0]!^1;return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.snapshot.observation.snapshot='4:15:';return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory(expected,async()=>{const restored=independent();restored.snapshot.rows.link.artifact_id=id(99);return restored;}),/HISTORY_INVALID/);
 await assert.rejects(()=>verifyDocumentBodyHistory({...expected,jobRef:pinned(99)},async()=>independent()),/HISTORY_INVALID/);
});

test('원 승인 백업 입장이 없거나 최종 정책이 바뀌면 수집 권위를 만들지 않는다',async()=>{
 for(const mode of ['unconfigured','policy-denied','policy-revoked','new-policy']){
  const f=fixture(mode);
  await assert.rejects(f.run,/SNAPSHOT_(ADMISSION_|AUTH_CHANGED)/);
  assert(!f.trace.includes('RC2:document_versions'),mode);
  if(mode==='unconfigured'||mode==='policy-denied')assert(!f.trace.includes('RR:begin'),mode);
 }
});

test('교차 관계·스냅샷·회수 불명·권한 변경에서 수집 결과를 반환하지 않는다',async()=>{
 for(const mode of ['wrong-link','snapshot-changed','rollback-unknown','wrong-body','close-unknown','revoked','current-artifact-change']){
  const f=fixture(mode);
  await assert.rejects(f.run);
  assert.equal(f.trace.includes('RC2:commit'),false,mode);
  assert.equal(f.trace.filter(s=>s==='RR:rollback').length,1,mode);
  if(mode==='rollback-unknown')assert(f.trace.includes('RR:discard'));
  if(['wrong-link','snapshot-changed','rollback-unknown'].includes(mode))assert(!f.trace.includes('body:open'),mode);
  else assert.equal(f.trace.filter(s=>s==='body:close').length,1,mode);
 }
});
