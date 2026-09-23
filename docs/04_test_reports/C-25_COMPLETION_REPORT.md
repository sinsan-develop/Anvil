# C-25 완료보고 — developer-primary-c25-r1

## 판정

`COMPLETED` — host-only 구현·focused46·E06 포함 전체 agent_team 회귀680·비-E06 회귀624·compile7·diff-check PASS. 기존 checker SyntaxError는 별도 NOT_VERIFIED/NOT_PASS이며 제품 실패로 합산하지 않는다. formal FAILURE_REPORT count0. Developer 기본 검증은 독립 검토/Main acceptance 또는 canonical control PASS가 아니다.

## 판단 이유 / 기준선과 권한

- cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`, branch `codex/c09-execution-backends-r1`, HEAD `98e218264bf54db04a1bd35a67273b713805a649` 실제 확인.
- WI `docs/work_orders/C-25_WORK_INSTRUCTION.md` 전체 읽기, SHA256 `C33FF3BB787B2FCE0F4483D68E9F59191E53A5C9D5C3FE1F7780B760840026FC`; invocation 전체 읽기, SHA256 `3EE07438D01C61B45B5B9D151A68CBD27D2C2A1A35E61D2879B2994A46D43027`.
- 설계 v2.8 §51.3, 계획 v1.7 C25, 매트릭스 `SNS-DAON-RED/GREEN` 기준. 설계 baseline `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`.
- 최초 epoch1은 host10:22:54에 만료를 확인하여 파일0 변경으로 BLOCKED 보고했다. Main epoch2 보정 뒤 seq1226/exact8/linkage를 확인했으나 host10:28:17에는 아직 발효 전이라 읽기 전용으로 대기했다. **2026-09-19T10:30:10.0845717+09:00 발효를 확인한 뒤 RED 테스트를 작성했다.** 이 환경/권한 대기는 정식 실패가 아니다.
- worker `worker-lease-c25-r1-20260919-002`, execution `c25-r1-execution-fence-epoch-2-98e218264bf54db0`; write `write-lease-c25-r1-20260919-002`, write fence `c25-r1-write-fence-epoch-2-98e218264bf54db0`. ACTIVE window `2026-09-19T10:30:00+09:00`~`2026-09-19T22:30:00+09:00`.
- 시작 worktree는 기존 C22/C23/C24/E11/F01/F02 및 Main control dirty/untracked 상태였다. 모두 보존했다. 기존 adapter/provider/model registry/DB/UI/secret 파일과 control/progress/HANDOFF/checker/tooling은 변경하지 않았다. staged0, commit/push/merge0.

## 조치 / exact8 변경

| 경로 | 조치 |
|---|---|
| packages/agent_team/sns_gateway.py | SNSMessageEnvelope, host-only SNSGateway identity/admission/receipt/retry/DLQ/audit 구현 |
| packages/agent_team/daon_user_api.py | gateway를 사용하는 DaonUserAPI question/answer host facade |
| packages/agent_team/__init__.py | 신규 public symbols3 export만 추가; C22/C23/C24 exports 보존 |
| tests/agent_team/test_sns_gateway_c25.py | replay/rate/retry/DLQ/high-risk/expiry/revoke/게시 실패 검증 |
| tests/agent_team/test_daon_user_api_c25.py | 질문→실제 C23 결과 ref→답변 및 DLQ 부활 차단 |
| tests/agent_team/test_gateway_contracts_c25.py | trace/identity/C22 권한·fence/callback/alias/100회 동시 중복 검증 |
| tests/agent_team/test_privacy_receipts_c25.py | ref-only 개인정보 최소화·secret encoding·retention·audit pagination·bounds |
| docs/04_test_reports/C-25_COMPLETION_REPORT.md | 본 보고서 |

### 구현 의미와 재사용 경계

- C22 exact RolePolicyService/RoleAssignment current validation과 C23 RoleTeamOrchestrator.mailbox/project 공개 seam을 재사용한다. 현재 assignment hash/actor/role/task/session/target/baseline/parent task+parent run을 결박하고 권한 철회·잘못된 fence·expiry·session cancel은 replay 이전에 거부한다. role budget이나 worker/Run을 새로 실행하지 않는다.
- `capture_identity`는 이미 인증·인가한 host가 external actor의 hash, authn/authz evidence hash를 등록하는 **host-only observation seam**이다. payload/API로 identity를 mint하지 않는다. 실제 SNS 서명 검증·외부 신원 제공자·Web Console step-up은 구현하지 않았으며 authentication integration PASS가 아니다. 별도의 gateway 객체가 허용목록 밖 명령/권한을 부여하지 않는다.
- inbound envelope는 trace·command·payload artifact ref/hash·correlation/idempotency/nonce·attempt·privacy/retention·UTC window를 검증한다. QUESTION/STATUS/RESULT만 수용하며 Apply/Deploy/Delete/approval/Secret/Provider 변경/설계 확정 등은 `CONSOLE_STEP_UP_REQUIRED`; 실제 승인 원장 변경0.
- raw question/answer/body/transcript/token은 저장하지 않는다. 원문 대신 exact artifact ID/hash/PRIVATE ref만 허용한다. reference의 실제 bytes/checksum/권한 resolution은 artifact owner/후속 adapter 미통합이며 이 패키지는 이를 검증했다고 주장하지 않는다. 식별자는 bounded ASCII opaque ID만, external actor는 hash만, audit는 sequence/kind/receipt hash/time/NOT_EXECUTED/io0만 노출한다.
- idempotency는 exact envelope+registered identity hash에 결박한다. nonce/message reuse는 별도 거부한다. 동일 current 권한·동일 요청 재전달은 기존 receipt이며 rate를 추가 소비하지 않는다. actor별 sliding-window rate를 적용하고 새 identity ID로 내부 actor의 rate를 우회하지 않는다.
- retry는 host 관측 failure code에 따른 backoff/DLQ **projection만** 기록한다. sender/worker/queue0, 모든 delivery는 `NOT_EXECUTED`. old receipt의 새로운 retry는 거부하고 request exact retry는 동일 receipt다. DLQ 질문을 오래된 inbound receipt로 답변 부활시키지 않는다. 신규 질문이 자동으로 Run/Agent/Provider를 실행하지 않는다.
- Daon answer는 C23 task COMPLETED/current result hash를 요구하고 question hash/source result hash에 결박한다. 전달 완료나 사용자 승인으로 승격하지 않는다. 기존 C24 MoA/routing 코드는 수정하지 않았으며 SNS는 routing 변경 권한을 제공하지 않는다.
- candidate state와 detached 응답을 준비하고 final role authority를 확인한 후 상태를 게시한다. 주입된 response 생성 실패는 nonce/rate/idempotency/audit를 남기지 않고 retry가 수렴한다. 100회 동일 요청 동시 호출에서 receipt1/audit1을 검증한다.
- identity128, append-only audit512, audit page50, identifier128, payload snapshot256KiB, retry attempts1~8, rate1~1000/window1~3600sec, retention1~86400sec 등 유한 경계다. 한도 도달 시 거부하며 durable retention 삭제/자동 cleanup은 구현하지 않는다. 반환 DTO의 강제 변조로 내부 canonical JSON은 변경되지 않는다.

## TDD / 오류 분류

스킬 TDD를 사용해 구현 전에 실패를 실행하고, systematic-debugging으로 실제 C23 root-parent 자료를 확인했다. 모든 수치는 아래 F 명령의 결과다.

| 단계 | exit / 실제 결과 | fingerprint / 조치 |
|---|---|---|
| 최초 RED | 1 / 29 failed, 1.59s | `C25 gateway missing` — 신규 모듈 부재 |
| 첫 구현 | 1 / 9 failed, 20 passed, 1.17s | `TRACE_MISMATCH` — fixture가 C23 root parent_task=None과 packet parent_run을 혼동; 두 필드를 구분. retention fixture도 expiry와 일치시킴 |
| trace 정정 | 1 / 1 failed, 28 passed, 1.26s | 기대 regex FENCING과 canonical `STALE_EXECUTION_FENCE` 불일치; 기존 owner reason을 그대로 기대 |
| 첫 GREEN | 0 / 29 passed, 1.18s | 계약 단위 통과 |
| 적대 RED | 1 / 3 failed, 43 passed, 1.20s | identity observation 재결박, capture 중 revoke, DLQ 답변 부활 각각 재현 |
| 적대 GREEN | 0 / 46 passed, 1.54s | idempotency identity hash 결박 / publish 직전 role 재검사 / latest terminal receipt 검사 |
| 최종 fresh focused | 0 / 46 passed, 1.61s | 동일 F 명령 재실행, 제품 변경 없음 |

위 RED·fixture·개발 내부 재시도는 정식 FAILURE_REPORT가 아니며 count0이다. 기존 checker 손상 또한 C25 제품 결함으로 합산하지 않는다.

## 정확한 실행 명령 / 결과

Python은 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`를 사용했다. 아래 명령 cwd는 모두 canonical root다.

F — focused, 최종 exit0 **46 passed in 1.61s**, skip0:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_sns_gateway_c25.py tests/agent_team/test_daon_user_api_c25.py tests/agent_team/test_gateway_contracts_c25.py tests/agent_team/test_privacy_receipts_c25.py --tb=short
```

전체 관련 회귀 — 종료 확정, exit0 **680 passed in 720.76s (0:12:00)**, fail0/error0/skip0:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team --basetemp=D:/Project/Anvil/.codex-sandbox/c25-full-temp-20260919-01 --tb=short
```

실행 session `18491`, 최종 output chunk `80bf9d`, `exit_code=0`으로 반환됐다. 마지막 출력 원문은 아래와 같다. 진행 중/timeout/중단 결과가 아니다.

```text
..                                         [100%]
680 passed in 720.76s (0:12:00)
```

비-E06 관련 회귀 — exit0 **624 passed in 14.05s**, skip0:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team --ignore=tests/agent_team/test_worktree_writes_e06.py --basetemp=D:/Project/Anvil/.codex-sandbox/c25-fast-temp-20260919-01 --tb=short
```

구문 — exit0 `COMPILE7 PASS; pycache0`:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/agent_team/sns_gateway.py','packages/agent_team/daon_user_api.py','packages/agent_team/__init__.py','tests/agent_team/test_sns_gateway_c25.py','tests/agent_team/test_daon_user_api_c25.py','tests/agent_team/test_gateway_contracts_c25.py','tests/agent_team/test_privacy_receipts_c25.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE7 PASS; pycache0')"
```

`git diff --check` — exit0, 출력0. `git diff --cached --name-only` — exit0, staged0(기존 global ignore 접근 warning은 환경 경계이며 설정 미변경).

C24 frozen `moa.py`/`provider_catalog.py`/`provider_status.py` 및 C24 완료보고를 `Get-FileHash`로 다시 대조하여 이전 C24 exact SHA와 모두 동일함을 확인했다. __init__는 기존 exports를 보존하고 C25 import/export3줄만 추가했다.

Canonical checker — exit1, **NOT_VERIFIED/NOT_PASS**:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
```

`scripts/check_project_progress.py:32957`의 과거 C03 embedded fixture 문자열에서 `SyntaxError: leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers`. parsing 단계에서 종료하여 canonical 검증 로직은 실행되지 않았다. Main이 이미 전달한 기존 손상이며 해당 control 파일은 보존했다. 제품 테스트 PASS를 checker PASS로 승격하지 않는다.

## 미검증 / 다음 조치 / rollback

- 실제 SNS/Telegram/Kakao/Daon User HTTP/UI, auth provider/signature, 외부 sender/network/DB/WSL/Oracle/Provider/배포는 NOT_EXECUTED. C26/C27 external contract는 OPEN_DECISION으로 남기며 임의 API/토큰/쿼터를 생성하지 않았다.
- durable identity/inbox/DLQ/rate storage, process restart, artifact content verification, provider authenticity, 실제 delivery receipt ingestion은 NOT_INTEGRATED. 본 gateway에는 외부 delivery 성공을 mint하는 API 자체가 없다.
- 전체 관련 회귀의 E06 기존 테스트만 격리 임시 Git fixture를 사용한다. canonical worktree stage/commit/push/merge는 하지 않았다. root 전체 프로젝트 suite/실제 환경 acceptance를 주장하지 않는다.
- 다음 조치: Main control 복구 및 독립 검토. 완료보고는 Developer evidence이지 자동 합격이 아니다. 전용 basetemp 테스트 산출물은 진단 증거로 남겼으며 exact8 외 수동 삭제/광범위 cleanup은 하지 않았다.
- rollback: Main 검토 아래 C25 신규 모듈2·신규 테스트4·보고서와 __init__ 신규 export3줄만 회수한다. C22/C23/C24·기존 F01/F02·Main control 및 다른 dirty/untracked는 그대로 보존하며 reset/clean/stash/광범위 삭제를 사용하지 않는다. progress/HANDOFF는 Main 소유로 미갱신이다.

## 파일 SHA256

| 경로 | SHA256 |
|---|---|
| packages/agent_team/sns_gateway.py | 762A71F6F6BD76CFC181F24542A609D6AE95DB9C926AD256FF5563BC4CAA8573 |
| packages/agent_team/daon_user_api.py | DAC1A8E10FCA6D78AF90E1A262D675E9B94EFAD288CD5E95B76B1D0D55AD5856 |
| packages/agent_team/__init__.py | FE4130B4F2B4D65E1728D727BB9FC91FD4AA25FDA065A04AEA2E7052E8A35FA7 |
| tests/agent_team/test_sns_gateway_c25.py | E8C9B33FA4D0D6D16572AC039A1026B72FACAB89F0C22F8EFE4CA3ADDD9409C1 |
| tests/agent_team/test_daon_user_api_c25.py | 18E677F0E402643DAA6230D72D3BE0B302C2750B8D53BA03AE3113F5A237222F |
| tests/agent_team/test_gateway_contracts_c25.py | 4B0C6F3940B01E620BBC3C090ED9218380DEBCCD9181D093653DEAE54A38B4F5 |
| tests/agent_team/test_privacy_receipts_c25.py | D8C17A58BB3CDBD89797870260BBD883CB613D4501A4C28432051FE47C32F825 |

보고서 자체 hash는 최종 응답에서 제공한다.
