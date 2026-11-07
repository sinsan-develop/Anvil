import type { PoolClient } from 'pg';
import type { DraftMethodSelection } from '../../../../contracts/project-drafts.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { AuthFailure } from '../access/repository.ts';
import { validateMethodologyGraph } from '../methodologies/service.ts';
import { builtinSourceHash } from '../methodologies/builtins.ts';

function object(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
async function source(db: PoolClient, owner: string, ref: VersionRef) {
  const row = (await db.query("SELECT d.scope,v.graph_json,v.content_hash,v.origin_ref_json FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3) FOR SHARE OF d", [ref.id, ref.version, owner])).rows[0];
  if (!row) throw new AuthFailure('NOT_FOUND', 404);
  if (row.content_hash !== ref.contentHash || contentHash(canonicalJson(row.graph_json)) !== ref.contentHash) throw new AuthFailure('SOURCE_VERSION_CONFLICT', 409);
  return row;
}
// 초안 선택은 원본을 보존하며 확정 사건·프로젝트·실행 권한을 만들지 않는다.
export async function selectDraftMethodology(db: PoolClient, owner: string, value: unknown): Promise<DraftMethodSelection | null> {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AuthFailure('METHODOLOGY_SELECTION_INVALID', 422);
  const selection = value as Record<string, unknown>;
  const forms = (await db.query("SELECT v.definition_id AS id,v.version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1", [owner])).rows.map(form => ({ id: form.id, version: Number(form.version), contentHash: form.content_hash }));
  if (selection.kind === 'CONFIRMED_REFERENCE') {
    if (!object(value, ['kind', 'versionRef']) || !isVersionRef(value.versionRef)) throw new AuthFailure('METHODOLOGY_SELECTION_INVALID', 422);
    const ref = value.versionRef, method = await source(db, owner, ref);
    if (!validateMethodologyGraph(method.graph_json, forms).validForConfirmation) throw new AuthFailure('METHODOLOGY_NOT_CONFIRMED', 422);
    if (method.scope === 'SYSTEM') {
      if (method.origin_ref_json?.kind !== 'P01_APPROVED_SOURCE' || method.origin_ref_json?.sourceHash !== builtinSourceHash || method.origin_ref_json?.productAcceptance !== false) throw new AuthFailure('METHODOLOGY_SOURCE_NOT_READY', 422);
    } else {
      const confirmation = await db.query("SELECT 1 FROM anvil.methodology_reviews r JOIN anvil.commands c ON c.id=r.command_id WHERE r.definition_id=$1 AND r.version=$2 AND r.target_hash=$3 AND r.decision='CONFIRMED' AND c.scope_kind='USER_COMMON' AND c.scope_id=$4", [ref.id, ref.version, ref.contentHash, owner]);
      const latest = (await db.query("SELECT r.outcome FROM anvil.content_reviews r JOIN anvil.user_common_audit_events a ON a.owner_user_id=r.scope_id AND a.command_id=r.command_id WHERE r.scope_kind='USER_COMMON' AND r.scope_id=$1 AND r.target_kind='METHODOLOGY' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 AND r.criteria_version=1 ORDER BY a.server_sequence DESC LIMIT 1", [owner, ref.id, ref.version, ref.contentHash])).rows[0];
      if (!confirmation.rowCount || latest?.outcome !== 'ACCEPTED') throw new AuthFailure('METHODOLOGY_NOT_CONFIRMED', 422);
    }
    return value as unknown as DraftMethodSelection;
  }
  if (!object(value, ['kind', 'name', 'purpose', 'graph', 'sourceRefs', 'reviewRefs']) || value.kind !== 'NEW_PROJECT_DRAFT' || typeof value.name !== 'string' || value.name.length > 200 || typeof value.purpose !== 'string' || value.purpose.length > 20_000
    || !Array.isArray(value.sourceRefs) || value.sourceRefs.length > 200 || !value.sourceRefs.every(isVersionRef) || !Array.isArray(value.reviewRefs)) throw new AuthFailure('METHODOLOGY_SELECTION_INVALID', 422);
  if (value.reviewRefs.length) throw new AuthFailure('DRAFT_REVIEW_CONNECTION_PENDING', 412);
  const validation = validateMethodologyGraph(value.graph, forms);
  if (validation.issues.some(issue => issue.code === 'INPUT_INVALID')) throw new AuthFailure('GRAPH_INPUT_INVALID', 422);
  for (const ref of value.sourceRefs) await source(db, owner, ref);
  return value as unknown as DraftMethodSelection;
}
