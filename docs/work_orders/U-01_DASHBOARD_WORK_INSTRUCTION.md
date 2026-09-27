# U-01 Dashboard WorkInstruction

## 범위

기존 공통 shell 위에 Dashboard의 health, 운영 상태, 승인 대기/경고와 다음 행동 read model 표시를 계획 범위로 검증한다. 실제 source가 연결되지 않은 상태는 `UNAVAILABLE`/`NOT CONNECTED`로 표시하며 PASS로 승격하지 않는다.

## 검증 대상

- `apps/web/index.html`
- `apps/web/src/app/app-shell.js`
- `apps/web/src/features/app-shell/app-shell-model.js`
- `apps/web/src/styles/app-shell.css`
- `apps/web/tests/app-shell.test.mjs`

## 완료조건

same-origin readiness만 사용하고 내부 주소·secret을 브라우저에 노출하지 않으며, Dashboard 메뉴·health/operations/next actions/critical alerts의 미연결 상태를 정직하게 표시한다. 1920×1080·12px shell 및 좁은 화면 접근성 계약을 유지한다.
