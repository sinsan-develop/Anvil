# G-04 CompletionReport — Revision 2 재현성 보완

- package_id: `G-04`
- work_instruction_id: `WI-G-04-20260810-002`
- work_instruction_sha256: `4330D9ED93731B70579D7BD7A590F65238738EFE425D829465DBE5BD75FB6558`
- invocation_prompt_sha256: `981C3DB309F7D4CA0B1B37F51113135FADE1D41170610A0883999D16D2627C56`
- prior_test_report: `docs/test_reports/G-04_TEST_REPORT.md`
- prior_test_report_sha256: `E31E3B27BCCB6F34F13EE8C3438F60CCBE618B5CC1E3CA53F3FCECF73DF170B5`
- design_baseline_id: `BASELINE-G-02-DERIVED-20260810-001`
- design_baseline_sha256: `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B`
- work_plan_sha256: `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475`
- actor: `developer-primary-g04`
- result_status: `COMPLETED`
- review_state: `TEST_REVIEW`
- target_hash: `5B5FA32568A7AD293C611BB5E85FCD4C0C0076EA787327CCC4AF1D936042827D`
- delivered_hash: `5B5FA32568A7AD293C611BB5E85FCD4C0C0076EA787327CCC4AF1D936042827D`
- evidence_manifest: `docs/evidence/manifests/G-04_EVIDENCE_MANIFEST.json`
- evidence_manifest_content_hash: `F2C7858C7F742B92DFAE4298C01E0D743B43E76DE5A019790F8CE8BFE8858D4B`
- evidence_manifest_file_sha256: `F2674994201407532D6E18A9F9A0A94B606BA94385DCD126C03AF7F8264B09C1`

## 판정

`COMPLETED / TEST_REVIEW` — `G04-DEF-001~002`를 revision 2 계약으로 보완했다. 독립 Tester의 재검증 PASS 전에는 `ACCEPTED`, commit, G-05 시작이 금지된다.

## 판단 이유

1. 공통 envelope의 artifact 상태와 Package 상태를 분리하고 논리 `artifact_id`와 물리 `artifact_path`를 모두 고정했다.
2. WorkInstruction의 `verification_contract` 14개 필드를 정확히 검사한다.
3. InvocationPrompt는 WorkInstruction ID/hash와 CompletionReport template ID/hash만 참조하며 목표·범위·완료조건·금지사항을 복사하면 오류를 낸다.
4. CompletionReport의 5개 결과 상태, ProductValidation의 4개 결과, Defect 생명주기, 인증된 사람만 가능한 4개 ReleaseDecision을 서로 다른 enum으로 유지한다.
5. `RELEASE`의 사람 actor·필수 ProductValidation·blocking defect guard, `DEFER`의 risk/reconsider/carryover, `CRITICAL blocking=true`, EvidenceManifest의 6개 identity binding을 negative mutation으로 확인했다.
6. canonical JSON은 UTF-8/LF/BOM 없음/key sort/compact separator이며 최상위 `content_hash` 제외 SHA-256 규칙을 실행 가능한 함수와 테스트로 고정했다.
7. source WorkInstruction template과 fixture가 projection field 순서·flat output shape·canonicalization·hash를 직접 선언한다. checker는 더 이상 숨겨진 field 목록을 갖지 않고 이 계약만 사용한다.
8. `canonical_target_bytes(raw_checksums)`와 `canonical_target_sha256(raw_checksums)`가 구조화된 `target_algorithm`과 동일한 정렬·row 규칙을 사용한다. 18개 실제 파일 bytes/hash도 workspace에서 직접 대조한다.
9. revision 2 target은 canonical bytes `2109`, content bytes `85676`, SHA-256 `5B5FA325...2827D`로 제3자 재계산 가능하다.

## 변경 경로와 영향 범위

### 신규 canonical 계약·설명

- `docs/templates/artifact-schema.json`
- `docs/templates/artifact-catalog.json`
- `docs/templates/README.md`
- `docs/work_orders/templates/work-instruction.template.json`
- `docs/work_orders/templates/invocation-prompt.template.json`
- `docs/validation/templates/completion-report.template.json`
- `docs/validation/templates/test-report.template.json`
- `docs/validation/templates/product-validation.template.json`
- `docs/release/templates/defect-assessment.template.json`
- `docs/release/templates/release-decision.template.json`
- `docs/evidence/templates/evidence-manifest.template.json`

### 신규 checker·test·fixture·증거

- `scripts/check_artifact_templates.py`
- `tests/tooling/test_artifact_templates.py`
- `tests/fixtures/g04/work-instruction.json`
- `tests/fixtures/g04/expected-semantic-projection.json`
- `tests/fixtures/g04/negative-mutations.json`
- `docs/evidence/manifests/G-04_EVIDENCE_MANIFEST.json`
- `docs/completion_reports/G-04_COMPLETION_REPORT.md`

### 진행 기록

- `docs/progress/build-progress.json`
- `docs/progress/BUILD_HANDOFF.md`

설계서·작업계획서·검증매트릭스·테스트계획서·운영규칙과 G-01~G-03 artifact는 수정하지 않았다. 제품 API/UI/DB/migration/queue/Provider/Docker 동작도 추가하거나 변경하지 않았다.

## Git 기준선

- 시작 branch: `main`
- 시작 HEAD: `6d2dd6bebd8a6d5945621cb90b49783003554cb1`
- 승인 제품 기준선 commit: `6fab9aa95811ad09aa2f27a0e9c7f5b73bf12cfd`
- 시작 status: Main Agent가 먼저 만든 progress/HANDOFF 수정 2건과 G-04 WorkInstruction/InvocationPrompt 신규 2건
- remote: `0`
- commit/push/tag/deploy: 실행하지 않음

## TDD와 검증 증거

| 단계 | 명령 | 종료 코드 | 실제 결과 |
|---|---|---:|---|
| revision 2 RED | `PYTHONDONTWRITEBYTECODE=1 C:\Users\cyhuh\anaconda3\python.exe -m unittest tests.tooling.test_artifact_templates` | 1 | reconstruction contract와 target 함수 부재를 재현한 예상 failure 3건 |
| revision 2 GREEN | 동일 G-04 unittest | 0 | `Ran 14 tests ... OK` |
| 전체 회귀 | `...python.exe -m unittest tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries` | 0 | `Ran 23 tests ... OK` |
| template checker | `...python.exe scripts/check_artifact_templates.py .` | 0 | `G-04 artifact contract: 8 templates validated` |
| dependency checker | `...python.exe scripts/check_dependency_boundaries.py .` | 0 | 위반 출력 0건 |
| JSON parse | G-04 JSON 14개에 PowerShell `ConvertFrom-Json` | 0 | template·schema·fixture·manifest `JSON_PARSE_COUNT=14` |
| pycache | non-protected `*.pyc` 검색 | 0 | `NONPROTECTED_PYC_COUNT=0` |
| authority hash | SHA-256 재계산 | 0 | v2.6/v1.4/v1.2/v1.3/운영규칙/WI/Invocation 등록값 전량 일치 |

기존 negative mutation 전량에 더해 projection field 계약이 바뀌면 출력 field가 그대로 바뀌는지, raw checksum byte/hash가 바뀌면 canonical bytes·target/delivered 불일치가 검출되는지 확인했다.

## 미실행·제한

- 독립 Tester의 revision 2 `AV-FLOW-003`, expected 비열람 semantic projection, EvidenceManifest raw target 재계산은 아직 미실행이다.
- 제품 API/UI, 브라우저 Network, DB, Docker service, WSL/server, 배포, 실제 ReleaseDecision은 G-04 범위 밖으로 미실행이다.
- dependency 설치, lockfile 변경, network, commit, remote 추가, push, tag, 배포는 실행하지 않았다.

## rollback

G-04가 실패하면 이 보고서의 G-04 신규 경로와 G-04 진행기록 갱신만 되돌린다. `6fab9aa` 기준선과 기존 권위 문서·G-01~G-03 artifact는 수정하거나 삭제하지 않는다.

## 조치

Main Agent는 revision 2 target/delivered와 manifest content/file hash를 fresh 재계산해 `PRELIMINARY_ACCEPT` 여부를 판단한다. 독립 Tester는 expected를 열기 전에 source fixture의 `reconstruction_contract`만으로 projection을 고정하고, manifest `raw_checksums`만으로 canonical bytes `2109`와 새 target을 재계산해야 한다.
