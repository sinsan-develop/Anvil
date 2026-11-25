import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {constants,readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {
 current0076NegativeContract as stageContract,load0076NegativeFailureParser,
 type NegativeCommandObservation,type NegativeOwnedTarget,type NegativeStagePorts,
} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {
 create0076AtomicityNegativeReceiver,load0076NegativeReceiverGraph,type NegativeReceiverPorts,
} from '../../../scripts/qa-ix01-0076-atomicity-negative-receiver.ts';
import {
 current0076NegativeLinuxApprovalContract,type NegativeLinuxApprovalSelection,
} from '../../../scripts/qa-ix01-0076-negative-linux-approval.ts';
import {
 type NegativeLinuxProtectedReaderAuthority,type NegativeLinuxProtectedReaderStat,type NegativeLinuxProtectedReaderSystem,
} from '../../../scripts/qa-ix01-0076-negative-linux-protected-reader.ts';
import {type NegativeLinuxJournalStat,type NegativeLinuxJournalSystem} from '../../../scripts/qa-ix01-0076-negative-linux-journal.ts';
import type {NegativeLinuxDockerInvocation} from '../../../scripts/qa-ix01-0076-negative-linux-docker.ts';
import type {NegativeLinuxNativeDockerSystem} from '../../../scripts/qa-ix01-0076-negative-linux-native-docker.ts';
import {run0076NegativeLinuxEntry} from '../../../scripts/qa-ix01-0076-negative-linux-entry.ts';

const root=new URL('../../../',import.meta.url),source=(path:string)=>new Uint8Array(readFileSync(new URL(path,root)));
const manifestPath='docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv';
const manifest=new Uint8Array(Buffer.from(readFileSync(new URL(manifestPath,root),'utf8').replaceAll('\r\n','\n'),'utf8'));
const manifestRows=readCurrentSchemaManifest(manifest),sql=manifestRows.map(row=>source(row.path));
const receiverPath='scripts/qa-ix01-0076-atomicity-negative-receiver.ts',entryPath='scripts/qa-ix01-0076-negative-linux-entry.ts';
const original=source('db/migrations/0076_native_first_receive.sql.pending'),commit=Buffer.from('COMMIT;\n','ascii'),commitOffset=384546;
const corrected=new Uint8Array(Buffer.concat([original.subarray(0,commitOffset),original.subarray(commitOffset+commit.length),commit]));
const r9=new Uint8Array(Buffer.from(readFileSync(new URL(stageContract.parserPath,root),'utf8').replaceAll('\r\n','\n'),'utf8'));
const parser=await load0076NegativeFailureParser(r9);
let sequence=900;
const image='sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',containerId='d'.repeat(64);
const systemNames=['pg_database_owner','pg_read_all_data','pg_write_all_data','pg_monitor','pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables','pg_read_server_files','pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_checkpoint'];
const roles=(phase:'PRISTINE'|'INSTALLER')=>{
 const names=[...systemNames,'anvil_v3_bootstrap',...(phase==='INSTALLER'?['anvil_v3_migrator','anvil_v3_app','anvil_v3_provider_claim_writer']:[])];
 const role=(name:string)=>{const boot=name==='anvil_v3_bootstrap',installer=name==='anvil_v3_migrator',provider=name==='anvil_v3_provider_claim_writer';return{name,superuser:boot,inherit:!provider,createRole:boot||installer,createDb:boot,replication:boot,bypassRls:boot,login:boot||installer||name==='anvil_v3_app',validUntil:null};};
 return JSON.stringify({sessionUser:'anvil_v3_bootstrap',currentUser:'anvil_v3_bootstrap',roles:names.map(role),memberships:[
  ...['pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables'].map(name=>({role:name,member:'pg_monitor',grantor:'anvil_v3_bootstrap',adminOption:false})),
  ...(phase==='INSTALLER'?[{role:'anvil_v3_provider_claim_writer',member:'anvil_v3_migrator',grantor:'anvil_v3_bootstrap',adminOption:true}]:[]),
 ]});
};
class Stream extends EventEmitter{end(_value?:Uint8Array){queueMicrotask(()=>this.emit('finish'));}}
class Child extends EventEmitter{stdin=new Stream();stdout=new Stream();stderr=new Stream();}

function observation(owner:Readonly<NegativeOwnedTarget>,sqlHash:string):NegativeCommandObservation{
 return Object.freeze({scopeHash:contentHash(canonicalJson(owner)),sqlHash,kind:'SETTLED' as const,exitStatus:0,signal:null,sqlState:null,statementEndLine:null});
}
function fixture(tamperApproval=false,expireClockRead=Number.MAX_SAFE_INTEGER,journalUnknown=false){
 const attemptId='f7000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),approvalId='f7100000-0000-4000-8000-'+String(sequence).padStart(12,'0');
 const sourceHead='7'.repeat(40),issuedAt=Date.parse('2026-11-25T01:00:00.000Z'),expiresAt=issuedAt+1_800_000,compact=attemptId.replaceAll('-','');
 const receiptRoot='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,sourceRoot='/home/daon/anvil-ix01-0076-negative-source';
 const namespace=Object.freeze({container:'anvil-ix01-0076-negative-'+compact,database:'ix01_0076_negative_'+compact,receipt:receiptRoot,network:'none' as const});
 assert(current0076NegativeLinuxApprovalContract.dependencyPaths.includes(entryPath as never));
 const dependencies=current0076NegativeLinuxApprovalContract.dependencyPaths.map(path=>source(path));
 const protectedSourcePaths=current0076NegativeLinuxApprovalContract.protectedSourcePaths,r9Index=protectedSourcePaths.indexOf(stageContract.parserPath);
 const graphSources=new Map<string,Uint8Array>();for(const path of stageContract.graphPaths)graphSources.set(path,path===stageContract.parserPath?r9:source(path));
 for(const [index,path] of current0076NegativeLinuxApprovalContract.dependencyPaths.entries())graphSources.set(path,dependencies[index]!);
 const graphFiles=[...graphSources].map(([path,bytes])=>({path,bytes:bytes.byteLength,sha256:contentHash(bytes)})).sort((a,b)=>a.path.localeCompare(b.path));
 const graphRaw=canonicalJson({schemaVersion:1,sourceHead,files:graphFiles}),graphHash=contentHash(graphRaw);
 const plan={schemaVersion:1,purpose:stageContract.purpose,attemptId,sourceHead,graphHash,issuedAt,expiresAt,namespace,sourceManifestHash:contentHash(canonicalJson(manifestRows)),
  sourceSha256:stageContract.sourceSha256,executionSha256:stageContract.executionSha256,sentinelSqlHash:stageContract.sentinelSqlHash,catalogSqlHash:stageContract.catalogSqlHash};
 const planRaw=canonicalJson(plan),planHash=contentHash(planRaw),approval={schemaVersion:1,purpose:stageContract.purpose+'_APPROVAL',decision:'ALLOW_ONE_ISOLATED_NEGATIVE_STAGE',
  approvalId,attemptId,sourceHead,planHash,graphHash,issuedAt,expiresAt},approvalRaw=canonicalJson(approval),approvalHash=contentHash(approvalRaw);
 const selection=Object.freeze({schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_LINUX_APPROVAL_SELECTION' as const,attemptId,sourceHead,planHash,approvalHash,graphHash}) satisfies NegativeLinuxApprovalSelection;

 const requested=[receiptRoot+'-plan.json',receiptRoot+'-approval.json',receiptRoot+'-graph.json',...protectedSourcePaths,manifestPath];
 const actual=[requested[0]!,requested[1]!,requested[2]!,...protectedSourcePaths.map(path=>sourceRoot+'/'+path),sourceRoot+'/'+manifestPath];
 const logicalSql=manifestRows.map(row=>row.path),actualSql=logicalSql.map(path=>sourceRoot+'/'+path);
 const protectedValues=protectedSourcePaths.map((path,index)=>index===r9Index?r9:dependencies[index]!);
 const fileValues=[new Uint8Array(Buffer.from(planRaw)),new Uint8Array(Buffer.from(tamperApproval?approvalRaw+' ':approvalRaw)),new Uint8Array(Buffer.from(graphRaw)),...protectedValues,manifest];
 const readerFiles=new Map<string,Uint8Array>();for(const [index,path] of actual.entries())readerFiles.set(path,fileValues[index]!);for(const [index,path] of actualSql.entries())readerFiles.set(path,sql[index]!);
 const parentDirectories=[sourceRoot,'/home','/home/daon','/home/daon/.local','/home/daon/.local/share','/home/daon/.local/share/anvil-v3-qa-receipts',
  ...[...protectedSourcePaths,manifestPath,...logicalSql].flatMap(path=>{const parts=path.split('/');return parts.slice(0,-1).map((_,index)=>sourceRoot+'/'+parts.slice(0,index+1).join('/'));})];
 let ino=20;const readerStats=new Map<string,NegativeLinuxProtectedReaderStat>();for(const path of new Set(parentDirectories))readerStats.set(path,Object.freeze({kind:'DIRECTORY',dev:1,ino:ino++,uid:path==='/home'?0:1000,mode:path==='/home'?0o40755:0o40700,nlink:1,size:0,mtimeMs:1,ctimeMs:1}));
 for(const [index,path] of [...actual,...actualSql].entries()){const bytes=readerFiles.get(path)!;readerStats.set(path,Object.freeze({kind:'FILE',dev:1,ino:ino++,uid:1000,mode:index<3?0o100600:0o100644,nlink:1,size:bytes.byteLength,mtimeMs:1,ctimeMs:1}));}
 const readerRecipient=Object.freeze(Object.create(null)),readerHandles=new Map<object,{path:string;offset:number}>();let protectedOpens=0,wall=issuedAt+1000,mono=100,currentCalls=0,clockReads=0;
 const readerSystem=Object.freeze({recipient:readerRecipient,
  lstat(this:object,path:string){assert.equal(this,readerRecipient);const value=readerStats.get(path);if(!value)throw Object.assign(Error('missing'),{code:'ENOENT'});return value;},
  realpath(this:object,path:string){assert.equal(this,readerRecipient);return path;},
  open(this:object,path:string,flags:number){assert.equal(this,readerRecipient);assert.equal(flags,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const handle=Object.freeze(Object.create(null));readerHandles.set(handle,{path,offset:0});protectedOpens++;return handle;},
  fstat(this:object,handle:object){assert.equal(this,readerRecipient);return readerStats.get(readerHandles.get(handle)!.path)!;},
  read(this:object,handle:object,buffer:Uint8Array,offset:number,length:number){assert.equal(this,readerRecipient);const state=readerHandles.get(handle)!,bytes=readerFiles.get(state.path)!,count=Math.min(length,bytes.byteLength-state.offset);if(count<=0)return 0;buffer.set(bytes.subarray(state.offset,state.offset+count),offset);state.offset+=count;return count;},
  close(this:object,handle:object){assert.equal(this,readerRecipient);assert(readerHandles.delete(handle));},
 }) satisfies NegativeLinuxProtectedReaderSystem;
 const authorityRecipient=Object.freeze(Object.create(null)),authority=Object.freeze({recipient:authorityRecipient,selection,sourceRoot,receiptRoot,uid:1000 as const,
  now(this:object){assert.equal(this,authorityRecipient);clockReads++;return clockReads>=expireClockRead?expiresAt:wall;},monotonic(this:object){assert.equal(this,authorityRecipient);return mono;},
  assertCurrent(this:object,found:Readonly<NegativeLinuxApprovalSelection>){assert.equal(this,authorityRecipient);assert.equal(found,selection);currentCalls++;},
 }) satisfies NegativeLinuxProtectedReaderAuthority;

 const journalDirectories=['/home','/home/daon','/home/daon/.local','/home/daon/.local/share','/home/daon/.local/share/anvil-v3-qa-receipts',receiptRoot];
 const journalStats=new Map<string,NegativeLinuxJournalStat>();for(const path of journalDirectories)journalStats.set(path,Object.freeze({kind:'DIRECTORY',dev:2,ino:ino++,uid:path==='/home'?0:1000,mode:path===receiptRoot?0o40700:0o40755,nlink:1,size:0,mtimeMs:1,ctimeMs:1}));
 const journalFiles=new Map<string,Uint8Array>(),journalHandles=new Map<object,{path:string;kind:'FILE'|'DIRECTORY';offset:number}>(),journalTrace:string[]=[];
 const journalRecipient=Object.freeze(Object.create(null)),error=(code:string)=>Object.assign(Error(code),{code});
 const journalSystem=Object.freeze({recipient:journalRecipient,
  lstat(this:object,path:string){assert.equal(this,journalRecipient);const value=journalStats.get(path);if(!value)throw error('ENOENT');return value;},realpath(this:object,path:string){assert.equal(this,journalRecipient);return path;},
  open(this:object,path:string,flags:number,mode?:number){assert.equal(this,journalRecipient);journalTrace.push('open');if((flags&constants.O_EXCL)!==0){assert.equal(mode,0o600);if(journalFiles.has(path))throw error('EEXIST');journalFiles.set(path,new Uint8Array());journalStats.set(path,Object.freeze({kind:'FILE',dev:2,ino:ino++,uid:1000,mode:0o100600,nlink:1,size:0,mtimeMs:2,ctimeMs:2}));}
   const stat=journalStats.get(path);if(!stat)throw error('ENOENT');const handle=Object.freeze(Object.create(null));journalHandles.set(handle,{path,kind:stat.kind,offset:0});return handle;},
  fstat(this:object,handle:object){assert.equal(this,journalRecipient);return journalStats.get(journalHandles.get(handle)!.path)!;},
  write(this:object,handle:object,bytes:Uint8Array,offset:number){assert.equal(this,journalRecipient);const state=journalHandles.get(handle)!,copy=new Uint8Array(offset+bytes.byteLength);copy.set(journalFiles.get(state.path)??new Uint8Array());copy.set(bytes,offset);journalFiles.set(state.path,copy);journalStats.set(state.path,Object.freeze({...journalStats.get(state.path)!,size:copy.byteLength}));journalTrace.push('write');return bytes.byteLength;},
  read(this:object,handle:object,buffer:Uint8Array,offset:number,length:number){assert.equal(this,journalRecipient);const state=journalHandles.get(handle)!,bytes=journalFiles.get(state.path)!,count=Math.min(length,bytes.byteLength-state.offset);if(count<=0)return 0;buffer.set(bytes.subarray(state.offset,state.offset+count),offset);state.offset+=count;return count;},
  sync(this:object,handle:object){assert.equal(this,journalRecipient);const kind=journalHandles.get(handle)!.kind;journalTrace.push(kind==='DIRECTORY'?'syncDirectory':'syncFile');if(journalUnknown&&kind==='FILE')throw Error('unknown');},
  close(this:object,handle:object){assert.equal(this,journalRecipient);assert(journalHandles.delete(handle));journalTrace.push('close');},
  schedule(this:object,_callback:()=>void,timeoutMs:number){assert.equal(this,journalRecipient);assert(timeoutMs>0);return Object.freeze({timeoutMs});},cancel(this:object,token:object){assert.equal(this,journalRecipient);assert(token);},
 }) satisfies NegativeLinuxJournalSystem;

 const receiverSource=source(receiverPath),receiverGraph=load0076NegativeReceiverGraph(graphRaw,receiverSource),replaced=['connection_definition_capacity','native_preparation_capacity','quota_adopt_creation','quota_complete_before_source'].map((name,index)=>({name,oid:String(200+index),owner:'anvil_v3_migrator',definitionHash:contentHash(name+' definition'),aclHash:contentHash(name+' ACL')}));
 let priorInstalls=0,receiverCalls=0,prepareCalls=0,sentinelValue:Record<string,unknown>|null=null;const ledger:{id:string;checksum:string}[]=[];
 const base:NegativeStagePorts={now:()=>wall,monotonic:()=>mono,assertCurrent(){},async claim(){throw Error('entry claim must replace base claim');},
  async prepare(binding){prepareCalls++;return{schemaVersion:1 as const,purpose:'IX01_0076_NEGATIVE_OWNED_TARGET' as const,attemptId:binding.attemptId,sourceHead:binding.sourceHead,planHash:binding.planHash,graphHash:binding.graphHash,namespace:{...binding.namespace},containerId:'e'.repeat(64)};},
  async install(owner,_bytes,row){priorInstalls++;return observation(owner,row.sha256);},
  async appendLedger(owner,row){ledger.push({id:row.id,checksum:row.sha256});return observation(owner,contentHash("INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+row.id+"','"+row.sha256+"');"));},
  async sentinel(owner,statement){sentinelValue={signature:stageContract.signature,oid:'500',owner:'anvil_v3_migrator',sourceHash:contentHash('SELECT NULL::jsonb'),definitionHash:contentHash('sentinel definition'),aclHash:contentHash('sentinel ACL'),appExecute:false,publicExecute:false,securityDefiner:false,language:'sql',volatility:'v',config:['search_path=pg_catalog']};return observation(owner,contentHash(statement));},
  async catalog(owner,statement){return{scopeHash:contentHash(canonicalJson(owner)),sqlHash:contentHash(statement),exitStatus:0,signal:null,raw:canonicalJson({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_CATALOG',database:namespace.database,sessionUser:'anvil_v3_migrator',currentUser:'anvil_v3_migrator',tableCount:0,firstTable:false,lateFunction:false,lastTrigger:false,functionCount:sentinelValue?1:0,triggerCount:0,sentinel:sentinelValue,replaced,ledger:[...ledger].sort((a,b)=>a.id.localeCompare(b.id))})};},
 };
 const receiverRecipient=Object.freeze(Object.create(null)),receiver=Object.freeze({recipient:receiverRecipient,schedule(){return()=>{};},async execute(this:object){assert.equal(this,receiverRecipient);receiverCalls++;return Object.freeze({kind:'DDL_FAILURE' as const,error:{status:3,signal:null,stderr:'psql:<stdin>:2343: ERROR:  42723: PRIVATE SQL discarded'}});}}) satisfies NegativeReceiverPorts;
 const stage=create0076AtomicityNegativeReceiver(receiverGraph,parser,base,receiver);
 const nativeRecipient=Object.freeze(Object.create(null)),nativeHandle=Object.freeze(Object.create(null));let nativeOpens=0,nativeSpawns=0,nativeCloses=0,nativeInspect=0,bootstrapPsql=0;
 const nativeSystem=Object.freeze({recipient:nativeRecipient,
  open(this:object,path:string){assert.equal(this,nativeRecipient);assert.equal(path,'/usr/bin/docker');nativeOpens++;return nativeHandle;},
  stat(this:object,found:object){assert.equal(this,nativeRecipient);assert.equal(found,nativeHandle);return Object.freeze({path:'/usr/bin/docker',realpath:'/usr/bin/docker',kind:'FILE' as const,dev:3,ino:4,uid:0,gid:0,mode:0o100755,nlink:1,size:4,mtimeMs:1.5,ctimeMs:2.5});},
  read(this:object,found:object,offset:number,length:number){assert.equal(this,nativeRecipient);assert.equal(found,nativeHandle);return new Uint8Array(Buffer.from('tool').subarray(offset,offset+length));},
  spawnPinned(this:object,found:object,raw:Readonly<NegativeLinuxDockerInvocation>){assert.equal(this,nativeRecipient);assert.equal(found,nativeHandle);nativeSpawns++;const child=new Child(),args=raw.argv.slice(4);let stdout='',stderr='',status=0;
   if(args[0]==='info')stdout=JSON.stringify({ID:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',Name:'SINSAN'});
   else if(args[0]==='image')stdout=JSON.stringify({id:image,volumes:{'/var/lib/postgresql/data':{}}});
   else if(args[0]==='container'&&args[1]==='ls')stdout='';
   else if(args[0]==='create')stdout=containerId+'\n';
   else if(args[0]==='container'&&args[1]==='inspect'){const running=nativeInspect++>0;stdout=JSON.stringify({id:containerId,name:'/'+namespace.container,image,user:'999:999',labels:{'anvil.owner':'IX01_0076_NEGATIVE','anvil.instance':attemptId.replaceAll('-',''),'anvil.plan':selection.planHash},running,host:{Privileged:false,ReadonlyRootfs:true,NetworkMode:'none',LogConfig:{Type:'none',Config:{}},CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PidsLimit:64,Memory:536870912,NanoCpus:1000000000,PublishAllPorts:false,PortBindings:{},Binds:null,VolumesFrom:null,Tmpfs:{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456,uid=999,gid=999','/var/run/postgresql':'rw,noexec,nosuid,size=16777216,uid=999,gid=999','/tmp':'rw,noexec,nosuid,size=16777216,uid=999,gid=999'}},mounts:[],networks:running?{none:{NetworkID:'f'.repeat(64),IPAddress:''}}:{none:{MacAddress:'',NetworkID:'',EndpointID:'',Gateway:'',IPAddress:'',IPv6Gateway:'',GlobalIPv6Address:'',GwPriority:0,IPPrefixLen:0,GlobalIPv6PrefixLen:0,IPAMConfig:null,Links:null,Aliases:null,DriverOpts:null,DNSNames:null}},ports:{'5432/tcp':null}});}
   else if(args[0]==='start')stdout=containerId+'\n';
   else if(args.includes('/proc/1/comm'))stdout='postgres\n';
   else if(args.includes('pg_isready'))stdout='READY\n';
   else if(args.includes('psql')&&args.includes('--username=anvil_v3_bootstrap')){stdout=bootstrapPsql===0?roles('PRISTINE'):bootstrapPsql===2?roles('INSTALLER'):'';bootstrapPsql++;}
   else if(args.includes('psql')&&args.includes('--username=anvil_v3_migrator')){const input=raw.input??'';
    if(input===stageContract.catalogSql)stdout=canonicalJson({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_CATALOG',database:namespace.database,sessionUser:'anvil_v3_migrator',currentUser:'anvil_v3_migrator',tableCount:0,firstTable:false,lateFunction:false,lastTrigger:false,functionCount:sentinelValue?1:0,triggerCount:0,sentinel:sentinelValue,replaced,ledger:[...ledger].sort((a,b)=>a.id.localeCompare(b.id))});
    else if(input===stageContract.sentinelSql)sentinelValue={signature:stageContract.signature,oid:'500',owner:'anvil_v3_migrator',sourceHash:contentHash('SELECT NULL::jsonb'),definitionHash:contentHash('sentinel definition'),aclHash:contentHash('sentinel ACL'),appExecute:false,publicExecute:false,securityDefiner:false,language:'sql',volatility:'v',config:['search_path=pg_catalog']};
    else if(input.startsWith('INSERT INTO anvil.schema_migrations')){const matched=/VALUES\('([^']+)','([a-f0-9]{64})'\);/.exec(input);assert(matched);ledger.push({id:matched[1]!,checksum:matched[2]!});}
    else if(contentHash(input)===stageContract.executionSha256){status=3;stderr='psql:<stdin>:2343: ERROR:  42723: duplicate';}
   }else assert.fail('unexpected native args '+JSON.stringify(args));
   queueMicrotask(()=>queueMicrotask(()=>{if(stdout)child.stdout.emit('data',Buffer.from(stdout));if(stderr)child.stderr.emit('data',Buffer.from(stderr));child.stdout.emit('end');child.stderr.emit('end');child.emit('exit',status,null);child.emit('close',status,null);}));return child;
  },terminate(){assert.fail('native child should not be terminated');},setTimeout(){return Object.freeze({});},clearTimeout(){},close(this:object,found:object){assert.equal(this,nativeRecipient);assert.equal(found,nativeHandle);nativeCloses++;return'CLOSED' as const;},
 }) satisfies NegativeLinuxNativeDockerSystem;
 return{selection,authority,readerSystem,journalSystem,nativeSystem,stage,approvalId,receiptRoot,journalFiles,journalTrace,get protectedOpens(){return protectedOpens;},get currentCalls(){return currentCalls;},get priorInstalls(){return priorInstalls;},get receiverCalls(){return receiverCalls;},get prepareCalls(){return prepareCalls;},get nativeOpens(){return nativeOpens;},get nativeSpawns(){return nativeSpawns;},get nativeCloses(){return nativeCloses;},get ledger(){return ledger;}};
}

test('보호 approval 원문에서만 claim authority를 만들고 106+0076 source-only stage를 한 번 조립한다',async()=>{
 const h=fixture(),result=await run0076NegativeLinuxEntry(h.selection,h.authority,Object.freeze({mode:'SYNTHETIC_SOURCE_ONLY',reader:h.readerSystem,journal:h.journalSystem,stage:h.stage}));
 assert.equal(result.status,'OBSERVATIONS_MATCHED');assert.equal(result.priorInstalled,106);assert.equal(result.priorLedgered,106);assert.equal(result.targetDispatched,true);
 assert.equal(h.protectedOpens,3+current0076NegativeLinuxApprovalContract.protectedSourcePaths.length+1+130);assert.equal(h.priorInstalls,106);assert.equal(h.receiverCalls,1);assert.equal(h.prepareCalls,1);assert.equal(h.ledger.length,106);
 const receipt=h.journalFiles.get(h.receiptRoot+'/claim-v1.json')!;assert.equal(JSON.parse(Buffer.from(receipt).toString('utf8')).approvalId,h.approvalId);
 assert.deepEqual(h.journalTrace,['open','write','syncFile','close','open','syncDirectory','close','open','close']);assert(h.currentCalls>0);
});

test('같은 보호 callback이 R9·native owner·schema/receiver를 조립하고 durable claim 뒤에만 child를 연다',async()=>{
 const h=fixture(),result=await run0076NegativeLinuxEntry(h.selection,h.authority,Object.freeze({mode:'SYNTHETIC_NATIVE_ASSEMBLY',reader:h.readerSystem,journal:h.journalSystem,native:h.nativeSystem}));
 assert.equal(result.status,'OBSERVATIONS_MATCHED',JSON.stringify({result,opens:h.nativeOpens,spawns:h.nativeSpawns,closes:h.nativeCloses,ledger:h.ledger.length,journal:h.journalTrace,current:h.currentCalls}));assert.equal(result.priorInstalled,106);assert.equal(result.priorLedgered,106);assert.equal(result.targetDispatched,true);
 assert.equal(h.nativeOpens,1);assert.equal(h.nativeSpawns,230);assert.equal(h.nativeCloses,1);assert.equal(h.ledger.length,106);
 const failed=fixture(false,Number.MAX_SAFE_INTEGER,true),stopped=await run0076NegativeLinuxEntry(failed.selection,failed.authority,Object.freeze({mode:'SYNTHETIC_NATIVE_ASSEMBLY',reader:failed.readerSystem,journal:failed.journalSystem,native:failed.nativeSystem}));
 assert.equal(stopped.status,'STOPPED');assert.equal(stopped.reason,'CLAIM_UNCONFIRMED');assert.equal(failed.nativeOpens,0);assert.equal(failed.nativeSpawns,0);assert.equal(failed.nativeCloses,0);
});

test('approval 원문이 selection hash와 다르면 claim·journal·prepare·SQL 효과가 없다',async()=>{
 const h=fixture(true);await assert.rejects(run0076NegativeLinuxEntry(h.selection,h.authority,Object.freeze({mode:'SYNTHETIC_SOURCE_ONLY',reader:h.readerSystem,journal:h.journalSystem,stage:h.stage})));
 assert.equal(h.journalTrace.length,0);assert.equal(h.prepareCalls,0);assert.equal(h.priorInstalls,0);assert.equal(h.receiverCalls,0);assert.equal(h.ledger.length,0);
});

test('보호 read 뒤 원 window가 만료되면 claim file 생성과 prepare·SQL 효과가 없다',async()=>{
 const h=fixture(false,7),result=await run0076NegativeLinuxEntry(h.selection,h.authority,Object.freeze({mode:'SYNTHETIC_SOURCE_ONLY',reader:h.readerSystem,journal:h.journalSystem,stage:h.stage}));
 assert.equal(result.status,'STOPPED');assert.equal(result.reason,'INPUT_INVALID');
 assert.equal(h.journalTrace.length,0);assert.equal(h.prepareCalls,0);assert.equal(h.priorInstalls,0);assert.equal(h.receiverCalls,0);assert.equal(h.ledger.length,0);
});

test('PROTECTED_NATIVE 경로는 외부 reader·journal callback을 함께 받을 수 없다',async()=>{
 const h=fixture(),mixed=Object.freeze({mode:'PROTECTED_NATIVE',reader:h.readerSystem,journal:h.journalSystem,stage:h.stage});
 await assert.rejects(run0076NegativeLinuxEntry(h.selection,h.authority,mixed as never));
 assert.equal(h.protectedOpens,0);assert.equal(h.journalTrace.length,0);assert.equal(h.prepareCalls,0);assert.equal(h.receiverCalls,0);
});

test('PROTECTED_NATIVE 공급자는 Linux/euid와 보호 approval 뒤 read-only 조립까지만 하고 claim·child를 열지 않는다',()=>{
 const body=readFileSync(new URL('../../../scripts/qa-ix01-0076-negative-linux-entry.ts',import.meta.url),'utf8');
 const host=body.indexOf("if(systems.mode==='PROTECTED_NATIVE')requireNativeHostBoundary();");
 const reader=body.indexOf("create0076NegativeLinuxProtectedReader(rawAuthority)");
 const approval=body.indexOf('verify0076NegativeLinuxApproval(rawSelection,reader)');
 const blocked=body.indexOf('create0076NegativeLinuxReadOnlyDockerSystem()',approval);
 const retained=body.indexOf("if(prepared.status==='PREPARED')transferred="),afterReturnCurrent=body.indexOf("entryCurrent();if(prepared.status!=='PREPARED')",retained);
 assert.ok(host>=0&&reader>host&&approval>reader&&blocked>approval);
 assert.ok(retained>=0&&afterReturnCurrent>retained,'prepare 반환 상태를 보존한 뒤 후행 current를 검산해야 한다');
 assert.match(body,/process\.platform!=='linux'.*process\.geteuid\(\)!==1000/);
 assert.match(body,/run0076AtomicityNegativeStage\(input\).*blocked\.close\(\)/s);
 assert.doesNotMatch(body,/container[^\n]*(?:stop|rm)/);
});
