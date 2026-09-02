# C-21 로컬 세션 인증 및 SSE 재개 구현 보고서

## 판정

- 상태: `COMPLETED / LOCAL_IMPLEMENTATION_AND_VERIFICATION`
- 담당: `developer-primary` subagent
- 작업 브랜치: `codex/implement-session-auth-sse`
- 시작 HEAD: `9518dcab52756fed445ae4058a84d26777533d34`
- 원격 배포·운영 DB·NPM·Telegram·Provider 변경: `NOT_EXECUTED`

## 기준선과 권위 문서

| 문서 | SHA-256 |
|---|---|
| `AGENTS.md` | `1E93333379D230EA56058C3395570C96E9AAE98F40D586E6DEA9C1BD920D8246` |
| `Anvil_설계서_v2.md` | `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3` |
| `Anvil_작업계획서_v1.md` | `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18` |
| `Anvil_통합검증매트릭스_v1.md` | `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5` |
| `Anvil_테스트계획서_v1.md` | `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |

시작 시 canonical `main` worktree는 clean이었고, 사용자 작업이 있는 저장소 루트는 수정하지 않았다. 기능 구현은 별도 worktree와 단일 작업 브랜치에서 수행했다.

## 판단 이유와 보안 설계

기존 FastAPI는 세션 principal 및 endpoint별 권한·project·environment 검사를 갖고 있었지만 세션 발급 경로와 런타임 authenticator가 없어 운영 SSE 호출은 항상 401이었다. C-21 검증을 위해 다음의 제한된 테스트 인증 경계를 추가했다.

- 환경변수 구성이 모두 존재할 때만 `/auth/session`을 노출하며 기본값은 비활성화한다.
- 32~256 ASCII 문자의 bootstrap credential을 `Authorization: Bearer`로 한 번 검증한다.
- bootstrap credential을 세션으로 재사용하지 않고 256-bit급 난수 opaque session과 별도 CSRF token을 발급한다.
- 서버는 session 원문이 아니라 SHA-256 digest만 보관하고, 새 발급 시 이전 테스트 세션을 폐기한다.
- session cookie는 `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`, 최대 1시간 이하의 TTL을 적용한다.
- 발급 전 Host·Origin allowlist와 실제 authority/port의 same-origin 결합을 검증하며 실패 시 cookie를 발급하지 않는다.
- cookie 인증 SSE에 Origin이 있으면 동일한 allowlist·authority 결합을 검증한다. Origin이 없는 비브라우저 GET은 기존 계약을 유지한다.
- principal은 `tester` 역할과 `run:events:read` 권한만 가지며, 환경변수에 명시된 project·environment·run allowlist로 제한한다.
- client별 실패 횟수 제한을 적용하고 credential 및 session 원문을 응답·metadata에 노출하지 않는다.
- 단일 process의 session·rate-limit mutable state는 `RLock`으로 직렬화한다.
- OIDC, 운영 사용자 계정, mutation 권한, 인증 우회는 추가하지 않았다.

## 변경 파일

- `packages/api/local_session.py`: 제한된 테스트 session 설정·발급·검증·만료·rate-limit 구현
- `packages/api/fastapi_app.py`: 명시적으로 주입된 경우에만 `/auth/session` route와 secure cookie 발급
- `packages/api/runtime.py`: 환경변수 완전성 검증, SSE 전용 authenticator와 run scope 연결
- `tests/api/test_local_session.py`: 인증 발급, 보안 거부, 권한 격리, 만료, rate-limit, SSE 재개 계약 테스트
- `docs/04_test_reports/C-21_SESSION_AUTH_SSE_REPORT.md`: 작업현황과 검증 증거

## TDD 및 로컬 검증 증거

### 기준선

```text
명령: C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/api/test_sse_resume.py tests/api/test_web_security.py tests/api/test_runtime_app.py -q
결과: 19 passed, warning 1건
```

### RED

```text
명령: C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/api/test_local_session.py -q
결과: 7 failed, 1 passed
이유: session module·발급 route·runtime 설정 연결이 아직 없어서 기대한 실패 발생
```

비 ASCII credential 경계를 추가한 뒤 service 단위 RED에서 `TypeError`가 발생함을 확인하고 401 fail-closed로 수정했다.

### GREEN 및 회귀

```text
명령: C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/api/test_local_session.py -q
결과: 13 passed, warning 1건

명령: C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/api -q
결과: 48 passed, warning 1건

명령: C:\Users\cyhuh\anaconda3\python.exe -m pytest tests/api tests/recovery -q
결과: 65 passed, 13 skipped, warning 1건

명령: C:\Users\cyhuh\anaconda3\python.exe -m compileall -q packages/api tests/api
결과: exit 0

명령: git diff --check
결과: exit 0
```

warning은 기존 Starlette의 `python_multipart` PendingDeprecationWarning이며 이 변경의 실패로 분류하지 않았다.

## 로컬 authenticated SSE 증거

TestClient 기반 실제 FastAPI route 연결에서 다음을 확인했다.

1. 올바른 Host·Origin·bootstrap credential로 session 발급: HTTP 201
2. 발급 응답에 opaque secure cookie와 별도 CSRF token 존재, bootstrap 원문 비노출
3. cookie 인증 후 `/api/runs/run-c21/events`: HTTP 200, `evt-c21-1`, `evt-c21-2`
4. `Last-Event-ID: evt-c21-1`: HTTP 200, strict successor인 `evt-c21-2`만 반환
5. allowlist 밖 `run-other`: HTTP 403, journal read count 0
6. 잘못된 Host·Origin·credential, 만료 session: fail-closed
7. individually allowed이지만 서로 다른 Host/Origin 및 non-default Host port: HTTP 403
8. cookie 인증 SSE의 hostile/crossed Origin: HTTP 403
9. 동시 session 발급: 상태 접근 직렬화, 최종 단일 session만 유효

## 독립 코드 리뷰와 보완

읽기 전용 reviewer는 최초 diff에서 Critical은 없고 다음 Important 3건을 확인했다.

1. Host와 Origin을 별도 allowlist로만 검사해 서로 다른 허용 authority 또는 Host non-default port 조합이 발급될 수 있음
2. cookie 인증 SSE에 hostile Origin이 있어도 server-side 200을 반환함
3. session·rate-limit mutable dict 접근의 동시성 보호가 없음

위 조건을 별도 실패 테스트로 재현한 결과 `4 failed`를 확인했다. same-origin authority/port 결합 검증, SSE의 Origin-present 검증, `RLock` 직렬화를 순차 적용한 뒤 targeted `4 passed`, 최종 session suite `13 passed`를 확인했다.

보완 후 동일 reviewer가 재검토하여 Critical/Important 잔존 항목 없음, C-21 로컬 구현 범위 `Ready: YES`로 판정했다. bounded failure cache와 issuer 내부 오류의 추가 일반화는 Minor 후속 항목으로 남겼다.

## 전체 suite 경계

기본 `pytest -q`는 저장소 기존 중복 test module basename과 fixture sample의 `src` import 때문에 collection 6건에서 중단됐다. 수집 충돌을 배제한 다음 명령은 실행됐지만 전체 PASS는 아니다.

```text
명령: C:\Users\cyhuh\anaconda3\python.exe -m pytest --import-mode=importlib --ignore=tests/fixtures -q
결과: 788 passed, 19 skipped, 28 failed, warning 1건
```

대표 실패 6건(A-13/A-14/G-06/G-07/Phase G/project progress projection)을 변경 전 clean canonical `main`의 동일 HEAD에서도 재실행했고 6건 모두 실패했다. 따라서 해당 failure를 이 변경이 만든 회귀로 판정하지 않지만, 전체 suite는 `NOT_PASSING_BASELINE`로 유지한다.

## 오류와 처리 이력

- PowerShell `foreach` 결과를 직접 pipe한 parser 오류: 같은 원인 2회. 중간 변수에 수집 후 출력하도록 변경했다.
- `rg.exe` 실행 불가: `Select-String`으로 read-only 조사했다.
- `python` command 부재: 설치된 `C:\Users\cyhuh\anaconda3\python.exe`를 사용했다.
- HTTP client가 비 ASCII header 생성 단계에서 거부: service 경계 테스트로 이동해 실제 production `TypeError` RED를 재현하고 401로 수정했다.
- reviewer 보안 재현 테스트: Host/Origin 1건, SSE Origin 2건, 동시 발급 1건이 의도대로 RED(`4 failed`)였다.
- 최초 Origin 보완 patch가 일반 handler에 적용되어 SSE 2건이 계속 실패했다. handler 위치를 추적해 일반 handler 변경을 제거하고 `_sse_handler`에 적용한 뒤 targeted `4 passed`를 확인했다.
- 기본 전체 suite collection 충돌: `--import-mode=importlib --ignore=tests/fixtures`로 실행 범위를 확장하고 기존 기준선 실패를 별도 확인했다.
- 동일 근본 원인 3회 연속 실패는 없었다.

## 미검증 및 잔여 위험

- 운영 배포와 공개 `anvil.sinsan.kr` authenticated SSE는 실행하지 않았다.
- 운영 secret manager에 `ANVIL_TEST_SESSION_*` 값을 생성·등록하지 않았다.
- 이 경계는 C-21 제한 검증용이며 OIDC 또는 운영 인증의 대체물이 아니다.
- runtime 기본 EventStream은 `EmptyEventStream`이다. 운영에서 PostgreSQL event adapter가 주입되지 않으면 인증 성공 후에도 SSE가 `CAPABILITY_NOT_AVAILABLE`일 수 있다. 이 작업은 auth/session 범위만 구현했으며 adapter 구현으로 확장하지 않았다.
- session 저장소는 단일 process 메모리이므로 process 재시작 또는 복수 replica에 걸친 session 공유를 제공하지 않는다. C-21 단일 검증에는 fail-closed이지만 운영 인증으로 승격할 수 없다.
- active rate-limit window에 서로 다른 client key가 대량 유입되면 실패 기록 map이 커질 수 있다. 이 opt-in 단일 운영자 테스트 경계에서 허용한 잔여 위험이며 운영 인증으로 승격하기 전 bounded store가 필요하다.
- 전체 repository suite는 기존 기준선 failure 때문에 PASS가 아니다.

## Rollback

이 작업 commit을 revert하면 test session module, 선택적 발급 route, runtime 연결과 테스트·보고서가 함께 제거된다. 환경변수가 없을 때 기존 runtime 동작은 변경되지 않으며 DB migration이나 운영 정리는 필요하지 않다.

## 다음 조치

Main Agent가 diff와 로컬 증거를 독립 검토한 뒤 이 branch를 통합한다. 원격 C-21 완료에는 별도 범위에서 PostgreSQL EventStream adapter 존재 여부를 확인·보완하고, 승인된 commit/ReleaseManifest로 배포한 뒤 credential을 노출하지 않는 운영 session 발급과 SSE/`Last-Event-ID` 검증을 수행해야 한다.
