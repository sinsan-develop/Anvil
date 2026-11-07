import {readFile,realpath,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {get} from 'node:https';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const newCommit=()=>process.env.ANVIL_UI11_RUNTIME_COMMIT;
const rollbackCommit='9bade63e3d3959a16f015ff89bc0c6a0baddaa1b';
export function runtimeHttpTargets(mode){
 if(!['--http-new','--http-old'].includes(mode))throw Error('UI11_PROBE_BINDING_INVALID');
 const next=mode==='--http-new';
 return[
  {path:'/',hash:next?'1afc88c707c3678a2bd6ce849e6d4c25ce66b47b188fb05ef12df1a269be9216':'39bd2923bf898fa1d23aac96385cdc890ea7c55167d5ab864fb897bf455bc9f5'},
  {path:next?'/assets/index-Csxr80L5.js':'/assets/index-DCxasc0L.js',hash:next?'923d30230b13d436bad57153a9e2308148686ac57f49bebe94e1cd7c71f0b3a9':'150b3d211b349a4464126dd079e9071fb11a2cefa7c0f9ad82e5680d2acf1c69'},
  {path:'/assets/index-C3a7Hrx0.css',hash:'034435504a3650cd6024e9af5c9be6797efbb4caa2c3587cc287f778db5e9a56'},
 ];
}
export function checkRuntimeResponse(status,body,expectedStatus,expectedHash){
 if(status!==expectedStatus)throw Error('UI11_HTTP_STATUS_INVALID');
 if(body.length>1048576)throw Error('UI11_HTTP_BODY_TOO_LARGE');
 const hash=createHash('sha256').update(body).digest('hex');
 if(expectedHash&&hash!==expectedHash.toLowerCase())throw Error('UI11_HTTP_HASH_INVALID');
 return hash;
}
export function checkRuntimeHealth(body){
 try{const v=JSON.parse(body.toString('utf8'));if(v.status!=='ok'||v.scope!=='process')throw Error();}catch{throw Error('UI11_HEALTH_INVALID');}
}
export function runtimeRequestFailure(error){
 if(['UI11_HTTP_BODY_TOO_LARGE','UI11_HTTP_TIMEOUT'].includes(error?.message))return error.message;
 return error?.code==='ECONNREFUSED'?'UI11_HTTP_CONNECTION_FAILED':'UI11_HTTP_TRANSPORT_FAILED';
}
function bind(mode){
 const now=Date.now(),issued=Date.parse(process.env.ANVIL_UI11_RUNTIME_ISSUED_AT??''),expiry=Date.parse(process.env.ANVIL_UI11_RUNTIME_EXPIRES_AT??'');
 if(process.platform!=='win32'||process.env.ANVIL_UI11_RUNTIME_APPROVAL!=='AV3-PMO-N4-SERVICE-TRANSITION'||!/^[0-9a-f]{40}$/.test(newCommit()??'')||!Number.isFinite(issued)||!Number.isFinite(expiry)||issued>now||expiry<=now||expiry-issued>7200000||expiry<=issued)throw Error('UI11_PROBE_BINDING_INVALID');
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:5000,stdio:['ignore','pipe','pipe']}).trim();
 if(['--http-new','--http-original','--browser'].includes(mode)&&head!==newCommit()||mode==='--http-old'&&head!==rollbackCommit||mode==='--db'&&![newCommit(),rollbackCommit].includes(head))throw Error('UI11_PROBE_SOURCE_INVALID');
 return expiry;
}
async function dbSnapshot(){
 const bytes=await readFile('D:/Project/Anvil/.av3-data/db-app.json');
 const v=JSON.parse(bytes.toString('utf8'));
 const fields=['host','port','database','user','password','application_name','connectionTimeoutMillis'];
 if(Object.keys(v).some(k=>!fields.includes(k))||v.host!=='127.0.0.1'||v.port!==5546||v.database!=='anvil_v3_development'||v.user!=='anvil_v3_app'||!/^[0-9a-f]{64}$/.test(v.password??'')||v.application_name!=='anvil-v3-development'||v.connectionTimeoutMillis!==5000)throw Error('UI11_DB_TARGET_INVALID');
 const require=createRequire(resolve(process.cwd(),'package.json')),{Client}=require('pg');
 const db=new Client({...v,statement_timeout:5000,query_timeout:6000});
 try{
  await db.connect();await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const migrations=(await db.query('SELECT id,checksum FROM anvil.schema_migrations ORDER BY id')).rows;
  if(migrations.length!==46||migrations.filter(r=>r.id==='0008_source_read_observation'&&r.checksum==='26a7b7828481689d7017836c1ece2fc5e9f644cb9b8200122ee013e7f52db185').length!==1)throw Error('UI11_DB_SCHEMA_INVALID');
  const tables=(await db.query("SELECT n.nspname schema,c.relname name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('anvil','anvil_qa') AND c.relkind='r' ORDER BY n.nspname,c.relname")).rows;
  if(tables.length!==81)throw Error('UI11_DB_TABLE_SET_INVALID');
  const state=[];
  for(const table of tables){
   if(!['anvil','anvil_qa'].includes(table.schema)||!/^[a-z0-9_]+$/.test(table.name))throw Error('UI11_DB_TABLE_IDENTIFIER_INVALID');
   const target='"'+table.schema+'"."'+table.name+'"';
   const row=(await db.query(`SELECT count(*)::text n,md5(COALESCE(string_agg(to_jsonb(row)::text,E'\\n' ORDER BY to_jsonb(row)::text),'')) fingerprint FROM ${target} row`)).rows[0];
   state.push({...table,n:String(row.n),fingerprint:row.fingerprint});
  }
  await db.query('COMMIT');
  return{status:'PASS',scope:'READ_ONLY_DB_SNAPSHOT',tables:state.length,migrations:46,hash:createHash('sha256').update(JSON.stringify(state)).digest('hex'),databaseWrites:0};
 }finally{await db.end();}
}
async function checkedGet(path,expectedStatus,expectedHash){
 const ca=await readFile('D:/Project/Anvil/.av3-data/dev-tls/ca.cert.pem');
 return await new Promise((resolve,reject)=>{
  const request=get({hostname:'localhost',port:3830,path,ca,rejectUnauthorized:true,agent:false},response=>{
   const chunks=[];let length=0;
   response.on('data',chunk=>{length+=chunk.length;if(length>1048576)request.destroy(Error('UI11_HTTP_BODY_TOO_LARGE'));else chunks.push(chunk);});
   response.on('end',()=>{try{const body=Buffer.concat(chunks),hash=checkRuntimeResponse(response.statusCode,body,expectedStatus,expectedHash);resolve({path,status:response.statusCode,hash,body});}catch(e){reject(e);}});
   response.on('error',reject);
  });
  request.setTimeout(2000,()=>request.destroy(Error('UI11_HTTP_TIMEOUT')));
  request.on('error',error=>reject(Error(runtimeRequestFailure(error))));
 });
}
async function httpSnapshot(mode){
 const current=mode==='--http-new',facts=[];
 const health=await checkedGet('/api/v1/health',200);checkRuntimeHealth(health.body);facts.push({path:health.path,status:health.status});
 for(const target of runtimeHttpTargets(current?'--http-new':'--http-old')){
  const asset=await checkedGet(target.path,200,target.hash);facts.push({path:asset.path,status:asset.status,hash:asset.hash});
 }
 if(current){const denied=await checkedGet('/api/v1/projects/00000000-0000-4000-8000-000000000000/source-read-grants',401);facts.push({path:denied.path,status:denied.status});}
 return{status:'PASS',scope:current?'NEW_RUNTIME_HTTP':'ROLLBACK_RUNTIME_HTTP',facts,authenticatedRequests:0,databaseWrites:0};
}
async function browserSnapshot(){
 const profile=resolve('D:/tmp/anvil-v3-stage-b/browser/ui11-n4-served-01/profile');
 const meta=await lstat(profile);
 if(!meta.isDirectory()||meta.isSymbolicLink()||(await realpath(profile)).toLowerCase()!==profile.toLowerCase()||(await readdir(profile)).length)throw Error('UI11_BROWSER_PROFILE_NOT_NEW');
 const require=createRequire(resolve(process.cwd(),'package.json')),{chromium}=require('@playwright/test');
 let context;
 const pageErrors=[],facts={requests:0,nonGet:0,offOrigin:0,assetErrors:0,apiErrors:0,otherHttpErrors:0};
 try{
  context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,ignoreHTTPSErrors:false,timeout:5000,viewport:{width:1440,height:900}});
  const page=context.pages()[0]??await context.newPage();
  page.on('pageerror',()=>pageErrors.push(true));
  page.on('request',request=>{facts.requests++;if(request.method()!=='GET')facts.nonGet++;const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&url.origin!=='https://localhost:3830')facts.offOrigin++;});
  page.on('response',response=>{const url=new URL(response.url()),path=url.pathname,status=response.status();if(status<400)return;if(path.startsWith('/assets/'))facts.assetErrors++;else if(path.startsWith('/api/')&&!(path==='/api/v1/session'&&status===401))facts.apiErrors++;else if(!path.startsWith('/api/'))facts.otherHttpErrors++;});
  const response=await page.goto('https://localhost:3830/',{waitUntil:'domcontentloaded',timeout:8000});
  if(response?.status()!==200)throw Error('UI11_BROWSER_INDEX_FAILED');
  await page.locator('#root input[type=password]').first().waitFor({state:'visible',timeout:4000});
  await page.waitForLoadState('networkidle',{timeout:3000});
  const authCookies=(await context.cookies()).filter(c=>c.name==='__Host-anvil.sid').length;
  if(pageErrors.length||facts.nonGet||facts.offOrigin||facts.assetErrors||facts.apiErrors||authCookies)throw Error('UI11_BROWSER_READONLY_GATE_FAILED');
  return{status:'PASS',scope:'ANONYMOUS_BASIC_PAGE_ONLY',browser:context.browser()?.version()??'UNVERIFIED',pageErrors:0,authenticatedCookies:0,...facts,loginPerformed:false,dbUserJourneyVerified:false};
 }finally{
  if(context){
   let timer;
   try{await Promise.race([context.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('UI11_BROWSER_CLOSE_UNCONFIRMED')),3000);})]);}
   finally{if(timer)clearTimeout(timer);}
  }
 }
}
async function main(){
 const mode=process.argv[1]?.startsWith('--')?process.argv[1]:process.argv[2];
 if(mode==='--plan'){console.log(JSON.stringify({mode:'PLAN',databaseWrites:0,secretReads:0,requests:0}));return;}
 let timer;
 try{
  if(!['--db','--http-new','--http-old','--http-original','--browser'].includes(mode))throw Error('UI11_PROBE_BINDING_INVALID');
  const expiry=bind(mode);
  timer=setTimeout(()=>{console.log(JSON.stringify({status:'FAIL',failure:'UI11_PROBE_DEADLINE'}));process.exit(1);},Math.min(30000,expiry-Date.now()));
  const report=mode==='--db'?await dbSnapshot():mode==='--browser'?await browserSnapshot():await httpSnapshot(mode);
  console.log(JSON.stringify(report));
 }catch(e){console.log(JSON.stringify({status:'FAIL',failure:e instanceof Error&&/^UI11_[A-Z0-9_]{1,90}$/.test(e.message)?e.message:'UI11_PROBE_STEP_FAILED',...(typeof e?.code==='string'&&/^[0-9A-Z]{5}$/.test(e.code)?{code:e.code}:{})}));process.exitCode=1;}
 finally{if(timer)clearTimeout(timer);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href||process.env.ANVIL_UI11_RUNTIME_INLINE==='1'&&['--db','--http-new','--http-old','--http-original','--browser'].includes(process.argv[1]))await main();
