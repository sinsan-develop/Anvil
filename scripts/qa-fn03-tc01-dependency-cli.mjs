import * as fs from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {posix} from 'node:path';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual,types} from 'node:util';

/** @typedef {import('./qa-fn03-tc01-dependency-authorized-entry.ts').Tc01DependencyAuthorizationSystem} System */
/** @typedef {{file:string,args:readonly string[],cwd:string,env:Readonly<Record<string,string>>,timeout:number,killSignal:'SIGKILL',maxBuffer:number,shell:false,stdio:readonly string[]}} Command */
/** @typedef {{context():unknown,now():number,monotonic():number,system:System,execute(c:Command):string,stdin:import('node:stream').Readable}} IO */
const sourceHead='4c44da5d432e561c672021eee14983562ac57b78';
const closureSha='d4a0ca7695ccb7d05d2c9e61e113c2cd6a09d774f59a674aa53c288b1f460132';
const rows=Object.freeze([
 Object.freeze({"path":"contracts/canonical.ts","bytes":2986,"sha256":"5be93c5b92a3bda99baa9bc561e6b535c9c1ab80196601e561903a0b6f74e143"}),
 Object.freeze({"path":"contracts/runtime/validation-v1.ts","bytes":1523,"sha256":"bdfbe4a380c38f5cf3fb885ac167d9bf2c869b30faac540ceeab20bb16bee5d6"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-authorized-entry.ts","bytes":15596,"sha256":"691f540d32da8a0c98c993ecc09c3a63c0788cdcff4d64a21b3b71b6dd9cff34"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-carrier-entry.ts","bytes":7948,"sha256":"97d272bc776cd54992ae8da246e840d609f53806406fd540e15feb811557e615"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-carrier-wire.ts","bytes":8660,"sha256":"0fd5115f692ffbd7b3bac2cff100fdaef892d484d27b488e0c04edfa0240e4b9"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-evidence.ts","bytes":9019,"sha256":"9d04f02138f92e7ed0d658b1d9c025989988642b053dcc909f66881567843268"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-intake.ts","bytes":6600,"sha256":"be189d368418e5963a958fe2a4dbaf4038f0a992a88031cb183840dd40733f25"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-native-ports.ts","bytes":18252,"sha256":"485f8fc220a8b956a8bfce0a413af1dc0cfb624dc900ab8e2c942c1c81519117"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-dependency-preparation.ts","bytes":12133,"sha256":"dbedab6fe7467464b413844639e67b19259fef75131ad416c50e6bf087f6a602"}),
 Object.freeze({"path":"scripts/qa-fn03-tc01-pinned-load.ts","bytes":12568,"sha256":"cc8a6bf00683a6d18ac28f552d5f07182d2632f6d48115f40572ab8a9c9d6b4b"}),
 Object.freeze({"path":"scripts/qa-ix01-current-journey.ts","bytes":64438,"sha256":"a3de404e3397741ceca76e61b766bb3cb240af83d765bf8a978dc4d9cff8a63b"}),
 Object.freeze({"path":"tests/integration/IX01/current-schema-baseline.ts","bytes":9378,"sha256":"6c574464a72cc64fb9f44476d1da6252a69fef2bce2157e95725a864b32d4f9c"}),
 Object.freeze({"path":"tests/integration/IX01/current-schema-installation.ts","bytes":3402,"sha256":"0dbd658f8b9d2b484b731b04342db33d2dec216ca9ed9ac0810c9c32323f3cc1"})
]);

const deployment='/home/daon/.local/share/anvil-v3-qa-launchers/fn03-tc01-dependency-78dae503';
const cliPath=deployment+'/qa-fn03-tc01-dependency-cli.mjs';
const bootstrapPin=Object.freeze({path:deployment+'/qa-fn03-tc01-dependency-bootstrap-start.mjs',bytes:14597,sha256:'99d4ed9fb47252815616ed3109645843baf97fd56e20bba47769a1a68f6ab18c'});
const entryPin=Object.freeze({path:deployment+'/qa-fn03-tc01-dependency-linux-entry.ts',bytes:21426,sha256:'59dbeab165bdd9ec333d084c5e03c86658634e6418198fe780a9e099ba8b9ea0'});
const nodePath='/opt/node-v24.22.1-linux-x64/bin/node',npmPath='/opt/node-v24.22.1-linux-x64/lib/node_modules/npm/bin/npm-cli.js',npmPackage='/opt/node-v24.22.1-linux-x64/lib/node_modules/npm/package.json';
const toolPins=Object.freeze([
 Object.freeze({path:nodePath,sha256:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb',max:167772160,mode:0o755}),
 Object.freeze({path:npmPath,sha256:'8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7',max:54,bytes:54,mode:0o755}),
 Object.freeze({path:npmPackage,sha256:'f6478d5600180a23f73e4217610c7709a71cedb4ae13f6c3e15ecb457f5d4fd6',max:6597,bytes:6597,mode:0o644}),
]);
const statKeys=['dev','ino','uid','gid','mode','size','mtimeMs','ctimeMs','nlink'],dirKeys=['dev','ino','uid','gid','mode'];
const planKeys=['schemaVersion','purpose','profile','attemptId','sourceHead','issuedAt','expiresAt','sourceRoot','preparationRoot','receiptRoot','packageLockSha256','source','recipe','commandSha256'];
const systemKeys=['context','lstat','fstat','realpath','mkdir','open','read','sync','close','readdir','spawn','umask','setTimeout','clearTimeout','write'];
const fail=()=>{throw Error('TC01_DEPENDENCY_CLI_UNKNOWN');};
/** @param {unknown} ok @returns {asserts ok} */
function check(ok){if(!ok)fail();}
/** @param {string|Uint8Array} b */
const hash=b=>createHash('sha256').update(b).digest('hex');
/** @param {unknown} v */
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
/** @param {unknown} v @param {readonly string[]} keys @returns {Record<string,any>} */
function record(v,keys){check(v&&typeof v==='object'&&!types.isProxy(v)&&!Array.isArray(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);const r=Object.create(null);for(const k of keys){const x=d[k];check(x&&'value'in x);r[k]=x.value;}return r;}
/** @param {unknown} v */
function stat(v){const s=record(v,statKeys);check(statKeys.every(k=>typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=0));return s;}
/** @param {Record<string,any>} a @param {Record<string,any>} b @param {readonly string[]} [keys] */
const same=(a,b,keys=statKeys)=>keys.every(k=>a[k]===b[k]);
// 고정된 소스 행/명령만 직렬화한다. 승인 JSON의 parser/정규화 대체가 아니다.
/** @param {any} v @returns {string} */
const fixedJson=v=>v===null||typeof v!=='object'?/** @type {string} */(JSON.stringify(v)):Array.isArray(v)?'['+v.map(fixedJson).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+fixedJson(v[k])).join(',')+'}';
const unknown=()=>Object.freeze({status:'UNKNOWN',code:'DEPENDENCY_CLI_UNKNOWN',authority:'NOT_ISSUED'});
const used=new WeakSet();

/** 실제 main과 RAM 검수 모두 이 함수 하나를 호출한다. io는 내부 원 Node system/stdio만이며 원 승인 객체를 발급하지 않는다.
 * exact argv: node, 고정 cli, --run, attempt, plan SHA, approval SHA, 독립 Git SHA.
 * 최초 이 CLI/Node 실행 이미지와 argv를 고른 외부 감독의 근거는 별도 선행이다.
 * 이 함수의 자기 파일 사후 read/hash 또는 stdin 내용으로 그 근거를 소급 발급하지 않는다.
 * Git/tool 짧은 검사는 기존 timeout/SIGKILL을 유지한다. 설치 child에는 timeout kill/재시도/자동삭제가 없다.
 */
/** @param {unknown} io @returns {Promise<string|ReturnType<typeof unknown>>} */
export async function runTc01DependencyCli(io){
 /** @type {Buffer[]} */
 const buffers=[];
 /** @type {string|ReturnType<typeof unknown>} */
 let result=unknown();let poisoned=false;const retained=new Set();
 try{
  check(io&&typeof io==='object'&&!types.isProxy(io)&&!used.has(io));used.add(io);
  const p=record(io,['context','now','monotonic','system','execute','stdin']),sys=record(p.system,systemKeys);check(['context','now','monotonic','execute'].every(k=>typeof p[k]==='function')&&systemKeys.every(k=>typeof sys[k]==='function'));
  const context=()=>record(p.context.call(io),['platform','uid','execPath','execArgv','argv','environmentKeys','cwd','moduleURL','nodeVersion']);
  const c=context();check(c.platform==='linux'&&c.uid===1000&&c.execPath===nodePath&&c.nodeVersion==='24.22.1'&&Array.isArray(c.execArgv)&&c.execArgv.length===0&&Array.isArray(c.environmentKeys)&&c.environmentKeys.length===0&&c.moduleURL===pathToFileURL(cliPath).href);
  check(Array.isArray(c.argv)&&c.argv.length===7&&c.argv.every((/** @type {unknown} */v)=>typeof v==='string')&&c.argv[0]===nodePath&&c.argv[1]===cliPath&&c.argv[2]==='--run');
  const [attempt,planSha,approvalSha,gitSha]=c.argv.slice(3);check(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(attempt)&&[planSha,approvalSha,gitSha].every(hex));
  const root='/home/daon/anvil-fn03-tc01-'+attempt+'-qa',base='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+attempt,prep=base+'-dependency-preparation',receipt=base+'-dependency-consumption';check(c.cwd===root);
  const initialContext=Object.assign(Object.create(null),structuredClone(c)),files=new Map(),dirs=new Map();let wall=-1,mono=-1,expires=Infinity,monoUntil=Infinity;
  const clock=()=>{const w=p.now.call(io),m=p.monotonic.call(io);check(Number.isSafeInteger(w)&&w>=0&&w>=wall&&Number.isSafeInteger(m)&&m>=0&&m>=mono);if(wall===-1){expires=w+1800000;monoUntil=m+1800000;}check(w<expires&&m<monoUntil);monoUntil=Math.min(monoUntil,m+expires-w);wall=w;mono=m;};
  const fresh=()=>{check(!poisoned);clock();check(isDeepStrictEqual(context(),initialContext));for(const [path,s]of dirs)check(same(s,stat(sys.lstat.call(p.system,path)),dirKeys)&&sys.realpath.call(p.system,path)===path);for(const [path,s]of files)check(same(s,stat(sys.lstat.call(p.system,path)))&&sys.realpath.call(p.system,path)===path);clock();};
  /** @param {string} path @param {boolean} [leaf] */
  const pin=(path,leaf=false)=>{let cur='';for(const part of path.split('/').filter(Boolean)){cur+='/'+part;const s=stat(sys.lstat.call(p.system,cur));check((s.mode&0o170000)===0o040000&&[0,1000].includes(s.uid)&&!(s.mode&0o022));if(cur===path&&leaf)check(s.uid===1000&&(s.mode&0o7777)===0o700);const old=dirs.get(cur);check(!old||same(old,s,dirKeys));dirs.set(cur,s);}check(sys.realpath.call(p.system,path)===path);};
  /** @param {string} path */
  const missing=path=>{fresh();try{sys.lstat.call(p.system,path);}catch(error){check(error&&typeof error==='object'&&'code'in error&&error.code==='ENOENT');fresh();return;}fail();};
  // plainFile/tooling의 NOFOLLOW/원 fd/전후 stat을 유지. 큰 도구는 64KiB scratch만 보유한다.
  /** @param {string} path @param {number} uid @param {number} max @param {string} [sha] @param {number} [mode] @param {number} [bytes] @param {boolean} [keep] @returns {Buffer} */
  const read=(path,uid,max,sha,mode,bytes,keep=true)=>{
   fresh();pin(posix.dirname(path));const s=stat(sys.lstat.call(p.system,path));check((s.mode&0o170000)===0o100000&&s.uid===uid&&s.nlink===1&&!(s.mode&0o022)&&s.size<=max&&(bytes===undefined||s.size===bytes)&&(mode===undefined||(s.mode&0o7777)===mode)&&sys.realpath.call(p.system,path)===path);
   const prior=files.get(path);check(!prior||same(prior,s));const raw=keep?Buffer.alloc(s.size):undefined,scratch=Buffer.alloc(Math.min(65536,s.size+1)),probe=Buffer.alloc(1);if(raw)buffers.push(raw);const digest=createHash('sha256');let fd;
   try{fd=sys.open.call(p.system,path,'READ');check(Number.isSafeInteger(fd)&&fd>=0);fresh();check(same(s,stat(sys.fstat.call(p.system,fd))));let offset=0;
    while(offset<s.size){clock();const n=sys.read.call(p.system,fd,scratch,0,Math.min(scratch.length,s.size-offset),offset);check(Number.isSafeInteger(n)&&n>0&&n<=Math.min(scratch.length,s.size-offset));digest.update(scratch.subarray(0,n));if(raw)scratch.copy(raw,offset,0,n);offset+=n;clock();}
    check(sys.read.call(p.system,fd,probe,0,1,s.size)===0&&same(s,stat(sys.fstat.call(p.system,fd)))&&same(s,stat(sys.lstat.call(p.system,path)))&&sys.realpath.call(p.system,path)===path);
    const measured=digest.digest('hex');check(sha===undefined||measured===sha);files.set(path,s);
   }finally{scratch.fill(0);probe.fill(0);if(fd!==undefined)check(sys.close.call(p.system,fd)===undefined);}
   fresh();return raw??Buffer.alloc(0);
  };
  fresh();pin(root,true);pin(deployment,true);pin(posix.dirname(receipt));
  // 이 CLI의 현재 파일 신원은 연속성만 기록한다. 최초 실행 SHA로 자가 승인하지 않는다.
  read(cliPath,1000,262144,undefined,0o600,undefined,false);
  const bootstrap=read(bootstrapPin.path,1000,bootstrapPin.bytes,bootstrapPin.sha256,0o600,bootstrapPin.bytes),entryBytes=read(entryPin.path,1000,entryPin.bytes,entryPin.sha256,0o600,entryPin.bytes);
  for(const tool of toolPins)read(tool.path,0,tool.max,tool.sha256,tool.mode,'bytes'in tool?tool.bytes:undefined,false);read('/usr/bin/git',0,167772160,gitSha,0o755,undefined,false);
  const planRaw=read(receipt+'-plan.json',1000,32768,planSha,0o600),approvalRaw=read(receipt+'-approval.json',1000,32768,approvalSha,0o600);
  // 잠정 header는 파일 검산/적재에만 사용. 원 authorized-entry의 strict wire/승인 검산 뒤 BEFORE_CONSUMPTION에서만 최초 Git 효과.
  /** @param {Buffer} b */
  const parse=b=>JSON.parse(new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(b));
  const plan=record(parse(planRaw),planKeys),source=record(plan.source,['entry','sha256','closureSha256']),approval=record(parse(approvalRaw),['schemaVersion','purpose','profile','decision','approvalId','planHash','sourceHead','issuedAt','expiresAt']);
  check(plan.schemaVersion===1&&plan.purpose==='TC01_DEPENDENCY_PREPARATION'&&plan.profile==='TC01_DEPENDENCY_PREPARATION_ENTRY_V1'&&plan.recipe==='TC01_DEPENDENCY_RECIPE_CANDIDATE_V1'&&plan.attemptId===attempt&&plan.sourceHead===sourceHead&&plan.sourceRoot===root&&plan.preparationRoot===prep&&plan.receiptRoot===receipt&&hex(plan.packageLockSha256)&&hex(plan.commandSha256));
  check(source.entry==='scripts/qa-fn03-tc01-dependency-intake.ts'&&source.sha256===rows.find(r=>r.path===source.entry)?.sha256&&source.closureSha256===closureSha&&hash(fixedJson(rows))===closureSha);
  check(Number.isSafeInteger(plan.issuedAt)&&plan.issuedAt>=0&&Number.isSafeInteger(plan.expiresAt)&&plan.expiresAt>plan.issuedAt&&plan.expiresAt-plan.issuedAt<=1800000&&wall>=plan.issuedAt);
  expires=Math.min(expires,plan.expiresAt);fresh();check(approval.schemaVersion===1&&approval.purpose==='TC01_DEPENDENCY_PREPARATION_RUN_APPROVAL'&&approval.profile===plan.profile&&approval.decision==='ALLOW_ONE_RUN'&&approval.planHash===planSha&&approval.sourceHead===sourceHead&&approval.issuedAt===plan.issuedAt&&approval.expiresAt===plan.expiresAt&&typeof approval.approvalId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(approval.approvalId));
  const env=Object.freeze({PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:prep,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_COUNT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1',GIT_NO_LAZY_FETCH:'1',GIT_TERMINAL_PROMPT:'0',GIT_ATTR_NOSYSTEM:'1',GIT_PAGER:'cat'});
  const npmOptions=['--userconfig='+prep+'/npm-user.conf','--globalconfig='+prep+'/npm-global.conf','--cache='+prep+'/npm-cache','--registry=https://registry.npmjs.org/'];
  const install={file:nodePath,args:[npmPath,'ci','--ignore-scripts','--no-audit','--no-fund','--bin-links=false','--omit=dev','--include=optional',...npmOptions],cwd:root,env,shell:false,stdio:['ignore','pipe','pipe'],maxOutputBytes:65536};check(hash(fixedJson(install))===plan.commandSha256);
  const expected=Object.freeze({plan:Object.freeze(plan),planHash:planSha,approvalHash:approvalSha,approvalId:approval.approvalId});
  /** @param {string} file @param {string[]} args @param {number} [maxBuffer] @returns {string} */
  const execute=(file,args,maxBuffer=65536)=>{fresh();const timeout=Math.floor(Math.min(10000,expires-wall,monoUntil-mono));check(timeout>0);const out=p.execute.call(io,Object.freeze({file,args:Object.freeze(args),cwd:root,env,timeout,killSignal:'SIGKILL',maxBuffer,shell:false,stdio:Object.freeze(['ignore','pipe','pipe'])}));check(typeof out==='string'&&Buffer.byteLength(out)<=maxBuffer);fresh();return out;};
  const gitPrefix=['--no-pager','--no-optional-locks','--no-replace-objects','-c','core.fsmonitor=false','-c','core.hooksPath=/dev/null','-c','core.attributesFile=/dev/null','-c','core.excludesFile=/dev/null','-c','core.untrackedCache=false'];
  pin(root+'/.git');const config=read(root+'/.git/config',1000,8192),headRaw=read(root+'/.git/HEAD',1000,4096);
  check(!/\[\s*(?:include|includeIf|filter|alias)|fsmonitor|hooksPath|sshCommand|credential|alternate|worktree/i.test(new TextDecoder('utf8',{fatal:true}).decode(config)));
  for(const path of ['objects/info/alternates','objects/info/http-alternates','info/attributes','config.worktree','commondir','shallow'])missing(root+'/.git/'+path);
  const gitMetadata=()=>{let count=0;/** @param {string} path @param {number} [depth] */ const walk=(/** @type {string} */path,depth=0)=>{check(depth<=64);fresh();const names=sys.readdir.call(p.system,path,4097);check(Array.isArray(names)&&names.length<=4096&&new Set(names).size===names.length);for(const name of names){check(typeof name==='string'&&/^[A-Za-z0-9._-]+$/.test(name)&&name!=='.'&&name!=='..'&&++count<=20000);const child=path+'/'+name,s=stat(sys.lstat.call(p.system,child));check(s.uid===1000&&!(s.mode&0o022)&&sys.realpath.call(p.system,child)===child);if((s.mode&0o170000)===0o040000)walk(child,depth+1);else check((s.mode&0o170000)===0o100000&&s.nlink===1);}};walk(root+'/.git');fresh();};
  const gitCheck=()=>{fresh();for(const path of ['objects/info/alternates','objects/info/http-alternates','info/attributes','config.worktree','commondir','shallow'])missing(root+'/.git/'+path);gitMetadata();const tracked=execute('/usr/bin/git',[...gitPrefix,'ls-files','-v','-z'],2097152).split('\0');check(tracked.pop()===''&&tracked.length>0&&tracked.every(x=>x.startsWith('H ')));check(execute('/usr/bin/git',[...gitPrefix,'rev-parse','HEAD']).trim()===sourceHead&&execute('/usr/bin/git',[...gitPrefix,'status','--porcelain','--untracked-files=all','--ignore-submodules=none']).trim()==='');fresh();};
  const sourceFiles=rows.map(row=>Object.freeze({path:row.path,bytes:read(root+'/'+row.path,1000,row.bytes,row.sha256,undefined,row.bytes)}));
  read(root+'/package.json',1000,976,'281575a15bdfc1204c4df3390d260117a874d274281320016779c8207a8a345c',undefined,976);
  read(root+'/package-lock.json',1000,16777216,plan.packageLockSha256);
  missing(base);missing('/tmp/fn03-tc01-'+attempt);missing(root+'/.npmrc');missing(root+'/node_modules');missing(receipt);missing(prep);
  const wire=await readStdin(p.stdin,sys,fresh,()=>Math.floor(Math.min(expires-wall,monoUntil-mono)),buffers);fresh();
  const bootstrapURL='data:text/javascript;base64,'+bootstrap.toString('base64');
  const start=await import(bootstrapURL);fresh();check(Object.keys(start).length===1&&typeof start.createTc01DependencyBootstrapStart==='function');
  /** @param {unknown} v */
  const sameExpected=v=>isDeepStrictEqual(JSON.parse(JSON.stringify(v)),JSON.parse(JSON.stringify(expected)));
  let versionChecked=false;const created=new Map(),retainedClose=new Map();
  /** @param {string} phase */
  const verify=phase=>{fresh();if(phase==='BEFORE_CONSUMPTION'){missing(receipt);missing(prep);}missing(base);missing('/tmp/fn03-tc01-'+attempt);missing(root+'/.npmrc');if(phase!=='AFTER_CLOSE')missing(root+'/node_modules');
   if(phase==='BEFORE_PREPARE')missing(prep);if(phase==='BEFORE_START'||phase==='AFTER_CLOSE'){pin(prep,true);pin(prep+'/npm-cache',true);for(const path of [prep+'/npm-user.conf',prep+'/npm-global.conf'])read(path,1000,0,hash(Buffer.alloc(0)),0o600,0,false);}
   gitCheck();if(phase==='BEFORE_START'){if(!versionChecked){check(execute(nodePath,[npmPath,'--version',...npmOptions]).trim()==='11.19.1');versionChecked=true;}}fresh();};
  /** @type {System} */
  const system=Object.freeze(/** @type {System} */({...Object.fromEntries(systemKeys.map(k=>[k,(/** @type {any[]} */...args)=>sys[k].apply(p.system,args)])),
   mkdir:(path,mode)=>{check([receipt,prep,prep+'/npm-cache'].includes(path)&&mode===0o700);fresh();const r=sys.mkdir.call(p.system,path,mode);fresh();return r;},
   open:(path,kind,mode)=>{if(kind==='CREATE')check([receipt+'/intent.json',prep+'/npm-user.conf',prep+'/npm-global.conf'].includes(path)&&mode===0o600);const fd=sys.open.call(p.system,path,kind,mode);if(kind==='CREATE')created.set(fd,path);return fd;},
   write:(fd,bytes,offset)=>{fresh();check(created.get(fd)===receipt+'/intent.json');const n=sys.write.call(p.system,fd,bytes,offset);fresh();return n;},
   close:fd=>{created.delete(fd);return sys.close.call(p.system,fd);},
  }));
  /** @type {import('./qa-fn03-tc01-dependency-authorized-entry.ts').Tc01DependencyAuthorizationSupervisor} */
  const supervisor=Object.freeze(/** @type {import('./qa-fn03-tc01-dependency-authorized-entry.ts').Tc01DependencyAuthorizationSupervisor} */({now:()=>p.now.call(io),monotonic:()=>p.monotonic.call(io),assertCurrent:e=>{check(sameExpected(e));fresh();},verifySource:r=>{check(sameExpected(r.expected)&&typeof r.phase==='string'&&['BEFORE_CONSUMPTION','BEFORE_PREPARE','BEFORE_START','AFTER_CLOSE'].includes(r.phase));verify(r.phase);},retainChild:child=>{check(child&&typeof child.once==='function'&&!retained.has(child));retained.add(child);const done=()=>{retained.delete(child);retainedClose.delete(child);};retainedClose.set(child,done);child.once('close',done);}}));
  /** @type {Record<string,(r:any)=>any>} */
  const startup=Object.freeze({now:()=>p.now.call(io),monotonic:()=>p.monotonic.call(io),assertStart:r=>{fresh();check(r.bootstrapURL===bootstrapURL&&r.sourceHead===sourceHead&&sameExpected(r.expected)&&r.environment==='EMPTY'&&Array.isArray(r.execArgv)&&r.execArgv.length===0&&r.node.path===nodePath&&r.node.sha256===toolPins[0].sha256);},verifyBootstrap:r=>{fresh();check(r.sourceHead===sourceHead&&sameExpected(r.expected)&&r.entry==='scripts/qa-fn03-tc01-dependency-authorized-entry.ts'&&r.dependencies.length===0&&isDeepStrictEqual(r.rows.map((/** @type {any} */x)=>({path:x.path,bytes:x.bytes,sha256:x.sha256})),rows));}});
  const runner=start.createTc01DependencyBootstrapStart(startup);const answer=await runner.run({entryBytes,files:sourceFiles,input:{wire,expected,supervisor,system}});fresh();check(typeof answer==='string'&&Buffer.byteLength(answer)<=4210688);result=answer;
 }catch{poisoned=true;result=unknown();}finally{for(const b of buffers)b.fill(0);}
 // UNKNOWN 원 자식/새 경로는 보존한다. child/stream 오류 경계와 실제 종결은 원 adapter/외부 감독 책임이다.
 return result;
}

/** @param {import('node:stream').Readable} stream @param {Record<string,any>} sys @param {()=>void} fresh @param {()=>number} remaining @param {Buffer[]} buffers @returns {Promise<Buffer>} */
async function readStdin(stream,sys,fresh,remaining,buffers){
 check(stream&&typeof stream.on==='function'&&typeof stream.removeListener==='function'&&typeof stream.resume==='function');
 const raw=Buffer.alloc(16384);buffers.push(raw);return new Promise((resolve,reject)=>{let size=0,ended=false,terminal=false,ready=false,setup=true,pending=false;
 /** @type {any} */
 let timer=undefined;
  const cleanup=()=>{for(const [event,fn]of /** @type {[string,(...args:any[])=>void][]} */([['data',data],['end',end]]))stream.removeListener(event,fn);if(timer!==undefined)sys.clearTimeout(timer);};
  const settle=()=>{if(setup||!terminal)return;try{cleanup();if(pending)resolve(raw.subarray(0,size));else reject(Error('TC01_DEPENDENCY_CLI_UNKNOWN'));}catch{reject(Error('TC01_DEPENDENCY_CLI_UNKNOWN'));}};
  /** @param {boolean} ok */
  const finish=ok=>{if(terminal)return;terminal=true;pending=ok;settle();};
  const error=()=>finish(false),data=(/** @type {unknown} */b)=>{if(terminal)return;try{check(ready&&!ended&&!types.isProxy(b)&&types.isUint8Array(b));const typed=Object.getPrototypeOf(Uint8Array.prototype),n=/** @type {()=>number} */(Object.getOwnPropertyDescriptor(typed,'byteLength')?.get).call(b),backing=/** @type {()=>ArrayBuffer} */(Object.getOwnPropertyDescriptor(typed,'buffer')?.get).call(b);check(types.isArrayBuffer(backing)&&size+n<=raw.length);fresh();Uint8Array.prototype.set.call(raw,b,size);size+=n;}catch{finish(false);}},end=()=>{if(terminal)return;try{check(ready&&!ended&&size>0);fresh();ended=true;finish(true);}catch{finish(false);}},close=()=>{if(!ended)finish(false);stream.removeListener('error',error);stream.removeListener('close',close);};
  try{stream.on('error',error);stream.on('data',data);stream.on('end',end);stream.on('close',close);fresh();const ms=remaining();check(ms>0);timer=sys.setTimeout(()=>finish(false),ms);check(timer!==undefined&&timer!==null);if(!terminal){fresh();ready=true;stream.resume();}}catch{finish(false);}finally{setup=false;settle();}
 });
}

/** @returns {IO} */
function nativeIO(){
 /** @param {import('node:fs').Stats} s */
 const project=s=>Object.fromEntries(statKeys.map(k=>[k,s[/** @type {keyof import('node:fs').Stats} */(k)]]));
 /** @type {System} */
 const system={context:()=>({platform:process.platform,uid:process.getuid?.()}),lstat:path=>project(fs.lstatSync(path)),fstat:fd=>project(fs.fstatSync(fd)),realpath:path=>fs.realpathSync(path),mkdir:(path,mode)=>fs.mkdirSync(path,{mode}),
  open:(path,kind,mode)=>{const c=fs.constants;check(c.O_NOFOLLOW>0&&c.O_DIRECTORY>0&&c.O_NONBLOCK>0);return fs.openSync(path,c.O_NOFOLLOW|c.O_NONBLOCK|(kind==='CREATE'?c.O_WRONLY|c.O_CREAT|c.O_EXCL:c.O_RDONLY)|(kind==='DIRECTORY'?c.O_DIRECTORY:0),mode);},
  read:(fd,b,o,n,p)=>fs.readSync(fd,b,o,n,p),write:(fd,b,o)=>fs.writeSync(fd,b,o,b.length-o,null),sync:fd=>fs.fsyncSync(fd),close:fd=>fs.closeSync(fd),
  readdir:(path,limit)=>{const d=fs.opendirSync(path,{bufferSize:1}),out=[];try{while(out.length<limit){const e=d.readSync();if(e===null)break;out.push(e.name);}return out;}finally{d.closeSync();}},
  spawn:c=>spawn(c.file,[...c.args],{cwd:c.cwd,env:{...c.env},shell:false,stdio:['ignore','pipe','pipe']}),umask:v=>v===undefined?process.umask():process.umask(v),setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:h=>clearTimeout(/** @type {NodeJS.Timeout} */(h)),
 };
 return {context:()=>({platform:process.platform,uid:process.getuid?.(),execPath:process.execPath,execArgv:[...process.execArgv],argv:[...process.argv],environmentKeys:Object.keys(process.env),cwd:process.cwd(),moduleURL:import.meta.url,nodeVersion:process.versions.node}),now:()=>Date.now(),monotonic:()=>Math.floor(performance.now()),system,
  execute:c=>execFileSync(c.file,[...c.args],{cwd:c.cwd,env:{...c.env},timeout:c.timeout,killSignal:c.killSignal,maxBuffer:c.maxBuffer,shell:false,stdio:['ignore','pipe','pipe'],encoding:'utf8'}),stdin:process.stdin};
}
// 실제 실행은 외부가 고정 CLI/Node/argv를 검산하여 명시한 경우뿐이다. import는 포트/프로세스/파일을 열지 않는다.
if(import.meta.main){
 const sink=()=>{process.exitCode=1;};process.stdout.on('error',sink);process.stderr.on('error',sink);
 void runTc01DependencyCli(nativeIO()).then(result=>{const raw=typeof result==='string'?result:JSON.stringify(result)+'\n';process.exitCode=typeof result==='string'?0:1;process.stdout.write(raw,error=>{if(error)process.exitCode=1;});},()=>{process.exitCode=1;process.stdout.write(JSON.stringify(unknown())+'\n');});
}
