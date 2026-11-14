import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire,Module} from 'node:module';
import {sign} from 'node:crypto';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {nativeHash,nativeRequestProofBytes} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {ownershipObservationBytesV1} from '../../../contracts/runtime/ownership-observation-v1.ts';
import {nativeFixture,id,ref,testOpaque,testPrivateKey} from './native-host-storage-fixture.ts';
import {NativeWorkerDeploymentStore} from '../../../apps/server/modules/executions/native-worker-deployment-store.ts';
const require=createRequire(import.meta.url);
const {withWorkerBuild}=require('../../desktop/native-worker-build.test.cjs');
const {stagedWorker}=require('../../desktop/native-worker-publication.test.cjs');

test('원 publisher→store/GET→client/설치조정기 및 보호 basis→원 consume 반환 원장을 연결한다',async()=>{
 const api=await import('../../../apps/server/modules/executions/native-worker-ownership-basis-source.ts');
 assert.equal(typeof (api as any).createNativeWorkerDeploymentOwnershipBasisSource,'function','목적 store에서 원 runtime 배포 객체를 생산하는 연결이 없다');
 await withWorkerBuild(async(f:any)=>{
  const native=await nativeFixture(false,10000,true,false,false,false,2),oldNow=Date.now;
  Date.now=()=>native.clockDate().getTime();
  let publicApp:any;
  try{
   const publisher=require('../../../apps/desktop/scripts/native-worker-deployment-publisher.cjs');
   const product=await publisher.createWorkerPublication({compilation:f.staged.compilation,packageToken:f.staged.packageToken,factoryArtifact:f.artifact,configuration:f.config});
   let bundle:any,head:any,publishes=0,reads=0,readMode='',readTick=0,readAbort:AbortController|undefined;
   const db={query:async(sql:string,args:any[]=[])=>{
    if(sql.includes('worker_deployment_publish')){assert.equal(bundle,undefined);publishes++;bundle=JSON.parse(args[1]);const snapshot={schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_HEAD',nativeFactoryRef:bundle.descriptor.snapshot.nativeFactoryRef,descriptorRef:bundle.descriptor.ref,sequence:1,previousHeadRef:null,state:'ACTIVE',updatedAt:f.config.issuedAt,expiresAt:f.config.expiresAt};head={ref:{...ref(9900),contentHash:nativeHash(snapshot)},snapshot};return{rows:[{result:head}]};}
    if(sql.includes('worker_deployment_read')){reads++;readTick++;assert.deepEqual(JSON.parse(args[0]),f.artifact.factoryRef);const b=structuredClone(bundle);let h=structuredClone(head);let at=Date.now();if(readMode==='HASH')b.descriptor.ref.contentHash='f'.repeat(64);if(readMode==='FACTORY'){b.descriptor.snapshot.nativeFactoryRef=ref(9950);b.descriptor.ref.contentHash=nativeHash(b.descriptor.snapshot);}if(readMode==='EXPIRED')at=Date.parse(h.snapshot.expiresAt);if(readMode==='LATE_REVOKE'&&readTick===2){h=await store.revoke(id(9924),f.artifact.factoryRef,head.ref);assert.equal(h.snapshot.sequence,2);assert.equal(h.ref.version,2);assert.ok(h.snapshot.previousHeadRef);}if(readMode==='ABORT')readAbort!.abort();return{rows:[{result:{bundle:b,head:h,observedAt:new Date(at).toISOString()}}]};}
    if(sql.includes('worker_deployment_revoke')){assert.deepEqual(JSON.parse(args[2]),head.ref);const snapshot={...head.snapshot,sequence:2,state:'REVOKED',previousHeadRef:head.ref,updatedAt:new Date(Date.now()).toISOString()};head={ref:{...head.ref,version:2,contentHash:nativeHash(snapshot)},snapshot};return{rows:[{result:{bundle,head}}]};}
    assert.ok(['BEGIN',"SET LOCAL statement_timeout = '1000ms'",'COMMIT','ROLLBACK'].includes(sql));return{rows:[],command:sql==='COMMIT'?'COMMIT':undefined};
   },release(){}};
   const store=new NativeWorkerDeploymentStore({connect:async()=>db} as any,{readOriginal:publisher.readCurrentWorkerPublication});
   await publisher.publishWorkerDeployment(store,id(9901),product);assert.equal(publishes,1);
   const {buildApp}=await import('../../../apps/server/app.ts'),args:any[]=Array(18).fill(undefined);args[0]={};publicApp=(buildApp as any)(...args,store);
   const runtimeBuild=require('../../../apps/desktop/scripts/native-proof-runtime-build.cjs'),built=runtimeBuild.readNativeProofRuntime(await runtimeBuild.buildNativeProofRuntime());
   const memory:any=new Module('deployment-journey.memory.cjs');memory.require=(n:string)=>{assert.ok(runtimeBuild.EXTERNALS.includes(n));return require(n);};memory._compile(built.code,'deployment-journey.memory.cjs');
   const clientPath=require.resolve('../../../apps/desktop/src/native-worker-deployment-client.cjs'),load=(Module as any)._load;
   (Module as any)._load=function(name:string,parent:any,...rest:any[]){if(name==='./native-proof-runtime.cjs'&&parent?.filename===clientPath)return memory.exports;return Reflect.apply(load,this,[name,parent,...rest]);};
   let client:any,transportError:unknown;
   try{const profile={schemaVersion:1,purpose:'RUNTIME_CATALOGUE_AUTHORITY_PROFILE',profileId:id(9910),profileVersion:1,publisherId:id(9911),origin:native.origin,endpointPrefix:'/api/v1/runtime-catalogue/desktop-trust/v1',tls:{mode:'SYSTEM_CHAIN_AND_HOSTNAME',minimumVersion:'TLSv1.2',rejectUnauthorized:true},roles:['DESKTOP_TRUST_KEY_HOST'],platform:{os:'win32',arch:'x64',runtime:'NET_FRAMEWORK_4_X'},maxResponseBytes:2097152,maxEntries:64,maxValidityMs:86400000};client=require(clientPath).createWorkerDeploymentClient(profile,{now:Date.now,monotonic:()=>performance.now(),nonce:()=>Buffer.alloc(32,9),request:async(inv:any)=>{try{const u=new URL(inv.url);assert.equal(u.origin,native.origin);const r=await publicApp.inject({url:u.pathname+u.search});assert.equal(r.statusCode,200,r.body);return{status:r.statusCode,rawHeaders:['Content-Type',r.headers['content-type'],'Cache-Control',r.headers['cache-control']],body:Buffer.from(r.body)};}catch(error){transportError=error;throw error;}}});}finally{(Module as any)._load=load;}
   let installed=0,closed=0;const coordinator=require('../../../apps/desktop/src/native-worker-installation-coordinator.cjs').createWorkerInstallationCoordinator(client,async()=>({install:async(p:any,b:any)=>{b.check();assert.deepEqual(p.bundle,bundle);assert.deepEqual(p.head,head);installed++;return{state:'INSTALLED',installationRef:ref(9912),descriptorRef:bundle.descriptor.ref,headRef:head.ref,workerHash:bundle.descriptor.snapshot.workerHash};},close:async()=>{closed++;return{state:'CLOSED_CONFIRMED'};}}));
   const result=await coordinator.install(f.artifact.factoryRef,{check(){},remainingMs:()=>10000,signal:new AbortController().signal}).catch((error:unknown)=>{throw transportError??error;});assert.equal(result.state,'INSTALLED');assert.equal(installed,1);assert.equal(closed,1);
   // 원 옵션 producer가 보유한 RAM 선택 자료만 바꾼다. 보호 메서드와 판독기는 실제 제품 그대로다.
   const options=await native.nativeSource.options(native.db as any,native.actor as any,{projectId:native.pid} as any);options.items[0]!.nativeFactoryRef=f.artifact.factoryRef;native.nativeCommand.payload.nativeFactoryRef=f.artifact.factoryRef;
   const basis=(api as any).createNativeWorkerDeploymentOwnershipBasisSource(store);native.service.connectNativeOwnershipReturn(basis);
   native.nativeApp.addHook('onRequest',async(request:any)=>{Object.defineProperty(request.raw.socket,'encrypted',{value:true,configurable:true});});
   const made=await native.nativeApp.inject({method:'POST',url:'/api/v1/projects/'+native.pid+'/native-boundary-preparations',headers:native.headers,payload:native.nativeCommand});assert.equal(made.statusCode,200,made.body);
   const row=native.data().native[0],authority=row.snapshot_json,ar={id:row.id,version:1,contentHash:row.content_hash},path='/api/v1/connector/native-preparations/'+row.id,headers={host:new URL(native.origin).host,authorization:'Bearer '+testOpaque};
   const post=(suffix:string,payload:any,extra={})=>native.nativeApp.inject({method:'POST',url:path+suffix,headers:{...headers,...extra},payload});
   const body={schemaVersion:1,authorityRef:ar,localAttemptRef:ref(9920)},target={method:'POST',path:path+'/consume',queryHash:nativeHash({}),bodyHash:nativeHash(body)},req={schemaVersion:1,requestId:id(9921),authorityRef:ar,localAttemptRef:body.localAttemptRef,target};
   const challenge=await post('/challenges',req);assert.equal(challenge.statusCode,200,challenge.body);const proof={requestId:req.requestId,...target,authorityRef:ar,credentialGeneration:authority.credentialGeneration,serverNonce:challenge.json().serverNonce};
   const consumed=await post('/consume',body,{'x-anvil-native-proof':Buffer.from(canonicalJson(proof)).toString('base64url'),'x-anvil-native-signature':sign('sha256',nativeRequestProofBytes(proof),{key:testPrivateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')});assert.equal(consumed.statusCode,200,consumed.body);
   const receipt=consumed.json().receipt,processRef={runId:receipt.ref.id,generation:1,jobId:id(9922),pid:50,startTicks:'133000000000000000',executableHash:bundle.descriptor.snapshot.workerHash},request={schemaVersion:1,requestId:id(9923),authorityRef:ar,consumeReceiptRef:receipt.ref,localAttemptRef:body.localAttemptRef,processRef};
   const issued=await post('/ownership-requests',request);assert.equal(issued.statusCode,200,issued.body);
   const event=native.data().nativeEvents.find((e:any)=>e.snapshot_json.kind==='CONSUME_COMMITTED');assert.ok(event);assert.equal(issued.json().request.observerRef.id,event.id);
   const facts={processRef,state:'PREPARED',everResumed:false,active:1,processes:[{pid:50,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false},report={...issued.json().request,factsHash:nativeHash(facts),observedAt:native.clockDate().toISOString()};
   const packet={schemaVersion:1,authorityRef:ar,consumeReceiptRef:receipt.ref,localAttemptRef:body.localAttemptRef,bindingRef:issued.json().bindingRef,report,facts,signature:sign('sha256',ownershipObservationBytesV1(report),{key:testPrivateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
   const accepted=await post('/ownership-results',packet);assert.equal(accepted.statusCode,200,accepted.body);assert.equal(accepted.json().executionAuthorized,false);assert.equal(accepted.json().dispatchPerformed,false);assert.equal(native.hostStorage!.state.heads.length,1);assert.ok(reads>=5);
   const input={authority,consumeReceipt:receipt,consumeRecordRef:{id:event.id,version:1,contentHash:event.content_hash},checkedAt:native.clockDate().toISOString(),signal:new AbortController().signal};
   for(const mode of ['HASH','FACTORY','EXPIRED','ABORT','LATE_REVOKE']){readMode=mode;readTick=0;readAbort=new AbortController();await assert.rejects(()=>basis.current({...input,checkedAt:native.clockDate().toISOString(),signal:readAbort!.signal}),mode);assert.equal(native.hostStorage!.state.heads.length,1);assert.equal(installed,1);if(mode==='LATE_REVOKE')assert.equal(readTick,2);}
   readMode='';const before=reads,aborted=new AbortController();aborted.abort();await assert.rejects(()=>basis.current({...input,signal:aborted.signal}));assert.equal(reads,before);
   const replay=await post('/ownership-results',packet);assert.notEqual(replay.statusCode,200);assert.equal(native.hostStorage!.state.heads.length,1);assert.equal(installed,1);
  }finally{await publicApp?.close();await native.close();Date.now=oldNow;}
 },{beforeFactory:stagedWorker});
});

test('서버 basis는 일반 JSON reader·교체 메서드·Proxy를 원 목적 store로 수용하지 않는다',async()=>{
 const {createNativeWorkerDeploymentOwnershipBasisSource:create}=await import('../../../apps/server/modules/executions/native-worker-ownership-basis-source.ts');let traps=0,calls=0;
 assert.throws(()=>create({read:async()=>{calls++;}} as any));assert.throws(()=>create(new Proxy({},{getPrototypeOf(){traps++;return NativeWorkerDeploymentStore.prototype;}}) as any));assert.equal(traps,0);assert.equal(calls,0);
 const store=new NativeWorkerDeploymentStore({connect:async()=>{calls++;throw Error('UNREACHABLE');}} as any);Object.defineProperty(store,'read',{value:async()=>({})});assert.throws(()=>create(store));assert.equal(calls,0);
});
