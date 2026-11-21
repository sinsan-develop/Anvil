import {isProxy} from 'node:util/types';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../contracts/runtime/validation-v1.ts';
import {boundedSdkObject,maxSdkObjectBytes,sdkMessageShape} from '../adapters/secondary/schemas.ts';

const MiB=1024*1024,scopeRefs=['registrationRef','profileRef','assignmentRef','slotRef','grantRef','startReadyRef','dispatchAttemptRef','sessionBindingRef'] as const;
type Scope={projectId:string;executionId:string;generation:number;plannedSidDigest:string}&Record<typeof scopeRefs[number],Ref>;
export interface NormalUnderstandingResponseRequest {scope:Scope;initConfirmationRef:Ref;tailRef:Ref;firstSequence:number;lastSequence:number}
interface Binding {scope:Scope;mode:'CONTEXT_REVIEW';bundleRef:Ref;subjectBindingRef:Ref;basisRefs:Ref[];requiredPartRefs:Ref[];receivedPartRefs:Ref[];checkedAt:string;expiresAt:string}
/** 보호 응답 decoder도 원 reader와 같은 선택/현재성 형상만 검산한다. 공급자 권위는 발급하지 않는다. */
export function readNormalUnderstandingSelection(raw:unknown,current:unknown,at:number){
 const req=boundedSdkObject(raw,MiB).value;
 if(!exact(req,['scope','initConfirmationRef','tailRef','firstSequence','lastSequence'])||!scope(req.scope)||!refV1(req.initConfirmationRef)||!refV1(req.tailRef)||!positive(req.firstSequence)||!positive(req.lastSequence)||req.lastSequence<req.firstSequence||req.lastSequence>10000||req.lastSequence-req.firstSequence>=200)bad();
 return {request:cloneV1(req) as NormalUnderstandingResponseRequest,binding:binding(current,req.scope,at)};
}
export interface NormalUnderstandingDiscoveryBinding {scope:Scope;requestRef:Ref;acquisitionRef:Ref;contextBundleRef:Ref;checkedAt:string;expiresAt:string}
export interface NormalUnderstandingDiscoveryProjection {
 attribution:'SESSION_ONLY';projectId:string;executionId:string;executionGeneration:number;requestRef:Ref;acquisitionRef:Ref;contextBundleRef:Ref;
 initConfirmationRef:Ref;tailRef:Ref;ranges:{outputRef:Ref;sequence:number;payloadDigest:string;textBlocks:number;textBytes:number}[];
 wholeConversationComplete:false;executionAuthorized:false;
}
function discoveryBinding(raw:unknown,expected:Scope,at:number):NormalUnderstandingDiscoveryBinding{
 const v=boundedSdkObject(raw,MiB).value;
 if(!exact(v,['scope','requestRef','acquisitionRef','contextBundleRef','checkedAt','expiresAt'])||!scope(v.scope)||!equal(v.scope,expected)||!['requestRef','acquisitionRef','contextBundleRef'].every(k=>refV1(v[k]))||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>at||at-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)<=at)bad();
 return v as NormalUnderstandingDiscoveryBinding;
}
/** 동일 원 read의 전체 chain과 정상 close에서 메타데이터만 도출한다. 권위 발급은 없다. */
export async function readNormalUnderstandingDiscovery(raw:NormalUnderstandingDiscoveryBinding,source:NormalUnderstandingResponseSource,signal:AbortSignal):Promise<NormalUnderstandingDiscoveryProjection>{
 return await readSource(raw,source,signal,true) as NormalUnderstandingDiscoveryProjection;
}
interface Reader {rowCount:number;read(sequence:number):Promise<unknown>}
/** 내부 보호 읽기 접점. 공급자는 동일 등록/slot/FIRST 및 원 스풀의 정상 종결을 입증해야 한다.
 * 이 interface/반환값은 HUMAN 허가나 normal 공급자 인증을 발급하지 않는다. HTTP caller에 공개하지 않는다. */
export interface NormalUnderstandingResponseSource {
 clock():number;
 current():unknown;
 withRead(body:(reader:Reader)=>Promise<void>):Promise<void>;
}
interface Part {outputRef:Ref;sequence:number;payloadDigest:string;blockIndex:number;kind:'ASSISTANT_TEXT';text:string;textHash:string}
export interface NormalUnderstandingResponseProjection {
 attribution:'SESSION_ONLY';projectId:string;executionId:string;executionGeneration:number;
 bundleRef:Ref;subjectBindingRef:Ref;basisRefs:Ref[];initConfirmationRef:Ref;tailRef:Ref;
 firstSequence:number;lastSequence:number;beforeRef:Ref|null;afterRef:Ref|null;parts:Part[];
 wholeConversationComplete:false;executionAuthorized:false;
}
const bad=():never=>{throw Error('NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE');};
const equal=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
const exact=(v:unknown,keys:readonly string[]):v is Record<string,any>=>!isProxy(v)&&recordV1(v,keys);
const requiredRef=(v:unknown):Ref=>{if(!refV1(v))return bad();return cloneV1(v);};
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const refs=(v:unknown):v is Ref[]=>arrayV1(v,200)&&v.length>0&&v.every(refV1)&&new Set(v.map(canonicalJson)).size===v.length;
function scope(v:unknown):v is Scope{return exact(v,['projectId','executionId','generation','plannedSidDigest',...scopeRefs])&&uuidV1(v.projectId)&&uuidV1(v.executionId)&&positive(v.generation)&&hashV1(v.plannedSidDigest)&&scopeRefs.every(k=>refV1(v[k]));}
function binding(raw:unknown,expected:Scope,at:number):Binding{
 const v=boundedSdkObject(raw,MiB).value;
 if(!exact(v,['scope','mode','bundleRef','subjectBindingRef','basisRefs','requiredPartRefs','receivedPartRefs','checkedAt','expiresAt'])||!scope(v.scope)||!equal(v.scope,expected)||v.mode!=='CONTEXT_REVIEW'||!refV1(v.bundleRef)||!refV1(v.subjectBindingRef)||!refs(v.basisRefs)||!refs(v.requiredPartRefs)||!refs(v.receivedPartRefs)||!v.requiredPartRefs.every((r:Ref)=>v.receivedPartRefs.some((p:Ref)=>equal(p,r)))||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>at||at-Date.parse(v.checkedAt)>30000||Date.parse(v.expiresAt)<=at)bad();
 return v as Binding;
}
const stable=(v:Binding|NormalUnderstandingDiscoveryBinding)=>{const{checkedAt:_,expiresAt:__,...rest}=v;return rest;};

/** 동일 보호 read가 정상 종결한 뒤에만 고정 text projection을 반환한다.
 * 공급자의 실제 출처/HUMAN 정책/거래 권위는 별도 선행이며 기본 공급자·normal 인증 marker는 없다. */
export async function readNormalUnderstandingResponse(raw:NormalUnderstandingResponseRequest,source:NormalUnderstandingResponseSource,signal:AbortSignal):Promise<NormalUnderstandingResponseProjection>{
 return await readSource(raw,source,signal,false) as NormalUnderstandingResponseProjection;
}
async function readSource(raw:NormalUnderstandingResponseRequest|NormalUnderstandingDiscoveryBinding,source:NormalUnderstandingResponseSource,signal:AbortSignal,discovery:boolean):Promise<NormalUnderstandingResponseProjection|NormalUnderstandingDiscoveryProjection>{
 let timer:ReturnType<typeof setTimeout>|undefined,abort=()=>{},live=true;
 try{
  const req=boundedSdkObject(raw,MiB).value;
  if((!discovery&&(!exact(req,['scope','initConfirmationRef','tailRef','firstSequence','lastSequence'])||!scope(req.scope)||!refV1(req.initConfirmationRef)||!refV1(req.tailRef)||!positive(req.firstSequence)||!positive(req.lastSequence)||req.lastSequence<req.firstSequence||req.lastSequence>10000||req.lastSequence-req.firstSequence>=200))||!exact(source,['clock','current','withRead'])||Object.values(source).some(v=>typeof v!=='function'||isProxy(v))||!(signal instanceof AbortSignal)||signal.aborted)bad();
  const request=cloneV1(req) as NormalUnderstandingResponseRequest,ports={...source};
  let last=ports.clock(),end=last+30000,monoEnd=performance.now()+30000;
  if(!Number.isSafeInteger(last))bad();
  const readBinding=discovery?discoveryBinding:binding;
  if(discovery)discoveryBinding(req,req.scope,last);
  const initial=readBinding(ports.current(),request.scope,last),base=stable(initial);
  if(discovery&&!equal(req,initial))bad();
  const guard=()=>{
   if(!live||signal.aborted||!exact(source,['clock','current','withRead'])||source.clock!==ports.clock||source.current!==ports.current||source.withRead!==ports.withRead)bad();
   const at=ports.clock();if(!Number.isSafeInteger(at)||at<last)bad();last=at;
   const current=readBinding(ports.current(),request.scope,at);if(!equal(base,stable(current)))bad();
   end=Math.min(end,Date.parse(initial.expiresAt),Date.parse(current.expiresAt));monoEnd=Math.min(monoEnd,performance.now()+end-at);
   if(at>=end||performance.now()>=monoEnd)bad();
  };
  guard();
  const expired=new Promise<never>((_,reject)=>{abort=()=>{live=false;reject(Error('NORMAL_UNDERSTANDING_SOURCE_UNAVAILABLE'));};});
  void expired.catch(()=>undefined);signal.addEventListener('abort',abort,{once:true});
  timer=setTimeout(abort,Math.max(0,Math.min(end-last,monoEnd-performance.now())));
  const ranges:NormalUnderstandingDiscoveryProjection['ranges']=[];let discoveredInit:Ref|null=null,blocks=0;
  const parts:Part[]=[],ids=new Set<string>(),identities=new Set<string>();let called=false,completed=false,previous:Ref|null=null,beforeRef:Ref|null=null,afterRef:Ref|null=null,confirmed=false,prefix=hash([]),total=0,selectionBytes=0,projectionBytes=0,previousTime=-Infinity,lastFamily:string|null=null,initSeen=false;
  const read=ports.withRead(async reader=>{
   try{
   guard();if(called||!exact(reader,['rowCount','read'])||!positive(reader.rowCount)||reader.rowCount>10000||!discovery&&request.lastSequence>reader.rowCount||typeof reader.read!=='function'||isProxy(reader.read))bad();called=true;
   const rowCount=reader.rowCount,readRow=reader.read;
   for(let n=1;n<=rowCount;n++){
    guard();if(reader.rowCount!==rowCount||reader.read!==readRow)bad();
    const rawRow=await readRow.call(reader,n);guard();
    const r=boundedSdkObject(rawRow,3*MiB).value,s=r.snapshot;
    total+=Buffer.byteLength(canonicalJson(r))+1;
    if(total>64*MiB||!exact(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||ids.has(r.ref.id)||r.ref.contentHash!==hash(s)||!equal(s.scope,request.scope)||s.schemaVersion!==1||s.sequence!==n||!equal(s.previousRef,previous)||!isoV1(s.observedAt)||Date.parse(s.observedAt)>last||Date.parse(s.observedAt)<previousTime)bad();
    ids.add(r.ref.id);previousTime=Date.parse(s.observedAt);
    if(n===request.firstSequence)beforeRef=cloneV1(previous);
    if(n===request.lastSequence+1)afterRef=cloneV1(r.ref);
    const selected=!discovery&&n>=request.firstSequence&&n<=request.lastSequence;
    if(selected){selectionBytes+=Buffer.byteLength(canonicalJson(r))+1;if(selectionBytes>2*MiB)bad();}
    if(s.state==='SESSION_INIT_CONFIRMED'){
     if(selected||confirmed||!exact(s,['schemaVersion','state','scope','sequence','previousRef','initOutputRef','observedSidDigest','prefixCount','tailRef','prefixDigest','observedAt'])||!discovery&&!equal(r.ref,request.initConfirmationRef)||lastFamily!=='SYSTEM_INIT'||!equal(s.initOutputRef,previous)||!equal(s.tailRef,previous)||s.prefixCount!==n-1||s.prefixDigest!==prefix||s.observedSidDigest!==request.scope.plannedSidDigest)bad();confirmed=true;discoveredInit=cloneV1(r.ref);
    }else{
     if(!exact(s,['schemaVersion','state','scope','sequence','previousRef','initConfirmationRef','observedAt','family','identity','payloadDigest','classification','body'])||s.state!==(confirmed?'SESSION_OUTPUT':'OUTPUT_PENDING_SESSION')||!equal(s.initConfirmationRef,confirmed?(discovery?discoveredInit:request.initConfirmationRef):null)||!['ORDINARY','QUARANTINED'].includes(s.classification)||typeof s.body!=='string'||s.body.length>Math.ceil(maxSdkObjectBytes/3)*4||!hashV1(s.payloadDigest))bad();
     const bytes=Buffer.from(s.body,'base64');
     try{
      if(bytes.length>maxSdkObjectBytes||bytes.toString('base64')!==s.body||contentHash(bytes)!==s.payloadDigest)bad();
      const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),m=boundedSdkObject(JSON.parse(text),maxSdkObjectBytes).value,type=sdkMessageShape(m);
      if(type.state!=='SUPPORTED')return bad();
      if(canonicalJson(m)!==text||type.family!==s.family||s.identity!==hash(type.uuid)||identities.has(s.identity)||hash(type.sessionId)!==request.scope.plannedSidDigest||type.family==='SYSTEM_INIT'&&confirmed)bad();
      if(type.family==='SYSTEM_INIT'){if(initSeen)bad();initSeen=true;}
      identities.add(s.identity);
      if(discovery){
       if(s.classification!=='ORDINARY')bad();
       if(type.family==='ASSISTANT'){
        if(m.parent_tool_use_id!==null||Object.hasOwn(m,'error')||!arrayV1(m.message.content,200)||!m.message.content.length||Object.hasOwn(m.message,'role')&&m.message.role!=='assistant')bad();
        let textBytes=0;for(const block of m.message.content){if(!exact(block,['type','text'])||block.type!=='text'||typeof block.text!=='string'||!block.text.trim())bad();textBytes+=Buffer.byteLength(block.text);}
        blocks+=m.message.content.length;if(blocks>200||ranges.length>=200)bad();
        ranges.push({outputRef:cloneV1(r.ref),sequence:n,payloadDigest:s.payloadDigest,textBlocks:m.message.content.length,textBytes});
       }
      }
      if(selected){
       if(s.classification!=='ORDINARY'||type.family!=='ASSISTANT'||m.parent_tool_use_id!==null||Object.hasOwn(m,'error')||!arrayV1(m.message.content,200)||!m.message.content.length||Object.hasOwn(m.message,'role')&&m.message.role!=='assistant')bad();
       for(let i=0;i<m.message.content.length;i++){
        const block=m.message.content[i];if(!exact(block,['type','text'])||block.type!=='text'||typeof block.text!=='string'||!block.text.trim())bad();
        const p:Part={outputRef:cloneV1(r.ref),sequence:n,payloadDigest:s.payloadDigest,blockIndex:i,kind:'ASSISTANT_TEXT',text:block.text,textHash:contentHash(block.text)};
        projectionBytes+=Buffer.byteLength(canonicalJson(p));if(parts.length>=200||projectionBytes>2*MiB)bad();parts.push(p);
       }
      }
      lastFamily=type.family;
     }finally{bytes.fill(0);}
     prefix=hash({previous:prefix,ref:r.ref,payloadDigest:s.payloadDigest});
    }
    previous=cloneV1(r.ref);
   }
   guard();if(!confirmed||!discovery&&(!parts.length||!equal(previous,request.tailRef)))bad();completed=true;
   }catch{live=false;return bad();}
  });
  const closed=await Promise.race([read,expired]);guard();if(closed!==undefined||!called||!completed)bad();
  if(discovery){
   const d=initial as NormalUnderstandingDiscoveryBinding;
   if(!discoveredInit||!previous)bad();
   const result:NormalUnderstandingDiscoveryProjection={attribution:'SESSION_ONLY',projectId:request.scope.projectId,executionId:request.scope.executionId,executionGeneration:request.scope.generation,requestRef:d.requestRef,acquisitionRef:d.acquisitionRef,contextBundleRef:d.contextBundleRef,initConfirmationRef:requiredRef(discoveredInit),tailRef:requiredRef(previous),ranges,wholeConversationComplete:false,executionAuthorized:false};
   if(Buffer.byteLength(canonicalJson(result))>2*MiB)bad();
   for(const r of ranges){Object.freeze(r.outputRef);Object.freeze(r);}Object.freeze(ranges);
   for(const k of ['requestRef','acquisitionRef','contextBundleRef','initConfirmationRef','tailRef'] as const)Object.freeze(result[k]);
   return Object.freeze(result);
  }
  const b=initial as Binding;
  const result:NormalUnderstandingResponseProjection={attribution:'SESSION_ONLY',projectId:request.scope.projectId,executionId:request.scope.executionId,executionGeneration:request.scope.generation,bundleRef:b.bundleRef,subjectBindingRef:b.subjectBindingRef,basisRefs:b.basisRefs,initConfirmationRef:request.initConfirmationRef,tailRef:request.tailRef,firstSequence:request.firstSequence,lastSequence:request.lastSequence,beforeRef,afterRef,parts,wholeConversationComplete:false,executionAuthorized:false};
  if(Buffer.byteLength(canonicalJson(result))>2*MiB)bad();return result;
 }catch{return bad();}finally{live=false;if(timer!==undefined)clearTimeout(timer);if(signal instanceof AbortSignal)signal.removeEventListener('abort',abort);}
}
