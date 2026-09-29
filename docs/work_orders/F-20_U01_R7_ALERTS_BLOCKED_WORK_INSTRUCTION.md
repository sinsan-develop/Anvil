# F-20/U-01 R7 Alerts 조회 차단 표시 WorkInstruction

- 발행자: Main 어울. **DRAFT — canonical WI Event·epoch20 dual lease·G-05 PASS 전 제품 수정 금지.**
- 상위 권위: 승인된 설계/작업계획/매트릭스/테스트계획, `docs/04_test_reports/F-20_U01_R7_ALERTS_BLOCKED_BINDING_PLAN.md`.
- 분류: 기존 U-01 내부 구현 보완. 기능 범위·요구사항·공개 API·DB·인증/권한·Secret·운영 위험 변경 없음.

## 정확한 제품 쓰기 범위

1. `apps/web/src/console/App.tsx`
2. `apps/web/tests/f15-console.test.mjs`
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`
4. `docs/04_test_reports/F-20_U01_R7_ALERTS_BLOCKED_RESULT.md`

## 구현·완료 조건

- 기존 Alerts 조회의 `403`을 응답 본문 정상 소비 이후 `BLOCKED`로 구분하고 이전 경고를 제거한다. 화면 설명은 `조회 차단`처럼 원인을 단정하지 않는다. 단일·이전 페이지 조회 모두 적용한다.
- `401`, `5xx`, 비정상 본문은 `UNAVAILABLE`; abort/stale 응답은 현행 보호를 유지한다. 응답 본문·credential 원문은 DOM/로그에 표시하지 않는다.
- Node 테스트 RED→GREEN, typecheck/lint/build, 실제 WSL-server 격리 PG15/OIDC/Chromium 403 철회 후 DOM·stale clear·1920×1080 screenshot·same-origin Network를 수행하고 정확한 명령·exit·결과·미검증을 보고서에 기록한다. WSL 자원은 Main이 사전 기록·정리한다.
- Developer는 이 exact4만 수정하고 결과를 Main에게 인계한다. commit/push/merge, 공유 WSL 자원 변경, 다른 제품 경로 수정은 하지 않는다.
- F-20/U-01 전체 수락, C30 원장 사고 해소, 정식 E-SHOT/E-NET, 운영·ysna-server는 범위 밖이다.
