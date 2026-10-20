import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,lstat,readdir,readFile,realpath,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticFileStartStore} from '../../../apps/connector/runtime/execution-start-file-store.ts';
import {SyntheticPrimaryFileStartStore} from '../../../apps/connector/runtime/primary-start-file-store.ts';
import {SyntheticStartReceiver} from '../../../apps/connector/runtime/execution-start-receiver.ts';
const root='D:\\tmp\\anvil-v3-stage-b\\receiver-start-lifecycle-01',id='11111111-1111-4111-8111-111111111111',ref={id,version:1,contentHash:'a'.repeat(64)},at=Date.parse('2026-10-20T00:00:00.000Z'),scope={projectId:id,executionId:id,executionGeneration:1};
test('원START원장은정상sync/재열기를보존하고종료·예외tx와미대기IO를잠금외사용하지못한다',async()=>{
 assert.equal(process.platform,'win32');await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');assert.equal((await realpath('D:\\tmp\\anvil-v3-stage-b')).toUpperCase(),'D:\\TMP\\ANVIL-V3-STAGE-B');await mkdir(root,{mode:0o700});const identity=await lstat(root),names=['read','write','throw','inflight','normal','throw-inflight','primary-throw-inflight'];
 try{
  for(const name of names)await mkdir(join(root,name),{mode:0o700});
  const rejected:boolean[]=[];
  for(const action of ['read','write','throw']){
   let escaped:any;const store=new SyntheticFileStartStore(join(root,action),scope);try{await store.exclusive(scope,async tx=>{await tx.read();escaped=tx;if(action==='throw')throw Error('synthetic callback failure');return null;});}catch(e){if(action!=='throw')throw e;}
   let stopped=false;try{if(action==='write')await escaped.appendAndSync({ref,snapshot:{sequence:1,state:'RECEIVED'}});else await escaped.read();}catch{stopped=true;}rejected.push(stopped);
  }
  let pending:Promise<unknown>|null=null;await assert.rejects(new SyntheticFileStartStore(join(root,'inflight'),scope).exclusive(scope,async tx=>{pending=tx.read();pending.catch(()=>{});return null;}),/START_STORAGE_UNAVAILABLE/);let pendingRejected=false;try{await pending;}catch{pendingRejected=true;}rejected.push(pendingRejected);assert((await readdir(join(root,'inflight'))).includes('start.lock'));
  const retained:boolean[]=[];for(const primary of [false,true]){let operation:Promise<unknown>|null=null;const name=primary?'primary-throw-inflight':'throw-inflight',store=primary?new SyntheticPrimaryFileStartStore(join(root,name),scope):new SyntheticFileStartStore(join(root,name),scope);await assert.rejects(store.exclusive(scope,async tx=>{operation=tx.read();operation.catch(()=>{});throw Error('synthetic active callback failure');}));await assert.rejects(operation!);retained.push((await readdir(join(root,name))).includes(primary?'primary-start.lock':'start.lock'));}assert.deepEqual(retained,[true,true]);
  const context:any={projectId:id,assignmentId:id,executionId:id,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}]},u={schemaVersion:1,commandId:id,issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString(),executorRegistrationRef:ref,context,operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}},e={...u,envelopeHash:contentHash(canonicalJson(u))};let sends=0,consumes=0;
  const authority:any={transport:'SYNTHETIC_ONLY',consume:async()=>{consumes++;return{transport:'SYNTHETIC_ONLY',key:{...scope,commandId:id},envelopeHash:e.envelopeHash,grantRef:ref,permitRef:ref,checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+1000).toISOString()};}},wire:any={transport:'SYNTHETIC_ONLY',send:async()=>{sends++;assert.equal(JSON.parse(await readFile(join(root,'normal','000003.json'),'utf8')).snapshot.state,'PERMIT_RECORDED');return{transport:'SYNTHETIC_ONLY',responseRef:ref};}},make=()=>new SyntheticStartReceiver(new SyntheticFileStartStore(join(root,'normal'),scope),authority,wire,{context,executorRegistrationRef:ref,grantRef:ref},()=>at);
  await make().receive(e);const result=await make().start(e);assert.equal(result.state,'RESPONSE_RECORDED');assert.equal(result.executionAuthorized,false);assert.deepEqual(await make().start(e),result);assert.equal(sends,1);assert.equal(consumes,1);
  assert.deepEqual(rejected,[true,true,true,true]);for(const name of ['read','write','throw'])assert.deepEqual(await readdir(join(root,name)),[]);console.log('RECEIVER_START_CLOSED_TX_AND_INFLIGHT_GUARDS_VERIFIED');
 }finally{
  const current=await lstat(root);assert(!current.isSymbolicLink()&&current.dev===identity.dev&&current.ino===identity.ino);assert.equal((await realpath(root)).toUpperCase(),root.toUpperCase());for(const name of names){const dir=join(root,name),st=await lstat(dir);assert(st.isDirectory()&&!st.isSymbolicLink());for(const file of await readdir(dir)){assert(/^(00000[1-4]\.json|start\.lock|primary-start\.lock)$/.test(file));const path=join(dir,file),f=await lstat(path);assert(f.isFile()&&!f.isSymbolicLink());await unlink(path);}await rmdir(dir);}await rmdir(root);await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');console.log('RECEIVER_START_LIFECYCLE_QA_EXACT_CLEANUP_ZERO');
 }
});
