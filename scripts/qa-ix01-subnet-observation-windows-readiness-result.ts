import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';

const sourceHash='6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3';
const roles=Object.freeze(['SSH_IMAGE','USER_CONFIG','SYSTEM_CONFIG','USER_TRUST','USER_TRUST_2','SYSTEM_TRUST','SYSTEM_TRUST_2','LEDGER_PARENT'] as const);
const unknown=Object.freeze({status:'UNKNOWN',code:'READINESS_RESULT_UNCONFIRMED'} as const);
const arrayBufferPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const byteLength=Object.getOwnPropertyDescriptor(arrayBufferPrototype,'byteLength')!.get!;
const backing=Object.getOwnPropertyDescriptor(arrayBufferPrototype,'buffer')!.get!;
const emptyHash=contentHash('');

function reject():never{throw null;}
function fields(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)return reject();
 const result:Record<string,unknown>=Object.create(null);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return reject();result[key]=d.value;}
 return result;
}
function hex(value:unknown):value is string{return typeof value==='string'&&value.length===64&&/^[a-f0-9]+$/.test(value);}
function integer(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function readBinding(value:unknown){
 const b=fields(value,['attemptId','approvalHash','planHash','sourceHash','issuedAt','expiresAt']);
 if(typeof b.attemptId!=='string'||b.attemptId.length!==36||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(b.attemptId)||
 !hex(b.approvalHash)||!hex(b.planHash)||b.sourceHash!==sourceHash||!integer(b.issuedAt)||!integer(b.expiresAt)||b.expiresAt<=b.issuedAt||b.expiresAt-b.issuedAt>60000)return reject();
 return Object.freeze({attemptId:b.attemptId,approvalHash:b.approvalHash,planHash:b.planHash,sourceHash,issuedAt:b.issuedAt,expiresAt:b.expiresAt});
}
type Binding=ReturnType<typeof readBinding>;
type Role=typeof roles[number];
type Measurement=Readonly<{role:Role;state:'ABSENT';metadata:'MATCHED'}|{role:Role;state:'PRESENT';metadata:'MATCHED';aclHash:string;bytes?:number;sha256?:string;text?:'SUBSET_ONLY'}>;
export type SubnetWindowsReadinessComparison=Readonly<{
 status:'COMPARISON_ONLY';readiness:'UNCONFIRMED';binding:Binding;
 identity:Readonly<{imageSha256:string;configurationSha256:string;knownHostsSha256:string}>;
 outputSha256:string;metadataSha256:string;
}>;

function readRole(value:unknown,index:number):Measurement{
 const role=roles[index]!;
 // value는 duplicate-key/형상을 검사한 JSON 원문에서만 나온다.
 if(!value||typeof value!=='object'||Array.isArray(value))return reject();
 const state=Object.getOwnPropertyDescriptor(value,'state')?.value;
 const directory=role==='LEDGER_PARENT',image=role==='SSH_IMAGE';
 const keys=state==='ABSENT'?['role','state','metadata']:directory?['role','state','metadata','aclHash']:image?['role','state','metadata','bytes','sha256','aclHash']:['role','state','metadata','bytes','sha256','aclHash','text'];
 const r=fields(value,keys);
 if(r.role!==role||r.metadata!=='MATCHED')return reject();
 if(state==='ABSENT'){
  if(image||directory)return reject();
  return Object.freeze({role,state:'ABSENT',metadata:'MATCHED'});
 }
 if(state!=='PRESENT'||!hex(r.aclHash))return reject();
 if(directory)return Object.freeze({role,state:'PRESENT',metadata:'MATCHED',aclHash:r.aclHash});
 const maximum=image?67108864:index<=2?65536:1048576;
 if(!integer(r.bytes)||r.bytes>maximum||!hex(r.sha256)||(r.bytes===0&&r.sha256!==emptyHash)||(!image&&r.text!=='SUBSET_ONLY'))return reject();
 return Object.freeze({role,state:'PRESENT',metadata:'MATCHED',bytes:r.bytes,sha256:r.sha256,aclHash:r.aclHash,...(!image?{text:'SUBSET_ONLY' as const}:{})});
}

// 의미와 역할순서를 고정한다. ABSENT를 제거하지 않으며 caller 경로/원문/시간은 그룹 지문에 섞지 않는다.
// metadata는 PS가 공개한 MATCHED·ACL 및 길이/SHA만 뜻한다. 내부 부모/owner/FileId digest가 아니다.
function groupHash(purpose:string,measurements:readonly Measurement[]){
 return contentHash(canonicalJson({schemaVersion:1,purpose,sourceHash,roles:measurements}));
}

/** 순수 결과 판독. 원 감독이 같은 handle의 stdout 종결·EXIT0·실제 시간창·승인 결박을
 * 별도로 확인해야 한다. 이 함수는 해당 사실을 받거나 발급하지 않고 임의 verified/exit 필드도 받지 않는다.
 * 비교 결과는 현재 config 적용/alias/host trust/환경·운용 승인·review CURRENT가 아니다.
 * 실제 소비 연결과 재측정은 별도 감독 범위이며 여기에는 I/O·시계·재시도·자동 진입이 없다. */
export function readSubnetWindowsReadinessResult(raw:unknown,expectedBinding:unknown):SubnetWindowsReadinessComparison|typeof unknown{
 let bytes:Uint8Array|undefined;
 try{
  const expected=readBinding(expectedBinding);
  if(types.isProxy(raw)||!types.isUint8Array(raw)||types.isSharedArrayBuffer(backing.call(raw)))return unknown;
  const size=byteLength.call(raw);
  if(size<3||size>4096)return unknown;
  bytes=new Uint8Array(size);Uint8Array.prototype.set.call(bytes,raw);
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
  // 고정 실행 본문의 Console.Out.Write가 붙인 정확 LF 한 개. BOM/다른 줄 구분자도 허용하지 않는다.
  if(!text.endsWith('\n')||/[\r\n\uFEFF\u0085\u2028\u2029]/u.test(text.slice(0,-1)))return unknown;
  const r=fields(parseWireJson(text.slice(0,-1)),['schemaVersion','code','readiness','reason','binding','files']);
  if(r.schemaVersion!==1||r.code!=='INSPECTION_COLLECTED'||r.readiness!=='UNCONFIRMED'||r.reason!=='DEFAULT_SCOPE_ENV_AND_TRUST_UNCONFIRMED')return unknown;
  const binding=readBinding(r.binding);
  if(canonicalJson(binding)!==canonicalJson(expected)||!Array.isArray(r.files)||r.files.length!==roles.length)return unknown;
  const measurements=Object.freeze(r.files.map(readRole));
  const image=measurements[0]!;
  if(image.state!=='PRESENT'||!image.sha256)return unknown;
  const identity=Object.freeze({imageSha256:image.sha256,
   configurationSha256:groupHash('IX01_WINDOWS_CONFIG_COMPARISON_V1',measurements.slice(1,3)),
   knownHostsSha256:groupHash('IX01_WINDOWS_TRUST_COMPARISON_V1',measurements.slice(3,7))});
  return Object.freeze({status:'COMPARISON_ONLY',readiness:'UNCONFIRMED',binding,identity,
   outputSha256:contentHash(bytes),metadataSha256:groupHash('IX01_WINDOWS_PUBLIC_METADATA_COMPARISON_V1',measurements)});
 }catch{return unknown;}
 finally{bytes?.fill(0);}
}
