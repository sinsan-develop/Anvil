# WI-F19A-ACCEPTANCE-CONTROL-20261008-001

## 판정·기준

F-19A Task4 종료 checkpoint `9c6ab5dc17927fcbae6638718e9219fd1b208d44`는 local/private 동일·clean, G-05 seq2248 PASS, 종료 집중 7 PASS다. 승인된 F-19A Spec·Plan과 실제 WSL-server 보고서 `docs/04_test_reports/F-19A_MINIMAL_PAIR_AUTH_RESULT.md` SHA256 `9838B6C39006629261D22AAF4B8621214E48445E5ABABF906E934AA2A33D133D`를 보존한다. 독립 Tester는 `AV-OPS-026`·`AV-SAFE-034`, 기존 기능, 10테이블 backup/restore, QA 자원 잔여0을 재검토해 F-19A 수락 조건 충족을 권고했다. Main은 이 근거로 F-19A를 수락하되, canonical 투영과 Git 검증 전에는 `NOT_ACCEPTED`를 유지한다.

역사 R48 authority 2 FAIL은 F-20/U-01 fixture에서 F-19A 이전 SHA부터 재현된 비-F-19A 기능 case다. 인접 5파일은 180 PASS/2 FAIL(exit1)이며 전체 GREEN이 아니다. 물리 TCP 단절·ACK COMMIT 응답 소실은 미검증 잔여 위험이다. 이 판정은 해당 항목을 PASS로 바꾸지 않는다. `main` 병합은 필수 통합 gate 정리 전 보류하고, 신산님의 순차 branch 지시상 병합·branch 삭제 전 U-01 제품 write/새 branch도 금지한다. Release DEFER, Production/ysna-server NOT_EXECUTED다.

## 소유·순서

- Main 소유 문서: 이 WI, Event/progress/HANDOFF/detached digest/WORK_STATUS와 Git checkpoint·private push·최종 수락 판단. 단일 Developer `developer-primary-f19a-pair-grant`의 정확 코드 경로는 `scripts/check_project_progress.py`, `tests/tooling/test_f19a_start_projection.py` 두 개뿐이다. 제품/WSL-server/DB/browser write 0, Developer Git commit/push 0.
- Main은 seq2248 closed·clean/private/G-05를 기준으로 epoch93 WI→worker→write Event, 분리된 24시간 execution/write token, control2·제품0을 발행한다. A docs-only 게시·clean 확인 전 Developer code write 금지.
- Developer는 기존 Event seq1~2248과 F-19A Task4 active/C/B/close 검증을 동결한다. epoch93 A→C(control2)→B(docs-only)→close(docs-only) Git 순서, 보고서 SHA/blob·Tester PASS·R48 분리·미검증·Release DEFER, dual lease·WI hash·snapshot/digest/dirty/remote를 fail-closed 검증하고 RED→GREEN 테스트한다. `ACCEPTED` 투영은 종료된 F-19A만 대상으로 하고 U-01 write 권한을 열지 않는다.
- Main은 독립 C0/I0, 집중·인접·G-05·diff를 확인해 C 게시, 수락 결정과 근거를 B 문서에 결박해 게시·G-05 확인, write→worker 회수 후 종료 문서 게시·G-05 재검증한다. 인접 R48 2 FAIL은 별도 정확 상태로 남긴다. 다음은 같은 branch의 통합 필수 gate 정리이며 새 branch 생성은 금지한다.

## 완료 경계

최종 `F-19A ACCEPTED`는 Main의 결정·Tester 근거·QA 보고서·C/B/close Git·G-05가 모두 맞을 때만 기록한다. `ACCEPTED`는 `main` 병합, U-01 착수, Release 승인 또는 Production 검증을 의미하지 않는다. 동일 근본 원인 정식 Developer FAILURE_REPORT 3회일 때만 Main takeover를 적용한다.
