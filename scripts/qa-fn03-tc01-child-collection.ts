import {EventEmitter} from 'node:events';
import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';

export interface Tc01CollectionClock {
 now():number;monotonic():number;
 setTimeout(callback:()=>void,ms:number):unknown;clearTimeout(handle:unknown):void;
}
type Code='INPUT_INVALID'|'DEADLINE'|'SETUP_UNKNOWN'|'HANDLE_CHANGED'|'INPUT_FAILED'|'OUTPUT_FAILED'|'CHILD_FAILED'|'OUTPUT_LIMIT'|'OUTPUT_INVALID'|'ORDER_INVALID'|'CLOSE_UNCONFIRMED'|'CLEANUP_UNKNOWN'|'COLLECTION_UNKNOWN'|'RESULT_NOT_CHECKED'|'RESULT_COLLECTED';
export type Tc01ChildCollection=Readonly<{status:'COLLECTED'|'UNKNOWN';code:Code;localCollection:'CONFIRMED'|'UNCONFIRMED';authority:'NOT_ISSUED'}>;
const used=new WeakSet<object>(),on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
const typed=Object.getPrototypeOf(Uint8Array.prototype),lengthOf=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!,backingOf=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!,copy=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
const clockKeys=['now','monotonic','setTimeout','clearTimeout'] as const;
const resultKeys=['status','stage','code','authority','fn03','tc01','appClosed','poolClosed','resources'];
const answer=(code:Code,collected=false):Tc01ChildCollection=>Object.freeze({status:collected?'COLLECTED':'UNKNOWN',code,localCollection:collected?'CONFIRMED':'UNCONFIRMED',authority:'NOT_ISSUED'});
function own(value:object,key:string):unknown{const d=Object.getOwnPropertyDescriptor(value,key);return d&&'value'in d?d.value:undefined;}
function record(value:unknown,keys:readonly string[]):Record<string,any>{
 if(!value||typeof value!=='object'||types.isProxy(value)||Reflect.ownKeys(value).length!==keys.length)throw Error('INVALID');
 const out:Record<string,any>=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d))throw Error('INVALID');out[key]=d.value;}return out;
}
const emitter=(v:unknown):v is EventEmitter=>v!==null&&typeof v==='object'&&!types.isProxy(v)&&v instanceof EventEmitter;
function readResult(bytes:Uint8Array):'CHECKED'|'STOPPED'{
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),raw=parseWireJson(text),r=record(raw,resultKeys);
 if(text!==JSON.stringify(raw)&&text!==JSON.stringify(raw)+'\n')throw Error('INVALID');
 if(r.status==='CHECKED'&&r.stage==='RESULT'&&r.code==='JOURNEY_CHECKED'&&r.authority==='NOT_ISSUED'&&r.fn03==='CHECKED'&&r.tc01==='CHECKED'&&r.appClosed===true&&r.poolClosed===true&&r.resources==='REMOVED')return'CHECKED';
 if(r.status==='STOPPED'&&['INPUT','IMPORT','NATIVE','RUN','RESULT'].includes(r.stage)&&r.code==='BOUNDARY_OR_OUTCOME_UNKNOWN'&&r.authority==='NOT_ISSUED'&&['NOT_CHECKED','CHECKED'].includes(r.fn03)&&['NOT_STARTED','STARTED','CHECKED'].includes(r.tc01)&&typeof r.appClosed==='boolean'&&typeof r.poolClosed==='boolean'&&r.resources==='PRESERVED_OR_UNCONFIRMED'&&(r.fn03==='CHECKED'||r.tc01==='NOT_STARTED'))return'STOPPED';
 throw Error('INVALID');
}
/** 원 감독이 보유한 단일 Node handle의 로컬 보고만 수거한다. spawn/입력 전송/신호/조회 없음.
 * stdin 전송 전에 호출해야 한다. listener와 기한 timer 설치 중 이벤트는 정상 수거로 인정하지 않는다.
 * 기존 launcher exact9 JSON(+선택 LF), 최대4KiB 및 전체 승인창 최대30분을 재사용한다.
 * header/attempt를 stdout에 새로 만들지 않는다. 원 handle/manifest/승인 결박과 CLI는 별도 선행이다.
 * COLLECTED는 원 보고와 입력종결/출력종결/close(0,null)의 로컬 수거 사실이며 통합 시험·권위가 아니다.
 * timeout/불명에서 원 자식 종료를 주장하거나 요청하지 않는다. 자기 listener와 알려진 timer만 회수한다.
 */
export function collectTc01ChildResult(child:unknown,window:unknown,clock:Tc01CollectionClock):Promise<Tc01ChildCollection>{
 let original:EventEmitter,input:EventEmitter,output:EventEmitter,issuedAt:number,expiresAt:number,methods:Record<string,any>;
 try{
  if(!emitter(child)||used.has(child))return Promise.resolve(answer('INPUT_INVALID'));used.add(child);original=child;
  const w=record(window,['issuedAt','expiresAt']);issuedAt=w.issuedAt;expiresAt=w.expiresAt;
  if(!Number.isSafeInteger(issuedAt)||issuedAt<0||!Number.isSafeInteger(expiresAt)||expiresAt<=issuedAt||expiresAt-issuedAt>1800000)return Promise.resolve(answer('INPUT_INVALID'));
  const i=own(child,'stdin'),o=own(child,'stdout');if(!emitter(i)||!emitter(o)||i===o||i===child||o===child||used.has(i)||used.has(o))return Promise.resolve(answer('INPUT_INVALID'));
  used.add(i);used.add(o);input=i;output=o;methods=record(clock,clockKeys);if(!clockKeys.every(k=>typeof methods[k]==='function'))return Promise.resolve(answer('INPUT_INVALID'));
 }catch{return Promise.resolve(answer('INPUT_INVALID'));}
 return new Promise(resolve=>{
  const bytes=new Uint8Array(4096),listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
  let setup=true,ready=false,settled=false,terminal:{code:Code;collected:boolean}|undefined,timer:unknown,timerSet=false;
  let inputDone=false,outputDone=false,size=0,lastWall=-1,lastMono=-1,until=Infinity;
  const settle=()=>{
   if(settled||setup||!terminal)return;settled=true;let clean=true;
   for(const {target,event,fn}of listeners)try{off.call(target,event,fn);}catch{clean=false;}
   if(timerSet)try{if(methods.clearTimeout.call(clock,timer)!==undefined)clean=false;}catch{clean=false;}
   fill.call(bytes,0);resolve(answer(clean?terminal.code:'CLEANUP_UNKNOWN',clean&&terminal.collected));
  };
  const finish=(code:Code,collected=false)=>{if(terminal)return;terminal={code,collected};settle();};
  const fresh=()=>{
   try{
    const current=record(clock,clockKeys);if(!clockKeys.every(k=>current[k]===methods[k])){finish('COLLECTION_UNKNOWN');return false;}
    if(own(original,'stdin')!==input||own(original,'stdout')!==output){finish('HANDLE_CHANGED');return false;}
    const wall=methods.now.call(clock),mono=methods.monotonic.call(clock);
    if(!Number.isSafeInteger(wall)||wall<issuedAt||wall<lastWall||wall>=expiresAt||!Number.isSafeInteger(mono)||mono<0||mono<lastMono||mono>=until){finish('DEADLINE');return false;}
    if(until===Infinity){until=mono+expiresAt-wall;if(!Number.isSafeInteger(until)){finish('DEADLINE');return false;}}
    lastWall=wall;lastMono=mono;return true;
   }catch{finish('COLLECTION_UNKNOWN');return false;}
  };
  const listen=(target:EventEmitter,event:string,action:(...args:any[])=>void)=>{
   if(terminal)return;const fn=(...args:any[])=>{if(terminal)return;if(!ready){finish('SETUP_UNKNOWN');return;}try{if(fresh())action(...args);}catch{finish('COLLECTION_UNKNOWN');}};
   listeners.push({target,event,fn});on.call(target,event,fn);
  };
  try{
   if(!fresh())return;
   listen(input,'finish',()=>{if(inputDone||outputDone)finish('ORDER_INVALID');else inputDone=true;});
   listen(input,'error',()=>finish('INPUT_FAILED'));listen(input,'close',()=>{if(!inputDone)finish('INPUT_FAILED');});
   listen(output,'error',()=>finish('OUTPUT_FAILED'));listen(output,'close',()=>{if(!outputDone)finish('OUTPUT_FAILED');});
   listen(original,'error',()=>finish('CHILD_FAILED'));
   listen(original,'exit',(code:unknown,signal:unknown)=>{if(code!==0||signal!==null)finish('CHILD_FAILED');});
   listen(output,'data',(value:unknown)=>{
    if(outputDone||types.isProxy(value)||!types.isUint8Array(value)||!types.isArrayBuffer(backingOf.call(value))){finish('OUTPUT_INVALID');return;}
    const n=lengthOf.call(value);if(n>bytes.length-size){finish('OUTPUT_LIMIT');return;}copy.call(bytes,value,size);size+=n;
   });
   listen(output,'end',()=>{if(!inputDone||outputDone)finish('ORDER_INVALID');else outputDone=true;});
   listen(original,'close',(code:unknown,signal:unknown)=>{
    if(code!==0||signal!==null||!inputDone||!outputDone){finish('CLOSE_UNCONFIRMED');return;}
    try{const result=readResult(bytes.subarray(0,size));if(!fresh())return;finish(result==='CHECKED'?'RESULT_COLLECTED':'RESULT_NOT_CHECKED',result==='CHECKED');}catch{finish('OUTPUT_INVALID');}
   });
   if(!terminal&&fresh()){
    const remaining=Math.min(expiresAt-lastWall,until-lastMono);if(!Number.isSafeInteger(remaining)||remaining<=0)finish('DEADLINE');
    else{timer=methods.setTimeout.call(clock,()=>finish('DEADLINE'),remaining);timerSet=timer!==undefined&&timer!==null;if(!timerSet)finish('SETUP_UNKNOWN');if(!terminal&&fresh())ready=true;}
   }
  }catch{finish('SETUP_UNKNOWN');}finally{setup=false;settle();}
 });
}
