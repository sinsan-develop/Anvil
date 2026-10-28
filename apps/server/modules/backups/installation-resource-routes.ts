import type {FastifyInstance,FastifyRequest} from 'fastify';
import {TLSSocket} from 'node:tls';
import {AuthFailure} from '../access/repository.ts';
import {InstallationResourceStore} from './installation-resource-store.ts';
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'};
function token(r:FastifyRequest){if(r.headers.authorization!==undefined)throw new AuthFailure('CONNECTOR_CREDENTIAL_SCOPE_DENIED',403);const c=(r.headers.cookie??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith('__Host-anvil.sid='));return c.length===1?c[0]!.slice(17):'';}
function query(r:FastifyRequest){if(Object.keys(r.query as object).length)throw new AuthFailure('INPUT_INVALID',400);}
export function registerInstallationResourceRoutes(app:FastifyInstance,store:InstallationResourceStore){
 const prefix='/api/v1/projects/:projectId',params={type:'object',properties:{projectId:uuid,id:uuid},required:['projectId','id'],additionalProperties:false};
 app.get<{Params:{projectId:string};Querystring:Record<string,unknown>}>(prefix+'/backup-installation-slots',{schema:{params:{type:'object',properties:{projectId:uuid},required:['projectId'],additionalProperties:false}}},r=>{const q=r.query;if(Object.keys(q).length!==1||!['TARGET','ENCRYPTION_KEY'].includes(String(q.kind)))throw new AuthFailure('INPUT_INVALID',400);return store.slots(token(r),r.params.projectId,q);});
 app.get<{Params:{projectId:string;id:string}}>(prefix+'/backup-resource-intents/:id',{schema:{params}},r=>{query(r);return store.readIntent(token(r),r.params.projectId,r.params.id);});
 app.post<{Params:{projectId:string;id:string}}>(prefix+'/backup-resource-intents/:id/fulfill',{bodyLimit:20480,schema:{params}},r=>{query(r);const csrf=r.headers['x-anvil-csrf'];if(typeof csrf!=='string'||!csrf)throw new AuthFailure('CSRF_INVALID',403);const body=r.body as any;if(body?.secretInput!==null&&body?.secretInput!==undefined&&(!(r.raw.socket instanceof TLSSocket)||r.raw.socket.encrypted!==true))throw new AuthFailure('RESOURCE_UNVERIFIED',412);return store.fulfill(token(r),csrf,r.params.projectId,r.params.id,r.body);});
 const fixed={params:{type:'object',properties:{projectId:uuid,id:uuid,version:{type:'string',pattern:'^[1-9][0-9]{0,15}$'}},required:['projectId','id','version'],additionalProperties:false}};
 app.get<{Params:{projectId:string;id:string;version:string}}>(prefix+'/backup-resources/:id/versions/:version/portable-key',{schema:fixed},async(r,reply)=>{query(r);const file=await store.portableKey(token(r),r.params.projectId,r.params.id,Number(r.params.version));if(!/^[a-zA-Z0-9._-]{1,160}$/.test(file.name))throw new AuthFailure('RESOURCE_STATE_UNKNOWN',503);reply.header('content-type','application/octet-stream').header('content-disposition','attachment; filename="'+file.name+'"');return file.bytes;});
 app.get<{Params:{projectId:string;id:string;version:string}}>(prefix+'/backup-resources/:id/versions/:version/key-state',{schema:fixed},r=>{query(r);return store.keyState(token(r),r.params.projectId,r.params.id,Number(r.params.version));});
}
