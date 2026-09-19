# C-22 완료보고 — developer-primary-c22-r1

## 판정

`COMPLETED` — C22 host-only 역할/결과 계약 구현 및 기본 검증 완료. E06 포함 전체 agent_team checkpoint 회귀547 PASS와 최종 코드의 focused90·비-E06 회귀495 PASS를 구분해 기록한다. Developer evidence는 Main acceptance가 아니다. formal FAILURE_REPORT 0. control/Git index/commit/push/merge 변경0.

## 판단 이유 / 기준선

- canonical root `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`, branch `codex/c09-execution-backends-r1`, HEAD/dispatch `98e218264bf54db04a1bd35a67273b713805a649`.
- WI SHA256 `67C864C512AFC7023E08626DC4C8BB7FE39D84A3CFB44303B69D404B5D196E5B`; invocation SHA256 `C12B945CBBC661F983C724407AAE11899F1558B9F53C6EDAEC0C272CD72ECF6E` 일치. 설계 v2.8 §51.1/51.2, 계획 v1.7 C22, 매트릭스 예약군 `ROLE-CONTRACT-RED/GREEN`와 테스트계획 successor overlay를 대조했다. 임의 AV ID를 발행하지 않았다.
- canonical seq1203의 C22 baseline hash `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`.
- worker `worker-lease-c22-r1-20260918-001`, execution `c22-r1-execution-fence-epoch-1-98e218264bf54db0`; write `write-lease-c22-r1-20260918-001`, write fence `c22-r1-write-fence-epoch-1-98e218264bf54db0`. exact6 scope/worker linkage/fencing aliases/ACTIVE window 2026-09-18T17:10:00+09:00~2026-09-19T05:10:00+09:00를 17:56:15 KST에 확인한 후 제품 mutation 시작.
- 앞선 F02 active lease 및 C22 projection의 잔존 F02 scope/fence 발견 때 mutation0으로 Main에 보고했다. Main 정정 전 테스트도 쓰지 않았다. 이 통제 정합 문제는 제품 formal failure가 아니다.
- 시작 dirty에는 E11/F01/F02 산출물·authority/control 문서가 이미 존재했다. 모두 보존했으며 아래 exact6 외 파일을 쓰지 않았다. progress/HANDOFF/checker/tooling 수정0.

## 조치 / exact6

| 경로 | 변경 |
|---|---|
| packages/agent_team/role_contracts.py | 기존 AgentDefinition v1 hash 유지, v2 다섯 역할·RoleContract·CODE host lease·single owner/fencing |
| packages/agent_team/role_results.py | 기존 C05 ResultEnvelope를 감싼 RoleEnvelope, trace/evidence/result·변경 경로 권한·REWORK 검증 |
| packages/agent_team/__init__.py | RoleContract/CodeWriteLease/RoleEnvelope public exports만 추가 |
| tests/agent_team/test_role_contracts_c22.py | 다섯 역할·권한·lease·100회 경쟁·alias/callback·legacy 계약 |
| tests/agent_team/test_role_results_c22.py | 역할 결과·trace·증거·미검증·재현/위조/권한 경계 |
| docs/04_test_reports/C-22_COMPLETION_REPORT.md | 본 보고서 |

### 계약과 호환성

- E01 `agent_definition/v1`의 REVIEWER/TESTER 생성자/API/hash 입력은 보존한다. 새 `AgentDefinition.for_role()`는 `agent_definition/v2`의 PLANNING/CODE/REVIEW/TEST/DEPLOY만 수락한다. v1 별칭을 v2 역할로 암묵 변환하지 않는다.
- 각 역할은 input/output·고정 금지행동·Main handoff·failure contract·human approval boundary·필수 evidence를 선언한다. 허용 tool/action/path는 기존 PermissionSnapshot과 parent narrowing/DelegationPacket이 담당한다.
- CODE만 product write/patch 가능하며 host가 이미 승인/관측한 WI ID/hash/approval ref와 actor/workspace/assignment/baseline/target/current execution+write fence가 결박된 CodeWriteLease가 필요하다. 단일 RolePolicyService authority에서 workspace가 달라도 active CODE owner 하나만 허용한다. 100회 경쟁·정확 replay·revoked replay·scope/alias 우회를 테스트했다.
- 이 lease 등록은 **trusted host-only observation seam**이지 agent payload API 또는 실제 runtime lease 발급이 아니다. 실제 승인 원장 인증과 runtime LeaseService/다중 process 연결은 NOT_INTEGRATED. Project host는 한 authority instance를 소유해야 한다. 임의 service를 새로 만들어 권한을 mint하는 transport/API는 제공하지 않는다.
- REVIEW/PLANNING/DEPLOY는 mutation0. TEST는 기존 승인 TestWriteGrant+별도 current TestWriteLease를 갖춘 tests/**만 예외적으로 허용하며 제품 쓰기는 거부한다. 승인·merge·Oracle/production deploy·delete·bypass·secret 변경은 어떤 역할에도 허용하지 않는다. DEPLOY는 read-only 준비/관찰 계약이다.
- RoleEnvelope는 actor/role을 inner RoleResult, task/parent/Main trace를 packet, baseline/target 및 raw evidence hash를 정본에 결박한다. artifact refs, unverified scope, rollback, integer cost/latency, provenance를 명시하며 raw transcript를 전달하지 않는다. C05 ResultEnvelope owner/schema를 재정의하거나 수정하지 않았다.
- v2 result는 RoleEnvelope 없이 직접 제출할 수 없다. CODE changed_paths는 canonical current lease·effective mutation capability·scope를 재검사한다. TEST의 기존 좁은 grant/permission 검사도 유지한다. result validation은 budget/action 실행을 발생시키지 않는다.
- REVIEW C/I finding이 남은 completed 결과는 REWORK_REQUIRED다. 실제 독립 evidence 없이 Developer report 재인용이나 mock/fixture/static/build/SKIPPED/BLOCKED를 완료 PASS로 승격하지 않는다. validated proposal은 accepted=false/state_transitions=()/IO0이다. Main acceptance, handoff 실행, Release/Apply/Deploy 전이는 생성하지 않는다.
- exact builtin/known DTO 사전 검증, detached input/output, mutable tzinfo 거부와 bounded metadata로 callback/alias를 제한한다. v1 필드 추가 때문에 역사 content hash가 달라지지 않게 optional v2 contract는 v1 hash에서 제외한다.

## RED → GREEN / 오류 기록

1. C22 신규 두 파일 최초 RED: 아래 F 명령 exit1, **73 failed in 1.81s**. fingerprint `C22-FIVE-ROLE-FACTORY-MISSING`.
2. 최소 구현 후 F exit0, **73 passed in 0.71s**.
3. 적대 보강 RED: F exit1, **3 failed, 83 passed in 1.27s**. arbitrary assignment property callback, nested result deepcopy callback, REVIEW Important finding 완료 수락을 각각 재현했다. exact-type preflight와 REWORK rule 보완.
4. F + E01 두 파일: exit0, **162 passed in 1.38s**.
5. approved WI reference 누락 RED: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_role_contracts_c22.py -k without_explicit --tb=short` exit1, **1 failed, 58 deselected in 0.68s**. CodeWriteLease에 필수 approval_ref/work_instruction_hash 결박 후 F exit0, **87 passed in 0.98s**.
6. nested inner RoleResult constructor callback 및 receipt 전체 trace hash 결박 RED: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_role_results_c22.py -k 'inner_result_construction or entire_trace' --tb=short` exit1 **2 failed, 28 deselected in 0.72s**. v2 inner constructor 사전검증과 root RoleEnvelope receipt hash 보완 후 F exit0 **89 passed in 0.87s**.
7. 강제 content_hash callback RED: `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_role_results_c22.py -k forced_content_hash --tb=short` exit1 **1 failed, 30 deselected in 0.94s**. init=False 생성 중 hash 미설정과 소비 시 exact builtin hash를 구분해 검사한 뒤 F exit0 **90 passed in 1.00s**.

위는 test-first 구현/적대 보강이며 정식 FAILURE_REPORT가 아니다. formal failure count0. 실제 외부 자원/승인 변경 없이 해결했다.

## 정확한 실행 명령 / 결과

F:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_role_contracts_c22.py tests/agent_team/test_role_results_c22.py --tb=short`

최신 exit0 **90 passed in 1.00s**, skip0.

E01 포함:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_role_contracts_c22.py tests/agent_team/test_role_results_c22.py tests/agent_team/test_role_contracts_e01.py tests/agent_team/test_role_results_e01.py --tb=short`

exit0 **162 passed in 1.38s**, skip0 (approval-ref 추가 전 checkpoint; 마지막 focused는 위 F).

R:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team --basetemp=D:/Project/Anvil/.codex-sandbox/c22-agent-team-20260918-r1 --tb=short -rs`

exit0 **547 passed in 736.54s (0:12:16)**, skip0. 18:05:06 시작한 checkpoint 실행이며 마지막 기존 E06 격리 Git/worktree 구간 때문에 장시간 소요됐다. timeout/interrupt/실패0. 이 프로세스 시작 뒤 추가한 최종 C22 적대 보강은 아래 fresh F/비-E06 회귀에서 검증했으며 547 결과를 최종 550 단일 실행으로 재표기하지 않는다.

최종 explicit WI approval-ref 필드 보강 뒤 빠른 전체 owner 회귀를 다시 수행했다:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team --ignore=tests/agent_team/test_worktree_writes_e06.py --tb=short -rs`

checkpoint exit0 **492 passed in 9.53s**, 이후 **494 passed in 9.00s**. 마지막 content_hash callback 보강까지 포함한 동일 명령 **fresh exit0 495 passed in 9.02s**, skip0. 기존 E06 격리 Git/worktree 구간은 위 R 실행에서 완료했으며 skip를 PASS로 계산하지 않았다. E01/C17/E02/E03/E05 및 나머지 agent_team owner 회귀는 최종 코드에서 재확인했다.

S:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/agent_team/role_contracts.py','packages/agent_team/role_results.py','packages/agent_team/__init__.py','tests/agent_team/test_role_contracts_c22.py','tests/agent_team/test_role_results_c22.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE5 PASS; pycache0')"`

exit0 **COMPILE5 PASS; pycache0**.

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py`

exit0 **PASS sequence=1203 reporting=AUTO_CONTINUE**. `git diff --check` exit0. `git diff --cached --name-only` exit0/empty. Git global ignore-file read permission 경고는 exit0이며 제품 실패가 아니다.

## 미검증 / 잔여 위험 / rollback

- C22 계약 실행 자체의 tool/file/Provider dispatch IO0. DB/WSL/Provider/network/UI/browser/Oracle/production deploy는 **NOT_EXECUTED**. 기존 agent_team 회귀의 격리 local Git/worktree fixture는 실제 Provider/운영 증거가 아니다.
- actual authentication/approval ledger/runtime lease integration, multi-process durable single writer, physical path resolution, billing settlement, automatic handoff/Team scheduler는 **NOT_INTEGRATED**. canonical repo-relative 문자열 검사는 OS symlink/junction 인증을 대체하지 않는다.
- artifact ref hash는 전달 계약이며 실제 artifact storage byte 읽기는 C22가 하지 않는다. Evidence capture는 host 관측 seam이고 독립 명령 실행 자체를 수행하지 않는다. 실제 Test/Deploy 성공으로 표시하지 않는다.
- 전용 pytest basetemp `D:/Project/Anvil/.codex-sandbox/c22-agent-team-20260918-r1`는 실행 중 생성됐다. 공유 Temp를 사용하지 않았으며 기존 사용자 자료 삭제0. 이 경로의 pytest 산출물은 검증 근거로 보존한다(잔류0이라고 주장하지 않는다).
- rollback은 Main이 C22 exact6 diff만 검토해 되돌린다. 기존 E11/F01/F02 제품, control/authority 문서, 사용자 dirty·untracked를 reset/stash/clean하지 않는다. DB/schema/data rollback 없음.
- 다음 단계: Main 독립 검토. canonical seq1203/C22/worker ACTIVE/write ACTIVE 상태이며 이 writer는 acceptance/lease revoke/commit/push/후속 package를 시작하지 않는다.

## 제품 SHA256

- role_contracts.py: `88692B409E2F3E2391816473D666AE1FA4BDF5F2D60656AA62156DE73C8A1D0B`
- role_results.py: `1EECE19FBCD114AB698B20E77B275CBFB73369E84143A0D8AA515879AA25FD9C`
- __init__.py: `862B3A176F1EEAC94117EB9F24673516D55F09BA1F5B7F29553A9D9C40064754`
- test_role_contracts_c22.py: `63ED5F3DDC0873B6B6992218A34D78AE31BBDE589AA30BC2EA4C7E622EA1989C`
- test_role_results_c22.py: `0A39FE7B391163F08FA07C44D8A9A90EEC4F8C3165BA40CEE9D06AD6416CFCEC`
- 보고서 hash는 자기참조 없이 최종 반환에 제공한다.
