import {types} from 'node:util';
import {canonicalJson,contentHash} from '../canonical.ts';
import {cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from './validation-v1.ts';

export interface QaBDocumentResultBindingV1 {
 projectId:string;executionId:string;executionGeneration:number;credentialGeneration:number;
 registrationRef:Ref;grantRef:Ref;assignmentRef:Ref;sessionBindingRef:Ref;sessionDigest:string;
 dispatchAttemptRef:Ref;instructionRef:Ref;partsRef:Ref;envelopeHash:string;inputReceiptRef:Ref;
}
export interface QaBDocumentResultExpectationV1 {
 binding:QaBDocumentResultBindingV1;documentKind:'DESIGN'|'WORK_PLAN';inputRef:Ref;resultRef:Ref;
 providerCorrelationRef:Ref;outputRef:Ref;
}

const maxBytes=2*1024*1024;
const refs=['registrationRef','grantRef','assignmentRef','sessionBindingRef','dispatchAttemptRef','instructionRef','partsRef','inputReceiptRef'] as const;
const shape=(v:unknown,keys:readonly string[]):v is Record<string,any>=>!types.isProxy(v)&&recordV1(v,keys);
const ref=(v:unknown):v is Ref=>!types.isProxy(v)&&refV1(v);
const single=(v:unknown):v is Ref=>ref(v)&&v.version===1;
const positive=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const kind=(v:unknown)=>v==='DESIGN'||v==='WORK_PLAN';
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const invalid=():never=>{throw Error('QA_B_DOCUMENT_RESULT_PROVENANCE_INVALID');};

function binding(v:unknown):v is QaBDocumentResultBindingV1 {
 return shape(v,['projectId','executionId','executionGeneration','credentialGeneration',...refs,'sessionDigest','envelopeHash'])&&
  uuidV1(v.projectId)&&uuidV1(v.executionId)&&positive(v.executionGeneration)&&positive(v.credentialGeneration)&&
  refs.every(key=>ref(v[key]))&&hashV1(v.sessionDigest)&&hashV1(v.envelopeHash);
}

/** 호출자가 독립 검산한 보호 참조와 바이트의 일치만 확인한다. SDK의 인과 보장이나 저장 권위를 발급하지 않는다. */
export function verifyQaBDocumentResultProvenanceV1(rawInput:unknown,rawResult:unknown,rawExpected:unknown,body:Uint8Array){
 if(!shape(rawExpected,['binding','documentKind','inputRef','resultRef','providerCorrelationRef','outputRef'])||
    !binding(rawExpected.binding)||!kind(rawExpected.documentKind)||
    ![rawExpected.inputRef,rawExpected.resultRef,rawExpected.providerCorrelationRef,rawExpected.outputRef].every(single))return invalid();
 const expected=rawExpected as QaBDocumentResultExpectationV1;
 const all=[expected.inputRef,expected.resultRef,expected.providerCorrelationRef,expected.outputRef,expected.binding.dispatchAttemptRef,expected.binding.inputReceiptRef];
 if(new Set(all.map(value=>value.id)).size!==all.length)return invalid();
 if(!shape(rawInput,['ref','snapshot'])||!single(rawInput.ref)||!same(rawInput.ref,expected.inputRef)||
    !shape(rawInput.snapshot,['schemaVersion','kind','binding','documentKind','userMessageId','inputMessageDigest','yieldedAt']))return invalid();
 const input=rawInput.snapshot;
 if(input.schemaVersion!==1||input.kind!=='QA_B_DOCUMENT_SEND_INPUT'||!binding(input.binding)||!same(input.binding,expected.binding)||
    input.documentKind!==expected.documentKind||!uuidV1(input.userMessageId)||!hashV1(input.inputMessageDigest)||!isoV1(input.yieldedAt)||
    contentHash(canonicalJson(input))!==rawInput.ref.contentHash)return invalid();
 if(!shape(rawResult,['ref','snapshot'])||!single(rawResult.ref)||!same(rawResult.ref,expected.resultRef)||
    !shape(rawResult.snapshot,['schemaVersion','kind','binding','documentKind','inputRef','providerCorrelationRef','outputRef','payloadDigest','userMessageId','resultFamily','observedAt','resultText']))return invalid();
 const result=rawResult.snapshot;
 if(result.schemaVersion!==1||result.kind!=='QA_B_DOCUMENT_SEND_RESULT'||!binding(result.binding)||!same(result.binding,expected.binding)||
    result.documentKind!==expected.documentKind||!single(result.inputRef)||!same(result.inputRef,expected.inputRef)||
    !single(result.providerCorrelationRef)||!same(result.providerCorrelationRef,expected.providerCorrelationRef)||
    !single(result.outputRef)||!same(result.outputRef,expected.outputRef)||!hashV1(result.payloadDigest)||
    result.userMessageId!==input.userMessageId||result.resultFamily!=='RESULT_SUCCESS'||!isoV1(result.observedAt)||result.observedAt<input.yieldedAt||
    typeof result.resultText!=='string'||result.resultText.length>maxBytes||!result.resultText.isWellFormed()||!result.resultText.trim()||
    !ArrayBuffer.isView(body)||!(body instanceof Uint8Array)||body.byteLength>maxBytes)return invalid();
 const original=Buffer.from(result.resultText,'utf8');
 if(original.byteLength>maxBytes||!original.equals(body)||contentHash(canonicalJson(result))!==rawResult.ref.contentHash)return invalid();
 return cloneV1({inputRef:expected.inputRef,resultRef:expected.resultRef,providerCorrelationRef:expected.providerCorrelationRef,
  outputRef:expected.outputRef,bodyHash:contentHash(original),bodyBytes:original.byteLength});
}
