import type {FastifyInstance,FastifyRequest} from 'fastify';
import type {AccessRoutesOptions} from '../access/routes.ts';
import {AuthFailure} from '../access/repository.ts';
import {parseWireJson} from '../../../../contracts/canonical.ts';
import {sourceReadCredential} from '../../http/connector-auth.ts';
import {SourceReadProtocol} from './source-read-protocol.ts';
import {SourceReadRecords} from './source-read-records.ts';
import {ProjectListCodec} from '../projects/service.ts';
function humanToken(request:FastifyRequest){const values=(request.headers.cookie??'').split(';').map(v=>v.trim()).filter(v=>v.startsWith('__Host-anvil.sid='));return values.length===1?values[0]!.slice('__Host-anvil.sid='.length):'';}
export function registerSourceReadRoutes(app:FastifyInstance,options:AccessRoutesOptions){
 const protocol=new SourceReadProtocol(options.repository),origin=new URL(options.origin),records=new SourceReadRecords(options.repository.installationId),codec=new ProjectListCodec(v=>options.repository.signProjectCursor('SOURCE_READ_GRANTS:'+v));
 app.register(async routes=>{
  routes.removeContentTypeParser('application/json');
  routes.addContentTypeParser('application/json',{parseAs:'string'},(_r,body,done)=>{try{done(null,parseWireJson(String(body)));}catch{done(Object.assign(Error('INPUT_INVALID'),{statusCode:400}),undefined);}});
  routes.addHook('onRequest',async request=>{
   if(origin.protocol!=='https:'||!('encrypted' in request.raw.socket)||request.raw.socket.encrypted!==true||request.headers.host!==origin.host||request.headers.origin!==undefined&&request.headers.origin!==options.origin)throw new AuthFailure('SOURCE_READ_ORIGIN_OR_HTTPS_INVALID',403);
   if(request.headers.cookie)throw new AuthFailure('CONNECTOR_CREDENTIAL_SCOPE_DENIED',403);
   if(Object.keys(request.query as object).length)throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
  });
  routes.post<{Params:{cid:string;gid:string}}>('/api/v1/connectors/:cid/source-read-grants/:gid/exchange',{bodyLimit:256*1024,handlerTimeout:10000},request=>{
   if(request.headers.authorization!==undefined)throw new AuthFailure('CONNECTOR_CREDENTIAL_SCOPE_DENIED',403);
   return protocol.exchange(request.params.cid,request.params.gid,request.body,request.signal);
  });
  routes.get<{Params:{cid:string;gid:string}}>('/api/v1/connectors/:cid/source-read-grants/:gid/permit',{handlerTimeout:10000},request=>protocol.permit(request.params.cid,request.params.gid,sourceReadCredential(request),request.signal));
  routes.post<{Params:{cid:string;gid:string}}>('/api/v1/connectors/:cid/source-read-grants/:gid/reports',{bodyLimit:1024*1024,handlerTimeout:10000},request=>protocol.report(request.params.cid,request.params.gid,sourceReadCredential(request),request.body,request.signal));
 });
 // HUMAN 조회는 기존 현재 로그인 transaction만 소비한다. connector bearer의 fallback이 아니다.
 app.register(async routes=>{
  routes.addHook('onRequest',async request=>{if(request.headers.host!==origin.host||request.headers.origin!==undefined&&request.headers.origin!==options.origin)throw new AuthFailure('ORIGIN_INVALID',403);});
  routes.get<{Params:{pid:string};Querystring:Record<string,unknown>}>('/api/v1/projects/:pid/source-read-grants',request=>options.repository.authenticated(humanToken(request),null,(db,actor)=>records.list(db,actor,request.params.pid,request.query,codec)));
  routes.get<{Params:{pid:string;gid:string}}>('/api/v1/projects/:pid/source-read-grants/:gid',request=>{
   if(Object.keys(request.query as object).length)throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
   return options.repository.authenticated(humanToken(request),null,(db,actor)=>records.read(db,actor,request.params.pid,request.params.gid));
  });
  routes.get<{Params:{pid:string;sid:string}}>('/api/v1/projects/:pid/source-snapshots/:sid/versions/1',request=>{
   if(Object.keys(request.query as object).length)throw new AuthFailure('SOURCE_READ_INPUT_INVALID',422);
   return options.repository.authenticated(humanToken(request),null,(db,actor)=>records.readSnapshot(db,actor,request.params.pid,request.params.sid));
  });
 });
}
