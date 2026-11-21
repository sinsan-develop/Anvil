import test from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import type {Pool} from 'pg';
import {contentHash} from '../../../contracts/canonical.ts';
import {currentProfile} from '../../../scripts/qa-ix01-current-journey.ts';
import {createManagementOriginNativeProviders,createManagementOriginTc01NativeProviders,type ManagementOriginNativeOperations,type ManagementOriginNativePreparation} from '../../../scripts/qa-fn03-source-content-management-origin-native.ts';
import type {ManagementOriginPoolRequest} from '../../../scripts/qa-fn03-source-content-management-origin-isolated-ports.ts';
import {createManagementOriginIsolatedPorts,createManagementOriginTc01IsolatedPorts} from '../../../scripts/qa-fn03-source-content-management-origin-isolated-ports.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {buildBuiltinMethodologies} from '../../../apps/server/modules/methodologies/builtins.ts';
import {currentNetworkProbeContract} from '../../../scripts/qa-ix01-current-journey.ts';

let catalog:ReturnType<typeof load>|undefined;
function load(){
 const cwd=fileURLToPath(new URL('../../../',import.meta.url)),blob=(path:string)=>execFileSync('git',['cat-file','blob','c21a169e:'+path],{cwd,maxBuffer:4*1024*1024,windowsHide:true});
 const sources={forms:blob(currentProfile.forms),standard:blob(currentProfile.standard),methods:blob(currentProfile.methods)},forms=buildOfficialForms(sources.forms,sources.standard),m=buildBuiltinMethodologies(sources.methods,forms.forms)[0]!;
 return{sources,historicalTsv:blob(currentProfile.manifest),legacyBytes:blob(currentProfile.legacy),methodologyRef:{id:m.id,version:m.version,contentHash:m.contentHash}};
}
async function begin(h:ReturnType<typeof harness>,p:ReturnType<typeof createManagementOriginNativeProviders>){
 const source=catalog??=load(),b=h.preparation.binding,tag=b.attemptId.replaceAll('-',''),name=(h.integrated?'anvil_v3_fn03_tc01_':'anvil_v3_fn03_management_')+tag;
 let result:ReturnType<typeof p.command>|undefined;
 const adapter=await (h.integrated?createManagementOriginTc01IsolatedPorts:createManagementOriginIsolatedPorts)({binding:b,receiptRoot:h.receipt,...source,passwords:{bootstrap:'a'.repeat(64),app:'b'.repeat(64),migrator:'c'.repeat(64)},fixture:{artifactRoot:b.artifactRoot,access:{installationId:id(3),key:Buffer.alloc(32,7)},origin:'https://anvil.invalid',actorId:id(4),loginName:'fn03-isolated-fixture',password:'Synthetic fixture only 123!',credentialGeneration:1,methodologyRef:source.methodologyRef,ids:{draftCommandId:id(6),createCommandId:id(7),policyCommandId:id(8),ruleId:id(9),managementCommandId:id(10),deniedCommandId:id(11),readCommandId:id(12)},policyExpiresAt:new Date(b.expiresAt).toISOString(),managementPayload:{}}},{...p,command(call){result=p.command(call);throw Error('FIXED_TEST_FIRST_COMMAND_STOP');}});
 const scope={...b,containerName:name,networkName:name+'_net',database:name,image:currentNetworkProbeContract.image,labels:{'anvil.owner':h.integrated?'FN03_MANAGEMENT_ORIGIN_TC01':'FN03_MANAGEMENT_ORIGIN','anvil.instance':tag,'anvil.plan':b.planHash},containerId:'',networkId:'',host:''};
 await adapter.claim(scope);
 return()=>{assert.throws(()=>adapter.start.check('IMAGE_COLLISION',scope,10000));return result;};
}

// 제품 목록에서 동적으로 추출하지 않는 통합 경계의 독립 기대값.
const tc01Sources=[
 'scripts/qa-fn03-source-content-management-origin-profiles.ts',
 'scripts/qa-fn03-source-content-management-origin.ts',
 'scripts/qa-fn03-source-content-management-origin-auth-fixture.ts',
 'tests/integration/IX01/methodology-copy-application-scenario.ts',
 'tests/integration/IX01/current-schema-baseline.ts',
 'tests/integration/IX01/current-schema-installation.ts',
 'tests/integration/FN03/source-content-management-origin-supervision.ts',
 'tests/integration/FN03/source-content-management-origin-schema.ts',
 'tests/integration/FN03/source-content-management-origin-transaction-fence.ts',
 'tests/integration/FN03/source-content-management-origin-provision.ts',
 'tests/integration/FN03/source-content-management-origin-fixture.ts',
 'tests/integration/FN03/source-content-management-origin-journey.ts',
];
const id=(n:number)=>`9d000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const h=(text:string)=>contentHash(Buffer.from(text));
function harness(fault='',integrated=false,evidencePaths:readonly string[]=[]){
 const at=Date.parse('2026-11-21T00:00:00Z'),attemptId=id(1),head='7'.repeat(40),trace:string[]=[],commands:any[]=[],root='/home/daon/'+(integrated?'anvil-fn03-tc01-':'anvil-fn03-management-')+attemptId+'-qa',receipt='/home/daon/.local/share/anvil-v3-qa-receipts/'+(integrated?'fn03-tc01-':'fn03-management-')+attemptId,artifact='/tmp/'+(integrated?'fn03-tc01-':'anvil-v3-fn03-management-')+attemptId;
 let wall=at,mono=0,ino=1,fd=1,closed=0,endCalls=0;const timers=new Map<number,()=>void>();let timerId=0;
 type Node={kind:'file'|'dir'|'socket'|'link';bytes:Buffer;ino:number;uid:number;mode:number;mtimeMs:number;ctimeMs:number};
 const tree=new Map<string,Node>(),opened=new Map<number,{path:string;offset:number}>();
 const dir=(path:string,uid=1000,mode=0o700)=>{if(path===''||path==='/')return;const parent=path.slice(0,path.lastIndexOf('/'));if(!tree.has(parent))dir(parent,0,0o755);if(!tree.has(path))tree.set(path,{kind:'dir',bytes:Buffer.alloc(0),ino:ino++,uid,mode,mtimeMs:1,ctimeMs:1});};
 const file=(path:string,text:string,uid=1000,mode=0o600)=>{dir(path.slice(0,path.lastIndexOf('/')));tree.set(path,{kind:'file',bytes:Buffer.from(text),ino:ino++,uid,mode,mtimeMs:1,ctimeMs:1});};
 const lookup=(path:string)=>{const n=tree.get(path);if(!n)throw Object.assign(Error('PRIVATE_ABSENT'),{code:'ENOENT'});return n;};
 const stat=(path:string)=>{const n=lookup(path);return{dev:1,ino:n.ino,uid:n.uid,gid:n.uid,mode:n.mode,nlink:1,size:n.bytes.length,mtimeMs:n.mtimeMs,ctimeMs:n.ctimeMs,isFile:()=>n.kind==='file',isDirectory:()=>n.kind==='dir',isSocket:()=>n.kind==='socket'};};
 dir(root);dir(root+'/.git');dir(receipt.slice(0,receipt.lastIndexOf('/')));dir('/tmp',0,0o1777);dir('/run',0,0o755);
 const sourcePaths=['scripts/qa-fn03-source-content-management-origin-entry.ts','scripts/qa-fn03-source-content-management-origin-native.ts','scripts/qa-fn03-source-content-management-origin-isolated-ports.ts','scripts/qa-fn03-source-content-management-origin-host.ts','scripts/qa-ix01-current-journey.ts','scripts/qa-ix01-subnet-observation-host.ts','package.json','package-lock.json',...(integrated?tc01Sources:[]),...evidencePaths].sort();
 const rows=sourcePaths.map(path=>{const raw='synthetic-source:'+path;file(root+'/'+path,raw);return{path,bytes:Buffer.byteLength(raw),sha256:h(raw)};});
 const packageLockSha256=rows.find(r=>r.path==='package-lock.json')!.sha256;
 const sourceManifestRaw=JSON.stringify({schemaVersion:1,sourceHead:head,sourceRoot:root,gitSha256:'1'.repeat(64),dockerSha256:'2'.repeat(64),files:rows});
 const dep='synthetic dependency',dependencyManifestRaw=JSON.stringify({schemaVersion:1,sourceHead:head,packageLockSha256,files:[{path:'node_modules/pg/index.js',bytes:Buffer.byteLength(dep),sha256:h(dep)}]});file(root+'/node_modules/pg/index.js',dep);
 const runtime={sourceHead:head,entry:'scripts/qa-fn03-source-content-management-origin-entry.ts' as const,nodeSha256:currentProfile.nodeHash,sourceClosureSha256:h(sourceManifestRaw),packageLockSha256,installedDependenciesSha256:h(dependencyManifestRaw)};
 const plan={schemaVersion:1,purpose:integrated?'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED':'FN03_MANAGEMENT_ORIGIN_ISOLATED',profile:integrated?'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1':'FN03_MANAGEMENT_ORIGIN_ENTRY_V1',attemptId,sourceHead:head,issuedAt:at,expiresAt:at+1800000,artifactRoot:artifact,receiptRoot:receipt,subnet:'172.18.0.16/28',runtime},planRaw=JSON.stringify(plan),planHash=h(planRaw);
 const approval={schemaVersion:1,purpose:plan.purpose+'_RUN_APPROVAL',profile:plan.profile,decision:'ALLOW_ONE_RUN',approvalId:id(2),attemptId,planHash,sourceHead:head,issuedAt:at,expiresAt:plan.expiresAt},approvalRaw=JSON.stringify(approval);
 const binding={attemptId,approvalId:id(2),planHash,approvalHash:h(approvalRaw),sourceHead:head,issuedAt:at,expiresAt:plan.expiresAt,artifactRoot:artifact,subnet:plan.subnet,...(integrated?{purpose:plan.purpose,profile:plan.profile}:{})};
 const preparation:ManagementOriginNativePreparation={binding,runtime,sourceManifestRaw,dependencyManifestRaw};
 file(receipt+'-plan.json',planRaw);file(receipt+'-approval.json',approvalRaw);file(root+'/.git/config','[core]\nrepositoryformatversion=0\n');
 for(const path of [currentProfile.node,currentProfile.git,currentProfile.docker])file(path,'tool',0,0o755);
 tree.set('/run/docker.sock',{kind:'socket',bytes:Buffer.alloc(0),ino:ino++,uid:0,mode:0o660,mtimeMs:1,ctimeMs:1});
 if(fault==='source'){const bytes=lookup(root+'/'+sourcePaths[0]!).bytes;bytes[0]=bytes[0]!^1;}
 if(fault==='dependency')file(root+'/node_modules/unlisted/index.js','UNLISTED');
 if(fault==='symlink')lookup(root+'/node_modules/pg/index.js').kind='link';
 if(fault==='approval'){const bytes=lookup(receipt+'-approval.json').bytes;bytes[0]=bytes[0]!^1;}
 if(fault==='unsafe-dir')lookup(root).mode=0o777;
 if(fault==='duplicate')dir(receipt);
 const files={lstatSync(path:string){trace.push('STAT');return stat(path);},fstatSync(n:number){return stat(opened.get(n)!.path);},realpathSync:(path:string)=>path,
  openSync(path:string,flags:number,mode?:number){trace.push('OPEN');if(flags&constants.O_CREAT){if(tree.has(path))throw Object.assign(Error('PRIVATE_EXISTS'),{code:'EEXIST'});assert.equal(flags,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW);file(path,'',1000,mode);}else lookup(path);const n=fd++;opened.set(n,{path,offset:0});return n;},
  readSync(n:number,out:Buffer,offset:number,length:number){const o=opened.get(n)!,data=lookup(o.path).bytes;const size=Math.min(length,data.length-o.offset);data.copy(out,offset,o.offset,o.offset+size);o.offset+=size;return size;},
  writeFileSync(n:number,text:string){trace.push('WRITE');lookup(opened.get(n)!.path).bytes=Buffer.from(text);},fsyncSync(){trace.push('FSYNC');if(fault==='flush')throw Error('PRIVATE_FLUSH');},closeSync(n:number){assert(opened.delete(n));closed++;},
  mkdirSync(path:string,options:{mode:number}){trace.push('MKDIR');if(tree.has(path))throw Object.assign(Error('PRIVATE_EXISTS'),{code:'EEXIST'});assert.equal(options.mode,0o700);dir(path,1000,options.mode);},
  readdirSync(path:string){lookup(path);return[...tree.keys()].filter(p=>p.startsWith(path+'/')&&!p.slice(path.length+1).includes('/')).map(p=>p.slice(path.length+1));},
 } as unknown as ManagementOriginNativeOperations['files'];
 const poolObjects:Pool[]=[];
 const ops:ManagementOriginNativeOperations={files,identity:{now:()=>wall,monotonic:()=>mono,context:()=>({platform:fault==='windows'?'win32':'linux',uid:1000,hostname:'SINSAN',execPath:currentProfile.node,execArgv:[],environmentKeys:[]}),realpath:path=>path==='/var/run/docker.sock'?'/run/docker.sock':path,inspect:()=>{throw Error('UNUSED');},fingerprint(path,max,check){trace.push('FINGERPRINT');check();assert.equal(max,160*1024*1024);return fault==='tool'?'0'.repeat(64):path===currentProfile.node?currentProfile.nodeHash:path===currentProfile.git?'1'.repeat(64):'2'.repeat(64);}},
  spawn:((path:string,args:string[],options:any)=>{trace.push('SPAWN');commands.push({path,args,options});assert.equal(options.shell,false);assert(options.timeout>0);assert.equal(options.killSignal,'SIGKILL');assert.equal(options.stdio[2],'ignore');let stdout='';
   if(path===currentProfile.git){if(args.includes('rev-parse'))stdout=head+'\n';else if(args.includes('ls-files'))stdout=sourcePaths.map(p=>'H '+p+'\0').join('');else assert(args.includes('status'));}
   else{assert.equal(path,currentProfile.docker);stdout='{}';if(fault==='command')return{error:Error('PRIVATE_CMD'),status:null,signal:'SIGKILL',stdout:Buffer.alloc(0)};if(fault==='late-command')mono=1800000;}
   return{status:0,signal:null,stdout:Buffer.from(stdout)};
  }) as typeof ops.spawn,
  pool(request){trace.push('POOL');assert.equal(request.ssl,false);const pool={async end(){endCalls++;if(fault==='end')throw Error('PRIVATE_END');if(fault==='late-end')mono+=10000;}} as Pool;
   if(fault==='alias'&&poolObjects.length)return poolObjects[0]!;poolObjects.push(pool);if(fault==='late-pool')mono=1800000;return pool;},
  timer(callback,ms){const n=++timerId;timers.set(n,callback);if(ms===250)callback();return n;},clearTimer(handle){timers.delete(handle as number);},
 };
 const request=(user:ManagementOriginPoolRequest['user']='anvil_v3_app'):ManagementOriginPoolRequest=>({host:'172.18.0.18',port:5432,database:(integrated?'anvil_v3_fn03_tc01_':'anvil_v3_fn03_management_')+attemptId.replaceAll('-',''),user,password:'b'.repeat(64),ssl:false,max:2,connectionTimeoutMillis:3000,statement_timeout:5000,query_timeout:6000});
 const command={file:'/usr/bin/docker' as const,argv:['--config',receipt+'/docker-config','--host',currentProfile.socket,'info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}'],input:undefined,env:{PATH:'/opt/node-v24.22.1-linux-x64/bin:/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:receipt},timeoutMs:10000,maxBuffer:65536 as const,shell:false as const};
 return{integrated,preparation,ops,trace,commands,request,command,tree,opened,timers,receipt,artifact,root,get closed(){return closed;},get endCalls(){return endCalls;},expire(){mono=1800000;}};
}

test('native provider 생성은 효과0이고 불완전 승인 입력은 효과 전에 거절한다',()=>{
 const calls:string[]=[];const ops=new Proxy({}, {get(_t,k){calls.push(String(k));throw Error('PRIVATE');}});
 assert.throws(()=>createManagementOriginNativeProviders(undefined as never,ops as never),/FN03_MANAGEMENT_NATIVE_UNKNOWN/);
 assert.deepEqual(calls,[]);
});

test('메모리 보호 승인/closure→배타 flush→고정 command/Pool/root 원 효과 연결',async()=>{
 const h=harness(),p=createManagementOriginNativeProviders(h.preparation,h.ops);assert.equal(h.trace.length,0);
 p.assertPreparedRuntime(h.preparation.binding,h.preparation.runtime);assert.equal(h.commands.length,3);assert(!h.trace.includes('WRITE'));
 const first=await begin(h,p);assert(h.tree.has(h.receipt+'/intent.json'));assert.equal(h.opened.size,0);
 assert.equal(first()?.status,0);const pool=await p.openPool(h.request());await p.prepareArtifactRoot(h.preparation.binding);assert(h.tree.has(h.artifact+'/owner.json'));await p.closePool(pool,10000);
 assert.equal(h.endCalls,1);assert.equal(h.timers.size,0);assert.equal(h.opened.size,0);
 await assert.rejects(p.closePool(pool,10000));assert.equal(h.endCalls,1);
});

test('runtime/승인·metadata·링크·추가 dependency·도구 불명은 신규 소비0',()=>{
 for(const fault of ['source','dependency','symlink','approval','unsafe-dir','tool','duplicate']){
  const h=harness(fault),p=createManagementOriginNativeProviders(h.preparation,h.ops);
  assert.throws(()=>p.assertPreparedRuntime(h.preparation.binding,h.preparation.runtime),/FN03_MANAGEMENT_NATIVE_UNKNOWN/);
  assert(!h.trace.includes('WRITE'));assert(!h.trace.includes('MKDIR'));assert(!h.trace.includes('POOL'));assert.equal(h.opened.size,0);
  const count=h.trace.length;assert.throws(()=>p.command(h.command));assert.equal(h.trace.length,count);
 }
});

test('배타 mkdir/flush 불명은 보존하고 같은/다른 provider의 소비 재사용0',async()=>{
 for(const fault of ['flush','']){
  const h=harness(fault),p=createManagementOriginNativeProviders(h.preparation,h.ops);p.assertCurrent(h.preparation.binding);
  if(fault)await assert.rejects(p.consume(h.preparation.binding));else await p.consume(h.preparation.binding);
  assert(h.tree.has(h.receipt));const count=h.commands.length;await assert.rejects(p.consume(h.preparation.binding));assert.equal(h.commands.length,count);
  const other=createManagementOriginNativeProviders(h.preparation,h.ops);assert.throws(()=>other.assertCurrent(h.preparation.binding));assert.equal(h.opened.size,0);
 }
});

test('command 실패/늦은 결과 뒤 명령/Pool/root0, 원 Pool end만1',async()=>{
 for(const fault of ['command','late-command']){
  const h=harness(fault),p=createManagementOriginNativeProviders(h.preparation,h.ops),first=await begin(h,p);const pool=await p.openPool(h.request());
  assert.equal(first(),undefined);const count=h.trace.length;assert.throws(()=>p.command(h.command));await assert.rejects(p.prepareArtifactRoot(h.preparation.binding));assert.equal(h.trace.length,count);
  await p.closePool(pool,10000);assert.equal(h.endCalls,1);assert.equal(h.timers.size,0);
 }
});

test('늦은 Pool은 먼저 원 객체 보유 후 end1, 타 소유 alias는 end0',async()=>{
 const h=harness('late-pool'),p=createManagementOriginNativeProviders(h.preparation,h.ops);await p.consume(h.preparation.binding);await assert.rejects(p.openPool(h.request()));assert.equal(h.endCalls,1);
 const a=harness('alias'),q=createManagementOriginNativeProviders(a.preparation,a.ops);await q.consume(a.preparation.binding);const pool=await q.openPool(a.request());await assert.rejects(q.openPool(a.request('anvil_v3_bootstrap')));assert.equal(a.endCalls,0);await q.closePool(pool,10000);assert.equal(a.endCalls,1);
});

test('원 end 실패/10초 늦은 완료는 UNKNOWN 유지·두 번째 end0',async()=>{
 for(const fault of ['end','late-end']){const h=harness(fault),p=createManagementOriginNativeProviders(h.preparation,h.ops);await p.consume(h.preparation.binding);const pool=await p.openPool(h.request());await assert.rejects(p.closePool(pool,10000));await assert.rejects(p.closePool(pool,10000));assert.equal(h.endCalls,1);assert.equal(h.timers.size,0);assert.throws(()=>p.command(h.command));}
});

test('raw 또는 무관 Docker 대상은 runtime/실행 효과 전 거절한다',()=>{
 for(const argv of [['ps'],['container','rm','other'],['exec','other','sh','-c','ignored']]){const h=harness(),p=createManagementOriginNativeProviders(h.preparation,h.ops);assert.throws(()=>p.command({...h.command,argv:[...h.command.argv.slice(0,4),...argv]}));assert.equal(h.trace.length,0);}
});

test('TC01 명시 factory는 존재하며 legacy binding을 효과 전에 거절한다',()=>{
 const x=harness();assert.throws(()=>createManagementOriginTc01NativeProviders(x.preparation,x.ops),/FN03_MANAGEMENT_NATIVE_UNKNOWN/);assert.equal(x.trace.length,0);
});

test('TC01 RAM closure→전용 intent/config/root→원 Docker ticket 및 정확 DB Pool',async()=>{
 const x=harness('',true),p=createManagementOriginTc01NativeProviders(x.preparation,x.ops);assert.equal(x.trace.length,0);
 p.assertPreparedRuntime(x.preparation.binding,x.preparation.runtime);
 const first=await begin(x,p);assert.equal(first()?.status,0);
 const command=x.commands.at(-1)!;assert.equal(command.options.cwd,x.root);
 assert.deepEqual(command.args.slice(0,4),['--config',x.receipt+'/docker-config','--host',currentProfile.socket]);
 assert.deepEqual(command.args.slice(4),['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}']);
 const intent=JSON.parse(x.tree.get(x.receipt+'/intent.json')!.bytes.toString());
 assert.equal(intent.purpose,'FN03_MANAGEMENT_ORIGIN_TC01_INTENT');assert.deepEqual(intent.binding,x.preparation.binding);
 assert.equal(x.request().database,'anvil_v3_fn03_tc01_'+id(1).replaceAll('-',''));
 const pool=await p.openPool(x.request());await p.prepareArtifactRoot(x.preparation.binding);
 assert.deepEqual(x.tree.get(x.artifact+'/owner.json')!.bytes,x.tree.get(x.receipt+'/intent.json')!.bytes);
 await p.closePool(pool,10000);assert.equal(x.endCalls,1);assert.equal(x.opened.size,0);assert.equal(x.timers.size,0);
 const count=x.trace.length;await assert.rejects(p.consume(x.preparation.binding));assert(!x.trace.slice(count).includes('MKDIR'));
 await assert.rejects(p.prepareArtifactRoot(x.preparation.binding));assert.equal(x.endCalls,1);
});

test('교차 factory/binding/root/최소 closure 누락·오염은 생성 시 효과0',()=>{
 const integrated=harness('',true);assert.throws(()=>createManagementOriginNativeProviders(integrated.preparation,integrated.ops));assert.equal(integrated.trace.length,0);
 for(const change of [
  (p:ManagementOriginNativePreparation)=>{p.binding.purpose='FN03_MANAGEMENT_ORIGIN_ISOLATED';},
  (p:ManagementOriginNativePreparation)=>{p.binding.profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';},
  (p:ManagementOriginNativePreparation)=>{p.binding.artifactRoot='/tmp/extra/fn03-tc01-'+id(1);},
  (p:ManagementOriginNativePreparation)=>{p.binding.artifactRoot='tmp/fn03-tc01-'+id(1);},
  (p:ManagementOriginNativePreparation)=>{p.runtime.entry='other.ts' as never;},
  (p:ManagementOriginNativePreparation)=>{p.sourceManifestRaw+=' ';},
  ...tc01Sources.map(path=>(p:ManagementOriginNativePreparation)=>{
   const m=JSON.parse(p.sourceManifestRaw);m.files=m.files.filter((r:any)=>r.path!==path);p.sourceManifestRaw=JSON.stringify(m);p.runtime.sourceClosureSha256=h(p.sourceManifestRaw);
  }),
  (p:ManagementOriginNativePreparation)=>{const m=JSON.parse(p.sourceManifestRaw);m.sourceRoot='/home/daon/anvil-fn03-management-'+id(1)+'-qa';p.sourceManifestRaw=JSON.stringify(m);p.runtime.sourceClosureSha256=h(p.sourceManifestRaw);},
 ]){const x=harness('',true);change(x.preparation);assert.throws(()=>createManagementOriginTc01NativeProviders(x.preparation,x.ops));assert.equal(x.trace.length,0);}
});

function rebindFiles(x:ReturnType<typeof harness>,mutate:(plan:any,approval:any)=>void){
 const plan=JSON.parse(x.tree.get(x.receipt+'-plan.json')!.bytes.toString()),approval=JSON.parse(x.tree.get(x.receipt+'-approval.json')!.bytes.toString());
 mutate(plan,approval);const raw=JSON.stringify(plan);x.tree.get(x.receipt+'-plan.json')!.bytes=Buffer.from(raw);x.preparation.binding.planHash=h(raw);
 approval.planHash=h(raw);const approved=JSON.stringify(approval);x.tree.get(x.receipt+'-approval.json')!.bytes=Buffer.from(approved);x.preparation.binding.approvalHash=h(approved);
}

test('원 hash가 맞아도 교차 plan/approval/runtime/receipt는 Git·소비 효과 전 거절',()=>{
 for(const mutate of [
  (plan:any)=>{plan.purpose='FN03_MANAGEMENT_ORIGIN_ISOLATED';},
  (plan:any)=>{plan.profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';},
  (plan:any)=>{plan.receiptRoot=plan.receiptRoot.replace('fn03-tc01-','fn03-management-');},
  (plan:any)=>{plan.runtime.entry='other.ts';},
  (_plan:any,approval:any)=>{approval.purpose='FN03_MANAGEMENT_ORIGIN_ISOLATED_RUN_APPROVAL';},
  (_plan:any,approval:any)=>{approval.profile='FN03_MANAGEMENT_ORIGIN_ENTRY_V1';},
 ]){const x=harness('',true);rebindFiles(x,mutate);const p=createManagementOriginTc01NativeProviders(x.preparation,x.ops);assert.throws(()=>p.assertCurrent(x.preparation.binding));assert.equal(x.commands.length,0);assert(!x.trace.includes('WRITE'));assert(!x.trace.includes('MKDIR'));assert.equal(x.opened.size,0);}
});

test('TC01 Windows·변경 소스·중복 소비 및 legacy DB/타 Pool은 거절·후속 효과0',async()=>{
 for(const fault of ['windows','source','dependency','symlink']){
  const x=harness(fault,true),p=createManagementOriginTc01NativeProviders(x.preparation,x.ops);assert.throws(()=>p.assertCurrent(x.preparation.binding));
  if(fault==='windows')assert.equal(x.trace.length,0);assert(!x.trace.includes('WRITE'));assert(!x.trace.includes('POOL'));assert.equal(x.opened.size,0);
 }
 const x=harness('',true),p=createManagementOriginTc01NativeProviders(x.preparation,x.ops);await p.consume(x.preparation.binding);
 await assert.rejects(p.openPool({...x.request(),database:'anvil_v3_fn03_management_'+id(1).replaceAll('-','')}));assert(!x.trace.includes('POOL'));
 const count=x.trace.length;await assert.rejects(p.prepareArtifactRoot(x.preparation.binding));assert.equal(x.trace.length,count);
 const y=harness('',true),q=createManagementOriginTc01NativeProviders(y.preparation,y.ops);await q.consume(y.preparation.binding);
 let foreignEnd=0;await assert.rejects(q.closePool({end:async()=>{foreignEnd++;}} as Pool,10000));assert.equal(foreignEnd,0);
});

test('TC01 소비된 원 ticket은 같은/다른 provider 모두 재사용0',async()=>{
 const x=harness('',true),p=createManagementOriginTc01NativeProviders(x.preparation,x.ops);let call:Parameters<typeof p.command>[0]|undefined;
 const first=await begin(x,{...p,command(value){call=value;return p.command(value);}});assert.equal(first()?.status,0);assert(call);
 const y=harness('',true),q=createManagementOriginTc01NativeProviders(y.preparation,y.ops);assert.throws(()=>q.command(call!));assert.equal(y.trace.length,0);
 const count=x.trace.length;assert.throws(()=>p.command(call!));assert.equal(x.trace.length,count);
});

test('미소비 원 ticket의 legacy/TC01 교차 및 승인 후 source 교체는 첫 Docker 효과0',async()=>{
 for(const integrated of [false,true]){
  const x=harness('',integrated),factory=integrated?createManagementOriginTc01NativeProviders:createManagementOriginNativeProviders,p=factory(x.preparation,x.ops);
  let call:Parameters<typeof p.command>[0]|undefined;
  const first=await begin(x,{...p,command(value){call=value;return{status:0,signal:null,stdout:'{}'};}});first();assert(call);
  const other=harness('',!integrated),otherFactory=integrated?createManagementOriginNativeProviders:createManagementOriginTc01NativeProviders,q=otherFactory(other.preparation,other.ops);
  assert.throws(()=>q.command(call!));assert.equal(other.trace.length,0);
  const count=x.commands.length;assert.throws(()=>p.command(call!));assert.equal(x.commands.length,count);
 }
 const x=harness('',true),p=createManagementOriginTc01NativeProviders(x.preparation,x.ops);p.assertCurrent(x.preparation.binding);
 x.tree.get(x.root+'/'+tc01Sources[0])!.ino++;
 const before=x.commands.length;await assert.rejects(p.consume(x.preparation.binding));assert.equal(x.commands.length,before);assert(!x.trace.includes('WRITE'));assert(!x.trace.includes('MKDIR'));
});

const officialEvidence=['docs/design/공식산출물_양식정의.md','docs/design/문서작성_공통기준.md','docs/design/기본방법론_상세검토안.md'];
test('통합 native만 currentProfile 원 한글3문서의 tracked checkout/hash를 검산한다',()=>{
 assert.deepEqual(officialEvidence,[currentProfile.forms,currentProfile.standard,currentProfile.methods]);const h=harness('',true,officialEvidence),p=createManagementOriginTc01NativeProviders(h.preparation,h.ops);assert.equal(h.trace.length,0);
 p.assertPreparedRuntime(h.preparation.binding,h.preparation.runtime);assert.equal(h.commands.length,3);assert(h.commands.every(c=>c.path===currentProfile.git));assert.equal(h.opened.size,0);assert(!h.trace.includes('WRITE'));assert(!h.trace.includes('POOL'));
 const bad=harness('',true,officialEvidence);bad.tree.get(bad.root+'/'+officialEvidence[0])!.bytes.fill(0);const q=createManagementOriginTc01NativeProviders(bad.preparation,bad.ops);assert.throws(()=>q.assertPreparedRuntime(bad.preparation.binding,bad.preparation.runtime));assert.equal(bad.opened.size,0);assert(!bad.trace.includes('WRITE'));
});
test('legacy·dependency 및 유사 Unicode 경로에는 통합 native 예외를 확대하지 않는다',()=>{
 const legacy=harness('',false,officialEvidence);assert.throws(()=>createManagementOriginNativeProviders(legacy.preparation,legacy.ops));assert.equal(legacy.trace.length,0);
 for(const path of ['node_modules/'+officialEvidence[0],officialEvidence[0]!.normalize('NFD'),'docs/other/'+officialEvidence[0]!.split('/').at(-1),'./'+officialEvidence[0],'docs/design/임의.md']){const h=harness('',true,[path]);assert.throws(()=>createManagementOriginTc01NativeProviders(h.preparation,h.ops));assert.equal(h.trace.length,0);}
 const d=harness('',true);const manifest=JSON.parse(d.preparation.dependencyManifestRaw);manifest.files.push({path:'node_modules/'+officialEvidence[0],bytes:1,sha256:h('x')});manifest.files.sort((a:any,b:any)=>a.path<b.path?-1:1);d.preparation.dependencyManifestRaw=JSON.stringify(manifest);d.preparation.runtime.installedDependenciesSha256=h(d.preparation.dependencyManifestRaw);assert.throws(()=>createManagementOriginTc01NativeProviders(d.preparation,d.ops));assert.equal(d.trace.length,0);
});
