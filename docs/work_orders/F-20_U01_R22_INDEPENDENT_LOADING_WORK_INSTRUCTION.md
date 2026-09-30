# WorkInstruction — F-20/U-01 R22 독립 조회 상태

- 담당: `developer-primary-f20-u01-r22`. Main이 이 지시서·Invocation을 동일 SHA로 게시하고 canonical 신규 worker/write dual lease의 두 fencing token이 ACTIVE일 때만 단일 writer로 수정한다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R22 계획 `03B54EF4880DA9708A322DDCEC52CE39439A7CCFB7AB7D8B59DB4FA8C142BC46`.
- 기준 Git: 기존 `codex/f18-wsl-ops`의 R21 종료 seq1926, clean/G-05 PASS, worker/write null. R22 준비 checkpoint와 dual lease 발급 checkpoint의 정확한 SHA는 Main이 별도 기록한다.
- 분류: 승인된 U-01의 내부 표시 보완. 기능 범위·요구사항·중요 위험 및 공개 API·DB·권한 계약 변경 없음.

## allowed_paths 정확히 3개

1. `apps/web/tests/f15-console.test.mjs`: 첫 렌더의 Provider·Critical Alerts·Database가 실패가 아닌 `LOADING`인 테스트를 먼저 작성하고 현재 코드에서 의도한 RED를 확인한다. Provider/Alerts 직접 렌더, Database readiness와 Operations 응답 순서 양쪽 및 준비 실패, 기존 거부·실패·안전 렌더 회귀를 검증한다.
2. `apps/web/src/console/App.tsx`: 위 세 카드의 요청 전 표시만 `LOADING`으로 분리한다. Database는 readiness pending과 Operations pending을 구분하며, 완료 후 기존 `NOT CONNECTED`/Health signal 분류를 유지한다. 기존 same-origin 요청·응답 shape·권한·오류 본문 비노출·타 메뉴는 변경하지 않는다.
3. `docs/04_test_reports/F-20_U01_R22_INDEPENDENT_LOADING_RESULT.md`: 시작 HEAD/branch/status·기준 hash, RED→GREEN, 정확한 명령/exit/결과, diff·기능 유지·미검증·rollback, 임시 자원 정리와 Main 인계 여부를 기록한다.

## 검증·금지·인계

- 로컬 집중/console 전체, typecheck, lint, build, diff check, G-05를 실행한다. 임시 출력은 생성 전 부재·실경로·link 경계를 확인하고 본인 소유 exact target만 정리한다. Main이 독립 diff/회귀와 WSL-server 동일 SHA Node QA를 소유한다.
- Developer는 Main 소유 progress/HANDOFF/WORK_STATUS/control/Git commit·push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 제출한다. 이 R22 부분 구현을 U-01 전체 7상태·브라우저 인수·F-20 완료·C30 해소로 승격하지 않는다.
