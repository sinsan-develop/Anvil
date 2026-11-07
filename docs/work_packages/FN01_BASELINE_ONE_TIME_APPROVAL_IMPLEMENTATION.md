# FN01/FN11/UI02 기준선 3연산 일회 승인 집행

2026-10-27 · Main 어울 · 기준 `codex/av3-stage-b` / `8bd9232e68329cf1e1bee417f2fcb5ef29549dad`.

## 목적과 기존 승인

기존 saveBaselineDraft→reviewBaselineContent→confirmBaseline의 AUTO 경로는 구현돼 있으나 REQUIRE_APPROVAL는 BASELINE_APPROVAL_NOT_CONNECTED에서 막힌다. 승인된 FN01 기준선·FN11의 모든 변경 명령별 일회 승인과 기존 ActionScope/request/decision/authorize/consume/receipt를 연결한다. FN01_BASELINE_IMPLEMENTATION.md에 연결된 직접 A안 승인과 현재 계획을 기준으로 하며, 옛 제안서 머리의 PROPOSED_NOT_APPROVED만으로 승인을 취소하지 않는다.

각 연산의 정확 원명령마다 별도 승인을 소비한다. 초안 저장 승인을 내용 검토·채택으로 전파하지 않는다. 승인 자체가 실제 source·CORE 증거/기능 검증·실행 허가를 뜻하지 않는다. FN04 activation 후보/CAS 미채택 delta와 다르며 HUMAN CapabilityReport R2를 증거 생산자로 새로 채택하지 않는다.

새 operation/API·permission·공개 payload/DTO·원문 영구 후보 저장/다른 기기 복원·표/role/GRANT는 만들지 않는다. 실제 DB 적용·정책/사용자 권한·TLS/서비스·Secret·Agent/native는 제외한다. 기존 SQL과 이미 검수된 기준선/source/CORE 검사는 보존한다.

## 단일 writer 허용17경로

1. `apps/server/modules/access/project-command.ts`
2. `apps/server/modules/approvals/project-approvals.ts`
3. `apps/server/modules/approvals/approval-input.ts`
4. `apps/server/modules/projects/project-baselines.ts`
5. `apps/web/src/features/project-create/baseline-api.ts`
6. `apps/web/src/features/project-create/ProjectBaselinePanel.tsx`
7. 신규 `apps/web/src/features/project-create/baseline-approval.ts`
8. 신규 `apps/web/src/features/project-create/BaselineApprovalEditor.tsx`
9. `apps/web/src/features/decisions/api.ts`
10. `apps/web/src/features/decisions/ApprovalsPage.tsx` — 해당 3연산 허용·기준선 복귀 분기만
11. 신규 `db/migrations/0045_baseline_one_time_approval.sql.pending`
12. 신규 `tests/unit/FN01/baseline-approval-input.test.ts`
13. 신규 `tests/unit/FN01/baseline-approval-consumption.test.ts`
14. 신규 `tests/unit/UI02/baseline-approval-api.test.ts`
15. 신규 `tests/browser/UI02/baseline-one-time-approval.spec.ts`
16. `tests/unit/FN01/baseline-command-policy.test.ts` — 옛 미연결 오류 기대 2건만 새 명시 오류로 갱신하고 writer 부작용0·기존 DENY/만료/주체/세대·replay 검사는 보존한다.
17. `tests/unit/FN01/baseline-store.test.ts` — 잘못된 `{fake:true}` 승인 참조의 옛 미연결 오류 기대1건만 `APPROVAL_REFERENCE_INVALID/422`로 정확 갱신한다. 기존 원문 격리·변경·주체/receipt 무결성 시험은 보존한다.

Main 제품 수정0·code writer1명. App 전역 buffer와 기존 upload 승인 helper/component·baseline input/decision/source/validation은 소비하고 수정하지 않는다. 불가피한 추가 경로는 실제 호출선·최소 diff를 Main에게 먼저 보고한다. 다른 dirty·보호 untracked8은 보존한다. 새 공통화·의존성·구조 개편은 하지 않는다.

## 원명령·기준·저장/조회

1. payload는 기존 정의 그대로다. saveBaselineDraft target은 input.baseRef 또는 최초 null/0, reviewBaselineContent·confirmBaseline은 정확 draftRef/fullhash/version이다. 기존 baselineRefs=[]와 환경/소스/한도 ActionScope null/[]를 유지한다. 현재 HUMAN/user/client·control·policy와 원 candidateCommandId·payloadHash 전체를 결박한다. 단순 ID/version 일치로 fullhash를 생략하지 않는다.
2. 준비는 POST0이며 **명확한 APPROVAL_REQUIRED**에서만 기존 원명령을 잠근다. 그 명령으로 기존 승인 요청→UI08 별도 결정→UI02 보호 GET/명시 결박→별도 사용자 실행을 제공한다. UNKNOWN/응답 유실 뒤의412는 새 승인 준비로 바꾸지 않는다. 원명령이 없으면 hash만으로 payload를 재구성하지 않는다.
3. 원 commandId·payload·기준을 보존하며 approvalRef만 명시적으로 한 번 결박한다. 세 연산은 독립 승인이고 기존 uploadArtifact 승인을 재사용/전파하지 않는다. 준비/승인/결박만으로 저장·검토 기록·채택0이다. 다른 subject/client/세대/정책·기한·거절/수정/회수·다른 command/payload/ref/hash는 차단한다.
4. UI의 prepareBaselineCommand/prepareBaselineAdoption/envelope/send뿐 아니라 **recheckBaselineCommand도 이미 결박한 approvalRef를 null로 되돌리지 않게** 한다. dirty·reviewDirty·upload pending·검토/채택 원명령과 late/ABA/session/API/transport 교체 보호를 유지한다. 원명령 불명은 같은 명령으로만 수동 재확인한다. 후속 조회 실패는 확인된 receipt를 보존하며 새 command로 우회하지 않는다.
5. repository의 #envelope null 거절과 #receipt의 null 승인 재구성·소비null 제한을 한정 보정한다. 같은 원명령 hash·정확 승인 소비/receipt/감사에 연결하고 쓰기 뒤 기존 불변 초안·검토·채택을 재조회할 수 있게 한다. 역사 reader는 당시 immutable policy/subject/approval를 검증하고, 후속 합법 정책·control 변화만으로 과거 기록을 위조로 취급하지 않는다. 현재 source/head/CORE·내용 검토·별도 채택/CAS 조건은 그대로 검사한다.
6. 서버는 현재 권한·단독 control/정책→동일 합법 명령 replay→신규만 target/head·source/기준/내용·별도 승인 소비→자료/receipt/감사 원자 저장이다. 같은 명령/다른 내용409, 다른 명령의 승인 재사용0. 실제 소스가 미확인이면 승인으로 VERIFIED/구현완료를 만들지 않는다.

## 신규 미적용 SQL

0045는 Main541db3 inventory에서 부재 확인했으며 생성 직전 다시 확인한다. 기존0015와 다른 적용/미적용 SQL은 수정하지 않는다. baseline_authorized/guard_feature_baseline의 AUTO/null 전용 조건과 원명령 재구성을 신규 forward로 한정 확장한다. 공통 승인 target/consumption wrapper는 **현재0044 통합 후 chain**을 보존하며 baseline 3연산만 추가한다. export·saveWorkPlanDraft·detach·upload·candidate/trust 기존 분기를 잃지 않는다.

명령/승인 scope 어느 쪽만 baseline인 혼합도 거절하고, target/fullref·payloadHash/requestHash·policy·actor/client·receipt/audit·자료/version/head·승인 소비를 원자 대조한다. 감사 주체·기기·source_kind를 생략하지 않는다. 최종 command/소비/자료 연결을 UPDATE/DELETE로 무력화할 수 없게 하되 정상 INSERT·기존 AUTO/다른 연산은 유지한다. 현재권한 확인과 과거 불변 이력 읽기를 구분한다. 실제 SQL compile/DML/COMMIT/RLS/경합은 실행하지 않고 NOT_RUN으로 기록한다.

## TDD·검수·자원

- 먼저 신규 시험만 작성하고 기존제품/SQL불변에서 실제 baseline guard의 기능 반례 RED를 Main이 확인한다. 모듈 부재 RED와 구분한다. writer는 pure fake unit·type·메모리 build만 실행하고 실제 파일/브라우저/PG QA는 하지 않는다.
- 정상 최소 수직 여정: 초안 저장의 명확412→정확 승인 요청/별도결정·결박·실행→재조회, 저장 ref에 대한 내용 검토의 별도 승인·기록/재조회, 최신 적합 검토의 별도 채택 승인·명시 채택/이력 재조회. 승인 전 단계별 변경0과 세 원명령/승인 분리를 대조한다.
- 중요한 음성: 정합 재해시한 다른 ref·payload/이유·source/증거·최신 검토·policy/control 변경, DENY/만료/거절·재사용, 현재회수/변경에도 합법 과거이력 읽기, replay/다른내용·부분 transaction rollback, UNKNOWN 단조/응답유실·후속GET실패·주체이탈/ABA. 합성 시험이 실제 source 검사나 SQL 실행의 증거는 아니다.
- 변경 영향의 기존 FN01 baseline policy/store/routes·UI02 API/upload 승인, 공통 FN11와 반출 승인 직접 회귀를 필요한 범위만 선택한다. FS fixture는 Main 사전등록 없이 실행하지 않는다. 기존 기준을 낮추거나 불변 전수 검사를 반복하지 않는다.
- Main actual App/Edge용 새 root `D:/tmp/anvil-v3-stage-b/ui02-baseline-approval-20261027-01`, dist/results/temp/config.mjs, owner SINSAN\cyhuh·각 생성 최대30분. 생성 전 commentary/WORK_STATUS·부재/owner/nonlink/realpath 등록, 종료 후 exact 정리·별도 잔류0 확인. env `ANVIL_UI02_BASELINE_APPROVAL_DIST`는 해당 dist만 허용한다.
- 독립 명세/코드·SQL 검수 C/I 해소와 Main fresh 검증 뒤 소유 파일만 기존 branch에 checkpoint/private push한다. 실제 DB/served·사용자 인수·전체 FN01/FN11/Stage/계획 완료로 승격하지 않는다.

소스 rollback은 후속 revert로 가능하며, 이 작업에서 실제 DB·지속 자료 복구/삭제는 실행하지 않는다. 단계/담당/상태·파일·검증·오류 횟수·미확인·다음 조치를 WORK_STATUS에 누적한다.

## Main 내부 상세화 r2

Main8c79b4/c7655f로 기존 시험32행이 당시 미연결 오류를 기대하는 것을 확인했다. REQUIRE_APPROVAL/null은 APPROVAL_REQUIRED/412, AUTO의 불필요 승인 참조는 APPROVAL_NOT_REQUIRED/422로 정확히 구분하며 모두 writer 호출0을 유지한다. 기존 기능 미구현을 기대하는 문구만 승인 기능의 새 동작으로 변경하는 것이며 합격 기준 완화가 아니다. 최초 F2B3E1C4 지문은 사전 검토 이력으로 보존한다.

### r3 기존 저장소 시험 상세화

Main a8e8f1에서 기존 baseline-store.test.ts의 실제 잘못된 참조가 `{fake:true}`임을 확인했다. 기존의 미연결 거절 대신 기존 정확 ref parser가 거절하는 계약을 시험하도록 한 경로/한 기대만 추가 허용했다. 최초 담당 보고의 `{id:...}` 설명은 실제 source와 달라 이 기록으로 바로잡으며 기대를 느슨하게 바꾸지 않는다. r2 855BD430 지문은 이력으로 보존한다.
