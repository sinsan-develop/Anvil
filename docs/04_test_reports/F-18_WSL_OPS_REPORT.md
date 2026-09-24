# F-18 WSL 운영 유사 R1 로컬 제품 보고 — 2026-09-25

## 판정

`COMPLETED` — R1 exact3 범위의 부작용 없는 capability preflight 구현과 로컬 검증을 마쳤다. 이는 **F-18 인수 또는 WSL 운영 capability PASS가 아니다.** 실제 WSL 관측·배포는 Main의 후속 단계로 남아 있으며 F-18 `accepted=false`, F-19 `BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED`다.

## 기준·시작 상태

- 작업 경로 `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`, branch `codex/f18-wsl-ops`, 시작 HEAD `7e5ca9d1e05b1299320aa3d351168e2754240253`, 시작 `git status --short` clean.
- G-05: `C:\Users\cyhuh\anaconda3\python.exe -B scripts/check_project_progress.py .` exit 0, canonical seq1515 PASS.
- 기준 SHA-256: 설계 `1DD7D91D6A0F9406A100B43B68285AD0A06F453FEC55F497458D55B20F481712`; 계획 `943B4123C5A8F273FF628E150501E0D66FAC10705A72989CA98E8453A083AEEB`; 매트릭스 `1AFDDC9A0D35868EC9D1774CE6A6087A177620875074D7198C361AFF92363AD6`; 테스트계획 `902A6E64E06E92C5F8856EE6C18CA94983F4F72040351AD954ADD1428555A014`; 운영규칙 `BFDF50FB5909BC0D3E7D2267BBDA2E458A67E858D7B5A36A2F077C4FE2DE06B0`; WorkInstruction `A7398305655DCFBFB283414256F08132C8B69DCB64A39FDBAAFC0C7D13A9231A`.
- actor `developer-primary-f18-wsl-ops-r1`; worker lease `worker-lease-f18-wsl-ops-r1-20260925-001` / execution token `f18-wsl-ops-execution-fence-epoch-1-69247977e4e51781`; write lease `write-lease-f18-wsl-ops-r1-20260925-001` / write token `f18-wsl-ops-write-fence-epoch-1-69247977e4e51781`. canonical 만료 `2026-09-25 15:07:45+09:00`; 시작 당시 clock `2026-09-25 03:08:55+09:00`, 만료 전임을 확인했다.

## 변경과 판단 근거

- `packages/deployment/wsl_operational.py`: 기존 `validate_existing_checkout`을 먼저 호출하고 실패 reason을 그대로 보존한다. 성공해도 독립 신뢰 공개키·지문과 Ed25519 서명으로 검증한 capability envelope가 target environment, source commit, signed manifest envelope hash, Web/API/Worker image digest, collector ID 및 OIDC/object-storage/network/PG18 관측 항목 모두에 결박되지 않으면 `CAPABILITY_NOT_VERIFIED`다. 양성 반환은 `READY_FOR_WSL_REHEARSAL`에만 한정한다. Git/network/DB/Docker/Secret I/O는 없다.
- `tests/deploy/test_f18_wsl_operational.py`: 합성 서명 fixture로 기존 gate 순서, 누락·불일치·위조 `verified=True`, 관측 provenance 형식, 서명·신뢰 지문 실패를 검증한다.
- `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`: 이 증거와 미검증 경계를 기록한다.
- 이 envelope의 `real-wsl-observation` 표시는 서명된 입력 계약일 뿐, 이 로컬 테스트가 실제 WSL 관측을 증명한다는 뜻은 아니다. 신뢰 공개키·collector ID는 호출자가 독립적으로 공급해야 하며, 임의 키 또는 합성 관측으로 만든 로컬 양성 fixture를 인수·배포 증거로 사용할 수 없다. Production 신뢰키·Secret 정책을 새로 만들지 않았다.

## 실행 검증

- TDD RED: `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_wsl_operational.py` → exit 1, `ModuleNotFoundError: packages.deployment.wsl_operational` (제품 파일 생성 전 예상 실패).
- 최소 구현 직후 GREEN: 동일 명령 → exit 0, 18 PASS/0.18초.
- 누락 capability별 `NOT_VERIFIED`와 신뢰 지문 거부 테스트를 추가한 뒤 관련 회귀: `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-wsl-ops-test-temp tests/deploy/test_f18_wsl_operational.py tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f18_production_preflight_cli.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py` → exit 0, **133 PASS/68.42초**.
- `git diff --check` → exit 0. 전용 `.f18-wsl-ops-test-temp`는 resolved 절대경로가 이 worktree 내부이고 reparse point가 아님을 확인한 뒤 exact target만 제거, `Test-Path`는 `False`(잔류 0).

## 미검증·영향·복구

- WSL-server, Docker, DB, browser, OIDC issuer/API, object storage, network policy, PG18, 실제 collector 서명 및 key provisioning, 실제 세 image digest 동일성, Git fetch/checkout, 배포, Production은 모두 `NOT_EXECUTED`다. 합성 서명 fixture PASS를 실제 capability PASS로 승격하지 않는다.
- `pyproject.toml`/`uv.lock`에는 `cryptography` 직접 의존성이 없어, 기존 F-16/F-18 모듈 import가 WSL `uv sync --locked --group dev` 환경에서 실패할 가능성은 남아 있다. 이 Task의 exact3 lease 밖 의존성 파일은 변경하지 않았으며 Main이 별도 처리한다.
- 기존 F-16/F-17/F-18 관련 로컬 테스트는 위 133개 범위에서 유지됐다. 정식 실패보고 횟수 0. rollback은 이 Task의 exact3 commit을 revert하는 것이며, 운영 자원은 생성·변경하지 않았다.
- canonical progress/HANDOFF·control 문서는 Main 소유로 수정하지 않았다. Main의 독립 검토와 WSL 실제 관측·수락이 다음 조치다.

## R1 독립 리뷰 Important 2건·Minor 1건 보완 — 2026-09-25

- 시작 checkpoint `95121715c620e1447dff1d6ef8a9b68372b4e594`, branch `codex/f18-wsl-ops`, Git status clean. 같은 seq1515 worker/write lease와 execution/write fencing token 및 exact3 scope가 ACTIVE이고, 재확인 시각 `2026-09-25 03:25:16+09:00`은 lease 만료 `15:07:45+09:00` 이전이었다.
- 재확인 G-05는 처음 exit 1 `F18_LOCAL_START_GIT_INVALID`였다. 원인은 제품 checkpoint가 승인 `development/codex/f18-wsl-ops`보다 1 commit 앞선 Git 게시 상태였다. Main이 exact SHA를 게시한 뒤 독립 재실행 exit 0 `PASS sequence=1515 reporting=AUTO_CONTINUE`를 확인해 lease/정본 불일치는 없었다. 이 제품 작업자는 push·control 수정을 하지 않았다.
- Important 1: 기존 서명 payload가 migration/rollback 계획 hash를 묶지 않아 승인 계획 변경에도 과거 capability PASS를 사용할 수 있었다. TDD RED `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_wsl_operational.py -k old_capability_signature_cannot_authorize_changed_plan` → exit 1, 2 FAIL/22 deselected, 실제 반환 `READY_FOR_WSL_REHEARSAL`이었다. 서명 payload에 두 계획 hash를 추가하고 호출 입력 및 `DeployApprovalSubject`와 각각 비교한 뒤 동일 명령 exit 0, 2 PASS/22 deselected.
- Important 2: 같은 environment/commit/images의 오래된 증거 재사용을 제한하기 위해 서명 payload에 `target_instance_id`, `rehearsal_run_id`, `issued_at`, `expires_at`을 추가했다. 호출자는 독립 기대 instance/run ID와 UTC aware `now_utc`를 필수 제공한다. 증거 TTL은 최대 5분, 미래 발행 허용 오차는 최대 30초, 만료 시각 이상에서는 거부한다. RFC3339 UTC 초 단위 이외 형식, naive clock, target/run 변경, stale/future/TTL 초과는 `CAPABILITY_NOT_VERIFIED`다. TDD RED 양성 신규 API 테스트 exit 1, `unexpected keyword argument 'expected_target_instance_id'`; 구현 뒤 focused 37 PASS. 이 순수 함수는 동일 run 내 단회 소비 상태를 저장하지 않으므로, 호출 측의 새 run ID 발급과 독립 UTC clock 신뢰가 후속 운영 조건이다.
- 감사 결박: signed `approval_subject_hash`를 추가해 현재 `DeployApprovalSubject`의 hash 및 기존 Git/artifact gate의 `base.subject_hash`와 모두 비교한다. mismatch 테스트 RED exit 1에서 실제 `READY_FOR_WSL_REHEARSAL`을 관측한 뒤 GREEN. Minor 1: 공개 wrapper의 `approved_remote` override를 제거해 고정 승인 `APPROVED_DEVELOPMENT_REMOTE`만 기존 checkout gate로 전달한다. 거부/고정 전달 테스트를 추가했다.
- 최종 회귀: `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-wsl-ops-review-temp tests/deploy/test_f18_wsl_operational.py tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f18_production_preflight_cli.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py` → exit 0, **149 PASS/70.47초**. `git diff --check` exit 0. `.f18-wsl-ops-review-temp`의 resolved exact 경로가 worktree 내부이고 비-reparse임을 확인한 뒤 제거, `Test-Path=False`로 잔류 0.
- 변경은 이 보고서와 `packages/deployment/wsl_operational.py`, `tests/deploy/test_f18_wsl_operational.py` 세 경로뿐이다. 실제 WSL/DB/Docker/OIDC/object store/network/PG18/browser·배포·Production은 여전히 `NOT_EXECUTED`; 합성 서명과 시간 fixture PASS는 실제 관측·key/clock 신뢰를 증명하지 않는다. F-18 `accepted=false`, F-19 차단. 정식 실패보고 횟수 0. rollback은 이 보완 commit만 revert한다. progress/HANDOFF는 Main 소유라 미수정.

## R2 재현 가능한 crypto 의존성 — 로컬 제품 증거 / 2026-09-25

- 판정 `COMPLETED`(R2 로컬 exact5 제품 Task 한정). 시작 branch `codex/f18-wsl-ops`, published HEAD `5a0f961f921f6145ce8238353d7e66c3def5205d`, `git status --short` clean, G-05 `C:\Users\cyhuh\anaconda3\python.exe -B scripts/check_project_progress.py .` exit 0 / seq1520 PASS. WorkInstruction SHA-256 `7BAFF326D48F862EAF11173DA202BBB58754738AF81C204C403266D0F57C72EA`; 설계·계획·매트릭스·테스트계획·운영규칙 SHA는 위 기준과 동일했다.
- actor `developer-primary-f18-wsl-ops-r2`, worker `worker-lease-f18-wsl-ops-r2-20260925-001` / execution token `f18-wsl-ops-execution-fence-epoch-2-69247977e4e51781`, write `write-lease-f18-wsl-ops-r2-20260925-001` / write token `f18-wsl-ops-write-fence-epoch-2-69247977e4e51781`. 두 lease 모두 ACTIVE, epoch2, issued `2026-09-25 03:42:00+09:00`, expires `15:42:00+09:00`, baseline/dispatch `3b968e900b07d82f487090bf4de89748d057a221`, exact5 scope 일치. commit 전 재확인 clock `2026-09-25 03:50:01+09:00`으로 만료 전이다.
- 원인: WSL의 clean detached R1 SHA에서 `uv sync --locked --group dev --no-install-project`는 exit0이었지만 잠긴 venv의 F16/F18 수집은 `ModuleNotFoundError: cryptography` exit1이었다(상세 원본은 `docs/WORK_STATUS.md`). 시스템 crypto를 임시 결합한 149 PASS는 PROVISIONAL이다. F16/F18 Ed25519 runtime import가 프로젝트 직접 의존성·lock과 Web image requirements 어디에도 선언되지 않은 것이 원인이며 Secret·키 오류가 아니다.
- TDD RED: `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_wsl_dependencies.py` → exit1, 3 FAIL. 각각 `pyproject.toml` 직접 선언 없음, `uv.lock` root 의존성 없음, runtime pin용 잠긴 crypto package 없음이었다.
- 변경 exact5: `pyproject.toml`의 runtime 직접 의존성 `cryptography>=43,<47`; `uv.lock`에 resolver가 검증한 `cryptography==46.0.7` 및 필요한 `cffi==2.1.1`, `pycparser==3.0`; `deploy/wsl/requirements-runtime.txt`에 lock과 같은 `cryptography==46.0.7`; `tests/deploy/test_f18_wsl_dependencies.py`에 세 설치 경계의 정합성 검사; 이 보고서. `uv.lock` diff는 기존 package 버전 교체 없이 새 세 package와 root 직접 의존성만 추가했다.
- lock 명령: 기본 `uv lock --cache-dir D:\tmp\anvil-f18-r2-uv-cache`는 로컬 sandbox의 D:\tmp 생성 권한 거부(exit1). worktree 전용 cache의 `uv lock --cache-dir .f18-r2-uv-cache`는 sandbox 네트워크 socket 거부(exit1). 허가된 network 실행으로 동일 명령 exit0, 38 packages resolve, 위 3 package 추가. 이 두 환경/권한 오류는 정식 Developer 실패보고가 아니다. `uv lock --check --offline --cache-dir .f18-r2-uv-cache` exit0, 38 packages resolve.
- GREEN: 같은 신규 테스트 명령 exit0, **3 PASS/0.06초**. Windows 관련 회귀 명령 `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r2-pytest-temp tests/deploy/test_f18_wsl_dependencies.py tests/deploy/test_f18_wsl_operational.py tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f18_production_preflight_cli.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py` → exit0, **152 PASS/76.93초**.
- 격리 로컬 잠금 실행: `UV_PROJECT_ENVIRONMENT=.f18-r2-venv`에서 `uv sync --locked --group dev --no-install-project --python C:\Users\cyhuh\anaconda3\python.exe --cache-dir .f18-r2-uv-cache` → exit0, Python3.13.9 환경에 36 packages 설치(crypto 46.0.7 포함). `.f18-r2-venv\Scripts\python.exe -B -c "import cryptography; import packages.deployment.release_manifest; import packages.deployment.wsl_operational; print('LOCKED_IMPORT_OK', cryptography.__version__)"` → exit0, `LOCKED_IMPORT_OK 46.0.7`. 같은 venv의 `-B -m pytest -q -p no:cacheprovider --basetemp=.f18-r2-locked-pytest-temp tests/deploy/test_f18_wsl_dependencies.py tests/deploy/test_f18_wsl_operational.py tests/deploy/test_f16_release_manifest.py` → exit0, **75 PASS/0.39초**.
- `git diff --check` exit0. `.f18-r2-uv-cache`, `.f18-r2-venv`, `.f18-r2-pytest-temp`, `.f18-r2-locked-pytest-temp`는 각각 resolved exact worktree 내부·비-reparse 검증 후 개별 제거했고 4개 모두 `Test-Path=False`, 잔류0. 다른 제품 경로와 control/progress/HANDOFF 수정은 없다. 정식 Developer 실패보고 0회.
- 이 로컬 결과는 WSL Python3.12 잠긴 venv와 Web image build/runtime의 실제 import PASS를 대체하지 않는다. Main이 동일 게시 SHA로 WSL에서 system `PYTHONPATH`/임시 설치 없이 재검증해야 한다. OIDC·object storage·network·PG18·browser·동일 세 image digest·rollback·운영 유사 배포와 Production은 `NOT_EXECUTED`; F-18 `accepted=false`, F-19 차단. rollback은 이 R2 exact5 commit 하나를 revert하며 기존 서버 서비스·DB는 변경하지 않았다.
