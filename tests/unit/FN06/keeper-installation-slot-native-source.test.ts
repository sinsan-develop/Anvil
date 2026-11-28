import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const source = () => readFileSync(new URL('../../../apps/connector/native/NormalStartKeeperInstallationSlotSource.cs', import.meta.url), 'utf8');
function ordered(text: string, ...terms: string[]) {
  let offset = 0;
  for (const term of terms) {
    const next = text.indexOf(term, offset);
    assert.ok(next >= offset, term);
    offset = next + term.length;
  }
}

test('keeper installation body uses only the protected registration hierarchy and same retained parent', () => {
  const text = source();
  ordered(text, 'KnownProgramData()', 'OpenVolume', 'known.Substring(3).Split', 'knownParts.Length > 16',
    'foreach (string part in knownParts)', 'Relative', 'expected.ProgramData',
    'expected.SlotParts', 'Relative(parent, parts[i]', 'CompareExpected(seen, expected.ExpectedAt(i), volume)', 'AtRest');
  ordered(text, '!CanonicalId(installation)', '!CanonicalId(registration)', 'epoch < 1',
    'parts = new[]', '"Anvil"', '"KeeperInstall"', '"v1"', 'installation', 'registration', 'epoch.ToString', '"installation.json"',
    'installed.Clone()', 'identity.Volume != ProgramData.Volume', '!seen.Add(identity)');
  assert.match(text, /RootDirectory = parent\.DangerousGetHandle\(\), ObjectName = name, Attributes = ObjCaseInsensitive \| ObjDontReparse/);
  assert.match(text, /FileOpen, options/);
  assert.match(text, /uint options = OpenReparsePoint \| SyncNonAlert \| \(directory \? DirectoryFile : NonDirectoryFile\)/);
  assert.match(text, /!seen\.Equals\(expected\) \|\| seen\.Volume != volume\.Volume/);
  assert.doesNotMatch(text, /Environment\.GetEnvironmentVariable|File\.ReadAll|Path\.Combine|GetNamedSecurityInfo|CreateDirectory|WriteFile|TerminateProcess|DuplicateHandle|ResumeThread/);
});

test('keeper installation uses handle ACLs only for the isolated slot and denies wrong or aliased role SIDs', () => {
  const text = source();
  assert.match(text, /i >= ProtectedRegistrationIndex/);
  assert.match(text, /signer == keeper \|\| signer == SystemSid \|\| keeper == SystemSid/);
  assert.match(text, /string requiredSid = keeperSide \? expected\.KeeperSid : expected\.SignerSid/);
  ordered(text, 'static void CheckAcl', 'GetSecurityInfo(handle.DangerousGetHandle()', 'LocalFree(descriptor)');
  ordered(text, 'static void ValidateAcl', 'SystemSid', 'DiscretionaryAclProtected', 'DiscretionaryAcl.Count != 3', 'AceFlags.None',
    'AceQualifier.AccessAllowed', 'seen.Add(sid)', 'requiredAccess', 'seen.Contains(expected.SignerSid)', 'seen.Contains(expected.KeeperSid)');
  assert.match(text, /ReadAttributes \| Synchronize \| \(secured \? ReadControl : 0\)/);
  assert.match(text, /GetVolumeInformationByHandleW/);
  assert.match(text, /GetDriveTypeW\(drive\) != DriveFixed/);
  assert.match(text, /n != 49 \|\| root\.Length != 49/);
  assert.match(text, /GetDriveTypeW\(root\) != DriveFixed/);
  assert.match(text, /"NTFS"/);
  assert.match(text, /tag\.ReparseTag != 0/);
  assert.match(text, /standard\.DeletePending != 0/);
  assert.match(text, /standard\.NumberOfLinks != 1/);
});

test('keeper installation returns original bounded bytes only after EOF, exact readback and successful close', () => {
  const text = source();
  ordered(text, 'static byte[] AtRest', 'CheckAll', 'ReadExactly', 'CheckAll', 'ReadExactly', 'SameBytes', 'CheckAll');
  ordered(text, 'static byte[] ReadExactly', 'MaximumBodyBytes', 'SetFilePointerEx', 'ReadFile', 'ReadFile(file.DangerousGetHandle(), tail', 'actual != 0');
  ordered(text, 'for (int i = owned.Count - 1', 'CloseSucceeded', 'if (!clean)', 'SLOT_CLOSE_UNKNOWN',
    'if (payload == null)', 'check()', 'CheckLocalSid(requiredSid)', 'return payload');
  assert.match(text, /MaximumBodyBytes = 8192/);
  assert.match(text, /expected\.ExpiresAt/);
  assert.match(text, /budget\.Slice\(expected\.ExpiresAt, 2000\)/);
  assert.match(text, /read\.Check\(\)/);
  assert.doesNotMatch(text, /installation\.sig|TrustKeyHostSource\.Dispatch|RunInstalled\(|P1363|CREATE_PROCESS|PREPARED|EXECUTION_READY|FileMode\.Create/);
});

test('keeper relative opens use only read or traverse permission and never share writes or deletes', () => {
  const text = source();
  const values = Object.fromEntries([...text.matchAll(/\b(ReadData|Traverse|ReadAttributes|ReadControl|Synchronize|ShareRead) = (0x[a-f\d]+|\d+)/gi)]
    .map(([,name,value]) => [name,Number(value)]));
  assert.deepEqual(values, {ShareRead:1,ReadData:1,Traverse:32,ReadAttributes:128,ReadControl:131072,Synchronize:1048576});
  assert.equal(values.ShareRead, 1);
  assert.match(text, /uint access = ReadAttributes \| Synchronize \| \(secured \? ReadControl : 0\) \| \(directory \? Traverse : ReadData\);/);
  assert.match(text, /NtCreateFile\(out handle, access, ref objectAttributes, out status, IntPtr.Zero, 0, ShareRead, FileOpen, options, IntPtr.Zero, 0\)/);
});
