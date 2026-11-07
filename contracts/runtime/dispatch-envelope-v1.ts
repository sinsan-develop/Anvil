import {canonicalJson,contentHash} from '../canonical.ts';
import {recordV1,refV1,uuidV1,hashV1,isoV1,cloneV1,type RuntimeRefV1} from './validation-v1.ts';
import {readSourceScopesV1,type SourceScopeV1} from './source-scope-v1.ts';
export interface AdapterContextV1{projectId:string;assignmentId:string;executionId:string;executionGeneration:number;connectionRef:RuntimeRefV1;environmentRef:RuntimeRefV1;authorizationReceiptRef:RuntimeRefV1;capabilityRef:RuntimeRefV1;budgetRef:RuntimeRefV1;sourceScopes:SourceScopeV1[]}
type Payloads={START_SESSION:{contextBundleRef:RuntimeRefV1;optionsRef:RuntimeRefV1};SEND_INSTRUCTION:{sessionBindingRef:RuntimeRefV1;instructionRef:RuntimeRefV1;partsRef:RuntimeRefV1};REQUEST_STOP:{sessionBindingRef:RuntimeRefV1;stopScopeRef:RuntimeRefV1}};
type EnvelopeBase={schemaVersion:1;commandId:string;issuedAt:string;expiresAt:string;executorRegistrationRef:RuntimeRefV1;context:AdapterContextV1;envelopeHash:string};
export type DispatchEnvelopeV1={[K in keyof Payloads]:EnvelopeBase&{operation:K;payload:Payloads[K]}}[keyof Payloads];
const contextKeys=['projectId','assignmentId','executionId','executionGeneration','connectionRef','environmentRef','authorizationReceiptRef','capabilityRef','budgetRef','sourceScopes'];
const payloadKeys={START_SESSION:['contextBundleRef','optionsRef'],SEND_INSTRUCTION:['sessionBindingRef','instructionRef','partsRef'],REQUEST_STOP:['sessionBindingRef','stopScopeRef']};
/** schema/hash/시각 적합은 인증·서버 현재 권한/OS 소유/실행 허가가 아니다. */
export function readDispatchEnvelopeV1(value:unknown,nowMs:number):DispatchEnvelopeV1{
 const fail=():never=>{throw Error('ENVELOPE_INVALID');};
 if(!recordV1(value,['schemaVersion','commandId','issuedAt','expiresAt','executorRegistrationRef','context','operation','payload','envelopeHash'])||value.schemaVersion!==1||!uuidV1(value.commandId)||!isoV1(value.issuedAt)||!isoV1(value.expiresAt)||!refV1(value.executorRegistrationRef)||!hashV1(value.envelopeHash)||!recordV1(value.context,contextKeys)||!Number.isSafeInteger(nowMs))return fail();
 const c=value.context;if(!['projectId','assignmentId','executionId'].every(k=>uuidV1(c[k]))||!Number.isSafeInteger(c.executionGeneration)||c.executionGeneration<1||!['connectionRef','environmentRef','authorizationReceiptRef','capabilityRef','budgetRef'].every(k=>refV1(c[k])))return fail();
 try{readSourceScopesV1(c.sourceScopes);}catch{return fail();}
 if(typeof value.operation!=='string'||!Object.hasOwn(payloadKeys,value.operation))return fail();const fields=payloadKeys[value.operation as keyof Payloads];
 if(!recordV1(value.payload,fields)||!fields.every(k=>refV1(value.payload[k])))return fail();
 const issued=Date.parse(value.issuedAt),expires=Date.parse(value.expiresAt);if(expires<=issued||expires-issued>2*60*60*1000)return fail();
 const {envelopeHash,...unsigned}=value,encoded=canonicalJson(unsigned);if(Buffer.byteLength(encoded,'utf8')>2*1024*1024||contentHash(encoded)!==envelopeHash)return fail();
 if(nowMs<issued)throw Error('ENVELOPE_NOT_YET_VALID');if(nowMs>=expires)throw Error('ENVELOPE_EXPIRED');return cloneV1(value) as DispatchEnvelopeV1;
}
