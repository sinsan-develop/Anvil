import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {BigIntStats} from 'node:fs';
import {buildApp} from '../../../apps/server/app.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {omitted,type ExportManifest} from '../../../apps/server/modules/backups/project-backups-input.ts';
import {ProjectExportStore} from '../../../apps/server/modules/backups/project-export-store.ts';
import {aid,at,cid,exportAccess,exportCommand,exportDb,id,pid,uid} from './project-backups-fixture.ts';

const root=path.resolve('synthetic-export-storage'),jobId=id(20),jobRoot=path.join(root,jobId);
const manifestPath=path.join(jobRoot,'export.json'),payloadDirectory=path.join(jobRoot,'bundle','payload','blobs',pid);
const payloadPath=path.join(payloadDirectory,aid),download='/api/v1/projects/'+pid+'/backups/'+jobId+'/file';
const headers={host:'localhost:3830',cookie:'__Host-anvil.sid='+'a'.repeat(43)};
const uidNumber=BigInt(process.getuid?.()??0);
function stat(ino:bigint,size=0,kind:'file'|'directory'|'link'='file',mode=kind==='directory'?0o700n:0o600n,nlink=1n){
 return {dev:1n,ino,uid:uidNumber,gid:uidNumber,size:BigInt(size),mode,nlink,mtimeNs:1n,ctimeNs:1n,
  isFile:()=>kind==='file',isDirectory:()=>kind==='directory',isSymbolicLink:()=>kind==='link'} as BigIntStats;
}

function fixture(t:import('node:test').TestContext){
 const bytes=Buffer.from('immutable export bytes'),db=exportDb(bytes),selection=exportCommand(db).payload.selection;
 const manifest:ExportManifest={schemaVersion:1,kind:'SELECTED_DOCUMENT_ARTIFACT_EXPORT',projectId:pid,includeSource:false,selection,
  files:[{artifactRef:db.artifactRef,downloadName:aid+'.bin'}],omitted,createdAt:at,createdBy:{kind:'HUMAN',userId:uid}};
 const manifestBytes=Buffer.from(JSON.stringify(manifest));
 const ref={id:jobId,version:1,contentHash:contentHash(canonicalJson(manifest))};
 db.jobs.push({id:jobId,project_id:pid,document_id:selection.documentRef.id,document_version:1,document_content_hash:selection.documentRef.contentHash,
  artifact_id:aid,artifact_content_hash:db.artifactRef.contentHash,actor_id:uid,client_id:cid,command_id:id(21),
  manifest_json:JSON.parse(canonicalJson(manifest)),content_hash:ref.contentHash,created_at:new Date(at)});
 db.commands.push({id:id(21),project_id:pid,scope_kind:'PROJECT',state:'APPLIED',operation:'exportProject',actor_id:uid,client_id:cid,
  subject_ref:{kind:'HUMAN',userId:uid,clientId:cid},result_ref:{projectId:pid,status:'APPLIED',data:{status:'EXPORT_STORED',ref}}});
 const state={job:stat(2n,0,'directory'),manifest:stat(3n,manifestBytes.length) as BigIntStats|null,manifestBytes,manifestResolved:manifestPath,
  failClose:false,expireAfterClose:false,afterManifestOpen:()=>{},afterPayloadClose:()=>{}};
 const calls:{safe:string[];open:string[];reads:number[];close:string[]}={safe:[],open:[],reads:[],close:[]};
 const payloadStat=stat(4n,bytes.length);
 t.mock.method(ProjectExportStore.prototype,'safe',async (directory:string)=>{calls.safe.push(directory);assert([root,jobRoot,payloadDirectory].includes(directory));});
 t.mock.method(fs,'lstat',async (target:string)=>{
  if(target===jobRoot)return state.job;
  if(target===payloadPath)return payloadStat;
  if(target===manifestPath){if(state.manifest)return state.manifest;throw Object.assign(new Error('missing synthetic file'),{code:'ENOENT'});}
  throw Error('UNEXPECTED_LSTAT');
 });
 t.mock.method(fs,'realpath',async (target:string)=>{
  if(target===manifestPath)return state.manifestResolved;
  if(target===jobRoot)return target;
  throw Error('UNEXPECTED_REALPATH');
 });
 t.mock.method(fs,'open',async (target:string)=>{
  calls.open.push(target);
  if(target===payloadPath)return{stat:async()=>payloadStat,readFile:async()=>bytes,close:async()=>{calls.close.push(target);state.afterPayloadClose();}};
  assert.equal(target,manifestPath);
  const held=state.manifest!,heldBytes=state.manifestBytes;
  state.afterManifestOpen();
  return {stat:async()=>held,read:async(output:Buffer,offset:number,length:number,position:number)=>{
   calls.reads.push(length);
   const bytesRead=heldBytes.copy(output,offset,position,Math.min(position+length,heldBytes.length));
   return{bytesRead,buffer:output};
  },close:async()=>{calls.close.push(target);if(state.expireAfterClose)t.mock.method(performance,'now',()=>Number.POSITIVE_INFINITY);if(state.failClose)throw Error('synthetic close failure');}};
 });
 const app=buildApp({},undefined,{repository:Object.assign(exportAccess(db),{installationId:id(93)}),origin:'https://localhost:3830',artifactRoot:path.resolve('not-a-real-original'),exportRoot:root});
 t.after(()=>app.close());
 return {db,manifest,state,calls,bytes,get:()=>app.inject({method:'GET',url:download,headers})};
}

test('실제 반출 다운로드는 기존 export.json과 DB jsonb 키 순서가 달라도 정상 보관본을 반환한다',async(t)=>{
 const f=fixture(t),response=await f.get();
 assert.equal(response.statusCode,200,response.body);
 assert.deepEqual(response.rawPayload,f.bytes);
 assert.deepEqual(f.calls.open,[manifestPath,payloadPath]);
 assert.deepEqual(f.calls.close,[manifestPath,payloadPath]);
 assert.equal(f.calls.reads[0],f.state.manifestBytes.length);
});

test('실제 반출 다운로드에서 같은 길이의 타 프로젝트 manifest를 503으로 거절한다',async(t)=>{
 const f=fixture(t);
 f.state.manifestBytes=Buffer.from(JSON.stringify({...f.manifest,projectId:id(99)}));
 const response=await f.get();
 assert.equal(response.statusCode,503,response.body);
 assert.ok(response.body.includes('EXPORT_INTEGRITY_FAILED'));
 assert.deepEqual(f.calls.open,[manifestPath]);
});


test('manifest 누락·깨진 JSON·길이/링크·경로 이탈에서는 보관 파일을 열지 않는다',async(t)=>{
 for(const mode of ['missing','malformed','wrong-size','symlink','hardlink','escaped','job-link'] as const){
  await t.test(mode,async(t)=>{
   const f=fixture(t),length=f.state.manifestBytes.length;
   if(mode==='missing')f.state.manifest=null;
   if(mode==='malformed')f.state.manifestBytes=Buffer.alloc(length,32);
   if(mode==='wrong-size')f.state.manifest=stat(3n,length+1);
   if(mode==='symlink')f.state.manifest=stat(3n,length,'link');
   if(mode==='hardlink')f.state.manifest=stat(3n,length,'file',0o600n,2n);
   if(mode==='escaped')f.state.manifestResolved=path.join(root,'elsewhere.json');
   if(mode==='job-link')f.state.job=stat(2n,0,'link');
   const response=await f.get();
   assert.equal(response.statusCode,503,response.body);
   assert.ok(response.body.includes('EXPORT_INTEGRITY_FAILED'));
   assert.deepEqual(f.calls.open,mode==='malformed'?[manifestPath]:[]);
   if(mode==='malformed')assert.deepEqual(f.calls.close,[manifestPath]);
  });
 }
});

test('같은 bytes의 다른 파일이나 작업 폴더와 close 불명은 파일 반환 전에 거절한다',async(t)=>{
 for(const mode of ['replace-on-open','replace-on-payload-close','replace-job','close-error'] as const){
  await t.test(mode,async(t)=>{
   const f=fixture(t);
   const replace=()=>{f.state.manifest=stat(33n,f.state.manifestBytes.length);};
   if(mode==='replace-on-open')f.state.afterManifestOpen=replace;
   if(mode==='replace-on-payload-close')f.state.afterPayloadClose=replace;
   if(mode==='replace-job')f.state.afterPayloadClose=()=>{f.state.job=stat(22n,0,'directory');};
   if(mode==='close-error')f.state.failClose=true;
   const response=await f.get();
   assert.equal(response.statusCode,503,response.body);
   assert.ok(response.body.includes('EXPORT_INTEGRITY_FAILED'));
   const targets=mode==='replace-on-open'||mode==='close-error'?[manifestPath]:[manifestPath,payloadPath];
   assert.deepEqual(f.calls.open,targets);
   assert.deepEqual(f.calls.close,targets);
  });
 }
});

test('manifest close까지 진행해도 기한이 지나면 내용을 반환하지 않는다',async(t)=>{
 const f=fixture(t);
 f.state.expireAfterClose=true;
 const response=await f.get();
 assert.equal(response.statusCode,503,response.body);
 assert.ok(response.body.includes('EXPORT_TIME_LIMIT'));
 assert.deepEqual(f.calls.open,[manifestPath]);
 assert.deepEqual(f.calls.close,[manifestPath]);
});

test('현재 보호 source가 격리되거나 권한이 회수된 경우 manifest를 열지 않는다',async(t)=>{
 const f=fixture(t);
 f.db.artifact.state='QUARANTINED';
 assert.equal((await f.get()).statusCode,412);
 f.db.member=false;
 assert.equal((await f.get()).statusCode,404);
 assert.deepEqual(f.calls.open,[]);
});
