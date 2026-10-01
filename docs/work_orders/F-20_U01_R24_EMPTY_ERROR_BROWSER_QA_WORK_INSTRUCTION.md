# WorkInstruction — F-20/U-01 R24 빈 결과·오류 브라우저 QA

- 담당: `developer-primary-f20-u01-r24`. Main이 이 지시서와 Invocation을 기존 사설 branch 및 WSL-server 동일 SHA로 고정하고 canonical worker/write dual lease의 두 fencing token이 ACTIVE인 동안만 단일 writer로 작업한다. lease 발급 전 제품·테스트 파일 write 금지.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R24 계획 `7BBFF2DC745467494784D730AA037AF67427572F7846A30D3503A3EC133C0DED`.
- 기준 Git: 기존 `codex/f18-wsl-ops`, R23 close seq1938, worker/write null, clean/G-05 PASS. R24 계획·WSL checkout checkpoint `e13d8f3b4fe6094e7a3d08d3c81a8f01a5a75ef2`; 실제 lease 발급 기준 SHA는 Main이 별도 기록한다.
- 분류: 승인된 U-01의 브라우저 QA 하네스 보강. 기능 범위·요구사항·중요 위험 및 제품 공개 API·DB·권한 계약 변경 없음.

## allowed_paths 정확히 3개

1. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 PG15/OIDC/HTTPS/Chromium 하네스에서 인증 직후 저장 전 실제 빈 Critical Alerts/Next Actions와 테스트 경계의 단일 Dashboard 조회 오류를 분리해 검증한다. 빈 결과는 관측된 0건, 오류는 0건/HEALTHY가 아님을 단언한다. 다른 독립 카드는 관측값을 유지하고 오류 본문·Secret은 DOM에 표시하지 않는다. R23 초기 LOADING/키보드와 저장 alert→Next Actions→revoke/403, same-origin/Secret 감사를 유지한다. 새 단계 자기검증의 예상 RED→GREEN을 먼저 수행한다.
2. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: R24 제한된 boolean fact와 실패 stage를 안전한 whitelist에 결박한다. 비 opt-in은 실제 브라우저 PASS로 취급하지 않는다. 기존 R20/R23 결과 필드·DB fixture 의미를 바꾸지 않는다.
3. `docs/04_test_reports/F-20_U01_R24_EMPTY_ERROR_BROWSER_QA_RESULT.md`: 시작 branch/HEAD/status·기준 hash·lease, 정확한 RED/GREEN 명령·exit·결과, diff·기능 유지·미검증·rollback, 로컬 임시자원 정리와 Main 인계를 기록한다. 실제 WSL 브라우저 전에는 DOM/Network/DB를 `UNVERIFIED`로 둔다.

## 검증·금지·인계

- Developer는 `node --check`/하네스 자기검증, Python 비 opt-in, console 전체, typecheck/lint/build, G-05·diff check를 실행한다. 테스트 임시 경로는 사전 기록하고 정확한 신원·실경로/link 확인 후 전용 대상만 정리한다. Main은 exact3 diff와 로컬 회귀를 독립 확인하고 commit/private push 뒤 WSL-server 동일 SHA의 실제 격리 PG15/OIDC/Chromium opt-in, 증거·자원 정리를 소유한다.
- Developer는 Main 소유 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, Oracle/ysna-server/Production, 제품 `App.tsx`/API/schema·인증/권한·Secret을 변경하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 제출한다. R24 빈/오류 부분 QA를 U-01의 quota/cancel/reconnect·필터/운영 카드·전체 접근성·정식 E-SHOT/E-NET/E-API/E-EVT·F-20 완료·C30 해소로 승격하지 않는다.
