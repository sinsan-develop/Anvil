# Anvil 설계 변경·미진사항 기록

이 파일은 신산님의 2026-10-09 지시에 따른 작업 주기별 추적 기록이다. 작업을 진행할 수 없는 항목은 사유·재현 근거·영향·실제 수행/미검증 범위·재개 조건·권고안을 기록하고 다음 독립 작업을 계속한다. 이 기록으로 해당 항목의 **이번 계획 진도**는 정리할 수 있으나 실제 기능 구현, 테스트 PASS, 보안·DB 검증, PR 병합, 사용자 인수의 증거로 승격하지 않는다. 정본 상태와 실제 증거는 `docs/WORK_STATUS.md`, `docs/progress/build-progress.json`, 검증 보고서와 Git을 함께 대조한다.

## 현재 주기: U-01 정확 조합·기간 Dashboard

- 기준: 승인된 계약 B `docs/04_test_reports/U-01_SCOPED_DASHBOARD_CONTRACT_PROPOSAL.md`, 승인 기록 `docs/approvals/APPROVAL-20261009-U01-SCOPED-DASHBOARD-CONTRACT-001.md`, 구현 계획 `docs/work_orders/U-01_SCOPED_DASHBOARD_IMPLEMENTATION_PLAN.md`.
- 작업 범위: Windows 로컬 개발 → 기존 단일 branch push → `ssh WSL-server`에서 동일 SHA 격리 검증. `ysna-server`와 Production은 이 주기 작업 대상이 아니다.
- 2026-10-09 현재 Task 1 API shell, Task 2 Reader, Task 3 화면의 로컬 절편은 구현·검증·원격 보존했고 Task 3 종료 `95d79d9bed1187d1480e3f341984827a19028d40`의 G-05 seq2304 PASS까지 확인했다. Task 4의 실제 WSL-server·브라우저·DB 독립 수락과 PR/main 병합은 미실행이다. 이 기록으로 이번 계획 주기의 진행을 정리하되 U-01 전체는 `NOT_ACCEPTED`, Release는 `DEFER`, Production은 `NOT_EXECUTED`이며 실제 미실행 항목을 PASS로 바꾸지 않는다.

### DC-U01-003 — Task 4 WSL-server 동일 SHA 실측 불가

- 판정: 이번 주기 미실행 사항으로 기록한다. 설계·요구사항을 바꾸지 않으며 Task 1~3의 로컬 증거는 보존한다.
- 사유·재현 근거: 승인 계획은 로컬 clean SHA를 원격에 push한 뒤 `ssh WSL-server`에서 같은 SHA를 pull·검증하도록 정했다. Task 3 종료 SHA `95d79d9bed1187d1480e3f341984827a19028d40`의 로컬·`development/codex/u01-dashboard-r2` 동등성과 G-05 seq2304 PASS를 확인했다. Windows 로컬에서 `ssh -o BatchMode=yes -o ConnectTimeout=12 -o ConnectionAttempts=1 WSL-server true`는 2026-10-09에 종료 코드 1, `Connection timed out during banner exchange` / `172.27.253.53 port 22 timed out`으로 실패했다. 앞선 8·25·12초 시도도 같은 배너 시간 초과였으며 TCP 22 연결 가능성만으로 SSH 로그인 성공을 뜻하지 않는다.
- 영향: WSL-server Git pull/checkout, 격리 PG15·OIDC·HTTPS·Chromium, 실제 등록 두 pair→철회→재선택, 달력일 경계·DB row/API/화면/Network, 1920×1080·키보드·E-SHOT/E-NET/E-API/E-AUD/E-EVT와 해당 ID의 E-DEC/E-PRG·기존 Foundation 회귀는 `NOT_EXECUTED`다. 따라서 AV-SAFE-034·AV-OPS-027·AV-UI-017 및 U-01 공통 ID의 실제 환경 인수는 PASS 불가다.
- 수행·미검증: Windows 로컬 Web 103 PASS, typecheck/lint/build exit0, 인접 API 61 PASS/2 warnings, Task3 통제 인접 281 PASS와 독립 정적 검토 C0/I0/M0은 수행했다. 이는 WSL-server DB·브라우저·네트워크 결과를 대신하지 않는다. 이번 시도에서 WSL-server의 process/container/DB/임시 browser profile은 생성하지 않았으므로 그 대상에 대한 정리 작업은 없다. 기존 원격 잔여 자원 여부는 접속 불가로 미확인이다.
- 재개 조건·권고: SSH 배너 응답이 정상화되면 같은 단일 브랜치의 clean·원격 동일 exact SHA를 WSL-server가 Git으로 수신하고 Task 4의 격리 자원 이름·수명·정리법을 먼저 기록한 뒤 계획 Step 1~3을 실제 실행한다. WSL 서비스 재시작·Windows 재부팅·VHDX/ACL 변경 또는 다른 서버 대체는 이 기록만으로 승인되지 않는다.

### DC-U01-004 — Task 4 인수·PR/main 병합 보류

- 판정: 이번 주기 진도 기록상 미실행 항목으로 정리하되 제품 완료·수락·병합으로 표기하지 않는다.
- 사유·근거: 계획 Step 4는 필수 gate가 모두 GREEN일 때만 PR 생성·main 병합·merged-main smoke·기존 branch/worktree 정리를 허용한다. DC-U01-003의 실제 WSL-server·브라우저·DB·독립 인수 증거가 없으므로 GREEN 조건을 충족하지 못한다.
- 영향·조치: `codex/u01-dashboard-r2`는 기존 단일 작업 브랜치로 유지하고 새 브랜치를 만들지 않는다. PR/main 병합·merged-main smoke·branch/worktree 삭제·U-02 시작·ysna/Production 작업은 실행하지 않는다. 사용자 추가 승인을 요청해 작업을 멈추는 대신, 이 미충족 조건과 후속 재작업 범위를 여기와 결과보고서에 남긴다.
- 재개 조건: DC-U01-003의 동일 SHA 실측과 독립 Tester 판정, 필수 gate GREEN이 증거로 확인된 뒤 기존 브랜치에서 PR→main 병합→merged-main smoke→기존 브랜치·worktree 정리 순서를 수행한다. 승인 계획 밖의 기능·중요 위험 변경이 생기면 그 변경 내용 자체를 별도 항목으로 기록한다.

### DC-U01-005 — Task 4 결과 기록의 G-05 successor 경로 부재

- 판정: Task3 종료 checkpoint의 G-05 PASS는 보존하되, 이 변경기록·결과보고·evidence manifest를 같은 브랜치에 추가한 최신 상태를 GREEN으로 주장하지 않는다.
- 사유·재현 근거: Task3 H `95d79d9bed1187d1480e3f341984827a19028d40`은 clean/private 동일·G-05 seq2304 PASS(exit0)였다. Task4 보고 문서 추가 후 `python -B scripts/check_project_progress.py D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`는 종료 코드 1, `U01_TASK3_CLOSE_GIT_INVALID`다. 현재 검사기는 Task3 P→H 정확 5문서·1커밋 종료 경로에 결박되어 있으며 Task4 문서 후속 게시 route는 아직 없다. 보고서 내용 검증이 제품/WSL PASS라는 뜻도 아니다.
- 영향·조치: 후속 문서와 digest의 원문 해시는 맞췄지만 최신 Git에 대한 G-05는 NON-GREEN으로 남는다. 이를 무시해 PR/main을 진행하거나 검사 결과를 조작하지 않는다. Task3 H 불변 commit과 원격 복구 ref는 보존하고 새 문서는 같은 브랜치에 이력으로 보존한다.
- 재개 조건·권고: 기존 단일 브랜치에서 Task4 결과·미실행 상태를 명시적으로 허용하는 fail-closed 통제 successor와 위조 거부 테스트를 별도 작업지시·dual lease로 구현·독립 검토한 뒤 최신 G-05를 GREEN으로 복구한다. 이는 새 기능·공개 API·DB/운영 변경이 아니라 내부 진행 검증 경로 보완이다. WSL 실측 결손 DC-U01-003은 이 보완으로 해소되지 않는다.

### DC-U01-001 — Task 2 시작 문서의 제품 경로 표시 불일치

- 판정: 내부 문서 투영 오류를 A2에서 교정. 설계·기능 범위 변경은 아니다.
- 사유·근거: 최초 A `d89a1c6160821af0ed3fb62ee1426b9a576f201a`의 `repository.product_write_scope`가 전 Task 1 경로를 표시해 epoch102 WI·binding/write lease의 12경로와 달랐다.
- 영향·조치: Developer 쓰기를 중단하고 Event·lease 원문은 보존한 채 A2 `7b5c8bfc60e7db8d0147cf8bd7d82b5a674cc49d`에서 해당 표시와 A checkpoint를 교정했다. A2 local/private 동일·clean을 확인했다.
- 잔여·재개 조건: 신규 Task 2 통제 route와 제품 검증은 별도 gate다. A2 교정 자체를 제품 PASS로 간주하지 않는다.

### DC-U01-002 — Task 2 통제 독립 검토의 단계별 Git 허용 경계

- 판정: 동일 승인 범위의 통제 결함 2건과 음성 테스트 공백 2건을 단일 Developer가 보완했다.
- 사유·근거: 최초 통제 diff는 B 전용 `design_change.md` 수정을 D→P에도 허용했고, 종료 H가 test-only 제품 D를 허용했다. B→P/P→H 시각 역행 재결박 음성도 빠져 있었다.
- 영향·조치: 각각 RED→GREEN 음성을 추가하고 C→B에만 새 기록 파일을 요구하며 D→P 문서 및 H 제품 경로를 좁혔다. 최종 통제 SHA-256은 검사기 `BDC1AD0C9D932E8C1966C5814AFAE992C880BB33479E4592205C1E2FD6A607A9`, 테스트 `F49A5D11A67BBE2D6F1E04CD63F556714A695196D7F96837755C5ED2A7816CB7`이다.
- 실제 검증: Task 2 집중 10 PASS, 인접 7파일 271 PASS/0 FAIL(exit 0), 활성 G-05 seq2297 PASS, 독립 재검토 Critical 0/Important 0. 제품 12파일·WSL-server 실제 QA는 미실행이다.
- 잔여·재개 조건: 통제 C `ff8f26b60c22696fdb8a27ed5d551b26ab879100`는 기존 branch/private에 게시·원격 동일·clean까지 확인했다. 이 문서를 포함한 B 투영의 G-05·원격 게시/clean 후에만 제품 RED 테스트를 시작한다.
