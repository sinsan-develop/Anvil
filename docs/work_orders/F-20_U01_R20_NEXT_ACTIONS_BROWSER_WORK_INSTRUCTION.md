# WorkInstruction — F-20/U-01 R20 Next Actions 브라우저 검증

- 담당: `developer-primary-f20-u01-r20`. Main의 본 지시서·Invocation·새 dual lease가 동일 SHA로 게시되고 두 fencing token이 ACTIVE인 뒤에만 단일 writer로 수정한다.
- 기준 문서 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R20 계획 `02F24289D7A6DD3AFD772D58037B87F98788C1FA8A26F412281DA13C1651FE95`.
- 기준 Git: 기존 `codex/f18-wsl-ops`의 R20 준비 checkpoint `e551e9db57de983bbeaa09a8d45c45b7792b0c78` 직계 후손, 사설 `development/codex/f18-wsl-ops` 및 WSL-server 격리 QA checkout 동일 SHA·clean, canonical G-05 seq1914·worker/write null. 이 지시서의 checkpoint 뒤 새 lease를 별도로 발급한다.
- 분류: 승인된 U-01 내부 실제 화면 검증 보완. 기능 범위·요구사항·중요 위험, 제품 공개 API·DB schema·인증 계약·Secret·비용 한도 변경 없음.

## allowed_paths 정확히 3개

1. `tests/browser/f20-u01-oidc-browser-pg15.mjs`: 기존 R6 실제 Chromium 흐름을 확장한다. 먼저 자기검증에서 Next Actions API↔경고↔DOM 불일치 검출의 RED를 확인한다. 저장 Critical 경고 시 Dashboard API 200의 `next_actions` 정확한 한 행을 경고 필드·화면 텍스트와 대조하고, 권한 철회 뒤 Dashboard API 403·카드 `BLOCKED`·과거 조치 행 부재를 단언한다. 기존 Alerts, 1920×1080 스크린샷, 전체 page Network/비밀 감사는 유지한다.
2. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 합성 OIDC role에 기존 `dashboard:read`만 추가하고 철회 시 제거한다. 저장 alert에서 기대 action의 우선순위·이유·대상·조치·링크를 산출해 Node에 제한된 환경값으로 전달한다. 제품 role/API 계약·real account를 변경하지 않는다. Python 기대 `R6_RESULT`는 새 boolean/count 사실만 받아들이며 원본 credential/URL을 출력하지 않는다.
3. `docs/04_test_reports/F-20_U01_R20_NEXT_ACTIONS_BROWSER_RESULT.md`: 시작 HEAD/branch/status, RED→GREEN, 정확한 명령·exit·결과, 변경 diff, 기존 기능 유지, 미검증, 잔여 위험, rollback과 WORK_STATUS 갱신 여부를 기록한다. Main의 별도 WSL 결과는 인계 후 Main이 누적한다.

## 검증·금지·결과

- 로컬 Node 구문·자기검증, Python 비 opt-in 집중 테스트, 기존 `apps/web` console 전체 테스트·typecheck·lint·build를 실행한다. 임시 출력은 생성 전 부재·정확한 대상·수명·프로세스 종료를 확인한 뒤 정리한다.
- Developer는 Main 소유 progress/HANDOFF/WORK_STATUS, Git commit/push, WSL-server/Docker/DB, main/신규 branch, ysna/Production을 건드리지 않는다. 기존 R6 browser test의 일시 loopback 사용은 범위 한정 QA이며 정식 full E-NET 인수가 아니다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 반환한다. 한 slice PASS를 U-01 전체, F-20, C30 해소, ReleaseDecision 변경으로 승격하지 않는다.
