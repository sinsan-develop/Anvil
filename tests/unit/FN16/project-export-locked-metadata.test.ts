import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {ProjectBackups} from '../../../apps/server/modules/backups/project-backups.ts';
import {AuthFailure,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readFileSync} from 'node:fs';
import {inspectArtifact,assertStoredArtifactReadable} from '../../../apps/server/storage/sensitive-inspection.ts';
import type {ExportSelection} from '../../../apps/server/modules/backups/project-backups-input.ts';
const id=(n:number)=>`a6160066-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),aid=id(4),did=id(5);
/** 실제 DB/FS/권한을 만들지 않는다. SELECT 허용·app UPDATE 회수/FOR SHARE 충돌의 명시 메모리 모델이다. */
function fixture(){
 const actor:AuthenticatedIdentity={actorId:uid,clientId:cid,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:id(6),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
 const artifactRef={artifactId:aid,bytes:7,contentHash:contentHash('본문\n'),mediaType:'text/plain'},formRef={id:id(7),version:1,contentHash:'a'.repeat(64)},content={body:artifactRef,attachments:[],sections:[],sourceRefs:[]};
 const document={project_id:pid,document_id:did,version:1,title:'합성 고정 문서',form_definition_id:formRef.id,form_version:formRef.version,form_hash:formRef.contentHash,stage_ref_json:null,content_json:content,content_hash:contentHash(canonicalJson({title:'합성 고정 문서',formRef,stageNodeRef:null,content}))};
 const artifact={id:aid,project_id:pid,content_hash:artifactRef.contentHash,bytes:artifactRef.bytes,media_type:artifactRef.mediaType,storage_key:`blobs/${pid}/${aid}`,state:'READY',inspection_json:null as any};
 const selection:ExportSelection={kind:'DOCUMENT_ARTIFACT',documentRef:{id:did,version:1,contentHash:document.content_hash},artifactRef};
 const authenticated={session:actor.authSession!.id,actor:uid,client:cid};let locked=0;
 const mode={appUpdate:false,sessionUser:'anvil_v3_app',active:true,member:true,archived:false,participation:'OWNER',functionError:''};const calls:{sql:string;values:unknown[]}[]=[];
 const denied=()=>Object.assign(new Error('permission denied for table artifacts'),{code:'42501'});
 const db={query:async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});
 if(sql==='SELECT * FROM anvil.document_versions WHERE project_id=$1 AND document_id=$2 AND version=$3')return{rows:values[0]===pid&&values[1]===did&&values[2]===1?[document]:[]};
 if(sql.includes('FROM anvil.artifacts')){if(sql.includes('FOR SHARE')&&!mode.appUpdate)throw denied();const [p,a,h,b,m]=values;return{rows:p===artifact.project_id&&a===artifact.id&&h===artifact.content_hash&&b===artifact.bytes&&m===artifact.media_type?[artifact]:[]};}
 if(sql.includes('anvil.fn16_export_artifact_metadata_locked(')){
  if(mode.functionError)throw Object.assign(new Error('합성 DB 경계'),{code:mode.functionError});assert.equal(values.length,8);const[p,a,h,b,m,session,user,client]=values;
  // protected helper의 현재 활성 세션/프로젝트 회원 의미. OWNER·control·미보관을 역사 읽기에 추가하지 않는다.
  if(mode.sessionUser!=='anvil_v3_app'||!mode.active||session!==authenticated.session||user!==authenticated.actor||client!==authenticated.client||!mode.member||p!==pid)throw denied();
  const rows=p===artifact.project_id&&a===artifact.id&&h===artifact.content_hash&&BigInt(String(b))===BigInt(artifact.bytes)&&m===artifact.media_type?[artifact]:[];if(rows.length)locked++;return{rows};
 }
 throw Error('미모델 SQL');
 }} as unknown as PoolClient;
 const service=new ProjectBackups();
 // 네 번째 actor는 기존 함수가 무시하므로 원 signature의 실제 SQL 충돌까지 도달한다.
 const read=(identity:AuthenticatedIdentity|undefined=actor,p=pid,s:ExportSelection=selection)=>Reflect.apply(service.sourceRow,service,[db,p,s,identity]) as Promise<typeof artifact>;
 return{actor,document,artifact,selection,mode,calls,db,service,read,authenticated,locks:()=>locked};
}
test('실제 sourceRow는 앱 SELECT만으로 고정8인자 잠금 reader를 소비하며 원 FOR SHARE 권한충돌을 없앤다',async()=>{
 const f=fixture();const baseline=await f.db.query('SELECT * FROM anvil.artifacts WHERE project_id=$1 AND id=$2 AND content_hash=$3 AND bytes=$4 AND media_type=$5',[pid,aid,f.artifact.content_hash,f.artifact.bytes,f.artifact.media_type]);assert.equal(baseline.rows.length,1,'일반 metadata SELECT는 허용된다');const row=await f.read();assert.deepEqual(row,f.artifact);assert.equal(f.mode.appUpdate,false,'app UPDATE 부여0');const call=f.calls.find(c=>c.sql.includes('fn16_export_artifact_metadata_locked'));assert(call,'고정 잠금 함수 소비');assert.deepEqual(call.values,[pid,aid,f.artifact.content_hash,f.artifact.bytes,f.artifact.media_type,f.actor.authSession!.id,uid,cid]);assert(!f.calls.some(c=>c.sql.includes('FROM anvil.artifacts')&&c.sql.includes('FOR SHARE')),'잠금없는 fallback/직접 app FOR SHARE0');
});
test('기존 문서 hash/첨부 귀속 실패는 metadata helper에 도달하기 전에 거절한다',async()=>{
 for(const kind of ['HASH','ATTACHMENT']){const f=fixture();const selection=structuredClone(f.selection);if(kind==='HASH')selection.documentRef.contentHash='f'.repeat(64);else selection.artifactRef.artifactId=id(99);await assert.rejects(f.read(f.actor,pid,selection),{message:kind==='HASH'?'EXPORT_DOCUMENT_REF_CONFLICT':'EXPORT_ARTIFACT_NOT_IN_VERSION'});assert.equal(f.calls.filter(c=>c.sql.includes('artifacts')||c.sql.includes('fn16_export_artifact_metadata_locked')).length,0);}
});

test('실 authSession.id 부재/잘못된식별은 metadata SQL 전401이며 inactive/주체불일치는 잠금 전 거절한다',async()=>{
 for(const kind of ['MISSING','INVALID','INACTIVE','ACTOR','CLIENT','SESSION','DB_ROLE']){const f=fixture();let identity:any=structuredClone(f.actor);if(kind==='MISSING')delete identity.authSession;if(kind==='INVALID')identity.authSession.id='not-a-uuid';if(kind==='INACTIVE')f.mode.active=false;if(kind==='ACTOR')identity.actorId=id(99);if(kind==='CLIENT')identity.clientId=id(99);if(kind==='SESSION')identity.authSession.id=id(99);if(kind==='DB_ROLE')f.mode.sessionUser='other_db_role';await assert.rejects(f.read(identity),{message:['MISSING','INVALID'].includes(kind)?'AUTH_REQUIRED':'EXPORT_STORAGE_NOT_READY',statusCode:['MISSING','INVALID'].includes(kind)?401:503},kind);assert.equal(f.locks(),0);if(['MISSING','INVALID'].includes(kind))assert.equal(f.calls.length,0);}
});
test('역사 member/새client 읽기는 OWNER/control/미보관이나 APPLIED command를 요구하지 않는다',async()=>{
 const f=fixture();f.mode.participation='VIEWER';f.mode.archived=true;f.actor.clientId=id(23);f.actor.authSession={...f.actor.authSession!,id:id(24)};f.authenticated.client=id(23);f.authenticated.session=id(24);assert.deepEqual(await f.read(),f.artifact);const call=f.calls.find(c=>c.sql.includes('fn16_export_artifact_metadata_locked'))!;assert.deepEqual(call.values.slice(5),[id(24),uid,id(23)]);assert.equal(f.locks(),1);assert(!f.calls.some(c=>/project_control|commands|authorization_receipts/.test(c.sql)));
 const denied=fixture();denied.mode.member=false;await assert.rejects(denied.read(),{message:'EXPORT_STORAGE_NOT_READY',statusCode:503});assert.equal(denied.locks(),0);
});
test('잠금 reader의5조건 mismatch·storagekey 위조·타project는 원본과의 충돌로 닫힌다',async()=>{
 for(const key of ['project_id','id','content_hash','bytes','media_type','storage_key']){const f=fixture();if(key==='project_id'||key==='id')(f.artifact as any)[key]=id(90);if(key==='content_hash')f.artifact.content_hash='f'.repeat(64);if(key==='bytes')f.artifact.bytes++;if(key==='media_type')f.artifact.media_type='application/octet-stream';if(key==='storage_key')f.artifact.storage_key=['blobs','other','artifact'].join('/');await assert.rejects(f.read(),{message:'EXPORT_ARTIFACT_INTEGRITY_FAILED',statusCode:503},key);assert.equal(f.locks(),key==='storage_key'?1:0);}
 const f=fixture();await assert.rejects(f.read(f.actor,id(99)),{message:'NOT_FOUND',statusCode:404});assert.equal(f.locks(),0);
});
test('격리/inspection을 숨기거나 성공으로 치환하지 않고 기존 실제bytes검산 함수에 그대로 전달한다',async()=>{
 const bytes=Buffer.from('본문\n'),normal=fixture();normal.artifact.inspection_json=inspectArtifact(bytes);const row=await normal.read();assertStoredArtifactReadable(row,bytes);
 const quarantine=fixture();quarantine.artifact.state='QUARANTINED';const blocked=await quarantine.read();assert.equal(blocked.state,'QUARANTINED');assert.equal(quarantine.locks(),1);assert.throws(()=>assertStoredArtifactReadable(blocked,bytes),{message:'ARTIFACT_QUARANTINED',statusCode:412});
 const invalid=fixture();invalid.artifact.inspection_json={...inspectArtifact(bytes),policyVersion:2};assert.throws(()=>assertStoredArtifactReadable(invalid.artifact,bytes),{message:'ARTIFACT_INSPECTION_INTEGRITY_FAILED',statusCode:503});
});
test('함수 부재42883/권한42501은 원 storage503 분류이며 무잠금 fallback0이다',async()=>{
 for(const code of ['42883','42501']){const f=fixture();f.mode.functionError=code;await assert.rejects(f.read(),{message:code==='42883'?'EXPORT_STORAGE_FAILED':'EXPORT_STORAGE_NOT_READY',statusCode:503});assert.equal(f.calls.filter(c=>c.sql.includes('fn16_export_artifact_metadata_locked')).length,1);assert(!f.calls.some(c=>c.sql.includes('FROM anvil.artifacts')));assert.equal(f.locks(),0);}
});
test('0066 정적계약은 고정8인자/8열·한정 NOLOGIN 소유자·같은 transaction 잠금/권한회수를 정의한다',()=>{
 const sql=readFileSync(new URL('../../../db/migrations/0066_export_locked_metadata_reader.sql.pending',import.meta.url),'utf8');
 for(const token of ['BEGIN;','COMMIT;','NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS','CREATE ROLE anvil_v3_fn16_export_reader_owner',"rolname='anvil_v3_fn16_export_reader_owner'",'SECURITY DEFINER VOLATILE PARALLEL UNSAFE SET search_path=pg_catalog,pg_temp',"session_user<>'anvil_v3_app'",'anvil.fn01_active(p_session,p_actor,p_client)','m.user_id=p_actor AND m.revoked_at IS NULL','FOR SHARE OF a','UPDATE(id) ON anvil.artifacts TO anvil_v3_fn16_export_reader_owner','SELECT(id) ON anvil.projects','SELECT(project_id,user_id,revoked_at) ON anvil.project_members','GRANT EXECUTE ON FUNCTION anvil.fn01_active(uuid,uuid,uuid)','REVOKE CREATE ON SCHEMA anvil','REVOKE anvil_v3_fn16_export_reader_owner FROM anvil_v3_migrator','m.roleid=r.oid OR m.member=r.oid',"pg_has_role('anvil_v3_app',r.oid,'MEMBER')",'a.grantee=0'])assert(sql.includes(token),token);
 const signature=sql.match(/CREATE FUNCTION anvil\.fn16_export_artifact_metadata_locked\(([\s\S]*?)\) RETURNS TABLE\(([^)]*)\)/);assert(signature);assert.equal(signature[1]!.split(',').length,8);assert.deepEqual(signature[2]!.split(',').map(s=>s.trim().split(' ')[0]),['id','project_id','content_hash','bytes','media_type','storage_key','state','inspection_json']);const body=sql.slice(sql.indexOf('LANGUAGE plpgsql SECURITY DEFINER'),sql.indexOf('REVOKE ALL ON FUNCTION'));
 for(const token of ['a.project_id=p_project','a.id=p_artifact','a.content_hash=p_hash','a.bytes=p_bytes','a.media_type=p_media_type'])assert(body.includes(token));assert(!/a\.state\s*=|archived_at|participation|project_control|command_id|current_setting/.test(body),'격리 필터/역사범위 축소/아직없는 command/GUC 전제0');assert(!/CREATE POLICY|DISABLE ROW LEVEL|FORCE ROW LEVEL|\bEXECUTE\s+['"]/.test(sql));assert(!/GRANT[^;]*ON anvil\.artifacts TO anvil_v3_app/.test(sql));
});

import {exportDb,exportCommand,actor as legacyActor,pid as legacyPid} from './project-backups-fixture.ts';
test('기존 exportDb의 새 SQL분기는 실제 sourceRow·8열과 역사member를 보존하며 틀린 신원/5조건을 거절한다',async()=>{
 const f=exportDb(Buffer.from('ordinary')),service=new ProjectBackups(),command=exportCommand(f);f.participation='VIEWER';f.control=false;const row=await service.sourceRow(f.db,legacyPid,command.payload.selection,legacyActor);assert.deepEqual(Object.keys(row),['id','project_id','content_hash','bytes','media_type','storage_key','state','inspection_json']);assert.equal(row.id,f.artifact.id);const sql='SELECT * FROM anvil.fn16_export_artifact_metadata_locked($1,$2,$3,$4,$5,$6,$7,$8)',params=[legacyPid,f.artifact.id,f.artifact.content_hash,f.artifact.bytes,f.artifact.media_type,legacyActor.authSession.id,legacyActor.actorId,legacyActor.clientId];
 for(const index of [5,6,7]){const changed=[...params];changed[index]=id(99);await assert.rejects(f.db.query(sql,changed),{code:'42501'});}for(const index of [1,2,3,4]){const changed=[...params];changed[index]=index===3?f.artifact.bytes+1:index===2?'f'.repeat(64):index===4?'different/type':id(99);assert.equal((await f.db.query(sql,changed)).rows.length,0);}f.member=false;await assert.rejects(f.db.query(sql,params),{code:'42501'});
});
