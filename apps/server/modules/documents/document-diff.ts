export function documentTextDiff(base: string, proposed: string): { format: 'ANVIL_TEXT_DIFF_1'; startLine: number; before: string[]; after: string[]; unchangedBefore: number; unchangedAfter: number } {
  const lines = (text: string) => text ? text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g)! : [];
  const before = lines(base), after = lines(proposed); let prefix = 0, suffix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  return { format: 'ANVIL_TEXT_DIFF_1', startLine: prefix + 1, before: before.slice(prefix, before.length - suffix), after: after.slice(prefix, after.length - suffix), unchangedBefore: prefix, unchangedAfter: suffix };
}
