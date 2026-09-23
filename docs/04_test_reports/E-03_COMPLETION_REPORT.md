# E-03 완료보고 — 수동 외부 검증 bundle

## 판정

`COMPLETED` — Developer 구현·기본 검증 완료. E-03 자기검증 순환 때문에 본 보고는 최종 합격이 아니며 별도 독립 spec/quality 판정이 필요하다. acceptance/commit/push/E-04는 수행하지 않았다.

- cwd: `D:\Project\Anvil\.codex-sandbox\anvil-main-integration`
- branch: `codex/c09-execution-backends-r1`
- 시작 clean HEAD/upstream: `c9678884d8e44a53fc4ab7c070a2c84f29c4e481`, 현재 HEAD 불변.
- remote: Main의 `git ls-remote development refs/heads/codex/c09-execution-backends-r1` exit0 exact SHA 확인, source=`MAIN_LIVE_REMOTE_READ`. worker 직접 명령은 SSH alias DNS 해석 실패였다. 복합 명령에서 개별 ls-remote exit는 미수집이며 이를 worker remote PASS로 표시하지 않는다.
- canonical seq1080/E-02 ACCEPTED에서 seq1081 WI →1082 worker lease →1083 write lease →1084 PACKAGE_STARTED. E-03 IN_PROGRESS, E-04 NOT_READY, pending approval 없음.
- worker `worker-lease-e03-r1-20260917-001`, execution `e03-r1-execution-fence-epoch-1-c9678884d8e44a53`.
- write `write-lease-e03-r1-20260917-001`, token `e03-r1-write-fence-epoch-1-fc4ab7c070a2c84f`.
- 발효 `2026-09-17T10:23:00+09:00`, 만료 `2026-09-17T22:23:00+09:00`. 제품 mutation 전 seq1084 checker PASS와 host10:29 유효 시각 확인; 최종 검사10:38에도 유효.

## 판단 이유

### 권위와 hash

- 설계 `DC7509CB76A4BF08A0AE4D6F802FFB747B670FAB93426D5636B14575F7BEF9A3`: §46.8/46.16-11, §47.15/47.18-16·17·19.
- 계획 `00F4B03E5C6A82D50268025A87EB86FAC52815D675B54216D7B69B5BD220DD18`: E-03 ExternalVerifierAdapter·수동 Claude artifact bundle, 자동 연결 보류.
- 매트릭스 `289933C795F689AF3AF3E44F48B563580EF1B5D9E266AD5583490EDBCABC3DB5`: **AV-AGT-002, AV-AGT-027, AV-OPS-011** 전량.
- 테스트계획 `9C288947F6F77AADDF73ED150EC449B71BE7D1981358A71EA211687B6A75D644`: §10.6 독립 세션 및 R-02 CRITICAL 설계 원문 인용.
- WI `AB305CBEC74ABC20A2EF7B21A378F80018470642F673F0409FB6774602E61B03`.
- invocation `56A7E9CF869F50B3E38E2F4150E3F2ADE5B2EDD50AC18FF1F8963EF497553A40`.

### 변경 경로·diff

제품 exact6:

1. `packages/agent_team/__init__.py`: additive external verifier exports.
2. `packages/agent_team/external_verifier.py`: ExternalVerifierAdapter, host-only ManualImportAuthorization, canonical bounded JSON bytes interchange, artifact ref/bytes 복구, CRITICAL clause/hash, current authority/secret/replay/tamper fail-closed.
3. `packages/api/external_verification.py`: framework-neutral manual export/import/project/resolve. host capture·approve·connect·launch endpoint 없음.
4. `tests/agent_team/test_external_verifier_e03.py`: backend3종, authority/target/schema/lineage/artifact/hash/expiry/replay, canonical clause, secret, alias/TOCTOU 검증.
5. `tests/api/test_external_verification_e03.py`: manual API 계약, 기본 원문 비노출, explicit resolve, payload self-authority·외부 실행 금지.
6. 본 완료보고.

control exact9:

- `docs/work_orders/E-03_WORK_INSTRUCTION.md`
- `docs/work_orders/E-03_INVOCATION_PROMPT.md`
- `docs/evidence/manifests/E-03_START_MANIFEST.json`
- `docs/progress/progress-handoff-detached-digest-e03-start.json`
- `docs/progress/build-progress.json`
- `docs/progress/progress-events.json`
- `docs/progress/BUILD_HANDOFF.md`
- `scripts/check_project_progress.py`
- `tests/tooling/test_project_progress.py`

합계 exact15. checker delta는 158줄 추가/삭제0이며 historical event seq1~1080 prefix를 보존한다. E-01/E-02 owner 제품은 additive `__init__` 외 수정하지 않았다. 기존 Release Gate EvidenceManifest도 변경하지 않았다.

### 구현 판단·검증 ID

| ID | 구현·관찰 증거 | 실행 경계 |
|---|---|---|
| AV-AGT-002 | CLAUDE/CODEX/LOCAL 동일 packet/result 전체 payload 보존·정규 schema 검증. native source provider와 manual Claude verifier provider를 별도 표시 | 실제 backend 호출 없음 |
| AV-AGT-027 | E-02 current handoff에서 원 artifact bytes/refs 검증 후 manual bundle에 포함. default projection에는 refs만, explicit resolve로 exact transcript 복구 | memory ArtifactStore fixture |
| AV-OPS-011 | 기존 DelegationPacket/permission/context/lineage 및 ResultEnvelope/evidence 불변. owner current target/fence/revoke 재사용, export/import 자체가 TaskGraph·resume·Step 상태를 변경하지 않음 | 실제 backend 교체 실행/프로세스 재시작/운영 resume는 NOT_EXECUTED |

외부 결과의 `IMPORTED_MANUAL_RESULT`는 host가 정확한 response bytes/hash를 수동 관찰한 상태다. `declared_status`를 보존하지만 `provider_authenticity=UNVERIFIED`, `accepted=false`, `state_transitions=[]`를 고정한다. 실제 원격 Claude 인증/실행 PASS·사용자 승인·설계 변경·Main acceptance로 승격하지 않는다. native Codex/Local 결과를 Claude가 수동 검토할 수 있지만 원 source backend/provider를 Claude로 재표시하지 않는다.

CRITICAL 입력은 host가 주입한 canonical 문서 bytes의 실제 SHA256과 exact heading section 원문 전체를 대조하고 clause ID/document hash/quote hash를 bundle에 결박한다. provider 연결이나 문서 자동 검색은 없다. secret 검사는 D-03 credential-key/value·URI·bounded URL decoding 검사 재사용 및 JSON whitespace escape 검사로 export/import 전 수행한다. 오류에는 실제 값이 포함되지 않는다. UTF-8 JSON bundle 최대2MiB, artifact 최대64개, 제한 설명 최대16×256 bytes이며 silent truncation은 없다.

### TDD·정확한 명령 / exit / 결과

아래 `PY`는 `D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`이며 cwd는 상기 경로다.

| 명령 | exit·실제 결과 |
|---|---|
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E03StartControlTests --tb=short` | RED1: 2 failed/618 deselected(1.75s, E03 control 없음); 최초 GREEN0: 2 passed(8.49s); 최종0: 2 passed/618 deselected(2.72s) |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_external_verifier_e03.py tests/api/test_external_verification_e03.py --tb=short` | RED1: 52 failed(2.51s, 모듈 없음); 최종 GREEN0: **64 passed(5.93s)** |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_external_verifier_e03.py tests/api/test_external_verification_e03.py --tb=short -x` | 첫 GREEN0: 52 passed(2.78s) |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_external_verifier_e03.py -k 'manual_claude or artifact_callback' --tb=short` | 보강 RED1: 2 failed/45 deselected(0.76s): source/verifier provider 혼동 및 artifact callback 후 import authority 변조. 이후 전체 focused60/64 GREEN으로 해소 |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration tests/artifacts tests/api --tb=short` | **0: 1248 passed(25.11s)** |
| `PY -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/external_verifier.py packages/api/external_verification.py tests/agent_team/test_external_verifier_e03.py tests/api/test_external_verification_e03.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` | 0: 출력 없음 |
| `PY -B scripts/check_project_progress.py` | 0: PASS sequence=1084 reporting=AUTO_CONTINUE |
| `git diff --check` | 0: 출력 없음 |

### 편집 오류·복구 (정식 제품 실패 아님)

- `E03-CONTROL-EDIT-C03-001`, incident count1. checker append 중 C03 embedded evidence 인접 구간의 의도하지 않은 삭제가 SyntaxError/diff에서 관찰됐다. 세부 도구 원인은 확정하지 않았다.
- 제품 mutation0/새 start projection 미발급 상태에서 중단하고 Main에 보고했다. Main 지시에 따라 `git show HEAD:scripts/check_project_progress.py` 원문과 대조해 해당 C03 손상 구간만 apply_patch로 복구했다. E03 추가 delta는 보존했다. reset/checkout/stash/Git write는 없었다.
- 복구 검증: C03_BEGIN~E02_BASE 역사 구간 **1,656,749 bytes 동일**, SHA256 `7b67599c4a06e32dc5267ec0f1617623fff99a4a29b3f7c0a093259416395dd5`; checker diff158 additions/0 deletions; syntax compile exit0.
- `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k 'E01StartControlTests or E02StartControlTests or E02FinalAcceptanceControlTests' --tb=short` → exit0, **9 passed/611 deselected(19.57s)**. 제품 변경 전 복구 gate 증거이며 이후 historical product freeze 테스트의 successor 재실행 합격으로 표현하지 않는다.
- 임시 syntax 실패 및 내부 TDD 실패는 정식 FAILURE_REPORT 횟수에 포함하지 않는다. 현재 E03 formal valid failure count0. incident는 HANDOFF에도 기록했다.

## 조치

- Main의 별도 독립 세션 검증에 전달한다. 제품 완료 acceptance/lease 회수는 Main 소유이며 현재 양 lease ACTIVE, seq1084 IN_PROGRESS를 유지했다.
- NOT_EXECUTED/NOT_INTEGRATED: 실제 Claude/Provider/API 자동 연결·외부 전송, 실제 manual clipboard/file UX, HTTP wiring, UI/browser, OS artifact store, DB, worker 실행, durable restart recovery, DAG/parallel, 운영 배포. tests는 in-memory fixture 계약 증거이며 실제 외부 검증 수행으로 표시하지 않는다.
- residual risk: trusted host constructor/capture seam은 운영 인증이나 암호학적 원격 provider 인증을 제공하지 않는다. E01/E02의 current registry를 읽는 in-process adapter이며 owner private 구조가 바뀌면 영향 회귀가 필요하다. 새로운 owner schema는 만들지 않았다.
- rollback: Main이 exact15 미커밋 diff와 report를 보존하고 baseline c967888 기준 E03 delta만 제거/되돌릴 수 있다. 제품/통제 scope 밖 사용자 파일·역사 event는 변경하지 않는다. 외부 side effect나 migration은 없어 별도 운영 rollback이 필요하지 않다.
- commit/push/acceptance/E-04 미수행. 완료보고 이후 최종 exact15/checker/diff-check를 다시 확인한다.

## R1 독립 REWORK 보완 — 최신 판정

### 판정

`COMPLETED` — 독립 검토 C0/I3/M0의 세 finding을 보완하고 기본 검증을 완료했다. Developer 증거일 뿐 Main acceptance가 아니며 독립 재검증이 필요하다. formal REWORK **count1**, 주 lineage `E03-SOURCE-PROVENANCE-MIX-001`, 관련 `E03-BUNDLE-TOCTOU-002`, `E03-SECRET-UNICODE-BYPASS-003`. 앞의 count0/64/1248 수치는 최초 구현 시점의 역사적 증거이며 현재 수치는 아래 표다. TDD 내부 RED를 추가 formal failure로 세지 않았다.

### 판단 이유

- R→T export가 Developer packet과 Reviewer result를 혼합하던 RED를 재현했다. 이제 E02 source role/stage에 따라 exact Developer 또는 Reviewer packet을 선택하고 source role, packet hash, result hash 및 delegation identity를 함께 결박한다. Reviewer의 permission/context/result schema provenance를 Developer 것으로 대체하지 않는다.
- 마지막 store callback에서 bundle bytes 또는 seal이 변경되어도 import가 게시되던 두 RED를 재현했다. I/O 전 immutable bytes/seal snapshot을 보존하고 모든 adapter 호출 이후 동일 snapshot, canonical handoff/source/result/manifest/recipient authority를 재검증한다. 최종 fence는 I/O·예산·audit mutation 없이 수행한다. capture/import publication과 project/resolve 모두 fail-closed이며 실패 import count0을 검증했다.
- fullwidth credential, zero-width 및 literal Unicode escape, URL-encoded fullwidth separator를 transcript/response/structured mapping에 넣은 RED를 재현했다. 검사 전용 bounded URL decoding·Unicode NFKC·format-control 거부 뒤 기존 D03 key/value 검사에 전달한다. 원문 bytes와 hash는 변환하지 않으며 오류에 marker 값이 나오지 않는다. dict key와 value를 함께 검사해 정규화 후 credential 의미도 보존한다.
- 정상 한국어/Unicode 문구와 값 없는 credential key(null/빈 문자열/list/map)는 기존 의미를 유지한다. 이전 scanner로 수락된 payload도 현재 import/API/resolve 단계에서 재검사한다. D03 owner 코드는 수정하지 않았고 해당 domain 600개 회귀가 통과했다.

### 조치·변경 경로

R1에서 수정한 파일은 제품 exact6 중 아래 4개뿐이다. control/WI/progress/HANDOFF/start manifest/digest 및 E01/E02/D03 owner 파일은 수정하지 않았다.

1. `packages/agent_team/external_verifier.py`: role-aware provenance, pure final fence, Unicode 검사.
2. `tests/agent_team/test_external_verifier_e03.py`: 각 finding/우회·legacy resolve·안전 입력 회귀.
3. `tests/api/test_external_verification_e03.py`: 이전 capture의 Unicode 값 import 차단 및 값 비노출.
4. 본 보고서: R1 근거와 최신 결과 추가.

`PY`와 cwd는 위와 동일하다. 모든 명령은 실제 로컬 실행이다.

| 정확한 명령 | exit·실제 결과 |
|---|---|
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_external_verifier_e03.py -k 'reviewer_export or adapter_callback or unicode_credentials' --tb=short` | RED **1: 17 failed, 4 passed, 51 deselected (3.84s)**; packet 불일치 및 DID NOT RAISE |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_external_verifier_e03.py -k last_store_callback --tb=short` | RED **1: 2 failed, 72 deselected (1.51s)**; 마지막 callback bytes/seal 변경 후 import 게시 |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_external_verifier_e03.py tests/api/test_external_verification_e03.py --tb=short` | 첫 GREEN **0: 87 passed (8.30s)**; 보강 후 최종 **0: 98 passed (13.49s)** |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration tests/artifacts tests/api --tb=short` | **0: 1282 passed (36.69s)** |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_sources_d03.py --tb=short` | **0: 600 passed (3.65s)** |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E03StartControlTests --tb=short` | **0: 2 passed, 618 deselected (3.17s)** |
| `PY -B scripts/check_project_progress.py` | **0: PASS sequence=1084 reporting=AUTO_CONTINUE** |
| `PY -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/external_verifier.py packages/api/external_verification.py tests/agent_team/test_external_verifier_e03.py tests/api/test_external_verification_e03.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` | **0: 출력 없음** |
| `git diff --check` | **0: 출력 없음** |

시각 `2026-09-17T10:59:09+09:00` 확인: 기존 epoch1 dual lease 만료22:23 이전이며 token/seq1084는 변경하지 않았다. 현재 dirty는 E03 기존 exact15 집합이며 새 scope를 추가하지 않았다. 원격 재호출·Git mutation·E04 실행은 없었다.

미검증/잔여 위험: 앞의 실제 Provider/Claude/HTTP/UI/OS store/DB/외부 실행/병렬 운영 NOT_EXECUTED 경계 그대로다. host in-process registry가 신뢰 경계이며 암호학적 원격 provider 인증이 아니다. Unicode format-control은 수동 bundle에서 보수적으로 거부하며 정상 값이라도 해당 control이 필요하면 별도 host 입력 검토가 필요하다. rollback은 Main이 현재 exact15 미커밋 diff를 보존한 뒤 R1의 위 4개 diff만 되돌리는 방식이며, 자동 reset/stash/삭제는 수행하지 않았다. 독립 재검증 및 최종 progress/lease 회수는 Main 소유다.

## R2 corrective revision — 최신 완료보고

### 판정

`COMPLETED` — R1 독립 spec ACCEPT C0/I0/M0, quality REWORK C0/I1/M1에 대한 R2 보완·기본 검증 완료. 동일 fingerprint `E03-SECRET-UNICODE-BYPASS-003`의 formal failure **count2**다. 세 번째 동일 유효 실패 시 기존 Main takeover 규칙을 따른다. 본 Developer 결과는 독립 acceptance가 아니다.

HEAD/branch는 `c9678884d8e44a53fc4ab7c070a2c84f29c4e481` / `codex/c09-execution-backends-r1` 그대로다. 원 seq1084에서 Main 지시에 따라 additive corrective control만 추가해 현재 **seq1086**, E03 IN_PROGRESS/R2, E04 NOT_READY, 양 lease/token 불변 ACTIVE, pending approvals empty다. 2026-09-17T11:19:44+09:00 확인 시22:23 만료 전이었다. commit/push/acceptance/E04/외부 실행은 수행하지 않았다.

### 판단 이유·수정

1. `quote('ａｐｉ＿ｋｅｙ',safe='').replace('%','％')` 조합은 NFKC가 새 percent escape를 드러내고 decode가 다시 fullwidth key를 만드는 순환이었다. 한 번의 정규화로 안전하다고 판단하지 않고 NFKC→literal escape→URL decode→NFKC를 최대4회 검사해 fixed-point를 요구한다. 이후에도 변환이 남으면 `UNSAFE_ENCODING_DEPTH`로 거부한다. format-control도 각 단계에서 거부하며 실제 bytes/hash는 수정하지 않는다.
2. JSON artifact는 bounded strict parse 후 key/value 의미를 검사한다. raw JSON 문자열 전체에 credential regex를 먼저 적용하지 않는다. null/빈 문자열/빈 list/map는 보존하고 0/false 및 nonempty nested 값은 기존 D03 의미대로 차단한다. 비JSON transcript는 계속 raw text를 검사한다.
3. 저장된 bundle도 project/resolve/current consumption 시 exact artifact bytes를 다시 검사하므로 이전 scanner가 수락한 인코딩 payload를 projection 성공으로 유지하지 않는다. API export/project/resolve 200 우회를 RED로 고정했고 이제 모두400/값 비노출이다. import와 explicit resolve에서도 같은 검사를 적용한다.
4. R1 role-aware packet/result provenance와 I/O 후 immutable snapshot/pure final authority fence는 유지했다. D03 owner 구현은 변경하지 않았다.

### 통제 revision·hash·경로

- 새 corrective WI: `docs/work_orders/E-03_R2_CORRECTIVE_WORK_INSTRUCTION.md`, SHA256 `50846FD6E0A0536D37E248CB88A0B3ECB7617D00127D64AA5484A00354E295E6`.
- 분류 `MAIN_RECONFIRMED_NON_SEMANTIC_CORRECTIVE_REWORK`, semantic_diff NONE, scope_expansion false. 기능·요구·중요위험·제품 scope·lease 변경 없음. original WI/start binding을 부모로 명시하고 파생 WI hash를 seq1086에 결박했다.
- seq1085 `PACKAGE_REWORK_REQUESTED` →1086 `WORK_INSTRUCTION_REVISED`. spec/quality 판정과 fingerprint/count2는 event/manifest/progress/HANDOFF에 결박한다. 공통 `valid_failure_count`는 기존 runtime failure-ledger 전용값0을 보존하며, 패키지 formal2는 `e03_corrective_revision.formal_failure_count`로 별도 기록했다. 이를 count0으로 해석하면 안 된다.
- seq1~1084 raw prefix **3,550,538 bytes**, SHA256 `13C33C1BF22205D7368D9038D506FD4B0E58F177B80D5290785BD61D5F206ED6` 불변. original WI/prompt hash는 위와 동일. start manifest `34A4C72A8EFC2BFC7D454554BBBF2E987B24FA720F6CD6AA95ED53853FE7B7FC`, start digest `DDF493CA0BD60B34F6C92B061BD7CFB1DF9FAEA7C970D7A5551CF0F8B6719EDF` 불변.
- 신규 exact3: 위 corrective WI, `docs/evidence/manifests/E-03_R2_CORRECTIVE_REVISION_MANIFEST.json`, `docs/progress/progress-handoff-detached-digest-e03-r2-corrective-revision.json`.
- 기존 control 수정 exact5: `scripts/check_project_progress.py`, `tests/tooling/test_project_progress.py`, `docs/progress/build-progress.json`, `docs/progress/progress-events.json`, `docs/progress/BUILD_HANDOFF.md`.
- 제품 R2 수정 exact4: `packages/agent_team/external_verifier.py`, `tests/agent_team/test_external_verifier_e03.py`, `tests/api/test_external_verification_e03.py`, 본 보고서. 그 외 제품은 변경하지 않았다.
- 총 dirty는 기존 exact15+신규3=**exact18**이며 live checker가 missing/extra/staged/wrong HEAD를 거부한다. Git stat은 untracked를 포함하지 않으므로 전체 제품 diff 수치로 오인하지 않는다.

### RED/GREEN·정확한 명령·exit

`PY=D:/tmp/anvil-main-integration/.venv/Scripts/python.exe`, cwd는 이 보고서 상단과 동일하다.

| 정확한 명령 | exit / 실제 결과 |
|---|---|
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_external_verifier_e03.py -k r2 --tb=short` | RED **1 / 15 failed, 6 passed, 83 deselected (4.86s)**; encoded credential DID NOT RAISE 및 빈 JSON 값 거부 |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/api/test_external_verification_e03.py -k r2 --tb=short` | RED **1 / 3 failed, 15 deselected (2.76s)**; export/project/resolve 200==400 실패 |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team/test_external_verifier_e03.py tests/api/test_external_verification_e03.py --tb=short` | GREEN **0 / 122 passed (9.52s)** |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/agent_team tests/orchestration tests/artifacts tests/api --tb=short` | **0 / 1306 passed (32.58s)** |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/knowledge/test_sources_d03.py --tb=short` | **0 / 600 passed (2.03s)** |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k E03R2CorrectiveControlTests --tb=short` | control RED **1 / 3 failed, 620 deselected (3.91s)**; corrective builder 미구현 |
| `PY -B -m pytest -q -p no:cacheprovider --import-mode=importlib tests/tooling/test_project_progress.py -k 'E03StartControlTests or E03R2CorrectiveControlTests' --tb=short` | 최초 **0 / 5 passed, 618 deselected (47.94s)**; materialize 후 최종 **0 / 5 passed, 618 deselected (20.96s)** |
| `PY -B scripts/check_project_progress.py` | 중간1: EVENT_EFFECT_MISMATCH/EVENT_PAYLOAD_MISSING/FAILURE_PROJECTION_MISMATCH; 정합화 후 **0 / PASS sequence=1086 reporting=AUTO_CONTINUE** |
| `PY -B -m compileall -q packages/agent_team/__init__.py packages/agent_team/external_verifier.py packages/api/external_verification.py tests/agent_team/test_external_verifier_e03.py tests/api/test_external_verification_e03.py scripts/check_project_progress.py tests/tooling/test_project_progress.py` | **0 / 출력 없음** |
| `git diff --check` | **0 / 출력 없음** |

중간 control 오류는 새 revision event의 필수 alias/projection 필드와 runtime ledger 전용 global count에 관한 내부 정합화였다. 공통 guard를 제거하지 않고 exact1086 event를 추가 결박하고 package count를 분리했다. 새 formal 제품 실패로 세지 않는다. Git status의 사용자 global ignore 접근 경고는 환경 read 권한 경계이며 검사 경로나 실제 dirty18 판정을 생략하지 않았다.

### 조치·미검증·rollback

- 독립 재검증에 반환한다. 실제 Claude/API/Provider 연결·전송, OS store/HTTP/UI/DB/worker/병렬·운영 복구는 계속 NOT_EXECUTED/NOT_INTEGRATED다. fixture 계약 PASS를 실제 외부 실행으로 승격하지 않는다.
- bounded fixed-point를 넘는 encoding과 format-control은 보수적으로 거부한다. 이는 비밀 탐지 검사 정책이며 원문 정규화 저장이나 새 D03 credential 의미를 도입하지 않는다.
- rollback: Main이 현재 exact18의 미커밋 bytes/diff와 증거를 먼저 보존한 뒤 제품 R2 delta를 제한적으로 복원할 수 있다. 이미 기록한 seq1085~1086과 역사 event/hash는 삭제·재작성하지 않고 후속 corrective event로 처리한다. 원 WI/start4개는 그대로 복구 기준이다. 자동 reset/stash/delete/commit/push는 수행하지 않았다.
