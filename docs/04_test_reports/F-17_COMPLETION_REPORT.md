# F-17 Developer Primary R1 완료보고

## 판정

**COMPLETED — exact5 제품 구현·Windows 기본 검증 범위.** F-17 실제 WSL PG15/PG18, Docker, 브라우저, backup/restore, restart, ProductValidation 최종 판정은 Main의 독립 실행 전이므로 **NOT_EXECUTED / 전체 F-17 Gate 미판정**이다. 이 보고서는 실제 운영·RC PASS를 주장하지 않는다.

## 판단 이유

- 기준: `Anvil_설계서_v2.md` SHA256 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`; `Anvil_작업계획서_v1.md` `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`; 통합검증매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`; 테스트계획서 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`; 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`.
- WI SHA256 `B76BC2D471E4E9810BBD01CAEAB778B364D7B22BD9F761116399254DE2FEA9EE`, invocation SHA256 `1DD45EF085F5E2BD37BB2D18CD7DB6BA68C92B7344CD1FBDDC6CFECC6C571714`. G-05 seq1486 PASS, ACTIVE worker lease `worker-lease-f17-r1-20260924-001`, write lease `write-lease-f17-r1-20260924-001` 및 각 fencing token 확인 후 작성했다. 토큰 원문은 산출물에 저장하지 않는다.
- 시작 branch `codex/f17-wsl-pg18-rc`, dispatch HEAD `b77817a09c16571447edd267206d79c34a4ffa08`, 제품 작성 전 Main control checkpoint `feb20d2c34e963b7385da2ab85b0a7ef3ee2c8db` 및 clean status 확인. 작업 중 Main control-only HEAD `9ac7348f5b5c67f72aaa2819c332077de860445d`로 진전; 동일 branch이며 제품 변경은 아래 exact5만이다.
- `deploy/wsl/f17_validation.py`는 exact published SHA·clean checkout·image digest·migration 0016·환경·target hash 불일치에 fail-closed 한다. 실제 관측의 target/environment/evidence hash를 `ProductValidation` **메모리 내 부분 기록**에 결박한다. HTTP+DB 부분 기록은 항상 `NEEDS_IMPROVEMENT`이며 SUITABLE/ReleaseDecision/API 지속화로 승격하지 않는다. Git remote 게시 여부, Docker image ID 및 DB 실측은 입력값과 별개로 Main이 독립 검증해야 한다.
- `deploy/wsl/compose.f17.yml`은 PG18 전용 project `anvil-f17-pg18-rc`, postgres/web/api/worker, internal+ingress 네트워크, PGDATA tmpfs, volume 0, DB·Web loopback 단일 노출, cleanup label `F17_ISOLATED_PG18_RC`, admin/app credential 분리 및 API/Worker 비-superuser `anvil_app` 연결을 선언한다. **Compose만으로 실제 role 생성·최소 grant·image ID·tmpfs/label/port 상태가 증명되지 않는다.** Main이 admin 0016 migration 후 app role 생성/실측해야 한다.
- `tests/integration/test_f17_runtime_e2e.py`는 명시적 opt-in 이외에는 skip한다. 같은 코드로 PG15 WSL host loopback 전용 `anvil_f17_*` DB/role 및 PG18 격리 QA DB를 선택하고, migration head/PG major/vector extension·query/non-superuser role/ready 200을 DB·HTTP에서 확인한다. synthetic session으로 실제 Task create/read, **QA DB 안에서만** 합성 승인 계보 및 task CONFIRMED 상태를 seed한 후 Run create, DB task/run/event 행을 비교한다. Run ID를 얻은 뒤 API의 `ANVIL_TEST_SESSION_RUN_IDS`에 정확히 추가하여 재기동하고 `events` phase를 재실행한다. SSE는 첫 `id:`만 bounded streaming으로 읽고 DB event ID와 대조한다. 이 fixture는 실제 사람 승인이나 전체 UI 흐름을 입증하지 않는다. `Secure` session cookie를 HTTP에서 수동 재전달하지 않는다. Main의 임시 HTTPS loopback proxy `https://127.0.0.1:8443`와 명시된 임시 CA 파일을 이용해 정상 cookie jar/TLS 검증을 수행한다.
- Opt-in guard의 `anvil_f17_` 접두사 및 loopback 포트는 필요조건이지 실제 자원 소유권 증명이 아니다. Main은 실행 전에 exact DB/role 생성 기록, PG15 공유 기존 `anvil` DB 및 `anvil_app` role 보존, PG18 container/image/label/tmpfs/no mounts/port를 독립 검증해야 한다. F-14의 별도 격리 테스트 container와 F-17 Compose의 label·대상은 다르며 서로 증거를 대체하지 않는다.
- Main 독립 리뷰 Important 1에 따라 opt-in DB DSN username이 `ANVIL_F17_APP_ROLE`과 같아야 하며, 연결 후 `current_user` 일치·database/schema CREATE 권한 없음과 `rolsuper=false`, `rolcreatedb=false`, `rolcreaterole=false`, `rolcanlogin=true`를 확인한다. 관리자 DSN으로 조회하고 비권한 role의 존재만으로 통과하는 경로를 차단했다. PG18 Compose API는 `ANVIL_AUTH_MODE=WSL_ACCEPTANCE`, `ANVIL_RUNTIME_ENVIRONMENT=WSL_SERVER_TEST_STAGING`을 명시하고 PG15 host API에도 Main이 동일 설정을 주입한다. 실제 mode/session 흐름은 WSL 실측 전 미검증이다.

### 제품 변경 경로

1. `deploy/wsl/f17_validation.py` — target/부분 검증 기록 경계 신규.
2. `deploy/wsl/compose.f17.yml` — PG18 RC 격리 Compose 신규.
3. `tests/deploy/test_f17_validation.py` — target/오염 차단·Compose 정책 테스트 신규.
4. `tests/integration/test_f17_runtime_e2e.py` — 동일 PG15/18 실제 API+DB opt-in 및 guard 신규.
5. `docs/04_test_reports/F-17_COMPLETION_REPORT.md` — 본 보고.

기존 C-01/C-21/F-14 코드·guard 및 control/progress는 변경하지 않았다. Main은 progress/HANDOFF 갱신 소유자이며 Developer는 쓰지 않았다.

### 실행 증거와 오류

| 명령 | exit / 실제 결과 |
|---|---|
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q -p no:cacheprovider tests/deploy/test_f17_validation.py` (첫 실행) | 1 / 구현 전 import RED |
| 같은 명령 (Compose 테스트 추가 직후) | 1 / Compose 파일 부재 RED, 기존 10 PASS |
| 같은 명령 (구현 후) | 0 / 11 PASS |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q -p no:cacheprovider tests/integration/test_f17_runtime_e2e.py` | 0 / 최초 unit guard 1 PASS, live 2 SKIP |
| 같은 통합 테스트 (환경별 포트 오염 RED 추가 직후) | 1 / guard 누락 RED, 이후 수정 |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q -p no:cacheprovider tests/deploy/test_f17_validation.py tests/integration/test_f17_runtime_e2e.py` | 0 / 12 PASS, 2 SKIP, 1 Starlette deprecation warning |
| `C:\Users\cyhuh\anaconda3\python.exe -m pytest -q -p no:cacheprovider tests/deploy/test_f17_validation.py tests/integration/test_f17_runtime_e2e.py tests/deploy/test_f16_staging_compose.py tests/deploy/test_f16_release_manifest.py tests/api/test_local_session.py` | 1 / 기존 pytest 기본 temp root `pytest-of-cyhuh` 접근거부로 5 fixture ERROR, 제품 실패 아님; 75 PASS/2 SKIP |
| 같은 명령 + `--basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f17-pytest-20260924-a1` | 0 / 80 PASS, 2 SKIP, 1 Starlette warning |

이후 Secure cookie/HTTPS 경계 재작업에서 수동-cookie 전송 요구가 RED로 드러났고, 우회 금지 판정에 따라 HTTPS/TLS 경계로 변경했다. Compose HTTPS origin RED도 확인 후 수정했다. 마지막 코드 이후 동일 suite를 고유 `--basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f17-pytest-20260924-a3`로 재실행하여 **exit 0 / 81 PASS, 2 SKIP, 1 warning**이었다. 기대된 TDD RED 5회, 환경 오류 1회, 미해결 제품 오류 0회.

Main 독립 리뷰의 admin-DSN 오판과 WSL_ACCEPTANCE mode 누락을 각각 RED로 재현한 뒤 수정했다. 최종 관련 suite를 `--basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f17-pytest-20260924-a5`로 재실행하여 **exit 0 / 82 PASS, 2 SKIP, 1 warning**이었다. 누적 기대 RED 7회, 환경 오류 1회, 미해결 제품 오류 0회. live 2 SKIP은 여전히 실제 PG15/18·HTTPS PASS가 아니다.
추가 basetemp `a4/a5` 및 재생성된 F17 이름의 세 `.pyc`도 exact path 확인 후 제거했고 잔류 확인은 모두 `False`였다.

테스트가 만든 정확한 basetemp `anvil-f17-pytest-20260924-a1/a2/a3` 및 F17 이름의 세 `.pyc`만 확인 후 제거했고 존재 확인은 모두 `False`였다. 마지막 `git status --short --untracked-files=all`은 위 exact5 신규 파일만 표시했다. 전역 Git ignore 파일 접근 경고는 sandbox 환경에서 발생했으며 제품 diff나 판정에 반영하지 않았다.

## 조치·Main 인계

- Main이 F16 PR #32의 정확한 published Git/image 및 F17 시작 target을 독립 확인하고 PG15 전용 DB/role 생성 → 0016/vector → WSL host-loopback API 8301, PG18 별도 Compose project DB 32769/Web 8300 순서로 실측한다. 두 환경은 순차적으로 임시 HTTPS loopback proxy 8443을 통해 접근한다. 일회성 SAN `127.0.0.1` 인증서/키 및 CA는 Main이 제한 권한으로 생성·신뢰·삭제하며 Production trust가 아니다. PG18 admin credential은 postgres/bootstrap/migration에만, API/Worker에는 app credential만 사용한다. PG15 기존 `anvil` DB/role 및 공유 설정/network는 수정하지 않는다.
- Opt-in harness에는 프로세스 한정 환경으로 `ANVIL_F17_ALLOW_LIVE=1`, `ANVIL_F17_QA_DSN`, `ANVIL_F17_API_URL=https://127.0.0.1:8443`, `ANVIL_F17_CA_FILE`, `ANVIL_F17_ENVIRONMENT`, `ANVIL_F17_PROJECT_ID`, `ANVIL_F17_APP_ROLE`, `ANVIL_F17_TARGET_HASH`, `ANVIL_F17_GIT_SHA`, `ANVIL_F17_IMAGE_DIGEST`, `ANVIL_F17_SESSION_TOKEN`, `ANVIL_F17_PHASE=create`를 주입한다. 테스트 응답의 `run_id`만 기록하고 API 세션 allowlist에 넣어 재기동한 뒤 동일 QA DB에서 `ANVIL_F17_PHASE=events`와 `ANVIL_F17_RUN_ID`로 다시 실행한다. secret/DSN은 보고서·로그에 쓰지 않는다. HTTP/DB 예외는 stage만 출력하도록 redaction한다.
- Main은 **별개** 15/18 migration/extension/query, version-matched dump/restore, project/task/run/approval/progress/terminal 6계보, 유자료 downgrade 차단, restart/health, 1920/390 브라우저 same-origin/노출 0을 실제 실행·기록하고 환경별 evidence manifest·criterion별 최종 ProductValidation 판단을 만든다. 본 harness의 부분 기록 또는 F-14 역사 PASS만으로 전체 AV-OPS-015/025·RC PASS라 하지 않는다. ProductValidation 공개 API는 여전히 501이고 F17 범위 밖이다.
- 실패 시 변경된 것은 전용 QA DB의 synthetic rows만이다. Main은 작업 전 inventory와 대조해 **정확히 만든** F17 DB/role, PG18 Compose project/container/network/tmpfs/checkouts/browser profile/credential/process만 제거한다. 기존 shared PostgreSQL 설정, DB/role 및 운영 데이터에 대한 자동 rollback·drop은 없다. 유자료 migration downgrade는 F-14 계약대로 차단한다.
- WSL/Docker/PG15/PG18/실 브라우저/backup·restore/6계보/restart/role grant/cleanup 잔류 **NOT_EXECUTED by Developer**. Main의 formal 결과가 오기 전 최종 사용자 인수, 운영 배포, ysna/Oracle, 실 Provider, PR/merge는 주장하지 않는다.
