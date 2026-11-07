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
  readonly drafts: Pick<ProjectAssignmentDrafts, 'current' | 'read'> & Partial<Pick<ProjectAssignmentDrafts, 'currentForContent'>>;
  constructor(drafts: Pick<ProjectAssignmentDrafts, 'current' | 'read'> & Partial<Pick<ProjectAssignmentDrafts, 'currentForContent'>>) { this.drafts = drafts; }
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
  /** 하위 내용 원형은 현재 부모 head와 분리해 원명령·영수증·감사 전체를 검산한다. */
  async #contentProof(db: PoolClient, row: any, payload: Record<string, unknown>, ref: VersionRef, at: string) {
    try {
      const proof = (await db.query("SELECT to_jsonb(c) command, (SELECT jsonb_agg(to_jsonb(r)) FROM (SELECT * FROM anvil.authorization_receipts WHERE command_id=c.id LIMIT 2) r) receipts, (SELECT jsonb_agg(to_jsonb(a)) FROM (SELECT * FROM anvil.audit_events WHERE command_id=c.id LIMIT 2) a) audits FROM anvil.commands c WHERE c.project_id=$1 AND c.id=$2", [row.project_id, row.command_id])).rows;
      if (proof.length !== 1) throw Error();
      const { command: c, receipts, audits } = proof[0];
      if (!c || receipts?.length !== 1 || audits?.length !== 1) throw Error();
      const request: ProjectCommand = {schemaVersion:1,projectId:row.project_id,commandId:c.command_id,clientId:row.client_id,controlGeneration:Number(c.control_generation),operation:row.operation,targetId:row.draft_id ?? row.assignment_id,expectedVersion:Number(row.expected_version),baselineRefs:[],approvalRef:null,payload};
      const hash=contentHash(canonicalJson(request)), policy=c.policy_ref, result=c.result_ref, r=receipts[0], a=audits[0];
      const digest=contentHash(canonicalJson({projectId:row.project_id,actorId:row.created_by,clientId:row.client_id,controlGeneration:request.controlGeneration,requestHash:hash,policyRef:policy,targetRef:ref}));
      const stamp=(value:unknown)=>{const n=value instanceof Date?value.getTime():typeof value==='string'?Date.parse(value):NaN;if(!Number.isFinite(n))throw Error();return new Date(n).toISOString();};
      if (!uuid(c.id)||!uuid(c.command_id)||!uuid(c.operation_id)||!isVersionRef(policy)||!Number.isSafeInteger(request.controlGeneration)||request.controlGeneration<1
        ||c.id!==row.command_id||c.scope_kind!=='PROJECT'||c.scope_id!==row.project_id||c.project_id!==row.project_id||c.actor_id!==row.created_by||c.client_id!==row.client_id||c.operation!==row.operation||c.state!=='APPLIED'||c.request_hash!==hash||c.approval_consumption_id!==null||c.payload_ref!==null
        ||!same(result,row.result_ref)||result.commandId!==c.command_id||result.operationId!==c.operation_id||result.targetId!==ref.id||result.version!==ref.version||result.serverReceivedAt!==at||stamp(row.created_at)!==at||stamp(c.received_at)!==at||stamp(c.completed_at)!==at
        ||r.id!==c.authorization_receipt_id||r.command_id!==c.id||r.scope_kind!=='PROJECT'||r.scope_id!==row.project_id||!same(r.subject_ref,{kind:'HUMAN',userId:row.created_by,clientId:row.client_id})||!same(r.policy_ref,policy)||r.scope_digest!==digest||r.approval_decision_ref!==null||stamp(r.authorized_at)!==at
        ||a.project_id!==row.project_id||a.command_id!==c.id||a.operation_id!==c.operation_id||!same(a.actor_ref,{kind:'HUMAN',userId:row.created_by})||a.client_ref!==row.client_id||!same(a.target_ref,ref)||!same(a.policy_ref,policy)||a.approval_ref!==null||a.outcome!=='APPLIED'||a.source_kind!=='HUMAN_COMMAND'||a.scope_digest!==digest||stamp(a.recorded_at)!==at||!Number.isSafeInteger(Number(a.server_sequence))||Number(a.server_sequence)<1) throw Error();
      if(row.review_id && Number(row.server_sequence)!==Number(a.server_sequence))throw Error();
      return request;
    } catch { throw new AuthFailure('ASSIGNMENT_CONTENT_INTEGRITY_FAILED',503); }
  }
  async #contentReviews(db:PoolClient,projectId:string,ref:VersionRef){
    // 원행을 기준으로 검사하므로 JOIN이 손상된 최신 판단을 숨기지 못한다.
    const stats=(await db.query("SELECT count(*) total, count(*) FILTER(WHERE c.id IS NULL OR c.operation<>'reviewAssignmentContent' OR c.state<>'APPLIED' OR (SELECT count(*) FROM anvil.authorization_receipts ar WHERE ar.command_id=r.command_id)<>1 OR (SELECT count(*) FROM anvil.audit_events ae WHERE ae.command_id=r.command_id)<>1) invalid FROM anvil.assignment_content_reviews r LEFT JOIN anvil.commands c ON c.project_id=r.project_id AND c.id=r.command_id WHERE r.project_id=$1 AND r.draft_id=$2 AND r.draft_version=$3",[projectId,ref.id,ref.version])).rows[0];
    if(!stats||!Number.isSafeInteger(Number(stats.total))||Number(stats.total)<0||Number(stats.invalid)!==0)throw new AuthFailure('ASSIGNMENT_REVIEW_INTEGRITY_FAILED',503);
    const reviews=await this.#reviews(db,projectId,ref);
    if(reviews.length!==Math.min(201,Number(stats.total)))throw new AuthFailure('ASSIGNMENT_REVIEW_INTEGRITY_FAILED',503);
    for(const review of reviews)await this.#contentReview(db,projectId,review.ref);
    return reviews;
  }
  async #contentReview(db:PoolClient,projectId:string,ref:VersionRef){
    const rows=(await db.query(reviewsSelect+'WHERE r.project_id=$1 AND r.review_id=$2',[projectId,ref.id])).rows;
    if(rows.length!==1)throw new AuthFailure('ASSIGNMENT_REVIEW_INTEGRITY_FAILED',503);
    const row=rows[0],view=this.#reviewView(row),v=view.snapshot;
    if(!same(view.ref,ref))throw new AuthFailure('ASSIGNMENT_REVIEW_INTEGRITY_FAILED',503);
    await this.#contentProof(db,row,{draftRef:v.draftRef,criteriaVersion:v.criteriaVersion,items:v.items,outcome:v.outcome,reason:v.reason},ref,v.reviewedAt);
    return view;
  }
  async replayContent(db:PoolClient,actor:AuthenticatedIdentity,request:ProjectCommand,previous:unknown){
    const input=request.operation==='reviewAssignmentContent'?readAssignmentContentReview(request.payload):readAssignmentConfirmation(request.payload);
    this.#envelope(request,request.operation,input.draftRef);
    const draft=await this.drafts.read(db,actor,request.projectId,input.draftRef.id,input.draftRef.version);
    if(!same(draft.ref,input.draftRef))throw new AuthFailure('ASSIGNMENT_CONTENT_INTEGRITY_FAILED',503);
    if(draft.snapshot.definition.parentAssignmentRef===null)return previous;
    let rows:any[];
    if(request.operation==='reviewAssignmentContent'){
      rows=(await db.query(reviewsSelect+'WHERE r.project_id=$1 AND c.actor_id=$2 AND c.command_id=$3',[request.projectId,actor.actorId,request.commandId])).rows;
      if(rows.length!==1)throw new AuthFailure('ASSIGNMENT_CONTENT_INTEGRITY_FAILED',503);
      const v=this.#reviewView(rows[0]);await this.#contentReview(db,request.projectId,v.ref);
    }else{
      rows=(await db.query(versionsSelect+'WHERE v.project_id=$1 AND v.assignment_id=$2 AND v.version=$3',[request.projectId,input.draftRef.id,input.draftRef.version])).rows;
      if(rows.length!==1)throw new AuthFailure('ASSIGNMENT_CONTENT_INTEGRITY_FAILED',503);
      await this.readContent(db,actor,request.projectId,input.draftRef.id,input.draftRef.version);
    }
    if(!same(rows[0].result_ref,previous))throw new AuthFailure('ASSIGNMENT_CONTENT_INTEGRITY_FAILED',503);
    const v=request.operation==='reviewAssignmentContent'?rows[0].review_json:rows[0].version_json;
    const original=await this.#contentProof(db,rows[0],input as unknown as Record<string,unknown>,rows[0].result_ref.data.ref,v.reviewedAt??v.confirmedAt);
    if(!same(original,request))throw new AuthFailure('ASSIGNMENT_CONTENT_INTEGRITY_FAILED',503);
    return previous;
  }
  async #currentContent(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, ref: VersionRef) {
    if (!this.drafts.currentForContent) throw new AuthFailure('ASSIGNMENT_CONTENT_NOT_CONNECTED', 412);
    return this.drafts.currentForContent(db, actor, projectId, ref);
  }
  async reviewContent(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const input = readAssignmentContentReview(request.payload); this.#envelope(request, 'reviewAssignmentContent', input.draftRef);
    const original = await this.drafts.read(db, actor, request.projectId, input.draftRef.id, input.draftRef.version);
    if (original.snapshot.definition.parentAssignmentRef === null) return this.review(db,actor,request,policyRef);
    const draft = await this.#currentContent(db, actor, request.projectId, input.draftRef);
    const at = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const snapshot = { ...input, reviewedBy: { kind: 'HUMAN', userId: actor.actorId }, reviewedAt: at, independence: 'NOT_CLAIMED' };
    const ref = { id: randomUUID(), version: 1, contentHash: contentHash(canonicalJson(snapshot)) };
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'ASSIGNMENT_CONTENT_REVIEWED', snapshot }, policyRef, 'EXPLICIT_ASSIGNMENT_CONTENT_REVIEW');
    await db.query('INSERT INTO anvil.assignment_content_reviews(project_id,review_id,draft_id,draft_version,draft_hash,content_hash,review_json,created_by,client_id,command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [request.projectId, ref.id, input.draftRef.id, input.draftRef.version, input.draftRef.contentHash, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id]);
    return receipt.result;
  }
  async confirmContent(db: PoolClient, actor: AuthenticatedIdentity, request: ProjectCommand, policyRef: VersionRef) {
    const input = readAssignmentConfirmation(request.payload); this.#envelope(request, 'confirmAssignment', input.draftRef);
    const original = await this.drafts.read(db, actor, request.projectId, input.draftRef.id, input.draftRef.version);
    if (original.snapshot.definition.parentAssignmentRef === null) return this.confirm(db,actor,request,policyRef);
    const draft = await this.#currentContent(db, actor, request.projectId, input.draftRef);
    if ((await db.query(versionsSelect + 'WHERE v.project_id=$1 AND v.assignment_id=$2 AND v.version=$3', [request.projectId, input.draftRef.id, input.draftRef.version])).rows.length) throw new AuthFailure('VERSION_CONFLICT', 409);
    const analysis = readAssignmentDraftInput({ baseRef: draft.snapshot.previousRef ?? null, definition: draft.snapshot.definition, reason: draft.snapshot.reason ?? '내용 필수 검사' });
    if (contentIssues([...analysis.readinessIssues, ...draft.snapshot.readinessIssues]).length) throw new AuthFailure('ASSIGNMENT_CONTENT_INCOMPLETE', 422);
    const latest = (await this.#contentReviews(db, request.projectId, input.draftRef))[0];
    if (!latest || latest.snapshot.outcome !== 'ACCEPTED' || !same(latest.snapshot.draftRef, input.draftRef) || !input.reviewRefs.some(ref => same(ref, latest.ref))) throw new AuthFailure('ASSIGNMENT_REVIEW_REQUIRED', 422);
    for (const ref of input.reviewRefs) { const review = await this.#contentReview(db, request.projectId, ref); if (!same(review.snapshot.draftRef, input.draftRef) || review.snapshot.outcome !== 'ACCEPTED') throw new AuthFailure('ASSIGNMENT_REVIEW_REQUIRED', 422); }
    const at = (await db.query('SELECT transaction_timestamp() AS at')).rows[0].at.toISOString();
    const snapshot = { draftRef: input.draftRef, definition: draft.snapshot.definition, reviewRefs: input.reviewRefs, reason: input.reason, confirmedBy: { kind: 'HUMAN', userId: actor.actorId }, confirmedAt: at, contentConfirmed: true, readinessIssues: draft.snapshot.readinessIssues, ready: false, executionAuthorized: false, dispatchPerformed: false };
    if (Buffer.byteLength(canonicalJson(snapshot), 'utf8') > 2 * 1024 * 1024) throw new AuthFailure('ASSIGNMENT_CONFIRMATION_INPUT_INVALID', 422);
    const ref = { id: input.draftRef.id, version: input.draftRef.version, contentHash: contentHash(canonicalJson(snapshot)) }, confirmationId = randomUUID();
    const receipt = await persistProjectReceipt(db, actor, request, ref, { status: 'ASSIGNMENT_CONTENT_CONFIRMED', confirmationId, snapshot }, policyRef, 'EXPLICIT_ASSIGNMENT_CONTENT_ONLY');
    await db.query('INSERT INTO anvil.assignment_versions(project_id,assignment_id,version,content_hash,version_json,created_by,client_id,command_id,confirmation_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [request.projectId, ref.id, ref.version, ref.contentHash, JSON.stringify(snapshot), actor.actorId, actor.clientId, receipt.id, confirmationId]);
    return receipt.result;
  }
  async readContent(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    await projectMember(db, actor, projectId);
    if (!uuid(id) || !Number.isSafeInteger(version) || version < 1) throw new AuthFailure('INPUT_INVALID', 400);
    const row = (await db.query(versionsSelect.replace(' JOIN anvil.commands',' LEFT JOIN anvil.commands') + 'WHERE v.project_id=$1 AND v.assignment_id=$2 AND v.version=$3', [projectId, id, version])).rows[0];
    if (!row) throw new AuthFailure('NOT_FOUND', 404);
    if(row.version_json?.definition?.parentAssignmentRef===null)return this.read(db,actor,projectId,id,version);
    try {
      const ref = { id, version, contentHash: row.content_hash }, snapshot = row.version_json;
      this.#receipt(row, ref, snapshot, 'confirmAssignment', 'ASSIGNMENT_CONTENT_CONFIRMED');
      readAssignmentConfirmation({ draftRef: snapshot.draftRef, reviewRefs: snapshot.reviewRefs, reason: snapshot.reason, acknowledged: true });
      const draft = await this.drafts.read(db, actor, projectId, id, version);
      if (!uuid(row.confirmation_id) || row.result_ref.data.confirmationId !== row.confirmation_id || Number(row.expected_version) !== version || !same(snapshot.draftRef, draft.ref) || !same(snapshot.definition, draft.snapshot.definition) || !same(snapshot.readinessIssues, draft.snapshot.readinessIssues)
        || !same(snapshot.confirmedBy, { kind: 'HUMAN', userId: row.created_by }) || typeof snapshot.confirmedAt !== 'string' || !Number.isFinite(Date.parse(snapshot.confirmedAt))
        || snapshot.contentConfirmed !== true || snapshot.ready !== false || snapshot.executionAuthorized !== false || snapshot.dispatchPerformed !== false || Object.keys(snapshot).length !== 11) throw Error();
      for (const reviewRef of snapshot.reviewRefs) { const review = await this.#contentReview(db, projectId, reviewRef); if (!same(review.snapshot.draftRef, draft.ref) || review.snapshot.outcome !== 'ACCEPTED') throw Error(); }
      await this.#contentProof(db,row,{draftRef:snapshot.draftRef,reviewRefs:snapshot.reviewRefs,reason:snapshot.reason,acknowledged:true},ref,snapshot.confirmedAt);
      return { projectId, ref, snapshot, observedAt: new Date().toISOString() };
    } catch (error) { if (error instanceof AuthFailure && (error.statusCode === 404 || error.message === 'ASSIGNMENT_CHILD_DRAFT_ONLY')) throw error; throw new AuthFailure('ASSIGNMENT_CONFIRMATION_INTEGRITY_FAILED', 503); }
  }
  async decisionContent(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, id: string, version: number) {
    const draft = await this.drafts.read(db, actor, projectId, id, version);
    if(draft.snapshot.definition.parentAssignmentRef===null)return this.decision(db,actor,projectId,id,version);
    const reviews = await this.#contentReviews(db, projectId, draft.ref);
    let currentIssue: string | null = null;
    try { await this.#currentContent(db, actor, projectId, draft.ref); } catch (error) { if (!(error instanceof AuthFailure) || error.statusCode >= 500) throw error; currentIssue = error.message; }
    const rows = (await db.query(versionsSelect + 'WHERE v.project_id=$1 AND v.assignment_id=$2 AND v.version=$3', [projectId, id, version])).rows;
    const confirmed = rows.length ? await this.readContent(db, actor, projectId, id, version) : null;
    return { projectId, draftRef: draft.ref, criteriaVersion: 1, criteria: assignmentContentCriteria, reviews: reviews.slice(0, 200), hasMoreReviews: reviews.length > 200, contentIssues: contentIssues(draft.snapshot.readinessIssues), currentIssue, confirmedRef: confirmed?.ref ?? null, latestReviewAccepted: reviews[0]?.snapshot.outcome === 'ACCEPTED', readinessIssues: draft.snapshot.readinessIssues, ready: false, executionAuthorized: false, dispatchPerformed: false, observedAt: new Date().toISOString() };
  }

}
