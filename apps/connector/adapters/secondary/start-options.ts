import {isProxy,isUint8Array} from 'node:util/types';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,hashV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {SyntheticMaterialReceiver} from '../../runtime/execution-material-receiver.ts';
import {boundedSdkObject,maxSdkObjectBytes} from './schemas.ts';
type Checks={clock:()=>number;check:()=>boolean};
const originalStartOptions=SyntheticMaterialReceiver.prototype.startOptions;
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=():never=>{throw Error('CLAUDE_START_OPTIONS_UNAVAILABLE');};
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const child of Object.values(v))freeze(child);Object.freeze(v);}return v;}
/** 두 수신 경로가 공유하는 데이터 검산. 기본값·도구·실행 환경·권위를 추가하지 않는다. */
export function readClaudeQueryParams(value:unknown){
 const raw=boundedSdkObject(value,maxSdkObjectBytes).value;
 if(!recordV1(raw,['claudeQueryParams']))return fail();const p=raw.claudeQueryParams;
 if(!p||typeof p!=='object'||Array.isArray(p)||!Object.hasOwn(p,'model')||Object.keys(p).some(k=>!['model','maxTurns','maxBudgetUsd'].includes(k))||typeof p.model!=='string'||!p.model.isWellFormed()||p.model.length<1||p.model.length>200||!p.model.trim()||/\p{Cc}/u.test(p.model))return fail();
 if(Object.hasOwn(p,'maxTurns')&&(!Number.isSafeInteger(p.maxTurns)||p.maxTurns<1)||Object.hasOwn(p,'maxBudgetUsd')&&(typeof p.maxBudgetUsd!=='number'||!Number.isFinite(p.maxBudgetUsd)||p.maxBudgetUsd<0||p.maxBudgetUsd>Number.MAX_SAFE_INTEGER))return fail();
 return freeze({model:p.model,...(Object.hasOwn(p,'maxTurns')?{maxTurns:p.maxTurns}:{}),...(Object.hasOwn(p,'maxBudgetUsd')?{maxBudgetUsd:p.maxBudgetUsd}:{})});
}
/** 등록 완료나 SDK 호출 허가가 아닌 private 데이터 후보다. 실제 receiver의 원 수신 검산만 재사용한다. */
export async function readClaudeStartOptions(receiver:SyntheticMaterialReceiver,rawEnvelope:unknown,checks:Checks){
 let owned:Uint8Array|undefined,receivedOwned:Uint8Array|undefined;
 try{
  if(!receiver||isProxy(receiver)||Object.getPrototypeOf(receiver)!==SyntheticMaterialReceiver.prototype||SyntheticMaterialReceiver.prototype.startOptions!==originalStartOptions||!checks||isProxy(checks)||!recordV1(checks,['clock','check']))return fail();
  const clock=Object.getOwnPropertyDescriptor(checks,'clock')!.value,check=Object.getOwnPropertyDescriptor(checks,'check')!.value;if(typeof clock!=='function'||typeof check!=='function')return fail();
  const now=()=>{const at=Reflect.apply(clock,checks,[]);if(typeof at!=='number'||!Number.isSafeInteger(at)||!Number.isFinite(new Date(at).getTime()))return fail();return at as number;};
  const started=now(),snapshot=boundedSdkObject(rawEnvelope,maxSdkObjectBytes).value,envelope=readDispatchEnvelopeV1(snapshot,started);
  if(envelope.operation!=='START_SESSION'||same(envelope.payload.contextBundleRef,envelope.payload.optionsRef)||Reflect.apply(check,checks,[])!==true)return fail();
  const received=await Reflect.apply(originalStartOptions,receiver,[envelope]);
  if(!received||isProxy(received)||!recordV1(received,['transport','key','envelopeHash','contextBundleRef','optionsRef','materialReceiptRef','utf8Bytes','contentHash','bytes']))return fail();
  const bytes=Object.getOwnPropertyDescriptor(received,'bytes')!.value;
  if(isProxy(bytes)||!isUint8Array(bytes))return fail();receivedOwned=bytes;
  const metadata=boundedSdkObject(Object.fromEntries(Object.entries(received).filter(([key])=>key!=='bytes')),maxSdkObjectBytes).value;
  const key={projectId:envelope.context.projectId,executionId:envelope.context.executionId,executionGeneration:envelope.context.executionGeneration,commandId:envelope.commandId};
  if(metadata.transport!=='SYNTHETIC_ONLY'||!recordV1(metadata.key,['projectId','executionId','executionGeneration','commandId'])||!uuidV1(metadata.key.commandId)||!same(metadata.key,key)||metadata.envelopeHash!==envelope.envelopeHash||!same(metadata.contextBundleRef,envelope.payload.contextBundleRef)||!same(metadata.optionsRef,envelope.payload.optionsRef)||!refV1(metadata.materialReceiptRef)||metadata.materialReceiptRef.version!==1||!Number.isSafeInteger(metadata.utf8Bytes)||metadata.utf8Bytes<1||metadata.utf8Bytes>maxSdkObjectBytes||!hashV1(metadata.contentHash))return fail();
  const byteLength=Reflect.apply(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength')!.get!,bytes,[]);
  if(byteLength!==metadata.utf8Bytes)return fail();owned=new Uint8Array(byteLength);Uint8Array.prototype.set.call(owned,bytes);
  if(contentHash(owned)!==metadata.contentHash||owned[0]===0xef&&owned[1]===0xbb&&owned[2]===0xbf)return fail();
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(owned),raw=boundedSdkObject(parseWireJson(text),maxSdkObjectBytes).value;
  const params=readClaudeQueryParams(raw);
  if(Reflect.apply(check,checks,[])!==true)return fail();const at=now();if(at<started)return fail();readDispatchEnvelopeV1(envelope,at);
  return freeze({kind:'CLAUDE_QUERY_DATA_CANDIDATE' as const,transport:'SYNTHETIC_ONLY' as const,key,contextBundleRef:metadata.contextBundleRef,optionsRef:metadata.optionsRef,materialReceiptRef:metadata.materialReceiptRef,envelopeHash:metadata.envelopeHash,utf8Bytes:metadata.utf8Bytes,contentHash:metadata.contentHash,params,paramsHash:contentHash(canonicalJson(params)),actualExecutionVerified:false as const,executionAuthorized:false as const,dispatched:false as const,workAccepted:false as const,modelVerified:false as const,costAuthorized:false as const,permissionVerified:false as const});
 }catch{return fail();}finally{owned?.fill(0);receivedOwned?.fill(0);}
}
