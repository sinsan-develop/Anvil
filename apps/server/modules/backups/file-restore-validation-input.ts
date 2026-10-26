import type {FileManifestInput, VerificationBaseline, FileManifest} from './file-manifest-input.ts';
import type {BundleIssue, CleanupEntry} from './file-bundle-input.ts';
/** 내부 파일 검증복원 입력. 원 source 경로·실제 복원 권한을 받지 않는다. */
export interface FileRestoreValidationInput {
  bundleRoot:string;
  baseline:VerificationBaseline;
  limits:FileManifestInput['limits'];
  maxMetadataBytes:number;
  validationParent:string;
  validationName:string;
  signal?:AbortSignal;
}
export type RestoreValidationIssue = BundleIssue | {code:'METADATA_LIMIT'|'METADATA_INVALID'|'INVENTORY_MISMATCH'};
export interface FileRestoreValidationResult {
  complete:boolean;
  state:'complete'|'failed'|'partial';
  manifest:FileManifest|null;
  issues:RestoreValidationIssue[];
  cleanup:CleanupEntry[];
}
