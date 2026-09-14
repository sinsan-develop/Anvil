# C-10 Main takeover 완료보고서

## 판정

`COMPLETED_ACCEPTED` — 신산님의 `Main takeover 승인`에 따라 동일 근본 원인 3회 실패 뒤 Main Agent가 C-10 exact6을 직접 인수했다. 누적 독립 review의 command effect, raw-secret, hostile Mapping 예외를 TDD로 수정했고 전체 회귀를 통과했다. 최종 독립 Spec/Quality review는 모두 blocking 0 `PASS`이며 canonical seq865에서 C-10을 `ACCEPTED`로 전이했다.

## 기준선·승인·유효 lease

- branch: `codex/c09-execution-backends-r1`
- takeover predecessor: `e416898d231e0f6ef72d01c85378c0f3e48a0d11`
- takeover start control HEAD: `b855377fbd7e740a9274e1084cb5a2af4308d664`
- canonical progress sequence: `855`
- user direction: `Main takeover 승인`
- user direction SHA-256: `935088D3CD683FE8A10965538301343FA251C9AD61AAFAC7679F534A5831DE78`
- TakeoverPacket SHA-256: `C2E6EFE0D24806FD7F479085A5796AB2C6EDB6B1BDECF12F3F7DBADE6DA6B6EA`
- WorkInstruction: `docs/work_orders/C-10_MAIN_TAKEOVER_WORK_INSTRUCTION.md`
- WorkInstruction SHA-256: `071565E3485134ECE6CC5A148F9B828FDF706B858ACE6310F54754FD8C32F486`
- invocation prompt SHA-256: `5666C63C09B5CCBDA03AD69A7F82848A8A37F7C4FCAB4EC226DC6E00B3948AA8`
- worker lease: `worker-lease-c10-main-takeover-20260914-004`
- execution fencing token: `c10-main-takeover-execution-fence-epoch-4-8d2f71c5a6094be3`
- write lease: `write-lease-c10-main-takeover-20260914-004`
- write fencing token: `c10-main-takeover-write-fence-epoch-4-5b17e2d94c8a603f`
- lease expires: `2026-09-14T19:33:00+09:00`

제품 mutation과 검증은 epoch4 아래 exact6에 한정했다. 이전 epoch lease와 실패 결과를 현재 쓰기 권위로 사용하지 않았다.

## 인수 사유와 blocking findings

R1/R2의 독립 재검토에서 같은 command/secret fail-open 근본 원인이 3회 반복되어 기존 Developer lease를 회수하고 `WAITING_APPROVAL`로 중단했다. 신산님 승인 뒤 Main takeover를 시작했다.

초기 takeover 수정 대상과 첫 독립 재검토에서 추가 확인된 대상은 다음과 같다.

1. read/verify처럼 보이는 명령도 `argv`와 environment effect에 따라 파일 출력, 외부 helper, 저장소 범위 이탈, install, destructive temp/path mutation을 수행할 수 있었다.
2. `python -B -m pytest ...` 같은 안전한 표준 검증 명령이 interpreter flag 때문에 거부됐다.
3. `apiKeyValue`, `apiKeyHeader`, `privateKeyPem`, `privateKeyValue` raw-secret suffix 변형이 허용됐다.
4. hostile `Mapping`이 `OSError`를 발생시키면 `ActionRequest` 생성 밖으로 raw 예외가 탈출했다.
5. 첫 독립 Spec review는 외부/저장소 내부 가짜 executable 경로, pytest `-o/--override-ini` cache 경로와 일반 `Exception` Mapping을 재현해 blocking 2건 `REWORK`를 판정했다.
6. 첫 독립 Quality review는 Git protected-path 및 signature helper, pytest/mypy config/cache, Unicode confusable·Auth·Cookie·Basic Secret, `LookupError` Mapping을 재현해 Critical 1·Important 2 `REWORK`를 판정했다.
7. 두 번째 독립 Spec/Quality review는 외부 positional/plugin/discovery, unscoped Git diff/history, attr pathspec, 추가 pytest/mypy 출력 옵션, zero-width/confusable/Digest/Cookie credential을 각각 Critical 1·Important 1로 판정했다.
8. 세 번째 독립 review는 pytest cache/Python bytecode, Git patch synonym·remote·external exclude·custom protected path, mypy long-option abbreviation·Junit output·파일명 과차단, combining/delimiter/JWT/session/AWS credential을 blocking으로 판정했다.
9. 네 번째 독립 Spec review는 Git long-option abbreviation·remerge diff와 빈 서명 unsecured JWT 4건을 `REWORK`로 판정했다. 동일 제품 상태의 독립 Quality review는 blocking 0 `PASS`였다.
10. 다섯 번째 독립 Spec review는 외부 파일을 읽는 Git short option `diff -O<file>`·`ls-files -X <file>`과 완료보고서 증거 불일치를 `REWORK`로 판정했다.

## exact6 변경과 전후 차이

- `packages/action_policy/admission.py`: 명령을 executable/subcommand/argv/effect로 분류하되 bare canonical executable만 허용하고 모든 `env` wrapper와 Git global option을 fail-closed한다. Git diff는 authority의 custom protected path까지 제외한 repo-relative target이 명시된 경우만, show/log는 patch synonym·combined short option이 없는 no-patch metadata 형태만 허용한다. remote URL, external exclude/pathspec/order file, Git long-option abbreviation 및 `-O`/`-X` short file-input을 거부한다. pytest는 `python -B`, `-p no:cacheprovider`, 승인된 core option, repo-relative target을 필수화하고 직접 pytest executable은 거부한다. unittest/mypy도 외부 import/discovery/path를 차단하며 mypy long-option abbreviation을 canonical unsafe option 집합에 대조해 output/config/cache/helper는 막고 정상 `config.py`/`report.py` 대상은 보존한다. raw-secret key/value는 NFKD 후 format/combining mark를 역할에 따라 제거하고 mixed-script/confusable/internal delimiter, signed 또는 빈 서명 JWT, session/Auth/Cookie/Basic/Bearer/Digest/ApiKey/Token/AWS credential을 거부한다.
- `packages/action_policy/policy.py`: request arguments와 authority freeze에서 일반 `Exception` 계열을 raw 내용 없이 구조화해 `INVALID_ACTION` 또는 invalid authority로 닫는다.
- `tests/action_policy/test_c10_policy.py`: takeover 및 여섯 차수의 review 회귀, safe command compatibility와 추가 동일근본 우회를 누적해 focused 총 271건으로 확장했다.
- `packages/action_policy/__init__.py`, `tests/action_policy/test_policy.py`: 승인된 누적 C-10 공개 계약과 기본 회귀를 유지했다.
- `docs/04_test_reports/C-10_COMPLETION_REPORT.md`: seq855/epoch4와 실제 takeover 증거로 갱신했다.

변경 전에는 정확한 ordinary grant만 있으면 `git diff --output`, `git --ext-diff`, `env GIT_EXTERNAL_DIFF=...`, `env GIT_DIR=...`, `git -C`, 가짜 executable 경로, Git protected-path/signature helper, `--remerge-diff`, `-O`, `-X`, mypy install/config/cache, pytest basetemp/config/report/network가 `ALLOW`였다. suffix/confusable/Auth/Cookie/Basic Secret, 빈 서명 JWT와 hostile Mapping 예외도 fail-open했다. 변경 후 동일 입력은 원문이나 Secret 값을 receipt에 싣지 않고 `UNSAFE_COMMAND_DENIED`, `SECRET_INPUT_DENIED`, `INVALID_ACTION`으로 결정된다.

## TDD checkpoint

- RED: `python -m pytest tests/action_policy/test_c10_policy.py -q` — exit 1, `16 failed, 169 passed in 0.37s`.
- 최초 GREEN: 같은 명령 — exit 0, `185 passed in 0.19s`.
- Python 대소문자 경계 보강 후 focused GREEN: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py` — exit 0, `187 passed in 0.26s`.
- 첫 독립 재검토 RED: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py -k "r2_review"` — exit 1, `17 failed, 187 deselected in 0.28s`.
- 첫 독립 재검토 targeted GREEN: 같은 명령 — exit 0, `17 passed, 187 deselected in 0.12s`.
- 동일 근본 원인 보강 후 focused GREEN: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py` — exit 0, `211 passed in 0.28s`.
- 두 번째 독립 재검토 RED: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py -k "r3_review"` — exit 1, `20 failed, 8 passed, 211 deselected in 0.31s`.
- 명령별 allow grammar 및 credential canonicalization 1차 GREEN: 같은 명령 — `27 passed, 1 failed, 211 deselected`; `Basic` zero-width separator 1건이 남았다.
- zero-width key/value 역할 분리 후 targeted GREEN: 같은 명령 — exit 0, `28 passed, 211 deselected in 0.12s`.
- 외부 unittest dotted import와 mixed-script key 보강 후 focused GREEN: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py` — exit 0, `241 passed in 0.38s`.
- 세 번째 독립 재검토 RED: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py -k "r4_review"` — exit 1, `24 failed, 241 deselected in 0.33s`.
- authority-bound grammar·mypy option canonicalization·credential 확장 후 targeted GREEN: 같은 명령 — exit 0, `24 passed, 241 deselected in 0.12s`.
- 세 번째 보완 후 focused GREEN: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py` — exit 0, `265 passed in 0.34s`.
- 네 번째 독립 재검토 RED: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py -k "r5_review"` — exit 1, `4 failed, 265 deselected in 0.16s`.
- Git long-option/remerge 및 빈 서명 JWT 보완 후 targeted GREEN: 같은 명령 — exit 0, `4 passed, 265 deselected in 0.09s`.
- 네 번째 보완 후 focused GREEN: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py` — exit 0, `269 passed in 0.32s`.
- 다섯 번째 독립 재검토 RED: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py -k "r6_review"` — exit 1, `2 failed, 269 deselected in 0.15s`.
- Git `-O`/`-X` 보완 후 targeted GREEN: 같은 명령 — exit 0, `2 passed, 269 deselected in 0.10s`.
- 다섯 번째 보완 후 focused GREEN: `python -B -m pytest -q -p no:cacheprovider tests/action_policy/test_c10_policy.py` — exit 0, `271 passed in 0.38s`.

RED 16건은 리뷰에 명시된 command effect 10건, 안전한 `python -B` 호환 1건, hostile `OSError` 1건, raw-secret suffix 4건이다. 후속 `-I` 허용 및 `-i` 거부 계약도 통과했다.

## 최종 검증

| 검증 | 실제 명령 | 결과 |
|---|---|---|
| C-10 + C-09 gateway 회귀 | `python -B -m pytest -q -p no:cacheprovider tests/action_policy tests/tool_gateway` | PASS, `300 passed in 0.48s`, exit 0 |
| C-09 authoritative regression | `python -B -m pytest -q -p no:cacheprovider tests/paths tests/execution_backends tests/tool_gateway tests/integration/test_c09_repository_workspace.py --disable-warnings -ra` | PASS, `106 passed in 172.01s`, exit 0 |
| syntax | `python -B -m compileall -q packages/action_policy packages/tool_gateway tests/action_policy tests/tool_gateway` | PASS, exit 0 |
| whitespace | `git diff --check` | PASS, exit 0 |

초기에 존재하지 않는 `tests/tool_gateway/test_c09_gateway.py`와 `test_c09_contract.py`를 지정한 시도는 exit 1, `no tests ran`으로 끝났다. 이는 코드 실패나 PASS 증거가 아니며 위 authoritative 명령으로 교정했다.

모든 policy decision은 순수 계산이며 `io_count=0`을 유지한다. C-09 read gateway 회귀도 최종 제품 상태에서 다시 통과했다.

최종 독립 재검토는 동일 exact6 snapshot에서 다음과 같이 판정했다.

- Spec: `PASS`, Critical 0 / Important 0 / Minor 0. R6 targeted 2 PASS, 전체 300 PASS, C-09 106 PASS, diff check PASS.
- Quality: `PASS`, Critical 0 / Important 0. 전체 300 PASS, C-09 106 PASS, diff check PASS.
- 공통 경계: 실제 dispatch, Secret Broker, network/DNS, filesystem/subprocess, DB/API/UI/browser/WSL/Docker/deployment는 검증하지 않았다.

## 미검증·잔여 위험

- 실제 Tool Gateway가 action evaluator를 소비하는 dispatch integration은 아직 없다. pure admission contract만 검증했으며 실제 write/execute admission 연결은 `UNVERIFIED`다.
- 별도 destructive authority schema와 실행 경로는 이번 범위에 없으며 `UNVERIFIED`다. ordinary authority에서는 mutation·unknown/environment-wrapped command가 fail-closed된다.
- 실제 Secret Broker material injection·audit·rotate/revoke, DNS resolver·egress proxy·socket connect-time check, filesystem/subprocess mutation은 실행하지 않았다.
- DB/API/browser/WSL/Docker/deployment와 운영 검증은 수행하지 않았다.
- 실제 실행 계층은 canonical command identity, repository identity, environment와 fencing을 사용 시점에 다시 확인해야 한다.
- 첫 번째부터 다섯 번째까지 독립 Spec/Quality review의 `REWORK`를 반영했고 최종 독립 Spec/Quality review는 blocking 0 `PASS`다.
- epoch4 lease 만료를 seq856~857에서 회수하고 epoch5를 seq858~860에서 발급·재검증했으며, seq861~865에서 lease 회수·완료·독립판정·Main acceptance를 기록했다.

## rollback

Main Agent가 exact6 및 acceptance control을 local commit으로 고정한 뒤 문제가 발생하면 그 commit을 정상 revert한다. commit 전에는 combined exact13만 대상으로 하며 다른 dirty/untracked 파일은 변경하지 않는다.

현재까지 push·PR·merge·외부 API·브라우저·WSL·Docker·deploy는 수행하지 않았다.
