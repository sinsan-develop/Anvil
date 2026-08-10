# G-06 Revision 3 독립 재검증 보고서

## 1. 판정

- Work Package: `G-06`
- 판정: **PASS / READY_FOR_MAIN_ACCEPTANCE**
- `G06-DEF-001`~`G06-DEF-003`: 모두 **CLOSED**
- 신규 차단 finding: **0건**
- `AV-GATE-005(fixture 기준)`: **PASS**
- `AV-SAFE-010(fixture 준비)`: **PASS**
- `ACCEPTED`, commit, push, G-07 시작은 수행하지 않았다.

## 2. 판단 이유

Revision 1 보고서의 세 공격을 동일 증상으로 독립 재현했다. REDFAIL canonical fingerprint는 40회 모두 하나로 수렴했고, 잘못된 non-empty Package/evidence trace와 golden case+lock 동시 재작성은 각각 명시적 reason code로 거부됐다. 현재 golden anchor, 상위 human approval, candidate aggregate/subject의 raw 결박도 독립 계산과 일치한다.

### 2.1 기준선 및 raw hash

| 항목 | 독립 관측값 | 결과 |
|---|---|---|
| Branch / HEAD | `main` / `a70daa4933099b33c76575e0f278f22e15016649` | 일치 |
| WI | `WI-G-06-20260810-002` / `F8A966191412E3CC4CC29DC752169BC21B9E98CFD702134303F212454924352E` | 일치 |
| Invocation SHA-256 | `F2F9B857903B6E63322917E8FE7A920EAF7CF27C90123ACC2D2BA15A48359B1A` | 일치 |
| Manifest file SHA-256 | `1A61DA524064A0422E23F2C98B0179CD144E83470773FFFE1E4EAD58EA5D82F0` | raw 재계산 |
| Manifest content hash | `7664BFC423FA1D5F6F93E4E3409663FB807D739D2F0DA75E2B2C7AAFF671E6B1` | 기록값 일치 |
| raw checksum | 18/18 bytes·SHA 일치 | PASS |
| target canonical/content bytes | `2016` / `169648` | 기록값 일치 |
| target / delivered | `E3B29F23CDFF5FFA3AE26B88A5F63343D2DA8253B5A73C5FB10E28AA0A0074B1` / 동일 | MATCH |
| G-06 detached SHA-256 | `D5B8DBE29CE44FB0B78CB30D49A9287E132565FDEBB236ED585C116C7642CDDD` | current ref·manifest 일치 |
| progress file / canonical | `98A1652E...F501` / `C536782F...7452` | detached 일치 |
| snapshot | `5273498DD7464C8EFB33BE1EDC3C71A37CE909C4922CC1952DE5B6ED5FB61E19` | 기록값 일치 |
| HANDOFF file / summary | `D27E491C...28D5` / `EDAB64BC...1B79` | detached 일치 |
| event sequence | progress/HANDOFF/detached 모두 `12` | 일치 |

Target은 선언된 UTF-8 byte ordinal 정렬 및 `path<TAB>bytes<TAB>uppercase SHA`, LF, final newline 없음 규칙으로 독립 재계산했다.

G-05 불변 evidence는 `git diff --exit-code HEAD --` 결과 exit 0이었다.

- accepted manifest: `B8BCC1C6D5C409060DF73D0F8CDF25B5C07A9E22941DB65878972E776A971083`
- immutable R2 manifest: `F9A5E7168B9B68B70D74B68DD495211BDC7961223E5E48CFC6F565638B9E69E6`
- generic detached: `BF4C0037118F49DD4137AFB7279AE92AE573AA76EB3677B4E5592C49773AB438`

### 2.2 기존 finding closure

#### `G06-DEF-001` — CLOSED

- 동일 materialized `FIX-PY-REDFAIL`을 40회 실행했다.
- 실제 실패는 매회 재현됐고 canonical fingerprint는 40/40 모두 `40F10CC2C7400A21D9A8D4A2C555243FD34CDE874348EB828A5824720B322402`였다.
- elapsed `0.000s/0.001s`, fixture path와 object address가 다른 합성 출력도 동일 fingerprint로 정규화됐다.
- 안정 입력은 test ID, outcome, exception type, exception message로 제한됐다.

#### `G06-DEF-002` — CLOSED

- `S49-17-01.responsible_package="G-99"`, `evidence_types=["E-FAKE"]`로 동일 공격했다.
- 실제 오류: `SCENARIO_PACKAGE_TRACE_MISMATCH`, `SCENARIO_EVIDENCE_TRACE_MISMATCH`.
- 20개 scenario의 현재 AV ID·책임 Package 집합·evidence 집합도 권위 매트릭스와 독립 대조해 차이 0이었다.

#### `G06-DEF-003` — CLOSED

- `GC-PY-CLEAN-01.expected_result_status`를 변경하고 case content hash와 lock hash를 함께 재계산했다.
- 실제 오류: `GOLDEN_BASELINE_CASE_HASH_MISMATCH`.
- 변경되지 않은 candidate exact 8-case map이 coordinated rewrite를 차단한다.
- 독립 anchor chain:
  - candidate file SHA-256: `9A1802A39711D64FE571D88912EEF368406E49A9C7835E7145113C2285F28EAF`
  - 8-case aggregate: `sha256:33128E180D32B89813C62BAA382483001A52ABCF74DDEC8899076246B97DB56D`
  - exact subject: `sha256:F3447FC7323F63CB89B680C45C7DF9D0CC0C967E5F615508BAC115913F329923`
  - Main-authored anchor file SHA-256: `4A3B9FBCC8460D793CA68DB3D88147413F5CE7EC653BA32CF8CFFA3A98AD8351`
  - parent human approval file SHA-256: `94A82676DB9BF0EE23B55B0A59CBAC706AF7D8617B61BBB9887357E300FDFDC7`
- Anchor의 `recorded_by=main-agent-eoul`, 기존 approval ID·subject·scope·file hash, candidate path/hash, aggregate와 exact subject가 모두 실제 raw 파일과 일치했다. 새 승인이나 범위 확장으로 오인하지 않는다.

### 2.3 Fixture·golden·scenario·FI

- 8 fixture를 각각 새 temp Git repository로 materialize했다.
- `FIX-PY-CLEAN`: clean status, unittest exit 0.
- `FIX-PY-DIRTY`: ` M src/calc.py`, `?? notes/local-note.txt`; read-only 검사 전후 path·content·bytes·mtime_ns·SHA 변화 0.
- `FIX-PY-REDFAIL`: 지정 실패와 단일 canonical fingerprint 재현.
- `FIX-TS-CLEAN`: `npm ci --offline --ignore-scripts`, local `tsc` `Version 5.9.3`, typecheck exit 0.
- `FIX-TS-NOTOOL`: local executable·node_modules 없음, 격리 PATH에서 `BLOCKED TOOL_NOT_INSTALLED`; global fallback 없음.
- `FIX-PROTECTED`: 합성 marker만 존재, actual-looking secret 0.
- `FIX-LARGE`: module 24개 및 명시 cycle 재현.
- `FIX-CONFLICT`: 두 Step의 `src/shared.py` write 충돌 재현.
- Golden 8/8의 case hash·lock·candidate map·approval lineage가 일치했다.
- Scenario 20/20의 exact AV/Package/evidence mapping과 `DESIGN_LOCKED / NOT_EXECUTED`가 일치했다.
- FI-01~08 8/8은 minimum repeat 3, `DESIGN_LOCKED / NOT_EXECUTED`다.

### 2.4 회귀와 명령 증거

| 명령/독립 audit | Exit | 실제 핵심 출력 |
|---|---:|---|
| `python -m unittest tests.tooling.test_g06_test_assets tests.tooling.test_project_progress tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries` | 0 | `Ran 71 tests in 18.369s`, `OK` |
| `python scripts/check_g06_test_assets.py .` | 0 | `fixtures=8 golden=8 scenarios=20 fault_injections=8` |
| `python scripts/check_project_progress.py .` | 0 | `PASS sequence=12 reporting=AUTO_CONTINUE` |
| G-04/G-03 checker | 0/0 | 8 templates validated / dependency violation 0 |
| 독립 REDFAIL repeat | 0 | `RUNS=40 UNIQUE=1 EXPECTED_ONLY=True` |
| 독립 closure mutation/anchor audit | 0 | `R3_CLOSURE_OK=True` |
| 독립 8 fixture materialization | 0 | `MATERIALIZED=8/8 FAILURES=[]` |
| 독립 catalog audit | 0 | scenario/golden/FI errors `[]` |
| 독립 target/detached audit | 0 | `raw_mismatches=[]`, `G06_HASH_BINDING_OK=True` |
| G-05 immutable diff | 0 | 출력 없음 |

## 3. AV 판정

| 검증 ID | 판정 | 판단 이유 |
|---|---|---|
| `AV-GATE-005(fixture 기준)` | **PASS** | fixture/static 상태를 runtime PASS로 승격하지 않으며 false PASS, wrong trace, golden coordinated rewrite가 모두 거부된다. REDFAIL 기준도 반복 결정적이다. |
| `AV-SAFE-010(fixture 준비)` | **PASS** | dirty tracked/untracked 파일의 content·mtime·hash가 read-only 검사 전후 보존되고 원본 workspace 기존 파일은 Tester가 수정하지 않았다. |

## 4. 조치

1. Main Agent가 본 보고서와 hash를 fresh 확인한 뒤 G-06 최종 수락 여부를 판단한다.
2. `ACCEPTED`, commit, push 및 G-07 시작은 Main Agent의 별도 절차 전에는 수행하지 않는다.
3. 기존 세 finding은 닫혔고 신규 차단 finding은 없으므로 지정 범위 밖 재작업으로 합격 범위를 다시 열지 않는다.

## 5. 범위 제한

- §49.17 runtime scenario 20건과 FI-01~08 실제 fault injection은 `NOT_EXECUTED`다.
- 제품 API, UI, 브라우저/Network, DB/outbox/crash, Docker, WSL/server, 배포, Monitoring, Release는 범위 밖이며 검증하지 않았다.
- fixture/static PASS를 제품 또는 운영 PASS로 승격하지 않았다.
- Tester가 workspace에 작성한 파일은 이 보고서 하나뿐이다.
