import test,{type TestContext} from 'node:test';import assert from 'node:assert/strict';import fs,{constants as fsConstants} from 'node:fs';import {syncBuiltinESMExports} from 'node:module';import {dirname,resolve} from 'node:path';
import {draftArtifactFixture,draftId} from '../../support/draft-artifact-fixture.ts';import {DraftArtifacts} from '../../../apps/server/modules/projects/draft-artifacts.ts';import {ProjectsRepository} from '../../../apps/server/modules/projects/repository.ts';import {CommonMethodologyWriter} from '../../../apps/server/modules/methodologies/common-write.ts';import {ProjectSetupCopies} from '../../../apps/server/modules/projects/project-setup-copies.ts';import {canonicalJson} from '../../../contracts/canonical.ts';import {commonSetupHash} from '../../../apps/server/modules/user-common-setup/input.ts';import {commonSetupMigration,commonSetupChecksum} from '../../../apps/server/modules/user-common-setup/storage.ts';import {decodeCommonSetupProjection} from '../../../contracts/runtime/user-common-setup-v1.ts';
type Row=Record<string,any>;
// 실제 AccessRepository/ProjectsRepository/DraftArtifacts와 private namespace proof producer를 소비한다.
// 아래 SQL 포트는 물리행 전달/Tx rollback의 메모리 대역이다. PG 함수/RLS/수치식 집행은 NOT_RUN이다.
class NamespaceMemoryFS{
 readonly root:string;dirs=new Set<string>();files=new Map<string,Buffer>();inodes=new Map<string,number>();nextInode=1;openHandles=0;calls:string[]=[];beforeIO:(()=>void)|null=null;
 constructor(root:string){this.root=root;this.dirs.add(root);}
 error(code:string){return Object.assign(Error('MEMORY_FS_'+code),{code});}
 stat(p:string){if(!this.dirs.has(p)&&!this.files.has(p))throw this.error('ENOENT');return {isDirectory:()=>this.dirs.has(p),isFile:()=>this.files.has(p),isSymbolicLink:()=>false,nlink:1,size:this.files.get(p)?.length??0,uid:0,mode:this.dirs.has(p)?0o40700:0o100600,dev:1,ino:this.inodes.get(p)??0};}
 install(t:TestContext){
  const api=fs.promises as any,keys=['lstat','realpath','mkdir','open','readdir','copyFile','unlink','rmdir'],old=new Map(keys.map(k=>[k,api[k]]));
  t.after(()=>{for(const [k,v] of old)api[k]=v;syncBuiltinESMExports();assert.equal(this.openHandles,0);});
  const observe=(kind:string,p:string)=>{if(p!==this.root&&!p.startsWith(this.root+'\\'))throw Error('MEMORY_FS_OUTSIDE_REGISTERED_ROOT');this.beforeIO?.();this.calls.push(kind+':'+p);};
  api.lstat=async(p:string)=>{observe('stat',p);return this.stat(p);};api.realpath=async(p:string)=>{observe('realpath',p);this.stat(p);return p;};
  api.mkdir=async(p:string)=>{observe('mkdir',p);if(this.dirs.has(p)||this.files.has(p))throw this.error('EEXIST');if(!this.dirs.has(dirname(p)))throw this.error('ENOENT');this.dirs.add(p);};
  api.readdir=async(p:string)=>{observe('readdir',p);if(!this.dirs.has(p))throw this.error('ENOENT');return [...new Set([...this.dirs,...this.files.keys()].filter(x=>x!==p&&dirname(x)===p).map(x=>x.slice(p.length+1)))];};
  api.open=async(p:string,flags:number)=>{observe('open',p);if(!this.files.has(p)){if(!(flags&fsConstants.O_CREAT))throw this.error('ENOENT');if(!this.dirs.has(dirname(p)))throw this.error('ENOENT');this.files.set(p,Buffer.alloc(0));this.inodes.set(p,this.nextInode++);}else if(flags&fsConstants.O_EXCL)throw this.error('EEXIST');let closed=false;this.openHandles++;return {stat:async()=>this.stat(p),writeFile:async(b:Buffer|string)=>{assert(!closed);this.files.set(p,Buffer.from(b));},readFile:async()=>{assert(!closed);return Buffer.from(this.files.get(p)!);},sync:async()=>{assert(!closed);},close:async()=>{assert(!closed);closed=true;this.openHandles--;}};};
  api.copyFile=async(from:string,to:string)=>{observe('copy',to);if(!this.files.has(from)||!this.dirs.has(dirname(to)))throw this.error('ENOENT');if(this.files.has(to))throw this.error('EEXIST');this.files.set(to,Buffer.from(this.files.get(from)!));this.inodes.set(to,this.nextInode++);};
  api.unlink=async(p:string)=>{observe('unlink',p);if(!this.files.delete(p))throw this.error('ENOENT');};
  api.rmdir=async(p:string)=>{observe('rmdir',p);if(!this.dirs.has(p))throw this.error('ENOENT');if([...this.dirs,...this.files.keys()].some(x=>x!==p&&dirname(x)===p))throw this.error('ENOTEMPTY');this.dirs.delete(p);};
  syncBuiltinESMExports();
 }
}
async function fixture(t:TestContext,withNamespace=true){
 const f=draftArtifactFixture(),memory=new NamespaceMemoryFS(resolve('never-created-ui02-common-setup-memory'));
 memory.beforeIO=()=>assert.equal(f.active(),false);memory.install(t);
 let data={heads:[] as Row[],versions:[] as Row[],revocations:[] as Row[],commands:[] as Row[],receipts:[] as Row[],audit:[] as Row[],history:[] as Row[],copies:[] as Row[],reservations:[] as Row[],account:null as Row|null,charged:[] as string[]},saved:typeof data|null=null;
 const flags={settle:false,adopt:false},events:string[]=[];
 const versionProof=(v:Row)=>{const c=data.commands.find(x=>x.id===v.command_id);return !!c&&data.receipts.some(r=>r.id===c.authorization_receipt_id&&r.command_id===c.id)&&data.audit.some(a=>a.command_id===c.id)&&commonSetupHash(decodeCommonSetupProjection(v.snapshot_json,canonicalJson))===v.content_hash;};
 const original=f.access.pool.connect.bind(f.access.pool);
 (f.access.pool as any).connect=async()=>{const client=await original(),query=client.query.bind(client) as any;return{release:client.release.bind(client),query:async(sql:string,p:any[]=[])=>{
  if(sql==='BEGIN'){saved=structuredClone(data);return query(sql,p);}if(sql==='ROLLBACK'){const r=await query(sql,p);data=saved!;saved=null;return r;}if(sql==='COMMIT'){const r=await query(sql,p);saved=null;return r;}
  assert(f.active(),'추가 원형/사본 포트도 실제 인증 Tx 안에서만 소비한다');events.push(sql);const rows=(v:any[])=>({rows:v,rowCount:v.length});
  if(sql==='SELECT id,checksum FROM anvil.schema_migrations WHERE id=$1')return rows([{id:commonSetupMigration,checksum:commonSetupChecksum}]);
  if(sql==='SELECT anvil.common_setup_context($1,$2,$3)'){assert.equal(p[1],f.owner);assert.equal(p[2],f.clientId);return rows([{}]);}
  if(sql==='SELECT id FROM anvil.users WHERE id=$1 FOR UPDATE')return rows([{id:f.owner}]);
  if(sql==='SELECT transaction_timestamp() AS at'||sql==='SELECT clock_timestamp() AS at')return rows([{at:new Date()}]);
  if(sql==='SELECT * FROM anvil.common_setup_account($1)')return rows([{heads:String(data.heads.length),versions:String(data.versions.length),draft_versions:String(data.history.length),used_bytes:String(Buffer.byteLength(canonicalJson({versions:data.versions,commands:data.commands,history:data.history,receipts:data.receipts,audit:data.audit})))}]);
  if(sql.startsWith('SELECT id,request_hash,result_ref,client_id FROM anvil.commands'))return rows(data.commands.filter(c=>c.actor_id===p[0]&&c.command_id===p[1]));
  if(sql.startsWith('SELECT id FROM anvil.commands WHERE scope_kind=\'USER_COMMON\''))return rows(data.commands.filter(c=>c.actor_id===p[0]&&c.command_id===p[1]));
  if(sql.startsWith('SELECT id FROM anvil.commands WHERE scope_kind=\'DRAFT\''))return rows(f.state().commands.filter((c:Row)=>c.draft_id===p[0]&&c.actor_id===p[1]&&c.command_id===p[2]&&c.operation==='createProject'));
  if(sql.startsWith('INSERT INTO anvil.commands(')&&sql.includes("'USER_COMMON'")){data.commands.push({id:p[0],actor_id:p[1],client_id:p[2],operation:p[3],command_id:p[4],request_hash:p[5],authorization_receipt_id:p[7],result_ref:JSON.parse(p[9])});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.authorization_receipts(')){data.receipts.push({id:p[0],scope_id:p[1],command_id:p[2],subject_ref:JSON.parse(p[3]),scope_digest:p[4]});return query(sql,p);}
  if(sql.startsWith('INSERT INTO anvil.user_common_audit_events(')){data.audit.push({command_id:p[3],operation:p[5],target_ref:JSON.parse(p[6])});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.common_setup_heads(')){data.heads.push({owner_user_id:p[0],id:p[1],kind:p[2],label:p[3],head_version:1,state:'ACTIVE'});return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.common_setup_versions(')){data.versions.push({owner_user_id:p[0],definition_id:p[1],version:p[2],content_hash:p[3],snapshot_json:JSON.parse(p[4]),request_json:JSON.parse(p[5]),command_id:p[6],snapshot_canonical:p[7],request_canonical:p[8],result_canonical:p[9],definition_canonical:p[10]});return rows([]);}
  if(sql.startsWith('SELECT id,kind,head_version,state FROM anvil.common_setup_heads')||sql.startsWith('SELECT * FROM anvil.common_setup_heads WHERE'))return rows(data.heads.filter(h=>h.owner_user_id===p[0]&&h.id===p[1]));
  if(sql.startsWith('SELECT v.*,h.kind'))return rows(data.versions.filter(v=>v.owner_user_id===p[0]&&v.definition_id===p[1]&&v.version===p[2]).map(v=>({...v,...data.heads.find(h=>h.id===v.definition_id)})));
  if(sql==='SELECT anvil.common_setup_version_complete($1,$2,$3) AS complete'){const v=data.versions.find(x=>x.owner_user_id===p[0]&&x.definition_id===p[1]&&x.version===p[2]);return rows([{complete:!!v&&versionProof(v)}]);}
  if(sql==='SELECT anvil.common_setup_complete($1) AS complete')return rows([{complete:data.versions.every(versionProof)}]);
  if(sql==='SELECT anvil.common_setup_charge($1,$2) AS complete'){assert(data.versions.some(v=>v.command_id===p[1])||data.revocations.some(v=>v.command_id===p[1])||f.state().commands.some((c:Row)=>c.id===p[1]));assert(data.versions.every(versionProof));if(!data.charged.includes(p[1]))data.charged.push(p[1]);return rows([{complete:true}]);}
  if(sql.startsWith('INSERT INTO anvil.common_setup_revocations(')){data.revocations.push({command_id:p[6]});return rows([]);}
  if(sql.startsWith("UPDATE anvil.common_setup_heads SET state='REVOKED'")){data.heads.find(h=>h.id===p[1])!.state='REVOKED';return rows([]);}
  if(sql.startsWith('INSERT INTO anvil.draft_common_setup_selections(')){data.history.push({owner_user_id:p[0],draft_id:p[1],version:p[2],selection_json:JSON.parse(p[3]),command_id:p[4],request_json:JSON.parse(p[5]),request_canonical:p[6],result_canonical:p[7]});return rows([]);}
  if(sql.startsWith('SELECT selection_json,request_json,request_canonical,result_canonical FROM'))return rows(data.history.filter(h=>h.owner_user_id===p[0]&&h.draft_id===p[1]&&h.version===p[2]));
  if(sql==='SELECT anvil.fn75_draft_selection_complete($1,$2,$3) AS complete')return rows([{complete:data.history.some(h=>h.owner_user_id===p[0]&&h.draft_id===p[1]&&h.version===p[2]&&f.state().commands.some((c:Row)=>c.id===h.command_id)&&data.receipts.some(r=>r.command_id===h.command_id))}]);
  if(sql.startsWith('INSERT INTO anvil.project_setup_copies(')){data.copies.push({project_id:p[0],id:p[1],slot:p[2],source_owner_user_id:p[3],source_id:p[4],source_version:p[5],source_hash:p[6],content_hash:p[7],snapshot_json:JSON.parse(p[8]),creation_command_id:p[9],snapshot_canonical:p[10]});return rows([]);}
  if(sql==='SELECT id,result_ref FROM anvil.commands WHERE project_id=$1 AND id=$2')return rows(f.state().commands.filter((c:Row)=>c.project_id===p[0]&&c.id===p[1]));
  if(sql==='SELECT anvil.fn75_settle_project_setup($1,$2,$3,$4,$5,$6) AS complete'){
   if(flags.settle)return rows([{complete:false}]);const c=f.state().commands.find((c:Row)=>c.project_id===p[3]&&c.id===p[4]),i=f.state().creations.find((i:Row)=>i.target_project_id===p[3]);assert(c&&i);assert.equal(i.state,'COMMITTED');assert.equal(i.project_command_id,c.id);assert.equal(p[5],canonicalJson(c.result_ref));assert.equal(data.receipts.filter(r=>r.command_id===c.id).length,1);assert(f.state().audit.some((a:Row)=>a.values?.[4]===c.id));
   const copies=data.copies.filter(x=>x.project_id===p[3]);assert.equal(copies.length,c.result_ref.setupCopyRefs.length);for(const x of copies){assert.equal(x.creation_command_id,c.id);assert.equal(commonSetupHash(decodeCommonSetupProjection(x.snapshot_json,canonicalJson)),x.content_hash);assert(data.versions.some(v=>v.definition_id===x.source_id&&v.content_hash===x.source_hash));}
   data.reservations.push({project_id:p[3],command_id:p[4],copies:structuredClone(copies),canonical:p[5]});return rows([{complete:true}]);
  }
  if(sql==='SELECT anvil.quota_adopt_creation($1,$2,$3,$4,$5::jsonb) AS value'){
   if(flags.adopt)return rows([{value:false}]);const v=JSON.parse(p[4]),c=f.state().commands.find((c:Row)=>c.id===v.serverCommandId),i=f.state().creations.find((i:Row)=>i.id===v.creationId);assert(c&&i);assert.equal(i.state,'COMMITTED');assert.equal(i.project_command_id,c.id);assert.equal(v.manifest.projectId,p[3]);assert.equal(v.manifestHash,commonSetupHash(v.manifest));assert.deepEqual(v.manifest.artifactRefs,i.refs_json);assert(data.reservations.some(r=>r.command_id===c.id));assert(data.charged.some(cid=>f.state().commands.some((x:Row)=>x.id===cid&&x.operation==='createProject'&&x.draft_id===i.draft_id)));
   data.account={project_id:p[3],coverage_state:'VERIFIED',manifest:v.manifest,copies:data.copies.length};return rows([{value:true}]);
  }
  if(sql==='SELECT anvil.fn75_project_setup_refs($1,$2,$3,$4) AS value'){assert(data.account?.project_id===p[3]);const c=f.state().commands.find((c:Row)=>c.project_id===p[3]&&c.operation==='createProject');assert(c);assert.equal(data.reservations.length,1);return rows([{value:c.result_ref.setupCopyRefs}]);}
  if(sql.startsWith('SELECT p.id,p.head_version,v.rules_json')){const project=data.account?.project_id,rules=[{subjectRef:{kind:'HUMAN',userId:f.owner},targetScopes:[{kind:'PROJECT',projectId:project}],operations:['readProjectSetupCopy'],disposition:'AUTO',expiresAt:new Date(Date.now()+60000).toISOString(),limitPolicyRef:null}],reason='합성 명시 정책',reviewRefs:any[]=[];return rows([{id:draftId(88),head_version:1,rules_json:rules,reason,review_refs:reviewRefs,content_hash:commonSetupHash({rules,reason,reviewRefs}),created_at:new Date()}]);}
  if(sql==='SELECT anvil.fn75_project_setup_copy($1,$2,$3,$4,$5) AS value'){const x=data.copies.find(x=>x.project_id===p[3]&&x.id===p[4]);return rows([{value:x?{ref:{id:x.id,version:1,contentHash:x.content_hash},copy_json:x.snapshot_json,snapshot_canonical:x.snapshot_canonical}:null}]);}
  const result=await query(sql,p);
  if(sql.includes('fn01_commit_creation')){const i=f.state().creations.find((x:Row)=>x.id===p[3]);i.project_command_id=p[5];}
  if(sql.startsWith('SELECT p.*,m.participation'))for(const row of result.rows){const c=f.state().commands.find((c:Row)=>c.project_id===row.id&&c.operation==='createProject'&&c.result_ref?.setupCopyRefs!==undefined);row.setup_copy_records=c?1:0;row.setup_copy_candidates=c?[c.result_ref.setupCopyRefs]:null;}
  return result;
 }};};
 const service=withNamespace?new DraftArtifacts(f.access,memory.root):f.service,repo=new ProjectsRepository(f.access,service),writer=new CommonMethodologyWriter(f.access);
 const stored=await writer.execute(f.token,f.csrf,{schemaVersion:1,commandId:draftId(60),operation:'saveCommonSetupDefinition',targetId:null,expectedVersion:0,clientId:f.clientId,payload:{kind:'TOOL',definition:{label:'본인 원형',toolProduct:'Codex',toolVersion:'current',adapterKind:'NATIVE',modelOptions:{model:'auto',nul:'\u0000',literal:'\\u0000'}},reason:'합성 원형'}});
 const selection={coordinatorToolRef:stored.data.ref,codingToolRef:stored.data.ref,environmentRef:null},savedDraft=await repo.saveDraft(f.token,f.csrf,f.did,{schemaVersion:1,commandId:draftId(61),clientId:f.clientId,expectedVersion:1,step:3,input:{...f.input,setupSelection:selection}});
 const request={schemaVersion:1 as const,commandId:draftId(62),clientId:f.clientId,draftId:f.did,draftVersion:savedDraft.version};return{f,memory,repo,writer,stored,selection,request,flags,events,data:()=>data};
}

test('SYNTHETIC 실제 원형→초안→사본 생성/정산→COMMITTED 재진입/보호 고정 조회는 원 ref와 원문을 잇는다',async t=>{
 const x=await fixture(t),result=await x.repo.createProject(x.f.token,x.f.csrf,x.request) as any;
 assert.equal(result.setupCopyRefs.length,2);assert.equal(x.data().copies.length,2);assert.equal(x.data().reservations.length,1);assert.equal(x.data().account?.coverage_state,'VERIFIED');assert.equal(x.f.draft().consumed_project_id,result.id);assert.deepEqual(x.f.draft().input_json.setupSelection,x.selection);
 const count=x.data().copies.length,commits=x.f.events.filter(v=>v==='COMMIT').length;assert.deepEqual(await x.repo.createProject(x.f.token,x.f.csrf,x.request),result);assert.equal(x.data().copies.length,count);assert(x.f.events.filter(v=>v==='COMMIT').length>commits);
 const detail=await x.repo.detail(x.f.token,result.id) as any;assert.deepEqual(detail.setupCopyRefs,result.setupCopyRefs);
 await x.writer.execute(x.f.token,x.f.csrf,{schemaVersion:1,commandId:draftId(63),operation:'revokeCommonSetupDefinition',targetId:x.stored.targetId,expectedVersion:1,clientId:x.f.clientId,payload:{targetRef:x.stored.data.ref,reason:'원형 회수'}});
 const read=await x.f.access.authenticated(x.f.token,null,(db,actor)=>new ProjectSetupCopies().read(db,actor,result.id,result.setupCopyRefs[0].id,1));assert.deepEqual(read.copy.definitionSnapshot,x.stored.data.snapshot.definition);assert.equal(read.copy.status,'UNBOUND');assert.equal(read.executionAuthorized,false);
});
test('SYNTHETIC settle/adopt 거절은 같은 생성 Tx의 project/사본/소비를 rollback하고 선택을 보존한다',async t=>{
 for(const stage of ['settle','adopt'] as const){const x=await fixture(t);x.flags[stage]=true;await assert.rejects(x.repo.createProject(x.f.token,x.f.csrf,x.request));assert.equal(x.f.state().projects.length,0);assert.equal(x.data().copies.length,0);assert.equal(x.data().reservations.length,0);assert.equal(x.data().account,null);assert.equal(x.f.draft().consumed_project_id,null);assert.deepEqual(x.f.draft().input_json.setupSelection,x.selection);assert.equal(x.f.state().commands.filter((c:Row)=>c.operation==='createProject').length,0);}
});
test('SYNTHETIC 회수 원형/provider 부재는 생성 reserve/namespace IO 이전에 거절한다',async t=>{
 const x=await fixture(t,false),before=x.f.state().creations.length;await assert.rejects(x.repo.createProject(x.f.token,x.f.csrf,x.request),{message:'PROJECT_STORAGE_QUOTA_UNVERIFIED'});assert.equal(x.f.state().creations.length,before);assert.equal(x.memory.calls.length,0);
 x.data().heads[0]!.state='REVOKED';await assert.rejects(x.repo.createProject(x.f.token,x.f.csrf,x.request),{message:'COMMON_SETUP_SELECTION_CONFLICT'});assert.equal(x.f.state().creations.length,before);
});
