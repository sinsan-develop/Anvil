export function assertResourceAbsent(names: unknown, name: string): void {
  if (typeof names !== 'string') throw Error('RESOURCE_QUERY_INVALID');
  if (names.split(/\r?\n/).includes(name)) throw Error('RESOURCE_ALREADY_EXISTS');
}
export function assertNewResourceLabels(labels: unknown, instance: string): void {
  if (!labels || typeof labels !== 'object') throw Error('RESOURCE_OWNERSHIP_MISMATCH');
  const map = labels as Record<string, unknown>;
  if (map['anvil.project'] !== 'v3' || map['anvil.owner'] !== 'P03' || map['anvil.instance'] !== instance) throw Error('RESOURCE_OWNERSHIP_MISMATCH');
}
