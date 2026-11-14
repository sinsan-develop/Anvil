import {NormalStartCoordinator,type NormalStartPorts} from './normal-start-coordinator.ts';
import {receiveNormalStart} from './normal-start-intake.ts';
import type {NormalProtectedGetClient} from './normal-protected-get-client.ts';
import type {NormalProtectedPostClient} from './normal-protected-post-client.ts';
import type {NormalCommandPage} from './normal-start-material-consumer.ts';

export interface NormalPollingClients{get:NormalProtectedGetClient;post:NormalProtectedPostClient;expiresAt:string}
export interface NormalStartPollingOptions{
 clients:NormalPollingClients;start:Omit<NormalStartPorts,'post'>;
 /** 로컬 소유자 변경 감지용. 서버 grant/current 검사를 대신하지 않는다. */
 owner:()=>string;deadline:number;maxPages:number;idleMs:number;
 /** 호출자가 명시 renew를 호출할 때만 사용한다. 불명 자동 복구 포트가 아니다. */
 renew?:(previous:Readonly<NormalPollingClients>,signal:AbortSignal)=>Promise<NormalPollingClients>;
}
type State='LIMIT_REACHED'|'CANCELLED'|'EXPIRED'|'NEEDS_RENEWAL'|'OWNER_CHANGED'|'UNKNOWN';
class Stop extends Error{readonly state:State;constructor(state:State){super(state);this.state=state;}}
type Cursor={afterSequence:number;afterCursor?:string};
/** 명시적으로 시작하는 normal source 조합. 실 wire/current 공급자를 생성하지 않는다.
 * cursor는 page 전체의 자료/attempt/ACK 완료 뒤에만 승격한다. 재시작은 0부터 읽고
 * 기존 intake/attempt journal을 재검산하므로 같은 START를 새 wire로 바꾸지 않는다. */
export class NormalStartPolling{
 #p:NormalStartPollingOptions;#clients:NormalPollingClients;#owner:string;
 #cursor:Cursor={afterSequence:0};#busy=false;#unknown=false;#last=-Infinity;
 constructor(p:NormalStartPollingOptions){
  if(typeof p?.owner!=='function'||typeof p.start?.clock!=='function'||!Number.isSafeInteger(p.start.timeoutMs)||p.start.timeoutMs<1||p.start.timeoutMs>10000||!Number.isSafeInteger(p.deadline)||
   !Number.isSafeInteger(p.maxPages)||p.maxPages<1||p.maxPages>10000||!Number.isSafeInteger(p.idleMs)||p.idleMs<1||p.idleMs>10000||
   p.renew!==undefined&&typeof p.renew!=='function')throw Error('NORMAL_POLL_CONFIG_INVALID');
  this.#p={...p,start:{...p.start}};this.#clients=this.#validate(p.clients);this.#owner=p.owner();
  if(typeof this.#owner!=='string'||!this.#owner||this.#owner.length>256)throw Error('NORMAL_POLL_OWNER_REQUIRED');
 }
 #validate(c:NormalPollingClients){
  if(!c||typeof c.get?.prepareCommandPage!=='function'||typeof c.get.send!=='function'||typeof c.post?.prepareObservations!=='function'||
   typeof c.post.send!=='function'||typeof c.expiresAt!=='string'||!Number.isFinite(Date.parse(c.expiresAt))||
   new Date(c.expiresAt).toISOString()!==c.expiresAt)throw Error('NORMAL_POLL_CLIENTS_INVALID');
  return Object.freeze({...c});
 }
 #now(){const n=this.#p.start.clock();if(!Number.isSafeInteger(n)||n<this.#last)throw new Stop('UNKNOWN');this.#last=n;return n;}
 #guard(signal:AbortSignal,credential=true){
  if(signal.aborted)throw new Stop('CANCELLED');
  let owner:string;try{owner=this.#p.owner();}catch{throw new Stop('OWNER_CHANGED');}
  if(owner!==this.#owner)throw new Stop('OWNER_CHANGED');
  const n=this.#now();if(n>=this.#p.deadline)throw new Stop('EXPIRED');
  if(credential&&n>=Date.parse(this.#clients.expiresAt))throw new Stop('NEEDS_RENEWAL');
 }
 /** 늦게 끝난 포트는 관측만 하고 다음 단계로 연결하지 않는다. 불명은 이 인스턴스에서 영구 차단한다. */
 async #call<T>(fn:(s:AbortSignal)=>Promise<T>,signal:AbortSignal,credential=true,aggregate=false):Promise<T>{
  this.#guard(signal,credential);const child=new AbortController();
  // 묶음 전체에 개별 host의 10초를 재적용하지 않는다. 각 GET/permit/current/wire의 기존 한도는 해당 모듈이 지킨다.
  const remaining=Math.min(aggregate?Infinity:10000,this.#p.deadline-this.#now(),credential?Date.parse(this.#clients.expiresAt)-this.#now():Infinity);
  if(remaining<this.#p.start.timeoutMs)throw new Stop(credential&&Date.parse(this.#clients.expiresAt)<this.#p.deadline?'NEEDS_RENEWAL':'EXPIRED');
  let timer:ReturnType<typeof setTimeout>|undefined,watch:ReturnType<typeof setInterval>|undefined;
  let reject!:(e:unknown)=>void;const stopped=new Promise<never>((_,no)=>{reject=no;});
  const cancel=()=>{child.abort();reject(new Stop('CANCELLED'));};
  signal.addEventListener('abort',cancel,{once:true});
  timer=setTimeout(()=>{child.abort();reject(new Stop('EXPIRED'));},Math.max(1,remaining));
  watch=setInterval(()=>{try{this.#guard(signal,credential);}catch(e){child.abort();reject(e);}},25);
  try{
   const pending=Promise.resolve().then(()=>{this.#guard(signal,credential);if(child.signal.aborted)throw new Stop('CANCELLED');return fn(child.signal);});
   const value=await Promise.race([pending,stopped]);this.#guard(signal,credential);
   if(child.signal.aborted)throw new Stop('CANCELLED');return value;
  }catch(e){this.#unknown=true;throw e;}
  finally{if(timer!==undefined)clearTimeout(timer);if(watch!==undefined)clearInterval(watch);signal.removeEventListener('abort',cancel);child.abort();}
 }
 async #idle(signal:AbortSignal){
  this.#guard(signal);await new Promise<void>((resolve,reject)=>{
   let timer:ReturnType<typeof setTimeout>,watch:ReturnType<typeof setInterval>;
   const done=(e?:unknown)=>{clearTimeout(timer);clearInterval(watch);signal.removeEventListener('abort',abort);e?reject(e):resolve();};
   const abort=()=>done(new Stop('CANCELLED'));
   timer=setTimeout(()=>done(),Math.max(1,Math.min(this.#p.idleMs,this.#p.deadline-this.#now(),Date.parse(this.#clients.expiresAt)-this.#now())));
   watch=setInterval(()=>{try{this.#guard(signal);}catch(e){done(e);}},25);signal.addEventListener('abort',abort,{once:true});
   if(signal.aborted)abort();
  });this.#guard(signal);
 }
 #result(state:State,pages:number,commands:number,reason:State|string=state){return{state,reason,pages,commands,cursor:{...this.#cursor},
  // NEEDS_RENEWAL은 새 operation의 여유 부족도 포함한다. renew는 이 실제 만료 시각 전에는 거절한다.
  renewalNotBefore:this.#clients.expiresAt,executionAuthorized:false as const,agentSuccessVerified:false as const};}
 async run(signal:AbortSignal){
  if(this.#busy)throw Error('NORMAL_POLL_BUSY');if(!(signal instanceof AbortSignal))throw Error('NORMAL_POLL_SIGNAL_REQUIRED');
  if(this.#unknown)return this.#result('UNKNOWN',0,0);
  this.#busy=true;let pages=0,commands=0;
  try{
   while(pages<this.#p.maxPages){
    this.#guard(signal);const clients=this.#clients;
    // host의 10초 한도를 서버 long-poll에 전부 쓰지 않는다. 대기는 host 밖에서 한다.
    const packet=await this.#call(s=>clients.get.prepareCommandPage({...this.#cursor,waitMs:0},s),signal);
    const page=await this.#call(s=>clients.get.send(packet,s),signal) as NormalCommandPage;
    if(!Array.isArray(page.items)||page.items.length>50||typeof page.hasMore!=='boolean'||typeof page.nextCursor!=='string'||!page.nextCursor||page.nextCursor.length>4096)throw Error('PAGE_INVALID');
    let sequence=this.#cursor.afterSequence;
    for(const item of page.items){
     if(!Number.isSafeInteger(item.sequence)||item.sequence<=sequence||item.envelope.operation!=='START_SESSION')throw Error('PAGE_INVALID');
     await this.#call(s=>receiveNormalStart(clients.get,this.#p.start.intake,item,page.proofResultRef,s),signal,true,true);
     const coordinator=new NormalStartCoordinator({...this.#p.start,post:clients.post});
     const result=await this.#call(s=>coordinator.start(item.envelope,s),signal,true,true);
     if(result.state!=='RESPONSE_RECORDED')this.#unknown=true;
     await this.#call(s=>this.#p.start.spool.sync(clients.post,s),signal,true,true);
     if(result.state!=='RESPONSE_RECORDED'){this.#unknown=true;return this.#result('UNKNOWN',pages,commands,'START_UNKNOWN');}
     commands++;sequence=item.sequence;
    }
    if(!page.items.length)await this.#call(s=>this.#p.start.spool.sync(clients.post,s),signal,true,true);
    this.#guard(signal);
    if(page.hasMore&&!page.items.length)throw Error('PAGE_NO_PROGRESS');
    if(sequence>0)this.#cursor={afterSequence:sequence,afterCursor:page.nextCursor};
    pages++;if(pages<this.#p.maxPages&&!page.hasMore)await this.#idle(signal);
   }
   return this.#result('LIMIT_REACHED',pages,commands);
  }catch(e){
   const reason=e instanceof Stop?e.state:'OPERATION_FAILED';
   if(!(e instanceof Stop)||reason==='OWNER_CHANGED'||reason==='UNKNOWN')this.#unknown=true;
   return this.#result(this.#unknown?'UNKNOWN':reason as State,pages,commands,reason);
  }finally{this.#busy=false;}
 }
 async renew(signal:AbortSignal){
  if(!(signal instanceof AbortSignal))throw Error('NORMAL_POLL_SIGNAL_REQUIRED');
  if(this.#busy)throw Error('NORMAL_POLL_BUSY');if(this.#unknown)throw Error('NORMAL_POLL_UNKNOWN');
  this.#guard(signal,false);if(this.#now()<Date.parse(this.#clients.expiresAt))throw Error('NORMAL_POLL_NOT_EXPIRED');
  if(!this.#p.renew)throw Error('NORMAL_POLL_RENEW_REQUIRED');
  this.#busy=true;try{
   const old=this.#clients;
   const next=await this.#call(async s=>{
    const value=this.#validate(await this.#p.renew!(old,s));
    if(value.get===old.get||value.post===old.post||Date.parse(value.expiresAt)<=this.#now())throw Error('NORMAL_POLL_RENEW_INVALID');
    return value;
   },signal,false);
   this.#clients=next;this.#cursor={afterSequence:0};
  }finally{this.#busy=false;}
 }
}
