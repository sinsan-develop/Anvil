# WI-U01-HISTORICAL-GIT-FIXTURE-REWORK-20261008-001

## 판정과 기준선

F-19A는 PR #39로 `development/main=0443043251d25aa77c17d23165b7c9299c8dbeb8`에 병합됐다. U-01의 단일 작업 branch `codex/u01-dashboard-r2`에서 epoch97 H `96bef3b3dbd8aa49b3f87d4e36bf591820fc5adf`는 local/private 동일·clean, canonical Event seq2274와 G-05 PASS다. epoch97은 제품 완료가 아니라 `U01_POSTMERGE_CONTROL_CLOSED_REWORK_PENDING`으로 종료됐고 write·worker lease는 REVOKED다. U-01 수직 기능은 `NOT_ACCEPTED`, 새 공개 API 계약은 `AWAITING_HUMAN_DECISION`, Release `DEFER`, Production `NOT_EXECUTED`다.

epoch97의 새 통제 집중10과 실제 G-05는 PASS했지만 인접 F-19A/R48 6파일은 `187 PASS / 38 FAIL / exit1`이다. 대표 3건은 과거 Git 게시본을 검증하는 테스트 fixture가 현 postmerge branch·upstream·HEAD·remote·일부 blob을 혼용해 역사 Git collector 양성을 거부한다. H→epoch97 A의 기존 checker와 역사 테스트 5파일 blob은 동일하며 epoch97 제품 경로 변경은 0이다. 38건을 PASS로 표기하거나 필수 gate에서 건너뛰지 않는다.

설계/계획/매트릭스/테스트계획 SHA-256은 `2171EC811E3F25D672E00E470E1EA6D4A78A9FFBA13540B561CC38B0CAEE9BC7`, `19B7AC91EF17D14AA65BE2BDB871F1B6503565C67ACCEDC558972634A42ACBF4`, `9EE200DCE480497C4DE068963B546129F73679745C27846D593688455B2D38E8`, `C9C208709E71DB7F8769757AD77B5B51E854B0AB3AECAE89C39298C0C2615C8A`다. 승인 부모 `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md`의 기능·요구사항·중요 위험을 바꾸지 않는 `MAIN_RECONFIRMED_NON_SEMANTIC` fixture 후속이며 새 U-01 공개 API 승인으로 해석하지 않는다.

## 소유·정확 범위

- Main 소유: 이 WI·invocation, append-only Event/progress/HANDOFF/detached digest/WORK_STATUS, Git checkpoint·push, 독립 리뷰·G-05·최종 판정. epoch97 seq≤2274 원문과 H의 역사 blob을 보존한다.
- Developer `developer-primary-u01-historical-git-fixture`의 제품 write scope는 `[]`다. 정확 코드·테스트 6경로만 허용한다: `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`, `tests/tooling/test_f19a_start_projection.py`, `tests/tooling/test_f19a_document_successor_projection.py`, `tests/tooling/test_f20_u01_contract_successor_projection.py`, `tests/tooling/test_f20_u01_r48_close_projection.py`. 실제 수정은 원인별 최소 파일만 수행하며 다른 테스트·제품·DB·Web·WSL-server·서버·Git commit/push는 금지한다.
- Main은 seq2275 WorkInstruction→2276 worker→2277 write의 분리 24시간 fencing token을 발급한다. A docs-only local/private 동일·clean 후 Developer에게 code write를 인계한다. 단일 writer이며 Main은 lease 동안 위 6경로를 수정하지 않는다.

## 구현·검증

1. 각 역사 양성 fixture는 그 테스트가 증명하려는 **과거 게시 commit의 Git 관찰**만 재현한다. branch/upstream/HEAD/remote/history/ancestor/blob/dirty가 실제 과거 근거와 맞는지 읽기 전용으로 대조한 뒤 mock을 좁게 수정한다. 실제 현 postmerge 브랜치를 과거로 위장하거나 운영 검사기의 fail-closed 조건을 완화하지 않는다. 원격 불일치·dirty·다른 branch·다른 blob·위조 Event의 음성은 계속 실패해야 한다.
2. 새 epoch98 G-05 경로는 H `96bef3b3`의 seq2274 CLOSED bundle을 기존 validator로 먼저 확인하고, A→C→B→H의 새 WI/lease·정확 변경경로·Event 원문/chain·snapshot/digest·현재 branch/upstream/remote/clean을 순서별로 결박한다. U-01 수직 `NOT_ACCEPTED`, 공개 API `AWAITING_HUMAN_DECISION`, 제품 scope0, Release `DEFER`를 불변으로 유지한다. 역사 검사 경로의 테스트 편의를 실제 현재 상태 validator에 적용하지 않는다.
3. Developer는 대표 실패 RED→GREEN, 영향받은 6파일 인접 전체 GREEN(38건 포함), 새 통제 집중·위조 음성, `git diff --check`, 기존 Ruff 대비 변경 줄 신규0, 임시 fixture 잔여0, 정확 명령·종료 코드·SHA를 보고한다. 실제 실행 못한 검증은 미검증으로 표시한다. Main은 독립 코드 리뷰, 실제 G-05, local/private SHA와 clean 상태, 필요한 Web 기본 회귀를 확인한다.

## 완료·복구

이 WI의 완료는 역사 fixture와 U-01 착수 통제의 정합이지 U-01 제품 인수가 아니다. 38건 중 실패가 남으면 `NON_GREEN`으로 보존하고 다음 제품 단계나 PR/병합으로 승격하지 않는다. 실패·중단 시 같은 branch의 안전한 WIP commit/원격 ref와 WORK_STATUS를 남기며 dirty 자료를 삭제·reset하지 않는다. force push/history rewrite·새 branch·Production·ysna-server 작업은 금지한다. 별도 사용자 결정을 기다리는 공개 API/인가/DB 제품 write는 하지 않는다.
