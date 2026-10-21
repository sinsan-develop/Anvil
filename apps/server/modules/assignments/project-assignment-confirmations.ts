import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { persistProjectReceipt, projectMember, type ProjectCommand } from '../access/project-command.ts';
import type { ProjectAssignmentDrafts } from './project-assignment-drafts.ts';
import { assertAssignmentRoot, readAssignmentDraftInput } from './assignment-input.ts';
import { assignmentContentCriteria, readAssignmentConfirmation, readAssignmentContentReview } from './assignment-confirmation-input.ts';

const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const commandColumns = ',c.result_ref,c.operation,c.state,c.expected_version,c.actor_id command_actor,c.client_id command_client ';
const reviewsSelect = 'SELECT r.*' + commandColumns + ',a.server_sequence,dv.created_by draft_author FROM anvil.assignment_content_reviews r JOIN anvil.commands c ON c.id=r.command_id AND c.project_id=r.project_id JOIN anvil.audit_events a ON a.command_id=c.id AND a.project_id=c.project_id AND a.outcome=\'APPLIED\' JOIN anvil.assignment_draft_versions dv ON dv.project_id=r.project_id AND dv.draft_id=r.draft_id AND dv.version=r.draft_version ';
const versionsSelect = 'SELECT v.*' + commandColumns + 'FROM anvil.assignment_versions v JOIN anvil.commands c ON c.id=v.command_id AND c.project_id=v.project_id ';
const uuid = (id: unknown) => isVersionRef({ id, version: 1, contentHash: '0'.repeat(64) });
const contentIssues = (issues: { code: string; location: string }[]) => issues.filter(issue => ['REQUIRED_TEXT_MISSING', 'REQUIRED_LIST_MISSING', 'SOURCE_SCOPE_MISSING', 'BASELINE_REFERENCE_MISSING'].includes(issue.code));

/** ProjectPolicyRepository.command transaction 내에서만 쓰며, 내용 확정은 실행 허가가 아니다. */
export class ProjectAssignmentConfirmations {
  readonly drafts: Pick<ProjectAssignmentDrafts, 'current' | 'read'>;
  constructor(drafts: Pick<ProjectAssignmentDrafts, 'current' | 'read'>) { this.drafts = drafts; }
  #envelope(request: ProjectCommand, operation: string, ref: VersionRef) {
    if (request.operation !== operation || request.targetId !== ref.id || request.expectedVersion !== ref.version) throw new AuthFailure('VERSION_CONFLICT', 409);
    if (request.approvalRef !== null || request.baselineRefs.length) throw new AuthFailure('ASSIGNMENT_APPROVAL_NOT_CONNECTED', 412);
  }
  #receipt(row: any, ref: VersionRef, snapshot: any, operation: string, status: string) {
    if (row.operation !== operation || row.state !== 'APPLIED' || row.command_actor !== row.created_by || row.command_client !== row.client_id || row.result_ref?.status !== 'APPLIED'
      || row.result_ref?.projectId !== row.project_id || row.result_ref?.data?.status !== status || !same(row.result_ref.data.ref, ref) || !same(row.result_ref.data.snapshot, snapshot)
      || contentHash(canonicalJson(snapshot)) !== ref.contentHash) throw Error();
  }
  #reviewView(row: any) {
    try {
      const ref = { id: row.review_id, version: 1, contentHash: row.content_hash }, snapshot = row.review_json;
      this.#receipt(row, ref, snapshot, 'reviewAssignmentContent', 'ASSIGNMENT_CONTENT_REVIEWED');
      const input = readAssignmentContentReview({ draftRef: snapshot.draftRef, criteriaVersion: snapshot.criteriaVersion, items: snapshot.items, outcome: snapshot.outcome, reason: snapshot.reason });
      if (!same(input.draftRef, { id: row.draft_id, version: Number(row.draft_version), contentHash: row.draft_hash }) || Number(row.expected_version) !== input.draftRef.version
        || !same(snapshot.reviewedBy, { kind: 'HUMAN', userId: row.created_by }) || !Number.isSafeInteger(Number(row.server_sequence)) || Number(row.server_sequence) < 1
        || typeof snapshot.reviewedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.reviewedAt)) || snapshot.independence !== 'NOT_CLAIMED' || !uuid(row.draft_author) || Object.keys(snapshot).sort().join(',') !== ['draftRef','criteriaVersion','items','outcome','reason','reviewedBy','reviewedAt','independence'].sort().join(',')) throw Error();
      return { ref, snapshot, serverSequence: Number(row.server_sequence), sameAuthor: row.created_by === row.draft_author };
    } catch { throw new AuthFailure('ASSIGNMENT_REVIEW_INTEGRITY_FAILED', 503); }
  }
  async #reviews(db: PoolClient, projectId: string, ref: VersionRef) {
    return (await db.query(reviewsSelect + 'WHERE r.project_id=$1 AND r.draft_id=$2 AND r.draft_version=$3 ORDER BY a.server_sequence DESC LIMIT 201', [projectId, ref.id, ref.version])).rows.map(row => this.#reviewView(row));
  }
  async #referencedReview(db: PoolClient, projectId: string, ref: VersionRef) {
    const row = (await db.query(reviewsSelect + 'WHERE r.project_id=$1 AND r.review_id=$2', [projectId, ref.id])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    const view = this.#reviewView(row);
    if (!same(ref, view.ref)) throw new AuthFailure('VERSION_CONFLICT', 409);
    return view;
  }
  async review(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const input = readAssignmentContentReview(request.payload); this.#envelope(request, 'reviewAssignmentContent', input.draftRef);
    const draft = await this.drafts.current(db, actor, request.projectId, input.draftRef);
    assertAssignmentRoot(draft.snapshot.definition);
    const at = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const snapshot = { ...input, reviewedBy: { kind: 'HUMAN', userId: actor.actorId }, reviewedAt: at, independence: 'NOT_CLAIMED' };
    const ref = { id: randomUUID(), version: 1, contentHash: contentHash(canonicalJson(snapshot)) };
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'ASSIGNMENT_CONTENT_REVIEWED', snapshot }, policyRef, 'EXPLICIT_ASSIGNMENT_CONTENT_REVIEW');
    await db.query('INSERT INTO anvil.assignment_content_reviews(project_id,review_id,draft_id,draft_version,draft_hash,content_hash,review_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [request.projectId, ref.id, input.draftRef.id, input.draftRef.version, input.draftRef.contentHash, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id]);
    return receipt.result;
  }
  async confirm(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const input = readAssignmentConfirmation(request.payload); this.#envelope(request, 'confirmAssignment', input.draftRef);
    const draft = await this.drafts.current(db, actor, request.projectId, input.draftRef);
    assertAssignmentRoot(draft.snapshot.definition);
    if ((await db.query(versionsSelect + 'WHERE v.project_id=$1 AND v.assignment_id=$2 AND v.version=$3', [request.projectId, input.draftRef.id, input.draftRef.version])).rows.length) throw new AuthFailure('VERSION_CONFLICT', 409);
    const analysis = readAssignmentDraftInput({ baseRef: draft.snapshot.previousRef ?? null, definition: draft.snapshot.definition, reason: draft.snapshot.reason ?? '내용 필수 검사' });
    if (contentIssues([...analysis.readinessIssues, ...draft.snapshot.readinessIssues]).length) throw new AuthFailure('ASSIGNMENT_CONTENT_INCOMPLETE', 422);
    const latest = (await this.#reviews(db, request.projectId, input.draftRef))[0];
    if (!latest || latest.snapshot.outcome !== 'ACCEPTED' || !same(latest.snapshot.draftRef, input.draftRef) || !input.reviewRefs.some(ref => same(ref, latest.ref))) throw new AuthFailure('ASSIGNMENT_REVIEW_REQUIRED', 422);
    for (const ref of input.reviewRefs) { const review = await this.#referencedReview(db, request.projectId, ref); if (!same(review.snapshot.draftRef, input.draftRef) || review.snapshot.outcome !== 'ACCEPTED') throw new AuthFailure('ASSIGNMENT_REVIEW_REQUIRED', 422); }
    const at = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const snapshot = { draftRef: input.draftRef, definition: draft.snapshot.definition, reviewRefs: input.reviewRefs, reason: input.reason, confirmedBy: { kind: 'HUMAN', userId: actor.actorId }, confirmedAt: at, contentConfirmed: true, readinessIssues: draft.snapshot.readinessIssues, ready: false, executionAuthorized: false, dispatchPerformed: false };
    if (Buffer.byteLength(canonicalJson(snapshot), 'utf8') > 2 * 1024 * 1024) throw new AuthFailure('ASSIGNMENT_CONFIRMATION_INPUT_INVALID', 422);
    const ref = { id: input.draftRef.id, version: input.draftRef.version, contentHash: contentHash(canonicalJson(snapshot)) }, confirmationId = randomUUID();
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'ASSIGNMENT_CONTENT_CONFIRMED', confirmationId, snapshot }, policyRef, 'EXPLICIT_ASSIGNMENT_CONTENT_ONLY');
    await db.query('INSERT INTO anvil.assignment_versions(project_id,assignment_id,version,content_hash,version_json,created_by,client_id,command_id,confirmation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [request.projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id, confirmationId]);
    return receipt.result;
  }
  async read(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    await projectMember(db, actor, projectId);
    if (!uuid(id) || !Number.isSafeInteger(version) || version < 1) throw new AuthFailure('INPUT_INVALID', 400);
    const row = (await db.query(versionsSelect + 'WHERE v.project_id=$1 AND v.assignment_id=$2 AND v.version=$3', [projectId, id, version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    try {
      const ref = { id, version, contentHash: row.content_hash }, snapshot = row.version_json;
      assertAssignmentRoot(snapshot.definition);
      this.#receipt(row, ref, snapshot, 'confirmAssignment', 'ASSIGNMENT_CONTENT_CONFIRMED');
      readAssignmentConfirmation({ draftRef: snapshot.draftRef, reviewRefs: snapshot.reviewRefs, reason: snapshot.reason, acknowledged: true });
      const draft = await this.drafts.read(db, actor, projectId, id, version);
      if (!uuid(row.confirmation_id) || row.result_ref.data.confirmationId !== row.confirmation_id || Number(row.expected_version) !== version || !same(snapshot.draftRef, draft.ref) || !same(snapshot.definition, draft.snapshot.definition) || !same(snapshot.readinessIssues, draft.snapshot.readinessIssues)
        || !same(snapshot.confirmedBy, { kind: 'HUMAN', userId: row.created_by }) || typeof snapshot.confirmedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.confirmedAt))
        || snapshot.contentConfirmed !== true || snapshot.ready !== false || snapshot.executionAuthorized !== false || snapshot.dispatchPerformed !== false || Object.keys(snapshot).length !== 11) throw Error();
      for (const reviewRef of snapshot.reviewRefs) { const review = await this.#referencedReview(db, projectId, reviewRef); if (!same(review.snapshot.draftRef, draft.ref) || review.snapshot.outcome !== 'ACCEPTED') throw Error(); }
      return { projectId, ref, snapshot, observedAt: new Date().toISOString() };
    } catch (error) { if (error instanceof AuthFailure && (error.statusCode === 404 || error.message === 'ASSIGNMENT_CHILD_DRAFT_ONLY')) throw error; throw new AuthFailure('ASSIGNMENT_CONFIRMATION_INTEGRITY_FAILED', 503); }
  }
  async decision(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    const draft = await this.drafts.read(db, actor, projectId, id, version);
    const reviews = await this.#reviews(db, projectId, draft.ref);
    let currentIssue: string | null = null;
    try { await this.drafts.current(db, actor, projectId, draft.ref); } catch (error) { if (!(error instanceof AuthFailure) || error.statusCode >= 500) throw error; currentIssue = error.message; }
    const rows = (await db.query(versionsSelect + 'WHERE v.project_id=$1 AND v.assignment_id=$2 AND v.version=$3', [projectId, id, version])).rows;
    const confirmed = rows.length ? await this.read(db, actor, projectId, id, version) : null;
    return { projectId, draftRef: draft.ref, criteriaVersion: 1, criteria: assignmentContentCriteria, reviews: reviews.slice(0, 200), hasMoreReviews: reviews.length > 200, contentIssues: contentIssues(draft.snapshot.readinessIssues), currentIssue, confirmedRef: confirmed?.ref ?? null, latestReviewAccepted: reviews[0]?.snapshot.outcome === 'ACCEPTED', readinessIssues: draft.snapshot.readinessIssues, ready: false, executionAuthorized: false, dispatchPerformed: false, observedAt: new Date().toISOString() };
  }
}
