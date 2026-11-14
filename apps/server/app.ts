import type {NormalGrantRevocationOptions} from './modules/executions/normal-grant-revocation.ts';
import {types} from 'node:util';
import {NativeWorkerDeploymentStore} from './modules/executions/native-worker-deployment-store.ts';
import {createNativeWorkerDeploymentOwnershipBasisSource} from './modules/executions/native-worker-ownership-basis-source.ts';
import {ProjectNativePreparations} from './modules/executions/project-native-preparations.ts';
import {registerNormalExchangeChallenge,type NormalExchangeOptions} from './modules/executions/normal-exchange-challenge.ts';
import {registerWorkerDeploymentRoutes,type WorkerDeploymentReadSource} from './modules/executions/native-worker-deployment-routes.ts';
import {registerNormalCredentialExchange,type NormalCredentialExchangeOptions} from './modules/executions/normal-credential-exchange.ts';
import {registerNativeFirstReceiveRoutes,type NativeFirstReceiveRoutesOptions} from './modules/executions/native-first-receive-routes.ts';
import {NativeFirstReceiveService} from './modules/executions/native-first-receive-service.ts';
import {registerCommonSetupRoutes} from './modules/user-common-setup/routes.ts';
import type {DocumentSourceObservationPort} from './modules/documents/document-source-observation.ts';
import {registerDesktopRuntimeCatalogue,type RuntimeCatalogueReadSource} from './modules/runtime-catalogue/desktop-runtime-catalogue-routes.ts';
import {registerNativePreparationRoutes,type NativePreparationRoutesOptions} from './modules/executions/native-preparation-routes.ts';
import {registerWriterAuthorityRoutes,type WriterAuthorityRoutesOptions} from './modules/executions/project-writer-authority-routes.ts';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { readFile } from 'node:fs/promises';
import type { ServerOptions as HttpsOptions } from 'node:https';
import { registerAccessRoutes, type AccessRoutesOptions } from './modules/access/routes.ts';
import { AuthFailure } from './modules/access/repository.ts';
import { registerProjectRoutes } from './modules/projects/routes.ts';
import { registerDocumentRoutes } from './modules/documents/routes.ts';
import { registerMethodologyRoutes } from './modules/methodologies/routes.ts';
import { registerCommonMethodologyWrites } from './modules/methodologies/common-write.ts';
import { registerProjectFileRoutes } from './modules/documents/project-files.ts';
import { enforceConnectorCredentialScope } from './http/connector-auth.ts';
import { readPacket, registerNormalCommandPages, type NormalCommandPagesOptions } from './modules/executions/normal-command-pages.ts';
import { registerNormalStartMaterials, type NormalStartMaterialsOptions } from './modules/executions/normal-start-materials.ts';
import { RegisteredStartContextSource, type RegisteredStartContextOptions } from './modules/executions/normal-start-context-source.ts';
import { registerNormalStartPermit, type NormalStartPermitOptions } from './modules/executions/normal-start-permit.ts';
import { registerNormalObservations, type NormalObservationsOptions } from './modules/executions/normal-observations.ts';
import { registerConnectorRegistrationRoutes } from './modules/connections/registration-routes.ts';
import { registerSourceReadRoutes } from './modules/connections/source-read-routes.ts';
import type {NormalExecutionCurrentSource} from './modules/executions/normal-initial-execution.ts';
import type {SyntheticHumanExecutionPorts} from './modules/executions/project-runtime-commands.ts';
import {registerProviderClaimHistoryRoutes} from './modules/executions/provider-session-claim-history-routes.ts';
import {registerUnderstandingHistoryRoutes} from './modules/executions/understanding-history-routes.ts';
import { registerControlHandoffRoutes, type ControlHandoffRoutesOptions } from './modules/control-handoff/routes.ts';

/** 명시 내부 ownership 조립이며 공개 GET reader는 이 권위를 대신하지 않는다. */
export interface NativeWorkerOwnershipOptions {store:NativeWorkerDeploymentStore}
const connectOwnership=ProjectNativePreparations.prototype.connectNativeOwnershipReturn;

export function buildApp(options: FastifyServerOptions & { https?: HttpsOptions } = {}, webRoot?: URL, access?: AccessRoutesOptions, syntheticExecution?:SyntheticHumanExecutionPorts, controlHandoff?: ControlHandoffRoutesOptions, writerAuthority?:WriterAuthorityRoutesOptions,nativePreparation?:NativePreparationRoutesOptions,runtimeCatalogue:RuntimeCatalogueReadSource|null=null,documentObservation?:DocumentSourceObservationPort,nativeReceive?:NativeFirstReceiveRoutesOptions, normalExecution?:NormalExecutionCurrentSource, normalExchange?:NormalExchangeOptions, normalCredentialExchange?:NormalCredentialExchangeOptions,normalRequestChallenge?:{origin:string},normalPages?:NormalCommandPagesOptions,normalMaterials?:NormalStartMaterialsOptions & { registeredContext?: RegisteredStartContextOptions },normalPermit?:NormalStartPermitOptions,normalObservations?:NormalObservationsOptions,workerDeployment:WorkerDeploymentReadSource|null=null,nativeOwnership?:NativeWorkerOwnershipOptions,normalGrantRevocation?:NormalGrantRevocationOptions) {
  if(normalGrantRevocation!==undefined){
    if(!normalGrantRevocation||types.isProxy(normalGrantRevocation)||![Object.prototype,null].includes(Object.getPrototypeOf(normalGrantRevocation)))throw Error('NORMAL_REVOCATION_CONFIGURATION_INVALID');
    const fields=Object.getOwnPropertyDescriptors(normalGrantRevocation);
    if(Reflect.ownKeys(fields).length!==1||!fields.mode||!('value' in fields.mode)||!fields.mode.enumerable||fields.mode.value!=='NORMAL_PROTECTED'||!access||syntheticExecution)throw Error('NORMAL_REVOCATION_CONFIGURATION_INVALID');
    normalGrantRevocation=Object.freeze({mode:'NORMAL_PROTECTED'});
  }
  if(nativeOwnership!==undefined){
    if(!nativeOwnership||types.isProxy(nativeOwnership)||![Object.prototype,null].includes(Object.getPrototypeOf(nativeOwnership)))throw Error('NATIVE_OWNERSHIP_CONFIGURATION_INVALID');
    const fields=Object.getOwnPropertyDescriptors(nativeOwnership),preparations=nativePreparation?.preparations;
    if(Reflect.ownKeys(fields).length!==1||!fields.store||!('value' in fields.store)||!fields.store.enumerable||nativePreparation?.enabled!==true||
      !preparations||types.isProxy(preparations)||!(preparations instanceof ProjectNativePreparations)||
      preparations.connectNativeOwnershipReturn!==connectOwnership||ProjectNativePreparations.prototype.connectNativeOwnershipReturn!==connectOwnership)throw Error('NATIVE_OWNERSHIP_CONFIGURATION_INVALID');
    const store=fields.store.value;if(!store)throw Error('NATIVE_OWNERSHIP_CONFIGURATION_INVALID');
    const basis=createNativeWorkerDeploymentOwnershipBasisSource(store);
    connectOwnership.call(preparations,basis);
  }
  const app = Fastify({ ...options, logger: false, bodyLimit: 2 * 1024 * 1024, ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } } });
  app.addHook('onRequest',async request=>enforceConnectorCredentialScope(request));
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    return payload;
  });
  if(normalPages)registerNormalCommandPages(app,normalPages);
  if(normalMaterials){
    if(normalMaterials.context && normalMaterials.registeredContext)throw Error('EXECUTION_CONTEXT_SOURCE_AMBIGUOUS');
    const context=normalMaterials.registeredContext?new RegisteredStartContextSource(normalMaterials.registeredContext):normalMaterials.context;
    registerNormalStartMaterials(app,{...normalMaterials,context},readPacket);
  }
  if(normalPermit)registerNormalStartPermit(app,normalPermit,readPacket);
  if(normalObservations)registerNormalObservations(app,normalObservations,readPacket);
  if(normalRequestChallenge&&!normalExchange)throw Error('EXECUTION_CHALLENGE_STORE_REQUIRED');
  if(normalExchange)registerNormalExchangeChallenge(app,normalExchange,normalRequestChallenge);
  if(normalCredentialExchange)registerNormalCredentialExchange(app,normalCredentialExchange);
  registerDesktopRuntimeCatalogue(app,runtimeCatalogue);
  registerWorkerDeploymentRoutes(app,workerDeployment);
  app.get('/api/v1/health', async () => ({ status: 'ok', scope: 'process', version: '0.1.0' }));
  if (access) { registerAccessRoutes(app, access); registerProjectRoutes(app, access, syntheticExecution,documentObservation,normalExecution,normalGrantRevocation); registerDocumentRoutes(app, access); registerMethodologyRoutes(app, access); registerCommonMethodologyWrites(app, access); registerCommonSetupRoutes(app,access); registerProjectFileRoutes(app, access); registerConnectorRegistrationRoutes(app,access); registerSourceReadRoutes(app,access); registerProviderClaimHistoryRoutes(app,access); }
  if(access)registerUnderstandingHistoryRoutes(app,access,syntheticExecution?.understandingHistory);
  if(nativePreparation?.enabled===true)registerNativePreparationRoutes(app,nativePreparation,access);
  if(nativeReceive?.enabled===true){if(nativeReceive.service instanceof NativeFirstReceiveService&&nativePreparation?.preparations)nativeReceive.service.connectNativeCommand(nativePreparation.preparations);registerNativeFirstReceiveRoutes(app,nativeReceive,access);}
  else if(access){const service=new NativeFirstReceiveService(access.repository,undefined,Date.now,nativePreparation?.preparations??null,undefined,access.origin);if(nativePreparation?.preparations)service.connectNativeCommand(nativePreparation.preparations);registerNativeFirstReceiveRoutes(app,{enabled:true,service},access);}
  if(writerAuthority?.enabled===true)registerWriterAuthorityRoutes(app,writerAuthority,access);
  if (controlHandoff?.enabled === true) registerControlHandoffRoutes(app, controlHandoff);
  if (webRoot) {
    app.get('/', async (_request, reply) => reply.type('text/html; charset=utf-8').send(await readFile(new URL('index.html', webRoot))));
    app.get<{ Params: { name: string } }>('/assets/:name', async (request, reply) => {
      const { name } = request.params;
      if (!/^[a-zA-Z0-9_-]+\.(js|css)$/.test(name)) return reply.callNotFound();
      try {
        const body = await readFile(new URL('assets/' + name, webRoot));
        return reply.type(name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8').send(body);
      } catch { return reply.callNotFound(); }
    });
  }
  app.setNotFoundHandler((request, reply) => reply.code(404).send({
    code: 'NOT_FOUND', message: '대상을 찾을 수 없습니다', requestId: request.id,
    targetId: null, retryDisposition: 'not-retryable', details: {},
  }));
  app.setErrorHandler((error, request, reply) => {
    const declared = typeof error === 'object' && error !== null && 'statusCode' in error ? Number(error.statusCode) : 0;
    const status = declared >= 400 && declared < 500 ? declared : 503;
    return reply.code(status).send({
      code: error instanceof AuthFailure ? error.message : status === 413 ? 'PAYLOAD_TOO_LARGE' : status >= 500 ? 'STORAGE_FAILED' : 'INPUT_INVALID',
      message: '요청을 처리하지 못했습니다', requestId: request.id, targetId: null,
      retryDisposition: status >= 500 ? 'reconcile-first' : 'not-retryable', details: {},
    });
  });
  return app;
}
