import { readFile } from 'node:fs/promises';
import { buildApp } from './app.ts';
import { readConfig } from './config.ts';
import { validateDevelopmentDbConfig } from './storage/development-config.ts';
import { Pool } from 'pg';
import { AccessRepository } from './modules/access/repository.ts';
import { validateAuthConfig } from './modules/access/config.ts';
import type { AccessRoutesOptions } from './modules/access/routes.ts';

let pool: Pool | undefined;
try {
  const config = readConfig(process.env);
  const [key, cert] = await Promise.all([readFile(config.tlsKey), readFile(config.tlsCert)]);
  const dbConfig = validateDevelopmentDbConfig(JSON.parse(await readFile(config.dbConfig, 'utf8')), 'app');
  await readFile(new URL('../web/dist/index.html', import.meta.url));
  let access: AccessRoutesOptions | undefined;
  if (process.env.ANVIL_AUTH_CONFIG) {
    const auth = validateAuthConfig(JSON.parse(await readFile(process.env.ANVIL_AUTH_CONFIG, 'utf8')));
    pool = new Pool(dbConfig);
    pool.on('error', () => console.error('ANVIL_DATABASE_CONNECTION_UNAVAILABLE'));
    access = { repository: new AccessRepository(pool, auth), origin: auth.origin, artifactRoot: process.env.ANVIL_ARTIFACT_ROOT, exportRoot: process.env.ANVIL_EXPORT_ROOT };
  }
  const app = buildApp({ https: { key, cert } }, new URL('../web/dist/', import.meta.url), access);
  app.addHook('onClose', async () => { await pool?.end(); });
  await app.listen({ host: config.host, port: config.port });
  console.log('ANVIL_DEVELOPMENT_HTTPS_READY port=3830 scope=process-only');
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
} catch {
  await pool?.end().catch(() => {});
  console.error('ANVIL_START_FAILED: 보호 참조·인증서·포트·build를 확인하세요');
  process.exitCode = 1;
}
