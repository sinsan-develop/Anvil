import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {mkdir,lstat,readdir,readFile,writeFile,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {providerProtectedHandleRef,validateProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {SyntheticProviderCaptureResults} from '../../../apps/connector/runtime/provider-capture-results.ts';
import {providerTurnFixture} from './provider-turn-fixture.ts';

const names=['normal','callback-failure','partial','foreign','noncanonical','invalid-utf8','stale-lock','concurrent','aborted','escaped','overlap','unread','write-failure','row-extra','row-ref','row-cipher','row-parent','count','bytes','orphan','conflict','missing'] as const;
const lock='provider-capture-results.lock',filename=(n:number)=>String(n).padStart(6,'0')+'.json';
const signal=()=>new AbortController().signal;
const row=(claim:any,parent:any=null)=>({claim:structuredClone(claim),claimRef:validateProviderSessionClaim(claim,parent??undefined).ref,ciphertextHash:'f'.repeat(64),parent:structuredClone(parent)});
const metadata=(r:any)=>({claim:r.claim,claimRef:r.claimRef,ciphertextHash:r.ciphertextHash,executionAuthorized:false,dispatchPerformed:false});
const frame=(r:unknown)=>Buffer.from(canonicalJson(r)+'\n');
const fresh=(claim:any)=>{const{protectedHandleRef:_,...input}=structuredClone(claim);input.claimId=randomUUID();input.commandId=randomUUID();return{...input,protectedHandleRef:providerProtectedHandleRef(input,'f'.repeat(64))};};

// 소유/30분 수명/정리는 Main이 관리한다. OS temp fallback 및 시험 자체 삭제는 없다.
test('명시 파일 저장→원장 재생성 exactref와 손상·수명·한도 failclosed',async t=>{
 const raw=process.env.ANVIL_CAPTURE_STORE_QA_ROOT;
 assert.equal(typeof raw,'string','Main이 사전 등록한 QA root만 명시 주입해야 한다');
 assert.equal(resolve(raw!).toUpperCase(),'D:\\TMP\\ANVIL-PROVIDER-CAPTURE-RESULTS-STORE');
 const root=resolve(raw!);
 const m=await import('../../../apps/connector/runtime/provider-capture-results-file-store.ts');
 assert.equal(typeof m.SyntheticProviderCaptureResultsFileStore,'function');
 const Store=m.SyntheticProviderCaptureResultsFileStore;
 assert.throws(()=>new Store('relative-root'));
 await assert.rejects(lstat(root),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');
 await mkdir(root,{mode:0o700});
 const rootId=await lstat(root);assert(rootId.isDirectory()&&!rootId.isSymbolicLink());
 assert.equal((await realpath(root)).toUpperCase(),root.toUpperCase());
 const made:string[]=[];
 try{
  for(const name of names){if(name!=='missing'){await mkdir(join(root,name),{mode:0o700});made.push(name);}}
  const f=await providerTurnFixture(),clock=()=>Date.parse(f.f.basis.fact.checkedAt),thread=row(f.parent),turn=row(f.claim,f.parent);
  const prepared:any={transport:'SYNTHETIC_ONLY',read:async(bindingHash:string)=>{
   for(const r of [thread,turn]){const{protectedHandleRef:_,...bindingInput}=r.claim;
    const{providerBindingHash}=await import('../../../contracts/runtime/provider-session-claim-v1.ts');
    if(providerBindingHash(bindingInput)===bindingHash)return{complete:true,bindingInput,parent:r.parent};
   }throw Error('NOT_PREPARED');
  }};
  const store=(name:string)=>new Store(join(root,name));
  const ledger=(name:string,source=prepared)=>new SyntheticProviderCaptureResults(source,store(name),{clock,timeoutMs:10000});
  const read=(name:string)=>store(name).exclusive(async tx=>tx.read(),signal());
  await t.test('실제 기존 원장 저장·중복0·THREAD/TURN 재생성 조회·정확 ref',async()=>{
   const first=ledger('normal');assert.equal(store('normal').transport,'SYNTHETIC_ONLY');
   await first.appendAndSync(metadata(thread),signal());await first.appendAndSync(metadata(thread),signal());
   await first.appendAndSync(metadata(turn),signal());
   const reopened=ledger('normal');
   assert.deepEqual(await reopened.read(turn.claimRef,signal()),{claimRef:turn.claimRef,ciphertextHash:turn.ciphertextHash,parent:f.parent});
   assert.deepEqual(await reopened.read(thread.claimRef,signal()),{claimRef:thread.claimRef,ciphertextHash:thread.ciphertextHash,parent:null});
   await assert.rejects(reopened.read({...turn.claimRef,version:2},signal()));
   assert.deepEqual((await readdir(join(root,'normal'))).sort(),[filename(1),filename(2)]);
   assert.deepEqual(JSON.parse(await readFile(join(root,'normal',filename(2)),'utf8')),turn);
  });
  await t.test('성공 sync 이후 callback 실패도 행을 보존하여 재조회한다',async()=>{
   await assert.rejects(store('callback-failure').exclusive(async tx=>{await tx.read();await tx.appendAndSync(thread);throw Error('CALLBACK_FAILED');},signal()));
   assert.deepEqual(await ledger('callback-failure').read(thread.claimRef,signal()),{claimRef:thread.claimRef,ciphertextHash:thread.ciphertextHash,parent:null});
   assert.deepEqual(await readdir(join(root,'callback-failure')),[filename(1)]);
  });
  await t.test('부분·타파일·비정규JSON·잘못된UTF8·남은lock 보존 거절',async()=>{
   const bad:[string,string,Uint8Array][]=[['partial',filename(1),Buffer.from('{')],['foreign','other.json',frame(thread)],['noncanonical',filename(1),Buffer.from(JSON.stringify(thread)+'\n')],['invalid-utf8',filename(1),Buffer.from([0xff])],['stale-lock',lock,Buffer.from('STALE')]];
   for(const[name,file,bytes]of bad){await writeFile(join(root,name,file),bytes,{flag:'wx'});await assert.rejects(read(name),name);assert.deepEqual(await readFile(join(root,name,file)),bytes);}
  });
  await t.test('동시 인스턴스 lock 및 취소·callback후 tx 재사용 거절',async()=>{
   let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),waiting=new Promise<void>(r=>release=r);
   const active=store('concurrent').exclusive(async tx=>{await tx.read();enter();await waiting;},signal());
   await entered;try{await assert.rejects(read('concurrent'));}finally{release();await active;}
   const aborted=new AbortController();aborted.abort();let called=0;
   await assert.rejects(store('aborted').exclusive(async()=>{called++;},aborted.signal));assert.equal(called,0);
   const controller=new AbortController();let escaped:any;
   await assert.rejects(store('aborted').exclusive(async tx=>{escaped=tx;await tx.read();controller.abort();await tx.appendAndSync(thread);},controller.signal));
   await assert.rejects(escaped.read());assert(!(await readdir(join(root,'aborted'))).includes(filename(1)));
   const closed=await store('escaped').exclusive(async tx=>{await tx.read();return tx;},signal());
   await assert.rejects(closed.read());await assert.rejects(closed.appendAndSync(thread));assert.deepEqual(await readdir(join(root,'escaped')),[]);
  });
  await t.test('동일 tx 동시 연산·읽기전 쓰기·실제 write 실패는 성공으로 승격하지 않는다',async()=>{
   await assert.rejects(store('overlap').exclusive(async tx=>{const results=await Promise.allSettled([tx.read(),tx.read()]);assert(results.some(r=>r.status==='rejected'));},signal()));
   await assert.rejects(store('unread').exclusive(async tx=>tx.appendAndSync(thread),signal()));
   await assert.rejects(store('write-failure').exclusive(async tx=>{await tx.read();await mkdir(join(root,'write-failure',filename(1)));await tx.appendAndSync(thread);},signal()));
   assert((await lstat(join(root,'write-failure',filename(1)))).isDirectory());
   assert((await readdir(join(root,'write-failure'))).includes(lock));
  });
  await t.test('직접 port 임의 필드/rawhandle·다른ref/cipher·부모 불일치 저장0',async()=>{
   let n=0;for(const value of [{...thread,rawHandle:'FORBIDDEN_RAW'},{...thread,claimRef:{...thread.claimRef,contentHash:'0'.repeat(64)}},{...thread,ciphertextHash:'e'.repeat(64)},{...turn,parent:null}]){
    const name=['row-extra','row-ref','row-cipher','row-parent'][n++]!;await assert.rejects(store(name).exclusive(async tx=>{await tx.read();await tx.appendAndSync(value as any);},signal()));
    assert(!(await readdir(join(root,name))).includes(filename(1)));
   }
  });
  await t.test('512행 경계·2MiB 원장 경계 거절 후 기존자료 불변',async()=>{
   const countRows=Array.from({length:512},()=>row(fresh(f.parent)));
   assert(Buffer.byteLength(canonicalJson({complete:true,entries:countRows}))<=2*1024*1024);
   for(let i=0;i<countRows.length;i++)await writeFile(join(root,'count',filename(i+1)),frame(countRows[i]),{flag:'wx'});
   await assert.rejects(store('count').exclusive(async tx=>{const got:any=await tx.read();assert.equal(got.entries.length,512);await tx.appendAndSync(row(fresh(f.parent)));},signal()));
   assert(!(await readdir(join(root,'count'))).includes(filename(513)));
   const byteRows=[thread];let next:any;
   for(;;){next=row(fresh(f.claim),f.parent);if(Buffer.byteLength(canonicalJson({complete:true,entries:[...byteRows,next]}))>2*1024*1024)break;byteRows.push(next);assert(byteRows.length<512);}
   for(let i=0;i<byteRows.length;i++)await writeFile(join(root,'bytes',filename(i+1)),frame(byteRows[i]),{flag:'wx'});
   await assert.rejects(store('bytes').exclusive(async tx=>{await tx.read();await tx.appendAndSync(next);},signal()));
   assert(!(await readdir(join(root,'bytes'))).includes(filename(byteRows.length+1)));
  });
  await t.test('원장의 claim충돌·부모누락 기준과 미생성root 거절 유지',async()=>{
   await writeFile(join(root,'orphan',filename(1)),frame(turn),{flag:'wx'});await assert.rejects(ledger('orphan').read(turn.claimRef,signal()));
   await writeFile(join(root,'conflict',filename(1)),frame(thread),{flag:'wx'});
   const{protectedHandleRef:_,...input}=structuredClone(f.parent);input.claimId=randomUUID();
   const conflict=row({...input,protectedHandleRef:providerProtectedHandleRef(input,'f'.repeat(64))});
   const source:any={transport:'SYNTHETIC_ONLY',read:async()=>({complete:true,bindingInput:input,parent:null})};
   await assert.rejects(ledger('conflict',source).appendAndSync(metadata(conflict),signal()));
   assert(!(await readdir(join(root,'conflict'))).includes(filename(2)));
   await assert.rejects(read('missing'));await assert.rejects(lstat(join(root,'missing')),(e:NodeJS.ErrnoException)=>e.code==='ENOENT');
  });
 }finally{
  // Main은 이 정확 inventory와 owner/nonlink/identity/hash를 대조해 정리한다.
  const now=await lstat(root);assert.equal(now.dev,rootId.dev);assert.equal(now.ino,rootId.ino);assert(!now.isSymbolicLink());
  const inventory:any[]=[];
  for(const name of made)for(const file of await readdir(join(root,name))){assert(file===lock||file==='other.json'||/^\d{6}\.json$/.test(file));const path=join(root,name,file),stat=await lstat(path);assert(!stat.isSymbolicLink());if(stat.isDirectory()){assert.equal(name,'write-failure');assert.equal(file,filename(1));assert.deepEqual(await readdir(path),[]);inventory.push({relativePath:name+'/'+file,kind:'directory'});}else{assert(stat.isFile());const bytes=await readFile(path);inventory.push({relativePath:name+'/'+file,kind:'file',bytes:bytes.length,sha256:contentHash(bytes)});}}
  console.log('CAPTURE_STORE_QA_INVENTORY '+JSON.stringify({root,directories:made,entries:inventory}));
 }
});
