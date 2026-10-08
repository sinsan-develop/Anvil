# WorkInstruction — F-20/U-01 R34 범위 제한 Run 운영 카드

- 담당: `developer-primary-f20-u01-r34` 단일 제품 writer. Main의 seq2004 no-lease에서 정식 worker/write dual lease 발급·G-05 PASS 후에만 착수한다.
- 기준: 설계 §29.2, 작업계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8, `docs/04_test_reports/F-20_U01_R34_SCOPED_RUN_CARDS_PLAN.md`. Dispatch에 문서 hash, branch/HEAD/status, 두 fencing token·만료를 전달한다.
- 분류: 승인된 U-01의 세 Run 상태 카드 실제 read-model 절편. 기존 공개 Dashboard GET의 응답 필드가 확장되므로 exact-shape 소비자 회귀를 필수로 검증한다. 신규 route/권한/DB schema/지속 데이터/Secret·운영 배포는 없다.

## write allowed_paths 정확히 8개

1. `packages/api/operations.py`: 기존 Dashboard GET에 검증된 `run_summary` 성공/비가용 필드를 추가한다. 범위·권한 선행 검사를 유지하고 Run source 실패를 0으로 둔갑시키지 않는다.
2. `apps/web/src/console/App.tsx`: exact 응답 파서와 첫 세 운영 카드만 연결한다. 관측 분모/시각을 표시하고 미래·오염·누락 및 상위 조회 실패 시 수치를 숨긴다. 나머지 세 카드는 `UNAVAILABLE` 유지.
3. `tests/api/test_f20_u01_r10_dashboard_api.py`: 성공·빈 scope·부재/오류/변조/overflow·foreign scope·비밀/기존 경로 회귀를 RED→GREEN으로 검증한다.
4. `apps/web/tests/f15-console.test.mjs`: 세 카드 값/분모/시각, fail-closed 상태, 나머지 세 카드·기존 Dashboard 회귀를 RED→GREEN으로 검증한다.
5. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 기존 formal fixture와 exact API/browser 증거 계약을 새 필드에 맞춰 검증한다. opt-in guard와 source 범위는 유지한다.
6. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 실제 OIDC/HTTPS/Chromium의 API↔DOM, 같은 origin, 권한 철회, 거짓 0 비노출을 검증한다. 증거 key·파일명은 필요 없이 바꾸지 않는다.
7. `docs/04_test_reports/F-20_U01_R34_SCOPED_RUN_CARDS_RESULT.md`: 기준·lease·RED/GREEN·로컬/WSL 출처·미검증·rollback을 분리해 기록한다.
8. `tests/tooling/test_f20_u01_r33t_start_projection.py`: 현재 seq2004에서 실패하는 R33T 시작 역사 테스트 2건을 고정 과거 기준으로 복구한다. 현재 G-05와 역사 변조·만료 거부를 별도 유지하고 원장/checker/overlay 수정, 삭제·skip/xfail 금지.

## 완료조건과 금지

- 기존 `ScopedRunStatusSummary`/DB reader/OIDC host를 재사용한다. 각 숫자는 인가된 Project/Environment의 완전한 최대 100 Run 조회만 대표한다. Queue job·Worker lease·승인 객체 수나 실제 실행 프로세스 수로 해석하지 않는다. 별도 Run `observed_at`과 Dashboard snapshot 시각을 혼동하지 않는다.
- Developer는 착수 전 canonical G-05, branch/HEAD/status, actor·두 token·만료·exact8 scope를 확인한다. R33T 역사 테스트 복구를 API/UI 작업보다 먼저 수행한다. Main 소유 Event/progress/HANDOFF/WORK_STATUS/control, 사용자 dirty/untracked는 수정·stage·삭제하지 않는다.
- TDD RED→GREEN, API/Run/OIDC·Console·browser/문법·web typecheck/lint/build·관련 Python 비 opt-in·G-05·diff check를 실행한다. 미실행·SKIP은 PASS가 아니다. 임시 출력은 exact 대상·실경로·링크·프로세스를 확인한 뒤 정리한다.
- Developer는 commit/push/PR/merge, 새 branch/main, WSL-server/Docker/DB, ysna/Production을 건드리지 않는다. Main은 독립 검토·commit/private push·WSL-server 동일 SHA 실제 QA·자원 정리를 맡는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. R34 PASS도 U-01/F-20 인수는 아니고 C30 `OPEN_BLOCKING`/DEFER를 유지한다.
