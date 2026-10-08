# U-02 Workbench Invocation

1. 현재 branch/HEAD와 U-02 WorkInstruction을 확인한다.
2. `node --import tsx --test apps/web/tests/workbench.test.mjs`를 실행한다.
3. Dashboard 회귀는 `npm run web:test`로 별도 실행한다.
4. 결과와 미검증 범위를 U-02 보고서에 기록한다.
