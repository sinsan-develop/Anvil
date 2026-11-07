import { types } from 'node:util';
import { canonicalJson } from '../../../../contracts/canonical.ts';
import { readSourceScopesV1, type SourceScopeV1 } from '../../../../contracts/runtime/source-scope-v1.ts';
import { arrayV1 } from '../../../../contracts/runtime/validation-v1.ts';

type ReasonCode = 'EXACT_SCOPE_SUBSET' | 'PARENT_SCOPE_INVALID' | 'CHILD_SCOPE_INVALID' | 'SOURCE_BINDING_CHANGED' | 'TARGET_NOT_CONTAINED';
export interface SourceScopeContainment {
  readonly scopeContained: boolean;
  readonly reasonCode: ReasonCode;
  readonly executionAuthorized: false;
}
const result = (scopeContained: boolean, reasonCode: ReasonCode): SourceScopeContainment => ({ scopeContained, reasonCode, executionAuthorized: false });

function readScopes(value: unknown): SourceScopeV1[] {
  const seen = new Set<object>();
  const inspect = (item: unknown, depth: number): void => {
    if (item === null || typeof item !== 'object' && typeof item !== 'function') return;
    // isProxy는 reflection/get trap보다 먼저 검사한다. 정상 최대200 FILE의
    // 객체 수(최대1401)보다 여유 있는 유한 preflight이며 OS 메모리 quota는 아니다.
    if (types.isProxy(item) || depth > 64) throw Error('SOURCE_SCOPE_INVALID');
    if (seen.has(item)) return;
    if (seen.size >= 2000) throw Error('SOURCE_SCOPE_INVALID');
    seen.add(item);
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(item))) {
      if (!('value' in descriptor)) throw Error('SOURCE_SCOPE_INVALID');
      inspect(descriptor.value, depth + 1);
    }
  };
  inspect(value, 0);
  // 표준 JSON 배열만 소비한다. 검증 전에 사용자 iterator/getter를 호출하지 않는다.
  if (!arrayV1(value, 200) || Object.getPrototypeOf(value) !== Array.prototype) throw Error('SOURCE_SCOPE_INVALID');
  for (let index = 0; index < value.length; index++) {
    const scope = Object.getOwnPropertyDescriptor(value, String(index))!.value;
    const descriptor = scope && typeof scope === 'object' ? Object.getOwnPropertyDescriptor(scope, 'targets') : null;
    if (!descriptor || !('value' in descriptor) || !arrayV1(descriptor.value, 200) || Object.getPrototypeOf(descriptor.value) !== Array.prototype) throw Error('SOURCE_SCOPE_INVALID');
  }
  return readSourceScopesV1(value);
}

/**
 * FN09 하위 임무 준비용 구조 비교다. 서버 권한·프로젝트/세대·기한·예산·
 * sibling writer·실제 경로/OS 관측은 검사하지 않으며 위임/실행을 허가하지 않는다.
 * WRITE에서 READ나 경로 대소문자 동등성을 추정하지 않는다. 현재 지원 FILE만 비교한다.
 */
export function inspectSourceScopeContainment(parentValue: unknown, childValue: unknown): SourceScopeContainment {
  let parent: SourceScopeV1[], child: SourceScopeV1[];
  try { parent = readScopes(parentValue); } catch { return result(false, 'PARENT_SCOPE_INVALID'); }
  try { child = readScopes(childValue); } catch { return result(false, 'CHILD_SCOPE_INVALID'); }
  const byRoot = new Map(parent.map(scope => [scope.sourceRootRef.id, scope]));
  for (const scope of child) {
    const original = byRoot.get(scope.sourceRootRef.id);
    if (!original || (['sourceRootRef', 'mappingRef', 'observationRef', 'baselineRef'] as const).some(field => canonicalJson(original[field]) !== canonicalJson(scope[field]))) return result(false, 'SOURCE_BINDING_CHANGED');
    const targets = new Map(original.targets.map(target => [target.relativePath, target.access]));
    if (scope.targets.some(target => targets.get(target.relativePath) !== target.access)) return result(false, 'TARGET_NOT_CONTAINED');
  }
  return result(true, 'EXACT_SCOPE_SUBSET');
}
