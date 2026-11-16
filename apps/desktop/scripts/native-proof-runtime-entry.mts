import { NormalProtectedGetClient, type NormalProtectedGetOptions } from '../../connector/runtime/normal-protected-get-client.ts';
import { NormalProtectedPostClient } from '../../connector/runtime/normal-protected-post-client.ts';
import { OwnedSpoolRuntime } from '../../connector/runtime/normal-owned-spool-profile.ts';
import { NormalCredentialBootstrapClient, type NormalOwnedHostFactory, NormalOwnedCredentialPort } from '../../connector/runtime/normal-credential-bootstrap-client.ts';
import { cloneV1, recordV1, refV1, type RuntimeRefV1 } from '../../../contracts/runtime/validation-v1.ts';
import { canonicalJson } from '../../../contracts/canonical.ts';
import { NormalStartCoordinator, type NormalStartPorts } from '../../connector/runtime/normal-start-coordinator.ts';
import { NormalStartIntake, type NormalStartStore } from '../../connector/runtime/normal-start-intake.ts';
import { NormalObservationSpool } from '../../connector/runtime/normal-observation-spool.ts';
import { NormalStartPolling, type NormalPollingClients } from '../../connector/runtime/normal-start-polling.ts';
import { isProxy } from 'node:util/types';

const pairs = new WeakMap<NormalPollingClients, { port: NormalOwnedCredentialPort; scope: NormalProtectedGetOptions['scope'] }>();
const getMethods = ['prepareCommandPage','prepareMaterial','send'] as const;
const postMethods = ['preparePermit','prepareObservations','send'] as const;
const originalGet = getMethods.map(name => NormalProtectedGetClient.prototype[name]);
const originalPost = postMethods.map(name => NormalProtectedPostClient.prototype[name]);

function checkClients(pair: NormalPollingClients) {
  if (Object.getPrototypeOf(pair.get) !== NormalProtectedGetClient.prototype || Object.getPrototypeOf(pair.post) !== NormalProtectedPostClient.prototype ||
      getMethods.some((name,i) => Object.hasOwn(pair.get,name) || Object.getOwnPropertyDescriptor(NormalProtectedGetClient.prototype,name)?.value !== originalGet[i]) ||
      postMethods.some((name,i) => Object.hasOwn(pair.post,name) || Object.getOwnPropertyDescriptor(NormalProtectedPostClient.prototype,name)?.value !== originalPost[i])) throw Error('NORMAL_POLL_CLIENTS_CHANGED');
}

const matches = NormalOwnedCredentialPort.prototype.matches;
export function createNormalProtectedClientPair(options: Omit<NormalProtectedGetOptions, 'credential'>, port: NormalOwnedCredentialPort, now: () => number) {
  if (!recordV1(options, ['origin','ca','scope','credentialExpiresAt']) || typeof now !== 'function' ||
      !(port instanceof NormalOwnedCredentialPort) || !matches.call(port, options.origin, options.scope, options.credentialExpiresAt, options.ca)) {
    throw Error('NORMAL_CLIENT_PAIR_INVALID');
  }
  const ports = { protectedCredential: port, now };
  const pair = Object.freeze({ get: new NormalProtectedGetClient(options, ports), post: new NormalProtectedPostClient(options, ports), expiresAt: options.credentialExpiresAt });
  pairs.set(pair, {port,scope:cloneV1(options.scope)});
  return pair;
}

interface StartPollingInput {
  intakeStore: NormalStartStore;
  journalStore: NormalStartPorts['store'];
  expected: ConstructorParameters<typeof NormalStartIntake>[1];
  current: NormalStartPorts['current'];
  wire: NormalStartPorts['wire'];
  timeoutMs: number; deadline: number; maxPages: number; idleMs: number;
}

export function createNormalStartPolling(pair: NormalPollingClients, port: NormalOwnedCredentialPort, registration: RuntimeRefV1,
  input: StartPollingInput, now: () => number, renew: (previous: NormalPollingClients, signal: AbortSignal) => Promise<NormalPollingClients>) {
  const saved = pairs.get(pair);
  if (!saved || saved.port !== port || typeof now !== 'function' || typeof renew !== 'function' || !refV1(registration) ||
      isProxy(input) || !recordV1(input,['intakeStore','journalStore','expected','current','wire','timeoutMs','deadline','maxPages','idleMs'])) throw Error('NORMAL_POLL_CONFIG_INVALID');
  const {scope} = saved, expected = cloneV1(input.expected);
  if (!recordV1(expected,['context','executorRegistrationRef']) || canonicalJson(expected.executorRegistrationRef) !== canonicalJson(registration) ||
      expected.context?.projectId !== scope.projectId || expected.context.executionId !== scope.executionId ||
      expected.context.executionGeneration !== scope.executionGeneration || now() >= Date.parse(pair.expiresAt)) throw Error('NORMAL_POLL_SCOPE_INVALID');

  let active = pair;
  const clock = () => { checkClients(active); return now(); };
  const intake = new NormalStartIntake(input.intakeStore,expected,clock);
  const spool = new NormalObservationSpool(input.journalStore,{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration},clock);
  const start = {intake,spool,store:input.journalStore,current:input.current,wire:input.wire,grantRef:scope.grantRef,timeoutMs:input.timeoutMs,clock};
  // 최초 page 전에 기존 생성자의 포트 검사를 적용한다. 생성자는 I/O를 시작하지 않는다.
  new NormalStartCoordinator({...start,post:pair.post});
  checkClients(pair);
  const polling = new NormalStartPolling({clients:pair,start,deadline:input.deadline,maxPages:input.maxPages,idleMs:input.idleMs,
    owner:() => { clock(); return registration.id; },
    renew:async (previous,signal) => {
      if (previous.get !== active.get || previous.post !== active.post || previous.expiresAt !== active.expiresAt) throw Error('NORMAL_OWNED_PREDECESSOR');
      const next = await renew(active,signal);
      if (!pairs.has(next) || canonicalJson(pairs.get(next)!.scope) !== canonicalJson(scope)) throw Error('NORMAL_POLL_SCOPE_INVALID');
      checkClients(next); active = next; return next;
    }});
  return Object.freeze({run:(signal: AbortSignal) => polling.run(signal),renew:(signal: AbortSignal) => polling.renew(signal)});
}

/** Trusted desktop owner hands in the original REGISTERED host. No path, file store or lease escapes this assembly. */
export function createOwnedSpoolController(host: NormalOwnedHostFactory, attempt: string, ownerSignal: AbortSignal,
  registration: RuntimeRefV1, projectId: string, now: () => number,
  options: Omit<NormalProtectedGetOptions, 'credential'|'credentialExpiresAt'> | null) {
  let latest: {port: NormalOwnedCredentialPort; pair: NormalPollingClients} | null = null;
  const service = new OwnedSpoolRuntime(host,attempt,now,ownerSignal,()=>latest?.port.metadata ?? null);
  if (!options) {
    return Object.freeze({receive:(...args: Parameters<OwnedSpoolRuntime['receive']>) => {
      const [limits,input,expected,signal]=args,context=cloneV1(expected);
      if(context?.context.projectId!==projectId||canonicalJson(context.executorRegistrationRef)!==canonicalJson(registration)||ownerSignal.aborted)
        throw Error('NORMAL_SPOOL_SCOPE_INVALID');
      return service.receive(cloneV1(limits),cloneV1(input),context,signal);
    }});
  }
  const config=cloneV1(options);
  if (!config.ca || config.scope.projectId!==projectId || !refV1(registration)) throw Error('NORMAL_SPOOL_SCOPE_INVALID');
  const issuer=new NormalCredentialBootstrapClient({...config,ca:config.ca,attemptId:attempt},{host:service.credentialHost(),now});
  const bind=(port:NormalOwnedCredentialPort)=>{
    if(ownerSignal.aborted)throw Error('NORMAL_OWNED_PREDECESSOR');
    const pair=createNormalProtectedClientPair({...config,credentialExpiresAt:port.metadata.expiresAt},port,()=>{
      if(latest?.port!==port||ownerSignal.aborted)throw Error('NORMAL_OWNED_PREDECESSOR');
      return now();
    });
    latest={port,pair};return pair;
  };
  const renew=async(previous:NormalPollingClients,signal:AbortSignal)=>{
    if(ownerSignal.aborted||!latest||previous!==latest.pair)throw Error('NORMAL_OWNED_PREDECESSOR');
    return bind(await issuer.renew(latest.port,signal));
  };
  type WorkerInput=Omit<StartPollingInput,'intakeStore'|'journalStore'|'wire'>;
  type WireInput=WorkerInput&Pick<StartPollingInput,'wire'>;
  const assemble=(pair:NormalPollingClients,input:WorkerInput&Partial<Pick<StartPollingInput,'wire'>>,worker:boolean)=>{
    const fields=['expected','current','timeoutMs','deadline','maxPages','idleMs'];
    if(!latest||latest.pair!==pair||isProxy(input)||!recordV1(input,worker?fields:[...fields,'wire']))
      throw Error('NORMAL_POLL_CONFIG_INVALID');
    const {projectId,executionId,executionGeneration}=config.scope;
    const lifetime=new AbortController(),signal=AbortSignal.any([ownerSignal,lifetime.signal]);
    const store=service.journal({projectId,executionId,executionGeneration},signal);
    const current=input.current,currentMethod=current?.current;
    if(current?.transport!=='NORMAL_PROTECTED'||typeof currentMethod!=='function')throw Error('NORMAL_START_PORTS_REQUIRED');
    let active=pair,running=false;
    const clock=()=>service.external(()=>{
      if(latest?.pair!==active||signal.aborted||current.current!==currentMethod)throw Error('NORMAL_OWNED_PREDECESSOR');
      return now();
    });
    const wire=worker?service.workerWire(store,input.expected,current,config.scope.grantRef,clock,input.timeoutMs):input.wire;
    const send=wire?.send;
    if(wire?.transport!=='NORMAL_PROTECTED'||typeof send!=='function')throw Error('NORMAL_START_PORTS_REQUIRED');
    const checkedClock=()=>service.external(()=>{
      if(wire.send!==send)throw Error('NORMAL_WIRE_CHANGED');return clock();
    });
    const poll=createNormalStartPolling(pair,latest.port,registration,{...input,intakeStore:store.intake(),journalStore:store,current,wire},checkedClock,
      async(previous,signal)=>active=await renew(previous,signal));
    return Object.freeze({run:async(signal:AbortSignal)=>{
      if(running||signal.aborted||lifetime.signal.aborted)throw Error('NORMAL_POLL_UNAVAILABLE');running=true;
      const cancel=()=>lifetime.abort();signal.addEventListener('abort',cancel,{once:true});
      try{return await poll.run(signal);}finally{signal.removeEventListener('abort',cancel);running=false;}
    },renew:poll.renew});
  };
  return Object.freeze({
    bootstrap:async(signal:AbortSignal)=>bind(await issuer.bootstrap(signal)),renew,
    createStartPolling:(pair:NormalPollingClients,input:WireInput)=>assemble(pair,input,false),
    createWorkerStartPolling:(pair:NormalPollingClients,input:WorkerInput)=>assemble(pair,input,true)
  });
}

export { NativePreparationClient } from '../../connector/runtime/native-preparation-client.ts';
export { NativePreparationCredentialSlot } from '../../connector/runtime/native-preparation-credential-slot.ts';
export { NativePreparationHttpsChannel, restrictNativeProofSigningContext } from '../../connector/runtime/native-preparation-https.ts';
export { NativePreparationProofSigner } from '../../connector/runtime/native-preparation-proof-signer.ts';
export { readNativeAuthority } from '../../../contracts/runtime/native-preparation-authority-v1.ts';
export { readNativePreparationAuthority } from '../../../contracts/runtime/native-preparation-ownership-return-v1.ts';
export { NativePreparationOwnershipReturn } from '../../connector/runtime/native-preparation-ownership-return.ts';

export { NativeFirstReceiveHumanClient, NativeFirstReceiveFrameDecoder } from '../../connector/runtime/native-first-receive-client.ts';
export { NormalCredentialBootstrapClient } from '../../connector/runtime/normal-credential-bootstrap-client.ts';
export { NativePreparationProtectedJournal } from '../../connector/runtime/native-preparation-protected-journal.ts';

export { readWorkerDeploymentRead, readWorkerDeploymentBundle } from '../../../contracts/runtime/native-worker-deployment-v1.ts';
export { parseWireJson } from '../../../contracts/canonical.ts';
