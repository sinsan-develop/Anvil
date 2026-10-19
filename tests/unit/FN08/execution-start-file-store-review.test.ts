import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,lstat,readdir,realpath,open,readFile,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {SyntheticFileStartStore} from '../../../apps/connector/runtime/execution-start-file-store.ts';
const mode=process.env.ANVIL_C3_FILE_QA_MODE??'RED';assert(['RED','GREEN'].includes(mode));
const root=mode==='GREEN'?'D:\\tmp\\anvil-v3-c3-start-store-review-green-qa-01':'D:\\tmp\\anvil-v3-c3-start-store-review-qa-01',id='11111111-1111-4111-8111-111111111111',scope={projectId:id,executionId:id,executionGeneration:1};
test('없는 root의 OS 원문 경로는 adapter 밖으로 노출하지 않는다',async()=>{
 const path=join(root,'PRIVATE_TOKEN_MISSING_ROOT');await assert.rejects(lstat(path),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');
 await assert.rejects(new SyntheticFileStartStore(path,scope).exclusive(scope,async()=>null),(e:Error)=>e.message==='START_STORAGE_UNAVAILABLE');
});
test('실제 파일 sync 실패 뒤 재읽기/추가쓰기/정상반환으로 불명 상태를 해제하지 않는다',async()=>{
 assert.equal(process.platform,'win32');assert.equal((await realpath('D:\\tmp')).toUpperCase(),'D:\\TMP');await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');
 await mkdir(root,{mode:0o700});const before=await lstat(root);let prototype:any,descriptor:PropertyDescriptor|undefined;
 try{
  const probe=await open(join(root,'probe.lock'),'wx',0o600);prototype=Object.getPrototypeOf(probe);descriptor=Object.getOwnPropertyDescriptor(prototype,'sync');assert(descriptor&&typeof descriptor.value==='function');await probe.close();await unlink(join(root,'probe.lock'));
  let failOnce=true;Object.defineProperty(prototype,'sync',{...descriptor,value:async function(this:any){if(failOnce){failOnce=false;throw Error('PRIVATE_TOKEN_SYNC_FAILURE');}return descriptor!.value.call(this);}});
  let readBlocked=false,appendBlocked=false;
  await assert.rejects(new SyntheticFileStartStore(root,scope).exclusive(scope,async tx=>{
   await tx.read();const entry:any={ref:{id,version:1,contentHash:'a'.repeat(64)},snapshot:{sequence:1,state:'RECEIVED'}};
   await assert.rejects(tx.appendAndSync(entry),/START_STORAGE_UNAVAILABLE/);
   try{await tx.read();}catch(e:any){readBlocked=e.message==='START_STORAGE_UNAVAILABLE';}
   try{await tx.appendAndSync({...entry,snapshot:{sequence:2,state:'START_ATTEMPTED'}});}catch(e:any){appendBlocked=e.message==='START_STORAGE_UNAVAILABLE';}
   return 'FALSE_COMPLETED';
  }),/START_STORAGE_UNAVAILABLE/);
  assert(readBlocked);assert(appendBlocked);assert.deepEqual((await readdir(root)).sort(),['000001.json','start.lock']);assert((await readFile(join(root,'000001.json'),'utf8')).includes('RECEIVED'));
  console.log('C3_START_REAL_FILE_SYNC_FAILURE_STICKY_UNKNOWN_VERIFIED');
 }finally{
  if(prototype&&descriptor)Object.defineProperty(prototype,'sync',descriptor);
  const after=await lstat(root);assert(!after.isSymbolicLink()&&after.dev===before.dev&&after.ino===before.ino);assert.equal((await realpath(root)).toUpperCase(),root.toUpperCase());
  for(const file of await readdir(root)){assert(/^(probe\.lock|start\.lock|00000[12]\.json)$/.test(file));const path=join(root,file),st=await lstat(path);assert(st.isFile()&&!st.isSymbolicLink());await unlink(path);}await rmdir(root);await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');console.log('C3_START_FILE_REVIEW_QA_CLEANUP_ZERO');
 }
});
