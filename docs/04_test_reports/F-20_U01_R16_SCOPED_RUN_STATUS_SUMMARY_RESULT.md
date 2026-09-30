# F-20/U-01 R16 scoped Run 상태 요약 — Developer 결과

## 판정

`COMPLETED` — R16 제품 exact3의 로컬 구현·기본 검증 완료 주장이다. Main 독립 검증·WSL 동일 SHA QA·U-01/F-20 acceptance는 아직 수행되지 않았다. 정식 `FAILURE_REPORT` 0회.

## 기준·착수

- 담당: `developer-primary-f20-u01-r16`; branch `codex/f18-wsl-ops`; 착수 HEAD `a095060dc40ac30176155d140a406ec0daef42b0`, upstream `development/codex/f18-wsl-ops`도 동일 SHA. Lease 기준 `609a43562ec6f18434523beb5db04a9e661a70ff`는 HEAD의 조상(`git merge-base --is-ancestor` exit 0).
- 착수 `git status --short --branch`: Main 소유 `docs/WORK_STATUS.md`만 modified. 세 제품 파일은 없었다. 기존 dirty 파일은 수정·stage·reset하지 않았다.
- 설계 SHA-256 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 작업계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; R16 계획 `6181D8E511329D5FEF87150933B546878FA9DF40792FAC6B1C6EAA5CB2EE5A73`. 모두 WI 기재값과 일치.
- WI SHA-256 `F40D87E23B04B56809A146743658310258461C7D96529168CE4F4D27F6E7658A`; Invocation `DAF11BC9EF70F7FEC8A671FE1257B55A1D7A647001F83857A44F7DB9602F5508`. Start manifest 기재값과 일치.
- Canonical seq1888, epoch29 ACTIVE worker/write actor `developer-primary-f20-u01-r16`, 종속 execution/write fencing token, exact3 path scope, 만료 `2026-09-30T14:15:18+00:00` 확인. 착수 G-05 `PASS sequence=1888 reporting=AUTO_CONTINUE`.

## 변경과 영향

- `packages/observability/run_status_summary.py` 신규: 정확한 `ScopedRunSource`만 검증하고 `ACTIVE`, `WAITING_APPROVAL`, `BLOCKED`를 각각 집계하는 순수 함수와 frozen 5필드 결과. 100행 초과·중복·ID/행 불일치·잘못된 타입/enum/시각/version은 `RUN_STATUS_SUMMARY_UNAVAILABLE`로 fail closed. `observed_at` 객체를 그대로 보존한다.
- `tests/observability/test_f20_u01_run_status_summary.py` 신규: 혼합/0행/타 상태, 100·101행, malformed source, ID·행·enum·시각, 입력 비변경·출력 비밀값 비노출 등 22개.
- 본 결과보고서 신규. 기존 R12 read port, API/BFF/UI/DB/권한/Secret/배포 변경 없음. 반환값에 task/run ID, permission hash, payload 없음. `ACTIVE`는 canonical Run status 집계이며 프로세스 실측이 아니다.

## 실행 명령과 실제 결과

| 단계 | 명령 | exit | 결과 |
|---|---|---:|---|
| RED 초기 | `.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider -q tests\observability\test_f20_u01_run_status_summary.py` | 1 | 모듈 부재 collection error 1. 최소 import scaffold 후 동일 명령 재실행. |
| RED 확인 | 동일 명령 | 1 | 구현 전 `NotImplementedError`로 22 failed. |
| GREEN 집중 | 동일 명령 | 0 | 22 passed in 0.30s. |
| R12 인접 회귀 | `.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider -q tests\observability\test_f20_u01_run_status_summary.py tests\persistence\test_f20_u01_run_read.py` | 0 | 41 passed in 0.44s. R12의 legacy/101행/DB 오류는 `RUN_SOURCE_UNAVAILABLE` 기존 테스트로 확인. |
| observability 인접 | `.\.venv\Scripts\python.exe -B -m pytest -p no:cacheprovider -q tests\observability tests\persistence\test_f20_u01_run_read.py` | 0 | 59 passed in 2.16s. |
| G-05 | `.\.venv\Scripts\python.exe -B scripts\check_project_progress.py` | 0 | `G-05 project progress contract: PASS sequence=1888 reporting=AUTO_CONTINUE`. 착수·구현 후 각각 PASS. |
| diff | `git diff --check` | 0 | 출력 없음. 신규 untracked 파일은 이 Git 명령의 대상 밖이므로 실제 파일 내용을 별도 검토. |

전용 `.pytest_tmp_f20_u01_r16_dev`는 생성·사용하지 않았다. `-B`와 `-p no:cacheprovider`를 적용했다. 전체 프로젝트 suite, 실제 DB·API/UI·브라우저, WSL-server/Docker, ysna/Production은 미실행. 로컬 41 PASS를 그 범위 밖의 PASS나 U-01/F-20 수락으로 승격하지 않는다. C30 `OPEN_BLOCKING`·ReleaseDecision `DEFER` 유지.

## 인계·rollback

Developer는 commit/push/PR/merge를 하지 않았다. Main이 exact3 diff와 fresh tests, G-05를 독립 확인하고 `docs/WORK_STATUS.md`, canonical control/progress/HANDOFF, lease 회수 및 Git·WSL 후속을 소유한다. 회귀 시 이 R16 신규 제품 exact3만 제거하면 R12 port와 기존 UI를 보존한다. 기존 Main dirty 파일은 rollback 대상이 아니다.
