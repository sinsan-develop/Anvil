# WI-U01-SCOPED-DASHBOARD-TASK3-20261009-001

## 판정·기준선

신산님이 승인한 정확 pair·기간 Dashboard 계약 `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md` SHA-256 `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`, 승인 기록 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md` SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`, 구현 계획 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` SHA-256 `002977BDB7B634E974E4926F1FA52D6DC520450F92EBE64AB490EE6BD773C8C3`의 Task 3만 수행한다. 같은 단일 branch `codex/u01-dashboard-r2`의 Task2 H `36ba79fca821bb38e2585f76f96e3933f915400e`가 local/private 동일·clean이고 G-05 seq2299·종료 집중10 PASS, epoch102 두 lease는 REVOKED다. U-01 수직은 아직 `NOT_ACCEPTED`다.

## 정확 범위·소유

- Main은 WI·invocation, append-only Event, progress/HANDOFF/digest/WORK_STATUS, Git checkpoint·push와 독립 검토를 소유한다. 새 branch를 만들지 않는다.
- 단일 Developer `developer-primary-u01-scoped-dashboard-task3`는 새 worker/write fencing token 모두 유효하고 A 문서 local/private 동일·clean을 Main이 통지한 뒤에만 지정 경로를 쓴다. Main은 활성 Developer lease 동안 그 경로를 수정하지 않는다.
- 통제 2경로: `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`.
- 제품 3경로: `apps/web/src/console/App.tsx`, `apps/web/src/console/app-shell.css`, `apps/web/tests/f15-console.test.mjs`. Browser harness 변경이 필수라면 Main에게 정확 경로·근거를 먼저 보고하고 제품 write 전에 별도 범위를 투영한다.
- 제품 write는 통제 RED→GREEN·독립 C0/I0·활성 G-05·통제 C/B 원격 checkpoint·clean을 Main이 확인한 후에만 연다. Git commit/push·문서·DB·WSL-server 작업은 Developer가 하지 않는다.

## Task 3 제품 계약

1. 기존 `GET /api/dashboard/project-environments`의 활성 정확 pair 목록에서 선택한다. Project ID와 Environment ID를 독립 집합으로 합성하지 않는다. 목록 재조회·조합 변경·권한 상실 시 이전 pair 데이터와 cache를 폐기한다. 서버 권한 부재·철회·비활성은 이전 정보 노출 없이 차단한다.
2. 기간은 정확 `1d|7d|30d` 중 하나다. 새 요청은 same-origin 상대 경로 `/api/projects/{projectId}/environments/{environmentId}/dashboard?period=...`만 호출한다. 브라우저 절대 API·localhost·내부 Docker 주소는 쓰지 않는다. 서버가 반환한 `period`/`pair`만 근거로 표시하고 브라우저 timezone을 기간 권위로 사용하지 않는다.
3. pair·기간·목록 전환 시 `AbortController`와 증가하는 request identity를 함께 사용한다. 취소가 무시되거나 응답 순서가 역전돼도 오래된 response/error는 상태를 덮어쓰지 못한다. 새 선택의 loading·error·empty와 권한 실패를 명확히 분리한다.
4. `current`와 `occurrences`를 섞지 않는다. 카드별 `sourceCompleteness`, `observedAt`, `reason`, `UNAVAILABLE`/`null`을 근거와 함께 표시한다. 미연결·미실행·불완전 수치를 0/PASS로 꾸미지 않는다. 기간 밖에서 발생했지만 미해결인 Critical과 Next Action은 현재 영역에 남긴다. 기존 고정 Dashboard 카드·Critical 목록/ACK와 정상 운영 흐름을 회귀시키지 않는다.
5. 1920×1080·기본 12px 기준에서 과도한 상시 설명 박스 없이 선택·오류·근거를 읽을 수 있어야 하고, 두 Select/키보드/포커스/스크린리더 이름을 확인한다. 실제 브라우저·Network·PG15/OIDC/HTTPS는 Task4의 WSL-server 동일 SHA 정식 검증 전에는 미검증이다.
6. 새 migration/schema·지속 쓰기·인증 우회·Secret·운영/ysna-server는 금지한다. UI 구현 중 공개 계약/권한·중요 위험 변경이 필요하면 임의 확장하지 않고 Main에게 증거와 선택지를 전달한다.

## TDD·검증·게이트

- 통제 먼저: Task2 H seq2299에서 새 WI/dual lease A→통제 C/B→제품 D/P→H의 정확 successor만 수용하는 fail-closed route를 RED→GREEN한다. Event 원문·chain, 24시간 분리 token/scope, snapshot/digest, branch/upstream/remote/clean, Task2 H 불변, U-01 미수락을 위조 음성으로 검증한다. 새 route 부재 bootstrap RED를 PASS로 기록하지 않는다.
- 제품 RED: 정상 두 pair, 권한 철회 후 재선택, 목록 재조회, 기간 전환, 역순·abort 무시 응답, 현재/기간 별도 근거, UNAVAILABLE·503·403·loading·empty·키보드와 기존 GET/ACK 유지 테스트를 먼저 만든다. 가짜 0/PASS, cross-pair 노출, browser 절대 URL을 음성으로 막는다.
- 집중 `npm run web:test`, typecheck/lint/build, 관련 콘솔/API 회귀, `git diff --check`, G-05를 실제 종료 코드와 함께 보고한다. 실제 PG15/OIDC/HTTPS/Chromium·Network/PNG는 Main의 Git exact SHA WSL-server 검증 전 미검증이다.
- Main은 통제 C/B 원격·clean·G-05 후에만 제품 write를 개방한다. 제품 D/P·검증·독립 리뷰 후 write→worker 순서로 두 lease를 회수한다. Task4·PR/main 병합은 후속 게이트다.

## 실패·복구

동일 정식 `FAILURE_REPORT` 1·2·3회 절차와 Main takeover 규칙을 적용한다. 실패·중단 dirty 파일은 reset/삭제하지 않고 안전한 WIP·원격 복구 ref와 상태를 남긴다. rollback은 이 Task3 UI commit을 revert하되 Task1/2 API·기존 GET/ACK·등록 원장·감사 Event를 보존한다.
