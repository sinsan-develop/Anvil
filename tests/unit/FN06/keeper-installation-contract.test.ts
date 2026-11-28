import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {test} from 'node:test';
import {canonicalJson, contentHash} from '../../../contracts/canonical.ts';
import {
  KEEPER_INSTALLATION_MAX_BYTES, KEEPER_INSTALLATION_PURPOSE, verifyKeeperInstallationV1,
} from '../../../contracts/runtime/keeper-installation-v1.ts';

const testKey = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
const otherTestKey = generateKeyPairSync('ec', {namedCurve: 'prime256v1'});
const spki = testKey.publicKey.export({type: 'spki', format: 'der'});
const purpose = 'NORMAL_START_KEEPER_INSTALLATION_V1';
const id = (n: number) => `abc00000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ref = (n: number) => ({id: id(n), version: n, contentHash: 'b'.repeat(64)});
const installedAt = '2026-11-28T00:01:00.000Z';
const validAt = '2026-11-28T00:02:00.000Z';
const expiresAt = '2026-11-29T00:00:00.000Z';
const scope = {
  installationId: id(1), registrationRef: ref(2), connectorRef: ref(3), epoch: 7,
  installerId: id(4), signerSid: 'S-1-5-21-100-200-300-1001', keeperSid: 'S-1-5-21-100-200-300-1002',
  installationRootRef: ref(5), installedArtifactRef: ref(6), releaseRef: ref(7),
  packageRef: ref(8), buildRef: ref(9), endpointPolicyRef: ref(10), keeperArtifactHash: 'a'.repeat(64),
};
const issuerPin = {
  purpose, releaseRef: scope.releaseRef, issuerId: id(11), publicKeyFingerprint: contentHash(spki),
  publicKeySpki: spki.toString('base64url'),
  notBefore: '2026-11-28T00:00:00.000Z', expiresAt,
};
const expected = {...scope, issuerPins: [issuerPin]};
const snapshot = {
  ...scope, schemaVersion: 1, purpose, issuerId: issuerPin.issuerId,
  issuerKeyFingerprint: issuerPin.publicKeyFingerprint, installedAt,
};
const encode = (record: unknown) => Buffer.from(canonicalJson(record), 'utf8');
const signature = (bytes: Buffer, key = testKey.privateKey) =>
  sign('sha256', bytes, {key, dsaEncoding: 'ieee-p1363'}).toString('base64url');
const verify = (record: unknown, expectation: unknown = expected, at: unknown = validAt) => {
  const bytes = encode(record);
  return verifyKeeperInstallationV1(bytes, signature(bytes), expectation, at);
};
const denied = /KEEPER_INSTALLATION_EVIDENCE_INVALID/;

test('checks exact signed synthetic installation bytes within the trusted issuer window', () => {
  assert.equal(KEEPER_INSTALLATION_PURPOSE, purpose);
  const result = verify(snapshot);
  assert.deepEqual(result, snapshot);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.registrationRef));
  assert.equal(verify(snapshot, expected, installedAt).installedAt, installedAt);
  assert.equal('executionAuthorized' in result, false);
  assert.equal('publicKeySpki' in result, false);
});

test('rejects absent, multiple, aliased, wrong-purpose and wrong-release issuer pins', () => {
  for (const issuerPins of [
    undefined, [], [, issuerPin], [issuerPin, issuerPin], [issuerPin, {...issuerPin, issuerId: id(12)}],
    [{...issuerPin, purpose: 'HOST_PROOF'}], [{...issuerPin, releaseRef: ref(12)}],
    [{...issuerPin, issuerId: id(12)}], [{...issuerPin, publicKeyFingerprint: 'c'.repeat(64)}],
  ]) assert.throws(() => verify(snapshot, {...expected, issuerPins}), denied);
  const bytes = encode(snapshot);
  assert.throws(() => verifyKeeperInstallationV1(bytes, signature(bytes), undefined, validAt), denied);
});

test('requires the independently expected install, full references, epoch, installer and both principals', () => {
  const other = {
    installationId: id(12), registrationRef: {...scope.registrationRef, contentHash: 'd'.repeat(64)},
    connectorRef: ref(12), epoch: 8, installerId: id(12), signerSid: 'S-1-5-21-100-200-300-1010',
    keeperSid: 'S-1-5-21-100-200-300-1011', installationRootRef: ref(12), installedArtifactRef: ref(12),
    releaseRef: ref(12), packageRef: ref(12), buildRef: ref(12), endpointPolicyRef: ref(12),
    keeperArtifactHash: 'e'.repeat(64), issuerId: id(12), issuerKeyFingerprint: 'f'.repeat(64),
  };
  for (const [field, value] of Object.entries(other))
    assert.throws(() => verify({...snapshot, [field]: value}), denied, field);

  for (const keeperSid of [scope.signerSid, 'S-1-05-21-100-200-300-1002', 'S-1-5-4294967296', 's-1-5-21-1']) {
    assert.throws(() => verify({...snapshot, keeperSid}, {...expected, keeperSid}), denied);
  }
});

test('rejects a body-selected key and changed purpose regardless of valid synthetic signature', () => {
  const otherSpki = otherTestKey.publicKey.export({type: 'spki', format: 'der'});
  const bytes = encode(snapshot);
  assert.throws(() => verifyKeeperInstallationV1(bytes, signature(bytes, otherTestKey.privateKey), expected, validAt), denied);
  assert.throws(() => verify(snapshot, {...expected, issuerPins: [{...issuerPin, publicKeySpki: otherSpki.toString('base64url')}]}), denied);
  const selfAsserted = encode({...snapshot, issuerKeyFingerprint: contentHash(otherSpki), publicKeySpki: otherSpki.toString('base64url')});
  assert.throws(() => verifyKeeperInstallationV1(selfAsserted, signature(selfAsserted, otherTestKey.privateKey), expected, validAt), denied);
  assert.throws(() => verify({...snapshot, purpose: 'NORMAL_START_PREPARATION_RESULT_PROOF_V1'}), denied);
  assert.throws(() => verifyKeeperInstallationV1(bytes, signature(bytes) + '=', expected, validAt), denied);
  const derSignature = sign('sha256', bytes, testKey.privateKey).toString('base64url');
  assert.throws(() => verifyKeeperInstallationV1(bytes, derSignature, expected, validAt), denied);
});

test('rejects signed noncanonical, malformed, duplicate and partial byte sequences', () => {
  const bytes = encode(snapshot);
  const text = bytes.toString('utf8');
  for (const candidate of [
    Buffer.alloc(0), bytes.subarray(0, -1), Buffer.from(JSON.stringify(snapshot)),
    Buffer.from(text + '\n'), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), bytes]),
    Buffer.concat([bytes.subarray(0, -1), Buffer.from([0xc3, 0x28, 0x7d])]),
    Buffer.from(text.replace('"epoch":7', '"epoch":7,"epoch":7')),
    Buffer.from(text.replace('"epoch":7', '"epoch":7,"\\u0065poch":7')),
    Buffer.from(text.replace('"version":9', '"version":9,"\\u0076ersion":9')),
    Buffer.alloc(KEEPER_INSTALLATION_MAX_BYTES + 1, 32),
  ]) assert.throws(() => verifyKeeperInstallationV1(candidate, signature(candidate), expected, validAt), denied);
  const changed = encode({...snapshot, installedAt: '2026-11-28T00:01:01.000Z'});
  assert.throws(() => verifyKeeperInstallationV1(changed, signature(bytes), expected, validAt), denied);
});

test('checks canonical time and rejects future installation, inactive pins and exact expiration', () => {
  for (const at of ['2026-11-28T00:00:59.999Z', expiresAt, '2026-11-28T00:02:00Z', NaN])
    assert.throws(() => verify(snapshot, expected, at), denied);
  for (const at of ['2026-11-27T23:59:59.999Z', '2026-11-28T00:01:00Z', '2026-02-30T00:00:00.000Z'])
    assert.throws(() => verify({...snapshot, installedAt: at}), denied);
  for (const notBefore of ['2026-11-28T00:01:00.001Z', expiresAt])
    assert.throws(() => verify(snapshot, {...expected, issuerPins: [{...issuerPin, notBefore}]}), denied);
});
