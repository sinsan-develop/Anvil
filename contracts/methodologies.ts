import type { VersionRef } from './generated-types.ts';

export interface MethodologyDocumentItem {
  itemId: string; formRef: VersionRef; required: boolean; sourceNodeId?: string; reviewCriteria: string[];
}
export type GraphCondition = { kind: 'REVIEW_DECISION'; nodeId: string; outcome: 'ACCEPTED' | 'REWORK' | 'BLOCKED' }
  | { kind: 'USER_CHOICE'; nodeId: string; choiceId: string };
export interface MethodologyNode {
  nodeId: string; name: string; purpose: string; kind: 'HUMAN' | 'AGENT' | 'DECISION' | 'JOIN';
  position: { x: number; y: number }; role: 'USER' | 'COORDINATOR' | 'STAGE_OWNER';
  inputs: MethodologyDocumentItem[]; outputs: MethodologyDocumentItem[];
  taskScope: { included: string[]; excluded: string[] }; completionCriteria: string[];
  approvalBoundary: string[]; mode: 'AUTO' | 'CASE_BY_CASE'; limitPolicyRef: VersionRef | null;
  recordRequirements: string[]; requirements?: { capabilities: string[]; environment: string[] };
  joinRule?: { mode: 'ALL' | 'DECLARED_CONDITION'; condition?: GraphCondition };
}
export interface MethodologyEdge {
  edgeId: string; fromNodeId: string; toNodeId: string; kind: 'SEQUENCE' | 'BRANCH' | 'JOIN' | 'REWORK';
  condition: GraphCondition | null; reason: string;
  retryPolicy?: { maxAttempts: number; onExhausted: 'USER_DECISION'; counting: 'SAME_FAILURE_FINGERPRINT' };
}
export interface MethodologyGraph {
  nodes: MethodologyNode[]; edges: MethodologyEdge[]; entryNodeId: string; terminalNodeIds: string[];
}
export interface BuiltinMethodology {
  id: string; version: number; systemCode: string; name: string; purpose: string;
  graph: MethodologyGraph; contentHash: string; sourceHash: string;
  runtimeReadiness: 'PROJECT_BINDINGS_REQUIRED';
}
