# F-20/U-01 R47 Database Health Developer 결과

## 판정

`COMPLETED`는 **단일 Developer의 R47 구현·기본 검증 제출**만 뜻한다. 이후 Main이 보고한 동일 제품 SHA의 WSL-server 격리 PG15/OIDC/HTTPS/Chromium 실측은 이 **좁은 R47 절편에서 PASS**다. 독립 Tester 판정과 F-20/U-01 전체 인수는 별개이며 완료로 승격하지 않는다. ReleaseDecision은 `DEFER`, ysna/Production은 범위 밖이다.

## 판단 이유·기준선

- 시작 branch `codex/f18-wsl-ops`, HEAD `356dc3554cc330536c6388b1a7021a159eb2e64a`, progress G-05 seq2094 PASS. Epoch63 active worker/write dual lease와 서로 다른 execution/write fencing token·exact8 scope·만료 2026-10-06T06:36:33Z 확인. Main 소유 `docs/WORK_STATUS.md` dirty와 기존 `.pytest_cache` ACL 경고는 보존했다.
- 정본 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 통합매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R47 계획 `B3A7E19029038C1EF4E01397E969DF63C71B2103ABEFA5276F5808932BED9543`, WI `C874E144036BA263A5AAEAF4F27FDB4CA648E88B3D61BC2AE9B366224680D407`.
- `apps/api/anvil_api/oidc_process.py`: 기존 OIDC 단일 project/environment source loader에서 독립 SQL `SELECT 1` 및 `alembic_version` 단일 `0019_oidc_sessions`를 매 snapshot 관측한다. 시작 관측시각을 한 번만 소비하고, 실패·중복/불일치 head·5초 초과/역행 관측은 신호 없음→Database `UNKNOWN`/source gap이다. 성공 시 기존 `HealthSignal(database)`만 5분 freshness·오류0·credential-free SHA-256 evidence·`/operations/health`로 공급한다. Queue/Provider/나머지 5 Health를 정상으로 승격하지 않는다.
- R35 분리 대조: `/health/ready`의 결과를 읽거나 복사하지 않는다. readiness READY 여부와 무관하게 Dashboard Database는 별도 `OperationsSources.health_signals` 실제 관측만 사용하며, UI는 좁은 DB 접속·읽기 질의·Migration 일치 의미를 표시한다. `BLOCKED`/`UNAVAILABLE`에서 성공 설명을 숨긴다. API 응답 shape·OIDC scope/auth·DB schema/migration·Secret·공개 API 불변.

## 변경 파일·검증

- 변경 exact7(허용 exact8의 부분집합): `apps/api/anvil_api/oidc_process.py`, `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `tests/api/test_f20_u01_r47_database_health_host.py`, `tests/integration/test_f20_u01_r47_database_health_pg15.py`, `tests/browser/f20-u01-oidc-browser-pg15.mjs`, 이 결과 문서. `tests/integration/test_f20_u01_oidc_browser_pg15.py`는 별도 R47 opt-in에서 기존 안전한 인증 import helper만 재사용하고 파일은 무변경이다. Main 통제/progress/Event/WORK_STATUS/Git/WSL에 Developer write·접근 없음.
- TDD RED→GREEN: 실제 SQL+정확 head 미연결 2 FAIL→호스트 구현 후 GREEN; Web 좁은 설명 없음/denied에서 과장 설명 노출 각 RED→GREEN; 한 번 쓴 시각 재사용과 Queue 실패 뒤 시각 재사용 각 RED→GREEN. 접속 자체 실패 테스트는 기존 예외 처리가 이미 있어서 첫 실행부터 GREEN이었으며 이를 RED→GREEN으로 주장하지 않는다. R47 browser evidence 검증기와 control origin 경로는 각 undefined RED→self-test GREEN.
- 로컬 최종 관련 회귀: `python -m pytest -q -p no:cacheprovider tests/api/test_oidc_process.py tests/api/test_f20_u01_r37_provider_host_binding.py tests/api/test_f20_u01_r47_database_health_host.py tests/api/test_oidc_asgi_binding.py tests/observability/test_f13_operations.py tests/integration/test_f20_u01_r47_database_health_pg15.py tests/integration/test_f20_u01_oidc_browser_pg15.py` exit0, **155 PASS/4 SKIP/기존 deprecation warning1**(최종 재실행 11.54초). SKIP에는 R47 PG15·브라우저 실제 opt-in 미설정이 포함되며 PASS가 아니다. `node --check tests/browser/f20-u01-oidc-browser-pg15.mjs`, `node tests/browser/f20-u01-oidc-browser-pg15.mjs --r47-self-test` 및 기존 `--audit-self-test` exit0. 최종 `python -m scripts.check_project_progress .` G-05 seq2094 PASS, `git diff --check` exit0.
- Web `npm run test:console; npm run typecheck; npm run lint` exit0, 79 PASS/타입 오류0/lint 오류0. `npm run build` exit0, Vite20 모듈 빌드. 생성된 `apps/web/dist`는 경로·비-link·정확 내용을 확인하고 그 출력만 삭제, 잔류0.
- bare `python -m pytest -q -p no:cacheprovider` exit1, 테스트 실행 전 **13 collection ERROR**(동명 test module과 `tests/fixtures/repositories`의 독립 `src` import). 이는 R47 PASS가 아니다. 대체 `python -m pytest -q -p no:cacheprovider --import-mode=importlib --ignore=tests/fixtures/repositories`는 약 11%까지 진행하다 R47 scoped 검증 우선으로 수동 중단(exit1); 전체 PASS가 아니며 실제 테스트 최종 집계는 없다.
- opt-in `tests/integration/test_f20_u01_r47_database_health_pg15.py`는 `ANVIL_U01_R47_PG_DSN` 및 `ANVIL_U01_R47_PG_ISOLATED=1`, loopback5545, `anvil_f20_r47_<sha7>` 전용 DB/비root 동일 role, PG15/0019 preflight가 맞을 때만 실제 DB를 읽는다. 첫 검증은 실제 source 양성·migration mismatch/복구·scope 거부다. 두 번째는 정확 `ANVIL_F20_R47_FRONTEND_DIST=.../apps/web/dist`가 있을 때 임시 HTTPS issuer·OIDC 실제 `create_oidc_process_app` host·Chromium을 연결해 preauth401→Database HEALTHY(API/DOM/evidence)→migration mismatch UNKNOWN(API/DOM)→restore HEALTHY→권한 revoke403/BLOCKED→same-origin Network·Secret 비노출을 확인한다. Secret 검사는 양성·불일치·권한거부 API 본문, DOM, 요청 URL, synthetic 설정 비밀과 세션 쿠키 값을 포함한다. 기존 R6의 고정 QA HealthSignal을 이 경로에서 주입하지 않는다. 전용 DB의 migration 불일치 음성은 원래 head 복구를 `finally`로 수행하고 두 Engine·HTTPS listener·QA identity·임시 TLS/secret 파일을 정확 정리한다. 로컬에서는 opt-in 대상이 없어 두 테스트 모두 SKIP였고, 아래 Main 실측에서 각각 별도 PASS를 확인했다.

## Main 동일 SHA 실환경 실측 인계

- Main 보고 제품 SHA `f3ccc561092dfc15c41380d938cadb1d28360928`은 private/local/WSL 동일, G-05 seq2094 PASS. Main 로컬은 Python **155 PASS/4 SKIP**, Web **79 PASS**·typecheck/lint/build(Vite20 모듈) PASS, Node R47/R6 self-test PASS. WSL-server는 Node24, Web **79 PASS**·typecheck/lint/build(Vite20 모듈) PASS, Python **155 PASS/4 SKIP**. 이 기본 회귀의 SKIP을 실제 검증 PASS로 계산하지 않는다.
- 독립 tmpfs·loopback PostgreSQL 15 비관리자 role/DB, migration `0019_oidc_sessions`에서 R47 실제 SQL opt-in **1 PASS/1 deselected**. 별도 실제 OIDC host→HTTPS→Chromium opt-in **1 PASS/1 deselected/경고1**. 후자는 API/DOM의 Database 양성→migration 불일치 UNKNOWN→복구 HEALTHY→권한거부 403/BLOCKED와 same-origin Network·Secret 비노출을 확인했다. 합성 role `NOLOGIN`으로 실제 DB 접속을 끊었을 때 이전 HEALTHY 재사용 없이 fail-closed, `LOGIN` 복구 뒤 HEALTHY를 확인했다. 종료 전 head `0019_oidc_sessions` 및 합성 users/roles/sessions 0을 확인했다. 이는 R35 고정 QA HealthSignal과 별도인 실제 R47 host 경로의 증거다.
- Main은 PG 컨테이너 ID 접두 `3ff89547`의 정확 label/SHA/tmpfs/loopback/AutoRemove를 확인한 뒤 중지했고, port5545·브라우저·PG 컨테이너 잔여 0을 확인했다. `/tmp/anvil-u01-r47-{qa,venv,pytest}-f3ccc561` 세 root는 정확 실경로·UID1000·비-link·mount0·tracked-clean 확인 후 삭제해 잔여 0이다. 기존 공유 자원과 ysna/Production 변경은 0이다.
- 환경 명령 오류: 첫 editable pip install 형식 오류 1, PG role SQL 인용 오류 1, Playwright 설치 후 단순 버전 확인 인용 오류 1은 각각 정정됐다. 제품 테스트 실패로 계상하지 않는다.

## 미검증·영향·조치

- 기존 R6 browser harness의 `HEALTHY`는 QA-only 주입 fixture다. 이는 화면·same-origin Network·Secret 회귀일 뿐 R47 실제 host DB Health PASS가 아니다. R47 실제 host-to-DOM과 접속 단절/복구 근거는 위 Main의 동일 SHA WSL-server 격리 실측에 한정한다. 전체 F-20/U-01 인수·운영·Production 검증으로 확대하지 않는다.
- R45 역사적 frozen-authority close test 2 FAIL은 별도 기존 품질 기록이며 R47 관련 회귀 PASS로 덮지 않는다.
- 도구 환경 오류 4회: shell `CreateProcess helper_unknown_error: apply deny-read ACLs`가 기본 실행에서 반복됐지만 제품 테스트 실패는 아니었다. Main 지시에 따른 읽기 전용 `require_escalated` 재확인 1회 이후 같은 worktree에서 명령·테스트·G-05가 정상 종료됐다. 제품 실패 횟수 0, 미해결 도구 차단 없음.
- Main이 실측 결과와 exact diff를 독립 검토하고 Tester/통합 판정 및 progress/HANDOFF/WORK_STATUS 후속 통제를 수행한다. Rollback은 R47 변경 exact diff만 역적용; seq2090 이전 Event/lease/history 또는 다른 카드·공개 계약은 변경하지 않는다.
