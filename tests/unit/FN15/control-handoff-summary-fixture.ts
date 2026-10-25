import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { createControlRequestSnapshot } from '../../../apps/server/modules/control-handoff/control-request-snapshot.ts';

export const projectId = '11111111-1111-4111-8111-111111111111';
export const otherProject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const requester = '22222222-2222-4222-8222-222222222222';
export const requesterClient = '33333333-3333-4333-8333-333333333333';
export const controller = '44444444-4444-4444-8444-444444444444';
export const controllerClient = '55555555-5555-4555-8555-555555555555';
export const now = '2026-10-25T09:00:00.000Z';
export const requestCreatedAt = '2026-10-25T08:45:00.000Z';
export const requestExpiresAt = '2026-10-25T09:00:20.000Z';
export const baseControl = { actorId: controller, clientId: controllerClient, generation: 5, version: 8 };
export const requestId = '66666666-6666-4666-8666-000000000001';
export const requestCommandId = '77777777-7777-4777-8777-000000000001';
export const prepareCommandId = '88888888-8888-4888-8888-000000000001';
export const evidenceRef = { id: '99999999-9999-4999-8999-000000000001', version: 2,
  contentHash: 'a'.repeat(64) };
export const copy = <T>(value: T): T => structuredClone(value);

export function requestBundle() {
  const payload = { targetActorRef: { userId: requester },
    targetClientRef: { userId: requester, clientId: requesterClient },
    baseControl: copy(baseControl), reason: '인수 요청 원문', expiresAt: requestExpiresAt };
  const command = { schemaVersion: 1 as const, operation: 'requestControl' as const,
    commandId: requestCommandId, projectId, clientId: requesterClient, payload };
  const made = createControlRequestSnapshot({ id: requestId, projectId,
    requestedBy: { actorId: requester, clientId: requesterClient },
    input: payload, createdAt: requestCreatedAt });
  const request = { ...made, metadata: { id: requestId, version: 1, projectId,
    requestedBy: { actorId: requester, clientId: requesterClient },
    targetActorRef: payload.targetActorRef, targetClientRef: payload.targetClientRef,
    baseControl: payload.baseControl, reason: payload.reason,
    createdAt: requestCreatedAt, expiresAt: requestExpiresAt } };
  const row = { schemaVersion: 1, operation: 'requestControl', commandId: requestCommandId,
    commandHash: contentHash(canonicalJson(command)), payloadHash: contentHash(canonicalJson(payload)),
    projectId, actorId: requester, clientId: requesterClient,
    baseControl: copy(baseControl), requestRef: made.requestRef, createdAt: requestCreatedAt };
  const linked = { schemaVersion: 1, commandId: requestCommandId,
    commandHash: row.commandHash, projectId, actorId: requester,
    clientId: requesterClient, requestRef: made.requestRef };
  return { request, command: row, receipts: [{ ...linked, outcome: 'REQUEST_STORED' }],
    audits: [{ ...linked, event: 'CONTROL_REQUEST_STORED' }] };
}

export interface FakeObservation {
  project: { id: string; archivedAt: string | null };
  access: { projectId: string; now: string;
    identity: { actorId: string; clientId: string; credentialGeneration: number;
      currentCredentialGeneration: number; sessionRevokedAt: string | null;
      idleExpiresAt: string; absoluteExpiresAt: string; userActive: boolean;
      userRevokedAt: string | null; clientUserId: string; clientRevokedAt: string | null;
      reauthUntil: string | null };
    member: { projectId: string; userId: string; participation: 'OWNER' | 'HANDOFF_ELIGIBLE';
      revokedAt: string | null };
    control: { projectId: string; actorId: string; clientId: string;
      generation: number; version: number; revokedAt: string | null } | null };
}

export function observation(actorId = controller, clientId = controllerClient): FakeObservation {
  return { project: { id: projectId, archivedAt: null },
    access: { projectId, now,
      identity: { actorId, clientId, credentialGeneration: 3, currentCredentialGeneration: 3,
        sessionRevokedAt: null, idleExpiresAt: '2026-10-25T10:00:00.000Z',
        absoluteExpiresAt: '2026-10-25T11:00:00.000Z', userActive: true,
        userRevokedAt: null, clientUserId: actorId, clientRevokedAt: null,
        reauthUntil: '2026-10-25T09:00:10.000Z' },
      member: { projectId, userId: actorId, participation: 'OWNER', revokedAt: null },
      control: { projectId, ...copy(baseControl), revokedAt: null } } };
}

export function prepareCommand(bundle = requestBundle()) {
  return { schemaVersion: 1, operation: 'prepareControlHandoff', commandId: prepareCommandId,
    projectId, clientId: controllerClient, payload: { requestRef: copy(bundle.request.requestRef) } };
}
