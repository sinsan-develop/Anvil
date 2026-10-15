import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { AuthenticatedIdentity } from './repository.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';

export interface UserCommonCommand {
  schemaVersion: 1; commandId: string; operation: 'copyMethodology' | 'saveMethodologyDraft' | 'copyForm' | 'saveFormDraft';
  targetId: string | null; expectedVersion: number; clientId: string; payload: Record<string, unknown>;
}
// 호출자는 현재 인증·client·중복 명령과 해당 도메인 소유권을 같은 transaction에서 먼저 검사한다.
export async function persistCommonReceipt(db: PoolClient, actor: AuthenticatedIdentity, request: UserCommonCommand, ref: VersionRef, validation: { issues: { severity: string }[] }) {
  const commandId = randomUUID(), operationId = randomUUID(), receiptId = randomUUID(), requestHash = contentHash(canonicalJson(request));
  const receivedAt = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
  const result = { scopeKind: 'USER_COMMON', ownerUserId: actor.actorId, operationId, commandId: request.commandId, status: 'APPLIED', targetId: ref.id, version: ref.version,
    data: { ref, validation, status: 'DRAFT' }, evidenceRefs: [], warnings: validation.issues.filter(issue => issue.severity === 'WARNING'), serverReceivedAt: receivedAt };
  const scopeDigest = contentHash(canonicalJson({ scopeKind: 'USER_COMMON', ownerUserId: actor.actorId, clientId: actor.clientId, requestHash, targetRef: ref }));
  await db.query("INSERT INTO anvil.commands(id,scope_kind,scope_id,actor_id,client_id,operation,command_id,request_hash,operation_id,state,authorization_receipt_id,expected_version,result_ref,completed_at) VALUES($1,'USER_COMMON',$2,$2,$3,$4,$5,$6,$7,'APPLIED',$8,$9,$10,now())", [commandId, actor.actorId, actor.clientId, request.operation, request.commandId, requestHash, operationId, receiptId, request.expectedVersion, JSON.stringify(result)]);
  await db.query("INSERT INTO anvil.authorization_receipts(id,scope_kind,scope_id,command_id,subject_ref,scope_digest) VALUES($1,'USER_COMMON',$2,$3,$4,$5)", [receiptId, actor.actorId, commandId, JSON.stringify({ kind: 'HUMAN', userId: actor.actorId, clientId: actor.clientId }), scopeDigest]);
  await db.query("INSERT INTO anvil.user_common_audit_events(owner_user_id,server_sequence,event_id,client_id,command_id,operation_id,operation,target_ref,outcome,reason_code) SELECT $1,COALESCE(MAX(server_sequence),0)+1,$2,$3,$4,$5,$6,$7,'APPLIED','OWNED_USER_COMMON_ONLY' FROM anvil.user_common_audit_events WHERE owner_user_id=$1", [actor.actorId, randomUUID(), actor.clientId, commandId, operationId, request.operation, JSON.stringify(ref)]);
  return result;
}
