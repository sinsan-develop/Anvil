import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {TextDecoder} from 'node:util';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Pool} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {arrayV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionProofBytes,executionTarget,verifyNormalCredentialExchangeProof} from './execution-proof.ts';
import {original,readCurrent} from './normal-exchange-challenge.ts';

type Ref={id:string;version:number;contentHash:string};
type StorageScope={projectId:string;connectorId:string;executionId:string;grantRef:Ref;credentialGeneration:number;
 registrationRef:Ref;reservationRef:Ref;scopeDigest:string;publicKeyFingerprint:string;evidenceRefs:Ref[]};
export interface NormalCredentialExchangeOptions {
 pool:Pick<Pool,'connect'>; origin:string;
 storage?:{observe(scope:Readonly<StorageScope>,at:string,signal:AbortSignal):Promise<unknown>};
}
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function deny(code:string,status=412):never{throw new AuthFailure(code,status);}
function packet(request:FastifyRequest){
 const name='anvil-execution-auth',names=request.raw.rawHeaders.filter((_,i)=>!(i%2)).map(h=>h.toLowerCase());
 if(['cookie','authorization','origin','x-anvil-csrf','content-encoding'].some(h=>names.includes(h))||
  [name,'host','content-type','content-length'].some(h=>names.filter(n=>n===h).length>1))deny('EXECUTION_EXCHANGE_HEADER_REJECTED',403);
 const header=request.headers[name];
 if(typeof header!=='string'||header.length>8192||!header.length||!/^[A-Za-z0-9_-]+$/.test(header))deny('INPUT_INVALID',400);
 try{
  const b=Buffer.from(header,'base64url');
  if(b.length>4096||b.toString('base64url')!==header)throw Error();
  const raw=new TextDecoder('utf-8',{fatal:true}).decode(b),frame=parseWireJson(raw);
  if(!recordV1(frame,['schemaVersion','challengeRef','proof','signature'])||frame.schemaVersion!==1||!refV1(frame.challengeRef)||
    frame.challengeRef.version!==1||canonicalJson(frame)!==raw||typeof frame.signature!=='string')throw Error();
  executionProofBytes('EXECUTION_CREDENTIAL_EXCHANGE',frame.proof);
  return frame;
 }catch{ return deny('INPUT_INVALID',400); }
}
async function observeStorage(options:NormalCredentialExchangeOptions,scope:StorageScope,at:Date,signal:AbortSignal){
 if(!options.storage||signal.aborted)deny('EXECUTION_PROTECTED_STORAGE_UNAVAILABLE');
 const controller=new AbortController();
 let timer:ReturnType<typeof setTimeout>|undefined,reject!:()=>void;
 const cutoff=new Promise<never>((_,r)=>{reject=()=>{controller.abort();r(new AuthFailure('EXECUTION_PROTECTED_STORAGE_UNAVAILABLE',412));};});
 timer=setTimeout(reject,1000);signal.addEventListener('abort',reject,{once:true});
 try{
  // 상대에게 DB client, query, token, 응답 채널을 넘기지 않는다.
  const result=await Promise.race([cutoff,options.storage.observe(structuredClone(scope),at.toISOString(),controller.signal)]);
  if(!recordV1(result,['scope','state','checkedAt','expiresAt'])||result.state!=='VERIFIED_CURRENT'||
    !same(result.scope,scope)||result.checkedAt!==at.toISOString()||!isoV1(result.expiresAt)||Date.parse(result.expiresAt)<=at.getTime())
    deny('EXECUTION_PROTECTED_STORAGE_UNAVAILABLE');
  return Date.parse(result.expiresAt);
 }catch{return deny('EXECUTION_PROTECTED_STORAGE_UNAVAILABLE');}
 finally{clearTimeout(timer);signal.removeEventListener('abort',reject);controller.abort();}
}
async function exchange(options:NormalCredentialExchangeOptions,connector:string,execution:string,frame:any,target:unknown,signal:AbortSignal){
 const db=await options.pool.connect(),proof=frame.proof,g=proof.grantRef,c=frame.challengeRef,packetHash=digest({frame,target});
 let committing=false,discard:Error|undefined;
 try{
  await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'");
  const hit=(await db.query(`SELECT project_id, snapshot_json->'binding' AS fact FROM anvil.execution_grants
   WHERE id=$1 AND version=$2 AND content_hash=$3 AND execution_id=$4 AND snapshot_json->>'transport'='NORMAL_PROTECTED'
    AND snapshot_json#>>'{binding,registration,connectorId}'=$5 LIMIT 2`,[g.id,g.version,g.contentHash,execution,connector])).rows;
  if(hit.length!==1||!uuidV1(hit[0].project_id))deny('NOT_FOUND',404);
  const project=hit[0].project_id,fact=hit[0].fact,keys=[project,g.id,g.version];
  const current=await readCurrent(db,project,connector,execution,proof);
  const challengeRows=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=1 AND content_hash=$5',[...keys,c.id,c.contentHash])).rows;
  if(challengeRows.length!==1)deny('EXECUTION_EXCHANGE_CHALLENGE_REQUIRED');
  const row=challengeRows[0],challenge=original(row,current.binding).challenge;
  if(!same(row.snapshot_json.request.target,target))deny('EXECUTION_EXCHANGE_TARGET_INVALID');
  verifyNormalCredentialExchangeProof(current.spki,frame.signature,proof,current.binding,challenge);
  const res=(await db.query('SELECT id,version,content_hash,snapshot_json FROM anvil.execution_credentials WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND credential_generation=$4',[...keys,proof.credentialGeneration])).rows;
  if(res.length!==1||res[0].id!==fact.executionCredentialReservation?.id||res[0].content_hash!==digest(res[0].snapshot_json)||
    (res[0].version!==1&&res[0].version!=='1')||res[0].snapshot_json.state!=='RESERVED_NO_TOKEN'||!same(res[0].snapshot_json.grantRef,g))deny('EXECUTION_CREDENTIAL_RESERVATION_INVALID');
  const reservationRef={id:res[0].id,version:1,contentHash:res[0].content_hash};
  const prior=(await db.query(`SELECT r.id,r.content_hash,r.snapshot_json,v.content_hash AS consumed_hash,v.snapshot_json AS consumed
   FROM anvil.execution_receipts r LEFT JOIN anvil.execution_challenges v ON v.project_id=r.project_id AND v.id=r.challenge_id AND v.version=2
   WHERE r.project_id=$1 AND r.grant_id=$2 AND r.grant_version=$3 AND r.snapshot_json->>'kind'='NORMAL_CREDENTIAL_ISSUED' LIMIT 10001`,keys)).rows;
  // grant의 challenge 수명 상한 안에서 전체 불변 이력을 검산한다. 최신 행으로 과거 packet을 대체하지 않는다.
  if(prior.length>10000)deny('EXECUTION_CREDENTIAL_LEDGER_INVALID',503);
  let repeated:any=null,lastEnd=-Infinity;
  const intervals:{start:number;end:number}[]=[],ids=new Set<string>(),digests=new Set<string>();
  let response;
  for(const r of prior){
   const s=r.snapshot_json,ref={id:r.id,version:1,contentHash:r.content_hash};
   if(!refV1(ref)||!recordV1(s,['kind','purpose','binding','reservationRef','challengeRef','requestId','packetHash','tokenDigest','issuedAt','expiresAt','storageEvidenceRefs','storageExpiresAt'])||
     s.kind!=='NORMAL_CREDENTIAL_ISSUED'||s.purpose!=='EXECUTION_DISPATCH_ONLY'||digest(s)!==r.content_hash||!same(s.binding,current.binding)||
     !same(s.reservationRef,reservationRef)||!isoV1(s.issuedAt)||!isoV1(s.expiresAt)||!hashV1(s.tokenDigest)||!refV1(s.challengeRef)||
     !r.consumed||digest(r.consumed)!==r.consumed_hash||!same(r.consumed.binding,s.binding)||!same(r.consumed.previousRef,s.challengeRef)||
     !same(r.consumed.consumption?.resultRef,ref)||r.consumed.consumption.packetHash!==s.packetHash||
     r.consumed.consumption.consumedAt!==s.issuedAt||r.consumed.request?.requestId!==s.requestId||!isoV1(s.storageExpiresAt)||
     Date.parse(s.issuedAt)>=Date.parse(s.expiresAt)||Date.parse(s.expiresAt)>Math.min(Date.parse(s.issuedAt)+900000,Date.parse(s.storageExpiresAt))||
     ids.has(r.id)||digests.has(s.tokenDigest))deny('EXECUTION_CREDENTIAL_LEDGER_INVALID',503);
   ids.add(r.id);digests.add(s.tokenDigest);intervals.push({start:Date.parse(s.issuedAt),end:Date.parse(s.expiresAt)});
   if(same(s.challengeRef,c)){
    if(s.packetHash!==packetHash)deny('EXECUTION_CREDENTIAL_ALREADY_EXCHANGED',409);
    if(repeated)deny('EXECUTION_CREDENTIAL_LEDGER_INVALID',503);
    repeated={receiptRef:ref,delivery:'UNKNOWN',expiresAt:s.expiresAt};
   }else if(s.packetHash===packetHash)deny('EXECUTION_CREDENTIAL_LEDGER_INVALID',503);
  }
  for(const interval of intervals.sort((a,b)=>a.start-b.start)){
   if(interval.start<lastEnd)deny('EXECUTION_CREDENTIAL_LEDGER_INVALID',503);lastEnd=interval.end;
  }
  if(repeated)response=repeated;
  else{
   if(lastEnd>current.now.getTime())deny('EXECUTION_CREDENTIAL_ALREADY_EXCHANGED',409);
   const from=Date.parse(challenge.issuedAt),end=Date.parse(challenge.expiresAt);
   if(current.now.getTime()<from||current.now.getTime()>=end)deny('EXECUTION_EXCHANGE_CHALLENGE_EXPIRED');
   const evidence=fact.checks?.storage;
   if(evidence?.state!=='VERIFIED_CURRENT'||!arrayV1(evidence.evidenceRefs,128)||!evidence.evidenceRefs.length||
      !evidence.evidenceRefs.every(refV1)||!refV1(fact.registration?.ref))deny('EXECUTION_PROTECTED_STORAGE_UNAVAILABLE');
   const scope:StorageScope={projectId:project,connectorId:connector,executionId:execution,grantRef:g,credentialGeneration:proof.credentialGeneration,
    scopeDigest:current.binding.scopeDigest,publicKeyFingerprint:current.binding.publicKeyFingerprint,registrationRef:fact.registration.ref,reservationRef,evidenceRefs:evidence.evidenceRefs};
   const storageEnd=await observeStorage(options,scope,current.now,signal);
   const clock=current.now.toISOString(),expiresAt=new Date(Math.min(current.now.getTime()+900000,current.deadline.getTime(),storageEnd)).toISOString();
   const token='av3ex1_'+randomBytes(32).toString('base64url'),tokenDigest=createHash('sha256').update(token).digest('hex');
   const s={kind:'NORMAL_CREDENTIAL_ISSUED',purpose:'EXECUTION_DISPATCH_ONLY',binding:current.binding,reservationRef,challengeRef:c,requestId:proof.requestId,
     packetHash,tokenDigest,issuedAt:clock,expiresAt,storageEvidenceRefs:scope.evidenceRefs,storageExpiresAt:new Date(storageEnd).toISOString()};
   const ref={id:randomUUID(),version:1,contentHash:digest(s)};
   const seq=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
   if(!Number.isSafeInteger(seq)||seq<=row.snapshot_json.sequence||seq>20000)deny('EXECUTION_CREDENTIAL_LEDGER_INVALID',503);
   const v2={...row.snapshot_json,sequence:seq,previousRef:c,consumption:{resultRef:ref,packetHash,consumedAt:clock}};
   await db.query("SELECT set_config('anvil.normal_credential_verified',txid_current()::text||':'||$1,true)",[ref.contentHash]);
   const used=await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,2,$3,$4,$5,$6,$7)',
    [project,c.id,g.id,g.version,seq,digest(v2),JSON.stringify(v2)]);
   const issued=await db.query('INSERT INTO anvil.execution_receipts(project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,1,$6,$7)',
    [project,ref.id,g.id,g.version,c.id,ref.contentHash,JSON.stringify(s)]);
   if(used.rowCount!==1||issued.rowCount!==1)deny('EXECUTION_CREDENTIAL_WRITE_FAILED',503);
   const final=await readCurrent(db,project,connector,execution,proof);
   const finalStorage=await observeStorage(options,scope,final.now,signal);
   const check=(await db.query('SELECT clock_timestamp() AS at')).rows[0]?.at;
   if(!(check instanceof Date)||!Number.isFinite(check.getTime())||current.now>final.now||check<final.now||
    check.getTime()>=Math.min(end,Date.parse(expiresAt))||Math.min(finalStorage,final.deadline.getTime())<Date.parse(expiresAt)||
    !same(final.binding,current.binding)||final.spki!==current.spki||signal.aborted)deny('EXECUTION_CREDENTIAL_CURRENT_CHANGED');
   response={receiptRef:ref,credential:token,expiresAt};
  }
  committing=true;
  if((await db.query('COMMIT'))?.command!=='COMMIT')throw Error();
  committing=false;
  return response;
 }catch(error){
  if(committing)discard=new Error('EXECUTION_CREDENTIAL_COMMIT_UNKNOWN');
  try{await db.query('ROLLBACK');}catch{discard??=new Error('EXECUTION_CREDENTIAL_ROLLBACK_UNKNOWN');}
  if(committing)deny('EXECUTION_CREDENTIAL_COMMIT_UNKNOWN',503);
  throw error;
 }finally{db.release(discard);}
}
export function registerNormalCredentialExchange(app:FastifyInstance,options:NormalCredentialExchangeOptions){
 const origin=new URL(options.origin);
 if(origin.protocol!=='https:'||origin.origin!==options.origin)throw Error('EXECUTION_EXCHANGE_ORIGIN_INVALID');
 app.register(async routes=>{
  routes.removeContentTypeParser('application/json');
  routes.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit:16384},(_r,b,done)=>{
   try{const raw=new TextDecoder('utf-8',{fatal:true}).decode(b as Buffer);parseWireJson(raw);done(null,raw);}
   catch{done(new AuthFailure('INPUT_INVALID',400),undefined);}
  });
  routes.post<{Params:{cid:string;eid:string}}>('/api/v1/connectors/:cid/executions/:eid/credential-exchange',{bodyLimit:16384,handlerTimeout:10000},async(r,reply)=>{
   reply.header('Cache-Control','no-store');
   const {cid,eid}=r.params,path='/api/v1/connectors/'+cid+'/executions/'+eid+'/credential-exchange';
   if(!uuidV1(cid)||!uuidV1(eid)||r.raw.url!==path)return reply.callNotFound();
   if(!('encrypted' in r.raw.socket)||r.raw.socket.encrypted!==true||r.headers.host!==origin.host)deny('EXECUTION_EXCHANGE_CHANNEL_INVALID',403);
   if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(r.headers['content-type']??''))deny('INPUT_INVALID',400);
   const frame=packet(r),target=executionTarget('POST',path,[],r.body);
   try{return await exchange(options,cid,eid,frame,target,r.signal);}
   catch(error){if(error instanceof AuthFailure&&error.message==='NOT_FOUND')return reply.callNotFound();throw error;}
  });
 });
}
