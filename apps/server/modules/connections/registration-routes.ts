import type {FastifyInstance} from 'fastify';
import type {AccessRoutesOptions} from '../access/routes.ts';
import {AuthFailure} from '../access/repository.ts';
import {parseWireJson} from '../../../../contracts/canonical.ts';
import {registrationStatusCredential} from '../../http/connector-auth.ts';
import {ConnectorRegistrationProtocol} from './registration-protocol.ts';

export function registerConnectorRegistrationRoutes(app:FastifyInstance,options:AccessRoutesOptions){
 const protocol=new ConnectorRegistrationProtocol(options.repository),host=new URL(options.origin).host;
 app.register(async routes=>{
  routes.removeContentTypeParser('application/json');routes.addContentTypeParser('application/json',{parseAs:'string'},(_request,body,done)=>{try{done(null,parseWireJson(String(body)));}catch{done(Object.assign(Error('INPUT_INVALID'),{statusCode:400}),undefined);}});
  routes.addHook('onRequest',async request=>{if(request.headers.host!==host||request.headers.origin!==undefined&&request.headers.origin!==options.origin)throw new AuthFailure('ORIGIN_INVALID',403);});
  routes.post('/api/v1/connectors/enroll',{bodyLimit:16384},request=>protocol.enroll(request.body));
  routes.post<{Params:{id:string}}>('/api/v1/connectors/registrations/:id/proof',{bodyLimit:16384},request=>protocol.prove(request.params.id,request.body));
  routes.post<{Params:{id:string}}>('/api/v1/connectors/registrations/:id/exchange',{bodyLimit:16384},request=>protocol.exchange(request.params.id,request.body));
  routes.get<{Params:{id:string}}>('/api/v1/connectors/:id/registration-status',request=>{const token=registrationStatusCredential(request);if(Object.keys(request.query as object).length)throw new AuthFailure('CONNECTOR_PROTOCOL_INPUT_INVALID',422);return protocol.status(request.params.id,token);});
 });
}
