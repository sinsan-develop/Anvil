# G-02 독립 테스트 보고서 — Revision 3

## 1. 판정

- Work Package: `G-02`
- 재검증 대상: `G02-DEF-002`, WorkInstruction revision 3
- 독립 Tester 판정: **PASS**
- `G02-DEF-001` 회귀: **PASS — 관측 패턴 0건 유지**
- `G02-DEF-002`: **PASS — CORRECTED**
- `AV-SAFE-033`: **PASS**
- `AV-GATE-026`: **PASS**
- 차단 finding: **0건**
- 최종 승인 상태: 이 보고서는 독립 기술 검증 결과이며 Main Agent 또는 신산님의 `ACCEPTED`를 스스로 선언하지 않는다.

### 판정 요약

Revision 3은 R2의 차단 finding이었던 `parent_baseline_id`, `root_human_approval_id`, 파생 DesignBaseline 부재를 모두 보정했다. 선언된 계보 객체가 실제 파일로 존재하고 식별자·SHA-256·승인 참조가 상호 일치한다. revision 2의 권위 문서 및 Developer ACK, 두 이전 실패 보고서는 보호 hash 그대로 유지되었고, manifest 16개 artifact의 hash·byte 수 및 canonical target을 독립 재계산한 결과 모두 일치했다. 구조 검증도 97 Package, 255 unique AV, 234 executable, 미할당 0, DIR 4종을 재현했다.

## 2. 판단 이유

### 2.1 고정 대상 hash 재계산

| 대상 | 독립 계산 SHA-256 | 판정 |
|---|---|---|
| `docs/work_orders/G-02_WORK_INSTRUCTION.md` | `FB21506565A1D0FBF5CAE2DEB9593C3A811E29DAA9B18954D591CFA80E19F1A4` | PASS |
| `docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md` | `8332635C9CE92B085AFFDF1B235F48945605DC87FA7294DA5FF88A589C95D03D` | PASS |
| `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md` | `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B` | PASS |
| `docs/decisions/G-02_DECISION_RECORD.md` | `BFD2996BD54237B595BAC971BE5122302434A8EF5A14A128CBB85167B5C8C878` | PASS |
| `docs/evidence/manifests/G-02_EVIDENCE_MANIFEST.json` | `E39688335A0B1877116E34691977F8060E6B698A4D4F8E8A7B42BDBE5A3CD00A` | PASS |

### 2.2 `G02-DEF-001` 회귀

활성 권위 문서에서 R2가 제거한 여섯 관측 패턴을 동일 조건으로 다시 검색했다.

| 관측 패턴 | 결과 |
|---|---:|
| 미결/잠정 상태의 실행 Validation 할당 | 0 |
| 이전 matrix의 Package 공란 | 0 |
| 이전 test plan의 미할당 executable AV | 0 |
| 승인 대기·가배정·미확정 상태 표현 | 0 |
| revision 2 권위 hash 불일치 | 0 |
| Developer ACK hash 불일치 | 0 |

따라서 `G02-DEF-001`의 활성 기준선 회귀는 없다.

### 2.3 `G02-DEF-002` 계보와 승인 경계

| 검증 항목 | 실제 결과 | 판정 |
|---|---|---|
| 부모 baseline 실존 | `docs/baselines/G-01_BASELINE_RECORD.md`, ID `BASELINE-G-01-20260810-001`, SHA `8EA9C6DA6E45955D7F7397C208FCFB0EFCC8C01B84851021F239350AC542847B` | PASS |
| root human approval 실존 | `APPROVAL-20260810-INTEGRATED-BASELINE-001`, subject hash `C2B06FB7E358D909DD886C53699E2D28B04C69DAD150066DE03AAE05B42DB3B8` | PASS |
| G-02 decision approval 실존 | `APPROVAL-20260810-G02-DECISIONS-001` | PASS |
| G-02 canonical approval subject | canonical 9행, UTF-8 509 bytes, SHA `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91` | PASS |
| 파생 baseline 실존 | ID `BASELINE-G-02-DERIVED-20260810-001`, SHA `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B` | PASS |
| binding 필수 필드 | `parent_baseline_id`, `root_human_approval_id`, `derived_baseline_id`, `decision_approval_ref`, `semantic_diff=NONE` 모두 존재·일치 | PASS |
| DecisionRecord 역참조 | 동일 parent/root/derived ID와 binding·approval 참조 일치 | PASS |
| 승인 범위 | root approval과 G-02 decision approval을 대체·확대하지 않는다고 명시; 기능 범위·요구사항·중요 위험 변경 증거 없음 | PASS |
| semantic diff | revision 2 권위 artifact의 보호 hash 8/8 유지, `semantic_diff=NONE` 선언과 실제 관측 정합 | PASS |

G-01 승인 기준선과 G-02 human decision approval을 함께 부모 권위로 사용하고, revision 2의 문서 정규화 결과를 `MAIN_RECONFIRMED_NON_SEMANTIC` 파생 기준선으로 고정한 복합 계보다. G-02 승인 canonical 9행은 Q-01, Q-03~Q-06 및 Q-02 `RESERVED_NOT_DEFINED`, 5개 validation 할당을 한정적으로 승인하며, revision 3은 그 범위를 넓히지 않았다.

### 2.4 보호 hash 8개

| 보호 대상 | SHA-256 | 판정 |
|---|---|---|
| `Anvil_작업계획서_v1.md` | `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475` | PASS |
| `Anvil_통합검증매트릭스_v1.md` | `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` | PASS |
| `Anvil_테스트계획서_v1.md` | `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` | PASS |
| `docs/governance/ANVIL_OPERATING_RULES.md` | `5313045957E63D3AADA0DF2BFA8EBC2B8F878D59F4F917B3210B5293D4DE6DB6` | PASS |
| `docs/onboarding/developer-primary-ack.md` | `3110F6B21EFC3C7BE61B6CEB71A4586A75A80DC129D79DDC4B0A74AFE0039A69` | PASS |
| `docs/decisions/G-02_VALIDATION_ALLOCATION.md` | `B120543831125F1697011E40E2668D711ED77AD70104491F0CE8AD1BCD0862D4` | PASS |
| `docs/test_reports/G-02_TEST_REPORT.md` | `4B853057C4C370470C075B14384EB9FA2B881E2684AAB00E5D83CF2AEE274BF2` | PASS |
| `docs/test_reports/G-02_TEST_REPORT_R2.md` | `680232DEB4F232D858C3EB70EAEA875A9895BCCF5A0B9D867A66C76B633A565B` | PASS |

### 2.5 manifest 16개 artifact

manifest 기재 순서대로 실제 파일을 읽어 byte 수와 SHA-256을 재계산했다.

| # | Artifact | bytes | SHA-256 | 판정 |
|---:|---|---:|---|---|
| 1 | `docs/baselines/G-01_BASELINE_RECORD.md` | 5312 | `8EA9C6DA6E45955D7F7397C208FCFB0EFCC8C01B84851021F239350AC542847B` | PASS |
| 2 | `docs/approvals/APPROVAL-20260810-INTEGRATED-BASELINE-001.md` | 1966 | `94A82676DB9BF0EE23B55B0A59CBAC706AF7D8617B61BBB9887357E300FDFDC7` | PASS |
| 3 | `docs/approvals/APPROVAL-20260810-G02-DECISIONS-001.md` | 2271 | `40D01092F1DBEA6BB3860A154630FE2AF5CF9DEBD0C6F5BC531EE8FDC43C2DB6` | PASS |
| 4 | `docs/work_orders/G-02_WORK_INSTRUCTION.md` | 6741 | `FB21506565A1D0FBF5CAE2DEB9593C3A811E29DAA9B18954D591CFA80E19F1A4` | PASS |
| 5 | `docs/work_orders/G-02_INVOCATION_PROMPT.md` | 440 | `143CE907518F3608AF8752792BFB2BFEF53AEE0B65F3EFFF97CCE94FB5FFAD93` | PASS |
| 6 | `docs/test_reports/G-02_TEST_REPORT.md` | 10427 | `4B853057C4C370470C075B14384EB9FA2B881E2684AAB00E5D83CF2AEE274BF2` | PASS |
| 7 | `docs/test_reports/G-02_TEST_REPORT_R2.md` | 11624 | `680232DEB4F232D858C3EB70EAEA875A9895BCCF5A0B9D867A66C76B633A565B` | PASS |
| 8 | `docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md` | 4337 | `8332635C9CE92B085AFFDF1B235F48945605DC87FA7294DA5FF88A589C95D03D` | PASS |
| 9 | `docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md` | 4201 | `E11EAB020485395FE68049EF8F335D65A25F93AB65837901204554E570E8916B` | PASS |
| 10 | `Anvil_작업계획서_v1.md` | 64945 | `4DB8F5F5F85703CB4E1093550F6C8268D8666A50D2E84FDD70FC355014CF7475` | PASS |
| 11 | `Anvil_통합검증매트릭스_v1.md` | 61741 | `0A0CEA887EB0ECEB00EBFF7439E86890C878DDB06E1814398FB4D758E6B245D3` | PASS |
| 12 | `Anvil_테스트계획서_v1.md` | 53818 | `870BC8CAC3A7E5BAEBB711E3822C88EB01F18467654DCF170C689B3195114DC5` | PASS |
| 13 | `docs/governance/ANVIL_OPERATING_RULES.md` | 16886 | `5313045957E63D3AADA0DF2BFA8EBC2B8F878D59F4F917B3210B5293D4DE6DB6` | PASS |
| 14 | `docs/onboarding/developer-primary-ack.md` | 16416 | `3110F6B21EFC3C7BE61B6CEB71A4586A75A80DC129D79DDC4B0A74AFE0039A69` | PASS |
| 15 | `docs/decisions/G-02_DECISION_RECORD.md` | 5487 | `BFD2996BD54237B595BAC971BE5122302434A8EF5A14A128CBB85167B5C8C878` | PASS |
| 16 | `docs/decisions/G-02_VALIDATION_ALLOCATION.md` | 2902 | `B120543831125F1697011E40E2668D711ED77AD70104491F0CE8AD1BCD0862D4` | PASS |

- artifact 수: `16`
- 불일치: `0`
- canonical 입력: manifest 순서, `path=UPPERCASE_SHA256`, UTF-8, LF 구분, 마지막 LF 없음
- canonical bytes: `1718`
- 독립 계산 target: `B01C9BF94B00588DFCEFE35096C0D64A39FACE4D4123D34E314C1A54B07F5F17`
- manifest target: `B01C9BF94B00588DFCEFE35096C0D64A39FACE4D4123D34E314C1A54B07F5F17`
- delivered: `B01C9BF94B00588DFCEFE35096C0D64A39FACE4D4123D34E314C1A54B07F5F17`
- manifest 자체 SHA-256: `E39688335A0B1877116E34691977F8060E6B698A4D4F8E8A7B42BDBE5A3CD00A`

### 2.6 구조·할당·DIR

| 검증 항목 | 실제 결과 | 판정 |
|---|---:|---|
| 작업계획 Package 행 / unique | 97 / 97 | PASS |
| matrix reverse Package 행 / unique | 97 / 97 | PASS |
| Package reverse 누락 / 초과 | 0 / 0 | PASS |
| matrix AV 행 / unique AV | 255 / 255 | PASS |
| CON invariant | 21 | PASS |
| executable AV | 234 | PASS |
| executable 미할당 | 0 | PASS |
| reverse index 누락 executable ID | 0 | PASS |
| enforcement 공란 | 0 | PASS |
| DIR 계약 | `DIR-1`, `DIR-2`, `DIR-3`, 조건부 `DIR-X` 4종 | PASS |

`AV-SAFE-033`은 새 human binding이 필요한 hash 변경을 root human approval, G-02 decision approval, 비의미 재확정 binding, 파생 baseline의 parent-child 계보로 추적할 수 있으므로 PASS다. `AV-GATE-026`은 Q 결정·할당·97 Package 역색인·255 unique AV·234 executable·미할당 0·DIR 계약과 문서 간 정합성이 유지되므로 PASS다.

### 2.7 제품 코드·Git·server·DB 무변경

- 로컬 workspace에 `.git`, `apps`, `packages`, `domain`, `tests` 경로가 존재하지 않았다.
- `git status --short`, `git branch --show-current`, `git rev-parse HEAD`는 모두 `fatal: not a git repository`로 종료되어 Git commit·branch 변경 대상을 확인할 저장소가 없다.
- R2 보고서 이후 timestamp 기준 변경 파일은 revision 3의 허용 문서 8개뿐이었다: WorkInstruction, nonsemantic binding, derived baseline, DecisionRecord, manifest, CompletionReport, build-progress, BUILD_HANDOFF.
- G-02는 문서 전용 작업이며 제품 코드, 브라우저, server, DB, 배포 명령 실행 기록이 없다. 독립 Tester도 server/DB에 접속하거나 변경 명령을 실행하지 않았다.

이 결과는 **현재 로컬 문서 workspace와 제공된 evidence 범위**의 무변경 판정이다. 외부 server/DB의 전역 감사 로그를 조회한 결과로 확장하지 않는다.

## 3. 조치

1. Main Agent는 이 PASS를 독립 기술 검증 증거로 검토해 G-02 최종 상태를 결정한다.
2. 차단 finding이 없으므로 `G02-DEF-002` 재작업을 다시 열 필요가 없다.
3. 아래 MINOR 관찰은 기능 범위·요구사항·중요 위험을 바꾸지 않으므로 다음 문서 정비 시 명칭만 명확히 할 수 있다. 해당 보완을 이유로 합격 작업 전체를 다시 열지 않는다.

## 4. Findings

### 차단 finding

- 없음.

### `G02-OBS-001` — MINOR — 파생 baseline의 `Parent revision` 표제 명확성

- 관찰: G-01 BaselineRecord의 테스트계획 snapshot은 v1.1 / `FE6AEFE4A352A29D61CCD8AC3DD2EB6D6C9B1CDF8E3C095DFDC593C06586D1B8`이지만, nonsemantic binding과 derived baseline 표의 `Parent revision`은 v1.2 / `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A`로 적혀 있다.
- 판단: G-02 human decision approval이 G-01 이후 Q 결정과 검증 할당을 별도로 승인하고 해당 approval이 derived baseline에 명시되어 있으므로 계보 단절이나 승인 범위 확대는 아니다. 다만 `Parent revision`이라는 열 이름만 보면 단일 G-01 snapshot으로 오해할 수 있어 문서 품질상 모호성이 있다.
- 조치: 다음 비의미 문서 정비 시 열 이름을 `pre-normalization revision` 등으로 바꾸거나 `G-01 baseline → G-02 human decision transition → nonsemantic normalization`을 한 행으로 명시한다. 현재 PASS를 뒤집거나 G-02 전체를 재개할 사유는 아니다.

## 5. 실행 명령과 실제 결과

### 5.1 SHA·byte·manifest target

```powershell
Get-FileHash -Algorithm SHA256 <fixed/protected/artifact paths>
Get-Item -LiteralPath <artifact path> | Select-Object Length
$lines = $manifest.artifacts | ForEach-Object { "$($_.path)=$((Get-FileHash -Algorithm SHA256 -LiteralPath $_.path).Hash.ToUpperInvariant())" }
$canonical = [string]::Join("`n", $lines)
$target = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.UTF8Encoding]::new($false).GetBytes($canonical)))
```

실제 결과: fixed hash `5/5` 일치, protected hash `8/8` 일치, artifact hash/bytes `16/16` 일치, canonical bytes `1718`, target·delivered 모두 `B01C9BF94B00588DFCEFE35096C0D64A39FACE4D4123D34E314C1A54B07F5F17`.

### 5.2 canonical approval subject

```powershell
$canonical = [string]::Join("`n", <approval canonical 9 lines>)
[Text.UTF8Encoding]::new($false).GetByteCount($canonical)
[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.UTF8Encoding]::new($false).GetBytes($canonical)))
```

실제 결과: `LINE_COUNT=9`, `BYTES=509`, `SHA256=E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`.

### 5.3 계보 필드

```powershell
Select-String -Path docs/approvals/G-02_MAIN_RECONFIRMED_NON_SEMANTIC.md,docs/baselines/G-02_DERIVED_DESIGN_BASELINE.md,docs/decisions/G-02_DECISION_RECORD.md -Pattern 'parent_baseline_id|root_human_approval_id|derived_baseline_id|decision_approval|semantic_diff'
```

실제 결과: binding·derived baseline·DecisionRecord의 parent/root/derived ID가 모두 일치했고, 참조 파일이 모두 존재했으며 실제 hash도 manifest와 일치했다. `semantic_diff=NONE` 및 승인 비확대 문구가 확인되었다.

### 5.4 구조 계산

```powershell
# Markdown 표를 행 단위로 파싱하여 Package ID, AV ID, Type, Package assignment,
# reverse index, DIR ID를 각각 집합화한 뒤 중복·차집합·공란을 계산
```

실제 결과: `PLAN_PACKAGE=97/97`, `REVERSE_PACKAGE=97/97`, `MATRIX_AV=255/255`, `CON=21`, `EXECUTABLE=234`, `UNASSIGNED=0`, `REVERSE_MISSING=0`, `DIR=4`.

### 5.5 Git·제품 경로

```powershell
Test-Path .git,apps,packages,domain,tests
git status --short
git branch --show-current
git rev-parse HEAD
```

실제 결과: 모든 경로 `False`; Git 명령은 모두 `fatal: not a git repository`.

## 6. Spec compliance와 문서 품질

- Spec compliance: **PASS**. WorkInstruction revision 3의 허용 범위, 보호 hash, 계보 필드, manifest 계약, 구조·할당·DIR 조건을 충족한다.
- 문서 품질: **PASS with MINOR observation**. 핵심 ID·hash·승인 범위·semantic 판정은 재현 가능하다. `G02-OBS-001`의 표제 모호성만 차후 비의미 정비 대상으로 남는다.
- 기존 기능 유지: 제품 코드 자체가 범위에 없고 제품 경로가 없으므로 변경 증거가 없다. 런타임 기능 유지 PASS로 과장하지 않는다.

## 7. 미검증 범위와 한계

- revision 2 이전의 모든 중간 파일 snapshot이 별도로 보존되어 있지 않아 전체 byte-by-byte 역사 diff는 재현하지 않았다. 대신 manifest, 승인 기록, 보호 hash 8개와 현재 문서의 의미 경계를 대조했다.
- 제품 build, unit/integration/E2E, 브라우저 Network, 운영 유사 Docker, 배포는 G-02 문서 작업 범위가 아니므로 실행하지 않았다.
- 외부 server/DB에 접속하지 않았으므로 외부 감사 로그 기반의 전역 무변경은 미검증이다. 이 보고서의 무변경 판정은 로컬 artifact·허용 경로·실행 명령 범위에 한정한다.
- Git 저장소가 초기화되어 있지 않아 commit/branch 기반 diff는 사용할 수 없었다.

## 8. Evidence hash

- evidence manifest SHA-256: `E39688335A0B1877116E34691977F8060E6B698A4D4F8E8A7B42BDBE5A3CD00A`
- target hash: `B01C9BF94B00588DFCEFE35096C0D64A39FACE4D4123D34E314C1A54B07F5F17`
- delivered hash: `B01C9BF94B00588DFCEFE35096C0D64A39FACE4D4123D34E314C1A54B07F5F17`
- 이 보고서 자체 SHA-256은 파일 작성 완료 후 외부에서 계산하여 최종 응답으로 전달한다.
