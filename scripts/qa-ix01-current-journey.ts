import {execFileSync,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {constants,lstatSync,realpathSync,readSync,readdirSync,mkdirSync,openSync,fstatSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {readCurrentSchemaManifest,verifyCurrentSchemaSources,type SchemaMigrationBaseline} from '../tests/integration/IX01/current-schema-baseline.ts';
import {installCurrentSchema,type CurrentSchemaInstallationPorts,type CurrentSchemaInstallationResult} from '../tests/integration/IX01/current-schema-installation.ts';

export const currentProfile=Object.freeze({
 source:'/home/daon/anvil-ix01-current-tc01-20261108-a1-qa',
 receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-current-tc01-20261108-a1',
 artifact:'/tmp/anvil-v3-ix01-current-tc01-20261108-a1',
 container:'anvil-ix01-current-tc01-pg-20261108-a1',network:'anvil-ix01-current-tc01-net-20261108-a1',
 database:'anvil_v3_ix01_current_tc01_20261108_a1',owner:'IX01_CURRENT_TC01_20261108_A1',
 uid:1000,daemon:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',image:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',
 node:'/opt/node-v24.22.1-linux-x64/bin/node',nodeHash:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb',
 npm:'/opt/node-v24.22.1-linux-x64/lib/node_modules/npm/bin/npm-cli.js',npmHash:'8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7',
 npmPackage:'/opt/node-v24.22.1-linux-x64/lib/node_modules/npm/package.json',npmPackageHash:'f6478d5600180a23f73e4217610c7709a71cedb4ae13f6c3e15ecb457f5d4fd6',
 npmVersion:'11.19.1',git:'/usr/bin/git',docker:'/usr/bin/docker',socket:'unix:///var/run/docker.sock',
 legacyHash:'b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733',
 manifest:'docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv',
 launcher:'scripts/qa-ix01-current-journey.ts',child:'tests/integration/IX01/current-methodology-journey.test.ts',legacy:'scripts/qa-ix01-schema-closure.sh',
 forms:'docs/design/공식산출물_양식정의.md',standard:'docs/design/문서작성_공통기준.md',methods:'docs/design/기본방법론_상세검토안.md',
});
const f=currentProfile;
const requiredSources=Object.freeze([f.launcher,f.child,f.legacy,f.manifest,f.forms,f.standard,f.methods,'package.json','package-lock.json',
 'tests/integration/IX01/current-schema-baseline.ts','tests/integration/IX01/current-schema-installation.ts',
 'tests/integration/IX01/methodology-copy-application-scenario.ts','tests/integration/IX01/journey-context-lifecycle.ts',
 'tests/integration/FN12/result-qa-fence.ts']);
const hex=(v:unknown,size:number):v is string=>typeof v==='string'&&v.length===size&&/^[0-9a-f]+$/.test(v);
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const exact=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(key=>Object.hasOwn(v,key));
const fail=(code:string):never=>{throw Error(code);};
const nowBound=1_800_000,pgBound=600_000;
/** 기한에는 이 실행기가 시작한 로컬 직접 자식만 종료한다. 원격 작업의 정착을 증명하지 않는다. */
export function currentLocalTimeoutOptions(timeout:number){
 if(!Number.isSafeInteger(timeout)||timeout<1)fail('IX01_CURRENT_DEADLINE');
 return {timeout,killSignal:'SIGKILL'} as const;
}
type SourceFact={path:string;sha256:string};
export interface CurrentPlan{schemaVersion:1;purpose:'IX01_CURRENT_TC01';profile:string;sourceHead:string;issuedAt:number;expiresAt:number;gitHash:string;dockerHash:string;sourceFiles:SourceFact[]}
export interface CurrentAuthorization{readonly plan:CurrentPlan;readonly planHash:string;readonly approvalHash:string;readonly approvalId:string}
export interface CurrentInput{planRaw:string;planHash:string;approvalRaw:string;approvalHash:string}
type SqlInput={id:string;path:string;bytes:Uint8Array};
interface Prepared{historical:Uint8Array;sql:SqlInput[]}
interface Isolation{containerId:string;networkId:string;host:string}
interface CurrentHandoff extends Isolation{
 schemaVersion:1;purpose:'IX01_CURRENT_TC01_CHILD';profile:string;planHash:string;approvalHash:string;sourceHead:string;expiresAt:number;ledgerHash:string;
}
export interface CurrentPorts{
 now():number;assertCurrent():void;
 preflight(auth:CurrentAuthorization):Promise<Prepared>;
 claim(auth:CurrentAuthorization):Promise<'CLAIMED'|'DUPLICATE'>;
 prepareRuntime():Promise<void>;
 start():Promise<string>;
 schema:CurrentSchemaInstallationPorts;
 secure():Promise<void>;
 connect(containerId:string):Promise<Isolation&{expiresAt:number}>;
 child(handoff:Readonly<CurrentHandoff>):Promise<unknown>;
 cleanup(handoff:Readonly<CurrentHandoff>):Promise<void>;
 record(result:CurrentResult):Promise<void>;
}
type Stage='PREFLIGHT'|'CLAIM'|'RUNTIME'|'START'|'INSTALL'|'SECURE'|'NETWORK'|'CHILD'|'CLEANUP'|'RECORD';
export interface CurrentResult{
 readonly status:'REJECTED'|'UNKNOWN'|'CLEANED';readonly stage:Stage;readonly code:string;
 readonly planHash:string|null;readonly containerId:string|null;readonly networkId:string|null;
 readonly schema:CurrentSchemaInstallationResult|null;
 readonly evidence:'RETAINED_WHEN_CREATED';
}

function rawJson(raw:string,hash:string,max=32768):unknown{
 if(typeof raw!=='string'||Buffer.byteLength(raw)>max||!hex(hash,64)||contentHash(raw)!==hash)fail('IX01_CURRENT_HASH_INVALID');
 try{return parseWireJson(raw);}catch{return fail('IX01_CURRENT_JSON_INVALID');}
}
function requireTime(start:unknown,end:unknown,at:number){
 if(typeof start!=='number'||typeof end!=='number'||![start,end,at].every(Number.isSafeInteger)||start>at||end<=at||end-start>nowBound)fail('IX01_CURRENT_DEADLINE');
}
export function readCurrentAuthorization(input:CurrentInput,at:number):CurrentAuthorization{
 const p=rawJson(input.planRaw,input.planHash),a=rawJson(input.approvalRaw,input.approvalHash);
 if(!exact(p,['schemaVersion','purpose','profile','sourceHead','issuedAt','expiresAt','gitHash','dockerHash','sourceFiles'])
  ||p.schemaVersion!==1||p.purpose!=='IX01_CURRENT_TC01'||p.profile!==f.owner||!hex(p.sourceHead,40)||!hex(p.gitHash,64)||!hex(p.dockerHash,64)
  ||!Array.isArray(p.sourceFiles)||p.sourceFiles.length!==requiredSources.length
  ||p.sourceFiles.some((row,index)=>!exact(row,['path','sha256'])||row.path!==requiredSources[index]||!hex(row.sha256,64)||row.path===f.legacy&&row.sha256!==f.legacyHash))return fail('IX01_CURRENT_PLAN_INVALID');
 requireTime(p.issuedAt,p.expiresAt,at);
 if(!exact(a,['schemaVersion','purpose','profile','decision','approvalId','planHash','sourceHead','issuedAt','expiresAt'])
  ||a.schemaVersion!==1||a.purpose!=='IX01_CURRENT_TC01_RUN_APPROVAL'||a.profile!==f.owner||a.decision!=='ALLOW_ONE_RUN'||!uuid(a.approvalId)
  ||a.planHash!==input.planHash||a.sourceHead!==p.sourceHead||a.issuedAt!==p.issuedAt||a.expiresAt!==p.expiresAt)return fail('IX01_CURRENT_APPROVAL_REQUIRED');
 const plan=p as unknown as CurrentPlan;
 for(const row of plan.sourceFiles)Object.freeze(row);
 Object.freeze(plan.sourceFiles);
 return Object.freeze({plan:Object.freeze(plan),planHash:input.planHash,approvalHash:input.approvalHash,approvalId:a.approvalId});
}
export const currentRequiredSources=requiredSources;
const address=(v:unknown):v is string=>typeof v==='string'&&/^172\.(1[6-9]|2\d|3[01])\.(?:0|[1-9]\d{0,2})\.(?:[1-9]\d{0,2})$/.test(v)&&v.split('.').every(n=>Number(n)<=254);
export function currentLedgerHash(historical:Uint8Array){
 return contentHash(canonicalJson(readCurrentSchemaManifest(historical).map(({id,sha256})=>({id,checksum:sha256}))));
}
export function verifyCurrentHandoff(raw:string,digest:string,auth:CurrentAuthorization,historical:Uint8Array,at:number):Readonly<CurrentHandoff>{
 const h=rawJson(raw,digest,4096);
 if(!exact(h,['schemaVersion','purpose','profile','planHash','approvalHash','sourceHead','expiresAt','ledgerHash','containerId','networkId','host'])
  ||h.schemaVersion!==1||h.purpose!=='IX01_CURRENT_TC01_CHILD'||h.profile!==f.owner||h.planHash!==auth.planHash||h.approvalHash!==auth.approvalHash||h.sourceHead!==auth.plan.sourceHead
  ||typeof h.expiresAt!=='number'||!Number.isSafeInteger(h.expiresAt)||h.expiresAt<=at||h.expiresAt>auth.plan.expiresAt||h.expiresAt-at>pgBound
  ||h.ledgerHash!==currentLedgerHash(historical)||!hex(h.containerId,64)||!hex(h.networkId,64)||h.containerId===h.networkId||!address(h.host))return fail('IX01_CURRENT_HANDOFF_INVALID');
 return Object.freeze(h as unknown as CurrentHandoff);
}
export function verifyCurrentChildOutcome(value:unknown,handoffHash:string):boolean{
 if(!exact(value,['status','signal','stdout','stderr','result'])||value.status!==0||value.signal!==null||typeof value.stdout!=='string'||value.stderr!=='')return false;
 const {stdout}=value;
 return Buffer.byteLength(stdout)<=8192&&/^TAP version 13\r?\n/.test(stdout)&&!/\bnot ok\b|Bail out!|# SKIP|# TODO|\x1b/.test(stdout)
  &&[ /^1\.\.1\r?$/gm,/^ok 1 - IX01 TC01 현재 격리 저장 여정\r?$/gm,/^# tests 1\r?$/gm,/^# pass 1\r?$/gm,/^# fail 0\r?$/gm,/^# cancelled 0\r?$/gm,/^# skipped 0\r?$/gm,/^# todo 0\r?$/gm].every(pattern=>[...stdout.matchAll(pattern)].length===1)
  &&[...stdout.matchAll(/^ok [0-9]+(?: |$)/gm)].length===1
  &&exact(value.result,['schemaVersion','purpose','handoffHash','ledgerCount','status'])&&value.result.schemaVersion===1
  &&value.result.purpose==='IX01_CURRENT_TC01_CHILD_RESULT'&&value.result.handoffHash===handoffHash&&value.result.ledgerCount===112&&value.result.status==='PASSED';
}
export async function runCurrentJourney(input:CurrentInput,ports:CurrentPorts):Promise<CurrentResult>{
 let auth:CurrentAuthorization|null=null,stage:Stage='PREFLIGHT',containerId:string|null=null,networkId:string|null=null,schema:CurrentSchemaInstallationResult|null=null,claimed=false,claimStarted=false;
 const result=(status:CurrentResult['status'],code:string):CurrentResult=>Object.freeze({status,stage,code,planHash:auth?.planHash??null,containerId,networkId,schema,evidence:'RETAINED_WHEN_CREATED'});
 try{auth=readCurrentAuthorization(input,ports.now());}catch{return result('REJECTED','APPROVAL_OR_PLAN_INVALID');}
 const deadline=auth.plan.expiresAt;
 let observedAt=auth.plan.issuedAt;
 const fresh=()=>{const at=ports.now();if(!Number.isSafeInteger(at)||at<observedAt||at>=deadline)fail('IX01_CURRENT_DEADLINE');observedAt=at;ports.assertCurrent();};
 const call=async <T>(work:()=>Promise<T>)=>{fresh();const value=await work();fresh();return value;};
 try{
  const {historical,sql}=await call(()=>ports.preflight(auth!));
  verifyCurrentSchemaSources(historical,sql);
  const tsv=new Uint8Array(historical),sources=sql.map(row=>({id:row.id,path:row.path,bytes:new Uint8Array(row.bytes)}));
  stage='CLAIM';fresh();claimStarted=true;
  const claim=await ports.claim(auth);
  if(claim==='DUPLICATE'){claimStarted=false;return result('REJECTED','ALREADY_CLAIMED');}
  if(claim!=='CLAIMED')fail('IX01_CURRENT_CLAIM_UNKNOWN');
  claimed=true;fresh();
  stage='RUNTIME';await call(()=>ports.prepareRuntime());
  stage='START';const started=await call(()=>ports.start());if(!hex(started,64))fail('IX01_CURRENT_OWNER');containerId=started;
  stage='INSTALL';
  const installPorts:CurrentSchemaInstallationPorts={
   assertCurrent(){fresh();ports.schema.assertCurrent();},
   install:(raw,row)=>ports.schema.install(raw,row),
   appendLedger:row=>ports.schema.appendLedger(row),readLedger:()=>ports.schema.readLedger(),
  };
  schema=await installCurrentSchema(tsv,sources,installPorts);
  if(schema.status!=='VERIFIED')fail('IX01_CURRENT_INSTALL_STOPPED');
  stage='SECURE';await call(()=>ports.secure());
  stage='NETWORK';const isolation=await call(()=>ports.connect(containerId!));
  if(!exact(isolation,['containerId','networkId','host','expiresAt'])||isolation.containerId!==containerId||!hex(isolation.networkId,64)||isolation.networkId===containerId||!address(isolation.host)||!Number.isSafeInteger(isolation.expiresAt)||isolation.expiresAt<=ports.now()||isolation.expiresAt>deadline)fail('IX01_CURRENT_NETWORK');
  networkId=isolation.networkId;
  const handoff=Object.freeze({schemaVersion:1,purpose:'IX01_CURRENT_TC01_CHILD',profile:f.owner,planHash:auth.planHash,approvalHash:auth.approvalHash,sourceHead:auth.plan.sourceHead,expiresAt:Math.min(ports.now()+90_000,isolation.expiresAt),ledgerHash:currentLedgerHash(tsv),containerId:containerId!,networkId,host:isolation.host} as const);
  const raw=canonicalJson(handoff),digest=contentHash(raw);verifyCurrentHandoff(raw,digest,auth,tsv,ports.now());
  stage='CHILD';const child=await call(()=>ports.child(handoff));if(!verifyCurrentChildOutcome(child,digest))fail('IX01_CURRENT_CHILD_UNKNOWN');
  if(ports.now()>=handoff.expiresAt)fail('IX01_CURRENT_CHILD_UNKNOWN');
  stage='CLEANUP';await call(()=>ports.cleanup(handoff));
  stage='RECORD';const done=result('CLEANED','TC01_PASSED');await call(()=>ports.record(done));return done;
 }catch{
  const stopped=result(claimStarted?'UNKNOWN':'REJECTED',schema?.status==='STOPPED'?schema.reason:'STOPPED_'+stage);
  if(claimed&&stage!=='RECORD')try{await ports.record(stopped);}catch{/* 추가 실행 없이 감사 미정착을 보존한다. */}
  return stopped;
 }
}

const gitEnv={
 PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:f.receipt,
 GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',
 GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PAGER:'cat',
};
const planPath=f.receipt+'-plan.json',approvalPath=f.receipt+'-approval.json';
const intentPath=f.receipt+'/intent.json',handoffPath=f.receipt+'/handoff.json',childResultPath=f.receipt+'/child-result.json';
const configPath=f.receipt+'/docker-config';
type FileFact={dev:number;ino:number;uid:number;mode:number;size:number;mtimeMs:number;ctimeMs:number};
const unchangedFile=(a:FileFact,b:FileFact)=>a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid&&a.mode===b.mode&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
function plainFile(path:string,uid:number,max:number,mode?:number):Buffer{
 const before=lstatSync(path);
 if(!before.isFile()||before.nlink!==1||before.uid!==uid||(before.mode&0o022)!==0||before.size>max
  ||mode!==undefined&&(before.mode&0o777)!==mode||realpathSync(path)!==path)fail('IX01_CURRENT_FILE');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  if(!unchangedFile(before,fstatSync(fd)))fail('IX01_CURRENT_FILE');
  const bytes=Buffer.alloc(before.size+1);
  let total=0;
  while(total<bytes.length){const count=readSync(fd,bytes,total,bytes.length-total,null);if(count===0)break;total+=count;}
  if(total!==before.size||!unchangedFile(before,fstatSync(fd))||!unchangedFile(before,lstatSync(path)))fail('IX01_CURRENT_FILE');
  return bytes.subarray(0,total);
 }finally{closeSync(fd);}
}
function syncDirectory(path:string){
 const fd=openSync(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
 try{fsyncSync(fd);}finally{closeSync(fd);}
}
function createExclusive(path:string,raw:string,check:()=>void){
 check();const fd=openSync(path,'wx',0o600);
 try{writeFileSync(fd,raw,'utf8');fsyncSync(fd);}finally{closeSync(fd);}
 check();syncDirectory(path.slice(0,path.lastIndexOf('/')));
 if(plainFile(path,f.uid,65536,0o600).toString('utf8')!==raw)fail('IX01_CURRENT_DURABILITY');
}
function missing(path:string){
 try{lstatSync(path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
 fail('IX01_CURRENT_RESOURCE_EXISTS');
}
function directoryPins(){
 const pins=new Map<string,{dev:number;ino:number;uid:number;mode:number}>();
 const pin=(path:string,privateLeaf=false)=>{
  let cursor='';
  for(const segment of path.split('/').filter(Boolean)){
   cursor+='/'+segment;const s=lstatSync(cursor);
   if(!s.isDirectory()||!([0,f.uid] as number[]).includes(s.uid)||((s.mode&0o022)!==0&&!(cursor==='/tmp'&&s.uid===0&&(s.mode&0o7777)===0o1777))
    ||cursor===path&&privateLeaf&&(s.uid!==f.uid||(s.mode&0o777)!==0o700))fail('IX01_CURRENT_DIRECTORY');
   const prior=pins.get(cursor);
   if(prior&&(prior.dev!==s.dev||prior.ino!==s.ino||prior.uid!==s.uid||prior.mode!==s.mode))fail('IX01_CURRENT_DIRECTORY_CHANGED');
   pins.set(cursor,{dev:s.dev,ino:s.ino,uid:s.uid,mode:s.mode});
  }
  if(realpathSync(path)!==path)fail('IX01_CURRENT_DIRECTORY');
 };
 const check=()=>{for(const [path,prior] of pins){
  const s=lstatSync(path);if(!s.isDirectory()||prior.dev!==s.dev||prior.ino!==s.ino||prior.uid!==s.uid||prior.mode!==s.mode)fail('IX01_CURRENT_DIRECTORY_CHANGED');
 }};
 return {pin,check};
}
function tooling(path:string,sha:string,max=160*1024*1024,mode?:number){
 if(contentHash(plainFile(path,0,max,mode))!==sha)fail('IX01_CURRENT_TOOL');
 const pinned=lstatSync(path);
 return ()=>{if(!unchangedFile(pinned,lstatSync(path)))fail('IX01_CURRENT_TOOL_CHANGED');};
}
const childFlags=['--test','--test-isolation=none','--test-reporter=tap'];
function verifiedHost(auth:CurrentAuthorization,child=false){
 if(process.platform!=='linux'||process.getuid?.()!==f.uid||process.cwd()!==f.source||realpathSync(f.source)!==f.source||process.execPath!==f.node||!same(process.execArgv,child?childFlags:[]))fail('IX01_CURRENT_HOST');
 const checkNode=tooling(f.node,f.nodeHash,160*1024*1024,0o755),checkGit=tooling(f.git,auth.plan.gitHash);
 const pins=directoryPins();pins.pin(f.source,true);pins.pin(f.source+'/.git');pins.pin(f.receipt.slice(0,f.receipt.lastIndexOf('/')));
 const original=Date.now(),mono=performance.now();
 let last=original;
 const time=()=>last=Math.ceil(Math.max(last,Date.now(),original+performance.now()-mono));
 const fresh=()=>{if(time()>=auth.plan.expiresAt)fail('IX01_CURRENT_DEADLINE');pins.check();checkNode();checkGit();};
 const git=(args:string[],maxBuffer=65536)=>{fresh();const out=execFileSync(f.git,['--no-pager','--no-optional-locks','--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.attributesFile=/dev/null','-c','core.excludesFile=/dev/null','-c','core.untrackedCache=false',...args],{cwd:f.source,env:gitEnv,encoding:'utf8',...currentLocalTimeoutOptions(Math.min(10_000,auth.plan.expiresAt-time())),maxBuffer,stdio:['ignore','pipe','pipe']});fresh();return out.trim();};
 function sources(){
  fresh();
  const config=plainFile(f.source+'/.git/config',f.uid,8192).toString('utf8');
  if(/\[(?:include|includeIf|filter)|fsmonitor|hooksPath|sshCommand|credential|alternate|worktree/i.test(config))fail('IX01_CURRENT_GIT_CONFIG');
  for(const name of ['objects/info/alternates','info/attributes','config.worktree'])missing(f.source+'/.git/'+name);
  const tracked=git(['ls-files','-v','-z'],2*1024*1024).split('\0');
  if(tracked.pop()!==''||!tracked.length||tracked.some(row=>!row.startsWith('H '))
   ||git(['rev-parse','HEAD'])!==auth.plan.sourceHead||git(['status','--porcelain','--untracked-files=all','--ignore-submodules=none'])!=='')fail('IX01_CURRENT_SOURCE');
  for(const row of auth.plan.sourceFiles){
   if(contentHash(plainFile(f.source+'/'+row.path,f.uid,4*1024*1024))!==row.sha256)fail('IX01_CURRENT_SOURCE');
  }
  fresh();
 }
 return {pins,time,fresh,sources};
}
const intentFor=(auth:CurrentAuthorization)=>canonicalJson({schemaVersion:1,purpose:'IX01_CURRENT_TC01_INTENT',profile:f.owner,approvalId:auth.approvalId,planHash:auth.planHash,approvalHash:auth.approvalHash,sourceHead:auth.plan.sourceHead});
function fileInput(planHash:string,approvalHash:string):CurrentInput{
 if(!hex(planHash,64)||!hex(approvalHash,64)||process.platform!=='linux'||process.getuid?.()!==f.uid)fail('IX01_CURRENT_APPROVAL_REQUIRED');
 return {planHash,approvalHash,planRaw:plainFile(planPath,f.uid,32768,0o600).toString('utf8'),approvalRaw:plainFile(approvalPath,f.uid,32768,0o600).toString('utf8')};
}
function checkedRawFile(path:string,auth:CurrentAuthorization):Buffer{
 const fact=auth.plan.sourceFiles.find(row=>row.path===path);
 if(!fact)return fail('IX01_CURRENT_SOURCE');
 const bytes=plainFile(f.source+'/'+path,f.uid,4*1024*1024);
 if(contentHash(bytes)!==fact.sha256)fail('IX01_CURRENT_SOURCE');
 return bytes;
}
interface LegacyR9{
 DdlFailure:new (...args:never[])=>Error;
 parsePsqlFailure(error:unknown):unknown;
 buildPsqlArgs(id:string,db:string,user:string,path?:string,sha?:string):string[];
 bootstrapSql(database:string,selected:string[]):string;
 roleMetadataSql():string;
 verifyRoleMetadata(raw:string,phase:string,attempted:string[],completed:string[],selected:string[]):{systemHash:string;memberships:{role:string}[]};
 revokeSql(readers:string[],selected:string[]):string;
 finalServerArgs(id:string):string[];parseFinalServer(raw:string):boolean;
}
const r9Entry="if(process.argv[1]==='-')main(process.argv.slice(2),process.env).catch(error=>{console.error(JSON.stringify(safeFailure(error)));process.exitCode=1;});";
export function currentLegacyModuleSource(bytes:Uint8Array,expectedSha:string){
 if(expectedSha!==f.legacyHash||bytes.length!==35588||contentHash(bytes)!==expectedSha)fail('IX01_CURRENT_LEGACY_HASH');
 const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes),start='// IX01_CONTROLLER_BEGIN\n',end='// IX01_CONTROLLER_END\n';
 const pieces=source.split(start);
 if(pieces.length!==2)return fail('IX01_CURRENT_LEGACY_SHAPE');
 const body=pieces[1]!.split(end);
 if(body.length!==2||!body[0]!.endsWith(r9Entry+'\n'))return fail('IX01_CURRENT_LEGACY_SHAPE');
 return body[0]!.slice(0,-r9Entry.length-1);
}
const tmpfs=Object.freeze({'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456,uid=999,gid=999','/var/run/postgresql':'rw,noexec,nosuid,size=16777216,uid=999,gid=999','/tmp':'rw,noexec,nosuid,size=16777216,uid=999,gid=999'});
const noEntries=(v:unknown)=>v===null||Array.isArray(v)&&v.length===0||exact(v,[]);
const facts=(value:string):Record<string,any>=>{const obj=parseWireJson(value);if(!obj||typeof obj!=='object'||Array.isArray(obj))return fail('IX01_CURRENT_OBSERVATION');return obj as Record<string,any>;};
const labels=(auth:CurrentAuthorization)=>({'anvil.owner':f.owner,'anvil.instance':auth.plan.sourceHead.slice(0,32),'anvil.plan':auth.planHash});
const labelArgs=(auth:CurrentAuthorization)=>Object.entries(labels(auth)).flatMap(([k,v])=>['--label',k+'='+v]);
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const containerFormat='{"id":{{json .Id}},"name":{{json .Name}},"image":{{json .Image}},"user":{{json .Config.User}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"host":{{json .HostConfig}},"mounts":{{json .Mounts}},"networks":{{json .NetworkSettings.Networks}},"ports":{{json .NetworkSettings.Ports}}}';
const networkFormat='{"id":{{json .Id}},"name":{{json .Name}},"driver":{{json .Driver}},"internal":{{json .Internal}},"labels":{{json .Labels}},"containers":{{json .Containers}}}';
const ledgerSql="SELECT COALESCE(json_agg(json_build_object('id',id,'checksum',checksum) ORDER BY id),'[]'::json)::text FROM anvil.schema_migrations;";
const hba='local all all trust\nhost all all 0.0.0.0/0 scram-sha-256\nhost all all ::0/0 reject\n';

function actualPorts(input:CurrentInput,auth:CurrentAuthorization):CurrentPorts{
 const host=verifiedHost(auth),checkDocker=tooling(f.docker,auth.plan.dockerHash);
 const checkNpm=tooling(f.npm,f.npmHash,54,0o755),checkNpmPackage=tooling(f.npmPackage,f.npmPackageHash,6597,0o644);
 host.pins.pin('/tmp');host.pins.pin(realpathSync('/var/run'));
 const sock=realpathSync('/var/run/docker.sock'),socket=lstatSync(sock);
 if(sock!=='/run/docker.sock'&&sock!=='/var/run/docker.sock'||!socket.isSocket()||socket.uid!==0||(socket.mode&0o002)!==0)fail('IX01_CURRENT_DOCKER_SOCKET');
 let pgUntil=auth.plan.expiresAt,legacy:LegacyR9|undefined,claimed=false,containerId='',networkId='',attached=false;
 let passwords:{bootstrap:string;app:string;migrator:string}|undefined;
 let expected:readonly SchemaMigrationBaseline[]=[],systemHash='';
 const installed:string[]=[];
 const assertCurrent=()=>{
  host.fresh();checkDocker();
  if(host.time()>=pgUntil)fail('IX01_CURRENT_PG_DEADLINE');
  const live=lstatSync(sock);if(!live.isSocket()||live.dev!==socket.dev||live.ino!==socket.ino||live.uid!==socket.uid||live.mode!==socket.mode||realpathSync('/var/run/docker.sock')!==sock)fail('IX01_CURRENT_DOCKER_SOCKET');
  if(claimed&&plainFile(intentPath,f.uid,4096,0o600).toString('utf8')!==intentFor(auth))fail('IX01_CURRENT_INTENT');
 };
 const duration=(cap:number)=>Math.min(cap,pgUntil-host.time(),auth.plan.expiresAt-host.time());
 function run(file:string,args:string[],input?:string|Uint8Array,cap=10_000,extra?:Record<string,string>){
  assertCurrent();
  const value=execFileSync(file,args,{cwd:f.source,env:{...gitEnv,...extra},input,encoding:'utf8',maxBuffer:65536,...currentLocalTimeoutOptions(duration(cap)),stdio:['pipe','pipe','pipe']});
  assertCurrent();return value;
 }
 const dockRaw=(args:string[],input?:string|Uint8Array,cap?:number,extra?:Record<string,string>)=>{
  assertCurrent();if(readdirSync(configPath).length)fail('IX01_CURRENT_DOCKER_CONFIG');
  return run(f.docker,['--config',configPath,'--host',f.socket,...args],input,cap,extra);
 };
 const daemon=()=>{
  if(!same(facts(dockRaw(['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}'])),{ID:f.daemon,Name:'SINSAN'}))fail('IX01_CURRENT_DAEMON');
 };
 const docker=(args:string[],input?:string|Uint8Array,cap?:number,extra?:Record<string,string>)=>{daemon();return dockRaw(args,input,cap,extra);};
 const inspect=()=>{
  if(!hex(containerId,64))return fail('IX01_CURRENT_CONTAINER_ID');
  const v=facts(docker(['container','inspect','--format',containerFormat,containerId])),h=v.host;
  if(v.id!==containerId||v.name!=='/'+f.container||v.image!==f.image||v.user!=='999:999'||!same(v.labels,labels(auth))||typeof v.running!=='boolean'
    ||!h||h.Privileged!==false||h.ReadonlyRootfs!==true||h.NetworkMode!=='none'||h.LogConfig?.Type!=='none'||!noEntries(h.LogConfig.Config)
    ||!same(h.CapDrop,['ALL'])||!same(h.SecurityOpt,['no-new-privileges'])||h.PidsLimit!==64||h.Memory!==536870912||h.NanoCpus!==1000000000
    ||h.PublishAllPorts!==false||!noEntries(h.PortBindings)||!noEntries(h.Binds)||!noEntries(h.Mounts)||!noEntries(h.VolumesFrom)||!same(h.Tmpfs,tmpfs)
    ||!Array.isArray(v.mounts)||v.mounts.some(m=>!m||m.Type!=='tmpfs'||!Object.hasOwn(tmpfs,m.Destination)||m.RW!==true||m.Source!==undefined&&m.Source!=='')
    ||new Set(v.mounts.map(m=>m.Destination)).size!==v.mounts.length
    ||v.ports!==null&&(!exact(v.ports,['5432/tcp'])||v.ports['5432/tcp']!==null)&&!exact(v.ports,[]))fail('IX01_CURRENT_CONTAINER_OWNER');
  return v;
 };
 const noNetwork=(v:Record<string,any>)=>v.networks===null||exact(v.networks,[]);
 const none=(v:Record<string,any>)=>{
  if(!exact(v.networks,['none']))return false;
  const n=v.networks.none as {NetworkID?:unknown;IPAddress?:unknown}|null;
  return hex(n?.NetworkID,64)&&n?.IPAddress==='';
 };
 const onlyNone=()=>{const v=inspect();if(!v.running||!none(v))fail('IX01_CURRENT_NONE_ONLY');return v;};
 function readNetwork(){
  if(!hex(networkId,64))return fail('IX01_CURRENT_NETWORK');
  const v=facts(docker(['network','inspect','--format',networkFormat,networkId]));
  if(v.id!==networkId||v.name!==f.network||v.driver!=='bridge'||v.internal!==true||!same(v.labels,labels(auth)))fail('IX01_CURRENT_NETWORK');
  return v;
 }
 const emptyEndpoints=(v:unknown)=>v===null||exact(v,[]);
 function attachedHost(){
  const n=readNetwork(),v=inspect(),entry=n.containers?.[containerId],local=v.networks?.[f.network];
  const ip=typeof entry?.IPv4Address==='string'&&/^(172\.[0-9.]+)\/(?:1[6-9]|2[0-9]|3[0-2])$/.exec(entry.IPv4Address)?.[1];
  if(!v.running||!exact(v.networks,[f.network])||!exact(n.containers,[containerId])||entry?.Name!==f.container||!address(ip)
   ||local?.NetworkID!==networkId||local?.IPAddress!==ip||!hex(local?.EndpointID,64)||local.EndpointID!==entry.EndpointID) return fail('IX01_CURRENT_NETWORK');
  return ip;
 }
 const sql=(user:string,raw:string|Uint8Array,cap=30_000,row?:SchemaMigrationBaseline)=>{
  const owner=attached?attachedHost:onlyNone;
  owner();
  const output=docker(legacy!.buildPsqlArgs(containerId,f.database,user,row?.path,row?.sha256),raw,cap);
  owner();return output;
 };
 const bootstrap='anvil_v3_bootstrap',migrator='anvil_v3_migrator',app='anvil_v3_app';
 const paths=()=>expected.map(row=>row.path);
 const roles=(phase:'PRISTINE'|'INSTALLER'|'SETTLED'|'REVOKED')=>{
  const v=legacy!.verifyRoleMetadata(sql(bootstrap,legacy!.roleMetadataSql(),10_000).trim(),phase,installed,installed,paths());
  if(!hex(v.systemHash,64)||systemHash&&v.systemHash!==systemHash)fail('IX01_CURRENT_ROLE');
  systemHash=v.systemHash;return v;
 };
 return {
  now:host.time,assertCurrent,
  async preflight(){
   host.sources();
   missing(f.source+'/.npmrc');missing(f.source+'/node_modules');missing(f.artifact);
   const historical=checkedRawFile(f.manifest,auth);
   expected=readCurrentSchemaManifest(historical);
   const inputs=expected.map(row=>({id:row.id,path:row.path,bytes:plainFile(f.source+'/'+row.path,f.uid,row.bytes)}));
   verifyCurrentSchemaSources(historical,inputs);
   const r9=auth.plan.sourceFiles.find(row=>row.path===f.legacy)!;
   const source=currentLegacyModuleSource(checkedRawFile(f.legacy,auth),r9.sha256);
   legacy=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')) as LegacyR9;
   return {historical,sql:inputs};
  },
  async claim(){
   assertCurrent();
   try{mkdirSync(f.receipt,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')return 'DUPLICATE';throw error;}
   host.pins.pin(f.receipt,true);assertCurrent();syncDirectory(f.receipt.slice(0,f.receipt.lastIndexOf('/')));
   createExclusive(intentPath,intentFor(auth),assertCurrent);
   claimed=true;
   return 'CLAIMED';
  },
  async prepareRuntime(){
   for(const path of [configPath,f.receipt+'/npm-cache']){assertCurrent();mkdirSync(path,{mode:0o700});host.pins.pin(path,true);}
   for(const path of [f.receipt+'/npm-user.conf',f.receipt+'/npm-global.conf'])createExclusive(path,'',assertCurrent);
   checkNpm();checkNpmPackage();
   const opts=['--userconfig='+f.receipt+'/npm-user.conf','--globalconfig='+f.receipt+'/npm-global.conf','--cache='+f.receipt+'/npm-cache','--registry=https://registry.npmjs.org/'];
   const lock=facts(checkedRawFile('package-lock.json',auth).toString('utf8'));
   if(lock.lockfileVersion!==3||!lock.packages||Object.entries(lock.packages).some(([key,row]:[string,any])=>key!==''&&(!row||row.link===true||typeof row.resolved!=='string'||!row.resolved.startsWith('https://registry.npmjs.org/')||!/^sha(?:256|384|512)-[A-Za-z0-9+/=]+$/.test(row.integrity))))fail('IX01_CURRENT_NPM_LOCK');
   if(run(f.node,[f.npm,'--version',...opts]).trim()!==f.npmVersion)fail('IX01_CURRENT_NPM_VERSION');
   checkNpm();checkNpmPackage();host.sources();missing(f.source+'/node_modules');missing(f.source+'/.npmrc');
   for(const path of [f.receipt+'/npm-user.conf',f.receipt+'/npm-global.conf'])if(plainFile(path,f.uid,0,0o600).length)fail('IX01_CURRENT_NPM_CONFIG');
   run(f.node,[f.npm,'ci','--ignore-scripts','--no-audit','--no-fund',...opts],undefined,600_000);
   host.pins.pin(f.source+'/node_modules');host.sources();
  },
  async start(){
   const image=facts(docker(['image','inspect','--format','{"id":{{json .Id}},"volumes":{{json .Config.Volumes}}}',f.image]));
   if(image.id!==f.image||!exact(image.volumes,['/var/lib/postgresql/data']))fail('IX01_CURRENT_IMAGE');
   if(docker(['container','ls','-a','--filter','name=^/'+f.container+'$','--format','{{.ID}}']).trim()
     ||docker(['network','ls','--filter','name=^'+f.network+'$','--format','{{.ID}}']).trim())fail('IX01_CURRENT_RESOURCE_EXISTS');
   pgUntil=Math.min(auth.plan.expiresAt,host.time()+pgBound);
   passwords={bootstrap:randomBytes(32).toString('hex'),app:randomBytes(32).toString('hex'),migrator:randomBytes(32).toString('hex')};
   containerId=docker(['create','--pull','never','--name',f.container,'--network','none','--user','999:999','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--log-driver','none','--pids-limit','64','--memory','512m','--cpus','1',
    ...Object.entries(tmpfs).flatMap(([k,v])=>['--tmpfs',k+':'+v]),...labelArgs(auth),'--env','POSTGRES_USER='+bootstrap,'--env','POSTGRES_DB='+f.database,'--env','POSTGRES_PASSWORD','--env','POSTGRES_HOST_AUTH_METHOD=scram-sha-256','--env','POSTGRES_INITDB_ARGS=--auth-local=trust --auth-host=scram-sha-256',f.image,'postgres','-c','listen_addresses=*','-c','log_statement=none','-c','log_min_error_statement=fatal'],undefined,10_000,{POSTGRES_PASSWORD:passwords.bootstrap}).trim();
   const created=inspect();if(created.running||!noNetwork(created)&&!none(created))fail('IX01_CURRENT_CONTAINER_OWNER');
   if(docker(['start',containerId]).trim()!==containerId)fail('IX01_CURRENT_CONTAINER_START');
   onlyNone();let ready=false;
   for(let count=0;count<40;count++){
    onlyNone();
    if(legacy!.parseFinalServer(docker(legacy!.finalServerArgs(containerId)))){
     try{docker(['exec','--user','999:999',containerId,'pg_isready','--host=/var/run/postgresql','--username='+bootstrap,'--dbname='+f.database]);ready=true;break;}
     catch(error){const e=error as {status?:number;signal?:string;code?:string};if(![1,2].includes(e.status??0)||e.signal||e.code)throw error;}
    }
    await new Promise<void>(resolve=>setTimeout(resolve,250));assertCurrent();
   }
   if(!ready)fail('IX01_CURRENT_POSTGRES_READY');
   const db=facts(sql(bootstrap,"SELECT json_build_object('db',current_database(),'owner',pg_get_userbyid(datdba),'socket',inet_server_addr() IS NULL)::text FROM pg_catalog.pg_database WHERE datname=current_database();").trim());
   if(!same(db,{db:f.database,owner:bootstrap,socket:true}))fail('IX01_CURRENT_DATABASE');
   roles('PRISTINE');
   const oldDatabase='anvil_v3_ix01_ddl_20261104_r9_a1',original=legacy!.bootstrapSql(oldDatabase,paths());
   if(original.split(oldDatabase).length!==3)fail('IX01_CURRENT_BOOTSTRAP');
   sql(bootstrap,original.replaceAll(oldDatabase,f.database));roles('INSTALLER');
   return containerId;
  },
  schema:{
   assertCurrent,
   async install(raw,row){
    try{sql(migrator,raw,30_000,row);installed.push(row.path);return 'SETTLED';}
    catch(error){return legacy!.parsePsqlFailure(error) instanceof legacy!.DdlFailure?'DDL_REJECTED':'UNKNOWN';}
   },
   async appendLedger(row){
    if(!/^[a-z0-9_]+$/.test(row.id)||!hex(row.sha256,64))return 'UNKNOWN';
    try{sql(migrator,"INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+row.id+"','"+row.sha256+"');",10_000);return 'SETTLED';}catch{return 'UNKNOWN';}
   },
   async readLedger(){return parseWireJson(sql(migrator,ledgerSql,10_000).trim());},
  },
  async secure(){
   const before=roles('SETTLED'),s=passwords!;
   sql(bootstrap,"BEGIN;SET LOCAL password_encryption='scram-sha-256';ALTER ROLE "+bootstrap+" PASSWORD '"+s.bootstrap+"';ALTER ROLE "+app+" PASSWORD '"+s.app+"';ALTER ROLE "+migrator+" PASSWORD '"+s.migrator+"';COMMIT;");
   onlyNone();
   docker(['exec','-i','--user','999:999',containerId,'sh','-c','umask 077; cat > /var/lib/postgresql/data/pg_hba.conf'],hba);
   onlyNone();
   if(docker(['exec','--user','999:999',containerId,'cat','/var/lib/postgresql/data/pg_hba.conf'])!==hba)fail('IX01_CURRENT_SCRAM');
   const verified=facts(sql(bootstrap,"SELECT json_build_object('reload',pg_reload_conf(),'passwords',(SELECT count(*)=3 FROM pg_authid WHERE rolname IN('anvil_v3_bootstrap','anvil_v3_app','anvil_v3_migrator') AND rolpassword LIKE 'SCRAM-SHA-256$%'),'rules',(SELECT count(*)=3 AND bool_and(error IS NULL) FROM pg_hba_file_rules))::text;").trim());
   if(!same(verified,{reload:true,passwords:true,rules:true}))fail('IX01_CURRENT_SCRAM');
   sql(bootstrap,legacy!.revokeSql(before.memberships.map(row=>row.role),paths()));roles('REVOKED');
  },
  async connect(id){
   if(id!==containerId)fail('IX01_CURRENT_CONTAINER_ID');onlyNone();
   networkId=docker(['network','create','--internal','--driver','bridge',...labelArgs(auth),f.network]).trim();
   if(networkId===containerId||!emptyEndpoints(readNetwork().containers))fail('IX01_CURRENT_NETWORK');
   const v=onlyNone(),noneId=v.networks.none.NetworkID;
   if(!hex(noneId,64))fail('IX01_CURRENT_NONE_ONLY');
   const n=facts(docker(['network','inspect','--format',networkFormat,noneId]));
   if(n.id!==noneId||n.name!=='none'||n.driver!=='null')fail('IX01_CURRENT_NONE_ONLY');
   docker(['network','disconnect',noneId,containerId]);
   const detached=inspect();if(!detached.running||!noNetwork(detached)||!emptyEndpoints(readNetwork().containers))fail('IX01_CURRENT_NETWORK');
   docker(['network','connect',networkId,containerId]);
   const ip=attachedHost();attached=true;
   return {containerId,networkId,host:ip,expiresAt:pgUntil};
  },
  async child(handoff){
   if(handoff.host!==attachedHost()||handoff.containerId!==containerId||handoff.networkId!==networkId)fail('IX01_CURRENT_HANDOFF_INVALID');
   assertCurrent();mkdirSync(f.artifact,{mode:0o700});host.pins.pin(f.artifact,true);
   const raw=canonicalJson(handoff),digest=contentHash(raw);
   createExclusive(handoffPath,raw,assertCurrent);
   createExclusive(f.artifact+'/owner.json',raw,assertCurrent);
   host.sources();assertCurrent();
   const s=passwords!,child=spawnSync(f.node,[...childFlags,f.source+'/'+f.child],{
    cwd:f.source,env:{...gitEnv,ANVIL_IX01_CURRENT_CHILD:'AUTHORIZED_PARENT',ANVIL_IX01_CURRENT_PLAN_SHA256:input.planHash,ANVIL_IX01_CURRENT_APPROVAL_SHA256:input.approvalHash,ANVIL_IX01_CURRENT_HANDOFF_SHA256:digest,ANVIL_IX01_CURRENT_APP_PASSWORD:s.app,ANVIL_IX01_CURRENT_MIGRATOR_PASSWORD:s.migrator},
    encoding:'utf8',...currentLocalTimeoutOptions(duration(Math.min(90_000,handoff.expiresAt-host.time()))),maxBuffer:8192,stdio:['ignore','pipe','pipe'],
   });
   assertCurrent();
   if(child.error||child.status!==0||child.signal||host.time()>=handoff.expiresAt)fail('IX01_CURRENT_CHILD_UNKNOWN');
   const outcome=parseWireJson(plainFile(childResultPath,f.uid,4096,0o600).toString('utf8'));
   return {status:child.status,signal:child.signal,stdout:child.stdout,stderr:child.stderr,result:outcome};
  },
  async cleanup(handoff){
   if(handoff.host!==attachedHost())fail('IX01_CURRENT_NETWORK');
   roles('REVOKED');
   docker(['stop','--time','5',containerId]);
   if(inspect().running)fail('IX01_CURRENT_CONTAINER_STOP');
   docker(['container','rm',containerId]);
   if(!emptyEndpoints(readNetwork().containers))fail('IX01_CURRENT_NETWORK');
   docker(['network','rm',networkId]);
   if(docker(['container','ls','-a','--no-trunc','--filter','id='+containerId,'--format','{{.ID}}']).trim()
      ||docker(['network','ls','--no-trunc','--filter','id='+networkId,'--format','{{.ID}}']).trim())fail('IX01_CURRENT_RESOURCE_REMAINS');
   // 승인·인계·결과와 격리 원문 경로는 별도 감사에 남긴다.
  },
  async record(result){if(claimed)createExclusive(f.receipt+'/result.json',canonicalJson(result),()=>host.pins.check());},
 };
}

export function openCurrentChild(){
 if(process.argv.length!==2||process.argv[1]!==f.source+'/'+f.child)fail('IX01_CURRENT_CHILD_ARGV');
 const env=process.env;
 const childKeys=['ANVIL_IX01_CURRENT_CHILD','ANVIL_IX01_CURRENT_PLAN_SHA256','ANVIL_IX01_CURRENT_APPROVAL_SHA256','ANVIL_IX01_CURRENT_HANDOFF_SHA256','ANVIL_IX01_CURRENT_APP_PASSWORD','ANVIL_IX01_CURRENT_MIGRATOR_PASSWORD'];
 if(Object.keys(env).some(key=>!Object.hasOwn(gitEnv,key)&&!childKeys.includes(key))
    ||Object.entries(gitEnv).some(([key,value])=>env[key]!==value)
    ||env.ANVIL_IX01_CURRENT_CHILD!=='AUTHORIZED_PARENT')fail('IX01_CURRENT_CHILD_ENV');
 const {ANVIL_IX01_CURRENT_PLAN_SHA256:planHash,ANVIL_IX01_CURRENT_APPROVAL_SHA256:approvalHash,ANVIL_IX01_CURRENT_HANDOFF_SHA256:digest,ANVIL_IX01_CURRENT_APP_PASSWORD:appPassword,ANVIL_IX01_CURRENT_MIGRATOR_PASSWORD:migratorPassword}=env;
 if(!hex(planHash,64)||!hex(approvalHash,64)||!hex(digest,64)||!hex(appPassword,64)||!hex(migratorPassword,64)||appPassword===migratorPassword)return fail('IX01_CURRENT_CHILD_ENV');
 const input=fileInput(planHash,approvalHash),auth=readCurrentAuthorization(input,Date.now()),host=verifiedHost(auth,true);
 host.pins.pin(f.receipt,true);host.pins.pin(f.artifact,true);host.sources();
 const raw=plainFile(handoffPath,f.uid,4096,0o600).toString('utf8'),historical=checkedRawFile(f.manifest,auth),handoff=verifyCurrentHandoff(raw,digest,auth,historical,host.time());
 const fresh=()=>{
  host.fresh();if(host.time()>=handoff.expiresAt||plainFile(intentPath,f.uid,4096,0o600).toString('utf8')!==intentFor(auth)
   ||plainFile(handoffPath,f.uid,4096,0o600).toString('utf8')!==raw||plainFile(f.artifact+'/owner.json',f.uid,4096,0o600).toString('utf8')!==raw)fail('IX01_CURRENT_CHILD_SCOPE');
 };
 fresh();
 if(!same(readdirSync(f.artifact),['owner.json']))fail('IX01_CURRENT_CHILD_ARTIFACT');
 createExclusive(f.receipt+'/child-intent.json',canonicalJson({schemaVersion:1,purpose:'IX01_CURRENT_TC01_CHILD_INTENT',handoffHash:digest}),fresh);
 return {
  handoff,historical,appPassword,migratorPassword,fresh,
  sourceBytes(path:string){fresh();return checkedRawFile(path,auth);},
  finish(){createExclusive(childResultPath,canonicalJson({schemaVersion:1,purpose:'IX01_CURRENT_TC01_CHILD_RESULT',handoffHash:digest,ledgerCount:112,status:'PASSED'}),fresh);},
 };
}

function emit(value:unknown){console.log(canonicalJson(value));}
if(import.meta.main){
 void (async()=>{
  const [mode,planHash,approvalHash,...extra]=process.argv.slice(2);
  if(mode==='--plan'&&!planHash&&!approvalHash&&!extra.length){
   emit({purpose:'IX01_CURRENT_TC01_SOURCE',actualApprovalRequired:true,profile:f.owner,source:f.source,planPath,approvalPath,sourceFiles:requiredSources});
   return;
  }
  // 최초 Node 로드의 preload 금지는 별도 실행 승인과 env -i 호출의 선행이다.
  if(mode!=='--run'||extra.length||!hex(planHash,64)||!hex(approvalHash,64)||process.execArgv.length
    ||process.argv[1]!==f.source+'/'+f.launcher||Object.keys(process.env).length)return fail('IX01_CURRENT_RUN_NOT_APPROVED');
  const input=fileInput(planHash,approvalHash),auth=readCurrentAuthorization(input,Date.now()),result=await runCurrentJourney(input,actualPorts(input,auth));
  emit(result);if(result.status!=='CLEANED')process.exitCode=1;
 })().catch(()=>{emit({status:'REJECTED',code:'IX01_CURRENT_RUN_REJECTED'});process.exitCode=1;});
}
