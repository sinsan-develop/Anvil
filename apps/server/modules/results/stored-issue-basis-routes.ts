import type {FastifyInstance} from 'fastify';
import type {AccessRoutesOptions} from '../access/routes.ts';
import {AuthFailure} from '../access/repository.ts';
import type {ProjectStoredIssueBasis} from './project-stored-issue-basis.ts';
export function registerStoredIssueBasisRoute(app:FastifyInstance,options:AccessRoutesOptions,provider:ProjectStoredIssueBasis){
 const host=new URL(options.origin).host,id={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'};
 app.get<{Params:{projectId:string;id:string}}>('/api/v1/projects/:projectId/results/:id/issue-basis',{schema:{params:{type:'object',properties:{projectId:id,id},required:['projectId','id'],additionalProperties:false},querystring:{type:'object',properties:{},additionalProperties:false}}},async(request,reply)=>{
  reply.header('cache-control','no-store');if(request.headers.host!==host||request.headers.authorization!==undefined)throw new AuthFailure('ORIGIN_INVALID',403);
  const tokens=(request.headers.cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('__Host-anvil.sid='));if(tokens.length!==1||!/^__Host-anvil.sid=[A-Za-z0-9_-]{43}$/.test(tokens[0]!))throw new AuthFailure('AUTH_REQUIRED',401);
  const value=await options.repository.authenticated(tokens[0]!.slice('__Host-anvil.sid='.length),null,(db,actor)=>provider.read(db,actor,request.params.projectId,request.params.id));
  if(!Number.isFinite(Date.parse(value.validUntil))||Date.now()>=Date.parse(value.validUntil))throw new AuthFailure('AUTH_REQUIRED',401);return value.basis;
 });
}
