# D-03 완료보고

## 판정

`COMPLETED` — developer-primary-d03-r1 구현·기본 검증 완료. Main 독립 검토/ACCEPTED와 후속 D-04 시작을 뜻하지 않는다.

최신 판정은 아래 R3 재작업 결과 기준이다: focused **638 PASS**, knowledge/API **1062 PASS**. 최초 구현 및 R1/R2 결과는 당시 기록으로 보존한다.

## 판단 이유

- 여섯 source type의 typed locator, commit/revision, 재계산 content hash, scope/기밀/license/ownership/품질/scan/actor/time을 immutable version에 결박했다.
- secret/credential URI, 직접 PII, 영·한 instruction override, binary/executable/minified/vendor, malware marker 및 license/ownership finding은 eligibility를 차단한다. 본문은 저장하지 않으며 오류/조회에는 원문을 반영하지 않는다. 품질 미검증 자료는 USER_ENDORSED_UNVERIFIED로 보존한다.
- 8종 derived item과 snapshot/run 사용은 registry의 정확한 source/parent version/hash에만 결박한다. scope/기밀/license/exclusions는 상속하며 caller의 축소/확대 필드를 허용하지 않는다.
- revoke/quarantine은 등록된 계보로만 파생 항목/영향 snapshot·run/진행 Run PAUSE_REQUIRED를 계산한다. 과거 source/usage/impact를 삭제하지 않고 신규 사용을 차단한다.
- host context는 해당 repository가 발급한 exact object identity·원본 actor/scope·half-open validity로 확인한다. capture는 정확한 candidate digest와 발효시각에 결박한다. 공개 DTO 재구성·foreign context·payload authority·backdating은 거부한다.
- 정본 JSON 문자열과 분리된 frozen projection으로 mutable input/output alias가 정본 hash/계보를 바꾸지 않는다. RLock 및 scope/request receipt로 stale/replay/동시 중복 생성을 차단한다. 실패는 request ID를 소모하지 않는다.

### 기준선·권위

- 작업 경로: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`. 원본 D:\tmp worktree는 수정하지 않았다.
- 시작/종료 branch: `codex/c09-execution-backends-r1`, HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`.
- 시작 상태: 기존 C-13~C-15/D-01/D-02 및 Main control dirty/untracked 유지. D-03 source/API/tests/report는 새 파일, knowledge/__init__.py는 선행 D-01/D-02 untracked exports에 D-03 exports만 추가했다. clean worktree나 commit 완료로 표시하지 않는다.
- canonical sequence 955, D-01/D-02 ACCEPTED. 직접 확인 2026-09-16 08:24 KST 및 종료 전 08:42 이후 재확인.
- worker: `worker-lease-d03-r1-20260916-001`; execution fence: `d03-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`.
- write: `write-lease-d03-r1-20260916-001`; write fence: `d03-r1-write-fence-epoch-1-234458b5283abafa`.
- 양 lease ACTIVE, 발효 `2026-09-16T08:17:06+09:00`, 만료 `2026-09-16T20:17:06+09:00`; exact6 일치.
- WI SHA256: `32C4CD120D759913B6422FC4E70A4E05FCDC53AB9DBCAED489AA87ED5E4B92F9`.
- invocation SHA256: `B4E52274473A14901B9A6F9702A81DB78F9193FF40CF107470B8E9828248A89C`.
- 설계서 SHA256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`.
- 작업계획 SHA256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.
- 통합검증매트릭스 SHA256: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`.
- 테스트계획 SHA256: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`.

### 변경 파일·diff 요약 (exact6)

| 파일 | 변경 전 → 변경 후 |
|---|---|
| packages/knowledge/__init__.py | D-01/D-02 exports 유지 → D-03 8종 공개 계약 export 추가 |
| packages/knowledge/sources.py | 없음/RED stub → source·host capture·scanner·immutable lineage·impact registry |
| packages/api/learning_sources.py | 없음 → register/get/list-derived/get-impact/revoke/quarantine 순수 API adapter |
| tests/knowledge/test_sources_d03.py | 없음 → 58개 domain positive/adversarial/concurrency 테스트 |
| tests/api/test_learning_sources_d03.py | 없음 → 11개 API authority/schema/redaction/replay 테스트 |
| docs/04_test_reports/D-03_COMPLETION_REPORT.md | 없음 → 현재 실행 증거/경계/rollback 보고 |

### 실행 검증

모든 명령의 cwd는 위 격리 경로다. 사용 interpreter는 기존 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe` (Python 3.13.9)이며 원본 작업 파일은 쓰지 않았다.

| 단계 | 정확한 명령 | exit / 실제 결과 |
|---|---|---|
| 의도한 최초 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py -k six_source --tb=short` | 1 / 6 failed, 25 deselected, 0.22s; D03_SOURCE_CONTRACT_NOT_IMPLEMENTED |
| 최초 GREEN | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py --tb=short` | 0 / 42 passed, 0.98s |
| 발효시각 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py -k capture_cannot --tb=short` | 1 / 1 failed, 56 deselected, 0.16s; STALE_SOURCE_TIME 미발생 |
| 보강 GREEN | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py --tb=short` | 0 / 68 passed, 1.09s |
| scope PII RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py -k direct_pii_in_host_scope --tb=short` | 1 / 1 failed, 57 deselected, 0.15s; UNSAFE_SOURCE_METADATA 미발생 |
| 최종 focused | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py` | 0 / 69 passed, 0.98s |
| 최종 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 493 passed, 6.43s; skip 0 |
| compileall | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| tracked whitespace | `git diff --check` | 0 / 출력 없음 |

중간 관련 회귀도 492 passed(6.62s)였다. 최종 결과는 위 493이며 과거 실행을 현재 증거로 재사용하지 않는다.

untracked exact6도 각각 `git diff --no-index --check -- NUL <위 표의 파일 경로>`로 확인했다. 각 exit 1은 빈 NUL과 신규 파일의 내용 차이를 뜻하며 6개 모두 whitespace 진단 출력 0건이었다. 완료보고 작성 뒤 재실행한 `git diff --check`도 exit 0이다.

오류 fingerprint/count: 의도한 TDD RED 3종/8 test failures, 최종 미해결 0. 최초 patch 문맥의 빈 줄 불일치 1회는 파일 0변경 후 정확한 문맥으로 재적용했고 정식 제품 실패가 아니다. Git global ignore 접근 경고는 읽기 환경 경고이며 제품 테스트 실패가 아니다. 정식 FAILURE_REPORT 횟수 0.

AV-LRN-006/007/009/027은 위 순수 domain/API 계약 범위로 검증했다. D-01 memory.py SHA256 `D730F3FC46BA374895B87C03580C346772D095C039BD3690094891D53483D1F7`, D-02 snapshots.py SHA256 `42B620BC1ADE951D9C9B22327A217BAA62C7C6806096D138DB02D0D86BDC848F` 유지 및 관련 회귀 통과.

## 조치

- Main에 현재 exact6 diff와 본 보고서를 전달한다. progress/HANDOFF/events/checker/WI는 Main 소유로 미갱신. Git stage/commit/push, 권한 상승, 승인 UI, 외부 전송 없음.
- 미검증: 실제 HTTP 인증, repository/file/URL fetch·검사, DB persistence, AST/candidate 생성, Provider/browser/WSL/Docker/deploy, D-02 catalog 전파, 실제 Run pause, 승인/activation lifecycle. 전부 D-03 밖이며 PASS로 주장하지 않는다.
- 잔여 위험: scanner는 제한된 결정론적 패턴이며 범용 악성코드 분석/PII 탐지/의미 기반 injection 판단이 아니다. host가 실제 검증·권한 확인을 수행했다는 in-memory trusted adapter 경계를 전제로 한다. source 등록은 자료 출처 계약이지 생성된 skill의 실행 승인/품질 보증이 아니다.
- rollback: Main이 이번 신규 source/API/test/report 5개와 __init__.py D-03 import/exports만 검토 후 역적용한다. __init__.py의 기존 D-01/D-02 exports, 다른 dirty/untracked 및 원본 D:\tmp worktree는 보존한다. DB/외부 side effect가 없어 데이터 rollback은 없다.
- 사용 skill의 TDD·완료 전 검증 원칙에 따라 scanner/권위/시간 경계를 RED로 재현한 후 수정하고, 최종 명령 출력에 근거해 범위를 한정했다.

## R1 재작업 — metadata credential 비노출 및 locator 정규성

### 판정

`COMPLETED` — 독립 리뷰의 token credential metadata 누출 및 locator 경계 공백 보완. 최종 focused 139 PASS, 관련 회귀 563 PASS. Main 재검토 전 ACCEPTED로 승격하지 않는다.

### 판단 이유

- 재현 fingerprint `D03-METADATA-TOKEN-EXPOSURE`: 기존 D-01 scanner는 일반 `token=` assignment를 놓쳐 teaching_intent/locator query 등을 capture·등록할 수 있었다. `_text()`의 공통 검사에 credential assignment를 추가해 source_id/teaching_intent/label/exclusions/locator의 모든 문자열과 host provenance 문자열에서 `SECRET_LIKE_INPUT`으로 원문 비노출 거부한다.
- URL query는 검사 전용 bounded percent/plus decoding 후 같은 credential·PII·instruction·malware 규칙을 적용한다. 원본 locator를 rewrite하지 않는다. 반복 encoding 한도를 넘는 모호한 입력은 fail-closed한다. 일반 URL, token 설명 문장, 기존 부정 instruction 문장은 허용한다.
- 동일 credential 규칙을 source body 검사에도 적용했다. body는 structured SECRET_LIKE_INPUT finding을 가진 QUARANTINED reference만 남기며 원문은 저장/반환하지 않는다.
- `D03-LOCATOR-WHITESPACE`: revision/document ID/path/symbol 등 metadata 문자열의 leading/trailing whitespace는 조용한 trim/rebinding 대신 `INVALID_SOURCE_INPUT`으로 거부한다. 기존 canonical commit 소문자 변환과 key/목록 순서 정규화는 유지한다.
- API 실패는 안전한 reason만 반환한다. 실패 후 storage/get은 없음 상태이며 같은 request ID로 정상 retry 가능함을 검증했다.
- 2026-09-16T08:53:24+09:00 seq955 양 lease ACTIVE·token/exact6·만료20:17:06 재확인. HEAD/branch/WI/prompt hash는 위 기준선과 동일하고 D-01/D-02 구현 hash도 유지했다.

### 조치·현재 검증

R1 수정 파일은 exact6 중 `packages/knowledge/sources.py`, `tests/knowledge/test_sources_d03.py`, `tests/api/test_learning_sources_d03.py`, 본 보고서 4개다. API 구현 및 __init__.py는 이번 R1에서 변경하지 않았다.

| 단계 | 정확한 명령 (cwd는 위 격리 경로) | exit / 실제 결과 |
|---|---|---|
| metadata/locator RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py -k r1 --tb=short` | 1 / 39 failed, 31 passed, 68 deselected, 1.39s |
| body 공통경계 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py -k common_credential --tb=short` | 1 / 1 failed, 117 deselected, 0.14s |
| 최종 focused GREEN | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py --tb=short` | 0 / 139 passed, 1.05s |
| 최종 전체 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 563 passed, 6.34s; skip 0 |
| compileall | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| whitespace | `git diff --check` | 0 / 출력 없음 |

R1 추가 RED는 40 test failures이며 token 공통 검사/경계 공백 두 원인에 대한 의도된 TDD 증거다. 최종 미해결 실패 0. 이전 완료보고가 리뷰를 대체하지 못했음을 기록하며 정식 실패 ledger·리뷰 횟수 판정은 Main 소유다.

미검증/잔여 위험은 위와 동일: 제한된 deterministic scanner이며 범용 secret/PII/악성코드 탐지나 실제 fetch/HTTP/DB/Run 제어를 증명하지 않는다. rollback은 Main이 R1 공통 검사와 R1 테스트/보고 추가만 역적용하되 최초 D-03 및 D-01/D-02 dirty를 보존한다. control/progress/Git mutation/외부 IO/권한 상승은 수행하지 않았다. 리뷰 수신·TDD·완료 전 검증 skill에 따라 재현→최소 수정→fresh 회귀 순서를 유지했다.

## R2 재작업 — credential key separator 정규성

### 판정

`COMPLETED` — 공백형 credential key 및 빈 값 오탐을 보완했다. focused 219 PASS, 관련 knowledge/API 643 PASS. Main 재검토/acceptance는 별도다.

### 판단 이유

- fingerprint `D03-CREDENTIAL-SPACED-KEY`: `api key`의 공백/탭과 encoded query를 기존 key regex가 누락했다. key 문법을 공통으로 두고 `api key`, `access token`, `client secret`, `refresh token`, `auth token`의 공백·탭·underscore·hyphen 및 대소문자를 동등하게 검사한다. 검사 전 bounded percent/plus decoding은 R1과 동일하다.
- 실제 값이 없는 assignment는 검사 전용 문자열에서만 제외한다. 원본을 변경하지 않고 정상 설명·bare key·빈 assignment·빈 따옴표/query value를 허용한다. 빈 assignment 뒤의 다른 실제 credential까지 제거하지 않는 회귀를 검증했다.
- metadata는 원문 없는 `SECRET_LIKE_INPUT`으로 capture/register 전에 거부한다. 본문은 동일 규칙으로 QUARANTINED/finding 처리한다. JSON 직렬화 전에 중첩 string 값도 검사하여 실제 탭이 `\\t`로 escape되어 우회되는 것을 차단한다. 본문 원문 저장·projection은 없다.
- API는 같은 safe reason/400과 저장 0을 반환하고 정상 retry는 허용한다. 기존 139개 focused와 D-01/D-02 회귀를 보존했다.
- 2026-09-16T09:01:07+09:00 seq955와 ACTIVE lease·만료20:17:06을 확인했다. execution/write token은 기존 epoch1과 동일하다. HEAD/branch 및 D-01/D-02 구현 hash는 위 기준선과 동일하다.

### 조치·현재 검증

R2 수정은 exact6 중 sources.py, domain/API 테스트 두 파일, 본 보고서만이다. D-01 memory.py/D-02 snapshots.py/API 구현/exports/control/Git는 변경하지 않았다.

| 단계 | 정확한 명령 (cwd는 위 격리 경로) | exit / 실제 결과 |
|---|---|---|
| R2 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py -k r2 --tb=no` | 1 / 최초20 failed, 46 passed, 138 deselected, 1.08s; body 빈값 보강 후22 failed, 55 passed, 138 deselected, 1.23s |
| 1차 GREEN | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py --tb=short` | 0 / 215 passed, 1.40s |
| nested body RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py -k nested_or_empty --tb=short` | 1 / 2 failed, 2 passed, 184 deselected, 0.19s |
| 최종 focused | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py --tb=short` | 0 / 219 passed, 1.23s |
| 전체 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 643 passed, 6.70s; skip 0 |
| compileall | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| whitespace | `git diff --check` | 0 / 출력 없음 |

R2 고유 재현 실패는 최종 RED 집합 22건 및 nested 2건이며 중간 재실행을 별도 정식 실패로 중복 계산하지 않는다. 최종 미해결 0. 공식 리뷰/실패 ledger는 Main 소유다.

미검증 경계는 변함없다: 실제 외부 IO/인증/Run 제어 및 범용 secret·malware 탐지를 주장하지 않는다. rollback은 Main이 R2 key 문법·빈값 처리·중첩 검사와 R2 tests/report 추가만 역적용하며 R1 및 기존 dirty를 보존한다. progress/HANDOFF/control/Git mutation/외부 IO/권한 상승 없음.

## R3 재작업 — structured mapping의 credential key/value 의미

### 판정

`COMPLETED` — structured body의 TAB credential key 누락과 의미상 빈 값 오탐을 수정했다. 최신 focused 638 PASS, knowledge/API 관련 회귀 1062 PASS. Main 독립 재검토는 별도다.

### 판단 이유

- fingerprint `D03-STRUCTURED-MAPPING-CREDENTIAL`: mapping의 key/value를 각각 검사하면 key 자체는 값 없는 credential 명칭이고 value는 단독 문자열이어서 결합 의미를 놓쳤다. canonical JSON은 TAB을 escape하여 기존 문자열 regex 재검사도 통과했다.
- mapping key는 기존 bounded decoding과 공통 separator/case key 문법으로 full-match하고, 실제 값의 존재 여부와 결합해 SECRET_LIKE_INPUT으로 판정한다. nested mapping/list의 모든 방문 깊이에 같은 검사를 적용한다. 과도한 재귀/invalid input은 기존 fail-closed 경계를 유지한다.
- JSON 직렬화 결과를 credential assignment 문자열로 재해석하지 않는다. 따라서 `null`, 빈 문자열(whitespace-only 포함), 빈 list/mapping은 credential 값으로 판단하지 않는다. `0`과 `false`는 명시적으로 제공된 값이므로 non-empty로 차단한다. 비어 있지 않은 collection도 보수적으로 non-empty다.
- body 등록/API 201은 자료의 quarantined reference 생성이며 activation 허용이 아니다. 악성 mapping body는 QUARANTINED/eligibility false/SECRET_LIKE_INPUT finding이고 create/get projection에 원문이 없다. 의미상 빈 값은 REGISTERED/eligible로 유지된다.
- 5 key 종류 × 6 separator × 3 case × 4 위치 = 360조합과 URL decode 1~4층, domain/API null/empty/0/false 의미를 검증했다. 기존 219 focused 및 관련 643 tests를 모두 보존했다.
- 2026-09-16T09:16:32+09:00 canonical seq955/ACTIVE epoch1 dual tokens/만료20:17:06 확인. HEAD/branch/WI/prompt/D-01/D-02 hash는 위 기준선 그대로다.

### 조치·현재 검증

R3 변경은 허용 exact6 중 sources.py, domain/API 테스트, 본 보고서 4개다. control/Git/외부 IO/권한 상승/다른 제품 파일 변경은 없다.

| 단계 | 정확한 명령 (cwd는 위 격리 경로) | exit / 실제 결과 |
|---|---|---|
| R3 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py -k r3 --tb=no --no-summary` | 1 / 81 failed, 339 passed, 218 deselected, 1.49s |
| focused GREEN | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_sources_d03.py tests/api/test_learning_sources_d03.py --tb=short` | 0 / 638 passed, 1.66s |
| 전체 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 1062 passed, 6.91s; skip 0 |
| compileall | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| whitespace | `git diff --check` | 0 / 출력 없음 |

R3 의도된 RED 81건, 최종 미해결 실패 0. 이는 재현 test count이며 공식 실패/리뷰 ledger는 Main 소유다. 위험·미검증은 이전과 동일한 제한적 scanner 및 in-memory host 경계다. 실제 IO/HTTP 인증/Run 제어는 수행하지 않았다. rollback은 Main이 R3 mapping key/value 판정과 직렬화 재검사 제거 및 R3 tests/report 추가만 검토 후 역적용한다. R2 이전 dirty·source/API·D-01/D-02·control은 보존한다.
