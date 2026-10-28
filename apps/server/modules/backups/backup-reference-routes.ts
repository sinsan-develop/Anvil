import type {FastifyInstance,FastifyRequest} from 'fastify';
import {AuthFailure} from '../access/repository.ts';
import {BackupReferenceStore} from './backup-reference-store.ts';
const uuid={type:'string',pattern:'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'};
const object=(properties:Record<string,unknown>)=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
function token(r:FastifyRequest){if(r.headers.authorization!==undefined)throw new AuthFailure('CONNECTOR_CREDENTIAL_SCOPE_DENIED',403);const cookies=(r.headers.cookie??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith('__Host-anvil.sid='));return cookies.length===1?cookies[0]!.slice('__Host-anvil.sid='.length):'';}
/** 기존 projects strict JSON parser/origin hook 하위에만 등록한다. */
export function registerBackupReferenceReads(app:FastifyInstance,store:BackupReferenceStore){
 const prefix='/api/v1/projects/:projectId',project={params:object({projectId:uuid})},fixed={params:object({projectId:uuid,id:uuid,version:{type:'string',pattern:'^[1-9][0-9]{0,15}$'}})};
 app.get<{Params:{projectId:string};Querystring:Record<string,unknown>}>(prefix+'/backup-resources',{schema:project},r=>store.resources(token(r),r.params.projectId,r.query));
 app.get<{Params:{projectId:string;id:string;version:string};Querystring:Record<string,unknown>}>(prefix+'/backup-resources/:id/versions/:version',{schema:fixed},r=>store.resource(token(r),r.params.projectId,r.params.id,Number(r.params.version),r.query));
 app.get<{Params:{projectId:string};Querystring:Record<string,unknown>}>(prefix+'/backup-references',{schema:project},r=>store.list(token(r),r.params.projectId,r.query));
 app.get<{Params:{projectId:string;id:string;version:string};Querystring:Record<string,unknown>}>(prefix+'/backup-references/:id/versions/:version',{schema:fixed},r=>store.read(token(r),r.params.projectId,r.params.id,Number(r.params.version),r.query));
}
