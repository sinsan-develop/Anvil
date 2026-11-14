import test from 'node:test';
import assert from 'node:assert/strict';
import {NormalStartFileStore} from '../../../apps/connector/runtime/normal-start-file-store.ts';
import {root,memoryFiles,scope} from './normal-start-local-fixture.ts';
test('normal file store는 sync 후 재열기하고 caller bytes를 변경하지 않는다',async()=>{
 const f=memoryFiles(),store=new NormalStartFileStore(root,scope,f.fs),value={x:'한글'};
 await store.exclusive('observations',async tx=>{assert.deepEqual(await tx.read(),[]);await tx.appendAndSync(value);});
 assert.equal(f.mode.syncs,1);assert.equal([...f.files.keys()].some(p=>p.endsWith('.lock')),false);
 await new NormalStartFileStore(root,scope,f.fs).exclusive('observations',async tx=>assert.deepEqual(await tx.read(),[value]));
 assert.deepEqual(value,{x:'한글'});
});
test('부분 sync·남은 lock·root link는 닫고 다른 journal을 손대지 않는다',async()=>{
 for(const kind of ['sync','partial','link']){
  const f=memoryFiles(),store=new NormalStartFileStore(root,scope,f.fs);
  if(kind==='sync')f.mode.failSync=true;if(kind==='partial')f.mode.partial=true;if(kind==='link')f.mode.rootLink=true;
  await assert.rejects(store.exclusive('observations',async tx=>{await tx.read();await tx.appendAndSync({value:1});}));
  if(kind!=='link'){assert([...f.files.keys()].some(p=>p.endsWith('.lock')));await assert.rejects(store.exclusive('observations',async()=>0),/BUSY/);}
 }
});
test('완료 뒤 보관한 transaction·다른 scope intake·비정규 channel 거절',async()=>{
 const f=memoryFiles(),store=new NormalStartFileStore(root,scope,f.fs);let saved:any;
 await store.exclusive('observations',async tx=>{saved=tx;await tx.read();});await assert.rejects(saved.read());
 await assert.rejects(store.exclusive('../outside',async()=>0));
 await assert.rejects(store.intake().exclusive({...scope,executionGeneration:2,commandId:scope.executionId},async()=>0));assert.equal(f.files.size,0);
});

for(const method of ['instructionIntake','instructionAttempts'] as const)test('SEND '+method+'는 원 root scope 외 입력을 쓰기 전에 거절한다',async()=>{
 const f=memoryFiles(),store=new NormalStartFileStore(root,scope,f.fs);
 await assert.rejects(store[method]().exclusive({...scope,executionGeneration:2,commandId:scope.executionId},async()=>0));assert.equal(f.files.size,0);
});

test('SEND typed 채널 close 불명은 원 lock을 보존하고 새 store 진입을 막는다',async()=>{
 const f=memoryFiles(),open=f.fs.open,store=new NormalStartFileStore(root,scope,f.fs),key={...scope,commandId:scope.executionId};
 let closes=0;f.fs.open=async(path:string,flag:any)=>{const h=await open(path,flag);if(path.endsWith('.lock'))h.close=async()=>{closes++;throw Error('RAM_CLOSE_UNKNOWN');};return h;};
 await assert.rejects(store.instructionAttempts().exclusive(key,async tx=>{await tx.read();await tx.appendAndSync({original:true});}),/NORMAL_LOCAL_STORAGE_UNAVAILABLE/);
 assert(f.files.has(f.path('attempt-'+key.commandId+'.lock')));
 await assert.rejects(new NormalStartFileStore(root,scope,f.fs).instructionAttempts().exclusive(key,async()=>0),/NORMAL_LOCAL_BUSY/);assert.equal(closes,1);
});


test('STOP 전용 attempt는 root scope를 검산하고 정상 body 뒤 CLOSE 불명도 반환하지 않는다',async()=>{
 const f=memoryFiles(),open=f.fs.open,store=new NormalStartFileStore(root,scope,f.fs),key={...scope,commandId:scope.executionId};let closes=0;
 await assert.rejects(store.stopAttempts().exclusive({...key,executionGeneration:2},async()=>0));assert.equal(f.files.size,0);
 f.fs.open=async(path:string,flag:any)=>{const h=await open(path,flag);if(path.endsWith('.lock'))h.close=async()=>{closes++;throw Error('RAM_STOP_CLOSE_UNKNOWN');};return h;};
 await assert.rejects(store.stopAttempts().exclusive(key,async tx=>{await tx.read();return 'HISTORY';}),/NORMAL_LOCAL_STORAGE_UNAVAILABLE/);
 assert(f.files.has(f.path('attempt-'+key.commandId+'.lock')));await assert.rejects(new NormalStartFileStore(root,scope,f.fs).stopAttempts().exclusive(key,async()=>0),/NORMAL_LOCAL_BUSY/);assert.equal(closes,1);
});
