import {performance} from 'node:perf_hooks';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';

/** 호출자가 이미 소유한 합성 duplex만 사용한다. 장치 열기/프로세스 시작/재접속 경로는 없다. */
export interface SyntheticPrimaryDuplexIO {
  write(chunk:Uint8Array,signal:AbortSignal):Promise<number>;
  read(signal:AbortSignal):Promise<Uint8Array|null>;
  close():void;
}
const MAX_BYTES=2*1024*1024;
const LF=10, CR=13;
const fail=():never=>{throw Error('PRIMARY_DUPLEX_UNKNOWN');};
function message(frame:Uint8Array,max:number):Record<string,unknown>{
  const body=frame.at(-1)===CR?frame.subarray(0,-1):frame;
  if(!body.length||body.length>max)throw Error();
  const value=parseWireJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body));
  if(value===null||typeof value!=='object'||Array.isArray(value))throw Error();
  return value as Record<string,unknown>;
}

/** exchange는 프레이밍과 응답 ID만 대조한다. schema 검사·codec.push·journal은 기존 transport 소유다. */
export class SyntheticPrimaryDuplexWire {
  readonly transport='SYNTHETIC_ONLY' as const;
  #io:SyntheticPrimaryDuplexIO;
  #max:number;
  #timeout:number;
  #used=new Set<string>();
  #active:AbortController|null=null;
  #closed=false;
  #tail=new Uint8Array(0);
  constructor(io:SyntheticPrimaryDuplexIO,options:{maxFrameBytes:number;timeoutMs:number}){
    if(!io||typeof io.write!=='function'||typeof io.read!=='function'||typeof io.close!=='function'
      ||!Number.isSafeInteger(options?.maxFrameBytes)||options.maxFrameBytes<1||options.maxFrameBytes>MAX_BYTES
      ||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10000)
      throw Error('PRIMARY_DUPLEX_CONFIG_INVALID');
    this.#io=io;this.#max=options.maxFrameBytes;this.#timeout=options.timeoutMs;
  }
  close():void{
    if(this.#closed)return;
    this.#closed=true;this.#active?.abort();this.#tail.fill(0);this.#tail=new Uint8Array(0);this.#used.clear();
    try{void Promise.resolve(this.#io.close()).catch(()=>{});}catch{/* 닫힌 채널을 재사용하지 않는다. */}
  }
  async exchange(input:Uint8Array,signal:AbortSignal):Promise<Uint8Array>{
    if(this.#closed)throw Error('PRIMARY_DUPLEX_CLOSED');
    if(this.#active)throw Error('PRIMARY_DUPLEX_BUSY');
    if(!(signal instanceof AbortSignal)||signal.aborted||!(input instanceof Uint8Array)
      ||input.byteLength<2||input.byteLength>Math.min(MAX_BYTES,this.#max+2))throw Error('PRIMARY_DUPLEX_INPUT_INVALID');
    const bytes=new Uint8Array(input);let id:string|number,digest:string;
    try{
      if(bytes.indexOf(LF)!==bytes.length-1)throw Error();
      const q=message(bytes.subarray(0,-1),this.#max);
      if(typeof q.method!=='string'||!q.method||Object.hasOwn(q,'result')||Object.hasOwn(q,'error')
        ||!(typeof q.id==='string'||(typeof q.id==='number'&&Number.isSafeInteger(q.id))))throw Error();
      id=q.id as string|number;digest=contentHash(canonicalJson(id));
      if(this.#used.has(digest)||this.#used.size>=1024)throw Error();
    }catch{bytes.fill(0);throw Error('PRIMARY_DUPLEX_INPUT_INVALID');}

    const active=new AbortController();this.#active=active;
    const abort=()=>active.abort(),deadline=performance.now()+this.#timeout;
    let rejectAbort!:()=>void;
    const aborted=new Promise<never>((_,reject)=>{rejectAbort=()=>reject(Error('PRIMARY_DUPLEX_UNKNOWN'));});
    active.signal.addEventListener('abort',rejectAbort,{once:true});
    signal.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(abort,this.#timeout);
    const check=()=>{if(active.signal.aborted||performance.now()>=deadline)fail();};
    let scratch=new Uint8Array(Math.min(MAX_BYTES,Math.max(256,this.#tail.length)));
    const pump=async()=>{
      for(let sent=0;sent<bytes.length;){
        check();const remaining=bytes.subarray(sent);
        const n=await this.#io.write(remaining,active.signal);check();
        if(!Number.isSafeInteger(n)||n<1||n>remaining.length)fail();sent+=n;
      }
      let end=this.#tail.length,start=0,carried=end>0;
      scratch.set(this.#tail);this.#tail.fill(0);this.#tail=new Uint8Array(0);
      for(;;){
        check();const chunk=await this.#io.read(active.signal);check();
        if(!(chunk instanceof Uint8Array)||!chunk.length||chunk.byteLength>MAX_BYTES-end)return fail();
        const before=end;end+=chunk.length;
        if(end>scratch.length){
          const larger=new Uint8Array(Math.min(MAX_BYTES,Math.max(end,scratch.length*2)));
          larger.set(scratch);scratch.fill(0);scratch=larger;
        }
        scratch.set(chunk,before);
        let matched=false;
        for(let i=before;i<end;i++){
          if(scratch[i]!==LF){
            if(i-start>=this.#max&&(i-start>this.#max||scratch[i]!==CR))fail();
            continue;
          }
          const value=message(scratch.subarray(start,i),this.#max);check();
          const result=Object.hasOwn(value,'result'),error=Object.hasOwn(value,'error');
          if(result||error){
            // 이전 요청 중 이미 도착한 부분 프레임은 새 요청에 대한 응답이 될 수 없다.
            if(carried||matched||result===error||value.id!==id||Object.hasOwn(value,'method'))fail();
            matched=true;
          }else if(typeof value.method!=='string'||!value.method)fail();
          start=i+1;carried=false;
        }
        if(matched){
          check();this.#tail=scratch.slice(start,end);return scratch.slice(0,start);
        }
      }
    };
    try{
      this.#used.add(digest);
      const out=await Promise.race([aborted,pump()]);
      if(active.signal.aborted||performance.now()>=deadline){out.fill(0);return fail();}
      return out;
    }catch{this.close();return fail();}
    finally{
      clearTimeout(timer);signal.removeEventListener('abort',abort);active.signal.removeEventListener('abort',rejectAbort);
      bytes.fill(0);scratch.fill(0);this.#active=null;
    }
  }
}
