# FN16 권한정책 내부 조합 연결 작업지시서 — 2026-10-29

기준 codex/av3-stage-b 6ebce9e1ede2135ad0e2c599c42797693703e1a7. 정책역사 source497630CF는 Main11PASS/독립C0I0로 게시했다. 고정19 조합 뒤 이 실제 collector를20번째로 연결해 기존 POLICY_VERSION 외부 참조의 정확 존재/부재/충돌을 확인한다. 기존 FN16 내부 source 연결이며 공개 API/정책/영속/실키·DB·서비스/Agent 변경0. 전체백업·권한복원 허가가 아니다. Primary단독writer/Main관리검수통합/독립읽기. preflight 전 GO아님.

## 정확 허용4경로
- apps/server/modules/backups/project-inventory-composition.ts
- tests/unit/FN16/project-inventory-composition.test.ts
- tests/unit/FN16/project-inventory-composition-schema.test.ts
- tests/unit/FN16/project-inventory-artifact-verification.test.ts
기존 권한정책 collector·원문helper/normalizer·다른source/schema/SQL 수정0. 기존 보호8/사용자변경 보존, Git은Main만.

## 연결 계약
1. 실제 collectPermissionPolicyInventory를 고정 import하고 기존19 순서 뒤에 PermissionPolicy라는 명시 name으로1회 호출한다. 외부선택/provider 주입0, 최초/최종RC 및 최소신원/기한·전역metadata/파일합집합/회수503우선은 기존과 동일하다. 20개 child는 독립RR이며 원자 snapshotfalse다.
2. 정책의 원 inventoryHash는 H({kind,projectId,policies,versions,evidence,issues,externalDependencies}) 고정7필드로 대조한다. 원 child전체 resultDigest, scope/원선언/미수집/rowcount를 기존 형식대로 보존한다. 정책원문내용hash/개인정보제외projectionHash/조합hash를 섞지 않는다.
3. PermissionPolicy.versions[].ref만 POLICY_VERSION namespace의 명시 provider로 추가한다. 기존 각 child의 POLICY_VERSION+정확ref dependency는 namespace/project/id/version/hash로 EXACT_REFERENCE_PRESENT 또는 COLLECTED_REFERENCE_ABSENT를 판정한다. 같은 key 다른원hash면503 REFERENCE_CONFLICT. sourceEvidence.targetRef나 projectionHash로 원ref를 대신하지 않는다. 다른 종류/ID-only/unknown·PERMISSION_POLICY는 자동alias하지 않는다. 현재권한/expiry/소비 허가로 연결하지 않는다.
4. 고정 notCollected의 WHOLE_PERMISSION_APPROVAL_COMMAND_AUTH_AUDIT는 WHOLE_APPROVAL_COMMAND_AUTH_AUDIT로 한정 보정한다. 이것은 정책metadata자료군을 실제수집한 사실만 반영한다. PermissionPolicy의 wholeApprovalHistory/wholeCommandLedger/wholeAuthorizationReceipts/wholeProjectAuditLedger/authenticationAuditHistory NOT_COLLECTED와 request/currentPermission/reauth/auditChain/sourceOs/blob NOT_PERFORMED, 권한복원false는 원문 그대로 보존한다. 개인정보/경로 원형이 투영에없다는 제한을 결과보고에 명시한다. 모든 의존해소도 전체coverage/restorablefalse다.
5. 정책빈프로젝트 정상, 정책원문검사·권한변경 실패는 빈성공/skip으로 낮추지 않는다. 새20번째 수집기의 지연·오류·세션변경/회수불명도 전체 총한도와 동일규칙. policy 포함으로 payload가커져도 timeout/metadata 기본상한을 늘리지 않는다. 기존16개/원문13개 행동 기대와 보안반례를 삭제/완화하지 않는다.

## 필수 연결 반례·검증
- 기존비어있는20자료군·각RR관측/반납·scope제약/false/원문공유IO1·초기차단IO0·후속현재성/회수503를 유지한다. 호출수/최종auth단계는 새고정목록 길이/정확실순서에 맞춰 변경하되 중간phase의문맥/관측자료를 다른child에 주입하지 않는다. 숫자를 무차별일괄치환하지 않는다.
- 메모리 SQL에서 실제 정책collector와 다른자료군을 같이 호출하는 nonempty 정상: 적어도1개 원 POLICY_VERSION dependency가 실제PermissionPolicy ref로해소,원hash와projection다름·미수집/미검증원선언유지. 양null정책증빙 issue는 보존하고 권한허가발급0.
- 같은namespace/id/version의 다른원hash를 양쪽 자료군 각각정상원hash로재봉인한 충돌503,수집된정책에원ref없음 ABSENT, 다른namespace동일ID분리는 유지. unknown/ID-only는unsupported.
- 정책선행원문/명령증거의실collector검증을결과외부주입으로건너뛰지 않는다. 기존 fakeDB는 새5표 열/정렬/선택목록을정확모사한다.
- 신규연결시험먼저RED→같은담당source연결GREEN. Main fresh는 변경영향 composition행동/schema+project-inventory-artifact-verification행동/schema(현재16+13+새반례)만 검사한다. policy collector 자체11개는수정0이면재실행0. typecheck/diff/신규LF·지문/독립C/I0.
실제DB/RLS/키/서비스·원문FS·전체원장/권한복원·archive/restore/UI인수 NOT_RUN. 158E10미채택/API/READY/저장허가우회0. rollback은고정20번째연결/해당시험의검토된revert이며자료/정책/백업삭제0. Main만허용4+WI/결과/WORK_STATUS/WORK_PLAN 정확8경로checkpoint,전체계획미완료.
