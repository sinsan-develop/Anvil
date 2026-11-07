/** 명시 격리 QA만 지원한다. Main 등록·exact SHA 이후에만 별도 실행한다. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {ProjectBackups} from '../../../apps/server/modules/backups/project-backups.ts';
import {readExportPayload,exact} from '../../../apps/server/modules/backups/project-backups-input.ts';
import {ProjectListCodec} from '../../../apps/server/modules/projects/service.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import {createHash} from 'node:crypto';
import {executionPreparationQaDatabase} from '../../../scripts/execution-preparation-qa.ts';
const reject=():never=>{throw Error('FN16_EXPLICIT_ISOLATED_QA_CONFIG_REQUIRED');};
export async function validateConfig(v:unknown){
 if(!exact(v,['kind','qaRoot','artifactRoot','exportRoot','connection','installationId','authKeyHex','sessionToken','csrfToken','command','expectedBytesHex'])||v.kind!=='FN16_ISOLATED_PG_QA'||!exact(v.connection,['host','port','database','user','password','ssl'])||typeof v.connection.database!=='string'||!/^anvil_fn16_qa_[a-z0-9_]+$/.test(v.connection.database)||typeof v.connection.host!=='string'||!v.connection.host||!Number.isSafeInteger(v.connection.port)||Number(v.connection.port)<1||Number(v.connection.port)>65535||typeof v.connection.user!=='string'||!v.connection.user||typeof v.connection.password!=='string'||!v.connection.password||v.connection.ssl!==false||typeof v.authKeyHex!=='string'||!/^[a-f0-9]{64}$/.test(v.authKeyHex)||typeof v.sessionToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.sessionToken)||typeof v.csrfToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.csrfToken)||typeof v.installationId!=='string'||typeof v.expectedBytesHex!=='string'||!/^(?:[a-f0-9]{2})*$/.test(v.expectedBytesHex))return reject();
 const roots=[v.qaRoot,v.artifactRoot,v.exportRoot];for(const root of roots){if(typeof root!=='string'||!path.isAbsolute(root)||path.resolve(root)!==root)return reject();const s=await fs.lstat(root);if(!s.isDirectory()||s.isSymbolicLink()||await fs.realpath(root)!==root)return reject();}
 const qa=v.qaRoot as string;for(const root of roots.slice(1)){const relative=path.relative(qa,root as string);if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))return reject();}
 if(v.artifactRoot===v.exportRoot)return reject();
 const c=v.command as ProjectCommand;if(!c||c.operation!=='exportProject'||c.targetId!==null||c.expectedVersion!==0||c.approvalRef!==null||!Array.isArray(c.baselineRefs)||c.baselineRefs.length)return reject();const payload=readExportPayload(c.payload);if(Buffer.from(v.expectedBytesHex,'hex').length!==payload.selection.artifactRef.bytes||createHash('sha256').update(Buffer.from(v.expectedBytesHex,'hex')).digest('hex')!==payload.selection.artifactRef.contentHash)return reject();return v as any;
}
export async function runProjectArtifactExportPg(input:unknown,options:{before:()=>void;queryMs:number;expires:number}={before:()=>{},queryMs:30000,expires:Infinity}){
 options.before();if(!Number.isSafeInteger(options.queryMs)||options.queryMs<1||options.queryMs>30000)throw Error('FN16_QA_QUERY_BUDGET_INVALID');
 const c=await validateConfig(input);options.before();const pool=executionPreparationQaDatabase(new Pool({...c.connection,max:2,connectionTimeoutMillis:Math.min(5000,options.queryMs),query_timeout:options.queryMs,statement_timeout:options.queryMs}),options.before);
 try{
  const identity=(await pool.query('SELECT current_database() name,current_user role,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) bypass')).rows[0];assert.equal(identity.name,c.connection.database);assert.equal(identity.role,'anvil_v3_app');assert.equal(identity.bypass,false);
  const schema=(await pool.query("SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=to_regclass('anvil.project_artifact_exports')")).rows[0];assert.ok(schema?.relrowsecurity&&schema?.relforcerowsecurity,'0043 must be explicitly applied by the isolated QA owner before running');
  const access=new AccessRepository(pool,{installationId:c.installationId,key:Buffer.from(c.authKeyHex,'hex')}),policy=new ProjectPolicyRepository(access),backups=new ProjectBackups(c.artifactRoot,c.exportRoot),command=c.command as ProjectCommand;
  const invoke=()=>policy.command(c.sessionToken,c.csrfToken,command,(db,a,p,deadline)=>backups.create(db,a,command,p,deadline!));
  const first:any=await invoke(),again=await invoke();assert.deepEqual(again,first);assert.equal(first.data.status,'EXPORT_STORED');
  const stored=await access.authenticated(c.sessionToken,null,(db,a)=>backups.read(db,a,command.projectId,first.data.ref.id));assert.deepEqual(stored.ref,first.data.ref);
  const file=await access.authenticated(c.sessionToken,null,(db,a)=>backups.file(db,a,command.projectId,first.data.ref.id,performance.now()+30000));assert.deepEqual(file.bytes,Buffer.from(c.expectedBytesHex,'hex'));
  const page=await access.authenticated(c.sessionToken,null,(db,a)=>backups.list(db,a,command.projectId,{view:'SELECTED_ARTIFACT_EXPORTS'},new ProjectListCodec(value=>access.signProjectCursor('FN16_SELECTED_ARTIFACT_EXPORTS:'+value))));assert.ok(page.items.some(j=>j.ref.id===first.data.ref.id));
  await access.authenticated(c.sessionToken,null,async(db,a)=>{
   await backups.read(db,a,command.projectId,first.data.ref.id);
   // 실제 0043 CHECK를 복제한 격리 임시 표: 정상 대조군은 허용하고 NULL 변종은 23514여야 한다.
   await db.query('CREATE TEMP TABLE fn16_manifest_null_probe (LIKE anvil.project_artifact_exports INCLUDING CONSTRAINTS) ON COMMIT DROP');
   const control=await db.query('INSERT INTO fn16_manifest_null_probe SELECT * FROM anvil.project_artifact_exports WHERE id=$1',[first.data.ref.id]);assert.equal(control.rowCount,1);
   for(const mutate of ["jsonb_set(manifest_json,'{selection}','null'::jsonb)","jsonb_set(jsonb_set(manifest_json,'{selection,artifactRef}','null'::jsonb),'{files,0,artifactRef}','null'::jsonb)"]){
    await db.query('SAVEPOINT fn16_null_case');let rejected=false;
    try{await db.query(`INSERT INTO fn16_manifest_null_probe SELECT id,project_id,document_id,document_version,document_content_hash,artifact_id,artifact_content_hash,actor_id,client_id,command_id,${mutate},anvil.source_read_hash(${mutate}),created_at FROM anvil.project_artifact_exports WHERE id=$1`,[first.data.ref.id]);}catch(e){assert.equal((e as {code?:string}).code,'23514');rejected=true;}finally{await db.query('ROLLBACK TO SAVEPOINT fn16_null_case');await db.query('RELEASE SAVEPOINT fn16_null_case');}
    assert.equal(rejected,true,'NULL manifest must fail the copied actual CHECK even with its hash recomputed');
   }
  });
  const db=await pool.connect();try{await db.query('BEGIN');const hidden=await db.query('SELECT id FROM anvil.project_artifact_exports');assert.equal(hidden.rowCount,0,'RLS without trusted actor context must hide jobs');await assert.rejects(()=>db.query('DELETE FROM anvil.project_artifact_exports WHERE id=$1',[first.data.ref.id]));await db.query('ROLLBACK');}finally{db.release();}
  return {kind:'FN16_ISOLATED_PG_QA_RESULT',database:identity.name,ref:first.data.ref,bytes:file.bytes.length,checks:['STANDARD_AUTH_POLICY_COMMAND','REAL_COMMIT_REPLAY','JOB_FK_PROVENANCE','RLS_APP_ROLE','ACTUAL_COPY_BYTES','LIST_READ','APP_DELETE_DENIED','NULL_SELECTION_CHECK_DENIED','NULL_ARTIFACT_REF_CHECK_DENIED'],scope:'selected artifact only; no production or user acceptance'};
 }finally{let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([pool.end(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('FN16_QA_CONNECTION_CLEANUP_TIMEOUT')),Math.max(1,Math.min(10000,options.expires-Date.now())));})]);}finally{if(timer)clearTimeout(timer);}}
}
async function run(){if(process.argv.length!==4||process.argv[2]!=='--config'||!path.isAbsolute(process.argv[3]!))return reject();const configPath=process.argv[3]!,stat=await fs.lstat(configPath);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)return reject();console.log(JSON.stringify(await runProjectArtifactExportPg(JSON.parse(await fs.readFile(configPath,'utf8')))));}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url)))run().catch(e=>{console.error(e instanceof Error?e.name:'FN16_QA_FAILED');process.exitCode=1;});
