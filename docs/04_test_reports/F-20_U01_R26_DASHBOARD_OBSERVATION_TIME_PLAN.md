# F-20/U-01 R26 Dashboard 관측 시각 표시 계획

## 판정과 범위

승인된 설계서 §29.2의 Dashboard 갱신 시각 요구를 기존 공개 응답 `GET /api/dashboard/operations`의 `data.observed_at`으로 좁혀 구현한다. 현재 머리말의 `마지막 확인 · JUST NOW`는 readiness 결과이며 Dashboard 관측 시각의 증거가 아니다. R26은 이 혼동을 없애는 작은 UI 수직 절편이다. Project/Environment/기간 필터, 수동 재조회 버튼, 실행·승인·비용 read model은 이 절편에 포함하지 않고 U-01 미충족으로 유지한다.

기준은 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`이다. R25 종료 HEAD `aa6596bdce9ac79de653f828881c087f1ff7e82b`, 기존 `codex/f18-wsl-ops`, canonical seq1950·worker/write null, C30 `OPEN_BLOCKING`·ReleaseDecision `DEFER`에서 시작한다.

## 구현 계약

1. `LOADED` Dashboard 상태에 검증된 top-level `observed_at`을 보존한다. 기존 cards·Next Actions·Alerts·readiness 상태는 독립적으로 유지한다. 미래 시각은 유효한 관측으로 표시하지 않는다.
2. 머리말에 `대시보드 관측 시각`을 별도 표시한다. 성공 시 서버가 돌려준 ISO 시각을 보이며, 로딩·권한 차단·오류·잘못된 시각은 각기 정직한 상태를 표시한다. `JUST NOW`를 실제 시각으로 해석하거나 허위 0건/성공으로 바꾸지 않는다. 상태 변경은 접근 가능한 live 영역에서 전달한다.
3. 새 fetch, polling, 브라우저 절대 API 주소, localStorage, 공개 API/schema/DB/인증·권한/Secret 변경은 없다. 이미 받은 값으로 render 중 단순 파생하며 불필요한 effect·memo·동기 상태를 만들지 않는다.
4. `apps/web/tests/f15-console.test.mjs`에서 loading·valid·future/invalid·401/403/503·revoke의 정확한 DOM 의미와 기존 카드 불변을 TDD RED→GREEN으로 검증한다. `tests/browser/f20-u01-oidc-browser-pg15.mjs`의 기존 실제 PG15/OIDC/HTTPS/Chromium flow에 pre-auth/보류 로딩/저장 성공/권한 철회 시각 단언을 추가하되 R23~R25 fact·Network·Secret 검사를 느슨하게 하지 않는다. 새 Python fact 계약은 추가하지 않는다.

## 실행 순서와 검증

1. Main이 이 계획·WorkInstruction·Invocation·빈 결과보고서를 기존 branch에 checkpoint/private push하고 WSL-server에서 같은 Git SHA를 읽기 전용 확인한다. canonical epoch40 dual lease를 exact4 writer 범위로 발급한다. 발급·ACTIVE 확인 전 Developer 제품 write 금지다.
2. 단일 `developer-primary`가 테스트 우선으로 exact4만 수정한다. 로컬 Node console 전체·typecheck·lint·build, browser 자기검증, 비 opt-in Python, G-05 및 diff 검사를 완료한다. Main이 독립 diff·회귀를 확인한 뒤 같은 branch에 checkpoint/private push한다.
3. Main이 WSL-server에서 동일 clean SHA의 격리 PG15/OIDC/HTTPS/Chromium opt-in을 실행하고 화면·Network·API 사실을 확인한다. 사용 전 이름/실경로/포트 부재를 기록하고 테스트 후 해당 임시자원만 신원 확인·정리·잔여0으로 닫는다. 실제 실패를 mock PASS로 승격하지 않는다.
4. 결과보고·WORK_STATUS·canonical lease 회수/G-05/private push까지 마친다. `main` 병합·새 branch·ysna/Production은 하지 않는다. C30, U-01/F-20 미수락과 정식 독립 Tester E-SHOT/E-NET/E-API/E-EVT 미충족을 보존한다.

Rollback은 R26의 UI·테스트·보고서 exact4만 정상 Git revert한다. 기존 원장 Event·DB 지속 데이터는 손대지 않는다.
