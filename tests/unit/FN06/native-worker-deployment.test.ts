import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeHash} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {canonicalJson} from '../../../contracts/canonical.ts';

const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:String(n).repeat(64).slice(0,64)});
export function deploymentFixture(at=Date.parse('2026-11-14T00:00:00.000Z')){
 const issuedAt=new Date(at).toISOString(),expiresAt=new Date(at+3600000).toISOString(),factory=ref(1);
 const seal=(n:number,snapshot:any)=>({ref:{id:id(n),version:1,contentHash:nativeHash(snapshot)},snapshot});
 const packageRecord=seal(2,{schemaVersion:1,purpose:'NATIVE_FACTORY_PACKAGE_BASIS',parentExeHash:'2'.repeat(64),parentAsarHash:'3'.repeat(64),parentHeaderHash:'4'.repeat(64),issuedAt,expiresAt});
 const buildReceipt=seal(3,{schemaVersion:1,purpose:'NATIVE_WORKER_BUILD_RECEIPT',nativeFactoryRef:factory,packageRef:packageRecord.ref,compileInputHash:'5'.repeat(64),sourceHash:'6'.repeat(64),workerHash:'7'.repeat(64),issuedAt,expiresAt});
 const descriptor=seal(1,{schemaVersion:1,purpose:'NATIVE_PREPARATION_WORKER_DESCRIPTOR',nativeFactoryRef:factory,packageRef:packageRecord.ref,buildReceiptRef:buildReceipt.ref,rootId:id(4),relativePath:'OwnershipEvidenceWorker.exe',workerHash:'7'.repeat(64),issuedAt,expiresAt});
 const bundle={descriptor,packageRecord,buildReceipt};
 const head=seal(5,{schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_HEAD',nativeFactoryRef:factory,descriptorRef:descriptor.ref,sequence:1,previousHeadRef:null,state:'ACTIVE',updatedAt:issuedAt,expiresAt});
 return {bundle,head,factory,now:Date.parse(issuedAt),nonce:Buffer.alloc(32,8).toString('base64url')};
}
test('exact3 bundle의 원 부모/hash와 공개 projection을 검산한다',async()=>{
 const c=await import('../../../contracts/runtime/native-worker-deployment-v1.ts');const f=deploymentFixture();
 assert.deepEqual(c.readWorkerDeploymentBundle(f.bundle),f.bundle);
 const reply={schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_READ',nonce:f.nonce,bundle:f.bundle,head:f.head,observedAt:new Date(f.now).toISOString()};
 assert.deepEqual(c.readWorkerDeploymentRead(reply,f.factory,f.nonce,f.now),reply);
 for(const change of [(v:any)=>v.compile={},(v:any)=>v.buildReceipt.snapshot.workerHash='8'.repeat(64),(v:any)=>v.descriptor.snapshot.packageRef=ref(9)]){const v=structuredClone(f.bundle);change(v);assert.throws(()=>c.readWorkerDeploymentBundle(v));}
 const modified=structuredClone(f.bundle);modified.buildReceipt.snapshot.nativeFactoryRef=ref(9);modified.buildReceipt.ref.contentHash=nativeHash(modified.buildReceipt.snapshot);modified.descriptor.snapshot.buildReceiptRef=modified.buildReceipt.ref;modified.descriptor.ref.contentHash=nativeHash(modified.descriptor.snapshot);assert.throws(()=>c.readWorkerDeploymentBundle(modified));
 assert.throws(()=>c.readWorkerDeploymentRead(reply,ref(9),f.nonce,f.now));assert.throws(()=>c.readWorkerDeploymentRead(reply,f.factory,f.nonce,f.now+1001));
 let traps=0;assert.throws(()=>c.readWorkerDeploymentBundle(new Proxy({}, {ownKeys(){traps++;return[];}})));assert.equal(traps,0);
 assert.ok(Buffer.byteLength(canonicalJson(reply))<65536);
});
test('순수 JSON/model token은 게시 원천이 아니며 미설정 reader는 DB 호출 전 거절한다',async()=>{
 const {NativeWorkerDeploymentStore}=await import('../../../apps/server/modules/executions/native-worker-deployment-store.ts');
 let calls=0;const pool={connect:async()=>{calls++;throw Error('DB_MUST_NOT_RUN');}};
 const store=new NativeWorkerDeploymentStore(pool as any);const f=deploymentFixture();
 await assert.rejects(()=>store.publish(id(8),f.bundle));
 await assert.rejects(()=>store.publish(id(8),{...f.bundle,assurance:'SOURCE_ONLY_MODEL',compilerExecuted:false}));
 assert.equal(calls,0);
});
test('목적 함수만 호출하여 최초 게시/read 및 COMMIT 불명 폐기를 검산한다',async()=>{
 const {NativeWorkerDeploymentStore}=await import('../../../apps/server/modules/executions/native-worker-deployment-store.ts');const f=deploymentFixture(),token={},calls:any[]=[],released:any[]=[];
 let commit='COMMIT';const db={query:async(sql:string,args?:any[])=>{calls.push([sql,args]);if(sql==='COMMIT')return {command:commit,rows:[]};if(sql.includes('worker_deployment_publish'))return{rows:[{result:f.head}]};if(sql.includes('worker_deployment_read'))return{rows:[{result:{bundle:f.bundle,head:f.head,observedAt:new Date(f.now).toISOString()}}]};return{rows:[]};},release:(e?:Error)=>released.push(e)};
 const reader={readOriginal:(t:unknown)=>{assert.equal(t,token);return{bundle:f.bundle};}};const store=new NativeWorkerDeploymentStore({connect:async()=>db} as any,reader);
 assert.deepEqual(await store.publish(id(8),token),f.head);const result=await store.read(f.factory,f.nonce);assert.deepEqual(result.bundle,f.bundle);assert.equal(result.nonce,f.nonce);assert.ok(!calls.some(([s])=>/INSERT|UPDATE|FROM anvil\./.test(s)));
 commit='ROLLBACK';await assert.rejects(()=>store.publish(id(8),token),/WORKER_DEPLOYMENT_COMMIT_UNKNOWN/);assert.equal(released.at(-1)?.message,'WORKER_DEPLOYMENT_COMMIT_UNKNOWN');assert.equal(released.length,3);
});
test('revoke는 원 head fullref를 목적 함수에 보내고 이후 read는 회수를 거절한다',async()=>{
 const {NativeWorkerDeploymentStore}=await import('../../../apps/server/modules/executions/native-worker-deployment-store.ts');const f=deploymentFixture();let head=f.head,called=0;
 const db={query:async(sql:string,args:any[]=[])=>{if(sql.includes('worker_deployment_revoke')){called++;assert.deepEqual(args,[id(9),canonicalJson(f.factory),canonicalJson(f.head.ref)]);const snapshot={...head.snapshot,sequence:2,state:'REVOKED',previousHeadRef:f.head.ref};head={ref:{...head.ref,version:2,contentHash:nativeHash(snapshot)},snapshot};return{rows:[{result:{bundle:f.bundle,head}}]};}if(sql.includes('worker_deployment_read'))return{rows:[{result:{bundle:f.bundle,head,observedAt:new Date(f.now).toISOString()}}]};return{command:sql==='COMMIT'?'COMMIT':undefined,rows:[]};},release:()=>{}};
 const store=new NativeWorkerDeploymentStore({connect:async()=>db} as any);const result=await store.revoke(id(9),f.factory,f.head.ref);assert.equal(called,1);assert.deepEqual(result.snapshot.previousHeadRef,f.head.ref);assert.equal(result.ref.id,f.head.ref.id);await assert.rejects(()=>store.read(f.factory,f.nonce),/NOT_CURRENT/);
});
test('취소된 connect/query의 늦은 완료는 client를 한 번 폐기하고 후속 SQL/COMMIT을 실행하지 않는다',async()=>{
 const {NativeWorkerDeploymentStore}=await import('../../../apps/server/modules/executions/native-worker-deployment-store.ts');const f=deploymentFixture();
 for(const phase of ['CONNECT','QUERY']){const a=new AbortController();let resolve!: (v:any)=>void,calls:string[]=[],releases:any[]=[];
  const wait=new Promise<any>(r=>resolve=r),db={query:async(sql:string)=>{calls.push(sql);if(sql.includes('worker_deployment_read'))return wait;return{rows:[]};},release:(e:any)=>releases.push(e)};
  const store=new NativeWorkerDeploymentStore({connect:async()=>phase==='CONNECT'?wait:db} as any),pending=store.read(f.factory,f.nonce,a.signal);
  await new Promise(r=>setImmediate(r));a.abort();await assert.rejects(()=>pending);resolve(phase==='CONNECT'?db:{rows:[{result:{bundle:f.bundle,head:f.head,observedAt:new Date(f.now).toISOString()}}]});await new Promise(r=>setImmediate(r));
  assert.equal(releases.length,1);assert.ok(releases[0] instanceof Error);assert.ok(!calls.includes('COMMIT'));if(phase==='CONNECT')assert.equal(calls.length,0);
 }
});
test('공개 GET은 exact path/nonce만 받고 credential 혼합·비정규 입력·source 부재를 닫는다',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');const f=deploymentFixture(Date.now());let calls=0;
 const reply={schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_READ',nonce:f.nonce,bundle:f.bundle,head:f.head,observedAt:new Date(f.now).toISOString()};
 const source={read:async()=>{calls++;return {...reply,observedAt:new Date().toISOString()};}};const args:any[]=Array(18).fill(undefined);args[0]={};const app=(buildApp as any)(...args,source);
 const url=`/api/v1/native-worker-deployments/${f.factory.id}/1/${f.factory.contentHash}?nonce=${f.nonce}`;
 try{assert.equal((await app.inject({method:'GET',url})).statusCode,200);
 for(const entry of [{url:url+'&extra=1'},{url:url+'&nonce='+f.nonce},{url,headers:{cookie:'x=y'}},{url,headers:{authorization:'Bearer anything'}},{url:url.replace('/1/','/01/')}])assert.equal((await app.inject({method:'GET',...entry})).statusCode,400);
 assert.equal(calls,1);assert.equal((await app.inject({method:'GET',url:'/api/v1/health'})).statusCode,200);
 }finally{await app.close();}
 const absent=buildApp();try{assert.equal((await absent.inject({method:'GET',url})).statusCode,503);}finally{await absent.close();}
});
test('GET 응답의 자체 observedAt은 새 1초 권위가 아니며 늦은 source를 반환하지 않는다',async()=>{
 const {buildApp}=await import('../../../apps/server/app.ts');const f=deploymentFixture(Date.now()-5000);let slow=false,finished=0;
 const source={read:async()=>{if(slow)await new Promise(r=>setTimeout(r,1200));finished++;return{schemaVersion:1,purpose:'NATIVE_WORKER_DEPLOYMENT_READ',nonce:f.nonce,bundle:f.bundle,head:f.head,observedAt:new Date(f.now).toISOString()};}};
 const args:any[]=Array(18).fill(undefined);args[0]={};const app=(buildApp as any)(...args,source),url=`/api/v1/native-worker-deployments/${f.factory.id}/1/${f.factory.contentHash}?nonce=${f.nonce}`;
 try{assert.equal((await app.inject({method:'GET',url})).statusCode,503);slow=true;const start=performance.now();assert.equal((await app.inject({method:'GET',url})).statusCode,503);assert.ok(performance.now()-start<1150);assert.equal(finished,1);await new Promise(r=>setTimeout(r,250));assert.equal(finished,2);}finally{await app.close();}
});
test('COMMIT 응답 유실은 UNKNOWN이며 원 request/hash 조회만 저장된 최초 head를 반환한다',async()=>{
 const {NativeWorkerDeploymentStore}=await import('../../../apps/server/modules/executions/native-worker-deployment-store.ts');const f=deploymentFixture(),token={};let saved:any=null,publishes=0,lose=true;const releases:any[]=[];
 const db={query:async(sql:string,args:any[]=[])=>{if(sql.includes('worker_deployment_publish')){publishes++;saved={id:args[0],hash:nativeHash(JSON.parse(args[1])),head:f.head};return{rows:[{result:f.head}]};}if(sql.includes('worker_deployment_lookup'))return{rows:[{result:saved?.id===args[0]&&saved?.hash===args[1]?saved.head:null}]};if(sql==='COMMIT'){if(lose){lose=false;throw Error('RAM_COMMIT_RESPONSE_LOST');}return{command:'COMMIT',rows:[]};}return{rows:[]};},release:(e?:Error)=>releases.push(e)};
 const store=new NativeWorkerDeploymentStore({connect:async()=>db} as any,{readOriginal:t=>{assert.equal(t,token);return{bundle:f.bundle};}});
 await assert.rejects(()=>store.publish(id(8),token),/^Error: WORKER_DEPLOYMENT_COMMIT_UNKNOWN$/);assert.equal(publishes,1);assert.equal(releases.length,1);assert.ok(releases[0] instanceof Error);
 assert.equal(await store.lookup(id(8),'0'.repeat(64)),null);assert.deepEqual(await store.lookup(id(8),nativeHash(f.bundle)),f.head);assert.equal(publishes,1);
});
