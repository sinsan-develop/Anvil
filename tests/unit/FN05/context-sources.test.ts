import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { readContextPreparationInput, contextSlotCodes } from '../../../apps/server/modules/context/context-input.ts';
import { AuthFailure } from '../../../apps/server/modules/access/repository.ts';
const file = new URL('../../../apps/server/modules/context/context-sources.ts', import.meta.url);
const module = existsSync(file) ? await import(file.href) : {};
const pid = '10000000-0000-4000-8000-000000000001', uid = '20000000-0000-4000-8000-000000000002';
const ref = { id: pid, version: 1, contentHash: 'a'.repeat(64) };
const actor = { actorId: uid, clientId: uid, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
function fixture() {
 const body = '프로젝트 지식과 목적은 사용자가 소유한다', contentRef = { artifactId: uid, bytes: Buffer.byteLength(body), contentHash: contentHash(body), mediaType: 'text/plain;charset=utf-8' };
 const entry = { kind: 'PURPOSE', title: '프로젝트 목적', contentRef, sourceRefs: [], reason: '사용자 정의', scope: { projectId: pid, stageRefs: [], taskRefs: [] }, relatedRefs: [] };
 const knowledgeRef = { ...ref, contentHash: contentHash(canonicalJson(entry)) };
 const knowledge: any = { ref: knowledgeRef, entry, body, state: 'CONFIRMED', headVersion: 1, supersedesRef: null, confirmation: { eventId: uid, reviewRefs: [ref], reason: '사람 확인', actorRef: { kind: 'HUMAN', userId: uid }, recordedAt: '2026-10-18T05:00:00Z' }, currentConfirmationValid: true, contentReviewCriteria: [], contentReviews: [], appliedAsConstitution: false, redactionState: 'NOT_REDACTED', sensitiveInspection: 'KNOWN_PATTERNS_ONLY', history: [], agentDelivery: 'NOT_CONNECTED' };
 const definition: any = { taskRef: { planRef: ref, taskCode: 'FN01', applicationRef: ref, nodeId: 'N1' }, purpose: '사용자 주도', goal: '구현', baselineRefs: [ref], inputs: ['요구'], outputs: ['기능'], acceptanceCriteria: ['핵심 동작'], verificationRequirements: ['정상/실패'], included: ['개발'], excluded: ['운영'], allowedScopes: [{ sourceRootRef: ref, mappingRef: null, observationRef: ref, baselineRef: ref, targets: [{ relativePath: 'src/a.ts', kind: 'FILE', access: 'READ', recursive: false }] }], environmentRef: null, requiredCapabilities: ['구현'], budgetRef: null, ownerRole: '책임자', parentAssignmentRef: null, recordingPolicyRef: null, integrationResponsibility: '총괄' };
 const snapshot = { draftRef: ref, definition, reviewRefs: [ref], reason: '임무 내용 확정', confirmedBy: { kind: 'HUMAN', userId: uid }, confirmedAt: '2026-10-18T05:00:00Z', contentConfirmed: true, readinessIssues: [{ code: 'SOURCE_SCOPE_UNVERIFIED', location: 'allowedScopes' }], ready: false, executionAuthorized: false, dispatchPerformed: false };
 const assignmentRef = { ...ref, contentHash: contentHash(canonicalJson(snapshot)) }, assignment = { projectId: pid, ref: assignmentRef, snapshot, observedAt: '2026-10-18T05:00:00Z' };
 const input: any = readContextPreparationInput({ assignmentRef, budgetRef: null, slots: contextSlotCodes.map(code => ({ code, sources: code === 'PURPOSE_REASON' ? [{ kind: 'KNOWLEDGE_VERSION', versionRef: knowledgeRef }] : [], reason: '명시 선택/미선택' })), limits: { maxPartBytes: 4096, maxParts: 100 }, reason: '준비 후보' });
 let metaHash = knowledgeRef.contentHash, missing = false, lookupError: Error | null = null, kind = 'PURPOSE', currentCalls = 0;
 const documents = new Map<string, any>(), messages = new Map<string, any>();
 const db: any = { query: async (sql: string, params: any[]) => {
  assert.equal(params[0], pid);
  if (sql.includes('project_members')) return { rows: [{ id: pid, participation: 'OWNER', archived_at: null }] };
  if (sql.includes('knowledge_versions')) return { rows: missing ? [] : [{ content_hash: metaHash, kind, head_version: 1 }] };
  if (sql.includes('document_versions')) { const doc = documents.get(params[1]); return { rows: doc ? [{ content_hash: doc.contentHash }] : [] }; }
  if (sql.includes('conversation_messages')) { const msg = messages.get(params[1]); return { rows: msg ? [{ content_hash: msg.sourceRef.contentHash, conversation_id: msg.conversationId, kind: msg.message.kind, superseded: msg.superseded ?? false }] : [] }; }
  throw Error('UNEXPECTED_QUERY');
 } };
 const ports: any = { confirmations: { read: async () => structuredClone(assignment) }, drafts: { current: async () => { currentCalls++; return { ref, snapshot: { definition } }; } }, knowledge: { read: async () => { if (lookupError) throw lookupError; return structuredClone(knowledge); } }, documents: { version: async () => { throw Error('UNEXPECTED_DOCUMENT'); }, originalText: async () => { throw Error('UNEXPECTED_BODY'); } }, conversations: { readMessage: async () => { throw Error('UNEXPECTED_CONVERSATION'); } }, constitution: async () => null };
 const resolve = () => { assert.equal(typeof module.ProjectContextSources, 'function'); return new module.ProjectContextSources(ports).resolve(db, actor, pid, input); };
 return { input, knowledge, ports, resolve, db, documents, messages, setHash: (value: string) => { metaHash = value; }, setMissing: () => { missing = true; }, setError: (error: Error) => { lookupError = error; }, setKind: (value: string) => { kind = value; }, currentCalls: () => currentCalls }; }
test('확정 임무·현재 basis와 허가 원문 reader를 소비하고 빈 필수 슬롯·미확인 상태를 숨기지 않는다', async () => {
 const f = fixture(), result = await f.resolve(); assert.equal(f.currentCalls(), 1);
 assert.equal(result.parts.map((part: any) => part.text).join(''), f.knowledge.body); assert.equal(result.items.length, 7);
 assert.equal(result.items[0].includedState, 'INCLUDED'); assert.equal(result.missingRequired.length, 6);
 assert.equal(result.ready, false); assert.equal(result.executionAuthorized, false); assert.equal(result.dispatchPerformed, false); assert.equal(result.budgetVerified, false);
 assert.ok(result.unverified.includes('INSTRUCTION_EFFECTIVENESS_UNVERIFIED')); assert.ok(result.unverified.includes('CURRENT_STATE_MEANING_UNVERIFIED'));
});
test('없는/다른hash·다른 의미 종류·현재 basis 거절과 예산 불일치를 통과시키지 않는다', async () => {
 for (const mutate of [(f: any) => f.setMissing(), (f: any) => f.setHash('f'.repeat(64)), (f: any) => f.setKind('CONSTITUTION'), (f: any) => { f.ports.drafts.current = async () => { throw new AuthFailure('VERSION_CONFLICT', 409); }; }, (f: any) => { f.input.budgetRef = ref; }]) { const f = fixture(); mutate(f); await assert.rejects(f.resolve()); }
});
test('제외/대체·격리 원문은 평문 부분에 넣지 않고, 검증 전 다른 hash를 격리 ref로 저장하지 않는다', async () => {
 for (const state of ['EXCLUDED', 'SUPERSEDED']) { const f = fixture(); f.knowledge.state = state; const result = await f.resolve(); assert.equal(result.parts.length, 0); assert.equal(result.items[0].includedState, 'EXCLUDED'); }
 const f = fixture(); f.setError(new AuthFailure('ARTIFACT_QUARANTINED', 412)); const result = await f.resolve(); assert.equal(result.items[0].includedState, 'REDACTED'); assert.equal(result.parts.length, 0); assert.equal(JSON.stringify(result).includes(f.knowledge.body), false);
 const wrong = fixture(); wrong.setHash('f'.repeat(64)); wrong.setError(new AuthFailure('ARTIFACT_QUARANTINED', 412)); await assert.rejects(wrong.resolve());
});
test('현재 적용 헌법만 원문으로 채택하고 적용 참조 변경이나 회원 부재는 거절한다', async () => {
 const f = fixture(); f.input.slots[0].sources = []; f.knowledge.entry.kind = 'CONSTITUTION'; f.setKind('CONSTITUTION'); f.knowledge.ref.contentHash = contentHash(canonicalJson(f.knowledge.entry)); f.setHash(f.knowledge.ref.contentHash);
 f.input.slots[1].sources = [{ kind: 'KNOWLEDGE_VERSION', versionRef: f.knowledge.ref }];
 const application = { projectId: pid, versionRef: f.knowledge.ref, confirmationId: uid, reason: '별도 적용', acknowledged: true, reviewRef: ref, previousApplicationRef: null, appliedBy: { kind: 'HUMAN', userId: uid, clientId: uid }, controlGeneration: 1 };
 const current = { ref: { ...ref, contentHash: contentHash(canonicalJson(application)) }, application, appliedAt: '2026-10-18T05:00:00Z' };
 f.ports.constitution = async () => structuredClone(current); const resolved = await f.resolve(); assert.equal(resolved.items[1].includedState, 'INCLUDED'); assert.deepEqual(resolved.constitutionRef, current.ref);
 f.ports.constitution = async () => ({ ...current, application: { ...application, versionRef: ref } }); await assert.rejects(f.resolve(), /CONTEXT_CONSTITUTION_NOT_CURRENT/);
 const absent = fixture(); absent.db.query = async () => ({ rows: [] }); await assert.rejects(absent.resolve(), /NOT_FOUND/); assert.equal(absent.currentCalls(), 0);
});
test('복수 사용자 지시는 모두 보존하되 직접 정정된 앞 지시와 확정되지 않은 문서 본문은 넣지 않는다', async () => {
 const f = fixture(); f.input.slots[0].sources = [];
 for (const [index, body] of ['앞 지시', '새 지시 하나', '관련 지시 둘'].entries()) {
  const id = '30000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), bodyRef = { artifactId: uid, bytes: Buffer.byteLength(body), contentHash: contentHash(body), mediaType: 'text/plain;charset=utf-8' };
  const message = { kind: 'USER_INSTRUCTION', bodyRef, attachmentRefs: [], replyTo: null, supersedesInstructionRef: null, effectiveScope: { projectId: pid, stageRefs: [], taskRefs: [] } }, authorRef = { kind: 'HUMAN', userId: uid };
  const sourceRef = { kind: 'CONVERSATION', id, contentHash: contentHash(canonicalJson({ conversationId: pid, targetRoleRef: null, message, sourceRefs: [], serverSequence: index + 1, authorRef })) };
  f.messages.set(id, { sourceRef, conversationId: pid, serverSequence: index + 1, authorRef, message, body, deliveryState: 'STORED', redactionState: 'NOT_REDACTED', sensitiveInspection: 'KNOWN_PATTERNS_ONLY', recordedAt: '2026-10-18T05:00:00Z', superseded: index === 0 });
  f.input.slots[2].sources.push({ kind: 'USER_INSTRUCTION', conversationId: pid, messageRef: sourceRef });
 }
 f.ports.conversations.readMessage = async (_db: any, _actor: any, _pid: string, _cid: string, id: string) => structuredClone(f.messages.get(id));
 const body = '작업현황 원문', content = { body: { artifactId: uid, bytes: Buffer.byteLength(body), contentHash: contentHash(body), mediaType: 'text/markdown;charset=utf-8' }, attachments: [], sections: [], sourceRefs: [] };
 const document: any = { id: uid, version: 1, title: '작업현황', formRef: ref, stageNodeRef: null, stageBinding: null, content, contentHash: contentHash(canonicalJson({ title: '작업현황', formRef: ref, stageNodeRef: null, content })), sourceRefs: [], authorRef: { kind: 'HUMAN', userId: uid }, createdAt: '2026-10-18T05:00:00Z', confirmed: true, validation: {}, statusHistory: [], contentReviewCriteria: [], contentReviews: [], reviewRefs: [], proposalRefs: [], sourceLinks: [], importCandidateRefs: [] };
 f.documents.set(uid, document); f.input.slots[4].sources = [{ kind: 'DOCUMENT_VERSION', versionRef: { id: uid, version: 1, contentHash: document.contentHash } }];
 document.contentReviews = [{ ref: { id: uid, targetRef: f.input.slots[4].sources[0].versionRef, criteriaVersion: 1, outcome: 'ACCEPTED' }, sourceKind: 'HUMAN_REVIEW', serverSequence: 1 }];
 f.ports.documents.version = async () => structuredClone(document); f.ports.documents.originalText = async () => body;
 const result = await f.resolve(); assert.deepEqual(result.parts.map((part: any) => part.text), ['새 지시 하나', '관련 지시 둘', '작업현황 원문']); assert.ok(result.excluded.includes('LATEST_INSTRUCTIONS_1')); assert.equal(result.ready, false);
 document.confirmed = false; const unconfirmed = await f.resolve(); assert.ok(unconfirmed.missingRequired.includes('CURRENT_POSITION_1')); assert.equal(unconfirmed.parts.some((part: any) => part.text === body), false);
 document.confirmed = true;
 document.contentReviews = [{ ref: { id: uid, targetRef: f.input.slots[4].sources[0].versionRef, criteriaVersion: 1, outcome: 'REWORK' }, sourceKind: 'HUMAN_REVIEW', serverSequence: 2 }];
 const rework = await f.resolve(); assert.ok(rework.missingRequired.includes('CURRENT_POSITION_1')); assert.equal(rework.parts.some((part: any) => part.text === body), false);
 document.contentReviews = []; const missingReview = await f.resolve(); assert.ok(missingReview.missingRequired.includes('CURRENT_POSITION_1'));
});
test('허용된 지시 200개와 빈 필수6슬롯을 내부 표식 한도 때문에 누락하거나 거절하지 않는다', async () => {
 const f = fixture(); f.input.slots[0].sources = []; f.input.limits.maxParts = 200;
 for (let index = 0; index < 200; index++) {
  const id = '40000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), body = '지시' + index;
  const message = { kind: 'USER_INSTRUCTION', bodyRef: { artifactId: uid, bytes: Buffer.byteLength(body), contentHash: contentHash(body), mediaType: 'text/plain;charset=utf-8' }, attachmentRefs: [], replyTo: null, supersedesInstructionRef: null, effectiveScope: { projectId: pid, stageRefs: [], taskRefs: [] } }, authorRef = { kind: 'HUMAN', userId: uid };
  const sourceRef = { kind: 'CONVERSATION', id, contentHash: contentHash(canonicalJson({ conversationId: pid, targetRoleRef: null, message, sourceRefs: [], serverSequence: index + 1, authorRef })) };
  f.messages.set(id, { sourceRef, conversationId: pid, serverSequence: index + 1, authorRef, message, body, deliveryState: 'STORED', redactionState: 'NOT_REDACTED', sensitiveInspection: 'KNOWN_PATTERNS_ONLY', recordedAt: '2026-10-18T05:00:00Z' });
  f.input.slots[2].sources.push({ kind: 'USER_INSTRUCTION', conversationId: pid, messageRef: sourceRef });
 }
 f.ports.conversations.readMessage = async (_db: any, _actor: any, _pid: string, _cid: string, id: string) => structuredClone(f.messages.get(id));
 const result = await f.resolve(); assert.equal(result.items.length, 206); assert.equal(result.parts.length, 200); assert.equal(result.missingRequired.length, 6); assert.equal(result.parts.at(-1).text, '지시199'); assert.equal(result.ready, false);
});
