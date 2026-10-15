export function assertResourceAbsent(names: unknown, name: string): void {
  if (typeof names !== 'string') throw Error('RESOURCE_QUERY_INVALID');
  if (names.split(/\r?\n/).includes(name)) throw Error('RESOURCE_ALREADY_EXISTS');
}
export function assertNewResourceLabels(labels: unknown, instance: string): void {
  if (!labels || typeof labels !== 'object') throw Error('RESOURCE_OWNERSHIP_MISMATCH');
  const map = labels as Record<string, unknown>;
  if (map['anvil.project'] !== 'v3' || map['anvil.owner'] !== 'P03' || map['anvil.instance'] !== instance) throw Error('RESOURCE_OWNERSHIP_MISMATCH');
}
export function checkPostgresReady(run: (args: string[]) => string, container: string, database: string): void {
  run(['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'anvil_v3_bootstrap', '-d', database]);
}
