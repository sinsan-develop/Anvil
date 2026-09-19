# C-26 완료보고 — developer-primary-c26-r1

## 판정

`COMPLETED` — 승인된 host-only 구현/focused48/전체 agent_team 회귀728/비-E06 회귀672/legacy Telegram9/compile6/diff-check PASS. 전체 회귀는 exit0, skip0으로 종료했다. 기존 checker SyntaxError는 NOT_VERIFIED/NOT_PASS로 보존한다. formal FAILURE_REPORT0. Developer 기본 검증은 독립 검토/Main acceptance가 아니다.

## 판단 이유 / 기준선

- cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`; branch `codex/c09-execution-backends-r1`; HEAD `98e218264bf54db04a1bd35a67273b713805a649` 실제 확인.
- C26 WI/prompt 전체 읽기 및 SHA256 확인: WI `EC6346F11637C1AA6F680A955CFF3579611BFE0E87B04F554F5436D2C8C6FEAB`, prompt `74F8D81F3A1A0D373C1559991E3DCBD30774CC5E357E0FC5931F63BCAD9F1369`.
- 권위: 설계 v2.8 §51.3 및 Telegram 보조 Notification/Command 정책, 계획 v1.7 C26, 매트릭스 `SNS-DAON-RED/GREEN`. baseline `B0D89584F331C225BED07C1519CE56EB0D80B916207D21CFEF0A91807D1DF65D`.
- 제품 mutation 전 host `2026-09-19T10:59:18+09:00`에 canonical seq1233/epoch1/exact7/linkage를 확인했다. worker `worker-lease-c26-r1-20260919-001`, execution `c26-r1-execution-fence-epoch-1-98e218264bf54db0`; write `write-lease-c26-r1-20260919-001`, write fence `c26-r1-write-fence-epoch-1-98e218264bf54db0`. ACTIVE window `2026-09-19T10:56:52+09:00`~`2026-09-19T22:56:52+09:00`.
- 시작은 기존 C22~C25/F01/F02/E11/Main control dirty/untracked가 있는 상태였다. 그대로 보존했다. C25 SNS gateway/Daon facade와 C25 보고서 SHA는 이전 완료값과 동일함을 재확인했다. Git stage/commit/push/merge 및 control/progress/HANDOFF/checker/tooling 변경0.

## 조치 / exact7

| 경로 | 변경 |
|---|---|
| packages/agent_team/telegram_adapter.py | 새 TelegramGatewayAdapter additive 구현; legacy 본문 불변, HEAD diff175/0 |
| packages/agent_team/__init__.py | 신규 class import/export2줄; 기존 exports 보존 |
| tests/agent_team/test_telegram_adapter_c26.py | pause/resume 요청-only, 고위험 차단, 시각 검증 |
| tests/agent_team/test_telegram_contracts_c26.py | C25/C22 권한·매핑·receipt와 실제 C23 상태 observation |
| tests/agent_team/test_telegram_privacy_c26.py | raw/credential/link injection, callback/time/alias, bounds/pagination |
| tests/agent_team/test_telegram_replay_c26.py | update/nonce/idempotency/rate, 100회 동시 재전달, publication 복구 |
| docs/04_test_reports/C-26_COMPLETION_REPORT.md | 본 보고서 |

기존 `TelegramAdapter`, `TelegramUpdate`, `TelegramNotification`, HMAC/allowlist/state-store API 및 legacy 동작은 수정하지 않았다. 새 경로는 이 서명 기능을 호출하지 않고, 정규화된 host observation과 C25 공개 facade만 소비한다.

### 계약 및 Main 내부 구현 판단

- **Main 판단:** C25 명령집합 QUESTION/STATUS/RESULT는 변경하지 않는다. Telegram pause/resume은 QUESTION admission에 연결한 별도 `REQUESTED_NOT_APPLIED` intent이며 Web Console 확인 경로만 반환한다. queue/Runner/Run 상태 변경0. 기능·요구·중요위험 변경이나 별도 승인 요청이 아니다.
- binding은 host가 이미 인증한 chat/user hash, opaque device ID, C25 identity snapshot hash, auth observation hash, session/window를 결박한다. capture 자체는 `HOST_OBSERVATION_PENDING_GATEWAY_CHECK`이며 인증이나 현재 권한을 발급하지 않는다. unregistered identity로 만든 binding은 실제 process에서 C25가 거부한다. 실제 Telegram 신원/서명 검증은 미통합이다.
- 실제 권위는 매 process/replay/receipt에서 C25 current registered identity 및 C22 role/fence/expiry 검증으로 확인한다. host가 주입한 exact C23 owner의 공개 mailbox/project로 동일 session/task/assignment/target/baseline을 대조한다. 임의 legacy 객체·raw Telegram payload·자가 승인으로 대체하지 않는다.
- status 조회는 C23 current team/task 상태, target/baseline, projection hash, observed_at만 bounded projection으로 반환한다. task 상태 변경0. 동일 update exact replay는 과거 receipt/관측 시각을 그대로 반환하며 새 현재 조회에는 새 update/idempotency key가 필요하다.
- 상태/status-request·pause/resume만 허용한다. approval/merge/deploy/apply/delete/권한/Provider/credential/설계 확정 등 다른 명령은 `CONSOLE_STEP_UP_REQUIRED`; approval 객체/원장/외부 실행0이다.
- update는 정확한 builtin field 집합, update_id 범위, UTC window, PRIVATE artifact ref/hash, retention 및 bounded opaque metadata만 허용한다. raw text/body/token/username/임의 parameter는 받지 않는다. 실제 artifact bytes 검증·Telegram webhook schema parsing은 이 host-normalized 계약 밖이다.
- normalized update+binding hash가 C25 correlation identity에 들어간다. 따라서 다른 adapter 인스턴스로 같은 update/nonce/idempotency를 이용해 pause를 resume으로 바꾸어도 C25가 conflict로 거부한다. rate/nonce/idempotency는 C25 owner에 맡기며 별도 상충 owner를 만들지 않는다.
- deep-link는 검증한 opaque session ID로 생성한 same-origin 상대경로 `/sessions/<session_id>`뿐이다. 외부 URL/임의 path/query/credential input은 없다. 실제 UI route/HTTP 동작은 검증하지 않았다.
- 모든 delivery `NOT_EXECUTED`, automatic_acceptance false, runner_dispatch/io_count0. audit는 sequence/receipt hash/status/time만 보존하며 chat/user hash도 감사 페이지에는 싣지 않는다. bindings128/audit512/page50 및 기존 C25 limits를 적용한다. 반환 snapshot은 detached이며 강제 변조가 내부 record를 바꾸지 않는다.
- **owner 경계:** C25 admission이 먼저 기록된 후 C26 local receipt 생성이 실패할 수 있다. C25의 이미 기록된 감사/nonce/rate를 임의 rollback하지 않는다. 이때 C26 receipt/audit0, 외부 send0이고 동일 요청 retry는 같은 C25 receipt를 회수해 추가 rate 소비 없이 C26 게시1로 수렴한다. 이 동작을 fault injection으로 검증했으며 cross-owner transaction/DB durable exactly-once PASS로 승격하지 않는다.
- local DTO 준비 뒤 C25 권한과 binding 및 C23 observation hash를 재검사하고 local 상태 pointer를 한 번 게시한다. 준비 중 role revoke는 local publication0으로 거부하고 선행 C25 audit1은 정직하게 보존한다.

## RED → GREEN

TDD로 최초 missing-class RED를 실행한 뒤 최소 구현했다. 별도 적대 보강은 실제 C25/C22/C23 owner를 사용했다.

| 실행 | exit / 결과 | 판단 |
|---|---|---|
| 최초 focused RED | 1 / 31 failed, 0.77s | C26 gateway adapter missing assertion |
| 최소 GREEN | 0 / 31 passed, 0.86s | low-risk/high-risk/trace/replay/privacy 경계 구현 |
| 적대 보강 | 0 / 47 passed, 1.64s | foreign binding, revoke 중 게시, callback, 100중복, publication recovery 등 |
| 상태 observation RED | 1 / 1 failed, 0.80s | constructor에 실제 team owner 입력 미구현 |
| 상태 observation GREEN | 0 / 48 passed, 1.78s | 공개 C23 current 상태와 projection hash 결박 |

RED 및 개발 내 보완은 정식 FAILURE_REPORT가 아니며 count0이다. legacy·실행환경·checker 경계와 제품 결과를 혼합하지 않았다.

## 정확한 명령 / 결과

cwd는 위 canonical root, Python은 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`.

Focused F — exit0 **48 passed in 1.78s**, skip0:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_telegram_adapter_c26.py tests/agent_team/test_telegram_contracts_c26.py tests/agent_team/test_telegram_privacy_c26.py tests/agent_team/test_telegram_replay_c26.py --tb=short
```

별도 상태 observation RED 명령:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_telegram_contracts_c26.py::test_status_reads_current_c23_observation_without_changing_team --tb=short
```

전체 agent_team 회귀 — exit0 **728 passed in 663.42s (0:11:03)**, skip0. 실제 종료 출력 확인: exec session `94350`, final chunk `095bd5`:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team --basetemp=D:/Project/Anvil/.codex-sandbox/c26-full-temp-20260919-01 --tb=short
```

```text
...                                                                 [100%]
728 passed in 663.42s (0:11:03)
exit_code: 0
```

비-E06 회귀 — exit0 **672 passed in 14.08s**, skip0:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team --ignore=tests/agent_team/test_worktree_writes_e06.py --basetemp=D:/Project/Anvil/.codex-sandbox/c26-fast-temp-20260919-01 --tb=short
```

Legacy Telegram 단독 — exit0 **9 passed in 0.75s**, skip0:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/agent_team/test_telegram_adapter.py --tb=short
```

구문 — exit0 `COMPILE6 PASS; pycache0`:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/agent_team/telegram_adapter.py','packages/agent_team/__init__.py','tests/agent_team/test_telegram_adapter_c26.py','tests/agent_team/test_telegram_contracts_c26.py','tests/agent_team/test_telegram_privacy_c26.py','tests/agent_team/test_telegram_replay_c26.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE6 PASS; pycache0')"
git diff --check
```

diff-check exit0/출력0. `git diff --numstat -- packages/agent_team/telegram_adapter.py packages/agent_team/__init__.py` exit0: adapter175/0, __init__16/2(기존 C22~C25 누적 delta 포함, C26은 2줄만 추가).

Checker — exit1 **NOT_VERIFIED/NOT_PASS**:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
```

기존 `scripts/check_project_progress.py:32957` 과거 C03 embedded fixture 문자열에서 `SyntaxError: leading zeros in decimal integer literals are not permitted; use an 0o prefix for octal integers`. parsing 전에 종료하여 canonical 검증은 수행되지 않았다. Main 소유의 기존 손상으로 해당 파일을 수정하지 않았고 제품 테스트로 checker PASS를 대체하지 않았다.

## 미검증 / 다음 조치 / rollback

- 실제 Telegram SDK/network/webhook/bot token/외부 인증·계정·send/delivery, Provider/DB/WSL/UI/Oracle/deploy는 NOT_EXECUTED. 실제 서명 authenticity, HTTP routing, queue/Runner 연결, durable store/restart, artifact content resolution은 NOT_INTEGRATED.
- legacy 테스트의 synthetic HMAC은 기존 계약 회귀일 뿐 실제 Telegram 인증 증거가 아니다. 신규 adapter는 서명·secret 함수를 호출하지 않는다.
- 전체 회귀의 E06만 기존 격리 임시 Git fixture를 사용한다. canonical worktree stage/commit/push/merge0. 전용 basetemp 산출물은 진단 증거로 남기며 범위 밖 수동 cleanup은 하지 않는다.
- 독립 검토/Main acceptance 및 canonical checker 복구는 Main 소유다. 전체 회귀 종료 증거를 반영했으며 제품 확장이나 후속 Package 시작 없이 인계한다.
- rollback은 C26 adapter의 additive block, __init__ 2줄, 신규 테스트4/본 보고서만 대상으로 Main 검토하에 수행한다. 기존 Telegram 본문, C25 이하 제품/control, 기존 dirty/untracked를 보존하며 reset/clean/stash/광범위 삭제는 사용하지 않는다. progress/HANDOFF 미갱신.

## SHA256

| 경로 | SHA256 |
|---|---|
| packages/agent_team/telegram_adapter.py | 5062F6F1A96F93D24E4AF1156E0E0CDADCC0E017AC67DAE283371CC002D37A05 |
| packages/agent_team/__init__.py | 057D06375667D00043EF8EC5A141A3E6DA34844C4405C709BF394A3A086F3E9F |
| tests/agent_team/test_telegram_adapter_c26.py | AD263832ECE906F58503815886FCE82BDE3C5A80CE59E6140C75049FD5B33F62 |
| tests/agent_team/test_telegram_contracts_c26.py | 613BBC96AEFFE6894BE06E0813D21EDA511D4393A735877C129B46293EC35EFF |
| tests/agent_team/test_telegram_privacy_c26.py | CACE9E395F90576D28DC1D333AB578A18CBEFD874A8348696E10BFE63CA7AD0A |
| tests/agent_team/test_telegram_replay_c26.py | E97F497219208045D3F3368B355C1ACA039A6519F91ED28E4B7A33584E8EE0C8 |

보고서 자체 SHA는 최종 응답에서 제공한다.
