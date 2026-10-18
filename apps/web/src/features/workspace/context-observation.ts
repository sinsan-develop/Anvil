import type { ContextPreparationPage, ContextPreparationView } from './context-api.ts';

export interface ContextObservationState {
 sequence: number;
 opened: ContextPreparationView | null;
 page: ContextPreparationPage | null;
}
export type ContextObservationAction =
 | { kind: 'BEGIN'; sequence: number }
 | { kind: 'OPENED'; sequence: number; value: ContextPreparationView }
 | { kind: 'LISTED'; sequence: number; value: ContextPreparationPage };

export function contextObservation(state: ContextObservationState, action: ContextObservationAction): ContextObservationState {
 if (!Number.isSafeInteger(action.sequence) || action.sequence < 1) return state;
 if (action.kind === 'BEGIN') return action.sequence > state.sequence ? { sequence: action.sequence, opened: null, page: null } : state;
 if (action.sequence !== state.sequence) return state;
 return action.kind === 'OPENED' ? { ...state, opened: action.value, page: null } : { ...state, opened: null, page: action.value };
}
