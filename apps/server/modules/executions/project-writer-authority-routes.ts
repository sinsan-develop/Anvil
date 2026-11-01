import {parseWireJson} from '../../../../contracts/canonical.ts';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {AccessRoutesOptions} from '../access/routes.ts';
import {AuthFailure} from '../access/repository.ts';
import {projectMember,currentProjectController,authorizeMaterial} from '../access/project-command.ts';
import {uuidV1,recordV1} from '../../../../contracts/runtime/validation-v1.ts';
import {writerSame} from '../../../../contracts/runtime/project-writer-authority-v1.ts';
import {WriterAuthorityModel,ProjectWriterAuthorityRepository} from './project-writer-authority.ts';
export interface WriterAuthorityRoutesOptions{enabled:true;model?:WriterAuthorityModel;persistence?:ProjectWriterAuthorityRepository;observationSource?:{transport:'SOURCE_ONLY_MODEL';read(request:FastifyRequest):Promise<unknown>;transaction?(request:FastifyRequest,accept:(db:import('pg').PoolClient,actor:import('../access/repository.ts').AuthenticatedIdentity,report:unknown)=>Promise<unknown>):Promise<unknown>}}
const unavailable=():never=>{throw new AuthFailure('WRITER_AUTHORITY_UNAVAILABLE',503);};
/** 명시 등록된 source-only 검수 입구. 기본 앱에는 등록하지 않는다. */
export function registerWriterAuthorityRoutes(app:FastifyInstance,options:WriterAuthorityRoutesOptions,access?:AccessRoutesOptions):void{
 app.register(async scope=>{
 scope.removeContentTypeParser('application/json');scope.addContentTypeParser('application/json',{parseAs:'string'},(_r,raw,done)=>{try{done(null,parseWireJson(String(raw)));}catch{done(new AuthFailure('INPUT_INVALID',400),undefined);}});
 const model=options.model,persistence=options.persistence,source=options.observationSource,read=source?.read,transaction=source?.transaction;
 const human=async(request:FastifyRequest,pid:string,write:boolean,work:(actor:any,db:import('pg').PoolClient)=>Promise<unknown>)=>{
  if((!(model instanceof WriterAuthorityModel)&&!(persistence instanceof ProjectWriterAuthorityRepository))||!access)return unavailable();if(!uuidV1(pid)||model&&model.config.projectId!==pid)throw new AuthFailure('INPUT_INVALID',422);
  if(request.headers.host!==new URL(access.origin).host||write&&request.headers.origin!==access.origin||request.headers.authorization!==undefined)throw new AuthFailure('ORIGIN_INVALID',403);
  const cookies=(request.headers.cookie??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith('__Host-anvil.sid='));if(cookies.length!==1)throw new AuthFailure('AUTH_REQUIRED',401);const token=cookies[0]!.slice('__Host-anvil.sid='.length),csrf=request.headers['x-anvil-csrf'];if(write&&(typeof csrf!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(csrf)))throw new AuthFailure('CSRF_INVALID',403);
  return access.repository.authenticated(token,write?csrf as string:null,async(db,actor)=>{const p=await projectMember(db,actor,pid,write);if(p.archived_at)throw new AuthFailure('PROJECT_ARCHIVED',412);if(p.participation!=='OWNER')throw new AuthFailure('PROJECT_OWNER_REQUIRED',403);if(write){if(!persistence&&(!(actor.reauthUntil instanceof Date)||actor.reauthUntil.getTime()<=Date.now()))throw new AuthFailure('REAUTHENTICATION_REQUIRED',412);if(!recordV1(request.body,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload'])||request.body.projectId!==pid)throw new AuthFailure('INPUT_INVALID',422);await currentProjectController(db,actor,request.body as any);await authorizeMaterial(db,actor,request.body as any,true);}else{const control=(await db.query('SELECT * FROM anvil.project_control WHERE project_id=$1 FOR SHARE',[pid])).rows[0];if(!control||control.revoked_at||control.actor_id!==actor.actorId||control.client_id!==actor.clientId)throw new AuthFailure('PROJECT_CONTROL_REQUIRED',403);await authorizeMaterial(db,actor,{schemaVersion:1,projectId:pid,commandId:pid,clientId:actor.clientId,controlGeneration:Number(control.generation),operation:'readProjectWriterAuthority',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{}});}return work(actor,db);});
 };
 scope.get<{Params:{projectId:string}}>('/api/v1/projects/:projectId/writer-authorities/current',r=>human(r,r.params.projectId,false,(a,db)=>persistence?persistence.current(db,a,r.params.projectId):model!.current(a)));
 scope.post<{Params:{projectId:string}}>('/api/v1/projects/:projectId/writer-boundaries/establish',r=>human(r,r.params.projectId,true,(a,db)=>persistence?persistence.command(db,a,r.body as any):model!.establish(r.body,{caller:a})));
 scope.post<{Params:{projectId:string;leaseId:string}}>('/api/v1/projects/:projectId/writer-authorities/:leaseId/revoke',r=>human(r,r.params.projectId,true,(a,db)=>{if(!recordV1((r.body as any)?.payload,['expectedHeadRef','leaseId'])||(r.body as any).payload.leaseId!==r.params.leaseId)throw new AuthFailure('INPUT_INVALID',422);return persistence?persistence.command(db,a,r.body as any):model!.revoke(r.body,a);}));
 scope.post('/api/v1/connector/writer-observations',async request=>{
  if(!source||source.transport!=='SOURCE_ONLY_MODEL'||typeof read!=='function'||source.read!==read||request.headers.cookie!==undefined)return unavailable();const report=await read.call(source,request);if(source.read!==read||!writerSame(report,request.body))return unavailable();
  if(persistence){if(typeof transaction!=='function'||source.transaction!==transaction)return unavailable();let count=0,produced:unknown;const result=await transaction.call(source,request,async(db,actor,value)=>{if(++count!==1||!writerSame(value,report))return unavailable();produced=await persistence.acceptObservation(db,actor,value);return produced;});if(count!==1||source.transaction!==transaction||!writerSame(result,produced))return unavailable();return produced;}
  if(!model||model.transport!=='SOURCE_ONLY_MODEL')return unavailable();return model.acceptObservation(report);
 });
 });
}
