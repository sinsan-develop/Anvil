# U-02 Workbench WorkInstruction

## 범위

Workbench의 대화·작업 지시·진행·결과·승인/중단/재개 상태 표현과 same-origin API client 계약을 검증한다. Provider가 연결되지 않거나 fixture evidence인 경우 실제 PASS로 표시하지 않는다.

## 검증 대상

- `apps/web/src/features/workbench/workbench-state.js`
- `apps/web/src/api/workbench-client.js`
- `apps/web/src/app/workbench.js`
- `apps/web/src/styles/workbench.css`
- `apps/web/tests/workbench.test.mjs`

## 완료조건

canonical 9 Provider 순서와 honest state vocabulary, empty/quota/cancel/reconnect, Last-Event-ID 재개와 상대 경로 API를 유지한다. 430px 화면에서 overflow가 없고 다음 메뉴와 동시 write를 하지 않는다.
