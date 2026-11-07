import type {FastifyInstance,FastifyRequest} from 'fastify';
import {recordV1,uuidV1,hashV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {AccessRoutesOptions} from '../access/routes.ts';
import {SyntheticProviderClaimHistory} from './provider-session-claim-history.ts';
import {BoundPgProviderClaimHistoryStore} from './provider-session-claim-history-store.ts';
import {readProviderClaimPage} from './provider-session-claim-page.ts';
function invalid():never{throw new AuthFailure('INPUT_INVALID',400);}
function frameworkFields(raw:unknown):Record<string,unknown>{
 // Fastify uses a null-rooted intermediate prototype. Preserve every own data field before applying exact wire validation.
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.getOwnPropertySymbols(raw).length)return invalid();
 const fields=Object.getOwnPropertyDescriptors(raw);if(Object.values(fields).some(d=>!d.enumerable||!('value'in d)))return invalid();
 return Object.fromEntries(Object.entries(fields).map(([key,d])=>[key,d.value]));
}
function cookie(request:FastifyRequest){
 const tokens=(request.headers.cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('__Host-anvil.sid='));
 if(tokens.length!==1)return '';
 return tokens[0]!.slice('__Host-anvil.sid='.length);
}
/** The approved exact historical receipt GET. OWNER is connected first; RESPONSIBLE remains unimplemented here.
 * No execution credential reuse, claim creation, session renewal or raw provider handle response. */
export function registerProviderClaimHistoryRoutes(app:FastifyInstance,options:AccessRoutesOptions){
 const origin=new URL(options.origin);if(origin.protocol!=='https:'||origin.origin!==options.origin)throw Error('AUTH_ORIGIN_INVALID');
 app.get('/api/v1/projects/:pid/agent-sessions/:sid/provider-session-claims',async(request,reply)=>{
  if(request.headers.host!==origin.host||request.headers.authorization!==undefined)throw new AuthFailure('PROVIDER_SESSION_HISTORY_REJECTED',403);
  const p=frameworkFields(request.params),q=frameworkFields(request.query);
  if(!recordV1(p,['pid','sid'])||!uuidV1(p.pid)||!uuidV1(p.sid)||Object.keys(q).some(k=>!['limit','cursor'].includes(k))
   ||q.limit!==undefined&&(typeof q.limit!=='string'||!/^[1-9][0-9]?$/.test(q.limit)||Number(q.limit)>50)
   ||q.cursor!==undefined&&(typeof q.cursor!=='string'||!q.cursor.length||q.cursor.length>4096))return invalid();
  const token=cookie(request);if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AuthFailure('AUTH_REQUIRED',401);
  let store:BoundPgProviderClaimHistoryStore|undefined;
  const page=await options.repository.authenticated(token,null,async(db,actor)=>{
   store=new BoundPgProviderClaimHistoryStore(db,actor);return readProviderClaimPage(store,db,{projectId:p.pid,agentSessionId:p.sid,limit:q.limit===undefined?20:Number(q.limit),cursor:q.cursor??null},encoded=>options.repository.signProviderClaimCursor(encoded));
  });
  if(!store||Date.now()>=Date.parse(store.responseValidUntil()))throw new AuthFailure('PROVIDER_SESSION_HISTORY_REJECTED',403);
  reply.header('cache-control','no-store');return page;
 });
 app.get('/api/v1/projects/:pid/agent-sessions/:sid/provider-session-claim-receipt',async(request,reply)=>{
  if(request.headers.host!==origin.host||request.headers.authorization!==undefined)throw new AuthFailure('PROVIDER_SESSION_HISTORY_REJECTED',403);
  const p=frameworkFields(request.params),q=frameworkFields(request.query);
  if(!recordV1(p,['pid','sid'])||!uuidV1(p.pid)||!uuidV1(p.sid)||!recordV1(q,['executionId','generation','commandId','kind','requestIdDigest','claimHash'])||!uuidV1(q.executionId)||!uuidV1(q.commandId)
   ||typeof q.generation!=='string'||!/^[1-9][0-9]{0,15}$/.test(q.generation)||!Number.isSafeInteger(Number(q.generation))||typeof q.kind!=='string'||!['THREAD','TURN'].includes(q.kind)||!hashV1(q.requestIdDigest)||!hashV1(q.claimHash))return invalid();
  const token=cookie(request);if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new AuthFailure('AUTH_REQUIRED',401);
  const query={projectId:p.pid,agentSessionId:p.sid,executionId:q.executionId,generation:Number(q.generation),commandId:q.commandId,kind:q.kind as 'THREAD'|'TURN',requestIdDigest:q.requestIdDigest,claimHash:q.claimHash};
  let store:BoundPgProviderClaimHistoryStore|undefined;
  const responseCurrent=()=>{if(!store||Date.now()>=Date.parse(store.responseValidUntil()))throw new AuthFailure('PROVIDER_SESSION_HISTORY_REJECTED',403);};
  try{
   const result=await options.repository.authenticated(token,null,async(db,actor)=>{
    store=new BoundPgProviderClaimHistoryStore(db,actor);return new SyntheticProviderClaimHistory(store).read(query);
   });
   // authenticated includes COMMIT. Do not adopt a success or conflict after the original finite access window.
   responseCurrent();reply.header('cache-control','no-store');return result.result;
  }catch(error){if(error instanceof AuthFailure&&error.message==='PROVIDER_SESSION_CLAIM_CONFLICT'&&error.statusCode===409)responseCurrent();throw error;}
 });
}
