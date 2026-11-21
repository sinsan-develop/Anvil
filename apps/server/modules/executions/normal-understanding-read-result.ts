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

 /** 미래의 목적 challenge/result 거래가 같은 PoolClient와 readCurrent 근거로 재사용할 조회. */
 async current(db:PoolClient,token:string,binding:any,credentialRef:unknown,value:unknown,at:Date){
  const input=body(value),m=input.metadata;
  if(!hashV1(token)||!refV1(credentialRef)||!(at instanceof Date)||!Number.isFinite(at.getTime())
   ||m.projectId!==binding.projectId||m.executionId!==binding.executionId||m.executionGeneration!==binding.executionGeneration)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  const rows=(await db.query('SELECT anvil.fn09_normal_understanding_result_basis($1,$2,$3,$4) AS basis',
   [token,JSON.stringify(binding),JSON.stringify(m.requestRef),JSON.stringify(m.acquisitionRef)])).rows;
  const v=rows[0]?.basis,s=v?.snapshot,r=v?.receipt,get=v?.getChallenge,used=v?.getConsumed;
  if(rows.length!==1||!recordV1(v,['requestRef','snapshot','acquisitionRef','receipt','getChallenge','getConsumed','deadline'])
   ||!same(v.requestRef,m.requestRef)||!same(v.acquisitionRef,m.acquisitionRef)||hash(s)!==m.requestRef.contentHash
   ||!recordV1(s,['schemaVersion','purpose','request','context','requestedBy','policyRef','state','sourceScope','createdAt','expiresAt'])
   ||s.schemaVersion!==1||s.purpose!=='NORMAL_UNDERSTANDING_METADATA_DISCOVERY'||s.state!=='PENDING_SOURCE'||s.sourceScope!==null
   ||!recordV1(s.context,contextKeys)||!same(s.context.grantRef,binding.grantRef)||s.context.projectId!==binding.projectId
   ||s.context.executionId!==binding.executionId||s.context.executionGeneration!==binding.executionGeneration
   ||s.context.connectorId!==binding.connectorId||s.context.credentialGeneration!==binding.credentialGeneration
   ||!uuidV1(s.context.startCommandId)||!contextKeys.filter(k=>k.endsWith('Ref')).every(k=>refV1(s.context[k]))
   ||!same(s.context.contextBundleRef,m.contextBundleRef)||!isoV1(s.createdAt)||!isoV1(s.expiresAt)
   ||!recordV1(r,receiptKeys)||r.kind!=='NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED'||hash(r)!==m.acquisitionRef.contentHash
   ||!same(r.binding,binding)||!same(r.credentialRef,credentialRef)||!same(r.understandingRequestRef,m.requestRef)||!same(r.context,s.context)
   ||!hashV1(r.packetHash)||!uuidV1(r.requestId)||!isoV1(r.observedAt)||!isoV1(r.expiresAt)
   ||!recordV1(get,['id','content_hash','snapshot_json'])||!recordV1(used,['ref','snapshot'])||!refV1(used.ref)||used.ref.version!==2
   ||used.ref.id!==get.id||hash(used.snapshot)!==used.ref.contentHash||!positive(used.snapshot.sequence)
   ||used.snapshot.sequence<=get.snapshot_json?.sequence||!isoV1(v.deadline))fail();
  const old=original(get,binding,'EXECUTION_REQUEST',credentialRef),c=old.challenge;
  const getTarget=executionTarget('GET','/api/v1/connectors/'+binding.connectorId+'/executions/'+binding.executionId+'/understanding-response-read',[],null);
  if(!same(r.challengeRef,old.ref)||!same(r.target,getTarget)||!same(get.snapshot_json.request.target,getTarget)
   ||r.requestId!==c.requestId||!same(get.snapshot_json.understandingRequestRef,m.requestRef)
   ||!same(used.snapshot,{...get.snapshot_json,sequence:used.snapshot.sequence,previousRef:old.ref,consumption:{resultRef:m.acquisitionRef,packetHash:r.packetHash,consumedAt:r.observedAt}})
   ||Date.parse(r.observedAt)<Date.parse(c.issuedAt)||Date.parse(r.observedAt)>at.getTime()
   ||Date.parse(r.expiresAt)>Math.min(Date.parse(c.expiresAt),Date.parse(s.expiresAt))
   ||Date.parse(v.deadline)>Date.parse(r.expiresAt)||Date.parse(v.deadline)<=at.getTime())fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
  return {requestRef:v.requestRef,acquisitionRef:v.acquisitionRef,context:s.context,getChallengeRef:old.ref,getRequestId:c.requestId,
   observedAt:r.observedAt,deadline:v.deadline,bodyHash:input.bodyHash};
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
   if(rows.length!==1)fail();const post=original(rows[0],b,'EXECUTION_REQUEST',cred.ref);
   if(!same(rows[0].snapshot_json.request.target,target))fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   verifyNormalCommandPageProof(cur.spki,frame.signature,p,b,post.challenge,target);
   const source=await this.current(db,token,b,cred.ref,input.value,cur.now);
   const ends=Math.min(cred.expiresAt,cur.deadline.getTime(),Date.parse(source.deadline),Date.parse(post.challenge.expiresAt));
   if(c.id===source.getChallengeRef.id||p.requestId===source.getRequestId||Date.parse(post.challenge.expiresAt)>Math.min(cred.expiresAt,cur.deadline.getTime(),Date.parse(source.deadline))
    ||Date.parse(post.challenge.issuedAt)<Date.parse(source.observedAt)
    ||cur.now.getTime()<Date.parse(post.challenge.issuedAt)||cur.now.getTime()>=ends||signal.aborted)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   // GET 단일성은 목적 RPC가 원 GET requestId로 검산한다.
   // POST는 별도 미소비 원장 신원만 쓰며 원 GET v1/v2를 대체하거나 다시 소비하지 않는다.
   if((await db.query('SELECT id FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=2',[...keys,c.id])).rows.length)fail('NORMAL_UNDERSTANDING_RESULT_DENIED',412);
   const lastMark=mark(),lastCred=await requestCredential(db,token,connector,execution,p),last=await readCurrent(db,cred.project,connector,execution,p);
   const lastSource=await this.current(db,token,last.binding,lastCred.ref,input.value,last.now);
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
