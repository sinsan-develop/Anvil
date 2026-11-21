import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';
import {createTc01DependencyPreparation,type Tc01DependencyPreparationPorts} from './qa-fn03-tc01-dependency-preparation.ts';
import {createTc01DependencyEvidence,type Tc01DependencyEvidence,type Tc01DependencyEvidenceSupervisor} from './qa-fn03-tc01-dependency-evidence.ts';
import type {Tc01PreloadFilesPort} from './qa-fn03-tc01-preload-files.ts';

export interface Tc01DependencyIntakePorts extends Tc01DependencyPreparationPorts {
 /** 같은 감독이 원 설치 종결/사후 검산과 root·HEAD·lock·관측 권한을 계속 검산한다.
  * void 반환은 실제 승인·설치 provenance를 만들지 않는다. */
 assertCurrent:Tc01DependencyEvidenceSupervisor['assertCurrent'];
}
export type Tc01DependencyIntakeResult=Tc01DependencyEvidence|Readonly<{status:'UNKNOWN';code:'DEPENDENCY_INTAKE_UNKNOWN';authority:'NOT_ISSUED'}>;
const keys=['now','monotonic','assertApproved','verify','prepare','takeChild','start','umask','setTimeout','clearTimeout','assertCurrent'] as const;
const fileKeys=['context','lstat','fstat','realpath','open','read','close','readdir'] as const;
const bindingKeys=['attemptId','sourceHead','lockSha256','issuedAt','expiresAt'] as const;
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,bufferOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
const fail=():never=>{throw Error('TC01_DEPENDENCY_INTAKE_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function record(v:unknown,names:readonly string[]):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===names.length);
 const out:Record<string,any>=Object.create(null);for(const k of names){const x=d[k];check(x&&'value'in x);out[k]=x.value;}return out;
}
const unknown=():Tc01DependencyIntakeResult=>Object.freeze({status:'UNKNOWN',code:'DEPENDENCY_INTAKE_UNKNOWN',authority:'NOT_ISSUED'});
/** 명시 포트만 잇는 단회 내부 조립. factory/import에는 효과가 없다.
 * 기존 준비의 600초/원 child 종결/AFTER_CLOSE를 통과한 뒤에만 기존 관측을 실행한다.
 * 동일 clock anchor로 전체 승인창(최대30분)을 공유한다. 실패 뒤 재조회/신호/삭제/재시도0.
 * 반환은 기존 bootstrap dependencyManifestRaw/installedDependenciesSha256에 대조할 후보뿐이다.
 * 실제 graph·승인 packet/runtime hash 갱신이나 다음 실행을 자동 수행하지 않는다.
 * factory 단회는 프로세스 간 배타 승인 소비를 대신하지 않으며 원 child 회수는 외부 감독 책임이다. */
export function createTc01DependencyIntake(ports:Tc01DependencyIntakePorts,files:Tc01PreloadFilesPort){
 let spent=false;
 return Object.freeze({async run(input:unknown):Promise<Tc01DependencyIntakeResult>{
  if(spent)return unknown();spent=true;let lock:Buffer|undefined;
  try{
   const top=record(input,['binding','lockBytes']),b=Object.freeze(record(top.binding,bindingKeys));
   check(uuidV1(b.attemptId)&&typeof b.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(b.sourceHead)&&hashV1(b.lockSha256)&&Number.isSafeInteger(b.issuedAt)&&b.issuedAt>=0&&Number.isSafeInteger(b.expiresAt)&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=1800000);
   const value=top.lockBytes;check(!types.isProxy(value)&&types.isUint8Array(value)&&types.isArrayBuffer(bufferOf.call(value)));const n=lengthOf.call(value);check(n>0&&n<=16777216);lock=Buffer.alloc(n);set.call(lock,value);check(createHash('sha256').update(lock).digest('hex')===b.lockSha256);
   const p=record(ports,keys),f=record(files,fileKeys);check(keys.every(k=>typeof p[k]==='function')&&fileKeys.every(k=>typeof f[k]==='function'));
   let wall=-1,mono=-1,until=Infinity,afterClose=false,collected=false;
   const guard=()=>{
    const current=record(ports,keys),io=record(files,fileKeys);check(keys.every(k=>current[k]===p[k])&&fileKeys.every(k=>io[k]===f[k]));
    const w=p.now.call(ports),m=p.monotonic.call(ports);check(Number.isSafeInteger(w)&&w>=b.issuedAt&&w>=wall&&w<b.expiresAt&&Number.isSafeInteger(m)&&m>=0&&m>=mono&&m<until);
    if(until===Infinity){until=m+b.expiresAt-w;check(Number.isSafeInteger(until));}wall=w;mono=m;
   };
   const sameBinding=(request:Readonly<Record<string,unknown>>)=>{const seen=record(request.binding,bindingKeys);check(bindingKeys.every(k=>seen[k]===b[k]));};
   guard();
   const preparation=createTc01DependencyPreparation({
    now:()=>p.now.call(ports),monotonic:()=>p.monotonic.call(ports),
    assertApproved:r=>{guard();sameBinding(r);check(p.assertApproved.call(ports,r)===undefined);guard();},
    verify:r=>{guard();sameBinding(r);check(p.verify.call(ports,r)===undefined);guard();if(r.phase==='AFTER_CLOSE')afterClose=true;},
    prepare:r=>{guard();sameBinding(r);return p.prepare.call(ports,r);},
    // 원 handle은 기존 preparation이 먼저 캡처한 뒤 fresh 검사한다. wrapper에서 사후 throw로 잃지 않는다.
    takeChild:c=>{guard();return p.takeChild.call(ports,c);},start:(child,c)=>{guard();return p.start.call(ports,child,c);},
    // 원 timer/mask 정리는 기한·현재성 실패 후에도 원 captured 포트로 수행한다.
    umask:v=>p.umask.call(ports,v),setTimeout:(fn,ms)=>{guard();return p.setTimeout.call(ports,fn,ms);},clearTimeout:h=>p.clearTimeout.call(ports,h),
   });
   const result=await preparation.run(Object.freeze({binding:b,lockBytes:lock}));fill.call(lock,0);lock=undefined;
   const r=record(result,['status','code','recipe','authority','manifest']);check(r.status==='COLLECTED'&&r.code==='INSTALL_EXIT_COLLECTED'&&r.recipe==='TC01_DEPENDENCY_RECIPE_CANDIDATE_V1'&&r.authority==='NOT_ISSUED'&&r.manifest==='NOT_ISSUED'&&afterClose);
   guard();collected=true;
   const binding=Object.freeze({attemptId:b.attemptId,sourceHead:b.sourceHead,packageLockSha256:b.lockSha256,issuedAt:b.issuedAt,expiresAt:b.expiresAt});
   const observer=createTc01DependencyEvidence({now:()=>p.now.call(ports),monotonic:()=>p.monotonic.call(ports),assertCurrent:seen=>{check(collected&&afterClose);guard();check(Object.keys(binding).every(k=>seen[k]===binding[k as keyof typeof binding]));check(p.assertCurrent.call(ports,seen)===undefined);guard();}},files);
   const candidate=observer.observe(binding);guard();return candidate;
  }catch{return unknown();}finally{if(lock)fill.call(lock,0);}
 }});
}
