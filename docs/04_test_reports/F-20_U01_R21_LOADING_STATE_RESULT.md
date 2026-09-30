# F-20/U-01 R21 Dashboard 조회 중 상태 — Developer 결과

## 판정

`COMPLETED` (Developer 범위). Queue·Worker·Execution Backends·Artifact Store·Next Actions의 Operations snapshot 요청 전 표시를 `LOADING`으로 분리했다. F-20/U-01 인수 판정은 Main과 독립 검증 대상이며 C30 `OPEN_BLOCKING`과 ReleaseDecision `DEFER`는 유지한다.

## 시작 기준과 권한

- 작업자 `developer-primary-f20-u01-r21`; 시작 branch `codex/f18-wsl-ops`, HEAD `987d6237f05dc001c3f6999092ca346886232487`, predecessor `6272fab9948dd67b3756ecd7942dc15c78ccf8a5`, `git status --short --branch` clean. predecessor는 시작 HEAD의 ancestor(`git merge-base --is-ancestor`, exit 0).
- canonical `build-progress.json` seq1924 `ACTIVE`, `F20_U01_R21_LOADING_STATE_IMPLEMENTATION`; `BUILD_HANDOFF.md` 동일. worker `worker-lease-f20-u01-r21-r21load0110`/execution token `f20-u01-r21-execution-fence-epoch-35-r21load0110`, write `write-lease-f20-u01-r21-r21load0110`/write token `f20-u01-r21-write-fence-epoch-35-r21load0110`, 모두 epoch35 `ACTIVE`, 만료 `2026-10-01T07:15:12+00:00`로 착수 시 유효, actor·subject·exact3 경로 일치.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R21 계획 `45C570BAEC2E9D139FD257B36D4CEC0569619D34D5CEA8032E029B5BB3FB5A20`; WorkInstruction `86AEB545B0CAEE3737A76BCD00359F4D93AA26F2E761E1444BC442B1DE5D5A3D`; Invocation `EE0A14AC4D07E5B87598FCC0FDCDEC67021262D2AA17239348EA7F88513E3BBA`. 실제 파일 hash·canonical 등록값 일치.
- 착수 G-05 `.\.venv\Scripts\python.exe scripts/check_project_progress.py` exit 0, `PASS sequence=1924 reporting=AUTO_CONTINUE`. 시스템 `python scripts/check_project_progress.py`는 Python 명령 부재로 exit 1이었고 전용 `.venv` 명령으로 해결했다. 제품·원장 오류나 정식 동일 실패는 0건.

## 변경 전후와 검증

- `apps/web/tests/f15-console.test.mjs`: SSR 첫 렌더와 각 카드 직접 렌더에서 다섯 카드의 `aria-live`, `LOADING`·조회 중 설명, 실패/건강/0건 표시 부재를 단언했다. 기존 SSR 기대값도 요청 전 상태로 갱신했다. 기존 테스트의 `LOADED`/`BLOCKED`/`UNAVAILABLE` 및 응답 본문 비노출 검증은 보존했다.
- `apps/web/src/console/App.tsx`: `DashboardQueueState`와 Next Actions 상태에 `LOADING`을 추가하고 Shell의 Operations snapshot 초기값만 `LOADING`으로 변경했다. 세 카드 렌더 분기에 조회 중 설명을 넣고 대기 상태에는 실패 CSS class를 적용하지 않았다. 응답 완료 시 기존 `loadDashboardQueue` 분류, same-origin URL `/api/dashboard/operations`, Database readiness·Provider·Alerts·다른 메뉴는 변경하지 않았다.
- `docs/04_test_reports/F-20_U01_R21_LOADING_STATE_RESULT.md`: 이 결과와 인계 범위 기록.
- RED 1: `node --import tsx --test --test-name-pattern='Dashboard pending operations read' tests/f15-console.test.mjs` (`apps/web`), exit 1. Queue가 `LOADING` 값에도 “상태 정보를 확인할 수 없습니다”로 표시됨. RED 2: 같은 명령 exit 1, `LOADING`에 실패 CSS class가 남음. 구현 후 집중 테스트 exit 0, 1 PASS.
- 최종 `npm run web:test` exit 0, console 45 PASS; `npm run web:typecheck` exit 0; `npm run web:lint` exit 0, 3 files/no fixes; `npm run web:build` exit 0, 20 modules; `.\.venv\Scripts\python.exe scripts/check_project_progress.py` exit 0, G-05 seq1924 PASS; `git diff --check` exit 0. 모두 Windows local의 위 시작 HEAD 작업트리에서 실행.

## 영향·미검증·정리·인계

- 영향은 Dashboard Operations snapshot 요청 전의 다섯 카드 표시로 제한된다. 기존 console 전체 회귀 45 PASS는 API/DB·브라우저 실제 Network·WSL·운영 통과 증거가 아니다.
- 미검증: 실제 브라우저 E-SHOT/E-NET/E-API와 키보드·7상태 전체, WSL-server 동일 SHA, 독립 Tester, U-01/F-20 Gate, Production. Main이 exact3 diff 검토, Git commit·push, WSL-server 검증, progress/HANDOFF/WORK_STATUS·lease 회수를 소유한다. Developer는 이 파일들을 수정하지 않았다.
- build 전 `apps/web/dist` 부재를 확인했다. 최종 build 후 절대 경로 `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\apps\web\dist`와 reparse 아님을 확인하고 해당 빌드 출력만 삭제, 잔여 0. 새 DB·container·server·네트워크 임시자원 생성 0.
- rollback: Main이 이 R21 exact3 diff만 되돌리면 이전 초기 `UNAVAILABLE` 표시와 R20 동작으로 돌아간다. Developer는 Git 복구·commit·push를 실행하지 않았다.
