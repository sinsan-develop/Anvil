# F-20/U-01 R33 운영 카드 화면 절편 계획

> 승인된 설계 §29.2와 작업계획 U-01의 화면 구조를 기존 Console에 연결한다. R32 close seq1992/no-lease와 `codex/f18-wsl-ops`를 기준으로 하며 유효한 새 dual lease 전 제품 write를 금지한다.

## 목표와 경계

Dashboard의 2행에 설계서 순서대로 `실행 중`, `승인 대기`, `BLOCKED`, `필수 Gate 미통과`, `예상 비용 초과`, `baseline 충돌` 여섯 카드를 표시한다. 현재 공개 Dashboard 응답에는 이 카드들의 신뢰 가능한 수치 계약이 없으므로 각 카드는 `UNAVAILABLE`과 미연결 이유만 표시한다. 숫자 0, 성공률, 진행 상태, 상세 링크 또는 클릭 동작을 만들어 내지 않는다. 기존 Health·Next Actions·Critical Alerts, 같은 origin API 호출·권한 실패 처리에는 영향을 주지 않는다.

R12/R16/R17/R18의 `ScopedRunStatusSummary`는 project/environment 범위의 내부 Run 집계지만 아직 Dashboard 공개 응답에 없다. Queue/Worker 배열을 Run 수치로 대체하지 않는다. 이 절편은 공개 API/데이터 계약·DB schema/지속 데이터·인증/권한/Secret·비용/운영 배포를 바꾸지 않는다. 세 Run 운영 카드의 실제 수치 연결과 나머지 세 카드의 별도 소스 정의는 다음 절편으로 남긴다.

## 구현·검증 순서

1. 단일 Developer가 `apps/web/tests/f15-console.test.mjs`에 실제 Console 2행의 정확한 여섯 제목·순서·`UNAVAILABLE`·가짜 숫자/링크 부재 및 기존 섹션 유지 테스트를 먼저 추가해 RED를 확인한다.
2. `apps/web/src/console/App.tsx`에서 기존 한 줄 미연결 설명을 여섯 개 의미 있는 카드로 바꾸되 기존 `DASHBOARD_OPERATION_DEFINITIONS` 순서를 재사용한다. 1920×1080과 반응형은 현 `status-grid`를 사용하고 CSS 재설계는 하지 않는다.
3. `tests/browser/f20-u01-oidc-browser-pg15.mjs`의 기존 OIDC/HTTPS/Chromium 실제 Dashboard 검사에 카드 여섯 개·비가용 표현과 값/링크 비노출 단언을 추가한다. 새 증거 key·PNG/Network 계약을 만들지 않는다.
4. 로컬 console 전체, browser 문법/audit, web typecheck/lint/build, Python 관련 비 opt-in, G-05와 diff 검사를 실행한다. Main은 exact diff를 독립 검토하고 기존 branch checkpoint/private push 뒤 WSL-server 동일 clean SHA의 격리 PG15/OIDC/HTTPS/Chromium/browser/Network를 확인한다. 임시 자원은 생성 전 이름·수명·정리 방법을 WORK_STATUS에 기록하고 종료 시 잔여0을 확인한다.

## 인수 한계와 rollback

R33은 화면 골격·정직한 미연결 상태의 절편 증거만 제공한다. 여섯 수치의 실제 read model, 필터, Critical 확인, 독립 U-01 acceptance, F-20 최종 검증은 완료로 판정하지 않는다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다. 회귀 시 R33 제품 파일만 정상 Git revert하고 append-only Event prefix와 R32 결과를 보존한다.
