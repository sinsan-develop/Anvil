# F-14 제품 구현 완료보고 — developer-primary-f14-r1

## 판정

개발자 할당 제품 범위 `COMPLETED`(독립 리뷰 R1 Important 3건과 R2 Important 1건 재작업 반영). F-14 최종 합격은 아니다. Main의 재검토·G-05 및 WSL-server 격리 PostgreSQL 15/18 실제 migration·backup/restore 검증 전이며, F-17/F-20 RC/운영 승격 증거는 별개다.

## 판단 이유

- 시작 기준: `codex/f14-postgres-recovery`, control HEAD `ec7408cd70797f090e3eba8c2471be8a1015c237`, 시작 `git status --short --branch` clean. 기준 `main`은 `1584523ccca71bae4b3be01f592c7eb79c11935f`.
- 재작업 기준: Main이 제품 첫 checkpoint `71a466a08edd61fb925838047b7f10c07dbc2512`를 보존했다. 해당 commit에서 시작한 clean 작업트리에 독립 리뷰 Important 3건만 추가 수정했다. 재작업 완료 시 commit/push는 수행하지 않았다.
- canonical SHA-256: 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`, 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`, 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`, 테스트계획 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`, 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`. WI `7259563EA1307354AF174EC94B1239AEDA1308A3D977E668A4861C5B21172445`, invocation `191C70A362C45B2788B0CB47341E54289F210B5310F26418D3EEA19F1BBBC84E`. 두 lease 모두 `ACTIVE`, actor 일치, exact12 경로와 token 확인.
- F-13 Operations append/load owner는 새 PostgreSQL `operations_audit_heads` row lock과 sequence CAS transaction으로 구현했다. Audit event payload는 허용 field·scope·same-origin path·hash·actor를 검증하고, F-13 detector 고정 규칙의 code/source/category/cause/impact/next action/level/dedupe 결박 외 자유 문구를 거부한다. Synthetic `sk-` 형태 문자열의 DB 저장 가능 결함을 RED→GREEN으로 차단했다. 다중 인스턴스 load와 동시 writer 계약의 실제 DB 판정은 Main 실측 전이다.
- 복구 manifest는 Git SHA, migration head, PG major/image/extension, schema/event sequence, artifact checksum, actor/time/environment, dump digest 및 원본 project/run/approval/progress/terminal learning/audit 6개 계보 hash를 담는다. canonical JSON raw checksum sidecar 재읽기와 불변 snapshot, 백업 bytes hash와 restore listing을 검증한다. 격리 대상 계보뿐 아니라 별도 호출자 제공 원본 계보도 sidecar의 결박값과 같아야 하며, 두 호출자 dict를 함께 위조해도 `RESTORE_VERIFIED`가 되지 않는다. 단, 현재 Windows 테스트는 호출자 제공 관측값을 사용하며 실제 DB 재생 판정이 아니다.
- retention은 artifact metadata type·참조·기간을 이용한 dry-run 판정만 한다. 삭제 side effect는 없다. 데이터 손실 rollback은 단순 dataclass/해시만으로 허용되지 않고, 주입된 canonical approval owner가 해당 subject의 실제 결정을 검증하지 않으면 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 차단한다. 기본 owner 미결선은 차단 상태다.
- runbook은 backup/restore/migration뿐 아니라 rollback decision의 입력·상태·증거·next action을 반환하는 내부 library다. Data-loss 가능 rollback의 approval owner 미주입은 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 유지한다. 공개 `/api` route, CLI, 기본 ASGI 자동 결선이나 실제 DB 실행을 추가하지 않았다. 임의 dict 상태값은 PASS로 승격하지 않는다.

## 조치·diff

제품 exact12 경로 중 아래 12개만 신규/수정했다.

1. `migrations/versions/0016_operations_recovery.py` — 기존 `0015` 다음 append-only audit migration; 자료가 있으면 downgrade 차단.
2. `packages/persistence/operations_repository.py` — PostgreSQL CAS owner.
3. `packages/recovery/disaster.py` — manifest/backup/restore/migration evidence 검증.
4. `packages/recovery/retention.py` — dry-run 보존과 승인 owner 결박 rollback.
5. `packages/recovery/runbook.py` — 내부 상태 API.
6. `packages/recovery/__init__.py` — manifest 지연 export.
7. `tests/persistence/test_f14_operations_repository.py` — event secret/scope, cross-instance 및 동시 writer 선택적 DB 계약.
8. `tests/recovery/test_f14_disaster.py` — sidecar checksum, dump/lineage/target mismatch.
9. `tests/recovery/test_f14_retention.py` — 참조 보호·delete 0·forged approval 차단.
10. `tests/recovery/test_f14_runbook.py` — 미검증/forged result 차단 및 검증 result.
11. `tests/integration/test_f14_postgres_compat.py` — PG15/18 분리, downgrade data guard.
12. `docs/04_test_reports/F-14_COMPLETION_REPORT.md` — 본 보고서.

TDD: 신규 모듈 부재 RED(exit 1, import 5건), digest/scope/retention/forged approval/sidecar 변조 등 개별 RED(exit 1)를 확인하고 GREEN으로 전환했다. 정식 동일 원인 실패보고는 `0회`; RED는 의도한 개발 검증이며 정식 `FAILURE_REPORT`로 계상하지 않는다.

독립 리뷰 R1 `SPEC REWORK / QUALITY REWORK`, Important 3건: ① synthetic credential 자유 문구 `_safe_event` 수락 RED(exit 1) → detector 규칙 고정 및 GREEN 1 PASS; ② 원본·대상 lineage dict 공동 위조 RED(exit 1) → sidecar 원본 6계보 결박 및 GREEN 9 PASS; ③ runbook rollback 메서드 부재 RED(exit 1) → canonical owner 결박 상태·증거·next action 제공 및 GREEN 4 PASS. 추가로 restore target 가변 매핑 RED(exit 1) → 불변 snapshot으로 보완했다. 공식 실패보고 횟수는 여전히 0이며 재작업 완료 판단은 Main 독립 재검토 대상이다.

독립 리뷰 R2 `SPEC REWORK / QUALITY REWORK`, Important 1건: credential 문자 부분 문자열 `sk-`를 정상 ID `task-1`에서 발견해 F-13 QueueJob quarantine → detector → audit owner가 `AUDIT_EVENT_INVALID`로 실패하는 경로를 RED(exit 1)로 재현했다. 문자 앞 경계를 검사해 실제 credential 형태만 차단하고, 동일 실경로와 synthetic `sk-` ID 차단을 GREEN 4 PASS/PG 2 SKIP로 확인했다. Main이 같은 worktree의 `tests/tooling/test_f14_progress_overlay.py`를 수정 중인 상태를 확인했으며 해당 파일은 읽거나 수정·정리하지 않았다.

최종 Windows 관련 회귀 명령:

`D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -m pytest -q tests/recovery tests/artifacts tests/observability tests/persistence/test_f14_operations_repository.py tests/persistence/test_migration_contract.py tests/persistence/test_postgres_compatibility.py tests/integration/test_f14_postgres_compat.py -o cache_dir=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-r2-cache --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-r2-related`

결과: exit `0`, `66 passed, 15 skipped in 1.46s`. F-13 실제 detector의 건강 신호와 queue quarantine event가 강화된 저장소 경계를 통과하는 계약 테스트를 포함한다. Skip에는 `ANVIL_TEST_POSTGRES_DSN` 미설정 PostgreSQL 계약 2건과 기존 PostgreSQL 관련 13건이 포함된다. Windows 단위·계약·정적 migration 가드만 확인했으며 실제 PostgreSQL schema upgrade/downgrade·동시 writer·복원, WSL/Docker, 브라우저/API, Provider, ysna 운영은 `NOT_EXECUTED`다. Main의 재검토·G-05는 `NOT_EXECUTED`.

잔여 위험: restore 관측값은 신뢰할 수 있는 host가 격리 DB 재생 결과에서 작성해야 한다. 현재 기본 ASGI에 F-14 owner/runbook은 결선되지 않았으며, fixture PASS를 실제 서비스 PASS로 간주하지 않는다. dump bytes 및 sidecar의 독립 보존·재읽기 운영 경로와 PG15/PG18 실제 복원은 Main 검증 대상이다. 실자료를 포함한 `0016` downgrade는 자동 수행하지 않는다.

Rollback: 미커밋 상태에서는 이 exact12 변경만 작업 branch에서 되돌릴 수 있다(Main 판단). DB 적용 후에는 기존 자료 보존 상태를 확인하고 data-loss 가능 downgrade를 자동 호출하지 않는다. 본 작업은 DB/서버에 적용하지 않았다. `build-progress.json`과 `BUILD_HANDOFF.md`는 지시대로 변경하지 않았고 Main이 결과 판정 후 갱신한다. Commit/push/PR/merge 없음.

임시자원: Windows pytest 전용 `C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-r2-*` 경로만 사용했다. 최종 검증 후 cache 1개를 정확히 확인·제거했고 재조회 잔류는 `0건`이다. Docker/container/DB/서버 임시자원은 생성하지 않았다.

## 2026-09-24 F-14 실제 백업·복원 계보 opt-in 테스트 보강

판정: 개발자 테스트 코드 작성 `COMPLETED`, 실제 PostgreSQL 15/18 실행 `NOT_EXECUTED`(Main 소유). 재작업 시작 HEAD `2aa5690aadb4db80c65627935a6724dd9b58f80c`, branch `codex/f14-postgres-recovery`; 이 follow-up 변경은 exact12 중 `tests/integration/test_f14_postgres_compat.py`와 본 보고서뿐이다. Control/progress, WSL, Docker, PostgreSQL, 운영 DB, commit/push/PR은 건드리지 않았다.

판단 이유: 새 테스트는 `ANVIL_F14_ISOLATED_QA=1`, full 40자 `ANVIL_F14_EXPECTED_GIT_SHA`와 실행 checkout HEAD 일치, PG15/18별 `anvil-f14-pg{major}-<hex>` 컨테이너, loopback 관리 DSN의 지정 포트 `32768`/`32769`·`postgres` DB를 요구한다. 격리 전제가 하나라도 빠지면 DB 생성 전에 fail-closed 한다. 동일 container 내부의 version-matched `pg_dump`/`pg_restore`만 호출한다. 각 major마다 UUID가 붙은 fresh/source/target 세 임시 DB를 생성하고 finally에서 실제 생성 성공을 기록한 DB만 삭제한다. 실패 stderr/DSN은 테스트 출력에 넣지 않는다.

조치: fresh DB의 `0016` up→`0015` 무자료 down; `0015` 기존 DB에 task/run 생성→`0016` up→`0015` down→재-up; 유자료 `0016` down 차단 및 head·audit 보존을 검사한다(AV-OPS-009/022). 합성 project/task, run, approval, progress outbox, terminal learning `run_events`, operations audit 및 artifact metadata를 저장한다. DB 행에서 독립 계산한 6계보 해시·schema·migration head·Git SHA·PG major/vector extension·event sequence·artifact checksum과 실제 dump SHA를 `RecoveryManifest` canonical sidecar에 결박한다. Dump listing/sidecar 재읽기 후 별도 target DB에 restore하고 여섯 계보를 다시 질의해 `RESTORE_VERIFIED`, 이후 target task를 변경해 `RESTORE_LINEAGE_MISMATCH`를 검증한다(AV-OPS-007/008). 외부 artifact byte store 전체 복원, 운영 백업 보존·재시작, WSL 실측 자체는 이 Windows 테스트의 증거가 아니다.

TDD: 격리 가드 테스트를 먼저 추가해 `_isolated_target` 미구현 RED(exit 1, 1 failed/2 passed)를 확인했고 구현 뒤 GREEN(exit 0, 3 passed)을 확인했다. 전체 관련 Windows 명령은 `D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -m pytest -q tests/recovery tests/artifacts tests/observability tests/persistence/test_f14_operations_repository.py tests/persistence/test_migration_contract.py tests/persistence/test_postgres_compatibility.py tests/integration/test_f14_postgres_compat.py -o cache_dir=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-integr-cache --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-integr-related`; exit `0`, `67 passed, 17 skipped in 1.73s`. 새 실제 DB 테스트 2건은 opt-in 환경 미설정으로 SKIP이며 통과로 주장하지 않는다. 이 보강 중 정식 `FAILURE_REPORT` 0회.

Main 실행 조건: 각 major별 격리 container를 소유한 Main이 `ANVIL_F14_ISOLATED_QA=1`, `ANVIL_F14_EXPECTED_GIT_SHA=<실행 checkout full HEAD>`, `ANVIL_F14_PG15_CONTAINER`, `ANVIL_F14_PG15_ADMIN_DSN`, `ANVIL_F14_PG18_CONTAINER`, `ANVIL_F14_PG18_ADMIN_DSN`을 프로세스 한정으로 주입한다. 두 DSN의 호스트/포트/DB는 위 고정값이어야 한다. 실제 실측 exit, 생성·삭제한 DB 잔류, G-05 및 최종 PASS/REWORK 판정은 Main이 별도로 기록한다. 안전 rollback은 변경된 테스트/보고서만 되돌리는 것이며 이 developer는 DB를 만들지 않았다.

Main 사전 안전 재검토 보완: 고정 loopback 포트만으로는 다른 프로세스가 점유한 DB를 배제할 수 없어서 실제 연결 전 `docker inspect` JSON의 정확한 container Name/ID, Running, cleanup-scope label, `5432/tcp`의 단일 loopback port 결박, `Mounts=[]`, PGDATA를 덮는 tmpfs를 검증한다. `ANVIL_F14_PG{major}_IMAGE_DIGEST`가 지정되면 inspect image ID와도 결박한다. port/mount/label/tmpfs 반례를 독립 unit test로 추가했다. 최초 문법 오류 1회(exit 1, test collection 실패)를 수정했고, 의도한 helper 부재 RED(exit 1, 1 failed) → GREEN(exit 0, 4 passed/2 skipped)를 확인했다. 보완 후 전체 관련 회귀는 위와 같은 pytest 파일 집합에 `-o cache_dir=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-guard-cache --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-guard-related`를 사용해 exit `0`, `68 passed, 17 skipped in 1.51s`였다. 실제 PG 2건은 여전히 SKIP이며 제품/환경 실측 PASS가 아니다.

최종 미세 보완: CREATE DATABASE 중 일부 실패한 경우 존재하던 동명 DB를 삭제하지 않도록 생성 성공 목록만 finally에서 순서 역순으로 정리한다. 최종 관련 회귀 동일 파일 집합에 `-o cache_dir=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-final-cache --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-final-related`로 exit `0`, `68 passed, 17 skipped in 1.47s`. 이 실행에 사용한 Windows pytest 임시 경로는 정확한 경로 검증 후 제거했고 잔류 `0건`; DB/container 생성은 `0건`이다.

독립 opt-in 테스트 리뷰 추가 보완: 앞선 finally 삭제 loop는 첫 `DROP DATABASE` 실패 시 나머지 합성 DB를 시도하지 못하고 admin 연결도 닫지 못했다. 세 DB 모두 삭제를 시도하고 `close()`를 무조건 호출하는 helper를 도입했다. 삭제 실패 시 raw DSN/오류 문자열 없이 실패한 정확한 DB 이름만 `F14_CLEANUP_FAILED`에 기록하며, 원래 restore/검증 오류도 발생했다면 둘을 `F14_PRIMARY_AND_CLEANUP_FAILED` 그룹에 함께 보존한다. Helper 부재 RED(exit `1`, 1 failed) → GREEN(exit `0`, focused `5 passed, 2 skipped`); 첫 삭제 실패 후 나머지 시도·연결 종료, 원래 오류+정리 오류 보존을 가짜 admin으로 검증했다. 관련 회귀 동일 파일 집합 `-o cache_dir=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-cleanup-cache --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-cleanup-related`: exit `0`, `70 passed, 17 skipped in 1.60s`. 실제 PG15/18 2건은 여전히 SKIP이며 Main 실측 전이다.

첫 WSL opt-in PG15 Main 실측 후 테스트 전용 수정: Main 보고로 migration 전 SQLAlchemy가 psycopg의 libpq keyword DSN(`user=... dbname=...`)을 URL로 파싱하지 못해 `ArgumentError`가 났고 정리 잔류는 `0건`이었다. 이는 제품 migration 실패가 아니라 테스트 DSN 생성 오류다. `_database_url`을 도입해 이미 격리 검증한 admin URL에서 database 이름만 SQLAlchemy URL 객체로 교체하고 password-escape를 보존한다. 단위 테스트로 SQLAlchemy와 psycopg가 모두 파싱하는 URL임을 확인했다. Helper 부재 RED(exit `1`, 1 failed) → focused GREEN(exit `0`, `7 passed, 2 skipped`); 같은 전체 관련 회귀 `-o cache_dir=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-dsn-cache --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-dsn-related`: exit `0`, `71 passed, 17 skipped in 1.59s`. 이 developer는 WSL 재실행이나 DB 생성·삭제를 하지 않았고 실제 PG15/18 결과는 Main 재실측 전 미검증이다.

## Main 제공 WSL 격리 PostgreSQL 15/18 실측 증거 — 개발자 실행과 분리

판정: Main이 Git-only WSL checkout `3baf8e4e2313849740c4a7199de87ac92d5e356d`에서 F-14의 격리 DB migration·CAS·backup/restore·6계보 검증을 직접 수행했다. 위 Windows 개발자 검증의 `NOT_EXECUTED` 기록은 당시 시점의 사실이며, 아래는 그 후 Main이 제공한 별도 결과다. 이 developer는 해당 명령을 재실행하거나 원시 로그를 독립 확인하지 않았으므로 Main 제공 증거로 표시한다.

- Main이 PG15(image ID prefix `sha256:75f676…`, loopback port `32768`)와 PG18(prefix `sha256:5a9c2d…`, port `32769`) 격리 컨테이너 각각에서 cleanup label, tmpfs, 빈 `Mounts`, loopback 포트 결박을 확인했다. 양쪽 `0016_operations_recovery` Alembic 적용 및 vector extension 설치를 확인했다. 전체 image digest는 이 개발자에게 전달되지 않아 prefix 이상을 기록하지 않는다.
- 양쪽 실제 DB CAS 테스트는 각 `6 PASS`. 별도 DB로 version-matched `pg_dump`/`pg_restore` 후 operations audit 2행 보존을 확인했다. 자료가 있는 복원 DB에서 `downgrade -1`은 양쪽 모두 exit `1`과 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 거부되었고 migration head `0016` 및 audit 2행이 유지됐다.
- opt-in 실제 여섯 계보 테스트는 PostgreSQL 15/18 각각 실행되어 합계 `2 PASS, 7 deselected`. 최종 관련 WSL 회귀는 PG15 DSN과 PG18 DSN 각각 `75 PASS, 13 SKIP`, Alembic deprecation warning 각 `14건`. `SKIP`을 DB/브라우저/Provider PASS로 승격하지 않는다. Main의 명령 원문·전체 stdout은 이 developer가 받지 않았으므로 재구성하지 않는다.
- 첫 opt-in 시도는 migration 이전 테스트 DSN URL 오류로 실패했고 당시 UUID DB 잔류 `0건`; 수정은 위 `_database_url` 회귀와 SHA `3baf8e4…`에 반영됐다. 최종 모든 F-14 UUID DB 잔류 `0건`. Main이 정확히 두 격리 컨테이너를 stop/auto-rm하고 Git-only checkout, dump 및 중단된 pytest 임시물을 제거한 뒤 경로·컨테이너 잔류 `0건`을 확인했다고 보고했다.
- 광범위 `pytest tests` 시도는 중복 모듈 collection 및 yaml/httpx/fixture src 누락으로 실패했고, 다른 광범위 지원 범위 시도는 중단되어 출력이 유실됐다. 둘 다 PASS가 아니다. 기본 host 결선·실제 브라우저·Provider·배포·ysna Production은 미검증이다.

Main의 독립 최종 판정·control/progress/HANDOFF 반영·Git 통합은 Main 소유다. 이 개발자는 이 기록만 추가했고 제품/테스트 파일, WSL/DB/container, commit/push는 변경하지 않았다. 운영 rollback은 검증된 Git 기준점과 독립 backup/manifest를 기준으로 Main이 수행하며, 유자료 `0016` downgrade는 자동 진행하지 않는다.
