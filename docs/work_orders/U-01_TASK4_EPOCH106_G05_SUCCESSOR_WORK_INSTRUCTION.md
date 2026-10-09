# WI-U01-TASK4-EPOCH106-G05-SUCCESSOR-20261010-001

## 판정·기준선

신산님 승인 U-01 계약 B와 `U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` Task 4의 G-05 진행 통제만 복구한다. 기존 단일 branch `codex/u01-dashboard-r2`의 Task4 두 pair 하네스 epoch106은 R7 증거/독립 판정/`design_change.md` DC-U01-012를 보존한 `87823219d27444c529fdeeb1625ffc04d116dafb` 뒤, 회수 H `294d2eb03ddaceab3bf6f75ae41095dcf412c26b`에서 Event seq2318 write→2319 worker, active dual lease0으로 닫혔다. H는 local/private 동일·clean이나 새 G-05 route 부재로 검사 exit1·8오류이다. 이를 PASS로 표기하지 않는다. A 발급 commit은 `725e1012c31e10969ef12052ce6368c84d169feb`로서 R7 증거 commit과 구별한다. U-01 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`; PR/main·새 branch/U-02·ysna-server는 범위 밖이다.

## 정확 소유·쓰기 범위

- Main은 이 WI·invocation, canonical Event/lease/progress/HANDOFF/detached digest/WORK_STATUS, Git checkpoint·push, WSL-server clean exact-SHA control 확인과 독립 판정을 소유한다. 신규 branch/worktree나 제품 파일 write는 하지 않는다.
- 단일 Developer `developer-primary-u01-task4-epoch106-g05`는 Main이 발급·대조한 유효 worker/write fencing token, 이 WI hash, H와 새 A 문서의 local/private 동일·clean 및 bootstrap G-05 RED를 확인한 뒤에만 정확 두 파일 `scripts/check_project_progress.py`, `tests/tooling/test_u01_postmerge_control_projection.py`를 수정한다. 두 token/lease 유효 전에는 쓰지 않는다. Main은 활성 lease 동안 두 파일을 수정하지 않는다.
- 제품/API/UI/DB/브라우저/WSL-server/Secret/배포와 `design_change.md`, 증거·보고서·과거 Event의 Developer write는 금지한다. Developer는 commit/push·PR/merge를 하지 않는다. scope는 제품 write0의 내부 검사기와 음성 테스트뿐이다.

## fail-closed successor 계약

1. H의 exact SHA와 부모 계보를 고정한다. 이전 H2 `231bf84c843679b4eb47ea0ab09f070a31171129`→A `725e1012...`→R7 `87823219...`→H `294d2eb0...`는 단일 branch 직접 후손이고 merge/history rewrite가 없어야 한다. H의 WI/invocation·승인 계약 hash, `design_change.md`/R7 결과·증거 SHA, Event seq1~2317 원문과 seq2318→2319 chain·효과, A/R7 서로 다른 checkpoint, 완료 epoch106 lease 두 건·활성0, U-01 미수락/DEFER/Production 미실행과 U-02 잠금을 검사한다. 임의 오류 무시·기존 validator 완화·checksum 우회는 금지한다.
2. 새 비제품 epoch의 A는 H clean/private exact SHA를 predecessor로 하고 WI→worker→write Event 순서, 서로 다른 fencing token/24시간 유효기간/정확 code2·제품 scope0을 요구한다. code C는 정확 두 파일 외 변경0, C 결박 문서 B는 정확 canonical progress/HANDOFF/digest/WORK_STATUS/필요한 통제 보고만 허용한다. 마지막 H2는 write→worker 순차 회수·제품 scope0·U-01 미수락을 유지한다. 각 단계는 실제 Git 부모·허용 경로·blob·원격 SHA·dirty·Event raw prefix를 fail-closed로 판정한다.
3. 정상 fixture뿐 아니라 Event 누락/순서/종류/previous hash, payload·효과 위조, 잘못된 token·actor·epoch·만료·경로, snapshot·registry·HANDOFF·detached digest 위조, A와 R7 SHA 혼동, 허용 외 파일·merge·미게시/갈라진 원격·dirty, 거짓 수락/Release/Production/U-02 해제를 거부하는 음성 테스트를 RED→GREEN으로 작성한다. bootstrap RED를 GREEN으로 선행 주장하지 않고, route 구현 뒤 실제 현재 G-05 exit0만 GREEN이다.

## 검증·종료

- 단일 Developer는 먼저 위 반례의 기대 RED를 확인한 뒤 최소 successor route를 구현하고 focused·인접 통제 회귀·`git diff --check`의 명령/exit/실결과를 보고한다. Main은 독립 diff·음성 테스트·G-05·clean/private 동일 SHA를 확인하고 읽기 전용 독립 리뷰에서 Critical/Important0을 확인한 뒤 C→B→H2를 순차 결박한다.
- WSL-server에는 제품 배포 없이 Git exact-SHA 전용 격리 checkout으로 control 검사만 확인하며 자원 이름·수명·정리를 선기록한다. 이 G-05 통제 PASS가 기존 Foundation R6 `STORED_ROW`, 전체 E-NET/E-API/E-AUD 또는 U-01 사용자 인수를 증명하지 않는다. R6는 별도 정확 WI/lease로 진행한다.
- rollback은 신규 successor 코드/문서 commit만 정상 revert하되 frozen H와 R7 증거·승인 계약·원격 복구 ref는 보존한다. Developer 정식 동일 `FAILURE_REPORT` 3회면 Main takeover 규칙을 따른다.
