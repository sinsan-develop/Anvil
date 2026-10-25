import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sources = [
  { name: '0000_environment.sql', sha256: '6EBBB9C580D54A50E0431806EE982244CBE134613354F8C3A8CD4F547E30178D', ledgerId: '0000_environment' },
  { name: '0001_projects_access.sql', sha256: '353D28D657794D47B84DB0C8A4D9481C8EBC9BF73278614578C6CF5CFD4C3643', ledgerId: '0001_projects_access' },
  { name: '0017_execution_authority.sql', sha256: '40C8666FE6FB8F9D1D027D9F15D03E8A71F2B608887343E9A92B49C72220B1F3' },
  { name: '0025_result_submissions.sql', sha256: '426EC20615003F0FEF5F87F175A7E11F425DA51DBC952F1530C292821932325A' },
  { name: '0041_control_handoff_source.sql.pending', sha256: 'C6BD081FC7A70F8EAA68AC673CCE6F8E41549D98F2C3E5BB3C22833874B0E522', ledgerId: '0041_control_handoff_source' },
] as const;

const helpers = [
  { source: '0017_execution_authority.sql', name: 'execution_authority_number', byteLength: 1291, sha256: '74B807BF93A45F00DFFE85098E8074C4CF9BF34328192B6D53E5DBB3F2F15D36' },
  { source: '0017_execution_authority.sql', name: 'execution_authority_canonical', byteLength: 710, sha256: '22FD8BFCF5D6AE400682988591BF4C0F502AEF5A898B46A3AD1EF3D2BB84FB88' },
  { source: '0017_execution_authority.sql', name: 'execution_json_shape', byteLength: 321, sha256: 'D163F70DA99CC75A398487AB81E0479735F4AE86838E3738A2E190F258A20B9F' },
  { source: '0017_execution_authority.sql', name: 'execution_json_hash', byteLength: 201, sha256: '4FDA5D98B93CAD6340532CD88C330A44EFBBB9E06190FB154244FE7D6C16567A' },
  { source: '0017_execution_authority.sql', name: 'execution_iso_valid', byteLength: 485, sha256: '4C61F83BD6FDF7FBBD3AE62FFF38960F0E530AF757D1A3F78A1E3C9F15B615A9' },
  { source: '0025_result_submissions.sql', name: 'result_text_valid', byteLength: 434, sha256: '4F55FF7A63EDB4900BE8027BC4FCACCEC7CE41FC32BF1B5D8A4C6936F59EF0F0' },
  { source: '0025_result_submissions.sql', name: 'result_texts_safe', byteLength: 802, sha256: '7F7BBEB95B81F4E0E61D3B8EB46C06EE9C7F5101FB941A1BB5DA3976E940A7FC' },
] as const;

export type Fn15SourceName = typeof sources[number]['name'];
export type Fn15SourceBytes = Readonly<Record<Fn15SourceName, Uint8Array>>;

export interface Fn15QaManifest {
  readonly sourceFiles: readonly { readonly name: Fn15SourceName; readonly byteLength: number; readonly sha256: string }[];
  readonly fullSql: readonly { readonly id: string; readonly source: Fn15SourceName; readonly sql: string; readonly sha256: string }[];
  readonly ledger: readonly { readonly id: string; readonly checksum: string }[];
  readonly helpers: {
    readonly status: 'PARTIAL_HELPERS_ONLY';
    readonly blocks: readonly { readonly source: Fn15SourceName; readonly name: string; readonly byteLength: number; readonly sha256: string }[];
    readonly byteLength: 4250;
    readonly sha256: '282F65A34BEDE0D3A086307BBBC66A6C43C69AFA8CDDCDF1EF9AE8D8C9D71D0F';
    readonly sql: string;
  };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

export function buildFn15QaManifest(input: Readonly<Record<string, Uint8Array>>): Fn15QaManifest {
  const expected = sources.map((source) => source.name).sort();
  const received = Object.keys(input).sort();
  if (received.length !== expected.length || received.some((name, index) => name !== expected[index])) {
    throw new Error('FN15_QA_SOURCE_SET_MISMATCH');
  }
  const verified = new Map<Fn15SourceName, Buffer>();
  for (const source of sources) {
    const bytes = input[source.name];
    if (!(bytes instanceof Uint8Array) || sha256(bytes) !== source.sha256) {
      throw new Error(`FN15_QA_SOURCE_HASH_MISMATCH:${source.name}`);
    }
    verified.set(source.name, Buffer.from(bytes));
  }

  const blocks: { source: Fn15SourceName; name: string; byteLength: number; sha256: string }[] = [];
  const blockBytes: Buffer[] = [];
  for (const helper of helpers) {
    const original = verified.get(helper.source);
    if (!original) throw new Error('FN15_QA_SOURCE_MISSING');
    const expression = new RegExp(`^CREATE FUNCTION anvil\\.${helper.name}\\b[^\\r\\n]* AS \\$\\$\\r?\\n[\\s\\S]*?^\\$\\$;\\r?\\n`, 'gm');
    const text = original.toString('utf8');
    const matches = [...text.matchAll(expression)];
    if (matches.length !== 1 || !matches[0]?.[0]) throw new Error(`FN15_QA_HELPER_COUNT_MISMATCH:${helper.name}`);
    const bytes = Buffer.from(matches[0][0], 'utf8');
    if (bytes.length !== helper.byteLength || sha256(bytes) !== helper.sha256) {
      throw new Error(`FN15_QA_HELPER_HASH_MISMATCH:${helper.name}`);
    }
    blocks.push({ source: helper.source, name: helper.name, byteLength: bytes.length, sha256: helper.sha256 });
    blockBytes.push(bytes);
  }
  const joined = Buffer.concat(blockBytes.flatMap((bytes, index) => index === 0 ? [bytes] : [Buffer.from('\n'), bytes]));
  const joinedHash = '282F65A34BEDE0D3A086307BBBC66A6C43C69AFA8CDDCDF1EF9AE8D8C9D71D0F';
  if (joined.length !== 4250 || sha256(joined) !== joinedHash) throw new Error('FN15_QA_HELPER_COMBINED_MISMATCH');

  const fullSql = sources.flatMap((source) => {
    if (!('ledgerId' in source)) return [];
    const bytes = verified.get(source.name);
    if (!bytes) throw new Error('FN15_QA_SOURCE_MISSING');
    return [{ id: source.ledgerId, source: source.name, sql: bytes.toString('utf8'), sha256: source.sha256 }];
  });
  return {
    sourceFiles: sources.map((source) => ({ name: source.name, byteLength: verified.get(source.name)?.length ?? 0, sha256: source.sha256 })),
    fullSql,
    ledger: fullSql.map(({ id, sha256: checksum }) => ({ id, checksum: checksum.toLowerCase() })),
    helpers: { status: 'PARTIAL_HELPERS_ONLY', blocks, byteLength: 4250, sha256: joinedHash, sql: joined.toString('utf8') },
  };
}

// The only filesystem read is this explicit call. Imports never read source files or invoke external effects.
export function readFn15QaManifest(): Fn15QaManifest {
  const input: Record<string, Uint8Array> = {};
  for (const source of sources) {
    input[source.name] = readFileSync(new URL(`../db/migrations/${source.name}`, import.meta.url));
  }
  return buildFn15QaManifest(input);
}
