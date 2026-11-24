import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,refV1,uuidV1,hashV1,recordV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
export type NormalStartPreparationScope={requestHash:string;transactionId:string;projectId:string;executionId:string;executionGeneration:number;
 preparationRef:Ref;contextBundleRef:Ref;actorId:string;clientId:string;humanSessionId:string;controlGeneration:number;credentialGeneration:number};
export type NormalStartPreparationInput={purpose:'NORMAL_START_PREPARATION_V1';commandId:string;scope:NormalStartPreparationScope;connectorRef:Ref;registrationRef:Ref;createdAt:string;expiresAt:string};
export type NormalStartPreparationCommit={preparation:Readonly<NormalStartPreparationInput>;commandRef:Ref;grantRef:Ref;envelopeHash:string};
/** 서버의 명시 구성 전용. 원 객체의 새 읽기와 반대편 감독 인계이며 실행/쓰기 허가가 아니다. */
export interface NormalStartPreparationOwner {
 read(scope:Readonly<NormalStartPreparationScope>,observedAt:string,signal:AbortSignal):Promise<unknown>;
 handoff(commit:Readonly<NormalStartPreparationCommit>,signal:AbortSignal):Promise<NormalStartPreparationOwner>;
 close():Promise<void>;
}
/** 한 원 시도에 할당된 port다. 앱 전체의 다중 시도 생성자/지속 소진 원장은 별도 선행이다. */
export interface NormalStartPreparationPort {create(input:Readonly<NormalStartPreparationInput>,signal:AbortSignal):Promise<NormalStartPreparationOwner>;}
type CloseResult={state:'CLOSED_CONFIRMED'|'UNKNOWN'};
type Entry={input:NormalStartPreparationInput;phase:'CREATING'|'HELD'|'COMMITTING'|'HANDOFF_STARTED'|'HANDED_OFF'|'UNKNOWN';controller:AbortController;
 wallEnd:number;monoEnd:number;timer?:ReturnType<typeof setTimeout>;owner?:NormalStartPreparationOwner;read?:NormalStartPreparationOwner['read'];
 handoff?:NormalStartPreparationOwner['handoff'];close?:NormalStartPreparationOwner['close'];closing?:Promise<boolean>;cleanup?:Promise<CloseResult>;bodyCompleted?:boolean;transferring?:boolean};
const spent=new WeakSet<NormalStartPreparationPort>(),retained=new WeakMap<NormalStartPreparationPort,Entry>();
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const failure=()=>new AuthFailure('NORMAL_START_PREPARATION_OUTCOME_UNKNOWN',503);
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
/** 단회 소진은 같은 서버 port의 프로세스 수명에 한정된다. 재시작의 지속 원장을 대신하지 않는다. */
export class NormalStartPreparationAttempts {
 #port:NormalStartPreparationPort;#create:NormalStartPreparationPort['create'];
 constructor(port:NormalStartPreparationPort){
  const create=port?.create;if(!port||typeof create!=='function')throw new AuthFailure('NORMAL_START_PREPARATION_REQUIRED',503);
  this.#port=port;this.#create=create;
 }
 #release(e:Entry){e.owner=undefined;e.read=undefined;e.handoff=undefined;e.close=undefined;e.closing=undefined;retained.delete(this.#port);}
 #close(e:Entry):Promise<boolean>|undefined{
  if(!e.owner||typeof e.close!=='function'||e.transferring||e.bodyCompleted)return;
  if(!e.closing){
   let settle!:(value:boolean)=>void;e.closing=new Promise<boolean>(resolve=>{settle=resolve;});
   try{Promise.resolve(Reflect.apply(e.close,e.owner,[])).then(value=>settle(value===undefined),()=>settle(false));}catch{settle(false);}
  }
  return e.closing;
 }
 #unknown(e:Entry){if(e.phase==='HANDED_OFF')return;e.phase='UNKNOWN';clearTimeout(e.timer);e.timer=undefined;e.controller.abort();}
 #remaining(e:Entry){return Math.min(e.wallEnd-Date.now(),e.monoEnd-performance.now());}
 #failedBody(e:Entry):Promise<CloseResult>{
  if(e.phase==='HANDED_OFF'||e.bodyCompleted||e.transferring)return Promise.resolve({state:'UNKNOWN'});
  if(e.cleanup)return e.cleanup;
  if(!e.owner){this.#unknown(e);return Promise.resolve({state:'UNKNOWN'});}
  // 정리 자체의 관측일 뿐 DB rollback/commit 결과를 증명하지 않는다. 원 close 재진입도 한 번만 소비한다.
  let finish!:(result:CloseResult)=>void;e.cleanup=new Promise<CloseResult>(resolve=>{finish=resolve;});
  this.#unknown(e);const closing=this.#close(e),remaining=this.#remaining(e);
  if(!closing||remaining<=0){finish({state:'UNKNOWN'});return e.cleanup;}
  void(async()=>{
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{
    const confirmed=await Promise.race([closing,new Promise<false>(resolve=>{timer=setTimeout(()=>resolve(false),remaining);})]);
    if(!confirmed||this.#remaining(e)<=0){finish({state:'UNKNOWN'});return;}
    this.#release(e);finish({state:'CLOSED_CONFIRMED'});
   }finally{clearTimeout(timer);}
  })();return e.cleanup;
 }
 #check(e:Entry,scope=e.input.scope){
  if(!['CREATING','HELD','COMMITTING','HANDOFF_STARTED'].includes(e.phase)||e.controller.signal.aborted||Date.now()>=e.wallEnd||performance.now()>=e.monoEnd
   ||this.#port.create!==this.#create||!same(e.input.scope,scope)||e.owner&&(e.owner.read!==e.read||e.owner.handoff!==e.handoff||e.owner.close!==e.close)){
   this.#unknown(e);throw failure();
  }
 }
 async #race<T>(e:Entry,task:Promise<T>):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
   const abort=()=>reject(failure()),done=()=>e.controller.signal.removeEventListener('abort',abort);
   task.then(value=>{done();resolve(value);},error=>{done();reject(error);});
   if(e.controller.signal.aborted){reject(failure());return;}
   e.controller.signal.addEventListener('abort',abort,{once:true});
  });
 }
 async create(value:NormalStartPreparationInput){
  const input=freeze(cloneV1(value)),s=input.scope;
  if(!recordV1(input,['purpose','commandId','scope','connectorRef','registrationRef','createdAt','expiresAt'])||input.purpose!=='NORMAL_START_PREPARATION_V1'||!uuidV1(input.commandId)
   ||!recordV1(s,['requestHash','transactionId','projectId','executionId','executionGeneration','preparationRef','contextBundleRef','actorId','clientId','humanSessionId','controlGeneration','credentialGeneration'])
   ||!hashV1(s.requestHash)||typeof s.transactionId!=='string'||!(/^[1-9][0-9]*$/).test(s.transactionId)
   ||![s.projectId,s.executionId,s.actorId,s.clientId,s.humanSessionId].every(uuidV1)||![s.executionGeneration,s.controlGeneration,s.credentialGeneration].every(v=>Number.isSafeInteger(v)&&v>=1)
   ||![s.preparationRef,s.contextBundleRef,input.connectorRef,input.registrationRef].every(refV1)||!isoV1(input.createdAt)||!isoV1(input.expiresAt))throw new AuthFailure('NORMAL_START_PREPARATION_INVALID',412);
  const duration=Date.parse(input.expiresAt)-Date.parse(input.createdAt),remaining=Date.parse(input.expiresAt)-Date.now();
  if(duration<=0||duration>10000||Date.parse(input.createdAt)>Date.now()||remaining<=0||spent.has(this.#port)||this.#port.create!==this.#create)throw failure();
  const e:Entry={input,phase:'CREATING',controller:new AbortController(),wallEnd:Date.parse(input.expiresAt),monoEnd:performance.now()+Math.min(duration,remaining)};
  spent.add(this.#port);retained.set(this.#port,e);e.timer=setTimeout(()=>{this.#unknown(e);void this.#failedBody(e);},Math.min(duration,remaining));
  try{
   const created=Promise.resolve().then(()=>{this.#check(e);return Reflect.apply(this.#create,this.#port,[input,e.controller.signal]);}).then(owner=>{
    e.owner=owner;e.read=owner?.read;e.handoff=owner?.handoff;e.close=owner?.close;
    if(!owner||typeof e.read!=='function'||typeof e.handoff!=='function'||typeof e.close!=='function'){this.#unknown(e);throw failure();}
    if(e.phase==='UNKNOWN')void this.#failedBody(e);
    return owner;
   });
   await this.#race(e,created);this.#check(e);e.phase='HELD';
  }catch{await this.#failedBody(e);throw failure();}
  return{
   unknown:()=>this.#unknown(e),
   failedBody:()=>this.#failedBody(e),
   beforeCommit:()=>{this.#check(e);if(e.phase!=='HELD')throw failure();e.bodyCompleted=true;e.phase='COMMITTING';},
   observe:async(scope:NormalStartPreparationScope,observedAt:string,signal:AbortSignal)=>{
    try{
     this.#check(e,scope);if(e.phase!=='HELD'||signal.aborted)throw failure();
     const result=cloneV1(await this.#race(e,Promise.resolve(Reflect.apply(e.read!,e.owner,[freeze(cloneV1(scope)),observedAt,AbortSignal.any([signal,e.controller.signal])])))) as Record<string,unknown>;
     this.#check(e,scope);
     if(!result||typeof result!=='object'||!isoV1(result.checkedAt)||!isoV1(result.expiresAt)
      ||Date.parse(result.checkedAt)<Date.parse(input.createdAt)||Date.parse(result.expiresAt)>Date.parse(input.expiresAt))throw failure();
     return result;
    }catch{this.#unknown(e);throw failure();}
   },
   committed:async(result:any,envelopeHash:string)=>{
    try{
     this.#check(e);const d=result?.data,q=d?.snapshot;
     if(e.phase!=='COMMITTING'||result.commandId!==input.commandId||result.projectId!==s.projectId||d?.status!=='NORMAL_QUEUE_STORED'||!refV1(d.ref)||!refV1(q?.grantRef)
      ||q.transport!=='NORMAL_PROTECTED'||q.executionId!==s.executionId||q.executionGeneration!==s.executionGeneration||!same(q.executorRegistrationRef,input.registrationRef)||!hashV1(envelopeHash))throw failure();
     const commit=freeze(cloneV1({preparation:input,commandRef:d.ref,grantRef:q.grantRef,envelopeHash}));e.phase='HANDOFF_STARTED';e.transferring=true;
     const returned=await this.#race(e,Promise.resolve(Reflect.apply(e.handoff!,e.owner,[commit,e.controller.signal])));
     this.#check(e);if(returned!==e.owner)throw failure();
     e.phase='HANDED_OFF';clearTimeout(e.timer);e.timer=undefined;this.#release(e);
    }catch{this.#unknown(e);throw failure();}
   }
  };
 }
}
