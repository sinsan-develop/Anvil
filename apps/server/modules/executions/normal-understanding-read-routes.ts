import type {FastifyInstance,FastifyRequest} from 'fastify';
import {parseWireJson} from '../../../../contracts/canonical.ts';
import {recordV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import type {AccessRoutesOptions} from '../access/routes.ts';
import {NormalUnderstandingReadRequests} from './normal-understanding-read-requests.ts';

function header(request:FastifyRequest,name:string){
 const headers=request.raw.rawHeaders,indices=headers.flatMap((v,i)=>i%2===0&&v.toLowerCase()===name?[i]:[]);
 const value=request.headers[name];if(indices.length!==1||typeof value!=='string'||headers[indices[0]!+1]!==value)throw new AuthFailure('NORMAL_UNDERSTANDING_REQUEST_CHANNEL_INVALID',403);
 return value;
}
/** HUMAN 명시 요청 전용. connector GET/POST, 자동 poll 및 선택 원문 경로를 등록하지 않는다. */
export function registerNormalUnderstandingReadRoutes(app:FastifyInstance,options:AccessRoutesOptions){
 const origin=new URL(options.origin);if(origin.protocol!=='https:'||origin.origin!==options.origin)throw Error('AUTH_ORIGIN_INVALID');
 const service=new NormalUnderstandingReadRequests(options.repository);
 app.register(async route=>{
  route.removeContentTypeParser('application/json');route.addContentTypeParser('application/json',{parseAs:'string'},(_request,raw,done)=>{
   try{done(null,parseWireJson(String(raw)));}catch{done(new AuthFailure('INPUT_INVALID',400),undefined);}
  });
  route.post('/api/v1/projects/:pid/executions/:eid/understanding-response-read-requests',async(request,reply)=>{
   if(header(request,'host')!==origin.host||header(request,'origin')!==options.origin||request.headers.authorization!==undefined
    ||request.headers['content-encoding']!==undefined||request.headers['transfer-encoding']!==undefined)throw new AuthFailure('NORMAL_UNDERSTANDING_REQUEST_CHANNEL_INVALID',403);
   const cookie=header(request,'cookie'),csrf=header(request,'x-anvil-csrf'),tokens=cookie.split(';').map(v=>v.trim()).filter(v=>v.startsWith('__Host-anvil.sid='));
   if(tokens.length!==1||!/^[A-Za-z0-9_-]{43}$/.test(tokens[0]!.slice(17)))throw new AuthFailure('AUTH_REQUIRED',401);
   if(!/^[A-Za-z0-9_-]{43}$/.test(csrf))throw new AuthFailure('CSRF_INVALID',403);
   const params=Object.fromEntries(Object.entries(request.params as Record<string,unknown>)),query=Object.keys(request.query as object),q=request.body;
   if(!recordV1(params,['pid','eid'])||!uuidV1(params.pid)||!uuidV1(params.eid)||query.length||!q||typeof q!=='object'
    ||(q as Record<string,unknown>).projectId!==params.pid||(q as Record<string,unknown>).targetId!==params.eid)throw new AuthFailure('INPUT_INVALID',400);
   const result=await service.command(tokens[0]!.slice(17),csrf,q);reply.header('cache-control','no-store');return result;
  });
 });
}
