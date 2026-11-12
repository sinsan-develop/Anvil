import {randomUUID} from 'node:crypto';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {executionTarget,verifyNormalCommandPageProof} from './execution-proof.ts';
import {original,readCurrent} from './normal-exchange-challenge.ts';
import {normalRequestBearerDigest,requestCredential} from './normal-request-challenge.ts';

const limit=2*1024*1024;
function deny(code='EXECUTION_MATERIAL_REJECTED',status=412):never{throw new AuthFailure(code,status);}
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const digest=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const kinds=['CONTEXT_BUNDLE','START_OPTIONS'] as const;
export const maxPageMaterialParts=200;
type Part={materialId:string;partIndex:number;byteOffset:number;utf8Bytes:number;contentHash:string};
export interface StartMaterialDescriptor{manifestRef:Ref;groups:{kind:typeof kinds[number];payloadRef:Ref;sourceRef:Ref;sourceBytes:number;
 contentHash:string;mediaType:'application/json';parts:Part[]}[]}
type Binding={projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:Ref;credentialGeneration:number};
type Envelope={commandId:string;envelopeHash:string;payload:{contextBundleRef:Ref;optionsRef:Ref}};
/** 원 START가 같은 거래에서 등록한 manifest/material 행만으로 발견 descriptor를 재구성한다.
 * 경로·본문·임의 문서 목록은 포함하지 않으며 누락·불일치 행을 생략하거나 사후 보정하지 않는다. */
export function startMaterialDescriptor(row:unknown,b:Binding,e:Envelope):StartMaterialDescriptor{
 if(!recordV1(row,['command_record_id','manifest_ref','manifest','materials'])||!refV1(row.manifest_ref)||row.manifest_ref.version!==1)deny();
 const m=row.manifest,ref=row.manifest_ref as Ref;
 if(!recordV1(m,['schemaVersion','purpose','id','sourceKind','scope','commandId','payload','groups','expiresAt'])||digest(m)!==ref.contentHash||
   m.schemaVersion!==1||m.purpose!=='START_CONTEXT_OPTIONS_MATERIAL_V1'||m.id!==ref.id||m.sourceKind!=='PROTECTED_START_REFERENCE_V1'||
   !same(m.scope,{mode:'EXECUTION',projectId:b.projectId,connectorId:b.connectorId,executionId:b.executionId,executionGeneration:b.executionGeneration,
    grantRef:b.grantRef,credentialGeneration:b.credentialGeneration})||m.commandId!==e.commandId||!same(m.payload,e.payload)||!isoV1(m.expiresAt)||
   !arrayV1(m.groups,2)||m.groups.length!==2||!arrayV1(row.materials,maxPageMaterialParts))deny();
 const stored=new Map<string,any>();
 for(const x of row.materials as unknown[]){
  if(!recordV1(x,['ref','snapshot'])||!refV1(x.ref)||x.ref.version!==1||x.ref.contentHash!==digest(x.snapshot)||stored.has(x.ref.id))deny();
  stored.set(x.ref.id,x.snapshot);
 }
 let total=0;
 const groups=(m.groups as unknown[]).map((g,i)=>{
  const payloadRef=i===0?e.payload.contextBundleRef:e.payload.optionsRef;
  if(!recordV1(g,['kind','payloadRef','source','parts'])||g.kind!==kinds[i]||!same(g.payloadRef,payloadRef)||
    !recordV1(g.source,['sourceRef','bodyRef','originRef','contentHash','sourceBytes','mediaType'])||!refV1(g.source.sourceRef)||!hashV1(g.source.contentHash)||
    !positive(g.source.sourceBytes)||g.source.sourceBytes>limit||g.source.mediaType!=='application/json'||!arrayV1(g.parts,maxPageMaterialParts)||!g.parts.length)deny();
  const src=g.source;let offset=0;
  const parts=(g.parts as unknown[]).map((p,n):Part=>{
   if(!recordV1(p,['materialId','partIndex','byteOffset','utf8Bytes','contentHash'])||!uuidV1(p.materialId)||p.partIndex!==n+1||p.byteOffset!==offset||
     !positive(p.utf8Bytes)||!hashV1(p.contentHash)||!same(stored.get(p.materialId),{projectId:b.projectId,executionId:b.executionId,
      executionGeneration:b.executionGeneration,commandId:e.commandId,envelopeHash:e.envelopeHash,payloadRef,sourceRef:src.sourceRef,partIndex:n+1,
      partCount:g.parts.length,byteOffset:offset,sourceBytes:src.sourceBytes,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash,mediaType:'application/json'}))deny();
   offset+=p.utf8Bytes;total++;
   return {materialId:p.materialId,partIndex:p.partIndex,byteOffset:p.byteOffset,utf8Bytes:p.utf8Bytes,contentHash:p.contentHash};
  });
  if(offset!==src.sourceBytes)deny();
  return {kind:kinds[i]!,payloadRef,sourceRef:src.sourceRef as Ref,sourceBytes:src.sourceBytes as number,contentHash:src.contentHash as string,
   mediaType:'application/json' as const,parts};
 });
 if(total!==stored.size||total>maxPageMaterialParts)deny();
 return {manifestRef:ref,groups};
}
export const startMaterialParts=(d:StartMaterialDescriptor)=>d.groups.reduce((n,g)=>n+g.parts.length,0);
/** 재구성한 원본 전체와 등록된 부분을 각각 검산한다. 원본이 등록 hash/길이와 다르면 부분 bytes를 만들지 않는다.
 * 이 함수는 보호 읽기·nonce 소비·전달을 수행하지 않으며 결과는 실행 허가가 아니다. */
export function checkedMaterialPart(raw:string,source:{sourceBytes:unknown;contentHash:unknown},part:{byteOffset:unknown;utf8Bytes:unknown;contentHash:unknown}){
 if(typeof raw!=='string'||!positive(source?.sourceBytes)||source.sourceBytes>limit||!hashV1(source.contentHash)||
   !Number.isSafeInteger(part?.byteOffset)||Number(part.byteOffset)<0||!positive(part.utf8Bytes)||!hashV1(part.contentHash))deny();
 const bytes=Buffer.from(raw,'utf8'),offset=Number(part.byteOffset),end=offset+part.utf8Bytes;
 if(bytes.length!==source.sourceBytes||end>bytes.length||bytes.toString('utf8')!==raw||contentHash(bytes)!==source.contentHash)deny();
 const selected=bytes.subarray(offset,end);
 if(selected.length!==part.utf8Bytes||contentHash(selected)!==part.contentHash)deny();
 return selected;
}

/** 서버가 조립 때 주입하는 보호 원문 공급자. HTTP 입력·HUMAN 선언으로 대신할 수 없고 DB 손잡이를 받지 않는다.
 * 반환 원문은 등록된 길이·hash와 다시 대조하므로 공급자의 성공 자체가 전달 허가는 아니다. */
export interface NormalStartContextSource{
 contextBody(scope:Readonly<{projectId:string;executionId:string;executionGeneration:number;commandId:string;contextBundleRef:Ref;sourceBytes:number;contentHash:string}>,
  signal:AbortSignal):Promise<unknown>;
}
type ContextScope=Parameters<NormalStartContextSource['contextBody']>[0];
export interface NormalStartMaterialsOptions{pool:Pick<Pool,'connect'>;origin:string;context?:NormalStartContextSource}
const maxEncoded=2796203,maxMetadata=16384,maxResponse=2812587;
const receiptKeys=['kind','binding','credentialRef','challengeRef','packetHash','target','requestId','commandRef','envelopeHash','manifestRef','materialRef','partContentHash','observedAt','expiresAt'];
async function boundedContext(source:NormalStartContextSource,scope:Parameters<NormalStartContextSource['contextBody']>[0],outer:AbortSignal){
 const controller=new AbortController(),timeoutMs=2000,until=performance.now()+timeoutMs;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=()=>controller.abort();
 outer.addEventListener('abort',stop,{once:true});
 try{
  const timeout=new Promise<never>((_,fail)=>{timer=setTimeout(()=>fail(new AuthFailure('EXECUTION_MATERIAL_SOURCE_TIMEOUT',503)),timeoutMs);});
  const result=await Promise.race([timeout,source.contextBody(Object.freeze(cloneV1(scope)),controller.signal)]);
  if(performance.now()>=until||outer.aborted)deny('EXECUTION_MATERIAL_SOURCE_TIMEOUT',503);
  return result;
 }finally{clearTimeout(timer);outer.removeEventListener('abort',stop);controller.abort();}
}
async function readPart(db:PoolClient,args:unknown[],b:any,command:string,material:string,now:Date){
 const rows=(await db.query('SELECT * FROM anvil.normal_start_material_part($1,$2,$3,$4,$5,$6,$7)',args)).rows,r=rows[0];
 if(rows.length!==1||!recordV1(r,['command_record_id','command_ref','envelope','envelope_hash','manifest_ref','manifest','materials','options_body'])||
   !refV1(r.command_ref)||r.command_ref.id!==r.command_record_id||typeof r.options_body!=='string')deny();
 const envelope=readDispatchEnvelopeV1(r.envelope,now.getTime());
 if(envelope.operation!=='START_SESSION'||envelope.commandId!==command||envelope.context.projectId!==b.projectId||envelope.context.executionId!==b.executionId||
   envelope.context.executionGeneration!==b.executionGeneration||r.envelope_hash!==envelope.envelopeHash)deny();
 const descriptor=startMaterialDescriptor({command_record_id:r.command_record_id,manifest_ref:r.manifest_ref,manifest:r.manifest,materials:r.materials},b,envelope as any);
 const group=descriptor.groups.find(g=>g.parts.some(p=>p.materialId===material)),part=group?.parts.find(p=>p.materialId===material);
 const stored=(r.materials as any[]).find(x=>x.ref.id===material);
 if(!group||!part||!stored)deny();
 return {commandRef:r.command_ref as Ref,envelope,descriptor,group:group!,part:part!,materialRef:stored.ref as Ref,scope:r.manifest.scope,
  manifestExpiresAt:Date.parse(r.manifest.expiresAt),optionsBody:r.options_body as string,basis:canonicalJson(r)};
}
async function deliver(o:NormalStartMaterialsOptions,connector:string,execution:string,command:string,material:string,tokenDigest:string,frame:any,
 target:ReturnType<typeof executionTarget>,signal:AbortSignal,pre?:{scope:ContextScope;raw:unknown}){
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
  const packetHash=digest({frame,target}),args=[pid,execution,g.id,g.version,b.executionGeneration,command,material];
  const previous=(await db.query(`SELECT v.content_hash AS vhash,v.snapshot_json AS consumed,r.id,r.content_hash,r.snapshot_json AS receipt
   FROM anvil.execution_challenges v LEFT JOIN anvil.execution_receipts r ON r.project_id=v.project_id AND r.challenge_id=v.id
   WHERE v.project_id=$1 AND v.grant_id=$2 AND v.grant_version=$3 AND v.id=$4 AND v.version=2`,[...keys,c.id])).rows;
  if(previous.length>1)deny();
  const prior=previous[0],s=prior?.receipt;
  if(prior){
   if(!s||!uuidV1(prior.id)||prior.content_hash!==digest(s)||prior.vhash!==digest(prior.consumed)||!same(prior.consumed,{...old.snapshot_json,sequence:prior.consumed.sequence,previousRef:c,
     consumption:{consumedAt:s.observedAt,resultRef:{id:prior.id,version:1,contentHash:prior.content_hash},packetHash:s.packetHash}})||
    !recordV1(s,receiptKeys)||s.kind!=='NORMAL_START_MATERIAL'||!same(s.binding,b)||!same(s.credentialRef,cred.ref)||!same(s.challengeRef,c)||
    !isoV1(s.observedAt)||!isoV1(s.expiresAt))deny();
   if(s.packetHash!==packetHash||!same(s.target,target)||s.requestId!==proof.requestId)deny('IDEMPOTENCY_CONFLICT',409);
  }
  const m=await readPart(db,args,b,command,material,current.now);
  const expires=Math.min(end,Date.parse(m.envelope.expiresAt),m.manifestExpiresAt);
  if(at>=expires)deny();
  // 원문은 매 요청마다 다시 읽어 등록 hash와 대조한다. 영수증에는 bytes를 저장하지 않는다.
  let raw:unknown;
  if(m.group.kind==='START_OPTIONS')raw=m.optionsBody;
  else{
   if(typeof o.context?.contextBody!=='function')deny('EXECUTION_MATERIAL_SOURCE_REQUIRED');
   const scope:ContextScope={projectId:pid,executionId:execution,executionGeneration:b.executionGeneration,commandId:command,
    contextBundleRef:m.group.payloadRef,sourceBytes:m.group.sourceBytes,contentHash:m.group.contentHash};
   // 공급자는 프로젝트 행 잠금·DB 연결을 쥔 채 부르지 않는다. 첫 거래는 여기서 되돌리고 호출자가 거래 밖에서 원문을 받아 다시 들어온다.
   if(!pre){await db.query('ROLLBACK');return {needContext:scope} as const;}
   // 거래 사이에 등록 정보가 바뀌었으면 거절한다. 원문 자체는 아래에서 등록 길이·hash와 다시 대조한다.
   if(!same(pre.scope,scope))deny('EXECUTION_MATERIAL_CURRENT_CHANGED');
   raw=pre.raw;
  }
  if(typeof raw!=='string')deny();
  const bytes=checkedMaterialPart(raw as string,m.group,m.part);
  try{assertKnowledgeTextSafe(raw as string);}catch{deny('EXECUTION_MATERIAL_SENSITIVE_CONTENT');}
  const encoded=bytes.toString('base64url');
  if(encoded.length>maxEncoded||!Buffer.from(encoded,'base64url').equals(bytes))deny();
  const fixed={kind:'NORMAL_START_MATERIAL',binding:b,credentialRef:cred.ref,challengeRef:c,packetHash,target,requestId:proof.requestId,commandRef:m.commandRef,
   envelopeHash:m.envelope.envelopeHash,manifestRef:m.descriptor.manifestRef,materialRef:m.materialRef,partContentHash:m.part.contentHash};
  if(prior&&(!same({...fixed,observedAt:s.observedAt,expiresAt:s.expiresAt},s)||Date.parse(s.expiresAt)>expires||Date.parse(s.expiresAt)<=at||Date.parse(s.observedAt)>at))deny();
  const snapshot=s??{...fixed,observedAt:current.now.toISOString(),expiresAt:new Date(expires).toISOString()};
  const ref={id:prior?.id??randomUUID(),version:1,contentHash:digest(snapshot)};
  if(!prior){
   const seq=(await db.query('SELECT COALESCE(max(server_sequence),0)::int+1 AS sequence FROM anvil.execution_challenges WHERE project_id=$1 AND grant_id=$2 AND grant_version=$3',keys)).rows[0]?.sequence;
   if(!Number.isSafeInteger(seq)||seq<2||seq>20000)deny();
   const v2={...old.snapshot_json,sequence:seq,previousRef:c,consumption:{resultRef:ref,packetHash,consumedAt:snapshot.observedAt}};
   const binding={scope:m.scope,proofResultRef:ref,target,materialRef:m.materialRef,contentHash:m.part.contentHash};
   await db.query("SELECT set_config('anvil.normal_page_verified',txid_current()::text||':'||$1||':'||$2,true)",[ref.contentHash,tokenDigest]);
   if((await db.query('INSERT INTO anvil.execution_challenges(project_id,id,version,grant_id,grant_version,server_sequence,content_hash,snapshot_json) VALUES($1,$2,2,$3,$4,$5,$6,$7)',[pid,c.id,g.id,g.version,seq,digest(v2),JSON.stringify(v2)])).rowCount!==1)deny();
   if((await db.query('INSERT INTO anvil.execution_receipts(project_id,id,version,grant_id,grant_version,challenge_id,challenge_version,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,1,$6,$7)',[pid,ref.id,g.id,g.version,c.id,ref.contentHash,JSON.stringify(snapshot)])).rowCount!==1)deny();
   if((await db.query('INSERT INTO anvil.execution_material_proof_bindings(project_id,proof_result_id,proof_result_version,execution_id,generation,grant_id,grant_version,credential_generation,material_id,content_hash,snapshot_json) VALUES($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10)',
    [pid,ref.id,execution,b.executionGeneration,g.id,g.version,b.credentialGeneration,material,digest(binding),JSON.stringify(binding)])).rowCount!==1)deny();
  }
  const meta={transport:'NORMAL_PROTECTED',proofResultRef:ref,material:{materialId:material,sourceRef:m.group.sourceRef,partIndex:m.part.partIndex,partCount:m.group.parts.length,
   contentHash:m.part.contentHash},observedAt:snapshot.observedAt,expiresAt:snapshot.expiresAt,cacheControl:'no-store',nonceConsumed:true,executionAuthorized:false,dispatchPerformed:false};
  const out={...meta,material:{...meta.material,bytes:encoded}};
  if(Buffer.byteLength(canonicalJson(meta))>maxMetadata||Buffer.byteLength(JSON.stringify(out))>maxResponse)deny();
  // 마지막 await 뒤 credential·현재 권위·등록 행이 그대로인지 다시 확인한 뒤에만 확정한다.
  const lastCred=await requestCredential(db,tokenDigest,connector,execution,proof),last=await readCurrent(db,pid,connector,execution,proof);
  const again=await readPart(db,args,last.binding,command,material,last.now);
  if(!same(lastCred,cred)||!same(last.binding,b)||last.spki!==current.spki||last.now<current.now||signal.aborted||again.basis!==m.basis||
    last.deadline.getTime()<Date.parse(snapshot.expiresAt)||last.now.getTime()>=Date.parse(snapshot.expiresAt))deny();
  committing=true;
  if((await db.query('COMMIT')).command!=='COMMIT')throw Error();
  committing=false;return {out} as const;
 }catch(error){
  if(committing)discard=new Error('EXECUTION_MATERIAL_COMMIT_UNKNOWN');
  try{await db.query('ROLLBACK');}catch{discard??=new Error('EXECUTION_MATERIAL_ROLLBACK_UNKNOWN');}
  if(committing)deny('EXECUTION_MATERIAL_COMMIT_UNKNOWN',503);
  throw error;
 }finally{db.release(discard);}
}
/** 명시 옵션으로만 등록한다. 원문은 검산·같은 거래의 nonce 소비/영수증·확정 COMMIT 뒤에만 no-store로 반환한다. */
export function registerNormalStartMaterials(app:FastifyInstance,o:NormalStartMaterialsOptions,readPacket:(request:FastifyRequest)=>any){
 const origin=new URL(o.origin);
 if(origin.protocol!=='https:'||origin.origin!==o.origin)throw Error('EXECUTION_MATERIAL_HOST_REQUIRED');
 app.get<{Params:{cid:string;eid:string;command:string;material:string}}>('/api/v1/connectors/:cid/executions/:eid/commands/:command/materials/:material',
  {exposeHeadRoute:false,handlerTimeout:20000},async(r,reply)=>{
  const {cid,eid,command,material}=r.params,path='/api/v1/connectors/'+cid+'/executions/'+eid+'/commands/'+command+'/materials/'+material;
  if(![cid,eid,command,material].every(uuidV1)||r.raw.method!=='GET'||r.raw.url!==path)return reply.callNotFound();
  const target=executionTarget('GET',path,[],null),token=normalRequestBearerDigest(r,origin.host,true),packet=readPacket(r);
  const run=(pre?:{scope:ContextScope;raw:unknown})=>deliver(o,cid,eid,command,material,token,packet,target,r.signal,pre);
  const first=await run();
  if('out' in first)return first.out;
  // 거래 밖(잠금·연결 없음)에서 보호 공급자를 유한 시간 호출한 뒤 처음부터 다시 검산한다.
  const raw=await boundedContext(o.context!,first.needContext,r.signal);
  const second=await run({scope:first.needContext,raw});
  if(!('out' in second))deny('EXECUTION_MATERIAL_CURRENT_CHANGED');
  return second.out;
 });
}
