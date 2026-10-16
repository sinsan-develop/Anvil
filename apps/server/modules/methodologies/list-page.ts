import { timingSafeEqual } from 'node:crypto';
import { canonicalJson, contentHash } from '../../../../contracts/canonical.ts';

export interface MethodListFilter { scope: string | null; name: string; status: string | null; limit: number }
interface Position { key: string; id: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const position = (value: Position) => !!value && Object.keys(value).sort().join(',') === 'id,key' && typeof value.key === 'string' && /^(SYS-M0[1-3]|~)$/.test(value.key) && uuid.test(value.id);
export function methodListFilter(raw: Record<string, unknown>): MethodListFilter {
  if (Object.keys(raw).some(key => !['scope', 'name', 'status', 'limit', 'cursor'].includes(key))
    || raw.scope !== undefined && !['SYSTEM', 'USER_COMMON'].includes(String(raw.scope)) || raw.status !== undefined && !['DRAFT', 'CONFIRMED'].includes(String(raw.status))
    || raw.name !== undefined && (typeof raw.name !== 'string' || raw.name.length > 200 || !raw.name.isWellFormed())
    || raw.limit !== undefined && (typeof raw.limit !== 'string' || !/^[1-9][0-9]{0,2}$/.test(raw.limit) || Number(raw.limit) > 200)
    || raw.cursor !== undefined && (typeof raw.cursor !== 'string' || !raw.cursor.length || raw.cursor.length > 4096)) throw Error('FILTER_INVALID');
  return { scope: raw.scope === undefined ? null : String(raw.scope), name: raw.name === undefined ? '' : String(raw.name), status: raw.status === undefined ? null : String(raw.status), limit: raw.limit === undefined ? 50 : Number(raw.limit) };
}
export class MethodListCodec {
  #sign: (value: string) => string;
  constructor(sign: (value: string) => string) { this.#sign = sign; }
  create(actorId: string, filter: MethodListFilter, last: Position, now = new Date()) {
    if (!uuid.test(actorId) || !position(last)) throw Error('CURSOR_INVALID');
    const encoded = Buffer.from(canonicalJson({ version: 1, kind: 'METHOD_LIST', actorId, filterHash: contentHash(canonicalJson(filter)), last, expiresAt: now.getTime() + 30 * 60000 })).toString('base64url');
    return encoded + '.' + this.#sign(encoded);
  }
  read(cursor: string, actorId: string, filter: MethodListFilter, now = new Date()): Position {
    try {
      if (typeof cursor !== 'string' || cursor.length > 4096) throw Error();
      const parts = /^([A-Za-z0-9_-]+)\.([0-9a-f]{64})$/.exec(cursor);
      if (!parts || !timingSafeEqual(Buffer.from(parts[2]!, 'hex'), Buffer.from(this.#sign(parts[1]!), 'hex'))) throw Error();
      const bytes = Buffer.from(parts[1]!, 'base64url'); if (bytes.toString('base64url') !== parts[1]) throw Error();
      const value = JSON.parse(bytes.toString('utf8'));
      if (!value || Object.keys(value).sort().join(',') !== 'actorId,expiresAt,filterHash,kind,last,version' || value.version !== 1 || value.kind !== 'METHOD_LIST' || value.actorId !== actorId || !uuid.test(actorId)
        || value.filterHash !== contentHash(canonicalJson(filter)) || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now.getTime() || !position(value.last)) throw Error();
      return value.last;
    } catch { throw Error('CURSOR_INVALID'); }
  }
}
