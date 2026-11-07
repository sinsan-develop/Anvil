import type { AccessRepository } from '../access/repository.ts';
import { AuthFailure } from '../access/repository.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { validateMethodologyGraph } from './service.ts';
import { methodContentReviewCriteria } from './content-review.ts';
import { methodListFilter, MethodListCodec } from './list-page.ts';

export class MethodologiesRepository {
  access: AccessRepository;
  #cursor: MethodListCodec;
  constructor(access: AccessRepository) { this.access = access; this.#cursor = new MethodListCodec(value => access.signMethodCursor(value)); }
  async list(token: string, raw: Record<string, unknown>) {
    return this.access.authenticated(token, null, async (db, actor) => {
      let filters: ReturnType<typeof methodListFilter>, last: { key: string; id: string } | undefined;
      try { filters = methodListFilter(raw); if (raw.cursor) last = this.#cursor.read(String(raw.cursor), actor.actorId, filters); }
      catch { throw new AuthFailure('CURSOR_OR_FILTER_INVALID', 400); }
      const rows = (await db.query("WITH visible AS (SELECT d.id,d.scope,d.system_code,COALESCE(d.system_code,'~') AS sort_key,v.name,v.purpose,v.version,v.content_hash,EXISTS(SELECT 1 FROM anvil.methodology_reviews r JOIN anvil.commands c ON c.id=r.command_id WHERE r.definition_id=d.id AND r.version=v.version AND r.target_hash=v.content_hash AND r.decision='CONFIRMED' AND c.scope_kind='USER_COMMON' AND c.scope_id=$1) AS confirmed FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id AND v.version=d.head_version WHERE (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1) AND ($2::text IS NULL OR d.scope=$2) AND ($3::text IS NULL OR v.name ILIKE $3 ESCAPE '!')) SELECT * FROM visible WHERE ($4::text IS NULL OR CASE WHEN confirmed THEN 'CONFIRMED' ELSE 'DRAFT' END=$4) AND ($5::text IS NULL OR (sort_key COLLATE \"C\",id)>($5::text COLLATE \"C\",$6::uuid)) ORDER BY sort_key COLLATE \"C\",id LIMIT $7", [actor.actorId, filters.scope, filters.name ? '%' + filters.name.replace(/[!%_]/g, char => '!' + char) + '%' : null, filters.status, last?.key ?? null, last?.id ?? null, filters.limit + 1])).rows;
      const hasMore = rows.length > filters.limit, page = rows.slice(0, filters.limit), tail = page.at(-1);
      const items = page.map(row => ({ ref: { id: row.id, version: Number(row.version), contentHash: row.content_hash }, name: row.name, purpose: row.purpose, scope: row.scope, systemCode: row.system_code,
        status: row.confirmed ? 'CONFIRMED' : 'DRAFT', sourceAvailable: row.scope === 'SYSTEM' }));
      return { items, nextCursor: hasMore && tail ? this.#cursor.create(actor.actorId, filters, { key: tail.sort_key, id: tail.id }) : null, hasMore, observedAt: new Date().toISOString(), baselineVersion: null };
    });
  }
  async version(token: string, id: string, version: number) {
    return this.access.authenticated(token, null, async (db, actor) => {
      const row = (await db.query("SELECT v.*,d.scope,d.system_code FROM anvil.methodology_definitions d JOIN anvil.methodology_versions v ON v.definition_id=d.id WHERE d.id=$1 AND v.version=$2 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3)", [id, version, actor.actorId])).rows[0];
      if (!row) throw new AuthFailure('NOT_FOUND', 404);
      if (contentHash(canonicalJson(row.graph_json)) !== row.content_hash) throw new AuthFailure('METHODOLOGY_INTEGRITY_FAILED', 503);
      const forms = (await db.query("SELECT v.definition_id AS id,v.version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1", [actor.actorId])).rows.map(form => ({ id: form.id, version: Number(form.version), contentHash: form.content_hash }));
      const reviews = (await db.query("SELECT r.id,r.criteria_version,r.items_json,r.outcome,r.reviewer_subject_ref,r.source_kind,r.reason,r.created_at,a.server_sequence FROM anvil.content_reviews r JOIN anvil.user_common_audit_events a ON a.owner_user_id=r.scope_id AND a.command_id=r.command_id WHERE r.scope_kind='USER_COMMON' AND r.scope_id=$1 AND r.target_kind='METHODOLOGY' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 ORDER BY a.server_sequence DESC LIMIT 201", [actor.actorId, id, version, row.content_hash])).rows;
      if (reviews.length > 200) throw new AuthFailure('METHOD_REVIEW_PAGINATION_NOT_READY', 412);
      const confirmed = (await db.query("SELECT r.id,r.decision,r.decided_by,r.decided_at,r.review_refs FROM anvil.methodology_reviews r JOIN anvil.commands c ON c.id=r.command_id JOIN anvil.user_common_audit_events a ON a.command_id=c.id AND a.owner_user_id=c.scope_id WHERE r.definition_id=$1 AND r.version=$2 AND r.target_hash=$3 AND r.decision='CONFIRMED' AND c.scope_kind='USER_COMMON' AND c.scope_id=$4 ORDER BY a.server_sequence DESC LIMIT 1", [id, version, row.content_hash, actor.actorId])).rows[0];
      const confirmation = confirmed ? { id: confirmed.id, decision: confirmed.decision, decidedBy: confirmed.decided_by, decided_at: confirmed.decided_at.toISOString(), reviewRefs: confirmed.review_refs } : null;
      return { ref: { id, version, contentHash: row.content_hash }, name: row.name, purpose: row.purpose, scope: row.scope, systemCode: row.system_code,
        graph: row.graph_json, sourceApproval: row.origin_ref_json, reason: row.reason, createdAt: row.created_at.toISOString(), confirmation,
        contentReviewCriteria: methodContentReviewCriteria,
        contentReviews: reviews.map(review => ({ ref: { id: review.id, criteriaVersion: Number(review.criteria_version), targetRef: { id, version, contentHash: row.content_hash }, outcome: review.outcome }, items: review.items_json, reviewer: review.reviewer_subject_ref, sourceKind: review.source_kind, reason: review.reason, reviewedAt: review.created_at.toISOString(), serverSequence: Number(review.server_sequence) })),
        validation: validateMethodologyGraph(row.graph_json, forms), runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED' };
    });
  }
}
