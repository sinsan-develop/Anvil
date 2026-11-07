import type { MethodologyNode } from '../../../../../contracts/methodologies.ts';

/** UI가 명시한 합류 규칙 삭제만 적용한다. 다른 입력의 엄격한 검사는 유지한다. */
export function applyNodeDefinitionPatch(node: MethodologyNode, patch: Partial<MethodologyNode>): MethodologyNode {
  const next = { ...node, ...patch };
  if (Object.hasOwn(patch, 'joinRule') && patch.joinRule === undefined) delete next.joinRule;
  return next;
}
