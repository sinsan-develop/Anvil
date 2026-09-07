# C-21 Workbench UI rework local report

## 판정

`COMPLETED_LOCAL_PENDING_TOOLING_RECONCILIATION`.

운영 `/`는 fixture API를 호출하지 않고 인증된 same-origin Provider read API와 Run Event SSE를 사용한다. A-14 fixture는 `fixture-workbench.html`과 명시 경로에 보존했다. 이 판정은 LOCAL 구현·mock API 기반 실제 Chromium 클릭 범위이며 C-21 전체 acceptance가 아니다.

## 변경 결과

- canonical 9개 Provider 순서와 UPSTAGE primary를 API 응답 그대로 표시한다.
- 목록·상세·models는 credential 포함 same-origin GET만 사용한다.
- secret과 내부 host field를 허용하지 않는 fail-closed normalization을 사용한다.
- API가 확인하지 않은 값은 `NOT CHECKED`/`NOT AVAILABLE`로 표시한다.
- 설정·연결 테스트·models refresh는 disabled이고 POST를 보내지 않는다.
- loading/ready/empty/error/blocked/permission-denied/reconnect 상태를 상태 projection과 접근 가능한 status 영역으로 제공한다.
- SSE는 기존 authenticated GET 계약을 사용하고 재연결 때만 `Last-Event-ID`를 보낸다.

## 검증

- Node web 전체: 19 passed.
- Python API+agent_team: 193 passed.
- Headless Chromium: actual click/network PASS; same-origin GET only; UPSTAGE 자동 상세, GROQ 클릭, SSE 및 Last-Event-ID 재개 확인.
- 기존 Chromium SSE self-test/cross-origin rejection: PASS.
- diff/static boundary: PASS.
- 전체 pytest: collection error 7로 중단되어 PASS 아님.
- canonical full tooling: `583 tests / 19 failures / 1136.972s / exit 1`. seq578 validated-base mutation 1건은 현재 collector에서 fail-closed로 수정했다. 나머지 18건은 current-root를 과거 projection 검증에 사용한 temporal-fixture debt(A-13 7, A-14 2, G-07 3, Phase G Gate 4, progress historical projection 2)이며 별도 reconciliation package 전까지 독립 Tester 검토를 막는다.
- seq578 collector focused: `3/3 PASS`; start+result projection: `5/5 PASS`; live checker: `PASS sequence=578`; diff-check: PASS.

## 경계와 rollback

Provider·Telegram 실제 호출, WSL, ysna, main, DB/schema/Secret, push는 실행하지 않았다. historical evidence와 seq1~575는 변경하지 않았다. rollback은 결과 기록 commit을 먼저 되돌린 뒤 제품 commit `7eb2cc291bda729e21deebbed86376eac4db7c2b`를 revert하는 순서다.
