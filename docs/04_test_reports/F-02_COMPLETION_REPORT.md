# F-02 완료보고 — developer-primary-f02-r1

## 판정

`COMPLETED` — host-only discovery/routing façade 구현 및 기본 검증 완료. formal FAILURE_REPORT **0**, 독립 검토/Main acceptance는 별도다. 실제 Provider·network·DB·UI·deploy는 실행하지 않았다.

## 판단 이유 / 기준선

- canonical cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`, branch `codex/c09-execution-backends-r1`, HEAD/dispatch `98e218264bf54db04a1bd35a67273b713805a649`, canonical seq1195.
- WI `docs/work_orders/F-02_WORK_INSTRUCTION.md` SHA256 `832F0307F81922FD16405785A66D8E6DFB66A625DDEC3480061351B75C27B4E5`와 invocation `1B9B430DD13CE69A6704D450EEF82A15BAEAD851509F6FD082B7C4B4578231FC`를 전부 읽고 확인했다.
- 설계 §42.0~4/§49.9, 계획 F02, 매트릭스 AV-OPS-010/011·AV-LRN-028·AV-FLOW-019를 대조했다. design hash `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`, plan hash `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`.
- actor `developer-primary-f02-r1`; worker `worker-lease-f02-r1-20260918-001`, execution `f02-r1-execution-fence-epoch-1-98e218264bf54db0`; write `write-lease-f02-r1-20260918-001`, write fence `f02-r1-write-fence-epoch-1-4a1bd35a67273b71`. ACTIVE window `2026-09-18T14:25:27+09:00`~`2026-09-19T02:25:27+09:00`, host 확인시각14:26:29로 발효 후였다.
- 시작 시 기존 E11/DIR/E Gate/F01/F02 control dirty는 이미 존재했고 보존했다. 이 작업은 exact5만 신규 작성했다. 기존 owner/schema·control·Git index·commit·push 변경0.

## 조치 / exact5 diff

| 경로 | 변경 |
|---|---|
| packages/model_registry/__init__.py | DiscoveryRouter/immutable Snapshot/error public exports |
| packages/model_registry/models.py | exact builtin 입력·UTC·run-ref·5개 contract hash 검증 |
| packages/model_registry/service.py | D11 public owner 기반 discovery/catalog, exact context binding, current drift/TTL/fallback 선택, immutable decision·audit |
| tests/model_registry/test_model_registry_f02.py | 실제 D11/D06/D02 fixture owner 기반 focused55 |
| docs/04_test_reports/F-02_COMPLETION_REPORT.md | 본 보고서 |

신규 파일 전체가 diff다. 새 model/activation owner를 만들지 않고 기존 `packages.knowledge.model_registry.ModelRegistry`의 **public** `capture_model/publish/query/run_guard`만 소비한다. 기존 D11 private state·lease·candidate·snapshot을 제품 코드에서 직접 읽거나 수정하지 않는다. F01 canonical provider/immutable Snapshot/hash와 E10 callback-free builtin value validation을 재사용한다.

### 동작 / 권위 경계

- discovery는 host가 이미 수집한 관측값을 D11 capture/publish로 전달한다. upstream provider/model, model revision, endpoint/account/organization reference, region, context/tools, privacy/retention/training/ZDR, price, benchmark revision, probe evidence/TTL은 기존 D11 owner schema/hash에 결박된다. unknown provider·malformed metadata는 publication 전에 거부한다.
- catalog는 current model heads만 정렬하고 stale/unavailable을 숨기지 않는다. 모든 transport 상태는 `NOT_EXECUTED`; host observation을 실제 probe 성공이라고 표시하지 않는다.
- routing은 D11 `PINNED` selection, activation/routing/model/prompt/benchmark seal과 current model head/probe/TTL을 다시 확인한다. 기존 run_guard가 과거 PINNED를 반환해도 F02는 현재 quarantine/drift/TTL에 따라 BLOCKED한다. 기존 Run pin을 다른 model로 교체하지 않는다.
- fallback은 D11이 승인한 error policy의 RATE_LIMIT/TIMEOUT/TEMPORARY_5XX 및 **첫 승인 target**만 고려한다. privacy/region/training/ZDR/retention/tools/context/capability/가격 단위·가격이 동등하거나 안전하지 않으면 재승인을 요구한다. Reviewer는 승인된 benchmark의 최저 quality도 저하시키지 않는다. 후보를 몰래 탐색·재활성화하거나 budget send를 수행하지 않는다.
- host `bind_context`는 검증된 TaskGraph/permission/evidence/resume/baseline의 hash 5개와 exact Run snapshot을 결박한다. 다른 context ID로도 동일 Run의 계약을 바꿀 수 없다. host 검증 책임을 대신하는 raw human approval mint API는 없다.
- decision은 `SELECTED_NOT_SENT`, IO0, main_acceptance=false이며 계약 hash와 D11 selection/activation hash·origin/selected provider·error·capability delta를 보존한다. adapter 라벨 변경은 해당 계약을 바꾸지 않는다. 실제 backend adapter 실행 증거는 아니다.
- 모든 untrusted DTO/container/scalar는 callback 전에 builtin/shape/bounds를 검증한다. mutable/custom tzinfo도 callback0 거부한다. 응답과 감사는 detached immutable JSON snapshot이다. exact replay와 40-way concurrency는 감사/receipt 중복0, 다른 payload는 REPLAY_CONFLICT다.
- publication failure injection에서 F02 receipt/audit publication0과 retry recovery를 검증했다. **D11 public run_guard가 이미 만든 pin까지 cross-owner rollback하는 transaction은 아니다.** D11 pin은 기존 owner의 canonical idempotent state로 남으며 network/send0다.

## TDD / 오류 기록

Focused 명령은 아래 F를 사용했다.

1. 최초 RED: module 부재 **40 failed in 1.47s**, exit1.
2. 첫 구현 **31 failed, 9 passed in 2.59s**, exit1. fingerprint `F02-INGRESS-SECRET-KEY-SCHEMA-MISMATCH`: F01의 보수적 secret-key 검사가 정상 `session_id`/`context_tokens`를 거부했다. systematic debugging으로 실제 key 검사 원인을 확인한 뒤, F02 입력은 E10 builtin/value 검사 → 기존 D11 schema/credential semantic 검사 순서로 수정했다. F01 수정0. GREEN **40 passed in 1.94s**, exit0.
3. 같은 Run의 다른 context ID를 통한 contract rebind RED: **1 failed, 54 passed in 2.17s**, exit1. Run identity별 immutable contract binding 추가 후 **55 passed in 2.16s**, exit0.

이는 구현 과정 RED/정정이며 유효 FAILURE_REPORT가 아니다. formal failure count0. 새 승인·외부 자원·control 변경 없이 해소했다. TDD 및 완료 전 fresh evidence 확인을 적용했다.

## 정확한 명령 / 결과

cwd는 위 canonical root다.

F:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/model_registry/test_model_registry_f02.py --tb=short`

exit0 **55 passed in 2.16s**, skip0.

R:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/model_registry tests/provider_catalog tests/knowledge/test_model_registry_d11.py tests/budget tests/orchestration/test_delegation_packet.py tests/git_adapter --basetemp=D:/Project/Anvil/.codex-sandbox/f02-regression-20260918-r1 --tb=short -rs`

exit0 **664 passed, 4 skipped in 10.36s**. skip4는 `tests/budget/test_atomic_reservation.py`의 isolated PostgreSQL18 DSN 미설정(line106/155/218/265)이며 실제 DB PASS로 계산하지 않는다. F01/D11/E08/C02/E10 영향 회귀 보존.

S:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/model_registry/__init__.py','packages/model_registry/models.py','packages/model_registry/service.py','tests/model_registry/test_model_registry_f02.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE4 PASS; pycache0')"`

exit0 **COMPILE4 PASS; pycache0**. 신규 JSON 파일0; JSON snapshot/hash/detachment는 focused 실제 검사에 포함.

P:

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py`

exit0 **PASS sequence=1195 reporting=AUTO_CONTINUE**. `git diff --check` exit0. stage/commit/push0.

`Test-Path -LiteralPath 'D:/Project/Anvil/.codex-sandbox/f02-regression-20260918-r1'` → False/exit0. 이번 회귀는 해당 임시 directory를 생성하지 않았으며 잔류0. 기존 사용자/타 작업 임시자료를 정리하지 않았다.

## Validation / 미검증

| ID | 이번 계약 증거 | 미검증 |
|---|---|---|
| AV-OPS-010 | 실제 D11 model/capability/benchmark/approved role를 소비한 primary/fallback 선택 | 실제 model probe와 provider runtime |
| AV-LRN-028 | 같은 model ID의 privacy/가격/capability/region/upstream/endpoint/account/benchmark drift, TTL 경계에서 기존 replay까지 BLOCKED_CAPABILITY_DRIFT | live upstream 변화 탐지/production DB |
| AV-OPS-011, AV-FLOW-019 | Codex/Claude/Local 라벨·approved provider 교체 후 graph/permission/evidence/resume/baseline hash5 불변, IO0 | native adapter 전환·실제 TaskGraph execution/handoff |

Provider/upstream/network/DB/UI/browser/deploy 모두 **NOT_EXECUTED**. 실제 HTTP·host authentication·durable audit·다중 process 동기화·cross-owner atomic transaction·E08 전송 연결은 **NOT_INTEGRATED**. D11 fixture owner를 재사용한 증거를 live provider 또는 operational model authenticity로 승격하지 않는다. host 관측/capture/context binding은 인증된 control plane 책임이며 agent API로 노출하지 않는다.

## SHA256 / rollback / 다음 조치

- `packages/model_registry/__init__.py`: `8BBE5EAFE92BA7EDFE7774BB2E2BB7366CD9090DBBF5EED8D4815C2205AA3F90`
- `packages/model_registry/models.py`: `7FAE1F820149F33621286BBC812D335F34736637904A4FD19EB28457616FC447`
- `packages/model_registry/service.py`: `535DE99C1DCBA35BEDC03BF52E75C6E1DF7501FB81113EA24B9BF14994CA3F20`
- `tests/model_registry/test_model_registry_f02.py`: `CDEF857C482776A04241159742CEA8B8AFCD91F4753E1AB24CF6452BE49FB981`
- report SHA는 자기참조 없이 최종 결과에 제공한다.

rollback은 Main이 본 신규 exact5만 검토해 되돌리고 기존 E11/F01 및 control/user dirty를 보존한다. progress/HANDOFF 미수정, acceptance/lease revoke/commit/push/F03 시작0. 다음 조치는 Main의 독립 검토다.
