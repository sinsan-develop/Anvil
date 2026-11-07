import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdir,lstat,realpath,readdir,readFile,writeFile,open,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticExecutionClient} from '../../../apps/connector/runtime/execution-client.ts';
const m:any=await import('../../../apps/connector/runtime/execution-client-file-store.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const root='D:\\tmp\\anvil-v3-c3-client-file-qa-01',id='11111111-1111-4111-8111-111111111111',hash=(v:unknown)=>contentHash(canonicalJson(v)),ref={id,version:1,contentHash:'a'.repeat(64)},now=Date.parse('2026-10-19T12:00:00.000Z'),scope={projectId:id,executionId:id,executionGeneration:1};
const key={...scope,requestKey:'b'.repeat(64)},limits={maxBytes:1048576,maxRequests:10};

test('client 파일 저장은 잘못된 root/scope·무한 quota를 거절하며 다른 실행에는 파일을 만들지 않는다',async()=>{
 assert.equal(typeof m.SyntheticFileClientStore,'function');
 for(const [path,s,l] of [['relative',scope,limits],['D:\\',scope,limits],[root,{...scope,executionGeneration:0},limits],[root,scope,{...limits,maxBytes:Infinity}],[root,scope,{...limits,maxRequests:10001}]])assert.throws(()=>new m.SyntheticFileClientStore(path,s,l));
 const store=new m.SyntheticFileClientStore(root,scope,limits);await assert.rejects(store.exclusive({...key,executionGeneration:2},async()=>null),/CLIENT_SCOPE_MISMATCH/);
});

test('실파일 sync·재열기·불명/부분기록·잠금·quota·sync 오류는 요청 중복 없이 보존된다',async()=>{
 assert.equal(typeof m.SyntheticFileClientStore,'function');assert.equal(process.platform,'win32');
 await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');assert.equal((await realpath('D:\\tmp')).toUpperCase(),'D:\\TMP');
 await mkdir(root,{mode:0o700});const identity=await lstat(root),names=['normal','lost','partial','lock','scope','quota','sync'];
 try{
  for(const name of names)await mkdir(join(root,name),{mode:0o700});
  let sends=0;const clientScope={mode:'EXECUTION',...scope,connectorId:id,grantRef:ref,credentialGeneration:1},operation={kind:'PERMIT',commandId:id,bodyRaw:canonicalJson({envelopeHash:'d'.repeat(64),localAttemptRef:ref,sourceObservationRefs:[ref],osOwnershipRef:ref})};
  const make=(name:string,l=limits)=>new SyntheticExecutionClient(new m.SyntheticFileClientStore(join(root,name),scope,l),{transport:'SYNTHETIC_ONLY',current:async(v:any)=>({...v,transport:'SYNTHETIC_ONLY',checkedAt:new Date(now).toISOString(),expiresAt:new Date(now+30000).toISOString()})},{transport:'SYNTHETIC_ONLY',sign:async()=>Buffer.alloc(64,1).toString('base64url')},{transport:'SYNTHETIC_ONLY',challenge:async(_s:any,r:any)=>({ref,challenge:{id,requestId:r.requestId,purpose:r.purpose,grantRef:ref,credentialGeneration:1,scopeDigest:'c'.repeat(64),serverNonce:Buffer.alloc(32,2).toString('base64url'),clientNonce:r.clientNonce,issuedAt:new Date(now).toISOString(),expiresAt:new Date(now+30000).toISOString()},credentialIssued:false,nonceConsumed:false,executionAuthorized:false,dispatchPerformed:false}),perform:async()=>{sends++;if(name==='lost')throw Error('PRIVATE_RESPONSE_LOST');return{transport:'SYNTHETIC_ONLY',proofResultRef:ref,permit:{transport:'SYNTHETIC_ONLY',key:{...scope,commandId:id},envelopeHash:'d'.repeat(64),grantRef:ref,permitRef:ref,checkedAt:new Date(now).toISOString(),expiresAt:new Date(now+10000).toISOString(),executionAuthorized:false,dispatchPerformed:false},nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};}},{clock:()=>now,timeoutMs:1000});
  const out=await make('normal').execute(clientScope,operation);assert.equal(out.state,'RESPONSE_RECORDED');assert.equal(sends,1);assert.deepEqual(await make('normal').execute(clientScope,operation),out);assert.equal(sends,1);const normal=join(root,'normal',out.requestKey);assert.deepEqual((await readdir(normal)).sort(),['000001.json','000002.json','000003.json','000004.json','000005.json']);
  const lost=await make('lost').execute(clientScope,operation);assert.equal(lost.state,'UNKNOWN');assert.deepEqual(await make('lost').execute(clientScope,operation),lost);assert.equal(sends,2);assert(!JSON.stringify(lost).includes('PRIVATE'));
  const partial=join(root,'partial',key.requestKey);await mkdir(partial);await writeFile(join(partial,'000001.json'),'{',{flag:'wx'});await assert.rejects(new m.SyntheticFileClientStore(join(root,'partial'),scope,limits).exclusive(key,async(tx:any)=>tx.read()),/CLIENT_STORAGE_UNAVAILABLE/);assert.equal(await readFile(join(partial,'000001.json'),'utf8'),'{');assert((await readdir(join(root,'partial'))).includes('client.lock'));
  await writeFile(join(root,'lock','client.lock'),'synthetic stale lock',{flag:'wx'});await assert.rejects(make('lock').execute(clientScope,operation));assert.equal(await readFile(join(root,'lock','client.lock'),'utf8'),'synthetic stale lock');
  await assert.rejects(new m.SyntheticFileClientStore(join(root,'scope'),scope,limits).exclusive({...key,projectId:'22222222-2222-4222-8222-222222222222'},async()=>null),/CLIENT_SCOPE_MISMATCH/);assert.deepEqual(await readdir(join(root,'scope')),[]);
  await assert.rejects(make('quota',{maxBytes:10,maxRequests:1}).execute(clientScope,operation));assert.equal(sends,2);assert(!(await readdir(join(root,'quota'))).includes('client.lock'));
  const probe=await open(join(root,'sync','probe.lock'),'wx'),proto=Object.getPrototypeOf(probe),nativeSync=proto.sync;await probe.close();await unlink(join(root,'sync','probe.lock'));
  try{let failed=false;proto.sync=async function(){if(!failed){failed=true;throw Error('PRIVATE_SYNC');}return nativeSync.call(this);};await assert.rejects(make('sync').execute(clientScope,operation));assert(failed);}finally{proto.sync=nativeSync;}
  assert.equal(sends,2);assert((await readdir(join(root,'sync'))).includes('client.lock'));await assert.rejects(make('sync').execute(clientScope,operation));assert.equal(sends,2);
  console.log('C3_CLIENT_FILE_SYNC_REOPEN_UNKNOWN_LIMITED_VERIFIED');
 }finally{
  const current=await lstat(root);assert.equal(current.dev,identity.dev);assert.equal(current.ino,identity.ino);assert(!current.isSymbolicLink());assert.equal((await realpath(root)).toUpperCase(),root.toUpperCase());
  for(const name of names){const dir=join(root,name),st=await lstat(dir);assert(st.isDirectory()&&!st.isSymbolicLink());for(const item of await readdir(dir)){const path=join(dir,item),s=await lstat(path);assert(!s.isSymbolicLink());if(item==='client.lock'){assert(s.isFile());await unlink(path);}else{assert(/^[0-9a-f]{64}$/.test(item)&&s.isDirectory());assert.equal((await realpath(path)).toUpperCase(),path.toUpperCase());for(const f of await readdir(path)){assert(/^00000[1-6]\.json$/.test(f));const p=join(path,f),fs=await lstat(p);assert(fs.isFile()&&!fs.isSymbolicLink());await unlink(p);}await rmdir(path);}}await rmdir(dir);}
  assert.deepEqual(await readdir(root),[]);await rmdir(root);await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');console.log('C3_CLIENT_FILE_QA_EXACT_CLEANUP_ZERO');
 }
});
