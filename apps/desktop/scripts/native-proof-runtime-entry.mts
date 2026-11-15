import { NormalProtectedGetClient, type NormalProtectedGetOptions } from '../../connector/runtime/normal-protected-get-client.ts';
import { NormalProtectedPostClient } from '../../connector/runtime/normal-protected-post-client.ts';
import { NormalOwnedCredentialPort } from '../../connector/runtime/normal-credential-bootstrap-client.ts';
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
