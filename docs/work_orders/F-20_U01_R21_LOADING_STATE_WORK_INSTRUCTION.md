# WorkInstruction — F-20/U-01 R21 Dashboard 조회 중 상태

- 담당: `developer-primary-f20-u01-r21`. Main이 본 지시서·Invocation을 동일 SHA로 게시하고 canonical 새 worker/write dual lease의 두 fencing token이 ACTIVE일 때만 단일 writer로 수정한다.
- 기준 문서 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R21 계획 `45C570BAEC2E9D139FD257B36D4CEC0569619D34D5CEA8032E029B5BB3FB5A20`.
- 기준 Git: 기존 `codex/f18-wsl-ops`의 R20 종료 seq1920, clean/G-05 PASS, worker/write null. R21 준비 checkpoint·lease 발급 checkpoint의 정확한 SHA는 Main이 별도 기록한다.
- 분류: 승인된 U-01 내부 구현 보완. 기능 범위·요구사항·중요 위험 및 공개 API·DB·권한 계약 변경 없음.

## allowed_paths 정확히 3개

1. `apps/web/tests/f15-console.test.mjs`: 첫 렌더의 Operations snapshot 기반 다섯 카드에 `LOADING`을 요구하는 테스트를 먼저 추가하고 현재 코드에서 의도한 RED를 확인한다. 각 카드의 `aria-live`, 요청 완료 후 기존 LOADED/BLOCKED/UNAVAILABLE·오류 본문 비노출 회귀를 검증한다.
2. `apps/web/src/console/App.tsx`: Operations snapshot의 요청 전 상태만 `LOADING`으로 분리하고 Queue·Worker·Execution Backends·Artifact Store·Next Actions가 안전한 대기 표시를 하도록 최소 변경한다. 기존 API 요청·응답 분류, Database readiness, Provider, Alerts, 타 메뉴는 변경하지 않는다.
3. `docs/04_test_reports/F-20_U01_R21_LOADING_STATE_RESULT.md`: 시작 HEAD/branch/status·기준 hash, RED→GREEN, 정확한 명령/exit/결과, diff·기능 유지·미검증·rollback, 자원 정리 및 WORK_STATUS 인계 여부를 기록한다.

## 검증·금지·인계

- 로컬 집중/전체 console, typecheck, lint, build, diff check, G-05를 실행한다. Developer는 테스트 임시 출력 생성 전 부재와 경계를 확인하고 정확한 자신 소유 출력만 정리한다. Main이 독립 diff/테스트와 WSL-server 동일 SHA 검증을 소유한다.
- Developer는 Main 소유 progress/HANDOFF/WORK_STATUS/control/Git commit·push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 제출한다. `LOADING` 부분 구현을 U-01 전체 7상태·브라우저 인수·F-20 완료·C30 해소로 승격하지 않는다.
