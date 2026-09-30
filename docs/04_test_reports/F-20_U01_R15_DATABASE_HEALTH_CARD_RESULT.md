# F-20/U-01 R15 Database Health 카드 Developer 결과

## 판정

`COMPLETED` — 지정된 단일 Developer exact3 구현과 Windows 로컬 웹 검증을 완료했다. Main 독립 검토, 동일 제품 SHA의 WSL 검증, 실제 브라우저 E-SHOT/E-NET·DB health source·U-01/F-20 인수는 미실행이다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER`, Production `NOT_EXECUTED`를 유지한다. 유효한 동일 근본 원인 `FAILURE_REPORT`는 0회다.

## 기준과 착수 상태

- 작업/담당: `F-20/U01-R15`, `developer-primary-f20-u01-r15`. 시작 worktree `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops`, branch `codex/f18-wsl-ops`, HEAD `c08f9838192bff101eb06676e5b622e40f24dbdf`; `development/codex/f18-wsl-ops`도 같은 SHA. Lease baseline `2fe2c7c13a3cb17cc6892011c56f9353123d9696`는 HEAD 조상(`git merge-base --is-ancestor` exit 0).
- 시작 `git status --short`: Main 소유 `M docs/WORK_STATUS.md`만 존재. 제품 exact3은 clean이었고 해당 Main 파일 및 control/progress/HANDOFF는 보존했다.
- 권위 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`.
- R15 계획 SHA-256 `CCED2D0C0116D960FC8BBDC21156C04EC50183F255D88BFAD5B8110C0ED7FF78`; WI `80136398E837D1355AF644C7EEF400515FFF2CB0383D892FAA2C0BD4D24546A3`; Invocation `616E2BF6F121423EFE77CC35AC62D4C12B50978E26CD47D5C599DED7D8F5ECA5`. 실제 파일 hash가 모두 WI·Start Manifest와 일치했다.
- canonical progress/HANDOFF seq1882 `ACTIVE`, epoch28 worker/write lease 모두 actor `developer-primary-f20-u01-r15`, subject `F-20/U01-R15`, 만료 `2026-09-30T22:26:28+09:00`, exact3 path scope 일치. Worker execution token `f20-u01-r15-execution-fence-epoch-28-r15run3009b`, 종속 write token `f20-u01-r15-write-fence-epoch-28-r15run3009b`를 확인했다. G-05는 모듈 실행으로 `PASS sequence=1882 reporting=AUTO_CONTINUE`였다.

## 변경 전·후와 영향

| exact3 경로 | 변경 전 | 변경 후 |
|---|---|---|
| `apps/web/src/console/App.tsx` | Database 카드가 `/api/health/ready`의 migration readiness를 주 상태 `READY`로 표시 | 기존 단일 same-origin `/api/dashboard/operations` 응답의 `health.database`를 R14 7-field 규칙으로 별도 검증하고, readiness가 `READY`일 때만 `HEALTHY/LATE/EXPIRED/UNKNOWN` 또는 실패 상태를 주 상태로 표시. Migration head는 `API 준비 READY · Migration <head>`로 분리. |
| `apps/web/tests/f15-console.test.mjs` | readiness와 R14 세 카드·Queue 회귀 | 실제 loader와 카드 SSR에 정상/UNKNOWN·gap/준비 실패/malformed·미래/auth·전송, 비노출, R14 세 카드·Queue 보존 회귀 추가. 기존 readiness 테스트도 준비와 건강을 분리하도록 강화. |
| `docs/04_test_reports/F-20_U01_R15_DATABASE_HEALTH_CARD_RESULT.md` | 없음 | 본 증거·미검증·rollback 기록. |

Database row만 비정상이면 Database 카드만 `UNAVAILABLE`로 fail closed한다. Snapshot 자체 오류와 Operations 5xx/전송 실패는 `UNAVAILABLE`, Operations 401/403은 `BLOCKED`다. Readiness가 `READY`가 아니면 건강 신호에 관계없이 `NOT CONNECTED`다. 새 fetch/API/BFF route/공개 JSON field/DB·권한·Secret 변경이나 작동하지 않는 상세 링크는 없다. Worker/Execution Backends/Artifact Store, Queue 관측 수, Provider, Critical Alerts 경로는 유지했다.

## 로컬 실행 증거

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `& 'C:\Users\cyhuh\anaconda3\python.exe' -B scripts/check_project_progress.py .` | 1 | direct-path import 방식에서 기존 overlay module import 오류. 모듈 방식으로 재실행했으며 제품 실패 아님. |
| `& 'C:\Users\cyhuh\anaconda3\python.exe' -B -m scripts.check_project_progress .` | 0 | G-05 `PASS sequence=1882 reporting=AUTO_CONTINUE`. |
| `npm run web:test` (RED) | 1 | 39개 중 35 PASS/4 FAIL. 기존 readiness-only 카드가 건강·gap·malformed·auth 기대 상태를 표시하지 못함. |
| `npm run web:test` (첫 GREEN 및 최종 재실행) | 0 | 두 실행 모두 39/39 PASS, FAIL/SKIP 0. 마지막 실행은 테스트 보강 뒤 수행. |
| `npm run web:typecheck` | 0 | TypeScript noEmit PASS. 마지막 실행도 exit 0. |
| `npm run web:lint` | 0 | Biome 3 files checked, fixes 0. 마지막 실행도 exit 0. |
| `npm run web:build` | 0 | Vite 20 modules transformed, client build PASS. |
| `git diff --check` | 0 | whitespace/error 없음. |
| `git merge-base --is-ancestor 2fe2c7c13a3cb17cc6892011c56f9353123d9696 HEAD` | 0 | Lease baseline 조상 확인. |

`apps/web/dist`는 build 후 이 worktree 아래의 정확한 경로·자식 파일과 reparse point 부재를 확인하고 해당 생성물만 삭제했으며 잔여 `False`다. Node 프로세스 command line 조회(`Get-CimInstance`)는 권한 거부였고 `Get-Process -Name node`로 프로세스 목록을 확인했다. 기존 `node_modules` 및 다른 Node 프로세스는 건드리지 않았다. `.pytest_tmp_f20_u01_r15_dev`는 생성하지 않았고 잔여 `False`다.

## 미검증·다음 조치·rollback

- Node fixture/SSR와 로컬 정적 build는 실제 브라우저 Network, 실제 DB health source·Provider, WSL 동일 SHA, 배포 또는 사용자 인수 증거가 아니다. E-SHOT/E-NET·운영 유사 검증·U-01/F-20 acceptance는 Main·독립 Tester 후속 절차로 남긴다.
- Developer는 commit/push/PR/merge, WSL-server/Docker/DB, ysna/Production 작업을 실행하지 않았다. Main은 exact3 diff와 로컬 회귀를 독립 검토하고 동일 제품 SHA를 WSL에서 확인한다. progress/HANDOFF/WORK_STATUS의 통제 갱신은 Main 소유다.
- 회귀 시 R15 제품 exact2(`App.tsx`, `f15-console.test.mjs`)의 diff만 제거해 R14 제품 상태로 되돌리고, 본 결과와 실패 근거는 보존한다. Main 소유 dirty `docs/WORK_STATUS.md` 및 control/progress/HANDOFF는 rollback 대상이 아니다.
