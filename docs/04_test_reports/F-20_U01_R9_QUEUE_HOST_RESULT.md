# F-20/U-01 R9 Queue source host 결과

## 판정

`COMPLETED` — WorkInstruction의 로컬 내부 연결 범위 구현·기본 검증 완료 주장. Main 독립 검토, 동일 SHA WSL-server PostgreSQL 15 실제 검증, API·브라우저·U-01/F-20 수락은 아직 수행하지 않았다. C30 `OPEN_BLOCKING`, ReleaseDecision `DEFER` 유지.

## 기준과 변경

- 시작: `codex/f18-wsl-ops`, `c6eba4676db1ba5b42ca3bdffbbb3982d197ac13`, `development/codex/f18-wsl-ops` 동일, 제품 변경 전 clean. G-05 seq1846 PASS. epoch22 `developer-primary-f20-u01-r9` worker/write dual lease ACTIVE, exact5 경로.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`, 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`, 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`, 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`, 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`, R9 계획 `DC703FBDAD5ADA1C20F6E8657A000C9F3539F0F1FD6F7263CC72AAC590CD1919`, WI `7D1F8DE6CF047AEF5632D9B6A491E5FC1DA1FF026EDA43E2C0E4A45EDDD8BC3A`, Invocation `0FAA588A4B5A2762113ACE9BADCBEFD8B0F76342D4D71090977C0482182C7F39`.
- `packages/observability/service.py`: 선택적 trusted loader를 `snapshot()`와 명시적 `detect()` 시점마다 호출. invalid/legacy/DB/limit을 안정적 Queue 오류로 차단하고 기존 고정 source·alert/audit GET는 유지.
- `apps/api/anvil_api/oidc_process.py`: 기존 Engine과 인증 trust의 고정 project/environment만 캡처해 R8 bounded read-only Queue source를 요청 시점에 로드. bootstrap 1회 snapshot·새 공개 endpoint 없음.
- `tests/observability/test_f20_u01_r9_queue_host.py`, `tests/api/test_f20_u01_r9_oidc_queue_host.py`: fresh 2회, 명시 detect, scope, legacy/DB/limit/format fail-closed, health UNKNOWN, GET audit/alerts 무변경 검증.
- 제품 exact5 외의 현황 파일 `docs/WORK_STATUS.md` 변경은 Main 소유이며 Developer가 수정하지 않았다.

## 검증 증거

| 명령·환경 | 실제 결과 |
|---|---|
| `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r9_dev tests\observability\test_f20_u01_r9_queue_host.py tests\api\test_f20_u01_r9_oidc_queue_host.py` 구현 전 | 예상 RED `7 failed`, exit 1: `source_loader` 미지원 및 Queue 연결 부재 |
| 동일 명령 구현 후 | `7 passed in 1.01s`, exit 0 |
| `.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r9_dev tests\observability\test_f20_u01_r9_queue_host.py tests\api\test_f20_u01_r9_oidc_queue_host.py tests\observability\test_f13_operations.py tests\api\test_f13_operations_api.py tests\api\test_oidc_process.py tests\api\test_oidc_asgi_binding.py` | 최종 `89 passed, 1 skipped in 4.96s`, exit 0. Skip은 기존 opt-in PostgreSQL 15 OIDC 통합 검증이며 PASS로 계상하지 않음 |
| `.venv\Scripts\python.exe -B scripts\check_project_progress.py` | 임시 pytest base 존재 중 `F20_U01_R9_GIT_INVALID` exit 1; 정확한 base 제거·잔여0 뒤 `G-05 ... PASS sequence=1846 reporting=AUTO_CONTINUE`, exit 0 |
| `git diff --check` | exit 0 |

로컬 임시 base `D:\Project\Anvil\.worktrees\anvil-f18-wsl-ops\.pytest_tmp_f20_u01_r9_dev`는 Main이 생성 전 부재·소유·수명을 `WORK_STATUS`에 기록했다. 종료 후 실경로 worktree 내부, root non-reparse, 내부 link 13개 모두 base 내부, Python/pytest process 0을 확인한 다음 정확한 base만 제거했고 잔여 0이다. 새 DB/container/port/외부 자원 생성 0. 테스트용 합성 trust/secret·Queue 자료는 pytest base와 함께 제거됐다.

## 영향·미검증·다음 조치

- 고정 source 주입과 기존 GET `/api/operations/alerts`, `/api/operations/audit`의 권한·경로·읽기 계약은 변경하지 않았다. loader 실패는 빈 Queue 성공으로 내려가지 않으며 내부 SQL/credential/payload/fencing token을 오류 문자열로 반영하지 않는다. Queue health는 별도 신호가 없어 `UNKNOWN`이다.
- 실제 PostgreSQL 15 두 시점 fresh read, legacy/100건/DB 오류, 실제 OIDC host/API/브라우저, 정식 E-SHOT/E-NET, 전체 회귀는 미검증이다. 로컬 unit/API fixture PASS를 실제 DB·화면·운영 PASS로 승격하지 않는다.
- 정식 Developer 동일 실패 0회. 예상 TDD RED와 테스트 임시 경로 때문에 발생한 G-05 일시 invalid는 제품 정식 실패가 아니며 정리 후 해소했다.
- Main이 exact5 diff/독립 검토 후 필요하면 이 lease 안에서 보완하고, 안전한 commit·사설 push → WSL-server 격리 checkout 동일 SHA 실제 PostgreSQL 15 검증을 수행한다. `main` 병합·신규 branch·ysna/Production 작업은 수행하지 않는다.
- rollback: Main이 lease를 회수하고 제품 변경을 commit하지 않은 상태면 해당 exact5의 현재 diff를 개별 확인해 보존/복구한다. 안전 commit 후에는 그 제품 commit의 정상 `git revert`를 별도 검증한다. 파괴적 reset/clean/force push는 사용하지 않는다.
