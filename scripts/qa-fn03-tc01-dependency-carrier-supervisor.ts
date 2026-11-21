import {EventEmitter} from 'node:events';
import {types} from 'node:util';
import {contentHash} from '../contracts/canonical.ts';
import {readTc01DependencyCarrierInput,readTc01DependencyCarrierResult} from './qa-fn03-tc01-dependency-carrier-wire.ts';

type Input=ReturnType<typeof readTc01DependencyCarrierInput>;
type Candidate=ReturnType<typeof readTc01DependencyCarrierResult>['candidate'];
type Request=Readonly<{binding:Input['binding'];limits:Input['limits'];inputSha256:string}>;
export interface Tc01DependencyCarrierSupervisorPorts{
 now():number;monotonic():number;
 /** 별도 감독이 원 child/고정 source/recipe·승인 및 배타 소진 기록을 실제로 대조한다.
  * expected binding/digest 또는 이 callback의 void만으로 실제 권위가 생성되지는 않는다. */
 assertCurrent(child:EventEmitter,request:Request):void;
 setTimeout(callback:()=>void,ms:number):unknown;clearTimeout(handle:unknown):void;
 /** 이미 공급한 같은 원 child의 stdin에 bytes를 정확 한 번 write/end. 생성/신호/추가 명령 없음.
  * 비동기 전송은 호출 안에서 자체 소유 복사해야 한다(감독은 실패/종료 시 전달 복사본을 소거).
  * 실제 전송 완료는 원 stdin finish로 알려야 하며 undefined 반환만으로 종결하지 않는다. */
 transmit(child:EventEmitter,bytes:Uint8Array):void;
}
export type Tc01DependencyCarrierCollection=Readonly<{
 status:'COLLECTED'|'UNKNOWN';code:'MANIFEST_CANDIDATE_COLLECTED'|'DEPENDENCY_CARRIER_UNKNOWN';
 localCollection:'CONFIRMED'|'UNCONFIRMED';authority:'NOT_ISSUED';candidate?:Candidate;
}>;
const keys=['now','monotonic','assertCurrent','setTimeout','clearTimeout','transmit'] as const;
const used=new WeakSet<object>(),on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,backingOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!;
const set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill,subarray=Uint8Array.prototype.subarray,outputCap=4210688;
function check(v:unknown):asserts v{if(!v)throw Error('DEPENDENCY_CARRIER_UNKNOWN');}
function record(v:unknown,fields:readonly string[],plain=false):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v));if(plain)check(!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v)));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===fields.length);
 const r:Record<string,any>=Object.create(null);for(const k of fields){const x=d[k];check(x&&'value'in x&&(!plain||x.enumerable));r[k]=x.value;}return r;
}
function own(v:object,k:string):unknown{const d=Object.getOwnPropertyDescriptor(v,k);return d&&'value'in d?d.value:undefined;}
const emitter=(v:unknown):v is EventEmitter=>v!==null&&typeof v==='object'&&!types.isProxy(v)&&v instanceof EventEmitter;
function owned(v:unknown):Uint8Array{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v)&&types.isUint8Array(v)&&types.isArrayBuffer(backingOf.call(v)));
 const n=lengthOf.call(v);check(Number.isSafeInteger(n)&&n>0&&n<=16384);const b=new Uint8Array(n);
 try{set.call(b,v);return b;}catch{fill.call(b,0);throw Error('DEPENDENCY_CARRIER_UNKNOWN');}
}
const answer=(candidate?:Candidate):Tc01DependencyCarrierCollection=>Object.freeze(candidate?
 {status:'COLLECTED',code:'MANIFEST_CANDIDATE_COLLECTED',localCollection:'CONFIRMED',authority:'NOT_ISSUED',candidate}:
 {status:'UNKNOWN',code:'DEPENDENCY_CARRIER_UNKNOWN',localCollection:'UNCONFIRMED',authority:'NOT_ISSUED'});
/** 기존 wire만 소비하는 로컬 수거 감독. 원 process 생성/CLI/SSH/설치/신호/조회/재시도/삭제 포트 없음.
 * stdin <=16KiB, stdout <=4MiB+16KiB를 단일 owned 버퍼로 제한하고 같은 전체 window <=30분의
 * wall/mono 기한을 유지한다. 설치 단계600초는 기존 preparation의 원 내부 검산 책임이다.
 * listener와 timer 선등록 성공 후 전송은 한 번뿐이다. input finish → output end → close(0,null)
 * 및 현재성 뒤에만 후보를 반환한다. exit/kill 요청만으로 완료하지 않는다. stderr는 이 wire의
 * 입력이 아니며 별도 carrier의 기존 무원문/출력 제한 책임이다. 실제 carrier는 여기서 발급하지 않는다.
 * COLLECTED는 이 원 handle의 후보 보고를 수거한 로컬 사실이다. 실제 설치/provenance/시험 PASS나
 * 승인/소진 기록 진위를 주장하지 않는다. 불명에는 원 child 보존, 자기 listener/timer만 해제한다.
 * transmit 반환/원 stdin finish/종결 수거에서 같은 input digest를 재검산한다. 외부로 전달된
 * bytes의 실제 진위는 원 감독 책임이며 여기서는 보유 복사본 변조만 거절한다.
 * WeakSet 단회는 같은 module instance의 handle에 한정되며 외부 영속 배타 소진을 대신하지 않는다. */
export function createTc01DependencyCarrierSupervisor(ports:Tc01DependencyCarrierSupervisorPorts){
 const p=record(ports,keys);check(keys.every(k=>typeof p[k]==='function'));let spent=false;
 return Object.freeze({async run(child:unknown,inputWire:unknown,expectedBinding:unknown):Promise<Tc01DependencyCarrierCollection>{
  if(spent)return answer();spent=true;let raw:Uint8Array|undefined;
  try{
   check(emitter(child)&&!used.has(child));used.add(child);
   const input=own(child,'stdin'),output=own(child,'stdout');check(emitter(input)&&emitter(output)&&input!==output&&input!==child&&output!==child&&!used.has(input)&&!used.has(output));used.add(input);used.add(output);
   raw=owned(inputWire);
   const expected=record(expectedBinding,['purpose','attemptId','sourceHead','packageLockSha256','source','recipe','approvalSha256','consumptionSha256','issuedAt','expiresAt'],true);
   expected.source=Object.freeze(record(expected.source,['entry','sha256','closureSha256'],true));Object.freeze(expected);
   const startedAt=p.now.call(ports),monotonicStartedAt=p.monotonic.call(ports);
   const parsed=readTc01DependencyCarrierInput(raw,expected,{startedAt,monotonicStartedAt,now:startedAt,monotonicNow:monotonicStartedAt});
   const request:Request=Object.freeze({binding:parsed.binding,limits:parsed.limits,inputSha256:contentHash(raw)});
   const inputCurrent=()=>check(raw&&contentHash(raw)===request.inputSha256);
   const expiresAt=parsed.binding.expiresAt,until=monotonicStartedAt+expiresAt-startedAt;check(Number.isSafeInteger(until));
   let lastWall=startedAt,lastMono=monotonicStartedAt,guarding=false;
   const identity=()=>{const current=record(ports,keys);check(keys.every(k=>current[k]===p[k])&&own(child,'stdin')===input&&own(child,'stdout')===output);};
   const clock=()=>{const wall=p.now.call(ports),mono=p.monotonic.call(ports);check(Number.isSafeInteger(wall)&&wall>=lastWall&&wall<expiresAt&&Number.isSafeInteger(mono)&&mono>=lastMono&&mono<until);lastWall=wall;lastMono=mono;};
   const valid=()=>{check(!guarding);identity();clock();guarding=true;try{check(p.assertCurrent.call(ports,child,request)===undefined);}finally{guarding=false;}identity();clock();};
   valid();
   return await new Promise<Tc01DependencyCarrierCollection>(resolve=>{
    const bytes=new Uint8Array(outputCap),listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
    let setup=true,ready=false,settled=false,terminal:false|Candidate|undefined,timer:unknown,timerSet=false,inputDone=false,outputDone=false,size=0,exited=false;
    const settle=()=>{
     if(setup||settled||terminal===undefined)return;settled=true;let clean=true;
     for(const l of listeners)try{off.call(l.target,l.event,l.fn);}catch{clean=false;}
     if(timerSet)try{check(p.clearTimeout.call(ports,timer)===undefined);}catch{clean=false;}
     if(clean&&terminal)try{valid();inputCurrent();}catch{clean=false;}
     fill.call(bytes,0);resolve(answer(clean&&terminal?terminal:undefined));
    };
    const finish=(candidate?:Candidate)=>{if(settled)return;if(!candidate)terminal=false;else if(terminal===undefined)terminal=candidate;settle();};
    const listen=(target:EventEmitter,event:string,action:(...args:any[])=>void)=>{
     if(terminal!==undefined)return;const fn=(...args:any[])=>{if(terminal!==undefined)return;if(!ready){finish();return;}try{valid();if(terminal===undefined)action(...args);}catch{finish();}};
     listeners.push({target,event,fn});on.call(target,event,fn);
    };
    try{
     listen(input,'error',()=>finish());listen(output,'error',()=>finish());listen(child,'error',()=>finish());
     listen(input,'finish',()=>{check(!inputDone&&!outputDone);inputCurrent();inputDone=true;});
     listen(input,'close',()=>check(inputDone));listen(output,'close',()=>check(outputDone));
     listen(output,'data',(v:unknown)=>{
      check(!outputDone&&v!==null&&typeof v==='object'&&!types.isProxy(v)&&types.isUint8Array(v)&&types.isArrayBuffer(backingOf.call(v)));
      const n=lengthOf.call(v);check(Number.isSafeInteger(n)&&n>=0&&n<=outputCap-size);set.call(bytes,v,size);size+=n;
     });
     listen(output,'end',()=>{check(inputDone&&!outputDone);outputDone=true;});
     listen(child,'exit',(code:unknown,signal:unknown)=>{check(!exited&&code===0&&signal===null);exited=true;});
     listen(child,'close',(code:unknown,signal:unknown)=>{
      check(code===0&&signal===null&&inputDone&&outputDone);inputCurrent();
      const result=readTc01DependencyCarrierResult(subarray.call(bytes,0,size),request.binding,{startedAt,monotonicStartedAt,now:lastWall,monotonicNow:lastMono});
      valid();if(terminal===undefined)finish(result.candidate);
     });
     if(terminal===undefined){valid();const remaining=Math.min(expiresAt-lastWall,until-lastMono);check(Number.isSafeInteger(remaining)&&remaining>0);timer=p.setTimeout.call(ports,()=>finish(),remaining);timerSet=timer!==undefined&&timer!==null;check(timerSet);}
     if(terminal===undefined){valid();if(terminal===undefined){inputCurrent();ready=true;check(p.transmit.call(ports,child,raw)===undefined);inputCurrent();valid();}}
    }catch{terminal=false;}finally{setup=false;settle();}
   });
  }catch{return answer();}finally{if(raw)fill.call(raw,0);}
 }});
}
