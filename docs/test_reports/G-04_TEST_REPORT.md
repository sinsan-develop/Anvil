# G-04 독립 Test Report

- package_id: `G-04`
- tester_role: `independent_tester`
- verification_revision: `1`
- environment: `ENV-LOCAL`
- branch / HEAD: `main` / `6d2dd6bebd8a6d5945621cb90b49783003554cb1`
- work_instruction_id: `WI-G-04-20260810-001`
- work_instruction_sha256: `F09526E83D7D96AE0D2C3A59A2A8EF46E299C696BFF82034E168F8EE583BEAC0`
- evidence_manifest_file_sha256: `009745BBB04BDAA2F2CE5806236FB773A3D2A704BB07033103D7A7878CBCCA2B`
- declared target / delivered: `857179EF2FF83D491C00A4DFF409808B6DF3446FF238F39EC9BF0BE289F11372`
- assigned verification: `AV-FLOW-003` / `L2` / `E-ART`, `E-MAN`
- overall_status: `REWORK`
- result_counts: `PASS 6 / FAIL 2 / SKIPPED 0 / BLOCKED 0`
- blocking_defects: `2`

## 판정

`REWORK` — `AV-FLOW-003`은 `FAIL`이다. 8개 template·schema·catalog·checker와 guard 테스트는 fresh 검증을 통과했지만, WorkInstruction의 package exit 조건인 독립 semantic projection diff 0과 EvidenceManifest target 재현이 충족되지 않았다. 따라서 `ACCEPTED`, commit, G-05 시작의 근거로 사용할 수 없다.

## 판단 이유

### 1. G04-DEF-001 — context-free semantic reconstruction diff 0 미충족

- 심각도 / blocking: `MAJOR / true`
- source: 작업계획서 Phase G Gate, 테스트계획서 10.1, `AV-FLOW-003`, WorkInstruction 완료조건 9
- 예상 파일 선열람 방지 절차:
  1. `tests/fixtures/g04/work-instruction.json`만 읽었다.
  2. checker, test, expected fixture를 읽기 전에 workspace 밖 `C:\Users\cyhuh\AppData\Local\Temp\anvil-g04-independent-semantic-projection.json`을 작성했다.
  3. 독립 projection 파일 SHA-256 `F07FB539EF36A59FA5D8362449D4FB7CFFFAA91931DF21266816B6056C5E042D`를 먼저 고정했다.
  4. 그 뒤에만 expected fixture를 열었다. expected file SHA-256은 `45F710F8992D0E7FD4E5F4579DD672C1F57AE9A3E707628D8C2F3E7D2C9E98F9`였다.
- 관찰:
  - 독립 projection은 owner/executor, goal, preconditions, 세 scope, path/action 허용·금지, rollback, 완료조건, result/report 계약, 14-field verification contract와 baseline/work plan/approval binding 값을 재구성했다.
  - 그러나 의미별 중첩 구조를 사용했고 expected의 23개 최상위 필드 중 `content_hash`를 projection 출력에서 생략했으며, expected에 없는 `package_status`·supersedes 정보를 포함했다.
  - semantic field를 대응시켜도 expected 23개 중 22개만 동등하고 WorkInstruction 자체 hash binding 1개가 누락되어 diff 0이 아니다.
  - expected가 요구하는 field 선택·평면 구조는 fixture 안에 정의되지 않았다. 그 선택 규칙은 선열람 금지 대상인 `scripts/check_artifact_templates.py::semantic_projection()`에만 있어, context-free 독립 세션이 expected 형식을 결정론적으로 알 수 없다.
- 판단: 정식 checker가 자신이 정의한 projection과 expected를 비교해 PASS하는 것은 확인했으나, 이는 독립 재구성 성공을 대체하지 않는다. 독립 재구성 실험의 실제 결과가 diff 0이 아니므로 package exit 조건을 충족하지 못했다.

### 2. G04-DEF-002 — EvidenceManifest target canonicalization 재현 불가

- 심각도 / blocking: `MAJOR / true`
- source: WorkInstruction 완료조건 5·10, `E-MAN` 신뢰 사슬
- 관찰:
  - manifest `raw_checksums` 18건의 실제 bytes와 SHA-256은 18/18 등록값과 일치했다. 합계는 `71,052 bytes`다.
  - manifest 파일 SHA-256은 지정값 `009745BBB04BDAA2F2CE5806236FB773A3D2A704BB07033103D7A7878CBCCA2B`와 일치했다.
  - 최상위 `content_hash` 제외 canonical JSON으로 계산한 manifest content SHA-256도 `9F3F30DC68FE48CBDD6CCA031FC5147DE4F684F6865F1895427082E8F666F0FF`로 등록값과 일치했다.
  - 그러나 manifest가 선언한 `path + TAB + bytes + TAB + uppercase SHA-256`, UTF-8, LF separator, no final LF 규칙을 18건의 manifest 순서에 적용하면 canonical bytes는 `2,109`이고 SHA-256은 `C04684A5CA602AA25723DCC24E7D4CD8F75D06775AFF2BBA5D0DEF747CCC17F1`이다.
  - 등록된 canonical bytes `2,162`, target/delivered `857179EF2FF83D491C00A4DFF409808B6DF3446FF238F39EC9BF0BE289F11372`와 모두 다르다.
- 판단: target과 delivered 문자열끼리는 같지만 선언된 실제 artifact 집합으로 target을 재현할 수 없다. 따라서 전달 대상과 검증 대상의 동일성을 입증하는 `E-MAN`이 유효하지 않다.

### 3. 통과한 fresh 검증

1. 8개 catalog entry와 canonical template 유형 집합이 정확히 일치하고 Draft 2020-12 schema 선언이 존재한다.
2. WorkInstruction template의 `verification_contract`는 정확히 14개 필드다.
3. InvocationPrompt template은 WorkInstruction ID/hash를 요구하고 goal/scope/completion/forbidden/verification 본문 복사를 거부한다.
4. ReleaseDecision은 `RELEASE | REWORK | DEFER | REJECT`만 허용하고 네 결정 모두 human actor를 요구한다. `RELEASE`의 blocking defect·필수 ProductValidation guard, `DEFER`의 risk/reconsider/carryover guard가 동작한다.
5. `CRITICAL blocking=false`, artifact/Package status 혼용, EvidenceManifest의 target/environment/git/image/migration/routing 불일치를 거부한다.
6. G-04 11개 unit test와 G-03 회귀 포함 20개 test가 통과했고 두 checker exit code가 0이다. non-protected `.pyc`는 0개이며 `git diff --check`도 0이다.

### 4. 권위 문서 정합성 관찰

`Anvil_테스트계획서_v1.md` 346행의 `ReleaseDecision=BLOCKED` 표현은 설계서 49.1의 canonical enum `RELEASE | REWORK | DEFER | REJECT` 및 G-04 template과 문언상 충돌한다. G-04 구현은 우선순위가 더 높은 설계서와 일치하므로 이 항목을 G-04 구현 결함으로 세지 않았지만, G-07 문서 정규화에서 `BLOCKED`가 decision 값이 아니라 Release 생성/전이 guard 결과임을 명확히 해야 한다.

## 명령·종료 코드·실제 결과

| 명령 | exit | 실제 결과 |
|---|---:|---|
| `Get-FileHash ... G-04_WORK_INSTRUCTION.md` | 0 | `F09526...BEAC0`, 지정값 일치 |
| `Get-FileHash ... G-04_EVIDENCE_MANIFEST.json` | 0 | `009745...A2B`, 지정값 일치 |
| `python -m unittest tests.tooling.test_artifact_templates` | 0 | `Ran 11 tests ... OK` |
| `python -m unittest tests.tooling.test_dependency_boundaries tests.tooling.test_artifact_templates` | 0 | `Ran 20 tests ... OK` |
| `python scripts/check_artifact_templates.py .` | 0 | `G-04 artifact contract: 8 templates validated` |
| `python scripts/check_dependency_boundaries.py .` | 0 | 위반 출력 0건 |
| 독립 temp negative mutation runner | 0 | 17 cases, `FAILED=0`; 모든 mutation 기대대로 거부 |
| 독립 temp hash audit | 0 | raw checksum 18/18 일치, manifest content/file hash 일치, target/delivered 재계산 불일치 |
| G-04 JSON parse/format audit | 0 | `JSON_PARSE_COUNT=14`, BOM/CRLF failure 0 |
| `git diff --check` | 0 | 오류 0 |

초기 회귀 명령에서 존재하지 않는 `tests.tooling.test_scaffold_boundary`와 `scripts/check_scaffold_boundary.py`를 잘못 지정해 exit 1이 발생했다. 이는 Tester 명령 선택 오류이며 제품 실패로 집계하지 않았다. 실제 파일명 `test_dependency_boundaries.py`와 `check_dependency_boundaries.py`를 확인한 뒤 위 표의 정확한 명령으로 fresh 재실행했다.

## Git diff·범위 확인

- 검증 시작 branch/HEAD: `main` / `6d2dd6bebd8a6d5945621cb90b49783003554cb1`
- 기존 상태: progress/HANDOFF 수정 2건과 G-04 허용 경로의 신규 파일들. 독립 Tester는 기존 구현·진행 파일을 수정하지 않았다.
- Tester workspace write: 이 보고서 `docs/test_reports/G-04_TEST_REPORT.md` 한 파일만 신규 작성했다.
- commit, push, tag, deploy, dependency 설치, network, WSL/server/DB 접속: 실행하지 않았다.

## 미검증·범위 밖

제품 API, UI, 브라우저/Network, DB, migration, queue, Provider, Docker service, WSL-server, ysna-server, 배포와 실제 ReleaseDecision은 G-04 문서/tooling Package의 범위 밖이다. 해당 항목은 실행하지 않았으며 PASS로 승격하지 않는다.

## 조치

1. semantic projection의 canonical field set·구조·추출 규칙을 checker 구현이 아닌 WorkInstruction fixture와 독립 계약 문서/schema에 명시하고, expected 비열람 독립 Tester가 동일 결과를 재작성할 수 있게 한다.
2. EvidenceManifest target canonicalization을 하나로 확정해 18개 실제 raw artifact에서 target을 재생성하고, canonical byte count·target/delivered·CompletionReport·progress/HANDOFF 결박을 같은 revision으로 갱신한다.
3. target 계산 함수를 checker에 두고 manifest의 raw checksum 목록으로 target을 fresh 재계산하는 positive/negative test를 추가한다. target/delivered 문자열의 단순 상호 비교만으로 PASS하지 않는다.
4. 수정 후 재검증 범위는 `G04-DEF-001`, `G04-DEF-002`, G-04 11개 test, G-03 9개 회귀, 두 checker, 17개 negative mutation, raw checksum/target/manifest hash 전량이다.
5. 위 두 blocking finding이 독립 재검증으로 닫히기 전에는 `ACCEPTED`, commit, G-05 시작을 금지한다.
