# FN12 시험 자료 주장 등록·보호 조회 계약 후보

- 상태: **DRAFT / NOT_ADOPTED / 문서만**. 2026-10-22, Main 어울.
- 기준: 설계 r8 §7.3, WORK_PLAN r7 FN12/UI05·UI08, FUNCTION_WORK FN12, INTERFACES §13.3. 코드 기준 e4c9c17681fc859f6b56b02282fdbe8f38df2859.
- 작성 지시: PMO가 신규 명령/보호 GET/불변 원장·정책의 정확한 delta를 먼저 고정하도록 요청했다. 이 문서는 제품·API·SQL 구현 채택, 실제 DB 적용·정책 부여·Agent 호출 허가가 아니다.

## 1. 목적·기존 기능·대안

사용자가 보관한 시험 자료와 보고를 프로젝트에 남겨 다시 조회한다. 시험을 실제 실행하거나 시험의 성공·출처를 인증하는 기능이 아니다. FN12 전체 완료가 아니며, 실제 실행 증거/독립 검수 제공자는 별도 후속이다.

기존 submitResult는 manifest evidence 배열을 주장으로 보존한다. result_evidence_valid는 형식을 검사할 뿐 불변 증거 등록부가 아니다. ProjectResultArtifacts는 원제출의 artifactRefs에 선언한 보호 바이트를 대조하지만 실제 실행·시험 종류/exit/출처를 인증하지 않는다. SyntheticResultEvidence는 합성 readEvidence 포트만 있고, WORKER_CLAIM은 불충분 처리하지만 다른 sourceKind는 조건 일치 시 SUPPORTED_FOR_REVIEW가 될 수 있다. 그러므로 사람이 올린 자료를 TEST_ARTIFACT로 이름만 바꿔 이 포트에 넣으면 안 된다.

권장: 이번 별도 **미검증 주장 원장**만 구현 후보로 채택하고 기존 검수 차단을 유지한다. 대안1은 현재 결과 제출 JSON/보관파일 조회만 유지(변경 최소, 개별 시험 자료의 등록·조회 누락 지속). 대안2는 실제 시험 실행·관측 제공자까지 함께 설계(더 큰 출처/환경/권한·실행 위험, 이번 범위에서 제외).

## 2. 타입·신뢰 경계 — 기존 증거와 상호 대체 금지

새 자료형 이름은 **ResultEvidenceClaimV1**, discriminator는 kind=USER_TEST_ARTIFACT_CLAIM_V1이다. 기록은 다음 세 층을 분리한다.

1. 서버 확인 metadata: 현재 인증 HUMAN 작성자·client, project/assignment/execution/criteria의 정확 ref와 연결, 등록 시점, 실제 보호 파일의 byte/hash 일치.
2. 사용자 주장: reportedSourceKind=TEST_ARTIFACT, 시험 상태/종료 코드/시각과 이유. TEST_ARTIFACT는 파일 내용에 대한 주장이지 신뢰된 실행기 출처가 아니다.
3. 고정 비인증: sourceKind=WORKER_CLAIM, origin=HUMAN_UPLOAD, sourceVerification=UNVERIFIED, actualTestExecutionVerified=false, environmentExecutionVerified=false, evidenceProvenanceVerified=false, completionAccepted=false, formalFailureCounted=false, executionAuthorized=false, dispatchPerformed=false.

서버가 위 discriminator/주체/고정값을 도출한다. 요청의 sourceKind/origin/sourceVerification/위 flags·임의 verified 필드는 unknown field로 거절한다. HUMAN_UPLOAD는 인증 세션의 자료 등록을 뜻하며 원자료를 사람이 직접 만들었다는 물리적 증명이 아니다. 파일 hash는 바이트 결박이며 실행·출처 인증이 아니다.

새 ClaimRef는 {kind:USER_TEST_ARTIFACT_CLAIM_V1,versionRef:{id,version,contentHash}}로 구분한다. 기존 ResultManifest.evidence의 VersionRef로 자동 변환하거나 SyntheticResultEvidenceTransaction.readEvidence에 제공하는 adapter를 이번 범위에 만들지 않는다. 신뢰 필드를 지워 구형 shape로 바꾸는 fallback도 금지한다. 기존 evaluateResult의 ACCEPTED/NOT_APPLICABLE·임의 evidenceRefs 거절, REWORK/BLOCKED+evidence=[]·실패 집계false는 그대로다. UI가 주장 원장을 읽어도 현재 검수 판정·상태 전이/재시도·새 writer를 만들지 않는다.

## 3. 정확한 신규 API·명령

후보 operation은 registerResultEvidenceClaim 하나이며 기존 PROJECT command endpoint를 사용한다. HUMAN 인증·현재 OWNER/client/단독 제어 세대·CSRF·별도 명시 AUTO 정책을 검사한다. REQUIRE_APPROVAL 또는 approvalRef 지정은 EVIDENCE_CLAIM_APPROVAL_NOT_CONNECTED 412로 거절한다. 다른 연산의 승인을 재사용하지 않는다.

신규 command는 schemaVersion=1, projectId,commandId,clientId,controlGeneration,operation=registerResultEvidenceClaim,targetId=null,expectedVersion=0,baselineRefs=[],approvalRef=null,payload를 가진다. payload는 아래 필드 전부만 허용한다.

| 필드 | 검사 |
|---|---|
| assignmentRef,executionRef,criteriaRef | exact VersionRef. 존재·동일 프로젝트/확정 임무·등록 실행 관계·criteria의 assignment/baseline와 연결을 서버 reader로 재검사 |
| criterionId,testId | 기존 code 규칙 [A-Za-z0-9][A-Za-z0-9_.-]{0,79}. criteria의 유일 항목과 정확 일치 |
| environmentRef | exact VersionRef. criteria 항목과 일치하고 현재 HUMAN 보호 candidate reader로 읽을 수 있는 동일 프로젝트 환경 참조. 환경 등록은 실제 이 시험 실행 인증 아님 |
| baselineRefs | criteria의 고정 배열과 순서/전체 ref 정확 일치, 중복0, 1~100개 |
| reportedStatus | 기존 PASS/FAIL/NOT_EXECUTED/BLOCKED/NOT_APPLICABLE. 모두 사용자 주장 |
| reportedExitCode | null 또는 0 이상 safe integer. status PASS나 exit0만으로 합격하지 않으며 둘의 불일치도 인증으로 수정하지 않음 |
| reportedAt | null 또는 UTC ISO 문자열. server clock보다 미래 거절. 원자료에서 주장한 시각이며 observedAt으로 재명명 금지 |
| artifactRefs | version1 exact ref 1~20개·중복0. 현재 같은 프로젝트 READY 보호 원본만. 합계 ≤2MiB, text/plain;charset=utf-8 또는 text/markdown;charset=utf-8 |
| reason | 공백 제외 필수·≤20000 UTF16·기존 알려진 비밀 검사. 원문 자동 절단/마스킹으로 통과 금지 |

전체 canonical UTF8 ≤2MiB. 중복 JSON key/unknown/getter·비정상 prototype/형식·크기·의심 비밀은 기존 strict 경계로 거절한다. ID·hash를 제출했다는 사실만으로 자료 읽기/존재·실행·환경 진위를 인정하지 않는다. artifact 업로드는 기존 별도 uploadArtifact 계약을 그대로 사용하며 이 명령은 업로드·새 파일·기존 파일 수정/삭제를 수행하지 않는다.

신규 보호 조회 후보:

- GET /api/v1/projects/:projectId/result-evidence-claims/:id/versions/1 — query없음, 정확 불변 metadata·snapshot만 반환.
- GET /api/v1/projects/:projectId/results/:resultId/evidence-claim-pages?limit&cursor — 이 후보에서는 **미포함**. 결과 manifest와의 새 연결/목록·검색을 묵시 추가하지 않는다. 최초 UI는 등록 영수증의 ClaimRef를 보관해 정확 재조회하며 페이지 종료 후 발견용 목록은 별도 미구현으로 표시한다.
- 원문 바이트는 이 GET에 포함하지 않는다. 등록은 기존 보호 파일을 읽어 hash/보호 상태를 확인하지만 등록 영수증이 파일 다운로드 권한을 부여하지 않는다. 기존 ProjectResultArtifacts는 원제출에 선언한 파일만 조회하며 새 ClaimRef로 우회하지 않는다.

응답: {projectId,claimRef,snapshot,claimStored:true,sourceVerification:UNVERIFIED,evidenceProvenanceVerified:false,completionAccepted:false,formalFailureCounted:false,executionAuthorized:false,dispatchPerformed:false,observedAt}. snapshot에는 kind·scope{projectId,assignmentRef,executionRef}·criteriaRef·criterionId/testId·criteria에서 도출한 verificationKind·environmentRef·baselineRefs·reportedSourceKind·reportedStatus/ExitCode/At·artifactRefs·reason·registeredBy{kind:HUMAN,userId,clientId}·registeredAt·§2 고정값을 포함한다. ref hash는 완전한 canonical snapshot에 결박한다. 원문·storageKey·Secret·DSN/명령 인증정보는 반환하지 않는다. no-store/CSP·기존 same-origin/TLS/Host/CSRF 경계 유지.

## 4. 현재 쓰기·읽기 권한과 참조 보호

- 정책 action은 registerResultEvidenceClaim, 보호 조회 action은 readResultEvidenceClaim으로 분리한다. 둘 다 명시 PROJECT 정책·DENY 우선·기한/현재 세션을 검사하며 쓰기가 읽기/일반 회원 권한을 자동 부여하지 않는다. 정책을 설치하거나 실제 사용자에게 자동 부여하지 않는다.
- 정책 targetScopes는 기존 {kind:PROJECT,projectId}를 유지한다. 새로운 target kind/사용자 권한 모델을 만들지 않는다. 쓰기 scope digest는 project·assignment/execution/criteria exact ref와 정규화한 전체 payload/hash·주체/client/제어세대를 결박하고, 조회는 같은 프로젝트의 특정 ClaimRef·고정 scope와 현재 읽기 정책을 별도로 대조한다. 새 쓰기 action과 읽기 전용 readResultEvidenceClaim action을 정책 parser·저장 제약·요약에 추가하는 변화가 정확 delta다. 읽기 action을 POST command operation으로 허용하지 않으며 읽기 guard는 명령 생성·단독 제어 획득 없이 현재 세션/정책만 대조한다. 다른 operation의 기존 PROJECT 규칙을 이 action의 허가로 묵시 승격하지 않는다.
- 작성은 현재 OWNER/client·단독 제어를 요구한다. 조회는 현재 HUMAN 멤버+별도 READ 정책을 요구하되 새 writer/제어 획득은 요구하지 않는다. 읽기 클라이언트의 현재 client/session 조건도 정책이 정한 범위대로 검사한다.
- 최초 작성·replay·GET 모두 고정 assignment/execution/criteria/environment/각 artifact에 대한 현재 읽기 권한과 같은 프로젝트·현재 격리/보호 상태를 재검사한다. 관련 자료가 이제 접근 불가이면 과거 저장본을 삭제하지 않고 반환을 거절한다. 새 head와 다르다는 이유만으로 과거 고정 원문을 최신 원문으로 치환하지 않는다.
- 최초 등록의 전체 snapshot/receipt 반환, exact replay, GET 모두 별도 readResultEvidenceClaim 정책도 필요하다. WRITE만 있으면 등록·전체 응답을 거절하며 조회 불가 snapshot을 쓰기 영수증에 실어 보내지 않는다. 이를 명령 preflight·잠금 후 최종 검사·재조회에 적용하고 READ 검사 실패 시 신규 등록 transaction 전체를 rollback한다. READ만 있으면 신규 등록은 거절하고 허가된 고정 조회만 가능하다.
- 기존 execution reader의 SYNTHETIC_ONLY/범위 관계를 사용한다. actual provider가 없는 실행을 실제 수행으로 표시하지 않는다. reader 없는 대상/미확인 관계는 412, 교차 프로젝트/부재는 비공개 404, 인증 만료401·권한거절403·형식422·CAS409·내부 무결성503·격리412를 사용한다. 원문·존재 여부/민감 상세를 오류에 넣지 않는다.
- 참조 내용은 서버에서 다시 읽어 hash·최신 보호 상태를 검증한다. snapshot 불변과 별개로 replay/GET의 observedAt은 그 조회 시각이다. recordedAt/registeredAt과 혼동하지 않는다.

## 5. 잠금·원자성·replay

기존 project command의 현재 인증/제어·정책검사→동일 명령 식별/정확 replay→신규 최종 현재성 검사 순서를 소비한다. replay도 현재 보호/읽기 검사를 거치며 한 번 기록했다고 영구 허용하지 않는다.

신규 transaction에서 project/control·정책·assignment/execution/criteria/environment와 artifact 행을 **같은 고정 순서**로 잠근다(프로젝트→제어→정책→assignment→execution→criteria→environment→artifact ID 오름차순). 기존 reader가 필요한 원자 잠금 계약을 제공하지 못하면 구현 중 그 delta를 먼저 보고하고 잠금 없는 성공으로 대체하지 않는다. 각 보호 바이트 read 전/후에 실제 bytes/hash/length·READY/nonquarantine를 대조한다. DB 잠금은 파일 시스템 외부 변경 방어의 전부가 아니므로 store의 경로/링크·byte 검증을 유지한다.

격리 수준은 READ COMMITTED로 고정한다. 잠금 대기 전/잠금 statement와 같은 snapshot에서 얻은 허가·head 값을 최종 검사에 재사용하지 않으며, 모든 잠금 획득 후 **별도 새 statement**로 현재 세션/회원/정책/head·보호 상태를 다시 읽는다. 캐시·동일 statement의 옛 snapshot fallback은 금지한다.

상호 배제는 등록 경로만의 잠금으로 충분하지 않다. 프로젝트 정책 교체·멤버십/단독제어 변경·assignment/criteria/environment head 발행·artifact 상태/격리 변경도 같은 프로젝트 기준 anchor를 먼저 잠가야 한다. 현재 auth session/user 회수는 해당 실제 행에 대한 충돌 잠금과 fresh 재검사를 포함한다. 행 부재·정책 부재·새 head 삽입은 없는 행 SELECT로 보호하지 않고 공통 부모/기준 anchor와 갱신 세대에 결박하며 해당 발행자도 같은 anchor 잠금에 참여해야 한다. 관련 기존 변경 경로의 실제 참여·FK/행 잠금 충돌·발행 세대/CAS를 소스/경합 시험으로 확인하지 못하면 EVIDENCE_CLAIM_CONCURRENCY_UNSUPPORTED 412로 신규 등록을 거절한다. SERIALIZABLE이라는 이름이나 재시도만으로 이 보장을 대체하지 않는다.

이 공통 잠금이 없는 기존 경로의 보완은 숨은 부수 수정이 아니라 후보 채택 전 필요한 exact delta다. 구현 계획에는 해당 변경 operation/파일·anchor·잠금 순서·현재성 조회/행 부재 처리 지도를 먼저 제시한다. 영향이 후보 범위를 넘으면 그 경로만 별도 결정하고 등록 기능을 막힘으로 표시하며, 검증되지 않은 상호 잠금을 완료로 주장하지 않는다.

정책/세션/제어·각 연결/내용·artifact 보호를 잠금 뒤·최종 INSERT 전 clock으로 재확인하고, 저장·receipt·허가 영수증·비밀 없는 APPLIED audit를 하나의 transaction으로 묶는다. 마지막 쓰기 뒤 COMMIT 요청 직전에도 clock·현재 정책/세션/제어·참조 보호를 재검사하며 만료/변경 시 전부 rollback한다. 이 최종 검사를 기존 command transaction이 제공하지 못하면 해당 보완을 정확 delta로 다루고 생략하지 않는다. 판정은 최종 검사 시점의 유효성이고 COMMIT 이후 권한 영구 유효를 보장하지 않는다.

ID는 서버 생성·version1만, canonical snapshot/hash 불변. 같은 project/actor/client/commandId와 exact request hash만 동일 결과로 replay한다. payload/주체/제어/참조가 바뀐 동일 ID는409. 응답 유실은 UNKNOWN·원 명령 보존, 자동 새 commandId/자동 재등록·파일 업로드0. 보호 재검사 실패 replay에서 과거 receipt 원문을 반환하지 않는다. 모든 API 성공은 transaction COMMIT 완료 이후에만 노출한다.

## 6. 데이터 보존·실행 범위·rollback

채택 시 작성할 후보 forward SQL은 별도 result_evidence_claims 원장(version1·project/command/작성자·exact snapshot/hash·불변 제약·FK/읽기/쓰기 guard·감사 연결)이다. 파일/기존 제출/원 검수·기존 migration을 수정하지 않는다. 기존 command write 경로로만 삽입하고 app 직접 DML·UPDATE/DELETE·교차 프로젝트 조회를 거절하도록 설계한다. schema 적용·실사용자 권한 부여는 별도이며 지금 SQL파일조차 작성하지 않는다.

보존 정책은 자동 삭제 OFF·자동 격리 해제0이다. 기한/권한 만료는 보관 삭제가 아니라 현재 조회 거절이다. 원문이 사후 격리되면 원장/과거 audit는 남기고 metadata/바이트 반환은 fail-closed한다. 실제 Secret/인증서·계정/credential·보관 경로/ACL·서비스·Agent/비용·외부 반출·검수 ACCEPTED·실패 누적·자동 재작업/상태 전이·기존 미채택 후보의 채택은 제외한다.

코드 rollback은 새 소비/route 비활성화 또는 해당 commit 일반 revert이며 불변 자료 삭제/down migration을 뜻하지 않는다. 실제 적용한 뒤 데이터 폐기가 필요하면 정확 대상·보존/참조 영향을 별도로 결정한다. 후보 단계의 합성 자료만 정확 정리한다.

## 7. 채택 뒤 필수 검증·후속 미구현

1. 등록→COMMIT→별도 보호 GET→동일 snapshot/hash, 정확 command replay·도중 응답 유실/UNKNOWN·새 입력 혼입 거절.
2. 타 project/assignment/execution/criteria/env·다른 기준/시험ID·없는/변조/격리 artifact·읽기만/쓰기만 정책·회수/세션 만료·옛 generation·잠금 대기 뒤 정책 만료를 부작용0으로 거절.
   실제 두 transaction으로 정책 교체·회원/세션 회수·새 head 삽입·artifact 격리와 등록을 교차시켜 잠금 대기 뒤 새 상태가 반영되는지 검사한다. 공통 anchor 미참여 제공자는 412, 정상 경합 승자는 한 유효 snapshot만 COMMIT하고 패자는 부작용0이어야 한다. 최초 WRITE만 정책·replay 도중 READ 회수도 전체 snapshot/receipt를 노출하지 않는지 검사한다.
3. 원장 INSERT 뒤 receipt/audit/commit 직전 오류 주입은 **실제 transaction rollback**을 검사하고 원장·command·receipt/audit APPLIED 잔여0 확인. fake DB 예외만으로 COMMIT 원자성을 검증했다고 하지 않는다.
4. replay/GET 전후 정책/원문 격리/파일교체·hash 변경은 과거 성공을 그대로 공개하지 않는다. GET은 command/domain write0, side effect/nonce·새감사 명령 생성0.
5. 신뢰 음성: 사용자 PASS·exit0·reportedSourceKind TEST_ARTIFACT·일치 bytes를 등록해도 sourceVerification UNVERIFIED/출처·실행 인증false다. 새 ClaimRef를 old VersionRef/구형 readEvidence shape로 조작해도 처리 거절·현재 평가기 공급0·SUPPORTED_FOR_REVIEW/ACCEPTED·정식 실패 횟수/새 writer0.
6. UI 등록은 명시 확인 후만, owner/client/project/assignment/criteria 고정·중복전송방지·UNKNOWN 동결·다른 입력 보존·늦은응답 폐기. Secret 표식 거절과 원문 스크립트 비실행 확인.

기존 판정기 신뢰 증거 제공자, 실제 시험 실행/명령·환경 인증, 기존 제출 evidence와 ClaimRef의 별도 선택 연결·전체목록/페이지복구·검수 ACCEPTED는 이 후보에 포함하지 않는다. 이 후보가 채택돼 구현돼도 FN12 전체 완료 또는 실제 Agent 작업 완료가 아니다.
