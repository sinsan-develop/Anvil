import type { Client, PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { OfficialForm } from '../documents/forms.ts';
import type { BuiltinMethodology } from '../../../../contracts/methodologies.ts';
import { validateMethodologyGraph } from './service.ts';

export async function seedBuiltinMethodologies(db: Client | PoolClient, methods: BuiltinMethodology[], forms: OfficialForm[]): Promise<void> {
  for (const method of methods) {
    if (!validateMethodologyGraph(method.graph, forms.map(form => form.ref)).validForConfirmation || contentHash(canonicalJson(method.graph)) !== method.contentHash) throw Error('BUILTIN_GRAPH_INVALID');
    await db.query("INSERT INTO anvil.methodology_definitions(id,scope,system_code,name,purpose,head_version) VALUES($1,'SYSTEM',$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING", [method.id, method.systemCode, method.name, method.purpose, method.version]);
    await db.query('INSERT INTO anvil.methodology_versions(definition_id,version,name,purpose,graph_json,content_hash,origin_ref_json,reason,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,NULL) ON CONFLICT(definition_id,version) DO NOTHING',
      [method.id, method.version, method.name, method.purpose, canonicalJson(method.graph), method.contentHash,
        JSON.stringify({ kind: 'P01_APPROVED_SOURCE', approvalRecord: 'docs/04_test_reports/AV3/P01/REVIEW-01.md', sourceHash: method.sourceHash, implementationRevision: method.version, productAcceptance: false }),
        'P01 승인 원문을 고정 양식/단계 자료로 구현. 프로젝트의 실제 검수/확정·실행 준비는 별도.']);
    const row = (await db.query('SELECT d.scope,d.system_code,d.owner_user_id,d.project_id,d.head_version,v.* FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1', [method.id, method.version])).rows[0];
    if (!row || row.scope !== 'SYSTEM' || row.system_code !== method.systemCode || row.owner_user_id !== null || row.project_id !== null || Number(row.head_version) !== method.version
      || row.name !== method.name || row.purpose !== method.purpose || row.content_hash !== method.contentHash || canonicalJson(row.graph_json) !== canonicalJson(method.graph)) throw Error('BUILTIN_SEED_CONFLICT');
    // 원문 승인 출처만 보존한다. 가짜 사용자·사람 검토/확정 사건을 만들지 않는다.
  }
}
