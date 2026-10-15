export function validateAuthConfig(value: unknown): { installationId: string; key: Buffer; origin: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('AUTH_CONFIG_INVALID');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(',') !== 'fingerprintKey,installationId,kind,origin'
    || record.kind !== 'ANVIL_AUTH_KEY_V1'
    || typeof record.installationId !== 'string'
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.installationId)
    || typeof record.fingerprintKey !== 'string' || !/^[0-9a-f]{64}$/.test(record.fingerprintKey)
    || record.origin !== 'https://localhost:3830') throw Error('AUTH_CONFIG_INVALID');
  return { installationId: record.installationId, key: Buffer.from(record.fingerprintKey, 'hex'), origin: record.origin };
}
