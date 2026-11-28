import {createPublicKey, verify} from 'node:crypto';
import {types} from 'node:util';
import {canonicalJson, contentHash, parseWireJson} from '../canonical.ts';
import {arrayV1, hashV1, isoV1, recordV1, refV1, uuidV1, type RuntimeRefV1} from './validation-v1.ts';

export const KEEPER_INSTALLATION_PURPOSE = 'NORMAL_START_KEEPER_INSTALLATION_V1';
export const KEEPER_INSTALLATION_MAX_BYTES = 8192;

interface KeeperInstallationScope {
  installationId: string;
  registrationRef: RuntimeRefV1;
  connectorRef: RuntimeRefV1;
  epoch: number;
  installerId: string;
  signerSid: string;
  keeperSid: string;
  installationRootRef: RuntimeRefV1;
  installedArtifactRef: RuntimeRefV1;
  releaseRef: RuntimeRefV1;
  packageRef: RuntimeRefV1;
  buildRef: RuntimeRefV1;
  endpointPolicyRef: RuntimeRefV1;
  keeperArtifactHash: string;
}

export type KeeperInstallationV1 = Readonly<Omit<KeeperInstallationScope, typeof refKeys[number]> & {
  [K in typeof refKeys[number]]: Readonly<RuntimeRefV1>;
} & {
  schemaVersion: 1;
  purpose: typeof KEEPER_INSTALLATION_PURPOSE;
  issuerId: string;
  issuerKeyFingerprint: string;
  installedAt: string;
}>;

const refKeys = [
  'registrationRef', 'connectorRef', 'installationRootRef', 'installedArtifactRef',
  'releaseRef', 'packageRef', 'buildRef', 'endpointPolicyRef',
] as const;
const scopeKeys = [
  ...refKeys, 'installationId', 'epoch', 'installerId', 'signerSid', 'keeperSid', 'keeperArtifactHash',
] as const;
const bodyKeys = [...scopeKeys, 'schemaVersion', 'purpose', 'issuerId', 'issuerKeyFingerprint', 'installedAt'];
const pinKeys = ['purpose', 'releaseRef', 'issuerId', 'publicKeySpki', 'publicKeyFingerprint', 'notBefore', 'expiresAt'];
const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'byteLength')!.get!;

function invalid(): never { throw new Error('KEEPER_INSTALLATION_EVIDENCE_INVALID'); }

function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return !types.isProxy(value) && recordV1(value, keys) && Object.keys(value).length === keys.length
    && Object.keys(value).every(key => keys.includes(key));
}

function sid(value: unknown): boolean {
  if (typeof value !== 'string' || !/^S-1-(?:0|[1-9][0-9]{0,14})(?:-(?:0|[1-9][0-9]{0,9})){1,15}$/.test(value)) return false;
  const [, , authority, ...subAuthorities] = value.split('-');
  return Number(authority) <= 281474976710655 && subAuthorities.every(part => Number(part) <= 4294967295);
}

function validRef(value: unknown): value is RuntimeRefV1 {
  return record(value, ['id', 'version', 'contentHash']) && refV1(value);
}

function validScope(value: Record<string, unknown>): boolean {
  return uuidV1(value.installationId) && uuidV1(value.installerId)
    && typeof value.epoch === 'number' && Number.isSafeInteger(value.epoch) && value.epoch > 0
    && sid(value.signerSid) && sid(value.keeperSid) && value.signerSid !== value.keeperSid
    && hashV1(value.keeperArtifactHash) && refKeys.every(key => validRef(value[key]));
}

function base64url(value: unknown, maxLength: number, size?: number): Buffer {
  if (typeof value !== 'string' || value.length > maxLength || !/^[A-Za-z0-9_-]+$/.test(value)) return invalid();
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value || (size !== undefined && bytes.length !== size)) return invalid();
  return bytes;
}

/**
 * Verifies the signed record against independent, current expectations supplied by a protected caller.
 * The caller must establish release pin provenance, installed slot identity and current local principals.
 * The parsed record carries no installation, custody or execution authority.
 */
export function verifyKeeperInstallationV1(
  raw: unknown, signature: unknown, expected: unknown, observedAt: unknown,
): KeeperInstallationV1 {
  try {
    if (!record(expected, [...scopeKeys, 'issuerPins']) || !validScope(expected) || !isoV1(observedAt)) return invalid();
    const pins = expected.issuerPins;
    if (types.isProxy(pins) || !arrayV1(pins, 1) || pins.length !== 1) return invalid();
    const pin: unknown = pins[0];
    if (!record(pin, pinKeys) || pin.purpose !== KEEPER_INSTALLATION_PURPOSE
      || !validRef(pin.releaseRef) || canonicalJson(pin.releaseRef) !== canonicalJson(expected.releaseRef)
      || !uuidV1(pin.issuerId) || !hashV1(pin.publicKeyFingerprint)
      || !isoV1(pin.notBefore) || !isoV1(pin.expiresAt) || !(pin.notBefore <= observedAt && observedAt < pin.expiresAt)) return invalid();

    if (!types.isUint8Array(raw)) return invalid();
    const length = byteLength.call(raw);
    if (length === 0 || length > KEEPER_INSTALLATION_MAX_BYTES) return invalid();
    const bytes = Buffer.alloc(length);
    bytes.set(raw);
    const value = parseWireJson(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (!record(value, bodyKeys) || !validScope(value) || value.schemaVersion !== 1
      || value.purpose !== KEEPER_INSTALLATION_PURPOSE || value.issuerId !== pin.issuerId
      || value.issuerKeyFingerprint !== pin.publicKeyFingerprint || !isoV1(value.installedAt)
      || !(pin.notBefore <= value.installedAt && value.installedAt <= observedAt)
      || !scopeKeys.every(key => canonicalJson(value[key]) === canonicalJson(expected[key]))
      || !Buffer.from(canonicalJson(value), 'utf8').equals(bytes)) return invalid();

    // The evidence never selects a key. Validate the protected pin as canonical P-256 SPKI/P1363.
    const spki = base64url(pin.publicKeySpki, 4096);
    const key = createPublicKey({key: spki, type: 'spki', format: 'der'});
    const sig = base64url(signature, 86, 64);
    if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
      || !key.export({type: 'spki', format: 'der'}).equals(spki)
      || contentHash(spki) !== pin.publicKeyFingerprint
      || !verify('sha256', bytes, {key, dsaEncoding: 'ieee-p1363'}, sig)) return invalid();

    for (const field of refKeys) Object.freeze(value[field]);
    return Object.freeze(value) as KeeperInstallationV1;
  } catch {
    return invalid();
  }
}
