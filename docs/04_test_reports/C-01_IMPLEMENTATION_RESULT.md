# C-01 Product Correction 구현 결과

## 판정

`COMPLETED`

Developer 범위의 구현과 기본 검증을 완료했다. 이 판정은 Main Agent 검토나 독립 Tester acceptance, C-01 canonical projection, C Gate, 실제 Provider/운영 검증을 뜻하지 않는다.

## 기준선과 실행 권한

- Work Package: `C-01`
- branch: `codex/c01-mainline-reconciliation`
- BASE/시작 HEAD: `e215c0612363050dbe20315646f1612f31b8cdc0`
- 시작 Git 상태: clean
- worker lease: `worker-lease-c01-product-correction-20260910-001`
- execution fencing token: `c01-product-execution-fence-epoch-1-e215c06`
- write lease: `write-lease-c01-product-correction-20260910-001`
- write fencing token: `c01-product-write-fence-epoch-1-e215c06`
- allowed tracked path 밖 변경: 0

## 권위 문서 hash

- `Anvil_설계서_v2.md`: `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`
- `Anvil_작업계획서_v1.md`: `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`
- `Anvil_통합검증매트릭스_v1.md`: `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`
- `Anvil_테스트계획서_v1.md`: `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`
- corrective brief: `5F9F3DD6454ED7C223BBC69176EACC2E6E16069CF6E9245E55326E4B58C37178`
- 수정 전 `C-01_WORK_INSTRUCTION.md`: `D594FC661D3E54D905C64B0AEDEB8E53644832EB9F2FE5C17A2B0CA5A3014DF3`

## 구현과 diff

| 변경 전 | 변경 후 |
|---|---|
| `capabilities=set()`이 truthy fallback 때문에 `text_generation`으로 대체됨 | `None`만 기본값으로 처리하고 explicit empty set은 empty로 보존 |
| gateway 기본 ID는 `req-<uuid>`, kernel ID는 `request:{run}:{step}`로 Step마다 고정 | 자동 생성 ID를 호출별 `request:<32 lowercase hex>`로 통일 |
| 같은 Step 재호출이 같은 예약/요청 ID를 재사용하여 Provider를 두 번 호출 | 새 request ID와 기존 Step reservation ID의 binding 충돌로 두 번째 호출을 reserve 단계에서 거부 |
| Step 결과에 예산 Event evidence 없음 | sequence 1 `BUDGET_RESERVED`, sequence 2 `USAGE_RECONCILED` evidence와 JSON-safe `to_dict()` 제공 |
| LLM-provider `NativeAgentAdapter`만 존재 | 기존 adapter는 유지하고 별도 `NativeCodingAgentAdapter` lifecycle Protocol 추가 |

Native Coding Agent Protocol은 `probe_capabilities`, `start`, `stream_events`, `request_checkpoint`, `steer`, `stop`, `collect_result`만 정의한다. packet/result/handle/instruction은 opaque object로 통과시키므로 C-02+ `DelegationPacket`, Developer lifecycle, validation 의미를 선행 구현하지 않는다.

## 변경 경로

- `docs/work_orders/C-01_WORK_INSTRUCTION.md`
- `docs/WORK_STATUS.md`
- `docs/04_test_reports/C-01_IMPLEMENTATION_RESULT.md`
- `packages/llm_gateway/contracts.py`
- `packages/orchestration/__init__.py`
- `packages/orchestration/kernel.py`
- `packages/orchestration/native_agent_adapter.py`
- `tests/llm_gateway/test_c01_kernel.py`
- `tests/orchestration/test_c01_native_agent_adapter.py`

`docs/work_orders/C-01_INVOCATION_PROMPT.md`, `packages/llm_gateway/__init__.py`, `packages/llm_gateway/native.py`는 호환 보존을 위해 변경하지 않았다.

## TDD와 검증 증거

1. 시작 기준선
   - `.venv\Scripts\python.exe -m pytest tests\llm_gateway\test_c01_kernel.py tests\agent_team\test_c21_provider_nonbilling_qa.py -q -p no:cacheprovider`
   - exit 0, `10 passed in 0.77s`
2. RED 수집 구조 교정
   - 첫 실행은 신규 lifecycle symbol의 module-level import가 collection error를 일으켜 exit 1이었다.
   - test body 지연 import로 바꿔 개별 assertion RED가 모두 수집되게 했다.
   - fingerprint `C01_NATIVE_ADAPTER_IMPORT_COLLECTION_R1`, 1회, 제품/외부 영향 0.
3. 의미 있는 RED
   - `.venv\Scripts\python.exe -m pytest tests\llm_gateway\test_c01_kernel.py tests\orchestration\test_c01_native_agent_adapter.py -q -p no:cacheprovider`
   - exit 1, `9 failed, 5 passed in 0.36s`
4. 최소 GREEN
   - 같은 focused 명령
   - exit 0, `14 passed in 0.31s`
5. C-21 호환
   - `.venv\Scripts\python.exe -m pytest tests\agent_team\test_c21_provider_nonbilling_qa.py -q -p no:cacheprovider`
   - exit 0, `4 passed in 0.70s`
6. 최종 C-01 + C-21 묶음
   - `.venv\Scripts\python.exe -m pytest tests\llm_gateway tests\orchestration\test_c01_native_agent_adapter.py tests\agent_team\test_c21_provider_nonbilling_qa.py -q -p no:cacheprovider`
   - exit 0, `18 passed in 0.75s`
7. compileall
   - `.venv\Scripts\python.exe -m compileall -q packages\llm_gateway packages\orchestration`
   - 기본 sandbox 실행은 `__pycache__` 쓰기 권한 거부로 exit 1. fingerprint `C01_COMPILEALL_DTMP_SANDBOX_WRITE_DENIED_R1`, 1회, 제품 failure가 아니다.
   - 지정 worktree 내부 쓰기 승인으로 같은 명령 재실행: exit 0, output 0.
8. 최종 범위·diff
   - 최종 C-01+C-21 묶음 재실행: exit 0, `18 passed in 0.76s`.
   - `git diff --check`: exit 0.
   - `git status --porcelain=v1` 기반 allowed tracked path exact-set 검사: PASS, 변경 경로 9개, 범위 밖 0.

Claude/Codex/Local fake backend는 같은 opaque packet/result 계약을 통과시키며 `task_graph_ref`, `permission_ref`, `evidence_ref`, `resume_ref`를 동일하게 보존하는 parametrized 계약으로 검증했다. 실제 backend나 network를 호출하지 않았다.

## 제외·미검증·잔여 위험

- network, Provider, Telegram, DB, API, browser, WSL, deployment, secret/외부 environment mutation: `NOT_EXECUTED`.
- commit, push, merge, 외부 실행: `NOT_EXECUTED`.
- canonical `docs/progress/build-progress.json`, `docs/progress/BUILD_HANDOFF.md`, progress events/checker: 변경 0. 후속 reviewed acceptance task가 projection을 소유한다.
- 실제 Claude/Codex/local coding runtime은 실행하지 않았고 deterministic fake boundary만 검증했다.
- Main Agent의 범위/diff 검토와 독립 Tester의 AV-AGT-002, AV-AGT-003, AV-OPS-011 판정은 아직 수행 전이다.

## rollback

이 worktree에서 위 변경 경로의 diff만 역적용한다. 다른 tracked path, 사용자 dirty/untracked 자료, canonical progress/history는 수정·삭제하지 않는다.
