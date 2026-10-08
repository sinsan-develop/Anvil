# WorkInstruction — F-20/U-01 R25 Dashboard 접근성 브라우저 QA

- 담당: `developer-primary-f20-u01-r25`. Main이 계획·이 지시서·Invocation hash를 기존 branch와 WSL-server 동일 SHA에 고정하고 canonical worker/write dual lease의 두 fencing token이 ACTIVE인 동안만 단일 writer로 작업한다. 발급 전 제품·테스트 write 금지.
- 분류: 승인된 U-01의 내부 브라우저 QA 보강. 기능 범위·요구사항·중요 위험 및 공개 API·DB·인증/권한·Secret 계약 변경 없음.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`. R25 계획 hash는 Main의 dispatch checkpoint에 결박한다.

## allowed_paths 정확히 3개

1. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 R23/R24 실제 flow의 pre-auth/LOADING/빈 결과/503/저장/revoke stage에서 `aria-live`, 키보드 포커스, 상태 구분과 stale focusable 행 부재를 단언한다. 기존 API/DB/Network/Secret 단언을 느슨하게 하지 않는다.
2. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: R25 boolean fact 4개와 안전한 실패 stage를 제한 whitelist에 결박한다. 비 opt-in을 실제 브라우저 PASS로 기록하지 않는다.
3. `docs/04_test_reports/F-20_U01_R25_DASHBOARD_ACCESSIBILITY_BROWSER_QA_RESULT.md`: 기준 branch/HEAD/status·hash·lease, RED/GREEN 명령/exit, exact diff, 미검증·rollback, 임시자원 정리와 Main 인계를 기록한다.

## 검증·금지·인계

- `node --check`/`--audit-self-test`, Python 비 opt-in, console 전체/typecheck/lint/build, G-05·diff check를 수행한다. 임시 경로는 사전 기록한 전용 대상만 정확한 실경로/link 확인 뒤 정리한다.
- Main은 exact3 diff·로컬 회귀를 독립 검토하고 commit/private push 뒤 WSL-server 동일 SHA 실제 격리 PG15/OIDC/Chromium opt-in과 증거·잔여0 정리를 소유한다.
- Developer는 Main 소유 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, Oracle/ysna-server/Production, 제품 UI/API/schema·권한/Secret을 변경하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 제출한다. R25 좁은 QA를 U-01/F-20 전체 수락이나 C30 해소·정식 독립 E-SHOT/E-NET/E-API/E-EVT로 승격하지 않는다.
