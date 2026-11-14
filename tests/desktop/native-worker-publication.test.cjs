'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withWorkerBuild,workerPE}=require('./native-worker-build.test.cjs');
const hash=b=>require('node:crypto').createHash('sha256').update(b).digest('hex');
async function stagedWorker(f,forge=false,exercise=null){
 const compiler=require('../../apps/desktop/scripts/native-worker-compiler.cjs'),packager=require('../../apps/desktop/scripts/native-worker-package.cjs'),output=f.root+'\\Build\\OwnershipEvidenceWorker.exe';let outputIdentity='compile-output',closed=0,started=0;
 const inspect=async p=>f.files.has(p)?{state:'FILE',identity:p===output?outputIdentity:p,nlink:1,link:false,bytes:f.files.get(p).length}:{state:'ABSENT'};
 const ports={read:async p=>Buffer.from(f.files.get(p)),check:()=>{},inspect,readOutput:async p=>Buffer.from(f.files.get(p)),driver:inv=>{started++;assert.equal(inv.args.includes('/main:Anvil.Native.OwnershipEvidence.OwnershipEvidenceWorker'),true);assert.ok(!inv.args.some(a=>a.includes('ParentBasis')));return{watch:sink=>{queueMicrotask(()=>{f.files.set(output,workerPE());sink.close(0,null);closed++;});return()=>{};}};},now:()=>f.now,monotonic:()=>performance.now(),schedule:(cb,ms)=>{const t=setTimeout(cb,ms);return()=>clearTimeout(t);}};
 const configuration={repoRoot:f.repo,compiler:f.compiler,references:f.references.slice(0,2),sourceHash:hash('RAM original worker source'),outputPath:output};
 const input={configuration,expiresAt:new Date(f.now+60000).toISOString()};
 const io={inspectRoot:async()=>({identity:'package-root',owner:'ram-owner',link:false}),inspect,create:async p=>{assert.ok(!f.files.has(p));let b=Buffer.alloc(0);f.files.set(p,b);return{identity:p,write:async(bytes,offset)=>{b=Buffer.concat([b,bytes.subarray(offset)]);f.files.set(p,b);return bytes.length-offset;},sync:async()=>{},close:async()=>{}};},read:async p=>Buffer.from(f.files.get(p)),check:()=>{}};
 if(exercise)return exercise({compiler,packager,input,ports,io,output});
 if(forge){const producer=packager.createWorkerPackageProducer(input,{compiler:ports,package:io});let baseCalls=0;const hooks=packager.fixedNativeWorkerForgeHooks({postPackage:async()=>{baseCalls++;assert.ok(f.files.has(f.parent+'\\resources\\native-workers\\OwnershipEvidenceWorker.exe'));}},producer);await hooks.postPackage({}, {platform:'win32',arch:'x64',outputPaths:[f.parent]});assert.equal(started,1);assert.equal(closed,1);assert.equal(baseCalls,1);return{producer,ports,io,output,hooks};}
 const compilation=await compiler.runNativeWorkerCompiler(input,ports);assert.equal(started,1);assert.equal(closed,1);const packageToken=await packager.packageNativeWorker(compilation,f.parent,io);return{compilation,packageToken,ports,io,output,input};
}
module.exports={stagedWorker};
if(require.main===module){
test('게시 producer는 기존 SOURCE_ONLY_MODEL과 복제 compiler token을 거절한다',async()=>{
 const c=require('../../apps/desktop/scripts/native-worker-compiler.cjs'),p=require('../../apps/desktop/scripts/native-worker-deployment-publisher.cjs');
 assert.throws(()=>c.readWorkerCompilation({compilerExecuted:true}),/WORKER/);
 assert.throws(()=>p.readWorkerPublication({bundle:{},compilerExecuted:true}),/WORKER/);
 await assert.rejects(()=>p.createWorkerPublication({compilation:{},packageToken:{},factoryArtifact:{},configuration:{}}),/WORKER/);
});
test('부모 없는 compiler 원결과→고정 package→원 factory→publication→제품 store를 실제 함수로 연결한다',async()=>withWorkerBuild(async f=>{
 const publisher=require('../../apps/desktop/scripts/native-worker-deployment-publisher.cjs');const token=await publisher.createWorkerPublication({compilation:f.staged.compilation,packageToken:f.staged.packageToken,factoryArtifact:f.artifact,configuration:f.config});
 const publicValue=publisher.readWorkerPublication(token);assert.deepEqual(Object.keys(publicValue.bundle).sort(),['buildReceipt','descriptor','packageRecord']);assert.equal(publicValue.bundle.descriptor.snapshot.workerHash,hash(workerPE()));assert.ok(!JSON.stringify(publicValue).includes('C:\\WorkerQA'));
 assert.throws(()=>publisher.readWorkerPublication({...token}));assert.throws(()=>publisher.readWorkerPublication(awaitModel));
 const {NativeWorkerDeploymentStore}=await import('../../apps/server/modules/executions/native-worker-deployment-store.ts');let publishes=0;const bundle=publicValue.bundle;
 const snapshot={schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_HEAD',nativeFactoryRef:bundle.descriptor.snapshot.nativeFactoryRef,descriptorRef:bundle.descriptor.ref,sequence:1,previousHeadRef:null,state:'ACTIVE',updatedAt:f.config.issuedAt,expiresAt:f.config.expiresAt};
 const {nativeHash}=await import('../../contracts/runtime/native-preparation-authority-v1.ts');const head={ref:{id:'ad140002-0000-4000-8000-000000000090',version:1,contentHash:nativeHash(snapshot)},snapshot};
 const db={query:async(sql,args)=>{if(sql.includes('worker_deployment_publish')){publishes++;assert.deepEqual(JSON.parse(args[1]),bundle);return{rows:[{result:head}]};}return{command:sql==='COMMIT'?'COMMIT':undefined,rows:[]};},release:()=>{}};
 const store=new NativeWorkerDeploymentStore({connect:async()=>db},{readOriginal:publisher.readCurrentWorkerPublication});assert.deepEqual(await publisher.publishWorkerDeployment(store,'ad140002-0000-4000-8000-000000000091',token),head);assert.equal(publishes,1);
}, {beforeFactory:stagedWorker}));
const awaitModel={assurance:'SOURCE_ONLY_MODEL',compilerExecuted:false};
test('명시 Forge producer는 worker stage 뒤 기존 postPackage를 보존하고 같은 원 산출물만 한 번 게시한다',async()=>withWorkerBuild(async f=>{
 const publisher=require('../../apps/desktop/scripts/native-worker-deployment-publisher.cjs'),{NativeWorkerDeploymentStore}=await import('../../apps/server/modules/executions/native-worker-deployment-store.ts'),{nativeHash}=await import('../../contracts/runtime/native-preparation-authority-v1.ts');let count=0;
 const db={query:async(sql,args)=>{if(sql.includes('worker_deployment_publish')){count++;const b=JSON.parse(args[1]),snapshot={schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_HEAD',nativeFactoryRef:b.descriptor.snapshot.nativeFactoryRef,descriptorRef:b.descriptor.ref,sequence:1,previousHeadRef:null,state:'ACTIVE',updatedAt:f.config.issuedAt,expiresAt:f.config.expiresAt};return{rows:[{result:{ref:{id:'ad140002-0000-4000-8000-000000000090',version:1,contentHash:nativeHash(snapshot)},snapshot}}]};}return{rows:[],command:sql==='COMMIT'?'COMMIT':undefined};},release:()=>{}};
 const store=new NativeWorkerDeploymentStore({connect:async()=>db},{readOriginal:publisher.readCurrentWorkerPublication});const head=await f.staged.producer.finalize(f.artifact,f.config,store,'ad140002-0000-4000-8000-000000000091');assert.equal(head.snapshot.state,'ACTIVE');assert.equal(count,1);await assert.rejects(()=>f.staged.producer.finalize(f.artifact,f.config,store,'ad140002-0000-4000-8000-000000000092'));assert.equal(count,1);await assert.rejects(()=>f.staged.hooks.postPackage({}, {platform:'win32',arch:'x64',outputPaths:['C:\\Other']}));
},{beforeFactory:f=>stagedWorker(f,true)}));
test('compiler 원 output/source 또는 package bytes 변경은 같은 원 token 재검산에서 거절한다',async()=>{
 for(const mode of ['OUTPUT','SOURCE','PACKAGE','PORT'])await withWorkerBuild(async f=>{
  const publisher=require('../../apps/desktop/scripts/native-worker-deployment-publisher.cjs');
  if(mode==='OUTPUT')f.files.set(f.staged.output,Buffer.from('changed'));
  if(mode==='SOURCE')f.files.set(require('node:path').win32.join(f.repo,...f.worker.SOURCE.split('/')),Buffer.from('changed'));
  if(mode==='PACKAGE')f.files.set([...f.files.keys()].find(p=>p.includes('\\resources\\native-workers\\')),Buffer.from('changed'));
  if(mode==='PORT')f.staged.ports.read=async()=>workerPE();
  await assert.rejects(()=>publisher.createWorkerPublication({compilation:f.staged.compilation,packageToken:f.staged.packageToken,factoryArtifact:f.artifact,configuration:f.config}));
 },{beforeFactory:stagedWorker});
});
test('compiler 종료 불명은 늦은 close 뒤에도 같은 원 driver 재진입을 차단한다',async()=>withWorkerBuild(async()=>{}, {beforeFactory:f=>stagedWorker(f,false,async({compiler,input,ports})=>{
 let stop,late,calls=0,unwatched=0;ports.schedule=cb=>{stop=cb;return()=>{};};ports.driver=()=>{calls++;return{watch:sink=>{late=sink;queueMicrotask(()=>stop());return()=>{unwatched++;};}};};
 await assert.rejects(()=>compiler.runNativeWorkerCompiler(input,ports),/UNKNOWN/);assert.equal(calls,1);assert.equal(unwatched,1);late.close(0,null);
 await assert.rejects(()=>compiler.runNativeWorkerCompiler(input,ports),/UNKNOWN|INVALID/);assert.equal(calls,1);
})}));
test('package create 반환 뒤 현재성 실패에도 원 handle을 회수하고 UNKNOWN을 보존한다',async()=>withWorkerBuild(async()=>{}, {beforeFactory:f=>stagedWorker(f,false,async({compiler,packager,input,ports,io})=>{
 const token=await compiler.runNativeWorkerCompiler(input,ports);let closed=0,created=0;io.create=async p=>{created++;io.check=()=>{throw Error('RAM_CHANGED');};return{identity:p,write:async()=>{throw Error('UNREACHABLE');},sync:async()=>{},close:async()=>{closed++;}};};
 await assert.rejects(()=>packager.packageNativeWorker(token,f.parent,io),/UNKNOWN/);assert.equal(created,1);assert.equal(closed,1);
 await assert.rejects(()=>packager.packageNativeWorker(token,f.parent,io));assert.equal(created,1);
})}));

test('package create timeout 뒤 늦은 원 handle은 보존·정리되고 재설치를 시작하지 않는다',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 await withWorkerBuild(async()=>{}, {beforeFactory:f=>stagedWorker(f,false,async({compiler,packager,input,ports,io})=>{
 const token=await compiler.runNativeWorkerCompiler(input,ports);let deliver,entered,closed=0,creates=0;const started=new Promise(r=>entered=r);io.create=p=>{creates++;entered();return new Promise(r=>deliver=()=>r({identity:p,write:async()=>{throw Error('LATE_WRITE');},sync:async()=>{},close:async()=>{closed++;}}));};
 const operation=packager.packageNativeWorker(token,f.parent,io),rejected=assert.rejects(operation,/UNKNOWN/);await started;t.mock.timers.tick(60001);await rejected;deliver();await new Promise(r=>setImmediate(r));assert.equal(closed,1);
 await assert.rejects(()=>packager.packageNativeWorker(token,f.parent,io));assert.equal(creates,1);
 })});
});

test('package close 불명은 finally와 늦은 회수에서도 동일 close를 한 번만 호출한다',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});await withWorkerBuild(async()=>{}, {beforeFactory:f=>stagedWorker(f,false,async({compiler,packager,input,ports,io})=>{
 const token=await compiler.runNativeWorkerCompiler(input,ports);let entered,calls=0,finish;const begun=new Promise(r=>entered=r),create=io.create;io.create=async p=>{const h=await create(p);return{...h,close:()=>{calls++;entered();return new Promise(r=>finish=r);}};};
 const run=packager.packageNativeWorker(token,f.parent,io),rejected=assert.rejects(run,/UNKNOWN/);await begun;t.mock.timers.tick(60001);await new Promise(r=>setImmediate(r));assert.equal(calls,1);finish();await rejected;assert.equal(calls,1);
 })});
});
}
