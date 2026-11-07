export interface ResultPagePosition { cursors: readonly (string | null)[]; index: number }
export function initialResultPagePosition(): ResultPagePosition { return { cursors: [null], index: 0 }; }
export function olderResultPage(position: ResultPagePosition, nextCursor: string): ResultPagePosition {
  if (typeof nextCursor !== 'string' || !nextCursor.length || nextCursor.length > 4096) throw new Error('RESULT_CURSOR_INVALID');
  return { cursors: [...position.cursors.slice(0, position.index + 1), nextCursor], index: position.index + 1 };
}
export function newerResultPage(position: ResultPagePosition): ResultPagePosition {
  return position.index > 0 ? { cursors: position.cursors, index: position.index - 1 } : position;
}
