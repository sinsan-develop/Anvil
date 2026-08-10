# Anvil Build Handoff

```json anvil-recovery-summary
{
  "schema_version": "1.0.0",
  "event_sequence": 43,
  "status": "READY",
  "current_work_package": "A-02",
  "last_event_id": "evt_a01_revision2_main_accepted",
  "design_baseline_hash": "246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5",
  "valid_failure_count": 1,
  "active_lineage_valid_failure_count": 0,
  "historical_accepted_failure_count": 4,
  "dir_status": "NOT_REACHED",
  "repository_head": "50ff3c39f890d50230e1432101f2a22f5606f74f",
  "repository_upstream": "origin/main",
  "repository_remote_head": "50ff3c39f890d50230e1432101f2a22f5606f74f",
  "repository_status": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
  "repository_projection_mode": "VALIDATED_BASE_COMMIT_EXACT_EVIDENCE_ONLY_DESCENDANT",
  "repository_validated_base_commit": "50ff3c39f890d50230e1432101f2a22f5606f74f",
  "repository_head_relation": "EVIDENCE_ONLY_DESCENDANT_PENDING_COMMIT",
  "repository_exact_allowed_paths": ["docs/completion_reports/A-01_COMPLETION_REPORT.md", "docs/evidence/manifests/A-01_ACCEPTANCE_PROGRESS_MANIFEST.json", "docs/progress/BUILD_HANDOFF.md", "docs/progress/build-progress.json", "docs/progress/progress-events.json", "docs/progress/progress-handoff-detached-digest-a01-accepted.json", "scripts/check_a01_journey.py", "scripts/check_g07_baseline.py", "scripts/check_phase_g_gate.py", "scripts/check_project_progress.py", "tests/tooling/test_a01_journey.py", "tests/tooling/test_g07_baseline.py", "tests/tooling/test_phase_g_gate.py", "tests/tooling/test_project_progress.py"],
  "current_progress_digest_path": "docs/progress/progress-handoff-detached-digest-a01-accepted.json",
  "current_progress_manifest_path": "docs/evidence/manifests/A-01_ACCEPTANCE_PROGRESS_MANIFEST.json",
  "a01_precondition_status": "ACCEPTED",
  "a01_precondition_readiness": "READY_FOR_A01_WI",
  "next_safe_action": "Main may issue the A-02 WorkInstruction; A-02 implementation remains blocked until instruction and valid worker/write leases exist",
  "root_human_approval_id": "APPROVAL-20260810-INTEGRATED-BASELINE-001",
  "derived_baseline_id": "BASELINE-A-01-PRECONDITION-DERIVED-20260810-001",
  "reporting_decision": "AUTO_CONTINUE",
  "g_gate_status": "ACCEPTED",
  "g_gate_checkpoint_status": "CLEARED",
  "a01_start_allowed": true,
  "active_work_instruction": null,
  "worker_lease": null,
  "write_lease": null
}
```

> 갱신일: 2026-08-11
> 현재 상태: `A-01 ACCEPTED / A-02 READY`
> 현재 Phase / Package: `A / A-02`

## 1. 현재 기준선

- 설계서: `Anvil_설계서_v2.md` v2.6 — 신산님 승인, P1 계약 정합성 4건 비의미 재확정
- 설계서 SHA-256: `246D0487789A18AF17C7C9D5CF772442ACA2182339D33D4C989D209BAA3DA9A5`
- 작업계획서: `Anvil_작업계획서_v1.md` v1.5 / SHA-256 `A1032FB587337A914F63A316972402BAC99760A92C7934670EF93979BABA396A`
- 통합검증매트릭스: `Anvil_통합검증매트릭스_v1.md` v1.3 / SHA-256 `982B4046A4764D74564E0291A82F0306DB9B06F5D0A3858D49876322FB93F90A`
- 테스트계획서: `Anvil_테스트계획서_v1.md` v1.4 / SHA-256 `803868505616BE655B8D12FC216736DECB55E4812E7673DA242F2637BF7F40F8`
- 검증 문서 상태: v2.6·v1.5·v1.3·v1.4, Package 97·AV 255·고유 실행 234·역색인 97·미할당 0 유지. A-01은 `AV-UI-005`만 `STATIC_ONLY`, `AV-FLOW-001`은 A-05·B-03·A Gate의 `RUNTIME_DEFERRED`
- 운영규칙: `docs/governance/ANVIL_OPERATING_RULES.md` v1.6 / SHA-256 `4AA7B81629924DC47519353CF396A7FF85BAC8FB50F7A1B63D9F1337E8F6216E`
- A-01 사람 승인: `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001` / SHA-256 `9D440C46B0CD8F0F44C46B3143FCB1B4DF7322BF9A7E0BD0A52BCE8D873FA18F`
- A-01 파생 기준선: `BASELINE-A-01-PRECONDITION-DERIVED-20260810-001` / SHA-256 `E5A6E3B64CAAF48F6CDE51A1E8431A553C2CA2E4EF66DC7E5EE085D6F017E008`
- 비의미 binding: `MAIN_RECONFIRMED_NON_SEMANTIC:G-02-R2-G02-DEF-001` revision 3 / SHA-256 `8332635C9CE92B085AFFDF1B235F48945605DC87FA7294DA5FF88A589C95D03D`
- canonical parent baseline: `BASELINE-G-01-20260810-001` / `docs/baselines/G-01_BASELINE_RECORD.md` / SHA-256 `8EA9C6DA6E45955D7F7397C208FCFB0EFCC8C01B84851021F239350AC542847B`
- G-02 derived baseline: `BASELINE-G-02-DERIVED-20260810-001` / `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md` / SHA-256 `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- Git: `main` 초기 기준선 commit `6fab9aa95811ad09aa2f27a0e9c7f5b73bf12cfd`, remote 0개
- 제품 코드: 아직 없음; G-03은 directory scaffold와 tooling checker만 생성

## 2. 역할

- 최종 승인자: 신산님
- Main Agent·설계 책임자: 어울
- Primary Developer Subagent·작업 담당자: `developer-primary`
- Reviewer/Tester: G-01 PASS, G-02 revision 3 PASS, G-04 revision 2 PASS, G-05 revision 2 PASS, G-06 revision 2 PASS

## 3. 이번 설정에서 완료한 내용

- Developer Subagent를 `developer-primary`로 지정
- 루트 `AGENTS.md` 운영 진입점 생성
- Developer AgentDefinition 생성
- `[historical]` 프로젝트 운영규칙 v1.1 최초 작성
- 진행 상태와 세션 복구 파일 생성
- Developer의 설계서·작업계획서·MoaWorks 권고안 온보딩 완료
- Developer의 운영규칙 독립 대조 검토와 보완 후 재검토 `ACCEPT`
- 신산님 지시에 따라 개발 결과 자동 수집·3상태 구분과 승인 요청 범위를 기능 범위·요구사항·중요 위험 변경으로 제한
- 신산님 지시에 따라 9개 LLM Provider 선택 요구사항을 설계서와 작업계획서에 반영
- Provider별 adapter를 독립 Work Package로 분리하고 전체 계획을 96개로 재산정
- 통합검증매트릭스와 테스트계획서의 검증 ID·L1~L7·evidence·회귀·독립 Tester 계약을 작업계획서에 반영
- 검증 문서 정규화 G-07을 추가해 전체 계획을 97개 Package로 재산정
- DIR-1(A-15)·DIR-2(C-15)·DIR-3(E-11)를 신산님 보고 전 자동 재개가 불가능한 `DIR_HOLD`로 고정
- D Gate의 조용한 학습 CRITICAL 실패에는 긴급 DIR-X를 추가하되 E-11 뒤 DIR-3을 유지
- 신산님이 설계서 v2.6 핵심 완성안을 명시 승인
- 승인 후 독립 검토 P1 4건을 `MAIN_RECONFIRMED_NON_SEMANTIC`으로 재확정
- v2.6의 ProductValidation·Defect·Release, queue fencing, 비용 예약, egress/secret/web 보안, EvidenceManifest, Git-only 배포·monitoring 계약을 97개 Package에 반영
- `[historical]` 검증 매트릭스·테스트계획 v1.1에서 255개 ID·고유 실행 234개로 최초 정규화
- Local 개발 DB=WSL-server PostgreSQL 15, RC=WSL-server 격리 PostgreSQL 18, Production=ysna-server/`envil.sinsan.kr`로 확정
- `[historical]` 신산님이 작업계획 v1.3·검증문서 v1.1·D1~D10 통합 기준선을 승인하고 작업 시작을 지시
- 승인 기록 `APPROVAL-20260810-INTEGRATED-BASELINE-001`과 G-01 WorkInstruction 발행
- G-01 BaselineRecord·Source Inventory·EvidenceManifest·CompletionReport 작성 및 Main `PRELIMINARY_ACCEPT`
- G-01 독립 Tester가 artifact 5/5·canonical target·`AV-CON-016`을 검증해 `PASS`
- Main Agent가 독립 증거를 재계산하고 G-01을 최종 `ACCEPTED`
- 신산님이 G-02 Q-01~Q-06·과거 미할당 5건·D1~D10 계보 결정을 승인
- `[historical revision 1]` G-02 DecisionRecord·validation allocation·테스트계획 v1.2와 target `E70E5BEB4F132AA97DA4F717712EF9B5BFA68C602C71331B3225922E02212577`을 제출
- G-02 독립 Tester가 `G02-DEF-001`로 `AV-GATE-026 FAIL / REWORK` 판정, 실패 TestReport SHA-256 `4B853057C4C370470C075B14384EB9FA2B881E2684AAB00E5D83CF2AEE274BF2` 보존
- WorkInstruction revision 2에 따라 4개 authority 상태·revision·hash 참조를 비의미 정규화하고 Developer read-only 재온보딩 완료
- G-02 revision 2 target `6C440ED0FC95DDF5F65642649995F1554917E908AC44DF11AE76BDC3006473D9`, EvidenceManifest SHA-256 `275200DDACD9A59AC3CF65F3CD37E5142573705102A3C6CA50A99D5DFA29EEAA` 고정
- G-02 revision 2 독립 Tester가 `G02-DEF-002`로 `AV-SAFE-033 FAIL / REWORK` 판정, 실패 TestReport SHA-256 `680232DEB4F232D858C3EB70EAEA875A9895BCCF5A0B9D867A66C76B633A565B` 보존
- WorkInstruction revision 3에 따라 canonical `parent_baseline_id`·`root_human_approval_id`를 binding에 추가하고 `BASELINE-G-02-DERIVED-20260810-001`을 생성
- G-02 revision 3 canonical target `B01C9BF94B00588DFCEFE35096C0D64A39FACE4D4123D34E314C1A54B07F5F17`, EvidenceManifest SHA-256 `E39688335A0B1877116E34691977F8060E6B698A4D4F8E8A7B42BDBE5A3CD00A` 고정
- G-02 revision 3 독립 Tester가 `AV-SAFE-033`·`AV-GATE-026`을 모두 `PASS`로 판정하고 Main Agent가 최종 `ACCEPTED`
- 비차단 `G02-OBS-001`은 다음 비의미 문서 정비 시 표제 명확화로 이관하며 합격 작업을 다시 열지 않음
- G-04의 8개 canonical JSON artifact template, Draft 2020-12 schema/catalog, 표준 라이브러리 checker를 test-first로 구현
- G-04 RED 11/11 예상 실패를 관찰한 뒤 GREEN 11/11, G-03 경계검사 포함 전체 회귀 20/20 PASS
- WorkInstruction fixture 단독 semantic projection과 expected fixture의 Developer diff 0, negative mutation 11종 거부 확인
- `[historical revision 1]` G-04 target/delivered `857179EF2FF83D491C00A4DFF409808B6DF3446FF238F39EC9BF0BE289F11372`, EvidenceManifest file SHA-256 `009745BBB04BDAA2F2CE5806236FB773A3D2A704BB07033103D7A7878CBCCA2B`

## 4. 온보딩 판정

- v2.6/v1.4/v1.2/v1.3/운영규칙 v1.4 기준 Developer 재온보딩 `PASS / READ_ONLY_READY`
- 프로젝트 목적·Phase·역할·승인·복구·실패 3회·Skill/Hook/Plugin 규칙 이해도 10문항 합격
- 97 Package·255 ID(CON 21·실행 234)·DIR 4종과 G-02→G-03 차단사항을 정확히 설명함
- 현재 상태: `G-05_ACCEPTED / G-06_READY_WORK_INSTRUCTION_NOT_ISSUED`
- 온보딩 증거: `docs/onboarding/developer-primary-ack.md` / SHA-256 `3110F6B21EFC3C7BE61B6CEB71A4586A75A80DC129D79DDC4B0A74AFE0039A69`

## 5. 승인·결정 상태

- 통합 기준선 승인: `APPROVED`
- 승인 subject: `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8`
- D1~D8·D10: 현재 구현 기준 승인
- D9: benchmark 후 선택 정책 승인
- G-02 결정: Q-01·Q-03~Q-06 `HUMAN_CONFIRMED`, Q-02 `RESERVED_NOT_DEFINED`, 과거 미할당 5건의 현재 매트릭스 배정 확정
- G-02 작업 상태: `ACCEPTED`
- G-02 독립 Test Report R3: `docs/test_reports/G-02_TEST_REPORT_R3.md` / SHA-256 `F191B95AF36181715E71815081DE45673FE4D2A91AE1DB643597DB3917451D35`
- G-02 approval subject: `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`
- G-02 테스트계획 계보: `[historical]` v1.1 `FE6AEFE4A352A29D61CCD8AC3DD2EB6D6C9B1CDF8E3C095DFDC593C06586D1B8` → `[historical revision 1]` v1.2 `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A` → 현재 v1.3 `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5`
- G-02 revision 3 binding: `MAIN_RECONFIRMED_NON_SEMANTIC:G-02-R2-G02-DEF-001`, `parent_baseline_id=BASELINE-G-01-20260810-001`, `root_human_approval_id=APPROVAL-20260810-INTEGRATED-BASELINE-001`, `derived_baseline_id=BASELINE-G-02-DERIVED-20260810-001`, `semantic_diff=NONE`
- G-01 최종 판정: `ACCEPTED`
- G-01 canonical target: `6E16BB405D58296CECDC1EE057A2DDE0A6FA601F6D289257CBBAE78E3C30A38C`
- G-01 독립 Test Report: `docs/test_reports/G-01_TEST_REPORT.md` / SHA-256 `E6471B535EB6A749F96E8C08A155F53E4BC2F90FFEFD00BD057C98351161C71A`
- G-03 revision 4 Developer 결과: `COMPLETED / TEST_REVIEW`
- G-03 독립 TestReport: `FAIL / REWORK_REQUIRED`, SHA-256 `91BCFC383C8D4970355F7A3366924181096F0AB92691AB94E36EB26C3FF1107E`
- 차단 finding: `G03-DEF-001` checker 우회, `G03-DEF-002` §25.3 경로 누락, `G03-DEF-003` pycache 범위 위반, `G03-DEF-004` inventory 총계 오류
- 현재 WorkInstruction: `WI-G-03-20260810-004`, SHA-256 `F7AB695C6B6D91D47287E12218A39A870E8AC3CADBBE09ED91E46B8E30CC0A3A`
- 동일 단계 유효 실패: G03-DEF-001~006은 scoped rework로 보완됐으며 독립 Tester PASS 전 `ACCEPTED` 금지
- G-03 revision 2 독립 TestReport R2: `FAIL / REWORK_REQUIRED`, SHA-256 `AE84877A644C9FDF2420318B52B716475235C97ED036DD0833A47AC7362016D1`
- 기존 `G03-DEF-001`~`004`의 원래 증상은 독립 closure 확인됨
- 새 차단 `G03-DEF-005`: 유효한 `from ..domain import events`를 checker가 domain 이탈로 오탐; 최초 1회
- 현재 WorkInstruction revision 3: `WI-G-03-20260810-003`, SHA-256 `5CB06696378B7F3BC313FA28F849C5534E11835D6EDA5402B4E0296680D84820`
- G-03 revision 3 독립 TestReport R3: `FAIL / REWORK_REQUIRED`, SHA-256 `F3EE86CD7636CF49A5F8BE510E60D310A558F1528F03CD5D0E60A75486CC20AD`
- `G03-DEF-005`와 기존 `001`~`004`의 지정 증상은 독립 closure 확인됨
- 새 차단 `G03-DEF-006`: beyond-top-level 상대 import가 음수 slice로 허용됨; revision 4에서 test-first 최소 guard로 closure 제출
- G-03 revision 4 target/delivered: `F03EC454E960BCF6A8271D7BE547129CB4220574254DCE9B927F2E12AFBFD6AB`
- G-03 revision 4 EvidenceManifest: `docs/evidence/manifests/G-03_EVIDENCE_MANIFEST.json` / SHA-256 `A089B389B21DBDADD7CBC6D18EC9C2374F858D4E92DD7BC75EF1580DA5D1388F`
- G-03 revision 4 독립 TestReport R4: `PASS / READY_FOR_MAIN_ACCEPTANCE`, SHA-256 `D9F25579559865C9369C8913C78AA20A496D06CE3D887F7F87BE3DEA12FA452F`
- Main Agent fresh 검증: unittest 9/9, checker, manifest target, pycache 0, Git 0 상태 PASS
- G-03 최종 판정: `ACCEPTED`; `G03-DEF-001`~`006` 실패 계보는 R1~R3에 보존
- G-04 revision 1 Developer 결과: `COMPLETED / TEST_REVIEW`, 이후 독립 Tester `REWORK`
- G-04 revision 1 target/delivered: `857179EF2FF83D491C00A4DFF409808B6DF3446FF238F39EC9BF0BE289F11372`
- G-04 revision 1 EvidenceManifest file SHA-256: `009745BBB04BDAA2F2CE5806236FB773A3D2A704BB07033103D7A7878CBCCA2B`
- Main fresh 검증: G-04 11 + G-03 회귀 9 = 20/20 PASS, checker 2종·JSON·hash·pycache 0 확인
- Main 판정: `PRELIMINARY_ACCEPT`; expected 비열람 독립 semantic reconstruction 대기
- G-04 독립 TestReport: `REWORK / AV-FLOW-003 FAIL`, SHA-256 `E31E3B27BCCB6F34F13EE8C3438F60CCBE618B5CC1E3CA53F3FCECF73DF170B5`
- `G04-DEF-001`: source WorkInstruction 단독 field/shape 선택 규칙 부재로 독립 projection diff 0 실패
- `G04-DEF-002`: manifest 선언 target canonicalization 재계산과 등록 target 불일치
- 현재 WorkInstruction revision 2: `WI-G-04-20260810-002`, SHA-256 `4330D9ED93731B70579D7BD7A590F65238738EFE425D829465DBE5BD75FB6558`
- revision 2 Developer closure: source `reconstruction_contract`가 projection field 순서·flat output·canonicalization·hash를 자체 기술하고 checker hard-code를 제거
- revision 2 Developer closure: 구조화 `target_algorithm`과 raw checksum 기반 target 함수로 실제 18개 artifact를 재계산
- revision 2 target/delivered: `5B5FA32568A7AD293C611BB5E85FCD4C0C0076EA787327CCC4AF1D936042827D`, canonical bytes `2109`, content bytes `85676`
- revision 2 EvidenceManifest file SHA-256: `F2674994201407532D6E18A9F9A0A94B606BA94385DCD126C03AF7F8264B09C1`
- revision 2 Developer verification: G-04 14/14, G-03 회귀 포함 23/23 PASS; finding closure는 독립 Tester 확인 전 공식 종료 아님
- G-04 revision 2 독립 TestReport R2: `PASS / READY_FOR_MAIN_ACCEPTANCE`, SHA-256 `0C5123F32FBD268EA6E91B9592F833F2A8D899119A47528FC5761C895B8D34AF`
- `G04-DEF-001~002` 독립 `CLOSED`, `AV-FLOW-003 PASS`, open blocking defect 0
- Main 최종 fresh 검증: 전체 23/23, checker 2종, report hash, JSON, diff-check PASS
- G-04 최종 판정: `ACCEPTED`
- G-05 revision 1 독립 TestReport: `FAILURE_REPORT`, SHA-256 `CB03A995BF654964623737C5A347DCBD21ED62BF1268E5A53F5867516C32C26E`; valid failure count 1
- G-05 revision 2 독립 TestReport: `PASS / READY_FOR_MAIN_ACCEPTANCE`, SHA-256 `ED0F03496060C84D67DE84C0758611610CD753CF8D854216F9933089F07C758C`
- `G05-DEF-001~006` 독립 `CLOSED`, 신규 차단 finding 0
- Main Agent 최종 판정: G-05 `ACCEPTED`; 검증된 revision 2 EvidenceManifest는 `docs/evidence/manifests/G-05_EVIDENCE_MANIFEST_R2.json` / SHA-256 `F9A5E7168B9B68B70D74B68DD495211BDC7961223E5E48CFC6F565638B9E69E6`로 불변 보존
- 신산님 승인 `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`: 확정 계획 안의 Package는 자동 진행하며 일반 진행 보고·계속 확인을 하지 않음
- 신산님 중단 보고 조건: 기능 범위·요구사항·중요 위험 변경 또는 DIR-1·2·3/canonical DIR-X 도달
- Git origin: `https://github.com/cyhuh7950/anvil.git`
- G-06 WorkInstruction revision 2: `WI-G-06-20260810-002` / SHA-256 `F8A966191412E3CC4CC29DC752169BC21B9E98CFD702134303F212454924352E`
- G-06 Developer 결과: `COMPLETED / TEST_REVIEW`; 8 fixture·8 golden·20 scenario·FI-01~08 계약과 Package별 immutable progress detached를 제출
- G-06 runtime scenario 상태: 전량 `DESIGN_LOCKED / NOT_EXECUTED`; 제품·브라우저·DB·배포 PASS 주장 없음
- G-06 revision 1 독립 TestReport: `FAILURE_REPORT / REWORK_REQUIRED`, SHA-256 `9B80C65D3DAC88CF0547C83F2F0E1D258974F678F057FB68943EB8E17A0DB42F`; 유효 실패 1회
- `G06-DEF-001`: REDFAIL fingerprint를 stable test ID·exception type·message만으로 canonicalize하고 32회 단일 hash로 재현
- `G06-DEF-002`: §49.17의 exact AV·responsible Package set·evidence set을 고정하고 wrong-nonempty trace를 거부
- `G06-DEF-003`: 8개 golden exact case hash·aggregate·subject candidate를 기존 사람 승인 계보의 Main-authored immutable anchor에 결박하고 coordinated rewrite를 거부
- G-06 golden anchor: `docs/baselines/G-06_GOLDEN_BASELINE_ANCHOR.md` / SHA-256 `4A3B9FBCC8460D793CA68DB3D88147413F5CE7EC653BA32CF8CFFA3A98AD8351`; 새 승인이 아닌 기존 사람 승인 범위 내 불변 evidence
- G-06 revision 3 Developer 결과: `COMPLETED / TEST_REVIEW`; 독립 Tester revision 2 재검증 대기
- G-06 revision 2 독립 TestReport: `PASS / READY_FOR_MAIN_ACCEPTANCE`, SHA-256 `436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546`
- `G06-DEF-001~003` 독립 `CLOSED`, 신규 차단 finding 0, `AV-GATE-005(fixture 기준)`·`AV-SAFE-010(fixture 준비)` PASS
- Main Agent 최종 판정: G-06 revision 3 `ACCEPTED`; 검증된 manifest는 `docs/evidence/manifests/G-06_EVIDENCE_MANIFEST_R3.json` / SHA-256 `1A61DA524064A0422E23F2C98B0179CD144E83470773FFFE1E4EAD58EA5D82F0`로 불변 보존
- G-07 WorkInstruction revision 2 `WI-G-07-20260810-002` / SHA-256 `1D51FBBB450BB677BDAD3BFB30DF04BBAB44C9F6472404735B08858A27C3B0FA`를 비의미 재결박하고, projection-aware 회귀 3건을 허용 범위 안에서 최소 수정함
- observed Git `main` HEAD와 `origin/main`은 `23bc0019aeba0d6ae2b04c52fad6c778d8b7b6e8`로 일치하며, stale `a70daa4` progress/HANDOFF 투영을 sequence 14 `REPOSITORY_RECONCILED` Event로 현재 관측값에 정합화함. 과거 push 시점으로 소급하지 않음
- G-07 active lineage의 valid failure count는 `0`; historical accepted failure는 G-05 1회·G-06 1회로 합계 `2`를 별도 보존함
- G-07 독립 TestReport: `PASS / AV-GATE-026 PASS / blocking finding 0`, SHA-256 `8F3C8CF31FA31DA7908F308953BFDDC9141327AB46D70AD4909CEFD540270DAF`
- Main Agent 최종 판정: G-07 revision 2 `ACCEPTED`; verified manifest는 `docs/evidence/manifests/G-07_EVIDENCE_MANIFEST_R2.json` / SHA-256 `7967674B6CBDA114ADF530C98B94BFB062888278F05AF7A9A775EA64EBE46320`로 불변 보존
- 별도 Phase G regression·독립 Gate TestReport·`PHASE_GATE_DECIDED` record 전에는 G Gate 완료 또는 A-01 READY로 승격하지 않음
- Phase G Gate Developer dry-run은 8단계 worker/write fencing 시나리오를 실행하고 `COMPLETED / TEST_REVIEW`로 제출함. standing approval은 Gate TestReport 이후 actor·approval_ref와 함께 적용하며 현재 적용하지 않음
- Phase G Gate 독립 TestReport revision 1은 `FAIL / REWORK`, `PGATE-DEF-001` 1건, SHA-256 `CEC22DA268505597042FD3C2113484FB805C6A0A4EAFFE2B9DADDB9FA63FD253`; Main이 정식 failure 1회로 수락함
- revision 2는 reconstruction `accepted_packages`를 canonical `G-01..G-07`과 exact 비교해 `G-07→G-99` wrong-but-nonempty 위조를 `GATE_RECONSTRUCTION_CONTRACT_MISMATCH`로 거부함
- Phase G Gate 독립 TestReport revision 2는 `PASS`, blocking 0, SHA-256 `1A0A852EAC34450BA1CB815C756096673CF2917B6915118F2BA2B46B9941B6DD`
- Main Agent는 standing approval `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`의 범위 일치를 확인하고 `owner_report_review_status=NOT_REPORT_SPECIFIC`으로 G Gate를 `ACCEPTED` 판정함
- 검증된 proposal manifest revision 2는 `docs/evidence/manifests/PHASE_G_GATE_EVIDENCE_MANIFEST_R2.json` / SHA-256 `C6A7CBC5FCD8B37DC9CE5DE48268DC45FEC13DE5401B4B44F08DB9016C1E9A3A`로 byte 불변 보존함
- 현재 상태는 Phase G Gate checkpoint commit/push 대기이며 A-01 WorkInstruction·구현은 아직 시작할 수 없음
- Phase G Gate checkpoint commit/push는 `5ca9c1f65a5909e75283b878764509d747d6d2cf`로 local/origin `main` 일치 확인됨
- sequence 26 `GIT_PUSH` event가 G Gate checkpoint `CLEARED`와 A-01 `READY` 전이를 기록함
- A-01은 시작 가능 상태지만 active WorkInstruction과 worker/write lease는 아직 `null`이며 구현은 시작하지 않음
- 신산님 승인 `APPROVAL-20260810-A01-FLOW001-RESPONSIBILITY-001`에 따라 A-01 역색인은 `AV-UI-005` 단독으로 정합화했고 `AV-FLOW-001` runtime 책임은 A-05·B-03·A Gate에 유지함
- `developer-primary` successor 재온보딩 ACK는 active authority 전량의 exact bytes/hash를 기록했으며 A-01 제품 구현 권한을 주장하지 않음
- sequence 27 `REPOSITORY_RECONCILED`는 local `a843ca71c5c3cb3bb5cc9ca85901a9bd320f6cfd`, upstream `57703ffc3521287cdd7d54b07bfd7c9001928388`을 실제 관측 그대로 비소급 기록함
- 현재 repository 상태는 `PUSH_PENDING_MAIN`; local/upstream 일치를 꾸미지 않았고 Task 3에서 commit·push를 수행하지 않음
- active WorkInstruction, worker lease, write lease는 모두 `null`; A-01 상태는 `READY`
- Main push 후 local `main`, tracking `origin/main`, remote `refs/heads/main`이 `355efcbbccf63ae89771923ba09db9b22acc03cb`로 일치함을 직접 재확인함
- sequence 28 `GIT_PUSH`는 A-01 responsibility successor의 실제 push 완료를 현재 projection으로 기록하고 sequence 27 pre-push 관측을 수정하지 않음
- post-push 상태도 A-01 `READY`, active WorkInstruction·worker lease·write lease `null`, derived baseline active를 유지함
- Main push 후 local `main`, tracking `origin/main`, actual remote `refs/heads/main`이 `84c47406a8d7e75e63f26cb8fed52b058237df5d`로 일치함을 직접 재확인함
- sequence 29 `REPOSITORY_RECONCILED`는 seq27/28을 수정하지 않고 독립 Task 4 검증 진입용 historical projection으로 보존됨
- sequence 30 `REPOSITORY_RECONCILED`는 Task 4 보고서 `9555428AF1FA22C05A74010849564F3DA6160DAD9C1C736DBE5E0B3EBD998369`를 수락하고 A-01 사전조건을 `ACCEPTED / READY_FOR_A01_WI`로 투영함
- active 상태는 A-01 `READY`, active WorkInstruction·worker lease·write lease `null`이며 `AV-FLOW-001`은 계속 `RUNTIME_DEFERRED`임
- repository projection은 base `853da76458929e007d8a02ab32f7f918ab26d590`와 정확한 9개 tracked path allowlist를 결박하며 final commit SHA 자기참조를 요구하지 않음
- sequence 31~33은 Main Agent가 `developer-primary-a01`에 worker/write lease를 발급하고 WI-A-01-20260811-001을 `ACTIVE`로 시작한 비소급 착수 기록임
- historical baseline `7422b07b85bcdcec52031e1b10098ab6ca089170`은 dispatch HEAD `e97c35540c51d812c221469e272f0f87cd667839`의 ancestor이며, dispatch-time local/upstream 일치는 start Event와 current repository projection에 별도 결박함
- `AV-FLOW-001`은 계속 `RUNTIME_DEFERRED / NOT_EXECUTED`; 기능 범위·요구사항·중요 위험 변경 및 DIR 도달 없음, 보고 결정은 `AUTO_CONTINUE`
- Developer는 A-01 정적 산출물 13개를 `COMPLETED_PENDING_MAIN_PROJECTION`으로 동결했고 Developer EvidenceManifest SHA-256 `11C7321DF2657879E8B46FE95A2E8B86ADA573BF91C0CD76C115B55ADEF2301B`를 제출함
- sequence 34·35는 write/worker lease를 순서대로 회수했고 stale fencing token의 후속 write·execution은 허용하지 않음
- sequence 36은 Developer 결과를 `COMPLETED / TEST_REVIEW / accepted=false`로 투영하며 독립 Tester L7 전 `ACCEPTED`와 A-02 착수를 금지함
- current repository projection은 base `16af3f4284245aea4df130c5efa30700743fc6f6`과 Developer 13개 및 Main completion projection/tooling을 합친 exact 24-path allowlist를 결박함
- 독립 Tester는 `A01-TST-BLK-001`을 첫 유효 `FAILURE_REPORT`로 확정했고, Main은 기능 범위·요구사항·중요 위험 변경 없이 WorkInstruction revision 2를 발행함
- sequence 37~39는 `developer-primary-a01`에 epoch 2 worker/write lease를 발급하고 TestReport finding에서 A-01을 `ACTIVE / REWORK_IN_PROGRESS`로 재개한 비소급 기록임
- rework 기준 local/upstream HEAD는 `d13b94a11b5f4151cccdd37a03c7ce61bf6409eb`; 기존 Developer manifest와 TestReport는 immutable predecessor로 유지함
- Developer는 revision 2 exact 8-path 산출물을 `COMPLETED_PENDING_MAIN_PROJECTION`으로 동결했고 `A-01_EVIDENCE_MANIFEST_R2.json` SHA-256 `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4`를 제출함
- sequence 40·41은 epoch 2 write/worker lease를 순서대로 회수했고, sequence 42는 `COMPLETED / TEST_REVIEW / accepted=false / rework_revision=2`와 `A01-TST-BLK-001 FIXED_AWAITING_INDEPENDENT_RETEST`를 비소급 투영함
- revision 2 completion 기준 local/upstream HEAD는 `0162169cdbbf65c5f6b27c4625a82f5f16383bb6`; 독립 Tester R2 PASS 전 A-01 `ACCEPTED` 및 A-02 착수를 금지함
- 독립 Tester R2는 `PASS / READY_FOR_MAIN_ACCEPTANCE`, blocking finding 0, `A01-TST-BLK-001 RESOLVED`로 판정했고 TestReport SHA-256은 `9DD0EE2626800E28420DB5AC3597BE3D3717586632E7441938904E946EBCF620`임
- Main Agent는 revision 2 evidence를 재검토해 sequence 43 `MAIN_PACKAGE_ACCEPTED`로 A-01을 최종 `ACCEPTED`하고 A-02를 `READY`로 투영함
- 비차단 `A01-TST-R2-MIN-001`은 합격 Package를 다시 열지 않고 CompletionReport의 revision 2 sequence `40~42` 및 `17-path repository allowlist / 19-row predecessor evidence manifest` 구분으로 흡수함

## 6. 다음 안전 행동

G-05, G-06, G-07, Phase G Gate와 A-01은 최종 `ACCEPTED`다. current Package는 `A-02 / READY`이며 active WorkInstruction·agent·worker/write lease는 모두 `null`이다. A-01의 유효 실패 1회는 historical lineage로 보존하고 A-02 active lineage count는 0이다. 다음 안전 행동은 Main이 A-02 WorkInstruction을 발행하는 것이며, 유효 instruction과 worker/write lease 전에는 A-02 제품 구현을 시작하지 않는다.

DIR-1·DIR-2·DIR-3에 도달하면 결과가 `ALIGNED`여도 즉시 작업을 중단하고 신산님께 보고한다. 신산님의 계속 지시가 있을 때까지 후속 Gate·Package·Subagent·write·commit·push·배포를 시작하지 않는다.

## 7. 재개 절차

새 세션은 다음을 순서대로 확인한다.

1. 루트 `AGENTS.md`
2. 설계서·작업계획서 실제 hash
3. 운영규칙
4. `build-progress.json`
5. 이 HANDOFF
6. Developer 온보딩 증거
7. 승인 기록과 다음 WorkInstruction

불일치가 있으면 구현하지 않고 `RECONCILE_REQUIRED`로 신산님에게 보고한다.
