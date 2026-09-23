# F-14 제품 구현 완료보고 — developer-primary-f14-r1

## 판정

개발자 할당 제품 범위 `COMPLETED`. F-14 최종 합격은 아니다. Main의 독립 리뷰·G-05 및 WSL-server 격리 PostgreSQL 15/18 실제 migration·backup/restore 검증 전이며, F-17/F-20 RC/운영 승격 증거는 별개다.

## 판단 이유

- 시작 기준: `codex/f14-postgres-recovery`, control HEAD `ec7408cd70797f090e3eba8c2471be8a1015c237`, 시작 `git status --short --branch` clean. 기준 `main`은 `1584523ccca71bae4b3be01f592c7eb79c11935f`.
- canonical SHA-256: 설계 `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`, 계획 `A10A01759496511AF32354BACE84C1FCEF135A57A07247A45B8228E2A1CE0477`, 매트릭스 `999A906EF7D69835EE8C5EFAFD9DE72885BEF5AB3C7A2C1B47B58D7A9628A0BB`, 테스트계획 `9A6AFC5FCDD89C351D2D6E98551472BA362212C8C863E2542BFA93B1723DA102`, 운영규칙 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`. WI `7259563EA1307354AF174EC94B1239AEDA1308A3D977E668A4861C5B21172445`, invocation `191C70A362C45B2788B0CB47341E54289F210B5310F26418D3EEA19F1BBBC84E`. 두 lease 모두 `ACTIVE`, actor 일치, exact12 경로와 token 확인.
- F-13 Operations append/load owner는 새 PostgreSQL `operations_audit_heads` row lock과 sequence CAS transaction으로 구현했다. Audit event payload는 허용 field·scope·same-origin path·hash·actor를 검증하며 secret/token field 또는 URL 성격 문자열을 거부한다. 다중 인스턴스 load와 동시 writer 계약의 실제 DB 판정은 Main 실측 전이다.
- 복구 manifest는 Git SHA, migration head, PG major/image/extension, schema/event sequence, artifact checksum, actor/time/environment 및 dump digest를 담는다. canonical JSON raw checksum sidecar 재읽기, 백업 bytes hash와 restore listing, 격리 대상의 project/run/approval/progress/terminal learning/audit 계보를 비교한다. 단순 dump/list만으로 `RESTORE_VERIFIED`가 되지 않는다. 단, 현재 Windows 테스트는 호출자 제공 관측값을 사용하며 실제 DB 재생 판정이 아니다.
- retention은 artifact metadata type·참조·기간을 이용한 dry-run 판정만 한다. 삭제 side effect는 없다. 데이터 손실 rollback은 단순 dataclass/해시만으로 허용되지 않고, 주입된 canonical approval owner가 해당 subject의 실제 결정을 검증하지 않으면 `DEPLOYMENT_ROLLBACK_DECISION_REQUIRED`로 차단한다. 기본 owner 미결선은 차단 상태다.
- runbook은 검증 결과에 따른 상태·증거·next action을 반환하는 내부 library이며, 공개 `/api` route, CLI, 기본 ASGI 자동 결선이나 실제 DB 실행을 추가하지 않았다. 임의 dict 상태값은 PASS로 승격하지 않는다.

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

최종 Windows 관련 회귀 명령:

`D:\tmp\anvil-main-integration\.venv\Scripts\python.exe -m pytest -q tests/recovery tests/artifacts tests/observability tests/persistence/test_f14_operations_repository.py tests/persistence/test_migration_contract.py tests/persistence/test_postgres_compatibility.py tests/integration/test_f14_postgres_compat.py -o cache_dir=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-pytest-cache --basetemp=C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-pytest-final`

결과: exit `0`, `61 passed, 15 skipped in 1.45s`. Skip에는 `ANVIL_TEST_POSTGRES_DSN` 미설정 PostgreSQL 계약 2건과 기존 PostgreSQL 관련 13건이 포함된다. Windows 단위·계약·정적 migration 가드만 확인했으며 실제 PostgreSQL schema upgrade/downgrade·동시 writer·복원, WSL/Docker, 브라우저/API, Provider, ysna 운영은 `NOT_EXECUTED`다. Main의 G-05와 독립 review도 `NOT_EXECUTED`.

잔여 위험: restore 관측값은 신뢰할 수 있는 host가 격리 DB 재생 결과에서 작성해야 한다. 현재 기본 ASGI에 F-14 owner/runbook은 결선되지 않았으며, fixture PASS를 실제 서비스 PASS로 간주하지 않는다. dump bytes 및 sidecar의 독립 보존·재읽기 운영 경로와 PG15/PG18 실제 복원은 Main 검증 대상이다. 실자료를 포함한 `0016` downgrade는 자동 수행하지 않는다.

Rollback: 미커밋 상태에서는 이 exact12 변경만 작업 branch에서 되돌릴 수 있다(Main 판단). DB 적용 후에는 기존 자료 보존 상태를 확인하고 data-loss 가능 downgrade를 자동 호출하지 않는다. 본 작업은 DB/서버에 적용하지 않았다. `build-progress.json`과 `BUILD_HANDOFF.md`는 지시대로 변경하지 않았고 Main이 결과 판정 후 갱신한다. Commit/push/PR/merge 없음.

임시자원: Windows pytest 전용 `C:\Users\cyhuh\AppData\Local\Temp\anvil-f14-pytest-*` 경로만 사용했다. 테스트 후 해당 prefix를 확인하여 cache 1개를 제거했고, 재조회 결과 잔류 0건이다. Docker/container/DB/서버 임시자원은 생성하지 않았다.
