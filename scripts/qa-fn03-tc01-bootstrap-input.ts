import {types} from 'node:util';
import {posix} from 'node:path';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';
import {createTc01PinnedLoad,type Tc01PinnedLoadInput} from './qa-fn03-tc01-pinned-load.ts';
import type {ManagementOriginEntryInput} from './qa-fn03-source-content-management-origin-entry.ts';
import type {ManagementOriginNativePreparation} from './qa-fn03-source-content-management-origin-native.ts';

export interface Tc01BootstrapInput {
 entryInput:ManagementOriginEntryInput;nativePreparation:ManagementOriginNativePreparation;
 graphBytes:Uint8Array;loadFiles:readonly {path:string;bytes:Uint8Array}[];
 /** 외부 감독이 공급한 현재 시각. OS 관측/승인 발급은 아니다. */
 now:number;
}
const graphPath='scripts/qa-fn03-tc01-load-graph.json';
const targetEntry='scripts/qa-fn03-tc01-linux-runtime.ts';
const entryPath='scripts/qa-fn03-source-content-management-origin-entry.ts';
const nativePath='scripts/qa-fn03-source-content-management-origin-native.ts';
const purpose='FN03_MANAGEMENT_ORIGIN_TC01_ISOLATED',profile='FN03_MANAGEMENT_ORIGIN_TC01_ENTRY_V1';
const nodeSha='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb';
const fail=():never=>{throw Error('FN03_TC01_BOOTSTRAP_INPUT_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
const same=(a:Record<string,any>,b:Record<string,any>)=>Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(key=>a[key]===b[key]);
function record(value:unknown,keys:string[]):Record<string,any>{
 check(value!==null&&typeof value==='object'&&!types.isProxy(value));
 const d=Object.getOwnPropertyDescriptors(value);check(Reflect.ownKeys(d).length===keys.length);
 const out:Record<string,any>=Object.create(null);for(const key of keys){const x=d[key];check(x&&'value'in x);out[key]=x.value;}return out;
}
function array(value:unknown,max:number):unknown[]{
 check(Array.isArray(value)&&!types.isProxy(value));const d=Object.getOwnPropertyDescriptors(value) as unknown as Record<string,PropertyDescriptor>,length=d.length?.value;
 check(Number.isSafeInteger(length)&&length>=0&&length<=max&&Reflect.ownKeys(d).length===length+1);
 return Array.from({length},(_,i)=>{const x=d[String(i)];check(x&&'value'in x);return x.value;});
}
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,bufferOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,set=Uint8Array.prototype.set;
function bytes(value:unknown,max:number){check(types.isUint8Array(value)&&!types.isProxy(value));const n=lengthOf.call(value);check(types.isArrayBuffer(bufferOf.call(value))&&n<=max);const b=Buffer.alloc(n);set.call(b,value);return b;}
function wire(raw:unknown,sha:unknown,max:number):Record<string,any>{
 check(typeof raw==='string'&&raw.isWellFormed()&&Buffer.byteLength(raw)<=max&&hashV1(sha)&&contentHash(Buffer.from(raw))===sha);return parseWireJson(raw) as Record<string,any>;
}
const pathOk=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_@.+/-]{1,400}$/.test(value)&&!value.startsWith('/')&&posix.normalize(value)===value&&!value.split('/').some(p=>p==='.'||p==='..'||p==='')&&!value.startsWith('.git/');
interface Row{path:string;bytes:number;sha256:string;dependency:boolean}

/** 동일 plan 아래 graph/manifest와 load bytes만 연결한다. SQL132/fixture의 의미·원문은
 * 기존 entry가 이후 전량 검산하며 여기서는 반환하지 않는다. 전체 graph 생성, 설치/적재 증명,
 * 실제 승인/현재성/소비 원장 또는 hook 등록을 발급하지 않는다. graph는 자기 hash를 담지 않고
 * 분류/형식만 담는다. 그 원 bytes의 길이/SHA는 승인 sourceManifest의 control 행이 고정한다.
 */
export function prepareTc01BootstrapInput(input:Tc01BootstrapInput){
 const owned:Buffer[]=[];let graphBytes:Buffer|undefined,loader:ReturnType<typeof createTc01PinnedLoad>|undefined;
 try{
  const top=record(input,['entryInput','nativePreparation','graphBytes','loadFiles','now']);
  const e=record(top.entryInput,['packet','isolated','sql']),packet=record(e.packet,['planRaw','planHash','approvalRaw','approvalHash']);
  const n=record(top.nativePreparation,['binding','runtime','sourceManifestRaw','dependencyManifestRaw']);
  const plan=wire(packet.planRaw,packet.planHash,16384),approval=wire(packet.approvalRaw,packet.approvalHash,16384);
  check(recordV1(plan,['schemaVersion','purpose','profile','attemptId','sourceHead','issuedAt','expiresAt','artifactRoot','receiptRoot','subnet','runtime'])&&plan.schemaVersion===1&&plan.purpose===purpose&&plan.profile===profile&&uuidV1(plan.attemptId)&&typeof plan.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(plan.sourceHead));
  check(Number.isSafeInteger(plan.issuedAt)&&Number.isSafeInteger(plan.expiresAt)&&plan.issuedAt>=0&&plan.expiresAt>plan.issuedAt&&plan.expiresAt-plan.issuedAt<=1800000&&Number.isSafeInteger(top.now)&&top.now>=plan.issuedAt&&top.now<plan.expiresAt);
  const sourceRoot='/home/daon/anvil-fn03-tc01-'+plan.attemptId+'-qa',receiptRoot='/home/daon/.local/share/anvil-v3-qa-receipts/fn03-tc01-'+plan.attemptId;
  check(plan.artifactRoot==='/tmp/fn03-tc01-'+plan.attemptId&&plan.receiptRoot===receiptRoot);
  const subnet=typeof plan.subnet==='string'&&/^172\.(1[6-9]|2\d|3[01])\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28$/.exec(plan.subnet);check(subnet&&Number(subnet[2])<=254&&Number(subnet[3])<=240&&Number(subnet[3])%16===0);
  check(recordV1(approval,['schemaVersion','purpose','profile','decision','approvalId','attemptId','planHash','sourceHead','issuedAt','expiresAt'])&&approval.schemaVersion===1&&approval.purpose===purpose+'_RUN_APPROVAL'&&approval.profile===profile&&approval.decision==='ALLOW_ONE_RUN'&&uuidV1(approval.approvalId)&&approval.attemptId===plan.attemptId&&approval.planHash===packet.planHash&&approval.sourceHead===plan.sourceHead&&approval.issuedAt===plan.issuedAt&&approval.expiresAt===plan.expiresAt);
  const binding=Object.freeze({attemptId:plan.attemptId,approvalId:approval.approvalId,planHash:packet.planHash,approvalHash:packet.approvalHash,sourceHead:plan.sourceHead,issuedAt:plan.issuedAt,expiresAt:plan.expiresAt,artifactRoot:plan.artifactRoot,subnet:plan.subnet,purpose,profile});
  const bindingKeys=Object.keys(binding),runtimeKeys=['sourceHead','entry','nodeSha256','sourceClosureSha256','packageLockSha256','installedDependenciesSha256'];
  const runtime=record(n.runtime,runtimeKeys);check(recordV1(plan.runtime,runtimeKeys)&&same(runtime,plan.runtime)&&runtime.sourceHead===plan.sourceHead&&runtime.entry===entryPath&&runtime.nodeSha256===nodeSha&&['sourceClosureSha256','packageLockSha256','installedDependenciesSha256'].every(k=>hashV1(runtime[k])));
  check(same(record(n.binding,bindingKeys),binding));
  const isolated=record(e.isolated,['binding','receiptRoot','historicalTsv','legacyBytes','sources','passwords','fixture']);check(same(record(isolated.binding,bindingKeys),binding)&&isolated.receiptRoot===receiptRoot);
  // SQL/fixture 본문에는 접근하지 않고 기존 entry의 검산 책임을 유지한다.
  const sources=wire(n.sourceManifestRaw,runtime.sourceClosureSha256,2097152),dependencies=wire(n.dependencyManifestRaw,runtime.installedDependenciesSha256,2097152);
  check(recordV1(sources,['schemaVersion','sourceHead','sourceRoot','gitSha256','dockerSha256','files'])&&sources.schemaVersion===1&&sources.sourceHead===plan.sourceHead&&sources.sourceRoot===sourceRoot&&hashV1(sources.gitSha256)&&hashV1(sources.dockerSha256));
  check(recordV1(dependencies,['schemaVersion','sourceHead','packageLockSha256','files'])&&dependencies.schemaVersion===1&&dependencies.sourceHead===plan.sourceHead&&dependencies.packageLockSha256===runtime.packageLockSha256);
  const rows=new Map<string,Row>();
  for(const [manifest,dependency]of [[sources,false],[dependencies,true]] as const){
   check(Array.isArray(manifest.files)&&manifest.files.length>0&&manifest.files.length<=20000);let prior='',total=0;
   for(const row of manifest.files){check(recordV1(row,['path','bytes','sha256'])&&pathOk(row.path)&&row.path>prior&&row.path.startsWith('node_modules/')===dependency&&!rows.has(row.path)&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=16777216&&hashV1(row.sha256));prior=row.path;total+=row.bytes;check(total<=268435456);rows.set(row.path,{path:row.path,bytes:row.bytes,sha256:row.sha256,dependency});}
  }
  check(rows.get('package-lock.json')?.sha256===runtime.packageLockSha256);const graphRow=rows.get(graphPath);check(graphRow&&!graphRow.dependency&&graphRow.bytes<=2097152);
  graphBytes=bytes(top.graphBytes,graphRow.bytes);check(graphBytes.length===graphRow.bytes&&contentHash(graphBytes)===graphRow.sha256);
  const graph=parseWireJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(graphBytes)) as Record<string,any>,graphKeys=['schemaVersion','entry','files','builtins','imports'];
  const withR9=recordV1(graph,[...graphKeys,'legacyR9']);check((withR9||recordV1(graph,graphKeys))&&graph.schemaVersion===1&&graph.entry===targetEntry&&Array.isArray(graph.files)&&graph.files.length===rows.size&&graph.files.length<=20000);
  const loadRows:({path:string;bytes:number;sha256:string;format:string;dependency:boolean})[]=[],classes=new Map<string,string>();let prior='';
  for(const classification of graph.files){
   check(recordV1(classification,classification?.kind==='load'?['path','kind','format']:['path','kind'])&&pathOk(classification.path)&&classification.path>prior&&['load','nonload','control'].includes(classification.kind));prior=classification.path;
   const row=rows.get(classification.path);check(row);classes.set(row.path,classification.kind);
   if(classification.kind==='load'){check(typeof classification.format==='string');loadRows.push({...row,format:classification.format});}
  }
  check(loadRows.reduce((sum,row)=>sum+row.bytes,0)<=268435456);
  check(classes.get(graphPath)==='control'&&[targetEntry,entryPath,nativePath].every(path=>loadRows.some(row=>row.path===path&&!row.dependency&&row.format==='module-typescript')));
  const suppliedFiles=array(top.loadFiles,20000);check(suppliedFiles.length===loadRows.length);const expected=new Map(loadRows.map(row=>[row.path,row]));prior='';
  const files=suppliedFiles.map(raw=>{const file=record(raw,['path','bytes']);check(typeof file.path==='string'&&file.path>prior);prior=file.path;const row=expected.get(file.path);check(row);const copy=bytes(file.bytes,row.bytes);owned.push(copy);check(copy.length===row.bytes&&contentHash(copy)===row.sha256);return{path:row.path,bytes:copy};});
  const projection=(dependency:boolean)=>loadRows.filter(row=>row.dependency===dependency).map(({path,bytes,sha256,format})=>({path,bytes,sha256,format}));
  const loaderManifest={schemaVersion:1,attemptId:plan.attemptId,root:sourceRoot,entry:targetEntry,sources:projection(false),dependencies:projection(true),builtins:graph.builtins,imports:graph.imports,...(withR9?{legacyR9:graph.legacyR9}:{})};
  const manifestBytes=Buffer.from(canonicalJson(loaderManifest));owned.push(manifestBytes);
  const loadInput:Tc01PinnedLoadInput={attemptId:plan.attemptId,manifestSha256:contentHash(manifestBytes),manifestBytes,files};
  // 검산된 원 private loader를 미등록 상태로 반환한다. raw graph/파일/대체 hash는 반환하지 않는다.
  loader=createTc01PinnedLoad(loadInput);
  return Object.freeze({binding,runtime:Object.freeze(runtime),sourceRoot,receiptRoot,graphSha256:graphRow.sha256,loader});
 }catch{loader?.revoke();return fail();}finally{graphBytes?.fill(0);for(const value of owned)value.fill(0);}
}
