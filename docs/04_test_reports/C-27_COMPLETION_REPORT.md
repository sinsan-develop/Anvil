# C-27 완료보고 — developer-primary-c27-r1

## 판정

`COMPLETED` — 승인된 contract-only 제품 구현과 focused44/전체 agent_team 회귀772/비E06 회귀716/compile6/diff-check PASS. 전체 회귀는 exit0/skip0으로 종료했다. Kakao 외부 계약은 `OPEN_DECISION`, canonical checker는 기존 구문 오류로 `NOT_VERIFIED/NOT_PASS`다. 제품 formal FAILURE_REPORT0. Developer 기본 검증과 독립 검토/Main acceptance는 구분한다.

## 판단 이유 / 기준선

- 작업 위치 `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`; branch `codex/c09-execution-backends-r1`; HEAD `98e218264bf54db04a1bd35a67273b713805a649` 실제 확인.
- WI `docs/work_orders/C-27_WORK_INSTRUCTION.md` SHA256 `AB532B5AA001719D8BCECAAB228C20680E0E5454625A2CF93A9D8AC63645034B`; prompt `docs/work_orders/C-27_INVOCATION_PROMPT.md` SHA256 `5F9C8393C7311023A260F053C6FF5EAAB4B2B9E7C1479FD1FAFEB23F2BD602DC`. 두 파일을 전부 읽었다.
- 설계 §51.3의 미결정 Kakao API/채널·webhook/서명/token·사용자 매핑·rate/quota·메시지 정책·운영 계정과 계획 C27/§19.7 contract-only 경계를 따른다. baseline `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`.
- mutation 전 host `2026-09-19T13:58:20+09:00` 및 seq1240 ACTIVE epoch1/exact7 확인. worker `worker-lease-c27-r1-20260919-001`, execution `c27-r1-execution-fence-epoch-1-98e218264bf54db0`; write `write-lease-c27-r1-20260919-001`, write fence `c27-r1-write-fence-epoch-1-98e218264bf54db0`. 발효11:20~만료23:20 KST, worker/write linkage와 dispatch HEAD 일치.
- C22~C26/F01/F02 및 Main control 등의 기존 dirty/untracked를 보존했다. C27 새 파일들은 시작 때 없었다. stage/commit/push/merge0, control/progress/HANDOFF/checker/tooling 수정0.

## 조치 / exact7

| 경로 | 조치 |
|---|---|
| packages/agent_team/kakao_adapter.py | 신규 KakaoContractAdapter: bounded OPEN_DECISION draft projection/receipt/audit |
| packages/agent_team/__init__.py | class import/export 2줄 추가, 기존 exports 유지 |
| tests/agent_team/test_kakao_adapter_c27.py | 저위험 draft-only 및 고위험 차단 |
| tests/agent_team/test_kakao_contracts_c27.py | shared envelope/trace/미확정 경계/bounds |
| tests/agent_team/test_kakao_privacy_c27.py | raw 입력·callback·alias·audit pagination |
| tests/agent_team/test_kakao_replay_c27.py | replay/rebind/local throttle/100회 contention/실패 atomicity |
| docs/04_test_reports/C-27_COMPLETION_REPORT.md | 본 보고서 |

### 구현 판단과 제한

- 승인된 bounded contract-only 범위에서 구현했다. C25 `SNSMessageEnvelope`, exact builtin validation, UTC normalization, PRIVATE artifact ref/hash 및 immutable snapshot 계약을 재사용한다. Telegram adapter 동작을 Kakao에 복사하거나 Kakao API/auth 방식을 추측하지 않는다.
- constructor는 canonical C25 gateway 타입만 받지만 **gateway를 호출·보관하지 않는다**. 실제 권한 소비, gateway admission, 신원 인증, C23 상태 조회는 모두 실행하지 않는다. 외부 actor/session trace는 `UNVERIFIED_DECLARED_TRACE`이며 payload에 role/user/target이 있더라도 권위를 부여하지 않는다.
- inbound/outbound 모두 `OPEN_DECISION`, `allowed=False`, delivery/gateway_admission `NOT_EXECUTED`, io_count/runner_dispatch0, automatic_acceptance false다. 반환 receipt는 transport 수신·송신 증명이 아닌 등록된 **local draft receipt**다. 외부 receipt_ref는 null이다.
- STATUS/QUESTION/RESULT/PAUSE/RESUME은 `DRAFT_NOT_APPLIED`. PAUSE/RESUME은 intent만 보존하며 Run/queue/Runner/C25 명령 집합을 변경하지 않는다. 실제 상태는 읽지 않았으므로 observed_status=null이다.
- 그 외 명령은 `DENIED_HIGH_RISK` 및 `CONSOLE_STEP_UP_REQUIRED`. approval/설계 확정/merge/deploy/delete/apply/권한/Provider/Secret 변경0. Web Console 경로는 검증된 opaque session ID로 생성한 `/sessions/<id>` 상대경로뿐이며 실제 UI routing/step-up은 미통합이다.
- OPEN_DECISION 여섯 항목은 API_CHANNEL, AUTH_WEBHOOK_SIGNATURE_TOKEN, ACTOR_MAPPING, RATE_QUOTA, MESSAGE_POLICY, OPERATING_ACCOUNT. 이를 payload flag나 constructor 옵션으로 완료/허용으로 바꾸는 경로가 없다.
- identity/source authority와 실제 gateway rate/nonce는 소비하지 않는다. adapter의 replay/idempotency/message/nonce 및 rate 제한은 **host draft ledger에 한정**된다. local throttle은 전역 instance 기준으로 actor 문자열을 바꿔도 늘어나지 않으며 `HOST_DRAFT_ONLY_NOT_PROVIDER_QUOTA`로 명시한다. Kakao quota를 관측하거나 추정하지 않는다.
- exact normalized envelope+direction을 fingerprint로 결박한다. 동일 요청은 같은 receipt, 다른 payload/direction/actor rebind 및 nonce 재사용은 거부한다. 100회 concurrent same request는 게시1이다. 새로운 adapter/process 사이 durable/global dedupe는 미통합이다.
- type/shape/bounds 검사 전에 untrusted deepcopy/property/custom timezone callback을 실행하지 않는다. naive/custom tzinfo는 거부하고 builtin UTC로 분리한다. raw message/body/credential/API response가 아니라 PRIVATE artifact ref만 받으며 실제 bytes/store 해석은 수행하지 않는다.
- 생성 완료된 receipt/hash/audit/rate를 copy-on-write state에 모은 뒤 한 번 게시한다. catch 가능한 projection failure는 local receipt/audit/rate/nonce 게시0이고 retry가 정상 수렴한다. process-crash durability를 주장하지 않는다.
- audit는 sequence/hash/status/time/IO0만 보존한다. raw actor/본문/artifact metadata를 싣지 않는다. 최대512, 페이지50, stable offset; 반환 alias 변조가 내부 record에 영향을 주지 않는다. full ledger는 fail-closed이고 삭제/자동 eviction은 없다.

## RED → GREEN / 정확한 명령

cwd는 canonical root. Python은 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`.

Focused 명령 F:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_kakao_adapter_c27.py tests/agent_team/test_kakao_contracts_c27.py tests/agent_team/test_kakao_privacy_c27.py tests/agent_team/test_kakao_replay_c27.py --tb=short
```

| 단계 | exit / 실제 결과 | 근거 |
|---|---|---|
| F 최초 RED | 1 / 36 failed in 0.84s | `C27 adapter missing` assertion; 제품 파일 작성 전 실행 |
| F 최소 GREEN | 0 / 36 passed in 0.92s | 위 계약 구현 |
| F 적대 보강 | 0 / 44 passed in 0.96s, skip0 | handle callback0, audit70, direction/actor rebind, rate window, projection failure rollback |

RED·내부 재시도는 유효 FAILURE_REPORT가 아니며 formal count0이다.

전체 agent_team 회귀 — exit0 **772 passed in 668.07s (0:11:08)**, skip0. 실제 exec session `1258`, final chunk `2914a7`의 종료 출력을 확인했다:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team --basetemp=D:/Project/Anvil/.codex-sandbox/c27-full-temp-20260919-01 --tb=short
```

```text
...                     [100%]
772 passed in 668.07s (0:11:08)
exit_code: 0
```

비E06 회귀 — exit0 **716 passed in 11.79s**, skip0:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team --ignore=tests/agent_team/test_worktree_writes_e06.py --basetemp=D:/Project/Anvil/.codex-sandbox/c27-fast-temp-20260919-01 --tb=short
```

구문 — exit0 `COMPILE6 PASS; pycache0`:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/agent_team/kakao_adapter.py','packages/agent_team/__init__.py','tests/agent_team/test_kakao_adapter_c27.py','tests/agent_team/test_kakao_contracts_c27.py','tests/agent_team/test_kakao_privacy_c27.py','tests/agent_team/test_kakao_replay_c27.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE6 PASS; pycache0')"
```

`git diff --check` exit0/출력0. `git diff --cached --name-only` staged0. `git diff --numstat -- packages/agent_team/__init__.py`:18/2는 기존 C22~C26 누적 delta 포함이며 C27은 추가2줄뿐이다.

Checker — exit1, NOT_VERIFIED/NOT_PASS:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
```

기존 `scripts/check_project_progress.py:32957` embedded 과거 C03 fixture 문자열의 `SyntaxError: leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers`. parse 단계 종료로 canonical 검증이 수행되지 않았다. 해당 Main 소유 파일은 수정하지 않았다.

## 미검증 / 다음 조치 / rollback

- 실제 Kakao API/SDK/network/webhook/signature/token/auth/account/quota/delivery 및 Provider/DB/WSL/UI/Oracle/deploy는 NOT_EXECUTED. 외부 API/인증/사용자 매핑/메시지 정책/운영 계정 계약은 OPEN_DECISION, runtime/durable integration은 NOT_INTEGRATED다.
- local draft GREEN은 위 외부 계약 또는 운영 적합성 PASS가 아니다. fake transport/가짜 인증을 운영 경로로 만들지 않았다. artifact 원문 복구 및 source authenticity도 검증하지 않았다.
- 전체 회귀의 E06은 기존 격리 임시 Git fixture이며 canonical repository stage/commit/push/merge는 수행하지 않았다. 전용 basetemp 결과는 진단용으로 보존하고 외부 cleanup을 수행하지 않는다.
- 전체 회귀 종료 및 확정 수치를 반영하여 Main 독립 검토로 인계한다. checker 복구/lease revoke/acceptance/후속 package는 Main 소유다. C25 gateway/Daon facade, C26 Telegram adapter와 C26 완료보고의 SHA는 이전 완료값과 동일함을 다시 확인했다.
- rollback은 Main 검토하에 C27 신규 module/tests/report 및 __init__의 C27 import/export2줄만 대상으로 한다. C25/C26·기존 dirty/untracked/control 원장은 그대로 보존하며 reset/clean/stash/bulk delete를 사용하지 않는다. progress/HANDOFF 미갱신.

## SHA256

| 경로 | SHA256 |
|---|---|
| packages/agent_team/kakao_adapter.py | 8359291798DCDDB888FD5BDE90A48479233C206DCDBFB212FA1BA5D55F6BFFCF |
| packages/agent_team/__init__.py | F690406DEC499CDAC33D4F20DBEA14BF3471A272E877D693B81B4A9AC0A3F736 |
| tests/agent_team/test_kakao_adapter_c27.py | 10FD902362F2D470E04056DECA5A40D269FB245CD2509779C3615E001C18745A |
| tests/agent_team/test_kakao_contracts_c27.py | D555651536C1C69CBAE39A6202F1602AB07D9DC0922FE2040745085D1ED93D1C |
| tests/agent_team/test_kakao_privacy_c27.py | 5997082044A2B153EB35C2F7F7AF113CE02AE3F7E820FCAA6D3FC55B19EE7604 |
| tests/agent_team/test_kakao_replay_c27.py | AF5E1F14BB04B6F669D9EA165EE2234EE3825D00E661BFFC5323C2F5ED9AD4F2 |

보고서 자체 SHA는 최종 응답에서 제공한다.
