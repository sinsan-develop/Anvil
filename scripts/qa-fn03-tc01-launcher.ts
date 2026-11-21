import {types} from 'node:util';
import {canonicalJson} from '../contracts/canonical.ts';
import {prepareTc01BootstrapInput,type Tc01BootstrapInput} from './qa-fn03-tc01-bootstrap-input.ts';
import type {ManagementOriginEntryPorts} from './qa-fn03-source-content-management-origin-entry.ts';

export interface Tc01LauncherPorts {
 now():number;monotonic():number;
 /** 동일 감독의 실제 보유 근거를 검산한 공급자만 사용한다. 반환 문자열/합성 포트는
  * 승인·host/source/설치 증명의 발급이 아니다. 불명/회수는 throw 또는 불일치로 닫는다.
  * exact {binding,runtime,sourceRoot,receiptRoot,graphSha256,expiresAt}. */
 readCurrentEvidence():unknown;
}
export type Tc01LauncherInput=Omit<Tc01BootstrapInput,'now'>;
let hookOwner:object|undefined;
const fail=():never=>{throw Error('FN03_TC01_LAUNCHER_UNKNOWN');};
function check(value:unknown):asserts value{if(!value)fail();}
function fields(value:unknown,keys:readonly string[]):Record<string,any>{
 check(value!==null&&typeof value==='object'&&!types.isProxy(value));const descriptors=Object.getOwnPropertyDescriptors(value);
 check(Reflect.ownKeys(descriptors).length===keys.length);const out:Record<string,any>=Object.create(null);
 for(const key of keys){const d=descriptors[key];check(d&&'value'in d);out[key]=d.value;}return out;
}
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,bufferOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,set=Uint8Array.prototype.set;
function snapshot(value:unknown,owned:Buffer[],max=268435456):any{
 let size=0,nodes=0;const active=new Set<object>();
 const read=(v:unknown,depth:number):any=>{
  check(++nodes<=200000&&depth<=64);
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){check(Number.isFinite(v)&&(!Number.isInteger(v)||Number.isSafeInteger(v)));return v;}
  if(typeof v==='string'){check(v.isWellFormed());size+=Buffer.byteLength(v);check(size<=max);return v;}
  check(v!==null&&typeof v==='object'&&!types.isProxy(v)&&!active.has(v));
  if(types.isUint8Array(v)){const n=lengthOf.call(v);size+=n;check(size<=max&&types.isArrayBuffer(bufferOf.call(v)));const b=Buffer.alloc(n);set.call(b,v);owned.push(b);return b;}
  active.add(v);try{
   check(Array.isArray(v)||[Object.prototype,null].includes(Object.getPrototypeOf(v)));const d=Object.getOwnPropertyDescriptors(v) as Record<string,PropertyDescriptor>;
   if(Array.isArray(v)){const n=d.length?.value;check(Number.isSafeInteger(n)&&n>=0&&n<=20000&&Reflect.ownKeys(d).length===n+1);return Object.freeze(Array.from({length:n},(_,i)=>{const x=d[String(i)];check(x&&'value'in x&&x.enumerable);return read(x.value,depth+1);}));}
   const out:Record<string,unknown>=Object.create(null);for(const key of Reflect.ownKeys(d)){check(typeof key==='string');size+=Buffer.byteLength(key);check(size<=max);const x=d[key];check(x&&'value'in x&&x.enumerable);out[key]=read(x.value,depth+1);}return Object.freeze(out);
  }finally{active.delete(v);}
 };return read(value,0);
}
const initial=()=>({fn03:'NOT_CHECKED' as 'NOT_CHECKED'|'CHECKED',tc01:'NOT_STARTED' as 'NOT_STARTED'|'STARTED'|'CHECKED',appClosed:false,poolClosed:false,resources:'PRESERVED_OR_UNCONFIRMED' as 'PRESERVED_OR_UNCONFIRMED'|'REMOVED'});
function readOutcome(raw:unknown){
 const value=fields(raw,['status','stage','reason','authority','appClosed','poolClosed','resources','journeys']);
 const journeys=fields(value.journeys,['fn03','tc01','tc01Stage']);
 check(['CHECKED','STOPPED'].includes(value.status)&&typeof value.stage==='string'&&typeof value.reason==='string'&&value.authority==='NOT_ISSUED'&&typeof value.appClosed==='boolean'&&typeof value.poolClosed==='boolean'&&['REMOVED','PRESERVED_OR_UNCONFIRMED'].includes(value.resources));
 check(['CHECKED','NOT_CHECKED'].includes(journeys.fn03)&&['CHECKED','STARTED','NOT_STARTED'].includes(journeys.tc01)&&(journeys.tc01Stage===null||typeof journeys.tc01Stage==='string'&&/^[A-Z0-9_]{1,80}$/.test(journeys.tc01Stage)));
 check(journeys.fn03==='CHECKED'||journeys.tc01==='NOT_STARTED');
 const checked=value.status==='CHECKED';
 if(checked)check(value.stage==='DONE'&&value.reason==='JOURNEY_CHECKED'&&value.appClosed&&value.poolClosed&&value.resources==='REMOVED'&&journeys.fn03==='CHECKED'&&journeys.tc01==='CHECKED');
 else check(value.resources==='PRESERVED_OR_UNCONFIRMED');
 return{checked,fn03:journeys.fn03 as 'NOT_CHECKED'|'CHECKED',tc01:journeys.tc01 as 'NOT_STARTED'|'STARTED'|'CHECKED',appClosed:value.appClosed as boolean,poolClosed:value.poolClosed as boolean,resources:value.resources as 'REMOVED'|'PRESERVED_OR_UNCONFIRMED'};
}

/** 명시 호출 단위. import 시 효과0; 실제 승인/원 프로세스 전체 회수/설치 수집은 외부 감독 책임.
 * hook lease는 같은 canonical 모듈 인스턴스의 factory끼리만 배타적이다. 외부 고정 진입은
 * 이 모듈을 단일 URL로 한 번 적재해야 하며 복제 URL/외부 hooks는 여기서 검산하지 않는다.
 * factory 단회는 프로세스 간 배타 원장을 대체하지 않는다. 미등록 private loader는 동일 run만
 * 보유하고 entry의 원 app/Pool 회수 반환까지 등록을 유지한다. raw/비밀/원문은 결과로 반환하지 않는다. */
export function createTc01Launcher(ports:Tc01LauncherPorts){
 let spent=false;
 return Object.freeze({async run(input:Tc01LauncherInput){
  let stage:'INPUT'|'IMPORT'|'NATIVE'|'RUN'|'RESULT'='INPUT',facts=initial();
  const outcome=(checked=false)=>Object.freeze({status:checked?'CHECKED' as const:'STOPPED' as const,stage,code:checked?'JOURNEY_CHECKED':'BOUNDARY_OR_OUTCOME_UNKNOWN',authority:'NOT_ISSUED' as const,...facts});
  if(spent)return outcome();spent=true;
  const lease=Object.freeze({});let acquired=false,checked=false;
  const owned:Buffer[]=[];let prepared:ReturnType<typeof prepareTc01BootstrapInput>|undefined,failed=false;
  try{
   const methods=fields(ports,['now','monotonic','readCurrentEvidence']);check(Object.values(methods).every(v=>typeof v==='function'));
   const now=methods.now as ()=>number,monotonic=methods.monotonic as ()=>number,readEvidence=methods.readCurrentEvidence as ()=>unknown;
   let wall=-1,mono=-1,until=Infinity,wallUntil=Infinity;
   const clock=()=>{const t=now.call(ports),m=monotonic.call(ports);check(Number.isSafeInteger(t)&&Number.isSafeInteger(m)&&t>=wall&&m>=mono&&m>=0);wall=t;mono=m;};clock();const startedWall=wall,startedMono=mono;
   const top=fields(input,['entryInput','nativePreparation','graphBytes','loadFiles']);
   const held=snapshot({entryInput:top.entryInput,nativePreparation:top.nativePreparation},owned);clock();
   prepared=prepareTc01BootstrapInput({...held,graphBytes:top.graphBytes,loadFiles:top.loadFiles,now:wall});const p=prepared;until=startedMono+p.binding.expiresAt-startedWall;wallUntil=p.binding.expiresAt;check(Number.isSafeInteger(until));
   const expected={binding:p.binding,runtime:p.runtime,sourceRoot:p.sourceRoot,receiptRoot:p.receiptRoot,graphSha256:p.graphSha256};
   const guard=()=>{try{
    check(!failed);const current=fields(ports,['now','monotonic','readCurrentEvidence']);check(current.now===now&&current.monotonic===monotonic&&current.readCurrentEvidence===readEvidence);p.loader.assertHealthy();clock();
    check(wall>=p.binding.issuedAt&&wall<p.binding.expiresAt&&wall<wallUntil&&mono<until);
    const temporary:Buffer[]=[];try{
    const data=snapshot(readEvidence.call(ports),temporary,65536),evidence=fields(data,[...Object.keys(expected),'expiresAt']);check(temporary.length===0);
    const {expiresAt,...body}=evidence;check(canonicalJson(body)===canonicalJson(expected)&&Number.isSafeInteger(expiresAt)&&expiresAt>wall&&expiresAt<=p.binding.expiresAt);
    wallUntil=Math.min(wallUntil,expiresAt);until=Math.min(until,mono+expiresAt-wall);check(Number.isSafeInteger(until));clock();check(wall<wallUntil&&mono<until);p.loader.assertHealthy();
    }finally{for(const b of temporary)b.fill(0);}
   }catch{failed=true;return fail();}};
   guard();check(hookOwner===undefined);hookOwner=lease;acquired=true;stage='IMPORT';p.loader.register();guard();
   const module=await import(p.loader.entryURL);guard();
   const exports=Object.keys(module).sort();check(exports.length===2&&exports[0]==='createManagementOriginTc01Entry'&&exports[1]==='createManagementOriginTc01NativeProviders'&&typeof module.createManagementOriginTc01Entry==='function'&&typeof module.createManagementOriginTc01NativeProviders==='function');
   stage='NATIVE';guard();const native=module.createManagementOriginTc01NativeProviders(held.nativePreparation);guard();
   const keys=['now','monotonic','assertCurrent','assertPreparedRuntime','consume','command','wait','openPool','closePool','prepareArtifactRoot'] as const,original=fields(native,keys);check(keys.every(k=>typeof original[k]==='function'));
   const before=()=>{guard();const current=fields(native,keys);check(keys.every(k=>current[k]===original[k]));};
   const sync=(key:typeof keys[number],args:unknown[])=>{try{before();const out=original[key].apply(native,args);guard();if(key==='assertCurrent'||key==='assertPreparedRuntime')check(out===undefined);return out;}catch{failed=true;return fail();}};
   const asynchronous=async(key:typeof keys[number],args:unknown[])=>{let out:any,obtained=false;try{before();out=await original[key].apply(native,args);obtained=true;guard();if(key==='consume'||key==='wait'||key==='prepareArtifactRoot')check(out===undefined);return out;}catch{
    failed=true;if(key==='openPool'&&obtained)try{await original.closePool.call(native,out,10000);}catch{}return fail();
   }};
   const wrapped:ManagementOriginEntryPorts={
    now:()=>sync('now',[]),monotonic:()=>sync('monotonic',[]),
    assertCurrent:b=>sync('assertCurrent',[b]),assertPreparedRuntime:(b,r)=>sync('assertPreparedRuntime',[b,r]),
    consume:async b=>{check(await asynchronous('consume',[b])===undefined);},command:c=>sync('command',[c]),wait:async ms=>{check(await asynchronous('wait',[ms])===undefined);},
    openPool:r=>asynchronous('openPool',[r]),closePool:(pool,ms)=>original.closePool.call(native,pool,ms),
    prepareArtifactRoot:async b=>{check(await asynchronous('prepareArtifactRoot',[b])===undefined);},
   };
   guard();const entry=module.createManagementOriginTc01Entry(Object.freeze(wrapped));const run=fields(entry,['run']).run;check(typeof run==='function');guard();
   stage='RUN';const raw=await run.call(entry,held.entryInput);stage='RESULT';guard();const read=readOutcome(raw);facts={fn03:read.fn03,tc01:read.tc01,appClosed:read.appClosed,poolClosed:read.poolClosed,resources:read.resources};
   checked=read.checked;
  }catch{facts=initial();checked=false;}
  finally{let revoked=false;try{prepared?.loader.revoke();revoked=true;}catch{facts=initial();checked=false;}finally{for(const b of owned)b.fill(0);if(revoked&&acquired&&hookOwner===lease)hookOwner=undefined;}}
  return outcome(checked);
 }});
}
