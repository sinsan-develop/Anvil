# F-18 R12 Auth Ingress WorkInstruction

- 담당: `developer-primary`; Main은 통제·독립 검토·원격 push·WSL-server 실제 HTTP QA·lease 종료를 소유한다.
- 기준: 승인된 설계 v2.8·작업계획 v1.7 F-18·F-18 기본 WorkInstruction 단계3과 `F-18_WSL_OPS_R12_AUTH_INGRESS_PLAN.md`. 기준 SHA-256은 기본 WorkInstruction의 설계/계획/매트릭스/테스트계획 hash와 같다. Main invocation이 canonical seq1561·epoch10 worker/write lease·시작 HEAD를 고정한다.
- 분류: F-17 Web-only `/auth/session` 405와 R11 이후 image의 `/auth/` SPA fallback을 해소하는 내부 파일 배치·라우팅 보완이다. 새 인증 방식·권한·API·Secret·데이터 계약이 아니며 기존 신산님 F-18 범위 승인 `APPROVAL-20260925-LOCAL-WSL-OPERATIONS-SCOPE-001`을 부모로 한 `MAIN_RECONFIRMED_NON_SEMANTIC` revision이다. 기본 F-18 후보 경로 밖인 기존 `deploy/local/nginx.conf`·F-15 테스트를 이 Task의 exact scope로만 추가하며 범위를 일반적으로 확대하지 않는다.
- 허용 제품 exact3: `deploy/local/nginx.conf`, `tests/integration/test_f15_local_stack.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`.
- 목표: Web image의 `/auth/*` same-origin 요청을 기존 API `anvil-api:8301`에 전달하고 `/api/`·SPA·CSP·proxy header·API 인증/권한 동작을 유지한다.
- 금지: browser code, API 권한/인증 의미, 공개 API, DB·Secret·certificate, Compose·network·`deploy/ysna`, WSL runtime, 다른 파일, 새 branch/subagent, 원격 push/merge. 실제 인증·운영 검증 PASS를 로컬 계약 검사로 주장하지 않는다.
- 실행: 계획의 RED→GREEN 및 회귀·build·전체 pytest 시도·diff-check, exact3 clean commit. 로컬 temp 자원은 exact 경로 확인 후 정리한다.
- 보고: 기준 문서 hash·시작 HEAD/branch/status, exact3 diff, 명령/exit/PASS·FAIL·SKIP, WSL 실제 HTTP/browser/전체 F-18·Production 미검증, rollback, progress/HANDOFF 변경 없음, 정식 실패 횟수.
