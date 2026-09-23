# E-07 R1 완료보고 — 실패 정책과 exception inbox (independent review 보완 포함)

## 판정

- 상태: `COMPLETED` — 제품/관련 회귀/구문/diff와 canonical checker 검증 완료. 독립 acceptance 전 Developer 완료다.
- 담당: `developer-primary-e07-r1`. Developer evidence이며 Main acceptance 또는 독립 Reviewer/Tester 합격을 자동 생성하지 않는다.
- formal product failure count: **0**. TDD 의도된 RED와 발효 전 lease 시각 정정은 정식 실패가 아니다.
- 최신 independent review rework: 1 round, 지연 hard-stop 시각 및 custom mutable tzinfo 2 findings 해소. Main 지시에 따라 formal failure count는 증가시키지 않았다. 최신 수치는 마지막 보완 절의 **91 PASS / 761 PASS·1 SKIP**이다.

## 판단 이유

### 권위와 기준선

- cwd: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- HEAD/upstream 시작 기준: `8d65c871c119d6f3b195f00e53e7e18bd2dba991`; 최종 HEAD 동일. 원격/외부 네트워크 재조회는 하지 않았다.
- 설계 SHA256: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- 계획 SHA256: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- WI: `WI-E-07-R1-20260917-001`, SHA256 `64C4828CF385053DD7CC9E31F5DA531253B2C0F7829F49C125AF7C769A5C592D`
- invocation SHA256: `909E1B9E4D968CD471BEBDA6B0BAC342759E2CA897C7AFF15830C7AD93215D61`
- 권위: 설계 §7.5/§47.4/§47.7/§47.18-7~8, 계획 E-07; AV-SAFE-020, AV-AGT-035/036, AV-FLOW-007/008.
- E-06 ACCEPTED. Main start control seq1128 이후 lease 시각 정정 seq1133. 원 WI/Prompt는 그대로 보존되고 correction이 epoch2를 정본으로 supersede한다.
- worker: `worker-lease-e07-r1-20260917-002`; execution fence: `e07-r1-execution-fence-epoch-2-8d65c871c119d6f3`
- write: `write-lease-e07-r1-20260917-002`; write fence: `e07-r1-write-fence-epoch-2-b195f00e53e7e18b`
- 발효 `2026-09-17T20:31:40+09:00` ~ 만료 `2026-09-18T08:31:40+09:00`. mutation 전과 회귀 전 seq1133/ACTIVE/양 token/exact4를 확인했다.
- 초기 제품 변경0, Main control9 dirty. Main 정정 후 control11 dirty를 보호했다. 제품 exact4를 더한 최종 예상 dirty **exact15**, staged0. Main control11은 이 Developer가 수정하지 않았다.

### 구현·계약 판단

- E04 `TaskGraph`/`DagNode`의 `snapshot_graph`를 재사용하고 등록 시 hash, node/dependency, required 집합, 명시 정책/revision을 결박했다. 소비 때 graph canonical hash를 재검증한다.
- `STOP`: 실패 이후 nonterminal은 차단, Run FAILED. `CONTINUE_INDEPENDENT`: 안전한 독립 Step 완료 후 FINISHED_WITH_FAILURES. `COLLECT_AND_REVIEW`: 수집 중 ACTIVE, 완료 후 AWAITING_EXCEPTION_REVIEW.
- 실제 실패 Step의 transitive descendant만 BLOCKED_DEPENDENCY. unrelated conflict-group 또는 independent=False는 BLOCKED_RUN_STOP, 그 중단 node의 대기 자손도 RUN_STOP으로 분리한다. unrelated safe independent Step은 유지한다. 이 구분은 Main이 승인한 기존 범위 내 판단이다.
- 다섯 hard code는 severe=False라도 모든 정책을 무시하여 Run BLOCKED. 늦은 안전 증거는 append-only inbox에 추가하고 과거 terminal Step 결과를 덮지 않으면서 Run을 차단한다.
- `BUDGET_HARD_LIMIT`은 구성된 안전 hard policy 위반이다. Main ruling에 따라 E07 BLOCKED로 처리한다. `QUOTA_EXHAUSTED`는 `E08_NOT_IMPLEMENTED`로 거부한다. 예약/회계/자동 재개/PAUSED_QUOTA 생성은 구현하지 않는다. 기능/요구/중요위험 변경 없는 package ownership 해석이다.
- 결과 SUCCEEDED는 EXECUTED evidence만 인정한다. MOCK/FIXTURE/STATIC/BUILD/SKIPPED/BLOCKED 기반 성공 주장은 UNVERIFIED로 기록한다. required 실패/차단/미검증 및 optional 실패도 전체 SUCCEEDED로 승격하지 않는다.
- immutable exception/event/receipt, canonical fingerprint/hash, exact replay, conflicting replay 거부, UTC causal ordering, unknown Step/revision 거부. 하나의 local RLock 아래 callback-free 상태 publication; fallible projection/serialization은 publish 전에 수행한다.
- 반환 graph 영향, inbox/event/receipt/steps alias를 차단한다. graph 128 nodes/512 edges, run별 events 512개 상한으로 projection이 유한하다. raw transcript/임의 메시지를 받지 않고 code와 hash/reference identity만 기록한다.
- Host-only domain consumer다. `EXECUTED` 또는 안전 classification의 실제 source 진위는 기존 host validation 경계에서 검증 후 전달해야 한다. 이 facade가 에이전트 self-claim을 독립 검증/인증하거나 새 권위를 발급하지 않는다.
- queue/worker dispatch, Main acceptance, Step owner 전이, Release/Apply 생성은 **0**. 기존 C07 outcome resolver/ledger/takeover 및 E04~06 owner는 변경하지 않았다.

## 조치

### 변경 exact4와 diff

1. `packages/orchestration/exception_resolver.py`: 신규 340행(최초333→review 보완340). 정책, immutable inbox/event/receipt/projection 및 순차 resolver.
2. `packages/orchestration/__init__.py`: additive +12/-0. 기존 import/schema를 보존하는 E07 lazy exports.
3. `tests/orchestration/test_exception_resolver_e07.py`: 신규 424행(최초332→review 보완424), 최신 focused 91 cases.
4. `docs/04_test_reports/E-07_COMPLETION_REPORT.md`: 본 보고 신규.

기존 제품 파일 삭제/전체 재작성0. 신규 파일은 untracked이므로 기본 `git diff --numstat`에 나오지 않음을 구분한다. Git stage/commit/push0, control/progress/HANDOFF write0.

### RED → GREEN 실제 기록

공통 focused 명령:

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/orchestration/test_exception_resolver_e07.py --tb=short
```

- 최초 RED: exit1, **3 failed / 0 passed**, 0.68s. `ModuleNotFoundError: packages.orchestration.exception_resolver`.
- 최소 정책 구현 GREEN: exit0, **3 passed**, 0.54s.
- hard-stop/replay/validation/no-false-success 확장 RED: exit1, **41 failed / 3 passed**, 0.80s. missing hard-stop/unsafe-independent filtering, inbox/replay/invalid-input guard, real-evidence distinction.
- 해당 구현 GREEN: exit0, **44 passed**, 0.65s.
- 보강 RED: exit1, **3 failed / 66 passed**, 0.84s. 늦은 hard-stop가 STEP_TERMINAL로 거부되는 2건, public export 미정의 1건.
- 최종 focused GREEN: exit0, **69 passed**, 0.73s. 100-way 동일 전달은 정확히 1 event/receipt; serialization fault publication0 + retry recovery; detached forced mutation; 모든 정책/required·optional 경계 포함.
- 위 RED는 test-first 개발 증거이며 정식 실패 fingerprint/count에 산입하지 않는다.

### 관련 회귀·정적 검사

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/orchestration tests/queue tests/agent_team/test_concurrency_e05.py --basetemp=D:/Project/Anvil/.codex-sandbox/e07-r1-related-20260917a --tb=short
```

exit0: **739 passed, 1 skipped**, 2.92s.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/orchestration tests/queue tests/agent_team/test_concurrency_e05.py --basetemp=D:/Project/Anvil/.codex-sandbox/e07-r1-related-20260917b --tb=short -rs
```

exit0: **739 passed, 1 skipped**, 3.17s. SKIP: `tests/queue/test_durable_queue.py:99`, isolated PostgreSQL 18 DSN not configured. 실제 PostgreSQL PASS로 표시하지 않는다.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths = ['packages/orchestration/__init__.py', 'packages/orchestration/exception_resolver.py', 'tests/orchestration/test_exception_resolver_e07.py']; [compile(Path(p).read_bytes(), p, 'exec') for p in paths]; print('COMPILE_PASS', len(paths))"
git diff --check
git diff --cached --name-only
```

각 최종 단독 실행 exit0: 구문 `COMPILE_PASS 3`, diff-check 오류0, staged 출력0. pyc 생성 없이 builtin compile로 정확 세 파일 검증했다. Main control 보완 후 focused fresh 재실행 exit0 **69 passed in 0.98s**.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py
```

- 최초 exit1: `E07_LEASE_TIME_CORRECTION_GIT_INVALID`. seq1133 correction collector가 control exact11만 허용하고 정상 제품 exact4 추가(exact15)를 거부한 **Main control validator 결함**이었다. Developer는 control을 수정하지 않고 대기했다. 제품 실패 count에는 포함하지 않는다.
- Main이 control exact11 및 제품 exact4가 추가된 정상 exact15 허용, staged/escape 거부를 TDD로 보완했다. 그 후 Developer fresh 재실행 **exit0, `PASS sequence=1133 reporting=AUTO_CONTINUE`**.
- 최종 dirty exact15 = 보호 Main control11 + 제품 exact4, staged0. 양 lease ACTIVE 유지. Main acceptance/후속 Package 전이 없음.
- review 전 제품 SHA256: `__init__.py` = `8784175763D72F61EA8AD8507D02BF769845137A84017C200113A1E3CDFBA67D`; `exception_resolver.py` = `FD01AA5DE7B24E15359304A210D8D679D92F994BE99275100E66D45ABBC291C5`; 테스트 = `E54710A86A7AEECDB80BFEA3170ED7B1C32099E1DD54C91A8EC12EC266153076`. 최신 hash는 아래 보완 절이 supersede한다. 본 보고서 self-hash는 내부에 재귀 결박하지 않는다.

임시 basetemp 두 경로는 명시적으로 지정했으나 테스트 종료 후 **존재하지 않음**을 확인했다. Get-Item은 이 부재에 PathNotFound 진단을 냈다(제품 실패 아님). 제거한 사용자 파일0, 잔여 테스트 temp0. Git은 sandbox global ignore 경로 읽기 permission warning이 있으나 명령 성공이며 저장소 오류로 취급하지 않았다.

### 미검증·잔여 위험·rollback

- 실제 Provider/HTTP/UI/DB/WSL/배포/운영 실행 `NOT_EXECUTED`. PostgreSQL 18 DSN 검증1 SKIP. DB durable inbox와 다중 프로세스 atomicity `NOT_INTEGRATED`.
- E08 quota/accounting/reservation/auto-resume, E09 Gate, E10 Git adapter, 실제 worker dispatch는 구현하지 않았다. 이 run projection이 실제 scheduler를 자동 중단시키는 runtime 연결도 `NOT_INTEGRATED`다.
- local host 검증된 입력을 받아 결정론적 상태를 계산하는 계약 범위다. 외부 evidence authenticity, process crash persistence/recovery를 증명하지 않는다.
- Developer 자체 테스트는 최종 독립 검증을 대체하지 않는다. 다음 조치는 Main의 독립 review/test와 acceptance 판단이다.
- rollback: Main이 product exact4 diff를 검토해 신규3파일만 회수하고 `__init__.py`의 E07 additive12행만 역패치한다. control11과 기존 unrelated bytes는 보존한다. 이 작업에서 rollback/Git mutation은 수행하지 않았다.
- 실행계획/TDD/검증-before-completion skill을 승인된 WI와 exact4 범위에 적용했다. 추가 문서·agent·Git 작업 없이 RED 증거 후 구현, fresh 검사 후 판정을 기록했다.
- canonical progress/HANDOFF는 Main 소유로 **미갱신**. seq1133/E07 IN_PROGRESS/active dual lease 유지; acceptance/lease revoke/E08 시작0.

## Independent review rework — 지연 안전 증거와 UTC immutability

### 판정

`COMPLETED`(독립 재판정 전). review finding 2건 보완, formal product failure count **0 유지**. 동일 epoch2 lease와 product exact4 안에서 module/test/report 3개만 추가 수정하고 `__init__.py`/control11은 그대로 보존했다.

### 판단 이유

- 지연 hard-stop 재현: a EXECUTED SUCCEEDED(t0), d EXECUTED SUCCEEDED(t1) 뒤 a SECRET_ACCESS(t0)가 도착하면 global PAST_EVENT 검사가 hard 분류보다 먼저 작동하여 Run ACTIVE/ready b를 유지했다. 코드 흐름과 실제 RED로 확인했다.
- 수정: hard classification을 시간 역행 검사보다 먼저 판정하고 safety evidence만 arrival sequence append를 허용한다. 원 occurred_at은 보존한다. ordinary 시각 기준은 마지막 도착 event가 아닌 전체 event의 최대 occurred_at이므로, 늦은 안전 증거가 ordinary causal clock을 되감지 않는다. 기존 terminal Step와 이전 event는 불변, pending 모두 RUN_STOP, Run BLOCKED, exact replay/conflict 및 publish-last 원자성 유지.
- UTC 재현: custom mutable tzinfo callback이 통과하고 event에 보존되어 이후 offset/hash가 달라질 수 있었다. exact builtin datetime + exact builtin timezone만 callback 전에 확인하고 UTC offset만 허용한다. 새 builtin UTC datetime을 만들어 그 값만 request hash/event/inbox에 저장한다. custom tzinfo와 datetime subclass는 실행 없이 UTC_TIMESTAMP_REQUIRED; naive/non-UTC도 계속 거부. 정상 builtin UTC 의미는 보존한다.
- 적용 스킬: receiving-code-review/systematic-debugging으로 원인·재현을 확인한 뒤 test-driven-development에 따라 RED 후 최소 구현. 범위 밖 리팩토링/통제 변경0.

### 조치와 fresh 실행 증거

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/orchestration/test_exception_resolver_e07.py --tb=short
```

- RED exit1: **19 failed, 72 passed in 1.24s**. 지연 hard-stop matrix/fault case PAST_EVENT 16건, mutable tzinfo 허용2건, builtin UTC normalization 누락1건.
- GREEN exit0: **91 passed in 0.85s**. 3 policies × 5 hard codes, original time/arrival sequence, ordinary PAST_EVENT, replay/conflict, terminal 보존, serialization fault 후 publication0/retry, timezone callback0/alias 차단을 검증했다.

```text
D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/orchestration tests/queue tests/agent_team/test_concurrency_e05.py --basetemp=D:/Project/Anvil/.codex-sandbox/e07-review1-related-20260917 --tb=short -rs
```

exit0: **761 passed, 1 skipped in 3.10s**. 기존 PG18 DSN 미설정 skip1 동일. 전후 Test-Path False로 신규 basetemp 잔류0 확인, 사용자 자료 삭제0.

위 보고서의 정확한 builtin compile 명령 fresh exit0 `COMPILE_PASS 3`; canonical checker 명령 fresh exit0 `PASS sequence=1133 reporting=AUTO_CONTINUE`; `git diff --check` fresh exit0. dirty exact15/staged0 유지. 실제 외부 runtime/DB/worker 미검증 경계와 rollback은 이전 절 그대로다.

최신 SHA256: resolver `51242F6D6FA3806414C1BFE597CC82DE630184A77AB80F98823BD597B3BC1DFD`, test `73E8E2D771B7D173199DC6746325B85AB9C6E0AFC2B65FC5951A2416B5C1066B`. 보고서 self-hash 제외. 다음 조치: Main 독립 재검토; acceptance/lease revoke/Git publication/E08 시작은 수행하지 않았다.
