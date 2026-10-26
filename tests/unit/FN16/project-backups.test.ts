import test from 'node:test';
import assert from 'node:assert/strict';
import {documentOperations,materialRules} from '../../../apps/server/modules/access/project-command.ts';
const actor='11111111-1111-4111-8111-111111111111',project='22222222-2222-4222-8222-222222222222';
test('exportProject is explicitly selectable in the ordinary material policy',()=>{
 assert.ok((documentOperations as readonly string[]).includes('exportProject'));
 assert.equal(materialRules([{ruleId:'export',subjectRef:{kind:'HUMAN',userId:actor},operations:['exportProject'],targetScopes:[{kind:'PROJECT',projectId:project}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],project,actor).length,1);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import {readExportPayload,exportQuery,omitted} from '../../../apps/server/modules/backups/project-backups-input.ts';
import {ProjectBackups} from '../../../apps/server/modules/backups/project-backups.ts';
import {ProjectExportStore} from '../../../apps/server/modules/backups/project-export-store.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {buildApp} from '../../../apps/server/app.ts';
import {inspectArtifact} from '../../../apps/server/storage/sensitive-inspection.ts';
import {withExportFixture,exportDb,exportCommand,exportAccess,pid,uid,cid,did,aid,id,sign} from './project-backups-fixture.ts';
import {ProjectListCodec} from '../../../apps/server/modules/projects/service.ts';
test('strict payload/query rejects browser paths, sources, unknown fields and invalid refs',()=>{
 const f=exportDb(Buffer.from('ordinary')),p=exportCommand(f).payload;assert.deepEqual(readExportPayload(p),p);
 for(const bad of [{...p,includeSource:true},{...p,path:'x'},{...p,reason:''},{...p,selection:{...p.selection,filename:'x'}},{...p,selection:{...p.selection,artifactRef:{...p.selection.artifactRef,bytes:20971521}}}])assert.throws(()=>readExportPayload(bad),/EXPORT_INPUT_INVALID/);
 assert.equal(exportQuery({view:'SELECTED_ARTIFACT_EXPORTS'}).limit,50);for(const q of [{},{view:'ALL'},{view:'SELECTED_ARTIFACT_EXPORTS',limit:'51'},{view:'SELECTED_ARTIFACT_EXPORTS',root:'x'}])assert.throws(()=>exportQuery(q));
});
test('actual command/routes and synthetic bytes retain independent copy, replay, quota and isolation',async()=>withExportFixture(async(source,target,record)=>{
 const bytes=Buffer.from('ordinary immutable document bytes'),f=exportDb(bytes);f.artifact.inspection_json=inspectArtifact(bytes);const c=exportCommand(f),service=new ProjectBackups(source,target),repo=new ProjectPolicyRepository(exportAccess(f));
 const blobs=path.join(source,'blobs'),projectDir=path.join(blobs,pid),original=path.join(projectDir,aid);await fs.mkdir(blobs);await fs.mkdir(projectDir);await fs.writeFile(original,bytes,{flag:'wx'});await record([blobs,projectDir,original]);
 const stored:any=await repo.command('a'.repeat(43),'c'.repeat(43),c,(db,a,p,deadline)=>service.create(db,a,c,p,deadline!));
 const jobId=stored.data.ref.id,base=path.join(target,jobId),bundle=path.join(base,'bundle'),payload=path.join(bundle,'payload'),outBlobs=path.join(payload,'blobs'),outProject=path.join(outBlobs,pid),copy=path.join(outProject,aid);
 await record([base,bundle,payload,outBlobs,outProject,copy,path.join(bundle,'manifest.json'),path.join(base,'export.json')]);
 assert.equal(stored.data.status,'EXPORT_STORED');assert.equal(f.commands.length,1);assert.equal(f.audits,1);assert.deepEqual(await repo.command('a'.repeat(43),'c'.repeat(43),c,()=>{throw Error('REPLAY_WROTE');}),stored);
 await assert.rejects(()=>repo.command('a'.repeat(43),'c'.repeat(43),{...c,payload:{...c.payload,reason:'changed'}},()=>{throw Error();}),/IDEMPOTENCY_CONFLICT/);
 const page=await service.list(f.db,(await import('./project-backups-fixture.ts')).actor,pid,{view:'SELECTED_ARTIFACT_EXPORTS'},new ProjectListCodec(sign));assert.equal(page.items.length,1);assert.deepEqual(page.items[0]!.manifest.omitted,omitted);
 await fs.unlink(original);const a=(await import('./project-backups-fixture.ts')).actor;
 assert.deepEqual((await service.file(f.db,a,pid,jobId,performance.now()+30000)).bytes,bytes);
 f.artifact.state='QUARANTINED';assert.equal((await service.read(f.db,a,pid,jobId)).sourceAvailability,'BLOCKED');await assert.rejects(()=>service.file(f.db,a,pid,jobId,performance.now()+30000),/EXPORT_SOURCE_BLOCKED/);f.artifact.state='READY';
 await fs.writeFile(copy,'changed');await assert.rejects(()=>service.file(f.db,a,pid,jobId,performance.now()+30000),/EXPORT_INTEGRITY_FAILED/);await fs.writeFile(copy,bytes);
 await assert.rejects(()=>service.read(f.db,a,id(90),jobId),/NOT_FOUND/);f.member=false;await assert.rejects(()=>service.read(f.db,a,pid,jobId),/NOT_FOUND/);f.member=true;
 const manifest=page.items[0]!.manifest;await fs.writeFile(original,bytes,{flag:'wx'});await record([original]);
 const store=new ProjectExportStore(target),capacity=10*1024*1024*1024;store.usage=async()=>capacity;await assert.rejects(()=>store.copy(source,pid,id(22),f.artifactRef,manifest,performance.now()+30000),/EXPORT_CAPACITY_EXCEEDED/);await assert.rejects(()=>fs.lstat(path.join(target,id(22))),{code:'ENOENT'});
 await assert.rejects(()=>store.copy(source,pid,id(23),f.artifactRef,manifest,performance.now()-1),/EXPORT_TIME_LIMIT/);
 const reservation=path.join(target,'.reservation');await fs.writeFile(reservation,'unknown-owner',{flag:'wx'});await record([reservation]);await assert.rejects(()=>store.copy(source,pid,id(24),f.artifactRef,manifest,performance.now()+30000),/EXPORT_RESERVATION_UNAVAILABLE/);assert.equal(await fs.readFile(reservation,'utf8'),'unknown-owner');
 const app=buildApp({},undefined,{repository:exportAccess(f),origin:'https://localhost:3830',artifactRoot:source,exportRoot:target}),headers={host:'localhost:3830',cookie:'__Host-anvil.sid='+'a'.repeat(43)};try{
 const response=await app.inject({method:'GET',url:`/api/v1/projects/${pid}/backups/${jobId}/file`,headers});assert.equal(response.statusCode,200,response.body);assert.deepEqual(response.rawPayload,bytes);assert.match(response.headers['content-disposition'] as string,/attachment.*\.bin/);assert.equal(response.headers['cache-control'],'no-store');assert.equal(response.headers['x-content-type-options'],'nosniff');
 assert.equal((await app.inject({method:'GET',url:`/api/v1/projects/${pid}/backups?view=SELECTED_ARTIFACT_EXPORTS&root=x`,headers})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url:`/api/v1/projects/${pid}/commands`,headers:{...headers,origin:'https://localhost:3830'},payload:c})).statusCode,403);
 assert.equal((await app.inject({method:'GET',url:`/api/v1/projects/${pid}/backups?view=SELECTED_ARTIFACT_EXPORTS`,headers:{host:'localhost:3830'}})).statusCode,401);
 }finally{await app.close();}
}));
test('real standard current controller/policy denies before a writer callback',async()=>{
 for(const mode of ['OWNER','CONTROL','GENERATION','DENY','APPROVAL','MISSING_POLICY','CSRF']){const f=exportDb(Buffer.from('x')),c=exportCommand(f);if(mode==='OWNER')f.participation='OBSERVER';if(mode==='CONTROL')f.control=false;if(mode==='GENERATION')c.controlGeneration=2;if(mode==='DENY')f.rules[0]!.disposition='DENY';if(mode==='APPROVAL')f.rules[0]!.disposition='REQUIRE_APPROVAL';if(mode==='MISSING_POLICY')f.policy=false;let writes=0;await assert.rejects(()=>new ProjectPolicyRepository(exportAccess(f)).command('a'.repeat(43),mode==='CSRF'?'x':'c'.repeat(43),c,async()=>{writes++;return null;}));assert.equal(writes,0,mode);assert.equal(f.commands.length,0);}
});
test('authenticated storage unconfigured / unapplied SQL never returns fake empty list',async()=>{const f=exportDb(Buffer.from('x')),a=(await import('./project-backups-fixture.ts')).actor;await assert.rejects(()=>new ProjectBackups().list(f.db,a,pid,{view:'SELECTED_ARTIFACT_EXPORTS'},new ProjectListCodec(sign)),/EXPORT_STORAGE_UNCONFIGURED/);f.missing=true;await assert.rejects(()=>new ProjectBackups('D:\\source','D:\\target').list(f.db,a,pid,{view:'SELECTED_ARTIFACT_EXPORTS'},new ProjectListCodec(sign)),/EXPORT_STORAGE_NOT_READY/);});

test('fixed document hash / artifact membership / cross project are checked before file IO',async()=>{const f=exportDb(Buffer.from('ordinary')),service=new ProjectBackups('D:\\source','D:\\target'),c=exportCommand(f);await assert.rejects(()=>service.sourceRow(f.db,pid,{...c.payload.selection,documentRef:{...c.payload.selection.documentRef,contentHash:'0'.repeat(64)}}),/EXPORT_DOCUMENT_REF_CONFLICT/);await assert.rejects(()=>service.sourceRow(f.db,pid,{...c.payload.selection,artifactRef:{...c.payload.selection.artifactRef,artifactId:id(95)}}),/EXPORT_ARTIFACT_NOT_IN_VERSION/);await assert.rejects(()=>service.sourceRow(f.db,id(96),c.payload.selection),/NOT_FOUND/);});
test('unconfirmed orphan ID is never exposed as a job or file',async()=>{const f=exportDb(Buffer.from('x')),service=new ProjectBackups('D:\\source','D:\\target'),a=(await import('./project-backups-fixture.ts')).actor;await assert.rejects(()=>service.read(f.db,a,pid,id(99)),/NOT_FOUND/);await assert.rejects(()=>service.file(f.db,a,pid,id(99),performance.now()+30000),/NOT_FOUND/);assert.equal(f.jobs.length,0);});
test('COMMIT response unknown preserves original receipt and exact same-command replay',async()=>{const f=exportDb(Buffer.from('x')),c=exportCommand(f),base=exportAccess(f),{persistProjectReceipt}=await import('../../../apps/server/modules/access/project-command.ts');let uncertain=true;const access={...base,authenticated:async(t:string,csrf:string|null,fn:any)=>{const value=await base.authenticated(t,csrf,fn);if(uncertain){uncertain=false;throw Error('synthetic COMMIT response lost');}return value;}} as any,repo=new ProjectPolicyRepository(access),ref={id:id(28),version:1,contentHash:'b'.repeat(64)};let callbacks=0;const run=()=>repo.command('a'.repeat(43),'c'.repeat(43),c,async(db,a,p)=>{callbacks++;return(await persistProjectReceipt(db,a,c,ref,{status:'EXPORT_STORED'},p,'EXPLICIT_SELECTED_DOCUMENT_ARTIFACT_EXPORT')).result;});await assert.rejects(run,/EXPORT_RESULT_UNCERTAIN/);assert.equal(f.commands.length,1);const result:any=await run();assert.deepEqual(result.data.ref,ref);assert.equal(callbacks,1);});

test('browser strict manifest, mutable availability and receipt regression fence',async()=>{
 const {parseExportJob,mergeExportPending}=await import('../../../apps/web/src/features/backups/project-backups-api.ts'),f=exportDb(Buffer.from('ordinary')),selection=exportCommand(f).payload.selection,manifest={schemaVersion:1,kind:'SELECTED_DOCUMENT_ARTIFACT_EXPORT',projectId:pid,includeSource:false,selection,files:[{artifactRef:f.artifactRef,downloadName:aid+'.bin'}],omitted,createdAt:'2026-10-27T00:00:00.000Z',createdBy:{kind:'HUMAN',userId:uid}},ref={id:id(40),version:1,contentHash:contentHash(canonicalJson(manifest))},job={ref,manifest,sourceAvailability:'READY'};
 assert.equal((await parseExportJob(job,pid)).ref.contentHash,ref.contentHash);assert.equal((await parseExportJob({...job,sourceAvailability:'BLOCKED'},pid)).ref.contentHash,ref.contentHash);
 for(const bad of [{...job,path:'x'},{...job,manifest:{...manifest,includeSource:true}},{...job,manifest:{...manifest,filename:'x'}},{...job,ref:{...ref,contentHash:'0'.repeat(64)}}])await assert.rejects(()=>parseExportJob(bad,pid));await assert.rejects(()=>parseExportJob(job,id(99)));
 const pending:any={bindingId:'binding',ownerUserId:uid,ownerClientId:cid,projectId:pid,csrfToken:'c'.repeat(43),api:{},transport:()=>{},command:{},body:'fixed',receipt:ref};assert.deepEqual(mergeExportPending(pending,'binding',{...pending,receipt:null})?.receipt,ref);assert.equal(mergeExportPending(pending,'old',{...pending,receipt:null}),pending);assert.equal(mergeExportPending(pending,'binding',{...pending,body:'changed'}),pending);
});
test('signed export cursor binds actor, project, view and page size',async()=>{const f=exportDb(Buffer.from('ordinary')),a=(await import('./project-backups-fixture.ts')).actor,service=new ProjectBackups('D:\\source','D:\\target'),codec=new ProjectListCodec(sign),filter={query:canonicalJson({projectId:pid,view:'SELECTED_ARTIFACT_EXPORTS'}),archived:false,limit:50};for(const [who,changed] of [[id(90),filter],[uid,{...filter,query:canonicalJson({projectId:id(90),view:'SELECTED_ARTIFACT_EXPORTS'})}],[uid,{...filter,query:canonicalJson({projectId:pid,view:'OTHER'})}],[uid,{...filter,limit:49}]] as const){const cursor=codec.create(who,changed,{at:'2026-10-27T00:00:00.000Z',id:id(40)});await assert.rejects(()=>service.list(f.db,a,pid,{view:'SELECTED_ARTIFACT_EXPORTS',cursor},codec),/CURSOR_INVALID/);}});

test('PG runner rejects missing explicit isolated config without opening DB',async()=>{const {validateConfig}=await import('../../integration/FN16/project-artifact-export-pg.ts');for(const value of [null,{}, {kind:'FN16_ISOLATED_PG_QA',connection:{database:'anvil'}}])await assert.rejects(()=>validateConfig(value),/FN16_EXPLICIT_ISOLATED_QA_CONFIG_REQUIRED/);});

test('new bundle privacy narrows only exact owned directories and rejects identity replacement',async()=>{
 const module=await import('../../../apps/server/modules/backups/project-export-store.ts');assert.equal(typeof (module as any).protectOwnedExportDirectories,'function','adapter must own the private outer directory and secure builder-created descendants');
 const protect=(module as any).protectOwnedExportDirectories,jobRoot=path.resolve('D:/synthetic-private-root/'+id(80)),dirs=[jobRoot,path.join(jobRoot,'bundle'),path.join(jobRoot,'bundle','payload'),path.join(jobRoot,'bundle','payload','blobs'),path.join(jobRoot,'bundle','payload','blobs',pid)];
 const stats=new Map(dirs.map((d,index)=>[d,{dev:1n,ino:BigInt(index+1),uid:7n,mode:BigInt(index===0?0o40700:0o40755),isDirectory:()=>true,isSymbolicLink:()=>false}]));
 const changed:string[]=[],io:any={lstat:async(d:string)=>stats.get(d),realpath:async(d:string)=>d,open:async(d:string)=>({stat:async()=>({...stats.get(d)}),chmod:async(mode:number)=>{assert.equal(mode,0o700);changed.push(d);stats.get(d)!.mode=BigInt(0o40000|mode);},close:async()=>{}})};
 await protect(jobRoot,stats.get(jobRoot),pid,performance.now()+30000,io,true,7n);assert.deepEqual(changed,dirs.slice(1));assert.equal(stats.get(jobRoot)!.mode,0o40700n);
 changed.length=0;const original=io.open;io.open=async(d:string)=>{const h=await original(d);return{...h,stat:async()=>({...stats.get(d),ino:999n})};};await assert.rejects(()=>protect(jobRoot,stats.get(jobRoot),pid,performance.now()+30000,io,true,7n),/EXPORT_DESTINATION_UNSAFE/);assert.deepEqual(changed,[]);
});

test('command followup binds original selection and actor without narrowing general history',async()=>{
 const {readCommandExport,readExport}=await import('../../../apps/web/src/features/backups/project-backups-api.ts'),{ApiClient}=await import('../../../apps/web/src/api/client.ts'),f=exportDb(Buffer.from('ordinary')),c=exportCommand(f),selection=c.payload.selection;
 for(const mode of ['MATCH','SELECTION','ACTOR']){const manifest={schemaVersion:1,kind:'SELECTED_DOCUMENT_ARTIFACT_EXPORT',projectId:pid,includeSource:false,selection:mode==='SELECTION'?{...selection,documentRef:{...selection.documentRef,id:id(96)}}:selection,files:[{artifactRef:f.artifactRef,downloadName:aid+'.bin'}],omitted,createdAt:'2026-10-27T00:00:00.000Z',createdBy:{kind:'HUMAN',userId:mode==='ACTOR'?id(97):uid}},ref={id:id(92),version:1,contentHash:contentHash(canonicalJson(manifest))},job={ref,manifest,sourceAvailability:'READY'},api=new ApiClient(async()=>Response.json(job)),pending:any={ownerUserId:uid,projectId:pid,command:c,receipt:ref};assert.deepEqual((await readExport(api,pid,ref)).ref,ref);if(mode==='MATCH')assert.deepEqual((await readCommandExport(api,pending)).ref,ref);else await assert.rejects(()=>readCommandExport(api,pending),(e:any)=>e.code==='EXPORT_RECEIPT_SCOPE_MISMATCH');assert.deepEqual(pending.receipt,ref);}
});
