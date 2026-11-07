import { canonicalJson } from '../../../../contracts/canonical.ts';
import type { VersionRef } from '../../../../contracts/generated-types.ts';
import { isVersionRef } from '../../../../contracts/references.ts';
import { AuthFailure } from '../access/repository.ts';
import { assertKnowledgeTextSafe, exact, uuid } from '../knowledge/knowledge-entry.ts';

export type BaselineFeatureState = 'IMPLEMENTED_CORE_CHECKED' | 'IMPLEMENTED_UNCHECKED' | 'PARTIAL' | 'NOT_IMPLEMENTED';
export interface BaselineEvidenceRef { artifactId: string; bytes: number; contentHash: string; mediaType: string }
export interface BaselineSource {
  kind: 'NONE_SELECTED' | 'DECLARATION_ONLY' | 'ATTRIBUTE_REPORT';
  declarationRef: VersionRef | null;
  sourceRootRef: VersionRef | null;
  snapshotRef: VersionRef | null;
  grantRef: VersionRef | null;
  unverifiedReason: string;
}
export interface BaselineItem {
  itemId: string; title: string; designRef: VersionRef | null;
  featureState: BaselineFeatureState; evidenceRefs: BaselineEvidenceRef[];
  limitations: string; reason: string;
}
export interface BaselineDraftInput {
  baseRef: VersionRef | null; source: BaselineSource; items: BaselineItem[];
  coverageReason: string; reason: string;
}
export interface BaselineDraftAnalysis {
  input: BaselineDraftInput;
  issues: { code: 'CONTENT_REVIEW_REQUIRED' | 'SOURCE_UNVERIFIED' | 'COVERAGE_UNVERIFIED' | 'EXECUTION_NOT_CONNECTED'; location: string }[];
  contentConfirmed: false; sourceAuthorizationVerified: false; coverageVerified: false;
  executionAuthorized: false; dispatchPerformed: false;
}
function invalid(): never { throw new AuthFailure('BASELINE_INPUT_INVALID', 422); }
function text(value: unknown, limit: number, noControl = false): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= limit && value.isWellFormed()
    && (!noControl || !/[\u0000-\u001f\u007f]/.test(value));
}
function nullableRef(value: unknown): value is VersionRef | null { return value === null || isVersionRef(value); }
function source(value: unknown): value is BaselineSource {
  if (!exact(value, ['kind', 'declarationRef', 'sourceRootRef', 'snapshotRef', 'grantRef', 'unverifiedReason'])
    || !text(value.unverifiedReason, 20000)) return false;
  const { declarationRef, sourceRootRef, snapshotRef, grantRef } = value;
  if (value.kind === 'NONE_SELECTED') return [declarationRef, sourceRootRef, snapshotRef, grantRef].every(ref => ref === null);
  if (value.kind === 'DECLARATION_ONLY') return isVersionRef(declarationRef) && [sourceRootRef, snapshotRef, grantRef].every(ref => ref === null);
  return value.kind === 'ATTRIBUTE_REPORT' && nullableRef(declarationRef) && isVersionRef(sourceRootRef)
    && isVersionRef(snapshotRef) && snapshotRef.version === 1 && isVersionRef(grantRef) && grantRef.version === 1;
}
function evidence(value: unknown): value is BaselineEvidenceRef {
  return exact(value, ['artifactId', 'bytes', 'contentHash', 'mediaType']) && uuid(value.artifactId)
    && Number.isSafeInteger(value.bytes) && Number(value.bytes) >= 0 && Number(value.bytes) <= 20 * 1024 * 1024
    && typeof value.contentHash === 'string' && /^[0-9a-f]{64}$/.test(value.contentHash) && text(value.mediaType, 200, true);
}
function checkKnownMarkers(value: unknown): void {
  if (typeof value === 'string') assertKnowledgeTextSafe(value);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) checkKnownMarkers(item);
}

// 순수 입력 분석이다. 실제 원문 접근·내용 검토·완전성·실행 허가는 후속 계층에서 따로 확인한다.
export function readBaselineDraftInput(value: unknown): BaselineDraftAnalysis {
  let wire: string;
  try { wire = canonicalJson(value); } catch { return invalid(); }
  if (Buffer.byteLength(wire, 'utf8') > 2 * 1024 * 1024) return invalid();
  // getter를 다시 실행하거나 원입력과 참조를 공유하지 않는 JSON snapshot만 검사한다.
  const input: unknown = JSON.parse(wire);
  if (!exact(input, ['baseRef', 'source', 'items', 'coverageReason', 'reason']) || !nullableRef(input.baseRef)
    || !source(input.source) || !text(input.coverageReason, 20000) || !text(input.reason, 20000)
    || !Array.isArray(input.items) || input.items.length < 1 || input.items.length > 200) return invalid();
  let evidenceCount = 0;
  const itemIds = new Set<string>();
  for (const item of input.items) {
    if (!exact(item, ['itemId', 'title', 'designRef', 'featureState', 'evidenceRefs', 'limitations', 'reason'])
      || !text(item.itemId, 200, true) || itemIds.has(item.itemId) || !text(item.title, 200)
      || !nullableRef(item.designRef) || typeof item.featureState !== 'string' || !['IMPLEMENTED_CORE_CHECKED', 'IMPLEMENTED_UNCHECKED', 'PARTIAL', 'NOT_IMPLEMENTED'].includes(item.featureState)
      || !text(item.limitations, 20000) || !text(item.reason, 20000)
      || !Array.isArray(item.evidenceRefs) || item.evidenceRefs.length > 200
      || item.featureState === 'IMPLEMENTED_CORE_CHECKED' && !item.evidenceRefs.length) return invalid();
    itemIds.add(item.itemId);
    evidenceCount += item.evidenceRefs.length;
    if (evidenceCount > 200) return invalid();
    const evidenceIds = new Set<string>();
    for (const ref of item.evidenceRefs) {
      if (!evidence(ref) || evidenceIds.has(ref.artifactId)) return invalid();
      evidenceIds.add(ref.artifactId);
    }
  }
  try { checkKnownMarkers(input); } catch { throw new AuthFailure('BASELINE_SENSITIVE_CONTENT_SUSPECTED', 412); }
  return {
    input: input as unknown as BaselineDraftInput,
    issues: [
      { code: 'CONTENT_REVIEW_REQUIRED', location: 'items' },
      { code: 'SOURCE_UNVERIFIED', location: 'source' },
      { code: 'COVERAGE_UNVERIFIED', location: 'coverageReason' },
      { code: 'EXECUTION_NOT_CONNECTED', location: 'execution' },
    ],
    contentConfirmed: false, sourceAuthorizationVerified: false, coverageVerified: false,
    executionAuthorized: false, dispatchPerformed: false,
  };
}
