# F-20/U-01 R22 독립 조회 LOADING 결과

## 판정

`COMPLETED` — R22 exact3 범위의 로컬 구현과 검증 완료. U-01 전체 인수, 브라우저 E-SHOT/E-NET, F-20 Gate 및 C30 해소 판정은 아니다.

## 시작 기준·권한

- Windows local worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, 시작 HEAD `6507a9625c06162fd034f0112da04ac37fb4c1b8`, 시작 `git status --short` clean. lease의 `baseline_git_commit`/`dispatch_head`인 `9f643bdeafa73967fdbb4dcadd7b18defd092cec`는 seq1930 Event 발급 직전 통제 commit이며 실제 시작 HEAD의 직계 선조다(`git merge-base --is-ancestor` exit 0). 시작 G-05는 canonical seq1930 PASS.
- worker `worker-lease-f20-u01-r22-r22load0110` / execution fence `f20-u01-r22-execution-fence-epoch-36-r22load0110`, write `write-lease-f20-u01-r22-r22load0110` / write fence `f20-u01-r22-write-fence-epoch-36-r22load0110`: progress/HANDOFF 모두 ACTIVE, exact3 scope, 만료 2026-10-01T07:48:57Z. 작업 시작 현지시각 04:52 KST에 유효함을 확인했다.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R22 계획 `03B54EF4880DA9708A322DDCEC52CE39439A7CCFB7AB7D8B59DB4FA8C142BC46`; WorkInstruction `63A1B586CE26E14815505022EF9961DA97E8EA4826AFC57527D58CEC7790A5C5`, Invocation `8148B09251D374F945DEDDBD63BE11F70B50FECA5952DCFF256C27755C8B0C6F`.

## 변경·기능 유지

- `apps/web/tests/f15-console.test.mjs`: 첫 렌더 Provider/Alerts, Database readiness/Operations 응답 양 순서, readiness 실패 후 `NOT CONNECTED`와 대기 중 실패·0건 오표시 금지 assertion 추가. 기존 SSR 기대값 두 곳을 요청 전 `LOADING`으로 갱신했다.
- `apps/web/src/console/App.tsx`: Provider/Alerts 초기 상태와 대기 렌더를 `LOADING`으로 분리했다. Database에는 readiness 미완료 입력을 추가해 대기→준비 실패/성공→Operations 대기/완료 순으로 표시한다. 응답 완료 후 기존 분류, same-origin 네 요청 및 응답 shape, 권한·오류 본문 비노출, 다른 메뉴는 유지한다.
- 새 endpoint, DB, Provider 외부 호출, 운영 변경 없음. 기존 카드의 직접 settled 렌더와 로더 오류/거부 회귀는 console 전체 테스트로 확인했다. 브라우저 실동작·Network 관측은 Main 후속 범위다.

## RED → GREEN 및 실행 결과

모든 명령은 위 시작 HEAD의 Windows local 작업트리에서 실행했다. RED는 의도한 assertion 실패이며 정식 `FAILURE_REPORT` 오류가 아니다.

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `node --import tsx --test --test-name-pattern='independent Provider\|Database distinguishes' tests/f15-console.test.mjs` (`apps/web` cwd) | 1 | 새 2개 모두 예상 RED: Provider가 `UNAVAILABLE`, Database가 `NOT CONNECTED` 표시 |
| 위 집중 명령 재실행 | 0 | 2 PASS, 0 fail |
| `npm run test:console` (`apps/web` cwd) | 1 | 첫 전체 실행 46 PASS/1 fail; 기존 Critical Alerts SSR 기대값이 `UNAVAILABLE`이어서 실패. 기대값 갱신 |
| `npm run web:test` | 0 | console 47 PASS/0 fail |
| `npm run web:typecheck` | 0 | TypeScript 오류 없음 |
| `npm run web:lint` | 0 | 3 files, fixes 0 |
| `npm run web:build` | 0 | Vite 20 modules 변환·bundle 생성 |
| `.\.venv\Scripts\python.exe scripts/check_project_progress.py` | 1 | build 출력 `apps/web/dist`가 남아 `F20_U01_R22_GIT_INVALID` (제품·원장 결함 아님) |
| 정확한 `apps/web/dist` 제거 후 같은 G-05 명령 | 0 | `PASS sequence=1930 reporting=AUTO_CONTINUE` |
| `git diff --check` | 0 | whitespace 오류 없음 |

## 잔여·인계

- 임시 출력 `apps/web/dist`는 실행 전 부재를 확인했다. 빌드 후 절대경로가 worktree 내부의 정확한 경로임을 확인하고 root 및 하위 reparse point 없음 확인 후 그 경로만 제거했다. 잔여 0. 별도 container/DB/WSL/port/Secret/외부 자원 생성 0.
- Main이 exact3 diff 독립 검토, Git commit/private push, WSL-server 동일 SHA Node QA, control/progress/HANDOFF/WORK_STATUS 및 dual lease 회수를 소유한다. Developer는 해당 경로와 Git/WSL을 변경하지 않았다.
- 미검증: 실제 브라우저 클릭·Network E-SHOT/E-NET, WSL 동형 QA, 실제 API·DB·Provider·운영. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, F-20/U-01 미수락 유지.
- rollback은 R22의 위 exact3 변경만 되돌려 기존 R21 상태로 돌아가는 것이다. Main은 commit 전 diff 확인 후 경계에 맞게 수행한다.
