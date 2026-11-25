import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {contentHash} from '../../../contracts/canonical.ts';
import * as nativeDockerModule from '../../../scripts/qa-ix01-0076-negative-linux-native-docker.ts';
import {
 assert0076NegativeLinuxNativeDockerTransferredOwnerCurrent,bind0076NegativeLinuxNativeDockerOwner,close0076NegativeLinuxNativeDockerTransferredOwner,
 create0076NegativeLinuxNativeDocker,create0076NegativeLinuxNativeDockerForTransfer,create0076NegativeLinuxNativeDockerSameFdForTransfer,create0076NegativeLinuxReadOnlyDockerSystem,
 type NegativeLinuxNativeDockerOwnerPorts,type NegativeLinuxNativeDockerSameFdSource,type NegativeLinuxNativeDockerSystem,
} from '../../../scripts/qa-ix01-0076-negative-linux-native-docker.ts';
import {
 prepare0076NegativeLinuxDocker,prepare0076NegativeLinuxDockerWithToolHandoff,
 type NegativeLinuxDockerAuthority,type NegativeLinuxDockerBinding,type NegativeLinuxDockerInvocation,type NegativeLinuxDockerLegacy,
} from '../../../scripts/qa-ix01-0076-negative-linux-docker.ts';

let sequence=0;
const provider=readFileSync(new URL('../../../db/migrations/0037_provider_session_claims.sql.pending',import.meta.url));
const image='sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',containerId='d'.repeat(64);
const tmpfs={'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456,uid=999,gid=999','/var/run/postgresql':'rw,noexec,nosuid,size=16777216,uid=999,gid=999','/tmp':'rw,noexec,nosuid,size=16777216,uid=999,gid=999'};
function binding(){
 const attemptId='fa000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),compact=attemptId.replaceAll('-','');
 return Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_DOCKER_BINDING' as const,attemptId,sourceHead:'1'.repeat(40),planHash:'2'.repeat(64),approvalHash:'3'.repeat(64),approvalId:'fb000000-0000-4000-8000-000000000001',graphHash:'4'.repeat(64),issuedAt:1000,expiresAt:10_000,
  namespace:Object.freeze({container:'anvil-ix01-0076-negative-'+compact,database:'ix01_0076_negative_'+compact,receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none' as const})}) satisfies Readonly<NegativeLinuxDockerBinding>;
}
function invocation(found:Readonly<NegativeLinuxDockerBinding>,input:string|null=null):Readonly<NegativeLinuxDockerInvocation>{
 return Object.freeze({file:'/usr/bin/docker' as const,argv:Object.freeze(['--config',found.namespace.receipt+'/docker-config','--host','unix:///var/run/docker.sock','info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}']),cwd:'/' as const,
  env:Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',HOME:found.namespace.receipt}),input,timeoutMs:5000,stdoutLimit:65536,stderrLimit:65536});
}
function inspected(found:Readonly<NegativeLinuxDockerBinding>,running:boolean){return{id:containerId,name:'/'+found.namespace.container,image,user:'999:999',labels:{'anvil.owner':'IX01_0076_NEGATIVE','anvil.instance':found.attemptId.replaceAll('-',''),'anvil.plan':found.planHash},running,
 host:{Privileged:false,ReadonlyRootfs:true,NetworkMode:'none',LogConfig:{Type:'none',Config:{}},CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PidsLimit:64,Memory:536870912,NanoCpus:1000000000,PublishAllPorts:false,PortBindings:{},Binds:null,VolumesFrom:null,Tmpfs:{...tmpfs}},mounts:[],
 networks:running?{none:{NetworkID:'f'.repeat(64),IPAddress:''}}:{none:{MacAddress:'',NetworkID:'',EndpointID:'',Gateway:'',IPAddress:'',IPv6Gateway:'',GlobalIPv6Address:'',GwPriority:0,IPPrefixLen:0,GlobalIPv6PrefixLen:0,IPAMConfig:null,Links:null,Aliases:null,DriverOpts:null,DNSNames:null}},ports:{'5432/tcp':null}};}
class Stream extends EventEmitter{bytes=new Uint8Array();end(value?:Uint8Array){this.bytes=value?new Uint8Array(value):new Uint8Array();queueMicrotask(()=>this.emit('finish'));}}
class Child extends EventEmitter{stdin=new Stream();stdout=new Stream();stderr=new Stream();}
function fixture(mode:'NORMAL'|'OWNER_LOST'|'TOOL_CHANGED'|'SETUID_TOOL'|'CLOSE_UNKNOWN'|'TIMEOUT'|'SPAWN_THROW'|'AUTO_PREPARE'|'AUTO_PREPARE_CLOSE_UNKNOWN'|'AUTO_PREPARE_EXPIRE_WALL_DURING_FINAL_STAT'|'AUTO_PREPARE_EXPIRE_MONO_DURING_FINAL_STAT'|'BAD_SERVER'|'NEVER_READY'|'ARBITRARY_SQL'|'MALFORMED_CREATE'='NORMAL',transfer=false,source?:(system:NegativeLinuxNativeDockerSystem)=>NegativeLinuxNativeDockerSameFdSource){
 const expected=binding(),priorSql=Object.freeze(Array.from({length:106},(_,index)=>Object.freeze({id:String(index).padStart(4,'0')+'_row',path:index===37?'db/migrations/0037_provider_session_claims.sql.pending':'db/migrations/'+String(index).padStart(4,'0')+'_row.sql',bytes:index===37?new Uint8Array(provider):new TextEncoder().encode('SELECT '+index+';')}))),materials=Object.freeze({roleSql:'ROLE_SQL',bootstrapSql:'BOOTSTRAP_SQL',finalServerRaw:'postgres\n',priorSql}),toolBytes=new Uint8Array(Buffer.from('fixed docker executable bytes')),handle=Object.freeze(Object.create(null));let wall=2000,mono=10.25,opened=0,reads=0,statCalls=0,currentCalls=0,spawns=0,terminates=0,closes=0,inspectCount=0,expireAfterFinalStats:number|null=null;
 const stat=()=>Object.freeze({path:'/usr/bin/docker',realpath:'/usr/bin/docker',kind:'FILE' as const,dev:11,ino:12,uid:0,gid:0,mode:mode==='SETUID_TOOL'?0o104755:0o100755,nlink:1,size:toolBytes.byteLength,mtimeMs:1.25,ctimeMs:2.5});
 const ownerRecipient=Object.freeze(Object.create(null));
 const owner=Object.freeze({recipient:ownerRecipient,binding:expected,materials,assertCurrent(this:object,found:Readonly<NegativeLinuxDockerBinding>){currentCalls++;assert.equal(this,ownerRecipient);assert.equal(found,expected);if(mode==='OWNER_LOST'&&currentCalls>2)throw Error('lost');},wall(this:object){assert.equal(this,ownerRecipient);return wall;},monotonic(this:object){assert.equal(this,ownerRecipient);return mono;}}) satisfies NegativeLinuxNativeDockerOwnerPorts;
 const children:Child[]=[],systemRecipient=Object.freeze(Object.create(null));
 const system=Object.freeze({recipient:systemRecipient,open(this:object,path:string){assert.equal(this,systemRecipient);assert.equal(path,'/usr/bin/docker');opened++;return handle;},stat(this:object,found:object){assert.equal(this,systemRecipient);assert.equal(found,handle);statCalls++;if(expireAfterFinalStats!==null&&--expireAfterFinalStats===0){if(mode==='AUTO_PREPARE_EXPIRE_WALL_DURING_FINAL_STAT')wall=10_000;else mono=8010.25;}const value=stat();return mode==='TOOL_CHANGED'&&statCalls>2?Object.freeze({...value,mtimeMs:9.5}):value;},read(this:object,found:object,offset:number,length:number){assert.equal(this,systemRecipient);assert.equal(found,handle);assert(length>0&&length<=1024*1024);reads++;return new Uint8Array(toolBytes.slice(offset,offset+length));},spawnPinned(this:object,found:object,raw:Readonly<NegativeLinuxDockerInvocation>){assert.equal(this,systemRecipient);assert.equal(found,handle);assert.equal(raw.file,'/usr/bin/docker');spawns++;if(mode==='SPAWN_THROW')throw Error('spawn');const child=new Child();children.push(child);
    if(['AUTO_PREPARE','AUTO_PREPARE_CLOSE_UNKNOWN','AUTO_PREPARE_EXPIRE_WALL_DURING_FINAL_STAT','AUTO_PREPARE_EXPIRE_MONO_DURING_FINAL_STAT','BAD_SERVER','NEVER_READY','ARBITRARY_SQL','MALFORMED_CREATE'].includes(mode)){const args=raw.argv.slice(4);let stdout='';if(args[0]==='info')stdout=JSON.stringify({ID:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',Name:'SINSAN'});else if(args[0]==='image')stdout=JSON.stringify({id:image,volumes:{'/var/lib/postgresql/data':{}}});else if(args[0]==='container'&&args[1]==='ls')stdout='';else if(args[0]==='create')stdout=mode==='MALFORMED_CREATE'?'not-a-container-id\n':containerId+'\n';else if(args[0]==='container'&&args[1]==='inspect'){if(mode.includes('EXPIRE_')&&inspectCount===2)expireAfterFinalStats=5;stdout=JSON.stringify(inspected(expected,inspectCount++>0));}else if(args[0]==='start')stdout=containerId+'\n';else if(args.includes('/proc/1/comm'))stdout=mode==='BAD_SERVER'?'bash\n':mode==='NEVER_READY'?'starting\n':'postgres\n';else if(args.includes('pg_isready'))stdout='READY\n';else if(args.includes('psql'))stdout=raw.input==='BOOTSTRAP_SQL'?'':'ROLE_OK';else assert.fail('unexpected '+JSON.stringify(args));queueMicrotask(()=>queueMicrotask(()=>{if(stdout)child.stdout.emit('data',Buffer.from(stdout));child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);}));}
   return child;},terminate(this:object,child:object,signal:'SIGKILL'){assert.equal(this,systemRecipient);assert(children.includes(child as Child));assert.equal(signal,'SIGKILL');terminates++;},setTimeout(this:object,callback:()=>void,ms:number){assert.equal(this,systemRecipient);if(mode==='TIMEOUT'||['AUTO_PREPARE','AUTO_PREPARE_CLOSE_UNKNOWN','AUTO_PREPARE_EXPIRE_WALL_DURING_FINAL_STAT','AUTO_PREPARE_EXPIRE_MONO_DURING_FINAL_STAT','BAD_SERVER','NEVER_READY','ARBITRARY_SQL'].includes(mode)&&ms===250)queueMicrotask(callback);return Object.freeze({ms});},clearTimeout(this:object){assert.equal(this,systemRecipient);},close(this:object,found:object){assert.equal(this,systemRecipient);assert.equal(found,handle);closes++;return ['CLOSE_UNKNOWN','AUTO_PREPARE_CLOSE_UNKNOWN'].includes(mode)?'UNKNOWN' as const:'CLOSED' as const;}}) satisfies NegativeLinuxNativeDockerSystem;
 const capability=bind0076NegativeLinuxNativeDockerOwner(owner),transferred=source?create0076NegativeLinuxNativeDockerSameFdForTransfer(capability,source(system)):transfer?create0076NegativeLinuxNativeDockerForTransfer(capability,system):null,
  ports=transferred?.system??create0076NegativeLinuxNativeDocker(capability,system);
 return{expected,toolBytes,owner,system,ports,handoff:transferred?.handoff??null,children,get opened(){return opened;},get reads(){return reads;},get spawns(){return spawns;},get terminates(){return terminates;},get closes(){return closes;},setClock(nextWall:number,nextMono:number){wall=nextWall;mono=nextMono;}};
}

function sameFd(mode:'NORMAL'|'REPLACED'|'DIFFERENT_CHILD'|'EXPIRE_DURING_CHILD_STAT'|'SPAWN_THROW'='NORMAL'){
 let rawSystem:NegativeLinuxNativeDockerSystem|null=null,sourceStats=0,spawns=0,terminates=0,childStats=0,clock:((wall:number,mono:number)=>void)|null=null;
 const recipient=Object.freeze(Object.create(null));
 const source=Object.freeze({
  recipient,
  open(this:object,path:string){assert.equal(this,recipient);return rawSystem!.open.call(rawSystem!.recipient,path);},
  stat(this:object,handle:object){assert.equal(this,recipient);sourceStats++;const found=rawSystem!.stat.call(rawSystem!.recipient,handle);return mode==='REPLACED'&&sourceStats>2?Object.freeze({...found,ino:found.ino+1}):found;},
  read(this:object,handle:object,offset:number,length:number){assert.equal(this,recipient);return rawSystem!.read.call(rawSystem!.recipient,handle,offset,length);},
  spawn(this:object,file:'/proc/self/fd/3',args:readonly string[],options:Readonly<{argv0:'/usr/bin/docker';cwd:'/';env:Readonly<Record<string,string>>;shell:false;detached:false;stdio:readonly ['pipe','pipe','pipe',object]}>){
   assert.equal(this,recipient);assert.equal(file,'/proc/self/fd/3');assert.equal(options.argv0,'/usr/bin/docker');assert.equal(options.cwd,'/');assert.equal(options.shell,false);assert.equal(options.detached,false);assert.deepEqual(options.stdio.slice(0,3),['pipe','pipe','pipe']);assert.equal(args[0],'--config');
   spawns++;if(mode==='SPAWN_THROW')throw Error('spawn');return rawSystem!.spawnPinned.call(rawSystem!.recipient,options.stdio[3],Object.freeze({file:'/usr/bin/docker',argv:Object.freeze([...args]),cwd:'/',env:options.env,input:null,timeoutMs:5000,stdoutLimit:65536,stderrLimit:65536}));
  },
  childExecutable(this:object,child:object){assert.equal(this,recipient);assert(child instanceof Child);childStats++;if(mode==='EXPIRE_DURING_CHILD_STAT')clock?.(10_000,8010.25);return Object.freeze({dev:11,ino:mode==='DIFFERENT_CHILD'?13:12});},
  terminate(this:object,child:object,signal:'SIGKILL'){assert.equal(this,recipient);terminates++;return rawSystem!.terminate.call(rawSystem!.recipient,child,signal);},
  setTimeout(this:object,callback:()=>void,ms:number){assert.equal(this,recipient);return rawSystem!.setTimeout.call(rawSystem!.recipient,callback,ms);},
  clearTimeout(this:object,handle:unknown){assert.equal(this,recipient);rawSystem!.clearTimeout.call(rawSystem!.recipient,handle);},
  close(this:object,handle:object){assert.equal(this,recipient);return rawSystem!.close.call(rawSystem!.recipient,handle);},
 }) satisfies NegativeLinuxNativeDockerSameFdSource;
 return{bind(system:NegativeLinuxNativeDockerSystem){rawSystem=system;return source;},bindClock(value:(wall:number,mono:number)=>void){clock=value;},get spawns(){return spawns;},get terminates(){return terminates;},get childStats(){return childStats;}};
}

function legacy(h:ReturnType<typeof fixture>,options:Readonly<{roleSql?:string;bootstrapSql?:string;parseFinalServer?:(raw:string)=>boolean}>={}){
 return Object.freeze({daemonInfoArgs(){return Object.freeze(['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}']);},finalServerArgs(found:string){assert.equal(found,containerId);return Object.freeze(['exec','--user','999:999',found,'cat','/proc/1/comm']);},parseFinalServer(raw:string){return options.parseFinalServer?.(raw)??raw==='postgres\n';},bootstrapSql(found:string){assert.equal(found,h.expected.namespace.database);return options.bootstrapSql??'BOOTSTRAP_SQL';},roleMetadataSql(){return options.roleSql??'ROLE_SQL';},verifyPristineRoles(raw:string){assert.equal(raw,'ROLE_OK');},verifyInstallerRoles(raw:string){assert.equal(raw,'ROLE_OK');}}) satisfies NegativeLinuxDockerLegacy;
}
function authority(h:ReturnType<typeof fixture>){const recipient=Object.freeze(Object.create(null));return Object.freeze({recipient,binding:h.expected,assertClaimed(this:object,found:object){assert.equal(this,recipient);assert.equal(found,h.expected);},assertCurrent(this:object,found:object){assert.equal(this,recipient);assert.equal(found,h.expected);},wall(this:object){assert.equal(this,recipient);return 2000;},monotonic(this:object){assert.equal(this,recipient);return 10.25;}}) satisfies NegativeLinuxDockerAuthority;}

test('원 closure 뒤 같은 Docker handle의 최초 bytes·identity와 원 child close만 결과로 반환한다',async()=>{
 const h=fixture(),pin=await h.ports.pin.call(h.ports.recipient,'/usr/bin/docker');assert.equal(pin.sha256,contentHash(h.toolBytes));assert.deepEqual(Object.keys(pin),['path','realpath','kind','dev','ino','uid','mode','nlink','size','mtimeMs','ctimeMs','sha256','custody']);assert.equal(h.opened,1);h.ports.current.call(h.ports.recipient,pin);
 const pending=h.ports.run.call(h.ports.recipient,pin,invocation(h.expected));assert.equal(h.spawns,1);const child=h.children[0]!;await Promise.resolve();assert.equal(child.stdin.bytes.byteLength,0);
 child.stdout.emit('data',Buffer.from('ok\n'));child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);
 assert.deepEqual(await pending,{status:0,signal:null,closed:true,stdout:'ok\n',stderr:''});assert.equal(await h.ports.release.call(h.ports.recipient,pin),'CLOSED');assert.equal(h.closes,1);
});

test('고정 /proc/self/fd/3 상속은 같은 Docker inode child만 입력·종결을 수용하고 불명 뒤 재시도하지 않는다',async()=>{
 assert.equal('create0076NegativeLinuxNativeDockerNodeForTransfer' in nativeDockerModule,false);
 const fixed=sameFd(),ok=fixture('NORMAL',false,fixed.bind);fixed.bindClock(ok.setClock);const pin=await ok.ports.pin.call(ok.ports.recipient,'/usr/bin/docker');
 const pending=ok.ports.run.call(ok.ports.recipient,pin,invocation(ok.expected));assert.equal(fixed.spawns,1);assert.equal(fixed.childStats,1);const child=ok.children[0]!;await Promise.resolve();assert.equal(child.stdin.bytes.byteLength,0);
 child.stdout.emit('data',Buffer.from('ok\n'));child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',0,null);child.emit('close',0,null);
 assert.deepEqual(await pending,{status:0,signal:null,closed:true,stdout:'ok\n',stderr:''});assert.equal(await ok.ports.release.call(ok.ports.recipient,pin),'CLOSED');

 const preparedSource=sameFd(),prepared=fixture('AUTO_PREPARE',false,preparedSource.bind);preparedSource.bindClock(prepared.setClock);
 assert.equal((await prepare0076NegativeLinuxDocker(prepared.expected,authority(prepared),legacy(prepared),prepared.ports)).status,'PREPARED');assert.equal(preparedSource.spawns,13);assert.equal(preparedSource.childStats,13);
 assert(prepared.children.some(found=>Buffer.from(found.stdin.bytes).toString('utf8')==='BOOTSTRAP_SQL'));assert(prepared.children.some(found=>Buffer.from(found.stdin.bytes).toString('utf8')==='ROLE_SQL'));

 for(const mode of ['REPLACED','DIFFERENT_CHILD','EXPIRE_DURING_CHILD_STAT','SPAWN_THROW'] as const){
  const source=sameFd(mode),h=fixture('NORMAL',false,source.bind);source.bindClock(h.setClock);const found=await h.ports.pin.call(h.ports.recipient,'/usr/bin/docker'),first=await h.ports.run.call(h.ports.recipient,found,invocation(h.expected));
  assert.equal(first.closed,false);const after=source.spawns;assert.equal((await h.ports.run.call(h.ports.recipient,found,invocation(h.expected))).closed,false);assert.equal(source.spawns,after);
  if(mode==='REPLACED')assert.equal(source.spawns,0);else assert.equal(source.spawns,1);
  if(mode==='DIFFERENT_CHILD'){assert.equal(source.terminates,1);const child=h.children[0]!;assert.doesNotThrow(()=>{child.stdin.emit('error',Error('late'));child.stdout.emit('error',Error('late'));child.stderr.emit('error',Error('late'));child.emit('error',Error('late'));child.emit('close',null,'SIGKILL');});}
  if(mode==='EXPIRE_DURING_CHILD_STAT'){assert.equal(source.terminates,1);assert.equal(h.children[0]!.stdin.bytes.byteLength,0);}
 }
});

test('기존 Docker prepare는 exact pin 형상과 승인된 command 순서를 그대로 소비한다',async()=>{
 const h=fixture('AUTO_PREPARE'),result=await prepare0076NegativeLinuxDocker(h.expected,authority(h),legacy(h),h.ports);assert.equal(result.status,'PREPARED');assert.equal(h.opened,1);assert.equal(h.closes,1);assert.equal(h.spawns,13);
});

test('malformed create 결과는 Promise를 남기지 않고 UNKNOWN으로 종결한다',async()=>{
 const h=fixture('MALFORMED_CREATE'),result=await prepare0076NegativeLinuxDocker(h.expected,authority(h),legacy(h),h.ports);assert.equal(result.status,'UNKNOWN');assert.equal(h.spawns,4);assert.equal(h.closes,1);
});

test('보호 prepare는 COMPLETE인 같은 원 Docker handle을 opaque owner로 한 번 이전하고 소비 후 정확히 닫는다',async()=>{
 const h=fixture('AUTO_PREPARE',true);assert(h.handoff!==null);
 const result=await prepare0076NegativeLinuxDockerWithToolHandoff(h.expected,authority(h),legacy(h),h.ports,h.handoff);
 assert.equal(result.status,'PREPARED');if(result.status!=='PREPARED')assert.fail();
 assert.equal(result.toolCloseConfirmed,false);assert.deepEqual(Object.keys(result.toolOwner),[]);assert.equal(h.opened,1);assert.equal(h.closes,0);assert.equal(h.spawns,13);
 assert.doesNotThrow(()=>assert0076NegativeLinuxNativeDockerTransferredOwnerCurrent(result.toolOwner,result.target));
 const equalValueTarget=Object.freeze({...result.target});assert.throws(()=>assert0076NegativeLinuxNativeDockerTransferredOwnerCurrent(result.toolOwner,equalValueTarget));
 const wrong=Object.freeze({...result.target,containerId:'e'.repeat(64)});
 assert.throws(()=>assert0076NegativeLinuxNativeDockerTransferredOwnerCurrent(result.toolOwner,wrong));
 await assert.rejects(close0076NegativeLinuxNativeDockerTransferredOwner(result.toolOwner,wrong));assert.equal(h.closes,0);
 assert.equal(await close0076NegativeLinuxNativeDockerTransferredOwner(result.toolOwner,result.target),'CLOSED');
 assert.equal(await close0076NegativeLinuxNativeDockerTransferredOwner(result.toolOwner,result.target),'CLOSED');assert.equal(h.closes,1);
});

test('인계 뒤 만료는 owner 사용을 막되 원 handle의 단회 정리는 보존한다',async()=>{
 const h=fixture('AUTO_PREPARE',true);assert(h.handoff!==null);
 const result=await prepare0076NegativeLinuxDockerWithToolHandoff(h.expected,authority(h),legacy(h),h.ports,h.handoff);
 assert.equal(result.status,'PREPARED');if(result.status!=='PREPARED')assert.fail();
 h.setClock(10_000,8010.25);assert.throws(()=>assert0076NegativeLinuxNativeDockerTransferredOwnerCurrent(result.toolOwner,result.target));
 assert.equal(await close0076NegativeLinuxNativeDockerTransferredOwner(result.toolOwner,result.target),'CLOSED');assert.equal(h.closes,1);
});

test('transfer owner 발급 뒤 마지막 stat 중 만료되면 UNKNOWN으로 남기고 release하지 않는다',async()=>{
 for(const mode of ['AUTO_PREPARE_EXPIRE_WALL_DURING_FINAL_STAT','AUTO_PREPARE_EXPIRE_MONO_DURING_FINAL_STAT'] as const){
  const h=fixture(mode,true);assert(h.handoff!==null);const result=await prepare0076NegativeLinuxDockerWithToolHandoff(h.expected,authority(h),legacy(h),h.ports,h.handoff);
  assert.deepEqual(result,{status:'UNKNOWN',containerId,resourceMayExist:true,toolCloseConfirmed:false});assert.equal(h.opened,1);assert.equal(h.closes,0);assert.equal(h.spawns,13);
 }
});

test('prepare 미완료는 기존 release로 회수하고 transferred close 불명은 재close·current 복구를 만들지 않는다',async()=>{
 const incomplete=fixture('BAD_SERVER',true);assert(incomplete.handoff!==null);const failed=await prepare0076NegativeLinuxDockerWithToolHandoff(incomplete.expected,authority(incomplete),legacy(incomplete),incomplete.ports,incomplete.handoff);
 assert.equal(failed.status,'UNKNOWN');assert.equal(incomplete.closes,1);
 const unknown=fixture('AUTO_PREPARE_CLOSE_UNKNOWN',true);assert(unknown.handoff!==null);const prepared=await prepare0076NegativeLinuxDockerWithToolHandoff(unknown.expected,authority(unknown),legacy(unknown),unknown.ports,unknown.handoff);
 assert.equal(prepared.status,'PREPARED');if(prepared.status!=='PREPARED')assert.fail();assert.equal(await close0076NegativeLinuxNativeDockerTransferredOwner(prepared.toolOwner,prepared.target),'UNKNOWN');
 assert.equal(await close0076NegativeLinuxNativeDockerTransferredOwner(prepared.toolOwner,prepared.target),'UNKNOWN');assert.equal(unknown.closes,1);assert.throws(()=>assert0076NegativeLinuxNativeDockerTransferredOwnerCurrent(prepared.toolOwner,prepared.target));
});

test('보호 R9 재료·server 관측·40회 한도를 독립 검산해 임의 privileged SQL을 실행하지 않는다',async()=>{
 const arbitrary=fixture('ARBITRARY_SQL'),arbitraryResult=await prepare0076NegativeLinuxDocker(arbitrary.expected,authority(arbitrary),legacy(arbitrary,{roleSql:'ALTER SYSTEM SET fsync=off'}),arbitrary.ports);assert.equal(arbitraryResult.status,'UNKNOWN');assert.equal(arbitrary.spawns,9);
 const bootstrap=fixture('ARBITRARY_SQL'),bootstrapResult=await prepare0076NegativeLinuxDocker(bootstrap.expected,authority(bootstrap),legacy(bootstrap,{bootstrapSql:'DROP DATABASE postgres'}),bootstrap.ports);assert.equal(bootstrapResult.status,'UNKNOWN');assert.equal(bootstrap.spawns,10);
 const stale=fixture('BAD_SERVER'),staleResult=await prepare0076NegativeLinuxDocker(stale.expected,authority(stale),legacy(stale,{parseFinalServer:()=>true}),stale.ports);assert.equal(staleResult.status,'UNKNOWN');assert.equal(stale.spawns,8);
 const bounded=fixture('NEVER_READY'),boundedResult=await prepare0076NegativeLinuxDocker(bounded.expected,authority(bounded),legacy(bounded,{parseFinalServer:()=>false}),bounded.ports);assert.equal(boundedResult.status,'UNKNOWN');assert.equal(bounded.spawns,47);
});

test('owner·도구 current 상실과 만료는 stdin·spawn 또는 후속 command를 만들지 않는다',async()=>{
 const lost=fixture('OWNER_LOST');await assert.rejects(lost.ports.pin.call(lost.ports.recipient,'/usr/bin/docker'));assert.equal(lost.opened,0);assert.equal(lost.spawns,0);
 const changed=fixture('TOOL_CHANGED'),pin=await changed.ports.pin.call(changed.ports.recipient,'/usr/bin/docker');assert.throws(()=>changed.ports.current.call(changed.ports.recipient,pin));const result=await changed.ports.run.call(changed.ports.recipient,pin,invocation(changed.expected));assert.equal(result.closed,false);assert.equal(changed.spawns,0);
 const expired=fixture();expired.setClock(10_000,8010.25);await assert.rejects(expired.ports.pin.call(expired.ports.recipient,'/usr/bin/docker'));assert.equal(expired.opened,0);
 const setuid=fixture('SETUID_TOOL');await assert.rejects(setuid.ports.pin.call(setuid.ports.recipient,'/usr/bin/docker'));assert.equal(setuid.opened,1);assert.equal(setuid.closes,1);assert.equal(setuid.spawns,0);
 const arbitrary=fixture(),arbitraryPin=await arbitrary.ports.pin.call(arbitrary.ports.recipient,'/usr/bin/docker'),base=invocation(arbitrary.expected),bad=Object.freeze({...base,argv:Object.freeze([...base.argv.slice(0,4),'container','rm','x'])});assert.equal((await arbitrary.ports.run.call(arbitrary.ports.recipient,arbitraryPin,bad)).closed,false);assert.equal(arbitrary.spawns,0);
});

test('close 불명·중복 pin·위조 capability는 재close·재open·실행 권위를 만들지 않는다',async()=>{
 const h=fixture('CLOSE_UNKNOWN'),pin=await h.ports.pin.call(h.ports.recipient,'/usr/bin/docker');await assert.rejects(h.ports.pin.call(h.ports.recipient,'/usr/bin/docker'));assert.equal(h.opened,1);
 assert.equal(await h.ports.release.call(h.ports.recipient,pin),'UNKNOWN');assert.equal(await h.ports.release.call(h.ports.recipient,pin),'UNKNOWN');assert.equal(h.closes,1);assert.equal(h.spawns,0);
 assert.throws(()=>create0076NegativeLinuxNativeDocker(Object.freeze(Object.create(null)),h.system));
 const native=create0076NegativeLinuxReadOnlyDockerSystem();assert.throws(()=>native.spawnPinned.call(native.recipient,Object.freeze(Object.create(null)),invocation(h.expected)),/SAME_FD_EXEC_UNVERIFIED/);
 for(const mode of ['TIMEOUT','SPAWN_THROW'] as const){const failed=fixture(mode),failedPin=await failed.ports.pin.call(failed.ports.recipient,'/usr/bin/docker');assert.equal((await failed.ports.run.call(failed.ports.recipient,failedPin,invocation(failed.expected))).closed,false);const first=failed.spawns;assert.equal((await failed.ports.run.call(failed.ports.recipient,failedPin,invocation(failed.expected))).closed,false);assert.equal(failed.spawns,first);if(mode==='TIMEOUT'){assert.equal(await failed.ports.release.call(failed.ports.recipient,failedPin),'UNKNOWN');assert.equal(failed.closes,0);}}
});
