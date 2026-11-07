/* 자동 생성. schema를 수정한 뒤 npm run contracts:generate 실행. */
export interface VersionRef {
  id: string;
  version: number;
  contentHash: string;
}

export type ConnectorTrustRequest =
  | HostTrustRegistration
  | HostTrustConfirmation
  | HostTrustEnrollment
  | HostTrustProof
  | HostExchangeChallenge
  | HostCredentialIssue;
export type Hash = string;
export type Uuid = string;
export type Timestamp = string;
export type Reason = string;
export type Nonce = string;
export type Signature = string;

export interface HostTrustRegistration {
  kind: 'HOST_TRUST_REGISTRATION';
  hostLabel: string;
  expectedHostFingerprint: Hash;
  policyRef: ConnectorPolicyRef;
  expiresAt: Timestamp;
  reason: Reason;
}
export interface ConnectorPolicyRef {
  id: Uuid;
  version: number;
  contentHash: Hash;
}
export interface HostTrustConfirmation {
  registrationId: Uuid;
  observedHostFingerprint: Hash;
  scopeDigest: Hash;
  decision: 'APPROVE' | 'REJECT';
  reason: Reason;
}
export interface HostTrustEnrollment {
  registrationId: Uuid;
  oneTimeCode: Nonce;
  observedHostFingerprint: Hash;
  clientNonce: Nonce;
  connectorVersion: string;
  publicKeySpki: string;
}
export interface HostTrustProof {
  challengeId: Uuid;
  payload: HostProofPayload;
  signature: Signature;
}
export interface HostProofPayload {
  protocolVersion: 1;
  installationId: Uuid;
  registrationId: Uuid;
  scopeDigest: Hash;
  publicKeyFingerprint: Hash;
  serverNonce: Nonce;
  clientNonce: Nonce;
  expiresAt: Timestamp;
}
export interface HostExchangeChallenge {
  kind: 'CHALLENGE';
  payload: HostProofPayload;
  signature: Signature;
}
export interface HostCredentialIssue {
  kind: 'ISSUE';
  challengeId: Uuid;
  payload: HostProofPayload;
  signature: Signature;
}
