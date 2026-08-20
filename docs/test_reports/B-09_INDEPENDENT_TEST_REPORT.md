# B-09 Independent Retest Report — R5

- Package: `B-09`
- Tester: 구현 대화와 분리된 독립 Tester
- Tested baseline: `main = origin/main = 7c3382a497e995e18c736a487eee8761aa0c1a05`
- Tested projection: sequence `311`, `B-09 / TEST_REVIEW / PENDING_RETEST`, worker/write lease `null`, B-10 `BLOCKED_PENDING_B09_ACCEPTANCE`
- Tested at: `2026-08-20` (Asia/Seoul)
- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- Retested findings: `BLK-B09-IT-001 CLOSED`, `BLK-B09-IT-002 CLOSED`
- Write scope: 기존 이 보고서 1개만 교체

## 1. 판정

### 판정

`READY_FOR_MAIN_ACCEPTANCE`

### 판단 이유

R4 독립 검증에서 발견한 두 CRITICAL finding을 R5 frozen product에서 독립 재현 경로로 다시 검증했다. 격리 PostgreSQL 18.4에서 max-attempt orphan은 원자적으로 `QUARANTINED`와 `VISIBILITY_TIMEOUT_MAX_ATTEMPTS` evidence를 남겼고 다음 ready job은 오류 없이 claim되어 `BLK-B09-IT-001`이 닫혔다. 실제 Windows junction을 경유한 기존 파일은 canonical path와 같은 `conflict_scope_key`로 수렴했고 repository 밖 absolute path는 `ValueError`로 fail closed되어 `BLK-B09-IT-002`가 닫혔다.

current checkout과 시스템 기본 `core.autocrlf=true` fresh clone에서 focused B-09 `9 passed, 2 skipped`, core `102 passed, 2 skipped`, full tooling `367/367`, standalone checker `4/4`가 모두 통과했다. 격리 DSN을 부여한 focused suite는 `11/11`을 통과했고 migration `0007_progress_outbox -> 0008_queue_worker_leases -> 0007_progress_outbox`, FI-04 3회, stale execution/write fencing, concurrent `SKIP LOCKED`, poison quarantine, rollback 객체 제거와 exact 자원 정리를 확인했다.

### 조치

Main Agent는 이 보고서의 SHA-256과 blocker `0`을 검토한 뒤 별도 B-09 acceptance projection을 수행할 수 있다. 본 Tester는 acceptance, commit, push, B-10 시작, deploy를 수행하지 않았다.

## 2. 기준선과 authority

| 항목 | 결과 |
|---|---|
| canonical HEAD / origin/main | `7c3382a497e995e18c736a487eee8761aa0c1a05` / 동일 |
| canonical dirty projection | 보고서 교체 전 exact `39` paths; frozen product exact15 + Main/Tester R5 completion projection exact24 |
| progress | sequence `311`, `TEST_REVIEW / PENDING_RETEST`, active agent/leases `null` |
| B-10 | `BLOCKED_PENDING_B09_ACCEPTANCE`; 시작·구현·배포하지 않음 |
| `git diff --check` | exit `0` |

Authority와 R5 binding hash는 실제 bytes와 일치했다.

| 문서 | SHA-256 |
|---|---|
| `Anvil_설계서_v2.md` | `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5` |
| `Anvil_작업계획서_v1.md` | `E6ECCB6AD15F81E97A6D2AA663A0C3621BC7B8BB735666F60E2C424CE8763E0D` |
| `Anvil_통합검증매트릭스_v1.md` | `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5` |
| `Anvil_테스트계획서_v1.md` | `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644` |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E` |
| `docs/work_orders/B-09_WORK_INSTRUCTION.md` | `108E951F23FAAC8390D6B17D64A206C127FE73D2776126E8B518EB674166725D` |
| `docs/work_orders/B-09_INVOCATION_PROMPT.md` | `AC7CBD4BD48D81529D265F1757783E5B9C8E0218AAC542BE2167D5E48A7037D4` |
| `docs/work_orders/B-09_MAIN_TAKEOVER_PACKET_R4.md` | `1DBC23B54926D7AC78780FC8FFBDBF3614B4361E466FD9B02E7A9B62DD257526` |
| `docs/evidence/manifests/B-09_REWORK_COMPLETION_PROGRESS_MANIFEST_R5.json` | `78F021659008FD0DAF04820F1DD1616E45BE2A81297FE772751356394ACBBA88` |

## 3. current와 fresh default clone 회귀

fresh clone은 `C:\tmp\anvil-b09-r5-independent-clone-20260820-311`에 baseline을 clone하고 exact 39-path projection의 raw bytes를 overlay해 검증한 뒤 삭제했다.

| 검증 | current | fresh clone |
|---|---:|---:|
| `python -m pytest tests/queue tests/leases tests/paths -q` | `9 passed, 2 skipped` | `9 passed, 2 skipped` |
| domain~paths combined core, `--import-mode=importlib` | `102 passed, 2 skipped` | `102 passed, 2 skipped` |
| `python -m pytest tests/tooling -q` | `367 passed` | `367 passed` |
| `check_a13_repository_scan.py` | PASS | PASS |
| `check_g07_baseline.py` | PASS | PASS |
| `check_phase_g_gate.py` | PASS | PASS |
| `check_project_progress.py` | PASS, sequence 311 | PASS, sequence 311 |

두 skip은 local/fresh 환경에 `ANVIL_B09_PG18_DSN`을 주지 않아 의도적으로 제외된 PostgreSQL integration test다. 별도 격리 DSN 실행에서는 focused `11/11`이 통과했다.

## 4. EvidenceManifest 독립 재계산

current와 fresh clone에서 raw bytes로 동일하게 재계산했다.

| 항목 | 기대 / 실제 |
|---|---|
| exact paths / raw artifacts | `15 / 14` |
| raw checksum error | `0` |
| self-reference / raw self-reference | `false / false` |
| canonical bytes / content bytes | `1474 / 51469` |
| target hash | `0EE80F9B636595125F94E5B5C5E50BC4B703D6DA1E2BDC9D88061DB42A354578` 일치 |
| Product manifest SHA-256 | `5DBBEB29C5788E1D91B092B2239E615E8505C4B2F41F61E061D7A136ACA85F26` 일치 |
| R5 completion manifest SHA-256 | `78F021659008FD0DAF04820F1DD1616E45BE2A81297FE772751356394ACBBA88` 일치 |

## 5. BLK-B09-IT-001 독립 재시험 — CLOSED

고유 격리 PostgreSQL 18에서 아래 순서로 재시험했다.

1. `status=CLAIMED`, `attempts=max_attempts=1`, DB UTC 기준 만료된 `00-r5-max-orphan`을 생성했다.
2. 뒤에 claim 가능한 `01-r5-forward`를 생성했다.
3. `anvil_queue_recover_orphans()` 실행 후 max orphan은 `QUARANTINED / attempts=1`, quarantine reason은 `VISIBILITY_TIMEOUT_MAX_ATTEMPTS`였다.
4. 이어서 `anvil_queue_claim_next('r5-forward-worker',30)`는 `01-r5-forward / CLAIMED / attempts=1`을 반환했다.

이전 `ck_queue_job_attempts` 위반은 재현되지 않았고 max-attempt poison job이 다른 ready job의 forward progress를 막지 않았다. local `DurableQueue` 회귀도 같은 상태 전이와 다음 claim을 확인했다.

## 6. BLK-B09-IT-002 독립 재시험 — CLOSED

`C:\tmp\anvil-b09-r5-path-it-311b\junction-repo`를 canonical repository에 연결된 실제 Windows junction으로 만들고 존재하는 동일 파일을 비교했다.

```text
canonical = ('c:/tmp/anvil-b09-r5-path-it-311b/canonical-repo', 'packages/queue/service.py', 'INSENSITIVE')
junction  = ('c:/tmp/anvil-b09-r5-path-it-311b/canonical-repo', 'packages/queue/service.py', 'INSENSITIVE')
equal     = True
```

`D:\Other\file.py` repository 밖 absolute path는 `path must remain within the repository`로 거부됐다. 검증용 junction과 parent temp directory는 정확한 경로만 삭제했고 잔존하지 않는다.

최초 독립 fixture 실행은 target leaf file을 만들지 않아 junction 내부의 미존재 path가 fail closed로 거부됐다. 이는 제품 실패가 아니라 fixture precondition 누락이며 filesystem alias 대상 파일을 생성한 뒤 동일 절차를 재실행해 위 수렴 증거를 얻었다. 실패 호출은 PASS 집계에 포함하지 않았다.

## 7. WSL PostgreSQL 18 독립 검증

- Container: `anvil-b09-r5-it-pg18-311`
- Network: `anvil-b09-r5-it-net-311`
- Image: `postgres:18-alpine`
- PostgreSQL: `18.4` / `server_version_num=180004`
- Bind: `127.0.0.1:32770 -> 5432`
- Database: `anvil_b09_r5_it_311`

### 결과

1. Alembic `0007_progress_outbox -> 0008_queue_worker_leases`와 DSN-gated focused `11/11`이 통과했다.
2. FI-04 expired-worker 3회는 DB UTC expiry, epoch `1 -> 2`, owner/token rotation, old heartbeat `STALE_FENCING_TOKEN`을 확인했다.
3. current write lease는 허용하고 stale write epoch는 `STALE_FENCING_TOKEN`으로 거부했다.
4. 두 connection은 `FOR UPDATE SKIP LOCKED`로 서로 다른 job을 claim했고 max-attempt fail은 quarantine row를 만들었다.
5. R5 max-attempt orphan quarantine와 next-job forward progress를 별도 hostile SQL로 다시 확인했다.
6. downgrade 전 B-09 table/function은 `4/7`, `0008 -> 0007_progress_outbox` 후 `0/0`이었다.
7. exact container/network만 제거했고 final exact-name filtered listing은 빈 출력이었다.

초기 readiness probe는 entrypoint의 temporary server에서 target database 생성 직전 실행되어 `database does not exist`로 종료됐다. entrypoint가 `CREATE DATABASE`와 final server startup을 마친 뒤 같은 query를 재실행해 PostgreSQL `18.4`를 확인했다. 이 초기화 타이밍은 제품 검증이나 PASS 집계에 포함하지 않았다.

## 8. 검증 ID 판정

| ID | 판정 | 근거 |
|---|---|---|
| `AV-STAT-026` | PASS | FI-04 3회, DB UTC expiry 전 재개 금지와 stale heartbeat 거부 |
| `AV-STAT-027` | PASS | 일반 orphan epoch/token 회수와 max-attempt orphan quarantine·next-job progress |
| `AV-STAT-043` | PASS | stale execution/write token fail closed와 takeover epoch/token rotation |
| `AV-SAFE-028` | PASS | Windows drive/WSL/case 회귀, 실제 junction 수렴, 외부 absolute path fail closed |

## 9. 미실행 경계와 잔여 위험

다음은 B-09 범위 밖이므로 `NOT_EXECUTED`다.

- 실제 API/auth/SSE/same-origin BFF
- 실제 UI/browser/Network
- B-10 intervention/budget과 B-11/B-12
- Provider/외부 API
- ysna-server와 shared-db
- production/public exposure/deployment
- B-09 acceptance, commit, push

현재 alias 검증은 실제 Windows junction과 existing leaf를 대상으로 수행했다. 미존재 leaf는 안전하게 거부되며 후속 C-09 cross-backend path mapper가 새 파일 생성 workflow까지 확장할 때 별도 운영 검증이 필요하다. 이는 이중 lease를 허용하는 동작이 아니므로 B-09 acceptance blocker는 아니다.

## 10. 최종 결과

- Verdict: `READY_FOR_MAIN_ACCEPTANCE`
- Blocking finding count: `0`
- `BLK-B09-IT-001`: `CLOSED`
- `BLK-B09-IT-002`: `CLOSED`
- 제품·authority·progress·HANDOFF·checker 수정: `0`
- 수정 파일: `docs/test_reports/B-09_INDEPENDENT_TEST_REPORT.md` 1개
- commit/push/acceptance/B-10/deploy: `NOT_EXECUTED`
