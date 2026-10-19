import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,lstat,readdir,realpath,open,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {SyntheticFileInstructionStore} from '../../../apps/connector/runtime/execution-instruction-file-store.ts';
const mode=process.env.ANVIL_C3_INSTRUCTION_LOCK_QA_MODE??'RED';assert(['RED','GREEN'].includes(mode));
const root=mode==='GREEN'?'D:\\tmp\\anvil-v3-c3-instruction-store-lock-green-qa-01':'D:\\tmp\\anvil-v3-c3-instruction-store-lock-red-qa-01',id='11111111-1111-4111-8111-111111111111',scope={projectId:id,executionId:id,executionGeneration:1};
test('잠금 생성 직후 FileHandle.stat 실패는 callback0·미확인 잠금 보존·다음 진입 거절이다',async()=>{
 assert.equal(process.platform,'win32');assert.equal((await realpath('D:\\tmp')).toUpperCase(),'D:\\TMP');await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');await mkdir(root,{mode:0o700});const identity=await lstat(root);let prototype:any,descriptor:PropertyDescriptor|undefined;
 try{
  const f=await open(join(root,'probe.lock'),'wx',0o600);prototype=Object.getPrototypeOf(f);descriptor=Object.getOwnPropertyDescriptor(prototype,'stat');assert(descriptor&&typeof descriptor.value==='function');await f.close();await unlink(join(root,'probe.lock'));let calls=0,callback=0;
  Object.defineProperty(prototype,'stat',{...descriptor,value:async function(this:any,...args:any[]){calls++;if(calls===1)throw Error('PRIVATE_LOCK_IDENTITY_FAILURE');return descriptor!.value.apply(this,args);}});
  const store=new SyntheticFileInstructionStore(root,scope,{maxBytes:2097152});await assert.rejects(store.exclusive(scope,async()=>{callback++;return null;}),(e:Error)=>e.message==='INSTRUCTION_STORAGE_UNAVAILABLE');assert.equal(callback,0);assert.equal(calls,1);Object.defineProperty(prototype,'stat',descriptor);
  assert.deepEqual(await readdir(root),['instruction.lock']);await assert.rejects(new SyntheticFileInstructionStore(root,scope,{maxBytes:2097152}).exclusive(scope,async()=>null),/INSTRUCTION_JOURNAL_BUSY/);console.log('C3_INSTRUCTION_LOCK_IDENTITY_FAILURE_CALLBACK_ZERO_LOCK_PRESERVED_VERIFIED');
 }finally{
  if(prototype&&descriptor)Object.defineProperty(prototype,'stat',descriptor);const st=await lstat(root);assert(st.isDirectory()&&!st.isSymbolicLink());assert.equal(st.dev,identity.dev);assert.equal(st.ino,identity.ino);assert.equal((await realpath(root)).toUpperCase(),root.toUpperCase());for(const name of await readdir(root)){assert(['probe.lock','instruction.lock'].includes(name));const path=join(root,name),s=await lstat(path);assert(s.isFile()&&!s.isSymbolicLink());await unlink(path);}await rmdir(root);await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');console.log('C3_INSTRUCTION_LOCK_QA_EXACT_CLEANUP_ZERO');
 }
});
