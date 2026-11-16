'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {MessageChannel,Worker,workerData,parentPort}=require('node:worker_threads');
const {once}=require('node:events');
const {createChildStreams,createSynchronousSpawn}=require('../../apps/desktop/src/normal-sdk-child-bridge.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
if(workerData?.fixture==='RAM_STDIO'){
  const {control,data,mode}=workerData;
  const life=new AbortController(),span=mode==='EXPIRE'?100:2000;
  const spec={command:'ram-image',args:['--test'],cwd:'ram-root',env:{TEST_MARK:'fixture-only'},signal:life.signal};
  let getters=0;
  if(mode==='ACCESSOR')Object.defineProperty(spec.env,'TEST_MARK',{enumerable:true,get(){getters++;return 'invalid';}});
  if(mode==='SIGNAL_PROXY')spec.signal=new Proxy(spec.signal,{getPrototypeOf(){getters++;throw Error('trap');}});
  if(mode==='SIGNAL_GETTER')Object.defineProperty(spec.signal,'aborted',{get(){getters++;throw Error('getter');}});
  const originalLife=mode==='LIFETIME_PROXY'?new Proxy(life.signal,{get(){getters++;throw Error('trap');}}):life.signal;
  if(mode==='LIFETIME_LISTENER')Object.defineProperty(originalLife,'addEventListener',{get(){getters++;throw Error('getter');}});
  try{
    const spawn=createSynchronousSpawn(control,data,originalLife,Date.now()+span,performance.now()+span);
    const child=spawn(spec);
    assert.throws(()=>spawn(spec),/SDK_CHILD_UNKNOWN/);
    parentPort.postMessage({result:'STREAM',sync:!Object.hasOwn(child,'then')&&typeof child.stdin.write==='function',
      killed:child.killed,getters});
    life.abort();
  }catch(error){parentPort.postMessage({result:error.message,getters});}
  finally{control.close();data.close();parentPort.close();}
}else{
test('격리 RAM worker의 동기 hook은 원 기한 안에서만 원 제어 응답을 소비하고 입력 원문을 전달하지 않는다',async()=>{
  for(const mode of ['READY','EXPIRE','ACCESSOR','SIGNAL_PROXY','SIGNAL_GETTER','LIFETIME_PROXY','LIFETIME_LISTENER']){
    const control=new MessageChannel(),data=new MessageChannel();
    const seen=[];
    control.port1.on('message',frame=>{
      seen.push(frame);
      if(mode==='READY'&&frame.op==='SPAWN'){
        const state=new Int32Array(frame.cell);Atomics.compareExchange(state,0,0,1);Atomics.notify(state,0);
      }
    });
    const worker=new Worker(__filename,{workerData:{fixture:'RAM_STDIO',mode,control:control.port2,data:data.port2},transferList:[control.port2,data.port2]});
    try{
      const[result,exit]=await Promise.all([once(worker,'message'),once(worker,'exit')]);
      assert.deepEqual(exit,[0]);const [observed]=result;
      assert.equal(observed.getters,0);
      if(mode==='READY')assert.deepEqual(observed,{result:'STREAM',sync:true,killed:false,getters:0});
      else assert.equal(observed.result,'SDK_CHILD_UNKNOWN');
      const posted=mode==='READY'||mode==='EXPIRE';
      assert.equal(seen.filter(x=>x.op==='SPAWN').length,posted?1:0);
      if(posted){
        assert.match(seen[0].payload,/^[a-f0-9]{64}$/);
        assert.deepEqual(Object.keys(seen[0]).sort(),['cell','op','payload']);
        if(mode==='EXPIRE')assert.equal(Atomics.load(new Int32Array(seen[0].cell),0),-1);
      }
      assert.equal(seen.filter(x=>x.op==='ABANDON').length,posted?1:0);
    }finally{control.port1.close();data.port1.close();}
  }
});
test('stdout credit 한 건을 사용한 뒤 읽기 전에는 다음 DATA를 수락하지 않는다',async()=>{
  const {port1,port2}=new MessageChannel();const abort=new AbortController();
  const child=createChildStreams(port1,abort.signal,()=>true);
  const frames=[];port2.on('message',m=>frames.push(m.op));
  try{
    const issued=once(port2,'message');child.stdout.read(0);
    assert.equal((await issued)[0].op,'STDOUT_CREDIT');
    const readable=once(child.stdout,'readable');
    port2.postMessage({op:'STDOUT',seq:1,bytes:new Uint8Array([1])});
    await readable;await tick();await tick();
    const closed=once(port2,'close');
    port2.postMessage({op:'STDOUT',seq:2,bytes:new Uint8Array([2])});
    await Promise.race([closed,new Promise((_,reject)=>setTimeout(()=>reject(Error('second DATA accepted')),50))]);
    assert.deepEqual(frames,['STDOUT_CREDIT','ABANDON']);
  }finally{abort.abort();port1.close();port2.close();}
});
test('쓰기 한도는 ACK 대기 중 false를 무시해도 추가 DATA를 보내지 않고 각 callback을 한 번 종결한다',async()=>{
  const {port1,port2}=new MessageChannel();
  const abort=new AbortController();
  const child=createChildStreams(port1,abort.signal,()=>true);
  const frames=[];
  port2.on('message',m=>frames.push(m));
  const seen=[];
  try {
    const first=once(port2,'message');
    assert.equal(child.stdin.write(Buffer.alloc(1048576),err=>seen.push(['a',!!err])),false);
    const [data]=await first;
    assert.equal(data.op,'STDIN');
    assert.equal(data.bytes.byteLength,65536);
    assert.equal(child.stdin.write(Buffer.alloc(1048576),err=>seen.push(['b',!!err])),false);
    child.stdin.write('x',err=>seen.push(['c',!!err]));
    await tick();
    port2.postMessage({op:'STDIN_ACK',seq:data.seq});
    await tick();await tick();
    assert.deepEqual(seen.sort(),[['a',true],['b',true],['c',true]]);
    assert.equal(frames.filter(x=>x.op==='STDIN').length,1);
  } finally {abort.abort();port1.close();port2.close();}
});
test('동기 hook stdin의 분할·ACK 순서와 마지막 callback 1회',async()=>{
  const {port1,port2}=new MessageChannel();const abort=new AbortController();
  const child=createChildStreams(port1,abort.signal,()=>true);
  const chunks=[];let called=0;
  port2.on('message',m=>{if(m.op==='STDIN'){chunks.push(m.bytes.length);port2.postMessage({op:'STDIN_ACK',seq:m.seq});}});
  try{await new Promise((resolve,reject)=>child.stdin.write(Buffer.alloc(65537),err=>{called++;err?reject(err):resolve();}));
    assert.deepEqual(chunks,[65536,1]);assert.equal(called,1);
  }finally{abort.abort();port1.close();port2.close();}
});
test('취소 후 이미 수락된 write 두 개의 오류·늦은 ACK와 ABANDON 단발',async()=>{
  const {port1,port2}=new MessageChannel();const abort=new AbortController();
  const child=createChildStreams(port1,abort.signal,()=>true);
  const seen=[],frames=[];port2.on('message',m=>frames.push(m.op));
  try {
    const first=once(port2,'message');
    child.stdin.write('a',e=>seen.push(['a',!!e]));child.stdin.write('b',e=>seen.push(['b',!!e]));
    const [m]=await first;abort.abort();port2.postMessage({op:'STDIN_ACK',seq:m.seq});
    await once(port2,'close');await tick();
    assert.deepEqual(seen,[['a',true],['b',true]]);assert.deepEqual(frames,['STDIN','ABANDON']);
  }finally{port1.close();port2.close();}
});
test('읽지 않은 stdout에 보낸 DATA 또는 EOF 전 EXIT는 원 세션 불명',async()=>{
  for(const frame of [{op:'STDOUT',seq:1,bytes:new Uint8Array([1])},{op:'EXIT',code:0}]){
    const {port1,port2}=new MessageChannel();const abort=new AbortController();
    const child=createChildStreams(port1,abort.signal,()=>true);
    let exits=0;child.on('exit',()=>exits++);const failure=once(port2,'message');
    try{port2.postMessage(frame);assert.equal((await failure)[0].op,'ABANDON');
      assert.equal(child.exitCode,null);assert.equal(exits,0);}
    finally{abort.abort();port1.close();port2.close();}
  }
});
test('EOF 후 실제 EXIT만 종료 관측을 반환하며 stdin.end 완료는 종료 관측을 만들지 않는다',async()=>{
  const {port1,port2}=new MessageChannel();const abort=new AbortController();
  const child=createChildStreams(port1,abort.signal,()=>true);
  try{
    await new Promise(resolve=>child.stdin.end(resolve));assert.equal(child.exitCode,null);
    const received=new Promise(resolve=>child.once('exit',resolve));
    port2.postMessage({op:'STDOUT_EOF',seq:0});port2.postMessage({op:'EXIT',code:7});
    assert.equal(await received,7);assert.equal(child.exitCode,7);
  }finally{abort.abort();port1.close();port2.close();}
});
test('kill은 정확 boolean만 수락하고 비정상 반환·peer 소실은 해당 세션 불명',async()=>{
  for(const reply of [Promise.resolve(true),{},1]){
    const {port1,port2}=new MessageChannel();const abort=new AbortController();
    const child=createChildStreams(port1,abort.signal,()=>reply);
    try{assert.equal(child.kill(),false);assert.equal(child.killed,false);}
    finally{abort.abort();port1.close();port2.close();}
  }
});
test('상대 포트가 닫히면 미확인 write와 자식 error가 각각 한 번만 관측된다',async()=>{
  const {port1,port2}=new MessageChannel();const abort=new AbortController();
  const child=createChildStreams(port1,abort.signal,()=>true);
  let errors=0,calls=0;
  child.on('error',()=>errors++);
  const data=once(port2,'message');
  const written=new Promise(resolve=>child.stdin.write('payload',e=>{calls++;resolve(e);}));
  try{
    assert.equal((await data)[0].op,'STDIN');port2.close();
    assert.match((await written).message,/SDK_CHILD_UNKNOWN/);abort.abort();await tick();
    assert.equal(calls,1);assert.equal(errors,1);assert.equal(child.exitCode,null);
  }finally{abort.abort();port1.close();port2.close();}
});
test('stdout을 소비한 뒤에만 다음 credit을 내며 pipe EOF는 단독 exit를 만들지 않는다',async()=>{
  const {port1,port2}=new MessageChannel();const abort=new AbortController();
  const child=createChildStreams(port1,abort.signal,()=>true);
  const issued=[];port2.on('message',m=>issued.push(m));
  try{
    const first=once(port2,'message');child.stdout.read(0);await first;
    const ready=once(child.stdout,'readable');port2.postMessage({op:'STDOUT',seq:1,bytes:new Uint8Array([1,2])});
    await ready;await tick();assert.equal(issued.length,1);
    assert.deepEqual(child.stdout.read(1),Buffer.from([1]));await tick();assert.equal(issued.length,1);
    const next=once(port2,'message');assert.deepEqual(child.stdout.read(1),Buffer.from([2]));
    assert.deepEqual((await next)[0],{op:'STDOUT_CREDIT',seq:2});
    port2.postMessage({op:'STDOUT_EOF',seq:1});await tick();assert.equal(child.exitCode,null);
  }finally{abort.abort();port1.close();port2.close();}
});
test('입력 TypedArray 크기·복사는 원 내부 길이를 따르고 Proxy와 자체 속성을 호출하지 않는다',async()=>{
  for(const mode of ['ZERO_PROPERTY','LARGE','VALID','PROXY']){
    const {port1,port2}=new MessageChannel(),life=new AbortController();
    const child=createChildStreams(port1,life.signal,()=>true);
    let traps=0,calls=0;
    const a=new Uint8Array(mode==='LARGE'||mode==='ZERO_PROPERTY'?2097153:3).fill(7);
    if(mode==='ZERO_PROPERTY')Object.defineProperty(a,'byteLength',{value:0});
    else{
      Object.defineProperty(a,'byteLength',{get(){traps++;return 0;}});
      for(const key of ['buffer','length','constructor','byteOffset'])
        Object.defineProperty(a,key,{get(){traps++;throw Error(key);}});
    }
    const data=mode==='PROXY'?new Proxy(a,{getPrototypeOf(){traps++;throw Error('trap');},get(){traps++;throw Error('trap');}}):a;
    try{
      const first=once(port2,'message');
      const written=new Promise(resolve=>child.stdin.write(data,e=>{calls++;resolve(e);}));
      const [frame]=await first;
      assert.equal(traps,0);
      if(mode==='VALID'){
        assert.deepEqual(frame.bytes,new Uint8Array([7,7,7]));
        port2.postMessage({op:'STDIN_ACK',seq:frame.seq});assert.ifError(await written);
      }else{assert.equal(frame.op,'ABANDON');assert.match((await written).message,/SDK_CHILD_UNKNOWN/);}
      assert.equal(calls,1);
    }finally{life.abort();port1.close();port2.close();}
  }
});
test('stdio DATA는 exact backing을 한 frame씩 전송하고 역방향 초과 backing을 거절한다',async()=>{
  const {port1,port2}=new MessageChannel(),life=new AbortController();
  const child=createChildStreams(port1,life.signal,()=>true);
  try{
    const one=once(port2,'message');child.stdin.write(Buffer.alloc(131073,99));
    const [frame]=await one;
    assert.equal(frame.bytes.byteOffset,0);assert.equal(frame.bytes.byteLength,65536);
    assert.equal(frame.bytes.buffer.byteLength,frame.bytes.byteLength);
    const credit=once(port2,'message');child.stdout.read(0);await credit;
    const invalid=new Uint8Array(131073).subarray(5,6);
    const error=new Promise(resolve=>child.once('error',resolve));
    port2.postMessage({op:'STDOUT',seq:1,bytes:invalid});
    await Promise.race([error,new Promise((_,reject)=>setTimeout(()=>reject(Error('unexpected stdout accepted')),200))]);
    assert.equal(child.stdout.readableLength,0);
  }finally{life.abort();port1.close();port2.close();}
});
test('초기 signal의 Proxy·aborted 및 두 listener accessor는 효과 전 호출 없이 거절한다',()=>{
  for(const mode of ['PROXY','aborted','addEventListener','removeEventListener','NO_SLOT']){
    const {port1,port2}=new MessageChannel();let hits=0;
    const {signal}=new AbortController();
    const provided=mode==='PROXY'?new Proxy(signal,{get(){hits++;throw Error('trap');}}):
      mode==='NO_SLOT'?Object.create(AbortSignal.prototype):
      Object.defineProperty(signal,mode,{get(){hits++;throw Error('getter');}});
    try{assert.throws(()=>createChildStreams(port1,provided,()=>true),/SDK_CHILD_UNKNOWN/);assert.equal(hits,0);}
    finally{port1.close();port2.close();}
  }
});
}
