# F-20/U-01 R17 scoped Run host binding 결과

## 판정

`COMPLETED` — WI exact4의 내부 Run summary host binding 구현과 로컬 집중·인접 검증 완료. 제품 commit/push 및 WSL 동일 SHA 검증은 Main 담당이다. 임시 pytest base 정리 후 G-05는 seq1894 PASS다.

## 기준·권한

- 담당: `developer-primary-f20-u01-r17`; 시작 branch `codex/f18-wsl-ops`, HEAD `eebc88ad0ce02ed6f4490f48a4d30c8273e7b8e1`; 시작 dirty는 Main 소유 `docs/WORK_STATUS.md`만 확인. 기존 dirty/untracked 수정·stage·reset 없음.
- 설계 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R17 plan `BBD343B3CB467B3D316525D379BE7FC9B35121ABB9CD6A624D50546358FD37D9`.
- canonical G-05 시작 `PASS sequence=1894`, exit 0. epoch30 worker `worker-lease-f20-u01-r17-r17run3009d` / execution fencing `f20-u01-r17-execution-fence-epoch-30-r17run3009d`, write `write-lease-f20-u01-r17-r17run3009d` / write fencing `f20-u01-r17-write-fence-epoch-30-r17run3009d`; 둘 다 `ACTIVE`, 만료 `2026-09-30T15:04:55+00:00`. 양 lease의 actor와 exact4 scope 일치 확인.

## 변경 exact4와 기능 유지

1. `packages/observability/service.py`: 선택적 Run loader와 내부 `run_summary()` 추가. 부재·loader 예외·결과 타입 불일치를 `RUN_SUMMARY_UNAVAILABLE`로 닫는다. 기존 Queue projection, alert, audit 경로는 이 loader를 호출하지 않는다.
2. `apps/api/anvil_api/oidc_process.py`: 기존 인가 scope와 Engine을 closure에 결박해 R12 read→R16 summary를 `run_summary()` 호출 때만 실행한다. scope 불일치는 DB 조회 전에 `RUN_SOURCE_SCOPE_INVALID`로 거부한다.
3. `tests/observability/test_f20_u01_r17_run_host_binding.py`: fail-closed, 지연 로드, scope 분리, 0건·혼합 상태, Queue snapshot/detect 불변 검증.
4. 이 결과보고서.

`OperationsSources`, 공개 Dashboard JSON/route, BFF/UI, 권한/Secret, DB schema/migration은 변경하지 않았다. 내부 Run 수치는 공개 화면 수치로 승격하지 않았다.

## 명령·실제 결과

- RED: `.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r17_dev tests/observability/test_f20_u01_r17_run_host_binding.py -q` → exit 1, 3 FAIL(새 constructor/host 미구현). 구현 후 같은 명령 첫 실행은 테스트의 기존 Queue 빈 목록 오기대로 2 PASS/1 FAIL; 기존 Queue 행을 기대하도록 수정했다.
- GREEN 및 인접: `.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider --basetemp=.pytest_tmp_f20_u01_r17_dev tests/observability/test_f20_u01_r17_run_host_binding.py tests/persistence/test_f20_u01_run_read.py tests/observability/test_f20_u01_run_status_summary.py tests/observability/test_f20_u01_r9_queue_host.py tests/api/test_f20_u01_r9_oidc_queue_host.py tests/api/test_oidc_process.py tests/api/test_oidc_asgi_binding.py tests/api/test_f20_u01_r10_oidc_dashboard.py tests/api/test_f20_u01_r10_dashboard_api.py tests/observability/test_f13_operations.py tests/api/test_f13_operations_api.py -q` → exit 0, `144 passed, 1 skipped`(기존 opt-in PG 테스트).
- `.\.venv\Scripts\python.exe -B scripts/check_project_progress.py .` → 시작 exit 0/seq1894 PASS; pytest base 존재 중 `F20_U01_R17_GIT_INVALID`; base 정리 후 재검증 exit 0/seq1894 PASS. `git diff --check` → exit 0. exact4 외 Developer 변경 없음; Main의 `docs/WORK_STATUS.md` dirty는 제외.
- 임시 pytest base는 사전 기록된 worktree 내 `.pytest_tmp_f20_u01_r17_dev`만 사용. 실제 절대경로가 worktree 내부이고 root는 reparse point가 아님을 확인했다. 테스트가 만든 symlink만 먼저 제거하고, Python 프로세스 부재 확인 후 정확한 base만 제거했다. `Test-Path`는 `False`, 잔여 0. `Get-CimInstance` 프로세스 상세 조회는 접근 거부였고 `Get-Process python,pythonw` 조회에는 활성 결과가 없었다.

## 미검증·다음 조치·rollback

- 실제 PostgreSQL/WSL-server, API/browser Network, Production은 이 Developer 범위에서 `NOT_EXECUTED`; 전체 pytest도 실행하지 않았다. C30 `OPEN_BLOCKING`/ReleaseDecision `DEFER`, U-01/F-20 미수락과 main 미병합 유지.
- Main은 exact4 diff와 G-05의 Git checkpoint 조건을 검토하고 제품 commit/private push 뒤 동일 SHA G-05 및 WSL Python QA를 수행한다. progress/HANDOFF와 lease 회수는 Main 담당이다.
- rollback은 이 exact4의 제품·테스트·보고서 변경만 되돌리고 기존 Queue/OIDC 경로를 유지한다. Main 소유 status와 canonical Event/progress/HANDOFF는 건드리지 않는다.
