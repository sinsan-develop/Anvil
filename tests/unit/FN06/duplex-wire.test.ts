import assert from 'node:assert/strict';
import test from 'node:test';
import {getEventListeners} from 'node:events';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {Codex0161Codec} from '../../../apps/connector/adapters/primary/codec.ts';
import {SyntheticPrimaryStartTransport} from '../../../apps/connector/adapters/primary/start-transport.ts';

const modulePath='../../../apps/connector/adapters/primary/duplex-wire.ts';
const mod=await import(modulePath).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const frame=(value:unknown)=>Buffer.from(JSON.stringify(value)+'\n');
const request=(id:string|number)=>frame({method:'thread/start',params:{},id});
const response=(id:string|number)=>frame({id,result:{value:'관측'}});
const notice=frame({method:'thread/started',params:{text:'합성'}});
const signal=()=>new AbortController().signal;
type IO={write(b:Uint8Array,s:AbortSignal):Promise<number>;read(s:AbortSignal):Promise<Uint8Array|null>;close():void};
function channel(io:IO,maxFrameBytes=8192,timeoutMs=1000){
  assert.equal(typeof mod.SyntheticPrimaryDuplexWire,'function','bounded duplex controller missing');
  return new mod.SyntheticPrimaryDuplexWire(io,{maxFrameBytes,timeoutMs});
}
function endpoint(chunks:(Uint8Array|null)[],width=3){
  const written:Buffer[]=[]; let reads=0,closes=0;
  const io:IO={async write(b){const n=Math.min(width,b.length); written.push(Buffer.from(b.subarray(0,n)));return n;},
    async read(){reads++;return chunks.shift()??null;},close(){closes++;}};
  return {io,written,reads:()=>reads,closes:()=>closes};
}
test('부분 쓰기, UTF-8 분할, 응답 전후 알림 및 다음 exchange의 부분 꼬리를 유실하지 않는다',async()=>{
  const r1=response('가'),r2=response('나'),offset=notice.indexOf(Buffer.from('합성'))+1;
  const first=Buffer.concat([notice,r1,notice,notice.subarray(0,offset)]);
  const split=first.indexOf(Buffer.from('관측'))+1;
  const chunks=[first.subarray(0,split),first.subarray(split),Buffer.concat([notice.subarray(offset),r2])];
  const ep=endpoint([...chunks]);const wire=channel(ep.io);const q=request('가'),saved=Buffer.from(q);
  const out=await wire.exchange(q,signal());assert.deepEqual(Buffer.from(out),Buffer.concat([notice,r1,notice]));
  assert.equal(ep.reads(),2);assert.deepEqual(q,saved);assert.deepEqual(Buffer.concat(ep.written),q);
  out.fill(0);assert.deepEqual(Buffer.from(await wire.exchange(request('나'),signal())),Buffer.concat([notice,r2]));
  assert.equal(ep.reads(),3);wire.close();wire.close();assert.equal(ep.closes(),1);
});
test('사전 거부, 중복 ID 및 동시 요청은 진행 중 교환이나 다음 새 ID를 파괴하지 않는다',async()=>{
  let release!:()=>void;const wait=new Promise<void>(r=>release=r);const ep=endpoint([response(1),response('1')],999);
  const wire=channel({...ep.io,async read(s){await wait;return ep.io.read(s);}});
  await assert.rejects(wire.exchange(Buffer.from('invalid'),signal()));
  await assert.rejects(wire.exchange(request(1),AbortSignal.abort()));
  const pending=wire.exchange(request(1),signal());await assert.rejects(wire.exchange(request(2),signal()));
  release();await pending;await assert.rejects(wire.exchange(request(1),signal()));
  assert.deepEqual(Buffer.from(await wire.exchange(request('1'),signal())),response('1'));
  assert.equal(ep.written.length,2);wire.close();
});
for(const [name,data] of Object.entries({eof:null,partial:Buffer.from('{"id":'),wrong:response('wrong'),
  duplicate:Buffer.concat([response(1),response(1)]),invalidUtf8:Buffer.from([0xff,10]),
  large:Buffer.alloc(300,65),ambiguous:frame({id:1,result:{},error:{}})})){
  test('불명 후 모든 재전송 차단: '+name,async()=>{
    const ep=endpoint([data],999),wire=channel(ep.io,128);
    await assert.rejects(wire.exchange(request(1),signal()),/UNKNOWN/);
    await assert.rejects(wire.exchange(request(2),signal()));assert.equal(ep.written.length,1);assert.equal(ep.closes(),1);
  });
}
for(const phase of ['write','read'] as const)for(const stop of ['abort','close','deadline'] as const){
  test(phase+' 중 '+stop+' 및 지연 완료 뒤에도 새 I/O가 발생하지 않는다',async()=>{
    let started!:()=>void,late!:(v:any)=>void,calls=0,closes=0;
    const entering=new Promise<void>(r=>started=r);
    const stall=()=>new Promise<any>(resolve=>{started();late=resolve;});
    const io:IO={write:async b=>{calls++;return phase==='write'?stall():b.length;},read:async()=>{calls++;return stall();},close(){closes++;}};
    const w=channel(io,8192,stop==='deadline'?35:1000), c=new AbortController();
    const pending=w.exchange(request(1),c.signal);await entering;
    if(stop==='abort')c.abort();if(stop==='close')w.close();
    await assert.rejects(pending,/UNKNOWN/);const observed=calls;
    late(phase==='write'?1:response(1));await new Promise(r=>setImmediate(r));
    await assert.rejects(w.exchange(request(2),signal()));assert.equal(calls,observed);
    assert.equal(getEventListeners(c.signal,'abort').length,0);assert.equal(closes,1);
  });
}
for(const n of [0,-1,1.2,9999,'throw'])test('쓰기 반환 불명 '+n+' 재시도 0',async()=>{
  const ep=endpoint([]);let calls=0;const w=channel({...ep.io,write:async()=>{calls++;if(n==='throw')throw Error('PRIVATE');return Number(n);}});
  await assert.rejects(w.exchange(request(1),signal()),/^Error: PRIMARY_DUPLEX_UNKNOWN$/);
  await assert.rejects(w.exchange(request(1),signal()));assert.equal(calls,1);assert.equal(ep.closes(),1);
});
test('개별 프레임이 한도 안이어도 교환 누적 2MiB를 넘으면 부분 성공을 반환하지 않는다',async()=>{
  const limit=2*1024*1024;
  const largeNotice=frame({method:'observed',params:{text:'x'.repeat(1024*1024)}});
  const ep=endpoint([largeNotice,largeNotice,response(1)],100);
  const w=channel(ep.io,limit);
  await assert.rejects(w.exchange(request(1),signal()),/UNKNOWN/);
  assert.equal(ep.reads(),2);assert.equal(ep.closes(),1);
  assert.equal(largeNotice[0],123);assert.equal(largeNotice.at(-1),10);
  await assert.rejects(w.exchange(request(2),signal()));assert.equal(ep.written.length,1);
});
test('늦은 read reject는 관측하고 호출자와 I/O 소유 buffer는 변경하지 않는다',async()=>{
  const external=Buffer.from('소유자'),before=Buffer.from(external);
  let rejectLate!:(e:Error)=>void,ready!:()=>void;const entered=new Promise<void>(r=>ready=r);
  const ep=endpoint([]);const w=channel({...ep.io,read:async()=>{
    ready();return new Promise<Uint8Array>((_,reject)=>rejectLate=reject);
  }});
  const input=request('request'),snapshot=Buffer.from(input),c=new AbortController();
  const pending=w.exchange(input,c.signal);await entered;c.abort();
  await assert.rejects(pending,/UNKNOWN/);rejectLate(Error(external.toString()));
  await new Promise(r=>setImmediate(r));assert.deepEqual(input,snapshot);assert.deepEqual(external,before);
  assert.equal(ep.closes(),1);
});
test('이미 도착한 부분 응답으로 다음 요청의 응답을 위조할 수 없다',async()=>{
  const forged=response(2),ep=endpoint([Buffer.concat([response(1),forged.subarray(0,8)]),forged.subarray(8)],999);
  const w=channel(ep.io);assert.deepEqual(Buffer.from(await w.exchange(request(1),signal())),response(1));
  await assert.rejects(w.exchange(request(2),signal()),/UNKNOWN/);assert.equal(ep.closes(),1);
});
test('실제 START transport가 같은 wire를 소비하고 codec 응답 fact 하나만 journal에 기록한다',async()=>{
  const id=randomUUID(),hash=(v:unknown)=>contentHash(canonicalJson(v)),at=Date.UTC(2026,9,20);
  const ref={id,version:1,contentHash:'a'.repeat(64)},context={projectId:id,assignmentId:id,executionId:id,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}]};
  const unsigned={schemaVersion:1,commandId:id,issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+60000).toISOString(),executorRegistrationRef:ref,context,operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}};
  const envelope={...unsigned,envelopeHash:hash(unsigned)},key={projectId:id,executionId:id,executionGeneration:1,commandId:id};
  const bytes=frame({threadStartParams:{cwd:'C:/synthetic',sandbox:'read-only',approvalPolicy:'untrusted',ephemeral:true}});
  const source={transport:'SYNTHETIC_ONLY',key,envelopeHash:envelope.envelopeHash,contextBundleRef:ref,optionsRef:ref,materialReceiptRef:ref,utf8Bytes:bytes.length,contentHash:contentHash(bytes),bytes};
  const current={transport:'SYNTHETIC_ONLY',key,envelopeHash:envelope.envelopeHash,permitRef:ref,contextBundleRef:ref,optionsRef:ref,materialReceiptRef:ref,optionsContentHash:source.contentHash,grantRef:ref,ownershipRef:ref,checkedAt:new Date(at).toISOString(),expiresAt:new Date(at+30000).toISOString()};
  const thread={cliVersion:'0.161.0',createdAt:1,cwd:'C:/synthetic',ephemeral:true,id:'thread-private',modelProvider:'synthetic',preview:'',projectId:null,sessionId:'session-private',source:'appServer',status:{type:'idle'},turns:[],updatedAt:1};
  const result={approvalPolicy:'untrusted',approvalsReviewer:'user',cwd:'C:/synthetic',model:'synthetic',modelProvider:'synthetic',sandbox:{type:'readOnly'},thread};
  const ep=endpoint([frame({id:hash({key,envelopeHash:envelope.envelopeHash}),result})],11);const wire=channel(ep.io);
  const codec=new Codex0161Codec({maxFrameBytes:8192,maxPending:1});
  codec.encodeRequest('initialize','init',{clientInfo:{name:'synthetic',version:'1'}});
  codec.push(frame({id:'init',result:{codexHome:'C:/synthetic',platformFamily:'windows',platformOs:'windows',userAgent:'synthetic'}}));codec.encodeInitialized();
  const events:any[]=[];const transport=new SyntheticPrimaryStartTransport({transport:'SYNTHETIC_ONLY',exclusive:async(_scope,fn)=>fn({read:async()=>({complete:true,events}),appendAndSync:async entry=>{events.push(entry);}})},
    {transport:'SYNTHETIC_ONLY',read:async()=>source},{transport:'SYNTHETIC_ONLY',current:async()=>current},wire,codec,
    {context:context as any,envelopeExecutorRef:ref,grantRef:ref},{clock:()=>at,timeoutMs:1000});
  const receipt=await transport.send({envelope,permitRef:ref});assert.equal(receipt.transport,'SYNTHETIC_ONLY');
  assert.deepEqual(events.map(e=>e.snapshot.state),['START_ATTEMPTED','RESPONSE_RECORDED']);
  assert.equal(events[1].snapshot.responseFact.fact.method,'thread/start');assert.equal(events[1].snapshot.responseFact.fact.executionAuthorized,false);
  assert.doesNotMatch(JSON.stringify(events),/thread-private/);assert.equal(ep.reads(),1);wire.close();
});
