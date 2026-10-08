# WI-F19A-INTEGRATION-WHITESPACE-GATE-20261008-001

## 판정·기준

F-19A 로컬·WSL-server 범위는 수락됐고, epoch95 종료 seq2264/`3f0f51100d66283e39fca61ec944aabbe28467cf`는 clean·private 동일·G-05 PASS다. 원격 `main`은 `462c2e5b27823de2c1184f56f0fa9908a2cea328`이며, PR Broker가 실행하는 `git diff --check main...HEAD`는 기존 5경로의 과거 EOF 빈 줄에서 실패한다. `git -c core.whitespace=-blank-at-eof diff --check main...HEAD`는 PASS다. 원본 파일 바이트를 바꾸면 F-20 보고서의 고정 SHA 및 제품 QA 기준이 달라질 수 있으므로, 경로별 Git whitespace 판정만 비의미적으로 제한한다. 설계·작업계획·매트릭스·테스트계획 SHA는 각각 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, `9EE200DCE480497C4DE068963B546129F73679745C27846D593688455B2D38E8`, `C9C208709E71DB7F8769757AD77B5B51E854B0AB3AECAE89C39298C0C2615C8A`다.

## 소유·허용 범위

- Main은 WI·invocation·Event/progress/HANDOFF/digest/WORK_STATUS, Git checkpoint·push·merge·PR·독립 판정을 소유한다. Developer가 lease를 가진 동안 Main은 코드 경로를 수정하지 않는다.
- Developer `developer-primary-f19a-pair-grant`의 허용 코드 경로는 정확 `.gitattributes`, `scripts/check_project_progress.py`, `tests/tooling/test_f20_u01_r48_close_projection.py`다. 제품 write scope `[]`. 다른 제품·문서·원본 5경로·WSL-server·DB·브라우저·다른 브랜치/worktree·Git commit/push는 금지한다.
- Main은 종료 seq2264 확인 후 epoch96 `WORK_INSTRUCTION_ISSUED → WORKER_LEASE_ISSUED → WRITE_LEASE_ISSUED`를 append-only 발급하고, 24시간 분리 execution/write token과 WI SHA·정확3 경로를 결박한다. A docs-only private/clean 전에 Developer code write 금지.

## 구현·검증

1. `.gitattributes`에 아래 정확 5경로만 `whitespace=-blank-at-eof`를 추가한다: `apps/api/anvil_api/projects_scan.py`, `apps/web/tests/menu-routes.test.mjs`, `apps/web/tests/projects.test.mjs`, `docs/04_test_reports/F-20_WSL_FINAL_VALIDATION_REPORT.md`, `tests/api/test_projects_scan_api.py`. 기존 `* text=auto eol=lf`와 binary 규칙 보존, 다른 공백 오류 검출 유지, 대상 5경로의 blob/working bytes 불변 확인.
2. G-05의 epoch95 closed 후속 경로를 새 epoch96 A(문서)→C(정확3 코드)→B(문서)→write/worker 회수(문서)→정확 `main` merge/PR로 확장한다. bootstrap RED를 PASS로 주장하지 않는다. 추가 commit/경로·token/순서/해시 위조, 원본5 수정, 다른 whitespace 예외, `main` drift, dirty·원격 불일치, F-19A/U-01/Release 상태 변경은 거부한다. 기존 Event seq1~2264 원문 보존.
3. Developer는 RED→GREEN 집중 테스트, F-19A/R48 인접 회귀, `git check-attr whitespace` 5경로 및 대조 경로, 실제 `git diff --check development/main...HEAD`, Ruff 변경 줄 신규0, 임시 잔여0을 보고한다. Main은 독립 리뷰와 G-05, 최종 Web typecheck/lint/build/test 및 병합 전 gate를 검증한다. 전체 Ruff 기존 실패는 PASS로 승격하지 않는다.
4. Main은 C/B/H를 각 private 동일·clean으로 게시한 후 원격 `main` SHA가 불변이고 merge-base→main tree diff0일 때만 기존 브랜치에 정확 한 번 merge한다. PR Broker 경로와 merged-main smoke를 검증하고, merged main 확인 후에만 브랜치·worktree를 정리한다. U-01 제품 write는 F-19A 통합 gate 완료 전 금지한다.

## 완료·rollback

이 WI는 기존 승인된 F-19A 통합의 비의미 Git gate 보완이며 F-20/U-01·Release·Production 또는 신규 브랜치를 승인하지 않는다. 실패 시 기존 원격 `3f0f5110`과 append-only Event를 보존하고, 미게시 변경/dirty 자료는 삭제하지 않는다. force push/history rewrite/main 직접 개발/서버 patch 금지. Developer 동일 근본 원인의 유효 FAILURE_REPORT 3회에서만 Main 직접 인수한다.
