# F-01 완료보고 — developer-primary-f01-r1

## 판정

`COMPLETED` — 승인된 host-only catalog/egress/reference 계약 구현·기본 검증 완료. Main acceptance나 실제 Provider/Secret Manager 연동 성공을 의미하지 않는다. formal FAILURE_REPORT **0**.

## 판단 이유 / 기준선

- cwd `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`, branch `codex/c09-execution-backends-r1`, HEAD `98e218264bf54db04a1bd35a67273b713805a649`.
- 기존 E11/E Gate/DIR3/F01 control dirty를 보존했다. 제품 exact5만 신규 작성했고 control·Git index·commit·push를 수정하지 않았다.
- WI SHA256 `373FBAB2101322F0CCD8A46A47FE2D05D758D897C174016CC471DA2F60D83D47`, invocation `E487F7E86CBB930E16255C2C286F8700C080532EBF2267D3CF818F7865069DBB`.
- 설계 hash `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`, 계획 hash `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`. 설계 §42.0, §49.7, 계획 F01, 매트릭스 F01 직접 ID를 대조했다. DIR3 CLEARED seq1176와 E Gate ACCEPTED seq1178은 Main 통제 증거이며 본 구현에서 생성하지 않았다.
- epoch1은 host02:37보다 issued04:40이 미래여서 제품 mutation0 상태로 BLOCKED 보고했다. Main append-only correction 후 seq1187/epoch2를 재확인하고 시작했다. 이는 제품 failure가 아니다.
- worker `worker-lease-f01-r1-20260918-002`, execution `f01-r1-execution-fence-epoch-2-98e218264bf54db0`; write `write-lease-f01-r1-20260918-002`, write fence `f01-r1-write-fence-epoch-2-4a1bd35a67273b71`. ACTIVE window `2026-09-18T02:37:49+09:00`~`2026-09-18T14:37:49+09:00`.

## 조치 / 변경 exact5

| 경로 | 변경 내용 |
|---|---|
| packages/provider_catalog/__init__.py | public catalog/DTO exports |
| packages/provider_catalog/models.py | bounded builtin-only input, value-only immutable Snapshot, 기존 DataEgressProfile/SecretRef 재사용 |
| packages/provider_catalog/service.py | canonical 9 seed, host-approved immutable profiles/endpoints, run pin, egress decisions, reference register/rotate/revoke/expiry, bounded audit pagination |
| tests/provider_catalog/test_provider_catalog_f01.py | focused 74건: 정상/적대/회귀/100-way 동일 request 경쟁 |
| docs/04_test_reports/F-01_COMPLETION_REPORT.md | 본 보고서 |

신규 파일 전체가 diff다. 기존 owner/schema/transport를 변경하지 않았다. exact immutable JSON와 canonical SHA256를 내부 저장하고 반환 DTO는 canonical state와 alias를 공유하지 않는다. 입력은 callback/deepcopy/사용자 iterable 호출 전에 exact builtin shape/bounds 검증한다.

### Host trust boundary

- `ProviderCatalog` 생성과 `register_profile`, `register_endpoint`, `allow_local_endpoint`, `register_mask`, Secret lifecycle은 **신뢰된 host-only in-memory seam**이다. Agent payload/API에 등록 메서드를 노출하지 않는다.
- human_approval_id는 host가 실제 인증·exact payload 승인을 확인한 후 넣는 reference다. F01이 임의 문자열을 실제 사람 인증으로 검증하는 것이 아니며 인증 service/HTTP 연결은 **NOT_INTEGRATED**다.
- 기존 `packages.orchestration.delegation.DataEgressProfile`, `packages.action_policy.policy.SecretRef`를 소비한다. mutation 전 builtin validation은 기존 E10 value validator를 재사용하며 generic owner 변경0.
- profile 재정의는 immutable ID rebind를 거부한다. 새 profile은 human approval reference를 요구하며 기존 run pin은 바뀌지 않는다. cloud hostname/scheme/port와 승인된 DNS IP를 host registry에 exact 결박한다. 관측값만으로 DNS/IP를 자가 승인하지 않는다.
- localhost/link-local/metadata/미승인 private/redirect/IP drift는 IO0 BLOCKED. local_only는 명시 environment-local OLLAMA allowlist 외 연결을 거부한다. masked_content는 exact profile/provider/purpose/path/payload hash에 결박한 host masking attestation 없이는 BLOCKED다. 실제 DNS/마스킹 파이프라인은 실행하지 않는다.
- SecretRef는 실제 secret material을 받는 입력 필드가 없다. reference eligibility만 `REFERENCE_AUTHORIZED_NOT_INJECTED`로 반환한다. raw read는 거부·감사하고 rotate/version/revoke/expiry 및 observed expiry의 clock rollback 재활성화를 거부한다. 실제 injection/env cleanup/crash artifact scanner는 이 seam의 성공으로 주장하지 않는다.
- audit는 append-only sequence/hash와 최대100행 pagination을 가진다. receipt exact replay는 중복 publication을 만들지 않고 payload conflict는 거부한다. revoke 이후 이전 ALLOW replay는 현재 상태에 따라 BLOCKED다.

## RED → GREEN / 오류 구분

1. 신규 기능 없음 RED: focused **47 failed in 0.41s**, exit1(ModuleNotFoundError). 최초 GREEN **47 passed in 1.13s**, exit0.
2. 승인 endpoint/mask·expiry·nested 입력 보강 RED: **50 failed, 9 passed in 0.80s**, exit1(신규 seam 미구현 및 expired rotation 허용). GREEN **59 passed in 0.66s**, exit0.
3. local_only에서 public OLLAMA 허용 RED: **1 failed, 73 passed in 0.72s**, exit1. 최소 local allowlist guard 후 **74 passed in 0.65s**, exit0.
4. 관련 회귀 첫 실행: **757 passed, 5 errors in 8.45s**, exit1. fingerprint `ENV-PYTEST-COMMON-TEMP-WINERROR5`, 1회. 공용 `C:\Users\cyhuh\AppData\Local\Temp\pytest-of-cyhuh` setup 접근 오류이며 제품 assertion failure0. 전용 writable basetemp 재실행으로 **762 passed/skip0**.
5. cleanup precheck는 pytest가 만든 4개 `current` symlink를 탐지해 `TEMP_LINK_PRESENT`로 삭제 전 중단했다(exit1). 링크/target 모두 해당 전용 root 내부임을 읽기 검증하고 링크만 비재귀 제거 후 root 정리, exit0/residue0. 보호 자료 삭제0.

RED·fixture/environment/tool 문제는 formal FAILURE_REPORT가 아니다. brainstorming은 승인된 WI의 bounded host seam 범위 대조에, TDD는 실제 RED 후 구현에, completion verification은 fresh exit/count 확인 뒤 판정에 사용했다.

## 정확한 검증 명령 / 실제 결과

cwd는 위 canonical root. Python `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`.

### Focused

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/provider_catalog/test_provider_catalog_f01.py --tb=short`

최종 exit0 **74 passed in 0.65s**, skip0.

### 관련 회귀

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/provider_catalog tests/action_policy tests/tool_gateway tests/orchestration/test_delegation_packet.py tests/knowledge/test_model_registry_d11.py tests/git_adapter --basetemp=D:/Project/Anvil/.codex-sandbox/f01-regression-20260918-r1 --tb=short -rs`

exit0 **762 passed in 58.25s**, skip0. 첫 환경 오류 명령은 위와 동일하되 `--basetemp=...`만 없었다. C10 policy/Tool gateway, C02 delegation, D11 registry, E10 input/adapter 계약 회귀를 실제 실행했다. 기존 Tool gateway 회귀의 격리 temp local Git/filesystem은 F01 runtime 외부 증거가 아니다.

### 구문 / 정적

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B -c "from pathlib import Path; paths=['packages/provider_catalog/__init__.py','packages/provider_catalog/models.py','packages/provider_catalog/service.py','tests/provider_catalog/test_provider_catalog_f01.py']; [compile(Path(p).read_bytes(),p,'exec') for p in paths]; print('COMPILE4 PASS; pycache0')"`

exit0 **COMPILE4 PASS; pycache0**. 새 JSON 파일0이며 canonical JSON serialization/deterministic hash/alias 회귀는 focused에 포함.

`D:/tmp/anvil-main-integration/.venv/Scripts/python.exe -B scripts/check_project_progress.py`

exit0 **PASS sequence=1187 reporting=AUTO_CONTINUE**. control 자체를 수정하지 않았다.

`git diff --check` exit0. `git diff --cached --name-only` exit0/empty. read-only Git global ignore permission warning은 작업 명령 성공과 구분한다.

## Validation ID 매핑 / 미검증

| ID | 이번 증거 | 미검증 경계 |
|---|---|---|
| AV-SAFE-021 | reference-only field contract, synthetic credential/Unicode/URI rejection, audit 원문 비노출 | 실제 DB/브라우저/LLM/artifact store 5경계 L5 시험 NOT_EXECUTED |
| AV-SAFE-030 | metadata/linklocal/private/loopback/redirect/rebinding/승인 endpoint mismatch IO0, OLLAMA allowlist | 실제 DNS/connect/outbound proxy NOT_EXECUTED |
| AV-SAFE-031 | revoked version 및 이전 ALLOW replay/rotate stale/expired reference BLOCKED, 감사 | 실제 Run resume/Secret Manager NOT_INTEGRATED |
| AV-SAFE-032 | canonical casefold path·excluded path·profile scope·immutable run pin·approval ref 필수 | 실제 송신/인증 human authority/다음 Run wiring NOT_INTEGRATED |
| AV-OPS-010 | canonical9 provider allowlist/egress admission 재사용 기반 | 실제 capability routing은 기존 D11/F02 소유; F01 catalog를 routing PASS로 승격하지 않음 |

실제 Provider/DB/network/UI/browser/deployment/Secret Manager/child env는 전부 **NOT_EXECUTED**. catalog connection_status는 `NOT_EXECUTED`, ready=false로 유지한다. 런타임 OS Secret 주입/삭제, 영속 audit/DB transaction, multi-process registry, 실제 HTTP 인증은 **NOT_INTEGRATED**. host fixture/contract를 실제 보안 운영 PASS로 승격하지 않는다.

## SHA256 / rollback

- `packages/provider_catalog/__init__.py`: `E02B39BE00CA05E3E0A9AE85CE9F05906CCFD2342485F346BD183123185DC655`
- `packages/provider_catalog/models.py`: `B724BC8341A0FC684ED3C39F2596DFFEFAC1B007C8C0A999A525FBB9FA111514`
- `packages/provider_catalog/service.py`: `4EDDED292BA8C8FBDD67988CAB7E8E8C239F7C261EAABB83AFCBC2B5DCC96600`
- `tests/provider_catalog/test_provider_catalog_f01.py`: `722A6C56C070C829804DCC228CE9C7F4475A2FDEC8CC27E1BA52658DB44E9BD9`
- report SHA는 자기참조 없이 최종 응답에 제공한다.

전용 `D:\Project\Anvil\.codex-sandbox\f01-regression-20260918-r1`는 exact path·symlink target 검사 후 정리했고 `Test-Path` False/exit0다. 관련 없는 기존 E11 임시/사용자 자료는 변경하지 않았다. rollback은 Main이 본 신규 exact5만 되돌리며 기존 E11/E Gate/DIR/F01 control과 사용자 dirty를 보존한다. progress/HANDOFF는 Main 소유로 미갱신. 다음 조치는 Main 독립 검토이며 acceptance/lease revoke/commit/push/F02를 수행하지 않는다.
