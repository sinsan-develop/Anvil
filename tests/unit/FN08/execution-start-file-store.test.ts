import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,lstat,readdir,readFile,writeFile,unlink,rmdir,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticStartReceiver} from '../../../apps/connector/runtime/execution-start-receiver.ts';
const m:any=await import('../../../apps/connector/runtime/execution-start-file-store.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const mode=process.env.ANVIL_C3_FILE_QA_MODE??'RED';assert(['RED','GREEN'].includes(mode));
const root=mode==='GREEN'?'D:\\tmp\\anvil-v3-c3-start-store-green-qa-01':'D:\\tmp\\anvil-v3-c3-start-store-qa-01';
const id='11111111-1111-4111-8111-111111111111',ref={id,version:1,contentHash:'a'.repeat(64)},now=Date.parse('2026-10-19T12:00:00.000Z'),scope={projectId:id,executionId:id,executionGeneration:1};
function sample(){const context={projectId:id,assignmentId:id,executionId:id,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE' as const,access:'READ' as const,recursive:false as const}]}]};const unsigned={schemaVersion:1,commandId:id,issuedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+30000).toISOString(),executorRegistrationRef:ref,context,operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}};return{...unsigned,envelopeHash:contentHash(canonicalJson(unsigned))};}
test('새 전용 파일 수신함의 file.sync·재열기·UNKNOWN·불완전/잠금/다른범위 거절',async()=>{
 assert.equal(typeof m.SyntheticFileStartStore,'function');assert.equal(process.platform,'win32');assert.equal(resolve(root),root);
 // 소진하지 않은 정확 root만 생성한다. 기존 root·파일은 덮거나 정리하지 않는다.
 await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');const parent=await realpath('D:\\tmp');assert.equal(parent.toUpperCase(),'D:\\TMP');
 await mkdir(root,{mode:0o700});const created=await lstat(root),names=['normal','lost','partial','lock','scope'];let sends=0;
 try{
  for(const name of names)await mkdir(join(root,name),{mode:0o700});
  const e=sample(),expected={context:e.context,executorRegistrationRef:ref,grantRef:ref};
  const authority:any={transport:'SYNTHETIC_ONLY',consume:async()=>({transport:'SYNTHETIC_ONLY',key:{...scope,commandId:id},envelopeHash:e.envelopeHash,grantRef:ref,permitRef:ref,checkedAt:new Date(now).toISOString(),expiresAt:new Date(now+1000).toISOString()})};
  const wire:any={transport:'SYNTHETIC_ONLY',send:async()=>{sends++;return{transport:'SYNTHETIC_ONLY',responseRef:ref};}};
  const make=(name:string,provider=wire)=>new SyntheticStartReceiver(new m.SyntheticFileStartStore(join(root,name),scope),authority,provider,expected,()=>now);
  await make('normal').receive(e);assert.deepEqual((await readdir(join(root,'normal'))).sort(),['000001.json']);
  const result=await make('normal').start(e);assert.equal(result.state,'RESPONSE_RECORDED');assert.equal(sends,1);assert.deepEqual(await make('normal').start(e),result);assert.equal(sends,1);
  assert.deepEqual((await readdir(join(root,'normal'))).sort(),['000001.json','000002.json','000003.json','000004.json']);
  const attempted=JSON.parse(await readFile(join(root,'normal','000002.json'),'utf8'));assert.equal(attempted.snapshot.state,'START_ATTEMPTED');
  await make('lost').receive(e);const lost=await make('lost',{transport:'SYNTHETIC_ONLY',send:async()=>{sends++;throw Error('PRIVATE_TOKEN_LOST');}}).start(e);assert.equal(lost.state,'UNKNOWN');
  assert.deepEqual(await make('lost').start(e),lost);assert.equal(sends,2);assert.equal(JSON.stringify(lost).includes('PRIVATE_TOKEN'),false);
  await writeFile(join(root,'partial','000001.json'),'{',{flag:'wx',mode:0o600});await assert.rejects(make('partial').receive(e),/START_STORAGE_UNAVAILABLE/);assert.equal(await readFile(join(root,'partial','000001.json'),'utf8'),'{');assert((await readdir(join(root,'partial'))).includes('start.lock'));
  await writeFile(join(root,'lock','start.lock'),'synthetic stale lock',{flag:'wx',mode:0o600});await assert.rejects(make('lock').receive(e),/START_INBOX_BUSY/);assert.equal(await readFile(join(root,'lock','start.lock'),'utf8'),'synthetic stale lock');
  const store=new m.SyntheticFileStartStore(join(root,'scope'),scope);await assert.rejects(store.exclusive({...scope,executionGeneration:2},async()=>null),/START_SCOPE_MISMATCH/);assert.deepEqual(await readdir(join(root,'scope')),[]);
  console.log('C3_START_ACTUAL_FILE_SYNC_REOPEN_UNKNOWN_LIMITED_VERIFIED');
 }finally{
  const current=await lstat(root);assert.equal(current.dev,created.dev);assert.equal(current.ino,created.ino);assert.equal(current.isSymbolicLink(),false);assert.equal((await realpath(root)).toUpperCase(),root.toUpperCase());
  for(const name of names){const dir=join(root,name),st=await lstat(dir);assert(st.isDirectory()&&!st.isSymbolicLink());for(const file of await readdir(dir)){assert(/^(00000[1234]\.json|start\.lock)$/.test(file));const path=join(dir,file),f=await lstat(path);assert(f.isFile()&&!f.isSymbolicLink());await unlink(path);}await rmdir(dir);}
  assert.deepEqual(await readdir(root),[]);await rmdir(root);await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');console.log('C3_START_FILE_QA_EXACT_CLEANUP_ZERO');
 }
});
