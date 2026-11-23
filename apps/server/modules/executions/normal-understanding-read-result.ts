import type {Pool,PoolClient} from 'pg';
import {randomUUID} from 'node:crypto';
import {isProxy} from 'node:util/types';
import type {FastifyInstance} from 'fastify';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {arrayV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionTarget,normalUnderstandingRangeTarget,verifyNormalCommandPageProof} from './execution-proof.ts';
import {original,originalRange,originalRangeResult,readCurrent} from './normal-exchange-challenge.ts';
import {normalRequestBearerDigest,requestCredential} from './normal-request-challenge.ts';
import {readPacket} from './normal-command-pages.ts';

const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code='NORMAL_UNDERSTANDING_RESULT_UNKNOWN',status=503):never=>{throw new AuthFailure(code,status);};
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const freeze=(v:any):void=>{if(v&&typeof v==='object'){for(const item of Object.values(v))freeze(item);Object.freeze(v);}};
const contextKeys=['projectId','executionId','executionGeneration','grantRef','registrationRef','connectorId','credentialGeneration','startCommandId','startCommandRef','assignmentRef','preparationRef','contextBundleRef','sessionBindingRef'];
const receiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','understandingRequestRef','context','observedAt','expiresAt'];
const resultReceiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','understandingRequestRef','acquisitionRef','context','body','observedAt','expiresAt'];
type ResultPair={ref:{id:string;version:number;contentHash:string};receipt:Record<string,any>};
export interface NormalUnderstandingResultOptions {mode:'NORMAL_PROTECTED';purpose:'FN09_DISCOVERY_METADATA'}
export interface NormalUnderstandingRangeResultOptions {mode:'NORMAL_PROTECTED';purpose:'FN09_FIXED_RANGE_SELECTION'}
const rangePurpose=Symbol('FN09_FIXED_RANGE_SELECTION');
export function readNormalUnderstandingRangeResultOptions(value:NormalUnderstandingRangeResultOptions):Readonly<NormalUnderstandingRangeResultOptions>{
 const invalid=():never=>{throw Error('NORMAL_UNDERSTANDING_RANGE_RESULT_CONFIGURATION_INVALID');};
 if(!value||isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return invalid();
 const fields=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(fields).length!==2||!fields.mode||!fields.purpose||![fields.mode,fields.purpose].every(d=>'value'in d&&d.enumerable)
  ||fields.mode.value!=='NORMAL_PROTECTED'||fields.purpose.value!=='FN09_FIXED_RANGE_SELECTION')return invalid();
 return Object.freeze({mode:'NORMAL_PROTECTED',purpose:'FN09_FIXED_RANGE_SELECTION'});
}
/** 내부 구성일 뿐 native 원 출처/현재 HUMAN 권위를 대신하는 입력은 아니다. */
export function readNormalUnderstandingResultOptions(value:NormalUnderstandingResultOptions):Readonly<NormalUnderstandingResultOptions>{
 const invalid=():never=>{throw Error('NORMAL_UNDERSTANDING_RESULT_CONFIGURATION_INVALID');};
 if(!value||isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))invalid();
 const fields=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(fields).length!==2||!fields.mode||!fields.purpose||![fields.mode,fields.purpose].every(d=>'value'in d&&d.enumerable)
  ||fields.mode.value!=='NORMAL_PROTECTED'||fields.purpose.value!=='FN09_DISCOVERY_METADATA')invalid();
 return Object.freeze({mode:'NORMAL_PROTECTED',purpose:'FN09_DISCOVERY_METADATA'});
}
/** 현재 producer의 비밀 없는 metadata 형상만 읽는다. private read/close 또는 signer의 증명이 아니다. */
function body(value:unknown){
 try{
  const text=canonicalJson(value);
  if(Buffer.byteLength(text)>2*1024*1024)fail('INPUT_INVALID',400);
  const v=JSON.parse(text),m=v?.metadata;
  if(!recordV1(v,['schemaVersion','kind','metadata'])||v.schemaVersion!==1||v.kind!=='DISCOVERY_METADATA'
   ||!recordV1(m,['attribution','projectId','executionId','executionGeneration','requestRef','acquisitionRef','contextBundleRef','initConfirmationRef','tailRef','ranges','wholeConversationComplete','executionAuthorized'])
   ||m.attribution!=='SESSION_ONLY'||m.wholeConversationComplete!==false||m.executionAuthorized!==false
   ||!uuidV1(m.projectId)||!uuidV1(m.executionId)||!positive(m.executionGeneration)
   ||!['requestRef','acquisitionRef','contextBundleRef','initConfirmationRef','tailRef'].every(k=>refV1(m[k])&&m[k].version===1)
   ||!arrayV1(m.ranges,200))fail('INPUT_INVALID',400);
  if(m.initConfirmationRef.id===m.tailRef.id&&(!same(m.initConfirmationRef,m.tailRef)||m.ranges.length))fail('INPUT_INVALID',400);
  let previous=0,blocks=0;const ids=new Set<string>();
  for(const r of m.ranges){
   if(!recordV1(r,['outputRef','sequence','payloadDigest','textBlocks','textBytes'])||!refV1(r.outputRef)||r.outputRef.version!==1
    ||ids.has(r.outputRef.id)||r.outputRef.id===m.initConfirmationRef.id
    ||r.outputRef.id===m.tailRef.id&&(!same(r.outputRef,m.tailRef)||r!==m.ranges.at(-1))
    ||!positive(r.sequence)||r.sequence<=previous||r.sequence>10000||!hashV1(r.payloadDigest)
    ||!positive(r.textBlocks)||!positive(r.textBytes)||r.textBytes>2*1024*1024||(blocks+=r.textBlocks)>200)fail('INPUT_INVALID',400);
   previous=r.sequence;ids.add(r.outputRef.id);
  }
  return {value:v,metadata:m,text,bodyHash:contentHash(text)};
 }catch(error){if(error instanceof AuthFailure)throw error;return fail('INPUT_INVALID',400);}
}

const rangeReceiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','rangeRequestRef','context','selection','observedAt','expiresAt'];
const rangeResultReceiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','rangeRequestRef','acquisitionRef','sourceRequestRef','sourceResultRef','selectionHash','context','responseRef','partRefs','bodyHash','bodyBytes','observedAt','expiresAt'];
function rangeSelection(x:any){
 if(!recordV1(x,['requestRef','resultRef','initConfirmationRef','tailRef','firstSequence','lastSequence','ranges'])||!['requestRef','resultRef','initConfirmationRef','tailRef'].every(k=>refV1(x[k])&&x[k].version===1)||!positive(x.firstSequence)||!positive(x.lastSequence)||x.lastSequence>10000||x.lastSequence<x.firstSequence||!arrayV1(x.ranges,200)||x.ranges.length!==x.lastSequence-x.firstSequence+1)fail();
 let blocks=0,bytes=0;const ids=new Set<string>();
 for(const [i,r]of x.ranges.entries()){
  if(!recordV1(r,['outputRef','sequence','payloadDigest','textBlocks','textBytes'])||!refV1(r.outputRef)||r.outputRef.version!==1||ids.has(r.outputRef.id)||r.outputRef.id===x.initConfirmationRef.id||r.outputRef.id===x.tailRef.id&&(!same(r.outputRef,x.tailRef)||i!==x.ranges.length-1)||r.sequence!==x.firstSequence+i||!hashV1(r.payloadDigest)||!positive(r.textBlocks)||(blocks+=r.textBlocks)>200||!positive(r.textBytes)||(bytes+=r.textBytes)>2097152)fail();ids.add(r.outputRef.id);
 }return x;
}
/** 원 HTTP UTF8는 route에서 검산하며 여기서도 닫힌 선택 형상과 전체 part를 확인한다. */
function rangeBody(value:unknown){
 try{
  const text=canonicalJson(value);if(Buffer.byteLength(text)>2097152)fail('INPUT_INVALID',400);
  const m=JSON.parse(text);
  if(!recordV1(m,['schemaVersion','kind','attribution','projectId','executionId','executionGeneration','requestRef','acquisitionRef','sourceRequestRef','sourceResultRef','contextBundleRef','initConfirmationRef','tailRef','firstSequence','lastSequence','beforeRef','afterRef','parts','wholeConversationComplete','executionAuthorized'])||m.schemaVersion!==1||m.kind!=='FIXED_RANGE_SELECTION'||m.attribution!=='SESSION_ONLY'||m.wholeConversationComplete!==false||m.executionAuthorized!==false||!uuidV1(m.projectId)||!uuidV1(m.executionId)||!positive(m.executionGeneration)||!refV1(m.contextBundleRef)||!['requestRef','acquisitionRef','sourceRequestRef','sourceResultRef','initConfirmationRef','tailRef'].every(k=>refV1(m[k])&&m[k].version===1)||!positive(m.firstSequence)||!positive(m.lastSequence)||m.lastSequence<m.firstSequence||m.lastSequence>10000||![m.beforeRef,m.afterRef].every(r=>r===null||refV1(r)&&r.version===1)||!arrayV1(m.parts,200)||m.parts.length<1)fail('INPUT_INVALID',400);
  let sequence=m.firstSequence,index=0,total=0;const refs=new Set<string>();
  for(const [partIndex,p]of m.parts.entries()){
   if(!recordV1(p,['outputRef','sequence','payloadDigest','blockIndex','kind','text','textHash'])||!refV1(p.outputRef)||p.outputRef.version!==1||!positive(p.sequence)||p.sequence<m.firstSequence||p.sequence>m.lastSequence||partIndex===0&&p.sequence!==m.firstSequence||!hashV1(p.payloadDigest)||!Number.isSafeInteger(p.blockIndex)||p.blockIndex<0||p.kind!=='ASSISTANT_TEXT'||typeof p.text!=='string'||!p.text.isWellFormed()||p.textHash!==contentHash(p.text)||(total+=Buffer.byteLength(p.text))>2097152)fail('INPUT_INVALID',400);
   if(p.sequence!==sequence){if(p.sequence!==sequence+1)fail('INPUT_INVALID',400);sequence=p.sequence;index=0;}
   if(p.blockIndex!==index++)fail('INPUT_INVALID',400);
   const key=p.outputRef.id;if(p.blockIndex===0){if(refs.has(key))fail('INPUT_INVALID',400);refs.add(key);}else if(!same(p.outputRef,m.parts[partIndex-1].outputRef)||p.payloadDigest!==m.parts[partIndex-1].payloadDigest)fail('INPUT_INVALID',400);
  }
  if(m.beforeRef!==null&&m.beforeRef.id===m.initConfirmationRef.id&&!same(m.beforeRef,m.initConfirmationRef)||m.afterRef!==null&&m.afterRef.id===m.tailRef.id&&!same(m.afterRef,m.tailRef))fail('INPUT_INVALID',400);
  if(sequence!==m.lastSequence||(m.firstSequence===1)!==(m.beforeRef===null)||[m.beforeRef,m.afterRef].some(r=>r!==null&&refs.has(r.id)))fail('INPUT_INVALID',400);
  if(m.tailRef.id===m.parts.at(-1).outputRef.id&&(!same(m.tailRef,m.parts.at(-1).outputRef)||m.afterRef!==null))fail('INPUT_INVALID',400);
  return {value:m,metadata:m,text,bodyHash:contentHash(text)};
 }catch(error){if(error instanceof AuthFailure)throw error;return fail('INPUT_INVALID',400);}
}
/**
 * S3 원 GET/현재성 검산과 채택된 metadata 전용 내부 custody. inspect는 기존 preflight만 수행한다.
 * inspectResult는 같은 proof/현재 거래에서 목적 정산과 v2/영수증을 원자 정착하며 선택 text는 받지 않는다.
 * 기본 POST는 닫혀 있다. 실제 native 원 결과의 목적 서명 경로를 사용하는 명시 서버 조립에서만 등록한다.
 * 내부 구성값은 private read/close 증명을 대신하지 않으며 실행·HUMAN 권위를 발급하지 않는다.
 */
export class NormalUnderstandingReadResult {
 readonly pool:Pick<Pool,'connect'>;
 readonly #range:boolean;
 get purpose(){return this.#range?'FN09_FIXED_RANGE_SELECTION' as const:'FN09_DISCOVERY_METADATA' as const;}
 constructor(pool:Pick<Pool,'connect'>,purpose?:typeof rangePurpose){this.pool=pool;this.#range=purpose===rangePurpose;}

 /** GET 원장 검산은 challenge와 결과 본문에서 이 경로 하나만 재사용한다. */
 async #acquired(db:PoolClient,token:string,binding:any,credentialRef:unknown,requestRef:unknown,acquisitionRef:unknown,at:Date){
  const rows=(await db.query('SELECT anvil.fn09_normal_understanding_result_basis($1,$2,$3,$4) AS basis',
   [token,JSON.stringify(binding),JSON.stringify(requestRef),JSON.stringify(acquisitionRef)])).rows;
  const v=rows[0]?.basis,s=v?.snapshot,r=v?.receipt,get=v?.getChallenge,used=v?.getConsumed;
  if(rows.length!==1||!recordV1(v,['requestRef','snapshot','acquisitionRef','receipt','getChallenge','getConsumed','deadline'])
   ||!same(v.requestRef,requestRef)||!same(v.acquisitionRef,acquisitionRef)||!refV1(requestRef)||hash(s)!==requestRef.contentHash
   ||!recordV1(s,['schemaVersion','purpose','request','context','requestedBy','policyRef','state','sourceScope','createdAt','expiresAt'])
   ||s.schemaVersion!==1||s.purpose!=='NORMAL_UNDERSTANDING_METADATA_DISCOVERY'||s.state!=='PENDING_SOURCE'||s.sourceScope!==null
   ||!recordV1(s.context,contextKeys)||!same(s.context.grantRef,binding.grantRef)||s.context.projectId!==binding.projectId
   ||s.context.executionId!==binding.executionId||s.context.executionGeneration!==binding.executionGeneration
   ||s.context.connectorId!==binding.connectorId||s.context.credentialGeneration!==binding.credentialGeneration
   ||!uuidV1(s.context.startCommandId)||!contextKeys.filter(k=>k.endsWith('Ref')).every(k=>refV1(s.context[k]))
   ||!isoV1(s.createdAt)||!isoV1(s.expiresAt)
   ||!recordV1(r,receiptKeys)||r.kind!=='NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED'||!refV1(acquisitionRef)||hash(r)!==acquisitionRef.contentHash
   ||!same(r.binding,binding)||!same(r.credentialRef,credentialRef)||!same(r.understandingRequestRef,requestRef)||!same(r.context,s.context)
   ||!hashV1(r.packetHash)||!uuidV1(r.requestId)||!isoV1(r.observedAt)||!isoV1(r.expiresAt)
   ||!recordV1(get,['id','content_hash','snapshot_json'])||!recordV1(used,['ref','snapshot'])||!refV1(used.ref)||used.ref.version!==2
   ||used.ref.id!==get.id||hash(used.snapshot)!==used.ref.contentHash||!positive(used.snapshot.sequence)
   ||used.snapshot.sequence<=get.snapshot_json?.sequence||!isoV1(v.deadline))fail();
  const old=original(get,binding,'EXECUTION_REQUEST',credentialRef),c=old.challenge;
  const getTarget=executionTarget('GET','/api/v1/connectors/'+binding.connectorId+'/executions/'+binding.executionId+'/understanding-response-read',[],null);
  if(!same(r.challengeRef,old.ref)||!same(r.target,getTarget)||!same(get.snapshot_json.request.target,getTarget)
   ||r.requestId!==c.requestId||!same(get.snapshot_json.understandingRequestRef,requestRef)
   ||!same(used.snapshot,{...get.snapshot_json,sequence:used.snapshot.sequence,previousRef:old.ref,consumption:{resultRef:acquisitionRef,packetHash:r.packetHash,consumedAt:r.observedAt}})
   ||Date.parse(r.observedAt)<Date.parse(c.issuedAt)||Date.parse(r.observedAt)>at.getTime()
   ||Date.parse(r.expiresAt)>Math.min(Date.parse(c.expiresAt),Date.parse(s.expiresAt))
   ||Date.parse(v.deadline)>Date.parse(r.expiresAt)||Date.parse(v.deadline)<=at.getTime())fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  return {requestRef:v.requestRef,acquisitionRef:v.acquisitionRef,context:s.context,getChallengeRef:old.ref,getRequestId:c.requestId,
   getClientNonceDigest:contentHash(Buffer.from(c.clientNonce,'base64url')),getServerNonceDigest:get.snapshot_json.serverNonceDigest as string,
   getConsumedSequence:used.snapshot.sequence as number,observedAt:r.observedAt,deadline:v.deadline};
 }

 /** 고정 범위는 원 range GET index/영수증/현재 HUMAN을 같은 목적 RPC에서 검산한다. */
 async #rangeBasis(db:PoolClient,token:string,binding:any,credentialRef:unknown,id:string,target:any,at:Date){
  const query=db.query;
  const initial=(await db.query('SELECT clock_timestamp() AS at,pg_current_xact_id_if_assigned()::text AS transaction_id')).rows;
  const first=initial[0];
  if(db.query!==query||initial.length!==1||!(first.at instanceof Date)||!Number.isFinite(first.at.getTime())||first.at<at||typeof first.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(first.transaction_id))fail();
  const rows=(await db.query('SELECT anvil.fn09_normal_understanding_discovery($1,$2,$3,$4) AS discovery',[token,JSON.stringify(binding),null,JSON.stringify({purpose:'FIXED_RANGE_RESULT',rangeRequestId:id})])).rows;
  const v=rows[0]?.discovery,r=v?.receipt,s=v?.snapshot,get=v?.getChallenge,used=v?.getConsumed;
  if(db.query!==query||rows.length!==1||!recordV1(v,['requestRef','rangeRequestRef','acquisitionRef','sourceRequestRef','sourceResultRef','selectionHash','snapshot','context','selection','receipt','getChallenge','getConsumed','deadline'])||!refV1(v.rangeRequestRef)||v.rangeRequestRef.version!==1||v.rangeRequestRef.id!==id||!same(v.requestRef,v.rangeRequestRef)||hash(s)!==v.rangeRequestRef.contentHash
   ||!recordV1(s,['schemaVersion','purpose','request','requestedBy','policyRef','state','sourceScope','createdAt','expiresAt'])||s.schemaVersion!==1||s.purpose!=='NORMAL_UNDERSTANDING_FIXED_RANGE_REQUEST'||s.state!=='PENDING_SOURCE'||!isoV1(s.createdAt)||!isoV1(s.expiresAt)
   ||!recordV1(v.context,contextKeys)||!same(v.context.grantRef,binding.grantRef)||v.context.projectId!==binding.projectId||v.context.executionId!==binding.executionId||v.context.executionGeneration!==binding.executionGeneration||v.context.connectorId!==binding.connectorId||v.context.credentialGeneration!==binding.credentialGeneration||!uuidV1(v.context.startCommandId)||!contextKeys.filter(k=>k.endsWith('Ref')).every(k=>refV1(v.context[k]))
   ||!same(s.sourceScope,v.selection)||!same(s.request?.payload?.selection,v.selection)||!same(s.request?.payload?.assignmentRef,v.context.assignmentRef)||!same(s.request?.payload?.preparationRef,v.context.preparationRef)||s.request?.projectId!==binding.projectId||s.request?.targetId!==binding.executionId||s.request?.expectedVersion!==binding.executionGeneration
   ||!same(v.sourceRequestRef,v.selection?.requestRef)||!same(v.sourceResultRef,v.selection?.resultRef)||v.selectionHash!==hash(v.selection)
   ||!recordV1(r,rangeReceiptKeys)||r.kind!=='NORMAL_UNDERSTANDING_RANGE_ACQUIRED'||!refV1(v.acquisitionRef)||v.acquisitionRef.version!==1||hash(r)!==v.acquisitionRef.contentHash||!same(r.binding,binding)||!same(r.credentialRef,credentialRef)||!same(r.rangeRequestRef,v.rangeRequestRef)||!same(r.context,v.context)||!same(r.selection,v.selection)||!hashV1(r.packetHash)||!uuidV1(r.requestId)||!isoV1(r.observedAt)||!isoV1(r.expiresAt)
   ||!recordV1(get,['id','content_hash','snapshot_json'])||!recordV1(used,['ref','snapshot'])||!refV1(used.ref)||used.ref.version!==2||used.ref.id!==get.id||hash(used.snapshot)!==used.ref.contentHash||!positive(used.snapshot.sequence)||used.snapshot.sequence<=get.snapshot_json?.sequence||!isoV1(v.deadline)||Buffer.byteLength(canonicalJson(v))>2097152)fail();
  const selection=rangeSelection(v.selection),old=originalRange(get,binding,credentialRef),c=old.challenge,getTarget=normalUnderstandingRangeTarget(binding.connectorId,binding.executionId);
  if(!same(r.challengeRef,old.ref)||!same(r.target,getTarget)||r.requestId!==c.requestId||!same(get.snapshot_json.understandingRangeRequestRef,v.rangeRequestRef)||!same(used.snapshot,{...get.snapshot_json,sequence:used.snapshot.sequence,previousRef:old.ref,consumption:{resultRef:v.acquisitionRef,packetHash:r.packetHash,consumedAt:r.observedAt}})||Date.parse(r.observedAt)<Date.parse(c.issuedAt)||Date.parse(r.observedAt)>at.getTime()||Date.parse(r.expiresAt)>Math.min(Date.parse(c.expiresAt),Date.parse(s.expiresAt))||Date.parse(v.deadline)>Date.parse(r.expiresAt)||Date.parse(v.deadline)<=at.getTime())fail('NORMAL_UNDERSTANDING_RANGE_RESULT_DENIED',412);
  const clocks=(await db.query('SELECT clock_timestamp() AS at,pg_current_xact_id_if_assigned()::text AS transaction_id')).rows,clock=clocks[0];
  if(db.query!==query||clocks.length!==1||!(clock.at instanceof Date)||!Number.isFinite(clock.at.getTime())||clock.at<first.at||clock.at.getTime()>=Date.parse(v.deadline)||clock.transaction_id!==first.transaction_id)fail();
  const result={requestRef:v.rangeRequestRef,acquisitionRef:v.acquisitionRef,context:v.context,getChallengeRef:old.ref,getRequestId:c.requestId,getClientNonceDigest:contentHash(Buffer.from(c.clientNonce,'base64url')),getServerNonceDigest:get.snapshot_json.serverNonceDigest as string,getConsumedSequence:used.snapshot.sequence as number,observedAt:r.observedAt,deadline:v.deadline,bodyHash:target.bodyHash as string,target,selection,sourceRequestRef:v.sourceRequestRef,sourceResultRef:v.sourceResultRef,selectionHash:v.selectionHash};
  freeze(result);return result;
 }
 /** body 없는 challenge의 내부 선행. caller fullref 대신 path의 HUMAN 요청 id로 원 소비를 찾는다.
  * 원 거래/현재 credential과 기존 GET index만 사용하며 nonce·POST slot·저장/서명 권위를 발급하지 않는다. */
 async challengeBasis(db:PoolClient,token:string,rawBinding:unknown,credentialRef:unknown,rawTarget:unknown,at:Date){
  let binding:any,target:any;
  try{binding=JSON.parse(canonicalJson(rawBinding));target=JSON.parse(canonicalJson(rawTarget));}catch{return fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);}
  if(!hashV1(token)||!refV1(credentialRef)||!(at instanceof Date)||!Number.isFinite(at.getTime())
   ||!recordV1(binding,['transport','mode','projectId','connectorId','executionId','executionGeneration','grantRef','scopeDigest','credentialGeneration','publicKeyFingerprint'])
   ||binding.transport!=='NORMAL_PROTECTED'||binding.mode!=='EXECUTION'||!['projectId','connectorId','executionId'].every(k=>uuidV1(binding[k]))
   ||!positive(binding.executionGeneration)||!refV1(binding.grantRef)||!positive(binding.credentialGeneration)||!hashV1(binding.scopeDigest)||!hashV1(binding.publicKeyFingerprint)
   ||!recordV1(target,['method','path','queryHash','bodyHash'])||target.method!=='POST'||typeof target.path!=='string'
   ||target.queryHash!==hash({})||!hashV1(target.bodyHash)||target.bodyHash===hash(null))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const prefix='/api/v1/connectors/'+binding.connectorId+'/executions/'+binding.executionId+'/understanding-response-read/';
  const id=target.path.startsWith(prefix)&&target.path.endsWith('/result')?target.path.slice(prefix.length,-'/result'.length):'';
  if(!uuidV1(id)||target.path!==prefix+id+'/result')fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  if(this.#range)return this.#rangeBasis(db,token,binding,credentialRef,id,target,at);
  const query=db.query,observed=at.getTime();
  try{
   const getTarget=executionTarget('GET',prefix.slice(0,-1),[],null);
   const rows=(await db.query(`SELECT g.snapshot_json->'understandingRequestRef' AS request_ref,
    jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash) AS acquisition_ref,
    pg_current_xact_id_if_assigned()::text AS transaction_id
    FROM anvil.execution_challenges g JOIN anvil.execution_challenges u ON u.project_id=g.project_id AND u.id=g.id AND u.version=2 AND u.grant_id=g.grant_id AND u.grant_version=g.grant_version
    JOIN anvil.execution_receipts r ON r.project_id=g.project_id AND r.challenge_id=g.id AND r.challenge_version=1 AND r.version=1 AND r.grant_id=g.grant_id AND r.grant_version=g.grant_version
     AND u.snapshot_json#>'{consumption,resultRef}'=jsonb_build_object('id',r.id,'version',r.version,'contentHash',r.content_hash)
    WHERE g.project_id=$1 AND g.grant_id=$2 AND g.grant_version=$3 AND g.version=1 AND g.snapshot_json ? 'understandingRequestRef'
     AND g.snapshot_json->'understandingRequestRef'->>'id'=$4 AND g.snapshot_json->'binding'=$5::jsonb AND g.snapshot_json->'credentialRef'=$6::jsonb
     AND g.snapshot_json#>'{request,target}'=$7::jsonb AND r.snapshot_json->>'kind'='NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED'
    LIMIT 2`,[binding.projectId,binding.grantRef.id,binding.grantRef.version,id,JSON.stringify(binding),JSON.stringify(credentialRef),JSON.stringify(getTarget)])).rows;
   const row=rows[0],tx=row?.transaction_id;
   if(db.query!==query||rows.length!==1||!refV1(row?.request_ref)||row.request_ref.version!==1||row.request_ref.id!==id
    ||!refV1(row.acquisition_ref)||row.acquisition_ref.version!==1||typeof tx!=='string'||!/^[1-9][0-9]{0,18}$/.test(tx))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   const value=await this.#acquired(db,token,binding,credentialRef,row.request_ref,row.acquisition_ref,new Date(observed));
   if(db.query!==query)fail();
   const clocks=(await db.query('SELECT clock_timestamp() AS at,pg_current_xact_id_if_assigned()::text AS transaction_id')).rows,clock=clocks[0];
   if(db.query!==query||clocks.length!==1||clock?.transaction_id!==tx||!(clock.at instanceof Date)||!Number.isFinite(clock.at.getTime())
    ||clock.at.getTime()<observed||clock.at.getTime()>=Date.parse(value.deadline))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   const result={...value,bodyHash:target.bodyHash as string,target};
   freeze(result);return result;
  }catch(error){
   if(error instanceof AuthFailure)throw error;
   if(error instanceof Error&&/^NORMAL_UNDERSTANDING_RANGE_RESULT_(DENIED|EXPIRED)$/.test(error.message))fail(error.message,412);
   if(error instanceof Error&&error.message==='NORMAL_UNDERSTANDING_RANGE_RESULT_REPLAY_CONFLICT')fail(error.message,409);
   if(error instanceof Error&&error.message==='NORMAL_UNDERSTANDING_RESULT_DENIED')fail(error.message,412);
   return fail();
  }
 }

 /** 원 DB 근거로 기존 candidate에 내부 binding만 추가한다. 발행·삽입·native 증명은 없다. */
 async bindChallenge(db:PoolClient,token:string,binding:any,credentialRef:unknown,candidate:unknown,at:Date){
  let row:any;try{row=JSON.parse(canonicalJson(candidate));}catch{return fail('INPUT_INVALID',400);}
  if(!recordV1(row,['id','content_hash','snapshot_json'])||!uuidV1(row.id)||hash(row.snapshot_json)!==row.content_hash
   ||!row.snapshot_json||Object.hasOwn(row.snapshot_json,'understandingRequestRef')||Object.hasOwn(row.snapshot_json,'understandingResultBinding')||Object.hasOwn(row.snapshot_json,'understandingRangeResultBinding')||Object.hasOwn(row.snapshot_json,'understandingRangeRequestRef'))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const query=db.query,source=await this.challengeBasis(db,token,binding,credentialRef,row.snapshot_json.request?.target,at);
  if(db.query!==query)fail();
  const snapshot={...row.snapshot_json,...(this.#range?{understandingRangeResultBinding:this.#rangeMarker(source)}:{understandingResultBinding:{requestRef:source.requestRef,acquisitionRef:source.acquisitionRef}})};
  const bound={id:row.id,content_hash:hash(snapshot),snapshot_json:snapshot};
  await this.validateChallenge(db,token,binding,credentialRef,bound,at);if(db.query!==query)fail();freeze(bound);return bound;
 }

 /** 원 slot 조회와 GET 획득 재검산만 수행한다. purpose v1조차 여기서 저장하지 않는다. */
 async validateChallenge(db:PoolClient,token:string,binding:any,credentialRef:unknown,value:unknown,at:Date){
  let row:any;try{row=JSON.parse(canonicalJson(value));}catch{return fail('INPUT_INVALID',400);}
  if(!recordV1(row,['id','content_hash','snapshot_json']))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const post=this.#range?originalRangeResult(row,binding,credentialRef):original(row,binding,'EXECUTION_REQUEST',credentialRef),s=row.snapshot_json,marker=this.#range?s.understandingRangeResultBinding:s.understandingResultBinding;
  if(!recordV1(marker,this.#range?['rangeRequestRef','acquisitionRef','sourceRequestRef','sourceResultRef','selectionHash']:['requestRef','acquisitionRef']))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const markerKey=this.#range?'understandingRangeResultBinding':'understandingResultBinding',requestKey=this.#range?'rangeRequestRef':'requestRef';
  const query=db.query,slots=(await db.query(`SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges
   WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND version=1 AND snapshot_json ? '${markerKey}'
    AND snapshot_json#>>'{${markerKey},${requestKey},id}'=$4 LIMIT 2`,[binding.projectId,binding.grantRef.id,binding.grantRef.version,marker[requestKey].id]).catch(()=>fail())).rows;
  if(db.query!==query||!Array.isArray(slots))fail();
  if(slots.length>1||slots.length===1&&!same(slots[0],row))fail('NORMAL_UNDERSTANDING_RESULT_SLOT_CONFLICT',409);
  const source=await this.challengeBasis(db,token,binding,credentialRef,s.request.target,at),c=post.challenge;
  if(db.query!==query)fail();
  if(!same(marker,this.#range?this.#rangeMarker(source):{requestRef:source.requestRef,acquisitionRef:source.acquisitionRef})||post.ref.id===source.getChallengeRef.id
   ||c.requestId===source.getRequestId||s.sequence<=source.getConsumedSequence||s.serverNonceDigest===source.getServerNonceDigest
   ||contentHash(Buffer.from(c.clientNonce,'base64url'))===source.getClientNonceDigest
   ||Date.parse(c.issuedAt)<Date.parse(source.observedAt)||Date.parse(c.issuedAt)>at.getTime()||Date.parse(c.expiresAt)<=at.getTime()
   ||Date.parse(c.expiresAt)>Date.parse(source.deadline)||Math.abs(Date.parse(s.request.issuedAt)-Date.parse(c.issuedAt))>30000)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const result={post,source};freeze(result);return result;
 }

 #rangeMarker(source:any){return {rangeRequestRef:source.requestRef,acquisitionRef:source.acquisitionRef,sourceRequestRef:source.sourceRequestRef,sourceResultRef:source.sourceResultRef,selectionHash:source.selectionHash};}
 #matchBody(input:ReturnType<typeof body>,source:Awaited<ReturnType<NormalUnderstandingReadResult['challengeBasis']>>,binding:any){
  const m=input.metadata;
  if(this.#range){
   const x=rangeSelection((source as any).selection);let i=0;
   if(!same(m.sourceRequestRef,x.requestRef)||!same(m.sourceResultRef,x.resultRef)||!same(m.initConfirmationRef,x.initConfirmationRef)||!same(m.tailRef,x.tailRef)||m.firstSequence!==x.firstSequence||m.lastSequence!==x.lastSequence)fail('NORMAL_UNDERSTANDING_RANGE_RESULT_DENIED',412);
   for(const row of x.ranges){let bytes=0;for(let j=0;j<row.textBlocks;j++){const p=m.parts[i++];if(!p||!same(p.outputRef,row.outputRef)||p.sequence!==row.sequence||p.payloadDigest!==row.payloadDigest||p.blockIndex!==j)fail('NORMAL_UNDERSTANDING_RANGE_RESULT_DENIED',412);bytes+=Buffer.byteLength(p.text);}
    if(bytes!==row.textBytes)fail('NORMAL_UNDERSTANDING_RANGE_RESULT_DENIED',412);
   }if(i!==m.parts.length)fail('NORMAL_UNDERSTANDING_RANGE_RESULT_DENIED',412);
  }
  if(source.bodyHash!==input.bodyHash||!same(source.requestRef,m.requestRef)||!same(source.acquisitionRef,m.acquisitionRef)
   ||!same(source.context.contextBundleRef,m.contextBundleRef)||m.projectId!==binding.projectId||m.executionId!==binding.executionId
   ||m.executionGeneration!==binding.executionGeneration)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
 }

 /** 나중에 온 본문도 같은 서버 원장 경로로 도출하며 원 target/bodyHash와 비교한다. */
 async current(db:PoolClient,token:string,binding:any,credentialRef:unknown,value:unknown,at:Date,target:unknown){
  const input=this.#range?rangeBody(value):body(value);
  const source=await this.challengeBasis(db,token,binding,credentialRef,target,at);
  this.#matchBody(input,source,binding);
  return source;
 }

 async #resultPair(db:PoolClient,keys:unknown[],token:string,old:any,frame:any,input:ReturnType<typeof body>,source:Awaited<ReturnType<NormalUnderstandingReadResult['challengeBasis']>>,credentialRef:unknown,at:Date){
  const rows=(await db.query(`SELECT anvil.fn09_normal_understanding_result_custody_valid(v,r,$5) AS valid,
   v.content_hash AS vhash,v.snapshot_json AS consumed,r.id,r.content_hash,r.snapshot_json AS receipt
   FROM anvil.execution_challenges v LEFT JOIN anvil.execution_receipts r ON r.project_id=v.project_id AND r.challenge_id=v.id
   WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3 AND v.id=$4 AND v.version=2`,[...keys,frame.challengeRef.id,token])).rows;
  if(rows.length===0)return null;
  const row=rows[0],s=row?.receipt,c=frame.challengeRef,post=old.snapshot_json;
  if(rows.length!==1||row.valid!==true||!uuidV1(row.id)||!recordV1(s,resultReceiptKeys)||s.kind!=='NORMAL_UNDERSTANDING_DISCOVERY_RESULT'
   ||row.content_hash!==hash(s)||row.vhash!==hash(row.consumed)||!positive(row.consumed?.sequence)||row.consumed.sequence<=post.sequence||row.consumed.sequence>20000
   ||!same(s.binding,post.binding)||!same(s.credentialRef,credentialRef)||!same(s.challengeRef,c)||!same(s.target,source.target)
   ||s.requestId!==frame.proof.requestId||s.packetHash!==hash({frame,target:source.target})||!same(s.understandingRequestRef,source.requestRef)
   ||!same(s.acquisitionRef,source.acquisitionRef)||!same(s.context,source.context)||!same(s.body,input.value)||hash(s.body)!==source.bodyHash
   ||Buffer.byteLength(canonicalJson(s))>2*1024*1024||!isoV1(s.observedAt)||!isoV1(s.expiresAt)
   ||Date.parse(s.observedAt)<Date.parse(post.publicChallenge.issuedAt)||Date.parse(s.observedAt)>at.getTime()
   ||Date.parse(s.expiresAt)>Math.min(Date.parse(source.deadline),Date.parse(post.publicChallenge.expiresAt))||Date.parse(s.expiresAt)<=at.getTime()
   ||!same(row.consumed,{...post,sequence:row.consumed.sequence,previousRef:c,consumption:{resultRef:{id:row.id,version:1,contentHash:row.content_hash},packetHash:s.packetHash,consumedAt:s.observedAt}}))fail('NORMAL_UNDERSTANDING_RESULT_REPLAY_CONFLICT',409);
  return {ref:{id:row.id as string,version:1,contentHash:row.content_hash as string},receipt:s};
 }
 async #storeResult(db:PoolClient,keys:unknown[],token:string,old:any,frame:any,input:ReturnType<typeof body>,source:Awaited<ReturnType<NormalUnderstandingReadResult['challengeBasis']>>,credentialRef:unknown,at:Date,ends:number){
  const sequence=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
  if(!positive(sequence)||sequence<=old.snapshot_json.sequence||sequence>20000)fail();
  const receipt={kind:'NORMAL_UNDERSTANDING_DISCOVERY_RESULT',binding:old.snapshot_json.binding,credentialRef,challengeRef:frame.challengeRef,
   packetHash:hash({frame,target:source.target}),target:source.target,requestId:frame.proof.requestId,understandingRequestRef:source.requestRef,acquisitionRef:source.acquisitionRef,
   context:source.context,body:input.value,observedAt:at.toISOString(),expiresAt:new Date(ends).toISOString()};
  if(Buffer.byteLength(canonicalJson(receipt))>2*1024*1024)fail('INPUT_INVALID',400);
  const ref={id:randomUUID(),version:1,contentHash:hash(receipt)},consumed={...old.snapshot_json,sequence,previousRef:frame.challengeRef,consumption:{resultRef:ref,packetHash:receipt.packetHash,consumedAt:receipt.observedAt}};
  await db.query("SELECT set_config('anvil.normal_page_verified',txid_current()::text||':'||$1||':'||$2,true)",[ref.contentHash,token]);
  const rows=(await db.query('SELECT anvil.fn09_normal_understanding_result_store($1,$2,$3,$4,$5,$6) AS stored',
   [token,JSON.stringify(old.snapshot_json.binding),JSON.stringify(frame.challengeRef),JSON.stringify(consumed),JSON.stringify(ref),JSON.stringify(receipt)])).rows;
  const stored=rows[0]?.stored;
  if(rows.length!==1||!recordV1(stored,['status','ref','bytes','planHash'])||stored.status!=='SETTLED'||!same(stored.ref,ref)||!hashV1(stored.planHash)||typeof stored.bytes!=='string'||!/^[1-9][0-9]{0,18}$/.test(stored.bytes))fail();
  const actual=await this.#resultPair(db,keys,token,old,frame,input,source,credentialRef,at);
  if(!actual||!same(actual.ref,ref)||!same(actual.receipt,receipt))fail();return actual;
 }

 #rangeRefs(s:any,input:ReturnType<typeof rangeBody>,source:any,id:string){
  const x=source.selection,known=new Set<string>([id,source.requestRef.id,source.acquisitionRef.id,x.requestRef.id,x.resultRef.id,x.initConfirmationRef.id,x.tailRef.id,...x.ranges.map((r:any)=>r.outputRef.id)]);
  if(!refV1(s.responseRef)||s.responseRef.version!==1||s.responseRef.contentHash!==input.bodyHash||known.has(s.responseRef.id)||!arrayV1(s.partRefs,200)||s.partRefs.length!==input.value.parts.length)fail('NORMAL_UNDERSTANDING_RESULT_REPLAY_CONFLICT',409);
  known.add(s.responseRef.id);
  for(const [i,r]of s.partRefs.entries()){if(!refV1(r)||r.version!==1||r.contentHash!==hash(input.value.parts[i])||known.has(r.id))fail('NORMAL_UNDERSTANDING_RESULT_REPLAY_CONFLICT',409);known.add(r.id);}
 }
 async #rangePair(db:PoolClient,keys:unknown[],old:any,frame:any,input:ReturnType<typeof rangeBody>,source:any,credentialRef:unknown,at:Date):Promise<ResultPair|null>{
  const rows=(await db.query(`SELECT v.content_hash AS vhash,v.snapshot_json AS consumed,r.id,r.content_hash,r.snapshot_json AS receipt
   FROM anvil.execution_challenges v LEFT JOIN anvil.execution_receipts r ON r.project_id=v.project_id AND r.challenge_id=v.id AND r.version=1 AND r.challenge_version=1 AND r.grant_id=v.grant_id AND r.grant_version=v.grant_version
   WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3 AND v.id=$4 AND v.version=2`,[...keys,frame.challengeRef.id])).rows;
  if(rows.length===0)return null;const row=rows[0],r=row?.receipt,post=old.snapshot_json;
  if(rows.length!==1||!uuidV1(row.id)||!recordV1(r,rangeResultReceiptKeys)||r.kind!=='NORMAL_UNDERSTANDING_RANGE_RESULT'||row.content_hash!==hash(r)||row.vhash!==hash(row.consumed)||!positive(row.consumed?.sequence)||row.consumed.sequence<=post.sequence||row.consumed.sequence>20000||!same(r.binding,post.binding)||!same(r.credentialRef,credentialRef)||!same(r.challengeRef,frame.challengeRef)||!same(r.target,source.target)||r.packetHash!==hash({frame,target:source.target})||r.requestId!==frame.proof.requestId||!same(r.rangeRequestRef,source.requestRef)||!same(r.acquisitionRef,source.acquisitionRef)||!same(r.sourceRequestRef,source.sourceRequestRef)||!same(r.sourceResultRef,source.sourceResultRef)||r.selectionHash!==source.selectionHash||!same(r.context,source.context)||r.bodyHash!==input.bodyHash||r.bodyBytes!==Buffer.byteLength(input.text)||!isoV1(r.observedAt)||!isoV1(r.expiresAt)||Date.parse(r.observedAt)<Date.parse(post.publicChallenge.issuedAt)||Date.parse(r.observedAt)>at.getTime()||Date.parse(r.expiresAt)>Math.min(Date.parse(source.deadline),Date.parse(post.publicChallenge.expiresAt))||Date.parse(r.expiresAt)<=at.getTime()||!same(row.consumed,{...post,sequence:row.consumed.sequence,previousRef:frame.challengeRef,consumption:{resultRef:{id:row.id,version:1,contentHash:row.content_hash},packetHash:r.packetHash,consumedAt:r.observedAt}})||Buffer.byteLength(canonicalJson(r))>65536)fail('NORMAL_UNDERSTANDING_RESULT_REPLAY_CONFLICT',409);
  this.#rangeRefs(r,input,source,row.id);
  // 아직 private body/정산 성공이 아니다. 같은 RPC의 REPLAY 검산까지 통과해야 반환할 수 있다.
  return {ref:{id:row.id,version:1,contentHash:row.content_hash},receipt:r};
 }
 async #storeRangeResult(db:PoolClient,keys:unknown[],token:string,old:any,frame:any,input:ReturnType<typeof rangeBody>,source:any,credentialRef:unknown,at:Date,ends:number,previous:ResultPair|null){
  let result=previous,consumed:any;
  if(previous){consumed=(await db.query('SELECT content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=2',[...keys,frame.challengeRef.id])).rows;
   if(consumed.length!==1||consumed[0].content_hash!==hash(consumed[0].snapshot_json))fail('NORMAL_UNDERSTANDING_RESULT_REPLAY_CONFLICT',409);consumed=consumed[0].snapshot_json;
  }else{
   const sequence=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
   if(!positive(sequence)||sequence<=old.snapshot_json.sequence||sequence>20000)fail();
   const receipt={kind:'NORMAL_UNDERSTANDING_RANGE_RESULT',binding:old.snapshot_json.binding,credentialRef,challengeRef:frame.challengeRef,packetHash:hash({frame,target:source.target}),target:source.target,requestId:frame.proof.requestId,rangeRequestRef:source.requestRef,acquisitionRef:source.acquisitionRef,sourceRequestRef:source.sourceRequestRef,sourceResultRef:source.sourceResultRef,selectionHash:source.selectionHash,context:source.context,responseRef:{id:randomUUID(),version:1,contentHash:input.bodyHash},partRefs:input.value.parts.map((p:any)=>({id:randomUUID(),version:1,contentHash:hash(p)})),bodyHash:input.bodyHash,bodyBytes:Buffer.byteLength(input.text),observedAt:at.toISOString(),expiresAt:new Date(ends).toISOString()};
   const ref={id:randomUUID(),version:1,contentHash:hash(receipt)};this.#rangeRefs(receipt,input,source,ref.id);
   if(Buffer.byteLength(canonicalJson(receipt))>65536)fail('INPUT_INVALID',400);
   result={ref,receipt};consumed={...old.snapshot_json,sequence,previousRef:frame.challengeRef,consumption:{resultRef:ref,packetHash:receipt.packetHash,consumedAt:receipt.observedAt}};
  }
  const raw=Buffer.from(input.text);
  try{
   await db.query("SELECT set_config('anvil.normal_page_verified',txid_current()::text||':'||$1||':'||$2,true)",[result!.ref.contentHash,token]);
   const rows=(await db.query('SELECT anvil.fn09_normal_understanding_result_store($1,$2,$3,$4,$5,$6) AS stored',[token,JSON.stringify(old.snapshot_json.binding),JSON.stringify(frame.challengeRef),JSON.stringify(consumed),JSON.stringify(result!.ref),JSON.stringify({purpose:'FIXED_RANGE_RESULT_CUSTODY',receipt:result!.receipt,bodyBase64:raw.toString('base64')})])).rows;
   const value=rows[0]?.stored;
   if(rows.length!==1||!recordV1(value,['status','ref','responseRef','partRefs','bytes','planHash'])||value.status!==(previous?'REPLAY':'SETTLED')||!same(value.ref,result!.ref)||!same(value.responseRef,result!.receipt.responseRef)||!same(value.partRefs,result!.receipt.partRefs)||!hashV1(value.planHash)||typeof value.bytes!=='string'||!/^[1-9][0-9]{0,18}$/.test(value.bytes))fail();
   const actual=await this.#rangePair(db,keys,old,frame,input,source,credentialRef,at);
   if(!actual||!same(actual,result))fail();return actual;
  }finally{raw.fill(0);}
 }
 /** 기존 native 미연결 preflight의 반환 의미를 보존한다. */
 async inspect(connector:string,execution:string,token:string,packet:unknown,value:unknown,signal:AbortSignal){
  const result=await this.#inspect(connector,execution,token,packet,value,signal,false);
  if(result.status!=='NATIVE_SOURCE_AUTHORITY_REQUIRED')return fail();return result;
 }
 /** 실제 proof/current/목적 정산을 같은 거래에 정착한다. HTTP/normal 기본 조립에는 등록하지 않는다. */
 async inspectResult(connector:string,execution:string,token:string,packet:unknown,value:unknown,signal:AbortSignal){
  const result=await this.#inspect(connector,execution,token,packet,value,signal,true);
  if(result.status!==(this.#range?'RANGE_RESULT_STORED':'DISCOVERY_METADATA_STORED'))return fail();return result;
 }
 async #inspect(connector:string,execution:string,token:string,packet:unknown,value:unknown,signal:AbortSignal,validateResult:boolean){
  const input=this.#range?rangeBody(value):body(value);let frame:any;
  try{frame=JSON.parse(canonicalJson(packet));}catch{return fail('INPUT_INVALID',400);}
  if(!uuidV1(connector)||!uuidV1(execution)||!hashV1(token)||!(signal instanceof AbortSignal)||signal.aborted
   ||!recordV1(frame,['schemaVersion','challengeRef','proof','signature'])||frame.schemaVersion!==1||!refV1(frame.challengeRef)||frame.challengeRef.version!==1
   ||!recordV1(frame.proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])
   ||!refV1(frame.proof.grantRef)||!uuidV1(frame.proof.requestId)||!positive(frame.proof.credentialGeneration)
   ||Buffer.byteLength(canonicalJson(frame))+Buffer.byteLength(input.text)>2*1024*1024)fail('INPUT_INVALID',400);
  const target=executionTarget('POST','/api/v1/connectors/'+connector+'/executions/'+execution+'/understanding-response-read/'+input.metadata.requestRef.id+'/result',[],input.text);
  let db:PoolClient;
  try{db=await this.pool.connect();}catch{return fail();}
  let committing=false,committed=false,rolledBack=false,rollbackAttempted=false,discard:Error|undefined,mono=performance.now();const query=db.query;
  const mark=()=>{const next=performance.now();if(!Number.isFinite(next)||!Number.isFinite(mono)||next<mono)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);mono=next;return next;};
  try{
   await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'");
   const p=frame.proof,c=frame.challengeRef,g=p.grantRef;
   const firstMark=mark(),cred=await requestCredential(db,token,connector,execution,p),cur=await readCurrent(db,cred.project,connector,execution,p),b=cur.binding,keys=[cred.project,g.id,g.version];
   const rows=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=1 AND content_hash=$5',[...keys,c.id,c.contentHash])).rows;
   if(rows.length!==1)fail();const {post,source}=await this.validateChallenge(db,token,b,cred.ref,rows[0],cur.now);
   if(!same(rows[0].snapshot_json.request.target,target))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   verifyNormalCommandPageProof(cur.spki,frame.signature,p,b,post.challenge,target);
   this.#matchBody(input,source,b);
   const ends=Math.min(cred.expiresAt,cur.deadline.getTime(),Date.parse(source.deadline),Date.parse(post.challenge.expiresAt));
   if(c.id===source.getChallengeRef.id||p.requestId===source.getRequestId||Date.parse(post.challenge.expiresAt)>Math.min(cred.expiresAt,cur.deadline.getTime(),Date.parse(source.deadline))
    ||Date.parse(post.challenge.issuedAt)<Date.parse(source.observedAt)
    ||cur.now.getTime()<Date.parse(post.challenge.issuedAt)||cur.now.getTime()>=ends||signal.aborted)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   // GET 단일성은 목적 RPC가 원 GET requestId로 검산한다.
   // POST는 별도 미소비 원장 신원만 쓰며 원 GET v1/v2를 대체하거나 다시 소비하지 않는다.
   let result:ResultPair|null=null;
   let replay=false;
   if(validateResult){
    if(this.#range){result=await this.#rangePair(db,keys,rows[0],frame,input,source,cred.ref,cur.now);replay=result!==null;result=await this.#storeRangeResult(db,keys,token,rows[0],frame,input,source,cred.ref,cur.now,ends,result);}
    else{result=await this.#resultPair(db,keys,token,rows[0],frame,input,source,cred.ref,cur.now);replay=result!==null;
     if(!result)result=await this.#storeResult(db,keys,token,rows[0],frame,input,source,cred.ref,cur.now,ends);
    }
   }
   else if((await db.query('SELECT id FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=2',[...keys,c.id])).rows.length)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   const lastMark=mark(),lastCred=await requestCredential(db,token,connector,execution,p),last=await readCurrent(db,cred.project,connector,execution,p);
   const {source:lastSource}=await this.validateChallenge(db,token,last.binding,lastCred.ref,rows[0],last.now);
   this.#matchBody(input,lastSource,last.binding);
   if(db.query!==query||!same(cred,lastCred)||!same(b,last.binding)||cur.spki!==last.spki||!same(source,lastSource)||last.now<cur.now||last.now.getTime()>=ends||signal.aborted)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   // DB 시각의 잔여 한도를 원 monotonic 표본에 결박한다. COMMIT 대기 시간도 한도를 소비한다.
   const monoEnd=Math.min(firstMark+ends-cur.now.getTime(),lastMark+ends-last.now.getTime());
   if(mark()>=monoEnd)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   if(validateResult&&replay){rollbackAttempted=true;discard=new Error('NORMAL_UNDERSTANDING_RESULT_ROLLBACK_UNKNOWN');
    if((await db.query('ROLLBACK')).command!=='ROLLBACK'){discard=new Error('NORMAL_UNDERSTANDING_RESULT_ROLLBACK_UNKNOWN');fail();}
    rolledBack=true;discard=undefined;
   }else{
   committing=true;if((await db.query('COMMIT')).command!=='COMMIT')throw Error();committing=false;committed=true;
   }
   if(signal.aborted||mark()>=monoEnd)fail(validateResult?'NORMAL_UNDERSTANDING_RESULT_DELIVERY_UNKNOWN':'NORMAL_UNDERSTANDING_RESULT_DENIED',validateResult?503:412);
   if(validateResult&&result&&this.#range)return {transport:'NORMAL_PROTECTED' as const,status:'RANGE_RESULT_STORED' as const,proofResultRef:result.ref,receipt:result.receipt,cacheControl:'no-store' as const,resultStored:true as const,selectionAvailable:false as const,nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   if(validateResult&&result)return {transport:'NORMAL_PROTECTED' as const,status:'DISCOVERY_METADATA_STORED' as const,proofResultRef:result.ref,receipt:result.receipt,
    cacheControl:'no-store' as const,resultStored:true as const,metadataAvailable:true as const,selectionAvailable:false as const,nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   return {status:'NATIVE_SOURCE_AUTHORITY_REQUIRED' as const,requestRef:source.requestRef,acquisitionRef:source.acquisitionRef,bodyHash:source.bodyHash,
    cacheControl:'no-store' as const,resultStored:false as const,nonceConsumed:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){
   // 정상 COMMIT 뒤의 늦은 취소/만료는 저장 불명이나 새 ROLLBACK으로 재분류하지 않는다.
   if(committed||rolledBack){if(error instanceof AuthFailure)throw error;return fail();}
   if(committing)discard=new Error('NORMAL_UNDERSTANDING_RESULT_COMMIT_UNKNOWN');
   if(!rollbackAttempted){rollbackAttempted=true;try{if((await db.query('ROLLBACK')).command!=='ROLLBACK')discard??=new Error('NORMAL_UNDERSTANDING_RESULT_ROLLBACK_UNKNOWN');}catch{discard??=new Error('NORMAL_UNDERSTANDING_RESULT_ROLLBACK_UNKNOWN');}}
   if(committing||discard)fail();if(error instanceof AuthFailure)throw error;
   if(error instanceof Error&&/^NORMAL_UNDERSTANDING_RANGE_RESULT_(DENIED|EXPIRED)$/.test(error.message))fail(error.message,412);
   if(error instanceof Error&&error.message==='NORMAL_UNDERSTANDING_RANGE_RESULT_REPLAY_CONFLICT')fail(error.message,409);
   if(error instanceof Error&&error.message==='NORMAL_UNDERSTANDING_RESULT_DENIED')fail(error.message,412);
   if(error instanceof Error&&error.message==='PROJECT_STORAGE_QUOTA_EXCEEDED')fail(error.message,409);
   if(error instanceof Error&&error.message==='PROJECT_STORAGE_QUOTA_UNVERIFIED')fail(error.message,412);
   if(error instanceof Error&&error.message==='NORMAL_UNDERSTANDING_RESULT_REPLAY_CONFLICT')fail(error.message,409);
   return fail();
  }finally{db.release(discard);}
 }
}

/** range 목적은 이 모듈의 원 생성자 경계만 사용한다. caller boolean으로 켜지 않는다. */
export class NormalUnderstandingRangeReadResult extends NormalUnderstandingReadResult {constructor(pool:Pick<Pool,'connect'>){super(pool,rangePurpose);}}

/** metadata만 받는 등록 credential 목적 경로. 기본 app에는 등록하지 않는다. */
export function registerNormalUnderstandingReadResult(app:FastifyInstance,source:NormalUnderstandingReadResult,origin:string,rangeSource?:NormalUnderstandingReadResult){
 const host=new URL(origin);if(host.protocol!=='https:'||host.origin!==origin)throw Error('EXECUTION_PAGE_HOST_REQUIRED');
 const limit=2*1024*1024;
 app.register(async route=>{
  route.removeContentTypeParser('application/json');
  route.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit:limit},(_request,buf,done)=>{
   try{const text=new TextDecoder('utf-8',{fatal:true}).decode(buf as Buffer),value=parseWireJson(text);if(canonicalJson(value)!==text)throw Error();done(null,{text,value});}
   catch{done(new AuthFailure('INPUT_INVALID',400),undefined);}
  });
  route.post<{Params:{cid:string;eid:string;requestId:string}}>('/api/v1/connectors/:cid/executions/:eid/understanding-response-read/:requestId/result',{bodyLimit:limit,handlerTimeout:20000},async(r,reply)=>{
   const {cid,eid,requestId}=r.params,path='/api/v1/connectors/'+cid+'/executions/'+eid+'/understanding-response-read/'+requestId+'/result';
   if(![cid,eid,requestId].every(uuidV1)||r.raw.method!=='POST'||r.raw.url!==path)return reply.callNotFound();
   const names=r.raw.rawHeaders.filter((_,i)=>i%2===0).map(h=>h.toLowerCase());
   if(names.filter(h=>h==='content-type').length!==1||names.filter(h=>h==='content-length').length!==1
    ||!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(r.headers['content-type']??''))fail('INPUT_INVALID',400);
   const payload=r.body as {text:string;value:unknown}|undefined;
   if(!payload||typeof payload.text!=='string'||r.headers['content-length']!==String(Buffer.byteLength(payload.text)))return fail('INPUT_INVALID',400);
   const token=normalRequestBearerDigest(r,host.host,true),frame=readPacket(r,true),isRange=(payload.value as any)?.kind==='FIXED_RANGE_SELECTION';
   const provider=[source,rangeSource].find(v=>v?.purpose===(isRange?'FN09_FIXED_RANGE_SELECTION':'FN09_DISCOVERY_METADATA'));
   if(!provider)return fail('NORMAL_UNDERSTANDING_RESPONSE_SOURCE_UNAVAILABLE',503);
   const input=isRange?rangeBody(payload.value):body(payload.value);
   if(input.metadata.requestRef.id!==requestId||input.text!==payload.text)fail('INPUT_INVALID',400);
   return provider.inspectResult(cid,eid,token,frame,input.value,r.signal);
  });
 });
}
