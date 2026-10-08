# F-20/U-01 R42 — 알려진 메뉴 경로의 직접 진입 복구

## 판정과 기준선

- 설계 §29.2와 작업계획서 U-01의 화면·이동 흐름 안의 내부 구현 보완이다. 신규 메뉴 기능, 공개 API, 인증·인가, DB, 스키마, 운영 배포 범위는 늘리지 않는다.
- 준비 기준: `codex/f18-wsl-ops`의 R39 종료 후 clean/private HEAD `74208b1009192d3ac57f8c0a4e3b2e8ac5b8cbd9`, canonical G-05 seq2054 PASS, worker/write lease 없음, F-20/U-01 미수락, Release `DEFER`.
- read-only 재현: 로컬 `mount_frontend` TestClient에서 `/` 200, `/projects` 404, `/operations` 404, 미지 경로 404. 로컬 production Web 서버에서도 같은 순서로 200/404/404/404. WSL Nginx `try_files`의 우회와 구별한다.

## 최소 설계

1. 앱 메뉴가 실제로 링크하는 **정확한** 경로만 HTML shell 직접 진입을 허용한다. `/`는 기존대로, 그 외 메뉴 경로는 `MENU_ITEMS`의 알려진 경로와 동기화한다. 임의 문자열 prefix, catch-all, `/api/`·`/auth/`·`/health/`·fixture 경로 fallback을 만들지 않는다.
2. ASGI의 명시적 API 라우트 뒤·StaticFiles mount 앞에 알려진 GET 화면 경로를 등록한다. 로컬 production Web 서버도 같은 알려진 화면 경로를 `index.html`로 제공한다. Preview/fixture 전용 UI 동작과 기존 보안 헤더를 유지한다.
3. 모든 메뉴의 직접 진입 200은 **HTML shell 제공만** 증명한다. U-02~U-11의 read model·기능·인수, Health 상세 링크, 11메뉴 완료를 주장하지 않는다. 미지 경로/fixture/민감 API는 기존 404·권한 경계를 유지한다.
4. TDD로 실제 HTTP GET 회귀를 두 서버에서 먼저 RED로 확인한 뒤 구현한다. 기존 ASGI/Web 테스트와 typecheck/lint/build 및 G-05를 실행하고, private push의 정확 SHA를 WSL-server 전용 checkout에서 재검증한다. 임시자원은 정확 경로 확인 후 제거한다.

## 작업 경계

- 제품 단일 writer exact paths: `packages/api/fastapi_app.py`, `apps/web/server.mjs`, `tests/api/test_public_asgi_frontend.py`, `apps/web/tests/ui-preview-runtime.test.mjs`, 결과보고서 `docs/04_test_reports/F-20_U01_R42_KNOWN_MENU_NAVIGATION_RESULT.md`.
- Main만 canonical worker/write lease, Event/progress/HANDOFF/checker/Git/현황을 관리한다. Developer는 위 exact5 외의 제품·통제 파일을 변경하지 않는다.
- 실패 시 기존 HTML shell 또는 원격 checkpoint로 되돌릴 수 있다. 보존 브랜치나 사용자 dirty·untracked에는 손대지 않는다.

## 합격과 미검증

- 알려진 메뉴 직접 GET 200·동일 shell; 미지 경로·API 오인 경로·fixture 금지 경로 404 또는 기존 인증 응답. Preview/fixture 동작 불변.
- 두 서버의 실제 요청 테스트, 관련 회귀, 타입/정적/빌드, G-05, WSL-server 정확 SHA를 별도 결과로 기록한다. 브라우저 클릭·Network, PG/Provider/운영 실측은 이 작은 절편의 PASS로 승격하지 않는다.
