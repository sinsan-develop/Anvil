import type { AccessRepository } from '../access/repository.ts';
import { AuthFailure } from '../access/repository.ts';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import type { FormDefinition } from './forms.ts';
import { formContentReviewCriteria } from './content-review.ts';

export class FormsRepository {
  access: AccessRepository;
  constructor(access: AccessRepository) { this.access = access; }
  async list(token: string) {
    return this.access.authenticated(token, null, async (db, identity) => {
      const result = await db.query("SELECT d.id,d.scope,d.form_code,d.name,d.head_version,v.content_hash FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id AND v.version=d.head_version WHERE d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$1 ORDER BY d.form_code,d.id LIMIT 201", [identity.actorId]);
      // 사용자 양식 작성/목록 cursor 연결 전 잘린 목록을 완전한 결과로 표시하지 않는다.
      if (result.rows.length > 200) throw new AuthFailure('FORM_PAGINATION_NOT_READY', 412);
      return { items: result.rows.map(row => ({ ref: { id: row.id, version: Number(row.head_version), contentHash: row.content_hash }, formCode: row.form_code, name: row.name, scope: row.scope })),
        nextCursor: null, hasMore: false, observedAt: new Date().toISOString(), baselineVersion: null };
    });
  }
  async version(token: string, id: string, version: number) {
    return this.access.authenticated(token, null, async (db, identity) => {
      const row = (await db.query("SELECT v.definition_json,v.content_hash,s.id AS standard_id,s.version AS standard_version,s.content_hash AS standard_hash,s.body_utf8 FROM anvil.form_definitions d JOIN anvil.form_versions v ON v.definition_id=d.id JOIN anvil.authoring_standard_versions s ON s.id=v.authoring_standard_id AND s.version=v.authoring_standard_version AND s.content_hash=v.authoring_standard_hash WHERE d.id=$1 AND v.version=$2 AND (d.scope='SYSTEM' OR d.scope='USER_COMMON' AND d.owner_user_id=$3)", [id, version, identity.actorId])).rows[0];
      if (!row) throw new AuthFailure('NOT_FOUND', 404);
      const definition: FormDefinition = row.definition_json;
      if (contentHash(canonicalJson(definition)) !== row.content_hash || contentHash(row.body_utf8) !== row.standard_hash ||
        canonicalJson(definition.authoringStandardRef) !== canonicalJson({ id: row.standard_id, version: Number(row.standard_version), contentHash: row.standard_hash })) throw new AuthFailure('FORM_INTEGRITY_FAILED', 503);
      const reviews = (await db.query("SELECT r.id,r.criteria_version,r.items_json,r.outcome,r.reviewer_subject_ref,r.source_kind,r.reason,r.created_at,a.server_sequence FROM anvil.content_reviews r JOIN anvil.user_common_audit_events a ON a.owner_user_id=r.scope_id AND a.command_id=r.command_id WHERE r.scope_kind='USER_COMMON' AND r.scope_id=$1 AND r.target_kind='FORM' AND r.target_id=$2 AND r.target_version=$3 AND r.target_hash=$4 ORDER BY a.server_sequence DESC LIMIT 201", [identity.actorId, id, version, row.content_hash])).rows;
      if (reviews.length > 200) throw new AuthFailure('FORM_REVIEW_PAGINATION_NOT_READY', 412);
      const confirmation = (await db.query("SELECT r.id,r.decided_by,r.decided_at,r.review_refs FROM anvil.form_reviews r JOIN anvil.commands c ON c.id=r.command_id JOIN anvil.user_common_audit_events a ON a.command_id=c.id AND a.owner_user_id=c.scope_id WHERE r.definition_id=$1 AND r.version=$2 AND r.target_hash=$3 AND c.scope_kind='USER_COMMON' AND c.scope_id=$4 ORDER BY a.server_sequence DESC LIMIT 1", [id, version, row.content_hash, identity.actorId])).rows[0];
      return { ref: { id, version, contentHash: row.content_hash }, definition,
        authoringStandard: { ref: definition.authoringStandardRef, content: Buffer.from(row.body_utf8).toString('utf8') },
        contentReviewCriteria: formContentReviewCriteria,
        contentReviews: reviews.map(review => ({ ref: { id: review.id, criteriaVersion: Number(review.criteria_version), targetRef: { id, version, contentHash: row.content_hash }, outcome: review.outcome }, items: review.items_json, reviewer: review.reviewer_subject_ref, sourceKind: review.source_kind, reason: review.reason, reviewedAt: review.created_at.toISOString(), serverSequence: Number(review.server_sequence) })),
        confirmation: confirmation ? { id: confirmation.id, decidedBy: confirmation.decided_by, decidedAt: confirmation.decided_at.toISOString(), reviewRefs: confirmation.review_refs } : null,
        validation: { formatOnly: true, contentReview: reviews.length ? 'RECORDED' : 'NOT_PERFORMED', userAcceptance: confirmation ? 'CONFIRMED' : 'NOT_PERFORMED' } };
    });
  }
}
