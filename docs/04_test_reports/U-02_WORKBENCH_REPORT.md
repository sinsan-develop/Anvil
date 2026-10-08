# U-02 Workbench 완료 보고

## 판정

`ACCEPTED_U02_LOCAL_WEB_CONTRACT_SCOPED`

## 근거

- U-01 acceptance 이후 exact branch `codex/f18-wsl-ops`에서 검증했다.
- `node --import tsx --test apps/web/tests/workbench.test.mjs`: 10 passed.
- `npm run web:test`: Dashboard 회귀 3 passed.
- Workbench client는 상대 same-origin 경로만 허용하고 credentialed GET 및 SSE `Last-Event-ID` 재개를 계약으로 유지한다.
- reducer는 loading/ready/empty/blocked/permission/reconnect, quota/cancel과 fixture evidence를 구분하며 fixture를 실제 PASS로 승격하지 않는다.
- canonical Provider 9개 순서, 430px overflow 방지, 대화·지시·진행·결과·승인 상태용 UI state 계약을 확인했다.

## 미검증 범위

WSL-server 실제 브라우저 클릭/Network, live LLM Provider 호출·비용, 실제 DB Run hash와 human approval 계보, 운영/Production은 실행하지 않았다.

## 롤백

제품 파일 변경 없이 계약을 검증·기록했다. acceptance 기록은 이전 progress snapshot으로 복구한다.
