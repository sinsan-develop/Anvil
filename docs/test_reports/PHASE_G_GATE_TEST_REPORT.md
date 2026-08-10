# Phase G Gate 독립 TestReport

## 판정

- 대상: `WI-PHASE-G-GATE-20260810-001`
- WorkInstruction SHA-256: `5F0172B7CADDBBA9086428AE5DD294F67F6D5BADD44573D4730E84E76D1BB7D7`
- Invocation SHA-256: `BBD3F49B6E395A6F9BE460488C88B76283FCE1D2E8EBF12229AA811C6B031076`
- branch/HEAD/upstream: `main` / `23bc0019aeba0d6ae2b04c52fad6c778d8b7b6e8` / 동일
- 독립 Tester 판정: **FAIL / REWORK**
- blocking finding: **1건 (`PGATE-DEF-001`)**
- Phase G Gate `ACCEPTED`, commit/push, A-01 시작: **수행·주장하지 않음**

## 판단 이유

### 통과한 독립 검증

- fresh 회귀 명령:
  - `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_phase_g_gate tests.tooling.test_g07_baseline tests.tooling.test_g06_test_assets tests.tooling.test_project_progress tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries`
  - exit `0`; `Ran 91 tests in 38.798s`; `OK`.
- Gate checker: `C:\Users\cyhuh\anaconda3\python.exe scripts/check_phase_g_gate.py .`; exit `0`; `accepted=7 decisions=10 packages=97 av=255 scenarios=20 sync=7`.
- WI의 `reconstruction_contract`만 읽어 workspace 밖에 flat projection을 먼저 고정했다.
  - 파일: `C:\Users\cyhuh\AppData\Local\Temp\phase-g-gate-standalone-projection.json`
  - SHA-256: `37851DD2AE0268C1F201466B9DA392A47833F1B7D78C9673E71982B2C4C75C54`
  - 실제 validation projection과 기본 상태 semantic diff: `0`.
- §49.18의 7개 논리 동기화 대상 실제 hash가 결박값과 일치했다. 6번 대상은 progress와 HANDOFF 두 파일이다.
  - 작업계획 `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
  - 매트릭스 `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3`
  - 테스트계획 `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5`
  - AGENTS `1E93333379D230EA56058C3395570C96E9AAE98F40D586E6DEA9C1BD920D8246`
  - 운영규칙 `7D5E2AD0F272CBA1052EA8A21622F1E16438ABAB9AA4AAB7A1D34374B4FFB5F3`
  - progress `E268FE0CA507C3A3257590DFB8EE81C071EE212E4AB020E42D16851D682452C2`, HANDOFF `17E5001981FCB9F7F3697197823A05B5E6517D0EA74DA0BA2EAC92122C56D12A`
  - 재온보딩 `3110F6B21EFC3C7BE61B6CEB71A4586A75A80DC129D79DDC4B0A74AFE0039A69`
- D1~D8·D10 `HUMAN_CONFIRMED`, D9 `BENCHMARK_POLICY_CONFIRMED`, root approval `94A82676…FDC7`, G-02 R3 `F191B95A…D35`, `evt_g05_legacy_migration`의 Main-authored G-02 acceptance projection 계보가 일치했다.
- G-01~G-07은 completed projection, 독립 PASS TestReport, target=delivered final manifest를 모두 가졌다. G-05 R2, G-06 R3, G-07 R2를 포함한 immutable evidence는 실제 파일과 일치했다.
- 핵심 AV 5개(`AV-FLOW-003`, `AV-STAT-015`, `AV-STAT-016`, `AV-GATE-026`, `AV-CON-016(RV)`) 각각의 10-field provenance를 실제 TestReport/manifest bytes와 재대조해 불일치 `0`이었다.
- 독립 raw 파싱 결과: Package `97`, unique AV `255`, executable `234`, reverse `97`, 미할당 `0`, §49.17 scenario `20`.
- §49.17 20건은 전부 `DESIGN_LOCKED / NOT_EXECUTED`였다. runtime PASS로 승격되지 않았다.
- offline lease fixture 8단계를 별도 상태기로 실행했다. 두 번째 writer, stale worker, stale write는 거부됐고 정상 commit 뒤 write→worker 순으로 회수되어 최종 active lease는 `0`이었다. 실제 shared lease는 발급하지 않았다.
- Phase G manifest 독립 검산:
  - raw `11/11`, mismatch `0`; canonical/content bytes `1300/71603`.
  - target = delivered `C57DA1BBDA4EE9D33B3A86FC148ACA1654494BBCA1F84F399A1E5A64A86547A3`.
  - content hash `7B3616AABC9AFD21209846E7FAD715E19AAFBF8B3593B269205AAFFAC7508EAF`.
  - detached `3881CA4E624D0315CE91EDB8256FE3E01CDD842920E2CB44695D3A144E0C3E89`; progress/HANDOFF/event sequence `21/21/21`; snapshot·canonical hash 일치.
- standing approval은 `NOT_APPLIED_PENDING_GATE_TEST_REPORT`, actor/ref `null`; Gate `NOT_DECIDED`; A-01 `false`; progress의 worker/write lease도 `null`이었다.

## 차단 finding

### PGATE-DEF-001 — reconstruction_contract의 accepted_packages 위조가 semantic guard를 우회함

- 심각도: **BLOCKING / MAJOR**
- 영향: WorkInstruction 단독 재구성 계약에서 필수 수락 Package 집합이 잘못되어도 Gate checker가 PASS할 수 있다. Gate scope와 acceptance lineage를 위조하는 wrong-but-nonempty 입력을 차단하지 못한다.
- 재현:
  1. `docs/work_orders/PHASE_G_GATE_WORK_INSTRUCTION.md`의 reconstruction JSON만 override한다.
  2. `accepted_packages` 마지막 값을 `G-07`에서 `G-99`로 바꾼다.
  3. 실제 파일은 수정하지 않고 `validate_gate(root, text_overrides={wi_path: mutated_wi}, verify_hashes=False)`를 호출한다.
- 관측: 반환 `errors=[]`; 기대 reason code는 `GATE_RECONSTRUCTION_CONTRACT_MISMATCH`.
- 재현 명령: `C:\Users\cyhuh\anaconda3\python.exe C:\Users\cyhuh\AppData\Local\Temp\anvil-phase-g-mutations.py`
- 명령 결과: exit nonzero; `missing_acceptance`, `forged_decision`, `missing_acceptance_chain`, `second_writer_false_allow`, `scenario_false_pass`, `key_av_false_pass`, `reconstruction_missing_output`은 거부됐으나 `reconstruction_forged_package BYPASS []`; 총 `7/8` 거부.
- 원인: `scripts/check_phase_g_gate.py`의 reconstruction 검증이 counts, 일부 inputs, exit status/A-01만 검사하고 `accepted_packages`의 정확한 순서·값을 검사하지 않는다.

## 조치

- 최소 수정 범위:
  - `scripts/check_phase_g_gate.py`: WI reconstruction의 `accepted_packages`를 정확히 `G-01..G-07`과 비교하고 불일치 시 `GATE_RECONSTRUCTION_CONTRACT_MISMATCH`를 반환한다.
  - `tests/tooling/test_phase_g_gate.py`: `G-07→G-99` wrong-but-nonempty mutation 회귀 1건을 추가한다.
- 같은 계약의 `decision_ids`, `lease_dry_run`, `key_verifications`, `inputs`, `outputs`, 전체 `exit_projection`도 exact equality로 함께 고정하는 것이 안전하다. 이는 기능 범위 변경이 아니라 기존 reconstruction 계약 guard의 누락 보완이다.
- 수정 후 scoped test, 91개 전체 회귀, 독립 mutation 8/8, manifest/target/detached 검산을 다시 수행한다.
- 차단 해소 전 Main Agent는 Phase G Gate를 수락하거나 A-01을 시작하지 않는다.
- 제품 API/UI/브라우저/DB/server/WSL/production/deployment 및 §49.17 runtime은 이번 문서·fixture Gate 범위 밖이다.

## 변경 통제

- Tester가 작성한 workspace 파일은 `docs/test_reports/PHASE_G_GATE_TEST_REPORT.md` 한 파일뿐이다.
- 기존 구현, 권위 문서, progress/HANDOFF, manifest, fixture 및 accepted evidence는 수정하지 않았다.
