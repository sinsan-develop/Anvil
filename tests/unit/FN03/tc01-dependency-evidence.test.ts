import test from 'node:test';
import assert from 'node:assert/strict';
import {posix} from 'node:path';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {prepareTc01BootstrapInput} from '../../../scripts/qa-fn03-tc01-bootstrap-input.ts';
import {createTc01DependencyEvidence} from '../../../scripts/qa-fn03-tc01-dependency-evidence.ts';
import {createTc01PreloadFiles,type Tc01PreloadFilesPort} from '../../../scripts/qa-fn03-tc01-preload-files.ts';

function fixture(){
 const binding={attemptId:'a1000000-0000-4000-8000-000000000001',sourceHead:'a'.repeat(40),packageLockSha256:contentHash('lock'),issuedAt:1000,expiresAt:2000};
 const root='/home/daon/anvil-fn03-tc01-'+binding.attemptId+'-qa';
 const contents=new Map<string,Buffer>([['package-lock.json',Buffer.from('lock')],['scripts/runtime.ts',Buffer.from('export const mock=true;')],['node_modules/example/index.js',Buffer.from('private mock module bytes')],['node_modules/.package-lock.json',Buffer.from('{}')],['node_modules/@scope/pkg/empty.json',Buffer.alloc(0)]]);
 let inode=1,fd=10,wall=1001,mono=0;
 const nodes=new Map<string,any>(),handles=new Map<number,string>(),trace:{op:string;path?:string;fd?:number}[]=[],buffers:Buffer[]=[];
 const metadata=(dir:boolean,size=0)=>({dev:1,ino:inode++,uid:1000,gid:1000,mode:dir?0o040755:0o100644,size,mtimeMs:1,ctimeMs:1,nlink:dir?2:1});
 function build(){nodes.clear();for(const [relative,data]of contents){const path=root+'/'+relative;let parent=posix.dirname(path);while(parent!=='/'){if(!nodes.has(parent))nodes.set(parent,{...metadata(true),uid:['/home','/home/daon'].includes(parent)?0:1000});parent=posix.dirname(parent);}nodes.set(path,metadata(false,data.length));}nodes.get(root).mode=0o040700;}
 const hooks:any={before:(_op:string,_path:string)=>{},afterRead:(_path:string)=>{},close:()=>{},current:()=>{},context:()=>({platform:'linux',uid:1000})};
 const access=(op:string,path:string)=>{trace.push({op,path});hooks.before(op,path);const s=nodes.get(path);if(!s)throw Error('PRIVATE_MISSING');return s;};
 const io:Tc01PreloadFilesPort={context:()=>hooks.context(),lstat:path=>({...access('lstat',path)}),fstat:n=>{const path=handles.get(n);if(!path)throw Error('PRIVATE_FD');return{...access('fstat',path)};},realpath:path=>{access('realpath',path);return path;},open:path=>{access('open',path);const n=fd++;handles.set(n,path);return n;},
  read:(n,b,o,len,p)=>{const path=handles.get(n)!;access('read',path);if(!buffers.includes(b))buffers.push(b);const data=contents.get(path.slice(root.length+1))!,count=Math.min(len,Math.max(0,data.length-p));data.copy(b,o,p,p+count);hooks.afterRead(path);return count;},
  close:n=>{trace.push({op:'close',fd:n});assert(handles.has(n));handles.delete(n);hooks.close();},
  readdir:(path,limit)=>{access('readdir',path);return [...nodes.keys()].filter(p=>posix.dirname(p)===path).map(p=>posix.basename(p)).reverse().slice(0,limit);}};
 const supervisor={now:()=>wall,monotonic:()=>mono,assertCurrent:(b:Readonly<Record<string,unknown>>)=>{assert.deepEqual({...b},binding);hooks.current();}};
 build();return{binding,root,contents,nodes,handles,trace,buffers,hooks,io,supervisor,build,metadata,setTime:(w:number,m:number)=>{wall=w;mono=m;}};
}
const zero=(f:ReturnType<typeof fixture>)=>assert(f.buffers.every(b=>b.every(x=>x===0)));
const fail=(f:ReturnType<typeof fixture>)=>{assert.throws(()=>createTc01DependencyEvidence(f.supervisor,f.io).observe(f.binding),/^Error: FN03_TC01_DEPENDENCY_EVIDENCE_UNKNOWN$/);assert.equal(f.handles.size,0);zero(f);};
test('candidate exact sorted manifest preserves all files; scratch cleared and factory single-use',()=>{
 const f=fixture(),owner=createTc01DependencyEvidence(f.supervisor,f.io);assert.equal(f.trace.length,0);const result=owner.observe(f.binding),m=JSON.parse(result.manifestRaw);
 const files=[...f.contents].filter(([p])=>p.startsWith('node_modules/')).map(([path,b])=>({path,bytes:b.length,sha256:contentHash(b)})).sort((a,b)=>a.path<b.path?-1:1);
 assert.deepEqual(m,{schemaVersion:1,sourceHead:f.binding.sourceHead,packageLockSha256:f.binding.packageLockSha256,files});
 assert.equal(result.manifestRaw,canonicalJson(m)+'\n');assert.equal(result.manifestSha256,contentHash(result.manifestRaw));assert.equal(result.authority,'NOT_ISSUED');assert.equal(result.status,'CANDIDATE_ONLY');assert.equal(JSON.stringify(result).includes('private mock'),false);
 assert.equal(f.trace.filter(t=>t.op==='open').length,files.length);assert.equal(f.trace.filter(t=>t.op==='close').length,files.length);assert.equal(f.handles.size,0);zero(f);assert(f.buffers.every(b=>b.length<=65536));const count=f.trace.length;assert.throws(()=>owner.observe(f.binding));assert.equal(f.trace.length,count);
});

function consumer(f:ReturnType<typeof fixture>,dependencyManifestRaw:string,manifestSha256=contentHash(dependencyManifestRaw)){
 const b=f.binding,binding={attemptId:b.attemptId,approvalId:'a1000000-0000-4000-8000-000000000002',planHash:'1'.repeat(64),approvalHash:'2'.repeat(64),sourceHead:b.sourceHead,issuedAt:b.issuedAt,expiresAt:b.expiresAt,artifactRoot:'/tmp/fn03-tc01-'+b.attemptId,subnet:'172.18.0.16/28',purpose:'FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile:'FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1'};
 const source={schemaVersion:1,sourceHead:b.sourceHead,sourceRoot:f.root,gitSha256:'3'.repeat(64),dockerSha256:'4'.repeat(64),files:[...f.contents].filter(([p])=>!p.startsWith('node_modules/')).map(([path,bytes])=>({path,bytes:bytes.length,sha256:contentHash(bytes)})).sort((a,b)=>a.path<b.path?-1:1)};
 const sourceManifestRaw=canonicalJson(source)+'\n',runtime={sourceHead:b.sourceHead,entry:'scripts/qa-fn03-source-content-management-origin-entry.ts',nodeSha256:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb',sourceClosureSha256:contentHash(sourceManifestRaw),packageLockSha256:b.packageLockSha256,installedDependenciesSha256:manifestSha256};
 return {input:{preparation:{binding,runtime,sourceManifestRaw,dependencyManifestRaw},retainPaths:['node_modules/example/index.js']},supervisor:{now:f.supervisor.now,monotonic:f.supervisor.monotonic,assertCurrent:(seen:Readonly<Record<string,unknown>>,r:Readonly<Record<string,unknown>>)=>{assert.deepEqual({...seen},binding);assert.deepEqual({...r},runtime);f.hooks.current();}}};
}
test('unaltered canonical candidate is accepted by existing preload and changed installation is rejected',()=>{
 const f=fixture(),result=createTc01DependencyEvidence(f.supervisor,f.io).observe(f.binding),c=consumer(f,result.manifestRaw,result.manifestSha256);
 const held=createTc01PreloadFiles(c.supervisor,f.io).read(c.input);assert.equal(held.files[0]!.bytes.toString(),'private mock module bytes');held.assertCurrent();held.dispose();zero(f);
 for(const mode of ['sha','lock','file','extra','missing','empty','link']){const g=fixture(),r=createTc01DependencyEvidence(g.supervisor,g.io).observe(g.binding);let raw=r.manifestRaw;
  if(mode==='lock'){const v=JSON.parse(raw);v.packageLockSha256='0'.repeat(64);raw=canonicalJson(v)+'\n';}
  const x=consumer(g,raw,mode==='sha'?'0'.repeat(64):contentHash(raw));
  if(mode==='file')g.contents.get('node_modules/example/index.js')!.fill(65);
  if(mode==='extra')g.nodes.set(g.root+'/node_modules/extra.js',g.metadata(false,0));
  if(mode==='missing')g.nodes.delete(g.root+'/node_modules/example/index.js');
  if(mode==='empty')g.nodes.set(g.root+'/node_modules/empty',g.metadata(true));
  if(mode==='link')g.nodes.get(g.root+'/node_modules/example/index.js').mode=0o120777;
  assert.throws(()=>createTc01PreloadFiles(x.supervisor,g.io).read(x.input),/FN03_TC01_PRELOAD_UNKNOWN/);assert.equal(g.handles.size,0);zero(g);
 }
});
test('input/approval/Linux context failure has no file access and getter or proxy evaluation0',()=>{
 for(const mode of ['attempt','head','lock','extra','expires','wall','mono','approval','void','platform','uid']){const f=fixture();
  if(mode==='attempt')f.binding.attemptId='../other';if(mode==='head')f.binding.sourceHead='A'.repeat(40);if(mode==='lock')f.binding.packageLockSha256='z'.repeat(64);if(mode==='extra')(f.binding as any).root='/outside';if(mode==='expires')f.binding.expiresAt=1000;if(mode==='wall')f.setTime(2000,0);
  if(mode==='mono'){let calls=0;f.supervisor.monotonic=()=>calls++===0?0:999;}
  if(mode==='approval')f.hooks.current=()=>{throw Error('PRIVATE_APPROVAL');};if(mode==='void')f.hooks.current=()=>false;
  if(mode==='void')f.supervisor.assertCurrent=()=>false as any;
  if(mode==='platform')f.hooks.context=()=>({platform:'win32',uid:1000});if(mode==='uid')f.hooks.context=()=>({platform:'linux',uid:0});fail(f);assert.equal(f.trace.length,0);
 }
 let calls=0;const f=fixture();Object.defineProperty(f.binding,'attemptId',{get(){calls++;throw Error('PRIVATE');}});fail(f);assert.equal(calls,0);
 const g=fixture();const p=new Proxy(g.binding,{get(){calls++;throw Error('PRIVATE');}});assert.throws(()=>createTc01DependencyEvidence(g.supervisor,g.io).observe(p));assert.equal(calls,0);assert.equal(g.trace.length,0);
});
test('links, hardlinks, special files, owner/mode and root escape reject before file open',()=>{
 for(const mode of ['symlink','hardlink','special','owner','writable','root','parent','realpath']){const f=fixture(),file=f.root+'/node_modules/.package-lock.json';
  if(mode==='symlink')f.nodes.get(file).mode=0o120777;if(mode==='hardlink')f.nodes.get(file).nlink=2;if(mode==='special')f.nodes.get(file).mode=0o010600;if(mode==='owner')f.nodes.get(file).uid=0;if(mode==='writable')f.nodes.get(file).mode=0o100666;if(mode==='root')f.nodes.get(f.root).mode=0o040755;if(mode==='parent')f.nodes.get('/home/daon').mode=0o040777;if(mode==='realpath')f.io.realpath=()=>'/outside';
  fail(f);assert.equal(f.trace.some(t=>t.op==='open'),false);
 }
});
test('no empty directory or .bin omission; node_modules itself must be a directory',()=>{
 for(const mode of ['empty','bin','root-file','root-empty']){const f=fixture();if(mode==='empty'||mode==='bin')f.nodes.set(f.root+'/node_modules/'+(mode==='bin'?'.bin':'empty'),f.metadata(true));
  if(mode==='root-file'){for(const path of [...f.nodes.keys()])if(path.startsWith(f.root+'/node_modules/'))f.nodes.delete(path);f.nodes.set(f.root+'/node_modules',f.metadata(false,1));f.contents.set('node_modules',Buffer.from('x'));}
  if(mode==='root-empty')for(const path of [...f.nodes.keys()])if(path.startsWith(f.root+'/node_modules/'))f.nodes.delete(path);
  fail(f);
 }
 const f=fixture();f.contents.set('node_modules/.bin/tool',Buffer.from('not a link'));f.build();f.nodes.get(f.root+'/node_modules/.bin/tool').mode=0o120777;fail(f);assert.equal(f.trace.some(t=>t.op==='open'&&t.path?.endsWith('/.bin/tool')),false);
});
test('new normal files are included instead of silently dropping unexpected content',()=>{
 const f=fixture();f.contents.set('node_modules/example/LICENSE',Buffer.from('fixture'));f.build();const result=createTc01DependencyEvidence(f.supervisor,f.io).observe(f.binding);assert(JSON.parse(result.manifestRaw).files.some((r:any)=>r.path==='node_modules/example/LICENSE'));
});
test('invalid or duplicate directory names/path length, excessive rows and metadata length reject',()=>{
 for(const name of ['..','.','a/b','a\\b','한글.js','a\n','name%20','a'.repeat(401)]){const f=fixture();f.io.readdir=()=>[name];fail(f);assert.equal(f.trace.some(t=>t.op==='open'),false);}
 const duplicate=fixture();duplicate.io.readdir=()=>['a','a'];fail(duplicate);
 const huge=fixture();huge.io.readdir=()=>Array.from({length:20001},(_,i)=>'x'+i);fail(huge);assert.equal(huge.trace.some(t=>t.op==='open'),false);
 const big=fixture();big.nodes.get(big.root+'/node_modules/.package-lock.json').size=16777217;fail(big);assert.equal(big.trace.some(t=>t.op==='open'),false);
});
test('open result captured before current failure; original close once and no next file',()=>{
 for(const mode of ['open','read','fstat','close','port']){const f=fixture();
  if(mode==='open'){const open=f.io.open;f.io.open=p=>{const n=open(p);f.setTime(2000,1);return n;};}
  if(mode==='read')f.hooks.afterRead=()=>{f.setTime(2000,1);};
  if(mode==='fstat'){const original=f.io.fstat;let count=0;f.io.fstat=n=>({...original(n) as any,ino:++count});}
  if(mode==='close')f.hooks.close=()=>{throw Error('PRIVATE_CLOSE');};
  if(mode==='port')f.hooks.afterRead=()=>{f.io.lstat=()=>{throw Error('REPLACED');};};
  fail(f);assert.equal(f.trace.filter(t=>t.op==='open').length,1);assert.equal(f.trace.filter(t=>t.op==='close').length,1);
 }
});
test('partial reads, zero file, EOF extra and short read have exact bounded behavior',()=>{
 const f=fixture(),read=f.io.read;f.io.read=(fd,b,o,n,p)=>read(fd,b,o,Math.min(n,2),p);const r=createTc01DependencyEvidence(f.supervisor,f.io).observe(f.binding);assert.equal(JSON.parse(r.manifestRaw).files.find((x:any)=>x.path.endsWith('empty.json')).sha256,contentHash(Buffer.alloc(0)));zero(f);
 for(const mode of ['extra','short','large','throw']){const g=fixture(),original=g.io.read;g.io.read=(fd,b,o,n,p)=>{if(mode==='throw')throw Error('PRIVATE');const count=original(fd,b,o,n,p);return mode==='extra'&&count===0?1:mode==='short'?0:mode==='large'?n+1:count;};fail(g);assert.equal(g.trace.filter(t=>t.op==='open').length,1);assert.equal(g.trace.filter(t=>t.op==='close').length,1);}
});
test('observed file/dir mutation and final additional file remain UNKNOWN',()=>{
 for(const mode of ['file','dir','new','deleted','clock']){const f=fixture();let changed=false;f.hooks.afterRead=(path:string)=>{if(changed)return;changed=true;if(mode==='file')f.nodes.get(path).ctimeMs++;if(mode==='dir')f.nodes.get(f.root+'/node_modules').ctimeMs++;if(mode==='new')f.nodes.set(f.root+'/node_modules/added',f.metadata(false,0));if(mode==='deleted')f.nodes.delete(f.root+'/node_modules/example/index.js');if(mode==='clock')f.setTime(1001,999);};fail(f);}
});

test('same candidate is consumed by bootstrap private loader; tampered manifest never substitutes authority',()=>{
 const f=fixture(),candidate=createTc01DependencyEvidence(f.supervisor,f.io).observe(f.binding);
 const entry='scripts/qa-fn03-tc01-linux-runtime.ts',app='scripts/qa-fn03-source-content-management-origin-entry.ts',native='scripts/qa-fn03-source-content-management-origin-native.ts',graphPath='scripts/qa-fn03-tc01-load-graph.json';
 for(const path of [entry,app,native])f.contents.set(path,Buffer.from('export const synthetic=true;'));
 const graph={schemaVersion:1,entry,files:[...f.contents.keys(),graphPath].sort().map(path=>[entry,app,native].includes(path)?{path,kind:'load',format:'module-typescript'}:path==='node_modules/example/index.js'?{path,kind:'load',format:'commonjs'}:{path,kind:[graphPath,'package-lock.json'].includes(path)?'control':'nonload'}),builtins:[],imports:[{parent:entry,specifier:'example',target:'node_modules/example/index.js'}]};
 const graphBytes=Buffer.from(canonicalJson(graph));f.contents.set(graphPath,graphBytes);f.build();
 const c=consumer(f,candidate.manifestRaw,candidate.manifestSha256),{binding,runtime}=c.input.preparation;
 const plan={schemaVersion:1,purpose:binding.purpose,profile:binding.profile,attemptId:binding.attemptId,sourceHead:binding.sourceHead,issuedAt:binding.issuedAt,expiresAt:binding.expiresAt,artifactRoot:binding.artifactRoot,receiptRoot:'/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+binding.attemptId,subnet:binding.subnet,runtime};
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw),approvalRaw=canonicalJson({schemaVersion:1,purpose:plan.purpose+'_RUN_APPROVAL',profile:plan.profile,decision:'ALLOW_ONE_RUN',approvalId:binding.approvalId,attemptId:plan.attemptId,planHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt});
 const approvalHash=contentHash(approvalRaw);Object.assign(binding,{planHash,approvalHash});
 const input:any={entryInput:{packet:{planRaw,planHash,approvalRaw,approvalHash},isolated:{binding,receiptRoot:plan.receiptRoot,historicalTsv:undefined,legacyBytes:undefined,sources:undefined,passwords:undefined,fixture:undefined},sql:undefined},nativePreparation:c.input.preparation,graphBytes,loadFiles:graph.files.filter(r=>r.kind==='load').map(r=>({path:r.path,bytes:f.contents.get(r.path)!})),now:1001};
 const before=f.trace.length,prepared=prepareTc01BootstrapInput(input);assert.equal(f.trace.length,before);prepared.loader.assertHealthy();
 prepared.loader.resolve(prepared.loader.entryURL,{parentURL:undefined,conditions:['node','import'],importAttributes:{}},()=>{throw Error('NO_FALLBACK');});
 prepared.loader.resolve('example',{parentURL:prepared.loader.entryURL,conditions:['node','import'],importAttributes:{}},()=>{throw Error('NO_FALLBACK');});
 const url='file://'+f.root+'/node_modules/example/index.js',loaded=prepared.loader.load(url,{conditions:['node','require'],importAttributes:{},format:undefined},()=>{throw Error('NO_FALLBACK');});
 assert(Buffer.isBuffer(loaded.source));assert.deepEqual(loaded.source,f.contents.get('node_modules/example/index.js'));prepared.loader.revoke();assert.throws(()=>prepared.loader.assertHealthy());
 input.nativePreparation={...c.input.preparation,dependencyManifestRaw:candidate.manifestRaw+' '};assert.throws(()=>prepareTc01BootstrapInput(input),/FN03_TC01_BOOTSTRAP_INPUT_UNKNOWN/);
 input.nativePreparation={...c.input.preparation,runtime:{...runtime,installedDependenciesSha256:'0'.repeat(64)}};assert.throws(()=>prepareTc01BootstrapInput(input),/FN03_TC01_BOOTSTRAP_INPUT_UNKNOWN/);
});
test('256MiB aggregate boundary rejects the next file before opening it; memory stays one chunk',()=>{
 const f=fixture();f.contents.clear();for(let i=0;i<17;i++)f.contents.set('node_modules/f'+String(i).padStart(2,'0'),Buffer.alloc(0));f.build();
 for(const [path,s]of f.nodes)if(path.startsWith(f.root+'/node_modules/'))s.size=16*1048576;
 f.io.read=(fd,b,o,n,p)=>{assert(f.handles.has(fd));if(!f.buffers.includes(b))f.buffers.push(b);const count=Math.min(n,Math.max(0,16*1048576-p));b.fill(0,o,o+count);return count;};
 fail(f);assert.equal(f.trace.filter(t=>t.op==='open').length,16);assert.equal(f.trace.filter(t=>t.op==='close').length,16);assert(f.buffers.every(b=>b.length<=65536));
});

test('manifest byte cap rejects large metadata output instead of emitting a truncated candidate',()=>{
 const f=fixture();f.contents.clear();const directory='d'.repeat(280);
 for(let i=0;i<5000;i++)f.contents.set('node_modules/'+directory+'/f'+String(i).padStart(5,'0')+'x'.repeat(90),Buffer.alloc(0));f.build();
 fail(f);assert.equal(f.trace.filter(t=>t.op==='open').length,5000);assert.equal(f.trace.filter(t=>t.op==='close').length,5000);
});
test('scratch instance methods cannot replace hashing view or final clearing',()=>{
 const f=fixture(),read=f.io.read;let called=0;f.io.read=(fd,b,o,n,p)=>{const count=read(fd,b,o,n,p);b.subarray=(()=>{called++;throw Error('PRIVATE');}) as never;b.fill=(()=>{called++;throw Error('PRIVATE');}) as never;return count;};
 const result=createTc01DependencyEvidence(f.supervisor,f.io).observe(f.binding);assert.equal(result.status,'CANDIDATE_ONLY');assert.equal(called,0);zero(f);
});
