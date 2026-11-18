import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {execFileSync} from 'node:child_process';
import {constants,lstatSync,realpathSync,openSync,fstatSync,readSync,closeSync,mkdirSync,readdirSync,writeFileSync,fsyncSync,type Stats} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {currentNetworkProbeContract as contract,currentCreatedUnallocatedNone,currentNetworkFailureCode,
 readCurrentAttachedHost,runCurrentNetworkSteps,verifyContainerObservation,verifyNetworkObservation} from './qa-ix01-current-journey.ts';

/** 실행 승인이 아닌 별도 후보. 기존 TC01 자원/외피/DB에 접근하는 경로는 없다. */
export const networkProbeProfile=Object.freeze({
 owner:'IX01_NETWORK_ATTACHMENT_20261118_N1',
 source:'/home/daon/anvil-ix01-network-attachment-20261118-n1-qa',
 receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-network-attachment-20261118-n1',
 container:'anvil-ix01-network-attachment-20261118-n1',network:'anvil-ix01-network-attachment-net-20261118-n1',
 overallMs:300_000,commandMs:10_000,processSeconds:120,
});
// 상대 import의 전체 전이 폐쇄. builtin 외 패키지 로드/설치와 SQL 실행은 없다.
export const networkProbeSources=Object.freeze(['scripts/qa-ix01-network-attachment-probe.ts','scripts/qa-ix01-current-journey.ts',
 'contracts/canonical.ts','tests/integration/IX01/current-schema-baseline.ts','tests/integration/IX01/current-schema-installation.ts']);
interface ProbePlan{schemaVersion:1;purpose:'IX01_NETWORK_ATTACHMENT';profile:string;sourceHead:string;issuedAt:number;expiresAt:number;sourceFiles:{path:string;sha256:string}[]}
export interface NetworkProbeInput{planRaw:string;planHash:string;approvalRaw:string;approvalHash:string}
export interface NetworkProbeAuthorization{readonly plan:Readonly<ProbePlan>;readonly planHash:string;readonly approvalHash:string;readonly approvalId:string}
type Stage='PREFLIGHT'|'IMAGE'|'COLLISION'|'CLAIM'|'CREATE'|'CREATE_VERIFY'|'START'|'START_VERIFY'|'NETWORK'|'CLEANUP'|'RECORD';
export interface NetworkProbeResult{readonly status:'REJECTED'|'UNKNOWN'|'CLEANED';readonly stage:Stage;readonly code:string}
interface ProtectedRecord{schemaVersion:1;purpose:'IX01_NETWORK_ATTACHMENT_RESULT';profile:string;planHash:string;approvalHash:string;sourceHead:string;containerId:string|null;networkId:string|null;result:NetworkProbeResult}
/** 합성 포트는 실제 도구/소유권 검증의 증거가 아니다. 실제 어댑터의 preflight/claim과 별도다. */
export interface NetworkProbePorts{
 now():number;assertCurrent():void;preflight(auth:NetworkProbeAuthorization):void;
 claim(auth:NetworkProbeAuthorization):'CLAIMED'|'DUPLICATE';docker(args:readonly string[]):string;
 record(value:Readonly<ProtectedRecord>):void;
}

/** wall 역행도 기한을 연장하지 않으며 monotonic 경과도 같은 절대 상한에 포함한다. */
export function networkProbeClock(expiresAt:number,wall:()=>number,mono:()=>number){
 const start=wall(),initial=mono();let last=start,lastMono=initial;
 if(!Number.isSafeInteger(expiresAt)||!Number.isSafeInteger(start)||!Number.isFinite(initial)||expiresAt<=start||expiresAt-start>p.overallMs)reject();
 const now=()=>{const current=wall(),tick=mono();if(!Number.isSafeInteger(current)||!Number.isFinite(tick)||tick<lastMono)reject();
  lastMono=tick;last=Math.ceil(Math.max(last,current,start+tick-initial));if(last>=expiresAt)reject();return last;};
 return Object.freeze({now,timeout(){return Math.min(p.commandMs,expiresAt-now());}});
}

// A14 사전검산 1d1971의 root 소유 Git/Docker 바이트 지문. 설치 관측/새 실행 승인을 대신하지 않는다.
const hostTools=Object.freeze({uid:1000,node:'/opt/node-v24.22.1-linux-x64/bin/node',
 nodeHash:'e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb',
 git:'/usr/bin/git',gitHash:'eb54b535467e0975c1284d4c4d08eea779aeb248a5d34b02e2ee171382e22201',
 docker:'/usr/bin/docker',dockerHash:'7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b',
 daemon:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',socket:'unix:///var/run/docker.sock'});
const launcher=networkProbeSources[0]!;
const safeEnv=Object.freeze({PATH:'/usr/bin:/bin',HOME:'/nonexistent',LANG:'C',LC_ALL:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'});
const equalFile=(a:Stats,b:Stats)=>a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid&&a.gid===b.gid&&a.mode===b.mode&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs&&a.nlink===b.nlink;
function plainFile(path:string,uid:number,max:number,mode?:number):Buffer{
 const before=lstatSync(path);
 if(!before.isFile()||before.nlink!==1||before.uid!==uid||(before.mode&0o022)!==0||before.size>max||mode!==undefined&&(before.mode&0o777)!==mode||realpathSync(path)!==path)reject();
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  if(!equalFile(before,fstatSync(fd)))reject();const bytes=Buffer.alloc(before.size+1);let total=0;
  while(total<bytes.length){const count=readSync(fd,bytes,total,bytes.length-total,null);if(count===0)break;total+=count;}
  if(total!==before.size||!equalFile(before,fstatSync(fd))||!equalFile(before,lstatSync(path)))reject();return bytes.subarray(0,total);
 }finally{closeSync(fd);}
}
function missing(path:string){try{lstatSync(path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}reject();}
function pins(){
 const held=new Map<string,Stats>();
 const check=()=>{for(const [path,prior] of held){const current=lstatSync(path);if(!current.isDirectory()||current.dev!==prior.dev||current.ino!==prior.ino||current.uid!==prior.uid||current.gid!==prior.gid||current.mode!==prior.mode)reject();}};
 return {check,pin(path:string,privateLeaf=false){let cursor='';
  for(const part of path.split('/').filter(Boolean)){cursor+='/'+part;const current=lstatSync(cursor);
   if(!current.isDirectory()||![0,hostTools.uid].includes(current.uid)||(current.mode&0o022)!==0
    ||privateLeaf&&cursor===path&&(current.uid!==hostTools.uid||(current.mode&0o777)!==0o700))reject();
   const prior=held.get(cursor);if(prior&&(current.dev!==prior.dev||current.ino!==prior.ino||current.uid!==prior.uid||current.gid!==prior.gid||current.mode!==prior.mode))reject();held.set(cursor,current);
  }if(realpathSync(path)!==path)reject();check();}};
}
function syncDirectory(path:string){const fd=openSync(path,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(fd);}finally{closeSync(fd);}}
function exclusive(path:string,raw:string,check:()=>void){
 check();const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{writeFileSync(fd,raw,'utf8');fsyncSync(fd);}finally{closeSync(fd);}
 check();syncDirectory(path.slice(0,path.lastIndexOf('/')));if(plainFile(path,hostTools.uid,65536,0o600).toString('utf8')!==raw)reject();check();
}

/** 유일한 실제 어댑터. 호출자 경로/도구/명령/시간 연장 포트는 받지 않는다. 아직 실제 실행 미승인. */
function actualProbePorts(input:NetworkProbeInput,auth:NetworkProbeAuthorization):NetworkProbePorts{
 if(process.platform!=='linux'||process.getuid?.()!==hostTools.uid||process.cwd()!==p.source||process.execPath!==hostTools.node
  ||process.execArgv.length||Object.keys(process.env).length||process.argv.length!==5||process.argv[1]!==p.source+'/'+launcher||process.argv[2]!=='--run'
  ||process.argv[3]!==input.planHash||process.argv[4]!==input.approvalHash)reject();
 const clock=networkProbeClock(auth.plan.expiresAt,Date.now,()=>performance.now()),directories=pins();
 directories.pin(p.source,true);directories.pin(p.source+'/.git');directories.pin(p.receipt.slice(0,p.receipt.lastIndexOf('/')));
 const toolChecks:[string,Stats][]=[];
 for(const [path,hash] of [[hostTools.node,hostTools.nodeHash],[hostTools.git,hostTools.gitHash],[hostTools.docker,hostTools.dockerHash]] as const){
  clock.now();directories.pin(path.slice(0,path.lastIndexOf('/')));
  if(contentHash(plainFile(path,0,160*1024*1024,0o755))!==hash)reject();toolChecks.push([path,lstatSync(path)]);clock.now();
 }
 const socketPath=realpathSync('/var/run/docker.sock');
 if(socketPath!=='/run/docker.sock'&&socketPath!=='/var/run/docker.sock')reject();directories.pin(socketPath.slice(0,socketPath.lastIndexOf('/')));
 const socket=lstatSync(socketPath);if(!socket.isSocket()||socket.uid!==0||(socket.mode&0o002)!==0)reject();
 const planPath=p.receipt+'-plan.json',approvalPath=p.receipt+'-approval.json',intentPath=p.receipt+'/intent.json',configPath=p.receipt+'/docker-config';
 const intent=canonicalJson({schemaVersion:1,purpose:'IX01_NETWORK_ATTACHMENT_INTENT',profile:p.owner,approvalId:auth.approvalId,
  planHash:auth.planHash,approvalHash:auth.approvalHash,sourceHead:auth.plan.sourceHead,expiresAt:auth.plan.expiresAt});
 let claimed=false;
 const sourcePins=new Map<string,Stats>();
 const fresh=()=>{
  clock.now();directories.check();for(const [path,prior] of toolChecks)if(!equalFile(prior,lstatSync(path)))reject();
  const live=lstatSync(socketPath);if(!live.isSocket()||live.dev!==socket.dev||live.ino!==socket.ino||live.uid!==socket.uid||live.gid!==socket.gid||live.mode!==socket.mode||realpathSync('/var/run/docker.sock')!==socketPath)reject();
  for(const [path,prior] of sourcePins)if(!equalFile(prior,lstatSync(path)))reject();
  if(plainFile(planPath,hostTools.uid,32768,0o600).toString('utf8')!==input.planRaw||plainFile(approvalPath,hostTools.uid,32768,0o600).toString('utf8')!==input.approvalRaw)reject();
  if(claimed&&(plainFile(intentPath,hostTools.uid,4096,0o600).toString('utf8')!==intent||readdirSync(configPath).length!==0))reject();clock.now();
 };
 const run=(file:string,args:readonly string[],maxBuffer=65536)=>{
  fresh();const out=execFileSync(file,[...args],{cwd:p.source,env:safeEnv,encoding:'utf8',maxBuffer,timeout:clock.timeout(),killSignal:'SIGKILL',stdio:['ignore','pipe','pipe']});fresh();return out;
 };
 const git=(args:readonly string[],maxBuffer?:number)=>run(hostTools.git,['--no-pager','--no-optional-locks','--no-replace-objects','-c','core.fsmonitor=false',
  '-c','core.hooksPath=/dev/null','-c','core.attributesFile=/dev/null','-c','core.excludesFile=/dev/null','-c','core.untrackedCache=false',...args],maxBuffer).trim();
 const dockerRaw=(args:readonly string[])=>{if(!claimed)reject();return run(hostTools.docker,['--config',configPath,'--host',hostTools.socket,...args]);};
 const daemon=()=>{if(!same(json(dockerRaw(['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}'])),{ID:hostTools.daemon,Name:'SINSAN'}))reject();};
 return {
  now:clock.now,assertCurrent:fresh,
  preflight(){
   fresh();missing(p.receipt);
   const config=plainFile(p.source+'/.git/config',hostTools.uid,8192).toString('utf8');
   if(/\[(?:include|includeIf|filter)|fsmonitor|hooksPath|sshCommand|credential|alternate|worktree/i.test(config))reject();
   for(const name of ['objects/info/alternates','info/attributes','config.worktree'])missing(p.source+'/.git/'+name);
   const tracked=git(['ls-files','-v','-z'],2*1024*1024).split('\0');
   if(tracked.pop()!==''||!tracked.length||tracked.some(row=>!row.startsWith('H '))||git(['rev-parse','HEAD'])!==auth.plan.sourceHead
    ||git(['status','--porcelain','--untracked-files=all','--ignore-submodules=none'])!=='')reject();
   for(const row of auth.plan.sourceFiles){const path=p.source+'/'+row.path;directories.pin(path.slice(0,path.lastIndexOf('/')));
    if(contentHash(plainFile(path,hostTools.uid,4*1024*1024))!==row.sha256)reject();sourcePins.set(path,lstatSync(path));fresh();}
   fresh();
  },
  claim(){
   fresh();try{mkdirSync(p.receipt,{mode:0o700});}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')return 'DUPLICATE';throw error;}
   directories.pin(p.receipt,true);syncDirectory(p.receipt.slice(0,p.receipt.lastIndexOf('/')));
   exclusive(intentPath,intent,fresh);mkdirSync(configPath,{mode:0o700});directories.pin(configPath,true);syncDirectory(p.receipt);
   claimed=true;fresh();return 'CLAIMED';
  },
  docker(args){daemon();return dockerRaw(args);},
  record(value){if(!claimed)reject();exclusive(p.receipt+'/result.json',canonicalJson(value),fresh);},
 };
}

const p=networkProbeProfile;
function reject():never{throw Error('NETWORK_PROBE_REJECTED');}
const hex=(v:unknown,size:number):v is string=>typeof v==='string'&&new RegExp('^[a-f0-9]{'+size+'}$').test(v);
const exact=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(key=>Object.hasOwn(v,key));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function json(raw:string,hash?:string):Record<string,any>{
 if(typeof raw!=='string'||Buffer.byteLength(raw)>65536||hash!==undefined&&(!hex(hash,64)||contentHash(raw)!==hash))return reject();
 const v=parseWireJson(raw);if(v===null||typeof v!=='object'||Array.isArray(v))return reject();return v;
}
export function readNetworkProbeAuthorization(input:NetworkProbeInput,at:number):NetworkProbeAuthorization{
 if(Buffer.byteLength(input.planRaw)>32768||Buffer.byteLength(input.approvalRaw)>32768)return reject();
 const plan=json(input.planRaw,input.planHash),approval=json(input.approvalRaw,input.approvalHash);
 if(!exact(plan,['schemaVersion','purpose','profile','sourceHead','issuedAt','expiresAt','sourceFiles'])||plan.schemaVersion!==1
  ||plan.purpose!=='IX01_NETWORK_ATTACHMENT'||plan.profile!==p.owner||!hex(plan.sourceHead,40)
  ||typeof plan.issuedAt!=='number'||typeof plan.expiresAt!=='number'||![at,plan.issuedAt,plan.expiresAt].every(Number.isSafeInteger)
  ||plan.issuedAt>at||plan.expiresAt<=at||plan.expiresAt-plan.issuedAt>p.overallMs
  ||!Array.isArray(plan.sourceFiles)||plan.sourceFiles.length!==networkProbeSources.length
  ||plan.sourceFiles.some((row,index)=>!exact(row,['path','sha256'])||row.path!==networkProbeSources[index]||!hex(row.sha256,64)))return reject();
 if(!exact(approval,['schemaVersion','purpose','profile','decision','approvalId','planHash','sourceHead','issuedAt','expiresAt'])
  ||approval.schemaVersion!==1||approval.purpose!=='IX01_NETWORK_ATTACHMENT_RUN_APPROVAL'||approval.profile!==p.owner||approval.decision!=='ALLOW_ONE_RUN'
  ||typeof approval.approvalId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(approval.approvalId)
  ||approval.planHash!==input.planHash||approval.sourceHead!==plan.sourceHead||approval.issuedAt!==plan.issuedAt||approval.expiresAt!==plan.expiresAt)return reject();
 for(const row of plan.sourceFiles)Object.freeze(row);Object.freeze(plan.sourceFiles);
 return Object.freeze({plan:Object.freeze(plan) as unknown as Readonly<ProbePlan>,planHash:input.planHash,approvalHash:input.approvalHash,approvalId:approval.approvalId});
}

/** 승인/소스/도구 검산 포트 뒤에만 명령 생성. 실패 뒤에는 기록 외에 어떤 관측/정리도 하지 않는다. */
export function runNetworkAttachmentProbe(input:NetworkProbeInput,ports:NetworkProbePorts):NetworkProbeResult{
 let stage:Stage='PREFLIGHT',claimed=false,claimAttempted=false,duplicate=false,auth:NetworkProbeAuthorization|undefined,containerId='',networkId='';
 const check=()=>{ports.assertCurrent();const at=ports.now();if(!auth||!Number.isSafeInteger(at)||at<auth.plan.issuedAt||at>=auth.plan.expiresAt)reject();};
 const docker=(args:readonly string[])=>{check();const raw=ports.docker(args);check();if(typeof raw!=='string'||Buffer.byteLength(raw)>65536)reject();return raw;};
 const record=(result:NetworkProbeResult)=>{if(claimed&&auth)ports.record(Object.freeze({schemaVersion:1,purpose:'IX01_NETWORK_ATTACHMENT_RESULT',profile:p.owner,
  planHash:auth.planHash,approvalHash:auth.approvalHash,sourceHead:auth.plan.sourceHead,containerId:containerId||null,networkId:networkId||null,result}));};
 try{
  auth=readNetworkProbeAuthorization(input,ports.now());check();ports.preflight(auth);check();
  const labels={'anvil.owner':p.owner,'anvil.instance':auth.plan.sourceHead.slice(0,32),'anvil.plan':auth.planHash};
  const labelArgs=Object.entries(labels).flatMap(([key,value])=>['--label',key+'='+value]);
  const scope=()=>({containerId,networkId,containerName:p.container,networkName:p.network,image:contract.image,labels});
  const format=contract.containerFormat.slice(0,-1)+',"entrypoint":{{json .Config.Entrypoint}},"command":{{json .Config.Cmd}}}';
  const processCheck=(v:Record<string,unknown>)=>{if(!same(v.entrypoint,['/bin/sleep'])||!same(v.command,['120']))reject();};
  const inspect=()=>{if(!hex(containerId,64))return reject();const v=json(docker(['container','inspect','--format',format,containerId]));verifyContainerObservation(v,scope());processCheck(v);return v;};
  const network=()=>{if(!hex(networkId,64))return reject();return verifyNetworkObservation(json(docker(['network','inspect','--format',contract.networkFormat,networkId])),scope());};
  const empty=(v:unknown)=>v===null||exact(v,[]);
  const none=(v:Record<string,any>)=>exact(v.networks,['none'])&&hex((v.networks.none as Record<string,unknown>)?.NetworkID,64)&&(v.networks.none as Record<string,unknown>)?.IPAddress==='';
  const onlyNone=()=>{const v=inspect();if(!v.running||!none(v))return reject();return v;};
  const attached=()=>{let containerRaw='';readCurrentAttachedHost(scope(),{
   network:()=>docker(['network','inspect','--format',contract.networkFormat,networkId]),
   container:()=>containerRaw=docker(['container','inspect','--format',format,containerId]),
  });processCheck(json(containerRaw));check();};
  // 새 receipt의 배타 claim과 빈 config가 정착한 뒤에만 Docker를 호출한다.
  stage='CLAIM';check();claimAttempted=true;const claim=ports.claim(auth);if(claim==='DUPLICATE'){duplicate=true;reject();}if(claim!=='CLAIMED')reject();claimed=true;check();
  stage='IMAGE';const image=json(docker(['image','inspect','--format','{"id":{{json .Id}},"volumes":{{json .Config.Volumes}}}',contract.image]));
  if(image.id!==contract.image||!exact(image.volumes,['/var/lib/postgresql/data']))reject();
  stage='COLLISION';
  if(docker(['container','ls','-a','--no-trunc','--filter','name=^/'+p.container+'$','--format','{{.ID}}']).trim()
   ||docker(['network','ls','--no-trunc','--filter','name=^'+p.network+'$','--format','{{.ID}}']).trim())reject();
  stage='CREATE';const createdId=docker(['create','--pull','never','--name',p.container,'--network','none','--user','999:999','--read-only','--cap-drop','ALL',
   '--security-opt','no-new-privileges','--pids-limit','64','--memory','536870912','--cpus','1','--log-driver','none',
   ...Object.entries(contract.tmpfs).flatMap(([path,options])=>['--tmpfs',path+':'+options]),...labelArgs,'--entrypoint','/bin/sleep',contract.image,'120']).trim();
  if(!hex(createdId,64))reject();containerId=createdId;
  stage='CREATE_VERIFY';const created=inspect();if(created.running||!empty(created.networks)&&!none(created)&&!currentCreatedUnallocatedNone(created))reject();
  stage='START';if(docker(['start',containerId]).trim()!==containerId)reject();stage='START_VERIFY';onlyNone();
  stage='NETWORK';let noneId='';
  runCurrentNetworkSteps({
   PRECHECK(){onlyNone();},
   CREATE(){const id=docker(['network','create','--internal','--driver','bridge',...labelArgs,p.network]).trim();if(!hex(id,64))reject();networkId=id;},
   CREATE_VERIFY(){if(networkId===containerId||!empty(network().containers))reject();},
   NONE_VERIFY(){const v=onlyNone();noneId=v.networks.none.NetworkID;if(!hex(noneId,64))reject();
    const n=json(docker(['network','inspect','--format',contract.networkFormat,noneId]));if(n.id!==noneId||n.name!=='none'||n.driver!=='null')reject();},
   DISCONNECT(){docker(['network','disconnect',noneId,containerId]);},
   DETACHED_VERIFY(){const v=inspect();if(!v.running||!empty(v.networks)||!empty(network().containers))reject();},
   CONNECT(){docker(['network','connect',networkId,containerId]);},ATTACHED_VERIFY:attached,
  });
  stage='CLEANUP';attached();docker(['stop','--time','5',containerId]);if(inspect().running)reject();docker(['container','rm',containerId]);
  if(!empty(network().containers))reject();docker(['network','rm',networkId]);
  if(docker(['container','ls','-a','--no-trunc','--filter','id='+containerId,'--format','{{.ID}}']).trim()
   ||docker(['network','ls','--no-trunc','--filter','id='+networkId,'--format','{{.ID}}']).trim())reject();
  stage='RECORD';check();const result=Object.freeze({status:'CLEANED',stage,code:'NETWORK_ATTACHMENT_VERIFIED'} as const);record(result);return result;
 }catch(error){
  const result=Object.freeze({status:claimed||claimAttempted&&!duplicate?'UNKNOWN':'REJECTED',stage,code:stage==='NETWORK'?currentNetworkFailureCode(error):'STOPPED_'+stage} as NetworkProbeResult);
  // 실패 기록 자체의 불명은 재시도하지 않는다. 원 자원의 보존 원칙은 그대로다.
  if(stage!=='RECORD')try{record(result);}catch{}
  return result;
 }
}

/** import는 관측/효과 0. 실제 entry는 별도 승인된 고정 source/외피가 있어야만 진입한다.
 * import 전 외부 감독자가 exact HEAD/launcher와 networkProbeSources 5개의 Git 원바이트를 검산해야 한다.
 * 자체 preflight는 이미 실행된 import의 출처 인증을 소급해서 대신하지 않는다.
 */
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 let result:NetworkProbeResult={status:'REJECTED',stage:'PREFLIGHT',code:'STOPPED_PREFLIGHT'};
 try{
  const [mode,planHash,approvalHash,...rest]=process.argv.slice(2);
  if(mode!=='--run'||rest.length||!hex(planHash,64)||!hex(approvalHash,64)||process.platform!=='linux'||process.getuid?.()!==hostTools.uid
   ||process.cwd()!==p.source||process.execPath!==hostTools.node||process.execArgv.length||Object.keys(process.env).length)reject();
  const directories=pins();directories.pin(p.receipt.slice(0,p.receipt.lastIndexOf('/')));
  const input={planHash,approvalHash,planRaw:plainFile(p.receipt+'-plan.json',hostTools.uid,32768,0o600).toString('utf8'),
   approvalRaw:plainFile(p.receipt+'-approval.json',hostTools.uid,32768,0o600).toString('utf8')};
  const auth=readNetworkProbeAuthorization(input,Date.now());result=runNetworkAttachmentProbe(input,actualProbePorts(input,auth));
 }catch{}
 process.stdout.write(JSON.stringify(result)+'\n');process.exitCode=result.status==='CLEANED'?0:1;
}
