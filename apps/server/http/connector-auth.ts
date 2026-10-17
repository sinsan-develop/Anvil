import type {FastifyRequest} from 'fastify';
import {AuthFailure} from '../modules/access/repository.ts';

/** HUMAN cookie에 connector Bearer를 합쳐서 자료/명령 권한을 얻을 수 없다. */
export function enforceConnectorCredentialScope(request:FastifyRequest):void {
 const value=request.headers.authorization;
 if(typeof value!=='string'||!/^Bearer\s+av3ct1_/i.test(value.trim()))return;
 if(request.method!=='GET'||request.routeOptions.url!=='/api/v1/connectors/:id/registration-status')throw new AuthFailure('CONNECTOR_CREDENTIAL_SCOPE_DENIED',403);
}
export function registrationStatusCredential(request:FastifyRequest):string {
 const value=request.headers.authorization,match=typeof value==='string'?/^[Bb][Ee][Aa][Rr][Ee][Rr] (av3ct1_[A-Za-z0-9_-]{43})$/.exec(value):null;
 if(!match)throw new AuthFailure('CONNECTOR_CREDENTIAL_REQUIRED',401);return match[1]!;
}
