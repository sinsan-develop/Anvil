import type { AccessRepository } from '../access/repository.ts';
import { AuthFailure } from '../access/repository.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { validateMethodologyGraph } from './service.ts';

export class MethodologiesRepository {
  access: AccessRepository;
  constructor(access: AccessRepository) { this.access = access; }
  async list(token: string, filters: { scope?: string; name?: string; status?: string }) {
    return this.access.authenticated(token, null, async (db, actor) => {
      const rows = (await db.query("SELECT d.id,d.scope,d.system_code,v.name,v.purpose,v.version,v.content_hash,EXISTS(SELECT 1 FROM anvil.methodology_reviews r WHERE r.definition_id=d.id AND r.version=v.version AND r.target_hash=v.content_hash AND r.decision='CONFIRMED') AS confirmed FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=d.head_version WHERE (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1) AND ($2::text IS NULL OR d.scope=$2) AND ($3::text IS NULL OR v.name ILIKE $3 ESCAPE '!') ORDER BY d.system_code NULLS LAST,d.id LIMIT 201", [actor.actorId, filters.scope ?? null, filters.name ? '%' + filters.name.replace(/[!%_]/g, char => '!' + char) + '%' : null])).rows;
      if (rows.length > 200) throw new AuthFailure('METHODOLOGY_PAGINATION_NOT_READY', 412);
      const items = rows.map(row => ({ ref: { id: row.id, version: Number(row.version), contentHash: row.content_hash }, name: row.name, purpose: row.purpose, scope: row.scope, systemCode: row.system_code,
        status: row.confirmed ? 'CONFIRMED' : 'DRAFT', sourceAvailable: row.scope === 'SYSTEM' }));
      return { items: filters.status ? items.filter(item => item.status === filters.status) : items, nextCursor: null, hasMore: false, observedAt: new Date().toISOString(), baselineVersion: null };
    });
  }
  async version(token: string, id: string, version: number) {
    return this.access.authenticated(token, null, async (db, actor) => {
      const row = (await db.query("SELECT v.*,d.scope,d.system_code FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id WHERE d.id=$1 AND v.version=$2 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3)", [id, version, actor.actorId])).rows[0];
      if (!row) throw new AuthFailure('NOT_FOUND', 404);
      if (contentHash(canonicalJson(row.graph_json)) !== row.content_hash) throw new AuthFailure('METHODOLOGY_INTEGRITY_FAILED', 503);
      const forms = (await db.query("SELECT v.definition_id AS id,v.version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1", [actor.actorId])).rows.map(form => ({ id: form.id, version: Number(form.version), contentHash: form.content_hash }));
      const confirmation = (await db.query("SELECT id,decision,decided_at FROM anvil.methodology_reviews WHERE definition_id=$1 AND version=$2 AND target_hash=$3 AND decision='CONFIRMED' ORDER BY decided_at DESC,id DESC LIMIT 1", [id, version, row.content_hash])).rows[0] ?? null;
      return { ref: { id, version, contentHash: row.content_hash }, name: row.name, purpose: row.purpose, scope: row.scope, systemCode: row.system_code,
        graph: row.graph_json, sourceApproval: row.origin_ref_json, reason: row.reason, createdAt: row.created_at.toISOString(), confirmation,
        validation: validateMethodologyGraph(row.graph_json, forms), runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' };
    });
  }
}
