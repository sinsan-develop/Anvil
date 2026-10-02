# F-20/U-01 R29 Dashboard quota 상태 결과

## 판정

`COMPLETED` — Developer의 exact5 제품·테스트·결과보고서 변경과 로컬 검증을 완료했다. Main의 독립 검토, commit/private push, WSL-server 동일 SHA PG15/OIDC/HTTPS/Chromium opt-in 및 화면·Network 검증은 미실행이다. 따라서 U-01/F-20 인수는 미완료이며 C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다. WSL에서 주입할 429는 결정론적 장애이며 서버의 실제 quota enforcement를 증명하지 않는다.

## 시작 기준과 범위

- 작업자 `developer-primary-f20-u01-r29`, 기존 worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, dispatch `HEAD=e7c5b23bb74db9def3e6e695df84aa03c1cde17f`, 시작 `git status --short --branch` clean. Lease baseline `e7c7588a1e76306a1b29e930f6348ee5e1af3331` 뒤 control-only commit으로 HEAD가 전진한 상태다.
- canonical seq1972/G-05 PASS 기준, epoch43 ACTIVE worker `worker-lease-f20-u01-r29-r29quota1003`와 write `write-lease-f20-u01-r29-r29quota1003`가 같은 exact5 범위를 가리킨다. execution token `f20-u01-r29-execution-fence-epoch-43-r29quota1003`, write token `f20-u01-r29-write-fence-epoch-43-r29quota1003`, 만료 `2026-10-03T09:17:16Z`; 작업 시각에 유효함을 확인했다.
- SHA-256: 계획 `AC87D9C9A7B9379D3E2C2A82C417ADF63390E2E078BF196C77D33AB87AE7912D`; WI `493EFE4DAA6622DB2135E7D19D85F3ADA21E7CFFA2D07F449E1787C20629F582`; Invocation `4CB623ADC1B71BA663909596807F59B51D3E9FB22B8AFBF6619D333AC68A490A`. PMO·프로젝트 AGENTS와 설계서 §29.2, 계획 U-01, 매트릭스 §6.11, 테스트계획 §10.8, 운영규칙 및 progress/HANDOFF를 기준으로 했다.
- 변경 exact5: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, 이 결과보고서. Main 소유 `docs/WORK_STATUS.md`는 별도 변경 중이며 수정·stage하지 않았다.

## 판단 이유와 구현 diff

- 기존 429 `UNAVAILABLE` 분기만 `QUOTA`로 분리했다. 401/403 `BLOCKED`, 500/503·전송·형식 오류 `UNAVAILABLE`, 응답 본문 drain, same-origin GET은 유지했다. 429 반환은 보호 payload가 없는 상태 객체여서 이전 Queue/Next Actions 행·관측 시각이 남지 않는다.
- 관측 시각은 `조회 제한`, Queue·Next Actions는 `QUOTA` 및 제한 문구를 표시한다. Database와 Worker/Execution Backends/Artifact Store는 같은 Dashboard 상태를 통해 `QUOTA`를 표시한다. 독립 Provider/Critical Alerts의 상태·데이터 흐름은 변경하지 않았다.
- 기존 R6/R23~R28 브라우저 흐름의 저장된 Next Actions 뒤에 단일 Dashboard GET 429를 주입하고, disabled 중복 클릭 방지·same-origin GET1·행 제거·관측 시각 제한·카드 상태·본문 마커 미노출을 검사한다. 같은 세션에서 수동 GET200으로 새 관측 시각과 저장 행을 회복한 뒤 기존 403 철회까지 계속한다. Python은 신규 두 evidence 객체를 exact key/type/value로 확인하며 기존 키 소유권을 유지한다.

## 실행 명령·종료 코드·결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `node --import tsx --test --test-name-pattern='Dashboard 429 clears protected state' tests/f15-console.test.mjs` (`apps/web`) | 1 → 0 | RED에서 실제 `UNAVAILABLE` 대 기대 `QUOTA`; 구현 뒤 focused 1 PASS |
| `python -m pytest -q tests/integration/test_f20_u01_oidc_browser_pg15.py -k r29_quota_evidence` | 1 | Windows PATH에 `python` 없음. 테스트 실행 전 도구 오류 |
| `.\.venv\Scripts\python.exe -m pytest -q tests/integration/test_f20_u01_oidc_browser_pg15.py -k r29_quota_evidence` | 1 → 0 | RED에서 신규 strict 계약 함수 부재, 구현 뒤 1 PASS/27 deselected. 잘못된 status·count type·행 상태·관측 시각·추가 key 거부를 확인 |
| `npm run test:console -w @anvil/web` | 0 | 51 PASS, 기존 상태/접근성 회귀 포함 |
| `.\.venv\Scripts\python.exe -m pytest -q tests/integration/test_f20_u01_oidc_browser_pg15.py -m 'not wsl_browser_pg15'` | 1 | 24 PASS/1 SKIP/3 setup ERROR. Windows 기본 pytest temp `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh` 접근 거부 |
| `.\.venv\Scripts\python.exe -m pytest -q tests/integration/test_f20_u01_oidc_browser_pg15.py -m 'not wsl_browser_pg15' --basetemp=.pytest-r29-quota` | 0 | 27 PASS/1 SKIP |
| `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` | 0 | 문법 PASS |
| `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` | 0 | `R6_AUDIT_SELF_TEST_PASS`; 의도적 negative 진단 문구 출력 포함 |
| `npm run typecheck` (`apps/web`) | 0 | TypeScript PASS |
| `npm run web:lint` | 0 | 3 files, 수정 0 |
| `npm run web:build` | 0 | Vite 20 modules |
| `.\.venv\Scripts\python.exe -m scripts.check_project_progress` | 1 → 0 | build `dist` 생성 중 `F20_U01_R29_GIT_INVALID`; 전용 dist 정리 후 G-05 seq1972 PASS |
| `git diff --check` | 0 | 공백 오류 없음 |

임시자원: 테스트 전 `.pytest-r29-quota`가 없음을 확인하고 전용 pytest 출력으로 사용했다. 절대 경로와 하위 파일을 확인한 뒤 해당 경로만 제거하여 잔여 0을 확인했다. `apps/web/dist`도 이번 build 산출물임을 파일 목록으로 확인하고 정확한 절대 경로만 제거하여 잔여 0을 확인했다. WSL·Docker·DB 자원은 생성하지 않았다.

## 미검증·인계·rollback

- 로컬 Node/Python 검증은 브라우저 실제 클릭·PG15·OIDC·HTTPS·1920×1080·Network/Secret 또는 실제 quota enforcement를 증명하지 않는다. 해당 WSL opt-in과 artifact 검증은 Main이 동일 clean SHA에서 수행한다.
- Main은 exact5 diff와 429 카드·브라우저 evidence 계약을 독립 검토하고, 승인된 범위의 commit/private push 후 WSL 격리 QA와 전용 자원 잔여 0을 확인한다. progress/HANDOFF/WORK_STATUS/control, Git commit/push, 서버·DB·운영 변경은 Developer가 수행하지 않았다.
- rollback은 Main이 R29 exact scope의 정상 Git revert로 이전 R28 구현과 원장 prefix를 복원한다. 공개 API, DB/schema, auth/Secret, 지속 데이터 변경은 없다.

## 독립 리뷰 Important 수정 라운드 1

- 판정: 리뷰 finding 재현·수정 완료. Database 카드가 `QUOTA`와 독립 API 준비 `READY`만 보이고 Dashboard 제한 설명이 없었으며, Worker 등 신호 카드도 `QUOTA`만 표시했다. API 준비·migration 정보는 그대로 두고 Database/Worker/Execution Backends/Artifact Store에 `조회 제한 · [카드명] 상태 정보를 표시하지 않습니다.`를 추가했다. 브라우저 429 흐름도 카드별 제한 문구와 Database의 API 준비 표시 유지를 단언한다.
- RED: `node --import tsx --test --test-name-pattern='Dashboard 429 clears protected state' tests/f15-console.test.mjs` (`apps/web`) exit1. Database 카드의 제한 설명 누락으로 정확히 실패했다. GREEN: 같은 명령 exit0/1 PASS.
- 회귀: `npm run test:console -w @anvil/web` exit0/51 PASS; `.\.venv\Scripts\python.exe -m pytest -q tests/integration/test_f20_u01_oidc_browser_pg15.py -m 'not wsl_browser_pg15' --basetemp=.pytest-r29-review1` exit0/27 PASS·1 SKIP; `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs` exit0; `node tests/browser/f20-u01-oidc-browser-pg15.mjs --audit-self-test` exit0/`R6_AUDIT_SELF_TEST_PASS`; `npm run typecheck` (`apps/web`) exit0; `npm run web:lint` exit0/수정0; `npm run web:build` exit0/20 modules; `.\.venv\Scripts\python.exe -m scripts.check_project_progress` exit0/G-05 seq1972 PASS; `git diff --check` exit0.
- 전용 `.pytest-r29-review1`와 `apps/web/dist`는 생성 전 부재, 생성 후 절대 경로·하위 항목을 확인한 뒤 해당 경로만 제거하여 잔여 0을 확인했다. 실제 브라우저 opt-in은 여전히 Main의 동일 clean SHA WSL 검증 범위다. Main 소유 `docs/WORK_STATUS.md`는 건드리지 않았다.
