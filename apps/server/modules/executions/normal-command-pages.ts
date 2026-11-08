import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {arrayV1,hashV1,isoV1,recordV1,refV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {executionProofBytes,executionTarget,verifyNormalCommandPageProof} from './execution-proof.ts';
import {original,readCurrent} from './normal-exchange-challenge.ts';
import {normalRequestBearerDigest,requestCredential} from './normal-request-challenge.ts';

const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const limit=2*1024*1024;
function deny(code='EXECUTION_COMMAND_PAGE_REJECTED',status=412):never{throw new AuthFailure(code,status);}
function bounded(v:unknown){if(Buffer.byteLength(canonicalJson(v))>limit)deny();}
export function readPageWindow(rows:{sequence:unknown}[],after:number){
 if(!arrayV1(rows,51)||!Number.isSafeInteger(after)||after<0)deny();
 let previous=after;
 const sequences=rows.map(row=>{
  if(typeof row.sequence!=='string'||!/^[1-9][0-9]{0,15}$/.test(row.sequence))deny();
  const seq=Number(row.sequence);
  if(!Number.isSafeInteger(seq)||seq<=previous)deny();
  previous=seq;
  return seq;
 });
 return {sequences,hasMore:rows.length>50};
}

export class NormalPageCursors{
 #key:Buffer;
 constructor(key:Buffer){if(!Buffer.isBuffer(key)||key.length!==32)deny('EXECUTION_CURSOR_KEY_REQUIRED');this.#key=Buffer.from(key);}
 #mac(value:string){return createHmac('sha256',this.#key).update('anvil:normal-command-page:v1:').update(value).digest();}
 encode(scope:string,sequence:number,issued:number,expires:number){
  if(!hashV1(scope)||!Number.isSafeInteger(sequence)||sequence<0||![issued,expires].every(Number.isSafeInteger)||expires<=issued||expires-issued>900000)deny();
  const payload=Buffer.from(canonicalJson({scope,sequence,issued,expires})).toString('base64url');
  return 'v1.'+payload+'.'+this.#mac(payload).toString('base64url');
 }
 decode(value:string,scope:string,now:number):number{
  const parts=value.length<=4096&&/^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(value);
  if(!parts||!Number.isSafeInteger(now))deny();
  const bytes=Buffer.from(parts[1]!,'base64url'),mac=Buffer.from(parts[2]!,'base64url');
  if(bytes.toString('base64url')!==parts[1]||mac.toString('base64url')!==parts[2]||!timingSafeEqual(mac,this.#mac(parts[1]!)))deny();
  const p=parseWireJson(bytes.toString('utf8'));
  if(!recordV1(p,['scope','sequence','issued','expires'])||p.scope!==scope||p.issued>now||p.expires<=now||
   this.encode(scope,p.sequence,p.issued,p.expires)!==value)deny();
  return p.sequence;
 }
}
export interface NormalCommandPagesOptions{pool:Pick<Pool,'connect'>;origin:string;cursors:NormalPageCursors}
function readPacket(request:FastifyRequest){
 const names=request.raw.rawHeaders.filter((_,i)=>i%2===0).map(h=>h.toLowerCase());
 if(['cookie','origin','x-anvil-csrf','content-encoding','transfer-encoding'].some(h=>names.includes(h))||
   names.filter(h=>h==='content-length').length>1||(request.headers['content-length']??'0')!=='0')deny('EXECUTION_PAGE_CHANNEL_INVALID',403);
 const raw=request.headers['anvil-execution-auth'];
 const singleton=(name:string,value:unknown)=>typeof value==='string'&&names.filter(h=>h===name).length===1&&
  request.raw.rawHeaders[2*names.indexOf(name)+1]===value;
 if(!singleton('host',request.headers.host)||!singleton('authorization',request.headers.authorization)||!singleton('anvil-execution-auth',raw))
  deny('EXECUTION_PAGE_CHANNEL_INVALID',403);
 if(typeof raw!=='string'||raw.length>8192||!/^[A-Za-z0-9_-]+$/.test(raw))deny('INPUT_INVALID',400);
 try{
  const bytes=Buffer.from(raw,'base64url');
  if(bytes.length>4096||bytes.toString('base64url')!==raw)throw Error();
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),p=parseWireJson(text);
  if(canonicalJson(p)!==text||!recordV1(p,['schemaVersion','challengeRef','proof','signature'])||p.schemaVersion!==1||
   !refV1(p.challengeRef)||p.challengeRef.version!==1||typeof p.signature!=='string')throw Error();
  executionProofBytes('EXECUTION_REQUEST_PROOF',p.proof);
  return p;
 }catch{return deny('INPUT_INVALID',400);}
}
type Packet=ReturnType<typeof readPacket>;
type Target=ReturnType<typeof executionTarget>;
async function selectItems(db:PoolClient,keys:unknown[],generation:number,after:number,fixed:string[]|null,now:Date){
 const rows=(await db.query('SELECT * FROM anvil.normal_command_page_rows($1,$2,$3,$4,$5,$6,$7)',[...keys,generation,after,fixed])).rows;
 const {sequences,hasMore}=readPageWindow(rows as {sequence:unknown}[],after);
 const ids=new Set<string>();
 const items=rows.map((r,i)=>{
  if(r.valid!==true||!refV1(r.command_ref)||ids.has(r.command_ref.id))deny();
  ids.add(r.command_ref.id);
  const envelope=readDispatchEnvelopeV1(r.envelope,now.getTime());
  if(envelope.operation!=='START_SESSION'||envelope.context.projectId!==keys[0]||
    envelope.context.executionId!==keys[1]||envelope.context.executionGeneration!==generation||r.envelope_hash!==envelope.envelopeHash)deny();
  return {sequence:sequences[i]!,commandRef:r.command_ref,envelope};
 });
 const selected=items.slice(0,50);
 bounded(selected);
 return {items:selected,hasMore};
}
const descriptors=(items:Awaited<ReturnType<typeof selectItems>>['items'])=>items.map(x=>({sequence:x.sequence,commandRef:x.commandRef,envelopeHash:x.envelope.envelopeHash}));
async function attempt(o:NormalCommandPagesOptions,connector:string,execution:string,tokenDigest:string,frame:Packet,target:Target,
 cursor:string|null,wait:number,signal:AbortSignal){
 const db=await o.pool.connect(),proof=frame.proof,g=proof.grantRef,c=frame.challengeRef;
 let committing=false,discard:Error|undefined;
 try{
  await db.query('BEGIN');await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'");
  const cred=await requestCredential(db,tokenDigest,connector,execution,proof),pid=cred.project,keys=[pid,g.id,g.version];
  const current=await readCurrent(db,pid,connector,execution,proof),b=current.binding,scope=digest({binding:b,credentialRef:cred.ref});
  const rows=(await db.query('SELECT id,content_hash,snapshot_json FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3 AND id=$4 AND version=1 AND content_hash=$5',[...keys,c.id,c.contentHash])).rows;
  if(rows.length!==1)deny();
  const old=rows[0],ch=original(old,b,'EXECUTION_REQUEST',cred.ref).challenge,at=current.now.getTime();
  if(!same(old.snapshot_json.request.target,target)||at<Date.parse(ch.issuedAt))deny();
  verifyNormalCommandPageProof(current.spki,frame.signature,proof,b,ch,target);
  const end=Math.min(cred.expiresAt,current.deadline.getTime(),Date.parse(ch.expiresAt));
  if(at>=end||signal.aborted)deny();
  const packetHash=digest({frame,target}),after=cursor?o.cursors.decode(cursor,scope,at):0;
  const previous=(await db.query(`SELECT v.content_hash AS vhash,v.snapshot_json AS consumed,r.id,r.content_hash,r.snapshot_json AS receipt
   FROM anvil.execution_challenges v LEFT JOIN anvil.execution_receipts r ON r.project_id=v.project_id AND r.challenge_id=v.id
   WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3 AND v.id=$4 AND v.version=2`,[...keys,c.id])).rows;
  if(previous.length>1)deny();
  const prior=previous[0],s=prior?.receipt;
  if(prior){
   if(!s||!uuidV1(prior.id)||prior.content_hash!==digest(s)||prior.vhash!==digest(prior.consumed)||!same(prior.consumed,{...old.snapshot_json,sequence:prior.consumed.sequence,previousRef:c,
     consumption:{consumedAt:s.observedAt,resultRef:{id:prior.id,version:1,contentHash:prior.content_hash},packetHash:s.packetHash}})||
    !recordV1(s,['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','after','entries','hasMore','nextCursor','observedAt','expiresAt'])||
    s.kind!=='NORMAL_COMMAND_PAGE'||!same(s.binding,b)||!same(s.credentialRef,cred.ref)||!same(s.challengeRef,c)||
    !isoV1(s.observedAt)||!isoV1(s.expiresAt)||typeof s.hasMore!=='boolean'||!arrayV1(s.entries,50)||!s.entries.every((e:any)=>recordV1(e,['commandRef','sequence','envelopeHash'])&&refV1(e.commandRef)))deny();
   if(s.packetHash!==packetHash||!same(s.target,target)||s.after!==after||s.requestId!==proof.requestId)deny('IDEMPOTENCY_CONFLICT',409);
  }
  const page=await selectItems(db,[pid,execution,g.id,g.version],b.executionGeneration,after,prior?s.entries.map((e:any)=>e.commandRef.id):null,current.now);
  if(!prior&&!page.items.length&&wait>0){
   // 대기 동안 프로젝트/인가 잠금과 연결을 모두 반환한다.
   await db.query('ROLLBACK');return {wait:Math.max(0,Math.min(wait,end-at-1))} as const;
  }
  const entries=descriptors(page.items),expires=Math.min(end,...page.items.map(i=>Date.parse(i.envelope.expiresAt)));
  if(prior&&(!same(entries,s.entries)||Date.parse(s.expiresAt)>expires||Date.parse(s.expiresAt)<=at||Date.parse(s.observedAt)>at||
    o.cursors.decode(s.nextCursor,scope,at)!==(entries.at(-1)?.sequence??after)))deny();
  const snapshot=s??{kind:'NORMAL_COMMAND_PAGE',binding:b,credentialRef:cred.ref,challengeRef:c,packetHash,target,requestId:proof.requestId,after,entries,
   hasMore:page.hasMore,nextCursor:o.cursors.encode(scope,entries.at(-1)?.sequence??after,at,Math.min(at+900000,cred.expiresAt,current.deadline.getTime())),
   observedAt:current.now.toISOString(),expiresAt:new Date(expires).toISOString()};
  const ref={id:prior?.id??randomUUID(),version:1,contentHash:digest(snapshot)};
  if(!prior){
   const seq=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
   if(!Number.isSafeInteger(seq)||seq<2||seq>20000)deny();
   const v2={...old.snapshot_json,sequence:seq,previousRef:c,consumption:{resultRef:ref,packetHash,consumedAt:snapshot.observedAt}};
   await db.query("SELECT set_config('anvil.normal_page_verified',txid_current()::text||':'||$1||':'||$2,true)",[ref.contentHash,tokenDigest]);
   if((await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,2,$3,$4,$5,$6,$7)',[pid,c.id,g.id,g.version,seq,digest(v2),JSON.stringify(v2)])).rowCount!==1)deny();
   if((await db.query('INSERT INTO anvil.execution_receipts(project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,1,$6,$7)',[pid,ref.id,g.id,g.version,c.id,ref.contentHash,JSON.stringify(snapshot)])).rowCount!==1)deny();
  }
  const out={transport:'NORMAL_PROTECTED',proofResultRef:ref,items:page.items,nextCursor:snapshot.nextCursor,hasMore:snapshot.hasMore,observedAt:snapshot.observedAt,
   expiresAt:snapshot.expiresAt,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  bounded(out);
  const lastCred=await requestCredential(db,tokenDigest,connector,execution,proof),last=await readCurrent(db,pid,connector,execution,proof);
  if(!same(lastCred,cred)||!same(last.binding,b)||last.spki!==current.spki||last.now<current.now||signal.aborted||
    last.deadline.getTime()<Date.parse(snapshot.expiresAt)||last.now.getTime()>=Date.parse(snapshot.expiresAt))deny();
  committing=true;
  if((await db.query('COMMIT')).command!=='COMMIT')throw Error();
  committing=false;return {out} as const;
 }catch(error){
  if(committing)discard=new Error('EXECUTION_PAGE_COMMIT_UNKNOWN');
  try{await db.query('ROLLBACK');}catch{discard??=new Error('EXECUTION_PAGE_ROLLBACK_UNKNOWN');}
  if(committing)deny('EXECUTION_PAGE_COMMIT_UNKNOWN',503);
  throw error;
 }finally{db.release(discard);}
}
export function registerNormalCommandPages(app:FastifyInstance,o:NormalCommandPagesOptions){
 const origin=new URL(o.origin);
 if(origin.protocol!=='https:'||origin.origin!==o.origin||!(o.cursors instanceof NormalPageCursors))throw Error('EXECUTION_PAGE_HOST_REQUIRED');
 app.get<{Params:{cid:string;eid:string}}>('/api/v1/connectors/:cid/executions/:eid/commands',{exposeHeadRoute:false,handlerTimeout:20000},async(r,reply)=>{
  const {cid,eid}=r.params,path='/api/v1/connectors/'+cid+'/executions/'+eid+'/commands',raw=r.raw.url??'';
  if(!uuidV1(cid)||!uuidV1(eid)||r.raw.method!=='GET'||raw.split('?')[0]!==path)return reply.callNotFound();
  const tail=raw.slice(path.length);
  if(tail&&(!/^\?(?:[A-Za-z]+=[A-Za-z0-9_.-]+)(?:&[A-Za-z]+=[A-Za-z0-9_.-]+)?$/.test(tail)||tail.length>4140))deny('INPUT_INVALID',400);
  const query=Array.from(new URLSearchParams(tail)),target=executionTarget('GET',path,query,null),params=new Map(query);
  const token=normalRequestBearerDigest(r,origin.host,true),packet=readPacket(r);
  const run=(wait:number)=>attempt(o,cid,eid,token,packet,target,params.get('afterCursor')??null,wait,r.signal);
  let result=await run(Number(params.get('waitMs')??0));
  if(result.wait!==undefined){await delay(result.wait,undefined,{signal:r.signal});result=await run(0);}
  return result.out;
 });
}
