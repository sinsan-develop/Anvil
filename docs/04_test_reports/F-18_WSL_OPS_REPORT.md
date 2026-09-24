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
