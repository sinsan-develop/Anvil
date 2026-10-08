# WorkInstruction — F-20/U-01 R19 Next Actions 화면 연결

- 담당: `developer-primary-f20-u01-r19`. 제품 수정은 Main의 이 지시서·Invocation·새 dual lease가 동일 SHA로 게시되고 두 fencing token이 ACTIVE인 뒤에만 시작한다. 단일 writer 원칙을 적용한다.
- 기준: 설계 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R19 계획 `6543DC078DF1C3520103CE4E27CCCE6042CAF49922ECFD1BCDDB38BB101DA4EB`.
- 기준 Git: `codex/f18-wsl-ops`의 `ef124d09314220173e1eb4a4f412b4dd4c04e3b9`, `development/codex/f18-wsl-ops` 및 WSL-server 격리 QA checkout 동일 SHA·clean, G-05 seq1908. C30 `OPEN_BLOCKING`/DEFER, F-20/U-01 미수락, worker/write lease null에서 별도 신규 lease를 발급한다.
- 분류: 승인된 U-01 내부 화면 연결. 새 기능 범위/요구사항/중요 위험·공개 API/데이터 계약·DB schema·인증·Secret·비용 한도 변경 없음.

## 제품 allowed_paths exact3

1. `apps/web/tests/f15-console.test.mjs`: 먼저 실제 `loadDashboardQueue`와 실제 렌더를 대상으로 기존 `next_actions`의 정상 목록/빈 목록, 401/403, 5xx/transport, malformed 행, 위험 링크, 민감 오류 본문 비노출을 검증하는 실패 테스트를 작성하고 기능 부재 때문에 RED인지 확인한다. 기존 Queue/Health/Alerts 테스트는 보존한다.
2. `apps/web/src/console/App.tsx`: 같은-origin의 기존 `GET /api/dashboard/operations` 결과를 사용해 Dashboard에 Next Actions를 표시한다. 행은 `priority`, `reason`, `target`, `action`, `deep_link` exact5와 타입·건수 최대100을 fail-closed 검증한다. 링크는 안전한 내부 상대 경로이며 현재 구현된 메뉴 경로일 때만 사용하고 그렇지 않으면 텍스트로 표시한다. HTML/원본 JSON/오류 본문/Secret을 표시하지 않는다. 정상 빈 목록은 관측 범위의 0건임을 명시한다. malformed는 UNAVAILABLE, 401/403은 BLOCKED, 다른 실패는 UNAVAILABLE이다. 기존 상태 카드와 alert fetch는 독립 유지한다.
3. `docs/04_test_reports/F-20_U01_R19_NEXT_ACTIONS_UI_RESULT.md`: RED→GREEN, 정확한 명령·exit·결과, 변경 diff, 미검증, 잔여 위험, rollback, WORK_STATUS 갱신 여부를 기록한다. Main이 담당하는 WSL 실제 결과는 Main이 상태 파일에 누적한다.

## 검증·금지·결과

- 로컬 `apps/web` 전체 `test:console`, `typecheck`, `lint`, `build`를 실행한다. 필요한 임시 경로는 생성 전 부재 확인·수명 한정·정확한 정리 및 잔여 확인을 한다. 전체 suite 실패는 숨기지 않고 범위별로 보고한다.
- Developer는 Main 소유 progress/HANDOFF/WORK_STATUS, Git commit/push, WSL-server/Docker/DB, main/신규 branch, ysna/Production을 건드리지 않는다. API/BFF/server/schema/인증/운영 코드의 범위 밖 결함이 보이면 증거만 보고하고 임의 수정하지 않는다.
- 결과는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나로 반환한다. 1개의 UI slice PASS를 U-01 전체 E-SHOT/E-NET, F-20 acceptance, C30 incident 해소, ReleaseDecision 변경으로 승격하지 않는다.
