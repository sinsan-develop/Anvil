# F-18 로컬·WSL 사전검증 보고 — 로컬 작업자 checkpoint

## 판정

F-18 Task 1·2의 로컬 순수 함수 구현과 기본 회귀는 PASS다. WSL 검증은 Main 담당으로 미실행이다. F-18 전체, AV-OPS-013/016/020/021, Production DeployApproval 및 Release는 미완료다.

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

최초 F-16 포함 회귀를 기본 pytest 임시 경로로 실행했을 때 37 PASS/5 ERROR, exit 1이었다. 다섯 오류는 `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh` 접근 거부로 test setup에서 발생했다. 전용 `--basetemp` 재실행 77 PASS가 코드 회귀 판정 근거다. 정식 실패보고 횟수는 0이다.

## 미검증·인수

- Main의 동일 published Git commit WSL 격리 checkout QA, cleanup, canonical G-05 상태 갱신은 미실행.
- 이 순수 함수에는 Git checkout 상태·승인 remote·서버 patch를 직접 읽는 기능이 없다. 해당 F-16/서버 preflight 선행 검증을 생략할 수 없고 AV-OPS-021 전체 PASS 근거가 아니다.
- `ysna-server` 접속/조회, `shared-db`, OIDC, object storage, network capability, `envil.sinsan.kr` 브라우저·Network, 실제 DeployApproval, Monitoring/Release는 모두 `NOT_EXECUTED`.
- rollback: Main review 보완 commit, 보고서 commit `f214c6e`, Task 2 commit `88da55f`, Task 1 commit `3a97e06`을 역순 revert한다. Main control 파일·기존 F-16/F-17 파일은 건드리지 않는다.
