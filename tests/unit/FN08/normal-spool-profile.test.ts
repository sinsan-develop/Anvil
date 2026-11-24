import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {NormalStartEntry} from '../../../apps/connector/runtime/normal-start-intake.ts';
import {assembleNormalStartMaterial} from '../../../apps/connector/runtime/normal-start-material-consumer.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {join,relative,resolve,sep} from 'node:path';
import {OwnedSpoolRuntime,outsideOwnedSpoolCallback} from '../../../apps/connector/runtime/normal-owned-spool-profile.ts';
import type {NormalOwnedHostFactory,NormalOwnedMetadata} from '../../../apps/connector/runtime/normal-credential-bootstrap-client.ts';
import {memoryFiles,root,scope} from './normal-start-local-fixture.ts';

const id=(n:number)=>'d81d0001-0000-4000-8000-'+String(n).padStart(12,'0');
const ref=(n:number)=>({id:id(n),version:1,contentHash:'1'.repeat(64)});
const grant=ref(4),profileId=id(3);
const time=Date.parse('2026-11-16T00:00:00.000Z');

test('normal 생성 전 claim source는 기존 관리 lock/DPAPI/anchor와 nonce 단회·미정착 여유를 보존한다',()=>{
 const source=readFileSync('apps/connector/native/NormalExecutionSpoolProfileSource.cs','utf8'),start=source.indexOf('internal Row ClaimNormalStartPreparation('),end=source.indexOf('static Row EvidenceRef(',start);assert(start>0&&end>start);const claim=source.slice(start,end);
 assert.match(source,/FileShare.None/);assert.match(source,/ProtectedData.Unprotect/);assert.match(source,/ValidateNormalPreparationClaims\(rows\);activeAnchor=anchor/);
 assert.match(source,/k==NormalPreparationClaim\)dirs=checked\(dirs\+AdminHold\)/);assert.match(source,/log.Length\+4\+cipher.Length\+activeAnchor.Length\+32\+ManagementHold\(rows\)\)>AdminCap/);
 assert.match(source,/if\(beforeWrite!=null\)beforeWrite\(\);long before=log.Length/);assert.match(source,/log.Flush\(true\)[\s\S]*activeAnchor.Flush\(true\)/);
 assert.match(source,/NORMAL_START_PREPARATION_NONCE_V1/);assert.match(source,/!nonces.Add\(S\(r,"nonceDigest"\)\)/);assert.match(claim,/S\(r,"nonceDigest"\)==nonceDigest/);assert.match(claim,/prior.Length>1/);
 assert.match(claim,/foreach\(string k in row.Keys.Where\(k=>k!="id"&&k!="recordedAt"\)\)/);assert.ok(claim.indexOf('prior.Length==1')<claim.indexOf('Append(log,rows,row'));
 assert.match(claim,/Append\(log,rows,row,\(\)=>\{check\(\);appendStarted=true;\}\)/);assert.match(claim,/var back=Log\(false/);assert.match(claim,/J\(matches\[0\]\)!=J\(expected\)/);
 assert.match(claim,/if\(appendStarted\)\{blocked=true;throw Invalid\(\);\}/);assert.match(claim,/NORMAL_START_PREPARATION_REPLAY_ONLY/);assert.match(claim,/"creationAuthorized",false,"executionAuthorized",false,"dispatchPerformed",false/);
 assert.doesNotMatch(claim,/CreateSuspended|ReservePreparation|"RESERVED"|OsOwnershipVerified|NativeFactsVerified|SignNormal/);
});

// Synthetic native side. Sequence, registration and quota checks in C# are verified separately as source.
function fixture(shared?:{remaining:number},generation=1){
 const localScope={...scope,executionGeneration:generation},allocation=id(200+generation);
 const folder=resolve('Anvil','Trust','v1','owned-spool-profile.v1','data-'+allocation);
 const ram=memoryFiles(),events:string[]=[],releases:string[]=[],holds=new Map<string,string>();
 const owner=new AbortController(),signal=new AbortController(),child=new AbortController();
 let now=time,opens=0,allocated=false,count=0,loseSettle=false,capacity=false,unsupported=false,resumable=true,afterOpen:()=>void|Promise<void>=()=>{};
 let slot:NormalOwnedMetadata|null={slotId:id(500+generation),scope:{...localScope,connectorId:id(6),credentialGeneration:1,grantRef:grant},receiptRef:ref(7),
   expiresAt:new Date(time+20000).toISOString(),origin:'https://ram.invalid',caHash:'2'.repeat(64)};
 const old=slot;let onPhysicalCurrent=()=>{};
 type Summary={count:number;bytes:number;tail:string|null};
 const empty:Summary={count:0,bytes:0,tail:null},last=new Map<string,Summary>();
 const observe=(channel:string):Summary=>{
  let count=0,bytes=0,tail:string|null=null;
  for(const [path,row] of [...ram.files.entries()].sort(([a],[b])=>a.localeCompare(b))){
   const name=relative(root,path);if(!name.endsWith('.json')||(channel!=='inbox'&&!name.startsWith(channel+'.')))continue;
   count++;bytes+=row.bytes.length;const hash=contentHash(row.bytes);
   tail=channel==='inbox'?contentHash(canonicalJson([tail,name,row.bytes.length,hash])):hash;
  }return {count,bytes,tail};
 };
 const convert=(p:string)=>{assert.ok(p===folder||p.startsWith(folder+sep));return join(root,relative(folder,p));};
 const io={...ram.fs,lstat:async(p:string)=>ram.fs.lstat(convert(p)),realpath:async(p:string)=>{convert(p);return p;},
  open:async(p:string,...args:unknown[])=>{await afterOpen();return ram.fs.open(convert(p),...args);},
  opendir:async(p:string)=>{const names:string[]=await ram.fs.readdir(convert(p));return {close:async()=>{},async *[Symbol.asyncIterator](){for(const name of names)yield {name,isFile:()=>true,isSymbolicLink:()=>false};}};},
  readdir:async(p:string)=>ram.fs.readdir(convert(p)),unlink:async(p:string)=>ram.fs.unlink(convert(p)),
  unlinkSync:(p:string)=>{assert.ok(ram.files.delete(convert(p)));}};
 const host:NormalOwnedHostFactory={open:async()=>{
  opens++;
  return {invalidated:child.signal,current:()=>{onPhysicalCurrent();if(child.signal.aborted||owner.signal.aborted)throw Error('MODEL_HOST_LOST');},send:async(op,payload)=>{
   const p=payload as {channel:string;reservation:string;writer:string;nodeStamp:string};
   events.push(op);
   if(op==='NORMAL_SPOOL_PROFILE_STATE')return unsupported?{state:'UNSUPPORTED'}:{profileId,allocated};
   if(op==='NORMAL_SPOOL_ALLOCATE'||op==='NORMAL_SPOOL_RESUME'){
    if(!resumable||holds.size)throw Error('MODEL_UNSETTLED');
    const was=allocated;if(was&&p.writer==='NORMAL_EXECUTION')assert.deepEqual(slot?.scope.grantRef,grant);allocated=true;return {state:was?'RESUMED':'ALLOCATED',profileId,allocation,root:folder,directoryIdentity:'native-volume-index'};
   }
   if(op==='NORMAL_SPOOL_RESERVE'){
    assert.equal(p.nodeStamp,'1:1');const before=observe(p.channel);assert.deepEqual(before,last.get(p.channel)??empty);
    if(capacity||(shared&&shared.remaining<64*1024**2))return {state:'CAPACITY_EXCEEDED'};
    if(shared)shared.remaining-=64*1024**2;
    assert.ok(!holds.has(p.channel));const reservation=id(10+(count++));holds.set(p.channel,reservation);
    return {reservation,before};
   }
   if(op==='NORMAL_SPOOL_SETTLE'){
    assert.equal(holds.get(p.channel),p.reservation);const summary=observe(p.channel);last.set(p.channel,summary);holds.delete(p.channel);if(shared)shared.remaining+=64*1024**2;if(loseSettle)throw Error('SETTLE_REPLY_LOST');
    return {state:'SETTLED',summary};
   }
   if(op==='NORMAL_SPOOL_CLOSE'){assert.equal(holds.size,0);return {state:'CLOSED_CONFIRMED'};}
   assert.match(op,/^NORMAL_EXECUTION_/);return {opaque:true};
  },close:async disposition=>{releases.push(disposition);return {state:'CLOSED_CONFIRMED'};}};
 }};
 const runtime=new OwnedSpoolRuntime(host,id(1),()=>now,owner.signal,()=>slot,io);
 const store=runtime.journal(localScope,signal.signal);
 return {runtime,store,ram,events,releases,owner,signal,child,holds,old,opens:()=>opens,
  setSlot:(v:NormalOwnedMetadata|null)=>{slot=v;},expire:()=>{now=time+10000;},
  setCapacity:()=>{capacity=true;},noProfile:()=>{unsupported=true;},loseSettle:()=>{loseSettle=true;},
  setPhysicalCurrent:(callback:()=>void)=>{onPhysicalCurrent=callback;},noResume:()=>{resumable=false;},onOpen:(v:()=>void|Promise<void>)=>{afterOpen=v;}};
}

test('보호 SDK 출력행은 같은 배정의 ACK 읽기와 공존하고 범용 채널 이름으로 열리지 않는다',async()=>{
 const f=fixture();
 f.ram.files.set(f.ram.path('sdk-session-output.000001.json'),{bytes:Buffer.from('{"private":true}\n'),ino:500,link:false});
 const rows=await f.store.exclusive('acks',tx=>tx.read());
 assert.deepEqual(rows,[]);
 const opens=f.opens();
 await assert.rejects(f.store.exclusive('sdk-session-output',tx=>tx.read()),/NORMAL_LOCAL_STORAGE_UNAVAILABLE/);
 assert.equal(f.opens(),opens);
});

test('비권위 receipt writer는 normal slot 없이 등록 범위의 원 봉투를 읽고 동일 영수증만 재판독한다',async()=>{
 const f=fixture();f.setSlot(null);
 const context={...scope,assignmentId:id(10),connectionRef:ref(11),environmentRef:ref(12),authorizationReceiptRef:ref(13),capabilityRef:ref(14),budgetRef:ref(15),
  sourceScopes:[{sourceRootRef:ref(16),mappingRef:null,observationRef:ref(17),baselineRef:ref(18),targets:[{relativePath:'sample.ts',kind:'FILE' as const,access:'READ' as const,recursive:false as const}]}]};
 const expected={context,executorRegistrationRef:ref(19)},base={schemaVersion:1,commandId:id(20),issuedAt:new Date(time-1000).toISOString(),expiresAt:new Date(time+10000).toISOString(),
  ...expected,operation:'START_SESSION',payload:{contextBundleRef:ref(21),optionsRef:ref(22)}};
 const envelope={...base,envelopeHash:contentHash(canonicalJson(base))},limits={maxBytes:4096,maxEntries:10};
 const receive=()=>f.runtime.receive(limits,envelope,expected,f.signal.signal);
 const first=await receive(),second=await receive();assert.equal(first.state,'RECORDED');assert.equal(first.duplicate,false);
 assert.equal(second.duplicate,true);assert.equal(second.recordedAt,first.recordedAt);assert.equal(second.executionAuthorized,false);assert.equal(second.dispatchPerformed,false);
 assert.equal(f.ram.files.size,1);assert.equal(f.events.filter(x=>x==='NORMAL_SPOOL_SETTLE').length,2);
});

test('한 정상 거래의 중첩 자료/permit 대여는 물리 host 하나를 사용하고 외부·교차scope·늦은 작업을 거절한다',async()=>{
 const f=fixture(),port=f.runtime.credentialHost();let late!:Promise<void>;
 let resume!:()=>void;const gate=new Promise<void>(r=>{resume=r;});
 await f.store.exclusive('observations',async tx=>{
  await tx.read();await f.store.exclusive('acks',async a=>{await a.read();});
  await assert.rejects(outsideOwnedSpoolCallback(()=>port.open(f.signal.signal,f.old)),/BUSY/);
  await assert.rejects(port.open(f.signal.signal,{...f.old,slotId:id(11)}),/BUSY/);
  const borrowed=await port.open(f.signal.signal,f.old);
  await assert.rejects(port.open(f.signal.signal,f.old),/BUSY/);
  await borrowed.send('NORMAL_EXECUTION_CALL',{slotId:f.old.slotId,attemptId:id(1)});
  await borrowed.close('HOST_REQUEST_VALIDATED');await assert.rejects(borrowed.send('NORMAL_EXECUTION_READ',{}));
  late=gate.then(async()=>{await assert.rejects(port.open(f.signal.signal,f.old));});
  await tx.appendAndSync({record:1});
 });
 resume();await late;
 assert.equal(f.opens(),1);assert.equal(f.events.filter(x=>x==='NORMAL_SPOOL_SETTLE').length,2);
 assert.deepEqual(f.releases,['HOST_REQUEST_VALIDATED']);assert.equal(f.holds.size,0);
});

test('지원하지 않는 profile·용량거절은 원 상태로 닫히고 Node mutation이 없다',async()=>{
 for(const which of ['unsupported','capacity']){
  const f=fixture();if(which==='unsupported')f.noProfile();else f.setCapacity();
  await assert.rejects(f.store.exclusive('acks',async()=>0),which==='unsupported'?/UNSUPPORTED/:/CAPACITY_EXCEEDED/);
  assert.equal(f.ram.mode.opens,0);assert.equal(f.holds.size,0);assert.deepEqual(f.releases,['HOST_REQUEST_VALIDATED']);
 }
});

test('물리 host의 current에서 이어진 자손은 같은 scope의 원 보호 요청을 빌리지 못한다',async()=>{
 const f=fixture(),port=f.runtime.credentialHost();let release!:()=>void,last:Promise<void>|undefined;
 await f.store.exclusive('observations',async tx=>{
  f.setPhysicalCurrent(()=>{
   const gate=new Promise<void>(resolve=>{release=resolve;});
   last=gate.then(async()=>{await assert.rejects(port.open(f.signal.signal,f.old),/BUSY/);});
  });
  await tx.read();f.setPhysicalCurrent(()=>{});assert.ok(last);release();await last;
 });
 assert.equal(f.opens(),1);assert.equal(f.events.filter(op=>op.startsWith('NORMAL_EXECUTION_')).length,0);
 assert.deepEqual(f.releases,['HOST_REQUEST_VALIDATED']);
});

test('원 worker 재조회는 같은 미정산 attempt의 단 한 번뿐이며 반환·취소·교차 owner에서 자료를 열지 않는다',async()=>{
 const f=fixture(),other=fixture(),now=()=>time;
 const context={...scope,assignmentId:id(10),connectionRef:ref(11),environmentRef:ref(12),authorizationReceiptRef:ref(13),capabilityRef:ref(14),budgetRef:ref(15),
  sourceScopes:[{sourceRootRef:ref(16),mappingRef:null,observationRef:ref(17),baselineRef:ref(18),targets:[{relativePath:'a',kind:'FILE' as const,access:'READ' as const,recursive:false as const}]}]};
 const expected={context,executorRegistrationRef:ref(19)},key={...scope,commandId:id(20)};
 const issuedAt=new Date(time).toISOString(),expiresAt=new Date(time+10000).toISOString();
 const raw={schemaVersion:1 as const,operation:'START_SESSION' as const,commandId:key.commandId,...expected,issuedAt,expiresAt,payload:{contextBundleRef:ref(21),optionsRef:ref(22)}};
 const envelopeHash=contentHash(canonicalJson(raw)),envelope={...raw,envelopeHash},bytes=new Uint8Array([123,125]);
 const data={transport:'NORMAL_PROTECTED' as const,key,envelopeHash,contextBundleRef:raw.payload.contextBundleRef,
  receivedRef:ref(23),utf8Bytes:2,contentHash:contentHash(bytes),bytes,executionAuthorized:false as const};
 const input={envelope,contextBundle:data,options:{...data,optionsRef:raw.payload.optionsRef},localAttemptRef:ref(24),
  permit:{ref:ref(25),commandId:key.commandId,envelopeHash,issuedAt,expiresAt}};
 const current={transport:'NORMAL_PROTECTED' as const,current:async()=>assert.fail('거절된 재조회는 CURRENT를 호출하지 않는다')};
 assert.throws(()=>f.runtime.workerWire(other.store,expected,current,grant,now,1000),/SCOPE_INVALID/);
 const wire=f.runtime.workerWire(f.store,expected,current,grant,now,1000);
 assert.throws(()=>f.runtime.workerWire(f.store,expected,current,grant,now,1000),/SCOPE_INVALID/);
 const read=()=>outsideOwnedSpoolCallback(()=>wire.send(input,new AbortController().signal));
 const reserveCount=()=>f.events.filter(e=>e==='NORMAL_SPOOL_RESERVE').length;
 await f.store.exclusive('attempt-'+id(99),async()=>{await assert.rejects(read(),/NORMAL_INTAKE_START_UNAVAILABLE/);});
 await f.store.exclusive('attempt-'+key.commandId,async()=>{
  const before=reserveCount(),borrow=await f.runtime.credentialHost().open(f.signal.signal,f.old);
  await borrow.send('NORMAL_EXECUTION_CALL',{slotId:f.old.slotId,attemptId:id(1)});
  await assert.rejects(read(),/NORMAL_INTAKE_START_UNAVAILABLE/);
  await borrow.close('HOST_REQUEST_VALIDATED');
  await assert.rejects(read(),/NORMAL_INTAKE_START_UNAVAILABLE/);assert.equal(reserveCount(),before);
 });
 const count=reserveCount();await Promise.resolve().then(()=>assert.rejects(read(),/NORMAL_INTAKE_START_UNAVAILABLE/));
 assert.equal(reserveCount(),count);
 let cancelledRead:Promise<void>|undefined;
 await assert.rejects(f.store.exclusive('attempt-'+key.commandId,async()=>{
  f.signal.abort();cancelledRead=assert.rejects(read(),/NORMAL_INTAKE_START_UNAVAILABLE/);await cancelledRead;
 }));assert.ok(cancelledRead);await cancelledRead;assert.equal(reserveCount(),count+1);
});

test('두 owner가 공유하는 남은 정상 채널 한도에서 미정산 예약은 둘째 writer의 lock 생성 전에 거절된다',async()=>{
 // Native balance replies below model a profile already charged 192MiB against NORMAL_EXECUTION.
 const shared={remaining:64*1024**2},a=fixture(shared),b=fixture(shared,2);
 let release!:()=>void,started!:()=>void;const entered=new Promise<void>(r=>{started=r;}),pending=new Promise<void>(r=>{release=r;});
 const first=a.store.exclusive('observations',async tx=>{await tx.read();started();await pending;});
 await entered;assert.equal(shared.remaining,0);
 await assert.rejects(b.store.exclusive('acks',tx=>tx.read()),/CAPACITY_EXCEEDED/);assert.equal(b.ram.mode.opens,0);
 release();await first;await b.store.exclusive('acks',tx=>tx.read());assert.equal(shared.remaining,64*1024**2);
});
test('기한·원owner·slot 소실 뒤 새 쓰기 없이 미정산 hold를 보존한다',async()=>{
 for(const mode of ['time','owner','slot']){
  const f=fixture();await assert.rejects(f.store.exclusive('observations',async tx=>{
   await tx.read();if(mode==='time')f.expire();else if(mode==='owner')f.owner.abort();else f.setSlot(null);
   await tx.appendAndSync({forbidden:1});
  }));assert.equal(f.events.includes('NORMAL_SPOOL_SETTLE'),false);assert.equal(f.holds.size,1);
  assert.equal([...f.ram.files.keys()].some(p=>p.endsWith('.json')),false);
  await assert.rejects(f.store.exclusive('acks',async()=>0));assert.equal(f.opens(),1);
 }
});

test('원 host 상실 중 늦게 반환되는 lock handle을 닫아도 reservation을 정산하거나 다시 발행하지 않는다',async()=>{
 const f=fixture();let started!:()=>void,release!:()=>void;
 const entered=new Promise<void>(r=>{started=r;}),pending=new Promise<void>(r=>{release=r;});
 f.onOpen(()=>{started();return pending;});
 const work=f.store.exclusive('observations',async tx=>{await tx.read();await tx.appendAndSync({invalid:true});});
 await entered;assert.equal(f.holds.size,1);f.child.abort();
 await assert.rejects(work,/UNKNOWN/);release();await new Promise<void>(r=>setImmediate(r));assert.equal(f.holds.size,1);assert.equal(f.events.includes('NORMAL_SPOOL_SETTLE'),false);
 assert.ok([...f.ram.files.keys()].some(p=>p.endsWith('.lock')));assert.equal(f.ram.mode.opens,1);
 await assert.rejects(f.store.exclusive('acks',async()=>0));assert.equal(f.opens(),1);
});

test('native 정산은 확정해도 응답 유실이면 호출자 UNKNOWN이고 새 host나 보상 쓰기 0',async()=>{
 const f=fixture();f.loseSettle();
 await assert.rejects(f.store.exclusive('observations',async tx=>{await tx.read();await tx.appendAndSync({durable:1});}),/UNKNOWN/);
 assert.equal(f.holds.size,0);assert.equal(f.events.filter(x=>x==='NORMAL_SPOOL_SETTLE').length,1);
 await assert.rejects(f.store.exclusive('acks',async()=>0));assert.equal(f.opens(),1);
});

test('같은 세대 정상 slot 갱신은 원배정을 재개하고 다른 grant에는 기존 행을 제공하지 않는다',async()=>{
 const f=fixture();await f.store.exclusive('acks',async tx=>{await tx.read();await tx.appendAndSync({a:1});});
 f.setSlot({...f.old,slotId:id(80),receiptRef:ref(81)});
 assert.deepEqual(await f.store.exclusive('acks',tx=>tx.read()),[{a:1}]);
 f.setSlot({...f.old,slotId:id(83),scope:{...f.old.scope,grantRef:ref(84)}});
 const n=f.ram.mode.opens;await assert.rejects(f.store.exclusive('acks',tx=>tx.read()),/UNKNOWN/);
 assert.equal(f.ram.mode.opens,n);assert.equal(f.events.filter(x=>x==='NORMAL_SPOOL_ALLOCATE').length,1);
});
test('RAM에서 마지막 행 소실·동일 길이 교체·링크 변경을 새 빈 채널로 받아들이지 않는다',async()=>{
 for(const change of ['missing','replaced','linked']){
  const f=fixture();await f.store.exclusive('observations',async tx=>{await tx.read();await tx.appendAndSync({v:1});});
  const [path,row]=[...f.ram.files.entries()][0]!;
  if(change==='missing')f.ram.files.delete(path);else if(change==='replaced')row.bytes=Buffer.from('{"v":2}\n');else f.ram.mode.rootLink=true;
  const n=f.ram.mode.opens;await assert.rejects(f.store.exclusive('observations',tx=>tx.read()),/UNKNOWN/);
  assert.equal(f.ram.mode.opens,n);assert.equal(f.events.filter(x=>x==='NORMAL_SPOOL_ALLOCATE').length,1);
 }
});
test('기존 배정 재개 거절에서 allocate 대체와 자료 I/O가 없다',async()=>{
 const f=fixture();await f.store.exclusive('acks',tx=>tx.read());const n=f.ram.mode.opens;f.noResume();
 await assert.rejects(f.store.exclusive('acks',tx=>tx.read()),/UNKNOWN/);
 assert.equal(f.events.filter(x=>x==='NORMAL_SPOOL_ALLOCATE').length,1);assert.equal(f.ram.mode.opens,n);
});

test('한 거래에서 65번째 물리 frame을 발행하지 않고 예약을 보존한다',async()=>{
 const f=fixture(),port=f.runtime.credentialHost();await assert.rejects(f.store.exclusive('acks',async tx=>{
  await tx.read();const borrowed=await port.open(f.signal.signal,f.old);
  await borrowed.send('NORMAL_EXECUTION_BEGIN',{slotId:f.old.slotId,attemptId:id(1)});
  for(let i=0;i<64;i++)await borrowed.send('NORMAL_EXECUTION_WRITE',{});
 }));
 assert.equal(f.events.length,64);assert.equal(f.opens(),1);assert.equal(f.holds.size,1);
});


test('원 intake Options는 실제 RAM 보관 형상의 RECEIVED ref와 부분/전체 SHA로 재판독한다',async()=>{
 const f=fixture(),key={...scope,commandId:id(910)},bytes=Buffer.from('{"claudeQueryParams":{"model":"원 모델","maxBudgetUsd":0.125}}');
 const cuts=[0,17,bytes.length],parts=cuts.slice(1).map((end,i)=>({materialId:id(920+i),partIndex:i+1,byteOffset:cuts[i]!,utf8Bytes:end-cuts[i]!,contentHash:contentHash(bytes.subarray(cuts[i],end))}));
 const group={kind:'START_OPTIONS' as const,payloadRef:ref(930),sourceRef:ref(931),sourceBytes:bytes.length,contentHash:contentHash(bytes),mediaType:'application/json' as const,parts};
 const contextBytes=Buffer.from('{}'),contextPart={materialId:id(919),partIndex:1,byteOffset:0,utf8Bytes:contextBytes.length,contentHash:contentHash(contextBytes)};
 const descriptor={manifestRef:ref(938),groups:[{...group,kind:'CONTEXT_BUNDLE' as const,payloadRef:ref(939),sourceRef:ref(937),sourceBytes:contextBytes.length,contentHash:contentHash(contextBytes),parts:[contextPart]},group]};
 const entries:NormalStartEntry[]=[];const intake=f.store.intake();
 const add=(kind:'MATERIAL'|'RECEIVED',n:number,part:typeof parts[number]|null)=>{const snapshot={sequence:n,kind,key,envelopeHash:'2'.repeat(64),descriptorHash:contentHash(canonicalJson(descriptor)),materialId:part?.materialId??null,partContentHash:part?.contentHash??null,proofResultRef:ref(932),materials:kind==='RECEIVED'?descriptor:null,recordedAt:new Date(time).toISOString(),previousRef:entries.at(-1)?.ref??null};const entry={ref:{id:id(940+n),version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};entries.push(entry);return entry;};
 await intake.exclusive(key,async tx=>{await tx.read();await tx.appendAndSync(add('MATERIAL',1,contextPart),contextBytes);for(const [i,part] of parts.entries())await tx.appendAndSync(add('MATERIAL',i+2,part),bytes.subarray(cuts[i],cuts[i+1]));await tx.appendAndSync(add('RECEIVED',4,null),null);});
 const raw=[...f.ram.files.entries()].filter(([name])=>name.includes('intake-'+key.commandId)).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>JSON.parse(v.bytes.toString('utf8')));
 assert.equal(raw.length,4);assert.deepEqual(Object.keys(raw[0]).sort(),['bytes','entry']);assert.equal(raw[3].bytes,null);assert.deepEqual(raw[3].entry.ref,entries[3]!.ref);
 const received=await intake.exclusive(key,async tx=>{const saved=await tx.read();assert.equal(saved.complete,true);assert.deepEqual(saved.events.at(-1)?.ref,entries[3]!.ref);const received=[];for(const [i,part] of parts.entries())received.push({proofResultRef:ref(932),materialId:part.materialId,partIndex:i+1,bytes:await tx.readPart(entries[i+1]!.ref),observedAt:new Date(time).toISOString(),expiresAt:new Date(time+10000).toISOString()});return received;});
 assert.deepEqual(Buffer.from(assembleNormalStartMaterial(group,received).bytes),bytes);
 for(const bad of [{...group,sourceBytes:group.sourceBytes+1},{...group,contentHash:'0'.repeat(64)}])assert.throws(()=>assembleNormalStartMaterial(bad,received));
 const altered=received.map(r=>({...r,bytes:new Uint8Array(r.bytes)}));altered[0]!.bytes[0]=altered[0]!.bytes[0]!^1;assert.throws(()=>assembleNormalStartMaterial(group,altered));
 assert.equal(f.holds.size,0);
});

test('native FIRST Options 읽기는 원 ref·정착·파일 소유·전체 상한을 유지하고 부분 버퍼를 폐기한다',()=>{
 const source=readFileSync(new URL('../../../apps/connector/native/NormalExecutionSpoolProfileSource.cs',import.meta.url),'utf8');
 const start=source.indexOf('Row ReadSdkIntakeRow('),stop=source.indexOf('internal sealed class SdkStartOptions',start),parserStart=source.indexOf('sealed class SdkOptionsReader',stop),parserEnd=source.indexOf('static void RequireSdkFirst(',parserStart);
 assert(start>=0&&stop>start&&parserStart>stop&&parserEnd>parserStart);const read=source.slice(start,stop),parser=source.slice(parserStart,parserEnd);
 assert.match(read,/Unsettled\(rows\)[\s\S]*count<3\|\|count>201/);
 assert.match(read,/J\(entry\["ref"\]\)!=J\(receivedRef\)/);
 assert.match(read,/J\(group\["payloadRef"\]\)!=J\(payload\[g==0\?"contextBundleRef":"optionsRef"\]\)/);
 assert.match(read,/S\(reference,"contentHash"\)!=H\(snapshot\)/);
 assert.match(read,/J\(snapshot\["previousRef"\]\)!=J\(previous\)/);
 assert.match(read,/S\(snapshot,"envelopeHash"\)!=S\(envelope,"envelopeHash"\)/);
 assert.match(read,/N\(part\["byteOffset"\]\)!=offset/);
 assert.match(read,/FileIdentity\(file,path\)[\s\S]*length>3\*MiB/);
 assert.match(read,/bytes.LongLength!=N\(part\["utf8Bytes"\]\)[\s\S]*DesktopTrustKeyHostSource.Hash\(bytes\)!=S\(part,"contentHash"\)/);
 assert.match(read,/optionBytes>2\*MiB/);
 assert.match(read,/optionBytes!=N\(options\["sourceBytes"\]\)[\s\S]*S\(options,"contentHash"\)/);
 assert.equal((read.match(/finally\{Array.Clear\(bytes,0,bytes.Length\);\}/g)||[]).length,2);
 assert.equal((read.match(/Inspect\(rows,Normal,allocation,dir,channel,summary\)/g)||[]).length,2);
 assert.equal((read.match(/H\(descriptor\)/g)||[]).length,1);
 assert.doesNotMatch(read,/Append\(|Reserve\(|Allocate\(|FileMode.Create|WriteAll|Console\.|Process|plannedSid|claudeQueryParams/);
 assert.match(parser,/key!="claudeQueryParams"/);assert.match(parser,/!keys.Add\(key\)/);assert.match(parser,/key!="maxTurns"&&key!="maxBudgetUsd"/);assert.match(parser,/value>9007199254740991d/);assert.match(parser,/!keys.Contains\("model"\)/);assert.match(parser,/at!=text.Length/);
 assert.doesNotMatch(parser,/Append\(|Reserve\(|Allocate\(|FileMode.Create|WriteAll|Console\.|Process|plannedSid/);
});
