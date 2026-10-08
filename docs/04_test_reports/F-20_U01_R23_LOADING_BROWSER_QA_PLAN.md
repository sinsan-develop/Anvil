# F-20/U-01 R23 초기 LOADING 브라우저 QA 계획

## 판정·목적

`PLAN_READY_NOT_EXECUTED`. R21~R22의 Node/SSR 회귀는 Dashboard 독립 조회의 초기 `LOADING`을 확인했지만 실제 Chromium 화면·키보드·Network 증거는 아니다. 기존 R20의 PG15/OIDC/Chromium 하네스에서, 승인된 U-01 loading·접근성 계약 중 초기 조회 상태를 좁게 검증한다. U-01 전체 인수나 F-20 최종 검증으로 승격하지 않는다.

## 기준과 파일 경계

- 기존 단일 branch `codex/f18-wsl-ops`, 계획 시작 clean HEAD `87b39000eb8f1a363018a57a865e93e966089863`; 로컬 G-05 `PASS sequence=1932 reporting=AUTO_CONTINUE`, worker/write lease 없음. WSL-server 격리 QA checkout `/tmp/anvil-u01-r8-qa-360880a`도 같은 SHA·clean이며 캐시 `postgres:15`와 Playwright 1.62.1 이미지가 있다. C30은 `OPEN_BLOCKING`, ReleaseDecision은 `DEFER`다.
- 후속 단일 Developer의 테스트·결과 exact3: `tests/browser/f20-u01-oidc-browser-pg15.mjs`, `tests/integration/test_f20_u01_oidc_browser_pg15.py`, `docs/04_test_reports/F-20_U01_R23_LOADING_BROWSER_QA_RESULT.md`. 제품 UI/API·DB schema·인증/권한·Secret·기존 R20 증거 원본은 바꾸지 않는다. Main은 WorkInstruction, lease, control/progress/HANDOFF/WORK_STATUS, Git 및 WSL 검증을 소유한다.

## 검증 방법과 완료 조건

1. 기존 HTTPS same-origin/OIDC/PG15 격리 경로의 첫 Dashboard navigation에서 Provider, Critical Alerts, readiness, Operations 네 요청을 브라우저 라우팅으로 잠시 보류한다. 실제 DOM의 Health 여섯 카드·Next Actions·Critical Alerts가 요청 전 `LOADING`을 표시하고 실패·0건·READY/HEALTHY를 조기 주장하지 않으며 `aria-live` 설명을 유지하는지 확인한다. 요청은 정확한 네 경로만 각각 해제하고 응답 완료 뒤 기존 정상·권한거부 분류와 R20 저장 alert→Next Actions→철회 흐름을 재검증한다. 테스트 조작은 브라우저 QA에만 존재하며 제품 코드로 들어가지 않는다.
2. 실제 키보드 `Tab`/`Enter`로 Dashboard 메뉴의 포커스 및 사이드바 접기/펼치기 `aria-expanded` 변경을 확인한다. 이 범위는 기본 경로의 키보드 증거이지 U-01 전체 키보드·접근성 인수가 아니다. 화면 1920×1080, 앱 요청 same-origin, 비밀·내부 주소 노출 0을 기존 하네스와 함께 확인한다.
3. Developer는 하네스 자기검증의 예상 RED→GREEN, Python 비 opt-in, console 전체, typecheck/lint/build, G-05·diff check와 정확한 결과를 기록한다. Main은 diff·로컬 회귀를 독립 확인하고 기존 사설 branch에 안전한 commit/push 후 WSL-server 기존 격리 checkout에서 동일 SHA의 실제 PG15/OIDC/Chromium opt-in을 실행한다. 실제 브라우저 PASS는 WSL 동일 SHA와 Network·DOM·키보드 결과 및 임시자원 정리까지 확인한 경우에만 기록한다.
4. 임시 PG, browser/Node 컨테이너, 전용 venv·pytest base·증거 폴더·TLS 파일·checkout 빌드 출력은 실행 전 정확한 이름·부재·환경·수명·정리 방법을 WORK_STATUS에 사전 기록한다. 실패해도 신원/실경로/link·활성 프로세스를 확인해 전용 자원만 정리하고 잔여 0을 기록한다. 공유 `/srv`·정식 DB·다른 프로젝트·`ysna-server`/Production은 건드리지 않는다.

## 고정 경계·잔여

- 본 R23은 초기 loading·기본 키보드·기존 R20 흐름의 회귀만 판정한다. U-01의 empty/error/blocked/quota/cancel/reconnect 전량, Project/Environment/기간 필터·새로고침, 운영 상태 Run/승인/비용 공개 read model, 전체 E-SHOT/E-NET/E-API/E-EVT, 독립 Tester acceptance는 여전히 별도 미충족이다.
- 공개 API·데이터 계약 연결, C30 원장 사고 복구, F-20 최종 WSL 검증, `main` 병합·새 branch·Oracle/`ysna-server`/Production 작업은 이 단위에 포함하지 않는다.
- 회귀 시 R23 테스트 exact2와 결과 문서만 되돌린다. 제품·DB 지속 데이터 rollback 대상은 없다.
