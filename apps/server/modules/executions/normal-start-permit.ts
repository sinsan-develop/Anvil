import {randomUUID} from 'node:crypto';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1,type DispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {executionFactChecks,readServerExecutionFactV1,type ServerExecutionFactV1} from '../../../../contracts/runtime/server-execution-fact-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionTarget,verifyNormalCommandPageProof} from './execution-proof.ts';
import {original,readCurrent} from './normal-exchange-challenge.ts';
import {normalRequestBearerDigest,requestCredential} from './normal-request-challenge.ts';

/** FN08 normal START 일회 실행 허가(permit). 계약: docs/contracts/FN08_NORMAL_START_PERMIT_CONTRACT_20261113.md r1.
 * permit은 기한(최대 30초) 안에서 이 명령의 시작 시도 한 번만 허가한다. 서버는 전송하지 않는다(dispatchPerformed=false). */
const bodyLimit=16384;
function deny(code='EXECUTION_PERMIT_REJECTED',status=412):never{throw new AuthFailure(code,status);}
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
type Request={envelopeHash:string;localAttemptRef:Ref;sourceObservationRefs:Ref[];osOwnershipRef:Ref};
type FactScope={projectId:string;executionId:string;executionGeneration:number;grantRef:Ref;commandId:string;envelopeHash:string};
/** 서버 조립 때 주입하는 현재 실행 사실 공급자. HTTP 입력으로 사실을 받지 않으며, 공급자 결과도 아래에서 다시 검산한다. */
export interface NormalPermitCurrentSource{observe(scope:Readonly<FactScope>,signal:AbortSignal):Promise<unknown>}
export interface NormalStartPermitOptions{pool:Pick<Pool,'connect'>;origin:string;current?:NormalPermitCurrentSource}
const receiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','commandRef','envelopeHash','requestHash','observedAt','expiresAt'];
const permitKeys=['scope','commandId','commandRef','request','requestHash','proofRef','bindingHash','currentFact','state','issuedAt','expiresAt','executionAuthorized','dispatchPerformed'];

function readRequest(raw:unknown):Request{
 if(!recordV1(raw,['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])||!hashV1(raw.envelopeHash)||!refV1(raw.localAttemptRef)||!refV1(raw.osOwnershipRef)||
   !arrayV1(raw.sourceObservationRefs,200)||!raw.sourceObservationRefs.length||!raw.sourceObservationRefs.every(refV1)||
   new Set(raw.sourceObservationRefs.map(r=>canonicalJson(r))).size!==raw.sourceObservationRefs.length)return deny('INPUT_INVALID',400);
 return cloneV1(raw) as unknown as Request;
}
async function boundedFact(source:NormalPermitCurrentSource,scope:FactScope,outer:AbortSignal){
 const controller=new AbortController(),timeoutMs=2000,until=performance.now()+timeoutMs;let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=()=>controller.abort();outer.addEventListener('abort',stop,{once:true});
 try{
  const timeout=new Promise<never>((_,fail)=>{timer=setTimeout(()=>fail(new AuthFailure('EXECUTION_PERMIT_CURRENT_TIMEOUT',503)),timeoutMs);});
  let result:unknown;
  try{result=await Promise.race([timeout,source.observe(Object.freeze(cloneV1(scope)),controller.signal)]);}
  catch(error){if(error instanceof AuthFailure)throw error;return deny('EXECUTION_PERMIT_CURRENT_UNAVAILABLE',503);}
  if(performance.now()>=until||outer.aborted)deny('EXECUTION_PERMIT_CURRENT_TIMEOUT',503);
  return result;
 }finally{clearTimeout(timer);outer.removeEventListener('abort',stop);controller.abort();}
}
/** 합성 permit #current와 같은 기준으로 공급자 사실을 원 START 명령·현재 binding에 대조한다. */
function checkFact(raw:unknown,b:any,e:DispatchEnvelopeV1,request:Request,now:Date,grantBinding:unknown):ServerExecutionFactV1{
 // normal 사실(normal-initial-execution.ts:211)은 합성 형식과 세 곳이 다르다: transport NORMAL_PROTECTED,
 // executionCredentialReservation{id,generation} 추가, agentSession의 credentialGeneration 대신 bindingGeneration.
 // 이 차이를 명시 검산한 뒤 나머지 형식은 기존 검사기로 확인한다. 저장·결박에는 원래 normal 사실을 쓴다.
 let r:any;try{r=cloneV1(raw);}catch{return deny('EXECUTION_PERMIT_CURRENT_INVALID');}
 const res=r?.executionCredentialReservation,ag=r?.agentSession;
 if(!r||typeof r!=='object'||r.transport!=='NORMAL_PROTECTED'||!recordV1(res,['id','generation'])||!uuidV1(res.id)||!Number.isSafeInteger(res.generation)||res.generation<1||
   !recordV1(ag,['sessionRef','roleBindingRef','bindingGeneration'])||!Number.isSafeInteger(ag.bindingGeneration)||ag.bindingGeneration<1)
  return deny('EXECUTION_PERMIT_CURRENT_INVALID');
 const {executionCredentialReservation:_reservation,...shape}=r;
 let f:ServerExecutionFactV1;
 try{readServerExecutionFactV1({...shape,transport:'SYNTHETIC_ONLY',agentSession:{sessionRef:ag.sessionRef,roleBindingRef:ag.roleBindingRef,credentialGeneration:ag.bindingGeneration}});f=r;}
 catch{return deny('EXECUTION_PERMIT_CURRENT_INVALID');}
 // 현재 사실은 원 START grant binding과 같고 확인 시각·검사·만료·writer만 다를 수 있다(0089 guard와 같은 규칙).
 const stable=(v:any)=>{const {checkedAt:_c,checks:_k,expires:_e,writerState:_w,...rest}=v??{};return rest;};
 if(!recordV1(grantBinding,Object.keys(r))||!same(stable(r),stable(grantBinding)))return deny('EXECUTION_PERMIT_CURRENT_AUTHORITY_REQUIRED');
 const at=now.getTime();
 if(f.projectId!==b.projectId||f.executionId!==b.executionId||f.executionGeneration!==b.executionGeneration||f.registration.connectorId!==b.connectorId||
   f.registration.hostPublicKeyFingerprint!==b.publicKeyFingerprint||f.writerState!=='OWNED'||
   executionFactChecks.some(n=>n!=='understanding'&&f.checks[n].state!=='VERIFIED_CURRENT')||Date.parse(f.checkedAt)>at||at-Date.parse(f.checkedAt)>30000||
   f.intent.mode==='WORK'&&(f.understandingReviewRef===null||f.checks.understanding.state!=='VERIFIED_CURRENT')||
   f.intent.mode==='CONTEXT_REVIEW'&&f.intent.sourceScopes.some(s=>s.targets.some(t=>t.access!=='READ')))return deny('EXECUTION_PERMIT_CURRENT_AUTHORITY_REQUIRED');
 const p=e.payload as {contextBundleRef?:Ref};
 if(!same(e.executorRegistrationRef,f.registration.ref)||!same(p.contextBundleRef,f.intent.contextBundleRef)||
   !same(e.context,{projectId:f.projectId,assignmentId:f.intent.assignmentRef.id,executionId:f.executionId,executionGeneration:f.executionGeneration,
    connectionRef:f.intent.connectionRef,environmentRef:f.intent.environmentRef,authorizationReceiptRef:e.context.authorizationReceiptRef,capabilityRef:f.intent.capabilityRef,
    budgetRef:f.budgetReservationRef,sourceScopes:f.intent.sourceScopes}))return deny('EXECUTION_PERMIT_COMMAND_BINDING_INVALID');
 const sourceRefs=[...new Map(f.intent.sourceScopes.map(s=>[canonicalJson(s.observationRef),s.observationRef])).values()];
 if(!same(sourceRefs,request.sourceObservationRefs)||!f.checks.osFence.evidenceRefs.some(r=>same(r,request.osOwnershipRef)))return deny('EXECUTION_PERMIT_SOURCE_OS_MISMATCH');
 return f;
}
async function readCommand(db:PoolClient,pid:string,execution:string,g:Ref,generation:number,command:string,now:Date){
 const rows=(await db.query('SELECT * FROM anvil.normal_command_page_rows($1,$2,$3,$4,$5,$6,$7)',[pid,execution,g.id,g.version,generation,0,null])).rows;
 if(!arrayV1(rows,51))deny();
 const own=rows.filter((r:any)=>r?.envelope?.commandId===command);
 if(own.length!==1||own[0].valid!==true||!refV1(own[0].command_ref))deny('EXECUTION_PERMIT_COMMAND_NOT_FOUND',404);
 const r=own[0],e=readDispatchEnvelopeV1(r.envelope,now.getTime());
 if(e.operation!=='START_SESSION'||e.commandId!==command||e.context.projectId!==pid||e.context.executionId!==execution||e.context.executionGeneration!==generation||r.envelope_hash!==e.envelopeHash)deny();
 return {commandRef:r.command_ref as Ref,envelope:e};
}
type Packet={schemaVersion:1;challengeRef:Ref;proof:any;signature:string};
async function issue(o:NormalStartPermitOptions,connector:string,execution:string,command:string,tokenDigest:string,frame:Packet,
 target:ReturnType<typeof executionTarget>,request:Request,signal:AbortSignal,pre?:{scope:FactScope;fact:unknown}){
 const db=await o.pool.connect(),proof=frame.proof,g=proof.grantRef,c=frame.challengeRef;
 let committing=false,discard:Error|undefined;
 try{
  await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'");
  const cred=await requestCredential(db,tokenDigest,connector,execution,proof),pid=cred.project,keys=[pid,g.id,g.version];
  const current=await readCurrent(db,pid,connector,execution,proof),b=current.binding;
  const rows=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=1 AND content_hash=$5',[...keys,c.id,c.contentHash])).rows;
  if(rows.length!==1)deny();
  const old=rows[0],ch=original(old,b,'EXECUTION_REQUEST',cred.ref).challenge,at=current.now.getTime();
  if(!same(old.snapshot_json.request.target,target)||at<Date.parse(ch.issuedAt))deny();
  verifyNormalCommandPageProof(current.spki,frame.signature,proof,b,ch,target);
  const end=Math.min(cred.expiresAt,current.deadline.getTime(),Date.parse(ch.expiresAt));
  if(at>=end||signal.aborted)deny();
  const packetHash=digest({frame,target}),requestHash=digest(request);
  const previous=(await db.query(`SELECT v.content_hash AS vhash,v.snapshot_json AS consumed,r.id,r.content_hash,r.snapshot_json AS receipt
   FROM anvil.execution_challenges v LEFT JOIN anvil.execution_receipts r ON r.project_id=v.project_id AND r.challenge_id=v.id
   WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3 AND v.id=$4 AND v.version=2`,[...keys,c.id])).rows;
  if(previous.length>1)deny();
  const prior=previous[0],s=prior?.receipt;
  const m=await readCommand(db,pid,execution,g,b.executionGeneration,command,current.now);
  if(m.envelope.envelopeHash!==request.envelopeHash)deny('EXECUTION_PERMIT_COMMAND_BINDING_INVALID');
  const existing=(await db.query('SELECT id,content_hash,snapshot_json,proof_result_id FROM anvil.execution_start_permits WHERE project_id=$1 AND execution_id=$2 AND generation=$3',
   [pid,execution,b.executionGeneration])).rows;
  if(existing.length>1)deny();
  if(prior){
   // 같은 packet 재조회: 원 영수증과 permit만 다시 돌려준다. 공급자를 부르지 않고 새 기록을 만들지 않는다.
   if(!s||!uuidV1(prior.id)||prior.content_hash!==digest(s)||prior.vhash!==digest(prior.consumed)||!same(prior.consumed,{...old.snapshot_json,sequence:prior.consumed.sequence,previousRef:c,
     consumption:{consumedAt:s.observedAt,resultRef:{id:prior.id,version:1,contentHash:prior.content_hash},packetHash:s.packetHash}})||
    !recordV1(s,receiptKeys)||s.kind!=='NORMAL_START_PERMIT'||!same(s.binding,b)||!same(s.credentialRef,cred.ref)||!same(s.challengeRef,c))deny();
   if(s.packetHash!==packetHash||!same(s.target,target)||s.requestId!==proof.requestId||s.requestHash!==requestHash)deny('IDEMPOTENCY_CONFLICT',409);
   const row=existing[0],ps=row?.snapshot_json;
   if(!row||row.proof_result_id!==prior.id||row.content_hash!==digest(ps)||!recordV1(ps,permitKeys)||ps.state!=='NORMAL_START_PERMITTED'||ps.commandId!==command||
     !same(ps.proofRef,{id:prior.id,version:1,contentHash:prior.content_hash})||Date.parse(ps.expiresAt)<=at)deny('EXECUTION_PERMIT_EXPIRED');
   await db.query('ROLLBACK');
   return {out:respond({id:prior.id,version:1,contentHash:prior.content_hash},{id:row.id,version:1,contentHash:row.content_hash},ps)} as const;
  }
  // 실행 세대당 permit은 하나다.
  if(existing.length)deny('EXECUTION_PERMIT_ALREADY_ISSUED',409);
  const scope:FactScope={projectId:pid,executionId:execution,executionGeneration:b.executionGeneration,grantRef:cloneV1(g),commandId:command,envelopeHash:m.envelope.envelopeHash};
  if(typeof o.current?.observe!=='function')deny('EXECUTION_PERMIT_CURRENT_REQUIRED');
  // 공급자는 프로젝트 행 잠금·DB 연결을 쥔 채 부르지 않는다. 첫 거래를 되돌리고 거래 밖에서 사실을 받아 다시 들어온다.
  if(!pre){await db.query('ROLLBACK');return {needFact:scope} as const;}
  if(!same(pre.scope,scope))deny('EXECUTION_PERMIT_CURRENT_CHANGED');
  const grants=(await db.query('SELECT snapshot_json FROM anvil.execution_grants WHERE project_id=$1 AND id=$2 AND version=$3 AND content_hash=$4',[pid,g.id,g.version,g.contentHash])).rows;
  if(grants.length!==1||grants[0].snapshot_json?.transport!=='NORMAL_PROTECTED')deny();
  const f=checkFact(pre.fact,b,m.envelope,request,current.now,grants[0].snapshot_json.binding);
  const expires=Math.min(end,at+30000,Date.parse(m.envelope.expiresAt),...Object.values(f.expires).map(v=>Date.parse(v)));
  if(expires<=at)deny('EXECUTION_PERMIT_EXPIRED');
  const issuedAt=current.now.toISOString(),expiresAt=new Date(expires).toISOString();
  const receipt={kind:'NORMAL_START_PERMIT',binding:b,credentialRef:cred.ref,challengeRef:c,packetHash,target,requestId:proof.requestId,commandRef:m.commandRef,
   envelopeHash:m.envelope.envelopeHash,requestHash,observedAt:issuedAt,expiresAt};
  const receiptRef={id:randomUUID(),version:1,contentHash:digest(receipt)};
  const permitScope={mode:'EXECUTION',projectId:pid,connectorId:connector,executionId:execution,executionGeneration:b.executionGeneration,grantRef:cloneV1(g),credentialGeneration:b.credentialGeneration};
  const {checkedAt:_checked,...factBinding}=f;
  const permit={scope:permitScope,commandId:command,commandRef:m.commandRef,request,requestHash,proofRef:receiptRef,
   bindingHash:digest({scope:permitScope,commandRef:m.commandRef,authorizationReceiptRef:m.envelope.context.authorizationReceiptRef,fact:factBinding}),
   currentFact:f,state:'NORMAL_START_PERMITTED',issuedAt,expiresAt,executionAuthorized:true,dispatchPerformed:false};
  const permitRef={id:randomUUID(),version:1,contentHash:digest(permit)};
  const seq=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
  if(!Number.isSafeInteger(seq)||seq<2||seq>20000)deny();
  const v2={...old.snapshot_json,sequence:seq,previousRef:c,consumption:{resultRef:receiptRef,packetHash,consumedAt:issuedAt}};
  // v2 소비 행은 기존 normal 소비 guard(normal_command_consumption_valid)가 normal_page_verified로, 영수증은 0089 guard가 normal_permit_verified로 검산한다.
  await db.query("SELECT set_config('anvil.normal_page_verified',txid_current()::text||':'||$1||':'||$2,true)",[receiptRef.contentHash,tokenDigest]);
  await db.query("SELECT set_config('anvil.normal_permit_verified',txid_current()::text||':'||$1||':'||$2,true)",[receiptRef.contentHash,tokenDigest]);
  if((await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,2,$3,$4,$5,$6,$7)',[pid,c.id,g.id,g.version,seq,digest(v2),JSON.stringify(v2)])).rowCount!==1)deny();
  if((await db.query('INSERT INTO anvil.execution_receipts(project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,1,$6,$7)',[pid,receiptRef.id,g.id,g.version,c.id,receiptRef.contentHash,JSON.stringify(receipt)])).rowCount!==1)deny();
  if((await db.query('INSERT INTO anvil.execution_start_permits(project_id,execution_id,generation,id,version,proof_result_id,proof_result_version,content_hash,snapshot_json) VALUES($1,$2,$3,$4,1,$5,1,$6,$7)',
   [pid,execution,b.executionGeneration,permitRef.id,receiptRef.id,permitRef.contentHash,JSON.stringify(permit)])).rowCount!==1)deny();
  // 마지막 await 뒤 credential·현재 권위·명령이 그대로인지 다시 확인한 뒤에만 확정한다.
  const lastCred=await requestCredential(db,tokenDigest,connector,execution,proof),last=await readCurrent(db,pid,connector,execution,proof);
  const again=await readCommand(db,pid,execution,g,b.executionGeneration,command,last.now);
  if(!same(lastCred,cred)||!same(last.binding,b)||last.spki!==current.spki||last.now<current.now||signal.aborted||!same(again,m)||
    last.deadline.getTime()<expires||last.now.getTime()>=expires)deny();
  committing=true;
  if((await db.query('COMMIT')).command!=='COMMIT')throw Error();
  committing=false;return {out:respond(receiptRef,permitRef,permit)} as const;
 }catch(error){
  if(committing)discard=new Error('EXECUTION_PERMIT_COMMIT_UNKNOWN');
  try{await db.query('ROLLBACK');}catch{discard??=new Error('EXECUTION_PERMIT_ROLLBACK_UNKNOWN');}
  if(committing)deny('EXECUTION_PERMIT_COMMIT_UNKNOWN',503);
  throw error;
 }finally{db.release(discard);}
}
function respond(proofResultRef:Ref,permitRef:Ref,p:any){
 return {transport:'NORMAL_PROTECTED',proofResultRef,permit:{ref:permitRef,commandId:p.commandId,envelopeHash:p.request.envelopeHash,issuedAt:p.issuedAt,expiresAt:p.expiresAt},
  cacheControl:'no-store',nonceConsumed:true,executionAuthorized:true,dispatchPerformed:false};
}
/** 명시 옵션으로만 등록한다. 본문은 엄격 UTF-8 canonical JSON이어야 하며 서명 대상 본문 hash와 같아야 한다. */
export function registerNormalStartPermit(app:FastifyInstance,o:NormalStartPermitOptions,readPacket:(request:FastifyRequest,allowBody?:boolean)=>any){
 const origin=new URL(o.origin);
 if(origin.protocol!=='https:'||origin.origin!==o.origin)throw Error('EXECUTION_PERMIT_HOST_REQUIRED');
 app.register(async scope=>{
  scope.removeContentTypeParser('application/json');
  scope.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit},(_req,buf,done)=>{
   try{const text=new TextDecoder('utf-8',{fatal:true}).decode(buf as Buffer),value=parseWireJson(text);if(canonicalJson(value)!==text)throw Error();done(null,{text,value});}
   catch{done(new AuthFailure('INPUT_INVALID',400),undefined);}
  });
  scope.post<{Params:{cid:string;eid:string;command:string}}>('/api/v1/connectors/:cid/executions/:eid/commands/:command/permit',{bodyLimit,handlerTimeout:20000},async(r,reply)=>{
   const {cid,eid,command}=r.params,path='/api/v1/connectors/'+cid+'/executions/'+eid+'/commands/'+command+'/permit';
   if(![cid,eid,command].every(uuidV1)||r.raw.method!=='POST'||r.raw.url!==path)return reply.callNotFound();
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(r.headers['content-type']??''))deny('INPUT_INVALID',400);
   const body=r.body as {text:string;value:unknown}|undefined;
   if(!body||typeof body.text!=='string')deny('INPUT_INVALID',400);
   const request=readRequest(body!.value),target=executionTarget('POST',path,[],body!.text);
   const token=normalRequestBearerDigest(r,origin.host,true),packet=readPacket(r,true) as Packet;
   const run=(pre?:{scope:FactScope;fact:unknown})=>issue(o,cid,eid,command,token,packet,target,request,r.signal,pre);
   const first=await run();
   if('out' in first)return first.out;
   const fact=await boundedFact(o.current!,first.needFact,r.signal);
   const second=await run({scope:first.needFact,fact});
   if(!('out' in second))deny('EXECUTION_PERMIT_CURRENT_CHANGED');
   return second.out;
  });
 });
}
