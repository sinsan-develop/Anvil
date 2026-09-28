# F-20/U-01 R1 Database readiness 로컬 구현 결과

## 판정 → 판단 이유 → 조치

- **판정:** `COMPLETED_LOCAL_MAIN_REVIEW_PENDING`. 지정 exact3 중 제품 코드·테스트·이 보고서만 작성했다. U-01 전체 `ACCEPTED` 또는 F-20 수락 판정이 아니다.
- **판단 이유:** `0019_oidc_sessions`와 기존 `0016_operations_recovery`의 `status=ready`만 Database `READY`로 분류하고, 화면에 응답에서 확인한 실제 head를 표시한다. `0013_task_bootstrap_authority`, unknown, `not_ready`, null은 `NOT CONNECTED`다. 기존 same-origin `/api/health/ready` 요청은 유지했다. 로컬 Node 테스트·web typecheck·lint·build·G-05가 아래 범위에서 통과했다.
- **조치:** Main의 독립 diff·회귀 검토 후 같은 branch에서 commit/push하고, Main이 WSL-server의 정확한 SHA에서 실제 API/DB/브라우저·Network와 동일 테스트/빌드를 검증한다.

## 기준선과 쓰기 권한

| 항목 | 시작 시 관찰값 |
| --- | --- |
| 작업 | `F-20/U01-R1`, `WI-F-20-U01-R1-20260928-001` |
| checkout·branch | `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, `codex/f18-wsl-ops` |
| 시작 HEAD | `a20fae85734f8182eb175cd9b2d392dea3819c74` |
| 시작 status | `docs/WORK_STATUS.md` 수정 1건(Main 소유); 제품 exact3은 clean |
| 설계·계획 SHA-256 | `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712` / `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB` |
| 매트릭스·테스트계획 SHA-256 | `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6` / `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014` |
| 운영규칙 SHA-256 | `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0` |
| WI·Invocation SHA-256 | `034A0697B72B347190405AEE9709D8FC0CA2287CE16968818C3DB73E6AC01615` / `BC889BB504AAF664A748EBB1DD0697D0460951D78F7109030EC4A7244FD23610` |
| canonical Event | seq1771 `WORK_INSTRUCTION_ISSUED`, seq1772/1773 worker/write 발급, seq1774 재개. 시작 G-05 `PASS sequence=1774` |
| epoch10 worker/write | 둘 다 `ACTIVE`, 만료 `2026-09-29T03:21:00+09:00`; execution fence `f20-u01-r1-execution-fence-epoch-10-9c5a60a8951c`, write fence `f20-u01-r1-write-fence-epoch-10-9c5a60a8951c`; 동일 exact3 scope |

Lease의 `dispatch_head=b013b21c5de08d5528625f6cd93d5a7854665fc8`은 발급 직전 기준선이고 현재 HEAD `a20fae8`은 발급 Event·lease를 commit한 직계 후손이다. Main은 이 역사 기준선 해석을 확인하고 제품 write를 지시했다. WI/Invocation의 `DRAFT` 안내 문구는 발급 전 조건이며 canonical seq1771 발급으로 충족됐다. 이 해석이 잘못됐다면 lease 검증과 제품 작업 재검토가 필요하다.

## 변경 diff와 회귀

- `apps/web/tests/f15-console.test.mjs`: 0019 READY 및 기존 0016 READY, 0013/unknown/not_ready/null fail-closed를 검증한다. 실제 Database 카드의 0019·0016 표시와 unknown의 미연결 화면을 서버 렌더링 결과로 검증한다.
- `apps/web/src/console/App.tsx`: `classifyReadiness`에 정확한 0019 head를 추가한다. Database 카드는 동일 응답 payload로 상태와 실제 확인 head를 그리며, 나머지 카드의 `UNAVAILABLE` 표시는 유지한다. 사용하지 않는 React default import를 제거해 lint 경고를 해소했다.
- 이 결과보고서 외 제품/API/DB/auth·다른 메뉴·통제 원장 파일은 수정하지 않았다. 기존 `docs/WORK_STATUS.md` dirty는 Main 소유이며 이 결과의 diff에 포함하지 않는다.

## 로컬 실행 증거

| 순서 | 정확한 명령 | exit·관찰 결과 |
| --- | --- | --- |
| 착수 G-05 | `.\.venv\Scripts\python.exe scripts/check_project_progress.py` | 0, `PASS sequence=1774 reporting=AUTO_CONTINUE` |
| RED | `npm run test:console --workspace @anvil/web` | 1, 2 passed/2 failed. 0019 분류의 실제 `NOT CONNECTED` 대 기대 `READY`; Database 카드 구현 부재를 확인 |
| GREEN | `npm run test:console --workspace @anvil/web` | 0, 4 passed/0 failed/0 skipped |
| web typecheck | `npm run typecheck --workspace @anvil/web` | 0, TypeScript 오류 없음 |
| web lint | `npm run lint --workspace @anvil/web` | 0, 3 files 검사, 경고 없음. 첫 실행의 기존 React unused import 경고 1건은 제거 후 재실행 |
| web build | `npm run build --workspace @anvil/web` | 0, Vite 20 modules 변환. 최종 import 정리 후 재실행한 결과 |
| 빌드 후 G-05 | `.\.venv\Scripts\python.exe scripts/check_project_progress.py` | 첫 실행 exit1 `F20_U01_R1_GIT_INVALID`: build가 생성한 untracked `apps/web/dist/`가 exact3 밖이었다. 생성 전 status에 없던 산출물임을 확인하고 해당 경로만 정리 후 exit0, `PASS sequence=1774 reporting=AUTO_CONTINUE` |
| diff 검사 | `git diff --check` | 0 |

`apps/web/dist/`는 이 실행의 빌드 산출물 3개 파일만 확인하고 정리했으며 현재 경로가 없다. 전체 Python 프로젝트 suite, 실제 브라우저·Network, 격리 PostgreSQL/API, WSL-server exact SHA, Production은 이 writer가 실행하지 않았다. 로컬 컴포넌트 렌더링 테스트를 실제 브라우저·DB 응답 증거로 승격하지 않는다.

## 남은 경계와 rollback

- Main의 WSL-server 동일 SHA 검증에서 실제 `status=ready/migration_head=0019_oidc_sessions`와 `503/not_ready` 응답, Dashboard 카드·same-origin Network 및 화면을 확인해야 한다. 이 결과의 API/브라우저 증거는 `NOT_EXECUTED`다.
- C30 CRITICAL 원장 사고는 `OPEN_BLOCKING`, release 결정은 `DEFER`다. R1 GREEN은 이를 해소하거나 U-01/F-20을 수락하지 않는다. `ysna-server`/Production 작업은 범위 밖이다.
- rollback은 Main이 이 slice만 담아 만든 commit을 정상 `git revert`하고 Node 테스트·web 검사·G-05를 재검증하는 것이다. 기존 dirty `docs/WORK_STATUS.md`는 보존한다.
- canonical progress/HANDOFF 갱신, commit/push, write lease 회수는 Main 소유이며 이 writer는 수행하지 않았다. 정식 Developer 실패보고 0회다.
