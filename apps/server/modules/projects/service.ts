import { timingSafeEqual } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';

export interface ProjectListFilter { query: string; archived: boolean; limit: number }
interface Position { at: string; id: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validPosition(value: Position) { return typeof value.at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(value.at) && Number.isFinite(Date.parse(value.at)) && uuid.test(value.id); }
export function projectListFilter(input: Record<string, unknown>): ProjectListFilter {
  if (Object.keys(input).some(key => !['query', 'archived', 'limit', 'cursor'].includes(key))
    || input.query !== undefined && (typeof input.query !== 'string' || input.query.length > 200 || !input.query.isWellFormed())
    || input.archived !== undefined && (typeof input.archived !== 'string' || !['true', 'false'].includes(input.archived))
    || input.limit !== undefined && (typeof input.limit !== 'string' || !/^[1-9]\d{0,2}$/.test(input.limit))
    || input.cursor !== undefined && (typeof input.cursor !== 'string' || input.cursor.length > 4096)) throw Error('INPUT_INVALID');
  const limit = input.limit === undefined ? 50 : Number(input.limit);
  if (limit > 200) throw Error('INPUT_INVALID');
  return { query: typeof input.query === 'string' ? input.query : '', archived: input.archived === 'true', limit };
}
export class ProjectListCodec {
  #sign: (value: string) => string;
  constructor(sign: (value: string) => string) { this.#sign = sign; }
  create(actorId: string, filter: ProjectListFilter, last: Position, now = new Date()): string {
    if (!validPosition(last)) throw Error('CURSOR_INVALID');
    const text = Buffer.from(canonicalJson({ version: 1, actorId, filterHash: contentHash(canonicalJson(filter)), last, expiresAt: now.getTime() + 30 * 60000 })).toString('base64url');
    return text + '.' + this.#sign(text);
  }
  read(cursor: string, actorId: string, filter: ProjectListFilter, now = new Date()): Position {
    try {
      if (typeof cursor !== 'string' || cursor.length > 4096) throw Error();
      const match = /^([A-Za-z0-9_-]+)\.([0-9a-f]{64})$/.exec(cursor);
      if (!match || !timingSafeEqual(Buffer.from(match[2]!, 'hex'), Buffer.from(this.#sign(match[1]!), 'hex'))) throw Error();
      const decoded = Buffer.from(match[1]!, 'base64url');
      if (decoded.toString('base64url') !== match[1]) throw Error();
      const value = JSON.parse(decoded.toString('utf8'));
      if (Object.keys(value).sort().join(',') !== 'actorId,expiresAt,filterHash,last,version' || value.version !== 1 || value.actorId !== actorId
        || value.filterHash !== contentHash(canonicalJson(filter)) || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now.getTime()
        || !value.last || Object.keys(value.last).sort().join(',') !== 'at,id' || !validPosition(value.last)) throw Error();
      return value.last;
    } catch { throw Error('CURSOR_INVALID'); }
  }
}
