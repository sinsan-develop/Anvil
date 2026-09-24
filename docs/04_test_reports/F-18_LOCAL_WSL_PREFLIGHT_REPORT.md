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

## R2 Task 4 — 기존 checkout의 읽기 전용 Git guard

### 판정·기준

로컬 Task 4 구현과 테스트는 PASS다. `validate_existing_checkout`은 기존 `validate_promotion`이 `ready=True`일 때만 F-16 `verify_exact_checkout`을 호출한다. F-16 검증 당시의 `source_git_remote`를 `VerifiedApprovalRelease`에 결박하고, 호출자가 지정한 승인 remote와 다르면 Git guard 전 단계에서 차단한다. 이 결과는 기존 checkout을 읽는 private rehearsal 사전검증이며 실제 Production 승인·배포가 아니다.

- 시작 HEAD `4ff5af03b26f8c17e1d3087b80ffc5ca02613400`, branch `codex/f18-local-wsl-preflight`, 시작 `git status --short` 출력 없음. Canonical seq1501 `ACTIVE`, G-05 checker exit 0 `PASS sequence=1501 reporting=AUTO_CONTINUE`.
- R2 worker lease `worker-lease-f18-local-r2-20260924-001`, execution fence `f18-local-execution-fence-epoch-2-0889fe4137048494`; write lease `write-lease-f18-local-r2-20260924-001`, write fence `f18-local-write-fence-epoch-2-0889fe4137048494`. Exact3 scope는 이 보고서, `packages/deployment/promotion_preflight.py`, `tests/deploy/test_f18_promotion_preflight.py`다.
- 기존 설계·작업계획·검증매트릭스·테스트계획·운영규칙 SHA-256은 위 기준과 동일하다. R2 계획 `D59287F8D13759D865D78977236785DC2194A278A09F3D0FFADD4396BC737631`, invocation `CA4584955BFD91469BE44B27D9335E0280FDCE4FB1AAA390BCA3F76BA7149E5A`.

### RED→GREEN·회귀

| 명령 | exit·실제 결과 |
|---|---|
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_promotion_preflight.py` | exit 1, 새 `validate_existing_checkout` import 누락 — 의도한 RED. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r2-pytest-temp tests/deploy/test_f18_promotion_preflight.py -k existing_clean_detached` | exit 0, 1 PASS/26 deselected. 실제 로컬 bare Git remote/tag의 clean detached checkout을 읽기 전용 검증. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r2-pytest-temp tests/deploy/test_f18_promotion_preflight.py` | exit 0, 27 PASS. remote·tag·commit 불일치, attached HEAD, tracked/untracked dirty, 복사된 비-Git source 차단; Web 증거·approval 부족 시 Git guard 호출 0. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r2-pytest-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py` | exit 0, 90 PASS/35.73초. 기존 F-16/F-17 관련 로컬 회귀 포함. |
| `git diff --check` | exit 0, whitespace 문제 없음. |

합성 F-16 서명 subject는 `git@fixture:approved.git`를 쓰고, 테스트 과정의 `ls-remote`만 실제 임시 bare repository로 전달한다. 원격 tag object와 commit은 로컬 Git 명령으로 검증했다. fixture용 checkout 생성은 테스트 준비 단계에서만 수행했고 제품 함수는 fetch·checkout·파일 변경을 하지 않는다. 구현 중 Python의 다른 `deploy` namespace 충돌과 F-16의 `git@` remote 요구를 확인해 기존 F-16 파일을 바꾸지 않고 격리된 모듈 로드와 테스트 fixture 매핑으로 해결했다. 이들은 정식 실패보고에 해당하지 않으며 정식 실패 횟수 0이다.

전용 `.f18-r2-pytest-temp`는 실행 후 절대경로가 worktree 안에 있음을 확인하고 제거했다. 잔류 0. 이 Task의 제품 변경은 exact3만이며 Main 소유 control 파일은 수정하지 않았다. WSL/ysna-server, DB, Docker, 브라우저, 실제 Provider·OIDC·object storage·network policy는 미실행이다. F-18 `accepted=false`, F-19 차단 경계는 유지한다. Rollback은 Task 4 exact3 commit 한 건을 revert한다.

## Main의 WSL 격리 QA R2 — 2026-09-24

- 신산님의 `진행하자` 뒤 동일 `codex/f18-local-wsl-preflight` 브랜치의 공개 commit `ad0ddb16ed9504563128934a647db3390515e5cc`를 `ssh WSL-server`에서 승인 Git alias로 새 exact `/srv/anvil-wsl/f18-local-qa-r2`에 clone하고 clean detached checkout을 확인했다. 기존 서비스/DB·전역 Python은 변경하지 않았다.
- checkout 내부 `.f18-venv`는 `--system-site-packages`로 생성하고 `uv.lock`의 `SQLAlchemy==2.0.52`와 그 의존 `greenlet==3.5.6`만 가상환경에 설치했다. 전역 설치는 하지 않았다.
- `PYTHONDONTWRITEBYTECODE=1 .f18-venv/bin/python -B -m pytest -q -p no:cacheprovider --basetemp=.f18-wsl-pytest-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py`: exit 0, **79 PASS**, 2.59초. 첫 WSL 실행의 F-17 12 NOT_RUN은 이 동일 5-file 범위에서 해소됐다.
- 정리 전 realpath exact 일치, 비 symlink, `daon:daon` mode `0700`, HEAD `ad0ddb16…`를 확인했다. Git dirty는 checkout 내부 `?? .f18-venv/`와 `?? .f18-wsl-pytest-temp/`뿐이었다. exact 임시 checkout과 두 산출물을 제거한 뒤 경로 잔류 0. 기존 `local-postgres` Up, `anvil-web` Up/healthy 불변이다. 삭제된 임시 패키지/시험 산출물은 복구 불필요하며 소스는 공개 commit으로 복구 가능하다.
- 이 PASS는 Python 계약 회귀에 한정한다. Web 실제 digest 결박, Production Git checkout·`shared-db`, OIDC, object storage, network, `envil.sinsan.kr`, 실제 DeployApproval/Monitoring/Release는 계속 `NOT_EXECUTED` 또는 `NOT_VERIFIED`; F-18 `accepted=false`, F-19 차단을 유지한다.

## Main의 WSL 공개 tag Git 경계 QA — 2026-09-24

- 생성 전 exact `/srv/anvil-wsl/f18-git-gate-qa` 부재를 확인했다. 승인 remote `git@github-sinsan-develop:sinsan-develop/Anvil.git`의 공개 annotated tag `f17-rc-7083e2a`는 tag object `6eda3d5f984b6237250fb460d496970b7182e019`, peeled commit `7083e2aa90ced5bb109fd268cf22e34de34ff6d9`였다.
- WSL에서 위 tag를 mode0700 단일 격리 checkout으로 Git clone했다. 실제 `origin` URL은 승인 remote, HEAD는 peeled commit, 로컬 tag object는 공개 object와 동일, detached HEAD, `git status --porcelain=v1` 빈 출력이었다. 그 checkout에서 기존 `deploy.wsl.f16_staging.verify_exact_checkout`을 승인 remote·commit·tag 입력으로 직접 실행해 exit0을 확인했다. 이는 실제 원격을 사용한 **WSL 측 Git preflight PASS**이며 Production checkout 증거가 아니다.
- 정리 전 realpath exact 일치, 비 symlink, `daon:daon` mode0700, HEAD/clean을 확인했다. exact 임시 checkout 제거 후 경로 잔류0; 기존 `local-postgres` Up, `anvil-web` Up/healthy 불변. DB·Docker·브라우저·Secret·`ysna-server`에는 접속하거나 변경하지 않았다.

## Production 인수에 남은 정확한 증거

1. F-16 형식의 실제 서명된 ReleaseManifest와 독립 신뢰 public key/fingerprint, 관측값이 필요하다. 현재 `docs/evidence`·`deploy`의 JSON에는 F-16 `public_key_fingerprint` 서명 envelope가 발견되지 않았다. `deploy/ysna/ReleaseManifest.json`은 과거 C-21 `AnvilReleaseManifest` 형식과 다른 commit·migration을 가리켜 F-18 ReleaseManifest로 재사용할 수 없다.
   추가 읽기 전용 확인에서 WSL-server의 `/srv/anvil-wsl/evidence`, `/srv/anvil-wsl/control`, `/srv/anvil-wsl/runtime` 아래 깊이 3 이내의 `*release*manifest*.json`·`*evidence*manifest*.json` 경로도 발견되지 않았다. 첫 일반 `find`는 control 경로 권한 거부를 냈고, 동일한 세 정확한 경로의 `sudo find`로 확인했다. `.env` 내용이나 Secret은 읽지 않았다. 이는 조사한 경로의 부재 증거이며 WSL 전체 파일시스템의 전역 부재 선언은 아니다.
2. F-17 RC EvidenceManifest에는 `runtime_image_digest` 하나만 있고 Web/API/Worker 세 digest 결박이 없다. F-17 보고서에 기록된 Web image ID `sha256:5f02bdbbc2e26844e07f3d34208162bdb9a73c82f04670ae223e331281f44a32`는 현재 WSL Docker에서 `No such image`로 조회됐다. 이전 기록만으로 현존·동일 artifact를 증명할 수 없어 preflight는 `WEB_IMAGE_NOT_VERIFIED`를 유지한다. 임의 재빌드 image를 검증된 동일 digest로 간주하지 않는다.
3. 별도 운영 담당 범위에서 `ysna-server`의 승인 Git remote/tag/clean checkout, 실제 Web/API/Worker digest, `shared-db` PG18 전용 DB·role, OIDC·object storage·network capability, `envil.sinsan.kr` browser Network, backup/drain/migration/smoke/rollback/monitoring 및 승인 대상의 environment+manifest+migration+rollback hash를 실측해야 한다. 신산님이 Main의 작업 대상을 로컬·WSL로 한정했으므로 Main은 이 항목에 접속하거나 PASS를 발행하지 않는다.

결론: 로컬·WSL Git 경계와 Python 계약은 검증됐지만 AV-OPS-013/016/020/021의 Production 기준은 미충족이다. F-18 `accepted=false`, F-19 차단, 기존 작업 branch 보존을 유지한다.

## Main의 R2 Task 4 WSL QA — 2026-09-24

- 공개 제품 commit `1c2c5df72cb217c6507dcbd5021f397e108ccd78`을 WSL-server의 승인 Git alias에서 격리 경로 `/srv/anvil-wsl/f18-local-qa-r3`의 clean detached checkout으로 확인했다.
- `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r3-pytest-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py`: exit 0, **78 PASS**, 1.92초. 이는 R2 Git guard를 포함한 F-18/F-16 네 파일 범위다. Main의 독립 Windows 다섯 파일 회귀는 **90 PASS**다. 이전 WSL R2 다섯 파일 79 PASS와 실행 범위가 다르므로 합산하지 않는다.
- 첫 `rm -rf`는 임시 checkout 내부 산출물을 제거했으나 root 소유의 `/srv/anvil-wsl` 부모 경계 때문에 대상 root directory 제거에서 exit 1이었다. 제품 테스트 실패가 아닌 정리 명령 권한 오류 1건이다. Main이 대상의 exact realpath, 비-symlink, 빈 디렉터리, owner `daon:daon`을 확인한 뒤 `sudo rmdir`로 정확한 `/srv/anvil-wsl/f18-local-qa-r3`를 제거해 exit 0, `F18_R3_TEMP_RESIDUE=0`을 확인했다.
- 기존 서비스·DB는 변경하지 않았다. Production은 `NOT_EXECUTED`; 실제 서명 manifest·Web digest·Production capability 미충족으로 F-18 `accepted=false`, F-19 차단을 유지한다. 이 보고서 갱신은 제품 코드·Main control 파일을 수정하지 않는다.

## R3 Task 5 — 서명·approval·기존 checkout 읽기 전용 CLI

### 판정·기준

로컬 Task 5 CLI 구현과 관련 회귀는 PASS다. `python -m packages.deployment.production_preflight_cli`는 독립 expected observations, 서명 manifest와 신뢰 public key/fingerprint, WSL evidence, approval subject, 이미 존재하는 checkout을 입력받는다. 기존 F-16/F-18 검증을 통과한 경우에만 `F18_LOCAL_PREFLIGHT_PASS:<subject_hash>:PRODUCTION_CAPABILITY_NOT_VERIFIED`를 출력한다. 이 표시는 비공개 rehearsal 사전조건에 한정된다. 실제 Production capability·DeployApproval·Release 판정은 아니다.

- 시작 branch `codex/f18-local-wsl-preflight`, HEAD `633c3a99d795a6851971018d2711a19860ff96a3`, `git status --short` 출력 없음. Canonical seq1507 `ACTIVE`, G-05 `PASS sequence=1507 reporting=AUTO_CONTINUE` exit 0.
- R3 worker lease `worker-lease-f18-local-r3-20260924-001`, execution fence `f18-local-execution-fence-epoch-3-21617d772cd4ba8f`; write lease `write-lease-f18-local-r3-20260924-001`, write fence `f18-local-write-fence-epoch-3-21617d772cd4ba8f`. Exact3는 `packages/deployment/production_preflight_cli.py`, `tests/deploy/test_f18_production_preflight_cli.py`, 이 보고서다.
- 설계·작업계획·검증매트릭스·테스트계획·운영규칙 SHA-256은 위 기준과 동일하다. R3 계획 `7FFDB76B2AB5F46A186E352F0E4A333084C286F968A9D01654178C204A5A46FA`, invocation `CE0033CE90BED6475335D65FB371E061FEC0E39C7A761C80F187C42806F47A41`.
- CLI는 approved remote를 기존 F-16 SSH alias로 고정하고 override를 제공하지 않는다. JSON은 중복 키, 추가/누락 필드, 크기 초과, NaN 등 형식 오류를 거부한다. 실패는 원문·경로·secret을 출력하지 않는 안정 code만 반환한다. Git 원격 tag 확인은 기존 F-16 읽기 전용 `ls-remote`에 맡기며 fetch·checkout 생성·배포·DB·Secret·network capability probe를 추가하지 않았다.

### RED→GREEN·회귀

| 명령 | exit·실제 결과 |
|---|---|
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider tests/deploy/test_f18_production_preflight_cli.py` | exit 1, 새 CLI 모듈 없음 — 의도한 RED. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r3-pytest-temp tests/deploy/test_f18_production_preflight_cli.py` | 최종 exit 0, 19 PASS/25.65초. 합성 서명 manifest와 실제 로컬 bare Git checkout의 private rehearsal marker, 서명·approval·Web·commit/image·dirty·attached·remote·JSON·누락 파일 차단, `-m` 진입점의 redacted 실패 포함. |
| `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r3-pytest-temp tests/deploy/test_f18_production_preflight_cli.py tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py` | exit 0, 109 PASS/62.33초. F-16/F-17/F-18 관련 로컬 회귀. |
| `git diff --check` | exit 0, whitespace 문제 없음. |

양성 fixture는 서명 subject에 고정 승인 alias를 기록하고 테스트의 `ls-remote`만 로컬 bare Git remote로 전달한다. 실제 checkout은 clean detached Git이며 CLI는 읽기만 한다. `-m` subprocess는 누락 입력의 안전한 실패를 확인했다. 이는 로컬 fixture 증거이고 실제 운영 서명 manifest·Production remote checkout 증거가 아니다.

전용 `.f18-r3-pytest-temp`는 절대경로가 worktree 안에 있음을 확인한 뒤 제거했다. 잔류 0. 제품 변경은 exact3에 한정하고 Main control 파일은 수정하지 않았다. WSL/ysna-server 접속, push/PR/merge, DB·Docker·브라우저·실 Provider/OIDC/object storage/network 검증은 미실행이다. F-18 `accepted=false`, F-19 차단 유지. 정식 실패보고 횟수 0. Rollback은 Task 5 exact3 commit 한 건을 revert한다.

## Main의 R3 Task 5 독립 Windows·WSL QA — 2026-09-24

- Main의 독립 Windows F-16/F-17/F-18 여섯 파일 회귀는 exit 0, **109 PASS/64.56초**였다. `diff-check` exit 0. 전용 `.f18-r3-main-review-temp`의 exact local 경로를 정리해 잔류 0을 확인했다.
- WSL-server의 새 격리 경로 `/srv/anvil-wsl/f18-local-qa-r4`에서 승인 Git alias로 공개 제품 commit `96b6f17bfe7aa716bd1bb283af5ee3f3d8eae922`의 clean detached checkout을 확인했다. 실행 명령은 `PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r4-pytest-temp tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f18_production_preflight_cli.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py`이며 exit 0, **97 PASS/3.21초**였다. 이는 WSL의 다섯 파일 범위로, Windows 여섯 파일 PASS와 합산하지 않는다.
- 정리 전 대상 realpath의 exact 일치, 비-symlink, owner `daon:daon`, mode `0700`, HEAD 및 Git status의 `?? .f18-r4-pytest-temp/` 한 건만 확인했다. `sudo rm -rf -- /srv/anvil-wsl/f18-local-qa-r4`는 exit 0, 경로 잔류 0이었다. 기존 서비스·DB·Docker 및 Production은 접근·변경하지 않았다.
- 테스트의 서명 manifest는 합성 fixture이며 승인 SSH alias의 `ls-remote`를 임시 로컬 bare Git remote로 매핑했다. 이 PASS는 실제 Production 서명·SSH 정책·운영 checkout·Web artifact의 동일성을 증명하지 않는다. F-18 `accepted=false`, F-19 차단과 Production `NOT_EXECUTED`를 유지한다.

## R3 읽기 전용 리뷰 Minor 테스트 보강 — 2026-09-24

- 리뷰 판정: 기존 CLI 양성 fixture의 expected observations가 signed manifest subject를 복사해 독립 관측 필드 불일치를 직접 시험하지 않았다. 제품 코드 결함은 발견되지 않았다. 같은 서명 manifest 바이트를 유지한 채 expected Web image digest 또는 lockfile hash만 바꾸는 두 사례를 추가했다.
- `C:\Users\cyhuh\anaconda3\python.exe -B -m pytest -q -p no:cacheprovider --basetemp=.f18-r3-review-temp tests/deploy/test_f18_production_preflight_cli.py -k independent_expected_observation_mismatch`: exit 0, 2 PASS/19 deselected. 두 사례 모두 CLI exit 2, stdout 빈 값, stderr `F18_LOCAL_PREFLIGHT_FAILED:INPUT_OR_MANIFEST_NOT_VERIFIED` 한 줄이며 manifest 원본과 checkout clean 상태를 유지했다. 기존 검증 코드가 바로 GREEN이어서 별도 RED는 없었다.
- 같은 `--basetemp`에서 `tests/deploy/test_f18_production_preflight_cli.py tests/deploy/test_f18_deploy_approval.py tests/deploy/test_f18_promotion_preflight.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f17_validation.py`를 실행한 결과 exit 0, **111 PASS/71.96초**. `git diff --check` exit 0.
- `.f18-r3-review-temp`의 절대경로가 worktree 안인지 확인하고 정확한 대상만 제거해 잔류 0. 변경은 CLI 테스트와 이 보고서에 한정한다. `python -m` 성공 subprocess는 test-local Git alias remap을 별도 프로세스에 안전하게 전달하는 경로가 없어 추가하지 않았다. 현재 양성 `main(argv)` integration과 `-m` 실패 진입점 검증을 유지하며, 이를 실제 Production 검증으로 해석하지 않는다. F-18 `accepted=false`, F-19 차단. Rollback은 이 테스트·보고서 보강 commit 한 건을 revert한다.
