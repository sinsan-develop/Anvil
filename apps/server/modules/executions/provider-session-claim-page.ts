import type {PoolClient} from 'pg';
import {timingSafeEqual} from 'node:crypto';
import {canonicalJson,contentHash,parseWireJson} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1,isoV1,hashV1,refV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {BoundPgProviderClaimHistoryStore} from './provider-session-claim-history-store.ts';
import type {ProviderClaimReceiptQuery} from './provider-session-claim-history.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const purpose='PROVIDER_CLAIM_HISTORY_PAGE_V1';
function reject():never{throw new AuthFailure('PROVIDER_CLAIM_PAGE_REJECTED',403);}
interface Position{at:string;id:string}
const position=(v:unknown):v is Position=>recordV1(v,['at','id'])&&isoV1(v.at)&&uuidV1(v.id);
const older=(a:Position,b:Position)=>Date.parse(a.at)<Date.parse(b.at)||a.at===b.at&&a.id<b.id;
function decode(token:string,bindingHash:string,now:string,sign:(encoded:string)=>string):Position{
 try{
  if(token.length>4096)return reject();const match=/^([A-Za-z0-9_-]+)\.([a-f0-9]{64})$/.exec(token);if(!match)return reject();const encoded=match[1]!,signature=sign(encoded);
  if(!hashV1(signature)||!timingSafeEqual(Buffer.from(match[2]!,'hex'),Buffer.from(signature,'hex')))return reject();
  const bytes=Buffer.from(encoded,'base64url');if(bytes.toString('base64url')!==encoded)return reject();const text=bytes.toString('utf8'),v=parseWireJson(text);
  if(canonicalJson(v)!==text||!recordV1(v,['purpose','bindingHash','after','issuedAt','expiresAt'])||v.purpose!==purpose||v.bindingHash!==bindingHash||!position(v.after)||!isoV1(v.issuedAt)||!isoV1(v.expiresAt)
   ||Date.parse(v.issuedAt)>Date.parse(now)||Date.parse(v.expiresAt)<=Date.parse(now)||Date.parse(v.expiresAt)<=Date.parse(v.issuedAt)||Date.parse(v.expiresAt)-Date.parse(v.issuedAt)>30000)return reject();return v.after;
 }catch{return reject();}
}
/** OWNER-only historical metadata. Called only with the same existing authenticated db and store.
 * The signing callback uses the existing server key with a dedicated purpose; no key generation or authority issuance. */
export async function readProviderClaimPage(store:BoundPgProviderClaimHistoryStore,db:Pick<PoolClient,'query'>,input:unknown,sign:(encoded:string)=>string){
 if(!(store instanceof BoundPgProviderClaimHistoryStore)||db!==store.db||typeof sign!=='function'||!recordV1(input,['projectId','agentSessionId','limit','cursor'])||!uuidV1(input.projectId)||!uuidV1(input.agentSessionId)
  ||!Number.isSafeInteger(input.limit)||input.limit<1||input.limit>50||input.cursor!==null&&typeof input.cursor!=='string')return reject();
 const q=cloneV1(input),scope={projectId:q.projectId as string,agentSessionId:q.agentSessionId as string},limit=q.limit as number;
 return store.transaction(scope,async tx=>{
  const access=cloneV1(await tx.current()),now=await tx.clock();if(!recordV1(access,['transport','subject','projectId','agentSessionRef','participation','readPermission','responsibleBindingRef','checkedAt','expiresAt'])||!refV1(access.agentSessionRef)||access.participation!=='OWNER'||access.readPermission!=='VERIFIED_CURRENT'||!isoV1(now)||!isoV1(access.checkedAt)||!isoV1(access.expiresAt))return reject();
  // Login idle expiry may advance between authenticated reads. It is a live gate, not actor identity.
  // The signed cursor retains its own original immutable expiresAt and is never extended by this comparison.
  const {checkedAt:_,expiresAt:__,...binding}=access,bindingHash=hash({purpose,access:binding,filter:{limit,kind:'THREAD'}}),after=q.cursor===null?null:decode(q.cursor as string,bindingHash,now,sign);
  const rows=(await db.query('SELECT claim_id,recorded_at,execution_id,generation,command_id,kind,request_id_digest,content_hash FROM anvil.provider_session_claims WHERE project_id=$1::uuid AND agent_session_id=$2::uuid AND ($3::timestamptz IS NULL OR (recorded_at,claim_id)<($3::timestamptz,$4::uuid)) ORDER BY recorded_at DESC,claim_id DESC LIMIT $5::integer',[scope.projectId,scope.agentSessionId,after?.at??null,after?.id??null,limit+1])).rows;
  if(!Array.isArray(rows)||rows.length>limit+1)return reject();
  const items:Array<{query:ProviderClaimReceiptQuery;receipt:NonNullable<Awaited<ReturnType<typeof tx.read>>>['receipt']}>=[];let previous=after,last:Position|null=null;
  for(const [i,row]of rows.entries()){
   const at=row.recorded_at instanceof Date&&Number.isFinite(row.recorded_at.getTime())?row.recorded_at.toISOString():null,current={at,id:row.claim_id};
   if(!position(current)||Date.parse(current.at)>Date.parse(now)||previous&&!older(current,previous)||row.kind!=='THREAD'||!uuidV1(row.execution_id)||!Number.isSafeInteger(Number(row.generation))||Number(row.generation)<1||!uuidV1(row.command_id)||!hashV1(row.request_id_digest)||!hashV1(row.content_hash))return reject();previous=current;
   if(i===limit)continue;
   const query:ProviderClaimReceiptQuery={...scope,executionId:row.execution_id,generation:Number(row.generation),commandId:row.command_id,kind:'THREAD',requestIdDigest:row.request_id_digest,claimHash:row.content_hash},entry=await tx.read(query);
   if(!entry||!same(entry.claim.agentSessionRef,access.agentSessionRef)||entry.claim.claimId!==current.id||entry.receipt.recordedAt!==current.at||entry.receipt.claimRef.contentHash!==query.claimHash)return reject();
   items.push({query,receipt:cloneV1(entry.receipt)});last=current;
  }
  const hasMore=rows.length>limit,ended=await tx.clock(),expiresAt=new Date(Math.min(Date.parse(access.expiresAt),Date.parse(access.checkedAt)+30000)).toISOString();
  if(!isoV1(ended)||Date.parse(ended)>=Date.parse(expiresAt))return reject();let nextCursor:string|null=null;
  if(hasMore){if(!last)return reject();const encoded=Buffer.from(canonicalJson({purpose,bindingHash,after:last,issuedAt:ended,expiresAt})).toString('base64url'),signature=sign(encoded);if(!hashV1(signature))return reject();nextCursor=encoded+'.'+signature;}
  return{...scope,agentSessionRef:cloneV1(access.agentSessionRef),items,hasMore,nextCursor,observedAt:ended,historyOnly:true as const,availability:'UNVERIFIED' as const,executionAuthorized:false as const,dispatchPerformed:false as const};
 });
}
