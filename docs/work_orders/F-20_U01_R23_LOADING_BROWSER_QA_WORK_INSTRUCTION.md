# WorkInstruction — F-20/U-01 R23 초기 LOADING 브라우저 QA

- 담당: `developer-primary-f20-u01-r23`. Main이 이 지시서와 Invocation을 기존 사설 branch·WSL-server 동일 SHA로 고정하고 신규 canonical worker/write dual lease의 두 fencing token이 ACTIVE인 동안만 단일 writer로 수정한다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R23 계획 `8898A9C9420814656C3E12B74D131AA64D0C318260A59651F385E73B90E5184F`.
- 기준 Git: 기존 `codex/f18-wsl-ops`의 R22 종료 seq1932, clean/G-05 PASS, worker/write null. R23 계획 checkpoint는 `db178247d4eaa51354ace96db6b85bfbcc786adf`; lease 발급 기준 SHA는 Main이 별도 기록한다.
- 분류: 승인된 U-01의 검증 하네스 보강. 기능 범위·요구사항·중요 위험 및 제품 공개 API·DB·권한 계약 변경 없음.

## allowed_paths 정확히 3개

1. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 R6/R20 Chromium 흐름에서 첫 Dashboard 독립 네 요청만 잠시 보류해 실제 DOM의 Health 여섯 카드·Next Actions·Critical Alerts `LOADING`/`aria-live` 및 조기 실패·0건·READY/HEALTHY 부재를 확인한다. 네 요청을 해제해 settled 상태와 기존 저장 alert→Next Actions→권한 철회, same-origin·비밀 비노출 감사를 유지한다. 실제 `Tab`/`Enter`로 Dashboard 메뉴와 사이드바 접기/펼치기 `aria-expanded`를 좁게 확인한다. 하네스 자기검증에 실패 탐지 assertion을 먼저 추가하고 예상 RED→GREEN을 기록한다.
2. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: R23 브라우저 하네스의 단계·제한된 결과를 기존 PG15/OIDC opt-in 경계에 결박한다. 비 opt-in은 실제 브라우저 PASS로 취급하지 않으며, 기존 R20 검증의 기대 필드·권한·DB fixture 의미를 변경하지 않는다. 브라우저 flag 및 결과는 민감한 원문 없이 상태·건수·boolean 중심으로 유지한다.
3. `docs/04_test_reports/F-20_U01_R23_LOADING_BROWSER_QA_RESULT.md`: 시작 HEAD/branch/status·문서 hash·lease, RED→GREEN과 로컬 정확 명령/exit/결과, diff·기능 유지·미검증·rollback, 임시 자원 정리 및 Main 인계를 기록한다. WSL 실제 검증 전에는 브라우저·DB·Network를 `UNVERIFIED`로 둔다.

## 검증·금지·인계

- Developer는 로컬 `node --check`/하네스 자기검증, Python 비 opt-in, console 전체, typecheck, lint, build, G-05, diff check를 실행한다. 기존 의존성/임시 출력은 사전 부재·신원·경계 확인 후 exact target만 정리한다. Main이 exact3 diff·로컬 회귀를 독립 확인하고, Git commit/private push 뒤 WSL-server 동일 SHA의 격리 PG15/OIDC/Chromium 실제 opt-in 및 증거·자원 정리를 소유한다.
- Developer는 Main 소유 progress/HANDOFF/WORK_STATUS/control/Git commit·push, WSL-server/Docker/DB, 새 branch/main, Oracle/`ysna-server`/Production을 변경하지 않는다. 제품 `App.tsx`/API/schema·권한·Secret도 변경하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 제출한다. R23 초기 loading·기본 키보드 부분 QA를 U-01 전체 7상태·전체 접근성·정식 E-SHOT/E-NET·F-20 완료·C30 해소로 승격하지 않는다.
