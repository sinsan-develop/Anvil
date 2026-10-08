# F-20/U-01 R22 독립 조회 상태 구현 계획

## 판정·목적

승인된 U-01 Dashboard의 `loading` 계약을 Provider, Critical Alerts, Database의 독립 요청에도 적용한다. R21은 Operations snapshot을 소비하는 다섯 카드만 보완했다. 현재 첫 렌더에서 Provider·Critical Alerts는 실제 응답 전 `UNAVAILABLE`, Database는 readiness 응답 전 `NOT CONNECTED`로 표시된다. 이는 요청 실패·미연결의 관측 결과가 아니라 초기값이다. 시작 기준은 `codex/f18-wsl-ops` clean `1060b47fff3bb4c352170c618ecce4b1b889f3a3`, canonical seq1926·dual lease null·G-05 PASS이며 console 45 PASS다.

## 파일 경계·설계

- 단일 Developer 제품/테스트/보고서 exact3: `apps/web/src/console/App.tsx`, `apps/web/tests/f15-console.test.mjs`, `docs/04_test_reports/F-20_U01_R22_INDEPENDENT_LOADING_RESULT.md`. Main은 control/progress/HANDOFF/WORK_STATUS/Git 및 WSL QA만 소유한다.
- Provider와 Critical Alerts의 초기 상태를 `LOADING`으로 둔다. 기존 각 요청이 완료된 뒤의 `VALID`/`LOADED`/`BLOCKED`/`UNAVAILABLE` 분류는 유지한다. `aria-live` 영역은 대기 중 `LOADING`과 짧은 조회 중 설명을 표시하고, 실패 CSS나 관측되지 않은 0건·정상 표시를 하지 않는다.
- Database는 readiness 요청 완료 여부와 기존 Operations snapshot 상태를 함께 본다. readiness가 미완료면 `LOADING`; 완료 후 준비 실패면 기존 `NOT CONNECTED`; 준비 확인 후 Operations 요청 중이면 `LOADING`; 두 요청이 완료되면 기존 Health signal 분류를 사용한다. 두 응답의 순서가 바뀌어도 확인 전 `READY`/`HEALTHY`를 주장하지 않는다.
- 기존 same-origin `/api/providers`, `/api/dashboard/alerts`, `/api/health/ready`, `/api/dashboard/operations` 요청, 응답 shape, 권한·오류 본문 비노출, 다른 메뉴는 변경하지 않는다. 새 endpoint·DB·공개 데이터 계약·Provider 외부 호출은 없다.

## RED→GREEN·검증

1. 기존 console 테스트에 첫 렌더의 세 카드, Provider/Alerts의 직접 `LOADING` 렌더, Database 두 독립 응답의 도착 순서와 readiness 실패 후 상태를 먼저 추가한다. 현재 코드에서 기대한 assertion 실패를 확인한다.
2. `App.tsx`의 초기 상태 union·표시 분기와 Database의 readiness pending 판별만 최소 수정해 GREEN으로 만든다. 기존 settled 분류·Network·거부/실패 회귀도 실행한다.
3. Developer 로컬 집중/console 전체/typecheck/lint/build/G-05/diff check 및 결과보고. Main은 exact3 diff와 회귀를 독립 확인한다. 기존 사설 branch에 안전한 commit/push 후 WSL-server 기존 격리 QA checkout의 동일 SHA에서 Node24 frontend 검증을 재현한다. 임시 자원은 생성 전 이름·수명·정리 방법을 WORK_STATUS에 기록하고 exact target만 정리한다.
4. 증거를 기록하고 dual lease를 write→worker 순서로 회수한다. 이 부분 구현을 U-01 전체 7상태·키보드·실제 브라우저 E-SHOT/E-NET·인수, F-20 Gate, C30 사고 해소로 승격하지 않는다.

## 고정 경계

C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락을 유지한다. 공개 API·데이터 계약·DB schema/지속 데이터·인증/권한·Secret·운영 배포는 변경하지 않는다. `main` 병합·새 branch·ysna/Production은 하지 않는다. 회귀 시 R22 exact3만 되돌리고 R21의 검증된 상태를 보존한다.
