import {createTc01LocalEntryInput,type Tc01LocalEntryInputPorts} from './qa-fn03-tc01-local-entry-input.ts';
import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';
import {createTc01PreloadFiles,type Tc01PreloadSupervisor,type Tc01PreloadFilesPort} from './qa-fn03-tc01-preload-files.ts';
import {createTc01Launcher,type Tc01LauncherPorts,type Tc01LauncherInput} from './qa-fn03-tc01-launcher.ts';

export interface Tc01VerifiedLaunchSupervisor extends Tc01PreloadSupervisor,Tc01LauncherPorts {}
export interface Tc01VerifiedLaunchInput {
 entryInput:Tc01LauncherInput['entryInput'];nativePreparation:Tc01LauncherInput['nativePreparation'];
 /** 보유할 승인 행의 부분집합이다. graph 자신과 모든 load 행을 포함해야 하며 권위가 아니다. */
 retainPaths:readonly string[];
}
export interface Tc01LocalVerifiedLaunchSupervisor extends Tc01VerifiedLaunchSupervisor {fillSyntheticEntropy:Tc01LocalEntryInputPorts['fillSyntheticEntropy']}
export interface Tc01LocalVerifiedLaunchInput {
 packet:Tc01LauncherInput['entryInput']['packet'];nativePreparation:Tc01LauncherInput['nativePreparation'];retainPaths:readonly string[];
}
const graphPath='scripts/qa-fn03-tc01-load-graph.json';
const fail=():never=>{throw Error('FN03_TC01_VERIFIED_LAUNCH_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function fields(v:unknown,keys:readonly string[]):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);
 const out:Record<string,any>=Object.create(null);for(const k of keys){const x=d[k];check(x&&'value'in x);out[k]=x.value;}return out;
}
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,bufferOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
function snapshot(value:unknown,owned:Buffer[]){
 let total=0,nodes=0;const active=new Set<object>();
 const read=(v:unknown,depth:number):any=>{
  check(++nodes<=200000&&depth<=64);
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='string'){check(v.isWellFormed());total+=Buffer.byteLength(v);check(total<=268435456);return v;}
  if(typeof v==='number'){check(Number.isFinite(v)&&(!Number.isInteger(v)||Number.isSafeInteger(v)));return v;}
  check(v!==null&&typeof v==='object'&&!types.isProxy(v)&&!active.has(v));
  if(types.isUint8Array(v)){const n=lengthOf.call(v);total+=n;check(total<=268435456&&types.isArrayBuffer(bufferOf.call(v)));const b=Buffer.alloc(n);set.call(b,v);owned.push(b);return b;}
  check(Array.isArray(v)||[Object.prototype,null].includes(Object.getPrototypeOf(v)));active.add(v);
  try{const d=Object.getOwnPropertyDescriptors(v) as Record<string,PropertyDescriptor>;
   if(Array.isArray(v)){const n=d.length?.value;check(Number.isSafeInteger(n)&&n>=0&&n<=20000&&Reflect.ownKeys(d).length===n+1);return Object.freeze(Array.from({length:n},(_,i)=>{const x=d[String(i)];check(x&&'value'in x);return read(x.value,depth+1);}));}
   const out:Record<string,unknown>=Object.create(null);for(const k of Reflect.ownKeys(d)){check(typeof k==='string');total+=Buffer.byteLength(k);check(total<=268435456);const x=d[k];check(x&&'value'in x&&x.enumerable);out[k]=read(x.value,depth+1);}return Object.freeze(out);
  }finally{active.delete(v);}
 };return read(value,0);
}
const unknown=()=>Object.freeze({status:'STOPPED' as const,stage:'INPUT' as const,code:'BOUNDARY_OR_OUTCOME_UNKNOWN',authority:'NOT_ISSUED' as const,fn03:'NOT_CHECKED' as const,tc01:'NOT_STARTED' as const,appClosed:false,poolClosed:false,resources:'PRESERVED_OR_UNCONFIRMED' as const});
/** 같은 프로세스·같은 감독 포트를 잇는다. 새 CLI/transport/권위 또는 default live 파일 포트 없음.
 * 전체 행 preload는 한 번; 설치/보유 바이트 재검사는 launcher 복사 직전과 성공 표시 직전에만.
 * 실행 중은 기존 launcher 현재성/기한과 native 관측을 유지한다. entry의 원 회수 반환 후 소거한다.
 * retainPaths는 보유 선택일 뿐이다. 정확 graph 분류/전체 manifest/SQL·fixture는 기존 소비자가 재검산한다.
 */
export function createTc01VerifiedLaunch(supervisor:Tc01VerifiedLaunchSupervisor,files:Tc01PreloadFilesPort){
 const runner=createVerifiedLaunch(supervisor,files,false);return Object.freeze({run:(input:Tc01VerifiedLaunchInput)=>runner.run(input)});
}
/** 같은 원 preload에서만 SQL/문서/fixture를 생산한다. 외부 raw fixture fallback 및 별도 IO/entropy 기본값 없음. */
export function createTc01LocalVerifiedLaunch(supervisor:Tc01LocalVerifiedLaunchSupervisor,files:Tc01PreloadFilesPort){
 const runner=createVerifiedLaunch(supervisor,files,true);return Object.freeze({run:(input:Tc01LocalVerifiedLaunchInput)=>runner.run(input)});
}
function createVerifiedLaunch(supervisor:Tc01VerifiedLaunchSupervisor|Tc01LocalVerifiedLaunchSupervisor,files:Tc01PreloadFilesPort,local:boolean){
 let spent=false;
 return Object.freeze({async run(input:Tc01VerifiedLaunchInput|Tc01LocalVerifiedLaunchInput){
  if(spent)return unknown();spent=true;
  const owned:Buffer[]=[];let held:ReturnType<ReturnType<typeof createTc01PreloadFiles>['read']>|undefined;
  let result:Awaited<ReturnType<ReturnType<typeof createTc01Launcher>['run']>>=unknown();
  try{
   const keys=['now','monotonic','assertCurrent','readCurrentEvidence',...(local?['fillSyntheticEntropy']:[])],methods=fields(supervisor,keys);check(keys.every(k=>typeof methods[k]==='function'));
   const current=()=>{const now=fields(supervisor,keys);check(keys.every(k=>now[k]===methods[k]));};
   // 생략된 포트가 기존 preload의 native default로 넘어가지 않게 효과 전에 닫는다.
   const fileMethods=fields(files,['context','lstat','fstat','realpath','open','read','close','readdir']);check(Object.values(fileMethods).every(v=>typeof v==='function'));
   const top=fields(input,[local?'packet':'entryInput','nativePreparation','retainPaths']),copy=snapshot(top,owned);
   const preload=createTc01PreloadFiles({now:()=>{current();return methods.now.call(supervisor);},monotonic:()=>{current();return methods.monotonic.call(supervisor);},assertCurrent:(b,r)=>{current();check(methods.assertCurrent.call(supervisor,b,r)===undefined);current();}},files);
   held=preload.read({preparation:copy.nativePreparation,retainPaths:copy.retainPaths});
   const graph=held.files.find(row=>row.path===graphPath);check(graph&&graph.bytes.length<=2097152);
   const parsed=parseWireJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(graph.bytes)) as Record<string,any>;
   check(parsed&&Array.isArray(parsed.files)&&parsed.files.length<=20000);
   // 여기서는 보유 row를 고르는 데만 사용; 승인 판단은 아래 기존 bootstrap의 exact 검산이다.
   const byPath=new Map(held.files.map(row=>[row.path,row]));const loadFiles=parsed.files.filter((r:any)=>r?.kind==='load').map((r:any)=>{const row=byPath.get(r.path);check(row);return row;});
   if(!local)held.assertCurrent();
   const launcher=createTc01Launcher({now:()=>{current();return methods.now.call(supervisor);},monotonic:()=>{current();return methods.monotonic.call(supervisor);},readCurrentEvidence:()=>{current();const evidence=methods.readCurrentEvidence.call(supervisor);current();return evidence;}});
   if(local){
    const producer=createTc01LocalEntryInput({now:()=>{current();return methods.now.call(supervisor);},monotonic:()=>{current();return methods.monotonic.call(supervisor);},assertCurrent:(b,r)=>{current();check(methods.assertCurrent.call(supervisor,b,r)===undefined);current();},fillSyntheticEntropy:target=>{current();check(methods.fillSyntheticEntropy.call(supervisor,target)===undefined);current();}});
    // producer는 raw 결과를 반환하지 않는다. launcher의 닫힌 보고만 동일 호출의 지역 변수에 받는다.
    await producer.withInput(held,copy.packet,async entryInput=>{result=await launcher.run({entryInput,nativePreparation:copy.nativePreparation,graphBytes:graph.bytes,loadFiles});});
   }else result=await launcher.run({entryInput:copy.entryInput,nativePreparation:copy.nativePreparation,graphBytes:graph.bytes,loadFiles});
   if(result.status==='CHECKED')held.assertCurrent();
  }catch{result=unknown();}
  finally{try{held?.dispose();}catch{result=unknown();}finally{let failed=false;for(const b of owned)try{fill.call(b,0);}catch{failed=true;}if(failed)result=unknown();}}
  return result;
 }});
}
