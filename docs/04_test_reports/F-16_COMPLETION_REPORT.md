# F-16 Developer Completion Report

## 판정

`COMPLETED` — R2 최소권한 Compose 재작업의 Windows 단위·정적 검증 범위만 완료. Main의 WSL R1 실측에서 `POSTGRES_USER=anvil_app`가 PostgreSQL bootstrap superuser가 되는 Important 결함이 확인되어, 관리자와 runtime 계정을 분리했다. R2 실제 PostgreSQL role/grant·migration·Compose·브라우저·health는 Main 재검증 전이므로 `PASS`로 주장하지 않는다. R2 제품 commit·push·PR·merge는 수행하지 않았다.

## 판단 이유

- 기준 branch `codex/f16-wsl-staging-release-manifest`; R1 시작 HEAD `647bda45cc2dceeae0d8097d0aa8a54a1a790b3b`, R2 시작/현 제품 checkpoint `b5a23c5e0d4ec49433de4688f2717d79a4866486`. R2 시작 시 제품 tree는 clean이었다. 현재 `docs/WORK_STATUS.md` 수정은 Main 소유이며 제품 writer가 건드리지 않았다.
- WorkInstruction SHA-256 `5D2736C65FF3EF286242C780EB7C9925C58231BA9BD426BA489C625DD4A8108A`; invocation SHA-256 `B1B829B97BC30E3B874E46F389963076D60BECA1439485B41DD9236482B935C3`. 설계/계획/매트릭스/테스트/운영규칙 SHA-256은 각각 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`, `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`, `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`, `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`, `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`로 canonical progress와 일치했다. G-05 seq1477 PASS, worker/write lease ACTIVE와 두 fencing token을 시작 전에 확인했다.
- 변경 경로는 아래 exact8뿐이다. 기존 C-21/C-01 배포 스크립트, `local-postgres`, WSL 기존 checkout, 운영 자원, 기타 사용자 dirty/untracked를 변경하지 않았다.

| 경로 | diff 요지 |
| --- | --- |
| `packages/deployment/__init__.py` | host 전용 preflight namespace |
| `packages/deployment/release_manifest.py` | 엄격한 subject/canonical JSON SHA-256, 독립 신뢰 Ed25519 fingerprint·signature, 전체 필수 필드/관측값 검증 |
| `deploy/wsl/f16_staging.py` | 게시된 annotated tag 객체/commit의 clean detached Git checkout, 고정 승인 remote CLI, 실제 lockfile SHA-256·Docker image ID 읽기 전용 preflight |
| `deploy/wsl/compose.f16.yml` | `anvil-f16-staging` 전용 PG15 tmpfs, internal DB/API/Worker, web loopback·same-origin nginx alias, 명시적 image ID/env/cleanup label. R2: bootstrap `anvil_admin`/admin secret와 runtime `anvil_app`/app secret를 분리 |
| `tests/deploy/test_f16_release_manifest.py` | 서명·키·fingerprint·본문·관측값·credential 형태·CLI 순서/차단 34개 테스트 |
| `tests/deploy/test_f16_staging_git.py` | 원격 tag 객체·clean detached 및 공격적 Git 상태 9개 테스트 |
| `tests/deploy/test_f16_staging_compose.py` | 격리·노출·secret placeholder·security policy, R2 최소권한 자격증명 분리 5개 정적 테스트 |
| `docs/04_test_reports/F-16_COMPLETION_REPORT.md` | 본 개발 증거와 한계 |

- TDD RED→GREEN: R1 manifest 모듈 부재 수집 실패→서명 검증 26 PASS; credential/endpoint 모양 provider version 2 FAIL→2 PASS; forged local tag 객체 1 FAIL→1 PASS; Compose 파일 부재 4 FAIL→4 PASS. R2 `POSTGRES_USER=anvil_app`·공유 암호 1 FAIL→관리자/runtime 별도 계정·암호 1 PASS. Git 기본 공격 fixture 8 PASS. R2 focused 최종 합계는 아래 48 PASS.
- 서명 테스트의 Ed25519 private key는 테스트 함수의 합성 메모리 값으로만 생성했다. private key 원문·파일·로그·Git 저장은 없다. Windows Python `C:\Users\cyhuh\anaconda3\python.exe`의 cryptography 43.0.1을 사용했고, Main이 확인한 WSL host cryptography 41.0.7과 공통인 표준 API만 사용했다. host dependency pin 파일은 exact8 밖이므로 추가하지 않았으며 재현성 제약이다.
- preflight CLI는 **서명된 subject와 호출자가 공급한 관측 파일을 비교**한다. Git 원격/tag/checkout, 실제 lockfile, Docker image ID는 독립 측정한다. `db_migration_head`, config revision, provider adapter versions, evidence/report hash는 CLI 자체 측정값이 아니며 Main의 별도 DB·artifact·runtime 검증 없이는 실제 운영 증거가 아니다. 신뢰 public key/fingerprint도 Main이 독립 승인 경로로 공급해야 한다.
- Compose image ID는 preflight가 검증한 digest와 동일하게 환경 변수에 넣어야 한다. CLI가 Compose를 실행하지 않으며 우회 호출을 기술적으로 봉쇄하는 Docker wrapper는 없다. Main의 순서 통제와 실제 QA가 필수다. `fetch_exact_checkout`가 Git fetch 중 실패하면 부분 checkout 디렉터리가 남을 수 있으므로 Main이 정확한 경로를 inventory한 뒤 정리해야 한다.
- `anvil-f16-staging`의 서비스는 `web/api/worker/postgres`, 네트워크는 `anvil-f16-staging_internal`(internal)·`anvil-f16-staging_ingress`, named volume은 없으며 PGDATA는 tmpfs다. 모든 서비스·네트워크에 `F16_ISOLATED_STAGING` cleanup label을 둔다. R2 Compose는 PostgreSQL bootstrap에 `anvil_admin` 및 `ANVIL_F16_PG_ADMIN_PASSWORD`만 전달하고, API/Worker DSN에는 `anvil_app` 및 `ANVIL_F16_APP_PASSWORD`만 전달한다. PostgreSQL 컨테이너에는 앱 암호를, runtime 서비스에는 관리자 암호를 주입하지 않는다. **Compose만으로 `anvil_app` role 생성·최소권한 grant·접속 분리를 보증하지 않는다.** 기존 공유 `local-postgres`는 0.0.0.0:5432 바인딩이며 이를 F-16 보안 PASS로 주장하지 않는다. Main 결정에 따라 F-16은 전용 격리 PG15로 검증하고 설계 §49.11 일반 공유 DB 통합 경로는 F-17 조건/미검증 위험이다.

### 실행 증거

| 명령 | exit / 실제 결과 |
| --- | --- |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f16_staging_compose.py --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f16-focused-freeze` | 0 / 47 PASS, 23.46초 |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/deploy/test_f16_staging_compose.py -k separate_from_non_superuser --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f16-r2-red` | 1 / 예상 RED: bootstrap `anvil_app`·공유 암호 검출 |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/deploy/test_f16_staging_compose.py --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f16-r2-green` | 0 / 5 PASS |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f16_staging_compose.py --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f16-r2-focused` | 0 / 48 PASS, 23.00초 |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/deploy --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f16-r2-deploy-suite` | 완료 전 bounded 중단(exit 1). F16 focused 외 역사 deploy/WSL fixture에서 다수 실패 관찰; suite PASS 아님 |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q tests/deploy --maxfail=1 --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f16-r2-first-failure` | 1 / 37 PASS 후 `test_c01_wsl_formal_single_runtime_contract.py::test_candidate_verification_semantically_rejects_every_injected_stage_failure` 1 FAIL. Windows에서 `wsl -d Ubuntu`가 `4294967295` 반환, stderr 비었고 reader thread UTF-8 decode warning 1건. F16 제품 경로를 호출하지 않은 기존 WSL fixture 환경 경계 |
| `C:\Users\cyhuh\anaconda3\python.exe -m deploy.wsl.f16_staging --help` | 0 / host 전용 CLI 인자 표시, remote override 없음 |
| `C:\Users\cyhuh\anaconda3\python.exe -m compileall -q packages/deployment deploy/wsl/f16_staging.py tests/deploy/test_f16_release_manifest.py tests/deploy/test_f16_staging_git.py tests/deploy/test_f16_staging_compose.py` | 0 / 문법 확인 |
| 기존 `tests/deploy/test_public_deploy_pipeline.py tests/deploy/test_release_manifest_guard.py` 기준선 | 1 / 11 PASS·13 FAIL. Git Bash의 `/c/Users/cyhuh` mkdir Permission denied sandbox TEMP/HOME fixture 문제. 제품 F-16 코드 실패로 분류하지 않으며 완화 재실행은 하지 않았다. |

제품 정식 실패보고 횟수 0. 신규 TDD RED는 의도한 실패이며, 기준선 Git Bash 환경 오류와 R2 역사 WSL fixture 환경 오류는 별도 기록했다. 전체 저장소 회귀 PASS, lint/typecheck/build, R2 WSL Compose, 실제 PostgreSQL role/grant·migration 0016, browser Network, Provider·Telegram 실호출, ysna·PG18·F17 rollback, public domain/사용자 인수는 실행하지 않았다.

## 조치

- Main은 exact8 diff를 독립 검토하고 승인된 tag의 Git-only checkout에서 **서명·관측 파일/독립 신뢰키 → 고정 remote/tag/clean checkout → lockfile/image ID preflight → Compose** 순서를 지킨다. `python -m deploy.wsl.f16_staging`는 읽기 전용 gate이며 Compose를 자동 실행하지 않는다.
- Main의 R2 필수 QA 순서: 격리 PostgreSQL 15만 먼저 기동 → `anvil_admin` 자격증명으로만 0016 migration → LOGIN 가능한 `anvil_app`을 `NOSUPERUSER NOCREATEDB NOCREATEROLE`로 별도 생성하고 필요한 DML/sequence 최소 grants만 부여 → `rolsuper=false` 및 권한을 DB에서 실측 → 그 다음 API/Worker/Web 기동. Role 생성·grants·순서 강제는 Compose 자동화가 아닌 Main 절차이므로 건너뛰면 runtime 접속 실패 또는 과다권한 위험이 있다. 이어서 API/Worker/Web health, 실제 browser same-origin Network, provider 내부 주소/secret 비노출, Main이 독립 측정한 config/provider/evidence/report 값을 기록한다. WSL의 shared `local-postgres`나 기존 배포 자원을 변경하지 않는다.
- 검증 후 rollback은 전용 Compose project만 down, 전용 checkout/합성 키·관측 artifact/임시 DB 자원만 정확한 inventory와 label 확인 뒤 제거한다. 기존 `main`·C21 실행·공유 DB는 그대로 둔다. Main이 progress/HANDOFF와 공식 QA 결과를 별도 갱신한다. 현재 제품 writer는 두 control 파일을 갱신하지 않았다.
