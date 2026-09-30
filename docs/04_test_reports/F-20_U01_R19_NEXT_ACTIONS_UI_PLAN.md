# F-20/U-01 R19 Next Actions 화면 연결 계획

## 판정과 기준

승인된 U-01 Dashboard에는 Next Actions가 필요하다. 현재 `GET /api/dashboard/operations`의 기존 응답에는 `next_actions`가 있으나 `apps/web/src/console/App.tsx`는 배열 여부만 확인하고 화면에는 표시하지 않는다. R19는 새 공개 API·데이터 계약 없이 이 기존 read model의 화면 표시만 연결하는 단일 내부 작업이다. 시작 기준은 `codex/f18-wsl-ops`의 R18 R1 종료 checkpoint `8cde3b639bec2ea7f116b7a29aa98d70ff52824f`, clean, G-05 seq1908, worker/write lease null이다.

## 제품 범위와 안전 계약

- 단일 Developer 제품 write 범위는 `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R19_NEXT_ACTIONS_UI_RESULT.md` exact3으로 제한한다. 기존 `GET /api/dashboard/operations` 하나를 재사용한다. 서버/API/schema/migration/인증/Secret/운영 설정은 변경하지 않는다.
- Next Actions는 기존 응답의 `priority`, `reason`, `target`, `action`, `deep_link`만 사용한다. 배열과 각 행의 필드·타입·건수(최대100)를 검증하고, 비정상 행이나 요청 실패는 안전한 `UNAVAILABLE`, 401/403은 `BLOCKED`로 표시한다. 오류 본문·토큰·원본 JSON은 화면이나 로그에 노출하지 않는다.
- 링크는 같은 출처의 상대 경로만 허용한다. `//`, scheme, query, fragment, 역슬래시, 허용되지 않은 문자나 미구현 경로를 브라우저 내비게이션 대상으로 사용하지 않는다. action·reason·target은 React 텍스트로만 표시하고 HTML 주입을 하지 않는다. 비어 있는 정상 목록은 ‘현재 관측된 다음 조치 0건’으로 표시하되 전체 시스템에 조치가 없다는 뜻으로 승격하지 않는다.
- 기존 Queue/Health/Alerts 로딩·표시·인증 실패 분류를 회귀시키지 않는다. R16/R17/R18의 내부 Run summary를 이 작업에서 API로 공개하거나 UI의 실행·승인·비용 카드에 연결하지 않는다.

## RED→GREEN·검증

1. 실제 `loadDashboardQueue` 응답과 실제 렌더 컴포넌트를 대상으로 정상 행, 빈 목록, 권한 차단, 5xx/transport, malformed/위험 링크, 민감 오류 본문 비노출 테스트를 먼저 작성한다. 기존 코드에서 기능 부재로 실패하는 RED를 확인한다.
2. 최소 구현 뒤 해당 테스트 GREEN, `apps/web` 전체 `test:console`, `typecheck`, `lint`, `build`를 로컬에서 실행한다. 테스트가 만든 임시 경로는 생성 전 부재·실경로·소유 프로세스를 확인하고 정확한 대상만 정리한다.
3. Main은 diff·회귀·G-05를 독립 검토한다. 안전 commit을 기존 사설 원격 branch에 push하고 WSL-server의 기존 격리 QA checkout을 정확한 동일 SHA로 FF한 뒤 해당 Node 테스트·typecheck·lint·build를 재실행한다. 브라우저 E-SHOT/E-NET은 별도 전체 U-01 formal gate이며 R19 단독 PASS로 대체하지 않는다.

## 통제와 종료 경계

Main이 본 계획 hash와 제품 exact3을 WorkInstruction/Invocation에 결박한 뒤 유효한 worker/write dual lease를 발급한다. Developer는 그 전 제품 write를 하지 않고 Main도 같은 경로를 동시 수정하지 않는다. 완료 시 결과·명령·종료 코드·미검증·잔여 자원을 `WORK_STATUS`/결과보고에 누적하고 write→worker lease를 순차 회수한다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락, main 미병합·신규 branch 0, ysna/Production 미실행을 유지한다. 회귀 시 R19 exact3만 정상 revert하고 기존 Health/Alerts/Run 구현은 보존한다.
