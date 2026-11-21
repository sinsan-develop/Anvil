import {types} from 'node:util';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';
import {readTc01DependencyCarrierInput,readTc01DependencyCarrierResult} from './qa-fn03-tc01-dependency-carrier-wire.ts';
import {createTc01DependencyIntake,type Tc01DependencyIntakePorts} from './qa-fn03-tc01-dependency-intake.ts';
import type {Tc01PreloadFilesPort} from './qa-fn03-tc01-preload-files.ts';

type Input=ReturnType<typeof readTc01DependencyCarrierInput>;
type Request=Readonly<{binding:Input['binding'];limits:Input['limits'];inputSha256:string}>;
export interface Tc01DependencyCarrierReceiverSupervisor{
 /** 동일 원 수신 감독의 승인/배타 소진·고정 source/recipe 및 현재성을 실제 대조하는 선행.
  * 입력 digest나 void 반환 자체는 승인/실행 권위를 발급하지 않는다. */
 assertCurrent(request:Request):void;
 /** 이미 검산한 동일 checkout HEAD/lock의 원바이트만 단회 공급한다. 파일 경로/코드/명령 입력 없음.
  * exact {sourceHead,packageLockSha256,bytes}; 공급 원본 수명·소거는 공급자 소유이며 수신은 복사본만 소거. */
 takeLockBytes(request:Request):unknown;
}
export type Tc01DependencyCarrierEntryResult=string|Readonly<{status:'UNKNOWN';code:'DEPENDENCY_CARRIER_ENTRY_UNKNOWN';authority:'NOT_ISSUED'}>;
const supervisorKeys=['assertCurrent','takeLockBytes'] as const;
const portKeys=['now','monotonic','assertApproved','verify','prepare','takeChild','start','umask','setTimeout','clearTimeout','assertCurrent'] as const;
const fileKeys=['context','lstat','fstat','realpath','open','read','close','readdir'] as const;
const bindingKeys=['purpose','attemptId','sourceHead','packageLockSha256','source','recipe','approvalSha256','consumptionSha256','issuedAt','expiresAt'];
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,backingOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
const unknown=():Tc01DependencyCarrierEntryResult=>Object.freeze({status:'UNKNOWN',code:'DEPENDENCY_CARRIER_ENTRY_UNKNOWN',authority:'NOT_ISSUED'});
function check(v:unknown):asserts v{if(!v)throw Error('DEPENDENCY_CARRIER_ENTRY_UNKNOWN');}
function record(v:unknown,keys:readonly string[],plain=false):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v));if(plain)check(!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v)));
 const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);const r:Record<string,any>=Object.create(null);
 for(const k of keys){const x=d[k];check(x&&'value'in x&&(!plain||x.enumerable));r[k]=x.value;}return r;
}
function owned(v:unknown,cap:number):Uint8Array{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v)&&types.isUint8Array(v)&&types.isArrayBuffer(backingOf.call(v)));const n=lengthOf.call(v);check(Number.isSafeInteger(n)&&n>0&&n<=cap);
 const b=new Uint8Array(n);try{set.call(b,v);return b;}catch{fill.call(b,0);throw Error('DEPENDENCY_CARRIER_ENTRY_UNKNOWN');}
}
/** 효과 없는 factory, 명시 run만 동일 수신 감독/기존 intake를 잇는다. 실제 CLI/transport/파일 adapter 없음.
 * expectedBinding과 원 wire는 첫 clock/callback 전에 소유하며 형상·권한 digest 비교는 기존 reader가 담당.
 * lock 공급은 1회, 자체 복사/SHA 검산 뒤만 기존 preparation600초→원종결→관측에 전달한다.
 * 전체30분 wall/mono anchor는 lock 공급 전부터 유지한다. 실패 이후 원 timer/mask/fd 정리는
 * 기존 captured 포트로 허용하되 다음 효과/관측/재시도/삭제는 열지 않는다.
 * 성공 문자열은 기존 canonical+LF 결과 wire 후보만이다. 실패는 고정 UNKNOWN으로 후보 reader가 거절한다.
 * 실제 승인/소진 기록·설치 provenance/시험 PASS/실행 authority는 발급하지 않는다. factory 단회는
 * 외부 영속 배타 소진을 대체하지 않는다. 원 자식 보존/회수와 공급 원본 bytes는 외부 감독 책임이다. */
export function createTc01DependencyCarrierEntry(supervisor:Tc01DependencyCarrierReceiverSupervisor,ports:Tc01DependencyIntakePorts,files:Tc01PreloadFilesPort){
 let spent=false;
 return Object.freeze({async run(inputWire:unknown,expectedBinding:unknown):Promise<Tc01DependencyCarrierEntryResult>{
  if(spent)return unknown();spent=true;let raw:Uint8Array|undefined,lock:Uint8Array|undefined,output:Buffer|undefined;
  try{
   raw=owned(inputWire,16384);const expected=record(expectedBinding,bindingKeys,true);expected.source=Object.freeze(record(expected.source,['entry','sha256','closureSha256'],true));Object.freeze(expected);
   const s=record(supervisor,supervisorKeys),p=record(ports,portKeys),f=record(files,fileKeys);check(supervisorKeys.every(k=>typeof s[k]==='function')&&portKeys.every(k=>typeof p[k]==='function')&&fileKeys.every(k=>typeof f[k]==='function'));
   const startedAt=p.now.call(ports),monotonicStartedAt=p.monotonic.call(ports),input=readTc01DependencyCarrierInput(raw,expected,{startedAt,monotonicStartedAt,now:startedAt,monotonicNow:monotonicStartedAt});
   const request:Request=Object.freeze({binding:input.binding,limits:input.limits,inputSha256:contentHash(raw)}),b=input.binding;
   const until=monotonicStartedAt+b.expiresAt-startedAt;check(Number.isSafeInteger(until));let wall=startedAt,mono=monotonicStartedAt,checking=false;
   const identity=()=>{const a=record(supervisor,supervisorKeys),q=record(ports,portKeys),io=record(files,fileKeys);check(supervisorKeys.every(k=>a[k]===s[k])&&portKeys.every(k=>q[k]===p[k])&&fileKeys.every(k=>io[k]===f[k]));};
   const clock=()=>{const w=p.now.call(ports),m=p.monotonic.call(ports);check(Number.isSafeInteger(w)&&w>=wall&&w<b.expiresAt&&Number.isSafeInteger(m)&&m>=mono&&m<until);wall=w;mono=m;};
   const guard=()=>{check(!checking);identity();clock();checking=true;try{check(s.assertCurrent.call(supervisor,request)===undefined);}finally{checking=false;}identity();clock();};
   guard();const supplied=s.takeLockBytes.call(supervisor,request),row=record(supplied,['sourceHead','packageLockSha256','bytes'],true);
   check(row.sourceHead===b.sourceHead&&row.packageLockSha256===b.packageLockSha256);lock=owned(row.bytes,16777216);check(contentHash(lock)===b.packageLockSha256);guard();
   const invoke=(key:'assertApproved'|'verify'|'prepare'|'assertCurrent',value:unknown)=>{guard();check(p[key].call(ports,value)===undefined);guard();};
   const intake=createTc01DependencyIntake({
    now:()=>p.now.call(ports),monotonic:()=>p.monotonic.call(ports),
    assertApproved:r=>invoke('assertApproved',r),verify:r=>invoke('verify',r),prepare:r=>invoke('prepare',r),assertCurrent:r=>invoke('assertCurrent',r),
    // 기존 preparation이 원 handle/timer를 캡처하기 전에 사후 guard로 잃지 않도록 반환은 그대로 둔다.
    takeChild:c=>{guard();return p.takeChild.call(ports,c);},start:(child,c)=>{guard();return p.start.call(ports,child,c);},
    setTimeout:(fn,ms)=>{guard();return p.setTimeout.call(ports,fn,ms);},clearTimeout:h=>p.clearTimeout.call(ports,h),umask:v=>p.umask.call(ports,v),
   },files);
   guard();const candidate=await intake.run(Object.freeze({binding:Object.freeze({attemptId:b.attemptId,sourceHead:b.sourceHead,lockSha256:b.packageLockSha256,issuedAt:b.issuedAt,expiresAt:b.expiresAt}),lockBytes:lock}));
   fill.call(lock,0);lock=undefined;check(candidate.status==='CANDIDATE_ONLY');guard();
   const result=canonicalJson({schemaVersion:1,kind:'TC01_DEPENDENCY_RESULT_V1',binding:b,result:candidate})+'\n';output=Buffer.from(result,'utf8');
   readTc01DependencyCarrierResult(output,b,{startedAt,monotonicStartedAt,now:wall,monotonicNow:mono});guard();return result;
  }catch{return unknown();}finally{if(raw)fill.call(raw,0);if(lock)fill.call(lock,0);if(output)fill.call(output,0);}
 }});
}
