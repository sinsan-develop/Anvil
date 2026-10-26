# FN11/FN16/UI14 반출 일회 승인·원명령 실행 연결

2026-10-27 · Main 어울 · 기준 `codex/av3-stage-b` / `76129721c9640ae67b32cbd943436388eea7571a`.

## 목적·승인 범위

WORK_PLAN FN11/FN16/UI14와 FUNCTION_WORK FN11의 모든 변경 명령 AUTO/REQUIRE_APPROVAL/DENY·정확 대상/내용·일회 소비/replay를 기존 exportProject에 연결한다. 기존 선택 원본 반출은 AUTO만 연결하고 REQUIRE_APPROVAL에서는 EXPORT_APPROVAL_NOT_CONNECTED로 막는다. 그 단위의 null 승인 제한을 이번 소비 기능에 한해 확장한다. 새 공개 operation/API·permission 종류·반출 manifest·자료군·quota·새 표/role/GRANT는 만들지 않는다. 전체 반출/복원 재구현도 아니다.

기존 ActionScope·request/decision/authorize/consume·receipt를 재사용하는 승인 계획 안의 집행이다. 실제 DB 적용/정책 부여·사용자 권한·서비스·Secret·Agent·native 실행은 제외한다. 기존 특정 실행 거절과 FN04 후보 보관/CAS 미채택 경계는 우회하지 않는다. SQL은 신규 forward 후보만 작성하고 적용하지 않는다.

## 단일 writer 허용 경로

1. `apps/server/modules/access/project-command.ts`
2. `apps/server/modules/approvals/project-approvals.ts`
3. `apps/server/modules/approvals/approval-input.ts`
4. `apps/web/src/features/backups/project-backups-api.ts`
5. `apps/web/src/features/backups/ProjectBackupsPanel.tsx`
6. 신규 `apps/web/src/features/backups/export-approval.ts`
7. 신규 `apps/web/src/features/backups/ExportApprovalPanel.tsx`
8. `apps/web/src/features/decisions/api.ts`
9. `apps/web/src/features/decisions/ApprovalsPage.tsx` — export 허용 및 settings 복귀 분기만
10. 신규 `db/migrations/0044_project_artifact_export_approval.sql.pending`
11. 신규 `tests/unit/FN16/export-approval-input.test.ts`
12. 신규 `tests/unit/FN16/export-approval-consumption.test.ts`
13. 신규 `tests/unit/FN16/export-approval-api.test.ts`
14. 신규 `tests/browser/UI14/project-export-approval.spec.ts`
15. `apps/server/modules/backups/project-backups.ts` — create32행의 중복 `approvalRef!==null` 거절만 제거한다. 기존 공통 권한/일회 승인 대조를 거친 원 command를 그대로 소비하며 다른 입력·원문·저장·조회 동작은 보존한다.

Main은 제품 수정 없이 관리·검수·통합한다. writer는 한 명이며 다른 변경/보호 untracked 8개는 보존한다. 기존0043·다른 SQL·export store/builder/restore·App 전역 state는 변경하지 않는다. repository는 위 중복 거절 한 곳만 허용한다. 불가피한 추가 경로는 실제 호출선과 최소 diff 근거를 Main에 먼저 전달한다. 새 공통화/의존성/대규모 리팩토링은 하지 않는다.

## 연결 계약

1. 반출 원명령은 기존 targetId=null, expectedVersion=0, baselineRefs=[], payload의 정확 includeSource:false/selection/reason을 유지한다. ActionScope는 operation=exportProject, targetRef=null, expectedVersion=0, baselineRefs=[], environmentRef=null, sourceScopes=[], limitsRef=null이다. requestedSubject/current client·control·policy와 candidateCommandId=원 commandId, payloadHash=정확 원 payload 전체 canonical hash를 결박한다. 선택 document/artifact의 버전·hash와 현재 접근·격리 검사는 기존 서버를 소비한다.
2. 준비는 POST 0. 명확한 APPROVAL_REQUIRED 이후에만 원명령을 잠그고 기존 승인 요청을 명시 전송한다. 송신 결과가 불명확하면 승인 요청이나 새 명령으로 우회하지 않는다. UI08에서 별도 결정한 뒤 UI14가 기존 보호 GET의 정확 승인·주체·제어/정책·기한·미소비·scope를 대조해 명시 결박하고, 별도 사용자 실행으로만 전송한다.
3. 승인 요청/결정/결박만으로 반출·파일 생성은 0이다. 새 영구 후보 원문 저장/조회는 없다. UI14의 원명령·정확 선택/이유를 보존하고 UI08은 기존 scope/hash·요약을 표시한다. 원명령이 사라지면 hash로 payload를 재구성하지 않는다. 다른 기기 자동 복원·자동 승인·자동 송신은 하지 않는다.
4. 승인 결박은 같은 binding/원 commandId·payload를 보존하며 approvalRef만 바뀌는 명시 전이 1회로 한정한다. 불명확한 전송 이후 명령 교체·기존 unknown 해제 금지. 거절/수정요청/만료/DENY/회수·다른 project/user/client/control/policy·payload 변조는 차단한다. late/ABA·세션/API/transport 교체는 원명령을 보존하고 새 문맥을 덮지 않는다. 정상 AUTO/null은 그대로다.
5. 서버는 기존 현재 권한/정책→exact 동일 명령 replay→신규 승인 target/소비·job·receipt·감사를 같은 transaction으로 처리한다. 같은 command/hash 재확인은 한 결과이며 다른 내용409·다른 명령 재사용은 거절한다. 소비 전에 파일 생성으로 성공 표시하지 않는다. job 저장 후 GET 실패는 receipt 보존·별도 조회 실패다. 외부 파일 보관의 기존 unknown/orphan 정책은 바꾸지 않는다.

## 미적용 SQL

0044 번호는 조사 시 비어 있으며 생성 직전 inventory를 다시 확인한다. 기존0035의 wrapper chain을 기준으로 export만 추가한다. `connection_candidate_approval_target_valid` 및 `one_time_consumption_command_authorized`의 기존 plan/detach/host/candidate/upload 경로를 보존하고 새 export 분기는 command 또는 승인 scope 어느 한쪽이라도 export이면 혼합을 거절한다. target null/0·기존 ActionScope 전체·command/승인 소비/receipt/감사 및0043 job/ref/manifest 귀속의 원자 일치를 검사한다. 새 표·role·GRANT와 기존 적용 SQL 수정은 없다. 컴파일/COMMIT·직접 DML/RLS·경합은 실제 PG 미실행으로 남긴다. 현재 FN16 격리 TCP 지원 미결을 우회하거나 재시도하지 않는다.

## TDD·검수

- 실제 기존 REQUIRE_APPROVAL guard와 allowlist·UI 연결 부재의 명확한 RED를 먼저 기록한다. 모듈 부재와 기능 반례를 구분한다. writer는 순수 unit/typecheck/메모리 build만 실행하고 browser/PG/파일 QA는 Main만 수행한다.
- 정상: 준비→명확 APPROVAL_REQUIRED→정확 원명령 승인 요청→UI08 별도 APPROVE→UI14 명시 결박→명시 반출→기존 job/file 조회. 반출 전 각 단계 부작용 0을 확인한다.
- doc/version/hash/artifact/reason·다른 command/project/user/client/control/policy 변조와 거절/만료/회수, 소비 중복·같은 replay/다른 내용, rollback·COMMIT 불명·응답 유실 동일 명령 재확인을 필요한 직접 사례로 검수한다.
- 직접 인접 기존 FN11 approval input·detach/plan 소비와 AUTO/null export 회귀만 선정한다. 기존 검사를 낮추거나 불변 전수 검사를 반복하지 않는다. 실제 PG/RLS/경합·정식 서비스·사용자 인수 미검증을 분리한다.
- Main 실제 App/Edge용 신규 QA root는 `D:/tmp/anvil-v3-stage-b/ui14-export-approval-20261027-01` (dist/results/temp/config.mjs), owner SINSAN\cyhuh, 각 생성 최대30분이다. 생성 전 commentary/WORK_STATUS 등록·부재/owner/nonlink/realpath 확인, 종료 시 exact 자원 정리와 독립 잔류0을 확인한다. writer는 이 자원을 생성하지 않는다.
- 독립 C/I 검수 해소·Main fresh 집중 검증 뒤 소유 allowlist만 기존 branch에 checkpoint/private push한다. 실제 동작 미확인을 전체 기능 완료로 보고하지 않는다.

## 복구

소스는 해당 checkpoint의 후속 revert로 복구한다. 실제 DB/파일 자료는 이 구현 작업으로 변경하지 않으므로 데이터 rollback을 실행하지 않는다. 합성 검증 실패와 실제 서비스 실패를 구분하고 오류 횟수·조치·잔여를 WORK_STATUS에 누적한다.

## Main 내부 상세화 r2

기존14경로에서15경로로 한정 보정했다. d28637 실제 create32행이 승인ref를 다시 거절하는 것을 확인했다. ref를 null로 치환하면 원명령 hash/소비 결박이 깨지므로 중복 거절만 제거한다. 공개 계약·권한·기능 범위 확대가 아니며 신규 사용자 승인 사항을 만들지 않는다. 최초 E7DE1397 지문은 사전 검토 이력으로 보존한다.
