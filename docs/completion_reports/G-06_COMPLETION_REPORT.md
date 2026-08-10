# G-06 CompletionReport revision 4 — 독립 재검증 PASS와 Main 최종 수락

- package_id: `G-06`
- revision: `4`
- work_instruction_id: `WI-G-06-20260810-002`
- work_instruction_sha256: `F8A966191412E3CC4CC29DC752169BC21B9E98CFD702134303F212454924352E`
- invocation_prompt_sha256: `F2F9B857903B6E63322917E8FE7A920EAF7CF27C90123ACC2D2BA15A48359B1A`
- design_baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- design_baseline_sha256: `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- work_plan_sha256: `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
- validation_matrix_sha256: `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3`
- actor: `developer-primary-g06`
- result_status: `ACCEPTED`
- review_state: `ACCEPTED`
- accepted_failure_report_sha256: `9B80C65D3DAC88CF0547C83F2F0E1D258974F678F057FB68943EB8E17A0DB42F`
- independent_tester_r2_sha256: `436A0C67882ED51022B365B8CE4E41C7C302B19273187D1514E734A30EEB8546`
- valid_failure_count: `1`
- target_hash: `BF1EAB94FFE59E3C3B952E7A0F62E54F10DAA7FEEB0375881C9C3D1A2FDA0D1E`
- delivered_hash: `BF1EAB94FFE59E3C3B952E7A0F62E54F10DAA7FEEB0375881C9C3D1A2FDA0D1E`
- target_canonical_bytes: `2252`
- target_content_bytes: `186612`
- evidence_manifest: `docs/evidence/manifests/G-06_EVIDENCE_MANIFEST.json`
- evidence_manifest_content_hash: `BA4C884772CE05F94CDD40E406AA06C879A57109E23223DE0E364D24961121C3`
- evidence_manifest_file_sha256: `8B84F0D7EF3F20B99711A177FFC92A9EC8B20D07007E01962075C94B8A57B502`
- immutable_r3_manifest_sha256: `1A61DA524064A0422E23F2C98B0179CD144E83470773FFFE1E4EAD58EA5D82F0`
- progress_snapshot_hash: `FC58A3B366334F9F17E1153909B859B22BE4835F4C01C2382C3E039F2D9BF34D`
- progress_file_sha256: `86C89697E8F34E6EA969FCB2A11738EF821C963D57A527DF7924706C76D21CC6`
- progress_canonical_sha256: `5F43A4BAD8802A99B132C8227F58B1CDC9FE5A9E20DDE5FD39818891C27D8AC8`
- handoff_file_sha256: `24E06CEB9BD7FDB6A4119DD17AB9E8644B56CF25F03F4E1B54A7E74288154B7B`
- handoff_summary_canonical_sha256: `D50C2263788111244389F98F7450CBB8BD64882BDA94F2F4053CBB74DBA96894`
- detached_digest_sha256: `D33C6633D3E8428F1D1501B1067D2FAE10649FF46CA42E661F121F908AB6FB3B`
- golden_candidate_file_sha256: `9A1802A39711D64FE571D88912EEF368406E49A9C7835E7145113C2285F28EAF`
- golden_aggregate_hash: `33128E180D32B89813C62BAA382483001A52ABCF74DDEC8899076246B97DB56D`
- golden_exact_subject_hash: `F3447FC7323F63CB89B680C45C7DF9D0CC0C967E5F615508BAC115913F329923`
- golden_anchor_file_sha256: `4A3B9FBCC8460D793CA68DB3D88147413F5CE7EC653BA32CF8CFFA3A98AD8351`

## 판정

`ACCEPTED` — 독립 Tester revision 2가 `PASS / READY_FOR_MAIN_ACCEPTANCE`, `G06-DEF-001~003 CLOSED`, 신규 차단 0건과 할당 AV 2종 PASS를 보고했고 Main Agent가 G-06 revision 3을 최종 수락했다. 검증된 revision 3 manifest는 immutable R3 path에 exact 보존하고, canonical revision 4 manifest가 acceptance progress/HANDOFF detached snapshot을 단방향으로 결박한다. current Package는 `G-07 / READY`지만 G-07 WorkInstruction·구현, commit, push는 수행하지 않았다.

## 판단 이유

1. `FIX-PY-CLEAN`, `FIX-PY-DIRTY`, `FIX-PY-REDFAIL`, `FIX-TS-CLEAN`, `FIX-TS-NOTOOL`, `FIX-PROTECTED`, `FIX-LARGE`, `FIX-CONFLICT`가 index에 정확히 한 번씩 등록되고 각 manifest·source hash가 재계산됐다.
2. materializer는 nested `.git`을 저장소에 두지 않고 임시 대상에서 `git init`·초기 commit·상태 변이를 수행한다. 저장소 source tree에는 `node_modules`도 남기지 않는다.
3. `FIX-TS-CLEAN`은 local npm cache만 사용한 `npm ci --offline --ignore-scripts`로 TypeScript `5.9.3`을 실제 설치하고 local `tsc --noEmit -p tsconfig.json`을 통과했다. `FIX-TS-NOTOOL`은 격리 PATH에서 global fallback 없이 `BLOCKED / TOOL_NOT_INSTALLED`를 반환했다.
4. `FIX-PY-DIRTY` read-only 검사 전후 tracked dirty와 untracked 파일의 content hash·mtime snapshot이 완전히 같았다.
5. golden expected-value·hash·approval ref 변조, false product PASS, `NOT_EXECUTED` 누락, fixture 누락·중복, 실제처럼 보이는 secret, scenario AV/Package/evidence trace 누락, TS global fallback을 mutation test가 거부했다.
6. §49.17 scenario 20건과 FI-01~08은 모두 `implementation_status=DESIGN_LOCKED`, `execution_status=NOT_EXECUTED`다. 정적 계약을 runtime·제품 PASS로 승격하지 않았다.
7. revision 2에서 G-05 accepted manifest와 generic detached digest의 bytes를 보존하면서 G-06 고유 detached path/current ref를 도입했다. 과거 manifest는 동결 raw rows·target을 검증하고 현재 progress 비교는 현재 Package detached에만 적용된다.
8. revision 3에서 `G06-DEF-001`은 fingerprint 입력을 stable test ID·exception type·message로 제한해 elapsed/path/address를 제거했고 실제 32회가 단일 hash로 수렴했다.
9. `G06-DEF-002`는 §49.17 20건의 exact AV ID·responsible Package set·evidence set canonical map을 고정해 값이 존재하지만 틀린 trace도 거부한다.
10. `G06-DEF-003`은 8개 case exact hash 집합과 aggregate/subject candidate를 `MAIN_AUTHORED_GOLDEN_BASELINE_ANCHOR`에 결박했다. Anchor는 새 승인이 아니라 기존 신산님 승인 ID·subject·file hash·scope 안의 불변 evidence이며 Developer가 수정하지 않았다.

## 조치

Main Agent가 승인된 계획에 따라 G-07 WorkInstruction을 별도로 발행하는 것이 다음 안전 행동이다. 본 acceptance materialization은 G-07 구현, commit 또는 push를 시작하지 않는다.

## 8개 fixture 실제 materialization 결과

| fixture | 실제 관찰 결과 | 판정 |
|---|---|---|
| `FIX-PY-CLEAN` | 실제 Git `status --porcelain` 빈 출력, fixture unittest 성공 | PASS |
| `FIX-PY-DIRTY` | ` M src/calc.py`, `?? notes/local-note.txt` 정확히 재현 | PASS |
| `FIX-PY-REDFAIL` | unittest 비영(0 아님), `FAIL: test_known_baseline_failure`, stable identity fingerprint 32회가 단일 `40F10CC2...2402` | EXPECTED_FAIL_REPRODUCED |
| `FIX-TS-CLEAN` | offline local install, `Version 5.9.3`, local `tsc --noEmit` 성공 | PASS |
| `FIX-TS-NOTOOL` | local executable 부재·격리 PATH, `BLOCKED / TOOL_NOT_INSTALLED` | EXPECTED_BLOCK_REPRODUCED |
| `FIX-PROTECTED` | 합성 표식 `ANVIL_SYNTHETIC_SECRET=NOT_A_REAL_CREDENTIAL`만 존재 | PASS |
| `FIX-LARGE` | 24개 이상 module과 cycle 구조 재현 | PASS |
| `FIX-CONFLICT` | 두 step의 동일 write path 충돌 재현 | PASS |

`FIX-PY-DIRTY` snapshot은 검사 전후 모두 2개 변경 entry였고 canonical SHA-256이 `AD7FE2214634623B11EE46633D58945E6B491EC567A4C538926DECA7D4525903`으로 동일했다. snapshot에는 각 entry의 content SHA-256과 `mtime_ns`가 포함되므로 content·mtime 변화는 0이다.

## TDD와 검증 증거

| 단계 | 명령 | 종료 코드 | 실제 결과 |
|---|---|---:|---|
| 최초 RED | `python -m unittest tests.tooling.test_g06_test_assets.G06ExecutablePresenceTests` | 1 | checker/materializer 부재가 예상 사유로 실패 |
| fixture GREEN | `python -m unittest tests.tooling.test_g06_test_assets` | 0 | fixture/golden/scenario/FI 계약 PASS |
| TS offline | `npm ci --offline --ignore-scripts`; local `tsc --version`; local `tsc --noEmit -p tsconfig.json` | 0 | `Version 5.9.3`, typecheck PASS |
| revision 2 RED | Package 고유 detached resolver/current manifest/history 전환 test | 1 | 고정 G-05 detached/current-live 비교 가정을 예상대로 재현 |
| revision 2 targeted GREEN | 동적 detached/current manifest/history projection 4건 | 0 | `Ran 4 tests ... OK` |
| revision 3 RED | fingerprint noise, wrong-nonempty trace, coordinated rewrite/baseline 부재 3건 | 1 | `FFF`, 세 독립 finding 증상 재현 |
| anchor actual RED/GREEN | 실제 immutable anchor의 SHA-256 field parser | 1 → 0 | 숫자가 든 `sha256` field key 누락을 재현 후 actual anchor 검증 PASS |
| revision 3 G-06 GREEN | `python -m unittest tests.tooling.test_g06_test_assets` | 0 | `Ran 25 tests ... OK`; REDFAIL 32회 및 8 fixture 포함 |
| 최종 전체 회귀 | `python -m unittest -v tests.tooling.test_g06_test_assets tests.tooling.test_project_progress tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries` | 0 | fresh final `Ran 71 tests in 18.362s ... OK` |
| 독립 Tester revision 2 | `docs/test_reports/G-06_TEST_REPORT_R2.md`의 context-free 재검증 | 0 | `PASS`, 40회 fingerprint 단일성, 세 finding CLOSED, 신규 차단 0 |
| acceptance projection RED | G-06 ACCEPTED → G-07 READY projection test | 1 | 기존 `TEST_REVIEW` 상태를 예상대로 재현 |
| acceptance projection GREEN | 동일 projection test | 0 | `Ran 1 test ... OK` |
| acceptance 최종 전체 회귀 | G-06/G-05/G-04/G-03 전체 suite | 0 | fresh `Ran 71 tests in 20.913s ... OK` |
| G-06 checker | `python scripts/check_g06_test_assets.py .` | 0 | `fixtures=8 golden=8 scenarios=20 fault_injections=8` |
| progress checker | `python scripts/check_project_progress.py .` | 0 | `PASS sequence=9 reporting=AUTO_CONTINUE` |
| G-04 checker | `python scripts/check_artifact_templates.py .` | 0 | `8 templates validated` |
| G-03 checker | `python scripts/check_dependency_boundaries.py .` | 0 | dependency violation 0 |
| manifest self-check | target/content/raw checksum·current detached 재계산 | 0 | error 0, target/delivered/content/raw bytes 일치 |

## golden·scenario·FI와 mutation 결과

- Golden: `8/8`, 각 case가 approval ref와 immutable content hash를 가지며 `golden-lock.json`이 case path·hash를 다시 결박한다.
- Scenario: `20/20`, source clause·AV ID·책임 Package·Gate·level·method·environment·evidence·reset/repeat 계약 완비, 모두 `DESIGN_LOCKED / NOT_EXECUTED`.
- Fault injection: `FI-01~FI-08`, minimum repeat `3`, 모두 `DESIGN_LOCKED / NOT_EXECUTED`.
- Mutation: false PASS, status 누락, golden expected/hash/approval 변경, fixture/index hash 변경, secret heuristic, scenario trace 누락, global TypeScript fallback이 모두 거부됐다.

## 진행 증거와 과거 evidence 보존

- G-06 acceptance detached revision 4: `docs/progress/progress-handoff-detached-digest-g06.json`, SHA-256 `D33C6633D3E8428F1D1501B1067D2FAE10649FF46CA42E661F121F908AB6FB3B`
- G-05 accepted live manifest: SHA-256 `B8BCC1C6D5C409060DF73D0F8CDF25B5C07A9E22941DB65878972E776A971083` byte 불변
- G-05 generic detached: SHA-256 `BF4C0037118F49DD4137AFB7279AE92AE573AA76EB3677B4E5592C49773AB438` byte 불변
- current progress/HANDOFF는 sequence `13`, `READY`, current Package `G-07`, completed `G-06`, valid failure `1`, reporting `AUTO_CONTINUE`로 일치한다.

## 변경 경로와 영향 범위

- fixture/golden/schema/fault: `tests/fixtures/repositories/**`, `tests/fixtures/golden/**`, `tests/fixtures/schemas/**`, `tests/fault/**`
- tooling/test: `scripts/materialize_fixture_repository.py`, `scripts/check_g06_test_assets.py`, `tests/tooling/test_g06_test_assets.py`
- Package별 progress evidence 최소 일반화: `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`, `docs/governance/schemas/project-progress.schema.json`
- G-06 evidence/report/progress: `docs/evidence/manifests/G-06_EVIDENCE_MANIFEST.json`, 본 보고서, `docs/progress/**`

설계서·작업계획서·매트릭스·테스트계획서·운영규칙·AGENTS.md, G-01~G-05 accepted artifact/TestReport/immutable manifest, 제품 API/UI/DB/migration/queue/Provider/Docker는 수정하지 않았다.

## Git 기준선

- branch: `main`
- 시작/현재 HEAD: `a70daa4933099b33c76575e0f278f22e15016649`
- upstream: `origin/main` at `a70daa4933099b33c76575e0f278f22e15016649`
- commit/push/tag/deploy: 실행하지 않음

## SKIPPED·BLOCKED·미검증

- SKIPPED: 없음.
- BLOCKED: 없음.
- 독립 Tester revision 2가 세 finding closure와 AV 2종 PASS를 확인했고 Main Agent가 G-06을 최종 수락했다.
- 20개 §49.17 runtime scenario와 FI-01~08 실제 fault injection은 설계상 `NOT_EXECUTED`다.
- 제품 API/UI/browser/DB/Docker/WSL/production/deployment/release 검증은 G-06 범위 밖이며 미실행이다.
- fixture/static PASS는 제품 또는 운영 PASS를 뜻하지 않는다.

## 기존 기능 유지와 rollback

G-05/G-04/G-03 tooling 전체를 G-06과 함께 회귀해 기존 계약의 보존을 확인했다. rollback이 필요하면 G-06 신규 허용 경로, G-06 Package별 detached/current ref, G-06 progress/HANDOFF event만 되돌린다. G-05 accepted manifest와 generic detached를 포함한 G-05 이전 기준선은 수정·삭제하지 않는다.
