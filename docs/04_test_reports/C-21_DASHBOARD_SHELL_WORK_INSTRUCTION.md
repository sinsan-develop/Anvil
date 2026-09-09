# C-21 정식 Dashboard Shell 작업지시

## 기준과 목적

- 작업 branch: `codex/c21-wsl-acceptance-auth-r1`
- 기준 HEAD: `adae3a1`
- 사용자 확정: `/`는 Provider Workbench가 아니라 U-01 Dashboard + Common App Shell이다.
- 현재 Provider Workbench는 삭제하지 않고 Settings의 Provider 보조 화면으로 분리한다.
- 이 작업은 U-01 전체 완료가 아니라 실제 데이터 API 선행 전 최소 정식 Shell/routing 보완이다.

## 구현 범위

1. `apps/web/index.html`
   - 정식 Dashboard root로 교체한다.
   - `data-production-dashboard` 식별자를 둔다.
   - 11개 canonical 메뉴를 설계서 순서대로 표시한다.
   - Sidebar 224px/접힘 56px, Header 48px, 기본 여백 16px/카드 간격 12px를 CSS로 구현한다.
   - Header에 breadcrumb, environment 상태, 알림, 사용자를 배치한다.
   - Dashboard 상단에 Project, Environment, 오늘/7일/30일, 마지막 새로고침을 배치한다.
   - Health 6개, 운영 상태 6개, Next Actions, Critical Alerts 영역을 만든다.
   - 실제 source가 없는 값은 숫자를 만들지 말고 `UNAVAILABLE` 또는 `NOT_CONNECTED`와 이유를 표시한다.
   - 기존 `/health/ready`만 same-origin으로 읽어 Database readiness와 migration head를 표시할 수 있다.
2. `apps/web/provider-workbench.html`
   - 기존 production Workbench markup을 그대로 분리한다.
   - fixture link는 되살리지 않는다.
3. Dashboard App Shell module
   - `apps/web/src/app/app-shell.js`
   - `apps/web/src/features/app-shell/app-shell-model.js`
   - `apps/web/src/styles/app-shell.css`
   - 브라우저 코드는 same-origin 상대 URL만 사용한다.
   - Settings 메뉴의 Provider 진입은 `/provider-workbench.html`로 연결한다.
   - 아직 구현되지 않은 메뉴는 활성 기능처럼 가장하지 않고 준비 상태를 명시한다.
4. 기존 Workbench JS/state/client는 동작을 유지한다.
5. `ui-preview.html`과 historical evidence는 수정하지 않는다.

## 테스트 우선 계약

- 먼저 실패하는 `apps/web/tests/app-shell.test.mjs`를 작성한다.
- `/` Dashboard 식별자, canonical 11개 메뉴 순서, Provider 보조 경로, 정직한 UNAVAILABLE 상태, same-origin health path, 430px overflow 방지를 검증한다.
- `tests/api/test_public_asgi_frontend.py`에서 `/` Dashboard와 `/provider-workbench.html` 분리를 검증한다.
- 기존 Web 전체 `node --test apps/web/tests/*.test.mjs`와 관련 API 테스트를 회귀 실행한다.
- `git diff --check`와 browser code 내부 host/localhost 문자열 검사를 실행한다.

## 제외

- Dashboard read model/API 신규 구현과 가짜 데이터
- Provider 설정·연결 테스트·model refresh mutation
- DB migration, Provider/Telegram 외부 호출
- WSL/Oracle/ysna container 변경
- main merge, 원격 push

## 결과 계약

- 단일 writer로 구현하고 Subagent를 추가 생성하지 않는다.
- 작업현황을 `docs/04_test_reports/C-21_DASHBOARD_SHELL_PROGRESS.md`에 단계, 변경 파일, RED/GREEN 테스트, 오류 횟수, 미검증, 다음 조치로 누적 기록한다.
- 완료 시 commit을 만들고 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED` 중 하나로 보고한다.
