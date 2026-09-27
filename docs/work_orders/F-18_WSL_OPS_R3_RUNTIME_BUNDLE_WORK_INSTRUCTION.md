# F-18 WSL 운영 유사 R3 WorkInstruction — 잠긴 F17 검증·이미지 runtime bundle

## 기준·권한

- 같은 단일 `codex/f18-wsl-ops` branch와 승인된 Local 개발→Git push→`ssh WSL-server` Test/Staging 경계를 유지한다. `ysna-server`, Production, 공유 DB·기존 서비스는 대상이 아니다. 설계·작업계획서의 F-18 범위·요구사항·중요 위험을 변경하지 않는다.
- R2 제품 SHA `eed74079d813b13f35dacbb0fad8dcb483b9283a`의 WSL Python3.12 잠긴 venv에서 F-16/F-18 핵심 140 PASS, crypto import와 Web image crypto/F-16 import PASS. 8-file F17 테스트 수집은 `ModuleNotFoundError: yaml`; Web image F18 import는 `/opt/anvil/deploy/wsl/f16_staging.py` 누락으로 실패했다. 사용자 키 문제가 아니라 개발용 PyYAML 선언과 Dockerfile runtime bundle 구성 문제다. 최초 오류·정확한 명령·정리 증거는 `docs/WORK_STATUS.md`에 있다.
- R2 worker/write lease를 회수한 뒤 R3 새 두 token과 exact5를 발급한다. 제품 writer exact5: `pyproject.toml`, `uv.lock`, `deploy/wsl/Dockerfile.web`, `tests/deploy/test_f18_wsl_dependencies.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. 나머지 제품·control 파일은 수정하지 않는다.

## 구현·검증

1. 실제 WSL RED 두 가지를 근거로 최소 수정한다. F17의 `yaml`은 개발/검증 도구에서만 쓰이는지 import graph를 확인한 뒤 `PyYAML`을 dev group에 선언·lock한다. 운영 Web requirements에 불필요하게 추가하지 않는다. 기존 F-16/F-18 crypto runtime pin과 다른 package version은 유지한다. 기존 의존성 계약 테스트에 dev 검증 가능성·lock 정합을 보강한다.
2. `promotion_preflight.py`→`deploy/wsl/f16_staging.py` 실제 import 경로를 확인한 뒤 Web image에 필요한 `deploy/wsl` 파일만 복사한다. 런타임 이미지에서 F-18 import가 가능해야 하고 기존 image user/read-only/same-origin 동작을 바꾸지 않는다. `deploy/ysna` 또는 기존 WSL 서비스/Compose는 수정하지 않는다.
3. 로컬에서 `uv lock --check`와 신규 거부·기존 F16/F17/F18 관련 테스트 및 diff를 검증한 clean commit을 Main에게 넘긴다. Main만 승인 Git SSH alias로 push한다. Main은 WSL-server 새 전용 checkout에서 동일 code SHA를 잠긴 Python3.12로 설치하고 system `PYTHONPATH` 없이 8-file 회귀를 재실행한다. 새 image tag로 `Dockerfile.web`를 build하고 network/port/DB 없이 F-16/F-18 import를 검사한다. SHA/image ID·정리 잔류0을 기록한다.
4. 이 결과는 재현 가능한 테스트·runtime bundle에 한정한다. OIDC, object storage, network policy, PG18 격리 운영 유사 target, 동일 Web/API/Worker image 승격, backup/rollback, browser는 별도 후속 단계다. F-18 `accepted=false`, F-19 차단, Production `NOT_EXECUTED`, ReleaseDecision `DEFER` 유지.

## 복구

- 기존 서비스·DB·Docker 전역 자원을 rollback하거나 `ysna-server`에 접속하지 않는다. 새 QA 자원은 Main이 사전 기록한 exact 경로/label만 소유·HEAD·ID 검사 후 제거한다. 실패는 출처별로 기록하고 실행하지 못한 검증을 PASS로 쓰지 않는다.
