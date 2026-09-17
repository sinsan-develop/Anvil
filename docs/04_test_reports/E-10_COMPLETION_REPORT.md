# E-10 완료보고 — developer-primary-e10-r1

## 판정

`COMPLETED` — review round2 보완 구현/지정 fresh 검증 완료. Developer 증거이며 Main acceptance가 아니다. formal FAILURE_REPORT 0, 독립 review rework round2. 의도된 RED와 도구 진단 오류는 formal failure가 아니다.

## 판단 이유

- 기준 HEAD `30ca8a2d5a8f856ee4d82ae4f47b47bc60109342`, branch `codex/c09-execution-backends-r1`; 시작 상태는 Main 소유 control9 dirty, 제품 경로는 신규였다. 원래 dirty를 보존했고 stage/commit/push 0.
- WI `WI-E-10-R1-20260917-001` SHA256 `C1BE07185E99335FB9A976CCC667753A7D2C73089DABF6BF7F55051359B10138`; invocation SHA256 `773059897C676F06A927BE5CBC8937B0ED8AF2ADF7211606A09C585DE9CF3A4D`.
- canonical sequence1160; worker `worker-lease-e10-r1-20260917-001`, execution `e10-r1-execution-fence-epoch-1-30ca8a2d5a8f856e`; write `write-lease-e10-r1-20260917-001`, write token `e10-r1-write-fence-epoch-1-e4d82ae4f47b47bc`. 두 lease ACTIVE, 기간 `2026-09-17T23:47:51+09:00`~`2026-09-18T11:47:51+09:00`, host 확인 `2026-09-18T00:13:26+09:00`.
- strict builtin/bounded detached input, host 등록 current repository/grant, exact baseline/ref/status/scope/hash, synthetic driver 결과 검증, append-only hash-linked audit, idempotency/concurrency와 실패 publication0을 구현했다.
- 기존 `GitCommand` DTO와 canonical_hash를 재사용했다. MERGE/PR은 실제 E09 `ReleaseGateService.project/admit` public owner와 exact bundle/approval handle을 소비하며 approval boolean을 재구현하지 않았다. exact replay에도 current release 권위를 재확인한다.
- 사용자 dirty/untracked/index는 보존하며 commit은 exact host-owned approved index/content inventory만 허용한다. source/target/ref/parent/tree/delivered hash drift, protected path, destructive/history rewrite, 임의 argv/shell, stale fence, callback revoke, Unicode credential 변형은 fail-closed다.

## 조치 / 변경 exact5

| 경로 | 변경 |
|---|---|
| packages/git_adapter/__init__.py | 공개 contract export 4개 |
| packages/git_adapter/models.py | strict values/identity/hash/path/ref/time/request/snapshot 및 opaque grant |
| packages/git_adapter/service.py | host registry, fake driver, branch/commit/merge/PR plan, E09 admission, atomic simulated publication/audit |
| tests/git_adapter/test_git_adapter_e10.py | 초기118개 + R1 34개 + R2 21개 = 현재173개 집중/적대 테스트 |
| docs/04_test_reports/E-10_COMPLETION_REPORT.md | 본 보고서 |

제품 전체가 신규 파일이므로 diff는 각 exact 경로의 전체 내용이다. control9는 수정하지 않았다. 현재 stage0. progress/HANDOFF는 Main 소유로 미갱신.

### RED → GREEN

동일 focused 명령(아래 F)을 순차 실행했다.

1. initial module absent RED: exit1, 13 failed/0.47s → 최소 branch/commit GREEN exit0, 13 passed/0.51s.
2. E09 public owner constructor integration RED: exit1, 4 failed/21 passed/0.70s → GREEN exit0, 25 passed/0.67s.
3. branch target/expected commit, swallowed reentry, merge path scope, audit publication RED: exit1, 5 failed/82 passed/0.99s → 첫 수정에서 reason code expectation 1 failed/86 passed/1.06s, 원인 코드 정합 보완.
4. revoked release replay, Unicode/encoded secret, authorization publication RED: exit1, 5 failed/89 passed/0.97s → GREEN exit0, 94 passed/1.01s.
5. 전 request field callback0, input/output alias, callback repository/fence drift, driver exception 비노출 추가. driver error mapping RED exit1, 1 failed/117 passed/1.26s → GREEN exit0, **118 passed/1.05s**.

도구 진단: 존재하지 않는 구현 후보 경로 조회 및 Select-Object 인자 오타는 read-only 탐색 오류이며 수정 후 계속했다. Git global ignore 접근 경고는 환경 경계이며 명령 exit0. 제품 formal failure 0.

### 초기 구현 정확한 실행 명령 / 결과 (review round1 이전 기록)

cwd는 `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`, interpreter는 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`다.

F: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/git_adapter/test_git_adapter_e10.py --tb=short`

- 최종 exit0, **118 passed in 1.05s**, skip0.

R: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/git_adapter tests/execution_backends tests/repository_intelligence tests/verification --basetemp=D:/Project/Anvil/.codex-sandbox/e10-regression-20260918-r1 --tb=short`

- exit0, **556 passed, 8 skipped in 237.89s (0:03:57)**. 시작 당시 E10 94개를 수집했으며 이후 추가된 E10 24개는 최종 focused로 별도 검증했다. 관련 기존 owner 코드 변경은 없다.
- skip 사유 재확인 명령: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_c01_l3_independent_acceptance.py -rs --tb=short` → exit0, **1 passed, 8 skipped in 1.01s**. skip8은 `ANVIL_TEST_DATABASE_URL is not set`; 실제 DB 검증 PASS가 아니다.

C: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py -k E10StartControlTests --tb=short`

- exit0, **2 passed, 661 deselected in 10.58s**.

P: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py`

- exit0, `PASS sequence=1160 reporting=AUTO_CONTINUE`.

S: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/git_adapter/__init__.py','packages/git_adapter/models.py','packages/git_adapter/service.py','tests/git_adapter/test_git_adapter_e10.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE PASS 4; pycache writes 0')"`

- exit0, COMPILE PASS 4, pycache write0. 승인 WI의 builtin compile 방식.

`git diff --check`: exit0. `git diff --cached --name-only`: exit0/empty. 보고서 추가 후 canonical checker 재실행도 seq1160 PASS. `git status --porcelain=v1 --untracked-files=all`은 control9+product5 **exact14**, scope escape0이다.

### Validation ID / 경계

| ID | 증거 |
|---|---|
| AV-SAFE-015 | forbidden operation6/argv16, aliases/path/ref, user overlap/index smuggling, scope/state/fence/hash drift, callback0/alias0, reentry/100 concurrent attempts |
| AV-GATE-020 | real E09 owner bundle/admission subject, exact source/target/delivered hash, revoked release 재사용 거부 |
| AV-GATE-025 | driver parent/commit/tree/ref/status/artifact evidence와 승인 subject exact 비교, mismatch publication0 |

위 PASS는 **FAKE_DRIVER_CONTRACT / external_side_effects=0**다. 실제 branch/commit/merge/push/PR, subprocess, filesystem mutation, provider/remote/network/HTTP/API/UI/DB/production은 E10에서 NOT_EXECUTED. 기존 backend 회귀의 임시 로컬 Git 실행은 기존 owner 검증이며 E10 실제 driver 통합 증거가 아니다. physical_identity/owned_changes는 trusted host fixture capture이며 실제 physical path resolver/OS capture 및 durable multi-process registry/send-once/crash recovery는 NOT_INTEGRATED. 실제 remote 인증/권한/secret manager 검증을 주장하지 않는다.

### 제품 SHA256

- `packages/git_adapter/__init__.py`: `ACA315A3F72E1EB4DB6AA948CE083564B2BA89EA1A175AC163D74A535B7745A4`
- `packages/git_adapter/models.py`: `5430AA20A5FDB6DF14600EBD986DAF7366C5E664B9CD837A7983E776D28EBA9B`
- `packages/git_adapter/service.py`: `B9CC125F7538B2EDB6E1E747E835C9DF9612E309D22DD58E0BDABD31ABBBB6A8`
- `tests/git_adapter/test_git_adapter_e10.py`: `FCD7CCB4B9E68AEB7BC272B5E28F1CA0A43115636A71FE1F514F13D6913B5421`
- 본 보고서 SHA는 self-reference 없이 최종 결과 메시지에 제공한다.

### 잔여 위험 / rollback

합성 host capability의 자체 호출 권한은 실제 인증/원격 adapter 연결을 대신하지 않는다. 실제 execution 연결 전 E09 current admission, OS identity, native Git 결과/부작용 원자성, provider credential/remote policy를 host owner가 검증해야 한다. 외부 실행 없이 fake 통과만으로 production admission을 만들지 않는다.

rollback은 Main이 이 신규 exact5만 검토해 되돌리는 방식이며 control9/user dirty는 보존한다. Developer는 삭제/reset/stash/commit/push를 수행하지 않았다. 관련 회귀 임시 자료는 명시한 workspace-local basetemp에 한정되며 운영 저장소/원격 자료가 아니다. 해당 디렉터리 child133개를 read-only 확인하고 보존했다(잔여0/cleanup 완료를 주장하지 않음). 운영 프로세스/remote/DB/container를 생성하지 않았다. 다음 조치는 Main 독립 spec/quality 검토이며 Developer는 acceptance/후속 E11을 시작하지 않는다.

## Review round1 — Important5 재현과 보완

formal FAILURE_REPORT **0** 유지. 독립 review rework **round1**이며 동일 근본 원인 정식 실패 보고로 계산하지 않는다. receiving-code-review/TDD 절차로 각 재현을 먼저 실행했다.

| Finding | RED/원인 | 보완 |
|---|---|---|
| short/full ref alias | `refs/heads/main`, conflicting short/full OID 등록 허용 | 모든 ref 경계에서 case-folded `refs`/`refs/` namespace 거부, canonical short branch ref만 허용. 기존 Unicode/path/case 방어 유지 |
| credential audit 유입 | bearer/token/PEM header 일반·전각·percent·zero-width 변형 허용 | bounded normalization/decoding 검사에 Authorization Bearer, token assignment, private-key PEM header 추가. 실제 credential0, synthetic marker만 사용하며 원문은 error/audit/driver에 없음 |
| 누적 audit 조회 실패 | branch70/event140에서 aggregate input bound 초과 | append-only 원본 유지; `audit()` 기본 최신20 이내, `after_sequence`/`through_sequence`/`limit` cursor paging. limit1~100 및 serialized UTF-8 262144 bytes 상한. snapshot 끝 sequence를 고정하면 append 중에도 기존 page/hash 안정 |
| 반환 release_admission alias | MERGE/PR 반환값 변조가 grant seal을 손상 | stored receipt와 반환 receipt를 publication 전에 각각 별도 detached capture. 반환 nested admission 변조 뒤 내부 grant/receipt/audit 불변, exact replay 동일 |
| impossible commit identity | expected commit이 baseline/source/target여도 허용 | COMMIT/no-ff MERGE 신규 commit은 세 identity와 달라야 하며 authorize 이전 request 검사에서 `IMPOSSIBLE_COMMIT_IDENTITY` 거부 |

### R1 정확한 명령 / 결과

1. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/git_adapter/test_git_adapter_e10.py -k r1_ --tb=short`
   - RED exit1, **21 failed, 118 deselected in 1.65s**. 다섯 finding 모두 실제 assertion failure로 확인했다.
2. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/git_adapter/test_git_adapter_e10.py --tb=short`
   - 최소 GREEN exit0, **139 passed in 2.74s**.
   - page cursor/대형 event/credential 변형 회귀를 추가한 첫 실행은 test fixture의 trailing whitespace가 기존 text 계약에 거부되어 exit1 **1 failed/151 passed in 2.74s**. 구현 변경 없이 fixture trim으로 정정했다(제품 failure 아님).
   - 최종 focused exit0, **152 passed in 4.15s**. 큰 event를 포함한 모든 sequence 조회, wire byte bound, alias 분리 검증.
3. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py tests/verification/test_gates_c14.py --tb=short`
   - exit0, **358 passed in 2.30s**.
4. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/git_adapter tests/execution_backends tests/repository_intelligence tests/verification --basetemp=D:/Project/Anvil/.codex-sandbox/e10-review-r1-20260918 --tb=short -rs`
   - exit0, **601 passed, 8 skipped in 243.48s (0:04:03)**. skip8은 C01 `ANVIL_TEST_DATABASE_URL is not set` 경계다. E10 139개 collection 후 추가13개는 최종 focused로 검증. 기존 related owner 파일 변경0. 전용 basetemp의 테스트 잔여 자료는 보존하며 cleanup0을 PASS로 주장하지 않는다.
5. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py -k E10StartControlTests --tb=short`
   - exit0, **2 passed, 661 deselected in 10.35s**.
6. 위 S builtin compile4를 최종 test 수정 후 재실행: exit0, COMPILE PASS4/pycache0. 위 P checker: exit0, **sequence1160 AUTO_CONTINUE PASS**. `git diff --check` exit0, `git diff --cached --name-only` exit0/empty.

실제 E10 Git/remote/filesystem mutation0, control9 변경0. 실제 운영·원격·DB·provider 및 durable/multiprocess 경계는 이전과 동일한 NOT_EXECUTED/NOT_INTEGRATED다. audit 기본값은 최신 bounded suffix이며 전체 이력을 원하는 소비자는 명시적 cursor로 조회해야 한다. 본 API는 E10 내부 신규 계약이며 기존 audit()의 list 반환/최신 denial 확인을 보존한다.

## Review round2 — Authorization scheme 누락 보완

판정 `COMPLETED`, formal FAILURE_REPORT **0**, review round2. epoch1 lease 및 exact5 불변. 작업 전 host clock `2026-09-18T00:37:45+09:00`와 canonical ACTIVE worker/write fence를 재확인했다.

원인: R1 검사는 Authorization Bearer만 거부하여 Basic 등 다른 credential scheme이 audit까지 유입될 수 있었다. 최소 수정은 normalized inspection text의 `authorization ... bearer ...` 조건을 `\bauthorization\s*:\s*\S+`로 일반화한 1줄이다. 특정 scheme allowlist를 만들지 않으며 비어 있지 않은 header payload를 fail-closed한다. 단순 문서 단어 authorization/빈 header는 허용한다. 기존 bounded Unicode/percent/zero-width 검사와 원문 보존 정책은 그대로다.

명령/실제 결과:

1. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/git_adapter/test_git_adapter_e10.py -k r2_ --tb=short`
   - RED exit1, **14 failed, 7 passed, 152 deselected in 0.76s**. synthetic Basic plain/percent/fullwidth/zero-width, Digest/Custom/schemeless header를 message와 metadata에서 재현했다. Bearer 기존 방어2와 안전한 문서5는 이미 PASS였다.
2. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/git_adapter/test_git_adapter_e10.py --tb=short`
   - GREEN exit0, **173 passed in 4.18s**. denial code는 SENSITIVE_INPUT exact; grant/receipt/driver0, audit/error 원문0을 검증했다.
3. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/verification/test_gates_e09.py tests/verification/test_gates_c14.py --tb=short`
   - exit0, **358 passed in 2.79s**.
4. `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/tooling/test_project_progress.py -k E10StartControlTests --tb=short`
   - exit0, **2 passed, 661 deselected in 9.25s**.
5. 위 S 명령으로 builtin compile4 재실행: exit0, pycache0. 위 P canonical checker 재실행: exit0, **PASS sequence1160 reporting=AUTO_CONTINUE**. `git diff --check`: exit0.

R2 지시의 focused/E09+C14/control/checker/compile/diff를 fresh 실행했다. 앞 절의 full related 601 PASS/8 SKIP는 R1 실행 증거이며 R2에서 재실행했다고 표시하지 않는다. 실제 credential0(synthetic test value only), 실제 Git/remote/filesystem mutation0, stage/commit/push0, control9 변경0. 미검증 범위와 rollback은 이전 절 그대로이며 Main 독립 재검토를 기다린다.
