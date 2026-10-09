# U-01 정확 조합·기간 Dashboard 이번 주기 완료보고

- 판정: 승인 계획 Task 1~3의 로컬 구현·검증 및 종료 기록은 완료. Task 4의 WSL-server 실측·독립 인수·PR/main 병합은 미실행으로 `design_change.md` DC-U01-003/004에 기록했다. 이 기록은 이번 계획 주기 완료보고이지 U-01 제품 최종 완료·사용자 인수 PASS가 아니다.
- 기준: 승인 계약 B SHA-256 `5B13E92A16A903F2887BA5F3E038AA5A41BBBBA667EE0DED57FF9C39E7BCA584`, 승인 기록 SHA-256 `60167FF6B062CC208CF21BE4990A7132743D249824B9160BA830044E6885AD39`, 구현 계획 SHA-256 `002977BDB7B634E974E4926F1FA52D6DC520450F92EBE64AB490EE6BD773C8C3`.
- 기준 Git: 기존 단일 브랜치 `codex/u01-dashboard-r2`, Task3 종료 `95d79d9bed1187d1480e3f341984827a19028d40`은 로컬·`development/codex/u01-dashboard-r2` 동일·clean. G-05 `PASS sequence=2304 reporting=AUTO_CONTINUE` 종료 코드 0. 이 SHA는 WSL-server에 수신·실행되지 않았다.
- 후속 Task4 기록 상태: 이 보고서·변경기록·manifest 추가 뒤 현행 checker는 `U01_TASK3_CLOSE_GIT_INVALID`(exit 1)다. Task3 H의 과거 PASS를 최신 문서 상태의 GREEN으로 승격하지 않는다. 상세·복구 조건은 `design_change.md` DC-U01-005에 기록했다.

## 실제 수행 근거

- Task 1 API shell, Task 2 Reader, Task 3 UI를 승인된 정확 pair·서울 달력일·same-origin·요청별 인가·원본 없는 값 `UNAVAILABLE` 계약 안에서 구현했다. 기존 GET/ACK 경로와 Foundation 보존은 실행한 로컬 테스트 범위에서만 확인했다.
- Task 3 제품 변경은 `apps/web/src/console/App.tsx`, `apps/web/src/console/app-shell.css`, `apps/web/tests/f15-console.test.mjs` 정확 3파일, 제품 commit `a8db53ba0cfa3596ab196e5d21de491d2ce586ce`다. Developer와 Main 각각 `npm run web:test` 103 PASS, `npm run web:typecheck`·`npm run web:lint`·`npm run web:build` 종료 코드 0. API 인접 `tests/api/test_u01_scoped_dashboard_api.py tests/api/test_f19a_registration_api.py` 61 PASS/2 warnings, 종료 코드 0.
- Task 3 통제 변경은 검사기와 테스트 정확 2파일, 집중 10 PASS, 인접 7파일 281 PASS/0 FAIL/0 SKIP. 독립 UI 정적 재검토 Critical 0/Important 0/Minor 0. 기존 전체 Ruff 진단 4844와 변경 줄 신규 0은 이전 조사 결과이며 최종 Ruff 전체 재실행 PASS를 주장하지 않는다.
- Task 3 실행/쓰기 임대는 seq2303 write→seq2304 worker 순서로 회수했다. 활성 agent/worker/write는 null, 완료 임대 둘 REVOKED. 로컬 build 산출물 `apps/web/dist`의 생성 파일 3개는 정확 경로·추적 상태 확인 후 제거했으며 다시 빌드해 복구 가능하다. 기존 `.pytest_cache` ACL 경고 폴더는 변경하지 않았다.

## Task 4 미실행과 영향

- 동일 SHA WSL-server 실측: `ssh -o BatchMode=yes -o ConnectTimeout=12 -o ConnectionAttempts=1 WSL-server true` 종료 코드 1, `Connection timed out during banner exchange` / `172.27.253.53 port 22 timed out`. 따라서 WSL-server Git pull/checkout, 격리 PG15/OIDC/HTTPS/Chromium, 실제 등록 pair/권한 철회·재선택, 기간 경계·DB row/API/화면/Network는 `NOT_EXECUTED`.
- 1920×1080·12px 실제 화면, 키보드, 상태/오류, E-SHOT/E-NET/E-API/E-AUD/E-EVT(통합검증매트릭스 §6.11), UI-003/004/014의 E-DEC, OPS-005의 E-PRG, 브라우저 내부 주소·secret 노출 0, Foundation 실환경 회귀는 `NOT_EXECUTED`. 로컬 빌드와 정적 검토를 실제 브라우저 PASS로 승격하지 않는다.
- 이번 Task4 시도에서 WSL-server process/container/DB/임시 profile은 생성하지 않았다. 새 자원 정리 대상은 0이지만 기존 WSL-server 잔여 자원은 접속 불가로 확인하지 못했다.
- `AV-SAFE-034`, `AV-OPS-027`, `AV-UI-017`과 U-01 공통 ID의 실제 환경 독립 인수는 미판정. U-01 수직 `NOT_ACCEPTED`, Release `DEFER`, Production `NOT_EXECUTED`. PR/main 병합·merged-main smoke·branch/worktree 삭제·U-02 시작·ysna-server 작업은 수행하지 않았다.
- 독립 read-only 검토의 판정도 `NOT_ACCEPTED`: 정적 소스 범위에서 새 Critical/Important 코드 결함은 확인되지 않았지만 필수 환경 증거가 없어 gate를 GREEN으로 판정할 수 없다. 직접 테스트·WSL·브라우저는 실행하지 않았다. 추후 공통 UI-001/002/006/007/010~014, 추가 UI-003/004/008/009/017, OPS-001~005/027, SAFE-034의 ID별 판정이 필요하다.

## 다음 재작업 조건

`design_change.md` DC-U01-003/004/005를 다음 주기의 입력으로 삼는다. 먼저 보고 후속 통제 route를 fail-closed로 보완하고 최신 G-05를 복구한다. SSH 배너 복구 후 같은 브랜치의 clean exact SHA를 WSL-server가 Git으로 수신하고, 격리 자원 범위·수명·정리법을 기록한 뒤 Task4 Step 1~3을 실제 실행한다. 독립 Tester의 필수 gate GREEN 전에는 PR/main 병합하지 않는다. 새 작업 브랜치는 기존 작업 브랜치를 main 병합·삭제하기 전 생성하지 않는다.
