import {AsyncLocalStorage} from 'node:async_hooks';
import * as fs from 'node:fs/promises';
import {unlinkSync} from 'node:fs';
import {basename,resolve,isAbsolute} from 'node:path';
import {isProxy} from 'node:util/types';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {recordV1,uuidV1,hashV1} from '../../../contracts/runtime/validation-v1.ts';
import type {NormalOwnedHostFactory,NormalOwnedHostSession,NormalOwnedMetadata,HostCloseDisposition} from './normal-credential-bootstrap-client.ts';
import {isOwnedSpoolPath,NormalStartFileStore,type NormalFilePorts,type NormalLocalScope,type ProfileJournalAccess} from './normal-start-file-store.ts';
import {NormalStartIntake,type NormalStartStore} from './normal-start-intake.ts';
import {NormalClaudeStartWire} from '../adapters/secondary/normal-start-wire.ts';
import type {NormalStartCurrent} from './normal-start-coordinator.ts';
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
const profileJournals=new WeakSet<ProfileJournalAccess>();
const profileReceipts=new WeakMap<InboxFilePorts,string>();
export function isProfileJournal(access:ProfileJournalAccess){return profileJournals.has(access);}
export function isProfileReceipt(ports:InboxFilePorts,path:string){return profileReceipts.get(ports)===path;}
export function outsideOwnedSpoolCallback<T>(call:()=>T):T{return tickets.exit(call);}
function summary(value:unknown){return recordV1(value,['count','bytes','tail'])&&Number.isSafeInteger(value.count)&&Number.isSafeInteger(value.bytes)&&value.count>=0&&value.count<=10000&&value.bytes>=0&&(value.count===0?value.bytes===0&&value.tail===null:value.bytes>0&&hashV1(value.tail));}
const pathEqual=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

// Only application source uses this class. The desktop bundle exports a purpose factory, not this store or its host.
export class OwnedSpoolRuntime {
 readonly #als=tickets;
 readonly #workerReads=new WeakMap<NormalStartFileStore,NormalStartStore>();
 #session?:Session;#opening=false;#unknown=false;
 readonly #host:NormalOwnedHostFactory;readonly #open:NormalOwnedHostFactory['open'];readonly #io:IO;
 readonly #attempt:string;readonly #now:()=>number;readonly #owner:AbortSignal;
 readonly #slot:()=>NormalOwnedMetadata|null;
 constructor(host:NormalOwnedHostFactory,attempt:string,now:()=>number,owner:AbortSignal,slot:()=>NormalOwnedMetadata|null,io?:IO){
  if(!host||typeof host.open!=='function'||!uuidV1(attempt)||!(owner instanceof AbortSignal))invalid('NORMAL_SPOOL_UNSUPPORTED');
  this.#host=host;this.#open=host.open;this.#attempt=attempt;this.#now=now;this.#owner=owner;this.#slot=slot;this.#io=io??defaultIO;
 }
 external<T>(call:()=>T):T{return this.#als.exit(call);}
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
   if(!t){if(this.#unknown||this.#owner.aborted||this.#opening||this.#session)invalid('NORMAL_OWNED_BUSY');return this.external(()=>Reflect.apply(this.#open,this.#host,[signal]));}
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
 async #root<T>(writer:Writer,signal:AbortSignal,body:(t:Ticket)=>Promise<T>):Promise<T>{
  const parent=this.#als.getStore();
  if(parent){
   this.#check(parent.session);if(!parent.live||parent.child||parent.session.borrowed||parent.session.writer!==writer||parent.session.signal!==signal)invalid('NORMAL_OWNED_BUSY');
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
   const a=await this.#frame(s,state.allocated?'NORMAL_SPOOL_RESUME':'NORMAL_SPOOL_ALLOCATE',auth);
   if(!recordV1(a,['state','profileId','allocation','root','directoryIdentity'])||a.state!==(state.allocated?'RESUMED':'ALLOCATED')||
      a.profileId!==state.profileId||!uuidV1(a.allocation)||typeof a.directoryIdentity!=='string'||!a.directoryIdentity||
      typeof a.root!=='string'||!isAbsolute(a.root)||!pathEqual(a.root,resolve(a.root))||!isOwnedSpoolPath(a.root)||basename(a.root)!=='data-'+a.allocation)invalid();
   s.profile=a.profileId;s.allocation=a.allocation;s.path=a.root;
   const path=s.path,st=await this.#bounded(s,()=>this.#io.lstat(path));this.#check(s);
   if(!st.isDirectory()||st.isSymbolicLink()||!pathEqual(await this.#bounded(s,()=>this.#io.realpath(path)),path))invalid();
   s.stamp=String(st.dev)+':'+String(st.ino);this.#check(s);
   const t={session:s,live:true,child:false};let result:T;
   let denied=false;
   try{result=await this.#bounded(s,()=>this.#als.run(t,()=>body(t)));this.#check(s);if(t.child||s.borrowed)invalid();}catch(error){if(error!==capacity)throw error;denied=true;}finally{t.live=false;}
   const closed=await this.#frame(s,'NORMAL_SPOOL_CLOSE',{...auth,allocation:s.allocation});
   if(!recordV1(closed,['state'])||closed.state!=='CLOSED_CONFIRMED')invalid();
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
  return NormalClaudeStartWire.forWorker({intake,current,grantRef,clock,timeoutMs});
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
