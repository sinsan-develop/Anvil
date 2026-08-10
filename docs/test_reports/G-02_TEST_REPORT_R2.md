# G-02 Revision 2 독립 Test Report

- package_id: `G-02`
- work_instruction_id: `WI-G-02-20260810-001`
- work_instruction_revision: `2`
- tester_role: `구현·작성 담당자와 분리된 독립 Tester Subagent`
- verification_environment: `local-document-workspace / Windows PowerShell`
- repository_state: `NOT_INITIALIZED`
- overall_status: `REWORK`
- G02-DEF-001: `CORRECTED_VERIFIED`
- AV-SAFE-033: `FAIL`
- AV-GATE-026: `PASS`
- target_hash: `6C440ED0FC95DDF5F65642649995F1554917E908AC44DF11AE76BDC3006473D9`
- delivered_hash: `6C440ED0FC95DDF5F65642649995F1554917E908AC44DF11AE76BDC3006473D9`
- evidence_manifest_sha256: `275200DDACD9A59AC3CF65F3CD37E5142573705102A3C6CA50A99D5DFA29EEAA`
- non_semantic_binding_sha256: `232563E90F3AC06B165964A2C0D01D2DB10AAC63DD4B4DA5146E7FA65C3FDFA0`

## 1. 판정

`REWORK` — revision 1의 `G02-DEF-001`은 활성 위치 6개 패턴이 모두 0건이고 상호 version/hash, 97 Package·255 AV·234 실행 AV·미할당 0·DIR 4종이 일치하여 보정 완료로 판정한다. 따라서 `AV-GATE-026`은 `PASS`다.

그러나 revision 2의 `MAIN_RECONFIRMED_NON_SEMANTIC` binding에는 설계서 §48.1·§49.14와 운영규칙 §6이 필수로 요구하는 `parent_baseline_id`가 없고, 이를 대신할 파생 `DesignBaseline` 식별자/artifact도 없다. 기존 `BASELINE-G-01-20260810-001`에서 현재 authority 집합으로 이어지는 canonical parent-child 계보가 명시적으로 결박되지 않았으므로 `AV-SAFE-033`은 `FAIL`이다. 해당 ID의 심각도는 `CRITICAL`이므로 G-02를 `ACCEPTED`로 전환할 수 없다.

## 2. 판단 이유

| 검증 항목 | 결과 | 독립 확인 결과 |
|---|---|---|
| WorkInstruction revision 2 | PASS | 실제 SHA-256 `774225042E3061AD4375602B2B41BA6C401EB05D1D06181377DE18C70BB600E0` |
| authority 고정 hash | PASS | 계획 v1.4, 매트릭스 v1.2, 테스트계획 v1.3, 운영규칙 v1.4의 실제 hash가 지시값·binding·progress·HANDOFF와 일치 |
| approval subject | PASS | canonical 9행, UTF-8/LF/no-final-LF 509 bytes를 재계산해 `E0DEC865...68A91` 일치 |
| 13 artifact manifest | PASS | artifact 13/13 SHA-256·bytes 일치, mismatch 0 |
| target/delivered | PASS | canonical 1,396 bytes 재계산 결과 `6C440ED0...473D9`, target·delivered 동일 |
| 기존 실패 보고서 보존 | PASS | `docs/test_reports/G-02_TEST_REPORT.md` SHA-256 `4B853057...74BF2`, 10,427 bytes로 manifest와 일치 |
| G02-DEF-001 활성 패턴 | PASS | 작업계획 상태/구 test baseline/§2.2 승인대기, 매트릭스 상태/구 pair, 운영규칙 구 현재 기준선의 6개 exact pattern 합계 0 |
| historical 계보 분리 | PASS | 과거 v1.1·v1.2 참조는 `[historical]`, `[historical revision 1]`, 변경 전/후 계보 문맥으로만 존재 |
| 상호 version/hash | PASS | 계획 v1.4↔매트릭스 v1.2↔테스트계획 v1.3↔운영규칙 v1.4 및 progress/HANDOFF의 실제 hash 일치 |
| semantic diff | 내용상 `NONE` 확인 | 구현 기준값·Q/D 결정·Package/AV/DIR·테스트 범위/레벨/심각도/종료 기준의 변경은 관측되지 않음 |
| approval 범위 비확대 | 내용상 비확대 / **계보 계약 FAIL** | root human approval과 G-02 decision approval 값은 맞고 의미 확대는 관측되지 않았으나 mandatory `parent_baseline_id`가 없어 canonical 비확대 계보를 완결하지 못함 |
| 97 Package | PASS | 작업계획 직접 행 97·고유 97, §8 역색인 97·고유 97, 누락·초과 0 |
| 255/234 AV | PASS | 직접 AV 행 255·고유 255, CON 21, 실행 AV 234, 책임 Package 공란 0, §8 누락·미정의 0 |
| 과거 미할당 5건 | PASS | `AV-SAFE-004/B-04`, `AV-STAT-030/B-10`, `AV-GATE-011/C-14`, `AV-GATE-007`+`008/C-14`, `AV-STAT-015/G-05` |
| DIR 4종 | PASS | DIR-1=A-15, DIR-2=C-15, DIR-3=E-11, DIR-X=`DIRX-LRN-CRITICAL` 조건부 추가 및 DIR-3 유지 일치 |
| 제품 코드·Git | PASS | `.git`, `apps`, `packages`, `domain`, `tests` 모두 부재; Git 명령은 모두 저장소 아님 오류; 제품 파일 변경 관측 0 |
| 서버·DB | 범위 내 무변경 | 문서·명령·변경 경로에 서버/DB 작업 증거 없음. 금지 범위이므로 live 접속은 수행하지 않음 |

## 3. Findings

### G02-DEF-002 · Non-semantic binding의 필수 parent baseline 계보 누락

- **심각도**: `CRITICAL`
- **위반 검증 ID**: `AV-SAFE-033`
- **판정**: `FAIL`
- **관측 사실**:
  - `Anvil_설계서_v2.md:5648`, `:6502`와 `docs/governance/ANVIL_OPERATING_RULES.md:84`는 non-semantic binding에 `parent_baseline_id`, `root_human_approval_id`, old/new hash, semantic diff, 영향·근거·actor·시각을 필수로 요구한다.
  - `docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md`에는 old/new hash, `semantic_diff: NONE`, 영향·근거·actor·시각과 `root_human_approval_ref`가 있지만 `parent_baseline_id`가 없다.
  - parent가 되어야 할 기존 기준선은 `docs/baselines/G-01_BASELINE_RECORD.md:3`의 `BASELINE-G-01-20260810-001`로 실제 존재한다.
  - `docs/baselines/`에는 G-01 기준선만 있으며 revision 2 파생 `DesignBaseline` ID/artifact가 없다. 새 13-artifact manifest에도 parent BaselineRecord 또는 파생 Baseline artifact가 포함되지 않았다.
- **판단 이유**: 현재 문서의 의미와 승인 범위 자체가 확대된 흔적은 없다. 그러나 `AV-SAFE-033`은 단순 선언이 아니라 root human approval 범위를 넘지 않았음을 계보로 증명해야 한다. 필수 parent baseline identity가 빠지면 어떤 승인된 immutable snapshot에서 파생됐는지 기계적으로 고정할 수 없어 canonical binding 계약을 충족하지 못한다.
- **조치**: 기존 root human approval과 G-02 decision approval 범위를 바꾸지 않고, binding에 `parent_baseline_id: BASELINE-G-01-20260810-001`과 canonical `root_human_approval_id` 매핑을 명시한다. 설계서 계약에 따른 파생 DesignBaseline ID/artifact를 만들고 old/new authority hash·binding·parent/root 계보를 결박한다. 변경된 binding·DecisionRecord·manifest·CompletionReport·progress/HANDOFF의 hash와 target을 재생성한 뒤 `AV-SAFE-033`과 13개 이상 새 artifact 집합을 독립 재검증한다.
- **재검증 범위**: 새 binding 및 파생 baseline 전체, parent/root approval 원문, 변경된 모든 artifact hash/bytes, canonical target/delivered, `AV-SAFE-033`; target 변경에 따라 `AV-GATE-026` 구조 통계도 회귀 확인.

## 4. G02-DEF-001 보정 확인

| 기존 관측 패턴 | 현재 활성 일치 건수 | 판정 |
|---|---:|---|
| 작업계획 `승인 대기 작업계획서` | 0 | PASS |
| 작업계획 테스트계획 v1.1 / `FE6AEFE4...D1B8` 활성 기준선 | 0 | PASS |
| 작업계획 §2.2 `신산님 승인 대기` | 0 | PASS |
| 매트릭스 `승인 대기 검증 기준선` | 0 | PASS |
| 매트릭스 짝 문서 테스트계획 v1.1 | 0 | PASS |
| 운영규칙 현재 기준선 테스트계획 v1.1 | 0 | PASS |

현재 활성 기준선은 계획 v1.4 / 매트릭스 v1.2 / 테스트계획 v1.3 / 운영규칙 v1.4다. 과거 hash는 명시적인 historical 또는 변경 계보 문맥에만 남아 있다.

## 5. 명령과 실제 결과

| 명령·검사 | 종료 코드 | 실제 결과 |
|---|---:|---|
| `Get-FileHash -Algorithm SHA256`로 WI·4 authority·binding·Developer ACK·manifest 재계산 | 0 | 고정값 8/8 일치, mismatch 0 |
| 승인 canonical code block을 UTF-8/LF/no-final-LF로 `SHA256.HashData` | 0 | 9행·509 bytes, `E0DEC865...68A91` |
| `ConvertFrom-Json` 후 manifest 13 artifact의 `Get-FileHash`·`Get-Item.Length` 재계산 | 0 | 13/13 일치, mismatch 0 |
| manifest 순서 `path=UPPERCASE_SHA256`를 LF/no-final-LF로 `SHA256.HashData` | 0 | 1,396 bytes, `6C440ED0...473D9`, target=delivered |
| PowerShell 정규식으로 작업계획 Package 직접 행/고유 집계 | 0 | 97 / 97 |
| PowerShell 정규식으로 매트릭스 AV 직접 행/고유/CON/실행 집계 | 0 | 255 / 255 / 21 / 234 |
| 매트릭스 §8 축약·범위를 전개해 실행 AV·Package 집합 비교 | 0 | 실행 AV 누락 0, 미정의 0, Package 97/97, 누락·초과 0 |
| 기존 finding 6개 문자열을 각 활성 authority에 `Select-String -SimpleMatch` | 0 | 6개 pattern 합계 0 |
| `rg -n "FE6AE...|EB1AB...|테스트계획서_v1.md.*v1.1"` authority/progress/HANDOFF 검색 | 0 | historical·변경 계보 문맥에서만 검출 |
| `rg -n "parent_baseline_id|root_human_approval_id" 'docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md'` | 1 | no-match — mandatory canonical field 0건 |
| `rg -n "^- baseline_id:" 'docs/baselines/G-01_BASELINE_RECORD.md'` | 0 | `BASELINE-G-01-20260810-001` 존재 |
| `rg -n "parent_baseline_id|root_human_approval_id"` 설계서·운영규칙 검색 | 0 | 설계서 5648·6502, 운영규칙 84에서 필수 계약 확인 |
| `Get-ChildItem 'docs/baselines' -File` | 0 | G-01 BaselineRecord·SourceInventory만 존재, revision 2 파생 baseline 없음 |
| 기존 TestReport `Get-FileHash` | 0 | `4B853057C4C370470C075B14384EB9FA2B881E2684AAB00E5D83CF2AEE274BF2` 보존 |
| 기존 TestReport 이후 local workspace `LastWriteTime` 열거 | 0 | WI와 revision 2 허용 문서 13건만 변경; 제품 경로 0 |
| `git status --short`; `git branch --show-current`; `git rev-parse HEAD` | 128 / 128 / 128 | 모두 `fatal: not a git repository` |
| `Test-Path '.git','apps','packages','domain','tests'` 개별 확인 | 0 | 모두 `False` |

## 6. Spec compliance와 문서 품질

- `G02-DEF-001` 보정은 정확하다. 활성 상태와 상호 revision/hash가 명확하고 historical 계보도 현재 기준선과 구분된다.
- 13-artifact manifest와 canonical target은 재현 가능하며 기존 실패 증거를 변경하지 않고 포함한다.
- Q 결정, 과거 미할당 5건, Package/AV/DIR 구조는 revision 1과 동일하다. 범위 확대는 관측되지 않았다.
- 다만 non-semantic binding은 필수 parent baseline identity와 파생 baseline을 생략해 승인 비확대 증명의 핵심 연결 고리가 없다. 이는 문구 품질 문제가 아니라 canonical 승인 안전 계약 미충족이다.
- WorkInstruction revision 2의 하단 보정 계약이 상단의 기존 v1.2 완료조건을 v1.3으로 대체한다는 점은 해석 가능하지만, 후속 revision에서는 superseded 범위를 명시하면 혼선을 줄일 수 있다. 이 사항은 비차단 문서 개선점이다.

## 7. 미검증 범위

- 변경 전 authority 4개 원본 bytes는 현재 workspace에 별도 보존되지 않아 full byte diff로 `semantic_diff=NONE`을 재현하지 못했다. 이전 독립 TestReport, 변경 전 hash, 현재 내용, Q/D·97/255/234·DIR·테스트 계약 불변을 대조해 의미 확대가 관측되지 않았음을 확인했다.
- 서버·DB 외부 감사 로그나 스냅샷은 조회하지 않았다. G-02 금지 범위이고 비교 가능한 외부 baseline이 제공되지 않았다.
- 제품 코드·브라우저·API·DB·배포 기능 테스트는 G-02 비범위이며 수행하지 않았다.
- Git이 미구성되어 diff 기반 changed-path 검증은 불가능하다. 파일 시각·허용 경로·제품 scaffold 부재로 로컬 범위를 확인했다.

## 8. 조치

`G02-DEF-001`은 닫되 G-02를 `TEST_REVIEW_REVISION_2 → REWORK`로 반환한다. `G02-DEF-002`는 기존 finding과 다른 fingerprint의 첫 정식 실패다. canonical parent/derived baseline 계보를 보완하고 새 target으로 독립 재검증하기 전에는 G-02 `ACCEPTED`, G-03, Git 초기화, scaffold, commit, push 또는 배포를 시작하지 않는다.
