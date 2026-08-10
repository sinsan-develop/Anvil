# G-07 revision 2 독립 TestReport

## 판정

- Work Package: `G-07`
- WorkInstruction: `WI-G-07-20260810-002`
- WI SHA-256: `1D51FBBB450BB677BDAD3BFB30DF04BBAB44C9F6472404735B08858A27C3B0FA`
- Invocation SHA-256: `504C747A5A078D8D7E06DE736FB01F187948B78868B4ABD11A13D0C3F4A8A873`
- 독립 Tester 판정: **PASS / TEST_REVIEW**
- `AV-GATE-026`: **PASS (L2, 문서·artifact 기준선 검증 범위)**
- blocking finding: **0건**
- G-07 `ACCEPTED`, Phase G Gate 판정, commit/push, A-01 시작: **수행·주장하지 않음**

## 판단 이유

### 1. 권위 기준선과 Git provenance

- branch/HEAD/upstream: `main` / `23bc0019aeba0d6ae2b04c52fad6c778d8b7b6e8` / 동일, 명령 exit `0`.
- 권위 문서 실제 SHA-256은 WI binding과 일치했다: AGENTS `1E933333…8246`, 설계서 `246D0487…A9A5`, 작업계획 `4DB8F5F5…7475`, 통합검증매트릭스 `0A0CEA88…45D3`, 테스트계획 `870BC8CA…DC5`, 운영규칙 `7D5E2AD0…FB5F3`.
- G-01~G-06 final TestReport/manifest는 Git tracked evidence이며 progress의 완료 집합 및 acceptance event와 일치했다. 특히 G-05 R2와 G-06 R3에 대해 `git diff --exit-code HEAD -- ...`가 exit `0`이었다.
- 과거 산출물 안의 이전 version 표기는 이력 문맥으로 보존되어 있었다. 현재 문서 첫 heading·현재 권위 SHA binding과 분리해 판정했으며 active drift로 집계하지 않았다.

### 2. 독립 Markdown/JSON 파싱 결과

workspace 밖 임시 독립 파서를 작성해 raw 문서를 직접 파싱했다.

| 항목 | 독립 재계산 |
|---|---:|
| Package / unique / reverse | `97 / 97 / 97` |
| Phase | `G7, A15, B12, C15, D13, E11, F20, P4` |
| 미상 dependency / cycle | `0 / 0` |
| AV / unique / executable | `255 / 255 / 234` |
| domain | `AGT38, CON21, FLOW25, GATE26, LRN28, OPS25, PLG7, SAFE30, STAT39, UI16` |
| 미할당 AV / 잘못된 CON enforcement | `0 / 0` |
| §49.17 trace | `20/20`, 의미 불일치 `0` |

- CON 21건은 135개 유효 실행형 enforcement reference 및 `AV-CON-016`의 `RV 판정`으로 집행 경로가 모두 존재했다.
- DIR 위치는 `A-15=22`, `C-15=49`, `D-13=62`, `E-11=73`이었다. `DIRX-LRN-CRITICAL`, DIR-3 보존, `DIR_HOLD → REPORTING → WAITING_OWNER_DIRECTION → CLEARED`도 일치했다.
- Local/WSL PostgreSQL 15/격리 PostgreSQL 18 RC/ysna-server 및 Git-only 배포 계약이 존재했다.
- 명령: `C:\Users\cyhuh\anaconda3\python.exe C:\Users\cyhuh\AppData\Local\Temp\anvil-g07-independent.py`; exit `0`; `G07_INDEPENDENT_PARSE_OK=True`.

### 3. manifest·snapshot·HANDOFF 독립 검산

- raw checksum: `14/14` 실제 file bytes/hash 일치, mismatch `0`.
- canonical bytes/content bytes: `1627 / 160176`.
- 독립 target = recorded target = delivered: `836E618A3F3784C06DE7002B8572AD4B1453314B85807D6B1AB29EBBCBA89D7A`.
- manifest content hash: `CBC89E3C270038688ACDD7DCCB66CC533F6AEA048D0C6358BDBFD08393737BEA`; manifest file SHA: `7967674B6CBDA114ADF530C98B94BFB062888278F05AF7A9A775EA64EBE46320`.
- progress file/canonical/snapshot은 각각 `2ECC673E…A40F`, `82AD28BA…520D`, `BCC7646B…C9D1`로 recorded 값과 일치했다.
- HANDOFF file/machine-summary는 `C5003AA6…8157`, `9EC0EC86…D4B4`; detached file은 `0C6BFAA8…6F29`; event sequence는 모두 `18`이었다.
- 명령: `C:\Users\cyhuh\anaconda3\python.exe C:\Users\cyhuh\AppData\Local\Temp\anvil-g07-hash-audit.py`; exit `0`; `G07_HASH_BINDING_OK=True`.

### 4. 적대 변형과 회귀

- 독립 적대 변형 `14/14`가 모두 거부됐다: 현재 권위 hash/version, Package duplicate/unknown dependency, AV duplicate, reverse duplicate, DIR 누적, scenario AV/package/Gate/evidence trace, runtime false PASS, 기존 acceptance evidence 누락, G Gate 전 A-01 허용.
- 명령: `C:\Users\cyhuh\anaconda3\python.exe C:\Users\cyhuh\AppData\Local\Temp\anvil-g07-mutations.py`; exit `0`; `G07_ADVERSARIAL_MUTATIONS_OK=14/14`.
- 명령: `python -m unittest tests.tooling.test_g07_baseline tests.tooling.test_g06_test_assets tests.tooling.test_project_progress tests.tooling.test_artifact_templates tests.tooling.test_dependency_boundaries`; exit `0`; `Ran 83 tests in 19.500s`, `OK`.
- 명령: `python scripts/check_g07_baseline.py .`; exit `0`; `G-07 baseline: PASS packages=97 av=255 uncovered=0 scenarios=20 mapping=AE9838B35B430703E16255B6C34C084B7F917B063171BD98F61460F8CFA8F8AF`.

## 조치

- 차단 finding이 없으므로 구현 수정이나 재작업 지시는 없다.
- Main Agent는 이 독립 PASS를 검토한 뒤에만 별도 권한으로 G-07 acceptance와 Phase G Gate를 판단한다.
- §49.17 20건은 `DESIGN_LOCKED / NOT_EXECUTED`다. 제품 API/UI/브라우저/DB/server/Docker/WSL/production/deployment/release와 FI runtime 실행은 이번 L2 범위 밖이며 PASS로 승격하지 않는다.
- G Gate가 적법하게 완료되기 전 A-01은 시작할 수 없다.

## 변경 통제

- Tester가 작성한 workspace 파일: `docs/test_reports/G-07_TEST_REPORT.md` 한 파일.
- 기존 구현·progress·HANDOFF·manifest·테스트·권위 문서는 수정하지 않았다.
