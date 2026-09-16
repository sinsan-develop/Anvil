# D-01 완료보고

## 1. 판정

- 결과 계약: `COMPLETED` — Developer 구현·기본 검증 완료 주장. Main 독립 검토/ACCEPTED와 구분한다.
- 담당: `developer-primary-d01-r1`, 검증 ID `AV-LRN-001`.
- R2 최종 집중 검증: **208 passed**, exit 0. 관련 `knowledge + api` 회귀: **373 passed**, exit 0. 최초 73/238 및 R1 100/265 결과는 아래 역사 증거로 보존한다.
- compileall 및 diff whitespace 검사 통과. Git stage/commit/push, 외부 IO, Main 통제 파일 변경 없음.
- D-02 미착수. 본 보고서는 제품 전체 완료·HTTP/DB/운영 검증·학습 activation 승인 주장이 아니다.

## 2. 판단 이유

### 기준선과 쓰기 경계

- 최초 정본: `D:\tmp\anvil-main-integration`.
- 실제 구현·검증 위치: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`.
- Main이 원본 dirty 49개 SHA256 일치/seq937 checker PASS를 확인하고 위 격리 clone으로 작업 경로를 재지정했다. 원본 worktree는 보존했고 제품 파일을 쓰지 않았다.
- 시작/종료 branch: `codex/c09-execution-backends-r1`.
- 시작/종료 HEAD: `a3fa3ed09cd6998b234458b5283abafa0f222f88`.
- 시작 상태: C-13~C-15 기존 제품·보고 및 Main progress/control dirty/untracked 보호. D-01 exact6은 모두 신규 경로이며 기존 자료를 덮어쓰지 않았다.
- 시작 seq937: C Gate ACCEPTED / DIR-2 CLEARED, D-01 epoch1 worker/write ACTIVE. 06:44:26 KST 새 경로에서 재확인.
- worker lease: `worker-lease-d01-r1-20260916-001`.
- execution fence: `d01-r1-execution-fence-epoch-1-a3fa3ed09cd6998b`.
- write lease: `write-lease-d01-r1-20260916-001`.
- write fence: `d01-r1-write-fence-epoch-1-234458b5283abafa`.
- 발효/만료: `2026-09-16T06:35:00+09:00` / `2026-09-16T18:35:00+09:00`.

기준 문서 SHA256(직접 확인):

| 문서 | SHA256 |
|---|---|
| Anvil_설계서_v2.md | DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3 |
| Anvil_작업계획서_v1.md | 00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18 |
| Anvil_통합검증매트릭스_v1.md | 289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5 |
| Anvil_테스트계획서_v1.md | 9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644 |
| D-01_WORK_INSTRUCTION.md | 91F655D13342B8C2BEF55DC346E24201A9FB7239707614F9900B24E016FE1AC6 |
| D-01_INVOCATION_PROMPT.md | FB8DB49A70A6C7F6D30705E99013CB08A36DE930642B2929E3D3226D08EC6B49 |

직접 읽은 구현 근거: 설계 12(출처), 36.1~36.7(계층·scope·항목·용량·쓰기), 49.9(8단계 priority), 48 운영 책임; 작업계획 D-01; 매트릭스 AV-LRN-001; 테스트계획 Phase D 조용한 학습/승인 경계; AGENTS·PMO AGENTS·governance·developer definition·현재 WI/prompt/progress/HANDOFF. 과거 문서의 초기 상태는 현재 seq937 successor를 대체하지 않는다.

### 구현/검증 대응

| 계약 | 구현 및 관측 |
|---|---|
| USER/MEMORY 및 user/project 분리 | 종류별 별도 dictionary와 `(user_id, scope, project_id)` partition. 다른 사용자/프로젝트/종류 및 project source의 global 혼입 거부 |
| provenance와 version | source의 7개 필드, evidence type/ref, confidence/category/status, aware UTC 시각, version/previous_hash/content_hash. canonical JSON string tuple journal에 새 version만 append |
| 조회 유효성 | 현재 latest ACTIVE만 조회; 생성 전/만료 경계 제외. 비활성·폐기 latest 뒤 과거 ACTIVE를 되살리지 않음. history는 별도 host 감사 조회 |
| instruction priority | CURRENT_USER → DESIGN_BASELINE → WORK_PLAN → WORK_INSTRUCTION → PROJECT_POLICY → AGENT_DEFINITION → SKILL_HOOK_PROMPT → MEMORY_CODE_EXAMPLE. 인접 7쌍과 전체 역순 입력 검증 |
| 충돌 | host-normalized instruction_key의 값 충돌 시 Memory 미적용, LearningConflict append. 동순위 모순은 INSTRUCTION_AMBIGUITY로 해당 key 적용 금지. 문서/지시를 변경하는 기능 없음 |
| 결정성 | entry canonical SHA256; context hash는 scope/kind/시각/정렬된 전체 instruction 입력과 결과를 결박. 같은 입력 재실행·역순 입력 hash 동일 |
| capacity | `estimate_tokens(statement) = ceil(UTF-8 bytes / 4)`를 각 statement별 계산 후 합산. USER 500 / MEMORY 800. exact limit 허용/+1 거부, current/added/limit/total 반환. version의 현재 replacement 계산 및 만료 비용 제외, 과거 version은 보존 |
| 입력 안전성 | 빈값/enum/scope/evidence/source/time 거부; source_type 제한; model_summary는 unverified로만 저장하고 context에 미적용. 비밀 형태 및 명백한 지시 무시 문구(영문/한국어) 거부. 오류에는 reason/count만 반환 |
| proposal과 curated write | propose는 PENDING_REVIEW projection만 반환하고 저장/활성화하지 않음. add/version은 host가 이미 curated한 자료를 전달하는 경계. API의 curated_write는 생성 시 host가 부여하고 payload는 이를 부여할 수 없음 |
| API shape | propose/add/version/get/list/resolve-context/conflicts/capacity; scope를 adapter 생성 때 고정. version expected_hash, repository+scope 단위 request replay journal. append와 replay 예약은 같은 host lock 아래 실행 |
| projection 격리 | 저장은 immutable canonical 문자열, 응답은 매번 재구성한 frozen DTO/읽기전용 mapping 또는 detached JSON. 강제 object.__setattr__와 nested input/output mutation이 저장 내용을 바꾸지 않음 |

## 3. 조치와 증거

### 변경 파일 — exact6

| 경로 | 변경 전 → 변경 후 |
|---|---|
| packages/knowledge/__init__.py | 없음 → D-01 계약 타입/저장소/estimator export |
| packages/knowledge/memory.py | 없음 → curated repository, schema/time/scope/secret 검증, capacity/version/priority/conflict/immutable projection |
| packages/api/knowledge_memory.py | 없음 → scope-bound in-process API adapter, 안전 오류·request replay |
| tests/knowledge/test_memory_d01.py | 없음 → provenance/scope/time/capacity/priority/적대·mutation 회귀 |
| tests/api/test_knowledge_memory_d01.py | 없음 → API 정상/replay/malformed/scope/capability/projection 회귀 |
| docs/04_test_reports/D-01_COMPLETION_REPORT.md | 없음 → 본 보고서 |

최초 구현(R1 이전) 제품 3개 SHA256:

- memory.py: `AA8FED337BC6D42176605CF76799405D2F2EC4B3B069558AB36E4A978AA604BE`
- knowledge/__init__.py: `BD16E2B7C813374F0CD4E2FC861B4BBBFD2336AB403B7F5722087FC1C9920292`
- knowledge_memory.py: `64F07C7DC9FD19B4934C76E041D4FCE96DB01057A2C21D6A872E4866C28A1C84`

### 최초 구현(R1 이전) 정확한 실행 명령·exit·결과

명령 작업 디렉터리는 위 새 격리 clone이다. 실행 Python은 기존 venv의 Python 3.13.9이며 설치/환경 변경은 하지 않았다.

| 단계 | 명령 | exit / 실제 결과 |
|---|---|---|
| 환경 확인 | `python -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py tests/api/test_knowledge_memory_d01.py --tb=short` | 1 / PATH에 python 없음, 테스트 미실행 |
| 최초 interface RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py tests/api/test_knowledge_memory_d01.py --tb=short` | 1 / 47 setup errors, 두 신규 module 없음. 2.89s. behavior RED와 구분 |
| 명시 stub RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py::test_hash_provenance_and_no_input_output_alias --tb=short` | 1 / 1 failed, D01_CURATED_ADD_NOT_IMPLEMENTED, 0.15s |
| 1차 GREEN | 위 두 focused 파일 `--tb=short` 명령 | 0 / 47 passed, 1.15s |
| 경계 RED | 위 두 focused 파일 `--tb=short` 명령 | 1 / 4 failed, 66 passed, 1.01s |
| 경계 GREEN | 위 두 focused 파일 `--tb=short` 명령 | 0 / 70 passed, 1.12s |
| scan/source RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py -k 'instruction_override or self_label' --tb=short` | 1 / 3 failed, 53 deselected, 0.17s |
| 최종 집중 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py tests/api/test_knowledge_memory_d01.py --disable-warnings -ra` | 0 / 73 passed, 1.13s |
| 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 238 passed, 8.28s |
| 컴파일 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| tracked diff | `git diff --check` | 0 / 출력 없음 |
| 신규 파일 whitespace | `git diff --no-index --check -- NUL <각 exact6 경로>` | 각 1 / 신규 파일과 NUL의 내용 차이 exit, whitespace 진단 출력은 0건. tracked diff-check exit 0과 구분 |

`compileall`의 생성 bytecode는 검증 부산물이며 제품 source 변경이 아니다. 테스트 cacheprovider와 일반 Python bytecode write는 비활성화했다. 별도 DB/서버/컨테이너/네트워크 자원 생성 없음.

### 오류 fingerprint와 횟수

- `D01_LEASE_NOT_YET_EFFECTIVE`: 최초 06:31:59~06:34:23에 제품 write 0으로 BLOCKED; 06:35 이후 Main 재지시로 해소. 정식 실패 0.
- `D01_CANONICAL_SANDBOX_PARENT_CREATE_DENIED`: 원본 D:\tmp에서 첫 apply_patch가 부모 디렉터리 생성 실패. 두 test 파일 존재하지 않음 확인. require_escalated를 호출하지 않았으며 Main 지정 격리 clone에서 동일 scope 재개. 정식 실패 0.
- `PYTHON_PATH_NOT_FOUND`: 1회, 기존 venv absolute 실행 파일로 해결. 정식 실패 0.
- TDD 의도된 실패: module missing 47 setup errors, stub 1 failure, scope-hash/source-enum/expiry/replay 4 failures, override/model-summary 3 failures. 각 cycle 내 결함 재현·보완이며 유효 FAILURE_REPORT 3회 인수 횟수로 세지 않는다.
- 최종 focused/related 실패·skip: 0. read-only git status의 사용자 전역 ignore 접근 경고는 Git 관측 환경 경고이며 테스트 실패가 아니다.
- 기존 C-01 OpenAPI snapshot 실패 1 / DB skip 8은 이 D-01 suite에 포함하지 않았다. 기존 baseline의 해소·재검증으로 주장하지 않는다.

### 미검증·잔여 위험

- 실제 HTTP/DB/파일 persistence/브라우저/Provider/network/WSL/Docker/deployment: 모두 **NOT_EXECUTED**. API 증거는 in-process request/response뿐이다. 기존 ASGI 관련 회귀도 TestClient/in-memory/fake session 증거다.
- 승인 lifecycle, source revocation 전파, Task/Session frozen snapshot 및 실제 activation은 D-02/D-03/D-06 등 후속 Package 소유. 본 저장소가 HTTP 인증이나 사람 승인 서비스를 대신하지 않는다.
- host만 scope·curated_write·instruction chain을 구성해야 한다. API를 그대로 비신뢰 transport에 노출하면 안 된다. source ref는 스키마/계보 참조일 뿐 외부 artifact 실제 존재를 검증하지 않는다.
- 충돌 판정은 host-normalized structured key와 값의 결정론적 비교다. 임의 자연어 의미 동등성/모순을 완전히 판별한다는 주장이 아니다. regex scanner 역시 모든 비밀/PII/교묘한 prompt injection을 검출한다는 주장이 아니다. host curated review를 대체하지 않는다.
- token-equivalent는 고정 UTF-8 estimator이며 실제 모델 tokenizer가 아니다. capacity는 각 kind/scope에서 context로 주입할 statements에 적용하고 history/provenance 저장량 제한은 아니다.
- 저장소 수명은 프로세스 내이며 crash durability, 분산 동시성, persistent replay 보호는 미검증. 반환 snapshot을 강제로 변조해도 내부 저장소와 기존 snapshot은 독립이지만 호출자 자신이 변조한 DTO를 그대로 신뢰해서는 안 된다.

### rollback·인계

- 본 작업은 미커밋 신규 exact6만 추가했다. Main이 먼저 이 six-file 후보를 보존한 뒤 해당 신규 파일만 제외하면 시작 상태로 복구할 수 있다. reset/clean/stash/광역 삭제 금지, 기존 dirty 49개 보존.
- 원본 D:\tmp와 격리 clone 간 제품 반영·Git 작업은 Main 소유이며 수행하지 않았다.
- progress/HANDOFF/events/checker/WI/prompt는 **Main 소유·미갱신**. 본 보고와 테스트 결과를 Main 독립 검토에 인계하며 D-02는 시작하지 않는다.

## 4. R1 독립 리뷰 재작업 — 2026-09-16

### 판정

- `COMPLETED`: Blocking 2건을 RED로 재현하고 scanner를 최소 보완했다. R1 신규 27개 포함 집중 100 PASS, 관련 회귀 265 PASS. Main 재검토 대상이며 자동 ACCEPTED가 아니다.
- 07:05:28 KST에 동일 seq937 epoch1 worker/write와 18:35 KST 만료를 직접 재확인했다. 작업 경로·HEAD·branch·기준 문서·lease token·exact6은 변경하지 않았다.

### 판단 이유

- `D01-R1-URI-USERINFO`: 기존 `_SECRET`는 key=value·Bearer·일부 key prefix만 검사하여 URI authority의 credential user-info를 놓쳤다. DB scheme, 대문자 HTTPS/percent-encoded user-info, username-only SFTP와 statement/source/evidence 경로에서 9개 직접 거부 실패 및 API version 거부 실패 1개를 재현했다.
- `_URI_AUTHORITY`를 통해 scheme 또는 scheme-relative authority 안의 `@`를 검사한다. credential 값·사용자 이름은 반환하지 않고 `SECRET_LIKE_INPUT`만 반환한다. URL path/query의 `@`는 authority가 아니므로 허용한다. 일반 HTTPS·credential 없는 DB URI 등 정상 URL 4개도 검증했다. 네트워크 요청·URI 대상 접속은 없다.
- `D01-R1-OVERRIDE-VOCABULARY`: 기존 injection regex는 `instructions`·한국어 `지시` 및 제한된 관사만 검사했다. system prompt / prior directives / 한국어 시스템 프롬프트 / higher priority rules가 통과했고, 기존 `Never ignore prior instructions`는 오탐이었다.
- override 동사와 상위 지시 대상을 명시적으로 결합하는 패턴에 prompt/directive/rule·관사·한국어 프롬프트/규칙을 추가했다. 직접 부정 지시(do not/don't/never, 무시하지 마/말/않)는 제외하여 정상 문장 오탐을 줄인다. 전체 문장의 각 일치를 검사하며 일반 자연어 의미 판별기로 주장하지 않는다.
- repository propose/add와 API add/version에서 거부되며 history/current context에 신규 항목이 들어가지 않고, 실패 version 뒤 기존 hash/전체 projection이 유지된다. 오류 payload는 정확한 reason과 빈 details만 가진다.

### 조치·검증

R1에서 실제 변경한 경로는 exact6 중 다음 4개다. 나머지 2개 및 기존 보호 dirty는 변경하지 않았다.

- `packages/knowledge/memory.py`: URI authority scan과 injection 어휘/부정문 처리.
- `tests/knowledge/test_memory_d01.py`: URI 9개 적대 + 4개 정상, override 4개 적대 + 6개 정상/부정문.
- `tests/api/test_knowledge_memory_d01.py`: credential version 무변경·redaction 1개 및 injection add/context 거부 3개.
- `docs/04_test_reports/D-01_COMPLETION_REPORT.md`: R1 증거 append와 현재 판정 요약 갱신.

| 단계 | 정확한 명령 | exit / 결과 |
|---|---|---|
| URI RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py tests/api/test_knowledge_memory_d01.py -k r1 --tb=short` | 1 / 10 failed, 4 passed, 73 deselected, 1.08s |
| URI GREEN | 위 동일 명령 | 0 / 14 passed, 73 deselected, 1.01s |
| injection RED | 위 동일 명령(추가 tests 포함) | 1 / 8 failed, 19 passed, 73 deselected, 1.20s |
| R1 GREEN | 위 동일 명령 | 0 / 27 passed, 73 deselected, 0.94s |
| 최종 집중 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py tests/api/test_knowledge_memory_d01.py --disable-warnings -ra` | 0 / 100 passed, 0.99s |
| 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 265 passed, 6.04s |
| 컴파일 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| tracked diff | `git diff --check` | 0 / 출력 없음 |
| 신규 exact6 | `git diff --no-index --check -- NUL <각 exact6 경로>` | 각 1 / 신규 내용 차이, whitespace 진단 0건 |

R1 최종 SHA256:

- memory.py: `4517DDDAE0F591C5B601B06FFD56E288C07508338C2B248AAB77DD11ADC63790`
- test_memory_d01.py: `717B2A82179290D358C1E4348573AB02F95CC3A845454A72E464F95223BB15B0`
- test_knowledge_memory_d01.py: `47E2F730D4635155E74FDABC7E64AE220B8EF192E49707E1312DD8F08996C3C3`

재작업 횟수 1회, 독립 리뷰 blocking fingerprint 2개. 위 RED는 의도된 재현이며 유효 FAILURE_REPORT 3회 집계와 구분한다. 최종 focused/related 실패·skip은 0이다.

미검증/잔여 위험/rollback은 3절과 동일하다. 실제 credential을 사용하지 않은 synthetic fixture이며 외부 IO·승인 UI·require_escalated·Git mutation·통제 파일 변경 모두 0. regex 기반 유한 탐지가 모든 인코딩·자연어 jailbreak·PII를 보장하지 않으므로 host curated review 경계를 유지한다. R1을 되돌리려면 Main이 현재 후보를 먼저 보존한 뒤 위 scanner/test/report 변경만 복구하며, 기존 exact6 초안과 원본 보호 dirty를 광역 reset/삭제하지 않는다.

## 5. R2 독립 리뷰 재작업 — 2026-09-16

### 판정

- `COMPLETED`: R2 신규 108개 포함 focused **208 passed**, 관련 **373 passed**. 컴파일 exit 0, tracked diff-check exit 0. Main 재검토/ACCEPTED와 구분한다.
- 07:17:34 KST 직접 확인: 동일 seq937 execution/write fence, 양 lease 18:35 KST 만료. HEAD `a3fa3ed09cd6998b234458b5283abafa0f222f88`, branch·격리 작업 경로·exact6·기준 문서 변경 없음.

### 판단 이유

- `D01-R2-OVERRIDE-SUBJECT-OBJECT-NEGATION`: R1 exact phrase regex가 system message / earlier instructions / 한국어 시스템 메시지를 놓쳤고, `should not` 및 `not ever` 같은 정상 부정을 오탐했다.
- 최초 R2 재현에서 **10 failed / 8 passed**를 관측했다. subject 6 × object 5 × override 동사 3의 90개 교차조합을 추가해 각 조합의 긍정 차단·`should not ever` 부정 허용을 함께 검증했으며 구현 전 **100 failed / 8 passed**였다.
- 특정 문자열 예외를 추가하는 방식을 끝내고 영문을 lexical class로 정규화한다. previous/prior/earlier/system/higher/developer → SUBJECT, instruction/directive/rule/prompt/message 및 복수형 → OBJECT, ignore/disregard/override → OVERRIDE, not/never/부정 축약형 → NEGATION, 관사와 부사도 별도 class다.
- `OVERRIDE [관사] SUBJECT [priority] OBJECT` 구조를 찾은 뒤 동사 직전 부사만 건너뛰어 부정 범위를 판정한다. 접속사·구두점·다른 동사를 건너 부정이 전파되지 않는다. `not only`는 단순 부정으로 취급하지 않는다.
- 한국어는 이전/과거/상위/시스템/개발자 대상과 지시사항/지시/지침/규칙/프롬프트/메시지를 target class로 인식하고 무시 동사의 바로 뒤 `-지 않/-지 말/-지 마` 어미를 판정한다. 모든 target/동사를 별도로 확인하므로 부정절 뒤 실제 override 절이 있으면 차단된다.
- repository propose/add에서 차단 입력은 history와 context에 남지 않는다. API는 정확히 `MEMORY_INSTRUCTION_INJECTION` + 빈 details만 반환하고 입력 값을 노출하지 않는다. 정상 부정문과 기존 URI·R1 테스트는 회귀 통과했다.

### 조치·검증

R2 변경은 R1과 같은 exact6 내 4개(`memory.py`, 두 D-01 test, 본 보고)다. 새로운 dependency, 다른 제품 경로, 통제 파일을 변경하지 않았다.

| 단계 | 정확한 명령 | exit / 실제 결과 |
|---|---|---|
| R2 최초 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py tests/api/test_knowledge_memory_d01.py -k r2 --tb=short` | 1 / 10 failed, 8 passed, 100 deselected, 1.21s |
| 교차조합 RED | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py tests/api/test_knowledge_memory_d01.py -k r2 --tb=no` | 1 / 100 failed, 8 passed, 100 deselected, 1.12s |
| R2 GREEN | 위 최초 RED와 같은 `-k r2 --tb=short` 명령 | 0 / 108 passed, 100 deselected, 1.12s |
| 최종 집중 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge/test_memory_d01.py tests/api/test_knowledge_memory_d01.py --disable-warnings -ra` | 0 / 208 passed, 1.19s |
| 관련 회귀 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/knowledge tests/api --disable-warnings -ra` | 0 / 373 passed, 6.38s |
| 컴파일 | `& D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m compileall -q packages/knowledge packages/api tests/knowledge tests/api` | 0 / 출력 없음 |
| tracked diff | `git diff --check` | 0 / 출력 없음 |
| 신규 exact6 | `git diff --no-index --check -- NUL <각 exact6 경로>` | 각 1 / 신규 내용 차이, whitespace 진단 0건 |

R2 최종 SHA256:

- memory.py: `D730F3FC46BA374895B87C03580C346772D095C039BD3690094891D53483D1F7`
- test_memory_d01.py: `9192BEA220BD5D2067074BF9644CA2149EA3AB880B9070C23C9142FB3307AE49`
- test_knowledge_memory_d01.py: `5C3E2BA90A0E6EBF67E91652CBF381AFC400E9AF2B8571B2CDF39DB5A96E6639`

재작업 총 2회. R2 RED들은 하나의 원인에 대한 의도된 재현/교차조합 검증이며 유효 FAILURE_REPORT 3회 인수 선언이 아니다. 현재 focused/related 실패·skip 0. 보고서의 이전 시행 결과는 삭제하지 않았다.

잔여 위험: finite grammar는 지정 어휘·동사구의 결정론적 방어이며 모든 자연어 간접 명령·다국어·난독화·인코딩을 해결하는 semantic classifier가 아니다. 부정 범위를 좁게 다루므로 host curated review가 여전히 필요하다. 실제 HTTP/DB/Provider/네트워크/배포는 미실행이며 기존 C-01 baseline 실패/DB skip을 해소했다는 주장이 아니다.

rollback은 Main이 현재 exact6 후보를 보존한 뒤 R2 scanner/추가 test/report diff만 별도로 되돌리는 방식이며 광역 reset/clean/삭제는 하지 않는다. 원본 D:\tmp worktree·기존 dirty·progress/HANDOFF는 그대로 보존했다. require_escalated/승인 UI/Git mutation/control write/외부 IO 0. D-02 미착수.
