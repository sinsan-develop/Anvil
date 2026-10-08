# F-20/U-01 R6B — 브라우저 오류 응답 완료 경계 보완 계획

## 판정과 근거

- 기존 R6의 기본 모드 실제 WSL-server PG15/OIDC/Chromium E2E는 `PRE_AUTH_RESPONSES` Provider401 본문/완료 TIMEOUT으로 실패했다.
- 동일 SHA의 테스트 전용 A/B에서 기본 OFF는 재현됐고, 비정상 응답 clone 본문을 읽는 ON은 기존 OIDC·DB·Network·Secret 검사를 끝까지 수행한 뒤 진단 전용 SKIP으로 종료됐다. 이는 원인 가설의 강한 증거지만 제품 기본 모드 PASS는 아니다.
- 현 R6 exact3 WorkInstruction은 제품 UI/서비스 동작 및 `App.tsx`를 제외한다. 현재 lease로 제품 수정하지 않고 새 WorkInstruction·epoch19 dual lease를 발급한다.
- 요구 기능, 공개 API, role·권한, DB schema·지속 데이터, Secret, 외부 비용, 운영 배포는 변경하지 않는다. 오류 응답 처리의 내부 구현 보완만 다루므로 Main의 내부 revision으로 분류한다. 다른 영향이 확인되면 즉시 재분류한다.

## 목표와 경계

비인증 Provider·Alerts 및 실패 Health 응답을 화면이 안전하게 완료 처리하도록 최소 수정하고, 실제 비계측 브라우저 요청의 완료/본문 Network 감사와 OIDC·저장 Critical·403 제거 E2E를 검증한다. 사용자에게 오류 원문·비밀값을 표시하지 않는다. 성공 응답과 기존 fail-closed 화면 상태는 유지한다.

## 순서

1. 기존 R6 epoch18 write→worker 회수, R6B epoch19 exact5와 WI hash를 canonical event/progress/handoff에 발급하고 G-05 확인. 이전 writer가 해당 파일에 동시 write하지 않게 한다.
2. `apps/web/tests/f15-console.test.mjs`에 Provider/Alerts/Health 오류 응답 body 완료 경계와 기존 UNAVAILABLE/FAILED 상태·비밀 비노출 회귀를 RED로 추가한다.
3. `apps/web/src/console/App.tsx`의 실패 응답만 최소한으로 완료 처리한다. bounded 여부·AbortSignal·오류 무시 시 기존 UX/정책 회귀를 검토하며 API 계약이나 성공 경로를 변경하지 않는다.
4. R6 Python/Node harness와 결과보고서를 필요한 최소 범위에서 갱신하되 A/B 진단 ON을 수락 근거로 사용하지 않는다. 로컬 Node/Python 인접, typecheck/lint/build, G-05 및 diff를 검증한다.
5. Main 독립 검토 후 같은 `codex/f18-wsl-ops` private branch에 commit/push하고 WSL-server 격리 checkout에서 exact SHA pull. 일회성 PG15·합성 OIDC·실제 Chromium의 **기본 OFF** 전체 E2E와 Network·Secret 검사를 수행한다.
6. 지정 컨테이너/DB/role/포트/TLS/pytest/build 임시 자원만 확인·정리하고 잔류0·G-05·Git 상태를 기록한다. R6B의 범위 한정 합격은 C30 `OPEN_BLOCKING` 해소, U-01/F-20 전체 수락, main 병합 또는 Production 검증이 아니다.

## 제외

새 branch, main 병합, ysna-server/Production, 공유 WSL checkout·DB·서비스, 새 공개 API/권한/DB migration, 로그인 UI 및 다른 Dashboard 기능은 제외한다.
