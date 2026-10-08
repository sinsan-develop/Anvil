# WI-F19A-TASK4-FINAL-QA-REPORT-CONTROL-20261008-001

## 판정·기준

F-19A Task4의 WSL-server 격리 QA 보고를 canonical 통제에 결박하는 비의미 successor다. 새 기능·요구사항·중요 위험 변경이나 제품 write는 없다. 부모 human approval `docs/approvals/APPROVAL-20261007-F19A-PAIR-GRANT-CONTRACT-001.md` SHA256 `ADF11125667CA6C374F31462D2ABD7D55C425D7A86019CB7A8D4B9BA8D0A0AF5`, Spec `A4AE1EE80530F2A05393A18409CDE2FC94543C1FAC8598365CD8A4EBB7032247`, Plan `0CD8309E3FD8C7F507281BF6094D6BA696973FB5AA12F27023E57E1DA51CA26E`를 보존한다.

epoch91 종료 seq2243와 local/private 동일 clean 제품 QA SHA `73055ce3e8b08449cf53d371107c5bd326417ae3` 뒤 Main은 실측을 마치고 전용 QA 자원 잔여0을 확인했다. Main의 정확 보고서·WORK_STATUS 기록 commit `ddd56c2f3c5e462f284aa6da7497c97256dd9e15`(이하 R)은 같은 branch/private에 게시·clean이다. 보고서 `docs/04_test_reports/F-19A_MINIMAL_PAIR_AUTH_RESULT.md`의 R blob `f34f482c5eded29ce3d0a0fc0b8f923c4677a861`, SHA256 `9838B6C39006629261D22AAF4B8621214E48445E5ABABF906E934AA2A33D133D`를 고정한다. 기존 closed G-05는 보고서가 허용된 문서5 밖이라 `F19A_TASK4_DB_FAULT_CLOSE_GIT_INVALID` exit1이다. 보고서 제거·history rewrite·force push로 우회하지 않는다.

## 소유·실행 순서

- Main 소유: 이 WI, Event/progress/HANDOFF/detached digest/WORK_STATUS, 보고서, Git checkpoint·private push·독립 검토·수락 판정. 단일 Developer `developer-primary-f19a-pair-grant`의 정확 코드 경로는 `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py` 두 개뿐이다. 제품 scope 0, WSL-server/DB/browser 추가 실행 0, Developer의 Git commit/push 0이다.
- Main이 R을 부모로 epoch92의 WI→worker→write Event를 append-only 발행하고, 24시간 이내 서로 다른 execution/write fencing token과 이 두 정확 경로·제품0을 결박한다. A docs-only checkpoint/private/clean, 활성 lease·SHA·scope 확인 전 Developer는 코드 write하지 않는다.
- Developer는 기존 seq1~2243과 epoch91 active/closed checker를 불변으로 두고 새 epoch92 A→control C→docs B→close projection만 추가한다. R의 보고서 birth commit·blob/SHA·정확 두 경로 이력, A/C/B/HEAD 조상·clean/private, Event hash chain·WI hash·별도 worker/write token/만료/경로·progress/HANDOFF/digest, 위조 report·다른 path·merge commit·원격 불일치·stale lease를 fail-closed 검증한다. RED→GREEN 테스트 후 Main에 정확 diff·명령·결과를 보고한다.
- Main은 독립 C0/I0/M0, 통제 집중·역사·G-05, diff check를 거쳐 정확 control2 C commit/private를 만든다. 이후 Main의 docs-only B로 C·R 보고서·독립 판정·미검증·잔여0을 결박하고 private/clean G-05를 확인한다. 그 다음 write→worker 순서로 lease를 회수해 seq2247→2248 종료를 투영, docs-only close/private/clean G-05·필수 회귀를 확인한다.

## 완료 경계

`AV-OPS-026=PASS`, `AV-SAFE-034=PASS`는 독립 Tester 권고이며 자동 Package 수락이 아니다. Main이 최종 exact SHA/필수 gate/잔여 위험을 별도로 판정하기 전 F-19A는 `NOT_ACCEPTED`, U-01 제품 write 금지, Release DEFER, Production/ysna-server NOT_EXECUTED다. 기존 R48 인접 회귀 2 FAIL을 은폐하지 않는다. 동일 근본 원인 유효 Developer 정식 FAILURE_REPORT 3회 때에만 Main takeover를 적용한다.
