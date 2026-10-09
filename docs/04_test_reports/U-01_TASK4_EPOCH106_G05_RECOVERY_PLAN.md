# U-01 Task4 epoch106 이후 G-05 successor 복구 계획

## 현재 판정

기존 단일 branch `codex/u01-dashboard-r2`의 R6 증거 checkpoint `510a79a84cd2ca5e234e6dc5e793dfeb531b30f0`에서 `python -B scripts/check_project_progress.py`는 exit 1이다. 오류는 `DETACHED_DIGEST_MISMATCH`, `EVENT_EFFECT_MISMATCH`, `EVENT_PAYLOAD_MISSING`, `EVENT_TYPE_UNREGISTERED`, `GIT_LOCAL_HEAD_MISMATCH`, `GIT_REMOTE_HEAD_MISMATCH`, `HANDOFF_BASELINE_MISMATCH`, `HANDOFF_DIR_STATUS_MISMATCH`, `HANDOFF_FAILURE_COUNT_MISMATCH`, `MANIFEST_DETACHED_DIGEST_BINDING_MISSING`의 10개다. Python launcher의 real-location 경고는 별도이며 검사기가 실제 실행되어 위 오류를 출력했다. epoch106 `U01_TASK4_TWO_PAIR_QA_ACTIVE`가 최신 checker dispatch에 없고 과거 successor 경로로 fallback하는 것이 직접 원인 후보다. 이 상태를 PASS로 처리하지 않는다.

## 순차 복구 경계

1. 현 epoch106의 허용된 두 테스트 파일에서 E-NET 증거 보강을 끝내고 로컬·WSL-server exact-SHA QA 및 독립 판정·격리 정리를 기록한다. 제품/API/UI/DB·기존 Foundation R6 테스트는 현 lease에서 수정하지 않는다.
2. R7 결과를 기존 branch/private remote에 clean checkpoint한 뒤 canonical Event seq1~2317 원문과 현재 worker/write token·만료·경로, WI hash, progress/HANDOFF/detached digest, `design_change.md`·증거 파일 hash를 읽기 전용 결박한다. old write→worker 순서로 회수하고 active lease 0을 확인한다.
3. 별도 비제품 control WI/invocation과 정확 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py` 경로의 새 dual lease를 발급한다. frozen prefix와 새 Event 효과·hash를 append-only로 검증하고 기능 범위·공개 API·DB/schema·Secret·운영 환경은 변경하지 않는다.
4. 단일 Developer가 새 active/closed route의 정상 fixture와 raw Event, payload/effect, lease fencing·만료·경로, detached digest/HANDOFF, Git ancestor/정확 경로·원격 SHA·dirty 음성 테스트를 RED→GREEN으로 작성한다. 단순 오류 무시·기존 오류 필터 확대·checksum 우회는 금지한다. Main은 독립 회귀·G-05와 WSL-server 동일 clean SHA를 확인한 뒤 control lease를 순서대로 닫는다.
5. 이후 기존 Foundation R6 `STORED_ROW` 실패는 별도 정확 WI/lease로 실제 재현하고 보정한다. E-NET·E-API·E-AUD 전체 ID와 U-01 acceptance는 독립 Tester가 다시 판정한다. 필수 gate GREEN 전 PR/main 병합·branch 삭제·신규 branch/U-02는 금지한다.

현재 단계의 next safe action은 기존 Task4 하네스 범위의 E-NET 보강이며, G-05 복구를 현 epoch106의 허용되지 않은 코드 경로에 선행 쓰기하지 않는다. WSL-server는 테스트에만 사용하고 ysna/Production은 제외한다.
