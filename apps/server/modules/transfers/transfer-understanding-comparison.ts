import {canonicalJson} from '../../../../contracts/canonical.ts';
import {arrayV1, cloneV1, recordV1, refV1, uuidV1, type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {understandingCodes} from '../executions/execution-understanding.ts';
import {assertKnowledgeTextSafe} from '../knowledge/knowledge-entry.ts';
import {readPreparationSource, type PreparationSource} from './preparation-record-input.ts';

type Code = typeof understandingCodes[number];
type Judgement = 'MATCH' | 'MISMATCH' | 'INSUFFICIENT';
type Evidence = 'VERIFIED' | 'UNVERIFIED' | 'INSUFFICIENT' | 'MISMATCH';
type Ref = Readonly<RuntimeRefV1>;

interface ComparisonScope {
  readonly projectId: string;
  readonly transferRef: Ref;
  readonly targetConnectionRef: Ref;
  readonly newSessionRef: Ref;
  readonly sessionGeneration: number;
  readonly deliveryAttemptRef: Ref;
  readonly responseRef: Ref;
}

interface Criterion {
  code: Code;
  sourceRefs: (RuntimeRefV1 | PreparationSource)[];
  responsePartRefs: RuntimeRefV1[];
}

interface Assessment extends Criterion {
  judgement: Judgement;
  reason: string;
}

const scopeRefs = ['transferRef', 'targetConnectionRef', 'newSessionRef', 'deliveryAttemptRef', 'responseRef'] as const;
const itemKeys = ['code', 'sourceRefs', 'responsePartRefs'] as const;
const judgements = new Set<Judgement>(['MATCH', 'MISMATCH', 'INSUFFICIENT']);

function readScope(value: unknown): ComparisonScope | null {
  if (!recordV1(value, ['projectId', 'sessionGeneration', ...scopeRefs])
    || !uuidV1(value.projectId) || !Number.isSafeInteger(value.sessionGeneration) || value.sessionGeneration < 1
    || !scopeRefs.every(key => refV1(value[key])) || value.transferRef.version !== 1) return null;
  const scope = cloneV1(value) as ComparisonScope;
  for (const key of scopeRefs) Object.freeze(scope[key]);
  return Object.freeze(scope);
}

function sourceRef(value: unknown): boolean {
  if (refV1(value)) return true;
  try { readPreparationSource(value); return true; } catch { return false; }
}

function refList(value: unknown, validRef: (ref: unknown) => boolean): boolean {
  return arrayV1(value, 200) && value.every(validRef) && new Set(value.map(canonicalJson)).size === value.length;
}

function readCriteria(value: unknown): Map<Code, Criterion> | null;
function readCriteria(value: unknown, assessments: true): Map<Code, Assessment> | null;
function readCriteria(value: unknown, assessments = false): Map<Code, Criterion> | null {
  if (!arrayV1(value, understandingCodes.length) || value.length !== understandingCodes.length) return null;
  const items = new Map<Code, Criterion>();
  for (const item of value) {
    if (!recordV1(item, assessments ? [...itemKeys, 'judgement', 'reason'] : itemKeys)
      || !understandingCodes.includes(item.code) || items.has(item.code)
      || !refList(item.sourceRefs, sourceRef) || !refList(item.responsePartRefs, refV1)) return null;
    if (assessments) {
      if (!judgements.has(item.judgement) || typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 20000) return null;
      try { assertKnowledgeTextSafe(item.reason); } catch { return null; }
    }
    items.set(item.code, cloneV1(item) as Criterion);
  }
  return items;
}

function readObservation(scope: ComparisonScope, value: unknown): Map<Code, Criterion> | null {
  if (!recordV1(value, ['scope', 'criteria']) || !readScope(value.scope)
    || canonicalJson(scope) !== canonicalJson(value.scope)) return null;
  const items = readCriteria(value.criteria);
  if (!items) return null;
  const partIds = [...items.values()].flatMap(item => item.responsePartRefs.map(ref => ref.id));
  return new Set(partIds).size === partIds.length ? items : null;
}

function evidenceFor(original: Criterion | undefined, assessed: Assessment | undefined): Evidence {
  if (!original) return 'UNVERIFIED';
  if (!original.sourceRefs.length || !original.responsePartRefs.length || !assessed) return 'INSUFFICIENT';
  if (canonicalJson(original.sourceRefs) !== canonicalJson(assessed.sourceRefs)
    || canonicalJson(original.responsePartRefs) !== canonicalJson(assessed.responsePartRefs)) return 'MISMATCH';
  return 'VERIFIED';
}

/**
 * 내부 조회자는 호출자의 보호 거래에서 불변 인계본·선택한 대상과 새 세션·동일 전달의
 * 원 응답과 항목별 참조를 검산한 값을 공급한다. 검토 입력은 사람의 판정만 공급한다.
 * 이 함수의 결과는 대조 제안이다. 조회자 인증·검토 저장·이전 확정은 별도 경계다.
 */
export function compareTransferUnderstanding(
  rawScope: unknown,
  rawAssessments: unknown,
  readVerifiedObservation: (scope: ComparisonScope) => unknown,
) {
  const scope = readScope(rawScope);
  const assessments = readCriteria(rawAssessments, true);
  const observation = scope && readObservation(scope, readVerifiedObservation(scope));
  const items = understandingCodes.map(code => {
    const original = observation?.get(code);
    const assessed = assessments?.get(code);
    return {
      code,
      sourceRefs: original?.sourceRefs ?? [],
      responsePartRefs: original?.responsePartRefs ?? [],
      judgement: assessed?.judgement ?? null,
      reason: assessed?.reason ?? null,
      evidence: evidenceFor(original, assessed),
    };
  });
  return {
    scope: observation ? scope : null,
    observation: observation ? 'VERIFIED' : 'UNVERIFIED',
    items,
    status: items.every(item => item.evidence === 'VERIFIED' && item.judgement === 'MATCH') ? 'REVIEW_PROPOSAL' : 'NEEDS_REWORK',
    ready: false,
    transferConfirmed: false,
    resumeAuthorized: false,
    executionAuthorized: false,
    dispatchPerformed: false,
  } as const;
}
