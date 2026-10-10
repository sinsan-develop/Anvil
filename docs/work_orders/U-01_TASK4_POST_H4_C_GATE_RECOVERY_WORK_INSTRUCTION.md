# WI-U01-TASK4-POST-H4-C-GATE-RECOVERY-20261010-001

## 판정·승인 범위

기존 `U-01_TASK4_POST_H4_REPORT_TAIL_WORK_INSTRUCTION.md`의 제품 범위와 역사 통제는 변경하지 않는다. C `3e788ed25330910d2b55c932e3fe517e8661bd59`의 clean/private exact-SHA G-05는 실제 exit1 `U01_TASK4_POST_H4_TAIL_GIT_INVALID`로, 현재 검사기가 C를 A 전용 단계로 판정한다. 이를 `design_change.md` DC-U01-016에 미충족으로 보존하고 C PASS로 소급하지 않는다. 본 WI는 승인된 U-01/G-05의 **비제품** 단계 판정 재작업이며 기능·요구사항·중요 위험·공개 API·DB·인증·Secret·운영·비용 변경0이다. 기존 human approval `APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001`을 부모로 Main이 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 binding을 기록하되 범위를 넓히지 않는다.

기준 진단·계획 D1은 `64d5c2f50978bceff3ae55ecf95c4f67657c3df7`, 계획 `docs/work_orders/U-01_TASK4_POST_H4_C_GATE_RECOVERY_PLAN.md` SHA256 `18F720CC5C1B3B5DB55A59ED4D24859EE44483570D257A4FF6EAE86FEACB537D`다. 본 WI와 Invocation의 정확 SHA는 W3 게시 후 A2에서 결박한다. 기존 W2/A/C와 승인·Event 원문은 수정하지 않는다.

## 소유·쓰기 경계

- Main은 이 WI/Invocation·WORK_STATUS의 W3, 분리된 dual lease A2, Event/progress/HANDOFF/digest, Git checkpoint/private push, 독립 리뷰, WSL-server 격리 Git QA·정리를 소유한다.
- 이전 epoch111 `worker_lease`/`write_lease`를 만료 전에 **write→worker**로 회수한 뒤 새 epoch112의 서로 다른 24시간 worker/write fencing token을 **worker→write**로 발급한다. old token의 추가 code write·commit은 허용하지 않는다.
- 새 두 token·WI SHA·A2 clean/private를 대조한 단일 `developer-primary`만 `scripts/check_project_progress.py`와 `tests/tooling/test_u01_postmerge_control_projection.py` 정확 두 경로를 TDD로 수정한다. 제품 write scope는 빈 배열이다. Main은 활성 새 write lease 동안 두 code 경로에 쓰지 않는다.
- 새 branch/worktree, amend/rebase/force push, 과거 Event/commit/approval/WI 변경, 제품/API/UI/DB/browser/Secret·ysna/Production 변경은 금지한다. WSL-server는 Main의 사전 등록 단일 격리 Git QA checkout 검증만 허용한다.

## 고정 Git·Event 계보

1. 기존 H4→R→P→W→A1→C1→B1→H→R2→D→W2→A→C의 각 direct-parent·한 commit·정확 경로, 각 역사 Git blob/Event raw prefix/chain, branch/upstream/private 원격·dirty0을 이전 epoch111 이상 강도로 보존한다. C의 실제 G-05 실패 문자열과 그 결과 기록은 불변 사실이다.
2. **D1** C의 직접 자식 `64d5c2f50978bceff3ae55ecf95c4f67657c3df7`는 `design_change.md`, `docs/WORK_STATUS.md`, `docs/work_orders/U-01_TASK4_POST_H4_C_GATE_RECOVERY_PLAN.md` 정확3경로다. **W3**는 D1의 직접 자식이며 이 WI, 대응 Invocation, `docs/WORK_STATUS.md` 정확3경로다.
3. **A2**는 W3 직접 자식의 Event/progress/HANDOFF/digest/WORK_STATUS 정확5경로다. frozen seq1~2342 뒤 seq2343 `WRITE_LEASE_REVOKED`→2344 `WORKER_LEASE_REVOKED`→2345 `WORK_INSTRUCTION_ISSUED`→2346 `WORKER_LEASE_ISSUED`→2347 `WRITE_LEASE_ISSUED`만 append한다. 새 epoch112 actor·서로 다른 token·만료/24시간·제품 scope0·정확2 code path, 원래 epoch111 두 lease `REVOKED`, progress snapshot/registry/HANDOFF/digest/approval binding을 byte 일치로 검사한다.
4. **C2**는 A2 직접 자식의 검사기·통제 테스트 정확2경로이며 canonical projection이 A2에 머무는 동안에도 C2의 HEAD/tracking/live private ref가 정확 일치·clean이어야 G-05 GREEN이다. 이 허용은 A2의 직접 자식·single parent·한 commit·정확2 code diff일 때만 적용한다. C2 외 임의 HEAD, 제품/문서/추가 경로, merge, stale/advanced/unavailable remote, 역사 blob·Event·lease 위조는 RED다.
5. **B2**는 C2 직접 자식의 progress/HANDOFF/digest/WORK_STATUS 정확4경로로 `control_checkpoint=C2`, active seq2347, next action은 통제 검증만, U-01 `NOT_ACCEPTED`/Release `DEFER`/Production `NOT_EXECUTED`/U-02 `BLOCKED`를 유지한다. B2 local/private clean exact-SHA G-05 GREEN 전에는 회수 H2를 완료 판정하지 않는다.
6. **H2**는 B2 직접 자식의 Event/progress/HANDOFF/digest/WORK_STATUS 정확5경로로 seq2348 write→2349 worker를 순차 회수한다. 두 completed lease `REVOKED`, active lease/agent null, 제품 scope0, 다음은 Foundation R6 별도 WI다. H2 뒤 보고 tail은 각 single-parent 직접 자손의 `docs/WORK_STATUS.md` 수정 필수, 선택 `design_change.md` 수정·신규 `docs/04_test_reports/U-01_TASK4_*.md` 추가만 허용하며 최대256개다. 과거 보고 수정·삭제·rename, 제품/검사기/통제/WI/approval/Event 변경은 RED다.

## 검증·완료 경계

- Developer는 C2 positive와 비C/extra path/원격·역사 위조 negative를 먼저 RED로 재현한 뒤 최소 검사기로 GREEN, 인접 epoch111/110/109 focused 및 `git diff --check`를 보고한다. C2 live G-05는 commit/private push 이후 Main이 실제 clean SHA로 실행한다.
- Main은 독립 Critical/Important0, C2/B2/H2 각각 local/private exact-SHA G-05 exit0, H2 집중 회귀와 사전 등록 격리 WSL-server Git checkout의 exact-SHA G-05/focused·자원 잔여0을 확인한다. D1/W3/A2의 G-05 RED는 예상 준비 상태일 뿐 PASS가 아니다. 임시 QA 자원은 생성 전 이름·owner·수명·정리 방법을 WORK_STATUS에 기록한다.
- Foundation R6 `STORED_ROW`의 정확 단언·PG15/OIDC/HTTPS/Chromium, 전체 E-NET/E-API/E-AUD, U-01 사용자 인수와 PR/main 병합은 본 WI의 통과로 증명하지 않는다. 미실행은 `NOT_EXECUTED`/미검증으로 기록한다.
- rollback은 이 복구의 신규 commit만 정상 revert하되 C와 모든 앞선 commit/Event/private 복구 ref를 보존한다. 현재 RED 상태에서 결과만 맞추는 우회나 history rewrite를 허용하지 않는다.
