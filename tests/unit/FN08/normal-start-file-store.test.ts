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
