# F-18 로컬·WSL 사전검증 보고 — 로컬 작업자 checkpoint

## 판정

F-18 Task 1·2의 로컬 순수 함수 구현과 기본 회귀는 PASS다. Main이 공개 checkpoint의 WSL 격리 checkout에서 F-18/F-16 focused 67개를 PASS했다. WSL F-17 회귀 12개는 의존성 부재로 `NOT_RUN`이다. F-18 전체 acceptance는 `false`이며 AV-OPS-013/016/020/021, Production DeployApproval 및 Release는 미완료다. F-19는 차단 상태다.

실제 F-17 증거 형태는 Git commit과 API/Worker 단일 `runtime_image_digest`만 결박한다. F-16 `VerifiedRelease`는 Web/API/Worker 각각의 digest를 갖는다. 따라서 commit과 API/Worker digest가 일치해도 Web 대응 증거가 없으면 `WEB_IMAGE_NOT_VERIFIED`와 `ready=False`를 반환한다. 세 이미지 digest를 모두 명시한 합성 증거에서만 `READY_FOR_PRIVATE_REHEARSAL`을 반환한다. 이 상태는 실제 Production 승격·배포 승인이 아니다.

Main review에서 F-16 `VerifiedRelease.subject_hash`가 서명된 envelope가 아닌 subject만 결박하는 공백을 발견했다. F-18은 F-16의 독립 신뢰 검증 함수를 호출한 후 입력 signed envelope 전체의 SHA-256을 `release_manifest_hash`로 사용하도록 보완했다. 같은 subject에 새 유효 서명을 붙여도 이전 approval은 무효다. F-16 검증 결과만 단독으로 전달하면 F-18 preflight는 차단한다.

## 기준·변경

- 시작 worktree: `D:\Project\Anvil\.worktrees\f18-local-wsl-preflight`; branch `codex/f18-local-wsl-preflight`; HEAD `8f78d3138ec2e4b7690b0247365defef708fb2c7`; 시작 `git status --short` 출력 없음.
- G-05 seq1495 PASS, worker lease `worker-lease-f18-local-r1-20260924-001`, write lease `write-lease-f18-local-r1-20260924-001`, actor `developer-primary-f18-local-r1`, exact5 scope. Lease baseline `b6b3ff04`의 단일 자식 F-18 control HEAD에서 작업했다.
- 기준 SHA-256: 설계서 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; 작업계획서 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`; 검증매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`; 테스트계획서 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`; 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`; F-18 계획 `BE517087E033575A639DE3EE76E1ED14688DB38E8A1794A07EE99C48F71E5837`.
- Task 1 commit `3a97e06`: `packages/deployment/deploy_approval.py`, `tests/deploy/test_f18_deploy_approval.py`. 네 필드 canonical JSON SHA-256 결박, 필드별 approval 무효화와 입력 검증.
- Task 2 commit `88da55f`: `packages/deployment/promotion_preflight.py`, `tests/deploy/test_f18_promotion_preflight.py`. F-16 verified subject, F-17 commit/runtime digest, environment 및 plan hash를 비교하는 부작용 없는 사전검증. Web digest 미결박은 보류.
- Main review 보완: 같은 Task 2의 두 파일에서 `verify_approval_release`가 F-16 서명·신뢰·관측 검증과 signed envelope hash를 함께 생성한다. `validate_promotion`은 이 결박 결과만 입력받는다. 동일 subject의 새 유효 서명이 이전 approval과 불일치하는 RED→GREEN 테스트를 추가했다.
- 최종 변경 경로: 위 코드·테스트 4개 파일과 이 보고서의 exact5. 다른 제품 경로는 수정하지 않았다.

## 로컬 실행 증거

| 명령 | exit·결과 |
|---|---|
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_deploy_approval.py` (구현 전) | exit 1, 누락 모듈 collection error — 의도한 RED |
| 동일 명령 (구현 후) | exit 0, 8 PASS |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_promotion_preflight.py` (구현 전) | exit 1, 누락 모듈 collection error — 의도한 RED |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f18_deploy_approval.py` | exit 0, 20 PASS |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-pytest-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py` | exit 0, 77 PASS. 전용 임시 경로는 실행 뒤 제거하여 잔류 0. |
| `git diff 8f78d3138ec2e4b7690b0247365defef708fb2c7..88da55f139dc850e0bc89afd4b14f9829e8c3679 --check` | exit 0, whitespace 문제 없음 |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_promotion_preflight.py` (Main review 보완 전) | exit 1, `verify_approval_release` 누락 import error — 의도한 RED |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f18_deploy_approval.py` (보완 후) | exit 0, 22 PASS |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-review-pytest-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py` | exit 0, 77 PASS. 전용 임시 경로 잔류 0. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f18_deploy_approval.py` (최종 보완 후) | exit 0, 24 PASS; bare F-16 결과 거부와 변조 서명 거부 포함. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-review-final-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py` | exit 0, 79 PASS. 전용 임시 경로 잔류 0. 최종 회귀 근거. |

최초 F-16 포함 회귀를 기본 pytest 임시 경로로 실행했을 때 37 PASS/5 ERROR, exit 1이었다. 다섯 오류는 `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh` 접근 거부로 test setup에서 발생했다. 전용 `--basetemp` 최종 재실행 79 PASS가 Windows 코드 회귀 판정 근거다. 정식 실패보고 횟수는 0이다.

## Main의 WSL 격리 QA 증거

- 공개 checkpoint `de4caa5eede6b3700cb5c0607b895a442994cfc5`를 `ssh WSL-server`의 `/srv/anvil-wsl/f18-local-qa`에서 승인 remote `git@github-sinsan-develop:sinsan-develop/Anvil.git`로 가져와 정확한 SHA의 clean detached checkout으로 검증했다. 대상 realpath는 exact path와 일치하고 symlink가 아니었으며 owner `daon:daon`, mode `0700`이었다.
- 첫 경로 생성은 permission denied였다. Main이 그 exact path에 `sudo install -d -o daon -g daon -m 0700`을 적용해 격리 경로를 준비했다. 초기 5-file pytest collection은 `tests/deploy/test_f17_validation.py`가 WSL에 없는 `sqlalchemy`를 import하여 exit 1이었다. 환경 오류는 경로 권한과 의존성 두 건이며 코드 PASS로 집계하지 않는다. F-17 12개 테스트는 WSL에서 `NOT_RUN`이다.
- 실행 명령: `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider --basetemp=.f18-wsl-pytest-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py`. 결과 exit 0, 67 PASS, 1.17초.
- Main Windows 동일 5-file 범위는 exit 0, 79 PASS, 23.74초. Windows 증거는 WSL F-17 미실행을 대체하지 않는다.
- 정리 전 Git status는 `?? .f18-wsl-pytest-temp/`만 보였다. 검증 후 Main이 realpath·비-symlink·대상 소유권을 확인하고 `sudo rm -rf -- /srv/anvil-wsl/f18-local-qa`로 정확한 격리 경로를 정리했다. 경로 잔류 0. 기존 `local-postgres Up 31h`, `anvil-web Up 31h (healthy)`는 변경되지 않았다.
- WSL QA에서 DB, Docker, 브라우저, `ysna-server`는 접근·변경하지 않았다. 이 PASS는 순수 preflight와 해당 F-16 회귀에 한정한다.

## 미검증·인수

- 첫 WSL F-17 회귀 12개는 `sqlalchemy` 부재로 미실행이었으나 아래 R2에서 같은 12개를 포함한 79건을 재실행해 PASS했다. 79 PASS도 전체 F-18 acceptance 근거는 아니다.
- 이 순수 함수에는 Git checkout 상태·승인 remote·서버 patch를 직접 읽는 기능이 없다. 해당 F-16/서버 preflight 선행 검증을 생략할 수 없고 AV-OPS-021 전체 PASS 근거가 아니다.
- `ysna-server` 접속/조회, `shared-db`, OIDC, object storage, network capability, `envil.sinsan.kr` 브라우저·Network, 실제 DeployApproval, Monitoring/Release는 모두 `NOT_EXECUTED`.
- rollback: Main review 보완 commit, 보고서 commit `f214c6e`, Task 2 commit `88da55f`, Task 1 commit `3a97e06`을 역순 revert한다. Main control 파일·기존 F-16/F-17 파일은 건드리지 않는다.

## Main의 WSL 격리 QA R2 — 2026-09-24

- 신산님의 `진행하자` 뒤 동일 `codex/f18-local-wsl-preflight` 브랜치의 공개 commit `ad0ddb16ed9504563128934a647db3390515e5cc`를 `ssh WSL-server`에서 승인 Git alias로 새 exact `/srv/anvil-wsl/f18-local-qa-r2`에 clone하고 clean detached checkout을 확인했다. 기존 서비스/DB·전역 Python은 변경하지 않았다.
- checkout 내부 `.f18-venv`는 `--system-site-packages`로 생성하고 `uv.lock`의 `SQLAlchemy==2.0.52`와 그 의존 `greenlet==3.5.6`만 가상환경에 설치했다. 전역 설치는 하지 않았다.
- `PYTHONDONTWRITEBYTECODE=1 .f18-venv/bin/python -B -m pytest -q -p no:cacheprovider --basetemp=.f18-wsl-pytest-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py`: exit 0, **79 PASS**, 2.59초. 첫 WSL 실행의 F-17 12 NOT_RUN은 이 동일 5-file 범위에서 해소됐다.
- 정리 전 realpath exact 일치, 비 symlink, `daon:daon` mode `0700`, HEAD `ad0ddb16…`를 확인했다. Git dirty는 checkout 내부 `?? .f18-venv/`와 `?? .f18-wsl-pytest-temp/`뿐이었다. exact 임시 checkout과 두 산출물을 제거한 뒤 경로 잔류 0. 기존 `local-postgres` Up, `anvil-web` Up/healthy 불변이다. 삭제된 임시 패키지/시험 산출물은 복구 불필요하며 소스는 공개 commit으로 복구 가능하다.
- 이 PASS는 Python 계약 회귀에 한정한다. Web 실제 digest 결박, Production Git checkout·`shared-db`, OIDC, object storage, network, `envil.sinsan.kr`, 실제 DeployApproval/Monitoring/Release는 계속 `NOT_EXECUTED` 또는 `NOT_VERIFIED`; F-18 `accepted=false`, F-19 차단을 유지한다.
