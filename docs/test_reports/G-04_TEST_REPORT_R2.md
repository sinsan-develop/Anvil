# G-04 독립 Test Report — Revision 2

- package_id: `G-04`
- tester_role: `independent_tester`
- verification_revision: `2`
- environment: `ENV-LOCAL`
- branch / HEAD: `main` / `6d2dd6bebd8a6d5945621cb90b49783003554cb1`
- work_instruction_id: `WI-G-04-20260810-002`
- work_instruction_sha256: `4330D9ED93731B70579D7BD7A590F65238738EFE425D829465DBE5BD75FB6558`
- invocation_prompt_sha256: `981C3DB309F7D4CA0B1B37F51113135FADE1D41170610A0883999D16D2627C56`
- evidence_manifest_file_sha256: `F2674994201407532D6E18A9F9A0A94B606BA94385DCD126C03AF7F8264B09C1`
- target / delivered: `5B5FA32568A7AD293C611BB5E85FCD4C0C0076EA787327CCC4AF1D936042827D`
- assigned verification: `AV-FLOW-003` / `L2` / `E-ART`, `E-MAN`
- prior_findings: `G04-DEF-001`, `G04-DEF-002`
- overall_status: `PASS`
- recommendation: `READY_FOR_MAIN_ACCEPTANCE`
- result_counts: `PASS 3 / FAIL 0 / SKIPPED 0 / BLOCKED 0`
- open_blocking_defects: `0`

## 판정

`PASS / READY_FOR_MAIN_ACCEPTANCE` — revision 1의 `G04-DEF-001~002`는 scoped 독립 재검증에서 모두 닫혔다. `AV-FLOW-003`, 8개 template/schema/checker, 기존 guard와 G-03 회귀가 fresh 검증을 통과했다.

이 판정은 Main Agent의 최종 `ACCEPTED`를 대신하지 않으며 commit, G-05 시작 또는 제품 Release를 승인하지 않는다.

## 판단 이유

### 1. G04-DEF-001 — CLOSED

- expected fixture, checker, test를 열기 전에 `tests/fixtures/g04/work-instruction.json`만 읽었다.
- source 내부 `reconstruction_contract`의 23개 `projection_fields`, `flat_json_object`, UTF-8/key-sort/compact/no-final-newline/no-BOM, SHA-256 계약만 사용했다.
- workspace 밖 독립 결과:
  - path: `C:\Users\cyhuh\AppData\Local\Temp\anvil-g04-r2-independent-flat-projection.json`
  - fields: `23`
  - canonical bytes: `2218`
  - SHA-256: `B347FDC3F80DF3373A88DACBC689675E0199208A5568B544EB67EB800809AD72`
- 이 해시를 고정한 뒤 expected를 처음 열었다.
- raw expected 파일은 pretty JSON이어서 `2432 bytes`, SHA-256 `45F710F8992D0E7FD4E5F4579DD672C1F57AE9A3E707628D8C2F3E7D2C9E98F9`이고 독립 canonical 출력과 물리 byte가 다르다.
- 그러나 expected JSON에 source 계약의 동일 canonicalization을 적용하면 `2218 bytes`, SHA-256 `B347FDC3F80DF3373A88DACBC689675E0199208A5568B544EB67EB800809AD72`이며 독립 출력과 byte-identical이다.
- JSON semantic equality도 `true`다. field/shape/content hash를 포함한 canonical byte diff와 semantic diff는 모두 0이다.
- checker의 `semantic_projection()`은 숨겨진 field 목록이 아니라 source의 `reconstruction_contract.projection_fields`만 사용하고, field 목록 변경 회귀도 통과한다.

판정: source WorkInstruction 하나만으로 결정론적 재구성이 가능하므로 `G04-DEF-001 CLOSED`.

### 2. G04-DEF-002 — CLOSED

- manifest의 구조화된 `target_algorithm`을 독립 구현으로 해석하고 checker 함수를 사용하지 않은 채 재계산했다.
- `raw_checksums` 18건을 실제 workspace 파일과 대조한 결과:
  - bytes 일치: `18/18`
  - SHA-256 일치: `18/18`
  - raw failure: `0`
  - content bytes 합계: `85676`
- repository-relative POSIX path를 UTF-8 byte ordinal 순으로 정렬하고 각 row를 `path<TAB>decimal_bytes<TAB>uppercase_sha256_without_prefix`, LF 구분, 마지막 LF 없음으로 직렬화했다.
- 독립 재계산 결과:
  - canonical bytes: `2109`
  - target SHA-256: `5B5FA32568A7AD293C611BB5E85FCD4C0C0076EA787327CCC4AF1D936042827D`
  - manifest target 일치: `true`
  - manifest delivered 일치: `true`
- manifest 자체도 재검산했다.
  - content hash: `F2C7858C7F742B92DFAE4298C01E0D743B43E76DE5A019790F8CE8BFE8858D4B`, 등록값 일치
  - file SHA-256: `F2674994201407532D6E18A9F9A0A94B606BA94385DCD126C03AF7F8264B09C1`, 지정값 일치
- checker는 raw checksum 변형 시 canonical byte count와 target hash 불일치를 함께 검출한다.

판정: 제3자 target 재현과 실제 전달 파일 checksum 대조가 모두 일치하므로 `G04-DEF-002 CLOSED`.

### 3. AV-FLOW-003 및 guard 회귀

1. InvocationPrompt가 revision 2 WorkInstruction ID/hash를 참조하고 실행 계약 본문을 복사하지 않는다.
2. G-04 unit test 14개와 G-03 dependency-boundary 회귀 9개, 총 23개가 통과했다.
3. 독립 negative runner의 17개 case가 전부 기대대로 거부됐다.
   - Invocation 본문 복사·WI hash 누락
   - 14-field verification contract 누락
   - target/manifest binding 누락
   - 비인증 Release actor, blocking defect, 미완료 ProductValidation
   - 불완전 DEFER
   - `CRITICAL blocking=false`
   - artifact/Package status 혼용
   - EvidenceManifest target/environment/git/image/migration/routing 재사용 불일치
4. artifact checker와 dependency checker가 모두 exit 0이다.
5. G-04 JSON 14건 parse 성공, non-protected `.pyc` 0건, `git diff --check` 오류 0건이다.

## 명령·종료 코드·실제 결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `Get-FileHash ... G-04_WORK_INSTRUCTION.md` | 0 | `4330D9...6558`, 지정값 일치 |
| `Get-FileHash ... G-04_INVOCATION_PROMPT.md` | 0 | `981C3D...7C56`, 지정값 일치 |
| `Get-FileHash ... G-04_EVIDENCE_MANIFEST.json` | 0 | `F26749...B09C1`, 지정값 일치 |
| expected 비열람 독립 reconstruction runner | 0 | `23 fields`, `2218 bytes`, `B347FDC3...AD72` |
| 독립 projection ↔ expected 비교 | 0 | raw byte unequal, canonical byte equal, semantic equal |
| 독립 target audit | 0 | raw 18/18, `2109 bytes`, target/delivered/content/file hash 전량 일치 |
| `python -m unittest tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries` | 0 | `Ran 23 tests ... OK` |
| `python scripts/check_artifact_templates.py .` | 0 | `G-04 artifact contract: 8 templates validated` |
| `python scripts/check_dependency_boundaries.py .` | 0 | 위반 출력 0건 |
| 독립 negative mutation runner | 0 | `NEGATIVE_CASES=17 FAILED=0` |
| PowerShell JSON parse audit | 0 | `JSON_PARSE_COUNT=14 JSON_FAILURES=0` |
| non-protected pyc 검사 | 0 | `NONPROTECTED_PYC_COUNT=0` |
| `git diff --check` | 0 | 오류 0 |

## Git diff·쓰기 범위

- 재검증 시작 branch/HEAD: `main` / `6d2dd6bebd8a6d5945621cb90b49783003554cb1`
- 기존 dirty/untracked G-04 구현·progress·revision 1 TestReport를 보존했다.
- 독립 Tester workspace write는 이 보고서 `docs/test_reports/G-04_TEST_REPORT_R2.md` 한 파일뿐이다.
- 구현, 진행 파일, 기존 TestReport, authority 문서는 수정하지 않았다.
- commit, push, tag, deploy, dependency 설치, network, WSL/server/DB 접속은 실행하지 않았다.

## 미검증·범위 밖

제품 API, UI, 브라우저/Network, DB, migration, queue, Provider, Docker service, WSL-server, ysna-server, 배포와 실제 ReleaseDecision은 G-04 문서/tooling Package 범위 밖이다. 실행하지 않았으며 PASS로 승격하지 않는다.

## 조치

Main Agent가 이 보고서와 fresh evidence를 검토해 G-04 최종 `ACCEPTED` 여부를 판정한다. `ACCEPTED`, commit 또는 G-05 시작은 Main Agent 판정 전 수행하지 않는다.
