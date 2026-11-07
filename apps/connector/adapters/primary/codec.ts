import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {requestMethods,approvalMethods,notificationMethods,validateRequest,validateInbound,validateResult,validateError,validateInitialized} from './schemas.ts';
import type {CodexMethod,InboundMethod} from './schemas.ts';

type Code='CODEC_UNUSABLE'|'INPUT_INVALID'|'UNSUPPORTED_METHOD'|'SCHEMA_INVALID'|'INITIALIZATION_WIRE_NOT_READY'|'INITIALIZE_RESPONSE_REQUIRED'|'INITIALIZE_ALREADY_PREPARED'|'INITIALIZED_ALREADY_PREPARED'|'DUPLICATE_REQUEST_ID'|'REQUEST_ID_BUDGET_EXHAUSTED'|'PENDING_LIMIT'|'FRAME_TOO_LARGE'|'CHUNK_TOO_LARGE'|'EMPTY_FRAME'|'MALFORMED_FRAME'|'UNMATCHED_RESPONSE'|'CONTEXT_MISMATCH'|'CONTEXT_PENDING'|'PARTIAL_FRAME_EOF'|'PENDING_RESPONSE_EOF'|'TRANSPORT_ERROR'|'REMOTE_RPC_ERROR'|'SERVER_DECISION_VERIFIER_NOT_CONNECTED';
type FactKind='PROTOCOL_UNKNOWN'|'CONTEXT_UNVERIFIED'|'RPC_RESPONSE'|'RPC_ERROR'|'INTERRUPT_RESPONSE'|'TOOL_APPROVAL_REQUIRED'|'TURN_FACT'|'THREAD_FACT'|'ITEM_FACT'|'OUTPUT_FACT'|'TOOL_ERROR_FACT'|'STREAM_CLOSED';
export interface CodecFact{
 readonly kind:FactKind;readonly code?:Code|'PROTECTED_CAPTURE_FAILED';readonly method?:CodexMethod|InboundMethod;
 readonly requestIdDigest?:string;readonly requestDigest?:string;readonly contextDigest?:string;readonly payloadDigest?:string;
 readonly toolStatus?:'completed'|'interrupted'|'failed'|'inProgress';
 readonly automaticDecision?:false;
 readonly executionAuthorized:false;readonly workAccepted:false;readonly ownership:'UNVERIFIED';
}
type Rejected={readonly kind:'REJECTED';readonly code:Code;readonly executionAuthorized:false;readonly dispatched:false};
type Encoded={readonly kind:'ENCODED';readonly wire:Uint8Array;readonly executionAuthorized:false;readonly dispatched:false};
interface Pending{method:CodexMethod;id:string|number;threadId?:string;turnId?:string}
interface Context{threadId:string;turnId?:string}
export interface ProtectedSessionCapture {
 method:'thread/start'|'turn/start'|'turn/steer';requestIdDigest:string;payloadDigest:string;threadId:string;turnId:string|null;
}
/** Internal explicit port. RECORDED is the port's claim, not proof of OS protection or server acceptance. */
export interface ProtectedSessionCapturePort {capture(value:Readonly<ProtectedSessionCapture>):unknown}
function rejected(code:Code):Rejected{return {kind:'REJECTED',code,executionAuthorized:false,dispatched:false};}
function fact(value:Omit<CodecFact,'executionAuthorized'|'workAccepted'|'ownership'>):CodecFact{return {...value,executionAuthorized:false,workAccepted:false,ownership:'UNVERIFIED'};}
function object(v:unknown):v is Record<string,any>{return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function hash(v:unknown):string{return contentHash(canonicalJson(v));}
function id(v:unknown):v is string|number{return (typeof v==='string'&&v.isWellFormed())||(typeof v==='number'&&Number.isSafeInteger(v));}
function onlyKeys(v:Record<string,unknown>,allowed:readonly string[]):boolean{return Object.keys(v).every(k=>allowed.includes(k));}

// 큰 본문을 JSON 문자열/복제/Buffer로 만들기 전에 직렬화 바이트 예산에서 중단한다.
// 입력 객체 자체와 JS reflection 메타데이터/VM 메모리까지 제한하는 OS quota는 아니다.
function preflight(value:unknown,maxBytes:number):void{
 let bytes=0;const active=new Set<object>();
 const invalid=():never=>{throw Error('INPUT_INVALID');};
 const add=(n:number)=>{bytes+=n;if(bytes>maxBytes)throw Error('FRAME_TOO_LARGE');};
 function string(s:string):void{
  add(2);
  for(let n=0;n<s.length;n++){
   const c=s.charCodeAt(n);
   if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)add(2);
   else if(c<32)add(6);
   else if(c<128)add(1);
   else if(c<2048)add(2);
   else if(c>=0xd800&&c<=0xdbff){const low=s.charCodeAt(++n);if(!(low>=0xdc00&&low<=0xdfff))invalid();add(4);}
   else if(c>=0xdc00&&c<=0xdfff)invalid();
   else add(3);
  }
 }
 function visit(item:unknown,depth:number):void{
  if(depth>64)invalid();
  if(item===null){add(4);return;}
  if(typeof item==='boolean'){add(item?4:5);return;}
  if(typeof item==='string'){string(item);return;}
  if(typeof item==='number'){if(!Number.isFinite(item)||(Number.isInteger(item)&&!Number.isSafeInteger(item)))invalid();add(JSON.stringify(item).length);return;}
  if(typeof item!=='object'||active.has(item)||Object.getOwnPropertySymbols(item).length)invalid();
  const objectItem=item as object,proto=Object.getPrototypeOf(objectItem);
  if(!Array.isArray(item)&&proto!==Object.prototype&&proto!==null)invalid();
  active.add(objectItem);
  try{
   add(2);
   if(Array.isArray(item)){
    for(let n=0;n<item.length;n++){
     if(n)add(1);const d=Object.getOwnPropertyDescriptor(item,String(n));if(!d||!('value' in d))invalid();visit(d!.value,depth+1);
    }
    if(Object.getOwnPropertyNames(item).length!==item.length+1)invalid();
   }else{
    let n=0;
    for(const key of Object.getOwnPropertyNames(objectItem).sort()){
     if(n++)add(1);string(key);add(1);const d=Object.getOwnPropertyDescriptor(objectItem,key);
     if(!d||!d.enumerable||!('value' in d))invalid();visit(d!.value,depth+1);
    }
   }
  }finally{active.delete(objectItem);}
 }
 visit(value,0);
}

/** 메모리 wire/사실 codec뿐이다. transport·서버 허가·영속 receipt·OS 회수를 제공하지 않는다. */
export class Codex0161Codec{
 readonly #maxFrameBytes:number;readonly #maxPending:number;readonly #buffer:Uint8Array;
 #length=0;#state:'OPEN'|'UNKNOWN'|'CLOSED'='OPEN';
 #initializePrepared=false;#initializeResponse=false;#initializedPrepared=false;
 readonly #pending=new Map<string,Pending>();
 readonly #contexts=new Map<string,true>();
 readonly #threads=new Map<string,true>();
 readonly #provisional=new Map<string,Context>();
 readonly #usedIds=new Set<string>();
 readonly #capture:((value:Readonly<ProtectedSessionCapture>)=>unknown)|undefined;
 #capturing=false;
 constructor(options:{maxFrameBytes:number;maxPending:number},protectedPort?:ProtectedSessionCapturePort){
  let value:any;try{value=JSON.parse(canonicalJson(options));}catch{throw Error('CODEC_OPTIONS_INVALID');}
  // 내부 인스턴스 메모리 상한. 서버/실제 stdio 정책이나 완료·권한 계약이 아니다.
  if(!object(value)||!onlyKeys(value,['maxFrameBytes','maxPending'])||!Number.isSafeInteger(value.maxFrameBytes)||value.maxFrameBytes<1||value.maxFrameBytes>2097152||!Number.isSafeInteger(value.maxPending)||value.maxPending<1||value.maxPending>1024)throw Error('CODEC_OPTIONS_INVALID');
  if(protectedPort!==undefined){const descriptor=Object.getOwnPropertyDescriptor(protectedPort,'capture');if(!descriptor||!('value'in descriptor)||typeof descriptor.value!=='function')throw Error('CODEC_OPTIONS_INVALID');this.#capture=descriptor.value.bind(protectedPort);}
  this.#maxFrameBytes=value.maxFrameBytes;this.#maxPending=value.maxPending;this.#buffer=new Uint8Array(value.maxFrameBytes+1);
 }
 #remember(threadId:string,turnId:string):void{
  const key=canonicalJson([threadId,turnId]);
  this.#contexts.delete(key);this.#contexts.set(key,true);
  while(this.#contexts.size>this.#maxPending)this.#contexts.delete(this.#contexts.keys().next().value!);
 }
 #rememberThread(threadId:string):void{
  this.#threads.delete(threadId);this.#threads.set(threadId,true);
  while(this.#threads.size>this.#maxPending)this.#threads.delete(this.#threads.keys().next().value!);
 }
 #bound(context:Context):boolean{return context.turnId===undefined?this.#threads.has(context.threadId):this.#contexts.has(canonicalJson([context.threadId,context.turnId]));}
 #canResolve(context:Context):boolean{
  for(const pending of this.#pending.values()){
   if(context.turnId===undefined){if(pending.method==='thread/start'||(pending.method==='thread/resume'&&pending.threadId===context.threadId))return true;}
   else if(pending.method==='turn/start'&&pending.threadId===context.threadId)return true;
  }
  return false;
 }
 #reconcile():boolean{
  for(const [key,context] of this.#provisional){if(this.#bound(context))this.#provisional.delete(key);else if(!this.#canResolve(context))return false;}
  return true;
 }
 #unknown(code:Code|'PROTECTED_CAPTURE_FAILED',kind:'PROTOCOL_UNKNOWN'|'CONTEXT_UNVERIFIED'='PROTOCOL_UNKNOWN'):CodecFact{
  this.#state='UNKNOWN';this.#buffer.fill(0);this.#length=0;this.#pending.clear();this.#contexts.clear();this.#threads.clear();this.#provisional.clear();
  return fact({kind,code});
 }
 #wire(value:unknown):Encoded|Rejected{
  try{preflight(value,this.#maxFrameBytes);}catch(error){return rejected(error instanceof Error&&error.message==='FRAME_TOO_LARGE'?'FRAME_TOO_LARGE':'INPUT_INVALID');}
  const wire=Buffer.from(canonicalJson(value)+'\n','utf8');
  if(wire.byteLength-1>this.#maxFrameBytes)return rejected('FRAME_TOO_LARGE');
  return {kind:'ENCODED',wire,executionAuthorized:false,dispatched:false};
 }
 encodeRequest(method:unknown,requestId:unknown,params:unknown):Encoded|Rejected{
  if(this.#capturing)return rejected('CODEC_UNUSABLE');
  if(this.#state!=='OPEN')return rejected('CODEC_UNUSABLE');
  if(this.#provisional.size)return rejected('CONTEXT_PENDING');
  if(typeof method!=='string'||!requestMethods.includes(method as CodexMethod))return rejected('UNSUPPORTED_METHOD');
  if(!id(requestId))return rejected('INPUT_INVALID');
  try{preflight({id:requestId,method,params},this.#maxFrameBytes);}catch(error){return rejected(error instanceof Error&&error.message==='FRAME_TOO_LARGE'?'FRAME_TOO_LARGE':'INPUT_INVALID');}
  const name=method as CodexMethod,key=canonicalJson(requestId);
  if(name==='initialize'&&this.#initializePrepared)return rejected('INITIALIZE_ALREADY_PREPARED');
  if(name!=='initialize'&&!this.#initializedPrepared)return rejected('INITIALIZATION_WIRE_NOT_READY');
  const idDigest=contentHash(key);
  if(this.#usedIds.has(idDigest))return rejected('DUPLICATE_REQUEST_ID');
  if(this.#pending.size>=this.#maxPending)return rejected('PENDING_LIMIT');
  if(this.#usedIds.size>=1024){this.#unknown('REQUEST_ID_BUDGET_EXHAUSTED');return rejected('REQUEST_ID_BUDGET_EXHAUSTED');}
  let value:any;try{value=JSON.parse(canonicalJson({id:requestId,method:name,params}));}catch{return rejected('INPUT_INVALID');}
  if(!validateRequest(name,value))return rejected('SCHEMA_INVALID');
  const wire=this.#wire(value);if(wire.kind==='REJECTED')return wire;
  // 지시/config/본문을 pending에 보관하지 않는다. 상관관계용 최소 식별만 유지한다.
  const pending:Pending={method:name,id:requestId};
  if(typeof value.params.threadId==='string')pending.threadId=value.params.threadId;
  if(name==='turn/interrupt')pending.turnId=value.params.turnId;
  if(name==='turn/steer')pending.turnId=value.params.expectedTurnId;
  this.#pending.set(key,pending);
  this.#usedIds.add(idDigest);
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
  if(this.#capturing)return [this.#unknown('PROTECTED_CAPTURE_FAILED')];
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
  if(this.#capturing)return [this.#unknown('PROTECTED_CAPTURE_FAILED')];
  if(this.#state!=='OPEN')return [fact({kind:'PROTOCOL_UNKNOWN',code:'CODEC_UNUSABLE'})];
  if(reason!=='EOF')return [this.#unknown('TRANSPORT_ERROR')];
  if(this.#length)return [this.#unknown('PARTIAL_FRAME_EOF')];
  if(this.#pending.size)return [this.#unknown('PENDING_RESPONSE_EOF')];
  this.#state='CLOSED';this.#contexts.clear();this.#threads.clear();this.#provisional.clear();this.#buffer.fill(0);
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
  const context:Context={threadId,...(turnId===undefined?{}:{turnId})};
  if(!this.#bound(context)){
   if(!this.#canResolve(context))return this.#unknown('CONTEXT_MISMATCH','CONTEXT_UNVERIFIED');
   const key=canonicalJson([threadId,turnId??null]);
   if(!this.#provisional.has(key)&&this.#provisional.size>=this.#maxPending)return this.#unknown('PENDING_LIMIT','CONTEXT_UNVERIFIED');
   // 원문/완료/승인으로 승격하지 않고 최소 식별만 보류한다. 정확 응답 수신 전 새 요청 금지.
   this.#provisional.set(key,context);
   return fact({kind:'CONTEXT_UNVERIFIED',code:'CONTEXT_PENDING',method,payloadDigest:hash(p)});
  }
  const payloadDigest=hash(p),contextDigest=hash({threadId,turnId:turnId??null,itemId:p.itemId??p.item?.id??null});
  if(request)return fact({kind:'TOOL_APPROVAL_REQUIRED',method,requestDigest:hash(value),contextDigest,payloadDigest,automaticDecision:false});
  if(method==='turn/started'||method==='turn/completed')return fact({kind:'TURN_FACT',method,toolStatus:p.turn.status,contextDigest,payloadDigest});
  if(method==='thread/started'||method==='thread/status/changed')return fact({kind:'THREAD_FACT',method,payloadDigest});
  if(method==='error')return fact({kind:'TOOL_ERROR_FACT',method,contextDigest,payloadDigest});
  return fact({kind:method==='item/commandExecution/outputDelta'||method==='item/agentMessage/delta'?'OUTPUT_FACT':'ITEM_FACT',method,contextDigest,payloadDigest});
 }
 #response(value:Record<string,any>):CodecFact{
  const isError=Object.hasOwn(value,'error');
  if(!id(value.id)||!onlyKeys(value,isError?['id','error']:['id','result'])||Object.hasOwn(value,'result')===isError)return this.#unknown('SCHEMA_INVALID');
  const key=canonicalJson(value.id),pending=this.#pending.get(key);
  if(!pending)return this.#unknown('UNMATCHED_RESPONSE');
  if(isError){
   if(!validateError(value))return this.#unknown('SCHEMA_INVALID');
   this.#pending.delete(key);
   if(!this.#reconcile())return this.#unknown('CONTEXT_MISMATCH');
   if(pending.method==='initialize')this.#unknown('REMOTE_RPC_ERROR');
   return fact({kind:'RPC_ERROR',code:'REMOTE_RPC_ERROR',method:pending.method,requestIdDigest:hash(pending.id),payloadDigest:hash(value.error)});
  }
  if(!validateResult(pending.method,value.result))return this.#unknown('SCHEMA_INVALID');
  const result=value.result;
  if((pending.method==='turn/steer'&&result.turnId!==pending.turnId)||(pending.method==='thread/resume'&&result.thread.id!==pending.threadId))return this.#unknown('CONTEXT_MISMATCH');
  this.#pending.delete(key);
  if(pending.method==='initialize')this.#initializeResponse=true;
  if(pending.method==='turn/start'&&pending.threadId!==undefined)this.#remember(pending.threadId,result.turn.id);
  if(pending.method==='thread/start'||pending.method==='thread/resume'){
   this.#rememberThread(result.thread.id);
   for(const turn of result.thread.turns)this.#remember(result.thread.id,turn.id);
  }
  if(!this.#reconcile())return this.#unknown('CONTEXT_MISMATCH');
  const requestIdDigest=hash(pending.id),payloadDigest=hash(result);
  if(this.#capture&&['thread/start','turn/start','turn/steer'].includes(pending.method)){
   const threadId=pending.method==='thread/start'?result.thread.id:pending.threadId;
   const turnId=pending.method==='thread/start'?null:pending.method==='turn/start'?result.turn.id:result.turnId;
   const handle=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/.test(v);
   if(!handle(threadId)||(turnId!==null&&!handle(turnId)))return this.#unknown('PROTECTED_CAPTURE_FAILED');
   this.#capturing=true;
   try{
    const recorded=this.#capture(Object.freeze({method:pending.method as ProtectedSessionCapture['method'],requestIdDigest,payloadDigest,threadId,turnId}));
    if(recorded instanceof Promise)void recorded.catch(()=>{});
    if(recorded!=='RECORDED'||this.#state!=='OPEN')return this.#unknown('PROTECTED_CAPTURE_FAILED');
   }catch{return this.#unknown('PROTECTED_CAPTURE_FAILED');}finally{this.#capturing=false;}
  }
  return fact({kind:pending.method==='turn/interrupt'?'INTERRUPT_RESPONSE':'RPC_RESPONSE',method:pending.method,requestIdDigest,payloadDigest});
 }
}
