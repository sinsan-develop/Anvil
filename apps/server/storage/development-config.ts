import type { ClientConfig } from 'pg';
export function validateDevelopmentDbConfig(value: unknown, role: 'app' | 'migrator'): ClientConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('DB_TARGET_INVALID');
  const input = value as Record<string, unknown>;
  const user = role === 'app' ? 'anvil_v3_app' : 'anvil_v3_migrator';
  const fields = ['host', 'port', 'database', 'user', 'password', 'application_name', 'connectionTimeoutMillis'];
  if (Object.keys(input).some(key => !fields.includes(key))
    || input.host !== '127.0.0.1' || input.port !== 5546 || input.database !== 'anvil_v3_development'
    || input.user !== user
    || typeof input.password !== 'string' || !/^[0-9a-f]{64}$/.test(input.password)
    || input.application_name !== 'anvil-v3-development' || input.connectionTimeoutMillis !== 5000) throw Error('DB_TARGET_INVALID');
  return { host: input.host, port: input.port, database: input.database, user, password: input.password,
    application_name: input.application_name, connectionTimeoutMillis: input.connectionTimeoutMillis };
}
