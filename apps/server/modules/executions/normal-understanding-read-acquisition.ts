import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionTarget,verifyNormalCommandPageProof} from './execution-proof.ts';
import {original,readCurrent} from './normal-exchange-challenge.ts';
import {readPacket} from './normal-command-pages.ts';
import {normalRequestBearerDigest,requestCredential} from './normal-request-challenge.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code='NORMAL_UNDERSTANDING_DISCOVERY_UNKNOWN',status=503):never=>{throw new AuthFailure(code,status);};
const contextKeys=['projectId','executionId','executionGeneration','grantRef','registrationRef','connectorId','credentialGeneration','startCommandId','startCommandRef','assignmentRef','preparationRef','contextBundleRef','sessionBindingRef'];
const receiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','understandingRequestRef','context','observedAt','expiresAt'];
/** 내부 SQL 목적 저장소. source/SELECT ticket이나 정상 출력의 FIRST/close를 발급하지 않는다. */
export class NormalUnderstandingReadAcquisition {
 readonly pool:Pick<Pool,'connect'>;
 constructor(pool:Pick<Pool,'connect'>){this.pool=pool;}
 async current(db:PoolClient,token:string,binding:any,requestId:string,expected:unknown=null){
  const rows=(await db.query('SELECT anvil.fn09_normal_understanding_discovery($1,$2,$3,$4) AS discovery',[token,JSON.stringify(binding),requestId,JSON.stringify(expected)])).rows;
  const v=rows[0]?.discovery;
  if(rows.length!==1)fail();
  if(recordV1(v,['status'])&&v.status==='NONE'){if(expected!==null)fail();return null;}
  if(!recordV1(v,['status','requestRef','snapshot','deadline'])||v.status!=='REQUEST'||!refV1(v.requestRef)||v.requestRef.version!==1||hash(v.snapshot)!==v.requestRef.contentHash
   ||!recordV1(v.snapshot,['schemaVersion','purpose','request','context','requestedBy','policyRef','state','sourceScope','createdAt','expiresAt'])
   ||v.snapshot.schemaVersion!==1||v.snapshot.purpose!=='NORMAL_UNDERSTANDING_METADATA_DISCOVERY'||v.snapshot.state!=='PENDING_SOURCE'||v.snapshot.sourceScope!==null
   ||!isoV1(v.snapshot.createdAt)||!isoV1(v.snapshot.expiresAt)||!isoV1(v.deadline)||v.deadline>v.snapshot.expiresAt||v.deadline<=v.snapshot.createdAt
   ||!recordV1(v.snapshot.context,contextKeys)||!same(v.snapshot.context.grantRef,binding.grantRef)
   ||v.snapshot.context.projectId!==binding.projectId||v.snapshot.context.executionId!==binding.executionId||v.snapshot.context.executionGeneration!==binding.executionGeneration
   ||v.snapshot.context.connectorId!==binding.connectorId||v.snapshot.context.credentialGeneration!==binding.credentialGeneration
   ||!uuidV1(v.snapshot.context.startCommandId)||!contextKeys.filter(k=>k.endsWith('Ref')).every(k=>refV1(v.snapshot.context[k]))
   ||expected!==null&&!same(expected,v.requestRef))fail();
  return {requestRef:v.requestRef,context:v.snapshot.context,expiresAt:v.deadline};
 }
 async acquire(connector:string,execution:string,token:string,frame:ReturnType<typeof readPacket>,signal:AbortSignal){
  const target=executionTarget('GET','/api/v1/connectors/'+connector+'/executions/'+execution+'/understanding-response-read',[],null);
  const db=await this.pool.connect();let committing=false,discard:Error|undefined;
  try{
   await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'");
   const p=frame.proof,c=frame.challengeRef,g=p.grantRef;
   const cred=await requestCredential(db,token,connector,execution,p),cur=await readCurrent(db,cred.project,connector,execution,p),b=cur.binding,keys=[cred.project,g.id,g.version];
   const rows=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=1 AND content_hash=$5',[...keys,c.id,c.contentHash])).rows;
   if(rows.length!==1)fail();const old=rows[0],ch=original(old,b,'EXECUTION_REQUEST',cred.ref).challenge;
   if(!same(old.snapshot_json.request.target,target)||!refV1(old.snapshot_json.understandingRequestRef))fail();
   verifyNormalCommandPageProof(cur.spki,frame.signature,p,b,ch,target);
   const basis=await this.current(db,token,b,p.requestId,old.snapshot_json.understandingRequestRef);if(!basis)return fail();
   const expires=Math.min(cred.expiresAt,cur.deadline.getTime(),Date.parse(ch.expiresAt),Date.parse(basis.expiresAt));
   if(signal.aborted||cur.now.getTime()<Date.parse(ch.issuedAt)||cur.now.getTime()>=expires)fail('NORMAL_UNDERSTANDING_DISCOVERY_EXPIRED',412);
   const packetHash=hash({frame,target});
   const previous=(await db.query(`SELECT v.content_hash AS vhash,v.snapshot_json AS consumed,r.id,r.content_hash,r.snapshot_json AS receipt
    FROM anvil.execution_challenges v LEFT JOIN anvil.execution_receipts r ON r.project_id=v.project_id AND r.challenge_id=v.id
    WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3 AND v.id=$4 AND v.version=2`,[...keys,c.id])).rows;
   if(previous.length>1)fail();const prior=previous[0],s=prior?.receipt;
   if(prior&&(!recordV1(s,receiptKeys)||s.kind!=='NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED'||!uuidV1(prior.id)||prior.content_hash!==hash(s)
    ||prior.vhash!==hash(prior.consumed)||!Number.isSafeInteger(prior.consumed.sequence)||prior.consumed.sequence<=old.snapshot_json.sequence
    ||!same(prior.consumed,{...old.snapshot_json,sequence:prior.consumed.sequence,previousRef:c,consumption:{consumedAt:s.observedAt,resultRef:{id:prior.id,version:1,contentHash:prior.content_hash},packetHash:s.packetHash}})
    ||!same(s.binding,b)||!same(s.credentialRef,cred.ref)||!same(s.challengeRef,c)||!same(s.understandingRequestRef,basis.requestRef)||!same(s.context,basis.context)
    ||s.packetHash!==packetHash||!same(s.target,target)||s.requestId!==p.requestId||!isoV1(s.observedAt)||!isoV1(s.expiresAt)
    ||Date.parse(s.observedAt)<Date.parse(ch.issuedAt)||Date.parse(s.observedAt)>cur.now.getTime()||Date.parse(s.expiresAt)>expires||Date.parse(s.expiresAt)<=cur.now.getTime()))fail('NORMAL_UNDERSTANDING_DISCOVERY_REPLAY_CONFLICT',409);
   const receipt=s??{kind:'NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED',binding:b,credentialRef:cred.ref,challengeRef:c,packetHash,target,requestId:p.requestId,
    understandingRequestRef:basis.requestRef,context:basis.context,observedAt:cur.now.toISOString(),expiresAt:new Date(expires).toISOString()};
   const ref={id:prior?.id??randomUUID(),version:1,contentHash:hash(receipt)};
   if(!prior){
    const seq=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
    if(!Number.isSafeInteger(seq)||seq<2||seq>20000)fail();
    const v2={...old.snapshot_json,sequence:seq,previousRef:c,consumption:{resultRef:ref,packetHash,consumedAt:receipt.observedAt}};
    await db.query("SELECT set_config('anvil.normal_page_verified',txid_current()::text||':'||$1||':'||$2,true)",[ref.contentHash,token]);
    if((await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,2,$3,$4,$5,$6,$7)',[cred.project,c.id,g.id,g.version,seq,hash(v2),JSON.stringify(v2)])).rowCount!==1)fail();
    if((await db.query('INSERT INTO anvil.execution_receipts(project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,1,$6,$7)',[cred.project,ref.id,g.id,g.version,c.id,ref.contentHash,JSON.stringify(receipt)])).rowCount!==1)fail();
   }
   const lastCred=await requestCredential(db,token,connector,execution,p),last=await readCurrent(db,cred.project,connector,execution,p),lastBasis=await this.current(db,token,last.binding,p.requestId,basis.requestRef);
   if(!same(cred,lastCred)||!same(b,last.binding)||last.spki!==cur.spki||!lastBasis||!same(lastBasis.context,basis.context)||last.now<cur.now||signal.aborted
    ||Math.min(last.deadline.getTime(),lastCred.expiresAt,Date.parse(lastBasis.expiresAt))<Date.parse(receipt.expiresAt)||last.now.getTime()>=Date.parse(receipt.expiresAt))fail('NORMAL_UNDERSTANDING_DISCOVERY_DENIED',412);
   committing=true;if((await db.query('COMMIT')).command!=='COMMIT')throw Error();committing=false;
   return {transport:'NORMAL_PROTECTED',status:'DISCOVERY_ACQUIRED',proofResultRef:ref,receipt,sourceAvailable:false,selectionAvailable:false,
    cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  }catch(error){
   if(committing)discard=new Error('NORMAL_UNDERSTANDING_DISCOVERY_COMMIT_UNKNOWN');
   try{if((await db.query('ROLLBACK')).command!=='ROLLBACK')discard??=new Error('NORMAL_UNDERSTANDING_DISCOVERY_ROLLBACK_UNKNOWN');}catch{discard??=new Error('NORMAL_UNDERSTANDING_DISCOVERY_ROLLBACK_UNKNOWN');}
   if(committing||discard)fail();if(error instanceof AuthFailure)throw error;
   if(error instanceof Error&&/^(NORMAL_UNDERSTANDING_DISCOVERY_(DENIED|EXPIRED))$/.test(error.message))fail(error.message,412);
   fail();
  }finally{db.release(discard);}
 }
}
export function registerNormalUnderstandingReadAcquisition(app:FastifyInstance,source:NormalUnderstandingReadAcquisition,origin:string){
 const host=new URL(origin);if(host.protocol!=='https:'||host.origin!==origin)throw Error('EXECUTION_PAGE_HOST_REQUIRED');
 app.get<{Params:{cid:string;eid:string}}>('/api/v1/connectors/:cid/executions/:eid/understanding-response-read',{exposeHeadRoute:false,handlerTimeout:20000},async(r,reply)=>{
  const {cid,eid}=r.params,path='/api/v1/connectors/'+cid+'/executions/'+eid+'/understanding-response-read';
  if(!uuidV1(cid)||!uuidV1(eid)||r.raw.method!=='GET'||r.raw.url!==path)return reply.callNotFound();
  return source.acquire(cid,eid,normalRequestBearerDigest(r,host.host,true),readPacket(r),r.signal);
 });
}
