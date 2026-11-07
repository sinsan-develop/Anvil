import { execFileSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Pool } from 'pg';
import { validateDevelopmentDbConfig } from '../apps/server/storage/development-config.ts';
import { generateAuthBundle, persistNewAuthFiles } from '../apps/server/modules/access/setup.ts';

// 신산님이 승인한 신규 두 파일/초기화 행만 만든다. 재발급/계정 생성 도구가 아니다.
const root = 'D:\\Project\\Anvil\\.av3-data';
let pool: Pool | undefined;
let releaseFiles: (() => Promise<void>) | undefined;
let commitAttempted = false;
let phase = 'ROOT';
try {
  if (process.platform !== 'win32' || (await realpath(root)).toLowerCase() !== resolve(root).toLowerCase() || !(await lstat(root)).isDirectory()) throw Error('AUTH_ROOT_INVALID');
  phase = 'PROTECTED_ACL';
  execFileSync('C:/Program Files/PowerShell/7/pwsh.exe', ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference='Stop'
    $target='D:\\Project\\Anvil\\.av3-data'
    $owner=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $acl=Get-Acl -LiteralPath $target
    if (!$acl.AreAccessRulesProtected) { throw 'ROOT_NOT_PROTECTED' }
    foreach($rule in $acl.Access) {
      $sid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
      if ($rule.AccessControlType -ne 'Allow' -or $sid -notin @($owner,'S-1-5-18')) { throw 'UNEXPECTED_ACCESS' }
    }
    foreach($file in @('db-app.json')) {
      $path=Join-Path $target $file
      if ((Get-Item -LiteralPath $path).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'LINK_NOT_ALLOWED' }
      foreach($rule in (Get-Acl -LiteralPath $path).Access) {
        $sid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
        if ($rule.AccessControlType -ne 'Allow' -or $sid -notin @($owner,'S-1-5-18')) { throw 'UNEXPECTED_ACCESS' }
      }
    }
  `], { stdio: 'pipe', windowsHide: true });
  phase = 'DB_CONFIG';
  const config = validateDevelopmentDbConfig(JSON.parse(await readFile(join(root, 'db-app.json'), 'utf8')), 'app');
  pool = new Pool(config);
  pool.on('error', () => {});
  phase = 'DB_CONNECT';
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    phase = 'DB_LOCK';
    await db.query('LOCK TABLE anvil.users,anvil.installation_claims IN SHARE ROW EXCLUSIVE MODE');
    phase = 'DB_IDENTITY';
    const identity = (await db.query('SELECT current_database() AS db,current_user AS role')).rows[0];
    if (identity.db !== 'anvil_v3_development' || identity.role !== 'anvil_v3_app') throw Error('DB_TARGET_INVALID');
    const current = (await db.query('SELECT (SELECT count(*)::int FROM anvil.users) AS users,(SELECT count(*)::int FROM anvil.installation_claims) AS claims')).rows[0];
    if (current.users !== 0 || current.claims !== 0) throw Error('AUTH_INITIALIZATION_ALREADY_PRESENT');
    if (process.argv.includes('--check')) {
      await db.query('ROLLBACK');
      console.log('AUTH_INITIALIZATION_PREFLIGHT_OK filesWritten=0 rowsWritten=0');
    } else {
    phase = 'NEW_FILES';
    const bundle = generateAuthBundle(new Date());
    releaseFiles = await persistNewAuthFiles(root, bundle);
    phase = 'NEW_RECORD';
    await db.query('INSERT INTO anvil.installation_claims(installation_id,bootstrap_digest,expires_at) VALUES($1,$2,$3)', [bundle.auth.installationId, bundle.bootstrapDigest, bundle.bootstrap.expiresAt]);
    commitAttempted = true;
    phase = 'COMMIT';
    await db.query('COMMIT');
    releaseFiles = undefined;
    console.log(JSON.stringify({ kind: 'ANVIL_AUTH_INITIALIZED', installationId: bundle.auth.installationId, expiresAt: bundle.bootstrap.expiresAt, newFiles: 2, initializationRows: 1, usersCreated: 0, secretsPrinted: 0 }));
    }
  } catch (error) {
    const rolledBack = await db.query('ROLLBACK').then(() => true, () => false);
    // COMMIT 결과가 불명확하면 재실행/삭제하지 않고 보호 파일을 보존한다.
    if (!commitAttempted && rolledBack && releaseFiles) { await releaseFiles(); releaseFiles = undefined; }
    throw error;
  } finally { db.release(); }
} catch (error) {
  const rawCode = (error as NodeJS.ErrnoException).code;
  const code = typeof rawCode === 'string' && /^[A-Z0-9_]{2,40}$/.test(rawCode) ? rawCode : 'GUARD_OR_OPERATION_FAILED';
  console.error(JSON.stringify({ status: commitAttempted ? 'AUTH_INITIALIZATION_REQUIRES_READ_ONLY_RECONCILIATION_FILES_PRESERVED' : 'AUTH_INITIALIZATION_NOT_COMPLETED_EXISTING_STATE_PRESERVED', phase, code }));
  process.exitCode = 1;
} finally { await pool?.end().catch(() => {}); }
