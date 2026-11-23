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
function humanSession(request:FastifyRequest){
 const csrf=header(request,'x-anvil-csrf');
 const tokens=header(request,'cookie').split(';').map(v=>v.trim()).filter(v=>v.startsWith('__Host-anvil.sid='));
 if(tokens.length!==1||!/^[A-Za-z0-9_-]{43}$/.test(tokens[0]!.slice(17)))throw new AuthFailure('AUTH_REQUIRED',401);
 if(!/^[A-Za-z0-9_-]{43}$/.test(csrf))throw new AuthFailure('CSRF_INVALID',403);
 return {token:tokens[0]!.slice(17),csrf};
}
/** HUMAN 명시 탐색 근거 조회와 요청 저장 전용. */
export function registerNormalUnderstandingReadRoutes(app:FastifyInstance,options:AccessRoutesOptions){
 const origin=new URL(options.origin);if(origin.protocol!=='https:'||origin.origin!==options.origin)throw Error('AUTH_ORIGIN_INVALID');
 const service=new NormalUnderstandingReadRequests(options.repository);
 app.register(async route=>{
  route.removeContentTypeParser('application/json');route.addContentTypeParser('application/json',{parseAs:'string'},(_request,raw,done)=>{
   try{done(null,parseWireJson(String(raw)));}catch{done(new AuthFailure('INPUT_INVALID',400),undefined);}
  });
  route.get('/api/v1/projects/:pid/understanding-response-readiness',{exposeHeadRoute:false},async(request,reply)=>{
   reply.header('cache-control','no-store');
   if(header(request,'host')!==origin.host||(request.headers.origin!==undefined&&header(request,'origin')!==options.origin)
    ||request.headers.authorization!==undefined||request.headers['content-encoding']!==undefined||request.headers['transfer-encoding']!==undefined
    ||request.headers['content-length']!==undefined||request.body!==undefined)throw new AuthFailure('NORMAL_UNDERSTANDING_REQUEST_CHANNEL_INVALID',403);
   const params=Object.fromEntries(Object.entries(request.params as Record<string,unknown>));
   if(!recordV1(params,['pid'])||!uuidV1(params.pid))throw new AuthFailure('INPUT_INVALID',400);
   const path=`/api/v1/projects/${params.pid}/understanding-response-readiness`,url=request.raw.url??'';
   if(!url.startsWith(path+'?')||url.length>512)throw new AuthFailure('INPUT_INVALID',400);
   const q=new URLSearchParams(url.slice(path.length+1));
   const keys=['controlGeneration','assignmentId','assignmentVersion','assignmentHash','preparationId','preparationVersion','preparationHash'];
   if([...q.keys()].length!==keys.length||keys.some(key=>q.getAll(key).length!==1)||url!==`${path}?${q}`)throw new AuthFailure('INPUT_INVALID',400);
   const version=(key:string)=>{const value=q.get(key)??'';return /^[1-9][0-9]{0,15}$/.test(value)?Number(value):null;};
   const {token,csrf}=humanSession(request);
   return service.readiness(token,csrf,params.pid,{controlGeneration:version('controlGeneration'),
    assignmentRef:{id:q.get('assignmentId'),version:version('assignmentVersion'),contentHash:q.get('assignmentHash')},
    preparationRef:{id:q.get('preparationId'),version:version('preparationVersion'),contentHash:q.get('preparationHash')}});
  });
  route.post('/api/v1/projects/:pid/executions/:eid/understanding-response-read-requests',{bodyLimit:2*1024*1024},async(request,reply)=>{
   reply.header('cache-control','no-store');
   if(header(request,'host')!==origin.host||header(request,'origin')!==options.origin||request.headers.authorization!==undefined
    ||request.headers['content-encoding']!==undefined||request.headers['transfer-encoding']!==undefined)throw new AuthFailure('NORMAL_UNDERSTANDING_REQUEST_CHANNEL_INVALID',403);
   const {token,csrf}=humanSession(request);
   const params=Object.fromEntries(Object.entries(request.params as Record<string,unknown>)),query=Object.keys(request.query as object),q=request.body;
   if(!recordV1(params,['pid','eid'])||!uuidV1(params.pid)||!uuidV1(params.eid)||query.length||!q||typeof q!=='object'
    ||(q as Record<string,unknown>).projectId!==params.pid||(q as Record<string,unknown>).targetId!==params.eid)throw new AuthFailure('INPUT_INVALID',400);
   const result=await service.command(token,csrf,q);reply.header('cache-control','no-store');return result;
  });
  for(const suffix of ['current','range-current','range-history'] as const)route.get(`/api/v1/projects/:pid/executions/:eid/understanding-response-read-requests/:rid/${suffix}`,{exposeHeadRoute:false},async(request,reply)=>{
   reply.header('cache-control','no-store');
   if(header(request,'host')!==origin.host||(request.headers.origin!==undefined&&header(request,'origin')!==options.origin)
    ||request.headers.authorization!==undefined||request.headers['content-encoding']!==undefined||request.headers['transfer-encoding']!==undefined
    ||request.headers['content-length']!==undefined||request.body!==undefined)throw new AuthFailure('NORMAL_UNDERSTANDING_REQUEST_CHANNEL_INVALID',403);
   const params=Object.fromEntries(Object.entries(request.params as Record<string,unknown>));
   if(!recordV1(params,['pid','eid','rid'])||!uuidV1(params.pid)||!uuidV1(params.eid)||!uuidV1(params.rid))throw new AuthFailure('INPUT_INVALID',400);
   const path=`/api/v1/projects/${params.pid}/executions/${params.eid}/understanding-response-read-requests/${params.rid}/${suffix}`,url=request.raw.url??'';
   if(!url.startsWith(path+'?')||url.length>1024)throw new AuthFailure('INPUT_INVALID',400);
   const q=new URLSearchParams(url.slice(path.length+1)),keys=['controlGeneration','executionGeneration','requestVersion','requestHash','assignmentId','assignmentVersion','assignmentHash','preparationId','preparationVersion','preparationHash'];
   if([...q.keys()].length!==keys.length||keys.some(key=>q.getAll(key).length!==1)||url!==`${path}?${q}`)throw new AuthFailure('INPUT_INVALID',400);
   const version=(key:string)=>{const value=q.get(key)??'';return /^[1-9][0-9]{0,15}$/.test(value)?Number(value):null;};
   const {token,csrf}=humanSession(request);
   return service[suffix==='range-history'?'historicalRange':suffix==='range-current'?'currentRange':'current'](token,csrf,{projectId:params.pid,executionId:params.eid,executionGeneration:version('executionGeneration'),controlGeneration:version('controlGeneration'),
    requestRef:{id:params.rid,version:version('requestVersion'),contentHash:q.get('requestHash')},
    assignmentRef:{id:q.get('assignmentId'),version:version('assignmentVersion'),contentHash:q.get('assignmentHash')},
    preparationRef:{id:q.get('preparationId'),version:version('preparationVersion'),contentHash:q.get('preparationHash')}});
  });
 });
}
