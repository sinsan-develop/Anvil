import {AsyncLocalStorage} from 'node:async_hooks';
import * as fs from 'node:fs/promises';
import {unlinkSync} from 'node:fs';
import {basename,resolve,isAbsolute} from 'node:path';
import {isPromise,isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,refV1,recordV1,uuidV1,hashV1} from '../../../contracts/runtime/validation-v1.ts';
import type {NormalOwnedHostFactory,NormalOwnedHostSession,NormalOwnedMetadata,HostCloseDisposition} from './normal-credential-bootstrap-client.ts';
import {isOwnedSpoolPath,NormalStartFileStore,type NormalFilePorts,type NormalLocalScope,type ProfileJournalAccess} from './normal-start-file-store.ts';
import {NormalStartIntake,type NormalStartStore} from './normal-start-intake.ts';
import {NormalClaudeStartWire} from '../adapters/secondary/normal-start-wire.ts';
import {confirmNormalLiveInputDelivery,takeFirstOutputOrigin,type LiveInputPort,type NormalFirstSendSource} from './normal-first-send-owner.ts';
import type {NormalStartWire,NormalStartCurrent} from './normal-start-coordinator.ts';
import type {RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {receiveProfiledEnvelope,type InboxFilePorts,type InboxLimits} from './receipt-inbox.ts';

type Writer='NORMAL_EXECUTION'|'UNVERIFIED_RECEIPT_INBOX';
type IO=NormalFilePorts&InboxFilePorts;
type Guard=()=>void;
type Session={host:NormalOwnedHostSession;invalidated:AbortSignal;current:()=>void;send:NormalOwnedHostSession['send'];scope:string;writer:Writer;slot:NormalOwnedMetadata|null;
 signal:AbortSignal;wall:number;mono:number;frames:number;sending:boolean;borrowed:boolean;dead:boolean;
 profile:string;allocation:string;path:string;stamp:string};
type Ticket={session:Session;live:boolean;child:boolean};
function invalid(code='NORMAL_SPOOL_UNKNOWN'):never{throw Error(code);}
const capacity=Object.freeze(new Error('NORMAL_SPOOL_CAPACITY_EXCEEDED'));
const defaultIO:IO={lstat:fs.lstat,realpath:fs.realpath,open:fs.open,opendir:fs.opendir,readdir:fs.readdir,unlink:fs.unlink,unlinkSync};
const byRef=(value:unknown)=>canonicalJson(value);
const tickets=new AsyncLocalStorage<Ticket>();
const outside=new AsyncLocalStorage<boolean>();
const profileJournals=new WeakSet<ProfileJournalAccess>();
type OutputPorts=NormalFirstSendSource['storage'];
export type WorkerSdkPorts=Pick<NormalFirstSendSource,'plannedSid'|'expiresAt'|'create'|'close'|'check'>&{classify:OutputPorts['classify']};
type Hold=Awaited<ReturnType<OutputPorts['reserve']>>;
type OutputTx=Parameters<OutputPorts['strictExclusive']>[1];
type Handoff={reservation:string;challenge:string;scopeDigest:string;requestDigest:string};
type PhaseControls={resume?:Handoff;closeReservation?:string;challenge?:string;guard:()=>void};
const outputBinders=new WeakMap<OutputPorts,(ticket:object)=>void>();
const outputJournals=new WeakSet<ProfileJournalAccess>();
export function isProfileOutputJournal(access:ProfileJournalAccess){return outputJournals.has(access);}
export function bindProfileOutput(store:OutputPorts,ticket:object){outputBinders.get(store)?.(ticket);}
function gate<T>(){
 let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;
 const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});void promise.catch(()=>{});
 return {promise,resolve,reject};
}
// SDK 입력에는 첫 명령 한 개와 다음 명령을 기다리는 pull 한 개만 둔다.
function workerInput(first:AsyncIterable<unknown>,life:AbortSignal,check:Guard){
 type Step=IteratorResult<unknown>;
 let taken=false,firstUsed=false,pulling=false,offered=false,closed=false;
 let demand=gate<void>(),request:ReturnType<typeof gate<Step>>|undefined;
 const error=()=>Error('NORMAL_WORKER_INPUT_UNAVAILABLE');
 const close=()=>{closed=true;life.removeEventListener('abort',close);demand.reject(error());request?.reject(error());};
 const live=()=>{if(closed||life.aborted)throw error();check();if(closed||life.aborted)throw error();};
 life.addEventListener('abort',close,{once:true});if(life.aborted)close();
 const stream=Object.freeze({[Symbol.asyncIterator](){
  if(taken)throw error();taken=true;live();
  return Object.freeze({
   next():Promise<Step>{
    if(pulling)return Promise.reject(error());pulling=true;
    try{
     live();
     if(!firstUsed){
      firstUsed=true;
      return (async()=>{try{const value=await first[Symbol.asyncIterator]().next();live();if(value.done)throw error();return value;}
       catch(cause){close();throw cause;}finally{pulling=false;}})();
     }
     request=gate<Step>();demand.resolve();return request.promise;
    }catch(cause){close();return Promise.reject(cause);}
   },
   async return(){close();return {done:true as const,value:undefined};}
  });
 }});
 const provide=async(input:AsyncIterable<unknown>,signal:AbortSignal,confirm:Guard)=>{
  if(offered||closed||!firstUsed||signal.aborted)throw error();
  offered=true;signal.addEventListener('abort',close,{once:true});
  try{
   live();await demand.promise;live();const next=request;if(!next||signal.aborted)throw error();
   // 이 명령의 진짜 iterable이 current/원장 재검산을 마친 뒤에만 대기한 SDK pull에 제공한다.
   const value=await input[Symbol.asyncIterator]().next();live();
   if(value.done)throw error();const upcoming=gate<void>();
   confirm();
   if(closed||life.aborted||signal.aborted||request!==next)throw error();
   request=undefined;pulling=false;demand=upcoming;next.resolve(value);
  }catch(cause){close();throw cause;}finally{offered=false;signal.removeEventListener('abort',close);}
 };
 return {stream,provide,close};
}
const profileReceipts=new WeakMap<InboxFilePorts,string>();
export function isProfileJournal(access:ProfileJournalAccess){return profileJournals.has(access);}
export function isProfileReceipt(ports:InboxFilePorts,path:string){return profileReceipts.get(ports)===path;}
export function outsideOwnedSpoolCallback<T>(call:()=>T):T{return tickets.exit(()=>outside.run(true,call));}
function summary(value:unknown){return recordV1(value,['count','bytes','tail'])&&Number.isSafeInteger(value.count)&&Number.isSafeInteger(value.bytes)&&value.count>=0&&value.count<=10000&&value.bytes>=0&&(value.count===0?value.bytes===0&&value.tail===null:value.bytes>0&&hashV1(value.tail));}
const pathEqual=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

// Only application source uses this class. The desktop bundle exports a purpose factory, not this store or its host.
export class OwnedSpoolRuntime {
 readonly #als=tickets;
 readonly #workers=new WeakMap<NormalStartWire,{journal:NormalStartFileStore;scope:NormalLocalScope;registration:RuntimeRefV1;grant:RuntimeRefV1}>();
 readonly #workerReads=new WeakMap<NormalStartFileStore,NormalStartStore>();
 #foreground?:AbortSignal;#turn?:ReturnType<typeof gate<void>>;
 #binding?:{update:(profile:RuntimeRefV1,allocation:RuntimeRefV1)=>void};
 #session?:Session;#opening=false;#unknown=false;
 readonly #host:NormalOwnedHostFactory;readonly #open:NormalOwnedHostFactory['open'];readonly #io:IO;
 readonly #attempt:string;readonly #now:()=>number;readonly #owner:AbortSignal;
 readonly #slot:()=>NormalOwnedMetadata|null;
 constructor(host:NormalOwnedHostFactory,attempt:string,now:()=>number,owner:AbortSignal,slot:()=>NormalOwnedMetadata|null,io?:IO){
  if(!host||typeof host.open!=='function'||!uuidV1(attempt)||!(owner instanceof AbortSignal))invalid('NORMAL_SPOOL_UNSUPPORTED');
  this.#host=host;this.#open=host.open;this.#attempt=attempt;this.#now=now;this.#owner=owner;this.#slot=slot;this.#io=io??defaultIO;
 }
 external<T>(call:()=>T):T{return outsideOwnedSpoolCallback(call);}
 async #enterTurn(eligible:boolean,signal:AbortSignal){
  if(!this.#binding)return ()=>{};
  if(this.#turn&&(!eligible||outside.getStore()))invalid('NORMAL_OWNED_BUSY');
  const prior=this.#turn,next=gate<void>();this.#turn=next;
  const release=()=>{if(this.#turn===next)this.#turn=undefined;next.resolve();};
  if(prior)await prior.promise;
  if(this.#unknown||signal.aborted||this.#owner.aborted){release();invalid();}
  return release;
 }
 #clock(){return this.external(this.#now);}
 #check(s:Session,physical=true){
  this.external(()=>{
   if(s.host.send!==s.send||this.#open!==this.#host.open)invalid();
   if(physical){
    if(s.current!==s.host.current||s.invalidated!==s.host.invalidated||s.invalidated.aborted)invalid();
    Reflect.apply(s.current,s.host,[]);
   }
  });
  const wall=this.#clock(),slot=s.writer==='NORMAL_EXECUTION'?byRef(this.external(this.#slot)):s.scope;
  if(this.#unknown||s.dead||this.#owner.aborted||s.signal.aborted||s!==this.#session||
     wall>=s.wall||performance.now()>=s.mono||slot!==s.scope)invalid();
 }
 async #bounded<T>(s:Session,run:()=>Promise<T>):Promise<T>{
  this.#check(s);
  let reject!:(error:Error)=>void;
  const lost=new Promise<never>((_,r)=>{reject=r;}),signals=[s.signal,this.#owner,s.invalidated];
  void lost.catch(()=>{});
  const cancel=()=>{s.dead=true;reject(Error('NORMAL_SPOOL_UNKNOWN'));};
  const timer=setTimeout(cancel,Math.max(1,Math.min(s.wall-this.#clock(),s.mono-performance.now())));
  for(const signal of signals)signal.addEventListener('abort',cancel,{once:true});
  try{this.#check(s);return await Promise.race([run(),lost]);}
  finally{clearTimeout(timer);for(const signal of signals)signal.removeEventListener('abort',cancel);}
 }
 async #frame(s:Session,op:string,p:unknown){
  this.#check(s);if(s.sending||++s.frames>64)invalid();s.sending=true;
  try{const answer=await this.external(()=>Reflect.apply(s.send,s.host,[op,p]));this.#check(s);return answer;}
  catch(e){s.dead=true;throw e;}finally{s.sending=false;}
 }
 // Channel.operation supplies its captured credential metadata only for a protected HTTP request.
 credentialHost():NormalOwnedHostFactory{
  return {open:async(signal,request)=>{
   const t=this.#als.getStore();
   if(!t){
    if(!this.#binding){if(this.#unknown||this.#owner.aborted||this.#opening||this.#session)invalid('NORMAL_OWNED_BUSY');return this.external(()=>Reflect.apply(this.#open,this.#host,[signal]));}
    const eligible=!!request&&byRef(request)===byRef(this.external(this.#slot));
    const release=await this.#enterTurn(eligible,signal);
    try{
     if(this.#opening||this.#session||eligible&&byRef(request)!==byRef(this.external(this.#slot)))invalid('NORMAL_OWNED_BUSY');
     const raw=await this.external(()=>Reflect.apply(this.#open,this.#host,[signal]));
     const send=raw.send,close=raw.close;let returned=false;
     return {send:(op:string,p:unknown)=>{if(returned||raw.send!==send)invalid();return this.external(()=>Reflect.apply(send,raw,[op,p]));},
      close:async(d:HostCloseDisposition)=>{if(returned)invalid();returned=true;try{return await this.external(()=>Reflect.apply(close,raw,[d]));}finally{release();}}};
    }catch(error){release();throw error;}
   }
   const s=t.session;this.#check(s);
   if(!t.live||t.child||!request||s.writer!=='NORMAL_EXECUTION'||s.borrowed||s.scope!==byRef(request)||signal.aborted)invalid('NORMAL_OWNED_BUSY');
   s.borrowed=true;let returned=false,began=false;
   const check=()=>{this.#check(s);if(!t.live||returned||!s.borrowed||signal.aborted)invalid();};
   return {send:async(op:string,p:unknown)=>{
    check();if(!began){
     if(!['NORMAL_EXECUTION_BEGIN','NORMAL_EXECUTION_CALL'].includes(op)||p===null||typeof p!=='object'||isProxy(p)||
        Object.getOwnPropertyDescriptor(p,'slotId')?.value!==s.slot?.slotId||Object.getOwnPropertyDescriptor(p,'attemptId')?.value!==this.#attempt)invalid();
     began=true;
    }else if(!['NORMAL_EXECUTION_WRITE','NORMAL_EXECUTION_EXECUTE','NORMAL_EXECUTION_READ'].includes(op))invalid();
    const answer=await this.#frame(s,op,p);check();return answer;
   },close:async(disposition:HostCloseDisposition)=>{
    if(returned||!t.live||this.#session!==s||s.sending||!began||disposition!=='HOST_REQUEST_VALIDATED')s.dead=true;
    returned=true;s.borrowed=false;this.#check(s);return {state:'CLOSED_CONFIRMED'};
   }};
  }};
 }
 #auth(s:Session){return s.slot?{writer:s.writer,attemptId:this.#attempt,slotId:s.slot.slotId}:{writer:s.writer,attemptId:this.#attempt};}
 async #root<T>(writer:Writer,signal:AbortSignal,body:(t:Ticket)=>Promise<T>,phase?:PhaseControls):Promise<T>{
  if(this.#als.getStore()||!this.#binding)return this.#openRoot(writer,signal,body,phase);
  const release=await this.#enterTurn(signal===this.#foreground||!!phase,signal);
  try{phase?.guard();return await this.#openRoot(writer,signal,body,phase);}finally{release();}
 }
 async #openRoot<T>(writer:Writer,signal:AbortSignal,body:(t:Ticket)=>Promise<T>,phase?:PhaseControls):Promise<T>{
  const parent=this.#als.getStore();
  if(parent){
   if(phase)invalid();this.#check(parent.session);if(!parent.live||parent.child||parent.session.borrowed||parent.session.writer!==writer||parent.session.signal!==signal)invalid('NORMAL_OWNED_BUSY');
   parent.child=true;const t={session:parent.session,live:true,child:false};
   try{return await this.#als.run(t,()=>body(t));}finally{t.live=false;parent.child=false;}
  }
  if(this.#unknown||this.#session||this.#opening||this.#owner.aborted||signal.aborted||this.#host.open!==this.#open)invalid('NORMAL_OWNED_BUSY');
  this.#opening=true;
  let host:NormalOwnedHostSession|undefined,s:Session|undefined,success=false,openingStarted=false;
  try{
   const slot=writer==='NORMAL_EXECUTION'?this.external(this.#slot):null;
   if(writer==='NORMAL_EXECUTION'&&!slot)invalid('NORMAL_SPOOL_UNSUPPORTED');
   const now=this.#clock(),wall=Math.min(now+10000,slot?Date.parse(slot.expiresAt):Infinity),mono=performance.now()+wall-now;
   if(wall<=now||this.#owner.aborted||signal.aborted)invalid();
   openingStarted=true;host=await this.external(()=>Reflect.apply(this.#open,this.#host,[signal]));
   const current=host.current,invalidated=host.invalidated;if(typeof current!=='function'||isProxy(current)||!(invalidated instanceof AbortSignal))invalid();
   s={host,current,invalidated,send:host.send,scope:byRef(slot),writer,slot,signal,wall,mono,frames:0,sending:false,borrowed:false,dead:false,profile:'',allocation:'',path:'',stamp:''};
   this.#session=s;const auth=this.#auth(s);
   const state=await this.#frame(s,'NORMAL_SPOOL_PROFILE_STATE',auth);
   if(recordV1(state,['state'])&&state.state==='UNSUPPORTED'){success=true;invalid('NORMAL_SPOOL_UNSUPPORTED');}
   if(!recordV1(state,['profileId','allocated'])||!uuidV1(state.profileId)||typeof state.allocated!=='boolean')invalid('NORMAL_SPOOL_UNSUPPORTED');
   const binding=writer==='NORMAL_EXECUTION'&&!!this.#binding&&!phase?.resume;
   if(phase?.resume&&!state.allocated)invalid();phase?.guard();
   const a=await this.#frame(s,state.allocated?'NORMAL_SPOOL_RESUME':'NORMAL_SPOOL_ALLOCATE',
    phase?.resume?{...auth,...phase.resume}:binding?{...auth,outputBinding:true}:auth);
   if(!recordV1(a,['state','profileId','allocation','root','directoryIdentity',...(binding?['profileRef','assignmentRef']:[])])||a.state!==(state.allocated?'RESUMED':'ALLOCATED')||
      a.profileId!==state.profileId||!uuidV1(a.allocation)||typeof a.directoryIdentity!=='string'||!a.directoryIdentity||
      typeof a.root!=='string'||!isAbsolute(a.root)||!pathEqual(a.root,resolve(a.root))||!isOwnedSpoolPath(a.root)||basename(a.root)!=='data-'+a.allocation)invalid();
   if(binding){
    if(!refV1(a.profileRef)||a.profileRef.version!==1||a.profileRef.id!==a.profileId||!refV1(a.assignmentRef)||a.assignmentRef.version!==1||a.assignmentRef.id!==a.allocation)invalid();
    this.#binding!.update(cloneV1(a.profileRef),cloneV1(a.assignmentRef));
   }
   s.profile=a.profileId;s.allocation=a.allocation;s.path=a.root;
   const path=s.path,st=await this.#bounded(s,()=>this.#io.lstat(path));this.#check(s);
   if(!st.isDirectory()||st.isSymbolicLink()||!pathEqual(await this.#bounded(s,()=>this.#io.realpath(path)),path))invalid();
   s.stamp=String(st.dev)+':'+String(st.ino);this.#check(s);
   const t={session:s,live:true,child:false};let result:T;
   let denied=false;
   try{result=await this.#bounded(s,()=>this.#als.run(t,()=>body(t)));this.#check(s);if(t.child||s.borrowed)invalid();}catch(error){if(error!==capacity)throw error;denied=true;}finally{t.live=false;}
   phase?.guard();
   const closed=await this.#frame(s,'NORMAL_SPOOL_CLOSE',{...auth,allocation:s.allocation,...(phase?.closeReservation?{reservation:phase.closeReservation}:{})});
   if(phase?.closeReservation){
    if(!recordV1(closed,['state','challenge'])||closed.state!=='SDK_READ_CLOSED'||typeof closed.challenge!=='string'||!uuidV1(closed.challenge.slice(0,36))||!uuidV1(closed.challenge.slice(36)))invalid();
    phase.challenge=closed.challenge;
   }else if(!recordV1(closed,['state'])||closed.state!=='CLOSED_CONFIRMED')invalid();
   success=true;if(denied)throw capacity;return result!;
  }finally{
   if(host){
    try{const physical=host;const closed=await this.external(()=>physical.close(success?'HOST_REQUEST_VALIDATED':'OPERATION_UNKNOWN'));if(closed?.state!=='CLOSED_CONFIRMED')success=false;
     if(success&&s)this.#check(s,false);
    }catch{success=false;}
   }
   if(s)s.dead=true;this.#session=undefined;this.#opening=false;
   if(!success&&openingStarted){this.#unknown=true;invalid();}
  }
 }
 async #transaction<T>(writer:Writer,channel:string,signal:AbortSignal,run:(path:string,io:IO)=>Promise<T>):Promise<T>{
  return this.#root(writer,signal,async t=>{
   const s=t.session,auth={...this.#auth(s),allocation:s.allocation,channel};
   const hold=await this.#frame(s,'NORMAL_SPOOL_RESERVE',{...auth,nodeStamp:s.stamp});
   if(recordV1(hold,['state'])&&hold.state==='CAPACITY_EXCEEDED')throw capacity;
   if(!recordV1(hold,['reservation','before'])||!uuidV1(hold.reservation)||!summary(hold.before))invalid();
   let pending=0,sealed=false;
   const check=()=>{this.#check(s);if(!t.live||sealed||this.#als.getStore()!==t)invalid();};
   const io=guardFiles(this.#io,check,()=>{pending++;},()=>{pending--;},s.path,s.stamp);
   if(writer==='UNVERIFIED_RECEIPT_INBOX')profileReceipts.set(io,s.path);
   let completed=false;
   try{
    const result=await run(s.path,io);check();sealed=true;
    if(pending||t.child||s.borrowed)invalid();
    const settled=await this.#frame(s,'NORMAL_SPOOL_SETTLE',{...auth,reservation:hold.reservation});
    if(!recordV1(settled,['state','summary'])||settled.state!=='SETTLED'||!summary(settled.summary))invalid();completed=true;return result;
   }finally{sealed=true;profileReceipts.delete(io);if(!completed)s.dead=true;}
  });
 }
 journal(scope:NormalLocalScope,signal:AbortSignal){
  const verify=()=>{
   const slot=this.external(this.#slot);
   if(!slot||slot.scope.projectId!==scope.projectId||slot.scope.executionId!==scope.executionId||slot.scope.executionGeneration!==scope.executionGeneration)
    invalid('NORMAL_SPOOL_SCOPE_INVALID');
  };
  let activeRead:{ticket:Ticket;channel:string;used:boolean}|undefined;
  const access:ProfileJournalAccess={transaction:(channel,run)=>{
   verify();
   return this.#transaction('NORMAL_EXECUTION',channel,signal,async(path,io)=>{
    if(!channel.startsWith('attempt-'))return run(path,io);
    const ticket=this.#als.getStore();
    if(activeRead||!ticket||!ticket.live||ticket.session.signal!==signal)invalid();
    const original={ticket,channel,used:false};activeRead=original;
    try{return await run(path,io);}finally{if(activeRead===original)activeRead=undefined;}
   });
  }};
  Object.freeze(access);profileJournals.add(access);
  const journal=new NormalStartFileStore(access,scope),source=journal.intake();
  const reader:NormalStartStore={transport:'NORMAL_PROTECTED',exclusive:async(key,read)=>{
   const claim=activeRead;
   if(!claim||claim.used||this.#als.getStore()||!recordV1(key,['projectId','executionId','executionGeneration','commandId'])||
      key.projectId!==scope.projectId||key.executionId!==scope.executionId||key.executionGeneration!==scope.executionGeneration||
      !uuidV1(key.commandId)||claim.channel!=='attempt-'+key.commandId)invalid();
   // Consume before current/clock or any async work. Only the private forWorker intake has this reader.
   claim.used=true;
   const t=claim.ticket,s=t.session;
   const current=()=>{
    if(activeRead!==claim||!t.live||s!==this.#session||s.writer!=='NORMAL_EXECUTION'||s.signal!==signal||signal.aborted||s.borrowed)invalid();
    this.#check(s);
   };
   current();if(t.child)invalid();
   const result=await this.#als.run(t,()=>source.exclusive(key,async tx=>{
    const out=await read({
     read:async()=>{current();const v=await tx.read();current();return v;},
     readPart:async ref=>{current();const bytes=await tx.readPart(ref);current();return bytes;},
     appendAndSync:async()=>invalid()
    });
    current();return out;
   }));
   current();if(t.child)invalid();return result;
  }};
  this.#workerReads.set(journal,Object.freeze(reader));return journal;
 }
 workerWire(journal:NormalStartFileStore,expected:ConstructorParameters<typeof NormalStartIntake>[1],current:NormalStartCurrent,
  grantRef:RuntimeRefV1,clock:()=>number,timeoutMs:number){
  const reader=this.#workerReads.get(journal);if(!reader)invalid('NORMAL_SPOOL_SCOPE_INVALID');
  this.#workerReads.delete(journal);
  const intake=new NormalStartIntake(reader,expected,clock);
  const worker=NormalClaudeStartWire.forWorker({intake,current,grantRef,clock,timeoutMs});
  const {projectId,executionId,executionGeneration}=expected.context;
  this.#workers.set(worker,{journal,scope:{projectId,executionId,executionGeneration},registration:cloneV1(expected.executorRegistrationRef),grant:cloneV1(grantRef)});
  return worker;
 }
 #outputPorts(local:NormalLocalScope,origin:()=>{scope:ReturnType<typeof takeFirstOutputOrigin>['scope'];signal:AbortSignal;end:number;profile:string;allocation:string},classify:OutputPorts['classify']):OutputPorts{
  type Request=Parameters<OutputPorts['reserve']>[0];
  type Closed={holdId:string;tailRef:RuntimeRefV1|null;rows:number};
  const make=(req:Request)=>({req,ready:gate<Hold>(),pre:gate<OutputTx>(),post:gate<number>(),written:gate<Closed>(),
   held:undefined as Hold|undefined,seal:undefined as Handoff|undefined,stage:'RESERVING',read:undefined as Promise<Closed>|undefined,
   write:undefined as Promise<{holdId:string;dataBytes:number;managementBytes:number}>|undefined});
  let ongoing:ReturnType<typeof make>|undefined,unknown=false;
  function check(){if(unknown)return invalid();return origin();}
  function sameHold(hold:Hold){
   check();const op=ongoing;if(!op?.held||isProxy(hold)||byRef(hold)!==byRef(op.held))return invalid();return op;
  }
  const inspect=async(t:Ticket,body:OutputTx,readOnly:boolean):Promise<{tailRef:RuntimeRefV1|null;tail:string|null;rows:number;bytes:number}>=>{
   const s=t.session;let active=true,pending=0,open=false;
   const guard=()=>{const b=check();this.#check(s);if(!active||!t.live||s.profile!==b.profile||s.allocation!==b.allocation)invalid();};
   const io=guardFiles(this.#io,guard,()=>{pending++;},()=>{pending--;},s.path,s.stamp);
   const access:ProfileJournalAccess={transaction:async(channel,run)=>{
    guard();if(open||channel!=='sdk-session-output')invalid();open=true;return run(s.path,io);
   }};
   profileJournals.add(access);outputJournals.add(access);
   try{
    const store=new NormalStartFileStore(access,local);
    const end=await store.outputExclusive(async tx=>{
     guard();
     let verified:string[]|undefined;
     const result={read:async()=>{guard();const v=await tx.read();guard();verified=v.map(row=>contentHash(byRef(row)));return v;},
      appendAndSync:async(value:unknown)=>{guard();if(readOnly)invalid();await tx.appendAndSync(value);guard();}};
     await this.external(()=>body(Object.freeze(result)));guard();
     const rows=await tx.read();guard();if(!verified||verified.length!==rows.length)invalid();
     const scope=byRef(check().scope);let bytes=0,tailRef:RuntimeRefV1|null=null,index=0,tail:string|null=null;
     for(const row of rows){
      if(!recordV1(row,['ref','snapshot'])||!refV1(row.ref)||row.ref.contentHash!==contentHash(byRef(row.snapshot))||
       byRef(row.snapshot.scope)!==scope)invalid();
      const encoded=byRef(row);if(contentHash(encoded)!==verified![index++])invalid();
      bytes+=Buffer.byteLength(encoded)+1;tailRef=cloneV1(row.ref);tail=contentHash(encoded+'\n');
     }
     return {tailRef,tail,rows:rows.length,bytes};
    });
    guard();if(!open||pending||t.child||s.borrowed)invalid();return end;
   }finally{active=false;outputJournals.delete(access);profileJournals.delete(access);}
  };
  return Object.freeze({classify,
   reserve:async(request:Request)=>{
    const b=check(),sd=contentHash(byRef(b.scope));if(ongoing||this.#als.getStore()||request.scopeDigest!==sd||request.channel!=='SDK_SESSION_OUTPUT'||request.pool!=='NORMAL_EXECUTION')invalid();
    const op=make(cloneV1(request));ongoing=op;
    const phase:PhaseControls={guard:()=>{check();}};
    op.read=this.#root('NORMAL_EXECUTION',b.signal,async t=>{
     const s=t.session;if(s.profile!==b.profile||s.allocation!==b.allocation)invalid();
     const result=await this.#frame(s,'NORMAL_SPOOL_RESERVE',{...this.#auth(s),allocation:s.allocation,channel:'sdk-session-output',nodeStamp:s.stamp,
      request:op.req,scope:b.scope,expiresAt:new Date(Math.min(check().end,Date.parse(s.slot!.expiresAt))).toISOString()});
     if(recordV1(result,['state'])&&result.state==='CAPACITY_EXCEEDED')throw capacity;
     if(!recordV1(result,['id','requestDigest','normalUsed','normalHeldBefore','channelRows','channelBytes','channelHeldBytes','channelHeldRows','managementBytes'])||
        !uuidV1(result.id)||result.requestDigest!==contentHash(byRef(request)))invalid();
     const h=cloneV1(result) as Hold;op.held=h;op.stage='PRE';op.ready.resolve(cloneV1(h));
     const read=await op.pre.promise;check();
     const end=await inspect(t,read,true);
     if(end.bytes!==h.channelBytes||end.rows!==h.channelRows||byRef(end.tailRef)!==byRef(op.req.tailRef))invalid();
     phase.closeReservation=h.id;return {holdId:h.id,tailRef:end.tailRef,rows:end.rows};
    },phase).then(result=>{
     if(!phase.challenge||!op.held) return invalid();check();
     op.seal={reservation:op.held.id,challenge:phase.challenge,scopeDigest:sd,requestDigest:op.held.requestDigest};
     op.stage='WRITE';return result;
    }).catch(error=>{unknown=true;op.ready.reject(error);op.pre.reject(error);throw error;});
    void op.read.catch(()=>{});return op.ready.promise;
   },
   strictExclusive:async(hold:Hold,body:OutputTx)=>{
    const op=sameHold(hold);
    if(typeof body!=='function'||isProxy(body))return invalid();
    if(op.stage==='PRE'&&op.read){op.stage='READING';op.pre.resolve(body);return op.read;}
    if(op.stage!=='WRITE'||!op.seal)return invalid();op.stage='WRITING';
    const b=check(),resume=op.seal;op.seal=undefined;
    op.write=this.#root('NORMAL_EXECUTION',b.signal,async t=>{
     const s=t.session;if(s.profile!==b.profile||s.allocation!==b.allocation)invalid();
     const end=await inspect(t,body,false);check();
     op.stage='SETTLE';op.written.resolve({holdId:hold.id,tailRef:end.tailRef,rows:end.rows});
     const added=await op.post.promise;check();if(added!==end.bytes-hold.channelBytes||added<0||added>op.req.dataBytes||
       end.rows<hold.channelRows||end.rows-hold.channelRows>op.req.rows)invalid();
     const answer=await this.#frame(s,'NORMAL_SPOOL_SETTLE',{...this.#auth(s),allocation:s.allocation,channel:'sdk-session-output',reservation:hold.id});
     if(!recordV1(answer,['state','summary'])||answer.state!=='SETTLED'||!summary(answer.summary)||answer.summary.bytes!==end.bytes||answer.summary.count!==end.rows||answer.summary.tail!==end.tail)invalid();
     return {holdId:hold.id,dataBytes:added,managementBytes:hold.managementBytes};
    },{guard:()=>{check();},resume}).catch(error=>{unknown=true;op.post.reject(error);op.written.reject(error);throw error;});
    void op.write.catch(()=>{});return op.written.promise;
   },
   settle:async(hold:Hold,dataBytes:number)=>{
    const op=sameHold(hold);if(op.stage!=='SETTLE'||!op.write)return invalid();op.stage='SETTLING';op.post.resolve(dataBytes);
    const closed=await op.write;check();ongoing=undefined;return closed;
   }
  });
 }
 outputSource(worker:NormalStartWire,journal:NormalStartFileStore,sdk:WorkerSdkPorts,signal:AbortSignal):{source:NormalFirstSendSource;port:LiveInputPort}{
  const saved=this.#workers.get(worker),slot=this.external(this.#slot);
  if(this.#binding||!saved||saved.journal!==journal||!slot||!refV1(slot.receiptRef)||this.#owner.aborted||signal.aborted||
   isProxy(sdk)||!recordV1(sdk,['plannedSid','expiresAt','check','create','close','classify'])||
   [sdk.check,sdk.create,sdk.close,sdk.classify].some(fn=>typeof fn!=='function'||isProxy(fn)))return invalid();
  const fixed={...sdk},slotKey=byRef(slot),lifetime=AbortSignal.any([signal,this.#owner]);
  let binding:{profile:RuntimeRefV1;allocation:RuntimeRefV1}|undefined,origin:ReturnType<typeof takeFirstOutputOrigin>|undefined;
  const verify=()=>{
   if(lifetime.aborted||byRef(this.external(this.#slot))!==slotKey||sdk.check!==fixed.check||sdk.create!==fixed.create||
      sdk.close!==fixed.close||sdk.classify!==fixed.classify||sdk.plannedSid!==fixed.plannedSid||sdk.expiresAt!==fixed.expiresAt)invalid();
  };
  const storage=this.#outputPorts(saved.scope,()=>{
   verify();if(!origin||!binding||origin.signal.aborted)return invalid();
   const end=this.external(origin.check);
   return {scope:origin.scope,signal:origin.signal,end,profile:binding.profile.id,allocation:binding.allocation.id};
  },raw=>this.external(()=>Reflect.apply(fixed.classify,sdk,[raw])));
  // These two fields are populated only by the verified native allocation, before the first protected START completes.
  let inputStream:ReturnType<typeof workerInput>|undefined,query:AsyncIterable<unknown>|undefined;
  const core={storage,plannedSid:sdk.plannedSid,expiresAt:sdk.expiresAt,ownerSignal:lifetime,slotRef:cloneV1(slot.receiptRef),
   clock:()=>{verify();return this.#clock();},
   check:(scope:Parameters<NormalFirstSendSource['check']>[0])=>{verify();return this.external(()=>Reflect.apply(fixed.check,sdk,[scope]));},
   create:(...args:Parameters<NormalFirstSendSource['create']>)=>{
    verify();if(inputStream)invalid();
    const [request,first,life]=args;
    const active=workerInput(first,life,()=>{verify();if(origin)this.external(origin.check);});inputStream=active;
    try{
     const result=this.external(()=>Reflect.apply(fixed.create,sdk,[request,active.stream,life]));
     if(isProxy(result)||!isPromise(result))invalid();
     return new Promise<AsyncIterable<unknown>>((accept,reject)=>Reflect.apply(Promise.prototype.then,result,[
      (original:AsyncIterable<unknown>)=>{query=original;accept(original);},(error:unknown)=>{active.close();reject(error);}
     ]));
    }catch(error){active.close();throw error;}
   },
   close:(...args:Parameters<NormalFirstSendSource['close']>)=>this.external(()=>Reflect.apply(fixed.close,sdk,args))};
  const source=core as NormalFirstSendSource;this.#foreground=signal;
  this.#binding={update:(profile,allocation)=>{
   verify();if(binding){if(byRef(profile)!==byRef(binding.profile)||byRef(allocation)!==byRef(binding.allocation))invalid();return;}
   binding={profile,allocation};source.profileRef=cloneV1(profile);source.assignmentRef=cloneV1(allocation);Object.freeze(source);
  }};
  outputBinders.set(storage,proof=>{
   outputBinders.delete(storage);
   verify();const original=takeFirstOutputOrigin(proof,storage,worker),s=original.scope;
   if(!binding||byRef(s.registrationRef)!==byRef(saved.registration)||byRef(s.grantRef)!==byRef(saved.grant)||byRef(s.slotRef)!==byRef(slot.receiptRef)||
    byRef(s.profileRef)!==byRef(binding.profile)||byRef(s.assignmentRef)!==byRef(binding.allocation)||s.projectId!==saved.scope.projectId||
    s.executionId!==saved.scope.executionId||s.generation!==saved.scope.executionGeneration)invalid();
   origin=original;
  });
  const port:LiveInputPort=Object.freeze({provide:(original,input,signal)=>{
   if(!inputStream||!query||original!==query||!origin||origin.signal.aborted)return Promise.reject(Error('NORMAL_WORKER_INPUT_UNAVAILABLE'));
   return inputStream.provide(input,signal,()=>confirmNormalLiveInputDelivery(input,worker,original,port));
  }});
  return {source,port};
 }
 receive(limits:InboxLimits,input:unknown,expected:Parameters<typeof receiveProfiledEnvelope>[3],signal:AbortSignal){
  return this.#transaction('UNVERIFIED_RECEIPT_INBOX','inbox',signal,async(path,io)=>{
   const receipt=await receiveProfiledEnvelope(path,limits,input,expected,this.#clock(),io);
   if(receipt.state==='UNKNOWN')invalid();return receipt;
  });
 }
}

// Track actual pending Node I/O. After loss, closing a previously obtained handle is the only new operation allowed.
function guardFiles(raw:IO,check:Guard,begin:Guard,end:Guard,root:string,stamp:string):IO{
 const keys=['lstat','realpath','open','readdir','opendir','unlink'] as const;
 const captured=keys.map(k=>raw[k]);
 const method=<K extends typeof keys[number]>(k:K):IO[K]=>{
  check();const fn=raw[k];if(typeof fn!=='function'||isProxy(fn)||fn!==captured[keys.indexOf(k)])invalid();return fn;
 };
 const guarded=async<T>(fn:()=>Promise<T>,late?:(v:T)=>Promise<void>)=>{
  check();begin();try{const v=await fn();try{check();}catch(e){if(late)await late(v);throw e;}return v;}finally{end();}
 };
 const wrap=<T extends object>(handle:T,methods:readonly string[])=>{
  const exposed:Record<string|symbol,unknown>={};
  for(const key of methods){
   const method:unknown=Reflect.get(handle,key);
   if(method===undefined)continue;
   if(typeof method!=='function'||isProxy(method))invalid();
   exposed[key]=key==='close'?async()=>{begin();try{return await Reflect.apply(method,handle,[]);}finally{end();}}:
    (...args:unknown[])=>guarded(async()=>Reflect.apply(method,handle,args));
  }
  return exposed;
 };
 const sync=raw.unlinkSync;
 const io={
  lstat:(...a:Parameters<IO['lstat']>)=>guarded(async()=>{
   const st=await Reflect.apply(method('lstat'),raw,a);
   if(a[0]===root&&!st.isSymbolicLink()&&String(st.dev)+':'+String(st.ino)!==stamp)invalid();return st;
  }),
  readdir:(...a:Parameters<IO['readdir']>)=>guarded(()=>Reflect.apply(method('readdir'),raw,a)),
  realpath:(...a:Parameters<IO['realpath']>)=>guarded(()=>Reflect.apply(method('realpath'),raw,a)),
  unlink:(...a:Parameters<IO['unlink']>)=>guarded(()=>Reflect.apply(method('unlink'),raw,a)),
  open:async(...a:Parameters<IO['open']>)=>{
   const f=await guarded(()=>Reflect.apply(method('open'),raw,a),v=>v.close());return wrap(f,['stat','read','writeFile','sync','close']);
  },
  opendir:async(...a:Parameters<IO['opendir']>)=>{
   const d=await guarded(()=>Reflect.apply(method('opendir'),raw,a),v=>v.close()),view=wrap(d,['close']);
   view[Symbol.asyncIterator]=()=>{check();const it=d[Symbol.asyncIterator]();return {next:()=>guarded(()=>it.next())};};return view;
  },
  ...(typeof sync==='function'&&!isProxy(sync)?{unlinkSync:(path:string)=>{check();if(raw.unlinkSync!==sync)invalid();return Reflect.apply(sync,raw,[path]);}}:{}),
 };
 // FileHandle/Dir expose more methods in Node's types; these private views implement only the operations of the two stores.
 return io as unknown as IO;
}
