import {AuthFailure} from '../access/repository.ts';
import {types} from 'node:util';
import {canonicalJson,parseWireJson} from '../../../../contracts/canonical.ts';
import {receiveLimits,receiveRecord,receiveUuid,receiveRef,receiveCanonical,receiveInvalid,readReceiveProof} from '../../../../contracts/runtime/native-first-receive-v1.ts';
import {readNativePreparationCommand} from './native-preparation-input.ts';
/** 새 Offer의 소유 외피만 검산한다. 원 native parser/상한은 그대로 소비한다. */
export function parseReceiveControl(raw:string):any{if(typeof raw!=='string'||!raw.isWellFormed()||Buffer.byteLength(raw)>receiveLimits.control)receiveInvalid();return parseWireJson(raw);}
export function parseReceiveOfferCommand(raw:string):any{
 if(typeof raw!=='string'||!raw.isWellFormed()||Buffer.byteLength(raw)>receiveLimits.offerBody)receiveInvalid();
 // JSON.parse와 별도로 전체 token의 중복 key를 검산한다. 원 command의 깊이는 자체 parser가 소유한다.
 let v:any;try{v=JSON.parse(raw);}catch{return receiveInvalid();}
 const stack:{keys:Set<string>|null;key:boolean}[]=[];for(const token of raw.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g)??[]){if(token==='{'||token==='[')stack.push({keys:token==='{'?new Set():null,key:token==='{'});else if(token==='}'||token===']')stack.pop();else{const f=stack.at(-1);if(!f?.keys)continue;if(token===',')f.key=true;else if(token===':')f.key=false;else if(f.key&&token.startsWith('"')){const key=JSON.parse(token);if(f.keys.has(key))receiveInvalid();f.keys.add(key);}}}
 if(!receiveRecord(v,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||v.schemaVersion!==1||![v.projectId,v.commandId,v.clientId].every(receiveUuid)||!Number.isSafeInteger(v.controlGeneration)||v.controlGeneration<1||v.operation!=='offerNativeReceiveCommand'||v.approvalRef!==null||!Array.isArray(v.baselineRefs)||v.baselineRefs.length||!receiveRecord(v.payload,['windowRef','command'])||!receiveRef(v.payload.windowRef)||v.payload.windowRef.version!==1||v.targetId!==v.payload.windowRef.id||v.expectedVersion!==1)receiveInvalid();
 const c=readNativePreparationCommand(v.payload.command);if(c.projectId!==v.projectId||c.clientId!==v.clientId||c.controlGeneration!==v.controlGeneration)receiveInvalid();v.payload.command=c;for(const[k,x]of Object.entries(v))if(k!=='payload')receiveCanonical(x);receiveCanonical(v.payload.windowRef);return v;
}

/** 원 native body/hash를 바꾸지 않는 신규 header 전용 검산이다. 실제 ARM/current 권위는 별도 검산한다. */
export function readNativeReceiveArmHeader(headers:unknown,rawHeaders:unknown){
 if(!headers||typeof headers!=='object'||types.isProxy(headers)||!Array.isArray(rawHeaders)||rawHeaders.length%2||rawHeaders.some(v=>typeof v!=='string'))receiveInvalid();
 const name='x-anvil-native-receive-arm';let seen=0,rawValue:string|undefined;
 for(let n=0;n<rawHeaders.length;n+=2){const key=rawHeaders[n].toLowerCase();if(!key.startsWith('x-anvil-native-receive-'))continue;if(key!==name)receiveInvalid();seen++;rawValue=rawHeaders[n+1];}
 for(const key of Object.getOwnPropertyNames(headers))if(key.toLowerCase().startsWith('x-anvil-native-receive-')&&key!==name)receiveInvalid();
 const descriptor=Object.getOwnPropertyDescriptor(headers,name);if(!descriptor&&seen===0)return null;if(!descriptor||!('value'in descriptor)||seen!==1||typeof descriptor.value!=='string'||descriptor.value!==rawValue)receiveInvalid();
 const encoded=descriptor.value;if(encoded.length!==184||!/^[A-Za-z0-9_-]+$/.test(encoded))receiveInvalid();const bytes=Buffer.from(encoded,'base64url');if(bytes.length!==138||bytes.toString('base64url')!==encoded)receiveInvalid();
 let text:string,value:unknown;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);value=parseWireJson(text);}catch{return receiveInvalid();}
 if(!receiveRef(value)||value.version!==1||receiveCanonical(value)!==text)receiveInvalid();return JSON.parse(text);
}

const humanFields=['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'];
export function readNativeReceiveHumanCommand(raw:unknown):Record<string,any>{
 if(!receiveRecord(raw,humanFields)||raw.schemaVersion!==1||![raw.projectId,raw.commandId,raw.clientId].every(receiveUuid)||!Number.isSafeInteger(raw.controlGeneration)||raw.controlGeneration<1||!Array.isArray(raw.baselineRefs)||raw.baselineRefs.length!==0||raw.approvalRef!==null)receiveInvalid();
 if(raw.operation==='prepareNativeReceiveWindow'){
  if(raw.targetId!==null||raw.expectedVersion!==0||!receiveRecord(raw.payload,['registrationRef','localReceiveAttemptId','profileRef'])||!receiveRef(raw.payload.registrationRef)||!receiveRef(raw.payload.profileRef)||!receiveUuid(raw.payload.localReceiveAttemptId))receiveInvalid();
 }else if(raw.operation==='closeNativeReceiveWindow'){
  if(!receiveRecord(raw.payload,['windowRef','reason'])||!receiveRef(raw.payload.windowRef)||raw.payload.windowRef.version!==1||raw.targetId!==raw.payload.windowRef.id||raw.expectedVersion!==1||raw.payload.reason!=='USER_CANCELLED')receiveInvalid();
 }else if(raw.operation==='offerNativeReceiveCommand'){
  if(!receiveRecord(raw.payload,['windowRef','command'])||!receiveRef(raw.payload.windowRef)||raw.payload.windowRef.version!==1||raw.targetId!==raw.payload.windowRef.id||raw.expectedVersion!==1)receiveInvalid();
  const command=readNativePreparationCommand(raw.payload.command);if(command.projectId!==raw.projectId||command.clientId!==raw.clientId||command.controlGeneration!==raw.controlGeneration)receiveInvalid();const value={...raw,payload:{windowRef:raw.payload.windowRef,command}};
  const encoded=humanFields.slice().sort().map(key=>JSON.stringify(key)+':'+(key==='payload'?'{"command":'+canonicalJson(command)+',"windowRef":'+receiveCanonical(raw.payload.windowRef)+'}':receiveCanonical(raw[key]))).join(',');if(Buffer.byteLength('{'+encoded+'}')>receiveLimits.offerBody)receiveInvalid();return value;
 }else receiveInvalid();
 const canonical=receiveCanonical(raw);if(Buffer.byteLength(canonical)>receiveLimits.control)receiveInvalid();return JSON.parse(canonical);
}
/** 서버 소유 외피와 검산한 원 native command를 분리해 원 깊이/bytes/hash를 유지한다. */
export function receiveHumanCommandCanonical(raw:unknown){const v=readNativeReceiveHumanCommand(raw);if(v.operation!=='offerNativeReceiveCommand')return receiveCanonical(v);return'{'+humanFields.slice().sort().map(key=>JSON.stringify(key)+':'+(key==='payload'?'{"command":'+canonicalJson(v.payload.command)+',"windowRef":'+receiveCanonical(v.payload.windowRef)+'}':receiveCanonical(v[key]))).join(',')+'}';}

/** 새 수신 전용 proof header의 원문만 검산한다. 서명 권위와 현재성은 실제 OPEN owner가 검산한다. */
export function readNativeReceiveProofHeaders(headers:unknown,rawHeaders:unknown){
 if(!headers||typeof headers!=='object'||types.isProxy(headers)||!Array.isArray(rawHeaders)||types.isProxy(rawHeaders)||rawHeaders.length%2)receiveInvalid();const allowed=['x-anvil-native-receive-proof','x-anvil-native-receive-signature'],values=new Map<string,string>();
 for(let i=0;i<rawHeaders.length;i+=2){const kd=Object.getOwnPropertyDescriptor(rawHeaders,String(i)),vd=Object.getOwnPropertyDescriptor(rawHeaders,String(i+1));if(!kd||!vd||!('value'in kd)||!('value'in vd)||typeof kd.value!=='string'||typeof vd.value!=='string')receiveInvalid();const name=kd.value.toLowerCase();if(!name.startsWith('x-anvil-native-'))continue;if(!allowed.includes(name)||values.has(name))receiveInvalid();values.set(name,vd.value);}
 for(const name of Object.getOwnPropertyNames(headers))if(name.toLowerCase().startsWith('x-anvil-native-')&&!allowed.includes(name))receiveInvalid();for(const name of allowed){const d=Object.getOwnPropertyDescriptor(headers,name);if(!d||!('value'in d)||typeof d.value!=='string'||d.value!==values.get(name))receiveInvalid();}
 const encoded=values.get(allowed[0]!)!,signature=values.get(allowed[1]!)!;if(encoded.length>Math.ceil(receiveLimits.control*4/3)||!/^[A-Za-z0-9_-]+$/.test(encoded)||signature.length!==86||!/^[A-Za-z0-9_-]{85}[AQgw]$/.test(signature))receiveInvalid();const bytes=Buffer.from(encoded,'base64url'),sig=Buffer.from(signature,'base64url');if(bytes.length>receiveLimits.control||bytes.toString('base64url')!==encoded||sig.length!==64||sig.toString('base64url')!==signature)receiveInvalid();let text:string,proof:any;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);proof=readReceiveProof(parseWireJson(text));if(receiveCanonical(proof)!==text)receiveInvalid();}catch{return receiveInvalid();}return{proof,signature};
}
export function readNativeReceiveChallengeInput(raw:unknown){
 if(!receiveRecord(raw,['schemaVersion','requestId','phase','offerRef','armRef','deliveryRef','authorityRef','commandHash'])||raw.schemaVersion!==1||!receiveUuid(raw.requestId)||!['STREAM','ARM','ACK','STATE','CLOSE'].includes(raw.phase))receiveInvalid();const required:Record<string,readonly string[]>={STREAM:[],ARM:['offerRef','commandHash'],ACK:['offerRef','armRef','deliveryRef','authorityRef','commandHash'],STATE:[],CLOSE:[]};for(const key of ['offerRef','armRef','deliveryRef','authorityRef','commandHash']){const value=raw[key];if(required[raw.phase]!.includes(key)){if(key==='commandHash'?(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value)):(!receiveRef(value)||value.version!==1))receiveInvalid();}else if(value!==null)receiveInvalid();}return structuredClone(raw);
}
export function readNativeReceiveCredentialHeader(headers:unknown,rawHeaders:unknown):string{
 if(!headers||typeof headers!=='object'||types.isProxy(headers)||!Array.isArray(rawHeaders)||types.isProxy(rawHeaders)||rawHeaders.length%2)receiveInvalid();let value:string|undefined,count=0;for(let i=0;i<rawHeaders.length;i+=2){const k=Object.getOwnPropertyDescriptor(rawHeaders,String(i)),v=Object.getOwnPropertyDescriptor(rawHeaders,String(i+1));if(!k||!v||!('value'in k)||!('value'in v)||typeof k.value!=='string'||typeof v.value!=='string')receiveInvalid();if(k.value.toLowerCase()==='authorization'){count++;value=v.value;}}
 const d=Object.getOwnPropertyDescriptor(headers,'authorization');if(count!==1||!d||!('value'in d)||typeof d.value!=='string'||d.value!==value||!/^AnvilReceive [A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value!))receiveInvalid();return value!.slice(13);
}
export function readNativeReceivePhaseBody(phase:unknown,raw:unknown){
 if(typeof phase!=='string'||!['STREAM','ARM','STATE','CLOSE'].includes(phase))receiveInvalid();const keys=phase==='STREAM'?[]:phase==='ARM'?['schemaVersion','windowRef','offerRef','commandHash']:phase==='CLOSE'?['schemaVersion','windowRef','reason']:['schemaVersion','windowRef'];if(!receiveRecord(raw,keys))receiveInvalid();if(phase!=='STREAM'&&(raw.schemaVersion!==1||!receiveRef(raw.windowRef)||raw.windowRef.version!==1))receiveInvalid();if(phase==='ARM'&&(!receiveRef(raw.offerRef)||raw.offerRef.version!==1||typeof raw.commandHash!=='string'||!/^[a-f0-9]{64}$/.test(raw.commandHash)))receiveInvalid();if(phase==='CLOSE'&&raw.reason!=='USER_CANCELLED')receiveInvalid();const text=receiveCanonical(raw);if(Buffer.byteLength(text)>receiveLimits.control)receiveInvalid();return JSON.parse(text);
}

const failureNames=new Set(['NATIVE_RECEIVE_INPUT_INVALID','AUTH_REQUIRED','NATIVE_RECEIVE_AUTH_REQUIRED','NATIVE_RECEIVE_PURPOSE_DENIED','NATIVE_RECEIVE_NOT_FOUND','NATIVE_RECEIVE_CONFLICT','NATIVE_RECEIVE_CONTEXT_CHANGED','NATIVE_RECEIVE_IN_FLIGHT','NATIVE_RECEIVE_EXPIRED','NATIVE_RECEIVE_REVOKED','NATIVE_RECEIVE_PROFILE_UNAVAILABLE','REAUTHENTICATION_REQUIRED','APPROVAL_BASIS_NOT_CURRENT','NATIVE_RECEIVE_WIRE_LIMIT','NATIVE_RECEIVE_ADMISSION_DENIED','NATIVE_RECEIVE_OWNER_UNAVAILABLE','NATIVE_RECEIVE_SOURCE_UNAVAILABLE','NATIVE_RECEIVE_OUTCOME_UNKNOWN','INPUT_INVALID','NOT_FOUND','CSRF_INVALID','PROJECT_OPERATION_DENIED','PROJECT_WRITE_DENIED','PROJECT_CONTROL_REQUIRED','CONTROL_GENERATION_CONFLICT','IDEMPOTENCY_CONFLICT','PROJECT_ARCHIVED','PERMISSION_POLICY_UNCONFIGURED','NATIVE_SOURCE_UNAVAILABLE']);
/** 예외 객체를 반사하기 전에 prototype chain 전체를 확인한다. 공개 입력·권한 검산기가 아니다. */
export function nativeReceiveClassifyFailure(error:unknown):Readonly<{safe:boolean;authCode:string|null;status:number|null;sqlAuth:boolean;frameworkCode:string|null}>{
 const unsafe=()=>Object.freeze({safe:false,authCode:null,status:null,sqlAuth:false,frameworkCode:null});if(!error||typeof error!=='object')return unsafe();let node:object|null=error,auth=false;const seen=new Set<object>();try{for(let depth=0;node!==null;depth++){if(depth>=32||types.isProxy(node)||seen.has(node))return unsafe();seen.add(node);if(node===AuthFailure.prototype)auth=true;node=Object.getPrototypeOf(node);}const descriptors=['message','statusCode','code'].map(key=>Object.getOwnPropertyDescriptor(error,key));if(descriptors.some(d=>d&&!('value'in d)))return unsafe();const message=descriptors[0]?.value,status=descriptors[1]?.value,code=descriptors[2]?.value;return Object.freeze({safe:true,authCode:auth&&typeof message==='string'&&failureNames.has(message)?message:null,status:Number.isSafeInteger(status)?status:null,sqlAuth:code==='42501'&&message==='NATIVE_RECEIVE_AUTH_REQUIRED',frameworkCode:typeof code==='string'&&['FST_ERR_CTP_BODY_TOO_LARGE','FST_ERR_CTP_INVALID_MEDIA_TYPE','FST_ERR_CTP_EMPTY_JSON_BODY','FST_ERR_CTP_INVALID_JSON_BODY'].includes(code)?code:null});}catch{return unsafe();}
}

/** 새 HUMAN 읽기 본문에는 phase나 현재성 선언을 받지 않는다. */
export function readNativeReceivePhaseCurrentInput(raw:unknown){if(!receiveRecord(raw,['schemaVersion','receiveSessionRef','challengeRef'])||raw.schemaVersion!==1||!receiveRef(raw.receiveSessionRef)||raw.receiveSessionRef.version!==1||!receiveRef(raw.challengeRef)||raw.challengeRef.version!==1)receiveInvalid();return JSON.parse(receiveCanonical(raw))as {schemaVersion:1;receiveSessionRef:{id:string;version:number;contentHash:string};challengeRef:{id:string;version:number;contentHash:string}};}
