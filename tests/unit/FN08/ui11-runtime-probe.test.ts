import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const target=new URL('../../../scripts/ui11-runtime-probe.mjs',import.meta.url);
const load=()=>import(target.href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
test('startup 재조회는 ECONNREFUSED만 허용하고 TLS·본문상한·timeout 오류를 연결대기로 바꾸지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.runtimeRequestFailure,'function');
 assert.equal(m.runtimeRequestFailure({code:'ECONNREFUSED'}),'UI11_HTTP_CONNECTION_FAILED');
 assert.equal(m.runtimeRequestFailure({code:'CERT_HAS_EXPIRED',message:'private'}),'UI11_HTTP_TRANSPORT_FAILED');
 assert.equal(m.runtimeRequestFailure({message:'UI11_HTTP_BODY_TOO_LARGE'}),'UI11_HTTP_BODY_TOO_LARGE');
 assert.equal(m.runtimeRequestFailure({message:'UI11_HTTP_TIMEOUT'}),'UI11_HTTP_TIMEOUT');
});
test('runtime HTTP 소비 대상은 승인된 후보와 구 bundle을 혼용하지 않는 정확 hash binding이다',async()=>{
 const m:any=await load();assert.equal(typeof m.runtimeHttpTargets,'function');
 assert.deepEqual(m.runtimeHttpTargets('--http-new'),[
  {path:'/',hash:'1afc88c707c3678a2bd6ce849e6d4c25ce66b47b188fb05ef12df1a269be9216'},
  {path:'/assets/index-Csxr80L5.js',hash:'923d30230b13d436bad57153a9e2308148686ac57f49bebe94e1cd7c71f0b3a9'},
  {path:'/assets/index-C3a7Hrx0.css',hash:'034435504a3650cd6024e9af5c9be6797efbb4caa2c3587cc287f778db5e9a56'},
 ]);
 assert.equal(m.runtimeHttpTargets('--http-old')[1].hash,'150b3d211b349a4464126dd079e9071fb11a2cefa7c0f9ad82e5680d2acf1c69');
 assert.throws(()=>m.runtimeHttpTargets('guess'),/UI11_PROBE_BINDING_INVALID/);
});
test('runtime HTTP 판정은 실제 status/body hash·건강 계약을 검사하고 기준 미달을 성공시키지 않는다',async()=>{
 const m:any=await load();assert.equal(typeof m.checkRuntimeResponse,'function');
 const abc=Buffer.from('abc'),hash='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
 assert.equal(m.checkRuntimeResponse(200,abc,200,hash),hash);
 assert.throws(()=>m.checkRuntimeResponse(404,abc,200,hash),/UI11_HTTP_STATUS_INVALID/);
 assert.throws(()=>m.checkRuntimeResponse(200,Buffer.from('abC'),200,hash),/UI11_HTTP_HASH_INVALID/);
 assert.throws(()=>m.checkRuntimeResponse(200,Buffer.alloc(1048577),200,hash),/UI11_HTTP_BODY_TOO_LARGE/);
 assert.equal(typeof m.checkRuntimeHealth,'function');
 m.checkRuntimeHealth(Buffer.from('{"status":"ok","scope":"process"}'));
 assert.throws(()=>m.checkRuntimeHealth(Buffer.from('{"status":"ok","scope":"database"}')),/UI11_HEALTH_INVALID/);
 assert.throws(()=>m.checkRuntimeHealth(Buffer.from('not-json')),/UI11_HEALTH_INVALID/);
});
test('runtime probe plan은 네트워크/Secret 없이 반환하고 무승인 db/http는 접근 전에 거절한다',()=>{
 const run=(mode:string)=>spawnSync(process.execPath,[fileURLToPath(target),mode],{encoding:'utf8',timeout:5000,windowsHide:true,env:{...process.env,ANVIL_UI11_RUNTIME_APPROVAL:'',ANVIL_UI11_RUNTIME_INLINE:''}});
 const plan=run('--plan');assert.equal(plan.status,0,plan.stderr);assert.deepEqual(JSON.parse(plan.stdout),{mode:'PLAN',databaseWrites:0,secretReads:0,requests:0});
 for(const mode of ['--db','--http-new','--http-old','--http-original','--browser']){
  const result=run(mode);assert.equal(result.status,1);assert.deepEqual(JSON.parse(result.stdout),{status:'FAIL',failure:'UI11_PROBE_BINDING_INVALID'});assert.equal(result.stderr,'');
 }
});
