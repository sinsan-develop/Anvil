# C-09 R4 제품 독립 Quality / Concurrency / Security Review 원문

## 판정

REWORK_REQUIRED — Critical 0 / Important 11 / Minor 0.

본 문서는 reviewer가 확정한 R4 quality 최종 판정과 11개 finding 및 독립 hostile probe 근거를 기록한다. Developer 완료보고를 승인하는 문서가 아니며, 제품 수정이나 후속 구현을 포함하지 않는다. 별도 spec review와 severity를 합산하여 새로운 quality 판정을 만들지 않는다.

동일 R4 제품 snapshot을 검토한 spec/quality 두 결과는 동일 package의 한 review cycle이다. 앞선 유효 product failure 2회에 이번 유효 REWORK_REQUIRED를 한 번만 더하여 valid_failure_count=3, same_failure_count=3, rework_attempt=3으로 판단한다. 이는 formal Developer FAILURE_REPORT를 만들어내는 것이 아니다. R4 WI의 MAIN_TAKEOVER_AT_3에 따라 Developer 중지 → epoch3 write lease 회수 → worker lease/도구 실행권 회수 → TakeoverPacket → Main 순차 인수가 필요하다. 같은 Developer R5 재지시는 금지한다. 이 보고 자체가 lease를 실제 회수하거나 Main 실행권을 발행하지는 않는다.

## 검토 대상과 보존

- 저장소: D:/tmp/anvil-main-integration
- reviewed HEAD: 85d72196eaafe3e458f8aea7016df94f810df086
- sole parent: 74f9878de521a6bc5a2c4f5165332c76edfc1354
- branch: codex/c09-execution-backends-r1
- upstream: development/main
- reviewed 상태: unstaged product exact18, staged0. tracked dirty10 + untracked8.
- 제품 exact18 경로 hash: AC308DAC4396006ABA4FFD3CCDB44FA90063F787C88EAA9F7E6B86E541D0887F
- 제품18 raw map hash: 6AE618D40896B16A0AD69BFBEDFBB900F9B2E22F9FEDD9DF8750F5C2C77B58AF
- raw map hash 정의: 각 경로의 {bytes, sha256}를 가진 object를 json.dumps(ensure_ascii=False, sort_keys=True, separators=(',', ':'))로 UTF-8 인코딩하여 SHA-256. 각 파일 sha256은 uppercase.
- completion report: docs/04_test_reports/C-09_COMPLETION_REPORT.md, 7222 bytes, SHA256 89D95D90CCEB839B5265166200DCFD36C8C7A865790F68A661D94755601034A7.
- 원문 근거 WorkInstruction: docs/work_orders/C-09_WORK_INSTRUCTION_R4.md, SHA256 7BFDD939DADE6D2605D6185ED1ACE03C6D5C6FED8E3123BA6792120C5268B2B3.

제품 exact18:

```text
docs/04_test_reports/C-09_COMPLETION_REPORT.md
packages/execution_backends/__init__.py
packages/execution_backends/docker.py
packages/execution_backends/git_worktree.py
packages/execution_backends/models.py
packages/execution_backends/registry.py
packages/paths/identity.py
packages/tool_gateway/__init__.py
packages/tool_gateway/gateway.py
packages/tool_gateway/models.py
packages/tool_gateway/registry.py
tests/execution_backends/test_docker.py
tests/execution_backends/test_git_worktree.py
tests/execution_backends/test_registry.py
tests/integration/test_c09_repository_workspace.py
tests/paths/test_conflict_scope_identity.py
tests/tool_gateway/test_gateway.py
tests/tool_gateway/test_tool_registry.py
```

독립 review 시 제품18 raw bytes는 probe 전후 동일함을 확인했다. 제품 수정0, tracked write0, stage0, commit0, push0. 현재 bounded evidence 기록에서는 이 quality 원문 파일 하나만 새로 생성한다. spec reviewer 원문과 제품 dirty18은 건드리지 않는다.

## 검증 방법과 명령

독립 probe는 기존 pytest assertion을 단순 재실행한 것이 아니다. 현재 제품 코드를 import하여 Event/Condition barrier와 stateful fake를 주입하고, sleep 타이밍에 의존하지 않고 admission / authorization / IO / cancel / disposal 경계를 정해 검사했다. 실제 Git 저장소 생성, subprocess 실행, Docker daemon 접속, WSL 또는 외부 네트워크를 실행하지 않았다. Git/Docker backend의 driver/read/cleanup seams는 메모리 fake로 대체했다.

실제 공통 실행 명령은 작업트리에서 PowerShell here-string을 stdin으로 전달한 다음과 같다. 독립 probe 본문은 reviewer 도구 실행 이력에 있으며 저장소 테스트 파일로 저장하지 않았다. 아래 finding의 출력은 해당 실행에서 관측한 값/예외를 기록한 것이고, 전체 stdout 원본을 별도 파일로 저장했다는 주장은 하지 않는다.

```powershell
@'
# 독립 in-memory hostile probe 본문
'@ | .venv/Scripts/python.exe -B -u -
```

실행 세트: quality_r4_probe1, 이어서 미실행 후반부를 수행한 quality_r4_probe1b, quality_r4_probe2, quality_r4_probe3. 첫 probe의 JSON 출력 단계에서 frozenset 직렬화 TypeError가 1회 발생했다. 제품 결함이 아닌 reviewer harness 오류이며 default=list로 출력만 보완했다. 완료된 앞부분을 통과로 조작하거나 제품 코드를 수정하지 않았고, 미실행 후반부를 이어 실행했다. probe1b/2/3 종료코드0. 동일 오류 반복0. 이 harness 오류는 유효 product failure 횟수에 포함하지 않는다.

pytest 전체 suite는 이 review의 read-only 제약상 실행하지 않았다. fixture 임시 파일을 생성하는 authoritative suite 결과를 이번 독립 실행의 PASS로 주장하지 않는다. -B는 pycache 생성을 막기 위한 것이다.

다음 cross-session probe는 추가 fixture 없이 그대로 재현 가능한 실제 명령이다:

```powershell
.venv/Scripts/python.exe -B -c "from packages.tool_gateway.registry import ToolPermissionRegistry; p=ToolPermissionRegistry(); p.grant('A',['repo.status']); p.grant('B',['repo.status']); t=p.reserve('B','repo.status'); p.revoke('A'); p.authorize_io(t,lambda:print('B_IO'))"
```

관측: B grant는 남아 있지만 ToolGatewayRejected: TOOL_PERMISSION_DENIED. B_IO 미출력, B IO0. 이것은 B의 권한 거부가 의도된 정상 결과라는 뜻이 아니라 A revoke가 B pending reservation까지 무효화한 결함이다.

## Important 11개

### I01 — cancel-before-IO 이후에도 실제 read가 진행됨

위치: packages/execution_backends/models.py:367 (_mark_io), packages/execution_backends/git_worktree.py:336 (execute IO 시작).

재현: Git backend 실제 execute 경로에서 _admit로 RUNNING handle을 만든 뒤 io_authorizer barrier에서 멈춘다. owner identity를 갖춘 cancel을 완료하여 terminal CANCELLED를 만든 뒤 barrier를 연다. read seam에서 호출 수를 센다.

관측: handle CANCELLED, terminal 취소가 먼저 확정됐는데 후속 read1 / IO1. _mark_io는 counter 또는 io_authorizer를 호출할 뿐 handle의 CANCELLED/terminal 상태를 다시 검사하지 않는다. execute도 read 직전 취소 fence를 재검증하지 않는다.

영향: 취소 완료 후 IO0이라는 제어 경계가 깨진다. terminal receipt가 취소를 표현하더라도 그 이후 read가 실제로 수행된다. admission과 IO 사이의 cancel 상태를 원자적으로 닫는 재검증이 필요하다.

### I02 — revoke-before-IO는 IO0이지만 RUNNING handle을 영구 잔류시킴

위치: packages/execution_backends/git_worktree.py:336, packages/execution_backends/docker.py:205. 두 execute의 _mark_io가 try/terminal failure 처리 바깥에 있다.

재현: gateway execute를 _mark_io 직전 barrier에서 멈추고 동일 session permission revoke를 완료한다. barrier를 열어 stale reservation을 소비하게 한다.

관측: TOOL_PERMISSION_DENIED, IO0, denial audit1은 지켜졌다. 그러나 backend에는 RUNNING handle이 남고 terminal event/receipt0이다. 예외가 _failed 경로로 전달되지 않는다.

영향: active handle 때문에 destroy가 막히고 동일 idempotency retry가 완료 receipt를 얻지 못한다. revoke-before-IO 보안 거부와 backend lifecycle terminal 정합성을 함께 닫아야 한다. IO0만으로 PASS를 판단할 수 없다.

### I03 — session A revoke가 session B pending reservation도 취소함

위치: packages/tool_gateway/registry.py:91, 특히 pending reservation 정리 부분.

재현: A/B 각각 repo.status grant, B reserve, A revoke, B authorize_io. 위 standalone 명령으로 재현 가능하다.

관측: B의 grant와 generation은 유효하지만 B pending reservation이 제거되어 TOOL_PERMISSION_DENIED / IO0. revoke가 해당 session 소유 pending만 선별하지 않고 pending 전체를 제거한다.

영향: 한 session의 취소/인수가 독립 session 작업을 중단시키는 교차-session 간섭이다. shared ToolPermissionRegistry의 per-session 계약 위반이다.

### I04 — Docker execute와 per-handle cancel 사이 상관 식별자가 없음

위치: packages/execution_backends/docker.py:186 (execute envelope), :223 (anvil-read-tool-cancel에 handle ID 전달).

재현: 같은 workspace에서 A/B를 동시에 실행시키고 strict stateful Docker helper fake가 받은 execute envelope와 cancel control ID를 기록한다. A cancel 후 B를 완료하고 새 C read도 수행한다.

관측: operation/arguments/authority/limits가 같은 A/B execute envelope가 동일하다. helper에는 handle/request/process control ID가 전달되지 않지만 cancel은 handle-a를 찾도록 요구한다. strict helper는 대상을 상관시킬 수 없어 DOCKER_DRIVER_FAILED, A/B는 SUCCEEDED로 완료된다. whole-container stop은 사용하지 않았고 C 후속 read는 성공한다.

영향: 컨테이너 전체 stop 회귀는 닫혔지만 개별 실행 cancel 기능은 닫히지 않았다. helper가 실행 때 받은 owned process/control ID와 cancel ID를 정확히 연결해야 한다. fake가 임의로 cancel 성공을 돌려주는 것으로 검증을 대체할 수 없다.

### I05 — early cap 이전 producer 누적과 symbols 전체 bytes가 제한되지 않음

위치: packages/execution_backends/git_worktree.py:62 (unbounded queue.Queue), :302 부근 (symbols traversal).

재현 A: _run_bounded의 producer/consumer를 분리하고 consumer가 결과를 꺼내기 전에 producer가 EOF까지 읽는 합법적인 스케줄을 barrier로 강제한다. max_output_bytes=1, stdout fake는 더 큰 payload를 제공한다.

관측 A: producer가 65536 bytes / 17 reads를 수행한 뒤 consumer가 한도를 검사했다. 큐가 무제한이므로 consumer의 사후 cap은 producer의 early memory/read bound가 아니다.

재현 B: symbols에 반환 symbol이 없는 큰 파일20개, 합계20 MiB를 공급한다. 출력은 작게 유지한다.

관측 B: 누적20 MiB를 모두 읽고 SUCCEEDED. 누적 visited bytes hard cap이 없어 output cap만으로 traversal/read를 막지 못한다.

영향: 출력 제한이 IO·메모리·traversal 비용의 조기 상한으로 작동하지 않는다. producer 제한과 symbols cumulative bytes를 각각 검증해야 한다.

### I06 — foreign Mapping/validator 예외와 non-string key가 ingress audit를 우회함

위치: packages/tool_gateway/models.py:60~64 (ToolRequest arguments 동결), packages/execution_backends/models.py:17 (deep_freeze key str 변환), packages/tool_gateway/gateway.py:139 (_validate_schema).

재현: Mapping.items가 RuntimeError를 던지는 foreign Mapping, RuntimeError를 던지는 schema validator, Path('path')를 key로 가진 arguments를 각각 공급한다.

관측: foreign Mapping.items RuntimeError와 validator RuntimeError는 stable TOOL_SCHEMA_INVALID denial로 변환되지 않고 audit0으로 빠져나간다. Path('path') key는 str로 변환되어 repo.read_file 요청이 SUCCEEDED / IO1로 수락된다.

영향: ingress는 string-key Mapping만 받아야 하지만 coercion과 예외 경로가 검증/감사를 우회한다. 반면 list/tuple/scalar/None의 단순 non-Mapping은 denial audit1/IO0이었다. 후자의 PASS가 foreign Mapping/키 검증 PASS를 의미하지 않는다.

### I07 — destroy cleanup 실패 후 ACTIVE로 복귀하여 신규 IO 허용

위치: packages/execution_backends/models.py:583 (_abort_destroy); Git :354 / Docker :268 호출 경로.

재현: disposal authorization 후 DISPOSING 상태에서 cleanup seam이 OSError를 발생시키도록 한다. cleanup 실패 처리 후 같은 workspace에서 새 execute를 호출한다.

관측: DISPOSING 동안 신규 execute는 거부되어 IO0이었다. 그러나 _abort_destroy가 ACTIVE로 복구한 뒤에는 후속 execute SUCCEEDED / IO1이다.

영향: 부분 삭제/잔류 여부가 미확정인 workspace를 재사용할 수 있다. WI가 요구하는 cleanup failure RETAINED 상태와 recovery authority 경계가 깨진다.

### I08 — gateway가 oversized result와 receipt 없는 성공 handle을 수용함

위치: packages/tool_gateway/gateway.py:52 (_validate_output_schema), :186~190 (결과 검증/성공 audit).

재현: gateway에 등록된 backend fake가 permission callback을 소비하고 identity는 정확하지만 SUCCEEDED, 100-byte string result, receipt=None을 반환하도록 한다. request.max_output_bytes=1이다.

관측: gateway는 SUCCEEDED를 반환하고 audit의 terminal_receipt_sha256은 null이다. 단순 type 판정은 request-bound size와 canonical terminal receipt 존재를 검증하지 않는다.

영향: backend 경계에서 malformed/oversized/missing receipt를 fail-closed하지 못한다. 성공 audit를 내기 전에 bounded result와 terminal receipt 정합성을 검증해야 한다. 출력 schema 실패 또한 FAILED terminal receipt/audit로 닫혀야 한다.

### I09 — canonical receipt에 필수 traversal/masking/error 증거 필드 누락

위치: packages/execution_backends/models.py:193 (ExecutionReceipt).

재현: 정상 terminal receipt를 직렬화하고 reviewer가 SHA-256을 독립 재계산한다. handle/event/artifact reference와 비교하며 WI 필수 field set도 비교한다.

관측: 현재 receipt의 canonical hash 재계산과 event/artifact SHA 연결은 일치했다. 하지만 masked_fields, traversal files/bytes/rows limits, error_sha256을 갖지 않는다.

영향: 제한값과 마스킹/실패 증거를 receipt만으로 검증할 수 없다. hash가 정확하다는 사실은 내용의 completeness를 증명하지 않는다. 현재 양호한 immutable/hash linkage는 보존하되 누락 계약을 채워야 한다.

### I10 — public owner identity의 backend_id 축을 지원하지 않음

위치: packages/execution_backends/models.py:519 (_owned_handle), :535/540/548 부근 (stream_events/cancel/collect_artifacts); Docker cancel :214.

재현: owner identity 없음/일부만 제공/잘못된 run-session-workspace/정확한 네 축을 public method에 각각 전달한다.

관측: missing/partial3은 HANDLE_OWNER_IDENTITY_REQUIRED, wrong3은 HANDLE_OWNERSHIP_MISMATCH로 거부된다. 그러나 올바른 backend_id를 포함해 네 축을 제공하면 unexpected keyword argument TypeError가 발생한다. public signature와 내부 비교는 세 축뿐이다.

영향: run_id+session_id+workspace_id+backend_id 전체 identity 계약을 호출자가 표현할 수 없다. three-axis rejection 개선만으로 full owner 계약 완료를 주장할 수 없다.

### I11 — request_id uniqueness가 id_factory 구현에 의존함

위치: packages/execution_backends/models.py:431 (_admit), :444 (handle ID 중복만 검사).

재현: 지원되는 id_factory seam이 호출마다 새 handle ID를 생성하도록 하고 같은 request_id에 서로 다른 idempotency key의 요청 두 개를 보낸다.

관측: handle0과 handle2가 각각 수락되고 IO2. _admit는 request_id 자체의 별도 uniqueness index가 아니라 생성된 handle_id 충돌만 검사한다.

영향: request ID 충돌 거부가 기본 factory의 결정성에 우연히 기대며, 허용된 factory 교체에서 계약이 사라진다. request ID와 canonical payload/idempotency 관계를 admission lock transaction 안에서 직접 검증해야 한다.

## 독립 통과 항목

- Concurrent 동일 idempotency/payload의 실제 loser 대기와 winner IO barrier: IO1, terminal1, 같은 immutable receipt.
- Gateway 동일 요청 replay: IO1, terminal1, 같은 receipt, invocation별 audits2. replay가 audit를 남기는 것과 backend IO를 반복하는 것은 구분했다.
- Terminal receipt SHA를 reviewer가 독립 재계산한 값이 일치하고 event/artifact reference도 같은 SHA.
- Session A long backend IO를 barrier로 막아 둔 동안 session B grant/revoke가 A release 전에 완료: global permission lock이 long IO 전체를 둘러싸는 이전 문제는 재현되지 않았다.
- list/tuple/scalar/None arguments: TOOL_SCHEMA_INVALID, denial audit1, backend IO0.
- DISPOSING 상태의 신규 execute 거부와 IO0. 단, cleanup 실패 후 ACTIVE 복귀는 I07.
- Docker whole-container stop 없음 및 후속 read 성공. 단, 실제 per-handle cancellation correlation은 I04.
- 제품18 raw bytes/hash probe 전후 동일. reviewer가 제품 파일이나 테스트 파일을 바꾸지 않았다.

위 통과 항목은 해당 in-memory probe 경계만 증명한다. 실제 Docker/WSL/배포 성공으로 승격하지 않는다.

## 미실행과 한계

Actual Docker daemon, actual helper/container 실행, WSL, DB, API, UI/browser, Provider, Telegram, network, deployment, Secret 접근은 NOT_EXECUTED / NOT_ACCESSED. 실제 외부 Git fixture와 물리 filesystem hostile 테스트를 이번 read-only review에서 새로 실행하지 않았다. 기존 개발자 suite 숫자를 이번 reviewer의 실제 테스트 횟수로 합산하지 않는다. 위 probe는 race/ownership/audit/cap/receipt 계약을 겨냥한 독립 fake-seam 검증이며 운영 환경 인증이 아니다.

## 조치와 rollback 경계

11 Important finding이 남아 있으므로 quality PASS와 C-09 acceptance는 거부한다. spec C2/I8/M1 결과는 별도 원문에 보존하고 동일 snapshot failure3을 한 번만 집계한다. Main은 Developer를 중지하고 epoch3 write→worker 회수 후 TakeoverPacket과 successor control로 순차 인수해야 한다. 기능/요구/중요위험을 새로 확대하는 권한은 부여되지 않는다. C10/일반 exec.run/raw shell/patch/write/risk/egress/Secret 구현은 이 review의 허용 범위가 아니다.

제품 rollback 작업은 수행하지 않았다. dirty 제품을 reset/clean/stash/checkout/delete하지 않고 raw bytes와 index를 보존한다. 이 원문 기록의 변경은 지정된 새 보고서 한 파일뿐이며 stage/commit/push는 하지 않는다.
