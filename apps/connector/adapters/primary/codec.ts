import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {requestMethods,approvalMethods,notificationMethods,validateRequest,validateInbound,validateResult,validateError,validateInitialized} from './schemas.ts';
import type {CodexMethod,InboundMethod} from './schemas.ts';

type Code='CODEC_UNUSABLE'|'INPUT_INVALID'|'UNSUPPORTED_METHOD'|'SCHEMA_INVALID'|'INITIALIZATION_WIRE_NOT_READY'|'INITIALIZE_RESPONSE_REQUIRED'|'INITIALIZE_ALREADY_PREPARED'|'INITIALIZED_ALREADY_PREPARED'|'DUPLICATE_REQUEST_ID'|'PENDING_LIMIT'|'FRAME_TOO_LARGE'|'CHUNK_TOO_LARGE'|'EMPTY_FRAME'|'MALFORMED_FRAME'|'UNMATCHED_RESPONSE'|'CONTEXT_MISMATCH'|'PARTIAL_FRAME_EOF'|'PENDING_RESPONSE_EOF'|'TRANSPORT_ERROR'|'REMOTE_RPC_ERROR'|'SERVER_DECISION_VERIFIER_NOT_CONNECTED';
type FactKind='PROTOCOL_UNKNOWN'|'CONTEXT_UNVERIFIED'|'RPC_RESPONSE'|'RPC_ERROR'|'INTERRUPT_RESPONSE'|'TOOL_APPROVAL_REQUIRED'|'TURN_FACT'|'THREAD_FACT'|'ITEM_FACT'|'OUTPUT_FACT'|'TOOL_ERROR_FACT'|'STREAM_CLOSED';
export interface CodecFact{
 readonly kind:FactKind;readonly code?:Code;readonly method?:CodexMethod|InboundMethod;
 readonly requestIdDigest?:string;readonly requestDigest?:string;readonly contextDigest?:string;readonly payloadDigest?:string;
 readonly toolStatus?:'completed'|'interrupted'|'failed'|'inProgress';
 readonly automaticDecision?:false;
 readonly executionAuthorized:false;readonly workAccepted:false;readonly ownership:'UNVERIFIED';
}
type Rejected={readonly kind:'REJECTED';readonly code:Code;readonly executionAuthorized:false;readonly dispatched:false};
type Encoded={readonly kind:'ENCODED';readonly wire:Uint8Array;readonly executionAuthorized:false;readonly dispatched:false};
interface Pending{method:CodexMethod;id:string|number;threadId?:string;turnId?:string}
function rejected(code:Code):Rejected{return {kind:'REJECTED',code,executionAuthorized:false,dispatched:false};}
function fact(value:Omit<CodecFact,'executionAuthorized'|'workAccepted'|'ownership'>):CodecFact{return {...value,executionAuthorized:false,workAccepted:false,ownership:'UNVERIFIED'};}
function object(v:unknown):v is Record<string,any>{return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function hash(v:unknown):string{return contentHash(canonicalJson(v));}
function id(v:unknown):v is string|number{return (typeof v==='string'&&v.isWellFormed())||(typeof v==='number'&&Number.isSafeInteger(v));}
function onlyKeys(v:Record<string,unknown>,allowed:readonly string[]):boolean{return Object.keys(v).every(k=>allowed.includes(k));}

/** 메모리 wire/사실 codec뿐이다. transport·서버 허가·영속 receipt·OS 회수를 제공하지 않는다. */
export class Codex0161Codec{
 readonly #maxFrameBytes:number;readonly #maxPending:number;readonly #buffer:Uint8Array;
 #length=0;#state:'OPEN'|'UNKNOWN'|'CLOSED'='OPEN';
 #initializePrepared=false;#initializeResponse=false;#initializedPrepared=false;
 readonly #pending=new Map<string,Pending>();
 readonly #contexts=new Map<string,true>();
 constructor(options:{maxFrameBytes:number;maxPending:number}){
  let value:any;try{value=JSON.parse(canonicalJson(options));}catch{throw Error('CODEC_OPTIONS_INVALID');}
  // 내부 인스턴스 메모리 상한. 서버/실제 stdio 정책이나 완료·권한 계약이 아니다.
  if(!object(value)||!onlyKeys(value,['maxFrameBytes','maxPending'])||!Number.isSafeInteger(value.maxFrameBytes)||value.maxFrameBytes<1||value.maxFrameBytes>2097152||!Number.isSafeInteger(value.maxPending)||value.maxPending<1||value.maxPending>1024)throw Error('CODEC_OPTIONS_INVALID');
  this.#maxFrameBytes=value.maxFrameBytes;this.#maxPending=value.maxPending;this.#buffer=new Uint8Array(value.maxFrameBytes+1);
 }
 #remember(threadId:string,turnId:string):void{
  const key=canonicalJson([threadId,turnId]);
  this.#contexts.delete(key);this.#contexts.set(key,true);
  while(this.#contexts.size>this.#maxPending)this.#contexts.delete(this.#contexts.keys().next().value!);
 }
 #unknown(code:Code,kind:'PROTOCOL_UNKNOWN'|'CONTEXT_UNVERIFIED'='PROTOCOL_UNKNOWN'):CodecFact{
  this.#state='UNKNOWN';this.#buffer.fill(0);this.#length=0;this.#pending.clear();this.#contexts.clear();
  return fact({kind,code});
 }
 #wire(value:unknown):Encoded|Rejected{
  const wire=Buffer.from(canonicalJson(value)+'\n','utf8');
  if(wire.byteLength-1>this.#maxFrameBytes)return rejected('FRAME_TOO_LARGE');
  return {kind:'ENCODED',wire,executionAuthorized:false,dispatched:false};
 }
 encodeRequest(method:unknown,requestId:unknown,params:unknown):Encoded|Rejected{
  if(this.#state!=='OPEN')return rejected('CODEC_UNUSABLE');
  if(typeof method!=='string'||!requestMethods.includes(method as CodexMethod))return rejected('UNSUPPORTED_METHOD');
  if(!id(requestId))return rejected('INPUT_INVALID');
  const name=method as CodexMethod,key=canonicalJson(requestId);
  if(name==='initialize'&&this.#initializePrepared)return rejected('INITIALIZE_ALREADY_PREPARED');
  if(name!=='initialize'&&!this.#initializedPrepared)return rejected('INITIALIZATION_WIRE_NOT_READY');
  if(this.#pending.has(key))return rejected('DUPLICATE_REQUEST_ID');
  if(this.#pending.size>=this.#maxPending)return rejected('PENDING_LIMIT');
  let value:any;try{value=JSON.parse(canonicalJson({id:requestId,method:name,params}));}catch{return rejected('INPUT_INVALID');}
  if(!validateRequest(name,value))return rejected('SCHEMA_INVALID');
  const wire=this.#wire(value);if(wire.kind==='REJECTED')return wire;
  // 지시/config/본문을 pending에 보관하지 않는다. 상관관계용 최소 식별만 유지한다.
  const pending:Pending={method:name,id:requestId};
  if(typeof value.params.threadId==='string')pending.threadId=value.params.threadId;
  if(name==='turn/interrupt')pending.turnId=value.params.turnId;
  if(name==='turn/steer')pending.turnId=value.params.expectedTurnId;
  this.#pending.set(key,pending);
  if(name==='initialize')this.#initializePrepared=true;
  if(pending.threadId!==undefined&&pending.turnId!==undefined)this.#remember(pending.threadId,pending.turnId);
  return wire;
 }
 encodeInitialized():Encoded|Rejected{
  if(this.#state!=='OPEN')return rejected('CODEC_UNUSABLE');
  if(!this.#initializeResponse)return rejected('INITIALIZE_RESPONSE_REQUIRED');
  if(this.#initializedPrepared)return rejected('INITIALIZED_ALREADY_PREPARED');
  const value={method:'initialized'};if(!validateInitialized(value))return rejected('SCHEMA_INVALID');
  const wire=this.#wire(value);if(wire.kind==='ENCODED')this.#initializedPrepared=true;
  return wire;
 }
 /** 서버의 실제 결정 검증/소비 미연결. caller 주장과 무관하게 응답 wire를 만들지 않는다. */
 encodeToolDecision(_requestDigest:unknown,_externalDecision:unknown){
  return {kind:'REJECTED' as const,code:'SERVER_DECISION_VERIFIER_NOT_CONNECTED' as const,state:'UNVERIFIED' as const,executionAuthorized:false as const,dispatched:false as const};
 }
 push(chunk:Uint8Array):CodecFact[]{
  if(this.#state!=='OPEN')return [fact({kind:'PROTOCOL_UNKNOWN',code:'CODEC_UNUSABLE'})];
  if(!(chunk instanceof Uint8Array))return [this.#unknown('INPUT_INVALID')];
  if(chunk.byteLength>this.#maxFrameBytes+2)return [this.#unknown('CHUNK_TOO_LARGE')];
  const facts:CodecFact[]=[];
  for(const byte of chunk){
   if(byte===10){
    const size=this.#length>0&&this.#buffer[this.#length-1]===13?this.#length-1:this.#length;
    if(size===0){facts.push(this.#unknown('EMPTY_FRAME'));break;}
    if(size>this.#maxFrameBytes){facts.push(this.#unknown('FRAME_TOO_LARGE'));break;}
    let value:unknown;
    try{value=parseWireJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(this.#buffer.subarray(0,size)));}
    catch{facts.push(this.#unknown('MALFORMED_FRAME'));break;}
    this.#buffer.fill(0,0,this.#length);this.#length=0;
    facts.push(this.#message(value));if(this.#state!=='OPEN')break;
   }else{
    if(this.#length>=this.#maxFrameBytes&&(this.#length>this.#maxFrameBytes||byte!==13)){facts.push(this.#unknown('FRAME_TOO_LARGE'));break;}
    this.#buffer[this.#length++]=byte;
   }
  }
  return facts;
 }
 finish(reason:'EOF'|'TRANSPORT_ERROR'='EOF'):CodecFact[]{
  if(this.#state!=='OPEN')return [fact({kind:'PROTOCOL_UNKNOWN',code:'CODEC_UNUSABLE'})];
  if(reason!=='EOF')return [this.#unknown('TRANSPORT_ERROR')];
  if(this.#length)return [this.#unknown('PARTIAL_FRAME_EOF')];
  if(this.#pending.size)return [this.#unknown('PENDING_RESPONSE_EOF')];
  this.#state='CLOSED';this.#contexts.clear();this.#buffer.fill(0);
  return [fact({kind:'STREAM_CLOSED'})];
 }
 #message(value:unknown):CodecFact{
  if(!object(value))return this.#unknown('SCHEMA_INVALID');
  if(Object.hasOwn(value,'result')||Object.hasOwn(value,'error'))return this.#response(value);
  const request=Object.hasOwn(value,'id'),methods=request?approvalMethods:notificationMethods;
  if(typeof value.method!=='string'||!(methods as readonly string[]).includes(value.method))return this.#unknown('UNSUPPORTED_METHOD');
  if(!onlyKeys(value,request?['id','method','params','trace']:['method','params']))return this.#unknown('SCHEMA_INVALID');
  const method=value.method as InboundMethod;
  if(!validateInbound(method,value,request))return this.#unknown('SCHEMA_INVALID');
  const p=value.params;
  const threadId=method==='thread/started'?p.thread.id:p.threadId;
  const turnId=method==='turn/started'||method==='turn/completed'?p.turn.id:p.turnId;
  // thread/started has no turn; only a matching in-memory thread request can attribute it.
  const bound=method==='thread/started'
   ?[...this.#pending.values()].some(v=>v.threadId===threadId)
   :this.#contexts.has(canonicalJson([threadId,turnId]));
  if(!bound)return this.#unknown('CONTEXT_MISMATCH','CONTEXT_UNVERIFIED');
  const payloadDigest=hash(p),contextDigest=hash({threadId,turnId:turnId??null,itemId:p.itemId??p.item?.id??null});
  if(request)return fact({kind:'TOOL_APPROVAL_REQUIRED',method,requestDigest:hash(value),contextDigest,payloadDigest,automaticDecision:false});
  if(method==='turn/started'||method==='turn/completed')return fact({kind:'TURN_FACT',method,toolStatus:p.turn.status,contextDigest,payloadDigest});
  if(method==='thread/started')return fact({kind:'THREAD_FACT',method,payloadDigest});
  if(method==='error')return fact({kind:'TOOL_ERROR_FACT',method,contextDigest,payloadDigest});
  return fact({kind:method==='item/commandExecution/outputDelta'?'OUTPUT_FACT':'ITEM_FACT',method,contextDigest,payloadDigest});
 }
 #response(value:Record<string,any>):CodecFact{
  const isError=Object.hasOwn(value,'error');
  if(!id(value.id)||!onlyKeys(value,isError?['id','error']:['id','result'])||Object.hasOwn(value,'result')===isError)return this.#unknown('SCHEMA_INVALID');
  const key=canonicalJson(value.id),pending=this.#pending.get(key);
  if(!pending)return this.#unknown('UNMATCHED_RESPONSE');
  if(isError){
   if(!validateError(value))return this.#unknown('SCHEMA_INVALID');
   this.#pending.delete(key);
   if(pending.method==='initialize'){this.#state='UNKNOWN';this.#contexts.clear();}
   return fact({kind:'RPC_ERROR',code:'REMOTE_RPC_ERROR',method:pending.method,requestIdDigest:hash(pending.id),payloadDigest:hash(value.error)});
  }
  if(!validateResult(pending.method,value.result))return this.#unknown('SCHEMA_INVALID');
  const result=value.result;
  if((pending.method==='turn/steer'&&result.turnId!==pending.turnId)||(pending.method==='thread/resume'&&result.thread.id!==pending.threadId))return this.#unknown('CONTEXT_MISMATCH');
  this.#pending.delete(key);
  if(pending.method==='initialize')this.#initializeResponse=true;
  if(pending.method==='turn/start'&&pending.threadId!==undefined)this.#remember(pending.threadId,result.turn.id);
  if(pending.method==='thread/start'||pending.method==='thread/resume'){
   for(const turn of result.thread.turns)this.#remember(result.thread.id,turn.id);
  }
  return fact({kind:pending.method==='turn/interrupt'?'INTERRUPT_RESPONSE':'RPC_RESPONSE',method:pending.method,requestIdDigest:hash(pending.id),payloadDigest:hash(result)});
 }
}
