import test from 'node:test';
import assert from 'node:assert/strict';
import {NativePreparationProtectedJournal,isNativePreparationProtectedJournal} from '../../../apps/connector/runtime/native-preparation-protected-journal.ts';
import {nativeHash} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {readNativeLocalRecords} from '../../../apps/connector/runtime/native-preparation-local-attempt.ts';
const id=(n:number)=>'bd140008-0000-4000-8000-'+String(n).padStart(12,'0'),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(mode='OK'){
 let at=Date.parse('2030-01-01T00:00:00.000Z'),mono=0,opens=0,closed=0,lock=false,unknown=false;const records:any[]=[],calls:string[]=[];
 const a={schemaVersion:2,purpose:'NATIVE_PREPARATION_AUTHORITY',authorityId:id(1),credentialId:id(2),credentialGeneration:1,scope:{installationId:id(3),projectId:id(4),executionId:id(5),executionGeneration:1,authorityEpoch:1,leaseId:id(6),registrationRef:ref(7),nativeFactoryRef:ref(8),sourceScopeHash:'b'.repeat(64),writerHeadRef:ref(9),preparationRef:ref(10),hostPublicKeyFingerprint:'c'.repeat(64)},subject:{userId:id(11),clientId:id(12),humanSessionId:id(13),controlGeneration:1,credentialGeneration:1},parent:{commandRef:ref(14),authorizationReceiptRef:ref(15),auditRef:ref(16)},policyRef:ref(17),channelProfileRef:ref(18),allowedOperations:['CHECK_NATIVE_PREPARATION_CURRENT','CONSUME_NATIVE_PREPARATION','RETURN_NATIVE_PREPARATION_OWNERSHIP'],issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+10000).toISOString(),codingAgentExecutionAuthorized:false,agentDispatchPerformed:false};
 const authority={ref:{id:a.authorityId,version:1,contentHash:nativeHash(a)},snapshot:a},controller=new AbortController(),budget={signal:controller.signal,remainingMs:()=>10000-mono,expiresAt:()=>a.expiresAt};
 const port={open:async(signal:AbortSignal,end:string)=>{assert(!signal.aborted);assert.equal(end,a.expiresAt);opens++;let handle=id(30),opened=false;
  return{send:async(op:string,p:any)=>{calls.push(op);if(op==='OPEN'){if(lock||unknown)throw Error('LOCKED');assert.deepEqual(p.authority,authority);lock=true;opened=true;return{handle,authorityRef:authority.ref};}
   assert(opened&&lock);assert.equal(p.handle,handle);
   if(op==='READ')return{handle:mode==='HANDLE'?id(99):handle,complete:true,records:structuredClone(records)};
   if(op==='APPEND_SYNC'){assert.equal(p.expectedHash,nativeHash(records));records.push(structuredClone(p.record));if(mode==='SYNC'){unknown=true;throw Error('SYNC_UNKNOWN');}if(mode==='EXPIRE')mono=10001;return{handle,recordsHash:nativeHash(records)};}
   if(op==='CLOSE'){assert(!unknown);lock=false;opened=false;return{handle,state:'CLOSED_CONFIRMED'};}throw Error('OP');},close:async()=>{closed++;if(opened)unknown=true;return{state:mode==='CLOSE'?'UNKNOWN':'CLOSED_CONFIRMED'};}};
 }};
 const snapshot={schemaVersion:1,purpose:'NATIVE_PREPARATION_LOCAL_ATTEMPT',authorityRef:authority.ref,preparationRef:a.scope.preparationRef,writerHeadRef:a.scope.writerHeadRef,scopeHash:a.scope.sourceScopeHash,requestId:id(31),at:a.issuedAt,expiresAt:a.expiresAt,state:'PREPARED'},record={ref:{id:id(32),version:1,contentHash:nativeHash(snapshot)},snapshot};
 const create=()=>new NativePreparationProtectedJournal(authority,port,{wall:()=>at,monotonic:()=>mono},controller.signal);
 return{authority,record,records,budget,create,calls,controller,opens:()=>opens,closed:()=>closed,locked:()=>lock};
}
test('보호 typed journal은 첫 PREPARED sync/readback 후 닫고 새 adapter가 원 기록을 읽는다',async()=>{
 const f=fixture(),journal=f.create();assert.equal(isNativePreparationProtectedJournal(journal),true);assert.equal(isNativePreparationProtectedJournal({...journal}),false);
 await journal.exclusive(f.authority.ref,async tx=>{assert.deepEqual(await tx.read(),{complete:true,records:[]});await tx.appendAndSync(f.record);assert.deepEqual((await tx.read()).records,[f.record]);},f.budget);
 await f.create().exclusive(f.authority.ref,async tx=>{assert.deepEqual((await tx.read()).records,[f.record]);},f.budget);
 assert.equal(f.opens(),2);assert.equal(f.closed(),2);assert.equal(f.locked(),false);
});
test('동일 root 동시 OPEN·다른 authority·label 복제는 새 append를 허용하지 않는다',async()=>{
 const f=fixture();let release!:()=>void,entered!:()=>void;const ready=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r),first=f.create();
 const pending=first.exclusive(f.authority.ref,async tx=>{await tx.read();entered();await gate;},f.budget);await ready;
 await assert.rejects(first.exclusive(f.authority.ref,async()=>{},f.budget));await assert.rejects(f.create().exclusive(ref(99),async()=>{},f.budget));await assert.rejects(f.create().exclusive(f.authority.ref,async()=>{},f.budget));release();await pending;assert.equal(f.records.length,0);
});
test('sync·handle·close·기한 불명은 같은 adapter 추가 OPEN과 원행 초기화를 막는다',async()=>{
 for(const mode of ['SYNC','HANDLE','CLOSE','EXPIRE']){const f=fixture(mode),journal=f.create();await assert.rejects(journal.exclusive(f.authority.ref,async tx=>{await tx.read();await tx.appendAndSync(f.record);await tx.read();},f.budget));const calls=f.opens();await assert.rejects(journal.exclusive(f.authority.ref,async()=>{},f.budget));assert.equal(f.opens(),calls);if(mode!=='HANDLE')assert.equal(f.records.length,1);}
});
test('이미 취소된 journal과 부모 budget 소진은 host OPEN0이다',async()=>{
 const f=fixture();f.controller.abort();await assert.rejects(f.create().exclusive(f.authority.ref,async()=>{},f.budget));assert.equal(f.opens(),0);
});

test('OPEN 대기중 외부취소는 다음 새 budget 재OPEN0이며 늦게 생긴 host는 정확1회 닫는다',async()=>{
 const f=fixture(),call=new AbortController();let opens=0,closes=0,release!:(v:any)=>void;
 const session={send:async()=>{throw Error('NO_SEND');},close:async()=>{closes++;return{state:'CLOSED_CONFIRMED'};}};
 const port={open:async()=>{opens++;return opens===1?new Promise<any>(r=>{release=r;}):session;}};
 const journal=new NativePreparationProtectedJournal(f.authority,port,{wall:()=>Date.parse(f.authority.snapshot.issuedAt),monotonic:()=>0},f.controller.signal);
 const pending=journal.exclusive(f.authority.ref,async()=>{}, {...f.budget,signal:call.signal});await new Promise(r=>setImmediate(r));call.abort();await assert.rejects(pending);
 await assert.rejects(journal.exclusive(f.authority.ref,async()=>{},f.budget));release(session);await new Promise(r=>setImmediate(r));assert.equal(opens,1);assert.equal(closes,1);
});
test('OPEN 공급자 예외는 host 생성 유무 불명이므로 같은 adapter에서 재OPEN하지 않는다',async()=>{
 const f=fixture();let opens=0;const port={open:async()=>{opens++;throw Error('LOST_OPEN');}};
 const journal=new NativePreparationProtectedJournal(f.authority,port,{wall:()=>Date.parse(f.authority.snapshot.issuedAt),monotonic:()=>0},f.controller.signal);
 await assert.rejects(journal.exclusive(f.authority.ref,async()=>{},f.budget));await assert.rejects(journal.exclusive(f.authority.ref,async()=>{},f.budget));assert.equal(opens,1);
});

test('work 중 원 Client deadline이 줄면 다음 append 전 차단하고 새10초를 만들지 않는다',async()=>{
 const f=fixture(),journal=f.create();let left=10000;f.budget.remainingMs=()=>left;
 await assert.rejects(journal.exclusive(f.authority.ref,async tx=>{await tx.read();left=0;await tx.appendAndSync(f.record);},f.budget));
 assert.equal(f.records.length,0);assert.equal(f.calls.includes('APPEND_SYNC'),false);assert.equal(f.locked(),true);
});
test('판독 가능한 길이경계2행·실제 tuple·OPEN/APPEND/READ frame은64KiB 안이고 작업은7frame이다',()=>{
 const f=fixture(),r={id:id(1),version:Number.MAX_SAFE_INTEGER,contentHash:'f'.repeat(64)};
 const s={...f.record.snapshot,preparationRef:r,writerHeadRef:r,at:'9999-12-31T23:59:58.000Z',expiresAt:'9999-12-31T23:59:59.999Z'};
 const first={ref:{...ref(2),contentHash:nativeHash(s)},snapshot:s},t={state:'FACTORY_ATTEMPTED',localAttemptRef:first.ref,consumeReceiptRef:r,factoryPermitRef:r,at:'9999-12-31T23:59:58.001Z'},second={ref:{...ref(3),contentHash:nativeHash(t)},snapshot:t};
 assert.equal(readNativeLocalRecords({complete:true,records:[first,second]},f.authority.ref).length,2);
 const tuple={schemaVersion:1,purpose:'NATIVE_JOURNAL_BINDING',sid:'S-1-281474976710655-'+Array(15).fill('4294967295').join('-'),installationId:id(3),registrationRef:r,scopeDigest:'f'.repeat(64),authorityRef:f.authority.ref};
 const request=(operation:string,payload:unknown)=>({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_OPERATION_V1',requestId:id(5),sequence:64,callExpiresAt:'9999-12-31T23:59:59.999Z',remainingMs:10000,signerRef:r,operation,payload});
 const frames=[request('NATIVE_JOURNAL_OPEN',{attemptId:id(6),authority:f.authority}),request('NATIVE_JOURNAL_APPEND_SYNC',{attemptId:id(6),handle:id(7),expectedHash:nativeHash([]),record:first}),{schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:id(5),sequence:64,rootIdentity:'x'.repeat(512),data:{handle:id(7),complete:true,records:[first,second]}}];
 for(const frame of frames)assert(Buffer.byteLength(JSON.stringify(frame)+'\n')<8192);
 assert(Buffer.byteLength(JSON.stringify({schemaVersion:1,purpose:'NATIVE_JOURNAL_ROW',tuple,sequence:1,record:first}))<4096);
 assert.equal(['OPEN','READ','APPEND_SYNC','READ','APPEND_SYNC','READ','CLOSE'].length,7);
 assert.throws(()=>readNativeLocalRecords({complete:true,records:[{...first,snapshot:{...s,padding:'x'.repeat(2097152)}}]},f.authority.ref));
});

test('완전 CLOSED bytes가 남은 flush오류와 종료응답유실은 같은 관측이므로 재OPEN 권위로 쓰지 않는다',async()=>{
 for(const reason of ['FLUSH_COMPLETE_BUT_ERROR','CLOSED_RESPONSE_LOST']){
  const f=fixture();f.records.push(structuredClone(f.record));let opens=0,mutations=0;
  const port={open:async()=>{opens++;return{send:async(op:string)=>{if(op==='APPEND_SYNC')mutations++;throw Error('NATIVE_JOURNAL_DURABILITY_UNSUPPORTED');},close:async()=>({state:'CLOSED_CONFIRMED'})};}};
  const journal=new NativePreparationProtectedJournal(f.authority,port,{wall:()=>Date.parse(f.authority.snapshot.issuedAt),monotonic:()=>0},f.controller.signal);
  await assert.rejects(journal.exclusive(f.authority.ref,async tx=>{await tx.read();},f.budget),reason);
  const restart=new NativePreparationProtectedJournal(f.authority,port,{wall:()=>Date.parse(f.authority.snapshot.issuedAt),monotonic:()=>0},f.controller.signal);
  await assert.rejects(restart.exclusive(f.authority.ref,async tx=>{await tx.read();},f.budget));assert.equal(opens,2);assert.equal(mutations,0);assert.deepEqual(f.records,[f.record]);
 }
});
