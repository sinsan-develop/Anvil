# WI-U01-SCOPED-DASHBOARD-TASK4-TWO-PAIR-QA-20261010-001

## 판정·승인 범위

신산님이 승인한 U-01 정확 조합·기간 계약 B와 `U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md` Task 4의 로컬 하네스 작성 및 `ssh WSL-server` 실측을 수행한다. 직전 보고 통제 종료 H2 `231bf84c843679b4eb47ea0ab09f070a31171129`는 seq2314 G-05 PASS·기존 `codex/u01-dashboard-r2`의 개발 원격 동일·clean이다. U-01은 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`; `design_change.md` DC-U01-006/007은 미검증·역사 실패를 보존한다. 새 branch/worktree, PR/main 병합, U-02, ysna-server/Production은 이 작업 범위가 아니다.

## 정확 소유·쓰기 범위

- Main은 기준 문서·dual lease·진행 원장과 작업현황, 실행 전 격리 자원 계획, 로컬 clean exact SHA 게시, WSL-server Git 수신·QA 자원 생성/정리, 증거와 독립 Tester 판정을 소유한다. 같은 파일에 Developer와 동시 쓰기하지 않는다.
- 단일 Developer `developer-primary-u01-task4-two-pair-qa`는 유효한 worker/write fencing token과 이 WI hash에 결박된 canonical Event·snapshot·digest·원격 A 문서 checkpoint를 확인한 뒤 정확 두 파일 `tests/integration/test_u01_scoped_dashboard_browser_pg15.py`, `tests/browser/u01-scoped-dashboard-two-pair.mjs`만 로컬에서 만든다. 기존 제품/API/UI/DB 파일, R6 시험, 문서, Git commit/push, WSL-server 파일은 수정하지 않는다. 기존 파일을 수정해야만 통과할 경우 증거와 최소 변경 제안을 Main에게 보고하고 허용되지 않은 파일은 쓰지 않는다.
- R6 `STORED_ROW AssertionError`는 별도 원인 분리다. `tests/browser/f20-u01-oidc-browser-pg15.mjs:2253`의 저장 Critical 행 control0 단언과 현 ACK 버튼은 충돌 후보지만 정확 실패 assertion은 아직 미확정이다. 이 WI에서 역사 단언을 약화하거나 실패를 키 문제로 무시하지 않는다.

## RED→GREEN과 실제 수직 증거

1. 신규 시험은 opt-in이다. DB·QA 인증·브라우저 준비가 없으면 `SKIP` 또는 명확한 `BLOCKED`이며 인수 PASS가 아니다. 정확 로컬 HEAD·기존 branch·개발 원격·WSL 수신 SHA/clean 불일치, 비격리/비어 있지 않은 DB, migration head `0020_f19a_pair_grants` 불일치, QA trust/subject/pair 설정 충돌을 쓰기 전에 거절한다. 이 음성을 로컬 RED→GREEN으로 검증한다.
2. 격리 PostgreSQL 15 원본에 서로 다른 정확 Project·Environment pair A/B를 등록하고 같은 reader actor에게 정확 두 `dashboard:read` grant를 발급한다. OIDC/HTTPS/Chromium에서 목록 정확 두 pair와 각 scoped GET `1d|7d|30d`의 200·pair label·현재/발생 분리·`UNAVAILABLE/count:null`·서울 달력일 `[startUtc,endUtc)` 및 실제 read 상한 `observedAt`을 DB row/API/화면/Network와 연결한다. 교차조합·다른 actor·비활성/원본 장애는 허용하지 않는다.
3. pair A 철회 직후 목록에서 A가 사라지고 A scoped GET은 403, B는 계속 200이어야 한다. A 재허용·재선택 후 200으로 회복되는 실제 사용자 경로를 검증한다. pair/기간 전환의 늦은 응답은 이전 조합·기간 값을 되살리지 못해야 한다. 브라우저 API 요청은 same-origin 상대 경로만 허용하고 내부 주소·Secret 노출0을 확인한다.
4. 기본 1920×1080·12px 화면, 키보드, loading/empty/error/UNAVAILABLE/권한 실패/성공 상태를 실제 클릭과 Network로 검증한다. E-SHOT/E-NET/E-API/E-AUD 및 필요한 E-EVT/E-DEC/E-PRG를 증거 파일에 결박하되 미실행을 PASS로 표기하지 않는다. 독립 Tester가 `AV-SAFE-034`, `AV-OPS-027`, `AV-UI-017` 및 U-01 공통 ID를 현재 코드·실제 증거로 판정한다.

## 실행·정리 경계

- Main은 WSL-server에 만들 전용 Git checkout·tmpfs PG15/DB·loopback port·OIDC QA issuer/subject/trust·HTTPS BFF·Chromium profile·증거 폴더의 정확 이름, owner, 수명, 포트, 정리 순서를 생성 전에 기록한다. QA issuer가 인스턴스당 subject 고정이면 세션 분리 또는 전용 issuer의 순차 수명으로 확인하며 공유 인스턴스의 신원을 임의 전환하지 않는다.
- 로컬 코드 기본 테스트·typecheck/build 영향 검증 후 정확 두 파일만 commit/push한 clean SHA를 WSL-server가 Git으로 수신한다. WSL-server에서 제품 소스 직접 patch·scp 배포·공유 checkout/DB 변경은 금지한다. 검증 후 전용 process/container/DB/listener/checkout/profile/임시 TLS·증거 산출물을 정확 신원 확인 후 정리하고 잔여0을 기록한다. 필요 증거는 정리 전 로컬 승인 경로로 안전하게 수집하며 Secret은 기록하지 않는다.
- 결과가 미충족이면 `design_change.md`와 U-01 보고서·WORK_STATUS에 사실, 오류 횟수, 수행/미수행, 재개 조건을 기록하되 U-01/Release/Production PASS로 승격하지 않는다. 필수 gate가 모두 GREEN일 때만 기존 branch의 PR/main 병합·merged-main smoke·branch/worktree 정리를 진행한다.

## 완료 증거·rollback

Developer 완료보고에는 시작 HEAD/branch/status·WI/lease hash, 정확 변경 diff, 로컬 명령·종료 코드, SKIP/BLOCKED, WSL 미실행 범위와 rollback을 포함한다. Main은 실제 로컬/원격/WSL SHA, PG15/OIDC/HTTPS/Chromium/API/DB/UI/Network 증거, 독립 판정, 자원 잔여, G-05와 U-01 수락을 각각 분리 기록한다. rollback은 새 하네스 커밋만 정상 revert하고 H2·기존 제품 코드·원격 복구 ref와 WSL 공유 자원은 보존한다.
