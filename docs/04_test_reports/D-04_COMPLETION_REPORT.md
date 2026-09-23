# D-04 완료보고

## 판정

`COMPLETED` — developer-primary-d04-r1의 승인 WI 구현·기본 검증 완료. Main 독립 검토/ACCEPTED와 D-05 시작 승인이 아니다.

최신 결과는 아래 R1 기준: focused **70 PASS**, knowledge/API **1132 PASS**. 최초 64/1126 결과는 당시 실행 증거로 보존한다.

## 판단 이유

- D-03 repository의 exact host context와 source ID/version/record hash·현재 REGISTERED 상태·보안/license/ownership을 추출 및 모든 사용 조회 직전에 재검증한다. source lock과 pattern lock의 고정 순서로 concurrent revoke와 사용 사이 TOCTOU를 막는다.
- CodePattern, ExampleReference, AntiPattern을 immutable version/previous hash로 생성한다. source scope/confidentiality/license/ownership/exclusions/quality/content hash를 상속하며 원본 source body는 받거나 저장하지 않는다.
- positive pattern/reference는 VERIFIED source·eligibility, source content hash와 동일한 최종/승인 hash, independent verification, ACCEPTED/SUCCEEDED, non-empty tests PASS와 exact G0~G3 PASS를 요구한다. 실패/거부/미검증 및 자체생성 미검증 결과는 positive exemplar가 되지 않는다.
- 품질만 부족한 REGISTERED source는 failure evidence가 있는 AntiPattern 후보만 가능하다. 보안/license 부적격 또는 revoked/quarantined source는 AntiPattern에도 사용할 수 없다. AntiPattern failure evidence 역시 exact source content hash에 결박한다.
- host-only attest는 exact payload digest·source·evidence·actor·half-open time에 결박한다. API에서 raw evidence/body/actor/quality/approval/scope/license 자가부여를 허용하지 않는다.
- metadata-only search는 intent/language/framework/risk 및 scope/현재 source 상태를 검사하고 deterministic rank한다. AntiPattern은 명시적으로 검색 종류를 지정한 경우에만 반환하며 기본 positive 검색에서 제외한다.
- ExampleReference의 extract/get/search는 summary만 제공한다. load-reference는 선택 CodePattern에 정확히 등록된 reference ID/version/hash만 로드한다. 반환 내용은 source locator/commit/revision, 범위 selector/purpose/excerpt hash뿐이며 실제 source fetch/본문 load는 아니다.
- JSON 정본과 분리된 frozen projection, version gap/rollback/identity rebind 차단, scope request replay, failed-request retry, concurrent extract 정본 1개를 검증했다.

### 기준선·권위

- cwd: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- 시작/종료 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`; branch `codex/c09-execution-backends-r1`.
- 시작 git status: 이전 C-13~C-15/D-01~D-03 및 Main control dirty/untracked를 유지한 상태. 이번 D-04 네 개 code/test 파일 및 report는 신규, 기존 knowledge/__init__.py에는 export만 추가했다. clean/commit 완료를 주장하지 않는다.
- 확인 시각 `2026-09-16T09:35:15+09:00`, canonical seq964, 선행 D-03 ACCEPTED.
- worker `worker-lease-d04-r1-20260916-001`, execution fence `d04-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`.
- write `write-lease-d04-r1-20260916-001`, write fence `d04-r1-write-fence-epoch-1-234458b5283abafa`.
- 양 lease ACTIVE, 발효 `2026-09-16T09:29:38+09:00`, 만료 `2026-09-16T21:29:38+09:00`, exact6 일치.
- WI SHA256 `7883CB61254E817929DB8D9EDBFCDE0B9088308BCFDA4C01E7D2B35341124905`.
- invocation SHA256 `F221CBA261A8984B23A11BBCF1218AB5D09A7F1752FE1D12379F1A02AC533078`.
- Design baseline SHA256 `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`.
- 작업계획 SHA256 `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.
- Matrix SHA256 `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`.
- Test plan SHA256 `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`.
- 범위: AV-LRN-008, AV-LRN-009의 D-04 순수 domain/API 계약. AST/LLM extraction, Skill/Hook 후보 생성 및 activation은 PASS로 승격하지 않는다.

### 변경 파일·diff

| exact6 | 변경 전 → 변경 후 |
|---|---|
| packages/knowledge/__init__.py | D-01~D-03 exports 유지 → D-04 artifact/repository/error/summary exports 추가 |
| packages/knowledge/patterns.py | 없음/RED stub → source/evidence-bound artifact 추출·immutable store·metadata rank·explicit reference projection |
| packages/api/knowledge_patterns.py | 없음 → authenticated host-context extract/search/get/load-reference adapter |
| tests/knowledge/test_patterns_d04.py | 없음 → 50개 source/quality/lineage/alias/version/concurrency/선택적 load 테스트 |
| tests/api/test_knowledge_patterns_d04.py | 없음 → 14개 API authority/redaction/projection/revoke 테스트 |
| docs/04_test_reports/D-04_COMPLETION_REPORT.md | 없음 → 현재 검증·경계·rollback 보고 |

### 정확한 실행 증거

모든 command cwd는 위 격리 경로다. 기존 Python 3.13.9 interpreter를 읽어 실행했으며 원본 D:\tmp worktree 파일은 변경하지 않았다.

| 단계 | 명령 | exit / 실제 결과 |
|---|---|---|
| 최초 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_patterns_d04.py -k verified_sources --tb=short` | 1 / 3 failed, 28 deselected, 0.13s; D04_PATTERN_CONTRACT_NOT_IMPLEMENTED |
| 최초 GREEN | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_patterns_d04.py tests/api/test_knowledge_patterns_d04.py --tb=short` | 0 / 40 passed, 1.14s |
| AntiPattern target RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_patterns_d04.py -k antipattern_evidence --tb=short` | 1 / 1 failed, 49 deselected, 0.14s; PATTERN_EVIDENCE_TARGET_MISMATCH 미발생 |
| 보강 GREEN | 위 focused 명령 | 0 / 59 passed, 1.02s |
| 최종 focused | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_patterns_d04.py tests/api/test_knowledge_patterns_d04.py --tb=short` | 0 / 64 passed, 1.17s |
| 전체 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 1126 passed, 7.80s; skip 0 |
| compileall | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| whitespace | `git diff --check` | 0 / 출력 없음 |

오류 fingerprint/count: 의도한 RED 2종/4 test failures, 최종 미해결 0. 정식 FAILURE_REPORT 0. Git global ignore 접근 경고는 환경 경고이고 제품 실패가 아니다.

신규/untracked exact6은 각각 `git diff --no-index --check -- NUL <위 exact6 경로>`로 검사했다. 각 exit 1은 NUL 대비 내용 차이이고 whitespace 진단은 모두 0건이다. 보고서 작성 후 `git diff --check`도 exit 0이다.

선행 구현 SHA256 유지: memory.py `D730F3FC46BA374895B87C03580C346772D095C039BD3690094891D53483D1F7`, snapshots.py `42B620BC1ADE951D9C9B22327A217BAA62C7C6806096D138DB02D0D86BDC848F`, sources.py `124DE0727753C6E8785B5E0DDE58F657769FF2F50EC4F030DF0A6BEFBF191121`.

## 조치

- Main 독립 검토를 요청하는 결과 계약으로 반환한다. progress/HANDOFF/events/checker/WI/Git는 Main 소유이며 변경하지 않았다. D-05 시작 없음.
- 실제 미검증: HTTP 인증/서버/UI, filesystem/repository/network fetch, AST·LLM extraction, 실제 Gate/test evidence 취득, DB/Provider/browser/WSL/Docker/deploy, D-06 승인/activation/rollback 및 Run 사용 연결.
- 모든 artifact는 candidate_only다. positive exemplar의 저장/검색 품질 기준을 충족해도 실제 활성화/실행 권한을 부여하지 않는다. attest는 host가 검증한 metadata에 대한 in-memory trusted seam이지 실제 인증·human approval 시스템이 아니다.
- D-04는 자체 source→artifact provenance를 보존하고 D-03 current source를 매 사용마다 확인한다. D-03 derived registry에 자동 역색인 등록하지 않으므로 D-03 SourceRevocationImpact의 파생 목록에 D-04 artifact가 자동 포함되는 end-to-end 연결은 미검증이다. 특히 품질 미검증 AntiPattern은 기존 D-03 register_derived eligibility 계약과 다른 후보 경계다. 이 경계는 구현 중 Main에 보고했다.
- 잔여 위험: D-03 host identity/lock의 in-memory adapter 결합, 제한된 metadata 안전 scanner, host가 제공한 증거의 실제 취득 신뢰. 실제 외부 evidence 검증으로 오해하지 않는다.
- rollback: Main이 D-04 신규 pattern/API/tests/report 5개와 __init__.py의 D-04 import/exports만 검토 후 역적용한다. D-01~D-03 exports·기존 dirty/untracked·원본 D:\tmp worktree는 보존한다. 외부 side effect나 DB 변경 없음.
- 승인 WI 실행/TDD/완료 전 검증 skill에 따라 순차 RED→GREEN과 fresh 관련 회귀를 수행했다. 사용자 지정 격리 clone을 사용했으며 새 worktree/branch/install/권한 상승을 수행하지 않았다.

## R1 재작업

### 판정

`COMPLETED` — positive evidence key 결박, 만료 후 attestation 재발급, reference sibling locator 비노출의 리뷰 3항목을 수정했다. Main 재검토 전 ACCEPTED가 아니다.

### 판단 이유

- `D04-POSITIVE-UNBOUND-TEST-REF`: non-empty/all PASS tests만 확인하면 unrelated-smoke가 요구 verification ref의 PASS를 대체할 수 있었다. 이제 모든 positive proof verification_refs는 exact PASS test/gate evidence key에 속해야 하며 CodePattern details refs는 proof refs의 부분집합이어야 한다. CodePattern과 ExampleReference, API 경로에서 무관 test 대체를 차단했다.
- `D04-EXPIRED-ATTESTATION-REISSUE`: active attestation의 conflicting rebind는 계속 거부한다. 기존 attestation의 half-open expiry 이후에만 동일 payload digest의 새 proof/captured_at/expires_at을 host가 발급할 수 있다. extract는 최신 발급 record의 시간 경계를 확인하여 과거 attestation 시각과 새 만료 경계 사용을 거부한다.
- `D04-REFERENCE-SIBLING-DISCLOSURE`: source locator 전체를 reference에 복사하지 않는다. repository/document/run/URL identity 및 commit/revision은 유지하고 path/symbol은 선택된 값만 저장·반환한다. range는 선택 selector에 그대로 결박한다. private sibling path/symbol이 reference 정본·explicit load·API에 없으며 D-03 원본 source locator는 그대로 유지됨을 검증했다.
- 2026-09-16T09:59:22+09:00 canonical seq964/ACTIVE epoch1 dual lease/tokens/만료21:29:38 확인. HEAD/branch와 D-01~D-03 구현 hash는 위 기준선과 같다.

### 조치·검증

R1 변경은 exact6 중 patterns.py, domain/API 테스트 2개, 본 보고서 4개다. API 구현/__init__.py/D-01~D-03/control/Git/외부 IO는 변경하지 않았다.

| 단계 | 정확한 명령 (cwd는 위 격리 경로) | exit / 실제 결과 |
|---|---|---|
| RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_patterns_d04.py tests/api/test_knowledge_patterns_d04.py -k r1 --tb=short` | 1 / 6 failed, 1 passed, 63 deselected, 1.03s |
| focused GREEN | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_patterns_d04.py tests/api/test_knowledge_patterns_d04.py --tb=short` | 0 / 70 passed, 1.00s |
| 전체 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 1132 passed, 7.47s; skip 0 |
| compileall | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| whitespace | `git diff --check` | 0 / 출력 없음 |

R1 의도한 RED는 3 fingerprint/6 tests이며 최종 미해결 실패 0. 공식 review/failure ledger는 Main 소유다. 기존 revoke/alias/version 회귀를 포함한다. 미검증·잔여 위험은 위의 실제 IO/host evidence 신뢰/activation 및 D-03 역색인 연결 경계와 동일하다.

rollback은 Main이 R1 evidence key 검사·만료 reissue 조건·locator 최소화와 R1 tests/report 추가만 역적용하며 최초 구현/기존 dirty를 보존한다. progress/HANDOFF/control/Git mutation/권한 상승/외부 IO 없음. 리뷰 수신·TDD·완료 전 검증 순서를 준수했다.
