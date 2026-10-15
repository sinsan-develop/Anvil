export interface ServerConfig {
  host: '127.0.0.1';
  port: 3830;
  tlsKey: string;
  tlsCert: string;
  dbConfig: string;
}

export function readConfig(env: Record<string, string | undefined>): ServerConfig {
  const { ANVIL_TLS_KEY: tlsKey, ANVIL_TLS_CERT: tlsCert, ANVIL_DB_CONFIG: dbConfig } = env;
  if (!tlsKey?.trim() || !tlsCert?.trim() || !dbConfig?.trim()
    || (env.ANVIL_PORT !== undefined && env.ANVIL_PORT !== '3830')
    || (env.ANVIL_HOST !== undefined && env.ANVIL_HOST !== '127.0.0.1')) {
    throw new Error('CONFIG_INVALID: HTTPS·DB 보호 참조·공통 포트를 확인하세요');
  }
  return { host: '127.0.0.1', port: 3830, tlsKey, tlsCert, dbConfig };
}
