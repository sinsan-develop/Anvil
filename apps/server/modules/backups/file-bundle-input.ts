import type {FileManifestInput, FileManifest, VerificationBaseline, IssueCode} from './file-manifest-input.ts';

/** 내부 임시 보관본. 공개 반출 형식이나 권한·복원 가능성 인증이 아니다. */
export interface FileBundleInput {
  source: FileManifestInput;
  manifest: FileManifest;
  baseline: VerificationBaseline;
  destinationParent: string;
  destinationName: string;
}
export type BundleIssueCode = IssueCode | 'DESTINATION_UNSAFE' | 'DESTINATION_EXISTS' | 'WRITE_FAILED' | 'CLOSE_FAILED' | 'VERIFY_FAILED';
export interface BundleIssue {code: BundleIssueCode; path?: string}
export interface CleanupEntry {path: string; state: 'removed' | 'preserved'; reason?: 'IDENTITY_UNCONFIRMED' | 'UNKNOWN_OR_CHANGED' | 'CLEANUP_FAILED'}
export interface FileBundleResult {
  complete: boolean;
  state: 'complete' | 'failed' | 'partial';
  manifest: FileManifest | null;
  issues: BundleIssue[];
  cleanup: CleanupEntry[];
}
