import assert from 'node:assert/strict';
import test from 'node:test';
import fs,{mkdir,lstat,readdir,realpath,unlink,rmdir} from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {join} from 'node:path';
import {SyntheticFileClientStore} from '../../../apps/connector/runtime/execution-client-file-store.ts';
const mode=process.env.ANVIL_C3_CLIENT_FILE_REVIEW_MODE??'RED';assert(['RED','GREEN'].includes(mode));
const root=mode==='GREEN'?'D:\\tmp\\anvil-v3-c3-client-file-review-green-qa-01':'D:\\tmp\\anvil-v3-c3-client-file-review-red-qa-01',id='11111111-1111-4111-8111-111111111111',scope={projectId:id,executionId:id,executionGeneration:1},key={...scope,requestKey:'b'.repeat(64)},limits={maxBytes:1048576,maxRequests:10};

test('callback 예외로 미완료 append를 남기면 lock 보존·재진입 거절·늦은 연산의 poison 유지',async()=>{
 await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');assert.equal((await realpath('D:\\tmp')).toUpperCase(),'D:\\TMP');await mkdir(root,{mode:0o700});const rootId=await lstat(root),dir=join(root,'abandon');await mkdir(dir,{mode:0o700});
 const native=fs.lstat;let pending:Promise<void>|undefined,release!:()=>void,delaying=false,gated=false,txSaved:any;const gate=new Promise<void>(r=>release=r);
 try{
  (fs as any).lstat=async(...args:any[])=>{const result=await (native as any)(...args);if(delaying&&!gated&&args[0]===dir){gated=true;await gate;}return result;};syncBuiltinESMExports();
  const store=new SyntheticFileClientStore(dir,scope,limits);await assert.rejects(store.exclusive(key,async tx=>{txSaved=tx;await tx.read();delaying=true;pending=tx.appendAndSync({ref:{id,version:1,contentHash:'a'.repeat(64)},snapshot:{transport:'SYNTHETIC_ONLY',sequence:1,state:'PREPARED',requestKey:key.requestKey,preparedRef:null,previousRef:null,at:'2026-10-19T12:00:00.000Z',payload:null,reason:'NONE'}});void pending.catch(()=>{});throw Error('SYNTHETIC_CALLBACK_ABORT');}));
  assert(gated);assert((await readdir(dir)).includes('client.lock'),'진행 중 append가 있으면 예외 종료 뒤에도 lock을 보존해야 한다');await assert.rejects(new SyntheticFileClientStore(dir,scope,limits).exclusive(key,async()=>null),/CLIENT_JOURNAL_BUSY/);
  release();await assert.rejects(pending!,/CLIENT_STORAGE_/);await assert.rejects(txSaved.read(),/CLIENT_STORAGE_UNAVAILABLE/);assert((await readdir(dir)).includes('client.lock'));console.log('C3_CLIENT_FILE_ABANDONED_CALLBACK_LOCK_PRESERVED');
 }finally{
  release();await pending?.catch(()=>{});fs.lstat=native;syncBuiltinESMExports();
  const current=await lstat(root);assert.equal(current.dev,rootId.dev);assert.equal(current.ino,rootId.ino);assert(!current.isSymbolicLink());assert.equal((await realpath(root)).toUpperCase(),root.toUpperCase());const child=await lstat(dir);assert(child.isDirectory()&&!child.isSymbolicLink());
  for(const item of await readdir(dir)){const path=join(dir,item),s=await lstat(path);assert(!s.isSymbolicLink());if(item==='client.lock'){assert(s.isFile());await unlink(path);}else{assert(item===key.requestKey&&s.isDirectory());assert.equal((await realpath(path)).toUpperCase(),path.toUpperCase());for(const name of await readdir(path)){assert.equal(name,'000001.json');const file=join(path,name),st=await lstat(file);assert(st.isFile()&&!st.isSymbolicLink());await unlink(file);}await rmdir(path);}}
  await rmdir(dir);assert.deepEqual(await readdir(root),[]);await rmdir(root);await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');console.log('C3_CLIENT_FILE_REVIEW_QA_EXACT_CLEANUP_ZERO');
 }
});
