import type { PoolClient } from 'pg';
import { canonicalJson } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { AuthFailure, type AuthenticatedIdentity } from '../access/repository.ts';
import { projectMember } from '../access/project-command.ts';
import type { ProjectAssignmentConfirmations } from '../assignments/project-assignment-confirmations.ts';
import type { ProjectAssignmentDrafts } from '../assignments/project-assignment-drafts.ts';
import type { ProjectDocuments } from '../documents/project-documents.ts';
import type { ProjectKnowledge } from '../knowledge/knowledge.ts';
import type { ProjectConversations } from '../knowledge/conversations.ts';
import { currentConstitutionRecord } from '../knowledge/constitution-records.ts';
import { constitutionEligibility } from '../knowledge/knowledge-state.ts';
import { readContextPreparationInput, type ContextSourceSelection, type ContextSlotCode } from './context-input.ts';
import { planContextText } from './context-text-plan.ts';

interface ContextSourceReaders {
 confirmations: Pick<ProjectAssignmentConfirmations, 'read'>; drafts: Pick<ProjectAssignmentDrafts, 'current'>;
 documents: Pick<ProjectDocuments, 'version' | 'originalText'>; knowledge: Pick<ProjectKnowledge, 'read'>;
 conversations: Pick<ProjectConversations, 'readMessage'>; constitution?: typeof currentConstitutionRecord;
}
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const selectedRef = (selection: ContextSourceSelection) => selection.kind === 'USER_INSTRUCTION' ? selection.messageRef : selection.versionRef;

/** 기존 인증 transaction 안에서만 사용하며, 문법 ref가 아닌 현재 보호 reader와 불변 원문을 소비한다. */
export class ProjectContextSources {
 readonly readers: ContextSourceReaders;
 constructor(readers: ContextSourceReaders) { this.readers = readers; }
 async resolve(db: PoolClient, actor: AuthenticatedIdentity, projectId: string, value: unknown) {
  const input = readContextPreparationInput(value);
  await projectMember(db, actor, projectId, true);
  const assignment = await this.readers.confirmations.read(db, actor, projectId, input.assignmentRef.id, input.assignmentRef.version);
  if (assignment.projectId !== projectId || !same(assignment.ref, input.assignmentRef) || assignment.snapshot.contentConfirmed !== true) throw new AuthFailure('CONTEXT_ASSIGNMENT_INVALID', 409);
  await this.readers.drafts.current(db, actor, projectId, assignment.snapshot.draftRef);
  if (!same(input.budgetRef, assignment.snapshot.definition.budgetRef)) throw new AuthFailure('CONTEXT_BUDGET_MISMATCH', 409);
  const constitution = await (this.readers.constitution ?? currentConstitutionRecord)(db, projectId);
  const originals: any[] = [], bindings: { itemId: string; selection: ContextSourceSelection | null; bodyRef: unknown; sourceState: string }[] = [];
  let totalBytes = 0;
  for (const slot of input.slots) {
   if (!slot.sources.length) {
    originals.push({ itemId: slot.code, category: slot.code, required: true, sourceRef: null, reason: slot.reason, state: 'MISSING', bodyRef: null, body: null });
    bindings.push({ itemId: slot.code, selection: null, bodyRef: null, sourceState: 'NOT_SELECTED' }); continue;
   }
   for (const [index, selection] of slot.sources.entries()) {
    const itemId = slot.code + '_' + (index + 1), sourceRef = selectedRef(selection);
    // 원문 reader가 격리 오류를 내기 전에 같은 프로젝트의 실제 ref/hash를 확정한다.
    const metadata = selection.kind === 'KNOWLEDGE_VERSION'
     ? (await db.query('SELECT v.content_hash,k.kind,k.head_version FROM anvil.knowledge_versions v JOIN anvil.knowledge_entries k ON k.project_id=v.project_id AND k.id=v.entry_id WHERE v.project_id=$1 AND v.entry_id=$2 AND v.version=$3', [projectId, sourceRef.id, (sourceRef as VersionRef).version])).rows[0]
     : selection.kind === 'DOCUMENT_VERSION'
      ? (await db.query('SELECT content_hash FROM anvil.document_versions WHERE project_id=$1 AND document_id=$2 AND version=$3', [projectId, sourceRef.id, (sourceRef as VersionRef).version])).rows[0]
      : (await db.query('SELECT m.content_hash,m.kind,m.conversation_id,EXISTS(SELECT 1 FROM anvil.conversation_messages newer WHERE newer.project_id=m.project_id AND newer.conversation_id=m.conversation_id AND newer.supersedes_instruction_id=m.id) superseded FROM anvil.conversation_messages m WHERE m.project_id=$1 AND m.id=$2 AND m.conversation_id=$3', [projectId, sourceRef.id, selection.conversationId])).rows[0];
    if (!metadata) throw new AuthFailure('NOT_FOUND', 404);
    if (metadata.content_hash !== sourceRef.contentHash) throw new AuthFailure('CONTEXT_SOURCE_MISMATCH', 409);
    const expectedKind = ({ PURPOSE_REASON: 'PURPOSE', RULES_SCOPE: 'CONSTITUTION', DECISIONS_REASON: 'DECISION' } as Partial<Record<ContextSlotCode, string>>)[slot.code];
    if (expectedKind && metadata.kind !== expectedKind) throw new AuthFailure('CONTEXT_SOURCE_KIND_INVALID', 422);
    if (slot.code === 'RULES_SCOPE' && (!constitution || !same(constitution.application.versionRef, sourceRef))) throw new AuthFailure('CONTEXT_CONSTITUTION_NOT_CURRENT', 412);
    let state = 'AVAILABLE', sourceState = 'CURRENT_READ', body: string | null = null, bodyRef: any = null;
    try {
     if (selection.kind === 'KNOWLEDGE_VERSION') {
      const source = await this.readers.knowledge.read(db, actor, projectId, selection.versionRef.id, selection.versionRef.version);
      if (!same(source.ref, selection.versionRef) || source.entry.scope.projectId !== projectId || source.entry.kind !== metadata.kind) throw new AuthFailure('CONTEXT_SOURCE_MISMATCH', 409);
      sourceState = source.state;
      if (['EXCLUDED', 'SUPERSEDED'].includes(source.state)) state = 'EXCLUDED';
      else if (source.state !== 'CONFIRMED' || !source.currentConfirmationValid) state = 'MISSING';
      else if (slot.code === 'RULES_SCOPE' && !constitutionEligibility(source).usable) state = 'MISSING';
      else { body = source.body; bodyRef = source.entry.contentRef; }
     } else if (selection.kind === 'DOCUMENT_VERSION') {
      const source = await this.readers.documents.version(db, actor, projectId, selection.versionRef.id, selection.versionRef.version);
      if (!same({ id: source.id, version: source.version, contentHash: source.contentHash }, selection.versionRef)) throw new AuthFailure('CONTEXT_SOURCE_MISMATCH', 409);
      const latestReview = source.contentReviews.find(review => review.sourceKind === 'HUMAN_REVIEW' && review.ref.criteriaVersion === 1);
      const usable = source.confirmed && latestReview?.ref.outcome === 'ACCEPTED' && same(latestReview.ref.targetRef, selection.versionRef);
      sourceState = usable ? 'CONFIRMED' : 'CURRENT_CONFIRMATION_REVIEW_REQUIRED';
      if (!usable) state = 'MISSING'; else { bodyRef = source.content.body; body = await this.readers.documents.originalText(db, projectId, bodyRef); }
     } else {
      if (metadata.kind !== 'USER_INSTRUCTION' || metadata.conversation_id !== selection.conversationId) throw new AuthFailure('CONTEXT_SOURCE_KIND_INVALID', 422);
      if (metadata.superseded) { state = 'EXCLUDED'; sourceState = 'SUPERSEDED_INSTRUCTION'; }
      else {
       const source = await this.readers.conversations.readMessage(db, actor, projectId, selection.conversationId, selection.messageRef.id);
       if (!same(source.sourceRef, selection.messageRef) || source.conversationId !== selection.conversationId || source.message.kind !== 'USER_INSTRUCTION' || source.authorRef.kind !== 'HUMAN') throw new AuthFailure('CONTEXT_SOURCE_MISMATCH', 409);
       body = source.body; bodyRef = source.message.bodyRef; sourceState = 'STORED_NOT_EFFECTIVENESS_APPROVED';
      }
     }
    } catch (error) {
     if (!(error instanceof AuthFailure) || !['ARTIFACT_QUARANTINED', 'KNOWLEDGE_SENSITIVE_CONTENT_SUSPECTED'].includes(error.message)) throw error;
     state = 'REDACTED'; sourceState = error.message; body = null; bodyRef = null;
    }
    if (body !== null && (totalBytes += Buffer.byteLength(body, 'utf8')) > 2 * 1024 * 1024) throw new AuthFailure('CONTEXT_SOURCE_TOTAL_TOO_LARGE', 422);
    originals.push({ itemId, category: slot.code, required: true, sourceRef, reason: slot.reason, state, bodyRef, body });
    bindings.push({ itemId, selection: structuredClone(selection), bodyRef, sourceState });
   }
  }
  const planned = planContextText(originals, input.limits);
  return { assignmentRef: input.assignmentRef, baselineRefs: structuredClone(assignment.snapshot.definition.baselineRefs), constitutionRef: constitution?.ref ?? null,
   budgetRef: input.budgetRef, bindings, ...planned,
   unverified: ['CONTEXT_SELECTION_REVIEW_REQUIRED', 'INSTRUCTION_EFFECTIVENESS_UNVERIFIED', 'CURRENT_STATE_MEANING_UNVERIFIED', 'BUDGET_UNVERIFIED', 'DELIVERY_NOT_CONNECTED', 'UNDERSTANDING_NOT_REVIEWED', 'EXECUTION_NOT_CONNECTED'] };
 }
}
