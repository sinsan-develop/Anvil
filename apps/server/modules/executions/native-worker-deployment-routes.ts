import type {FastifyInstance} from 'fastify';
import {types} from 'node:util';
import {readWorkerDeploymentRead,workerNonce} from '../../../../contracts/runtime/native-worker-deployment-v1.ts';
import {workerDataSnapshot} from '../../../../contracts/runtime/native-worker-provenance-v1.ts';
import {refV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
export interface WorkerDeploymentReadSource{read(factory:RuntimeRefV1,nonce:string,signal?:AbortSignal):Promise<unknown>;}
export function registerWorkerDeploymentRoutes(app:FastifyInstance,source:WorkerDeploymentReadSource|null=null){
 const read=source?.read;
 app.get<{Params:{factoryId:string;factoryVersion:string;factoryHash:string}}>('/api/v1/native-worker-deployments/:factoryId/:factoryVersion/:factoryHash',async(request,reply)=>{
  const error=(status:number,code:string)=>reply.code(status).header('cache-control','no-store').send({code});
  const {factoryId,factoryVersion,factoryHash}=request.params,factory={id:factoryId,version:Number(factoryVersion),contentHash:factoryHash};
  const url=request.raw.url??request.url,match=/^\/api\/v1\/native-worker-deployments\/([0-9a-f-]+)\/([1-9][0-9]*)\/([0-9a-f]{64})\?nonce=([A-Za-z0-9_-]{43})$/.exec(url);
  const raw=request.raw.rawHeaders,names=raw.filter((_,i)=>i%2===0).map(h=>h.toLowerCase());
  if(!match||match[1]!==factoryId||match[2]!==factoryVersion||match[3]!==factoryHash||!refV1(factory)||!workerNonce(match[4])||request.body!==undefined||request.headers['content-length']!==undefined&&request.headers['content-length']!=='0'||request.headers['transfer-encoding']!==undefined||request.headers.authorization!==undefined||request.headers.cookie!==undefined||names.includes('authorization')||names.includes('cookie')||new Set(names).size!==names.length)return error(400,'INPUT_INVALID');
  if(!source||types.isProxy(source)||typeof read!=='function'||source.read!==read)return error(503,'WORKER_DEPLOYMENT_UNAVAILABLE');
  const wall=Date.now(),start=performance.now(),controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,active=true;
  const abort=()=>controller.abort();request.raw.once('aborted',abort);
  const work=Promise.resolve().then(()=>read.call(source,factory,match[4]!,controller.signal));
  const stop=new Promise<never>((_,reject)=>{const end=()=>{active=false;controller.abort();reject(Error('WORKER_DEPLOYMENT_UNAVAILABLE'));};timer=setTimeout(end,1000);controller.signal.addEventListener('abort',()=>{active=false;reject(Error('WORKER_DEPLOYMENT_UNAVAILABLE'));},{once:true});});
  try{const rawResult=await Promise.race([work,stop]),elapsed=performance.now()-start,now=Date.now();if(!active||controller.signal.aborted||source.read!==read||elapsed<0||elapsed>=1000||now<wall)throw Error();const result=workerDataSnapshot(rawResult);if(Date.parse(result.observedAt)<wall||Date.parse(result.observedAt)>now)throw Error();const checked=readWorkerDeploymentRead(result,factory,match[4]!,now);return reply.header('cache-control','no-store').send(checked);}
  catch(e){const message=e instanceof Error?e.message:'';return error(message==='WORKER_DEPLOYMENT_NOT_FOUND'?404:message==='WORKER_DEPLOYMENT_NOT_CURRENT'?412:503,message==='WORKER_DEPLOYMENT_NOT_FOUND'?'NOT_FOUND':message==='WORKER_DEPLOYMENT_NOT_CURRENT'?'NOT_CURRENT':'WORKER_DEPLOYMENT_UNAVAILABLE');}
  finally{active=false;if(timer)clearTimeout(timer);request.raw.removeListener('aborted',abort);controller.abort();void work.catch(()=>{});}
 });
}
