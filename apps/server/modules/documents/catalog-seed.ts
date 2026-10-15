import type { Client, PoolClient } from 'pg';
import { canonicalJson } from '../../../../contracts/canonical.ts';
import type { OfficialCatalog } from './forms.ts';

// 호출자가 소유한 migration transaction 안에서만 실행한다. 기존 버전 덮어쓰기/자동 개정은 하지 않는다.
export async function seedOfficialForms(db: Client | PoolClient, catalog: OfficialCatalog): Promise<void> {
  const standard = catalog.standard;
  await db.query('INSERT INTO anvil.authoring_standard_versions(id,version,content_hash,body_utf8,source_approval_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id,version) DO NOTHING',
    [standard.ref.id, standard.ref.version, standard.ref.contentHash, standard.body, JSON.stringify({ kind: 'P01_APPROVED_SOURCE', approvalRecord: 'docs/04_test_reports/AV3/P01/REVIEW-02.md', formsSourceHash: catalog.sourceHash, productAcceptance: false })]);
  const prior = (await db.query('SELECT content_hash,body_utf8 FROM anvil.authoring_standard_versions WHERE id=$1 AND version=$2', [standard.ref.id, standard.ref.version])).rows[0];
  if (prior?.content_hash !== standard.ref.contentHash || !Buffer.from(prior.body_utf8).equals(standard.body)) throw Error('AUTHORING_STANDARD_SEED_CONFLICT');
  for (const { ref, definition } of catalog.forms) {
    await db.query("INSERT INTO anvil.form_definitions(id,scope,form_code,name,head_version) VALUES($1,'SYSTEM',$2,$3,$4) ON CONFLICT(id) DO NOTHING", [ref.id, definition.formCode, definition.name, ref.version]);
    await db.query('INSERT INTO anvil.form_versions(definition_id,version,definition_json,content_hash,authoring_standard_id,authoring_standard_version,authoring_standard_hash,origin_ref_json,authoring_standard_ref,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL) ON CONFLICT(definition_id,version) DO NOTHING',
      [ref.id, ref.version, canonicalJson(definition), ref.contentHash, standard.ref.id, standard.ref.version, standard.ref.contentHash,
        JSON.stringify({ kind: 'P01_APPROVED_SOURCE', sourcePath: 'docs/design/공식산출물_양식정의.md', sourceHash: catalog.sourceHash, productAcceptance: false }), canonicalJson(standard.ref)]);
    const saved = (await db.query('SELECT d.scope,d.owner_user_id,d.project_id,d.form_code,d.name,d.head_version,v.definition_json,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=$2 WHERE d.id=$1', [ref.id, ref.version])).rows[0];
    if (!saved || saved.scope !== 'SYSTEM' || saved.owner_user_id !== null || saved.project_id !== null || saved.form_code !== definition.formCode || saved.name !== definition.name || Number(saved.head_version) !== ref.version || saved.content_hash !== ref.contentHash || canonicalJson(saved.definition_json) !== canonicalJson(definition)) throw Error('OFFICIAL_FORM_SEED_CONFLICT');
  }
}
