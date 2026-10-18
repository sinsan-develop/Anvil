// FN01 준비 전용 후보. import 시 OS/파일/DB/네트워크 mutation 없음.
// actual binding 미발급. 환경변수나 호출자의 boolean으로 실행을 열지 않는다.
import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';

export const fixedQa = Object.freeze({
  source:'36c3939dd0dcbb7851de0ec967054f6e00471b76',
  root:'/home/daon/.local/share/anvil-v3-development/qa-fn01-baseline-01',
  owner:'FN01_BASELINE_QA_01',container:'anvil-v3-fn01-baseline-pg-01',network:'anvil-v3-fn01-baseline-net-01',database:'anvil_v3_fn01_baseline_qa_01',
  image:'postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425',
  imageId:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',
  daemonId:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',daemonName:'SINSAN',
  node:'/opt/node-v24.21.0-linux-x64/bin/node',npm:'/opt/node-v24.21.0-linux-x64/lib/node_modules/npm/bin/npm-cli.js',
  nodeHash:'7fde7b8afa198da66257f42ee2001d874c7355631e6d1579a5fb5ef1f246df4c',
  npmHash:'8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7',
  migrationAggregate:'e1d3666ff8e469feb9df0a80d440e0d06be35558f2943d24dabc4526a7989b2c',
  lockHash:'ca586e2dd02c11c41da55a64aa4f07d3848936fe44dca1897f8586ac4fb0f1d6',
  dependencyAggregate:'d8968986422a06f5fe24c630486ee1ee6f13363e1a050a235a2a16b163b800ba',
});
export const actualQaAuthority:null = null;
// ambient는 계속 미발급. 실제 B 고정 entry가 등록한 객체만 이 process에서 유효하다.
const permits=new WeakMap<object,ActualBController>(),workflowScope=new AsyncLocalStorage<object>();
export function assertActualQaAuthorized(permit?:object):void {
  const value=permit??workflowScope.getStore(),c=value&&permits.get(value);
  if(!c)throw Error('FN01_ACTUAL_AUTHORIZATION_NOT_ISSUED');
  validateActualBController(c,Date.now());
}
export const sha256=(value:string|Uint8Array):string=>createHash('sha256').update(value).digest('hex');
/** 타이머는 대기 상한일 뿐 OS/SQL 취소·종료 증거가 아니다. timeout 뒤 결과는 UNKNOWN. */
export class QaWaitTimeout extends Error {constructor(){super('FN01_WAIT_TIMEOUT_UNKNOWN');}}
export async function boundedWait<T>(timeoutMs:number,operation:(signal:AbortSignal)=>Promise<T>):Promise<T> {
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>1200000)throw new QaWaitTimeout();
  const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
  const expiration=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new QaWaitTimeout());},timeoutMs);});
  try{return await Promise.race([Promise.resolve().then(()=>operation(controller.signal)),expiration]);}
  finally{if(timer!==undefined)clearTimeout(timer);}
}
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const fail=(code:string):never=>{throw Error(code);};
export interface Identity {path:string;realpath:string;uid:number;mode:number;dev:number;ino:number;kind:'DIRECTORY'|'FILE'|'LINK';links:number}
export interface FileProof {path:string;kind:'DIRECTORY'|'FILE';uid:number;mode:number;dev:number;ino:number;links:number;hash:string|null}
export interface MigrationManifest {schemaVersion:1;productSource:string;count:number;ordered:{id:string;sha256:string}[];dependencyLock:{sha256:string;count:number;projectionSha256:string;entries:unknown[]}}

export function assertParentChain(rows:readonly Identity[]):void {
  const paths=['/','/home','/home/daon','/home/daon/.local','/home/daon/.local/share','/home/daon/.local/share/anvil-v3-development'];
  if(rows.length!==paths.length)fail('FN01_PATH_CHAIN_INVALID');
  rows.forEach((r,i)=>{if(r.path!==paths[i]||r.realpath!==r.path||r.kind!=='DIRECTORY'||r.uid!==(i<2?0:1000)||(r.mode&0o022)!==0||r.dev!==rows[0]!.dev||!Number.isSafeInteger(r.ino)||r.ino<1)fail('FN01_PATH_CHAIN_INVALID');});
}
/** metadata 재대조일 뿐 same-UID/root/uid1001 경합의 강제 방어 증거가 아니다. */
export function assertSameIdentity(old:readonly Identity[],now:readonly Identity[]):void {
  assertParentChain(old);assertParentChain(now);
  if(JSON.stringify(old)!==JSON.stringify(now))fail('FN01_PATH_IDENTITY_CHANGED');
}
export class QaWindow {
  readonly issuedAt:number;readonly expiresAt:number;
  constructor(issuedAt:number,expiresAt:number){if(!Number.isSafeInteger(issuedAt)||!Number.isSafeInteger(expiresAt)||expiresAt<=issuedAt||expiresAt-issuedAt>1200000)fail('FN01_WINDOW_INVALID');this.issuedAt=issuedAt;this.expiresAt=expiresAt;}
  remaining(now:number,limit:number):number {if(!Number.isSafeInteger(now)||now<this.issuedAt||!Number.isSafeInteger(limit)||limit<1)fail('FN01_WINDOW_INVALID');const remaining=this.expiresAt-now-20000;if(remaining<=0)fail('FN01_QA_EXPIRED');return Math.min(limit,remaining);}
}
/** 종료 전환은 영구적이다. 회수 시간창으로 일반 작업 허가가 되살아나지 않는다. */
export class QaWorkAdmission {
  #stopped=false;
  stop():void {this.#stopped=true;}
  assertWork():void {if(this.#stopped)fail('FN01_WORK_STOPPED');}
}
export function assertMigrationManifest(value:unknown):asserts value is MigrationManifest {
  const m=value as MigrationManifest;
  if(!m||m.schemaVersion!==1||m.productSource!==fixedQa.source||m.count!==49||!Array.isArray(m.ordered)||m.ordered.length!==49||m.ordered.some(r=>!r||!/^[0-9]{4}_[a-z0-9_]+$/.test(r.id)||!hash(r.sha256))||new Set(m.ordered.map(r=>r.id)).size!==49||sha256(JSON.stringify(m.ordered))!==fixedQa.migrationAggregate)fail('FN01_MANIFEST_INVALID');
  if(m.dependencyLock?.sha256!==fixedQa.lockHash||m.dependencyLock.count!==146||m.dependencyLock.projectionSha256!==fixedQa.dependencyAggregate||!Array.isArray(m.dependencyLock.entries)||sha256(JSON.stringify(m.dependencyLock.entries))!==fixedQa.dependencyAggregate)fail('FN01_MANIFEST_DEPENDENCIES_INVALID');
}
function labels(value:any,nonce:string):boolean{return /^[0-9a-f]{32}$/.test(nonce)&&value?.['anvil.project']==='v3'&&value?.['anvil.owner']===fixedQa.owner&&value?.['anvil.instance']===nonce;}
export function assertOwnedNetwork(value:any,id:string,nonce:string,empty:boolean):void {
  if(!hash(id)||value?.Id!==id||value.Name!==fixedQa.network||value.Internal!==true||!labels(value.Labels,nonce)||!value.Containers||typeof value.Containers!=='object'||Array.isArray(value.Containers)||empty&&Object.keys(value.Containers).length!==0)fail('FN01_NETWORK_IDENTITY_INVALID');
}
export function assertOwnedContainer(v:any,id:string,networkId:string,nonce:string):string {
  if(!hash(id)||!hash(networkId)||v?.Id!==id||v.Name!=='/'+fixedQa.container||v.Image!==fixedQa.imageId||!labels(v.Config?.Labels,nonce))fail('FN01_CONTAINER_IDENTITY_INVALID');
  const h=v.HostConfig,n=v.NetworkSettings,net=n?.Networks?.[fixedQa.network];
  if(h?.Privileged!==false||h.PublishAllPorts!==false||h.NetworkMode!==fixedQa.network||h.PortBindings&&Object.keys(h.PortBindings).length||!n?.Ports||Object.keys(n.Ports).length!==1||n.Ports['5432/tcp']!==null||!Array.isArray(v.Mounts)||v.Mounts.length||!h.Tmpfs||Object.keys(h.Tmpfs).length!==1||h.Tmpfs['/var/lib/postgresql/data']!=='rw,noexec,nosuid,size=268435456'||!n.Networks||Object.keys(n.Networks).length!==1||net?.NetworkID!==networkId||typeof net.IPAddress!=='string'||!/^172\.(1[6-9]|2\d|3[01])\.(?:\d{1,3})\.(?:\d{1,3})$/.test(net.IPAddress)||net.IPAddress.split('.').some((n:string)=>Number(n)>255))fail('FN01_CONTAINER_ISOLATION_INVALID');
  return net.IPAddress;
}
export function dependencyArguments():string[]{return[fixedQa.npm,'ci','--ignore-scripts','--bin-links=false','--no-audit','--no-fund','--registry=https://registry.npmjs.org','--cache='+fixedQa.root+'/npm-cache','--userconfig='+fixedQa.root+'/empty-user.npmrc','--globalconfig='+fixedQa.root+'/empty-global.npmrc'];}
export function containerArguments(nonce:string):string[]{if(!/^[0-9a-f]{32}$/.test(nonce))fail('FN01_NONCE_INVALID');return['run','--pull=never','-d','--name',fixedQa.container,'--label','anvil.project=v3','--label','anvil.owner='+fixedQa.owner,'--label','anvil.instance='+nonce,'--network',fixedQa.network,'--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=268435456','--env','POSTGRES_USER=anvil_v3_bootstrap','--env','POSTGRES_DB='+fixedQa.database,'--env','POSTGRES_PASSWORD',fixedQa.image,'-c','log_statement=none','-c','log_min_error_statement=fatal'];}
export function cleanupFileOrder(expected:readonly FileProof[],current:readonly FileProof[]):FileProof[]{
  const permitted=(f:FileProof)=>f.path.startsWith(fixedQa.root+'/')&&posix.normalize(f.path)===f.path&&f.uid===1000&&f.dev>0&&f.ino>0&&(f.kind==='DIRECTORY'&&f.hash===null||f.kind==='FILE'&&f.links===1&&hash(f.hash));
  if(expected.some(f=>!permitted(f))||current.some(f=>!permitted(f))||new Set(expected.map(f=>f.path)).size!==expected.length||new Set(current.map(f=>f.path)).size!==current.length||expected.length!==current.length)fail('FN01_CLEANUP_UNKNOWN_ITEM');
  const byPath=new Map(expected.map(f=>[f.path,f]));
  for(const f of current)if(JSON.stringify(byPath.get(f.path))!==JSON.stringify(f))fail('FN01_CLEANUP_ITEM_CHANGED');
  return current.map(f=>({...f})).sort((a,b)=>b.path.split('/').length-a.path.split('/').length||(a.kind===b.kind?a.path.localeCompare(b.path):a.kind==='FILE'?-1:1));
}
export interface BootstrapExpectation {
  nonce:string;head:string;issuedAt:number;expiresAt:number;rootCreatedAt:number;
  root:Identity;parents:Identity[];inventoryHash:string;
  toolchainManifestHash:string;toolchainDecisionRef:string;pathRiskDecisionRef:string;
}
export interface BootstrapReceipt extends BootstrapExpectation {
  schemaVersion:1;kind:'FN01_BASELINE_BOOTSTRAP';phase:'DEPENDENCIES_READY';owner:string;
  remote:string;productSource:string;paths:{root:string;source:string;cache:string;artifacts:string};
  migrationAggregate:string;lockHash:string;dependencyAggregate:string;inventory:FileProof[];
}
export interface BootstrapMetadata {metadataMatched:true;executionAuthorized:false;receipt:BootstrapReceipt}
const exactKeys=(v:any,keys:readonly string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const identityValue=(v:Identity)=>[v.path,v.realpath,v.uid,v.mode,v.dev,v.ino,v.kind,v.links];
/** 정렬된 원문/기대값의 사실 일치일 뿐, 파일이나 caller의 주장으로 권한을 발급하지 않는다. */
export function validateBootstrapReceipt(value:unknown,expectation:unknown,now:number):BootstrapMetadata {
  const invalid=():never=>fail('FN01_BOOTSTRAP_METADATA_INVALID');let r:BootstrapReceipt,e:BootstrapExpectation;
  try{const wire=JSON.stringify(value),expectedWire=JSON.stringify(expectation);if(!wire||!expectedWire||Buffer.byteLength(wire)>16*1024*1024||Buffer.byteLength(expectedWire)>1024*1024)return invalid();r=JSON.parse(wire);e=JSON.parse(expectedWire);}catch{return invalid();}
  const baseKeys=['nonce','head','issuedAt','expiresAt','rootCreatedAt','root','parents','inventoryHash','toolchainManifestHash','toolchainDecisionRef','pathRiskDecisionRef'];
  if(!exactKeys(e,baseKeys)||!exactKeys(r,[...baseKeys,'schemaVersion','kind','phase','owner','remote','productSource','paths','migrationAggregate','lockHash','dependencyAggregate','inventory'])||r.schemaVersion!==1||r.kind!=='FN01_BASELINE_BOOTSTRAP'||r.phase!=='DEPENDENCIES_READY'||r.owner!==fixedQa.owner||r.remote!=='git@github-sinsan-develop:sinsan-develop/Anvil.git'||r.productSource!==fixedQa.source)return invalid();
  if(!/^[0-9a-f]{32}$/.test(e.nonce)||!/^[0-9a-f]{40}$/.test(e.head)||!hash(e.inventoryHash)||!hash(e.toolchainManifestHash)||!['toolchainDecisionRef','pathRiskDecisionRef'].every(k=>typeof e[k as keyof BootstrapExpectation]==='string'&&/^[A-Za-z0-9_:/.\-]{1,200}$/.test(e[k as keyof BootstrapExpectation] as string)))return invalid();
  for(const key of ['nonce','head','issuedAt','expiresAt','rootCreatedAt','inventoryHash','toolchainManifestHash','toolchainDecisionRef','pathRiskDecisionRef'] as const)if(r[key]!==e[key])return invalid();
  try{new QaWindow(e.issuedAt,e.expiresAt).remaining(now,1);assertParentChain(e.parents);assertParentChain(r.parents);}catch{return invalid();}
  if(!Number.isSafeInteger(e.rootCreatedAt)||e.rootCreatedAt<e.issuedAt||e.rootCreatedAt>now||!Number.isSafeInteger(now))return invalid();
  const rootKeys=['path','realpath','uid','mode','dev','ino','kind','links'];
  for(const root of [e.root,r.root])if(!exactKeys(root,rootKeys)||root.path!==fixedQa.root||root.realpath!==fixedQa.root||root.uid!==1000||root.mode!==0o700||root.kind!=='DIRECTORY'||root.dev!==e.parents[0]!.dev||!Number.isSafeInteger(root.ino)||root.ino<1||!Number.isSafeInteger(root.links)||root.links<1)return invalid();
  if(JSON.stringify(identityValue(e.root))!==JSON.stringify(identityValue(r.root))||JSON.stringify(e.parents.map(identityValue))!==JSON.stringify(r.parents.map(identityValue)))return invalid();
  if(!exactKeys(r.paths,['root','source','cache','artifacts'])||r.paths.root!==fixedQa.root||r.paths.source!==fixedQa.root+'/source'||r.paths.cache!==fixedQa.root+'/npm-cache'||r.paths.artifacts!==fixedQa.root+'/artifacts'||r.migrationAggregate!==fixedQa.migrationAggregate||r.lockHash!==fixedQa.lockHash||r.dependencyAggregate!==fixedQa.dependencyAggregate)return invalid();
  if(!Array.isArray(r.inventory)||r.inventory.length<1||r.inventory.length>20000||sha256(JSON.stringify(r.inventory))!==e.inventoryHash)return invalid();
  try{cleanupFileOrder(r.inventory,r.inventory);}catch{return invalid();}
  if(r.inventory.some(f=>!exactKeys(f,['path','kind','uid','mode','dev','ino','links','hash'])||f.dev!==r.root.dev||!Number.isSafeInteger(f.dev)||!Number.isSafeInteger(f.ino)||!Number.isSafeInteger(f.mode)||(f.mode&0o022)!==0||f.path.length>4096||/[\x00-\x1f\x7f]/.test(f.path)||f.path===fixedQa.root+'/bootstrap.json'||f.path===fixedQa.root+'/receipt.json'||f.path.startsWith(fixedQa.root+'/artifacts/')))return invalid();
  return{metadataMatched:true,executionAuthorized:false,receipt:r};
}

// 신산님 직접 B 결정(2026-10-18 20:21:04 KST). 외부 JSON 등록/일반 executor는 없다.
export const declaredActualBDecision=Object.freeze({decisionRef:'FN01_ACTUAL_B_20261018T112104Z',approvedAt:1792322464000,contractGit:'cb3400381e267d5460267b3c8d01319bfde78b06',contractHash:'ee88c4ea4aa5507ef26e711542788c1bfc8b6240bdb5debc094d5c7bb5fc9ebd',rawToolHash:'eef204d41339cad66153e3758d66b4e52fb10cc86d4993bdb95d74a270fa76f5',canonicalToolHash:'ca21640df365614690b0d3c507996d2ad1f7262aabdbf868445d9754705b2af2'});
export const actualBCodePaths=Object.freeze(['scripts/fn01-baseline-qa-guard.ts','scripts/qa-fn01-baseline-isolated.ts','tests/integration/FN01/baseline-isolated.test.ts','tests/unit/FN01/baseline-qa-guard.test.ts']);
export const actualBPaths=Object.freeze([...actualBCodePaths,'docs/work_packages/FN01_BASELINE_ISOLATED_PG_QA_PROPOSAL.md','docs/work_packages/FN01_BASELINE_PG_MIGRATION_MANIFEST.json','docs/WORK_STATUS.md']);
export const actualBScopeHash=sha256(JSON.stringify({paths:actualBPaths,source:fixedQa.source,root:fixedQa.root,owner:fixedQa.owner,container:fixedQa.container,network:fixedQa.network,database:fixedQa.database,image:fixedQa.image,attempts:1,windowMs:1200000,cleanupMs:30000}));
export interface ActualBController {
  schemaVersion:1;decisionRef:string;contractGit:string;contractHash:string;scopeHash:string;
  head:string;nonce:string;issuedAt:number;expiresAt:number;rootCreatedAt:number;root:Identity;parents:Identity[];codeHashes:Record<string,string>;
}
export interface IssuedRunFacts {controller:ActualBController;controllerBytesHash:string;bootstrap:BootstrapExpectation;bootstrapBytesHash:string;toolchainRaw:string}
export function validateActualBController(input:unknown,now:number):{executionAuthorized:false;controller:ActualBController} {
  const bad=():never=>fail('FN01_B_CONTROLLER_INVALID');let c:ActualBController;
  try{const wire=JSON.stringify(input);if(!wire||Buffer.byteLength(wire)>1024*1024)return bad();c=JSON.parse(wire);}catch{return bad();}
  const d=declaredActualBDecision;
  if(!exactKeys(c,['schemaVersion','decisionRef','contractGit','contractHash','scopeHash','head','nonce','issuedAt','expiresAt','rootCreatedAt','root','parents','codeHashes'])||c.schemaVersion!==1||c.decisionRef!==d.decisionRef||c.contractGit!==d.contractGit||c.contractHash!==d.contractHash||c.scopeHash!==actualBScopeHash||!/^[0-9a-f]{40}$/.test(c.head)||!/^[0-9a-f]{32}$/.test(c.nonce)||!Number.isSafeInteger(c.issuedAt)||c.issuedAt<d.approvedAt||c.issuedAt>=d.approvedAt+86400000||c.rootCreatedAt!==c.issuedAt||c.expiresAt!==c.issuedAt+1200000||!Number.isSafeInteger(now)||now<c.issuedAt||now>=c.expiresAt)return bad();
  if(!exactKeys(c.codeHashes,actualBCodePaths)||Object.values(c.codeHashes).some(v=>!hash(v)))return bad();
  try{assertParentChain(c.parents);}catch{return bad();}
  const r=c.root;if(!r||r.path!==fixedQa.root||r.realpath!==fixedQa.root||r.kind!=='DIRECTORY'||r.uid!==1000||r.mode!==0o700||r.dev!==c.parents[0]!.dev||!Number.isSafeInteger(r.ino)||r.ino<1||!Number.isSafeInteger(r.links)||r.links<1)return bad();
  return{executionAuthorized:false,controller:c};
}
export function assertActualBBinding(input:unknown,b:BootstrapExpectation,now:number):ActualBController {
  const c=validateActualBController(input,now).controller;
  if(!b||['head','nonce','issuedAt','expiresAt','rootCreatedAt'].some(k=>(c as any)[k] !==(b as any)[k])||JSON.stringify(c.root)!==JSON.stringify(b.root)||JSON.stringify(c.parents)!==JSON.stringify(b.parents)||b.toolchainDecisionRef!==c.decisionRef||b.pathRiskDecisionRef!==c.decisionRef)fail('FN01_B_BINDING_MISMATCH');
  return c;
}
export function canonicalizeActualBTools(rows:unknown):{files:FileProof[];canonicalHash:string;socket:{dev:number;ino:number;links:number}} {
  const bad=():never=>fail('FN01_B_TOOLS_INVALID');if(!Array.isArray(rows)||rows.length<2||rows.length>20000)return bad();
  const base='/opt/node-v24.21.0-linux-x64',dirs=[base,base+'/bin',base+'/lib',base+'/lib/node_modules',base+'/lib/node_modules/npm'];
  const files:FileProof[]=[],seen=new Set<string>();let socket:{dev:number;ino:number;links:number}|undefined;
  for(const r of rows){
    if(!Array.isArray(r)||r.length!==10||typeof r[0]!=='string'||seen.has(r[0]))return bad();seen.add(r[0]);
    if(r[1]==='SOCKET'){
      if(socket||r[0]!=='/var/run/docker.sock'||r[2]!==0||r[3]!==1001||r[4]!==0o660||r[5]!==97||r[6]!==867||r[7]!==1||r[8]!==null||r[9]!=='/run/docker.sock')return bad();socket={dev:r[5],ino:r[6],links:r[7]};continue;
    }
    const p=r[0],inNode=p===fixedQa.node||dirs.includes(p)||p.startsWith(base+'/lib/node_modules/npm/');
    if((!inNode&&!['/usr/bin/git','/usr/bin/docker'].includes(p))||posix.normalize(p)!==p||r[9]!==p||!['FILE','DIRECTORY'].includes(r[1])||r[2]!== (inNode?1001:0)||r[3]!== (inNode?1001:0)||!Number.isSafeInteger(r[4])||(r[4]&0o022)!==0||r[5]!==2112||!Number.isSafeInteger(r[6])||r[6]<1||!Number.isSafeInteger(r[7])||r[7]<1||(r[1]==='FILE'?(r[7]!==1||!hash(r[8])):r[8]!==null))return bad();
    files.push({path:p,kind:r[1],uid:r[2],mode:r[4],dev:r[5],ino:r[6],links:r[7],hash:r[8]});
  }
  if(!socket)return bad();return{files,canonicalHash:sha256(JSON.stringify(files)),socket};
}
export function consumeActualBDecision(c:ActualBController,used:Set<string>,now:number):void {
  validateActualBController(c,now);if(used.has(c.decisionRef))fail('FN01_B_ALREADY_CONSUMED');used.add(c.decisionRef);
}
export function assertActualBStarted(r:any,c:ActualBController,controllerHash:string,bootstrapHash:string,parentPid:number):void {
  if(!exactKeys(r,['decisionRef','head','nonce','issuedAt','expiresAt','controllerHash','bootstrapHash','parentPid','owner','phase'])||r.decisionRef!==c.decisionRef||r.head!==c.head||r.nonce!==c.nonce||r.issuedAt!==c.issuedAt||r.expiresAt!==c.expiresAt||!hash(controllerHash)||!hash(bootstrapHash)||r.controllerHash!==controllerHash||r.bootstrapHash!==bootstrapHash||!Number.isSafeInteger(parentPid)||parentPid<1||r.parentPid!==parentPid||r.owner!==fixedQa.owner||r.phase!=='CLAIMED')fail('FN01_B_STARTED_MISMATCH');
}
export function assertParentsAfterRootRemoval(before:readonly Identity[],after:readonly Identity[]):void {
  const expected=before.map((r,i)=>({...r,links:r.links-(i===before.length-1?1:0)}));assertSameIdentity(expected,after);
}
/** 비동기 준비 이후 실제 새 파일 효과 직전의 동기 gate. 이미 시작된 OS 호출 취소 보장은 아니다. */
export function assertQaEffectBoundary(admission:QaWorkAdmission,window:QaWindow,now:number,purpose:'WORK'|'CLEANUP',cleanupEnd:number):void {
  if(purpose==='WORK'){admission.assertWork();window.remaining(now,1);}
  else if(!Number.isSafeInteger(cleanupEnd)||cleanupEnd<=now)fail('FN01_CLEANUP_EXPIRED');
}
// 첫 QA는 이미 소비했고 별도 exact 회수도 끝났다. 새 코드 후보로 그 결정을 재사용하지 않는다.
const consumed=new Set<string>([declaredActualBDecision.decisionRef]);
function checkedFacts(value:unknown):IssuedRunFacts {
  const f=JSON.parse(JSON.stringify(value)) as IssuedRunFacts;
  if(!exactKeys(f,['controller','controllerBytesHash','bootstrap','bootstrapBytesHash','toolchainRaw'])||!hash(f.controllerBytesHash)||!hash(f.bootstrapBytesHash)||typeof f.toolchainRaw!=='string'||Buffer.byteLength(f.toolchainRaw)>2*1024*1024)fail('FN01_B_FACTS_INVALID');
  assertActualBBinding(f.controller,f.bootstrap,Date.now());
  const d=declaredActualBDecision,t=canonicalizeActualBTools(JSON.parse(f.toolchainRaw));
  if(sha256(f.toolchainRaw)!==d.rawToolHash||t.files.length!==2388||t.canonicalHash!==d.canonicalToolHash||f.bootstrap.toolchainManifestHash!==t.canonicalHash)fail('FN01_B_TOOL_BINDING_INVALID');
  return f;
}
function registerPermit(c:ActualBController):object {const p=Object.freeze({});permits.set(p,structuredClone(c));return p;}
export function assertActualBPermitBinding(p:object,c:ActualBController):void {
  assertActualQaAuthorized(p);if(JSON.stringify(permits.get(p))!==JSON.stringify(c))fail('FN01_B_PERMIT_BINDING_MISMATCH');
}
export function assertActualBWorkflowTarget(nonce:string,expiresAt:number):void {
  assertActualQaAuthorized();const p=workflowScope.getStore(),c=p&&permits.get(p);
  if(!c||nonce!==c.nonce||expiresAt!==c.expiresAt)fail('FN01_B_CHILD_TARGET_MISMATCH');
}
/** 고정 FN01 entry뿐. JSON은 사실이고 B 결정은 위 코드/직접 승인에 고정된다. */
export async function runApprovedBaselineQa(input:unknown):Promise<unknown> {
  if(consumed.has(declaredActualBDecision.decisionRef))fail('FN01_B_ALREADY_CONSUMED');
  const f=checkedFacts(input);consumeActualBDecision(f.controller,consumed,Date.now());const permit=registerPermit(f.controller);
  try{const native=await import('./qa-fn01-baseline-isolated.ts');return await native.runNativeBaselineQaCandidate(f,permit);}finally{permits.delete(permit);}
}
/** parent의 고정 명령에서만 호출. 파일 검증 후 같은 최초창의 test callback에만 전달한다. */
export async function runApprovedBaselineWorkflow(input:unknown):Promise<void> {
  if(consumed.has(declaredActualBDecision.decisionRef))fail('FN01_B_ALREADY_CONSUMED');
  const f=checkedFacts(input),native=await import('./qa-fn01-baseline-isolated.ts');
  await native.verifyNativeWorkflowBinding(f);
  consumeActualBDecision(f.controller,consumed,Date.now());const permit=registerPermit(f.controller);
  await workflowScope.run(permit,async()=>{await import('../tests/integration/FN01/baseline-isolated.test.ts');});
}

/** 파일/명령 API가 아닌 순수 작업 수거기. 항목8개만 in-flight, 실패 후 새 항목0·기존 작업 수거. */
export async function boundedReadMap<T,R>(items:readonly T[],assertAllowed:()=>void,read:(item:T,index:number)=>Promise<R>):Promise<R[]> {
  const result=new Array<R>(items.length);let next=0,failed=false,first:unknown;
  const worker=async()=>{while(!failed&&next<items.length){try{assertAllowed();const i=next++;result[i]=await read(items[i]!,i);assertAllowed();}catch(error){if(!failed){failed=true;first=error;}}}};
  await Promise.all(Array.from({length:Math.min(8,items.length)},worker));
  if(failed)throw first;return result;
}
const safeNativeFailures=new Set(('BOOTSTRAP_BYTES CHILD_EXPIRED CLEANUP_COMMAND_DENIED CODE_HASH CONTAINER_ALREADY_EXISTS CONTAINER_CREATE_UNKNOWN CONTAINER_INPUT CONTAINER_NOT_CREATED CONTROLLER_BYTES DATABASE DIRECTORY_CHANGED DOCKER_CONFIG_NOT_EMPTY ENTRY_SOURCE FILE_CHANGED FILE_IDENTITY FULL_ID_REQUIRED INSPECT INVENTORY_LIMIT KNOWN_DIRECTORY_CHANGED MIGRATION_CHANGED MIGRATION_INPUT NAME_ALREADY_EXISTS NETWORK_CREATE_UNKNOWN NETWORK_INPUT NOT_CLEANUP_OWNER NOT_CLEANUP NOT_OWNED_FILE PASSWORD PG_NOT_READY PLATFORM_OR_EXPIRED POST_ROOT_EFFECT_DENIED READ_CHANGED READ_DESCRIPTOR READ_LINK READ_RACE READY_UNKNOWN ROOT_IDENTITY ROOT_NOT_EMPTY ROOT_REAPPEARED SOCKET_IDENTITY SQL_INPUT STAGE_EXPIRED STARTED_CHANGED TMPFS TOOL_HASH TOOLCHAIN_CHANGED TOOLCHAIN_MANIFEST TOOLCHAIN_PATH WORKFLOW_BINDING WORKFLOW_FILE_PROOF WORKFLOW_FILES WORKFLOW_HOST WORKFLOW_RECEIPT WRITERS_UNKNOWN_PRESERVED CHILD_FAILED CLEANUP_READ_EXPIRED').split(' ').map(c=>'FN01_NATIVE_'+c));
const safeGuardFailures=new Set(['FN01_WAIT_TIMEOUT_UNKNOWN','FN01_WORK_STOPPED','FN01_QA_EXPIRED','FN01_WINDOW_INVALID','FN01_PATH_CHAIN_INVALID','FN01_PATH_IDENTITY_CHANGED','FN01_BOOTSTRAP_METADATA_INVALID','FN01_CLEANUP_UNKNOWN_ITEM','FN01_CLEANUP_ITEM_CHANGED','FN01_SOURCE_MISMATCH','FN01_MIGRATION_COUNT_MISMATCH','FN01_MIGRATION_HASH_MISMATCH','FN01_MANIFEST_INVALID','FN01_PREFLIGHT_MISMATCH','FN01_TOOLCHAIN_OR_PATH_UNRESOLVED','FN01_BOOTSTRAP_TRUST_MISMATCH','FN01_B_BINDING_MISMATCH','FN01_B_CONTROLLER_INVALID','FN01_B_STARTED_MISMATCH','FN01_WORKFLOW_INCOMPLETE']);
/** 임의 message/stack/본문을 반환하지 않는다. 정확 코드의 고정 allowlist만 진단 출력으로 허용. */
export function qaSafeFailureCode(error:unknown):string {
  try{
    if(error instanceof QaWaitTimeout)return'FN01_WAIT_TIMEOUT_UNKNOWN';
    if(error instanceof Error){
      const descriptor=Object.getOwnPropertyDescriptor(error,'message');
      const message=descriptor&&'value'in descriptor?descriptor.value:undefined;
      if(typeof message==='string'&&(safeNativeFailures.has(message)||safeGuardFailures.has(message)))return message;
    }
    const code=(error as {code?:unknown}|null)?.code;
    if(typeof code==='string'&&['EACCES','EPERM','ENOENT','ELOOP','ETIMEDOUT','ECONNREFUSED','EIO','ENOSPC'].includes(code))return'FN01_OS_'+code;
    if(error instanceof SyntaxError)return'FN01_PARSE_ERROR';
  }catch{/* getter/외부 객체를 신뢰하지 않는다. */}
  return'FN01_UNCLASSIFIED_ERROR';
}
export interface QaObservation {section:string;outcome:'RUNNING'|'PASS'|'FAIL';elapsedMs:number;code:string|null}
const safeSections=new Set(('PREFLIGHT SOURCE PARENTS CLAIM_STARTED CREATE_NETWORK NETWORK_INSPECT CREATE_PG CONTAINER_INSPECT TMPFS BOOTSTRAP MIGRATE WORKFLOW ENTRY_READ BOOTSTRAP_READ INVENTORY CONTROLLER_READ TOOLCHAIN_READ DOCKER_READ').split(' '));
/** 측정은 진단이며 검사 성공/실행 권한이 아니다. snapshot은 원 배열을 노출하지 않는다. */
export class QaReadTrace {
  private readonly rows:{value:QaObservation;started:number}[]=[];
  private first:string|null=null;
  private readonly now:()=>number;
  constructor(now:()=>number=Date.now){this.now=now;}
  get firstFailureCode():string|null{return this.first;}
  async run<T>(section:string,operation:()=>Promise<T>):Promise<T>{
    if(!safeSections.has(section)||this.rows.length>=128)throw Error('FN01_DIAGNOSTIC_SECTION_INVALID');
    const row={value:{section,outcome:'RUNNING' as QaObservation['outcome'],elapsedMs:0,code:null as string|null},started:this.now()};this.rows.push(row);
    try{const result=await operation();row.value.outcome='PASS';return result;}
    catch(error){row.value.outcome='FAIL';row.value.code=qaSafeFailureCode(error);this.first??=row.value.code;throw error;}
    finally{row.value.elapsedMs=Math.max(0,Math.floor(this.now()-row.started));}
  }
  snapshot():QaObservation[]{return this.rows.map(r=>({...r.value,elapsedMs:r.value.outcome==='RUNNING'?Math.max(0,Math.floor(this.now()-r.started)):r.value.elapsedMs}));}
}
