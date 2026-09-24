# F-18 WSL 운영 유사 R2 WorkInstruction — 재현 가능한 암호화 의존성

## 범위·기준

- 승인된 설계·작업계획서 F-18과 `F-18_WSL_OPS_WORK_INSTRUCTION.md`의 Local→Git push→`ssh WSL-server` 검증 범위를 유지한다. `ysna-server`, Production, 공유 DB, 기존 WSL 서비스는 대상이 아니다. 작업 브랜치는 기존 단일 `codex/f18-wsl-ops` 그대로이며 새 브랜치를 만들지 않는다.
- R1 제품 SHA `5fd4c1013fb4015929700874c61c09cea22519d2`의 독립 로컬 149 PASS와 WSL 임시 system crypto 결합 149 PASS는 순수 계약 재현이다. WSL의 잠긴 `uv sync --locked --group dev` 환경은 `ModuleNotFoundError: cryptography`로 수집 실패했다. R2는 이 재현 불능을 직접 의존성·lock·운영 Web image requirements에서 고친다. 키/Secret 실패로 분류하거나 무시하지 않는다.
- R1 worker/write lease는 R2 발급 전에 회수한다. R2 단일 writer의 exact 경로는 `pyproject.toml`, `uv.lock`, `deploy/wsl/requirements-runtime.txt`, `tests/deploy/test_f18_wsl_dependencies.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`이다. 그 밖의 제품 경로와 control 문서는 Main 소유이며 writer가 수정하지 않는다.

## 수행·검증

1. 테스트를 먼저 추가해 선언·lock·런타임 requirements 불일치와 잠긴 venv에서 `cryptography` import 불가를 RED로 관측한다. 기존 F-16/신규 F-18의 실제 Ed25519 import 경로가 필요한 의존성임을 근거로 runtime 직접 의존성을 추가하고 lock을 갱신한다. 범위 밖 패키지 업그레이드를 의도적으로 수행하지 않는다.
2. Windows 로컬에서 정확한 변경 diff, lock 일관성, 신규 테스트와 F-16/F-18 관련 회귀를 확인한다. Main에게 clean 제품 commit과 명령·exit·결과를 보고한다. Main이 승인 SSH alias의 동일 작업 branch에 push한다.
3. Main이 WSL-server에 미리 기록한 새 exact 임시 checkout을 만들고 게시된 **동일 code SHA**를 detached 수신한다. Python 3.12 `uv sync --locked --group dev --no-install-project`만 사용하며 system `PYTHONPATH` 또는 임시 `uv pip install` 우회 없이 동일 관련 테스트를 실행한다. Web image runtime requirements에서 crypto import도 image build/실행 검증에 포함한다. 모든 임시 자원은 소유·realpath·HEAD 확인 후 exact 제거하고 잔류0을 기록한다.
4. R2 성공은 재현 가능한 의존성과 Linux 계약 테스트만 증명한다. OIDC·object storage·network·PG18·브라우저·동일 세 image digest·backup/rollback·실제 WSL 운영 유사 배포는 별도 후속 작업이며 F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`, ReleaseDecision `DEFER`를 유지한다.

## 실패·복구

- 의존성 해석 실패나 WSL 잠긴 QA 실패는 exit와 원인을 보고서에 기록하고 임의로 시스템 전역 패키지·인증·키를 변경하지 않는다. 변경은 이 Task의 exact5만 revert할 수 있으며 기존 서비스를 rollback 대상으로 삼지 않는다. Main은 독립 검토 후에만 lease 회수·다음 단계로 전환한다.
