# WI-U01-POSTMERGE-INTAKE-CONTROL-20261008-001

## 판정·기준

F-19A는 PR #39로 `development/main=0443043251d25aa77c17d23165b7c9299c8dbeb8`에 실제 병합됐다. PR merge `04430432`의 부모는 옛 main `462c2e5b`와 작업 merge `096e6dfd`, 후자의 부모는 종료 H `c232cb71`와 옛 main이며 세 tree는 동일하다. clean main의 `--f19a-whitespace-merged-smoke`는 PASS, 이전 작업 branch/임시 tag는 삭제됐다. 현 단일 branch `codex/u01-dashboard-r2`는 이 main에서 시작해 문서 조사 3경로만 가진 `55e225522c1121530b1e7e4678b0c46ea33352ba`를 local/private 동일·clean으로 게시했다. 이전 seq2269의 CLOSED G-05는 옛 branch/main을 요구해 현재 `F19A_WHITESPACE_CLOSE_GIT_INVALID`이며 새 branch 합격을 의미하지 않는다.

설계/계획/매트릭스/테스트계획 SHA-256은 순서대로 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, `9EE200DCE480497C4DE068963B546129F73679745C27846D593688455B2D38E8`, `C9C208709E71DB7F8769757AD77B5B51E854B0AB3AECAE89C39298C0C2615C8A`다. parent F-19A 승인 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`의 기능·요구사항·중요 위험을 변경하지 않는 `MAIN_RECONFIRMED_NON_SEMANTIC` 후속이다. 새 U-01 공개 API/인가/DB 계약은 별도 신산님 결정을 기다리며 이 WI가 승인하지 않는다.

## 정확 소유·순서

- Main 소유: 이 WI·invocation, append-only Event/progress/HANDOFF/detached digest/WORK_STATUS, 기존 U-01 조사·계약 제안 문서, Git checkpoint·push, 최종 G-05와 리뷰. Developer 코드 write는 A docs-only가 local/private 동일·clean이 된 뒤에만 허용한다.
- Developer `developer-primary-u01-postmerge-control`의 정확 코드 경로는 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py` 두 개다. 제품 경로 `[]`; 등록·권한·Dashboard API/UI·DB·WSL-server·다른 worktree·Git commit/push는 금지한다. 한 시점 한 writer이며 Main은 유효한 worker/write 두 fencing token 발급 후 이 경로를 수정하지 않는다.
- Main은 seq≤2269 Event 원문을 byte 보존하고 epoch97 `WORK_INSTRUCTION_ISSUED` seq2270 → `WORKER_LEASE_ISSUED` seq2271 → `WRITE_LEASE_ISSUED` seq2272를 발급한다. 24시간 만료의 분리 token을 exact2와 이 WI SHA에 결박한다. A→C(정확2)→B→write/worker 회수 seq2273/2274의 순서로 게시하고 각 단계의 clean/private/G-05를 확인한다. 새 route가 아직 없는 A의 기존 G-05 RED를 PASS로 표시하지 않는다.

## 구현·검증

1. 새 G-05 projection mode는 **현재 branch의 postmerge 사실**을 검사한다. immutable `c232cb71`의 seq2269 CLOSED bundle은 기존 validator로 확인하고, PR P `04430432`의 정확 부모/동일 tree, M `096e6dfd` 부모/동일 tree, F-19A 원본 5 blob과 whitespace 예외 및 Broker diff를 검증한다. P→`55e22552`는 정확 문서 3경로만 허용하며 이후 A/C/B/H 이력과 remote SHA·clean·branch/upstream을 순서별로 확인한다. 다른 main, second branch, 추가 product/문서 경로, stale grant, 원격 미게시, 조작 Event·hash·lease·detached digest는 fail-closed다.
2. 현재 progress의 `merge pending`은 실제 Git 사실로 교체하되 완료된 F-19A와 과거 seq≤2269·completed leases는 보존한다. U-01의 제품 write는 새 API 계약 승인까지 잠금, Release `DEFER`, Production `NOT_EXECUTED` 유지. 예전 U-01 `LOCAL_WEB_SCOPED` 기록을 수직 `ACCEPTED`로 승격하지 않는다.
3. Developer는 RED→GREEN 집중 검사, 위조 음성, F-19A/R48 인접 회귀, `git diff --check`, 기존 Ruff 대비 변경 줄 신규0, 임시 fixture 잔여0과 정확 SHA를 보고한다. Main은 독립 코드 검토와 실제 G-05, local/private SHA·clean·Web 기존 회귀를 재확인한다. 전체 Ruff 기존 실패를 GREEN으로 쓰지 않는다.

## 완료·rollback

이 WI의 완료는 F-19A postmerge 증거와 U-01 착수 통제 정합이지 U-01 제품 인수가 아니다. 실패 시 원격 main P와 기존 seq≤2269를 보존하고 미게시 dirty 자료를 삭제하지 않는다. 후속 비제품 commit은 정상 revert 가능하며 force push/history rewrite/main 직접 개발은 금지한다. 제품 경계의 인간 승인 전에는 해당 write를 시작하지 않는다.
