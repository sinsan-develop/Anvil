import {randomUUID} from 'node:crypto';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionTarget,verifyNormalCommandPageProof} from './execution-proof.ts';
import {original,readCurrent} from './normal-exchange-challenge.ts';
import {normalRequestBearerDigest,requestCredential} from './normal-request-challenge.ts';

/** FN08 normal 실행 관측. 계약: docs/contracts/FN08_NORMAL_OBSERVATIONS_CONTRACT_20261113.md r1.
 * 관측은 실행기의 주장(PROVIDER_CLAIM_ONLY)이다. STARTED/STOPPED/HEARTBEAT로 writer 회수·업무 완료를 확정하지 않는다. */
const bodyLimit=1024*1024;
function deny(code='EXECUTION_OBSERVATION_REJECTED',status=412):never{throw new AuthFailure(code,status);}
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const types=['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED','STARTED','REJECTED','UNKNOWN','STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED','HEARTBEAT'];
const reasons=['NONE','UNVERIFIED_PROVIDER_CLAIM','PROVIDER_RESPONSE_LOST','RECORD_UNCERTAIN','STOP_UNCONFIRMED','REJECTED_BY_PROVIDER'];
const eventKeys=['projectId','executionId','executionGeneration','sequence','eventId','type','commandId','envelopeHash','localRecordRef','processRef','occurredAt','reasonCode'];
const receiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','bodyHash','ackRef','observedAt'];
type Event={projectId:string;executionId:string;executionGeneration:number;sequence:number;eventId:string;type:string;commandId:string;envelopeHash:string;
 localRecordRef:Ref;processRef:Ref|null;occurredAt:string;reasonCode:string};
type Scope={projectId:string;executionId:string;executionGeneration:number};
export interface NormalObservationsOptions{pool:Pick<Pool,'connect'>;origin:string}

function readEvent(raw:unknown,scope:Scope,now:number):Event{
 if(Buffer.byteLength(canonicalJson(raw))>65536)deny('INPUT_INVALID',400);
 if(!recordV1(raw,eventKeys)||raw.projectId!==scope.projectId||raw.executionId!==scope.executionId||raw.executionGeneration!==scope.executionGeneration||
   !positive(raw.sequence)||raw.sequence>10000||!uuidV1(raw.eventId)||!types.includes(raw.type)||!uuidV1(raw.commandId)||!hashV1(raw.envelopeHash)||
   !refV1(raw.localRecordRef)||raw.processRef!==null&&!refV1(raw.processRef)||!isoV1(raw.occurredAt)||Date.parse(raw.occurredAt)>now+30000||!reasons.includes(raw.reasonCode))
  return deny('INPUT_INVALID',400);
 return cloneV1(raw) as unknown as Event;
}
function readBatch(raw:unknown,scope:Scope,now:number){
 if(!recordV1(raw,['events','batchHash'])||!arrayV1(raw.events,200)||!raw.events.length||!hashV1(raw.batchHash)||raw.batchHash!==digest(raw.events))deny('INPUT_INVALID',400);
 return (raw as any).events.map((e:unknown)=>readEvent(e,scope,now)) as Event[];
}
/** 합성 관측과 같은 연속 ACK 요약. */
function summarize(events:Event[],scope:Scope){
 const sorted=[...events].sort((a,b)=>a.sequence-b.sequence);let highest=0,chain=digest([]),expected=1;const gaps:{from:number;to:number}[]=[];
 for(const e of sorted){if(e.sequence>expected)gaps.push({from:expected,to:e.sequence-1});expected=e.sequence+1;
  if(e.sequence===highest+1){highest++;chain=digest({previous:chain,eventHash:digest(e)});}}
 return {execution:{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration},highestContiguous:highest,
  maxSequence:sorted.at(-1)?.sequence??0,contiguousDigest:chain,gaps,storedCount:events.length,writerReleaseVerified:false,executionAuthorized:false,dispatchPerformed:false};
}
async function readLedger(db:PoolClient,pid:string,execution:string,generation:number,scope:Scope){
 const rows=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_observations WHERE project_id=$1 AND execution_id=$2 AND generation=$3 ORDER BY event_sequence',[pid,execution,generation])).rows;
 if(!arrayV1(rows,10000))deny('EXECUTION_OBSERVATION_LEDGER_INVALID',503);
 const events:Event[]=[];const seq=new Set<number>(),ids=new Set<string>();let bytes=0;
 for(const r of rows){
  const s=r.snapshot_json;
  if(!recordV1(s,['event','grantRef','credentialGeneration','mode','receivedAt','transport','verification'])||r.content_hash!==digest(s)||s.mode!=='EXECUTION'||
    !['SYNTHETIC_ONLY','NORMAL_PROTECTED'].includes(s.transport)||s.verification!=='PROVIDER_CLAIM_ONLY')deny('EXECUTION_OBSERVATION_LEDGER_INVALID',503);
  // 저장된 사건의 발생 시각 상한은 저장 당시 검산했으므로 여기서는 형식만 본다.
  let e:Event;try{e=readEvent(s.event,scope,Infinity);}catch{return deny('EXECUTION_OBSERVATION_LEDGER_INVALID',503);}
  if(seq.has(e.sequence)||ids.has(e.eventId))deny('EXECUTION_OBSERVATION_LEDGER_INVALID',503);seq.add(e.sequence);ids.add(e.eventId);events.push(e);bytes+=Buffer.byteLength(canonicalJson(s));
 }
 const acks=(await db.query('SELECT id,version,content_hash,snapshot_json FROM anvil.execution_acknowledgements WHERE project_id=$1 AND execution_id=$2 AND generation=$3 ORDER BY version DESC LIMIT 1',[pid,execution,generation])).rows;
 const ack=acks[0]??null;
 if(ack){const {recordedAt:_r,...summary}=ack.snapshot_json??{};if(ack.content_hash!==digest(ack.snapshot_json)||!same(summary,summarize(events,scope)))deny('EXECUTION_OBSERVATION_LEDGER_INVALID',503);}
 else if(events.length)deny('EXECUTION_OBSERVATION_LEDGER_INVALID',503);
 return {events,bytes,ack:ack as null|{id:string;version:number;content_hash:string;snapshot_json:any}};
}
type Packet={schemaVersion:1;challengeRef:Ref;proof:any;signature:string};
async function ingest(o:NormalObservationsOptions,connector:string,execution:string,tokenDigest:string,frame:Packet,target:ReturnType<typeof executionTarget>,body:unknown,signal:AbortSignal){
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
  if(at>=Math.min(cred.expiresAt,current.deadline.getTime(),Date.parse(ch.expiresAt))||signal.aborted)deny();
  const scope:Scope={projectId:pid,executionId:execution,executionGeneration:b.executionGeneration};
  const incoming=readBatch(body,scope,at),packetHash=digest({frame,target});
  const previous=(await db.query(`SELECT v.content_hash AS vhash,v.snapshot_json AS consumed,r.id,r.content_hash,r.snapshot_json AS receipt
   FROM anvil.execution_challenges v LEFT JOIN anvil.execution_receipts r ON r.project_id=v.project_id AND r.challenge_id=v.id
   WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3 AND v.id=$4 AND v.version=2`,[...keys,c.id])).rows;
  if(previous.length>1)deny();
  const prior=previous[0],s=prior?.receipt;
  if(prior){
   // 같은 packet 재조회: 최초 ACK 버전을 그대로 돌려준다.
   if(!s||!uuidV1(prior.id)||prior.content_hash!==digest(s)||prior.vhash!==digest(prior.consumed)||!same(prior.consumed,{...old.snapshot_json,sequence:prior.consumed.sequence,previousRef:c,
     consumption:{consumedAt:s.observedAt,resultRef:{id:prior.id,version:1,contentHash:prior.content_hash},packetHash:s.packetHash}})||
    !recordV1(s,receiptKeys)||s.kind!=='NORMAL_OBSERVATIONS'||!same(s.binding,b)||!same(s.credentialRef,cred.ref)||!same(s.challengeRef,c)||!refV1(s.ackRef))deny();
   if(s.packetHash!==packetHash||!same(s.target,target)||s.requestId!==proof.requestId)deny('IDEMPOTENCY_CONFLICT',409);
   const a=(await db.query('SELECT id,version,content_hash,snapshot_json FROM anvil.execution_acknowledgements WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND id=$4 AND version=$5',
    [pid,execution,b.executionGeneration,s.ackRef.id,s.ackRef.version])).rows[0];
   if(!a||a.content_hash!==s.ackRef.contentHash||a.content_hash!==digest(a.snapshot_json))deny('EXECUTION_OBSERVATION_LEDGER_INVALID',503);
   await db.query('ROLLBACK');
   return respond({id:prior.id,version:1,contentHash:prior.content_hash},s.ackRef,a.snapshot_json);
  }
  // 사건의 명령은 이 실행·세대의 원 normal 명령이어야 한다.
  const commands=(await db.query('SELECT * FROM anvil.normal_command_page_rows($1,$2,$3,$4,$5,$6,$7)',[pid,execution,g.id,g.version,b.executionGeneration,0,null])).rows;
  if(!arrayV1(commands,51))deny();
  const known=new Map<string,string>();
  for(const r of commands){if(r?.valid!==true)continue;try{const e=readDispatchEnvelopeV1(r.envelope,Date.parse(r.envelope?.issuedAt));known.set(e.commandId,e.envelopeHash);}catch{deny('EXECUTION_OBSERVATION_LEDGER_INVALID',503);}}
  for(const e of incoming)if(known.get(e.commandId)!==e.envelopeHash)deny('EXECUTION_OBSERVATION_COMMAND_MISMATCH');
  const ledger=await readLedger(db,pid,execution,b.executionGeneration,scope);
  const bySeq=new Map(ledger.events.map(e=>[e.sequence,e])),ids=new Set(ledger.events.map(e=>e.eventId)),fresh:Event[]=[];
  for(const e of incoming){
   const before=bySeq.get(e.sequence);
   if(before){if(!same(before,e))deny('EXECUTION_OBSERVATION_SEQUENCE_CONFLICT',409);continue;}
   if(ids.has(e.eventId))deny('EXECUTION_OBSERVATION_EVENT_ID_CONFLICT',409);
   if(ledger.events.length+fresh.length>=10000)deny('EXECUTION_OBSERVATION_LIFETIME_LIMIT',409);
   // SQL guard와 같은 누적 16 MiB 상한(관측 행 snapshot canonical 크기)을 DB 오류 대신 409로 거절한다.
   ledger.bytes+=Buffer.byteLength(canonicalJson({event:e,grantRef:g,credentialGeneration:b.credentialGeneration,mode:'EXECUTION',receivedAt:current.now.toISOString(),transport:'NORMAL_PROTECTED',verification:'PROVIDER_CLAIM_ONLY'}));
   if(ledger.bytes>16*1024*1024)deny('EXECUTION_OBSERVATION_LIFETIME_LIMIT',409);
   fresh.push(e);bySeq.set(e.sequence,e);ids.add(e.eventId);
  }
  const observedAt=current.now.toISOString(),all=[...ledger.events,...fresh];
  let ackRef:Ref,ackSnapshot:any;
  if(!fresh.length&&ledger.ack){ackRef={id:ledger.ack.id,version:Number(ledger.ack.version),contentHash:ledger.ack.content_hash};ackSnapshot=ledger.ack.snapshot_json;}
  else{ackSnapshot={...summarize(all,scope),recordedAt:observedAt};ackRef={id:ledger.ack?.id??randomUUID(),version:Number(ledger.ack?.version??0)+1,contentHash:digest(ackSnapshot)};}
  const receipt={kind:'NORMAL_OBSERVATIONS',binding:b,credentialRef:cred.ref,challengeRef:c,packetHash,target,requestId:proof.requestId,bodyHash:target.bodyHash,ackRef,observedAt};
  const receiptRef={id:randomUUID(),version:1,contentHash:digest(receipt)};
  const seq=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
  if(!Number.isSafeInteger(seq)||seq<2||seq>20000)deny();
  const v2={...old.snapshot_json,sequence:seq,previousRef:c,consumption:{resultRef:receiptRef,packetHash,consumedAt:observedAt}};
  // v2 소비 행은 기존 normal 소비 guard가 normal_page_verified로, 영수증·관측 행은 0090 guard가 normal_observation_verified로 검산한다.
  await db.query("SELECT set_config('anvil.normal_page_verified',txid_current()::text||':'||$1||':'||$2,true)",[receiptRef.contentHash,tokenDigest]);
  await db.query("SELECT set_config('anvil.normal_observation_verified',txid_current()::text||':'||$1||':'||$2,true)",[receiptRef.contentHash,tokenDigest]);
  if((await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,2,$3,$4,$5,$6,$7)',[pid,c.id,g.id,g.version,seq,digest(v2),JSON.stringify(v2)])).rowCount!==1)deny();
  if((await db.query('INSERT INTO anvil.execution_receipts(project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,1,$6,$7)',[pid,receiptRef.id,g.id,g.version,c.id,receiptRef.contentHash,JSON.stringify(receipt)])).rowCount!==1)deny();
  for(const e of fresh){
   const snap={event:e,grantRef:cloneV1(g),credentialGeneration:b.credentialGeneration,mode:'EXECUTION',receivedAt:observedAt,transport:'NORMAL_PROTECTED',verification:'PROVIDER_CLAIM_ONLY'};
   if((await db.query('INSERT INTO anvil.execution_observations(project_id,execution_id,generation,id,version,event_sequence,grant_id,grant_version,content_hash,snapshot_json) VALUES($1,$2,$3,$4,1,$5,$6,$7,$8,$9)',
    [pid,execution,b.executionGeneration,randomUUID(),e.sequence,g.id,g.version,digest(snap),JSON.stringify(snap)])).rowCount!==1)deny();
  }
  if(fresh.length&&(await db.query('INSERT INTO anvil.execution_acknowledgements(project_id,execution_id,generation,id,version,grant_id,grant_version,content_hash,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
   [pid,execution,b.executionGeneration,ackRef.id,ackRef.version,g.id,g.version,ackRef.contentHash,JSON.stringify(ackSnapshot)])).rowCount!==1)deny();
  // 마지막 await 뒤 credential·현재 권위가 그대로인지 다시 확인한 뒤에만 확정한다.
  const lastCred=await requestCredential(db,tokenDigest,connector,execution,proof),last=await readCurrent(db,pid,connector,execution,proof);
  if(!same(lastCred,cred)||!same(last.binding,b)||last.spki!==current.spki||last.now<current.now||signal.aborted)deny();
  committing=true;
  if((await db.query('COMMIT')).command!=='COMMIT')throw Error();
  committing=false;return respond(receiptRef,ackRef,ackSnapshot);
 }catch(error){
  if(committing)discard=new Error('EXECUTION_OBSERVATION_COMMIT_UNKNOWN');
  try{await db.query('ROLLBACK');}catch{discard??=new Error('EXECUTION_OBSERVATION_ROLLBACK_UNKNOWN');}
  if(committing)deny('EXECUTION_OBSERVATION_COMMIT_UNKNOWN',503);
  throw error;
 }finally{db.release(discard);}
}
function respond(proofResultRef:Ref,ackRef:Ref,snapshot:unknown){
 return {transport:'NORMAL_PROTECTED',proofResultRef,ack:{ref:ackRef,snapshot},cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
}
/** 명시 옵션으로만 등록한다. 본문은 엄격 UTF-8 canonical JSON이어야 하며 서명 대상 본문 hash와 같아야 한다. */
export function registerNormalObservations(app:FastifyInstance,o:NormalObservationsOptions,readPacket:(request:FastifyRequest,allowBody?:boolean)=>any){
 const origin=new URL(o.origin);
 if(origin.protocol!=='https:'||origin.origin!==o.origin)throw Error('EXECUTION_OBSERVATION_HOST_REQUIRED');
 app.register(async scope=>{
  scope.removeContentTypeParser('application/json');
  scope.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit},(_req,buf,done)=>{
   try{const text=new TextDecoder('utf-8',{fatal:true}).decode(buf as Buffer),value=parseWireJson(text);if(canonicalJson(value)!==text)throw Error();done(null,{text,value});}
   catch{done(new AuthFailure('INPUT_INVALID',400),undefined);}
  });
  scope.post<{Params:{cid:string;eid:string}}>('/api/v1/connectors/:cid/executions/:eid/observations',{bodyLimit,handlerTimeout:20000},async(r,reply)=>{
   const {cid,eid}=r.params,path='/api/v1/connectors/'+cid+'/executions/'+eid+'/observations';
   if(![cid,eid].every(uuidV1)||r.raw.method!=='POST'||r.raw.url!==path)return reply.callNotFound();
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(r.headers['content-type']??''))deny('INPUT_INVALID',400);
   const body=r.body as {text:string;value:unknown}|undefined;
   if(!body||typeof body.text!=='string')deny('INPUT_INVALID',400);
   const target=executionTarget('POST',path,[],body!.text);
   const token=normalRequestBearerDigest(r,origin.host,true),packet=readPacket(r,true) as Packet;
   return ingest(o,cid,eid,token,packet,target,body!.value,r.signal);
  });
 });
}
