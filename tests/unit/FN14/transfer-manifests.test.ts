import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../../apps/server/app.ts';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';
import {readFileSync} from 'node:fs';
import type {PoolClient} from 'pg';
import type {AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {ProjectTransferManifests} from '../../../apps/server/modules/transfers/transfer-manifests.ts';
import {ProjectTransferPreparationRecords} from '../../../apps/server/modules/transfers/preparation-records.ts';
import {PreparationRecordStore} from '../../../apps/server/modules/transfers/preparation-record-store.ts';
import {PreparationRecordVerifiers} from '../../../apps/server/modules/transfers/preparation-record-verifiers.ts';
import {preparationHash} from '../../../apps/server/modules/transfers/preparation-record-input.ts';
import {originalFixture} from '../UI09/transfer-original-fixture.ts';
import {pid as storedProject} from '../UI09/transfer-fixture.ts';

const id=(n:number)=>`ab141104-0000-4000-8000-${String(n).padStart(12,'0')}`;
const pid=id(1),origin='https://anvil-synthetic.invalid';
const path=`/api/v1/projects/${pid}/transfers/${id(2)}/manifest`;

test('계약 경로의 인계본 읽기는 외부 자격과 익명을 거절하며 exact ref만 허용한다',async()=>{
 const repository={installationId:id(99),async authenticated(){throw new AuthFailure('AUTH_REQUIRED',401);}};
 const app=buildApp({},undefined,{repository:repository as never,origin});
 const headers={host:'anvil-synthetic.invalid'},query='?version=1&contentHash='+'a'.repeat(64);
 try{
  assert.equal((await app.inject({url:path+query,headers})).statusCode,401);
  assert.equal((await app.inject({url:path+query,headers:{...headers,authorization:'Bearer synthetic-only'}})).statusCode,403);
  for(const suffix of ['',query+'&version=1',query.replace('version=1','version=2'),query+'&latest=true']){
   assert.equal((await app.inject({url:path+suffix,headers})).statusCode,400,suffix);
  }
 }finally{await app.close();}
});

type Row=Record<string,any>;
const at='2026-10-31T02:00:00.000Z',deadline='2026-10-31T02:30:00.000Z',userId=id(3),clientId=id(4);
const reject=(code:string,status:number)=>(e:unknown)=>e instanceof AuthFailure&&e.message===code&&e.statusCode===status;

function memory(){
 const original=originalFixture(),state={now:at,transactionAt:at,actorId:userId,clientId,denyRead:false,denySource:false,failManifestInsert:false,loseCommitReply:false};
 const tables={preparations:[] as Row[],versions:[] as Row[],manifests:[] as Row[],commands:[] as Row[],receipts:[] as Row[],audits:[] as Row[]};
 const trace:string[]=[];
 const rows=(...items:Row[])=>({rows:items,rowCount:items.length});
 const date=()=>new Date(state.transactionAt);
 const policy=()=>{
  const rules=['createTransferPreparationRecord','readTransferPreparationRecord','createTransferManifest','readTransferManifest'].map((op,i)=>({
   ruleId:'R'+i,subjectRef:{kind:'HUMAN',userId:state.actorId},operations:[op],targetScopes:[{kind:'PROJECT',projectId:storedProject}],
   disposition:op==='readTransferManifest'&&state.denyRead?'DENY':'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z',
  }));
  return {id:id(7),head_version:1,rules_json:rules,content_hash:preparationHash({rules,reason:'합성 정책',reviewRefs:[]}),
   reason:'합성 정책',review_refs:[],created_at:date()};
 };
 const graph=(commandId:string)=>({command_row:tables.commands.find(c=>c.id===commandId),receipt_rows:tables.receipts.filter(r=>r.command_id===commandId),audit_rows:tables.audits.filter(a=>a.command_id===commandId)});
 const commandRows=(p:any[])=>tables.commands.filter(c=>c.project_id===p[0]&&c.actor_id===p[1]&&c.command_id===p[2]);
 const db={async query(sql:string,p:any[]=[]){
  trace.push(sql);
  if(sql==='SELECT transaction_timestamp() AS at')return rows({at:date()});
  if(sql==='SELECT clock_timestamp() AS at')return rows({at:new Date(state.now)});
  if(sql.includes('FROM anvil.projects p JOIN anvil.project_members'))return p[0]===storedProject?rows({id:storedProject,archived_at:null,participation:'OWNER'}):rows();
  if(sql.includes('FROM anvil.project_control'))return rows({actor_id:userId,client_id:clientId,generation:1,revoked_at:null});
  if(sql.includes('FROM anvil.permission_policies'))return rows(policy());
  if(sql.includes('FN14_COMMAND_KEY')||sql.startsWith('SELECT operation,request_hash,result_ref FROM anvil.commands'))return rows(...commandRows(p));
  if(sql.includes('FN14_RECORD_USAGE'))return rows({record_count:String(tables.preparations.length),version_count:String(tables.versions.length),snapshot_bytes:'0'});
  if(sql.startsWith('INSERT INTO anvil.transfer_preparation_records')){tables.preparations.push({id:p[0],project_id:p[1],creator_user_id:p[2],creator_client_id:p[3],version:1,created_at:date()});return rows();}
  if(sql.startsWith('INSERT INTO anvil.transfer_preparation_record_versions')){tables.versions.push({record_id:p[0],project_id:p[1],version:1,snapshot_json:JSON.parse(p[2]),content_hash:p[3],command_id:p[4],policy_ref_json:JSON.parse(p[5]),created_at:date()});return rows();}
  if(sql.includes('FN14_RECORD_READ'))return rows(...tables.preparations.filter(r=>r.project_id===p[0]&&r.id===p[1]&&r.creator_user_id===p[2]).map(r=>{
   const v=tables.versions.find(v=>v.record_id===r.id)!;
   return {...r,...v,stored_version:v.version,version_created_at:v.created_at,...graph(v.command_id)};
  }));
  if(sql.startsWith('SELECT id FROM anvil.transfer_manifests'))return rows(...tables.manifests.filter(m=>m.project_id===p[0]&&m.preparation_id===p[1]));
  if(sql.startsWith('INSERT INTO anvil.transfer_manifests')){
   if(state.failManifestInsert)throw new Error('SYNTHETIC_INSERT_FAILURE');
   const [id,project_id,creator_user_id,creator_client_id,preparation_id,preparation_hash,command_id,snapshot,content_hash]=p;
   tables.manifests.push({id,project_id,creator_user_id,creator_client_id,version:1,preparation_id,preparation_version:1,preparation_hash,command_id,snapshot_json:JSON.parse(snapshot),content_hash,created_at:date()});
   return rows();
  }
  if(sql.includes('FN14_MANIFEST_READ'))return rows(...tables.manifests.filter(m=>m.project_id===p[0]&&m.id===p[1]&&m.version===p[2]&&m.content_hash===p[3]&&m.creator_user_id===p[4]).map(m=>({...m,...graph(m.command_id)})));
  if(sql.startsWith('INSERT INTO anvil.commands')){tables.commands.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],project_id:p[1],actor_id:p[2],client_id:p[3],
   operation:p[4],command_id:p[5],request_hash:p[6],operation_id:p[7],state:'APPLIED',authorization_receipt_id:p[8],approval_consumption_id:p[9],
   expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),payload_ref:p[13],result_ref:JSON.parse(p[14]),received_at:date(),completed_at:date()});return rows();}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){tables.receipts.push({id:p[0],scope_kind:'PROJECT',scope_id:p[1],command_id:p[2],
   subject_ref:JSON.parse(p[3]),policy_ref:JSON.parse(p[4]),scope_digest:p[5],approval_decision_ref:p[6],authorized_at:date()});return rows();}
  if(sql.startsWith('INSERT INTO anvil.audit_events')){tables.audits.push({project_id:p[0],server_sequence:tables.audits.length+1,event_id:p[1],
   actor_ref:JSON.parse(p[2]),client_ref:p[3],command_id:p[4],operation_id:p[5],target_ref:JSON.parse(p[6]),policy_ref:JSON.parse(p[7]),
   approval_ref:p[8],outcome:'APPLIED',reason_code:p[9],scope_digest:p[10],source_kind:'HUMAN_COMMAND',recorded_at:date()});return rows();}
  if(sql.startsWith('SELECT set_config('))return rows();
  throw Error('UNMODELED_TRANSFER_SQL');
 }} as unknown as PoolClient;
 const access={async authenticated<T>(_token:string,_csrf:string|null,work:(client:PoolClient,actor:AuthenticatedIdentity)=>Promise<T>){
  const previous=structuredClone(tables);
  let result:T;
  try{result=await work(db,{actorId:state.actorId,clientId:state.clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,
   authSession:{id:id(5),idleExpiresAt:'2098-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}});}
  catch(e){Object.assign(tables,previous);throw e;}
  if(state.loseCommitReply){state.loseCommitReply=false;throw new Error('SYNTHETIC_COMMIT_REPLY_LOST');}
  return result;
 }};
 const verifiers=new PreparationRecordVerifiers({transport:'SYNTHETIC_ONLY',commandLock:async()=>{},lock:async()=>{},
  assignment:async()=>({...original.confirmed,currentDraftRef:original.confirmed.snapshot.draftRef}),
  context:async()=>original.context,source:async(s,value)=>{
   assert.equal(s.db,db);trace.push('PROTECTED_SOURCE_READ');
   if(state.denySource)throw new AuthFailure('NOT_FOUND',404);
   return {projectId:s.projectId,source:value};
  },
 });
 const prepared=new ProjectTransferPreparationRecords({transport:'SYNTHETIC_ONLY',access,verifiers});
 const manifests=new ProjectTransferManifests(access,new PreparationRecordStore(verifiers));
 const envelope={schemaVersion:1,projectId:storedProject,clientId,controlGeneration:1,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null};
 return {state,tables,trace,original,manifests,async createParent(){
  return prepared.command('MODEL','MODEL_CSRF',{...envelope,operation:'createTransferPreparationRecord',commandId:id(8),
   payload:{assignmentRef:original.confirmed.ref,contextRef:original.context.ref,roleRef:null,oldBindingRef:null,targetConnectionRef:null,
    intentExpiresAt:deadline,reason:'고정 합성 보호 준비'}});
 },command(preparationRef:unknown){return {...envelope,operation:'createTransferManifest',commandId:id(9),payload:{preparationRef}};}};
}

test('원 준비 영수증과 보호 원문을 대조해 인계본 한 건을 보관하고 같은 명령을 읽는다',async()=>{
 const f=memory(),parent=await f.createParent(),parentBefore=structuredClone(f.tables.preparations);
 const command=f.command(parent.data.ref);
 f.state.transactionAt=f.state.now='2026-10-31T02:00:01.000Z';
 const result=await f.manifests.command('MODEL','MODEL_CSRF',command);
 const {ref,manifest}=result.data;
 assert.equal(f.tables.manifests.length,1);assert.deepEqual(manifest.preparationRef,parent.data.ref);
 assert.deepEqual(manifest.sourceRefs,parent.data.record.sourceRefs);assert.equal(manifest.sourceRefs.length,1);assert(!JSON.stringify(manifest).includes(f.original.body));
 assert.deepEqual(manifest.gaps,[...parent.data.record.gaps,'COMPLETED_UNVERIFIED','UNFINISHED_UNVERIFIED','CURRENT_POSITION_UNVERIFIED','DECISIONS_WITH_REASONS_UNVERIFIED']);
 assert.deepEqual(manifest.completed,[]);assert.deepEqual(manifest.unfinished,[]);assert.equal(manifest.currentPosition,null);assert.deepEqual(manifest.decisionsWithReasons,[]);
 assert.equal(manifest.capabilities,'UNVERIFIED');assert.equal(manifest.understandingState,'NOT_REVIEWED');assert.equal(manifest.bindingFrozen,false);
 assert.equal(manifest.executionAuthorized,false);assert.equal(manifest.resumeAuthorized,false);assert.equal(parent.data.manifestStored,false);
 assert.deepEqual(f.tables.preparations,parentBefore);assert.equal(preparationHash(manifest),ref.contentHash);
 const rows=structuredClone(f.tables),before=f.trace.length;
 f.state.now=deadline;
 assert.deepEqual(await f.manifests.command('MODEL','MODEL_CSRF',command),result);
 const fetched=await f.manifests.read('MODEL',storedProject,ref.id,'1',ref.contentHash);
 assert.deepEqual(fetched.manifest,{...manifest,contentHash:ref.contentHash});assert.equal(fetched.currentStatus.intentExpired,true);
 assert.equal(fetched.currentStatus.usableForTransfer,false);assert(!f.trace.slice(before).some(sql=>/^INSERT|^UPDATE|^DELETE/.test(sql)));
 assert.equal(f.trace.slice(before).filter(sql=>sql==='PROTECTED_SOURCE_READ').length,2);
 assert.deepEqual(f.tables,rows);
});

test('인계본은 다른 부모·작성자·버전·원문 회수·다른 명령으로 보관본을 대체하지 않는다',async()=>{
 const f=memory(),parent=await f.createParent(),command=f.command(parent.data.ref);
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',f.command({...parent.data.ref,version:2})),reject('INPUT_INVALID',422));
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',f.command({...parent.data.ref,contentHash:'e'.repeat(64)})),reject('NOT_FOUND',404));
 f.state.denySource=true;
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',command),reject('NOT_FOUND',404));assert.equal(f.tables.manifests.length,0);
 f.state.denySource=false;
 const result=await f.manifests.command('MODEL','MODEL_CSRF',command),ref=result.data.ref;
 await assert.rejects(f.manifests.read('MODEL',pid,ref.id,'1',ref.contentHash),reject('NOT_FOUND',404));
 await assert.rejects(f.manifests.read('MODEL',storedProject,ref.id,'1','d'.repeat(64)),reject('NOT_FOUND',404));
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',{...command,commandId:id(10)}),reject('VERSION_CONFLICT',409));
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',f.command({...parent.data.ref,id:id(11)})),reject('IDEMPOTENCY_CONFLICT',409));
 f.state.actorId=id(12);
 await assert.rejects(f.manifests.read('MODEL',storedProject,ref.id,'1',ref.contentHash),reject('NOT_FOUND',404));
 f.state.actorId=userId;f.state.denyRead=true;
 await assert.rejects(f.manifests.read('MODEL',storedProject,ref.id,'1',ref.contentHash),reject('PROJECT_OPERATION_DENIED',403));
 f.state.denyRead=false;f.state.denySource=true;
 await assert.rejects(f.manifests.read('MODEL',storedProject,ref.id,'1',ref.contentHash),reject('NOT_FOUND',404));
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',command),reject('NOT_FOUND',404));
 assert.equal(f.tables.manifests.length,1);
});

test('새 인계본 쓰기 실패는 함께 쓰던 원 명령·영수증·감사를 되돌리고 손상 영수증은 읽지 않는다',async()=>{
 const f=memory(),parent=await f.createParent(),before=structuredClone(f.tables),command=f.command(parent.data.ref);
 f.state.failManifestInsert=true;
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',command),reject('TRANSFER_MANIFEST_STORAGE_UNAVAILABLE',503));assert.deepEqual(f.tables,before);
 f.state.failManifestInsert=false;
 const result=await f.manifests.command('MODEL','MODEL_CSRF',command),ref=result.data.ref;
 f.tables.audits.pop();
 await assert.rejects(f.manifests.read('MODEL',storedProject,ref.id,'1',ref.contentHash),reject('TRANSFER_MANIFEST_INTEGRITY_FAILED',503));
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',command),reject('TRANSFER_MANIFEST_INTEGRITY_FAILED',503));
});

test('정착 응답을 잃었을 때 원 command는 같은 인계본 한 건과 영수증만 복구한다',async()=>{
 const f=memory(),parent=await f.createParent(),command=f.command(parent.data.ref);
 f.state.loseCommitReply=true;
 await assert.rejects(f.manifests.command('MODEL','MODEL_CSRF',command),reject('TRANSFER_MANIFEST_STORAGE_UNAVAILABLE',503));
 const rows=structuredClone(f.tables),original=rows.commands.find(c=>c.command_id===command.commandId);
 assert(original);assert.equal(rows.manifests.length,1);
 assert.deepEqual(await f.manifests.command('MODEL','MODEL_CSRF',command),original.result_ref);
 assert.deepEqual(f.tables,rows);
});

test('미적용 SQL은 선택한 준비와 인계본을 같은 거래에서 결박하고 이전 준비 표 ACL을 변경하지 않는다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0114_transfer_manifests.sql.pending',import.meta.url),'utf8');
 const statements=sql.replace(/^--[^\n]*\n/,'').trim();
 assert.match(statements,/^BEGIN;[\s\S]*COMMIT;$/);
 assert.match(sql,/FOREIGN KEY\(project_id,preparation_id\) REFERENCES anvil\.transfer_preparation_records/);
 assert.match(sql,/FOREIGN KEY\(preparation_id,preparation_version\) REFERENCES anvil\.transfer_preparation_record_versions/);
 assert.match(sql,/v\.content_hash IS DISTINCT FROM m\.preparation_hash/);
 assert.match(sql,/p\.creator_user_id IS DISTINCT FROM m\.creator_user_id/);
 assert.match(sql,/NOT anvil\.fn14_record_complete\(v\.command_id\)/);
 assert.match(sql,/snapshot IS DISTINCT FROM m\.snapshot_json OR anvil\.fn14_record_hash\(snapshot\) IS DISTINCT FROM m\.content_hash/);
 assert.match(sql,/CREATE CONSTRAINT TRIGGER fn14_manifest_command_complete[\s\S]*WHEN\(NEW\.operation='createTransferManifest'\)/);
 assert.match(sql,/CREATE TRIGGER fn14_manifest_immutable BEFORE UPDATE OR DELETE/);
 assert.doesNotMatch(sql,/\bGRANT\b|SECURITY DEFINER|ALTER TABLE\s+anvil\.transfer_preparation_/i);
});
