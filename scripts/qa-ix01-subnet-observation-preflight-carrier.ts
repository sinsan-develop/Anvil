import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {types} from 'node:util';
import {parseWireJson} from '../contracts/canonical.ts';
import {readSubnetCompletionBinding} from './qa-ix01-subnet-observation-remote.ts';
import type {SubnetCollectionClock} from './qa-ix01-subnet-observation-supervisor.ts';
export {buildSubnetPreflightBundle,SUBNET_PREFLIGHT_BUNDLE_HASH} from './qa-ix01-subnet-observation-bundle.ts';
const helperHash='e1228af0d86c599de9dd8439c809667b68f6bed842df304d12178746e525a8f4';
const bundleHash='e79a0b34931921e6bfba34edd866b32a45f38b29d73e6eb0bb9b2d1fc6f49ba8',bundleLength=54437;
const locations=['USR_BIN','USR_SBIN','BIN','SBIN'];
const hash=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const unknown=Object.freeze({status:'UNKNOWN',code:'PREFLIGHT_UNCONFIRMED'} as const);
const ap=Object.getPrototypeOf(Uint8Array.prototype),length=Object.getOwnPropertyDescriptor(ap,'byteLength')!.get!,backing=Object.getOwnPropertyDescriptor(ap,'buffer')!.get!;
function fail():never{throw new Error('PREFLIGHT_INVALID');}
function fields(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==keys.length)return fail();
 const out:Record<string,unknown>=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return fail();out[key]=d.value;}return out;
}
function copy(v:unknown,max:number){if(types.isProxy(v)||!types.isUint8Array(v)||types.isSharedArrayBuffer(backing.call(v)))return fail();const n=length.call(v);if(n>max)return fail();const b=new Uint8Array(n);Uint8Array.prototype.set.call(b,v);return b;}
export function readSubnetPreflightInput(input:unknown){
 const v=fields(input,['proof','window','location']),p=fields(v.proof,['attemptId','helperHash','approvalHash']);
 const b=readSubnetCompletionBinding({attemptId:p.attemptId,bundleHash:p.helperHash,approvalHash:p.approvalHash},v.window);
 if(p.helperHash!==helperHash||typeof v.location!=='string'||!locations.includes(v.location))return fail();
 return Object.freeze({proof:Object.freeze({attemptId:b.proof.attemptId,helperHash,approvalHash:b.proof.approvalHash}),window:b.window,location:v.location});
}
export function readSubnetIpMeasurement(line:unknown,input:unknown,startedAt:number,completedAt:number){
 const expected=readSubnetPreflightInput(input);
 if(typeof line!=='string'||Buffer.byteLength(line)>4096||!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(completedAt)
  ||startedAt<expected.window.issuedAt||completedAt<startedAt||completedAt>=expected.window.expiresAt||completedAt-startedAt>=10000)return fail();
 const r=fields(parseWireJson(line),['schemaVersion','purpose','basis','attemptId','helperHash','approvalHash','issuedAt','expiresAt','measuredAt','location','measurement']);
 if(line!==JSON.stringify(r)+'\n'||r.schemaVersion!==1||r.purpose!=='IX01_SUBNET_IP_MEASUREMENT'||r.basis!=='FIXED_NODE_PATH_METADATA'
  ||Object.entries(expected.proof).some(([k,v])=>r[k]!==v)||r.issuedAt!==expected.window.issuedAt||r.expiresAt!==expected.window.expiresAt||r.location!==expected.location
  ||typeof r.measuredAt!=='number'||!Number.isSafeInteger(r.measuredAt)||r.measuredAt<expected.window.issuedAt||r.measuredAt>=expected.window.expiresAt)return fail();
 const m=fields(r.measurement,['sha256','bytes','metadata']),meta=fields(m.metadata,['kind','dev','ino','uid','gid','mode','nlink','size','rdev','mtimeNs','ctimeNs']);
 if(typeof m.sha256!=='string'||!/^[a-f0-9]{64}$/.test(m.sha256)||typeof m.bytes!=='number'||!Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>160*1024*1024||m.bytes!==meta.size
  ||meta.kind!=='file'||meta.uid!==0||meta.nlink!==1||typeof meta.mode!=='number'||!Number.isSafeInteger(meta.mode)||meta.mode<0||(meta.mode&0o7777)!==0o755
  ||typeof meta.gid!=='number'||!Number.isSafeInteger(meta.gid)||meta.gid<0)return fail();
 for(const k of ['dev','ino','rdev','mtimeNs','ctimeNs'])if(typeof meta[k]!=='string'||!/^\d{1,30}$/.test(meta[k] as string))return fail();
 // dev/ino 등은 두 SSH 사이의 원자적 pin을 뜻하지 않는다. 다음 host는 이 SHA 및 현재 신원을 재검산한다.
 return Object.freeze({location:expected.location,sha256:m.sha256});
}
const wrapper=String.raw`
import {createHash as h} from 'node:crypto';
let line='{"code":"UNKNOWN"}\n',ok=false,raw,input;
try{
 const fail=()=>{throw null;},digest=b=>h('sha256').update(b).digest('hex');
 const decode=(s,max)=>{if(typeof s!=='string'||s.length>Math.ceil(max/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))fail();const b=Buffer.from(s,'base64');if(b.length>max||b.toString('base64')!==s)fail();return b;};
 raw=decode(metaBundle,54437);input=decode(metaInput,1024);
 if(raw.length!==54437||digest(raw)!=='e79a0b34931921e6bfba34edd866b32a45f38b29d73e6eb0bb9b2d1fc6f49ba8'||digest(input)!==metaInputHash)fail();
 const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();return v;};
 const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}),text=decoder.decode(input),q=exact(JSON.parse(text),['proof','window','location']);if(JSON.stringify(q)!==text)fail();
 const p=exact(q.proof,['attemptId','helperHash','approvalHash']),w=exact(q.window,['issuedAt','expiresAt']);
 if(typeof p.attemptId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.attemptId)||p.helperHash!=='e1228af0d86c599de9dd8439c809667b68f6bed842df304d12178746e525a8f4'||typeof p.approvalHash!=='string'||!/^[a-f0-9]{64}$/.test(p.approvalHash)||!['USR_BIN','USR_SBIN','BIN','SBIN'].includes(q.location))fail();
 if(!Number.isSafeInteger(w.issuedAt)||!Number.isSafeInteger(w.expiresAt)||w.issuedAt<=0||w.expiresAt<=w.issuedAt||w.expiresAt-w.issuedAt>60000)fail();
 const names=['node:util','node:child_process','node:crypto','node:fs','node:os','node:perf_hooks','node:net','node:events'],modules=Object.create(null);
 for(const name of names)modules[name]=await import(name);
 const require=name=>{if(!Object.hasOwn(modules,name))fail();return modules[name];},module={exports:{}};
 const {compileFunction}=await import('node:vm');compileFunction(decoder.decode(raw),['module','exports','require'])(module,module.exports,require);
 const result=module.exports.inspectSubnetIpPreflight(q);
 if(result?.code!=='MEASURED'||typeof result.line!=='string'||Buffer.byteLength(result.line)>4096)fail();
 const r=exact(JSON.parse(result.line),['schemaVersion','purpose','basis','attemptId','helperHash','approvalHash','issuedAt','expiresAt','measuredAt','location','measurement']);
 if(result.line!==JSON.stringify(r)+'\n'||r.schemaVersion!==1||r.purpose!=='IX01_SUBNET_IP_MEASUREMENT'||r.basis!=='FIXED_NODE_PATH_METADATA'||r.helperHash!==p.helperHash||r.attemptId!==p.attemptId||r.approvalHash!==p.approvalHash||r.issuedAt!==w.issuedAt||r.expiresAt!==w.expiresAt||r.location!==q.location||!Number.isSafeInteger(r.measuredAt)||r.measuredAt<w.issuedAt||r.measuredAt>=w.expiresAt)fail();
 const m=exact(r.measurement,['sha256','bytes','metadata']),s=exact(m.metadata,['kind','dev','ino','uid','gid','mode','nlink','size','rdev','mtimeNs','ctimeNs']);
 if(typeof m.sha256!=='string'||!/^[a-f0-9]{64}$/.test(m.sha256)||!Number.isSafeInteger(m.bytes)||m.bytes<=0||m.bytes>167772160||s.size!==m.bytes||s.kind!=='file'||s.uid!==0||s.nlink!==1||!Number.isSafeInteger(s.mode)||s.mode<0||(s.mode&4095)!==493||!Number.isSafeInteger(s.gid)||s.gid<0)fail();
 for(const k of ['dev','ino','rdev','mtimeNs','ctimeNs'])if(typeof s[k]!=='string'||!/^\d{1,30}$/.test(s[k]))fail();
 line=result.line;ok=true;
}catch{}finally{raw?.fill(0);input?.fill(0);}
process.exitCode=ok?0:1;
try{await new Promise((resolve,reject)=>process.stdout.write(line,e=>e?reject(null):resolve()));}catch{process.exitCode=1;}
`;
export const SUBNET_PREFLIGHT_WRAPPER_HASH='ae8ca87e4c24883c598f10326a687f1977912f0e71274ae29c912d78331673cd';
/** 원 helper는 compile/import/조립 때 호출하지 않는다. 배포/승인/단회 기록을 발급하지 않는 메모리 후보다. */
export function assembleSubnetPreflightStdin(raw:unknown,input:unknown){
 const bytes=copy(raw,bundleLength);try{
  if(bytes.length!==bundleLength||hash(bytes)!==bundleHash||hash(wrapper)!==SUBNET_PREFLIGHT_WRAPPER_HASH)return fail();
  const normalized=readSubnetPreflightInput(input),encoded=Buffer.from(JSON.stringify(normalized));if(encoded.length>1024)return fail();
  const inputHash=hash(encoded),text='const metaInput='+JSON.stringify(encoded.toString('base64'))+';\nconst metaInputHash='+JSON.stringify(inputHash)+';\nconst metaBundle='+JSON.stringify(Buffer.from(bytes).toString('base64'))+';\n'+wrapper;
  const payload=new Uint8Array(Buffer.from(text));if(payload.length>98304)return fail();
  return Object.freeze({bytes:payload,byteLength:payload.length,sha256:hash(payload),wrapperHash:SUBNET_PREFLIGHT_WRAPPER_HASH,bundleHash,inputHash,input:normalized});
 }finally{bytes.fill(0);}
}
const used=new WeakSet<object>(),on=EventEmitter.prototype.on,off=EventEmitter.prototype.removeListener;
function emitter(v:unknown):v is EventEmitter{return !!v&&typeof v==='object'&&!types.isProxy(v)&&v instanceof EventEmitter;}
/** 생성/kill은 하지 않는다. 원 입력 finish·출력 end·close와 측정 결박 모두 있어야 다음 입력을 반환한다.
 * 원 SSH가 미종결이면 UNKNOWN이며 외부 감독의 원 handle 수거 책임이 남는다. 새 연결/재조회는 없다. */
export function collectSubnetPreflight(original:unknown,input:unknown,startedAt:number,clock:SubnetCollectionClock,send:()=>void){
 return new Promise<Readonly<{status:'METADATA_COLLECTED';ip:Readonly<{location:string;sha256:string}>}>|typeof unknown>(resolve=>{
  let done=false,ended=false,finished=false,size=0,timer:unknown,timerSet=false;
  const bytes=new Uint8Array(4096),listeners:{target:EventEmitter;event:string;fn:(...args:any[])=>void}[]=[];
  const finish=(ip?:Readonly<{location:string;sha256:string}>)=>{if(done)return;done=true;let clean=true;for(const x of listeners)try{off.call(x.target,x.event,x.fn);}catch{clean=false;}
   if(timerSet)try{clock.clearTimeout(timer);}catch{clean=false;}bytes.fill(0);resolve(ip&&clean?Object.freeze({status:'METADATA_COLLECTED',ip}):unknown);};
  try{
   const expected=readSubnetPreflightInput(input),deadline=Math.min(expected.window.expiresAt,startedAt+10000);
   if(!emitter(original)||used.has(original)||!Number.isSafeInteger(startedAt)||startedAt<expected.window.issuedAt)throw null;
   const stdin=Object.getOwnPropertyDescriptor(original,'stdin')?.value,stdout=Object.getOwnPropertyDescriptor(original,'stdout')?.value;
   if(!emitter(stdin)||!emitter(stdout)||stdin===stdout||stdin===original||stdout===original)throw null;used.add(original);
   let last=startedAt,mono=clock.monotonic();const firstMono=mono;if(!Number.isFinite(mono)||mono<0)throw null;
   const fresh=()=>{const n=clock.now(),m=clock.monotonic();if(!Number.isSafeInteger(n)||n<last||n>=deadline||!Number.isFinite(m)||m<mono||m-firstMono>=10000)throw null;last=n;mono=m;return n;};
   const listen=(target:EventEmitter,event:string,action:(...args:any[])=>void)=>{const fn=(...a:any[])=>{if(done)return;try{fresh();action(...a);}catch{finish();}};listeners.push({target,event,fn});on.call(target,event,fn);};
   listen(stdin,'finish',()=>{if(finished)throw null;finished=true;});listen(stdin,'error',()=>finish());listen(stdout,'error',()=>finish());listen(original,'error',()=>finish());
   listen(stdout,'data',(v:unknown)=>{if(ended)throw null;const b=copy(v,4096-size);bytes.set(b,size);size+=b.length;});
   listen(stdout,'end',()=>{if(ended)throw null;ended=true;});
   // close는 synchronous sendEnd의 반환보다 먼저 올 수 있다. 송신 예외를 성공으로 바꾸지 않는다.
   let sending=true,accepted:Readonly<{location:string;sha256:string}>|undefined,closed=false;
   listen(original,'close',(code:unknown,signal:unknown)=>{if(closed||code!==0||signal!==null||!finished||!ended)throw null;closed=true;
    accepted=readSubnetIpMeasurement(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes.subarray(0,size)),expected,startedAt,fresh());if(!sending)finish(accepted);});
   const remaining=deadline-fresh();timer=clock.setTimeout(()=>finish(),remaining);timerSet=true;
   if(done){clock.clearTimeout(timer);return;}fresh();send();sending=false;fresh();if(closed)finish(accepted);
  }catch{finish();}
 });
}
