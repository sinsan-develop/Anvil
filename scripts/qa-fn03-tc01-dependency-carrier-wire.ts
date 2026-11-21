import {types} from 'node:util';
import {posix} from 'node:path';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';

const purpose='TC01_DEPENDENCY_PREPARATION',recipe='TC01_DEPENDENCY_RECIPE_CANDIDATE_V1';
const entry='scripts/qa-fn03-tc01-dependency-intake.ts';
const totalMs=1800000,installationMs=600000,manifestCap=2097152;
const fail=():never=>{throw Error('TC01_DEPENDENCY_CARRIER_WIRE_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function record(v:unknown,keys:readonly string[]):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v)&&!Array.isArray(v));
 check([Object.prototype,null].includes(Object.getPrototypeOf(v)));
 const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);
 const out:Record<string,any>=Object.create(null);
 for(const key of keys){const x=d[key];check(x&&x.enumerable&&'value'in x);out[key]=x.value;}
 return out;
}
const integer=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
type Binding=Readonly<{
 purpose:typeof purpose;attemptId:string;sourceHead:string;packageLockSha256:string;
 source:Readonly<{entry:typeof entry;sha256:string;closureSha256:string}>;
 recipe:typeof recipe;approvalSha256:string;consumptionSha256:string;issuedAt:number;expiresAt:number;
}>;
function binding(value:unknown):Binding{
 const b=record(value,['purpose','attemptId','sourceHead','packageLockSha256','source','recipe','approvalSha256','consumptionSha256','issuedAt','expiresAt']);
 const s=record(b.source,['entry','sha256','closureSha256']);
 check(b.purpose===purpose&&b.recipe===recipe&&s.entry===entry&&hashV1(s.sha256)&&hashV1(s.closureSha256));
 check(uuidV1(b.attemptId)&&typeof b.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(b.sourceHead)&&hashV1(b.packageLockSha256)&&hashV1(b.approvalSha256)&&hashV1(b.consumptionSha256));
 check(integer(b.issuedAt)&&integer(b.expiresAt)&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=totalMs);
 return Object.freeze({purpose,attemptId:b.attemptId,sourceHead:b.sourceHead,packageLockSha256:b.packageLockSha256,source:Object.freeze({entry,sha256:s.sha256,closureSha256:s.closureSha256}),recipe,approvalSha256:b.approvalSha256,consumptionSha256:b.consumptionSha256,issuedAt:b.issuedAt,expiresAt:b.expiresAt});
}
function current(b:Binding,value:unknown):void{
 const c=record(value,['startedAt','monotonicStartedAt','now','monotonicNow']);
 check(Object.values(c).every(integer)&&c.startedAt>=b.issuedAt&&c.now>=c.startedAt&&c.now<b.expiresAt&&c.monotonicNow>=c.monotonicStartedAt&&c.monotonicNow-c.monotonicStartedAt<b.expiresAt-c.startedAt);
}
const typed=Object.getPrototypeOf(Uint8Array.prototype);
const lengthGetter=Object.getOwnPropertyDescriptor(typed,'byteLength')!.get!;
const bufferGetter=Object.getOwnPropertyDescriptor(typed,'buffer')!.get!;
const set=Uint8Array.prototype.set,fill=Uint8Array.prototype.fill;
function owned(value:unknown,max:number):Uint8Array{
 check(value!==null&&typeof value==='object'&&!types.isProxy(value)&&types.isUint8Array(value));
 const length=lengthGetter.call(value),buffer=bufferGetter.call(value);
 check(integer(length)&&length>0&&length<=max&&types.isAnyArrayBuffer(buffer)&&!types.isSharedArrayBuffer(buffer));
 const copy=new Uint8Array(length);
 try{set.call(copy,value);return copy;}catch{fill.call(copy,0);return fail();}
}
// 컨테이너 시작 + 문자열(key/value) + 비문자 scalar를 각 1개로 센다. 구두점은 제외.
// 3필드 manifest row는 7개로 20,000행도 140,000+고정 헤더이며, 별도 2MiB가 우선한다.
// quote/escape 안의 구조 문자는 세지 않는다. 문법/중복/정규형은 기존 parser가 검산한다.
function boundedStructure(text:string):void{
 let depth=0,nodes=0,quoted=false,escaped=false,scalar=false;
 const node=()=>check(++nodes<=160128);
 for(const c of text){
  if(quoted){if(escaped){escaped=false;continue;}if(c==='\\'){escaped=true;continue;}if(c==='"')quoted=false;continue;}
  if(c==='"'){node();quoted=true;scalar=false;continue;}
  if(c==='{'||c==='['){node();check(++depth<=16);scalar=false;continue;}
  if(c==='}'||c===']'){check(--depth>=0);scalar=false;continue;}
  if(c===','||c===':'||c===' '||c==='\n'||c==='\r'||c==='\t'){scalar=false;continue;}
  if(!scalar){node();scalar=true;}
 }
 check(!quoted&&!escaped&&depth===0);
}
function json(text:string):unknown{
 boundedStructure(text);
 const parsed:unknown=parseWireJson(text);check(canonicalJson(parsed)+'\n'===text);return parsed;
}
function decode(raw:unknown,max:number):unknown{
 const bytes=owned(raw,max);
 try{return json(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes));}
 finally{fill.call(bytes,0);}
}
function envelope(raw:unknown,expected:unknown,clock:unknown,result:boolean){
 // 독립 감독이 이미 보유한 expected만 먼저 소유 복사. wire 자체는 승인 근거가 아니다.
 const b=binding(expected);current(b,clock);
 const r=record(decode(raw,result?4210688:16384),result?['schemaVersion','kind','binding','result']:['schemaVersion','kind','binding','limits']);
 check(r.schemaVersion===1&&r.kind===(result?'TC01_DEPENDENCY_RESULT_V1':'TC01_DEPENDENCY_INPUT_V1'));
 check(canonicalJson(binding(r.binding))===canonicalJson(b));return{b,r};
}
/** 효과 없는 내부 비교 판독기. expectedBinding은 실제 감독이 별도로 확인한 승인/배타 소진 기록의
 * digest·source closure·고정 recipe·원 attempt/window를 공급해야 한다. 이 함수는 기록의 진위,
 * 배타 소진·재사용 차단·원 child 종료·설치 provenance를 발급하지 않는다. 실제 승인 record 형상과
 * transport/collector는 미연결이다. 같은 감독의 clock snapshot이며 호출 간 현재성을 보유하지 않는다.
 * 600초는 기존 preparation의 wall/mono 단계 제한, 30분은 같은 전체 window이다.
 * 재시도/cleanup/설치/파일 읽기/CLI 및 기본 OS 포트 없음. */
export function readTc01DependencyCarrierInput(raw:unknown,expectedBinding:unknown,clock:unknown){
 try{
  const{b,r}=envelope(raw,expectedBinding,clock,false),l=record(r.limits,['installationMs','totalMs']);
  check(l.installationMs===installationMs&&l.totalMs===totalMs);
  return Object.freeze({validation:'COMPARISON_ONLY' as const,authority:'NOT_ISSUED' as const,binding:b,limits:Object.freeze({installationMs,totalMs})});
 }catch{return fail();}
}
/** 후보 원문은 기존 dependency-evidence의 canonical+LF/2MiB 형상을 그대로 보존한다.
 * 외부 wire는 JSON string escaping을 포함해 4MiB+16KiB로 유계. 원 파일 바이트를 받거나 반환하지 않는다.
 * UID/mode/NOFOLLOW/fd/정확 tree 관측과 설치 정상 종료는 기존 감독/관측기의 책임이며 SHA 목록은
 * 그 사실의 대용이 아니다. UNKNOWN/부분 결과는 후보로 수용하지 않고 고정 오류만 반환한다. */
export function readTc01DependencyCarrierResult(raw:unknown,expectedBinding:unknown,clock:unknown){
 try{
  const{b,r}=envelope(raw,expectedBinding,clock,true),v=record(r.result,['status','authority','manifestRaw','manifestSha256']);
  check(v.status==='CANDIDATE_ONLY'&&v.authority==='NOT_ISSUED'&&typeof v.manifestRaw==='string'&&v.manifestRaw.length<=manifestCap&&Buffer.byteLength(v.manifestRaw,'utf8')<=manifestCap&&hashV1(v.manifestSha256)&&contentHash(v.manifestRaw)===v.manifestSha256);
  const m=record(json(v.manifestRaw),['schemaVersion','sourceHead','packageLockSha256','files']);
  check(m.schemaVersion===1&&m.sourceHead===b.sourceHead&&m.packageLockSha256===b.packageLockSha256&&Array.isArray(m.files)&&m.files.length>0&&m.files.length<=20000);
  let total=0,prior='';const paths=new Set<string>();
  for(const value of m.files){
   const f=record(value,['path','bytes','sha256']);
   check(typeof f.path==='string'&&f.path.length<=400&&f.path.startsWith('node_modules/')&&/^[A-Za-z0-9_@.+/-]+$/.test(f.path)&&posix.normalize(f.path)===f.path&&f.path.split('/').every((s:string)=>s!==''&&s!=='.'&&s!=='..')&&f.path>prior);
   for(let parent=posix.dirname(f.path);parent!=='.';parent=posix.dirname(parent))check(!paths.has(parent));
   paths.add(f.path);check(integer(f.bytes)&&f.bytes<=16777216&&hashV1(f.sha256));total+=f.bytes;check(total<=268435456);prior=f.path;
  }
  return Object.freeze({validation:'COMPARISON_ONLY' as const,authority:'NOT_ISSUED' as const,binding:b,candidate:Object.freeze({status:'CANDIDATE_ONLY' as const,authority:'NOT_ISSUED' as const,manifestRaw:v.manifestRaw as string,manifestSha256:v.manifestSha256 as string})});
 }catch{return fail();}
}
