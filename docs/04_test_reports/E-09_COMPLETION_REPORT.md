# E-09 완료보고 — Developer / independent review REWORK R2 보완

## 판정

`COMPLETED` — 승인된 exact5의 구현 및 로컬 계약 검증을 완료했다. 이것은 Developer 산출물이며 Main acceptance, 실제 운영 검증, Release 또는 배포 완료 판정이 아니다. 독립 검증과 Main 판정은 별도다.

- formal `FAILURE_REPORT` count: **0**. 아래 의도된 TDD RED와 조사 도구 오류는 정식 실패보고가 아니다.
- independent review rework round: **2**. R1 수신 판정 C2/I4/M0 6개 경계 보완 후 남은 R2 Important1(actor generation replay)의 Developer RED→GREEN 보완 완료. 독립 재판정은 아직 받지 않았으며 아래 최신 R2 증거가 이전 수치보다 우선한다. formal FAILURE_REPORT는 **0**이다.
- 현재 canonical: sequence **1151**, E-09 `IN_PROGRESS`, reporting `AUTO_CONTINUE`. Worker/write lease ACTIVE 유지. progress/HANDOFF/control9는 Main 소유로 수정하지 않았다.
- 외부 실행·전송·DB·브라우저·Provider·서비스·실제 Apply/Deploy: **NOT_EXECUTED / NOT_INTEGRATED**. fixture 관측을 실제 실행 PASS로 승격하지 않는다.

## 판단 이유

### 기준선·권위·실행 소유권

- 작업 루트: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- base/dispatch/current HEAD: `593311d87de760bdc6bb5485b89a17014e81976a`.
- 작업 시작 상태: Main이 발행한 E09 control exact9 dirty, 제품 변경 0. 종료 예상은 control9 + 제품5 = exact14, staged0. commit/stage/push 수행 0.
- WI: `WI-E-09-R1-20260917-001`; SHA256 `2DCA27CDB9DF351F62AA77FE0424711DB7E31AF2CD287C4239A8834B3B77B85D`.
- Invocation SHA256: `F236AC1CF5D1B8D727B5DFCF3E3F5F0A02F5DAE12F7BC0FCF3EDF102ED893E7B`.
- 설계 기준 SHA256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`; 설계 §32.5~32.8, §49.1~49.2, §49.10, 계획 E09, 매트릭스, 테스트계획과 WI를 대조했다.
- worker: `worker-lease-e09-r1-20260917-001`; execution token `e09-r1-execution-fence-epoch-1-593311d87de760bd`.
- write: `write-lease-e09-r1-20260917-001`; write token `e09-r1-write-fence-epoch-1-c6bb5485b89a1701`.
- window: `2026-09-17T22:40:00+09:00` 이상, `2026-09-18T10:40:00+09:00` 미만. 구현/검증은 이 유효 기간 안에서 수행했다.

### 구현·diff

변경은 다음 product exact5뿐이다. Main control9의 기존 변경은 보존했다.

| 경로 | 변경 |
|---|---|
| `packages/verification/__init__.py` | 새 host facade/receipt/error 및 두 manifest의 명시적 public alias export. 기존 `EvidenceManifest`는 C14 타입 그대로 |
| `packages/verification/gates.py` | `GateResult`가 G4~G7 코드도 표현하도록 2줄 교체. 기존 G0~G3 required gate 집합·평가·seal·release owner 변경 없음 |
| `packages/verification/release_gates.py` | host-only builtin 입력 검증, G4~G7 관측, full transport manifest, criterion/defect/retest, HUMAN 결정, 독립 Apply/Deploy admission |
| `tests/verification/test_gates_e09.py` | 최초 104개와 R1 218개를 보존하고 R2 보강 후 228개 host 계약/적대 테스트. 실제 외부 실행 evidence 아님을 명시 |
| `docs/04_test_reports/E-09_COMPLETION_REPORT.md` | 본 보고서 |

기존 `packages.artifacts.evidence.EvidenceManifest` 및 `RawArtifactChecksum`을 transport 정본으로 사용한다. 외부 DTO나 generic Mapping을 직접 순회하지 않고 exact builtin 타입·깊이·개수·UTF-8 총량을 검사하여 detached primitive 값으로 만든 후 기존 DTO에 전달한다. `TransportEvidenceManifest`와 `FoundationEvidenceManifest` alias로 이름 충돌을 방지했다.

C14 `GateEvidenceAuthority`, `GateEngine`, `ProductValidation`, `DefectAssessment`, `ReleaseApprovalService`를 재사용한다. full release subject는 target/delivered/commit/image/migration/config/policy/routing/environment/design/plan/WI를 결박한다. G0 runtime/Git, G1 toolchain, G5 command, 모든 gate raw ref와 transport checksum target/environment를 대조한다. Mandatory field 누락에 임의 hash를 채우지 않는다.

Host가 보유한 facade instance의 capture/actor 등록 메서드만 authority boundary다. payload가 actor handle이나 bundle handle을 복제·위조하거나 다른 service에서 제출하면 거부된다. record는 canonical JSON+hash로 저장하며 DTO/조회 결과/입력의 alias 변조는 canonical 상태로 전파되지 않는다. RLock 아래에는 untrusted callback·외부 IO가 없다.

G4는 영향 있는 API/DB/Browser/Module/External adapter를 선택하고 real 관측/ref/exit 결과를 요구한다. signature-only, 부분 adapter, 내부 mock, 환경 불일치, 잘못된 Browser URL을 PASS로 만들지 않는다. G5는 production configuration, 실제 build 관측, 동일 artifact와 dependency snapshot을 요구한다. G6는 6필드와 UI 5개 경계(click/network/store/response/final_ui)를 요구한다. G7은 host가 정한 4종 inventory를 대조해 누락 및 전체 suite 미실행을 `unverified_scope`로 직접 계산한다.

기술 PASS와 ProductValidation을 분리한다. 인증된 TESTER/HUMAN의 criterion별 실측 계약이 없으면 RELEASE를 차단한다. Developer 보고는 독립 product validation으로 사용할 수 없다. 결함 누락은 삭제가 아니며 C14 append-only lifecycle을 유지한다. CRITICAL 또는 blocking MAJOR는 Release/Apply/Deploy를 막는다. CLOSED에는 같은 target의 READY_FOR_RETEST 이후 sealed G3 독립 retest가 필요하고, reporter와 actor/context가 같은 재검증은 거부한다.

RELEASE/REWORK/DEFER/REJECT는 current HUMAN handle만 생성할 수 있다. DEFER는 reason/risk/review_at/carryover를 보존한다. 이전 결정 replay는 최신 결정을 복구하지 않으며 동시각 상충 결정은 fail-closed다. Apply와 Deploy는 별도 operation-bound approval이고, 만료·철회·현재 validation/defect 변경·다른 bundle 재사용을 거부한다. 결과는 `ADMITTED_NOT_EXECUTED`, side_effects=0이며 실제 변경을 수행하지 않는다.

### TDD RED → GREEN

모든 아래 focused RED 실행의 정확한 공통 명령:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py --tb=short
```

| 순서 | 실제 RED (exit1) | 최소 보완 후 GREEN |
|---|---|---|
| 1 | 신규 모듈 부재 `ModuleNotFoundError`: 5 failed / 0 passed | G4/G5 5 passed, exit0 |
| 2 | G6/G7 미구현: 2 failed / 14 passed | E09+C14 146 passed, exit0 |
| 3 | actor/full manifest/release 메서드 부재: 18 failed / 16 passed | E09 34 passed, exit0 |
| 4 | defect/revocation 부재 및 오래된 RELEASE replay: 5 failed / 35 passed | E09+C14 170 passed, exit0 |
| 5 | adapter 내부 mock 승격 4건, bundle ID hash 미결박 1건: 5 failed / 86 passed | E09+C14 221 passed, exit0 |
| 6 | 중복 PV ref rejection 후 partial state: 1 failed / 103 passed | publish-last PV 변경 후 E09+C14 234 passed, exit0 |

RED는 구현 전에 추가한 구체적인 hand-derived expectation을 검증한 결과다. 외부 IO를 수행하지 않는 host adapter 경계의 synthetic record이며 테스트 payload의 `acquisition_mode=real`은 **real-shaped 계약 fixture**이지 이번 실행에서 실제 서비스/브라우저/빌드를 수행했다는 주장이 아니다.

### 최초 구현 검증 명령·exit·실제 결과 (R1 이전 이력)

1. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py --tb=short`
   - exit0; **104 passed in 1.05s**.
2. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py tests/verification/test_gates_c14.py --tb=short`
   - exit0; **234 passed in 1.45s**. 기존 C14 130개 모두 보존.
3. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --tb=short -ra --basetemp=D:/Project/Anvil/.codex-sandbox/e09-pytest-20260917-2310`
   - exit0; **898 passed, 8 skipped in 4.18s**.
   - 8 SKIP: `tests/verification/test_c01_l3_independent_acceptance.py:206`, `ANVIL_TEST_DATABASE_URL is not set`. 기존 C01 actual DB 경계이며 E09 또는 DB PASS로 계산하지 않는다.
   - 이전 중간 회귀: 신규 테스트 추가 전 **885 passed, 8 skipped in 5.28s**, exit0.
4. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E09StartControlTests --tb=short`
   - exit0; **2 passed in 10.23s**. control 파일 수정 없이 검증만 수행.
5. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=('packages/verification/__init__.py','packages/verification/gates.py','packages/verification/release_gates.py','tests/verification/test_gates_e09.py'); [compile(Path(p).read_bytes(), p, 'exec') for p in paths]; print('BUILTIN_COMPILE_PASS files=4; bytecode_writes=0')"`
   - exit0; `BUILTIN_COMPILE_PASS files=4; bytecode_writes=0`. WI의 builtin compile 방식이며 scope 밖 pycache 쓰기 0.
6. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py`
   - exit0; `G-05 project progress contract: PASS sequence=1151 reporting=AUTO_CONTINUE`.
7. `git diff --check`
   - exit0; 출력 없음. 보고서 작성 뒤 다시 확인한다.

보조 조사에서 존재하지 않는 pytest basetemp를 `Get-ChildItem`으로 조회한 exit1이 1회 있었다. 후속 `Test-Path D:/Project/Anvil/.codex-sandbox/e09-pytest-20260917-2310`는 False: 해당 suite는 경로 자체를 만들지 않았으며 잔여 임시 리소스 0, 삭제 수행 0이다. Git global ignore의 sandbox read warning은 제품 실패가 아니고 검증/변경 경로에 영향을 주지 않았다.

### Validation ID 전량 매핑

| ID | 테스트 근거 / 검증 계층 |
|---|---|
| AV-GATE-004 | `test_g4_nonreal_or_missing_environment_never_passes`, `test_every_late_gate_refuses_nonreal_mode` — 환경 부재/비실행의 BLOCKED 계약 |
| AV-GATE-016 | `test_g4_selects_impact_adapters_and_rejects_signature_only` — AST/signature-only PASS 금지 |
| AV-GATE-017 | `test_all_five_g4_adapters_require_exact_real_integration_refs`, `test_g4_db_rollback_and_browser_modes_are_explicit` — 5종 adapter 선택 |
| AV-GATE-018 | `test_g5_requires_production_build_and_artifact_dependency_hashes` — production build 계약 |
| AV-GATE-019 | `test_g6_six_fields_ui_boundaries_and_relative_url` — functional 6필드 계약 |
| AV-GATE-023 | `test_g7_four_scopes_and_unverified_are_derived_not_claimed` — 회귀 4종 선택 |
| AV-GATE-024 | `test_g7_four_scopes_and_unverified_are_derived_not_claimed` — 실행 범위/미검증 범위 명시 |
| AV-GATE-025 | `test_full_manifest_every_subject_dimension_is_bound`, `test_manifest_gate_and_transport_consistency` — commit/image/migration/config/policy/routing mismatch 거부 |
| AV-STAT-023 | `test_g4_nonreal_or_missing_environment_never_passes`, `test_missing_gate_forged_pass_raw_target_and_missing_mandatory_data_denied` — DB/서비스 부재 BLOCKED 및 release-ready 금지 |
| AV-UI-013 | `test_g6_six_fields_ui_boundaries_and_relative_url`, `test_g6_ui_absolute_and_escape_network_denied` — UI 관측 계약만, actual UI NOT_EXECUTED |
| AV-UI-014 | `test_every_late_gate_refuses_nonreal_mode`, `test_g6_never_promotes_nonpass_and_skip_requires_reason` — mock/static/선언을 actual 기능 PASS로 승격 금지 |
| AV-FLOW-014 | `test_g4_nonreal_or_missing_environment_never_passes`, `test_every_late_gate_refuses_nonreal_mode` — 미실행 정직성 |
| AV-FLOW-015 | `test_full_manifest_product_validation_then_human_release_and_separate_apply_deploy`, `test_unsuitable_product_blocks_technical_pass_release` — 자동 기술 PASS와 제품 합격 분리 |
| AV-FLOW-024 | `test_agent_cannot_release_payload_spoof_alias_or_cross_authority`, `test_product_validation_different_release_subject_exact_reason` — 권위/subject 오류 흐름 |
| AV-FLOW-025 | `test_critical_or_blocking_major_denies_release_apply_deploy`, `test_unsuitable_product_blocks_technical_pass_release`, `test_defect_omission_does_not_erase_and_independent_retest_required` — 필수 validation/defect가 Release/Apply/Deploy 모두 차단 |

이 매핑은 테스트 범위를 설명하며 실제 운영 validation ID 전체의 최종 합격 선언이 아니다. 특히 UI/DB/실제 build/service/browser가 필요한 acceptance 증거는 후속 실행 owner/독립 검증이 추가해야 한다.

### 제품 SHA256 (보고서 자체 제외)

| 파일 | SHA256 |
|---|---|
| `packages/verification/__init__.py` | `C6E1F423E0A61C5A5819B400E4766485324797D6BD08D1779B1B94947BE52ABF` |
| `packages/verification/gates.py` | `718FF29EC9CB142E1F2FBF8DC984A06158B7E5788D0717CAA31427D102D26B49` |
| `packages/verification/release_gates.py` | `37FD271494916A36A60202D9A164686F282F34333CD64557D11489353EB18AC1` |
| `tests/verification/test_gates_e09.py` | `9DC814A8619D264EBDB312778A1C4EC029A7BFA8D69FCED73F2BF3A68BE2B340` |

보고서 자체 hash는 self-reference를 피하기 위해 최종 전달 메시지에서 별도로 제공한다.

### R1 review 보완 이력 — C2/I4/M0 수렴 근거

Review rework round1이며 **formal FAILURE_REPORT 0**이다. 같은 base HEAD, seq1151, 유효 epoch1 dual lease를 재확인했다. 이번 라운드 변경은 exact5 안의 `release_gates.py`, `test_gates_e09.py`, 본 보고서 3개뿐이고 나머지 제품 2개와 control9는 보존했다.

리뷰 수용/TDD/완료 전 검증 절차에 따라 다음 6개 경계를 실제 동작으로 먼저 재현했다. 기존 positive fixture의 암묵 default를 승인된 explicit 계약으로 바꾸되 기존 104개 검증 목적과 C14 130개 회귀를 유지했다.

| finding 경계 | 최소 수정 | RED 및 보강 근거 |
|---|---|---|
| G4 누락 metadata가 real로 기본 처리 | selected adapter마다 `acquisition_mode=real`, `available=True`, exact environment를 명시적으로 요구. 누락/default/mock/false/mismatch 모두 BLOCKED | `test_r1_g4_every_adapter_requires_explicit_real_available_environment` 5종×6변형 |
| G5/G6 nested nonreal을 상위 real이 가림 | G5 observation, G6 scenario, UI의 click/network/store/response/final_ui 각각 동일 explicit real/available/environment 계약. UI 단순 ref 문자열은 불충분 | `test_r1_nested_real_cannot_override_absent_mock_or_unavailable`, legacy 문자열/ref 우회 3건, explicit positive |
| G5 artifact/dependency hash가 raw checksum에 연결되지 않음 | 두 종류 각각 `artifact_ref`/`dependency_snapshot_ref` 요구. 해당 raw path의 SHA256을 관측 hash와 exact 비교, 공통 target/env 검사 유지. 누락/다른 path/다른 hash는 publication 전에 차단 | `test_r1_g5_requires_each_artifact_reference`, `test_r1_build_hash_must_match_exact_transport_path_checksum`, dependency raw-path 대체, target/env swap |
| bundle property callback 선실행 | approve_action/admit 및 내부 decision 검증에서 bundle 속성 읽기 전 exact registered BUNDLE `_record` 검사 | `test_r1_bundle_property_callbacks_zero` 2 RED, `test_r1_every_public_handle_slot_rejects_properties_without_callbacks` 16 public slot 모두 callback0 |
| revoke 뒤 actor exact registration replay로 권한 부활 | actor identity revocation tombstone. 동일 identity의 exact replay/new window/new context 모두 `ACTOR_IDENTITY_REVOKED`; 새 명시적 identity 및 새 decision/approval 필요 | `test_r1_revoked_actor_identity_never_revives_old_approval` 3변형, 실제 새 identity 정상 경로 |
| 최초 reporter만 검사하여 fixer가 self-retest 가능 | FIXING/READY_FOR_RETEST의 host current actor/context를 append-only fixer 목록으로 보존. payload fixer claim 무시. TESTER가 reporter와 모든 fixer의 actor/context 양쪽에서 독립이어야 retest 가능. CLOSED는 해당 fixer hash에 결박된 retest 및 current tester 권위를 재검사 | `test_r1_retester_must_be_independent_of_actual_fixer`, HUMAN/DEVELOPER/TESTER fixer 역할 전이·context 변경·alias projection·payload spoof 회귀 |

R1 정확한 RED 명령과 결과:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py -k 'r1_g4 or r1_nested or r1_g6' --tb=no
exit1: 20 failed, 53 passed, 104 deselected in 0.84s

D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py -k r1_g6_legacy --tb=short
exit1: 3 failed, 177 deselected in 0.90s

D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py -k 'r1_g5 or r1_build or r1_dependency' --tb=no
exit1: 9 failed, 180 deselected in 0.81s

D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py -k 'r1_bundle_property or r1_revoked or r1_retester' --tb=short
exit1: 7 failed, 189 deselected in 2.60s
```

중간 GREEN은 E09 180 PASS → 189 PASS → E09+C14 326 PASS이며, public handle/역할 변경 등 유사 우회를 보강한 최신 결과는 다음과 같다.

| 정확한 명령 | exit / 실제 결과 |
|---|---|
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py --tb=short` | 0 / **218 passed in 2.71s** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py tests/verification/test_gates_c14.py --tb=short` | 0 / **348 passed in 3.41s** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --tb=short -ra --basetemp=D:/Project/Anvil/.codex-sandbox/e09-r1-pytest-20260917-2330` | 0 / **1012 passed, 8 skipped in 5.92s** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E09StartControlTests --tb=short` | 0 / **2 passed in 10.99s** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=('packages/verification/__init__.py','packages/verification/gates.py','packages/verification/release_gates.py','tests/verification/test_gates_e09.py'); [compile(Path(p).read_bytes(), p, 'exec') for p in paths]; print('BUILTIN_COMPILE_PASS files=4; bytecode_writes=0')"` | 0 / **BUILTIN_COMPILE_PASS files=4; bytecode_writes=0** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py` | 0 / **PASS sequence=1151 reporting=AUTO_CONTINUE** |
| `git diff --check` | 0 / 출력 없음; 보고서 갱신 후 재확인 |

8 SKIP는 이전과 동일한 C01 `ANVIL_TEST_DATABASE_URL` 미설정이다. 명시한 basetemp의 `Test-Path`는 False이며 생성/정리 대상 자체가 없다. 실제 DB/browser/build/service/Provider/Apply/Deploy 및 durable auth/evidence registry는 여전히 NOT_EXECUTED/NOT_INTEGRATED. 이번 개선은 host가 수집했다고 주장하는 자료의 교차 결박을 강화한 것이지 artifact bytes를 OS에서 직접 읽거나 실제 runner를 실행한 증거가 아니다. 독립 재검토 전 C0/I0 최종 acceptance를 주장하지 않는다.

Rollback 범위는 기존과 같은 제품 exact5이고 R1 자체 diff는 위 3파일이다. 새 persistence/control/Git 변경 0; 제품 lease 유지. 정확한 SHA256 표는 위에 최신 값으로 갱신했고 보고서 자체 최종 hash는 전달 메시지에 기록한다.

### 최신 R2 review 보완 — actor generation 역행 Important1

판정 `COMPLETED`(Developer 보완), **review round2 / formal FAILURE_REPORT 0**. 현재 활성 generation보다 과거 HUMAN registration을 replay하여 `_actors`의 hash를 되돌리고 기존 Apply/Deploy approval을 되살리는 문제를 재현했다. exact5 내 `release_gates.py`, `test_gates_e09.py`, 보고서만 수정했으며 control9 및 나머지 제품 2파일은 유지했다.

수정은 actor_id별 current generation handle을 보존하고 lock 안에서 기존 canonical record와 등록 입력을 비교하는 최소 변경이다. 현재 registration의 exact retry는 **동일 handle**을 반환하며 record/authority/handle count에 부작용이 없다. 다른 registration은 `issued_at`이 엄격히 증가해야 하며 과거·동일 시각 rebind는 `ACTOR_GENERATION_STALE`로 publication 전에 거부한다. superseded 기록 조회는 가능하나 current authority를 재지정할 수 없다. 명시 revoke의 identity tombstone이 우선하므로 같은 ID의 과거/현재/새 window 모두 계속 거부된다. 새 명시적 actor identity 및 정상 newer generation의 새 decision/approval 경로는 유지했다.

실제 RED:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py -k r2 --tb=short
exit1: 5 failed, 1 passed, 218 deselected in 0.99s
```

RED는 기존 HUMAN→new generation(role/context/window) 뒤 최초 registration replay 3건, current retry의 불필요한 새 handle 1건, 아직 등록하지 않은 older generation 허용 1건이다. 명시 revoke 회귀 1건은 이미 PASS였다. 구현 후 E09+C14 354 PASS; 동일 시각 role/context/expiry rebind 3건과 정상 newer generation 새 release 경로를 보강한 최종 증거는 아래와 같다.

| 정확한 명령 | exit / 실제 결과 |
|---|---|
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py --tb=short` | 0 / **228 passed in 2.83s** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py tests/verification/test_gates_c14.py --tb=short` | 0 / **358 passed in 3.08s** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification tests/orchestration --tb=short -ra --basetemp=D:/Project/Anvil/.codex-sandbox/e09-r2-pytest-20260917-2340` | 0 / **1022 passed, 8 skipped in 5.74s** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py::E09StartControlTests --tb=short` | 0 / **2 passed in 10.21s** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=('packages/verification/__init__.py','packages/verification/gates.py','packages/verification/release_gates.py','tests/verification/test_gates_e09.py'); [compile(Path(p).read_bytes(), p, 'exec') for p in paths]; print('BUILTIN_COMPILE_PASS files=4; bytecode_writes=0')"` | 0 / **BUILTIN_COMPILE_PASS files=4; bytecode_writes=0** |
| `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py` | 0 / **PASS sequence=1151 reporting=AUTO_CONTINUE** |
| `git diff --check` | 0 / 출력 없음; 보고서 작성 후 재확인 |

C01 DB 환경변수 미설정 8 SKIP, actual DB/browser/build/Provider/Apply/Deploy 및 durable authority NOT_INTEGRATED 경계는 그대로다. 명시 basetemp `Test-Path` False로 생성된 임시 리소스 0이다. R2에서 새 정식 실패보고/외부 실행/control 변경/Git mutation은 없다. rollback은 해당 3파일의 R2 diff만 Main이 검토해 되돌리는 방식이며 실제 rollback은 수행하지 않았다. 독립 최종 판정/acceptance는 Main 소유로 남긴다.

## 조치·미검증·잔여 위험·rollback

1. 제품 exact5 구현/테스트/보고만 작성했다. Main control9, WI/prompt/start history, 승인 문서, DB schema, API/UI 파일은 수정하지 않았다. 실행 계획/TDD/완료 전 검증 절차를 적용했고, 새 설계·새 agent·추가 승인·Git mutation은 수행하지 않았다.
2. HOST_ONLY_IN_MEMORY 경계: actor 등록/capture는 인증된 host adapter가 호출한다는 capability 계약이다. 실제 인증 시스템, OS artifact byte 수집/검증, durable evidence registry, restart/concurrent multi-process DB transaction은 **NOT_INTEGRATED**. 메모리와 host의 정직한 관측을 실제 외부 provider authenticity 또는 durable signature로 주장하지 않는다.
3. DB migration up/down, production build, Browser 실제 click/network/storage/final UI, 외부 API, 계정/서비스, 배포를 이번 모듈이 실행하지 않는다. 미설정 입력은 BLOCKED이며, unit fixture가 위 실행을 대신하지 않는다. C01 actual DB 8 SKIP와 전체 저장소 미실행을 보존한다.
4. ReleaseGateService는 C14 in-memory lifecycle 내부 state를 같은 패키지에서 재사용한다. 공용 persisted API/schema를 새로 만들지 않았다. 실제 라우팅/consumer 연결과 일반 운영 복구는 후속 owner 책임이다.
5. rollback은 Main이 제품 exact5 diff를 검토하고 그 변경만 원복하는 방식이다. 새 3파일(release_gates/tests/report)과 기존 2파일의 최소 diff를 구분하며 control9·다른 사용자 파일·history는 손대지 않는다. 외부 데이터/서비스 변경 0이라 DB/runtime rollback은 없다. Developer는 rollback/Git 작업을 실행하지 않았다.
6. 다음 안전 조치는 Main의 독립 spec/quality 검증과 acceptance 판단이다. E10 착수, lease 회수, acceptance event, commit/push는 수행하지 않는다.
