import type { VersionRef } from './generated-types.ts';
import type { MethodologyGraph } from './methodologies.ts';

export type DraftMethodSelection = { kind: 'CONFIRMED_REFERENCE'; versionRef: VersionRef }
  | { kind: 'NEW_PROJECT_DRAFT'; name: string; purpose: string; graph: MethodologyGraph; sourceRefs: VersionRef[]; reviewRefs: [] };
