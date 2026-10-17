import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,lstat,mkdir,realpath,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {validateDevelopmentDbConfig} from '../../../apps/server/storage/development-config.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {getPinnedForm} from '../../../apps/web/src/features/methodologies/forms-api.ts';
import {readDocument} from '../../../apps/web/src/features/design-trace/api.ts';
import {newDocument,editDocument,prepareDocumentSave,continueDocumentSave} from '../../../apps/web/src/features/design-trace/editor-api.ts';
import {newDesignIndex,prepareDesignIndex,sendDesignIndex,readDesignIndex} from '../../../apps/web/src/features/design-trace/design-index-api.ts';
import {readRegisteredScreen} from '../../../apps/web/src/features/design-trace/screen-region-navigation.ts';

// 동일 Web 함수→실제 Fastify/비관리자 PG/원문. 실제 제공 화면·실사용자 인수가 아니다.
test('등록 화면의 정확 v1 조회·명시 편집/저장·v2 재조회 및 과거/index 보존과 격리/CAS',async()=>{
 const run=process.env.ANVIL_UI06_SCREEN_REGION_RUN,expires=Date.parse(process.env.ANVIL_UI06_SCREEN_REGION_EXPIRES??'');
 if(process.platform!=='linux'||!run||!/^[0-9a-f-]{36}$/.test(run)||!Number.isFinite(expires)||Date.now()+120_000>=expires||!process.env.ANVIL_DB_CONFIG||!process.env.ANVIL_MIGRATOR_CONFIG)throw Error('REGISTERED_WSL_QA_REQUIRED_NOT_SKIP');
 const root='/tmp/anvil-v3-ui06-screen-region-edit-'+run,prefix='qa-ui06-screen-region-edit-'+run;
 const parent=await lstat('/tmp');assert.ok(parent.isDirectory()&&!parent.isSymbolicLink());assert.equal(await realpath('/tmp'),'/tmp');
 await assert.rejects(lstat(root),(e:any)=>e.code==='ENOENT');
 const pool=new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_DB_CONFIG,'utf8')),'app'));
 const admin=new Pool(validateDevelopmentDbConfig(JSON.parse(await readFile(process.env.ANVIL_MIGRATOR_CONFIG,'utf8')),'migrator'));
 const access=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository:access,origin:'https://localhost:3830',artifactRoot:root});
 const users=[randomUUID(),randomUUID()],projects=[randomUUID(),randomUUID()],ownedUsers:string[]=[],ownedProjects:string[]=[];let rootCreated=false;
 try{
  const password=randomBytes(32).toString('base64url'),phc=await hashPassword(password);
  for(const[i,id]of users.entries()){await pool.query("INSERT INTO anvil.users(id,login_name,normalized_login_name,display_name,status)VALUES($1,$2,$2,'시안 편집 합성 QA','ACTIVE')",[id,prefix+'-'+i]);ownedUsers.push(id);await pool.query('INSERT INTO anvil.password_credentials(user_id,argon2_phc,credential_generation)VALUES($1,$2,1)',[id,phc]);}
  let own=await access.login(prefix+'-0',password,'시안 편집 QA',prefix+'-0');const other=await access.login(prefix+'-1',password,'타 프로젝트 QA',prefix+'-1');
  own=await access.reauthenticate(own.token,own.csrfToken,password,prefix+'-0');
  for(const[i,pid]of projects.entries()){await admin.query("INSERT INTO anvil.projects(id,name,purpose,desired_outcome)VALUES($1,'시안 편집 합성 QA','정확 버전','기존 저장 왕복')",[pid]);ownedProjects.push(pid);await admin.query("INSERT INTO anvil.project_members(project_id,user_id,participation)VALUES($1,$2,'OWNER')",[pid,users[i]]);await admin.query('INSERT INTO anvil.project_control(project_id,actor_id,client_id,generation)VALUES($1,$2,$3,1)',[pid,users[i],i?other.clientId:own.clientId]);}
  const headers=(s=own)=>({host:'localhost:3830',origin:'https://localhost:3830',cookie:'__Host-anvil.sid='+s.token,'x-anvil-csrf':s.csrfToken});
  const clientFor=(s=own)=>new ApiClient(async(input,init)=>{const response=await app.inject({method:(init?.method??'GET')as'GET'|'POST',url:String(input),headers:{...headers(s),...Object.fromEntries(new Headers(init?.headers).entries())},payload:init?.body instanceof Uint8Array?Buffer.from(init.body):typeof init?.body==='string'?init.body:undefined});return new Response(new Uint8Array(response.rawPayload),{status:response.statusCode,headers:{'content-type':String(response.headers['content-type']??'')}});});
  const client=clientFor(),pid=projects[0]!,uid=users[0]!,session={user:{id:uid},clientId:own.clientId,csrfToken:own.csrfToken};
  const policy={schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:own.clientId,controlGeneration:1,operation:'savePermissionPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{rules:[{ruleId:'SCREEN_REGION_QA',subjectRef:{kind:'HUMAN',userId:uid},operations:['uploadArtifact','saveDocumentDraft','indexDesignDocument'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(expires).toISOString()}],reason:'한정 시안 편집 합성 QA',reviewRefs:[]}};
  const p=await app.inject({method:'POST',url:'/api/v1/projects/'+pid+'/commands',headers:headers(),payload:policy});assert.equal(p.statusCode,200,p.body);
  if(Date.now()+120_000>=expires)throw Error('QA_WINDOW_CLOSED');
  await mkdir(root,{mode:0o700});rootCreated=true;assert.equal((await lstat(root)).uid,process.getuid!());
  async function create(code:'AF02'|'AF03',body:string){const id=code==='AF02'?'a6f30000-0000-4000-8000-000000000002':'a6f30000-0000-4000-8000-000000000003';const f=(await admin.query('SELECT version,content_hash FROM anvil.form_versions WHERE definition_id=$1 ORDER BY version DESC LIMIT 1',[id])).rows[0];const form=await getPinnedForm(client,{id,version:Number(f.version),contentHash:f.content_hash}),work=newDocument(pid,form,uid,1);Object.assign(work,{title:code==='AF02'?'위치 설계':'화면시안',body,reason:'정확 원문 시안 QA',dirty:true});return continueDocumentSave(client,await prepareDocumentSave(work,session),session,()=>{},()=>true);}
  const source=await create('AF02','# D01 화면 편집 연결\n기존 저장을 사용한다.'),screen=await create('AF03','\uFEFF# S01 화면시안\r\n원문 v1\r\n');
  const work=editDocument(pid,await readDocument(client,pid,source.id,1),uid,1);work.designIndexState=newDesignIndex(work);work.designIndexState.input={items:[{localCode:'D01',title:'화면 편집',anchor:'line:1'}],screens:[{designLocalCode:'D01',screenCode:'S01',documentRef:screen,anchor:'line:1'}],reason:'원문 v1 고정 등록'};work.designIndexState.pending=prepareDesignIndex(work,session);
  const index=await sendDesignIndex(client,work,session,()=>true),context={projectId:pid,userId:uid,clientId:own.clientId,sourceRef:source},selection={...context,region:index.screenRegions[0]!};
  const opened=await readRegisteredScreen(client,context,selection,()=>true);assert.equal(opened.body,'\uFEFF# S01 화면시안\r\n원문 v1\r\n');assert.deepEqual({id:opened.document.id,version:opened.document.version,contentHash:opened.document.contentHash},screen);
  const edited=editDocument(pid,opened,uid,1);edited.body='# S01 화면시안\n명시 편집 v2';edited.reason='사용자가 선택한 새 초안';edited.dirty=true;
  const saved=await continueDocumentSave(client,await prepareDocumentSave(edited,session),session,()=>{},()=>true);assert.equal(saved.id,screen.id);assert.equal(saved.version,2);
  assert.equal((await readDocument(client,pid,saved.id,2)).body,edited.body);assert.equal((await readDocument(client,pid,screen.id,1)).body,opened.body);
  const reread=await readDesignIndex(client,pid,source);assert.deepEqual(reread,index);assert.deepEqual((await readRegisteredScreen(client,context,selection,()=>true)).document.content.body,opened.document.content.body);
  const conflict=editDocument(pid,opened,uid,1);conflict.body='# S01 구버전 편집';conflict.reason='구버전 CAS 차단';conflict.dirty=true;
  await assert.rejects(continueDocumentSave(client,await prepareDocumentSave(conflict,session),session,()=>{},()=>true),(e:any)=>e instanceof ApiError&&e.code==='VERSION_CONFLICT'&&e.status===409);
  assert.equal((await readDocument(client,pid,screen.id,2)).body,edited.body);
  await assert.rejects(readRegisteredScreen(clientFor(other),context,selection,()=>true),(e:any)=>e instanceof ApiError&&e.status===404);
  await assert.rejects(readRegisteredScreen(client,{...context,projectId:projects[1]!},selection,()=>true),(e:any)=>e instanceof ApiError&&e.code==='SCREEN_REGION_CONTEXT_CHANGED');
  await admin.query('UPDATE anvil.project_control SET generation=2 WHERE project_id=$1',[pid]);
  const stale=editDocument(pid,await readDocument(client,pid,screen.id,2),uid,1);stale.reason='이전 제어 세대 차단';stale.dirty=true;
  await assert.rejects(continueDocumentSave(client,await prepareDocumentSave(stale,session),session,()=>{},()=>true),(e:any)=>e instanceof ApiError&&e.status===409);
  await admin.query('UPDATE anvil.auth_sessions SET idle_expires_at=now()-interval\'1 second\' WHERE client_id=$1',[own.clientId]);
  await assert.rejects(readRegisteredScreen(client,context,selection,()=>true),(e:any)=>e instanceof ApiError&&e.status===401);
  assert.equal((await pool.query('SELECT count(*)::int n FROM anvil.delivery_outbox WHERE project_id=ANY($1::uuid[])',[ownedProjects])).rows[0].n,0);
  console.log(JSON.stringify({kind:'UI06_SCREEN_REGION_PG',versions:[1,2],indexVersion:1,sourceVersion:1,cas:'REJECTED',otherProject:'REJECTED',oldGeneration:'REJECTED',expired:'REJECTED',actualAgentCalls:0}));
 }finally{
  await app.close();const db=await admin.connect();
  try{await db.query('BEGIN');await db.query('SET CONSTRAINTS ALL DEFERRED');
   for(const table of ['screen_regions','design_items','document_version_events','document_artifact_links','document_versions','documents','artifacts','audit_events'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=ANY($1::uuid[])',[ownedProjects]);
   await db.query('UPDATE anvil.permission_policies SET head_version=head_version+1 WHERE project_id=ANY($1::uuid[])',[ownedProjects]);
   for(const table of ['permission_policy_versions','permission_policies'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=ANY($1::uuid[])',[ownedProjects]);
   await db.query('UPDATE anvil.commands SET authorization_receipt_id=NULL WHERE project_id=ANY($1::uuid[])',[ownedProjects]);await db.query('DELETE FROM anvil.authorization_receipts WHERE scope_id=ANY($1::uuid[])',[ownedProjects]);
   for(const table of ['commands','project_control','project_members'])await db.query('DELETE FROM anvil.'+table+' WHERE project_id=ANY($1::uuid[])',[ownedProjects]);
   await db.query('DELETE FROM anvil.projects WHERE id=ANY($1::uuid[])',[ownedProjects]);await db.query('DELETE FROM anvil.auth_audit_events WHERE subject_ref=ANY($1::uuid[])',[ownedUsers]);
   for(const table of ['auth_sessions','clients','password_credentials'])await db.query('DELETE FROM anvil.'+table+' WHERE user_id=ANY($1::uuid[])',[ownedUsers]);
   await db.query('DELETE FROM anvil.users WHERE id=ANY($1::uuid[])',[ownedUsers]);await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();await pool.end();await admin.end();if(rootCreated){async function owned(path:string){const stat=await lstat(path);if(stat.isSymbolicLink()||stat.uid!==process.getuid!()||await realpath(path)!==path||path!==root&&!path.startsWith(root+'/'))throw Error('QA_ROOT_CHANGED_PRESERVE');if(stat.isDirectory())for(const name of await readdir(path))await owned(join(path,name));}await owned(root);await rm(root,{recursive:true});console.log('UI06_SCREEN_REGION_RAW_ROOT_REMOVED');}}
 }
});
