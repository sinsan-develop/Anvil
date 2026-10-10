# WI-U01-TASK4-R6-NETWORK-TAIL-FIXTURE-RECOVERY-20261011-001

## 판정과 권한

기존 승인 `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`, 설계 §29.2, 작업계획 U-01 및 `U-01_TASK4_POST_H4_RECOVERY_PLAN.md` Task 2 안의 **비제품 통제 테스트 재작업**이다. 기능·요구사항·중요 위험·공개 API·DB·인증·Secret·비용·운영·제품 동작은 바꾸지 않는다. Main은 원 승인을 부모로 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 결박을 기록한다. 새 승인 요청 없이 이 범위만 수행한다.

기준은 기존 단일 `codex/u01-dashboard-r2`의 결과보고 `7d32c0082ba7fa3943fd664a06397a01108c3654`와 직접 자식 읽기 전용 현황 `99de79991544dea7e8640811e4a1097642336752`다. 착수 직전 local/private 동일 SHA·tracked clean·G-05 seq2364 PASS·active worker/write null을 다시 확인한다. 최신 R6 실제 opt-in은 `NETWORK_RESPONSE_FACTS/PAIR_LIST_API status404 BODY PENDING` exit1이고 전체 R6 FAIL·U-01 NOT_ACCEPTED다. E115 QA 자원 잔여0이며 역사 C/C3/C4의 실패와 각 과거 SHA의 PASS를 소급 변경하지 않는다.

## 정확한 실패와 수정 계약

`tests/tooling/test_u01_postmerge_control_projection.py::U01Task4R6NetworkCaptureDiagnosticTests::test_b5_h5_tail_git_rejects_remote_dirty_and_history_forgery`의 synthetic `h5`는 H5 당시 Event/progress/HANDOFF/digest/WORK_STATUS를 공급하지만 `design_change.md`는 현재 파일을 읽는다. 첫 결과보고에서 정상 append된 DC-U01-019 때문에 역사 H5 blob 비교가 실패한다. 이는 실제 G-05·원격·dirty 결함 증거가 아니다.

Developer는 정확 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py` **두 코드 경로만** TDD로 수정한다. synthetic H5/B5/보고 tail의 `design_change.md` 입력을 해당 Git 역사 시점의 동결 바이트로 명시 공급해 현재 파일 누출을 없앤다. append 허용·역사 rewrite/삭제/재배열·추가 파일/dirty·원격 stale/advanced/불가·Event/lease 위조의 기존 음성 검사는 유지하거나 강화한다. 실제 H5→첫 보고→WORK_STATUS-only 현황은 여전히 G-05 GREEN이어야 한다. 새 W7/A6/C6/B6/H6와 제한된 보고 tail의 fail-closed Git route를 추가하되 역사 W6/A5/C5/B5/H5/보고/현황의 commit·blob·검증 강도는 낮추지 않는다. 제품 파일, 브라우저 하네스, F-19A 설정, R6의 404/timeout/body 감사는 수정하지 않는다.

## 실행 소유권과 Git·Event 경계

- Main의 **W7**은 `99de7999` 직접 자식이며 본 WI·대응 Invocation·`docs/WORK_STATUS.md` 정확3문서 한 commit이다. WI/Invocation SHA256·부모 승인·현 기준 SHA·원격/lease를 기록한다. 새 route 전 G-05 RED는 예상 상태일 뿐 PASS가 아니다.
- Main의 **A6**은 W7 직접 자식이며 Event/progress/HANDOFF/detached digest/WORK_STATUS 정확5문서 한 commit이다. 기존 seq1~2364 원문을 보존하고 seq2365 `WORK_INSTRUCTION_ISSUED`→2366 epoch116 `WORKER_LEASE_ISSUED`→2367 `WRITE_LEASE_ISSUED`만 append한다. 서로 다른 24시간 fencing token, 단일 `developer-primary`, 정확 두 코드 경로, 제품 scope0을 결박한다. 이전 epoch115 write/worker는 `REVOKED`, active agent/code writer는 A6 이전 0이어야 한다. A6 독립 검토·private push 후에만 Developer를 dispatch한다.
- 유효 worker/write 두 token의 단일 Developer가 RED→GREEN으로 **C6** 코드를 작성한다. Main은 활성 write lease 동안 같은 두 파일에 쓰지 않는다. C6는 A6 직접 자식의 정확 두 코드 경로 한 commit이다. 단위·인접 회귀, `git diff --check`, 독립 Critical/Important0 및 clean/private **실제 C6 SHA** G-05 exit0 전에는 B6/WSL QA를 시작하지 않는다.
- Main의 **B6**는 C6 직접 자식 progress/HANDOFF/digest/WORK_STATUS 정확4문서 한 commit으로 C6 control checkpoint와 실제 시험 범위를 기록한다. **H6**는 B6 직접 자식 Event/progress/HANDOFF/digest/WORK_STATUS 정확5문서 한 commit으로 seq2368 write→2369 worker 순서 회수한다. active lease/agent null·제품0·U-01 미수락·Release DEFER·Production NOT_EXECUTED를 유지한다. H6 직접 자식인 **첫 보고 tail**은 `docs/04_test_reports/U-01_TASK4_R6_NETWORK_TAIL_FIXTURE_RECOVERY_RESULT.md` 신규 추가(A), `docs/WORK_STATUS.md` 수정(M) 필수의 한 commit이다. 새로운 미진이 실제 확인된 경우에만 `design_change.md` 수정(M)을 같은 첫 tail에 선택적으로 포함하며, 기존 파일 바이트를 prefix로 보존한 append만 허용한다. 첫 tail 뒤에는 각 single-parent 직접 자손의 `docs/WORK_STATUS.md` 수정(M) 한 경로만 허용한다. 첫 tail 포함 총수 최대256개, 보고서·DC blob 이후 불변, 역사 commit/경로의 수정·삭제·rename은 RED다.
- 모든 checkpoint는 기존 branch·single parent·정확 경로·local/private live SHA·tracked clean·Event raw prefix/chain·승인 hash·detached digest를 fail-closed로 검증한다. `main` 병합·새 branch/worktree·PR·amend/rebase/force push·ysna/Production은 금지한다.

## 검증과 종료

Developer는 위 단일 실패의 현재 RED, frozen-H5 GREEN, H5 이후 정상 append와 위조 음성, epoch115 및 앞선 통제 인접 회귀를 각각 명령·exit·결과로 보고한다. Main은 독립 diff 검토·로컬 집중/인접·C6/B6/H6/최신 보고 SHA별 실제 G-05를 확인한다. C6 clean/private PASS 뒤에만 사전 등록한 **단일 WSL-server 전용 Git exact-SHA checkout**에서 G-05와 집중 테스트를 실행한다. checkout의 literal 경로·owner·수명·정리 방법을 먼저 기록하고, 종료 시 exact remote/SHA/realpath/link/process를 검증해 그 checkout만 제거·잔여0으로 닫는다. 이 WI에는 PG/Node/browser/DB 자원 생성이 없다.

이 통제 복구는 PAIR_LIST_API 404/BODY lifecycle 원인 또는 R6 전체·E-NET/E-API/E-AUD·U-01 인수를 증명하지 않는다. 실제 원인분리는 후속 별도 최소 WI와 새 격리 WSL-server QA에서 계속한다. 실행 불가·실패는 WORK_STATUS와 필요 시 `design_change.md`에 사실대로 남기며 PASS로 바꾸지 않는다. Rollback은 이번 신규 commit만 정상 revert하고 Event 원문·승인·역사 Git/private 복구 ref를 보존한다.
