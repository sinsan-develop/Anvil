# C-28 mockup evidence — 사용자 확인 대기

## 증거 판정

`MOCKUP_ARTIFACT_READY / USER_CONFIRMATION_PENDING`.

이 문서는 HTML/CSS/interaction 계약 산출물과 실행한 Node unit/contract 검증 증거다. **브라우저 screenshot, 실제 운영 UI, 사용자 확인 또는 실제 API/Provider 실행 증거가 아니다.** 사용자 확인자·시각·evidence ref·confirmed target hash는 모두 미확정이다. C29 화면/BFF/API 연결은 `BLOCKED_USER_CONFIRMATION`으로 유지한다.

## 확인 대상

- `apps/web/c28-agent-console-mockup.html`: 기존 index/서버 route와 분리한 전용 mockup 진입점.
- `apps/web/src/app/c28-console.js`: local state reducer, render, mount click/keyboard 연결. 외부 요청 함수·데이터 client 없음.
- `apps/web/src/styles/c28-console.css`: 1920×1080 우선의 sidebar220px/content 구성, 기본12px·설명10px·보조9px·sidebar14px·title16px; 900px/600px responsive 규칙.
- `docs/evidence/ui/C-28_INTERACTION_CONTRACT.json`: C22~C27 source owner, 상태 의미, C29 상대 GET 경로 후보 및 사용자 확인 precondition.

## 검토 동선

1. Agent Team에서 5역할(ORCH/CODE/REVIEW/TEST/DEPLOY), owner/role 대화 자리, parent/child trace, model/provider/artifact/evidence/deploy readiness를 확인한다. 모든 표 데이터는 레이아웃 예시이며 실행 증거가 아니다.
2. MoA에서 proposal→critique→synthesis와 provenance 필드를 확인한다. Main 검토 입력일 뿐 승인·Release·Apply로 승격하지 않는다.
3. SNS / Daon User에서 channel/session/identity/permission/receipt/privacy/delivery 자리를 확인한다. Pause/Resume은 `REQUESTED_NOT_APPLIED` 메시지만 바꾸며 Run을 변경하지 않는다.
4. 보조 채널에서 Telegram의 요청-only 경계와 Kakao `OPEN_DECISION / allowed=false`를 확인한다.
5. 상태 예시 선택으로 권한 없음·오류·결과 없음·오프라인을 전환한다. 해당 상태에서 명령은 차단된다.
6. 고위험 버튼은 재확인 dialog만 연다. 취소/Escape는 닫기만 하며 확인은 `HUMAN_APPROVAL_REQUIRED`를 표시할 뿐 실제 승인 증거를 생성하지 않는다. Tab/Shift+Tab 포커스 순환은 unit DOM boundary로 검증했다.

## 실제로 실행한 검증

- `node --test apps/web/tests/c28-console.test.mjs`: exit0, 32 PASS/skip0, 92.4529ms. 실제 reducer/render/mount 함수를 사용하며 DOM boundary fixture는 운영 브라우저 증거가 아니다.
- 관련 비네트워크 UI tests 포함: exit0, 41 PASS/skip0, 129.0994ms.
- JSON parse/4개 상대경로/GET 후보/PENDING binding 검증: exit0.
- `node --check` JS 및 test 각각 구문 통과. `git diff --check` exit0.
- 실제 browser load/render/screenshot/responsive pixel QA/Network 확인은 NOT_EXECUTED. standalone ES module의 로컬 file 로딩 정책과 preview hosting도 이 실행에서 검증하지 않았다. 기존 server route에 새 파일을 연결하지 않았다.

## 사용자 확인 증거 경계

사용자 확인 상태 `PENDING`; evidence_ref=null; confirmed_target_hash=null. 로컬 dialog 확인 클릭이나 Node PASS로 이 값을 바꾸지 않는다. Main은 아래 정확한 artifact hash를 검토 대상으로 제시하고 실제 사용자 확인 evidence를 별도로 확보한 뒤에만 C29 연결을 진행해야 한다. 본 문서에는 사용자 확인을 받았다는 주장이나 생성된 가짜 승인 ID가 없다.

| 대상 | SHA256 |
|---|---|
| mockup HTML | 12118D77CC0C66E22D15D90B5670CAFD5DA3A990A6DE7A6579E3FEAE81850706 |
| interaction JS | A64E11E2C4FE7265D6E413656F244CFD9267F9CBF485D04D8E4C205ED5380AED |
| styles CSS | 7BC97363164528121AEE800AC9BAE0BF50791D1C8EF0136A826CBFCE93583A43 |
| interaction contract JSON | 2A1E5473B85B0D2AC4826B37C1CCF3B35082E56DF3F8C02C70950572E50FE9E8 |

실제 BFF/API/HTTP/DB/WSL/Provider/Telegram/Kakao/Oracle/deploy는 NOT_EXECUTED. E2E 연결과 외부 권위 검증은 후속 소유자 영역이다.
