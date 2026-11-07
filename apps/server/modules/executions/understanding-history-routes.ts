import type {FastifyInstance} from 'fastify';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1,cloneV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {readUnderstandingHistory,type ProjectUnderstandingReviews} from './execution-understanding.ts';
export interface UnderstandingHistoryPort{readonly transport:'SYNTHETIC_ONLY';list:ProjectUnderstandingReviews['list']}
/** 승인된 HUMAN 역사 조회만 연결한다. 실제 제공자가 없으면 비어 있는 성공으로 대체하지 않는다. */
export function registerUnderstandingHistoryRoutes(app:FastifyInstance,options:{origin:string},provider?:UnderstandingHistoryPort){
 const origin=new URL(options.origin);if(origin.protocol!=='https:'||origin.origin!==options.origin)throw Error('AUTH_ORIGIN_INVALID');
 const unavailable=():never=>{throw new AuthFailure('UNDERSTANDING_HISTORY_UNAVAILABLE',503);};
 const port=()=>{if(provider?.transport!=='SYNTHETIC_ONLY'||typeof provider.list!=='function')unavailable();};
 app.get('/api/v1/projects/:pid/executions/:eid/understanding-reviews',async(request,reply)=>{
  reply.header('cache-control','no-store');
  if(request.headers.host!==origin.host||request.headers.origin!==undefined&&request.headers.origin!==origin.origin||request.headers.authorization!==undefined)throw new AuthFailure('ORIGIN_INVALID',403);
  const p={...request.params as object} as Record<string,unknown>,q={...request.query as object} as Record<string,unknown>;
  if(!recordV1(p,['pid','eid'])||!uuidV1(p.pid)||!uuidV1(p.eid)||!recordV1(q,['generation'])||typeof q.generation!=='string'||!/^[1-9][0-9]{0,15}$/.test(q.generation)||!Number.isSafeInteger(Number(q.generation)))throw new AuthFailure('INPUT_INVALID',400);
  const cookies=(request.headers.cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('__Host-anvil.sid='));
  if(cookies.length!==1||!/^__Host-anvil.sid=[A-Za-z0-9_-]{43}$/.test(cookies[0]!))throw new AuthFailure('AUTH_REQUIRED',401);
  const scope={projectId:p.pid,executionId:p.eid,executionGeneration:Number(q.generation)};
  try{
   port();const value=await provider!.list(cookies[0]!.slice('__Host-anvil.sid='.length),scope);port();
   if(!recordV1(value,['transport','scope','items','currentness','executionAuthorized','dispatchPerformed'])||value.transport!=='SYNTHETIC_ONLY'||canonicalJson(value.scope)!==canonicalJson(scope)||value.currentness!=='NOT_RECHECKED'||value.executionAuthorized!==false||value.dispatchPerformed!==false)unavailable();
   readUnderstandingHistory(value.items,scope);return cloneV1(value);
  }catch(error){if(error instanceof AuthFailure&&error.statusCode<500)throw error;return unavailable();}
 });
}
