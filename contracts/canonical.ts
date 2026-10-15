import { createHash } from 'node:crypto';

function invalid(): never { throw new Error('INPUT_INVALID'); }

export function canonicalJson(value: unknown): string {
  const active = new Set<object>();
  function encode(item: unknown, depth: number): string {
    if (depth > 64) return invalid();
    if (item === null || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'string') return item.isWellFormed() ? JSON.stringify(item) : invalid();
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item))) return invalid();
      return JSON.stringify(item);
    }
    if (typeof item !== 'object' || active.has(item) || Object.getOwnPropertySymbols(item).length) return invalid();
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) return invalid();
    active.add(item);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(item);
      if (Array.isArray(item)) {
        if (Object.keys(descriptors).length !== item.length + 1) return invalid();
        const parts = [];
        for (let n = 0; n < item.length; n++) {
          const descriptor = descriptors[String(n)];
          if (!descriptor || !('value' in descriptor)) return invalid();
          parts.push(encode(descriptor.value, depth + 1));
        }
        return '[' + parts.join(',') + ']';
      }
      const parts = Object.keys(descriptors).sort().map(key => {
        const descriptor = descriptors[key]!;
        if (!key.isWellFormed() || !descriptor.enumerable || !('value' in descriptor)) return invalid();
        return JSON.stringify(key) + ':' + encode(descriptor.value, depth + 1);
      });
      return '{' + parts.join(',') + '}';
    } finally { active.delete(item); }
  }
  return encode(value, 0);
}

export function contentHash(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function parseWireJson(raw: string): unknown {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return invalid(); }
  const stack: { keys: Set<string> | null; expectKey: boolean }[] = [];
  const tokens = raw.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) ?? [];
  for (const token of tokens) {
    if (token === '{' || token === '[') stack.push({ keys: token === '{' ? new Set() : null, expectKey: token === '{' });
    else if (token === '}' || token === ']') stack.pop();
    else {
      const frame = stack.at(-1);
      if (!frame?.keys) continue;
      if (token === ',') frame.expectKey = true;
      else if (token === ':') frame.expectKey = false;
      else if (frame.expectKey && token.startsWith('"')) {
        const key: string = JSON.parse(token);
        if (frame.keys.has(key)) return invalid();
        frame.keys.add(key);
      }
    }
  }
  canonicalJson(value);
  return value;
}
