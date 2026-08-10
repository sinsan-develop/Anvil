# A-01 독립 TestReport R2

## 판정

`PASS / READY_FOR_MAIN_ACCEPTANCE`

- Work Package: `A-01`
- 검증 ID: `AV-UI-005`
- 검증 수준·방법: `L7 / MI / STATIC_ONLY`
- WorkInstruction revision 2 SHA-256: `F7F9F1F37320B3A75DB48FBB5DD230D9D2774BB79498DDCA2FF2DB0416CBDF60`
- 검증 HEAD / `origin/main`: `d027513c54069e5d4cd7b2e8233e434ede978755`
- R1 TestReport SHA-256: `53AB8F7F27BBC291FE3A8F338E23552DA14E53629B049A6EE225CA10E353A020`
- R1 finding: `A01-TST-BLK-001` — `RESOLVED`
- blocking finding: `0건`
- 신규 비차단 MINOR: `1건`

## R1 finding 재검증

1. `approval_boundary.human_approval_required_for`는 순서 독립 exact 집합 `FUNCTION_SCOPE_CHANGE`, `REQUIREMENT_CHANGE`, `IMPORTANT_RISK_CHANGE`로 고정됐다.
2. 다섯 decision의 ID, step, actor, subject, subject hash 요구, allowed results, reject/revise target을 literal exact contract로 비교한다.
3. 모든 decision reject/revise target은 존재하는 step·terminal 또는 명시적 비상태 결과여야 한다.
4. Concept, WorkInstruction, Release의 reject/revise 결과는 각각 machine-readable edge와 `PATH-REJECT` 또는 `PATH-REVISE.outcome_edge_ids`에 연결된다.
5. R1의 네 hostile mutation을 동일하게 재현한 결과는 다음과 같다.
   - approval guard 제거 → `APPROVAL_BOUNDARY_MISMATCH`
   - `DEC-CONCEPT.revise_result = TERMINAL-NONEXISTENT` → `DECISION_CONTRACT_MISMATCH`, `DECISION_TARGET_UNKNOWN`, `DECISION_EDGE_MISSING`
   - `EDGE-12-REJECT` 삭제 → `DECISION_EDGE_MISSING`, `DECISION_PATH_BINDING_MISSING`
   - `DEC-CONCEPT.allowed_results = [SELECT]` → `DECISION_CONTRACT_MISMATCH`

따라서 R1에서 확인한 사람 승인 및 decision outcome fail-open은 동일 mutation에 대해 fail-closed로 전환됐다.

## 정적 Journey 계약

- 14개 canonical 단계와 `PATH-NORMAL`, `PATH-REJECT`, `PATH-REVISE`, `PATH-STOP`, `PATH-RESUME`가 catalog에서 연결된다.
- screen map, Phase Rail, decision/approval map, progressive disclosure 계약이 유지된다.
- STOP은 checkpoint·완료 단계·중단 이유·다음 안전 행동을 요구한다.
- RESUME은 동일 artifact hash·checkpoint·완료 단계 복원과 중복 실행 금지를 요구한다.
- Technical Test, ProductValidation, DefectAssessment, ReleaseDecision, Learning은 분리된다.
- `AV-FLOW-001`은 A-01 assigned verification에 포함되지 않고 `A-05`, `B-03`, `A Gate`의 `RUNTIME_DEFERRED / NOT_EXECUTED` 책임으로 유지된다.
- 정적 render는 `E-SHOT_STATIC — not browser/runtime evidence`이며 runtime screenshot으로 승격하지 않는다.

## Evidence·progress 재계산

- R1 TestReport는 SHA-256 `53AB8F7F27BBC291FE3A8F338E23552DA14E53629B049A6EE225CA10E353A020`으로 불변이다.
- R1 EvidenceManifest는 SHA-256 `11C7321DF2657879E8B46FE95A2E8B86ADA573BF91C0CD76C115B55ADEF2301B`으로 불변이다.
- R2 EvidenceManifest file SHA-256은 `BB184388A47A31C9A238AE081C441A8A149815AE45F4B196E3421B1B7C5A95A4`다.
- R2 EvidenceManifest raw artifact `10개`의 bytes·SHA-256 불일치 `0건`, target/delivered `FED10096AE42BEFFD0BB20DB5362A17B4946BBB85DA22CFE24C5331D6B4D170E` 일치, self-reference 없음.
- Rework completion manifest file SHA-256은 `A2B6416A43742C752BB71209D5F348A00A236FF2B87F6131FF4CC83C207A7E9C`다.
- Rework completion manifest raw checksum `19개`의 불일치 `0건`, canonical bytes `2124`, content bytes `345453`, target/content/delivered `sha256:B9ABCE10C2AD44366B5781516A2F57AF65B2DD95FF2F2281F899651CF5579688` 일치, self-reference 없음.
- progress는 sequence `42`, `TEST_REVIEW`, `COMPLETED`, `accepted=false`, independent Tester `R2_PENDING`, worker/write lease `null`이다.
- local HEAD와 `origin/main`은 `d027513c54069e5d4cd7b2e8233e434ede978755`로 일치한다.
- validated base `0162169cdbbf65c5f6b27c4625a82f5f16383bb6` 이후 실제 변경 경로는 repository exact allowlist `17개`와 일치하고 `git diff --check`는 PASS했다.

## Fresh 검증

1. `C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_a01_journey -v`
   - `11/11 PASS`
2. `C:\Users\cyhuh\anaconda3\python.exe scripts/check_a01_journey.py --json`
   - `PASS`, errors `[]`
3. `C:\Users\cyhuh\anaconda3\python.exe scripts/check_project_progress.py`
   - `PASS`, sequence `42`, reporting `AUTO_CONTINUE`
4. `C:\Users\cyhuh\anaconda3\python.exe scripts/check_g07_baseline.py`
   - `PASS`, packages `97`, AV `255`, uncovered `0`, scenarios `20`
5. `C:\Users\cyhuh\anaconda3\python.exe scripts/check_phase_g_gate.py`
   - `PASS`, accepted `7`, decisions `10`, packages `97`, AV `255`, scenarios `20`, sync `7`
6. `C:\Users\cyhuh\anaconda3\python.exe -m unittest discover -s tests/tooling -p 'test_*.py' -v`
   - `115개 중 114 PASS / 1 FAIL`
   - 유일 실패는 historical Phase G checkpoint manifest를 현재 mutable detached progress와 비교하는 기존 `test_checkpoint_manifest_binds_current_detached_without_self_reference`다.
   - 기존 오류 코드 `GATE_CHECKPOINT_PROGRESS_REF_INVALID`, `GATE_CHECKPOINT_RAW_MISMATCH`, `GATE_CHECKPOINT_TARGET_BYTES_MISMATCH`, `GATE_CHECKPOINT_TARGET_MISMATCH`가 동일하게 재현됐다.
   - Phase G checker 자체와 R2 허용 상태 회귀는 PASS했으며, 이 historical baseline failure는 A-01 R2 신규 finding과 분리한다.

## 신규 비차단 MINOR

### `A01-TST-R2-MIN-001` — revision 설명 문구의 수치가 현재 투영과 불일치

**판정 →** `PASS 유지 / non-blocking MINOR`

**판단 이유 →** `A-01_COMPLETION_REPORT.md` rollback 문구는 R1의 `sequence 34`를 유지하지만 R2 변경 sequence는 `40~42`다. `build-progress.json.repository.worktree_status`는 exact allowlist를 `nineteen-path`라고 부르지만 실제 repository allowlist와 Git diff는 `17개`다. 별도 completion manifest raw checksum이 `19개`이므로 두 개념이 혼용된 것으로 판단한다. machine-readable sequence·allowlist·manifest·checker는 모두 일치하므로 기능·승인·증거 결박에는 영향이 없다.

**조치 →** 합격 Package를 다시 열지 않는다. 다음 progress/HANDOFF 갱신 또는 다음 WorkInstruction에 현재 sequence와 `17-path repository allowlist / 19-row evidence manifest` 구분을 반영한다.

## 미검증 runtime 경계

- 브라우저 실제 화면·click·Network: `NOT_EXECUTED`
- API·DB·영속 Event·same-origin BFF: `NOT_EXECUTED`
- 사람 승인·거부·보완 실제 runtime guard: `NOT_EXECUTED`
- STOP/RESUME 실제 checkpoint 복구·중복방지: `NOT_EXECUTED`
- WSL-server, PostgreSQL 15/18, ysna-server, Production, 배포, Release: `NOT_EXECUTED`
- `AV-FLOW-001`: `RUNTIME_DEFERRED / NOT_EXECUTED`

## 조치

`A-01` revision 2는 독립 Tester 관점에서 `READY_FOR_MAIN_ACCEPTANCE`다. Main Agent가 evidence와 비차단 MINOR를 검토해 최종 수락 여부를 판단한다. 본 Tester는 `ACCEPTED`, commit/push, A-02 착수를 수행하지 않는다.
