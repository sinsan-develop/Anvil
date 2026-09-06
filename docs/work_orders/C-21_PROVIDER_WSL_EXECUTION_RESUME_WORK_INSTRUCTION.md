# C-21 Provider WSL Execution Resume WorkInstruction

- Artifact ID: `WI-C-21-PROVIDER-WSL-EXECUTION-RESUME-20260906-001`
- Executor: `developer-primary`
- Dispatch source: `e6c562cf07bc2c35e24addb60efa9d90fae08046`
- Historical parent: `a6dca0da5a37e64491e91813895268e78ecb78b2`
- Approval binding: `MAIN_RESUMED_APPROVED_WSL_QA`
- Result state at dispatch: `IN_PROGRESS`
- Dispatch timestamp: `2026-09-06T17:55:29+09:00`
- Worker lease: `worker-lease-c21-provider-wsl-execution-resume-20260906-001`
- Write lease: `write-lease-c21-provider-wsl-execution-resume-20260906-001`
- Execution fence: `c21-provider-wsl-execution-resume-execution-fence-epoch-1-e6c562c`
- Write fence: `c21-provider-wsl-execution-resume-write-fence-epoch-1-e6c562c`

## 선행 S exact10 기록과 Git 검증

S의 허용 경로는 `scripts/check_project_progress.py`의 `c21_provider_wsl_execution_resume_start_paths()`가 반환하는 exact10이며 path-list SHA-256은 `0FCFCE1A57E7A806B9E94B495DBE7CF3AEFD720FB6B8ACFF029DA0CEBB7EA070`이다. 이 기록은 K 실행 준비만 허용하며 외부 실행 권한을 발급하지 않는다.

- Source full events: 943712 bytes / `2B1B29ACF178595EEF3C2C2CEB22BE3529BB61E7BB27567CC9601474C5CE7B36`.
- seq1~530 raw event-object prefix: 943494 bytes / `202F50F09DD6BA9F5D7E46DEFBB960F76A0E254416D3C18250617C6AA2B5B195`.
- seq1~530 ASCII canonical SHA-256: `BE6D46279351D3791B849F7668BD000709DE991B0F602FFA6F9F337E7E08CE55`.
- Source cumulative exact109: `16B35029243DAEF7A18A73DDBAA45C5E3150C7AF5B1863287CD823EAAA6DCB2E`.
- Post-S cumulative exact113: `3823FE6C7839D6E306A16C0CD765AF1105422ECAAEBEEA340DA7C18652A8CA5D`.
- Post-K cumulative exact117: `6E50421CAB8A0E2A99B1ED1A074A4CAB487B8A0C4EA5D77F526343C3402DABA1`.

S precommit은 source HEAD와 dirty exact10, source 누적 exact109를 모두 요구한다. S postcommit은 source의 유일한 부모를 가진 direct child, clean, 변경 exact10, 누적 exact113을 모두 요구한다. 추가 descendant, merge parent, cumulative reversion, 수집 실패, 이미 존재하는 candidate remote ref는 거부한다. Source parent에서 source까지의 exact12도 확인한다. 여기서 검증하는 postcommit 계약은 Developer에게 commit 권한을 부여하지 않는다.

seq531~533만 추가하고 source header의 last_sequence를 530에서 533으로 한 번 바꾼다. seq530까지 raw prefix와 historical commit=NOT_EXECUTED를 보존한다. seq530 validator와 Git 분기의 AST는 수정하지 않는다.

## 목적

기존 승인 범위에서 runtime-ready successor를 준비한다. 이 시작 projection과 다음 K exact14는 실행 권한이나 실행 성공을 주장하지 않는다.

## K write lease exact14

- `deploy/wsl/CandidateReleaseManifest.json`
- `deploy/wsl/candidate-manifest-guard.sh`
- `docs/04_test_reports/C-21_PROVIDER_WSL_EXECUTION_RESUME_REPORT.md`
- `docs/DEVELOPMENT_ENVIRONMENT.md`
- `docs/WORK_STATUS.md`
- `docs/evidence/manifests/C-21_PROVIDER_WSL_EXECUTION_RESUME_MANIFEST.json`
- `docs/progress/BUILD_HANDOFF.md`
- `docs/progress/build-progress.json`
- `docs/progress/progress-events.json`
- `docs/progress/progress-handoff-detached-digest-c21-provider-wsl-execution-resume-bound.json`
- `docs/validation/C-21_PROVIDER_WSL_EXECUTION_RESUME_VALIDATION.md`
- `scripts/check_project_progress.py`
- `tests/deploy/test_wsl_staging_harness.py`
- `tests/tooling/test_project_progress.py`

K exact14 path-list SHA-256: `3A67A5443BBCD92B125E5168442B5EB46A1FBA4EA0A9AE061411FB655921C09B`.

## 금지선과 완료 계약

- S와 K에서 commit, push, WSL, Docker, DB, Provider, Telegram, ysna, main을 실행하지 않는다.
- K는 `READY_FOR_APPROVED_WSL_QA`만 기록할 수 있으며 실행 성공을 기록할 수 없다.
- runtime dispatch는 K direct-child commit과 Main의 별도 exact binding 뒤에만 가능하다.
- 미래 dispatch에서 current/previous runtime 및 rollback은 관측해야 하며 추측으로 기록하지 않는다.
- seq1~530과 seq530 `commit=NOT_EXECUTED`은 불변이다.
- malformed 또는 missing evidence는 예외가 아니라 fail-closed 오류로 처리한다.

## 로컬 검증과 기록

- 실행환경: `D:/tmp/anvil-c21-operational-execution`, `.venv/Scripts/python.exe`, `PYTHONUTF8=1`, `PYTHONDONTWRITEBYTECODE=1`, `TEMP=TMP=D:/tmp`.
- 집중 검증: `.venv/Scripts/python.exe -m pytest tests/tooling/test_project_progress.py -q -p no:cacheprovider -k execution_resume`.
- fixture는 `D:/tmp/anvil-seq533-*` 일회성 경로에 만들고 테스트 종료 시 정리하며 잔류 여부를 확인한다.
- Main은 `c21_provider_wsl_execution_resume_start_artifacts(historical, files)`로 E/P/H/D/M의 결정론적 bytes를 검토한다. 이 함수는 파일에 쓰지 않고 외부 실행도 하지 않는다.
- 필수 historical mapping은 source commit의 `docs/progress/build-progress.json`, `docs/progress/progress-events.json` raw Git blob이다. 필수 current files mapping은 WORK_STATUS, HANDOFF, 이 WI, invocation prompt, checker, test의 raw bytes다.
- 기록/hash를 재결박한 뒤 live checker와 관련 회귀를 확인한다. 재결박 전 과거 seq530 manifest에 대한 current-file hash 실패를 새 기능 실패 또는 PASS로 바꾸지 않는다.
