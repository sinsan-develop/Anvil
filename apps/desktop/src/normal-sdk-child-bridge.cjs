'use strict';
const {MessagePort}=require('node:worker_threads');
const {EventEmitter}=require('node:events');
const {Readable,Writable}=require('node:stream');
const {types}=require('node:util');
const {createHash}=require('node:crypto');

const chunkLimit=65536;
const pendingLimit=2*1024*1024;
const lifeLimit=256*1024*1024;
const unknown=()=>Error('SDK_CHILD_UNKNOWN');
/** @param {object} prototype @param {string} key */
function getter(prototype,key){
  const get=Object.getOwnPropertyDescriptor(prototype,key)?.get;
  if(typeof get!=='function')throw unknown();
  return get;
}
const typed=Object.getPrototypeOf(Uint8Array.prototype);
const byteLength=getter(typed,'byteLength'),byteOffset=getter(typed,'byteOffset'),viewBuffer=getter(typed,'buffer');
const backingLength=getter(ArrayBuffer.prototype,'byteLength'),signalState=getter(AbortSignal.prototype,'aborted');
const addListener=EventTarget.prototype.addEventListener,removeListener=EventTarget.prototype.removeEventListener;
/** @param {AbortSignal} s */
function aborted(s){
  if(!s||types.isProxy(s)||Object.getPrototypeOf(s)!==AbortSignal.prototype||
      ['aborted','addEventListener','removeEventListener'].some(key=>Object.hasOwn(s,key)))throw unknown();
  try{return Reflect.apply(signalState,s,[]);}catch{throw unknown();}
}

/** 전용 원자식 파이프의 스트림. 생성 권위는 보유하지 않는다.
 * @param {MessagePort} port @param {AbortSignal} signal @param {(name:string)=>boolean} stopOriginal
 */
function createChildStreams(port,signal,stopOriginal) {
  if (types.isProxy(port)||!(port instanceof MessagePort) || aborted(signal)) throw unknown();
  const events=new EventEmitter();
  events.on('error',()=>{});
  let dead=false,ended=false,credit=false,killed=false;
  /** @type {number|null} */ let exitCode=null;
  /** @type {string|null} */ let signalCode=null;
  let nextInput=0,nextOutput=0,reserved=0,total=0,eof=false;
  /** @typedef {{size:number,closed:boolean,cb:(e?:Error|null)=>void}} Ticket */
  /** @type {Set<Ticket>} */const writes=new Set();
  /** @type {{bytes:Buffer,offset:number,done:(e?:Error|null)=>void}|null} */let active=null;
  /** @param {Ticket} item @param {Error|null} e */
  function finish(item,e) {
    if (item.closed) return;
    item.closed=true;
    writes.delete(item);
    reserved-=item.size;
    queueMicrotask(()=>item.cb(e));
  }
  function fail() {
    if (dead) return;
    dead=true;
    const err=unknown();
    try {port.postMessage({op:'ABANDON'});} catch {}
    const a=active;
    active=null;
    for(const item of writes) finish(item,err);
    if(a)a.done(err);
    stdin.destroy(err);stdout.destroy(err);
    Reflect.apply(removeListener,signal,['abort',fail]);
    port.close();events.emit('error',err);
  }
  function sendChunk() {
    if (!active || dead) return;
    const start=active.offset;
    const bytes=new Uint8Array(Math.min(chunkLimit,active.bytes.length-start));
    bytes.set(active.bytes.subarray(start,start+bytes.length));
    active.offset+=bytes.length;
    try{port.postMessage({op:'STDIN',seq:++nextInput,bytes},[bytes.buffer]);}catch{fail();}
  }
  const stdin=new Writable({highWaterMark:chunkLimit,write(bytes,_encoding,done){
    if(dead||ended||active){done(unknown());return;}
    if(!bytes.length){done();return;}
    active={bytes,offset:0,done};sendChunk();
  },final(done){if(dead){done(unknown());return;}try{port.postMessage({op:'STDIN_EOF',seq:nextInput});done();}catch{done(unknown());fail();}}});
  stdin.on('error',()=>{});
  const rawWrite=stdin.write;
  /** @param {unknown} data @param {BufferEncoding|((e?:Error|null)=>void)} [encoding] @param {(e?:Error|null)=>void} [callback] */
  function writeOwned(data,encoding,callback) {
    const cb=typeof encoding==='function'?encoding:callback;
    const enc=typeof encoding==='string'?encoding:'utf8';
    const size=typeof data==='string'&&Buffer.isEncoding(enc)?Buffer.byteLength(data,enc):
      !types.isProxy(data)&&types.isUint8Array(data)?Reflect.apply(byteLength,data,[]):-1;
    if(size<0||dead||ended||stdin.writableEnded||size>pendingLimit-reserved||
       size>lifeLimit-total||writes.size>=pendingLimit/chunkLimit){
      fail();if(cb)queueMicrotask(()=>cb(unknown()));return false;
    }
    reserved+=size;total+=size;
    const ticket={size,closed:false,cb:cb??(()=>{})};writes.add(ticket);
    try {
      const owned=typeof data==='string'?Buffer.from(data,enc):new Uint8Array(size);
      if(typeof data!=='string'){
        if(!types.isUint8Array(data)||Reflect.apply(byteLength,data,[])!==size){fail();return false;}
        owned.set(data);
      }
      if(owned.byteLength!==size){fail();return false;}
      return Reflect.apply(rawWrite,stdin,[owned,/** @param {Error|null|undefined} error */error=>finish(ticket,error??null)]);
    } catch { fail();return false; }
  }
  stdin.write=writeOwned;
  const rawEnd=stdin.end;
  /** @param {unknown} [data] @param {BufferEncoding|(()=>void)} [encoding] @param {()=>void} [cb] */
  function endOwned(data,encoding,cb) {
    if(typeof data==='function') cb=()=>Reflect.apply(data,undefined,[]);
    else if(typeof encoding==='function') cb=encoding;
    if(data!==undefined&&data!==null&&typeof data!=='function'){
      if(typeof encoding==='string')stdin.write(data,encoding);else stdin.write(data);
    }
    return Reflect.apply(rawEnd,stdin,typeof cb==='function'?[cb]:[]);
  }
  stdin.end=endOwned;
  // 정지된 reader에서는 짧은 DATA 하나도 high-water mark에 닿는다.
  const stdout=new Readable({highWaterMark:1,read(){
    if(!dead&&!ended&&!eof&&!credit){credit=true;try{port.postMessage({op:'STDOUT_CREDIT',seq:nextOutput+1});}catch{fail();}}
  }});
  stdout.on('error',()=>{});
  port.on('message',message=>{
    if(dead||ended)return;
    try{
      switch(message?.op){
      case 'STDIN_ACK': {
        if(!active||message.seq!==nextInput)return fail();
        if(active.offset<active.bytes.length)sendChunk();
        else{const done=active.done;active=null;done();}
        break;
      }
      case 'STDOUT':{
        const bytes=message.bytes;
        if(!credit||eof||message.seq!==nextOutput+1||types.isProxy(bytes)||!types.isUint8Array(bytes))return fail();
        const size=Reflect.apply(byteLength,bytes,[]),backing=Reflect.apply(viewBuffer,bytes,[]);
        if(size<1||size>chunkLimit||size>lifeLimit-total||!types.isArrayBuffer(backing)||
           Reflect.apply(byteOffset,bytes,[])!==0||Reflect.apply(backingLength,backing,[])!==size)return fail();
        credit=false;nextOutput++;total+=size;stdout.push(Buffer.from(backing));break;
      }
      case 'STDOUT_EOF':
        if(eof||message.seq!==nextOutput)return fail();
        eof=true;credit=false;stdout.push(null);break;
      case 'EXIT':
        if(!eof||active||writes.size||!Number.isInteger(message.code)||message.code<0||message.code>0xffffffff)return fail();
        ended=true;exitCode=message.code;
        Reflect.apply(removeListener,signal,['abort',fail]);port.close();events.emit('exit',exitCode,signalCode);break;
      default: fail();
      }
    }catch{fail();}
  });
  port.once('close',()=>{if(!ended)fail();});port.on('messageerror',fail);
  Reflect.apply(addListener,signal,['abort',fail,{once:true}]);
  return Object.freeze({stdin,stdout,get killed(){return killed;},get exitCode(){return exitCode;},
    get signalCode(){return signalCode;},
    /** @param {string} [name] */kill(name='SIGTERM'){
      if(dead||ended||killed||name!=='SIGTERM')return false;
      try {
        const accepted=stopOriginal(name);
        if(typeof accepted!=='boolean'){fail();return false;}
        if(accepted)killed=true;
        return accepted;
      } catch {fail();return false;}
    },
    on:events.on.bind(events),once:events.once.bind(events),off:events.off.bind(events)});
}
/** SDK worker 한 곳에서 동기 hook을 호출할 때 사용한다. broker/renderer에서는 대기하지 않는다.
 * @param {MessagePort} control @param {MessagePort} data @param {AbortSignal} lifetime
 * @param {number} expiresAt @param {number} monotonicEnd
 */
function createSynchronousSpawn(control,data,lifetime,expiresAt,monotonicEnd) {
  const {isMainThread}=require('node:worker_threads');
  if(isMainThread||types.isProxy(control)||types.isProxy(data)||!(control instanceof MessagePort)||!(data instanceof MessagePort)||control===data||
      aborted(lifetime)||!Number.isSafeInteger(expiresAt)||!Number.isFinite(monotonicEnd))throw unknown();
  let used=false,stopped=false,abandoned=false;
  function abandon() {
    if(abandoned)return;
    abandoned=true;
    try{control.postMessage({op:'ABANDON'});}catch{}
  }
  /** @param {'SPAWN'|'STOP'} op @param {string|null} payload */
  function accept(op,payload){
    const cell=new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    const left=()=>Math.floor(Math.min(expiresAt-Date.now(),monotonicEnd-performance.now()));
    if(left()<1||aborted(lifetime))throw unknown();
    control.postMessage({op,payload,cell:cell.buffer});
    for (;;) {
      const state=Atomics.load(cell,0),ms=left();
      if(ms<1||aborted(lifetime)||state<0){
        Atomics.compareExchange(cell,0,0,-1);
        abandon();throw unknown();
      }
      if(state===1)return true;
      if(state!==0)throw unknown();
      Atomics.wait(cell,0,0,ms);
    }
  }
  /** @param {{command:string,args:string[],cwd?:string,env:Record<string,string|undefined>,signal:AbortSignal}} spec */
  return function spawnOriginalChild(spec) {
    if(used||aborted(lifetime))throw unknown();
    used=true;
    if(!spec||types.isProxy(spec)||Object.getPrototypeOf(spec)!==Object.prototype)throw unknown();
    const keys=Reflect.ownKeys(spec);
    if(keys.length!==5||!['signal','command','args','env','cwd'].every(k=>keys.includes(k)))throw unknown();
    /** @param {object} obj @param {string} key */
    const field=(obj,key)=>{
      const d=Object.getOwnPropertyDescriptor(obj,key);
      if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw unknown();
      return d.value;
    };
    const originalSignal=field(spec,'signal');
    if(aborted(originalSignal))throw unknown();
    const signal=AbortSignal.any([lifetime,originalSignal]);
    // 비교용 관측 지문만 전송한다. native가 원 구성과 독립 대조해야 한다.
    const digest=createHash('sha256');let count=0;
    /** @param {unknown} value */
    const put=value=>{
      if(typeof value!=='string'||value.length>chunkLimit||!value.isWellFormed()||value.includes('\0'))throw unknown();
      const n=Buffer.byteLength(value),prefix=String(n)+':';
      if((count+=n+prefix.length)>chunkLimit)throw unknown();
      digest.update(prefix).update(value);
    };
    put('SDK_HOOK_OBSERVED_V1');put(field(spec,'command'));put(field(spec,'cwd'));
    const args=field(spec,'args'),env=field(spec,'env');
    if(!Array.isArray(args)||types.isProxy(args)||args.length>chunkLimit||Reflect.ownKeys(args).length!==args.length+1||
       !env||typeof env!=='object'||types.isProxy(env)||![Object.prototype,null].includes(Object.getPrototypeOf(env)))throw unknown();
    put(String(args.length));for(let i=0;i<args.length;i++)put(field(args,String(i)));
    const names=Reflect.ownKeys(env);if(names.length>chunkLimit||names.some(k=>typeof k!=='string'))throw unknown();
    put(String(names.length));
    for(const key of names.sort()){
      if(typeof key!=='string')throw unknown();
      put(key);put(field(env,key));
    }
    Reflect.apply(addListener,signal,['abort',abandon,{once:true}]);
    try{
      accept('SPAWN',digest.digest('hex'));
      if(aborted(signal))throw unknown();
      const streams=createChildStreams(data,signal,()=>{
        if(stopped)return false;stopped=true;return accept('STOP',null);
      });
      const detach=()=>Reflect.apply(removeListener,signal,['abort',abandon]);
      streams.once('exit',detach);
      streams.once('error',()=>{detach();abandon();});
      return streams;
    }catch(error){Reflect.apply(removeListener,signal,['abort',abandon]);abandon();throw error;}
  };
}
module.exports={createChildStreams,createSynchronousSpawn};
