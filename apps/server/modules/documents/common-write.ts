import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistCommonReceipt, type UserCommonCommand } from '../access/common-command.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { validateCustomForm } from './form-validation.ts';
import type { FormDefinition } from './forms.ts';

function keys(value: Record<string, unknown>, expected: string[]) {
  if (Object.keys(value).length !== expected.length || !expected.every(key => Object.hasOwn(value, key))) throw new AuthFailure('INPUT_INVALID', 400);
}
function text(value: unknown, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AuthFailure('INPUT_INVALID', 400);
  return value;
}
export async function writeCommonForm(db: PoolClient, actor: AuthenticatedIdentity, request: UserCommonCommand) {
  const payload = request.payload, reason = text(payload.reason, 20_000);
  let id = request.targetId, version: number, definition: FormDefinition, origin: object;
  if (request.operation === 'copyForm') {
    keys(payload, ['sourceRef', 'name', 'scope', 'reason']);
    if (payload.scope !== 'USER_COMMON' || id !== null || request.expectedVersion !== 0 || !isVersionRef(payload.sourceRef)) throw new AuthFailure('INPUT_INVALID', 400);
    const ref = payload.sourceRef;
    const source = (await db.query("SELECT v.definition_json,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.id=$1 AND v.version=$2 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3)", [ref.id, ref.version, actor.actorId])).rows[0];
    if (!source) throw new AuthFailure('NOT_FOUND', 404);
    if (source.content_hash !== ref.contentHash || contentHash(canonicalJson(source.definition_json)) !== ref.contentHash) throw new AuthFailure('SOURCE_VERSION_CONFLICT', 409);
    definition = { ...source.definition_json, scope: 'USER_COMMON', name: text(payload.name) };
    id = randomUUID(); version = 1; origin = { kind: 'COPY', parentRef: ref, reason };
  } else {
    keys(payload, ['definition', 'reason']); definition = payload.definition as FormDefinition;
    if (id === null) {
      if (request.expectedVersion !== 0) throw new AuthFailure('VERSION_CONFLICT', 409);
      id = randomUUID(); version = 1; origin = { kind: 'USER_AUTHORED', reason };
    } else {
      const current = (await db.query("SELECT d.scope,d.head_version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=d.head_version WHERE d.id=$1 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$2) FOR UPDATE OF d", [id, actor.actorId])).rows[0];
      if (!current) throw new AuthFailure('NOT_FOUND', 404);
      if (current.scope !== 'USER_COMMON') throw new AuthFailure('SYSTEM_IMMUTABLE', 403);
      const head = Number(current.head_version);
      if (!Number.isSafeInteger(head) || head >= Number.MAX_SAFE_INTEGER) throw new AuthFailure('VERSION_LIMIT', 412);
      if (head !== request.expectedVersion) throw new AuthFailure('VERSION_CONFLICT', 409);
      version = head + 1; origin = { kind: 'REVISION', parentRef: { id, version: head, contentHash: current.content_hash }, reason };
    }
  }
  const validation = validateCustomForm(definition);
  if (validation.issues.some(issue => issue.code === 'INPUT_INVALID')) throw new AuthFailure('FORM_INPUT_INVALID', 422);
  const standard = definition.authoringStandardRef;
  if (!(await db.query('SELECT 1 FROM anvil.authoring_standard_versions WHERE id=$1 AND version=$2 AND content_hash=$3', [standard.id, standard.version, standard.contentHash])).rowCount) throw new AuthFailure('AUTHORING_STANDARD_INVALID', 422);
  text(definition.name); text(definition.formCode); // 정의의 식별 메타데이터는 비어 있는 상태로 만들지 않는다.
  await db.query("SELECT set_config('anvil.actor_id',$1,true)", [actor.actorId]);
  if (version === 1) await db.query("INSERT INTO anvil.form_definitions(id,scope,owner_user_id,form_code,name,head_version) VALUES($1,'USER_COMMON',$2,$3,$4,1)", [id, actor.actorId, definition.formCode, definition.name]);
  const hash = contentHash(canonicalJson(definition));
  await db.query('INSERT INTO anvil.form_versions(definition_id,version,definition_json,content_hash,authoring_standard_id,authoring_standard_version,authoring_standard_hash,authoring_standard_ref,origin_ref_json,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [id, version, JSON.stringify(definition), hash, standard.id, standard.version, standard.contentHash, JSON.stringify(standard), JSON.stringify(origin), actor.actorId]);
  if (version > 1) await db.query('UPDATE anvil.form_definitions SET head_version=$2,name=$3,form_code=$4 WHERE id=$1', [id, version, definition.name, definition.formCode]);
  return persistCommonReceipt(db, actor, request, { id, version, contentHash: hash }, validation);
}
