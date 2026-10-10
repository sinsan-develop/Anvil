# WI-U01-TASK4-POST-H4-REPORT-TAIL-20261010-001

## 판정과 범위

승인된 U-01 Task4/G-05의 비제품 후속 통제 재작업이다. 기존 단일 `codex/u01-dashboard-r2`에서 H `c821a4661a601c16b3b22964e2f4054719cc4fd2`의 로컬·WSL-server G-05 seq2339와 focused34 PASS를 보존한다. H의 직접 자식 결과보고 R2 `84393391829309e4c20d140a8ff94edf8175f63e` 및 그 직접 자식 진단 D `beb8cccf69150483033d0de7c1fea37bb1d56edd`는 private 원격 동일·tracked clean이나 최신 G-05 `U01_TASK4_POST_H4_GIT_INVALID`다. 기존 collector는 B→H만 마지막 leg로 요구하고 과거 R의 `design_change.md` blob을 최신에도 요구하므로, 정상 보고를 기록할 때마다 다시 RED가 되는 것이 원인이다.

Main 판정: 이 작업은 기능·요구사항·공개 API·DB·인증·Secret·운영·비용을 바꾸지 않는 내부 진행 검증 보완이다. 역사 H4→R→P→W→A→C→B→H의 검증, Event 원문, 승인 binding은 완화하지 않는다. 보고 내용의 참·거짓은 독립 증거 검토 대상이며, G-05 GREEN만으로 Foundation R6나 U-01을 수락하지 않는다.

## 소유와 정확 write 경계

- Main은 이 WI/Invocation, 다음 epoch의 분리된 worker/write dual lease와 append-only Event, progress/HANDOFF/digest/WORK_STATUS, Git checkpoint/private push, 독립 검토, WSL-server 단일 격리 통제 QA·정리를 소유한다.
- 유효한 두 fencing token·24시간 만료·이 WI hash·clean/private A checkpoint를 확인한 **단일** `developer-primary`만 `scripts/check_project_progress.py`와 `tests/tooling/test_u01_postmerge_control_projection.py` 정확 두 경로를 TDD로 수정한다. 제품 write scope는 0이다. Main은 활성 write lease 동안 두 code path에 쓰지 않는다.
- 제품/API/UI/DB/브라우저/Secret, 역사 commit·Event·승인 원문, WSL-server/ysna/Production, Developer의 Git commit/push/PR/merge는 허가하지 않는다. 새 branch/worktree·history rewrite·force push는 없다.

## fail-closed 계약

1. H의 기존 validator와 H4 이후 모든 역사 Git leg를 그대로 검사한다. H→R2는 **직접 부모·한 커밋·정확3경로**(`design_change.md`, `docs/WORK_STATUS.md`, `docs/04_test_reports/U-01_TASK4_POST_H4_SUCCESSOR_H_WSL_CONTROL_QA_RESULT.md`), R2→D는 **직접 부모·한 커밋·정확2경로**(`design_change.md`, `docs/WORK_STATUS.md`)이며 세 commit의 SHA와 각 역사 blob을 고정한다. 현재 `design_change.md`는 R의 과거 blob과 같을 필요가 없지만, 과거 R blob과 R2/D의 실제 각 blob은 독립적으로 검증한다.
2. 새 WI/Invocation·WORK_STATUS 정확3문서 W2→dual lease A→코드 C→활성 B→회수 H2의 단일 부모·정확 경로, 원격 SHA·dirty0, Event raw/chain·seq/시간, worker→write 발급과 write→worker 회수, token·epoch·만료, registry·digest·snapshot을 기존 epoch110 이상의 강도로 검증한다. A는 Event/progress/HANDOFF/digest/WORK_STATUS 정확5문서와 seq2340 WI→2341 worker→2342 write, C는 검사기·통제 테스트 정확2, B는 progress/HANDOFF/digest/WORK_STATUS 정확4, H2는 Event/progress/HANDOFF/digest/WORK_STATUS 정확5와 seq2343 write→2344 worker를 요구한다. 활성/종료 projection mode는 각각 `U01_TASK4_POST_H4_REPORT_TAIL_ACTIVE`/`U01_TASK4_POST_H4_REPORT_TAIL_CLOSED`, 종료 상태는 `U01_TASK4_POST_H4_REPORT_TAIL_CLOSED_R6_PENDING`, 다음 행동은 `U01_TASK4_R6_SEPARATE_WI_PENDING`이다.
3. H2 뒤 보고 전용 tail은 과거 검증을 건너뛰지 않고 H2의 직접 자손만 허용한다. 각 tail commit은 단일 부모·비 merge이고 `docs/WORK_STATUS.md` 변경을 필수로, `design_change.md` 변경과 신규 `docs/04_test_reports/U-01_TASK4_*.md` 추가만 선택 허용한다. 보고 파일 경로는 `git diff --name-status --no-renames`에서 `A`여야 하고 과거 보고 파일 수정/삭제·rename은 RED다. 제품/검사기/테스트/승인/WI/Event/progress/HANDOFF/digest 변경, dirty/untracked, branch/upstream/private ref 불일치, SHA 분기·원격 전진도 RED다. 전체 tail은 최대 256개의 직접 부모 commit으로 제한하며, 초과 시 자동 PASS 대신 별도 통제 판정이 필요하다. 기존 보고의 내용과 과거 Git blob은 불변이다. 이 tail은 다음 별도 WI/lease가 시작되면 새 단계의 명시적 route로 다시 결박하며, 제품·U-01 수락 상태를 자동 전환하지 않는다.
4. `NOT_ACCEPTED`/`DEFER`/`NOT_EXECUTED`·U-02 `BLOCKED`, active lease0인 종료 상태를 유지한다. 보고 문장이나 fixture가 이를 PASS로 격상하지 못한다. 추가 파일·누락 보고·예상 밖 ref/branch·만료/교환 token·역행 Event·거짓 수락을 거부하는 음성 테스트를 포함한다.

## 검증과 인계

- 실제 D의 G-05 RED를 먼저 보존한다. Developer는 신규 허용·위조 거부 테스트를 RED로 실행한 뒤 최소 구현으로 GREEN, 신규/인접 focused·`git diff --check`·A G-05의 정확 명령·exit·결과를 보고한다. 전체 suite/Windows 기본 fd-capture 미실행은 분리한다.
- Main은 독립 Critical/Important 0, C/B/H2 각 local/private exact-SHA G-05와 사전 등록 단일 WSL-server Git QA checkout의 H2 exact-SHA G-05/focused·자원 잔여0을 확인한다. WSL checkout은 Git으로만 구성하고 공유 서비스·DB·Docker를 건드리지 않는다.
- H2 뒤 보고 전용 tail도 focused 음성/허용 사례와 실제 private exact SHA를 재검증한다. Foundation R6 `STORED_ROW`의 정확 단언은 별도 WI/lease·새 격리 PG15/OIDC/HTTPS/Chromium이며, 본 통제 PASS가 그 선행조건을 제외한 시험을 대신하지 않는다.
- rollback은 이 후속 통제 commit만 정상 revert하고 H/R2/D 및 private 원격 복구 ref·Event 원문을 보존한다. 동일한 유효 정식 `FAILURE_REPORT` 3회에서만 Main 인수한다.
