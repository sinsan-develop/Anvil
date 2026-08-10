# G-02 독립 Test Report

- package_id: `G-02`
- work_instruction_id: `WI-G-02-20260810-001`
- tester_role: `구현·작성 담당자와 분리된 독립 Tester Subagent`
- verification_environment: `local-document-workspace / Windows PowerShell`
- repository_state: `NOT_INITIALIZED`
- overall_status: `REWORK`
- AV-SAFE-033: `PASS`
- AV-GATE-026: `FAIL`
- target_hash: `E70E5BEB4F132AA97DA4F717712EF9B5BFA68C602C71331B3225922E02212577`
- delivered_hash: `E70E5BEB4F132AA97DA4F717712EF9B5BFA68C602C71331B3225922E02212577`
- evidence_manifest_sha256: `50156C81CD0234F2D17FDA0178187C74D0CA61172DA0C91144510166702E6CEE`
- test_plan_v1.2_sha256: `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A`
- approval_subject_sha256: `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91`

## 1. 판정

`REWORK` — `AV-SAFE-033`은 승인 canonical subject와 parent 계보, 구 binding 무효화 및 v1.2의 새 human binding이 원문과 재계산 결과에 일치하여 `PASS`다. 그러나 `AV-GATE-026`은 활성 권위 문서에 테스트계획 v1.1 구 기준선과 `승인 대기` 상태가 남아 있어 “구 기준선 0건” 조건을 위반하므로 `FAIL`이다. 매트릭스에서 이 항목의 심각도는 `CRITICAL`이므로 G-02를 `ACCEPTED`로 전환할 수 없다.

## 2. 판단 이유

| 검증 항목 | 결과 | 독립 확인 결과 |
|---|---|---|
| 승인 canonical 9행·subject hash | PASS | UTF-8, LF, 마지막 LF 없음으로 9행·509 bytes를 재계산해 `E0DEC865...68A91` 일치 |
| parent approval 계보 | PASS | G-02 승인·DecisionRecord·WorkInstruction의 parent가 `APPROVAL-20260810-INTEGRATED-BASELINE-001`; parent 파일 SHA `94A82676...FDFDC7`, `APPROVED`, 신산님 결정, v1.1 hash binding 확인 |
| content hash 변경·binding | PASS | parent binding의 테스트계획 hash `FE6AEFE4...D1B8`와 현재 실제 hash `EB1AB1FA...B80A`가 다르며, DecisionRecord와 테스트계획 §16이 구 binding 무효화 및 G-02 human subject 신규 binding을 명시 |
| Q-01, Q-03~Q-06 | PASS | 테스트 스택/Project Profile 분리, 독립 Subagent 세션, 30분, Owner 승인, Markdown 정본→DB·화면 이관 및 provenance·ID 보존이 승인·DecisionRecord·테스트계획과 일치 |
| Q-02 | PASS | 모든 대상 문서에서 `RESERVED_NOT_DEFINED`; 새 요구사항 발명 없음 |
| 과거 미할당 5건 | PASS | 승인 만료=`AV-SAFE-004/B-04`; 취소 Workspace 보존=`AV-STAT-030/B-10`; formatter drift=`AV-GATE-011/C-14`; baseline failure=`AV-GATE-007`+`AV-GATE-008/C-14`; build-progress 필드=`AV-STAT-015/G-05` |
| 테스트계획 잔존 표현 | PASS | `잠정|미확정|가배정|승인\s*대기|provisional|PRELIMINARY` 검색 0건; §2.3, §15, §16 및 R-01/R-03/R-09가 승인 결정과 일치 |
| WorkInstruction 범위 | PASS | 승인 시각 이후 관측된 G-02 관련 write는 허용 파일 집합 안에만 존재; 제품 scaffold·Git·서버·DB 작업 금지 유지 |
| 97 Package | PASS | 작업계획 직접 행 97건, 고유 97건; 매트릭스 §8 역색인 행 97건, 고유 97건; package 누락·초과 0 |
| 255/234 AV | PASS | 매트릭스 직접 AV 행 255건·고유 255건; CON 21건; 실행 AV 234건; §8 역색인에서 실행 AV 누락 0, 미정의 ID 0 |
| DIR 4종 | PASS | DIR-1=A-15, DIR-2=C-15, DIR-3=E-11, DIR-X=`DIRX-LRN-CRITICAL` 조건부 추가 및 DIR-3 유지가 설계서·계획·매트릭스·테스트계획과 일치 |
| manifest 8건 | PASS | artifact 8/8의 SHA-256·bytes 일치; canonical 838 bytes 재계산 target=`E70E5BEB...12577`; delivered 동일 |
| 제품 코드·Git | PASS | `.git`, `apps`, `packages`, `domain`, `tests`가 없고 Git 3개 명령은 모두 “not a git repository”; 제품 파일 변경 관측 없음 |
| 서버·DB | 범위 내 무변경 | G-02 산출물·명령·로컬 파일에 서버/DB 변경 증거 없음. 금지 범위이므로 live server/DB 접속은 수행하지 않음 |
| 활성 기준선 정합성 | **FAIL** | 작업계획 3·11행, 매트릭스 3·8행, 운영규칙 19행이 현재 승인/테스트계획 v1.2 상태와 불일치 |

## 3. Findings

### G02-DEF-001 · 활성 권위 문서에 구 테스트계획 기준선과 승인 대기 상태 잔존

- **심각도**: `CRITICAL`
- **위반 검증 ID**: `AV-GATE-026`
- **판정**: `FAIL`
- **관측 사실**:
  - `Anvil_작업계획서_v1.md:3`은 `승인 대기 작업계획서`로 표시한다.
  - `Anvil_작업계획서_v1.md:11`은 테스트 실행 기준선을 v1.1 / `FE6AEFE4...D1B8`로 표시한다.
  - `Anvil_작업계획서_v1.md:53~63`의 구현 기준선 상태도 `신산님 승인 대기`로 남아 있으며 Q-01 승인 대상인 테스트 도구 경계도 포함한다.
  - `Anvil_통합검증매트릭스_v1.md:3`은 `승인 대기 검증 기준선`, 8행은 짝 문서를 테스트계획 v1.1로 표시한다.
  - `docs/governance/ANVIL_OPERATING_RULES.md:19`는 `현재 기준선`을 테스트계획 v1.1로 표시한다.
  - 반면 실제 테스트계획·build-progress·HANDOFF·G-02 DecisionRecord는 v1.2 / `EB1AB1FA...B80A`를 현재 기준선으로 표시한다.
- **판단 이유**: `AV-GATE-026`은 구 기준선 0건과 문서 간 일치를 CRITICAL 완료조건으로 명시한다. manifest가 포함한 작업계획·매트릭스 자체가 구 기준선을 담고 있으므로 artifact hash 8/8 일치와 canonical target 일치는 내용 정합성을 증명하지 못한다. CompletionReport의 `PRELIMINARY_PASS_CANDIDATE` 주장은 이 불일치를 누락했다.
- **조치**: Main Agent가 의미 변경 여부를 분류하고 G-02 WorkInstruction revision을 발행한다. 작업계획·매트릭스·운영규칙의 활성 상태/짝 문서 기준선을 v1.2 binding과 정합화할 수 있도록 허용 파일을 명시한다. 변경된 모든 content hash는 기존 binding을 무효화하므로 운영규칙에 따라 새 binding 계보와 manifest를 재생성한 뒤 `AV-GATE-026` 전체를 독립 재검증한다.
- **재검증 범위**: G-02 전체 — approval subject/parent lineage, 변경 문서 hash, manifest 8건 또는 개정 artifact 집합, canonical target, 97/255/234, DIR, 구 기준선·미할당 표현 검색.

## 4. 명령과 실제 결과

| 명령·검사 | 종료 코드 | 실제 결과 |
|---|---:|---|
| `Get-FileHash -Algorithm SHA256 -LiteralPath 'Anvil_테스트계획서_v1.md'` | 0 | `EB1AB1FACABFC9775FDE6F89D598673C40748DE8E01C444282958EBD9F26B80A` |
| `Get-FileHash -Algorithm SHA256 -LiteralPath 'docs/evidence/manifests/G-02_EVIDENCE_MANIFEST.json'` | 0 | `50156C81CD0234F2D17FDA0178187C74D0CA61172DA0C91144510166702E6CEE` |
| 승인 파일의 `Canonical subject` code block을 추출해 UTF-8/LF/no-final-LF로 `SHA256.HashData` | 0 | 9행, 509 bytes, `E0DEC8651FEA543BDCC08B0A015C89F9D0E7A8F22E964F6025EBA1544BF68A91` |
| `ConvertFrom-Json` 후 manifest artifact 순서로 각 `Get-FileHash`·`Get-Item.Length` 재계산 | 0 | 8건, hash mismatch 0, bytes mismatch 0 |
| `path=UPPERCASE_SHA256` 8행을 LF/no-final-LF로 연결해 `SHA256.HashData` | 0 | canonical 838 bytes, target `E70E5BEB4F132AA97DA4F717712EF9B5BFA68C602C71331B3225922E02212577`, target=delivered |
| PowerShell 정규식으로 작업계획 `^\| ([GABCDFEP]-\d{2}) \|` 직접 행·고유 집계 | 0 | 97 / 97 |
| PowerShell 정규식으로 매트릭스 `^\| (AV-...-\d{3}) \|` 직접 행·고유 집계 | 0 | 255 / 255, CON 21, 실행 AV 234 |
| 매트릭스 §8 축약·범위를 전개해 실행 AV와 Package 집합 비교 | 0 | reverse unique AV 236, 실행 AV 누락 0, 미정의 AV 0, Package 97/97, 누락·초과 0 |
| `rg -n "AV-SAFE-004|AV-STAT-030|AV-GATE-011|AV-GATE-007|AV-GATE-008|AV-STAT-015" 'Anvil_통합검증매트릭스_v1.md'` | 0 | 6개 ID 직접 행과 B-04/B-10/C-14/G-05 역색인 확인 |
| `rg -n "잠정|미확정|가배정|승인\s*대기|provisional|PRELIMINARY" 'Anvil_테스트계획서_v1.md'` | 1 | 예상된 no-match, 잔존 0건 |
| `rg -n "Anvil_테스트계획서_v1\.md.*v1\.1|테스트계획서.*FE6AEFE4|승인 대기"` 대상 권위 문서 검색 | 0 | 작업계획·매트릭스·운영규칙의 활성 구 기준선/승인 대기 표현 검출 |
| `git status --short`; `git branch --show-current`; `git rev-parse HEAD` | 128 / 128 / 128 | 모두 `fatal: not a git repository` |
| `Test-Path '.git','apps','packages','domain','tests'` 개별 확인 | 0 | 모두 `False` |
| G-02 승인 파일 생성 시각 이후 workspace 파일 `CreationTime/LastWriteTime` 열거 | 0 | G-02 관련 write 10건 모두 WorkInstruction 허용 파일; 제품 경로 변경 0 |

## 5. Spec compliance와 문서 품질

- 승인 결정, Q 값, 5개 배정, hash canonicalization, ID/Package 통계와 DIR 계약은 명확하고 서로 추적 가능하다.
- DecisionRecord는 구 binding 무효화와 새 human binding을 같은 절에 고정해 `AV-SAFE-033`의 문서 증거 품질이 충분하다.
- Validation Allocation의 직접 행/역색인 인용은 정확하다. baseline failure를 두 ID로 분리한 점도 원문과 일치한다.
- 반면 CompletionReport와 manifest의 기계적 PASS는 활성 문서 내부의 구 기준선 문자열을 검사하지 않아 `AV-GATE-026`의 의미 조건을 충족하지 못했다. hash 일치는 내용 적합성의 대체 증거가 아니다.

## 6. 미검증 범위

- 변경 전 테스트계획 v1.1 원본 bytes는 현재 workspace에 보존되어 있지 않아 `FE6AEFE4...D1B8`을 과거 파일 내용에서 재계산하지 못했다. 대신 parent approval 원문과 그 파일 SHA, 현재 v1.2 실제 SHA의 차이 및 무효화 기록을 대조했다.
- 서버·DB의 외부 감사 로그나 스냅샷은 조회하지 않았다. G-02가 서버·DB 작업을 금지한 문서 Package이고 외부 변경 기준선도 제공되지 않았기 때문이다.
- 제품 코드·브라우저·API·DB·배포 기능 테스트는 G-02 비범위이며 수행하지 않았다.
- Git이 미구성되어 diff 기반 changed-path 증명은 불가능하다. 파일 시각·경로·hash와 제품 scaffold 부재로 범위 준수를 확인했다.

## 7. 조치

`G-02`를 `TEST_REVIEW → REWORK`로 반환한다. `G02-DEF-001`을 보정한 revised artifact/approval binding/manifest를 제출하고 같은 독립 검증을 재실행한다. 그 전에는 G-02 `ACCEPTED`, G-03 착수, Git 초기화, scaffold, commit, push 또는 배포를 수행하지 않는다.
