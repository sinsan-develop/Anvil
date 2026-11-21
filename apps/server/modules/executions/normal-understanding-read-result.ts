import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {arrayV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionTarget,verifyNormalCommandPageProof} from './execution-proof.ts';
import {original,readCurrent} from './normal-exchange-challenge.ts';
import {requestCredential} from './normal-request-challenge.ts';

const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code='NORMAL_UNDERSTANDING_RESULT_UNKNOWN',status=503):never=>{throw new AuthFailure(code,status);};
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const freeze=(v:any):void=>{if(v&&typeof v==='object'){for(const item of Object.values(v))freeze(item);Object.freeze(v);}};
const contextKeys=['projectId','executionId','executionGeneration','grantRef','registrationRef','connectorId','credentialGeneration','startCommandId','startCommandRef','assignmentRef','preparationRef','contextBundleRef','sessionBindingRef'];
const receiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','understandingRequestRef','context','observedAt','expiresAt'];
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

/**
 * S3 내부 custody 선행. 실제 DB의 원 GET v1/v2/영수증과 현재 HUMAN/normal 근거를 조회한다.
 * 공개 route/POST 발행/nonce 소비/본문 저장은 없다. source-purpose native 단회 서명이 미연결이므로
 * 성공적인 inspect도 저장·선택·실행 권위를 발급하지 않는다. 일반 signer 증명만으로 이를 활성화하면 안 된다.
 */
export class NormalUnderstandingReadResult {
 readonly pool:Pick<Pool,'connect'>;
 constructor(pool:Pick<Pool,'connect'>){this.pool=pool;}

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
   if(error instanceof Error&&error.message==='NORMAL_UNDERSTANDING_RESULT_DENIED')fail(error.message,412);
   return fail();
  }
 }

 /** 원 DB 근거로 기존 candidate에 내부 binding만 추가한다. 발행·삽입·native 증명은 없다. */
 async bindChallenge(db:PoolClient,token:string,binding:any,credentialRef:unknown,candidate:unknown,at:Date){
  let row:any;try{row=JSON.parse(canonicalJson(candidate));}catch{return fail('INPUT_INVALID',400);}
  if(!recordV1(row,['id','content_hash','snapshot_json'])||!uuidV1(row.id)||hash(row.snapshot_json)!==row.content_hash
   ||!row.snapshot_json||Object.hasOwn(row.snapshot_json,'understandingRequestRef')||Object.hasOwn(row.snapshot_json,'understandingResultBinding'))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const query=db.query,source=await this.challengeBasis(db,token,binding,credentialRef,row.snapshot_json.request?.target,at);
  if(db.query!==query)fail();
  const snapshot={...row.snapshot_json,understandingResultBinding:{requestRef:source.requestRef,acquisitionRef:source.acquisitionRef}};
  const bound={id:row.id,content_hash:hash(snapshot),snapshot_json:snapshot};
  await this.validateChallenge(db,token,binding,credentialRef,bound,at);if(db.query!==query)fail();freeze(bound);return bound;
 }

 /** 원 slot 조회와 GET 획득 재검산만 수행한다. purpose v1조차 여기서 저장하지 않는다. */
 async validateChallenge(db:PoolClient,token:string,binding:any,credentialRef:unknown,value:unknown,at:Date){
  let row:any;try{row=JSON.parse(canonicalJson(value));}catch{return fail('INPUT_INVALID',400);}
  if(!recordV1(row,['id','content_hash','snapshot_json']))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const post=original(row,binding,'EXECUTION_REQUEST',credentialRef),s=row.snapshot_json,marker=s.understandingResultBinding;
  if(!recordV1(marker,['requestRef','acquisitionRef']))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const query=db.query,slots=(await db.query(`SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges
   WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND version=1 AND snapshot_json ? 'understandingResultBinding'
    AND snapshot_json#>>'{understandingResultBinding,requestRef,id}'=$4 LIMIT 2`,[binding.projectId,binding.grantRef.id,binding.grantRef.version,marker.requestRef.id]).catch(()=>fail())).rows;
  if(db.query!==query||!Array.isArray(slots))fail();
  if(slots.length>1||slots.length===1&&!same(slots[0],row))fail('NORMAL_UNDERSTANDING_RESULT_SLOT_CONFLICT',409);
  const source=await this.challengeBasis(db,token,binding,credentialRef,s.request.target,at),c=post.challenge;
  if(db.query!==query)fail();
  if(!same(marker,{requestRef:source.requestRef,acquisitionRef:source.acquisitionRef})||post.ref.id===source.getChallengeRef.id
   ||c.requestId===source.getRequestId||s.sequence<=source.getConsumedSequence||s.serverNonceDigest===source.getServerNonceDigest
   ||contentHash(Buffer.from(c.clientNonce,'base64url'))===source.getClientNonceDigest
   ||Date.parse(c.issuedAt)<Date.parse(source.observedAt)||Date.parse(c.issuedAt)>at.getTime()||Date.parse(c.expiresAt)<=at.getTime()
   ||Date.parse(c.expiresAt)>Date.parse(source.deadline)||Math.abs(Date.parse(s.request.issuedAt)-Date.parse(c.issuedAt))>30000)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const result={post,source};freeze(result);return result;
 }

 #matchBody(input:ReturnType<typeof body>,source:Awaited<ReturnType<NormalUnderstandingReadResult['challengeBasis']>>,binding:any){
  const m=input.metadata;
  if(source.bodyHash!==input.bodyHash||!same(source.requestRef,m.requestRef)||!same(source.acquisitionRef,m.acquisitionRef)
   ||!same(source.context.contextBundleRef,m.contextBundleRef)||m.projectId!==binding.projectId||m.executionId!==binding.executionId
   ||m.executionGeneration!==binding.executionGeneration)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
 }

 /** 나중에 온 본문도 같은 서버 원장 경로로 도출하며 원 target/bodyHash와 비교한다. */
 async current(db:PoolClient,token:string,binding:any,credentialRef:unknown,value:unknown,at:Date,target:unknown){
  const input=body(value);
  const source=await this.challengeBasis(db,token,binding,credentialRef,target,at);
  this.#matchBody(input,source,binding);
  return source;
 }

 /** 내부 거래의 준비 검산만 수행한다. fresh POST 원장의 proof를 확인해도 전송 권위를 발급하지 않는다. */
 async inspect(connector:string,execution:string,token:string,packet:unknown,value:unknown,signal:AbortSignal){
  const input=body(value);let frame:any;
  try{frame=JSON.parse(canonicalJson(packet));}catch{return fail('INPUT_INVALID',400);}
  if(!uuidV1(connector)||!uuidV1(execution)||!hashV1(token)||!(signal instanceof AbortSignal)||signal.aborted
   ||!recordV1(frame,['schemaVersion','challengeRef','proof','signature'])||frame.schemaVersion!==1||!refV1(frame.challengeRef)||frame.challengeRef.version!==1
   ||!recordV1(frame.proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])
   ||!refV1(frame.proof.grantRef)||!uuidV1(frame.proof.requestId)||!positive(frame.proof.credentialGeneration)
   ||Buffer.byteLength(canonicalJson(frame))+Buffer.byteLength(input.text)>2*1024*1024)fail('INPUT_INVALID',400);
  const target=executionTarget('POST','/api/v1/connectors/'+connector+'/executions/'+execution+'/understanding-response-read/'+input.metadata.requestRef.id+'/result',[],input.text);
  let db:PoolClient;
  try{db=await this.pool.connect();}catch{return fail();}
  let committing=false,committed=false,discard:Error|undefined,mono=performance.now();
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
   if((await db.query('SELECT id FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=2',[...keys,c.id])).rows.length)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   const lastMark=mark(),lastCred=await requestCredential(db,token,connector,execution,p),last=await readCurrent(db,cred.project,connector,execution,p);
   const {source:lastSource}=await this.validateChallenge(db,token,last.binding,lastCred.ref,rows[0],last.now);
   this.#matchBody(input,lastSource,last.binding);
   if(!same(cred,lastCred)||!same(b,last.binding)||cur.spki!==last.spki||!same(source,lastSource)||last.now<cur.now||last.now.getTime()>=ends||signal.aborted)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   // DB 시각의 잔여 한도를 원 monotonic 표본에 결박한다. COMMIT 대기 시간도 한도를 소비한다.
   const monoEnd=Math.min(firstMark+ends-cur.now.getTime(),lastMark+ends-last.now.getTime());
   if(mark()>=monoEnd)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   committing=true;if((await db.query('COMMIT')).command!=='COMMIT')throw Error();committing=false;committed=true;
   if(signal.aborted||mark()>=monoEnd)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   return {status:'NATIVE_SOURCE_AUTHORITY_REQUIRED' as const,requestRef:source.requestRef,acquisitionRef:source.acquisitionRef,bodyHash:source.bodyHash,
    cacheControl:'no-store' as const,resultStored:false as const,nonceConsumed:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
  }catch(error){
   // 정상 COMMIT 뒤의 늦은 취소/만료는 저장 불명이나 새 ROLLBACK으로 재분류하지 않는다.
   if(committed){if(error instanceof AuthFailure)throw error;return fail();}
   if(committing)discard=new Error('NORMAL_UNDERSTANDING_RESULT_COMMIT_UNKNOWN');
   try{if((await db.query('ROLLBACK')).command!=='ROLLBACK')discard??=new Error('NORMAL_UNDERSTANDING_RESULT_ROLLBACK_UNKNOWN');}catch{discard??=new Error('NORMAL_UNDERSTANDING_RESULT_ROLLBACK_UNKNOWN');}
   if(committing||discard)fail();if(error instanceof AuthFailure)throw error;
   if(error instanceof Error&&error.message==='NORMAL_UNDERSTANDING_RESULT_DENIED')fail(error.message,412);
   return fail();
  }finally{db.release(discard);}
 }
}
