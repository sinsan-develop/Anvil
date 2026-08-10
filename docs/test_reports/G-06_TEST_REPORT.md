# G-06 독립 테스트 보고서

## 1. 판정

- Work Package: `G-06`
- 판정: **FAILURE_REPORT / REWORK_REQUIRED**
- `AV-GATE-005(fixture 기준)`: **FAIL**
- `AV-SAFE-010(fixture 준비)`: **PASS**
- 차단 finding: **3건** (`G06-DEF-001`~`003`)
- `ACCEPTED`, commit, push, G-07 시작은 수행하지 않았다.

## 2. 판단 이유

Developer의 대화·결론을 근거로 사용하지 않고 권위 문서, WorkInstruction revision 2, Invocation, 현재 raw workspace를 직접 읽었다. 8개 fixture를 각각 새로운 OS temp 경로의 실제 Git repository로 materialize하고 branch·HEAD·status·test·tool·manifest를 독립 대조했다. 현재 제출된 fixture/golden/scenario/FI 값과 hash는 일치하지만, 결정성 및 변경 방지 계약에 세 가지 우회가 있어 Package exit 조건의 `blocking defect 0`을 만족하지 못한다.

### 2.1 기준선·hash

| 항목 | 독립 관측값 | 결과 |
|---|---|---|
| Branch / HEAD | `main` / `a70daa4933099b33c76575e0f278f22e15016649` | 일치 |
| WorkInstruction | `WI-G-06-20260810-002` / `F8A966191412E3CC4CC29DC752169BC21B9E98CFD702134303F212454924352E` | 일치 |
| Invocation SHA-256 | `F2F9B857903B6E63322917E8FE7A920EAF7CF27C90123ACC2D2BA15A48359B1A` | 일치 |
| 설계서 / 작업계획서 | `246D0487...A9A5` / `4DB8F5F5...7475` | WI binding 일치 |
| 검증매트릭스 / 테스트계획 | `0A0CEA88...45D3` / `870BC8CA...DC5` | 권위 기준 일치 |
| G-06 Manifest file SHA-256 | `05D03F69D0CCCA5DC2B8CA0406BC30B5CFF09BC908F8CBFC1A655D883304CB6A` | raw file 재계산 |
| Manifest content hash | `0D18B1378725EC3347D5435D79BF387D43115E391008FA013429B145D420055D` | 기록값 일치 |
| raw checksum | 15/15 bytes·SHA 일치 | PASS |
| target canonical/content bytes | `1668` / `133417` | 기록값 일치 |
| target / delivered | `806E5DC6B4A380A07A4C1733BF3DBB05CE169C5760D91E3F25021A65E6EBF119` / 동일 | MATCH |
| G-06 detached file | `FE0563B9C5C1C7811FAEF4021EF1F7192406AA586F57D1A9D6027682B20F967A` | current ref·manifest row 일치 |
| progress file / canonical | `C110343F...EEE` / `BADACAD9...BCC` | detached와 일치 |
| snapshot | `84664A07D8ACD3C927BD4C933AEE5E59F695898851333C20C8DA884262906DD9` | 기록값 일치 |
| HANDOFF file / summary | `BBA5C3B9...B04` / `DE7B7F17...57A` | detached와 일치 |
| event sequence | progress/HANDOFF/detached 모두 `9` | 일치 |

`target_algorithm`의 UTF-8 byte ordinal 경로 정렬, `path<TAB>decimal_bytes<TAB>uppercase_sha256`, LF, final newline 없음 규칙을 그대로 독립 재계산했다.

G-05 accepted evidence의 byte 불변도 Git `HEAD`와 직접 비교했다.

- `docs/evidence/manifests/G-05_EVIDENCE_MANIFEST.json`: diff 0, SHA-256 `B8BCC1C6D5C409060DF73D0F8CDF25B5C07A9E22941DB65878972E776A971083`
- `docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json`: diff 0, SHA-256 `F9A5E7168B9B68B70D74B68DD495211BDC7961223E5E48CFC6F565638B9E69E6`
- generic detached: diff 0, SHA-256 `BF4C0037118F49DD4137AFB7279AE92AE573AA76EB3677B4E5592C49773AB438`

Package별 detached resolver는 G-06 고유 경로를 current ref로 사용하고 `../outside.json`을 거부하며, 과거 G-05 manifest는 동결 raw row/target만 검증하는 회귀를 통과했다.

### 2.2 8개 fixture 실제 materialization

각 fixture를 서로 다른 새 temp directory에 생성했다. 원본 Anvil workspace에는 nested `.git` 또는 `node_modules`를 만들지 않았다.

| Fixture | 실제 독립 관측 | 결과 |
|---|---|---|
| `FIX-PY-CLEAN` | branch `main`, HEAD `5d13d88b...`, clean status, unittest exit 0 | PASS |
| `FIX-PY-DIRTY` | ` M src/calc.py`, `?? notes/local-note.txt`; read-only status 검사 전후 2개 파일 content·bytes·mtime_ns·SHA 완전 동일 | PASS |
| `FIX-PY-REDFAIL` | branch `main`, HEAD `7474bdbb...`, unittest exit 1 및 지정 failure 재현 | 실패 상태 재현, fingerprint 결정성 FAIL |
| `FIX-TS-CLEAN` | `npm ci --offline --ignore-scripts`, local `node_modules/.bin/tsc.cmd --version`=`Version 5.9.3`, local typecheck exit 0 | PASS |
| `FIX-TS-NOTOOL` | `node_modules`·local executable 없음, 격리 PATH에서 `BLOCKED TOOL_NOT_INSTALLED`; global fallback 없음 | PASS |
| `FIX-PROTECTED` | 합성 marker 존재, actual-looking secret 0 | PASS |
| `FIX-LARGE` | module 24개, `module_01 → module_02 → module_01` cycle | PASS |
| `FIX-CONFLICT` | 두 Step의 canonical write path가 모두 `src/shared.py` | PASS |

8개 source aggregate hash와 각 manifest의 file bytes/hash도 독립 재계산해 모두 일치했다.

### 2.3 Golden·scenario·FI 현재값

- Golden: 8/8, fixture 1:1, 현재 case canonical content hash와 lock hash가 전부 일치하고 WI SHA 및 approval ref도 일치한다.
- §49.17: `S49-17-01~20` 20/20의 AV ID, 권위 매트릭스 책임 Package, evidence type을 독립 표와 대조해 현재값 차이 0이다.
- FI: `FI-01~08` 8/8, AV mapping과 minimum repeat `3`, `implementation_status=DESIGN_LOCKED`, `execution_status=NOT_EXECUTED`가 모두 일치한다.
- false runtime `PASS`, trace 필드 공백, actual-looking secret 변형은 각각 `SCENARIO_FALSE_PASS`, `SCENARIO_PACKAGE_REQUIRED`/`SCENARIO_EVIDENCE_REQUIRED`, `ACTUAL_LOOKING_SECRET`로 거부됐다.

현재값의 정합성과 checker가 승인되지 않은 의미 변경을 막는 것은 별개의 조건이다. 다음 세 우회 때문에 전체 판정은 실패다.

## 3. 차단 finding

### G06-DEF-001 — REDFAIL fingerprint가 실행시간에 따라 달라짐

- 판정: **BLOCKING MAJOR**
- 재현: 동일 materialized `FIX-PY-REDFAIL`에서 정확한 manifest test command를 `PYTHONDONTWRITEBYTECODE=1`로 30회 실행했다.
- 실제 결과:
  - SHA `015CC452F6900E3100F5EE6AA70E1079910472752A3C691800E924E07D361A6F`: 26회, `Ran 1 test in 0.001s`
  - SHA `1393FC49156C143F67EEB8449D5F2E121D5423EB390AE20DD8E1F28D57F64A4E`: 4회, `Ran 1 test in 0.000s`
- 원인: path만 `<FIXTURE_ROOT>`로 정규화하고 unittest elapsed time을 그대로 hash한다.
- 영향: 동일 source·동일 failure가 실행마다 golden fingerprint match 또는 mismatch가 되어 결정론적 baseline failure 계약을 위반한다.
- 조치: fingerprint 입력에서 elapsed time 등 비의미 가변값을 제거하고 안정 failure identity·message·test ID만 canonicalize한 뒤 RED/GREEN/반복 검증을 추가한다.

### G06-DEF-002 — 잘못된 non-empty Package/evidence trace가 허용됨

- 판정: **BLOCKING CRITICAL**
- 재현: `S49-17-01`을 `responsible_package="G-99"`, `evidence_types=["E-FAKE"]`로 바꾸고 scenario-index file hash를 실제 변경 파일 hash로 갱신했다.
- 실제 결과: `validate_bundle()` error `[]`; checker가 잘못된 권위 trace를 승인했다.
- 원인: AV ID만 `SCENARIO_MAP`으로 고정하고 Package와 evidence는 non-empty 여부만 검사한다.
- 영향: §49.17의 AV/Package/evidence 1:1 권위 mapping이 조용히 변조될 수 있다.
- 조치: 권위 매트릭스에서 파생·고정한 exact scenario mapping에 AV ID, Package 집합, evidence 집합을 모두 결박하고 wrong-but-nonempty mutation을 회귀에 추가한다.

### G06-DEF-003 — Golden case와 lock의 동시 재작성 우회

- 판정: **BLOCKING CRITICAL**
- 재현: `GC-PY-CLEAN-01.expected_result_status`를 `FAILURE_REPORT`로 변경하고 case content hash를 재계산한 뒤 `golden-lock.json`의 해당 hash도 같은 값으로 바꿨다. 새 신산님 승인, old/new hash lineage, supersedes 갱신은 하지 않았다.
- 실제 결과: `validate_bundle()` error `[]`; 조정된 expected가 기존 root approval ref로 통과했다.
- 원인: lock과 case가 상호 일치하는지만 검사하며, exact 승인 subject에 고정된 사전 golden set 또는 승인된 old/new revision chain을 검증하지 않는다.
- 영향: 구현 결과를 본 뒤 expected와 lock을 함께 다시 쓰는 행위를 탐지하지 못해 golden 사전 동결 계약과 false-PASS 방지 근거가 무효화된다.
- 조치: 최초 golden 8개 exact hash 집합을 별도 승인 subject/immutable baseline에 결박하고, 변경 시 새 human approval + old/new hash + supersedes chain을 checker가 강제하도록 한다. coordinated rewrite mutation을 회귀에 추가한다.

## 4. AV 판정

| 검증 ID | 판정 | 판단 이유 |
|---|---|---|
| `AV-GATE-005(fixture 기준)` | **FAIL** | 직접적인 `execution_status=PASS` 변형은 거부되지만 golden 동시 재작성 우회와 REDFAIL 비결정성으로 fixture 결과의 정직하고 재현 가능한 기준을 보장하지 못한다. |
| `AV-SAFE-010(fixture 준비)` | **PASS** | `FIX-PY-DIRTY`의 tracked dirty/untracked path·content·bytes·mtime_ns·SHA가 read-only 검사 전후 완전히 보존됐다. 원본 workspace도 Tester 보고서 외에는 수정하지 않았다. |

## 5. 실행 명령·exit·출력

| 명령/독립 audit | Exit | 핵심 실제 출력 |
|---|---:|---|
| `python -m unittest tests.tooling.test_g06_test_assets tests.tooling.test_project_progress tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries` | 0 | `Ran 68 tests in 16.638s`, `OK` |
| `python scripts/check_g06_test_assets.py .` | 0 | `fixtures=8 golden=8 scenarios=20 fault_injections=8` |
| `python scripts/check_project_progress.py .` | 0 | `PASS sequence=9 reporting=AUTO_CONTINUE` |
| G-04/G-03 checker | 0/0 | `8 templates validated`; dependency violation 0 |
| 독립 8-repository materialization audit | 0 | `MATERIALIZED=8/8 FAILURES=[]` |
| 독립 REDFAIL 30회 반복 | 3(의도된 비결정성 검출) | `UNIQUE=2 EXPECTED_SEEN=True` |
| 독립 target/detached audit | 0 | `raw_mismatches=[]`, `G06_HASH_BINDING_OK=True` |
| 독립 golden/scenario/FI authority audit | 0 | `SCENARIOS=20`, `GOLDEN=8`, `FI=8`, current errors `[]` |
| 독립 적대 mutation audit | 0 | expected guards 3종 정상; `WRONG_TRACE_BYPASS=True`, `GOLDEN_REWRITE_BYPASS=True` |
| G-05 immutable paths `git diff --exit-code HEAD -- ...` | 0 | 출력 없음 |

통과한 68개 회귀는 현재 구현이 자체 테스트와 일치함만 증명한다. 독립 반복·coordinated mutation에서 발견된 세 우회를 상쇄하지 않는다.

## 6. 조치

1. `G06-DEF-001~003`을 WorkInstruction revision으로 보완하고 동일 재현을 회귀 테스트에 고정한다.
2. 수정 후 8개 fixture를 다시 각각 새 temp Git repository로 materialize하고 REDFAIL을 충분히 반복해 fingerprint 단일성을 확인한다.
3. wrong-but-nonempty Package/evidence와 case+lock coordinated rewrite가 stable reason code로 거부되는지 독립 재검증한다.
4. 세 finding closure와 blocking defect 0 전에는 G-06를 `ACCEPTED`로 전환하거나 commit/push/G-07을 시작하지 않는다.

## 7. 범위 제한

- 본 검증은 fixture source, disposable local Git repository, offline local TypeScript, JSON/Markdown 계약, checker, hash와 mutation에 한정한다.
- §49.17 20개 runtime scenario와 FI-01~08의 실제 fault injection은 설계대로 `NOT_EXECUTED`다.
- 제품 API, UI, 브라우저/Network, DB/outbox/crash, Docker, WSL/서버, 배포, Monitoring, Release는 **범위 밖이며 검증하지 않았다**.
- fixture/static 결과를 제품 또는 운영 PASS로 승격하지 않았다.
- Tester가 workspace에 작성한 파일은 이 보고서 하나뿐이며 기존 변경 파일은 수정하지 않았다.
