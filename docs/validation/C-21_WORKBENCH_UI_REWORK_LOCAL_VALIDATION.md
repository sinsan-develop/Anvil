# C-21 Workbench UI rework local validation

- 범위: LOCAL product exact11과 seq576~578 result exact10.
- TDD: production UI/API/SSE 계약 RED 확인 후 GREEN.
- Node: web 전체 19/19 PASS.
- Python: API+agent_team 193/193 PASS; public ASGI focused 4/4 PASS.
- Browser: 실제 headless Chromium 클릭과 Network에서 canonical 9, UPSTAGE 자동 선택, GROQ 선택, same-origin credentialed GET, SSE `Last-Event-ID` 재개, disabled actions 3개를 확인했다.
- Static: production browser 코드에 absolute/internal host, localhost, Secret/API key reference 없음. `git diff --check` PASS.
- 전체 `pytest -q`: PASS 아님(exit2). PyYAML 미설치, duplicate test module import mismatch, fixture source import 오류 합계 7건으로 collection 중단.
- canonical full tooling: `583 tests / 19 failures / 1136.972s / exit 1`. validated-base mutation 1건은 seq578 collector 보완 대상으로 확인했다. 나머지 18건은 A-13/A-14/G-07/Phase G/progress의 historical projection이 current root와 결합된 temporal-fixture debt이며 이 package에서 수정하지 않는다.
- seq578 collector 보완 후 focused `3/3 PASS`, start+result `5/5 PASS`, live checker sequence578 PASS, diff-check PASS다.
- 제외: 실제 Provider/Telegram, WSL, ysna, main, DB/schema/Secret 변경, push.
- 결론: Developer local 구현 `COMPLETED_LOCAL_PENDING_TOOLING_RECONCILIATION`; 독립 Tester `BLOCKED_PENDING_TOOLING_RECONCILIATION`; C-21 전체 `BLOCKED_NOT_ACCEPTED`.
