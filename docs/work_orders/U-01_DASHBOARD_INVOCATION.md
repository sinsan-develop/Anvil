# U-01 Dashboard Invocation

1. WorkInstruction과 현재 branch/HEAD를 확인한다.
2. `npm ci` 후 `npm run web:test`, `npm run web:typecheck`, `npm run web:build`, `npm run web:lint`를 실행한다.
3. 결과와 미검증 범위를 `U-01_DASHBOARD_REPORT.md`에 기록한다.
4. 운영/Production·ysna-server 호출은 수행하지 않는다.
