# B-02 Independent Test Report

- package: `B-02`
- baseline: `HEAD == origin/main == 0abd0a830432956fc3da18740edbfd07488e3847`
- progress: sequence `213`, `TEST_REVIEW`, worker/write lease `null`
- developer manifest SHA-256: `7D2C102C5ACAC4C49278D2B2262C863CEB459F4528FA789CAC8EEBD740E2B77E`
- developer target: `B5AB576791132542F42F4102725E7159FE271600C1FAA87A0A8D44368CF011F9`
- verdict: `REWORK`
- blocking findings: `1`

## 판정 → 판단 이유 → 조치

**판정: `REWORK`.** persistence interface·migration·compatibility 정적 계약과 실제 격리 PostgreSQL 15/18 migration cycle은 독립 검증을 통과했다. 그러나 canonical completion evidence가 server version number를 `postgresql15_port`/`postgresql18_port`로 잘못 투영한다. 실제 localhost 포트와 의미가 다르므로 evidence truthfulness 계약이 불일치한다.

**판단 이유:** 실제 Tester 포트는 `32771`, `32772`였고 server version numbers는 `150017`, `180004`였다. `B-02_COMPLETION_PROGRESS_MANIFEST.json`은 후자를 `postgresql15_port`, `postgresql18_port`에 기록했다. raw hash와 target은 byte 일치하지만 의미적으로 거짓인 필드까지 정당화하지 못한다.

**조치:** completion successor의 필드를 `postgresql15_server_version_num`/`postgresql18_server_version_num`처럼 의미에 맞게 수정하거나, 실제 port를 기록하려면 해당 실행의 실제 port와 결박해야 한다. 수정 후 successor target·progress checker를 재동기화하고 독립 재검증한다. B-02 acceptance, B-03, commit, push는 수행하지 않는다.

## Blocking finding

### BLK-B02-001-COMPLETION-RUNTIME-FIELD-SEMANTICS — MAJOR

- 위치: `docs/evidence/manifests/B-02_COMPLETION_PROGRESS_MANIFEST.json`의 `runtime_boundary`
- 실제 독립 값:
  - PostgreSQL 15: localhost port `32771`, `server_version_num=150017`
  - PostgreSQL 18: localhost port `32772`, `server_version_num=180004`
- manifest 값: `postgresql15_port=150017`, `postgresql18_port=180004`
- 영향: 소비자가 server version number를 TCP port로 해석하게 하며, 실제 실행 증거의 필드 의미를 왜곡한다.

## 실제 격리 PostgreSQL 검증

- scope: `b02-tester-20260814-7f3c91`
- images:
  - `postgres:15-alpine`, digest `postgres@sha256:fceb6f86328c36f2438fae3b851b0cc57c4a7e69a58c866d9ce24281f2cf0c9c`
  - `postgres:18-alpine`, digest `postgres@sha256:9a8afca54e7861fd90fab5fdf4c42477a6b1cb7d293595148e674e0a3181de15`
- isolation: 고유 network 1개, 고유 container 2개, localhost-only random port, tmpfs PG data, 신규 B02-Tester DB/role. shared/production 자원·credential 재사용 없음.

| 단계 | PG15 | PG18 |
|---|---|---|
| readiness | accepting connections | accepting connections |
| version / timezone / extension | `150017 / UTC / plpgsql` | `180004 / UTC / plpgsql` |
| `alembic upgrade head` | `anvil_metadata`, `0001_base` | `anvil_metadata`, `0001_base` |
| `alembic downgrade base` | `anvil_metadata` absent | `anvil_metadata` absent |
| re-upgrade | `anvil_metadata`, `0001_base` | `anvil_metadata`, `0001_base` |

`migrations/versions/0001_base.py`의 실제 적용 schema는 `version_id`와 timezone-aware `created_at`을 포함한다. 두 환경 결과는 별도 실행했으며 한 버전의 결과를 다른 버전에 재사용하지 않았다.

검증 후 두 exact container와 exact network만 삭제했고 `EXACT_RESOURCES_ABSENT`를 확인했다. 기존/shared/protected 환경은 접근·수정하지 않았다.

## 정적·회귀 결과

| 환경 | 결과 |
|---|---|
| current domain | `14/14 PASS`, 0.006s |
| current persistence | `6/6 PASS`, 0.001s |
| current tooling | `282/282 PASS`, 199.533s |
| current standalone A-13/project/G-07/Phase G | 모두 PASS |
| LF clean clone domain | `14/14 PASS`, 0.006s |
| LF clean clone persistence | `6/6 PASS`, 0.002s |
| LF clean clone tooling | `282/282 PASS`, 202.713s |
| LF clean clone standalone 4종 | 모두 PASS |

Repository는 Protocol `get/save`로 고정되고 domain은 persistence/SQLAlchemy/Alembic/driver를 import하지 않는다. DSN은 환경 주입이며 repr에서 credential을 노출하지 않는다. migration은 exact revision `0001_base`, upgrade/downgrade, UTC-aware column을 보존한다. compatibility는 PG15/18과 `plpgsql`만 fail-closed 허용한다.

## Manifest·no-write

- Developer manifest: exact paths `15`, raw rows `14`, self-reference false.
- target 재계산: canonical `1,454` bytes, content `8,207` bytes, `B5AB5767...011F9` 일치.
- completion target 재계산: canonical `509` bytes, content `13,260` bytes, `5BD61BE3...CCB67` 일치.
- raw hash, duplicate, self-reference, exact expansion, target forgery는 모두 fail-closed.
- hash/byte 무결성 PASS와 `BLK-B02-001`의 의미 불일치는 별개다.
- 제품·fixture·authority·progress/HANDOFF tracked/cached diff는 없고 Tester write는 이 보고서 1개뿐이다.

## 미실행 경계

실제 API, UI, browser, provider, production, deployment는 `NOT_EXECUTED`다. B-02 acceptance, B-03, commit, push도 `NOT_EXECUTED`다.
