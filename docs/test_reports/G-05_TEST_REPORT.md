# G-05 독립 Test Report

- package_id: `G-05`
- tester_role: `independent_tester`
- verification_revision: `1`
- environment: `ENV-LOCAL`
- branch / HEAD: `main` / `a3014da95b34d8fe3a0a22418d78016b0fe57e61`
- upstream / remote HEAD: `origin/main` / `a3014da95b34d8fe3a0a22418d78016b0fe57e61`
- work_instruction_id: `WI-G-05-20260810-001`
- work_instruction_sha256: `10D54BAC7D6CD87273861AFF2B47B4C09492C7DAEF7B2445B4608603B33B569A`
- invocation_prompt_sha256: `F2F9AD88ECAF41D8753B9C3444F2EACDA33CF6B59F69F4C313DA183C1635CAD2`
- operating_approval_sha256: `A0986462BB0D2894BDC24C5C2A9022116B2173138C63A077F1E4B58500B85288`
- evidence_manifest_file_sha256: `46BBCEF2FD42ED9CB03FD9C6B114B60A8AE8E7A249C2C4815D00740496EFAC27`
- target / delivered: `85BC3D40BDD3599D4EA7AB8F0A546DC988EA7674545466AA9DC6C4F75FD421AA`
- overall_status: `REWORK`
- result_counts: `PASS 2 / FAIL 3 / SKIPPED 0 / BLOCKED 0`
- blocking_findings: `6`

## 판정

`REWORK` — `AV-STAT-015`, `AV-STAT-041`은 PASS지만 `AV-STAT-014`, `AV-STAT-016`, `AV-STAT-042`는 FAIL이다. 공식 36개 테스트와 checker 3종은 fresh 실행에서 통과했으나, 독립 적대 변형 7건 중 5건이 checker를 우회했고 EvidenceManifest target이 G-05 핵심 전달물인 progress/HANDOFF를 결박하지 않는다.

최신 승인 `APPROVAL-20260810-AUTONOMOUS-EXECUTION-001`을 우선 적용했다. routine recovery는 `AUTO_CONTINUE`가 맞지만, 기능 범위·요구사항·중요 위험 변경 또는 DIR 상태는 반드시 `STOP_AND_REPORT_*`이어야 한다.

## 판단 이유

### 검증 ID별 판정

| 검증 ID | 판정 | 이유 |
|---|---|---|
| `AV-STAT-014` | `FAIL` | 현재 routine `AUTO_CONTINUE`는 정상이나 `SCOPE_EXPANSION_REQUIRED` pending approval을 그대로 `AUTO_CONTINUE`로 허용함 |
| `AV-STAT-015` | `PASS` | 작업계획서 15장 최소 17개 필드, 확장 recovery 필드, snapshot hash, registry ref가 존재하고 누락 mutation을 거부함 |
| `AV-STAT-016` | `FAIL` | event type 열거만 검사하고 유형별 payload/상태 효과를 검증하지 않아 빈 `GIT_PUSH` event를 허용하며 전체 범주 fixture도 없음 |
| `AV-STAT-041` | `PASS` | A-15/C-15/E-11 ACCEPTED 뒤 checkpoint 누락 3건과 DIR_HOLD 중 lease 1건을 모두 거부함 |
| `AV-STAT-042` | `FAIL` | 존재하지 않는 owner direction Event ID만 넣어도 `CLEARED`를 허용함 |

### G05-DEF-001 — EvidenceManifest가 progress/HANDOFF를 결박하지 않음

- 심각도 / blocking: `MAJOR / true`
- manifest raw checksum 17건은 실제 파일 bytes/SHA와 17/17 일치한다.
- 독립 target 재계산:
  - content bytes: `63234`
  - canonical bytes: `1933`
  - SHA-256: `85BC3D40BDD3599D4EA7AB8F0A546DC988EA7674545466AA9DC6C4F75FD421AA`
  - target/delivered: 모두 일치
- manifest content hash `57F2333E22EFCE0B24B705850C1D7407986EFB1F04C9BC085D351B0E5CB4B194`와 file hash `46BBCEF2FD42ED9CB03FD9C6B114B60A8AE8E7A249C2C4815D00740496EFAC27`도 재현됐다.
- 그러나 `raw_checksums`에 다음 핵심 전달물이 없다.
  - `docs/progress/build-progress.json`
  - `docs/progress/BUILD_HANDOFF.md`
- progress snapshot은 self-hash이고 progress가 manifest를 참조할 뿐, manifest/target이 progress와 HANDOFF를 역으로 결박하지 않는다. CompletionReport가 두 파일 hash를 적었지만 CompletionReport 자체도 target 밖이다.
- 영향: 검증 후 progress/HANDOFF를 함께 변경하고 snapshot hash만 다시 계산해도 현재 target/delivered는 바뀌지 않는다. G-05의 주 산출물과 검증 대상 동일성을 입증하지 못한다.

### G05-DEF-002 — 유효 failure count와 evidence authenticity 우회

- 심각도 / blocking: `MAJOR / true`
- 변형:
  - `result_status=FAILURE_REPORT`
  - `accepted=true`, `counts_toward_valid_failure=true`, `validator_acceptance=true`
  - `evidence_refs=["docs/evidence/does-not-exist.json"]`
  - ledger 유효 count 1, progress/HANDOFF `valid_failure_count`는 0 유지
- 실제 결과: `validate_bundle()` errors `[]`로 ACCEPT.
- 원인: evidence ref는 비어 있지 않은지만 검사하고 실제 path/hash를 확인하지 않으며, ledger projection의 count를 progress/HANDOFF count와 대조하지 않는다.
- 영향: 존재하지 않는 evidence로 failure를 수락하거나 3회 takeover 상태와 recovery 표시를 서로 다르게 유지할 수 있다.

### G05-DEF-003 — nonsemantic root approval·scope 위조 허용

- 심각도 / blocking: `CRITICAL / true`
- 변형:
  - `root_human_approval_id=APPROVAL-DOES-NOT-EXIST`
  - `root_approval_scope=["UNBOUNDED"]`
  - `derived_scope=["UNBOUNDED"]`
- 실제 결과: `validate_bundle()` errors `[]`로 ACCEPT.
- 원인: approval ID가 비어 있지 않고 derived scope가 self-declared root scope의 부분집합인지만 검사한다. 실제 승인 artifact·subject hash·승인 scope와 대조하지 않는다.
- 영향: 존재하지 않는 승인을 근거로 임의 scope를 root scope처럼 선언해 nonsemantic binding의 scope 비확장 guard를 우회할 수 있다.

### G05-DEF-004 — 존재하지 않는 DIR direction Event로 CLEARED 허용

- 심각도 / blocking: `CRITICAL / true`
- 변형: DIR-1을 `status=CLEARED`, `verdict=ALIGNED`, `owner_direction_event_id=evt-does-not-exist`로 변경하고 실제 event stream에는 direction Event를 추가하지 않음.
- 실제 결과: `validate_bundle()` errors `[]`로 ACCEPT.
- 원인: `owner_direction_event_id`가 non-empty인지만 검사하고 event 존재, `DIR_OWNER_DIRECTION_RECORDED` 유형, 신산님 actor, checkpoint/subject binding을 검증하지 않는다.
- 영향: 신산님의 direction Event 없이 DIR을 해제할 수 있어 `AV-STAT-042`를 직접 위반한다.

### G05-DEF-005 — scope expansion을 routine AUTO_CONTINUE로 허용

- 심각도 / blocking: `CRITICAL / true`
- 변형: `pending_approvals=[{"change_classification":"SCOPE_EXPANSION_REQUIRED"}]`, reporting decision은 현재 `AUTO_CONTINUE` 유지.
- 실제 결과: snapshot hash를 정상 재계산한 뒤 `validate_bundle()` errors `[]`로 ACCEPT.
- 원인: stop 분류를 `FUNCTION_SCOPE_CHANGE | REQUIREMENT_CHANGE | IMPORTANT_RISK_CHANGE` 세 문자열에만 한정하고 기존 canonical scope-expansion 상태를 인식하지 않는다. schema enum 또는 normalization도 없다.
- 영향: 최신 사람 승인의 STOP_AND_REPORT 경계를 우회해 기능 범위 변경을 routine으로 자동 진행할 수 있으므로 `AV-STAT-014`가 FAIL이다.

### G05-DEF-006 — event 유형 열거만으로 전체 갱신 검증을 대체

- 심각도 / blocking: `MAJOR / true`
- 변형: sequence 4에 `event_type=GIT_PUSH`, `details={}`인 event를 추가하고 progress/HANDOFF sequence와 snapshot hash를 정상 동기화함.
- 실제 결과: `validate_bundle()` errors `[]`로 ACCEPT.
- 원인: checker는 contiguous sequence와 event type 등록 여부만 확인하고 `progress-event.schema.json` 또는 유형별 필수 payload/상태 효과를 적용하지 않는다.
- raw fixture는 failure ledger와 index뿐이며 Package 7종, 인계, failure 수락/거부, lease, Gate/DIR, commit/push/deploy 등 전체 갱신 범주의 event fixture가 없다.
- 영향: `GIT_PUSH`처럼 증거와 remote commit이 필요한 event도 빈 payload로 기록할 수 있어 `AV-STAT-016`의 “전부 기록·fixture 검증” 완료조건을 충족하지 못한다.

## 정상 재현 증거

1. 권위 hash는 WI binding과 일치했다.
   - 설계서 `246D0487...DA9A5`
   - 작업계획서 `4DB8F5F5...F7475`
   - 검증매트릭스 `0A0CEA88...45D3`
   - 테스트계획서 `870BC8CA...DC5`
   - 운영규칙 v1.5 `7D5E2AD0...B5F3`
2. current progress:
   - file SHA-256 `F23E9A6992BD441319EBBCC471FEFBCCBA255BBCDBC646FDF08CE91BF2A03BD2`
   - snapshot SHA-256 `035622E64D85AE92A11520D6A0F8CDA71247DEAD0A6CAC2505C549467438334C`, 등록값 일치
3. HANDOFF:
   - file SHA-256 `7A32397355FCEA45A9A33A2F0FC24F355497E8B5749E49EB037958C9C1547A9B`
   - machine summary 13개 대응 필드 불일치 0
4. registry refs 5건 실제 hash 불일치 0.
5. current routine recovery는 `AUTO_CONTINUE`, `stop_before_dialogue_report=false`로 최신 승인과 일치한다.
6. `origin`은 `https://github.com/cyhuh7950/anvil.git`, local/upstream HEAD는 모두 `a3014da95b34d8fe3a0a22418d78016b0fe57e61`로 일치한다.

## 명령·종료 코드·실제 결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `python -m unittest tests.tooling.test_project_progress tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries` | 0 | `Ran 36 tests ... OK` |
| `python scripts/check_project_progress.py .` | 0 | `PASS sequence=3 reporting=AUTO_CONTINUE` |
| `python scripts/check_artifact_templates.py .` | 0 | `8 templates validated` |
| `python scripts/check_dependency_boundaries.py .` | 0 | 위반 출력 0건 |
| 독립 raw target/snapshot/HANDOFF audit | 0 | target·snapshot·13-field summary·registry hash 자체 정합성 PASS, core target omission 확인 |
| 독립 최소필드/event/failure/nonsemantic/DIR/reporting 적대 runner | 0 | 7건 중 정상 거부 2, 우회 5 |
| 독립 AV-STAT-041 runner | 0 | A-15/C-15/E-11 checkpoint 누락 3건과 hold lease 1건, 4/4 거부 |
| G-05 JSON parse audit | 0 | `14` files, failure 0 |
| non-protected pyc 검사 | 0 | `0` |
| `git diff --check` | 0 | 오류 0 |

## Git diff·쓰기 범위

- 시작 branch/HEAD: `main` / `a3014da95b34d8fe3a0a22418d78016b0fe57e61`
- 기존 G-05 dirty/untracked 파일과 progress/HANDOFF를 보존했다.
- 독립 Tester workspace write는 이 보고서 `docs/test_reports/G-05_TEST_REPORT.md` 한 파일뿐이다.
- 구현·진행·기존 evidence/보고서·authority 문서는 수정하지 않았다.
- commit, push, tag, deploy, dependency 설치, network, WSL/server/DB 접속은 실행하지 않았다.

## 미검증·범위 밖

G-05는 정적 JSON/Markdown/checker 계약만 검증했다. B-08/B-12의 DB transaction, outbox, atomic replace와 실제 process-crash durable recovery는 범위 밖이며 PASS로 승격하지 않는다. 제품 API/UI, 브라우저 Network, DB, Docker, WSL/server, 배포와 실제 ReleaseDecision도 실행하지 않았다.

## 조치

1. EvidenceManifest target에 current `build-progress.json`과 `BUILD_HANDOFF.md`의 외부 결박 가능한 digest를 포함한다. self-reference 순환은 별도 immutable snapshot artifact 또는 manifest가 참조하는 detached digest record로 해소한다.
2. failure evidence ref의 실제 path/hash를 검증하고 ledger projection의 valid count·takeover를 progress/HANDOFF와 일치시킨다.
3. nonsemantic binding의 root approval ID/scope를 실제 승인 artifact와 subject hash에서 읽어 검증하며 binding 자체가 root scope를 선언하게 두지 않는다.
4. DIR direction ID를 실제 append-only event의 type/actor/checkpoint/subject와 대조하고, trigger/report/direction Event chain이 완전해야만 `CLEARED`를 허용한다.
5. scope/risk change classification을 schema enum과 단일 normalization으로 고정하고 `SCOPE_EXPANSION_REQUIRED` 등 canonical 동의어가 반드시 `STOP_AND_REPORT_SCOPE_RISK`가 되게 한다.
6. 모든 갱신 범주의 positive/negative event fixture와 유형별 필수 payload·상태 효과 검증을 추가한다. 빈 `GIT_PUSH`·DIR·lease·approval event를 거부한다.
7. 수정 후 재검증 범위는 6개 finding, 할당 AV ID 5개, G-05 적대 변형, 전체 36개 회귀, raw target/snapshot/HANDOFF/registry 전량이다.
8. 차단 finding이 닫히기 전에는 `ACCEPTED`, commit, G-06 시작을 금지한다.
