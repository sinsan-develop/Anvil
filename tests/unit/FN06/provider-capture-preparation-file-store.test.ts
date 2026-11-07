import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdir,lstat,readdir,readFile,writeFile,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerBindingHash,providerProtectedHandleRef,validateProviderSessionClaim,type ProviderBindingInput,type ProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {SyntheticProviderCapturePreparation} from '../../../apps/connector/runtime/provider-capture-preparation.ts';
import {SyntheticProviderCaptureResults} from '../../../apps/connector/runtime/provider-capture-results.ts';
import {SyntheticProviderCaptureResultsFileStore} from '../../../apps/connector/runtime/provider-capture-results-file-store.ts';
import {SyntheticStartProtectedCaptureBridge} from '../../../apps/connector/runtime/start-protected-capture-bridge.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';
import {startCaptureFixture} from './start-capture-barrier-fixture.ts';
const names=['normal','callback-failure','partial','foreign','noncanonical','invalid-utf8','stale-lock','concurrent','aborted','escaped','overlap','unread','write-failure','row-extra','row-hash','row-parent','count','bytes','conflict','expired','bridge-preparation','bridge-results','bridge-rejected-preparation','bridge-rejected-results'] as const;
const lock='provider-capture-preparation.lock',filename=(n:number)=>String(n).padStart(6,'0')+'.json',signal=()=>new AbortController().signal;
const row=(claim:ProviderSessionClaim,parent:ProviderSessionClaim|null=null)=>{const{protectedHandleRef:_,...bindingInput}=structuredClone(claim);return{bindingHash:providerBindingHash(bindingInput),bindingInput,parent:structuredClone(parent)};};
const frame=(value:unknown)=>Buffer.from(canonicalJson(value)+'\n');
const fresh=(claim:ProviderSessionClaim)=>{const{protectedHandleRef:_,...input}=structuredClone(claim);input.claimId=randomUUID();input.commandId=randomUUID();return{...input,protectedHandleRef:providerProtectedHandleRef(input,'f'.repeat(64))};};
// SYNTHETIC_ONLY metadata/인증·pipe fixture와 실제 file I/O 증거를 구별한다.
// Main 소유 30분 수명·정확 정리. OS temp fallback/시험 자체 삭제는 없다.
test('준비 파일원장·기존 START bridge와 결과파일 명시 연결 및 failclosed',async t=>{
 const raw=process.env.ANVIL_CAPTURE_PREPARATION_STORE_QA_ROOT;
 assert.equal(typeof raw,'string','Main이 등록한 QA root를 명시해야 한다');
 assert.equal(resolve(raw!).toUpperCase(),'D:\\TMP\\ANVIL-PROVIDER-CAPTURE-PREPARATION-STORE');
 const root=resolve(raw!);
 // module 부재 RED는 QA root 생성 전에 실패해야 한다.
 const{SyntheticProviderCapturePreparationFileStore:Store}=await import('../../../apps/connector/runtime/provider-capture-preparation-file-store.ts');
 assert.equal(typeof Store,'function');assert.throws(()=>new Store('relative-root'));
 await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');
 await mkdir(root,{mode:0o700});const rootId=await lstat(root);assert(rootId.isDirectory()&&!rootId.isSymbolicLink());assert.equal((await realpath(root)).toUpperCase(),root.toUpperCase());
 try{
  for(const name of names)await mkdir(join(root,name),{mode:0o700});
  const f=await providerTurnFixture(),at=Date.parse(f.f.basis.fact.checkedAt),clock=()=>at,thread=row(f.parent),turn=row(f.claim,f.parent);
  const store=(name:string)=>new Store(join(root,name));
  const ledger=(name:string,now=clock)=>new SyntheticProviderCapturePreparation(store(name),{clock:now,timeoutMs:10000});
  const read=(name:string)=>store(name).exclusive(tx=>tx.read(),signal());
  await t.test('THREAD/TURN 원자료 준비·중복0·새 store/원장 exact 원입력 재조회',async()=>{
   const first=ledger('normal');await first.prepare(thread.bindingInput,null,signal());await first.prepare(thread.bindingInput,null,signal());await first.prepare(turn.bindingInput,turn.parent,signal());
   assert.deepEqual(await ledger('normal').read(thread.bindingHash,signal()),{complete:true,bindingInput:thread.bindingInput,parent:null});
   assert.deepEqual(await ledger('normal').read(turn.bindingHash,signal()),{complete:true,bindingInput:turn.bindingInput,parent:f.parent});
   assert.deepEqual((await readdir(join(root,'normal'))).sort(),[filename(1),filename(2)]);
   assert.deepEqual(JSON.parse(await readFile(join(root,'normal',filename(2)),'utf8')),turn);
   const conflict=structuredClone(thread.bindingInput);conflict.claimId=randomUUID();await assert.rejects(first.prepare(conflict,null,signal()));assert.equal((await readdir(join(root,'normal'))).length,2);
  });
  await t.test('완료 sync 뒤 callback 실패 보존·만료/같은 사건 다른 claim 재발급 거절',async()=>{
   await assert.rejects(store('callback-failure').exclusive(async tx=>{await tx.read();await tx.appendAndSync(thread);throw Error('CALLBACK_FAILED');},signal()));
   assert.deepEqual(await ledger('callback-failure').read(thread.bindingHash,signal()),{complete:true,bindingInput:thread.bindingInput,parent:null});
   const expired=ledger('expired',()=>Date.parse(thread.bindingInput.usableBefore));await assert.rejects(expired.prepare(thread.bindingInput,null,signal()));assert.deepEqual(await readdir(join(root,'expired')),[]);
   await assert.rejects(ledger('normal',()=>Date.parse(thread.bindingInput.usableBefore)).read(thread.bindingHash,signal()));
  });
  await t.test('부분/타파일/비정규JSON/UTF8/남은lock 보존 거절',async()=>{
   const bad:[string,string,Uint8Array][]=[['partial',filename(1),Buffer.from('{')],['foreign','other.json',frame(thread)],['noncanonical',filename(1),Buffer.from(JSON.stringify(thread)+'\n')],['invalid-utf8',filename(1),Buffer.from([0xff])],['stale-lock',lock,Buffer.from('STALE')]];
   for(const[name,file,bytes]of bad){await writeFile(join(root,name,file),bytes,{flag:'wx'});await assert.rejects(read(name));assert.deepEqual(await readFile(join(root,name,file)),bytes);}
  });
  await t.test('경쟁 lock·취소·닫힌 tx·동시연산·읽기전쓰기·실제 write 거절',async()=>{
   let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),waiting=new Promise<void>(r=>release=r);
   const active=store('concurrent').exclusive(async tx=>{await tx.read();enter();await waiting;},signal());await entered;try{await assert.rejects(read('concurrent'));}finally{release();await active;}
   const aborted=new AbortController();aborted.abort();let calls=0;await assert.rejects(store('aborted').exclusive(async()=>{calls++;},aborted.signal));assert.equal(calls,0);
   const controller=new AbortController();await assert.rejects(store('aborted').exclusive(async tx=>{await tx.read();controller.abort();await tx.appendAndSync(thread);},controller.signal));assert(!(await readdir(join(root,'aborted'))).includes(filename(1)));
   const closed=await store('escaped').exclusive(async tx=>{await tx.read();return tx;},signal());await assert.rejects(closed.read());await assert.rejects(closed.appendAndSync(thread));
   await assert.rejects(store('overlap').exclusive(async tx=>{const outcomes=await Promise.allSettled([tx.read(),tx.read()]);assert(outcomes.some(v=>v.status==='rejected'));},signal()));
   await assert.rejects(store('unread').exclusive(async tx=>tx.appendAndSync(thread),signal()));
   await assert.rejects(store('write-failure').exclusive(async tx=>{await tx.read();await mkdir(join(root,'write-failure',filename(1)));await tx.appendAndSync(thread);},signal()));assert((await readdir(join(root,'write-failure'))).includes(lock));
  });
  await t.test('직접 prepared 임의필드/rawhandle·bindinghash·부모 불일치 저장0',async()=>{
   const invalid:[string,unknown][]=[['row-extra',{...thread,rawHandle:'FORBIDDEN_RAW'}],['row-hash',{...thread,bindingHash:'0'.repeat(64)}],['row-parent',{...turn,parent:null}]];
   for(const[name,value]of invalid){await assert.rejects(store(name).exclusive(async tx=>{await tx.read();await tx.appendAndSync(value as typeof thread);},signal()));assert(!(await readdir(join(root,name))).includes(filename(1)));}
  });
  await t.test('512행/2MiB 경계와 미생성root는 자동 복구하지 않는다',async()=>{
   const countRows=Array.from({length:512},()=>row(fresh(f.parent)));assert(Buffer.byteLength(canonicalJson({complete:true,entries:countRows}))<=2*1024*1024);
   for(let i=0;i<countRows.length;i++)await writeFile(join(root,'count',filename(i+1)),frame(countRows[i]),{flag:'wx'});
   await assert.rejects(store('count').exclusive(async tx=>{const got=await tx.read() as {entries:unknown[]};assert.equal(got.entries.length,512);await tx.appendAndSync(row(fresh(f.parent)));},signal()));assert(!(await readdir(join(root,'count'))).includes(filename(513)));
   const byteRows=[thread];let next=turn;
   for(;;){next=row(fresh(f.claim),f.parent);if(Buffer.byteLength(canonicalJson({complete:true,entries:[...byteRows,next]}))>2*1024*1024)break;byteRows.push(next);assert(byteRows.length<512);}
   for(let i=0;i<byteRows.length;i++)await writeFile(join(root,'bytes',filename(i+1)),frame(byteRows[i]),{flag:'wx'});
   await assert.rejects(store('bytes').exclusive(async tx=>{await tx.read();await tx.appendAndSync(next);},signal()));assert(!(await readdir(join(root,'bytes'))).includes(filename(byteRows.length+1)));
   await assert.rejects(read('missing'));await assert.rejects(lstat(join(root,'missing')),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');
  });
  await t.test('기존 START bridge 준비sync→CREATE→결과sync와 두 새 원장 exactread',async()=>{
   const sf=startCaptureFixture(),now=()=>Date.parse('2026-10-23T00:00:00.000Z'),order:string[]=[];let captures=0,binding:ProviderBindingInput|undefined;
   const preparationStore=store('bridge-preparation'),prepared=new SyntheticProviderCapturePreparation(preparationStore,{clock:now,timeoutMs:10000});
   const results=new SyntheticProviderCaptureResults(prepared,new SyntheticProviderCaptureResultsFileStore(join(root,'bridge-results')),{clock:now,timeoutMs:10000});
   const bridge=new SyntheticStartProtectedCaptureBridge({preparationStore,basis:{transport:'SYNTHETIC_ONLY',prepare:async(input,abort)=>{const v=await sf.barrier.complete(input,abort);const{protectedHandleRef:_,...b}=v.claim;binding=b;return{bindingInput:b,parent:null};}},pipe:{transport:'SYNTHETIC_ONLY',invoke:async()=>{captures++;assert(binding);assert.deepEqual(await prepared.read(providerBindingHash(binding),signal()),{complete:true,bindingInput:binding,parent:null});assert.deepEqual(await readdir(join(root,'bridge-results')),[]);order.push('PREPARATION_SYNC','CREATE');return frame({ok:true,data:{ciphertextHash:'f'.repeat(64)}});}},receipts:{transport:'SYNTHETIC_ONLY',appendAndSync:async(value,abort)=>{const receipt=await results.appendAndSync(value,abort);order.push('RESULT_SYNC');return receipt;}}},{clock:now,timeoutMs:10000,maxFrameBytes:8192});
   bridge.codec.encodeRequest('initialize','init',{clientInfo:{name:'anvil',version:'0.1'}});bridge.codec.push(frame({id:'init',result:{codexHome:'C:\\synthetic',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'}}));bridge.codec.encodeInitialized();
   // 원 START fixture의 codec/transport가 만든 RPC facts를 보존한다. fixture의 80ms
   // 메모리 transport timeout과 실제 파일 시험 예산을 섞지 않고 bridge를 직접 완료한다.
   let captured:Parameters<typeof bridge.complete>[0]|undefined;
   await sf.withBarrier({codec:bridge.codec,transport:'SYNTHETIC_ONLY',complete:async(input:Parameters<typeof bridge.complete>[0],abort:AbortSignal)=>{captured=input;return sf.barrier.complete(input,abort);}}).send(sf.input());
   assert(captured);const result=await bridge.complete(captured,signal()) as {claim:ProviderSessionClaim;claimRef:ReturnType<typeof validateProviderSessionClaim>['ref'];ciphertextHash:string};assert(binding);
   assert.deepEqual(order,['PREPARATION_SYNC','CREATE','RESULT_SYNC']);assert.equal(captures,1);
   const rereadPreparation=new SyntheticProviderCapturePreparation(store('bridge-preparation'),{clock:now,timeoutMs:10000});
   assert.deepEqual(await rereadPreparation.read(providerBindingHash(binding),signal()),{complete:true,bindingInput:binding,parent:null});
   const rereadResults=new SyntheticProviderCaptureResults(rereadPreparation,new SyntheticProviderCaptureResultsFileStore(join(root,'bridge-results')),{clock:now,timeoutMs:10000});
   assert.deepEqual(await rereadResults.read(result.claimRef,signal()),{claimRef:result.claimRef,ciphertextHash:result.ciphertextHash,parent:null});
   await assert.rejects(bridge.complete(captured,signal()));assert.equal(captures,1);
   // 별도 원 START fixture의 손상 준비원장은 capture 전 차단한다.
   await writeFile(join(root,'bridge-rejected-preparation',filename(1)),Buffer.from('{'),{flag:'wx'});
   const sf2=startCaptureFixture();let captured2:Parameters<typeof bridge.complete>[0]|undefined;
   const rejectedPrepared=new SyntheticProviderCapturePreparation(store('bridge-rejected-preparation'),{clock:now,timeoutMs:10000});
   const rejectedResults=new SyntheticProviderCaptureResults(rejectedPrepared,new SyntheticProviderCaptureResultsFileStore(join(root,'bridge-rejected-results')),{clock:now,timeoutMs:10000});
   const rejected=new SyntheticStartProtectedCaptureBridge({preparationStore:store('bridge-rejected-preparation'),basis:{transport:'SYNTHETIC_ONLY',prepare:async(input,abort)=>{const v=await sf2.barrier.complete(input,abort);const{protectedHandleRef:_,...b}=v.claim;return{bindingInput:b,parent:null};}},pipe:{transport:'SYNTHETIC_ONLY',invoke:async()=>{captures++;throw Error('UNREACHABLE');}},receipts:rejectedResults},{clock:now,timeoutMs:10000,maxFrameBytes:8192});
   rejected.codec.encodeRequest('initialize','init',{clientInfo:{name:'anvil',version:'0.1'}});rejected.codec.push(frame({id:'init',result:{codexHome:'C:\\synthetic',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'}}));rejected.codec.encodeInitialized();
   await sf2.withBarrier({codec:rejected.codec,transport:'SYNTHETIC_ONLY',complete:async(input:Parameters<typeof bridge.complete>[0],abort:AbortSignal)=>{captured2=input;return sf2.barrier.complete(input,abort);}}).send(sf2.input());
   assert(captured2);await assert.rejects(rejected.complete(captured2,signal()));assert.equal(captures,1);assert.deepEqual(await readdir(join(root,'bridge-rejected-results')),[]);
  });
 }finally{
  const current=await lstat(root);assert.equal(current.dev,rootId.dev);assert.equal(current.ino,rootId.ino);assert(!current.isSymbolicLink());
  const inventory:{relativePath:string;kind:string;bytes?:number;sha256?:string}[]=[];
  for(const name of names)for(const file of await readdir(join(root,name))){assert(file===lock||file==='provider-capture-results.lock'||file==='other.json'||/^\d{6}\.json$/.test(file));const path=join(root,name,file),stat=await lstat(path);assert(!stat.isSymbolicLink());if(stat.isDirectory()){assert.equal(name,'write-failure');assert.equal(file,filename(1));assert.deepEqual(await readdir(path),[]);inventory.push({relativePath:name+'/'+file,kind:'directory'});}else{assert(stat.isFile());const bytes=await readFile(path);inventory.push({relativePath:name+'/'+file,kind:'file',bytes:bytes.length,sha256:contentHash(bytes)});}}
  console.log('CAPTURE_PREPARATION_STORE_QA_INVENTORY '+JSON.stringify({root,directories:names,entries:inventory}));
 }
});
