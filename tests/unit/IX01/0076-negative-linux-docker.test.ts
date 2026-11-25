import test from 'node:test';
import assert from 'node:assert/strict';
import {
 prepare0076NegativeLinuxDocker,prepare0076NegativeLinuxDockerWithToolHandoff,
 type NegativeLinuxDockerAuthority,
 type NegativeLinuxDockerInvocation,
 type NegativeLinuxDockerLegacy,
 type NegativeLinuxDockerSystem,
} from '../../../scripts/qa-ix01-0076-negative-linux-docker.ts';

const attemptId='fa000000-0000-4000-8000-000000000001',containerId='d'.repeat(64);
function makeBinding(id:string){const compact=id.replaceAll('-','');return Object.freeze({schemaVersion:1,purpose:'IX01_0076_NEGATIVE_LINUX_DOCKER_BINDING',attemptId:id,sourceHead:'a'.repeat(40),planHash:'b'.repeat(64),
 approvalHash:'c'.repeat(64),approvalId:'fb000000-0000-4000-8000-000000000002',graphHash:'e'.repeat(64),issuedAt:1_000,expiresAt:20_000,
 namespace:Object.freeze({container:'anvil-ix01-0076-negative-'+compact,database:'ix01_0076_negative_'+compact,
  receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+id,network:'none' as const})});}
const binding=makeBinding(attemptId);
const image='sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f';
const tmpfs={'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456,uid=999,gid=999','/var/run/postgresql':'rw,noexec,nosuid,size=16777216,uid=999,gid=999','/tmp':'rw,noexec,nosuid,size=16777216,uid=999,gid=999'};
function inspected(ownedBinding:typeof binding,running:boolean){const ownedCompact=ownedBinding.attemptId.replaceAll('-','');return{id:containerId,name:'/'+ownedBinding.namespace.container,image,user:'999:999',labels:{'anvil.owner':'IX01_0076_NEGATIVE','anvil.instance':ownedCompact,'anvil.plan':ownedBinding.planHash},running,
 host:{Privileged:false,ReadonlyRootfs:true,NetworkMode:'none',LogConfig:{Type:'none',Config:{}},CapDrop:['ALL'],SecurityOpt:['no-new-privileges'],PidsLimit:64,
  Memory:536870912,NanoCpus:1000000000,PublishAllPorts:false,PortBindings:{},Binds:null,VolumesFrom:null,Tmpfs:{...tmpfs}},mounts:[],
 networks:running?{none:{NetworkID:'f'.repeat(64),IPAddress:''}}:{none:{MacAddress:'',NetworkID:'',EndpointID:'',Gateway:'',IPAddress:'',IPv6Gateway:'',GlobalIPv6Address:'',GwPriority:0,IPPrefixLen:0,GlobalIPv6PrefixLen:0,IPAMConfig:null,Links:null,Aliases:null,DriverOpts:null,DNSNames:null}},ports:{'5432/tcp':null}};}

function fixture(mode:'OK'|'NOT_CLAIMED'|'CREATE_UNKNOWN'='OK',ownedBinding=binding){
 const recipient=Object.freeze(Object.create(null)),toolRecipient=Object.freeze(Object.create(null)),custody=Object.freeze(Object.create(null));
 let wall=2_000,mono=10.5,released=0,pinCount=0;const calls:NegativeLinuxDockerInvocation[]=[];
 const authority=Object.freeze({recipient,binding:ownedBinding,
  assertClaimed(this:object,found:unknown){assert.equal(this,recipient);assert.equal(found,ownedBinding);if(mode==='NOT_CLAIMED')throw Error('not claimed');},
  assertCurrent(this:object,found:unknown){assert.equal(this,recipient);assert.equal(found,ownedBinding);},
  wall(this:object){assert.equal(this,recipient);return wall;},monotonic(this:object){assert.equal(this,recipient);return mono;},
 }) satisfies NegativeLinuxDockerAuthority;
 const tool=Object.freeze({path:'/usr/bin/docker',realpath:'/usr/bin/docker',kind:'FILE' as const,dev:1,ino:2,uid:0,mode:0o100755,nlink:1,size:45_000_000,
  mtimeMs:1.25,ctimeMs:1.5,sha256:'1'.repeat(64),custody});
 let inspectCount=0;
 const system=Object.freeze({recipient:toolRecipient,
  async pin(this:object,path:string){assert.equal(this,toolRecipient);assert.equal(path,'/usr/bin/docker');pinCount++;return tool;},
  current(this:object,found:object){assert.equal(this,toolRecipient);assert.equal(found,tool);},
  async run(this:object,found:object,invocation:NegativeLinuxDockerInvocation){assert.equal(this,toolRecipient);assert.equal(found,tool);calls.push(invocation);const args=invocation.argv.slice(4);
   let stdout='';if(args[0]==='info')stdout=JSON.stringify({ID:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',Name:'SINSAN'});
   else if(args[0]==='image')stdout=JSON.stringify({id:image,volumes:{'/var/lib/postgresql/data':{}}});
   else if(args[0]==='container'&&args[1]==='ls')stdout='';
   else if(args[0]==='create'){if(mode==='CREATE_UNKNOWN')return Object.freeze({status:null,signal:null,closed:false,stdout:'',stderr:''});stdout=containerId+'\n';}
   else if(args[0]==='container'&&args[1]==='inspect')stdout=JSON.stringify(inspected(ownedBinding,inspectCount++>0));
   else if(args[0]==='start')stdout=containerId+'\n';
   else if(args[0]==='exec'&&args.includes('FINAL_SERVER'))stdout='postgres\n';
   else if(args[0]==='exec'&&args.includes('pg_isready'))stdout='READY\n';
   else if(args[0]==='exec'&&invocation.input==='ROLE_SQL')stdout='ROLE_OK';
   else if(args[0]==='exec'&&invocation.input==='BOOTSTRAP_SQL')stdout='';
   else assert.fail('unexpected command '+JSON.stringify(args));
   return Object.freeze({status:0,signal:null,closed:true,stdout,stderr:''});},
  async wait(this:object,timeoutMs:number){assert.equal(this,toolRecipient);assert.equal(timeoutMs,250);},
  async release(this:object,found:object){assert.equal(this,toolRecipient);assert.equal(found,tool);released++;return 'CLOSED' as const;},
 }) satisfies NegativeLinuxDockerSystem;
 const legacy=Object.freeze({daemonInfoArgs(){return Object.freeze(['info','--format','DAEMON']);},finalServerArgs(id:string){assert.equal(id,containerId);return Object.freeze(['exec',id,'FINAL_SERVER']);},
  parseFinalServer(raw:string){return raw==='postgres\n';},bootstrapSql(database:string){assert.equal(database,ownedBinding.namespace.database);return'BOOTSTRAP_SQL';},
  roleMetadataSql(){return'ROLE_SQL';},verifyPristineRoles(raw:string){assert.equal(raw,'ROLE_OK');},verifyInstallerRoles(raw:string){assert.equal(raw,'ROLE_OK');},
 }) satisfies NegativeLinuxDockerLegacy;
 return{authority,system,legacy,calls,get pinCount(){return pinCount;},get released(){return released;},setTime(nextWall:number,nextMono:number){wall=nextWall;mono=nextMono;}};
}

test('원 claim 뒤 same Docker tool pin으로 daemon/image/absent→create/start/inspect/readiness/role을 준비한다',async()=>{
 const h=fixture(),result=await prepare0076NegativeLinuxDocker(binding,h.authority,h.legacy,h.system);
 assert.equal(result.status,'PREPARED');if(result.status!=='PREPARED')assert.fail();assert.equal(result.target.containerId,containerId);
 assert.equal(h.pinCount,1);assert.equal(h.released,1);assert.deepEqual(h.calls.map(call=>call.argv[4]),['info','image','container','create','container','start','container','exec','exec','exec','exec','exec','container']);
 assert(h.calls.every(call=>call.file==='/usr/bin/docker'&&call.cwd==='/'&&call.timeoutMs>0&&call.timeoutMs<=18_000));
 await assert.rejects(prepare0076NegativeLinuxDocker(binding,h.authority,h.legacy,h.system));assert.equal(h.pinCount,1);
});

test('claim 부재·create/close 불명에서는 후속 준비나 재시도 없이 UNKNOWN을 보존한다',async()=>{
 const deniedBinding=makeBinding('fc000000-0000-4000-8000-000000000003'),denied=fixture('NOT_CLAIMED',deniedBinding);await assert.rejects(prepare0076NegativeLinuxDocker(deniedBinding,denied.authority,denied.legacy,denied.system));assert.equal(denied.pinCount,0);
 const unknownBinding=makeBinding('fd000000-0000-4000-8000-000000000004'),unknown=fixture('CREATE_UNKNOWN',unknownBinding),result=await prepare0076NegativeLinuxDocker(unknownBinding,unknown.authority,unknown.legacy,unknown.system);
 assert.deepEqual(result,{status:'UNKNOWN',containerId:null,resourceMayExist:true,toolCloseConfirmed:true});assert.equal(unknown.calls.filter(call=>call.argv[4]==='create').length,1);
 assert.equal(unknown.calls.some(call=>call.argv[4]==='start'),false);assert.equal(unknown.released,1);
});

test('native brand 없는 frozen handoff는 claim·pin·준비 효과 전에 거절한다',async()=>{
 const ownedBinding=makeBinding('fe000000-0000-4000-8000-000000000005'),h=fixture('OK',ownedBinding),handoff=Object.freeze({recipient:h.system.recipient,
  transfer(){return Object.freeze(Object.create(null));},owns(){return true;}});
 await assert.rejects(prepare0076NegativeLinuxDockerWithToolHandoff(ownedBinding,h.authority,h.legacy,h.system,handoff));
 assert.equal(h.pinCount,0);assert.equal(h.calls.length,0);assert.equal(h.released,0);
});
