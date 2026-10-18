// FN01 준비 전용 후보. import 시 OS/파일/DB/네트워크 mutation 없음.
// actual binding 미발급. 환경변수나 호출자의 boolean으로 실행을 열지 않는다.
import { createHash } from 'node:crypto';
import { posix } from 'node:path';

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
/** 별도 B 결정·코드 결박 없이는 실패. actual 환경을 읽기 전에 호출한다. */
export function assertActualQaAuthorized():never {throw Error('FN01_ACTUAL_AUTHORIZATION_NOT_ISSUED');}
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
