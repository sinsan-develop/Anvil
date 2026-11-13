'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
// 기존 실제 등록 owner/host-client fixture만 메모리 재사용. 기존 test는 등록/실행하지 않는다.
let fixtures;
test.before(async()=>{
 const file=require.resolve('./desktop-trust-registration.test.cjs'),m=new Module(file,module),before=[];
 const register=()=>{};register.before=fn=>before.push(fn);const original=Module.createRequire(file);
 m.filename=file;m.paths=module.paths;m.require=name=>name==='node:test'?register:original(name);
 m._compile(fs.readFileSync(file,'utf8')+'\nmodule.exports={liveNativeOwner,enrollmentFixture};',file);
 assert.equal(before.length,1);await before[0]();fixtures=m.exports;
});
const id=n=>'ce140001-0000-4000-8000-'+String(n).padStart(12,'0'),ref=n=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function model(f,mode='NORMAL'){
 const row=f.stored(),scope={projectId:row.projectId,connectorId:row.registration.connectorRef.id,executionId:id(1),executionGeneration:1,grantRef:ref(2),credentialGeneration:1};
 const config={origin:row.origin,ca:'TEST_ONLY_EXPLICIT_CA',scope},expiresAt=new Date(f.dependencies.now()+5000).toISOString(),calls=[],spawn=f.ports.spawn;
 let metadata,reply,offset=0;
 const chunk=()=>{const part=reply.subarray(offset,offset+48000),start=offset;offset+=part.length;return{handle:id(7),offset:start,total:reply.length,hash:contentHash(reply),expiresAt,bytes:part.toString('base64url'),done:offset===reply.length};};
 f.ports.spawn=(...args)=>{const child=spawn(...args),write=child.stdin.write;child.stdin.write=(raw,encoding,done)=>{
  const v=JSON.parse(Buffer.from(raw).toString());if(!v.operation.startsWith('NORMAL_EXECUTION_'))return write(raw,encoding,done);
  assert.ok(Buffer.byteLength(raw)<=65536);assert.equal(v.sequence,calls.filter(x=>x.child===child).length+4);calls.push({...v,child});
  queueMicrotask(()=>{let data;
   if(v.operation==='NORMAL_EXECUTION_BOOTSTRAP'){assert.equal(v.payload.attemptId,row.attemptId);assert.deepEqual(v.payload.scope,scope);metadata={slotId:id(3),receiptRef:ref(4),origin:row.origin,scope,expiresAt,caHash:contentHash(config.ca)};data=metadata;}
   else if(v.operation==='NORMAL_EXECUTION_CALL'){assert.equal(v.payload.attemptId,row.attemptId);assert.equal(v.payload.slotId,metadata.slotId);const r=v.payload.request;reply=Buffer.from(canonicalJson(v.payload.kind==='PREPARE'?{path:r.path,query:r.query,auth:'A'.repeat(20),challengeRef:ref(5),requestId:id(6),expiresAt}:mode==='MAX'?{value:'x'.repeat(2812587-12)}:{commands:[]}));offset=0;data=chunk();}
   else if(v.operation==='NORMAL_EXECUTION_READ'){assert.equal(v.payload.handle,id(7));assert.equal(v.payload.offset,offset);data=chunk();}
   else throw Error('UNEXPECTED_NORMAL_OPERATION');
   child.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:v.requestId,sequence:v.sequence,rootIdentity:mode==='ROOT'?'OTHER_ROOT':'TEST_ONLY_ROOT',data})+'\n'));done();
  });return true;
 };if(mode==='CLOSE'){child.stdin.end=(_a,_b,done)=>{queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',1);done?.();});};}return child;};
 return{config,calls,expiresAt,request:{method:'GET',path:'/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands',query:'',body:null,expiresAt}};
}
test('REGISTERED 실제 owner→bundle bootstrap→제한 host client, 매 작업 새 lease/root 검산',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f),before=f.calls(),client=f.owner.createNormalCredentialBootstrap(m.config);
 const port=await client.bootstrap(new AbortController().signal);
 assert.equal(f.calls(),before+1);assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
 assert.equal('credential' in port.metadata,false);assert.equal(typeof port.send,'undefined');assert.equal(typeof port.sign,'undefined');
 const prepared=await port.prepare(m.request,new AbortController().signal);
 assert.deepEqual(await port.request({...m.request,auth:prepared.auth},new AbortController().signal),{commands:[]});
 assert.equal(f.calls(),before+3);assert.equal(f.ends(),f.calls());assert.equal(f.timers(),0);
 assert.equal(m.calls.length,3);assert.equal(f.stored().state,'REGISTERED');
 for(const c of m.calls)assert.ok(c.sequence<=64);
});
test('미등록/다른 scope·origin·caller attempt는 host0 거절',async()=>{
 const empty=fixtures.enrollmentFixture();assert.throws(()=>empty.owner.createNormalCredentialBootstrap({}));assert.equal(empty.calls(),0);
 const f=await fixtures.liveNativeOwner(),m=model(f),before=f.calls();
 for(const input of [{...m.config,origin:'https://other.invalid'},{...m.config,scope:{...m.config.scope,projectId:id(9)}},{...m.config,scope:{...m.config.scope,connectorId:id(9)}},{...m.config,attemptId:id(8)}])assert.throws(()=>f.owner.createNormalCredentialBootstrap(input));
 assert.equal(f.calls(),before);
});
for(const mode of ['ROOT','CLOSE','REVOKED','MAPPING','INVALIDATE','ABORT'])test('owner '+mode+'는 성공·자동재발급 없이 닫힌다',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,mode),client=f.owner.createNormalCredentialBootstrap(m.config),abort=new AbortController();
 if(mode==='REVOKED'){const fetch=f.session.fetch;f.session.fetch=async function(...args){const response=await Reflect.apply(fetch,this,args),value=await response.json();value.basis={current:false,reasons:['REVOKED']};return new Response(canonicalJson(value),{headers:{'Content-Type':'application/json'}});};}
 if(mode==='MAPPING')f.stored().key.signerImageHash='f'.repeat(64);
 if(mode==='INVALIDATE')f.owner.invalidate();
 if(mode==='ABORT')abort.abort();
 const before=f.calls();await assert.rejects(client.bootstrap(abort.signal));
 assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
 const after=f.calls();await assert.rejects(client.bootstrap(new AbortController().signal));assert.equal(f.calls(),after);
 if(['REVOKED','MAPPING','INVALIDATE','ABORT'].includes(mode))assert.equal(m.calls.length,0);
 if(['INVALIDATE','ABORT'].includes(mode))assert.equal(after,before);
});

test('최대 encoded 응답 2812587 bytes는 실제 host 62 frames/64 이내, 임의 URL·메서드0',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f,'MAX'),port=await f.owner.createNormalCredentialBootstrap(m.config).bootstrap(new AbortController().signal);
 const result=await port.request({...m.request,auth:'A'.repeat(20)},new AbortController().signal);
 assert.equal(Buffer.byteLength(canonicalJson(result)),2812587);assert.equal(m.calls.length,60);assert.equal(m.calls.at(-1).sequence,62);assert.equal(f.timers(),0);
 const count=f.calls();for(const request of [{...m.request,method:'DELETE'},{...m.request,path:'/api/v1/projects/anything'},{...m.request,path:'https://other.invalid/commands'}])await assert.rejects(port.request({...request,auth:'A'},new AbortController().signal));assert.equal(f.calls(),count);
});
for(const mode of ['ABORT_LATE','DEADLINE','BUSY'])test('owner '+mode+'의 늦은 operation 정리와 다른 교환 보호',async()=>{
 const f=await fixtures.liveNativeOwner(),m=model(f),create=f.dependencies.createOperation;let release,entered=false,closes=0;
 f.dependencies.createOperation=async(...args)=>{const operation=await create(...args);entered=true;await new Promise(resolve=>{release=resolve;});return Object.freeze({...operation,close:async()=>{closes++;return operation.close();}});};
 const a=f.owner.createNormalCredentialBootstrap(m.config),b=f.owner.createNormalCredentialBootstrap(m.config),signal=new AbortController();
 const pending=a.bootstrap(signal.signal);const rejected=mode==='BUSY'?null:assert.rejects(pending);for(let i=0;i<100&&!entered;i++)await Promise.resolve();assert.equal(entered,true);
 if(mode==='BUSY'){await assert.rejects(b.bootstrap(new AbortController().signal));release();assert.ok((await pending).metadata);assert.equal(m.calls.length,1);}
 else{if(mode==='ABORT_LATE')signal.abort();else f.fireDeadline();await rejected;release();for(let i=0;i<100&&closes===0;i++)await Promise.resolve();assert.equal(closes,1);assert.equal(m.calls.length,0);await assert.rejects(a.bootstrap(new AbortController().signal));}
 assert.equal(f.owner.isBusy(),false);assert.equal(f.timers(),0);
});
