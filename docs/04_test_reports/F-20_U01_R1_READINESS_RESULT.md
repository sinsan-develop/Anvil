# F-20/U-01 R1 Database readiness 로컬·WSL 검증 결과

## 판정 → 판단 이유 → 조치

- **판정:** `SCOPED_PRODUCT_GREEN / FULL_SUITE_NON_GREEN`. 지정 exact3의 제품 코드는 Main 검토 뒤 commit/push됐고, WSL-server의 정확한 제품 SHA에서 실제 DB/API/브라우저 경로가 통과했다. 전체 pytest는 exit1(4 failed)이므로 U-01 전체 `ACCEPTED` 또는 F-20 수락 판정이 아니다.
- **판단 이유:** `0019_oidc_sessions`와 기존 `0016_operations_recovery`의 `status=ready`만 Database `READY`로 분류하고, 화면에 응답에서 확인한 실제 head를 표시한다. `0013_task_bootstrap_authority`, unknown, `not_ready`, null은 `NOT CONNECTED`다. 기존 same-origin `/api/health/ready` 요청은 유지했다. 로컬 및 Main의 WSL 실측 범위는 아래 증거로 한정한다.
- **조치:** 전체 suite의 G-06 환경 오염 3건은 임시 pycache 정리 후 해당 파일 25 PASS로 재검증했다. WSL 임시 자원은 Main이 잔여 0까지 정리했다. 남은 `tests/tooling/test_project_progress.py:1189`의 역사 기대값 불일치는 R1 exact3 밖이므로 Main이 새 lease/작업지시 범위를 분리하고 전체 suite를 재검증해야 한다.

## 기준선과 쓰기 권한

| 항목 | 시작 시 관찰값 |
| --- | --- |
| 작업 | `F-20/U01-R1`, `WI-F-20-U01-R1-20260928-001` |
| checkout·branch | `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops` |
| 시작 HEAD | `a20fae85734f8182eb175cd9b2d392dea3819c74` |
| 시작 status | `docs/WORK_STATUS.md` 수정 1건(Main 소유); 제품 exact3은 clean |
| 설계·계획 SHA-256 | `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712` / `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB` |
| 매트릭스·테스트계획 SHA-256 | `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6` / `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014` |
| 운영규칙 SHA-256 | `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0` |
| WI·Invocation SHA-256 | `034A0697B72B347190405AEE9709D8FC0CA2287CE16968818C3DB73E6AC01615` / `BC889BB504AAF664A748EBB1DD0697D0460951D78F7109030EC4A7244FD23610` |
| canonical Event | seq1771 `WORK_INSTRUCTION_ISSUED`, seq1772/1773 worker/write 발급, seq1774 재개. 시작 G-05 `PASS sequence=1774` |
| epoch10 worker/write | 둘 다 `ACTIVE`, 만료 `2026-09-29T03:21:00+09:00`; execution fence `f20-u01-r1-execution-fence-epoch-10-9c5a60a8951c`, write fence `f20-u01-r1-write-fence-epoch-10-9c5a60a8951c`; 동일 exact3 scope |

Lease의 `dispatch_head=b013b21c5de08d5528625f6cd93d5a7854665fc8`은 발급 직전 기준선이고 현재 HEAD `a20fae8`은 발급 Event·lease를 commit한 직계 후손이다. Main은 이 역사 기준선 해석을 확인하고 제품 write를 지시했다. WI/Invocation의 `DRAFT` 안내 문구는 발급 전 조건이며 canonical seq1771 발급으로 충족됐다. 이 해석이 잘못됐다면 lease 검증과 제품 작업 재검토가 필요하다.

## 변경 diff와 회귀

- `apps/web/tests/f15-console.test.mjs`: 0019 READY 및 기존 0016 READY, 0013/unknown/not_ready/null fail-closed를 검증한다. 실제 Database 카드의 0019·0016 표시와 unknown의 미연결 화면을 서버 렌더링 결과로 검증한다.
- `apps/web/src/console/App.tsx`: `classifyReadiness`에 정확한 0019 head를 추가한다. Database 카드는 동일 응답 payload로 상태와 실제 확인 head를 그리며, 나머지 카드의 `UNAVAILABLE` 표시는 유지한다. 사용하지 않는 React default import를 제거해 lint 경고를 해소했다.
- 이 결과보고서 외 제품/API/DB/auth·다른 메뉴·통제 원장 파일은 수정하지 않았다. 기존 `docs/WORK_STATUS.md` dirty는 Main 소유이며 이 결과의 diff에 포함하지 않는다.

## 로컬 실행 증거

| 순서 | 정확한 명령 | exit·관찰 결과 |
| --- | --- | --- |
| 착수 G-05 | `.\.venv\Scripts\python.exe scripts/check_project_progress.py` | 0, `PASS sequence=1774 reporting=AUTO_CONTINUE` |
| RED | `npm run test:console --workspace @anvil/web` | 1, 2 passed/2 failed. 0019 분류의 실제 `NOT CONNECTED` 대 기대 `READY`; Database 카드 구현 부재를 확인 |
| GREEN | `npm run test:console --workspace @anvil/web` | 0, 4 passed/0 failed/0 skipped |
| web typecheck | `npm run typecheck --workspace @anvil/web` | 0, TypeScript 오류 없음 |
| web lint | `npm run lint --workspace @anvil/web` | 0, 3 files 검사, 경고 없음. 첫 실행의 기존 React unused import 경고 1건은 제거 후 재실행 |
| web build | `npm run build --workspace @anvil/web` | 0, Vite 20 modules 변환. 최종 import 정리 후 재실행한 결과 |
| 빌드 후 G-05 | `.\.venv\Scripts\python.exe scripts/check_project_progress.py` | 첫 실행 exit1 `F20_U01_R1_GIT_INVALID`: build가 생성한 untracked `apps/web/dist/`가 exact3 밖이었다. 생성 전 status에 없던 산출물임을 확인하고 해당 경로만 정리 후 exit0, `PASS sequence=1774 reporting=AUTO_CONTINUE` |
| diff 검사 | `git diff --check` | 0 |

`apps/web/dist/`는 이 실행의 빌드 산출물 3개 파일만 확인하고 정리했으며 현재 경로가 없다. 아래 WSL 증거는 Main이 별도로 수행·전달한 결과다. 이 writer의 로컬 컴포넌트 렌더링 테스트를 실제 브라우저·DB 응답 증거로 승격하지 않는다.

## Main의 WSL-server exact SHA 실측

- 제품 commit `9b5bf8b2538c84ea721e34bc3676cca0be9522c2`는 같은 branch의 지정 원격 ref와 SHA가 일치했다. WSL-server 전용 checkout은 동일 SHA·Git clean을 확인하고 필요한 C-21 역사 객체를 준비했다. 격리 Node 22 `v22.23.2`에서 Node console **4 PASS**, web typecheck·lint·build **각 exit0**, G-05 `PASS sequence=1774`, F-15 API/UI와 R5e/R1 통제 **33 PASS**였다. Main 전달 요약에는 개별 WSL 명령 문자열이 포함되지 않았으므로 여기서 만들어 적지 않는다.
- 전용 PostgreSQL 15에 실제 Alembic `0019_oidc_sessions`를 적용했다. 임시 Anvil runtime/ASGI의 `/api/health/ready`는 HTTP 200 `{"status":"ready","migration_head":"0019_oidc_sessions"}`를 반환했다. 격리 Chrome **1920×1080·390×844**에서 Database `READY / Migration 0019_oidc_sessions`를 확인했고, 화면·JS·CSS·상대 `/api/health/ready` 네 요청은 모두 same-origin이었다.
- 음성 실측에서 전용 DB의 version 표식만 불일치시킨 뒤 실제 API는 HTTP 503 `{"status":"not_ready","reason":"migration_head_mismatch"}`를 반환했다. Chrome에서는 Database `NOT CONNECTED`, Migration 미표시, 동일 origin Network를 확인했다. 첫 `networkidle` 대기는 timeout이었으며 DOM 카드 상태 대기로 재검증해 성공했다. 0019 표식 복원 후 API는 HTTP 200으로 회복했다. 초기 DB 조작 명령 두 번은 shell 인용 오류·기본 psycopg2 부재로 데이터 변경 전에 실패했고, 프로젝트의 기존 psycopg3으로 수행했다. 이는 검증 도구 오류이며 제품 실패 증거가 아니다.
- Main이 캡처한 화면 SHA-256: ready 1920 `dc90653690f9a0b6df2e7c1a8214d845b1cb595b4605511a0a1f653e91508927`, ready 390 `cccd4bb97d17a43d5d0a6cc5cc7039c75638f4ebc4199f54583371d34c994b0e`, not-ready 1920 `391d8494801fd77c4de3cbd4fde8fd842363b7c2c0368cfcc3c0c720b38a848f`. 원본 캡처는 임시 산출물 정리 시 제거됐다.

## 전체 suite 비정상 결과와 자원 정리

- Main이 동일 SHA에서 실행한 정식 전체 pytest(`--import-mode=importlib`, fixture ignore, Node22, PG15 volume 환경, C-21 역사 commit 준비)는 **exit1, 8205 passed / 4 failed / 116 skipped / 14 warnings, 927.27s**였다. 로그 SHA-256은 `c8d407fa2b3202397e4da1f5c334224e170195b69f32601af2b9e53339668a0c`다. 로그 경로·정확한 실행 명령·14 warnings의 세부 내용은 writer에게 전달되지 않아 이 보고서에서 추가 판정하지 않는다.
- 실패 중 G-06 3건은 Main의 앞선 bare pytest가 fixture pycache 3개를 만든 환경 오염이었다. 정확한 세 파일 정리 후 G-06 파일 재실행은 **25 PASS**다. 이 집중 재검증을 전체 suite PASS로 바꾸지 않는다.
- 나머지 1건은 `tests/tooling/test_project_progress.py:1189`가 과거 `F20_R5E_AUDIT_INCIDENT_START`를 고정 기대하지만 현재 projection은 `F20_U01_R1_READINESS_START`인 불일치다. R1 exact3 밖이므로 이 writer가 테스트·checker·Event·projection을 수정하지 않았다. 새 lease와 별도 RED→GREEN/역사 권위 검토가 다음 조건이다.
- Main이 임시 API 프로세스·PG15 DB container·Chrome 프로필/캡처·build 산출물을 정리했다. 이어 남은 WSL checkout, focused pytest, formal pytest, npm cache, API 로그, bare/full 로그, formal 로그의 정확한 7경로를 realpath·HEAD·Git clean·프로세스/컨테이너 0·링크 상태 확인 뒤 제거했고 `F20_U01_R1_9B5BF8B_WSL_RESIDUE_ZERO` **exit0**을 확인했다. 앞서 G-06 fixture pycache 3곳도 제거했고 해당 파일 25 PASS를 확인했다. 이 자원 정리는 남은 역사 projection 테스트 실패의 해결을 뜻하지 않는다.

## 남은 경계와 rollback

- 실제 DB/API/브라우저·same-origin은 위 Main 실측 범위에서 확인됐다. 완전한 OIDC 로그인 세션 인수, U-01의 다른 Dashboard read model·11개 메뉴 수락, 정식 전체 suite GREEN은 미검증·미충족이다. 이 writer는 WSL·Production을 직접 실행하지 않았다.
- C30 CRITICAL 원장 사고는 `OPEN_BLOCKING`, release 결정은 `DEFER`다. R1 GREEN은 이를 해소하거나 U-01/F-20을 수락하지 않는다. `ysna-server`/Production 작업은 범위 밖이다.
- rollback 기준 제품 commit은 `9b5bf8b2538c84ea721e34bc3676cca0be9522c2`다. 이 commit에는 제품 exact3 외에 Main의 `docs/WORK_STATUS.md` 기록도 포함돼 있으므로, Main이 역사 기록 보존을 검토하며 정상 revert 범위를 정한 뒤 Node 테스트·web 검사·G-05를 재검증해야 한다. 현재 Main 소유 dirty `docs/WORK_STATUS.md`는 보존한다.
- canonical progress/HANDOFF 갱신, commit/push, write lease 회수는 Main 소유다. WSL 임시 자원 정리는 위와 같이 Main이 완료했다. 이 writer는 이번 후속에서 결과보고서 경로만 수정했고 commit/push를 수행하지 않았다. 정식 Developer 실패보고 0회다.
