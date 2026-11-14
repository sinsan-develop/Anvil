import {types} from 'node:util';
import {receiveCopy,receiveRecord} from '../../../contracts/runtime/native-first-receive-v1.ts';
import {readNativePreparationAuthority} from '../../../contracts/runtime/native-preparation-ownership-return-v1.ts';
import {nativeHash,nativeSame} from '../../../contracts/runtime/native-preparation-authority-v1.ts';
import {refV1,uuidV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {readNativeLocalRecords,type NativeLocalJournal,type NativeLocalRecord,type NativeLocalTransaction} from './native-preparation-local-attempt.ts';

export interface NativeJournalOwnedSession {send(operation:'OPEN'|'READ'|'APPEND_SYNC'|'CLOSE',payload:unknown):Promise<unknown>;close():Promise<{state:string}>}
export interface NativeJournalOwnedPort {open(signal:AbortSignal,expiresAt:string,budget:{remainingMs():number;expiresAt():string}):Promise<NativeJournalOwnedSession>}
const instances=new WeakSet<object>();
export function isNativePreparationProtectedJournal(value:unknown):value is NativePreparationProtectedJournal{return !!value&&typeof value==='object'&&!types.isProxy(value)&&instances.has(value);}
function fail():never{throw Error('NATIVE_LOCAL_OUTCOME_UNKNOWN');}
function method(value:any,key:string):Function{if(!value||types.isProxy(value))return fail();const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!('value'in d)||typeof d.value!=='function')return fail();return d.value;}
/** 소유 desktop operation의 typed journal만 사용한다. 경로/FS/키/기본 보호 공급자는 없다. */
export class NativePreparationProtectedJournal implements NativeLocalJournal {
 readonly transport='OWNED_NATIVE_JOURNAL' as const;
 #authority:any;#port:NativeJournalOwnedPort;#open:Function;#clock:{wall:()=>number;monotonic:()=>number};#signal:AbortSignal;#busy=false;#unknown=false;
 constructor(authority:unknown,port:NativeJournalOwnedPort,clock:{wall:()=>number;monotonic:()=>number},signal:AbortSignal){
  const v=receiveCopy(authority) as any;if(!receiveRecord(v,['ref','snapshot'])||!refV1(v.ref)||v.ref.version!==1)fail();const a=readNativePreparationAuthority(v.snapshot);if(v.ref.id!==a.authorityId||v.ref.contentHash!==nativeHash(a))fail();
  this.#authority=v;this.#port=port;this.#open=method(port,'open');this.#clock={wall:clock.wall,monotonic:clock.monotonic};this.#signal=signal;if(!(signal instanceof AbortSignal)||typeof clock.wall!=='function'||typeof clock.monotonic!=='function')fail();instances.add(this);
 }
 readonly exclusive=async<T>(authorityRef:RuntimeRefV1,work:(tx:NativeLocalTransaction)=>Promise<T>,budget?:{signal:AbortSignal;remainingMs():number;expiresAt():string}):Promise<T>=>{
  if(this.#busy||this.#unknown||this.#signal.aborted||!nativeSame(authorityRef,this.#authority.ref)||method(this.#port,'open')!==this.#open||typeof work!=='function')fail();
  if(!budget||!(budget.signal instanceof AbortSignal)||budget.signal.aborted)fail();
  const remaining=method(budget,'remainingMs'),expiry=method(budget,'expiresAt');if(Reflect.apply(remaining,budget,[])<1)fail();
  this.#busy=true;const controller=new AbortController(),started=this.#clock.monotonic(),wall=this.#clock.wall();let end=Math.min(wall+10000,wall+budget.remainingMs(),Date.parse(budget.expiresAt()),Date.parse(this.#authority.snapshot.expiresAt)),lastWall=wall,lastMono=started,active=true,sent=false,session:NativeJournalOwnedSession|undefined,send:Function|undefined,close:Function|undefined,handle:string|undefined,sequence=0,busy=false;
  const abort=()=>controller.abort();this.#signal.addEventListener('abort',abort,{once:true});budget.signal.addEventListener('abort',abort,{once:true});if(this.#signal.aborted||budget.signal.aborted)abort();
  const tighten=()=>{if(method(budget,'remainingMs')!==remaining||method(budget,'expiresAt')!==expiry)fail();const left=Reflect.apply(remaining,budget,[]),at=Date.parse(Reflect.apply(expiry,budget,[]));if(!Number.isFinite(left)||left<=0||!Number.isFinite(at)||budget.signal.aborted)fail();end=Math.min(end,this.#clock.wall()+left,at);};
  const check=()=>{tighten();const w=this.#clock.wall(),m=this.#clock.monotonic();if(!active||controller.signal.aborted||!Number.isFinite(w)||!Number.isFinite(m)||w<lastWall||m<lastMono||m-started>=end-wall||w>=end||method(this.#port,'open')!==this.#open)fail();lastWall=w;lastMono=m;if(session&&(method(session,'send')!==send||method(session,'close')!==close))fail();};
  const bounded=async<R>(fn:()=>Promise<R>)=>{check();let timer:ReturnType<typeof setTimeout>|undefined;let stop=()=>{};try{const aborted=new Promise<never>((_,reject)=>{stop=()=>reject(Error('NATIVE_LOCAL_OUTCOME_UNKNOWN'));controller.signal.addEventListener('abort',stop,{once:true});timer=setTimeout(()=>{this.#unknown=true;controller.abort();},Math.max(1,Math.min(end-this.#clock.wall(),end-wall-(this.#clock.monotonic()-started))));});return await Promise.race([fn(),aborted]);}finally{if(timer)clearTimeout(timer);controller.signal.removeEventListener('abort',stop);}};
  const call=async(op:'OPEN'|'READ'|'APPEND_SYNC'|'CLOSE',body:unknown)=>{check();if(busy||++sequence>8)fail();busy=true;sent=true;try{const result=receiveCopy(await bounded(()=>Reflect.apply(send!,session,[op,receiveCopy(body)])));check();return result as any;}finally{busy=false;}};
  let result!:T,error:unknown,hadError=false;
  try{
   sent=true; // 소유 host 생성 호출 자체의 실패도 생성 여부 불명이다. 새 OPEN으로 치유하지 않는다.
   const opening=Promise.resolve(Reflect.apply(this.#open,this.#port,[controller.signal,new Date(end).toISOString(),budget]));opening.then(async late=>{if(!active||controller.signal.aborted){try{await Reflect.apply(method(late,'close'),late,[]);}catch{}this.#unknown=true;}}).catch(()=>{});
   session=await bounded(()=>opening);send=method(session,'send');close=method(session,'close');check();
   const opened=await call('OPEN',{authority:this.#authority});if(!receiveRecord(opened,['handle','authorityRef'])||!uuidV1(opened.handle)||!nativeSame(opened.authorityRef,authorityRef))fail();handle=opened.handle;
   let before:NativeLocalRecord[]|null=null;
   const read=async()=>{const answer=await call('READ',{handle});if(!receiveRecord(answer,['handle','complete','records'])||answer.handle!==handle)fail();const rows=readNativeLocalRecords({complete:answer.complete,records:answer.records},authorityRef);if(before&&(!nativeSame(before,rows)))fail();before=receiveCopy(rows);return{complete:true,records:receiveCopy(rows)};};
   const appendAndSync=async(record:NativeLocalRecord)=>{if(before===null)fail();const rows=readNativeLocalRecords({complete:true,records:[...before,receiveCopy(record)]},authorityRef);if(Buffer.byteLength(JSON.stringify(record))>2097152)fail();const answer=await call('APPEND_SYNC',{handle,expectedHash:nativeHash(before),record});if(!receiveRecord(answer,['handle','recordsHash'])||answer.handle!==handle||answer.recordsHash!==nativeHash(rows))fail();before=rows;};
   result=await bounded(()=>work(Object.freeze({read,appendAndSync})));check();const ended=await call('CLOSE',{handle});if(!receiveRecord(ended,['handle','state'])||ended.handle!==handle||ended.state!=='CLOSED_CONFIRMED')fail();
  }catch(e){hadError=true;error=e;if(sent)this.#unknown=true;}
  finally{active=false;this.#signal.removeEventListener('abort',abort);budget.signal.removeEventListener('abort',abort);let closeBudget=1;try{tighten();closeBudget=Math.max(1,Math.min(end-this.#clock.wall(),end-wall-(this.#clock.monotonic()-started)));}catch{hadError=true;this.#unknown=true;error=Error('NATIVE_LOCAL_OUTCOME_UNKNOWN');}if(session){let timer:ReturnType<typeof setTimeout>|undefined;try{const ended:any=await Promise.race([Promise.resolve(Reflect.apply(close??method(session,'close'),session,[])),new Promise(resolve=>{timer=setTimeout(()=>resolve({state:'UNKNOWN'}),closeBudget);})]);if(ended?.state!=='CLOSED_CONFIRMED'){hadError=true;this.#unknown=true;error=Error('NATIVE_LOCAL_OUTCOME_UNKNOWN');}}catch(e){hadError=true;this.#unknown=true;error=e;}finally{if(timer)clearTimeout(timer);}}controller.abort();this.#busy=false;}
  if(hadError||this.#unknown)throw error??Error('NATIVE_LOCAL_OUTCOME_UNKNOWN');return result;
 };
}
