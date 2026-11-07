import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const qaRoot = 'D:/tmp/anvil-v3-stage-b/fn16-file-manifest-20261027-01';
export async function withFixture(run: (root: string, put: (name: string, data: string | Uint8Array) => Promise<void>) => Promise<void>) {
  const parent = path.dirname(qaRoot);
  for (const target of ['D:/tmp', parent]) {
    const stat = await fs.lstat(target);
    if (!stat.isDirectory() || stat.isSymbolicLink() || path.resolve(await fs.realpath(target)).toLowerCase() !== path.resolve(target).toLowerCase()) throw new Error('QA_PARENT_UNSAFE');
  }
  const owner = execFileSync('C:/Program Files/PowerShell/7/pwsh.exe', ['-NoProfile', '-Command', `(Get-Acl -LiteralPath '${parent}').Owner`], {encoding:'utf8'}).trim();
  if (owner !== 'SINSAN\\cyhuh') throw new Error('QA_OWNER_MISMATCH');
  await fs.mkdir(qaRoot); // 기존 root는 재사용하지 않는다.
  const started = Date.now();
  const identity = await fs.lstat(qaRoot);
  if (identity.isSymbolicLink() || path.resolve(await fs.realpath(qaRoot)) !== path.resolve(qaRoot)) throw new Error('QA_ROOT_UNSAFE');
  const files = new Set<string>();
  try {
    await fs.mkdir(path.join(qaRoot, 'fixtures'));
    const root = path.join(qaRoot, 'fixtures');
    if (path.resolve(await fs.realpath(root)) !== path.resolve(root)) throw new Error('QA_ROOT_UNSAFE');
    await run(root, async (name, data) => {
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) throw new Error('QA_NAME_UNSAFE');
      await fs.writeFile(path.join(root, name), data, {flag: files.has(name) ? 'w' : 'wx'});
      files.add(name);
    });
    if (Date.now() - started > 30 * 60_000) throw new Error('QA_LIFETIME_EXCEEDED');
  } finally {
    const root = path.join(qaRoot, 'fixtures');
    for (const target of [qaRoot,root]) {
      const stat=await fs.lstat(target);
      if (stat.isSymbolicLink() || !stat.isDirectory() || path.resolve(await fs.realpath(target))!==path.resolve(target)) throw new Error('QA_CLEANUP_UNSAFE_PRESERVED');
    }
    const current=await fs.lstat(qaRoot);
    if (current.dev!==identity.dev || current.ino!==identity.ino) throw new Error('QA_ROOT_REPLACED_PRESERVED');
    const children=await fs.readdir(qaRoot);
    if (children.length!==1 || children[0]!=='fixtures') throw new Error('QA_UNKNOWN_CHILD_PRESERVED');
    const actual = await fs.readdir(root);
    if (actual.some(name => !files.has(name))) throw new Error('QA_UNKNOWN_FILE_PRESERVED');
    for (const name of files) await fs.unlink(path.join(root, name));
    await fs.rmdir(root);
    await fs.rmdir(qaRoot);
    console.log(JSON.stringify({qa:'FN16', createdAt:new Date(started).toISOString(), cleanedAt:new Date().toISOString(), files:[...files].sort(), residual:false}));
  }
}
