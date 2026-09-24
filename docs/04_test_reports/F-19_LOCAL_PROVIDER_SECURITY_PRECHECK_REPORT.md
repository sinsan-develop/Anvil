# F-19 선행 로컬·WSL-server Provider/보안 회귀 점검 — 2026-09-24

## 판정

`PREPARED_UNMERGED`. 이 점검은 F-19 정식 Work Package 착수·인수나 F-18 전체 합격이 아니다. `F-18 accepted=false`, `F-19 BLOCKED_PENDING_F18_ACCEPTANCE`, Production `NOT_EXECUTED`를 유지한다. 작업 대상은 로컬 개발과 `ssh WSL-server` 테스트에 한정했다. 담당 Main 어울, 정식 Developer `FAILURE_REPORT` 0회.

## 판단 이유와 변경

- 기준 `main`은 PR #35 병합 commit `e2f3d994b95c2e60f6a3e597101c30daa25089b4`다. 이전 F18 작업 브랜치/worktree는 병합 계보와 merged-main G-05/관련 124 PASS 확인 뒤 삭제됐다. 새 단일 작업 브랜치 `codex/f19-test-dependency`에서 로컬 개발했다.
- `pyproject.toml`은 `httpx2`만 dev 의존성으로 선언했지만 저장소 통합 테스트와 WSL 고정 FastAPI/Starlette TestClient는 `httpx`를 import했다. 로컬 전역 Python에 있던 `httpx`가 누락을 가렸다. 최신 lock의 Starlette는 반대로 `httpx2`를 우선 사용하므로, 두 패키지를 모두 dev 의존성으로 유지하고 `uv.lock`을 갱신했다. 제품 런타임 의존성은 변경하지 않았다. 변경 전 단일 `httpx2>=2,<3` → 변경 후 `httpx>=0.28,<1` 및 `httpx2>=2,<3`다.
- WSL Python 3.12에서 기존 `tests/provider_catalog/test_provider_catalog_f01.py`의 IPv4-mapped loopback/metadata 2개 사례가 RED였다. `ipaddress.IPv6Address.is_loopback/is_link_local`이 mapped IPv4 값을 반영하지 않는 환경 차이를 양쪽 Python에서 실측했다. `packages/provider_catalog/service.py`의 `allow_local_endpoint`는 검증 시 `ipv4_mapped`가 있으면 그 IPv4 속성을 사용하고, 기존 원본 주소의 저장·감사 표현은 유지한다. 로컬 Python 3.13에서는 두 사례가 이미 GREEN이었으며, 수정 후 WSL Python 3.12에서도 GREEN이다.
- 로컬 commit `80665863c798ef0c56b7a95cbc9ac7242328d63a`(개발 의존성), `609f071391ef84f54cb6870668c15367d89fc937`(주소 검증)를 승인 원격 `development`로 push했다. WSL-server는 승인 SSH Git remote에서 정확한 `609f071391ef84f54cb6870668c15367d89fc937`를 새 `/srv/anvil-wsl/f19-readonly-prep-e2f3d99`에 fetch하여 detached checkout했다.

## 실행 결과

| 환경·검증 | 실제 결과 |
|---|---|
| Windows `uv lock --check`, 잠긴 격리 개발 환경 `uv sync --locked --group dev` | exit 0; `httpx 0.28.1`, `httpx2 2.13.1` import 확인 |
| Windows 잠긴 격리 환경: `python -B -m pytest -q -p no:cacheprovider` + `tests/providers tests/provider_catalog tests/provider_settings tests/api/test_f12_provider_settings_api.py tests/api/test_f15_web_security.py tests/api/test_web_security.py tests/recovery/test_secret_capability_recovery.py` | 수정 전·후 최종 범위 525 PASS, 최종 exit 0 / 5.47초 |
| WSL-server 기본 Python의 동일 범위 | SQLAlchemy/FastAPI 누락으로 collection ERROR 6건, exit 1; 제품 실패로 집계하지 않음 |
| WSL-server 격리 venv에 `deploy/wsl/requirements-runtime.txt`, 잠긴 pytest/httpx2 설치 후 동일 범위 | 구형 Starlette TestClient가 요구하는 `httpx` 누락으로 collection ERROR 3건, exit 1 |
| WSL-server 격리 venv에 `httpx 0.28.1` 추가, 보안 수정 전 게시 commit `8066586` | 523 PASS·2 FAIL, exit 1. 실패는 기존 IPv4-mapped loopback/metadata 차단 테스트 |
| WSL-server 같은 격리 환경, 보안 수정 후 게시 commit `609f071` | 525 PASS·1 upstream deprecation warning, exit 0 / 3.53초 |
| Windows 잠긴 격리 환경 전체 pytest `--maxfail=1` | `tests/deploy/test_anvil_public_preview_contract.py`의 `yaml` 미설치로 collection ERROR 1건, exit 1. 전체 suite PASS 아님 |
| `scripts/check_project_progress.py` on 후속 브랜치 | `F18_LOCAL_START_GIT_INVALID`, exit 1. F18 전용 branch/merge gate가 후속 maintenance 브랜치를 허용하지 않음 |

WSL-server의 격리 checkout은 삭제 전 realpath가 exact 경로와 일치하고 symlink가 아니며 owner `daon:daon`, mode `0700`, HEAD `609f071`임을 확인했다. 유일한 untracked `.venv/`를 포함한 그 exact checkout만 제거했고 경로 잔류 0을 확인했다. 기존 DB·Docker·브라우저·서비스와 `ysna-server`는 변경하지 않았다. Windows 격리 `.f19-uv-venv`도 exact 경로 비-reparse 확인 후 제거했다.

## 미검증·다음 조치

- 9개 실제 Provider 호출, 실환경 egress·secret·Network/DB/log/artifact 누출, Production 및 F-19 cross-environment EvidenceManifest는 검증하지 않았다. API key 부재에 의한 실제 Provider 오류는 이 합성 회귀 판정에 포함하지 않는다.
- G-05 실패 상태에서 PR/병합하지 않는다. F18 전체 인수 선행조건과 후속 maintenance branch를 허용할 통제 계약을 먼저 정본 지시에 맞게 정리하고, 동일 브랜치에서 검증·병합·정리한다. 새 브랜치는 만들지 않는다.
- 이 두 코드 commit의 rollback은 별도 후속 commit으로 역변경한 뒤 같은 로컬→Git push→WSL-server 검증을 반복하는 것이다. 이미 게시된 commit과 원격 브랜치는 복구 ref로 남아 있다.
