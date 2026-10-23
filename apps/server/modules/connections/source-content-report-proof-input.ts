import {canonicalJson} from '../../../../contracts/canonical.ts';
import {
 readSourceContentReportV1,sourceContentReportProofBytesV1,type SourceContentReportContextV1
} from '../../../../contracts/runtime/source-content-report-v1.ts';

/** 비활성 서명 입력만 준비한다. 보고의 구조/hash 정합은 서명·관측·현재 권한의 진위가 아니다. */
export function readSourceContentReportProofInputCandidate(value:unknown,context:unknown) {
 const raw=canonicalJson(context);
 if(Buffer.byteLength(raw,'utf8')>1048576)throw Error('SOURCE_CONTENT_INPUT_INVALID');
 const fixed=JSON.parse(raw) as SourceContentReportContextV1;
 const report=readSourceContentReportV1(value,fixed);
 return {
  status:'UNVERIFIED' as const,reason:'SIGNATURE_VERIFIER_UNAVAILABLE' as const,
  candidate:{proofBytes:sourceContentReportProofBytesV1(report,fixed),signatureBytes:Buffer.from(report.signature,'base64url')},
  signatureVerified:false as const,currentAuthorityVerified:false as const,
  executionAuthorized:false as const,linkAuthorized:false as const
 };
}
