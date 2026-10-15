import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, writeFileSync } from 'node:fs';
import { validateDevelopmentDbConfig } from '../apps/server/storage/development-config.ts';

const root = 'D:\\Project\\Anvil\\.av3-data';
const target = root + '\\db-app.json';
if (process.platform !== 'win32' || !existsSync(root) || lstatSync(root).isSymbolicLink() || existsSync(target)) throw Error('LOCAL_PROTECTED_TARGET_NOT_NEW');
try {
  const bytes = execFileSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', 'WSL-server',
    'cat /home/daon/.local/share/anvil-v3-development/app.json'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  const config = validateDevelopmentDbConfig(JSON.parse(bytes), 'app');
  writeFileSync(target, JSON.stringify(config), { encoding: 'utf8', flag: 'wx' });
  console.log('DEVELOPMENT_APP_DB_REFERENCE_PREPARED_NO_SECRET_OUTPUT');
} catch {
  console.error('DEVELOPMENT_DB_LINK_FAILED_NO_SECRET_OUTPUT');
  process.exitCode = 1;
}
