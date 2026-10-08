# WorkInstruction — F-20/U-01 R33 운영 카드 화면 골격

- 담당: `developer-primary-f20-u01-r33` 단일 writer. Main이 R32 seq1992 no-lease에서 새 worker/write dual lease를 정식 발급·검증한 뒤 착수한다.
- 기준: 설계 §29.2, 작업계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8, `docs/04_test_reports/F-20_U01_R33_OPERATING_CARDS_SHELL_PLAN.md`. Dispatch 때 기준 문서와 WI/Invocation SHA-256, branch/HEAD, 두 fencing token·만료를 전달한다.
- 분류: 이미 승인된 U-01의 제한된 화면 절편. 공개 API/데이터 계약·DB/auth/Secret·중요 위험 변경 없음.

## allowed_paths 정확히 4개

1. `apps/web/src/console/App.tsx`: Dashboard 2행에 기존 정의 순서의 여섯 운영 카드를 표시한다. 각 카드에는 제목, `UNAVAILABLE`, 미연결 사유만 놓고 수치·상세 링크·변경 버튼을 만들지 않는다. 기존 Health/Next Actions/Critical Alerts 및 인증 실패 화면은 보존한다.
2. `apps/web/tests/f15-console.test.mjs`: RED→GREEN으로 여섯 제목/순서/비가용, 가짜 0·성공률·클릭 링크 부재, 기존 섹션/권한 실패/반응형 관련 회귀를 검증한다.
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 실제 브라우저 흐름에서 2행 카드 DOM과 비가용/비노출을 검증한다. 기존 screenshot·Network evidence key/파일명/요청 allowlist는 변경하지 않는다.
4. `docs/04_test_reports/F-20_U01_R33_OPERATING_CARDS_SHELL_RESULT.md`: 착수 HEAD/branch/dirty·기준 hash·두 lease, exact diff, RED/GREEN 명령/exit/결과, 미검증, rollback, Main 인계를 누적한다.

## 완료조건과 금지

- 현 `DASHBOARD_OPERATION_DEFINITIONS`와 `status-grid`를 재사용한다. 고정 1920×1080/12px 및 작은 화면 순서를 유지한다. 운영 데이터 미연결을 정상 0·PASS로 표현하지 않는다. Run·Queue·Worker·Approval·Gate·Cost·baseline 수치를 서로 추론하지 않는다.
- Developer는 착수 전 canonical G-05, branch/HEAD/status, 두 fencing token·actor·유효기간·exact4 scope를 확인한다. Main 소유 progress/HANDOFF/WORK_STATUS/control과 사용자 dirty/untracked는 수정·stage·삭제하지 않는다.
- 로컬 console 전체·browser 문법/audit·web typecheck/lint/build·관련 Python 비 opt-in·G-05·diff check를 실행한다. 전용 임시 출력은 실제 경로와 내부 link를 확인한 뒤 정확히 정리한다. Main은 독립 diff/회귀, commit/private push, WSL-server 동일 SHA 실제 QA 및 자원 정리를 담당한다.
- Developer는 commit/push/PR/merge, 새 branch/main, WSL-server/Docker/DB, ysna/Production을 건드리지 않는다. 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 보고한다. R33 PASS도 U-01/F-20 수락이 아니며 C30 `OPEN_BLOCKING`/DEFER를 유지한다.
