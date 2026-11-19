import {EventEmitter} from 'node:events';
import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';
import {readSubnetRemoteEnvelope,readSubnetCompletionBinding,type SubnetRemoteEnvelope} from './qa-ix01-subnet-observation-remote.ts';

export interface SubnetCollectionClock{
 now():number;monotonic():number;
 setTimeout(callback:()=>void,ms:number):unknown;clearTimeout(handle:unknown):void;
}
type Code='INPUT_INVALID'|'DEADLINE'|'INPUT_FAILED'|'OUTPUT_FAILED'|'CHILD_FAILED'|'OUTPUT_LIMIT'|'OUTPUT_INVALID'|'CLOSE_UNCONFIRMED'|'COLLECTION_UNKNOWN'|'REMOTE_COMPLETION_UNVERIFIED';
export type SubnetChildCollection=Readonly<{status:'UNKNOWN';code:Code;localCollection:'CONFIRMED'|'UNCONFIRMED'}>;
const used=new WeakSet<object>();
const on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
const arrayPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const length=Object.getOwnPropertyDescriptor(arrayPrototype,'byteLength')!.get!;
const backing=Object.getOwnPropertyDescriptor(arrayPrototype,'buffer')!.get!;
const answer=(code:Code,confirmed=false):SubnetChildCollection=>Object.freeze({status:'UNKNOWN',code,localCollection:confirmed?'CONFIRMED':'UNCONFIRMED'});
function own(object:object,key:string):unknown{return Object.getOwnPropertyDescriptor(object,key)?.value;}
function emitter(value:unknown):value is EventEmitter{return !!value&&typeof value==='object'&&!types.isProxy(value)&&value instanceof EventEmitter;}

// 출력은 원 host의 닫힌 JSON 한 건만 허용한다. CIDR은 임시 메모리에서만 검사하며 반환하지 않는다.
function validResult(bytes:Uint8Array):boolean{
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 if(/^\{"code":"(?:UNKNOWN|NO_CANDIDATE)"\}\n?$/.test(text))return true;
 const m=/^\{"code":"CANDIDATE","cidr":"172\.(\d{2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28"\}\n?$/.exec(text);
 return !!m&&Number(m[1])>=16&&Number(m[1])<=31&&Number(m[2])<255&&Number(m[3])<=240&&Number(m[3])%16===0;
}

/** 이미 소유한 단일 child에, stdin 전송 전에 붙이는 수거기다. spawn/전송/kill/unref/OS 조회는 없다.
 * 공급자는 원 handle과 clock을 보유한 감독자여야 한다. 모의 EventEmitter는 운영 신원 증거가 아니다.
 * 원 stdin finish, stdout end, child close(0,null)를 모두 관측해야 로컬 수거만 확정한다.
 * timeout은 수거를 유한하게 끝내되 child 종결을 확정하지 않는다. 원 소유자의 후속 수거 책임은 남는다.
 * 제거하는 것은 자기 listener/timer뿐이다. 공급자가 가진 원 error 처리/프로세스 소유를 회수하지 않는다.
 * 로컬 SSH close와 원격 완료는 별개다. 채택된 원격 완료 증거가 없는 이 단위는 모든 경우 UNKNOWN이며
 * 후보/원 stdout/예외/주소/ID를 발행하지 않는다. 기존 host와 번들, 승인 및 실제 실행 범위는 불변이다.
 */
function collectChild(child:unknown,window:unknown,clock:SubnetCollectionClock,validate:(bytes:Uint8Array)=>boolean):Promise<SubnetChildCollection>{
 let input:EventEmitter,output:EventEmitter,issuedAt:number,expiresAt:number;
 try{
  if(!emitter(child)||used.has(child)||!window||typeof window!=='object'||types.isProxy(window)
   ||Reflect.ownKeys(window).length!==2)return Promise.resolve(answer('INPUT_INVALID'));
  const start=own(window,'issuedAt'),end=own(window,'expiresAt');
  if(typeof start!=='number'||typeof end!=='number'||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<=start||end-start>60_000)return Promise.resolve(answer('INPUT_INVALID'));
  const stdin=own(child,'stdin'),stdout=own(child,'stdout');
  if(!emitter(stdin)||!emitter(stdout)||stdin===stdout||stdin===child||stdout===child)return Promise.resolve(answer('INPUT_INVALID'));
  input=stdin;output=stdout;issuedAt=start;expiresAt=end;used.add(child);
 }catch{return Promise.resolve(answer('INPUT_INVALID'));}
 const original=child as EventEmitter;
 return new Promise(resolve=>{
  let done=false,inputDone=false,outputDone=false,size=0;
  let lastWall=issuedAt,lastMono=0,firstMono=0,remaining=0,timer:unknown,timerSet=false;
  const bytes=new Uint8Array(4096),listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
  const finish=(code:Code,confirmed=false)=>{
   if(done)return;done=true;let clean=true;
   for(const {target,event,fn}of listeners)try{off.call(target,event,fn);}catch{clean=false;}
   if(timerSet)try{clock.clearTimeout(timer);}catch{clean=false;}
   bytes.fill(0);resolve(answer(clean?code:'COLLECTION_UNKNOWN',clean&&confirmed));
  };
  const fresh=()=>{
   const wall=clock.now(),mono=clock.monotonic();
   if(!Number.isSafeInteger(wall)||wall<lastWall||wall>=expiresAt||!Number.isFinite(mono)||mono<lastMono||mono-firstMono>=remaining){finish('DEADLINE');return false;}
   lastWall=wall;lastMono=mono;return true;
  };
  const listen=(target:EventEmitter,event:string,action:(...args:any[])=>void)=>{
   const fn=(...args:any[])=>{if(done)return;try{if(fresh())action(...args);}catch{finish('COLLECTION_UNKNOWN');}};
   listeners.push({target,event,fn});on.call(target,event,fn);
  };
  try{
   lastWall=clock.now();firstMono=lastMono=clock.monotonic();remaining=expiresAt-lastWall;
   if(!Number.isSafeInteger(lastWall)||lastWall<issuedAt||remaining<=0||!Number.isFinite(firstMono)||firstMono<0){finish('DEADLINE');return;}
   listen(input,'finish',()=>{if(inputDone)finish('INPUT_FAILED');else inputDone=true;});
   listen(input,'error',()=>finish('INPUT_FAILED'));
   listen(output,'error',()=>finish('OUTPUT_FAILED'));
   listen(original,'error',()=>finish('CHILD_FAILED'));
   listen(output,'data',(value:unknown)=>{
    if(outputDone||types.isProxy(value)||!types.isUint8Array(value)||types.isSharedArrayBuffer(backing.call(value))){finish('OUTPUT_INVALID');return;}
    const n=length.call(value);if(n>bytes.length-size){finish('OUTPUT_LIMIT');return;}
    Uint8Array.prototype.set.call(bytes,value,size);size+=n;
   });
   listen(output,'end',()=>{if(outputDone)finish('OUTPUT_INVALID');else outputDone=true;});
   listen(original,'close',(code:unknown,signal:unknown)=>{
    if(code!==0||signal!==null||!inputDone||!outputDone){finish('CLOSE_UNCONFIRMED');return;}
    let valid=false;try{valid=validate(bytes.subarray(0,size));}catch{/* 원문은 보관하지 않는다. */}
    finish(valid?'REMOTE_COMPLETION_UNVERIFIED':'OUTPUT_INVALID',valid);
   });
   timer=clock.setTimeout(()=>{if(!done)finish('DEADLINE');},remaining);timerSet=true;
   // 합성 timer가 동기 종료를 전달해도 뒤늦게 등록된 timer를 남기지 않는다.
   if(done)try{clock.clearTimeout(timer);}catch{/* 이미 UNKNOWN인 수거 결과는 승격하지 않는다. */}
  }catch{finish('COLLECTION_UNKNOWN');}
 });
}
export function collectSubnetObservationChild(child:unknown,window:unknown,clock:SubnetCollectionClock):Promise<SubnetChildCollection>{return collectChild(child,window,clock,validResult);}

/** 고정 원 연결/소스의 소유자가 공급한 expected 결박만 소비한다. 임의 원격 보고를 인증하거나
 * 실제 실행 승인을 발급하지 않는다. 원 완료 envelope와 같은 로컬 원 handle의 정상 종결 둘 다 필요하다.
 * 기존 raw 후보 수거기는 계속 UNKNOWN이다. 새 형상은 후속 exact 실행안/adapter 없이는 운용하지 않는다.
 */
export async function collectSubnetRemoteCompletion(child:unknown,proof:unknown,window:unknown,clock:SubnetCollectionClock){
 let binding:ReturnType<typeof readSubnetCompletionBinding>;
 try{binding=readSubnetCompletionBinding(proof,window);}catch{return answer('INPUT_INVALID');}
 let verified:SubnetRemoteEnvelope|undefined;
 const local=await collectChild(child,binding.window,clock,bytes=>{
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),raw=parseWireJson(text);
  if(text!==JSON.stringify(raw)&&text!==JSON.stringify(raw)+'\n')return false;
  verified=readSubnetRemoteEnvelope(raw,binding.proof,binding.window);return true;
 });
 if(local.localCollection!=='CONFIRMED'||!verified)return local;
 return Object.freeze({status:'OBSERVATION_COLLECTED' as const,result:verified.result});
}
