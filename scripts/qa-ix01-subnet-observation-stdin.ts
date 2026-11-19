import {createHash} from 'node:crypto';
import {types} from 'node:util';
const bundleHash='da375f17e1ccfbc4a1bd85af108ee82c0a8398a061dced888427725223bb6d8d',bundleBytes=59_073;
const locations=Object.freeze(['USR_BIN','USR_SBIN','BIN','SBIN']);
const hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const arrayProto=Object.getPrototypeOf(Uint8Array.prototype),length=Object.getOwnPropertyDescriptor(arrayProto,'byteLength')!.get!,backing=Object.getOwnPropertyDescriptor(arrayProto,'buffer')!.get!;
function reject():never{throw new Error('SUBNET_STDIN_INVALID');}
function fields(v:unknown,names:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Reflect.ownKeys(v).length!==names.length)return reject();
 const out:Record<string,unknown>=Object.create(null);for(const name of names){const d=Object.getOwnPropertyDescriptor(v,name);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)return reject();out[name]=d.value;}return out;
}
function publicInput(value:unknown){
 const v=fields(value,['proof','window','ip']),p=fields(v.proof,['attemptId','bundleHash','approvalHash']),w=fields(v.window,['issuedAt','expiresAt']),ip=fields(v.ip,['location','sha256']);
 if(typeof p.attemptId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.attemptId)||p.bundleHash!==bundleHash||typeof p.approvalHash!=='string'||!/^[a-f0-9]{64}$/.test(p.approvalHash))return reject();
 if(typeof w.issuedAt!=='number'||typeof w.expiresAt!=='number'||!Number.isSafeInteger(w.issuedAt)||!Number.isSafeInteger(w.expiresAt)||w.issuedAt<=0||w.expiresAt<=w.issuedAt||w.expiresAt-w.issuedAt>60_000)return reject();
 if(typeof ip.location!=='string'||!locations.includes(ip.location)||typeof ip.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ip.sha256))return reject();
 return {proof:{attemptId:p.attemptId,bundleHash,approvalHash:p.approvalHash},window:{issuedAt:w.issuedAt,expiresAt:w.expiresAt},ip:{location:ip.location,sha256:ip.sha256}};
}
// 아래 고정 ESM 문자는 입력과 별도 지문을 갖는다. 조립/import는 이를 실행하지 않는다.
const wrapper=String.raw`
import {createHash as ixHash} from 'node:crypto';
let ixLine='{"code":"UNKNOWN"}\n',ixSuccess=false,inputBytes,cjsBytes;
try{
 const fail=()=>{throw null;},digest=b=>ixHash('sha256').update(b).digest('hex');
 const exact=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))fail();return v;};
 const decode=(s,limit)=>{if(typeof s!=='string'||s.length>Math.ceil(limit/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s))fail();const b=Buffer.from(s,'base64');if(b.length>limit||b.toString('base64')!==s)fail();return b;};
 inputBytes=decode(ixInput,1024);cjsBytes=decode(ixBundle,59073);
 if(digest(inputBytes)!==ixInputHash||cjsBytes.length!==59073||digest(cjsBytes)!=='da375f17e1ccfbc4a1bd85af108ee82c0a8398a061dced888427725223bb6d8d')fail();
 const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}),raw=decoder.decode(inputBytes),v=exact(JSON.parse(raw),['proof','window','ip']);if(JSON.stringify(v)!==raw)fail();
 const p=exact(v.proof,['attemptId','bundleHash','approvalHash']),w=exact(v.window,['issuedAt','expiresAt']),ip=exact(v.ip,['location','sha256']);
 if(typeof p.attemptId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(p.attemptId)||p.bundleHash!=='da375f17e1ccfbc4a1bd85af108ee82c0a8398a061dced888427725223bb6d8d'||typeof p.approvalHash!=='string'||!/^[a-f0-9]{64}$/.test(p.approvalHash))fail();
 if(!Number.isSafeInteger(w.issuedAt)||!Number.isSafeInteger(w.expiresAt)||w.issuedAt<=0||w.expiresAt<=w.issuedAt||w.expiresAt-w.issuedAt>60000)fail();
 const paths=Object.freeze({USR_BIN:'/usr/bin/ip',USR_SBIN:'/usr/sbin/ip',BIN:'/bin/ip',SBIN:'/sbin/ip'});
 if(typeof ip.location!=='string'||!Object.hasOwn(paths,ip.location)||typeof ip.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ip.sha256))fail();
 const names=['node:child_process','node:crypto','node:fs','node:net','node:os','node:perf_hooks','node:util','node:events'],modules=Object.create(null);
 for(const name of names)modules[name]=await import(name);
 const require=name=>{if(typeof name!=='string'||!Object.hasOwn(modules,name))fail();return modules[name];};
 const {compileFunction}=await import('node:vm'),module={exports:{}};
 compileFunction(decoder.decode(cjsBytes),['module','exports','require'])(module,module.exports,require);
 cjsBytes.fill(0);inputBytes.fill(0);
 const result=exact(await module.exports.observeSubnetNative({issuedAt:w.issuedAt,expiresAt:w.expiresAt,ip:{path:paths[ip.location],sha256:ip.sha256}},p),['code','envelope']);
 if(result.code!=='REMOTE_COMPLETE')fail();
 const e=exact(result.envelope,['attemptId','bundleHash','approvalHash','issuedAt','expiresAt','schemaVersion','purpose','completion','result']);
 if(e.attemptId!==p.attemptId||e.bundleHash!==p.bundleHash||e.approvalHash!==p.approvalHash||e.issuedAt!==w.issuedAt||e.expiresAt!==w.expiresAt||e.schemaVersion!==1||e.purpose!=='IX01_SUBNET_REMOTE_COMPLETION'||e.completion!=='DIRECT_CHILDREN_CLOSED')fail();
 const r=e.result;if(r?.code==='NO_CANDIDATE')exact(r,['code']);else{exact(r,['code','cidr']);if(r.code!=='CANDIDATE'||typeof r.cidr!=='string')fail();const m=/^172\.(\d{2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\/28$/.exec(r.cidr);if(!m||m[0]!==r.cidr||+m[1]<16||+m[1]>31||+m[2]>254||+m[3]>240||+m[3]%16)fail();}
 const line=JSON.stringify(e)+'\n';if(Buffer.byteLength(line)>4096)fail();ixLine=line;ixSuccess=true;
}catch{}finally{cjsBytes?.fill(0);inputBytes?.fill(0);}
process.exitCode=ixSuccess?0:1;
try{await new Promise((resolve,reject)=>process.stdout.write(ixLine,error=>error?reject(null):resolve()));}catch{process.exitCode=1;}
`;
const wrapperHash='ccf403d8b3281063c972d192725d66da0808f8b90180ae19952848fe3fc8bc75';
/** 비실행 적재물 후보만 반환한다. proof는 상관값이며 실효 승인/단회 소진 기록이 아니다.
 * 실제 사용 전 원 strict SSH carrier·외부 승인 ledger·ip 지문·기한을 별도로 고정해야 한다.
 * ESM 전체 잘림/구문 실패나 stdout 고장에는 한 줄 출력도 불가능할 수 있으므로 원 supervisor가
 * 결과 부재/비정상 close를 UNKNOWN으로 처리해야 한다. 문자열은 관리형 GC 대상이다.
 */
export function assembleSubnetObservationStdin(rawBundle:unknown,input:unknown){
 try{
  if(types.isProxy(rawBundle)||!types.isUint8Array(rawBundle)||length.call(rawBundle)!==bundleBytes||types.isSharedArrayBuffer(backing.call(rawBundle)))return reject();
  const owned=new Uint8Array(bundleBytes);Uint8Array.prototype.set.call(owned,rawBundle);
  try{
   if(hash(owned)!==bundleHash||hash(wrapper)!==wrapperHash)return reject();
   const normalized=publicInput(input),inputBytes=Buffer.from(JSON.stringify(normalized));if(inputBytes.length>1024)return reject();
   const inputHash=hash(inputBytes),text='const ixInput='+JSON.stringify(inputBytes.toString('base64'))+';\nconst ixInputHash='+JSON.stringify(inputHash)+';\nconst ixBundle='+JSON.stringify(Buffer.from(owned.buffer).toString('base64'))+';\n'+wrapper;
   inputBytes.fill(0);const bytes=new Uint8Array(Buffer.from(text));if(bytes.length>98_304)return reject();
   return Object.freeze({kind:'SOURCE_ONLY_CANDIDATE',bytes,byteLength:bytes.length,sha256:hash(bytes),bundleSha256:bundleHash,wrapperSha256:wrapperHash,wrapperBytes:Buffer.byteLength(wrapper),inputSha256:inputHash});
  }finally{owned.fill(0);}
 }catch{return reject();}
}
