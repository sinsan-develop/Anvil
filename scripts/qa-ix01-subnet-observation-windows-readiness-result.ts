import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';

const sourceHash='6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3';
const finalSourceHash='ad2254c843f97ff420eee2d35cf6968783f199694ee5b6404bdde69dd74cd3d8';
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
function readBinding(value:unknown,pinnedHash:string=sourceHash){
 const b=fields(value,['attemptId','approvalHash','planHash','sourceHash','issuedAt','expiresAt']);
 if(typeof b.attemptId!=='string'||b.attemptId.length!==36||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(b.attemptId)||
 !hex(b.approvalHash)||!hex(b.planHash)||b.sourceHash!==pinnedHash||!integer(b.issuedAt)||!integer(b.expiresAt)||b.expiresAt<=b.issuedAt||b.expiresAt-b.issuedAt>60000)return reject();
 return Object.freeze({attemptId:b.attemptId,approvalHash:b.approvalHash,planHash:b.planHash,sourceHash:pinnedHash,issuedAt:b.issuedAt,expiresAt:b.expiresAt});
}
type Binding=ReturnType<typeof readBinding>;
type Role=typeof roles[number];
type Measurement=Readonly<{role:Role;state:'ABSENT';metadata:'MATCHED'}|{role:Role;state:'PRESENT';metadata:'MATCHED';aclHash:string;bytes?:number;sha256?:string;text?:'SUBSET_ONLY'|'ALIAS_SUBSET'}>;
export type SubnetWindowsReadinessComparison=Readonly<{
 status:'COMPARISON_ONLY';readiness:'UNCONFIRMED';binding:Binding;
 identity:Readonly<{imageSha256:string;configurationSha256:string;knownHostsSha256:string}>;
 outputSha256:string;metadataSha256:string;
}>;

function readRole(value:unknown,index:number,final=false):Measurement{
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
 const text=final&&index>=1&&index<=2?'ALIAS_SUBSET' as const:'SUBSET_ONLY' as const;
 if(!integer(r.bytes)||r.bytes>maximum||!hex(r.sha256)||(r.bytes===0&&r.sha256!==emptyHash)||(!image&&r.text!==text))return reject();
 return Object.freeze({role,state:'PRESENT',metadata:'MATCHED',bytes:r.bytes,sha256:r.sha256,aclHash:r.aclHash,...(!image?{text}:{})});
}

function readAlias(value:unknown,measurements:readonly Measurement[]){
 const a=fields(value,['schemaVersion','status','code','alias','readiness','userKind','fields']);
 if(a.schemaVersion!==1||a.status!=='ALIAS_SUBSET'||a.code!=='CONFIG_CLASSIFIED'||a.alias!=='WSL-server'||a.readiness!=='UNCONFIRMED'||
 (a.userKind!=='UNSET'&&a.userKind!=='ROOT_LITERAL'&&a.userKind!=='NON_ROOT_LITERAL')||!Array.isArray(a.fields)||a.fields.length>5)return reject();
 const keys=['hostname','user','port','identitiesonly','identityfile'] as const;
 let previous=-1;
 const selected=Object.freeze(a.fields.map(value=>{
  const f=fields(value,['key','role','line']);
  const index=typeof f.key==='string'?(keys as readonly string[]).indexOf(f.key):-1;
  if(index<=previous||(f.role!=='USER_CONFIG'&&f.role!=='SYSTEM_CONFIG')||!integer(f.line)||f.line<1||f.line>4096)return reject();
  const measurement=measurements[f.role==='USER_CONFIG'?1:2]!;
  if(measurement.state!=='PRESENT'||measurement.bytes===undefined||f.line>measurement.bytes)return reject();
  previous=index;return Object.freeze({key:keys[index]!,role:f.role,line:f.line});
 }));
 if((a.userKind==='UNSET')!==!selected.some(f=>f.key==='user'))return reject();
 return Object.freeze({schemaVersion:1 as const,status:'ALIAS_SUBSET' as const,code:'CONFIG_CLASSIFIED' as const,alias:'WSL-server' as const,
  readiness:'UNCONFIRMED' as const,userKind:a.userKind,fields:selected});
}
export type SubnetWindowsFinalReadinessComparison=SubnetWindowsReadinessComparison&Readonly<{alias:ReturnType<typeof readAlias>}>;

// 의미와 역할순서를 고정한다. ABSENT를 제거하지 않으며 caller 경로/원문/시간은 그룹 지문에 섞지 않는다.
// metadata는 PS가 공개한 MATCHED·ACL 및 길이/SHA만 뜻한다. 내부 부모/owner/FileId digest가 아니다.
function groupHash(purpose:string,measurements:readonly Measurement[],pinnedHash:string=sourceHash,alias?:ReturnType<typeof readAlias>){
 return contentHash(canonicalJson({schemaVersion:1,purpose,sourceHash:pinnedHash,roles:measurements,...(alias?{alias}:{})}));
}

/** 순수 결과 판독. 원 감독이 같은 handle의 stdout 종결·EXIT0·실제 시간창·승인 결박을
 * 별도로 확인해야 한다. 이 함수는 해당 사실을 받거나 발급하지 않고 임의 verified/exit 필드도 받지 않는다.
 * 비교 결과는 현재 config 적용/alias/host trust/환경·운용 승인·review CURRENT가 아니다.
 * 실제 소비 연결과 재측정은 별도 감독 범위이며 여기에는 I/O·시계·재시도·자동 진입이 없다. */
export function readSubnetWindowsReadinessResult(raw:unknown,expectedBinding:unknown):SubnetWindowsReadinessComparison|typeof unknown{
 return readResult(raw,expectedBinding,false);
}

/** AD2254 원 결과 전용. alias는 고정 생산자의 제한 분류일 뿐 실제 config 적용/신뢰 증거가 아니다.
 * 새 plan의 4소스 검산 및 같은 handle·EXIT0·시간·승인은 호출자가 별도로 확인한다. */
export function readSubnetWindowsFinalReadinessResult(raw:unknown,expectedBinding:unknown):SubnetWindowsFinalReadinessComparison|typeof unknown{
 const result=readResult(raw,expectedBinding,true);
 return result.status==='COMPARISON_ONLY'&&'alias' in result?result:unknown;
}

function ownedWireBytes(raw:unknown):Uint8Array{
 if(types.isProxy(raw)||!types.isUint8Array(raw)||types.isSharedArrayBuffer(backing.call(raw)))return reject();
 const size=byteLength.call(raw);if(size<3||size>4096)return reject();
 const bytes=new Uint8Array(size);try{Uint8Array.prototype.set.call(bytes,raw);return bytes;}catch{bytes.fill(0);return reject();}
}
function wireValue(bytes:Uint8Array):unknown{
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 // 원 Console.Out.Write의 정확 LF 한 개. BOM/다른 줄 구분자와 중복 JSON 키는 거절한다.
 if(!text.endsWith('\n')||/[\r\n\uFEFF\u0085\u2028\u2029]/u.test(text.slice(0,-1)))return reject();
 return parseWireJson(text.slice(0,-1));
}

function readResult(raw:unknown,expectedBinding:unknown,final:boolean):SubnetWindowsReadinessComparison|SubnetWindowsFinalReadinessComparison|typeof unknown{
 let bytes:Uint8Array|undefined;
 try{
  const pinnedHash=final?finalSourceHash:sourceHash,expected=readBinding(expectedBinding,pinnedHash);
  bytes=ownedWireBytes(raw);
  const r=fields(wireValue(bytes),['schemaVersion','code','readiness','reason','binding','files',...(final?['alias']:[])]);
  if(r.schemaVersion!==1||r.code!==(final?'COMPARISON_ONLY':'INSPECTION_COLLECTED')||r.readiness!=='UNCONFIRMED'||r.reason!=='DEFAULT_SCOPE_ENV_AND_TRUST_UNCONFIRMED')return unknown;
  const binding=readBinding(r.binding,pinnedHash);
  if(canonicalJson(binding)!==canonicalJson(expected)||!Array.isArray(r.files)||r.files.length!==roles.length)return unknown;
  const measurements=Object.freeze(r.files.map((value,index)=>readRole(value,index,final)));
  const alias=final?readAlias(r.alias,measurements):undefined;
  const image=measurements[0]!;
  if(image.state!=='PRESENT'||!image.sha256)return unknown;
  const identity=Object.freeze({imageSha256:image.sha256,
   configurationSha256:groupHash(final?'IX01_WINDOWS_FINAL_CONFIG_COMPARISON_V1':'IX01_WINDOWS_CONFIG_COMPARISON_V1',measurements.slice(1,3),pinnedHash,alias),
   knownHostsSha256:groupHash('IX01_WINDOWS_TRUST_COMPARISON_V1',measurements.slice(3,7),pinnedHash)});
  return Object.freeze({status:'COMPARISON_ONLY',readiness:'UNCONFIRMED',binding,identity,
   outputSha256:contentHash(bytes),metadataSha256:groupHash('IX01_WINDOWS_PUBLIC_METADATA_COMPARISON_V1',measurements,pinnedHash),...(alias?{alias}:{})});
 }catch{return unknown;}
 finally{bytes?.fill(0);}
}

const diagnosticSourceHash='30ece222c2f5f194e8bd3de5f952b012c5fdcfddaca4fe3a42e9a5d6e448dbef';
const configRoles=['USER_CONFIG','SYSTEM_CONFIG'] as const;
const diagnosticCodes=['UNSUPPORTED_DIRECTIVE','CARRIER_FIXED_SERVER_ALIVE_INTERVAL','CARRIER_FIXED_SERVER_ALIVE_COUNT_MAX','CARRIER_FIXED_LOG_LEVEL'] as const;
const fatalCodes=['INPUT_UNCONFIRMED','TEXT_UNCONFIRMED','MALFORMED_CONFIG','UNSUPPORTED_HOST_PATTERN','INCLUDE_UNCONFIRMED','MATCH_UNCONFIRMED','CUSTOM_SCOPE_UNCONFIRMED','EFFECT_UNCONFIRMED','MALFORMED_VALUE','IDENTITY_CLASSIFIER_UNCONFIRMED','PATH_UNCONFIRMED','IDENTITY_SET_UNCONFIRMED'] as const;
const partialCodes=['WINDOW_EXPIRED','METADATA_UNCONFIRMED','READ_UNCONFIRMED','LENGTH_UNCONFIRMED','METADATA_CHANGED','CLOSE_UNCONFIRMED'] as const;
type ConfigRole=typeof configRoles[number];
type ConfigMeasurement=Readonly<{role:ConfigRole;state:'ABSENT';metadata:'MATCHED'}|{role:ConfigRole;state:'PRESENT';metadata:'MATCHED';bytes:number;sha256:string;aclHash:string;text:'DIAGNOSTIC_ONLY'}>;
type ConfigDiagnostic=Readonly<{role:ConfigRole;line:number;code:typeof diagnosticCodes[number];applicable:boolean}>;
export type SubnetWindowsConfigDiagnosticComparison=Readonly<{
 status:'COMPARISON_ONLY';readiness:'UNCONFIRMED';coverage:'BOTH_CONFIGS'|'PARTIAL';binding:Binding;reason:string;
 files:readonly ConfigMeasurement[];diagnostics:readonly ConfigDiagnostic[];additional:boolean;
 stop:Readonly<{code:typeof fatalCodes[number];role:ConfigRole;line:number}>|null;outputSha256:string;
}>;
function configMeasurement(value:unknown,index:number):ConfigMeasurement{
 const state=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'state')?.value:undefined;
 const f=fields(value,state==='ABSENT'?['role','state','metadata']:['role','state','metadata','bytes','sha256','aclHash','text']);
 const role=configRoles[index]!;if(f.role!==role||f.metadata!=='MATCHED')return reject();
 if(state==='ABSENT')return Object.freeze({role,state,metadata:'MATCHED'});
 if(state!=='PRESENT'||!integer(f.bytes)||f.bytes>65536||!hex(f.sha256)||!hex(f.aclHash)||f.text!=='DIAGNOSTIC_ONLY'||f.bytes===0&&f.sha256!==emptyHash)return reject();
 return Object.freeze({role,state,metadata:'MATCHED',bytes:f.bytes,sha256:f.sha256,aclHash:f.aclHash,text:'DIAGNOSTIC_ONLY'});
}
/** 동결 config -DiagnosticOnly 출력만 판독한다. coverage는 출력 형상의 범위일 뿐
 * 같은 handle의 종결/EXIT0·시간창·승인이나 실제 config 적용/SSH 신뢰를 입증하지 않는다.
 * 호출 감독은 이 원 수거 증거를 별도로 검산해야 하며 부분 실패는 BOTH_CONFIGS로 승격하지 않는다. */
export function readSubnetWindowsConfigDiagnosticResult(raw:unknown,expectedBinding:unknown):SubnetWindowsConfigDiagnosticComparison|typeof unknown{
 let bytes:Uint8Array|undefined;
 try{
  const expected=readBinding(expectedBinding,diagnosticSourceHash);bytes=ownedWireBytes(raw);
  const r=fields(wireValue(bytes),['schemaVersion','code','readiness','reason','files','binding','alias']);
  if(r.schemaVersion!==1||r.readiness!=='UNCONFIRMED'||r.code!=='UNKNOWN'&&r.code!=='CONFIG_DIAGNOSTIC_COLLECTED'||typeof r.reason!=='string')return unknown;
  const binding=readBinding(r.binding,diagnosticSourceHash);
  if(canonicalJson(binding)!==canonicalJson(expected)||!Array.isArray(r.files)||r.files.length<1||r.files.length>2)return unknown;
  const files=Object.freeze(r.files.map(configMeasurement));
  const rawAlias=r.alias;
  const hasStop=!!rawAlias&&typeof rawAlias==='object'&&Object.hasOwn(rawAlias,'role');
  const a=fields(rawAlias,['schemaVersion','status','code','alias','readiness','diagnostics','additional',...(hasStop?['role','line']:[])]);
  if(a.schemaVersion!==1||a.alias!=='WSL-server'||a.readiness!=='UNCONFIRMED'||!Array.isArray(a.diagnostics)||a.diagnostics.length>16||typeof a.additional!=='boolean'||a.additional&&a.diagnostics.length!==16)return unknown;
  const position=(role:unknown,line:unknown,zero=false)=>{
   const index=(configRoles as readonly unknown[]).indexOf(role);const file=files[index];
   if(index<0||!integer(line)||line<(zero?0:1)||line>4096||!file||file.state!=='PRESENT'||file.bytes===0||line>file.bytes)return reject();
   return {role:configRoles[index]!,line,order:index*4097+line};
  };
  let previous=-1;
  const diagnostics=Object.freeze(a.diagnostics.map(value=>{
   const d=fields(value,['role','line','code','applicable']),p=position(d.role,d.line);
   if(p.order<=previous||typeof d.applicable!=='boolean'||!(diagnosticCodes as readonly unknown[]).includes(d.code))return reject();previous=p.order;
   return Object.freeze({role:p.role,line:p.line,code:d.code as typeof diagnosticCodes[number],applicable:d.applicable});
  }));
  let stop:SubnetWindowsConfigDiagnosticComparison['stop']=null;
  if(hasStop){
   if(a.status!=='UNKNOWN'||!(fatalCodes as readonly unknown[]).includes(a.code))return unknown;
   const p=position(a.role,a.line,a.code==='INPUT_UNCONFIRMED'||a.code==='TEXT_UNCONFIRMED');
   if(p.order<=previous||files.length!==(p.role==='USER_CONFIG'?1:2))return unknown;
   stop=Object.freeze({code:a.code as typeof fatalCodes[number],role:p.role,line:p.line});
  }else{
   const unsupported=diagnostics.some(d=>d.code==='UNSUPPORTED_DIRECTIVE');
   if(a.status==='COMPARISON_ONLY'){if(a.code!=='CONFIG_DIAGNOSTIC_COLLECTED'||unsupported)return unknown;}
   else if(a.status!=='UNKNOWN'||a.code!=='UNSUPPORTED_DIRECTIVE'||!unsupported&&!a.additional)return unknown;
  }
  let coverage:SubnetWindowsConfigDiagnosticComparison['coverage']='PARTIAL';
  if(!stop&&r.reason===a.code){
   if(files.length!==2||r.code!==(a.status==='COMPARISON_ONLY'?'CONFIG_DIAGNOSTIC_COLLECTED':'UNKNOWN'))return unknown;
   coverage='BOTH_CONFIGS';
  }else{
   if(r.code!=='UNKNOWN'||r.reason!==stop?.code&&!(partialCodes as readonly string[]).includes(r.reason))return unknown;
   // read/metadata/close 실패의 alias는 직전 USER만이다. 두 번째 parser 이후 가능한 실패는 시간창뿐이다.
   if((partialCodes as readonly string[]).includes(r.reason)&&r.reason!=='WINDOW_EXPIRED'&&(files.length!==1||stop))return unknown;
  }
  return Object.freeze({status:'COMPARISON_ONLY',readiness:'UNCONFIRMED',coverage,binding,reason:r.reason,files,diagnostics,additional:a.additional,stop,outputSha256:contentHash(bytes)});
 }catch{return unknown;}finally{bytes?.fill(0);}
}
