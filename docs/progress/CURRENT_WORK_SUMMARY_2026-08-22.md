# Anvil 현재 작업 요약

작성일: 2026-08-22
작성 주체: Main Agent 어울
기준 worktree: `.worktrees/ysna-internal-deploy`
기준 HEAD: `f806399`

## 공식 상태

- Phase B Gate: `TEST_REVIEW_EXACT44`
- Phase B Gate acceptance: `NOT_STARTED`
- C-01: `BLOCKED_PENDING_PHASE_B_GATE_ACCEPTANCE`
- C-21: `READY_FOR_WORK_INSTRUCTION`
- C-32: 운영 검증 successor projection 완료
- historical event sequence `1~374`와 기존 authority hash 보존
- C-32 successor projection sequence `375`

## 완료 내용

- Agent Team collaboration primitive와 orchestration 구현
- capability 기반 MoA routing 및 provider catalog 정렬
- UPSTAGE primary/default route
- 원격 제어 및 Telegram adapter 구현
- durable Telegram webhook replay/audit/rate-limit 상태 구현
- Git 기반 ysna-server 배포 스크립트·Compose·ReleaseManifest 구성
- 서버 root 경로, psycopg3 DSN, migration image rebuild, tmpfs, database network 수정
- `shared-db` 안에 Anvil 전용 `anvil` database와 `anvil_app` role 생성
- migration head `0011_telegram_webhook_state` 적용
- `anvil.sinsan.kr/integrations/telegram/webhook` 경로 연결
- Telegram `setWebhook` 성공

## 운영 검증

- `/health/live` → HTTP `200`
- `/health/ready` → HTTP `200`
- readiness migration head → `0011_telegram_webhook_state`
- 잘못된 Telegram secret 요청 → HTTP `400`
- Telegram `getWebhookInfo`: URL 확인, pending `0`, last error 없음
- 비밀값은 기록하지 않음

## 주요 커밋

`ecfbb7c` root path fix → `9388749` psycopg3 DSN → `430b6fa` migration rebuild → `6668ec4` tmpfs fix → `348131a` database network → `f806399` successor projection → `06a3a4e` public UI preview plan/spec merge → `199a02b` common API/menu plan merge

## 2026-08-22 병합 기록

- `codex/anvil-public-ui-preview`를 `main`에 충돌 없이 `--no-ff` 병합했다.
- 병합 커밋: `06a3a4e23fd3c8caa387f0fe61c35fa1ef9a9cec`
- 추가 파일: `docs/superpowers/plans/2026-08-14-anvil-public-ui-preview.md`, `docs/superpowers/specs/2026-08-14-anvil-public-ui-preview.md`
- `git diff --check` 통과, `origin/main` push 완료.

## 2026-08-22 추가 병합 기록

- `codex/anvil-public-ui-preview-impl` 검증 후 `main`에 병합했다.
- 검증: Node UI preview 6/6, 배포 계약 pytest 8/8, `node --check apps/web/server.mjs` 통과.
- 구현 병합은 `main`의 운영 코드와 배포 이력을 보존하는 3-way 병합으로 완료했다.
- `codex/anvil-plan-common-api-menu-order`는 작업계획서 충돌을 해소한 후 `199a02b`로 병합했다.
- 충돌 해소는 신산님 확정 1~7단계 생명주기를 유지하고 공통 모듈·API·Backend Capability·U-01~U-11 순서를 하위 실행 규칙으로 결합하는 방식으로 기록했다.

## 남은 문제

canonical project checker는 다음을 보고한다.

- `DETACHED_DIGEST_MISMATCH`
- `GIT_DESCENDANT_PATH_SET_MISMATCH`
- `PRG_REFERENCED_HASH_MISMATCH`

원인은 C-32 successor commit이 기존 Phase B Gate historical baseline·허용 경로와 다른 후속 작업이기 때문이다. historical event/hash를 덮어써서 checker를 녹색으로 만드는 방식은 사용하지 않았다.

Phase B Gate acceptance 전에는 C-01을 시작하지 않는다. C-32 운영 성공은 Phase B Gate acceptance나 public release 승인을 의미하지 않는다.

## 다음 안전 작업

1. C-32 successor를 인식하는 별도 governance checker 규칙과 회귀 테스트 Work Package 작성
2. historical event/hash 불변 검증
3. Phase B Gate 독립 evidence 재검토 및 Main 판정
4. Gate 수락 후 C-01 WorkInstruction 발행

## 복구

- 코드 rollback: 승인된 이전 ReleaseManifest commit으로 `deploy/ysna/rollback.sh` 실행
- C-32 문서 projection rollback: `f806399` 이전 commit으로 되돌리되 historical event는 삭제하지 않음
- 운영 DB rollback은 Anvil 전용 `anvil` database만 대상으로 하며 기존 `postgres` 및 타 제품 DB는 변경하지 않음

## 2026-08-31 최신 상태 — C-01

- 원격 `origin/main`의 Phase B Gate `ACCEPTED` 기준선(`9f306f8`)을 동기화했다.
- C-01 WorkInstruction/InvocationPrompt를 작성하고 전용 branch에서 subagent 1명이 구현했다.
- C-01 구현을 `3dcab37` 병합 커밋으로 `main`에 통합했다.
- 변경 범위: `packages/llm_gateway`, `packages/orchestration`, C-01 테스트·완료보고서·WorkInstruction.
- Main 검증: C-01 수동 계약 테스트 5/5, `compileall` PASS, `git diff --check` PASS.
- pytest는 환경 제약으로 미실행: `pytest` 모듈 미설치 및 외부 패키지 다운로드 네트워크 차단. 실제 Provider·DB·API·browser·deployment는 범위 외/미실행.
- Main 검토에서 abort 빈 output 계약 결함 1회를 발견했고 동일 subagent가 최소 수정 후 보완했다. 오류 횟수는 1회이며 3회 인수 기준 미도달.
- 현재 판정: `C-01 TEST_REVIEW / INDEPENDENT_TESTER_PENDING`; C-02는 C-01 독립 Tester `ACCEPTED` 전까지 시작하지 않는다.
- 최신 main push 전 최종 검증과 독립 Tester 재검토가 다음 조치다.

## 2026-08-31 C-01 독립 검증 및 수락

- 독립 Tester 보고서 `docs/test_reports/C-01_INDEPENDENT_TEST_REPORT.md` 판정은 `PASS`다.
- C-01 테스트 6/6, compileall, `git diff --check`, branch 조상 검증이 통과했다.
- C-01을 `ACCEPTED`로 전환하고 다음 미완료 항목 C-02 WorkInstruction 발행을 시작한다.
- 외부 Provider·DB·API·browser·deployment는 C-01 범위 외로 `NOT_EXECUTED` 상태를 유지한다.

## 2026-08-31 C-02 독립 검증 및 수락

- C-02 WorkInstruction/InvocationPrompt를 발행하고 `codex/c02-delegation-packet`에서 구현했다.
- 초기 독립 검토에서 scope conflict reason code 분류 결함 1회를 발견했다.
- 최소 수정 커밋 `3a60964` 후 독립 Tester가 `PASS` 판정했다.
- C-02 테스트 15/15, compileall, `git diff --check` 통과.
- C-02를 `3e572df` 병합 커밋으로 `main`에 통합했다.
- 외부 Provider·DB·API·browser·deployment 및 C-03 lifecycle은 `NOT_EXECUTED`/다음 Package 범위다.
- 다음 미완료 항목은 C-03이며, C-02 branch/worktree 정리 후 C-03 WorkInstruction을 발행한다.

## 2026-08-31 C-07 독립 검증 및 수락

- C-07 WorkInstruction/InvocationPrompt를 발행하고 DelegationOutcomeResolver·Step/Delegation fencing 원자 전이를 구현했다.
- 독립 검증에서 current token 검증, duplicate idempotency, invalid transition, C-06 FAILURE_REPORT 연계를 확인했다.
- 최종 독립 검증: orchestration 테스트 47/47, compileall, `git diff --check` PASS.
- C-07을 `089bc36` 병합 커밋으로 `main`에 통합했다.
- PostgreSQL outbox/repository·실제 API/browser/deployment 및 C-08 Repository Intelligence는 `NOT_EXECUTED`/다음 Package 범위다.
- 다음 미완료 항목은 C-08이며 C-07 branch/worktree 정리 후 WorkInstruction을 발행한다.

## 2026-09-01 C-09 독립 검증 및 수락

- C-09 WorkInstruction/InvocationPrompt를 발행하고 read-only ExecutionBackend registry, Tool Gateway 계약을 구현했다.
- 독립 검토에서 EOF 공백과 완료보고서 기준 HEAD 불일치 1회를 보완했다. 최종 독립 검증은 지정 테스트 6/6, compileall, `git diff --check` PASS다.
- Windows junction·WSL·Docker 실제 연결 및 운영 Git 상태는 미검증으로 유지했다.
- C-09를 `merge: C-09 execution backend` 병합 커밋으로 `main`에 통합했다. 구현 보완 최종 커밋은 `95dcac4`다.
- 다음 미완료 항목은 C-10 patch/write/execute Action과 risk·permission·egress·Secret Broker policy다.

## 2026-09-01 C-11 독립 검증 및 Main takeover 수락

- C-11 Main Agent RequestAnalysis·DAG ExecutionPlan·WorkInstruction orchestration을 구현했다.
- 독립 검증에서 동일 binding 결함이 3회 도달해 Developer를 중지하고 Main Agent가 직접 인수했다. 필수 objective/scope/risk/egress/prohibited/actions/completion 및 request-analysis/content hash 결박과 dependency-aware READY를 보완했다.
- 최종 독립 검증: planning·orchestration·repository intelligence·action policy 72 passed, compileall, `git diff --check` PASS.
- C-11을 `main`에 병합·원격 push 완료했으며, 실제 DB/API/browser/Provider/외부 실행은 미검증이다.
- 다음 미완료 항목은 C-12 failure lineage·fingerprint·유효 횟수 집계다.

## 2026-09-01 C-13 독립 검증 및 수락

- C-13 세 번째 유효 failure에서 Developer stop→lease/tool revoke→Main TakeoverPacket/audit 원자 흐름을 구현했다.
- 독립 검토에서 execution fencing token 누락 허용 1회를 보완해 MISSING/STALE 토큰을 fail-closed로 처리했다.
- 최종 독립 검증: orchestration·leases·tool gateway 61 passed, 1 skipped, compileall·`git diff --check` PASS.
- C-13을 `main`에 병합·push했으며 실제 분산 transaction/운영 lease 저장소/Docker·WSL은 미검증이다.
- 다음 미완료 항목은 C-14 G0~G3 gate·diff review·EvidenceManifest·Apply Approval이다.

## 2026-09-01 C-15 독립 검증 및 DIR-2 Hold

- C-15 synthetic Single Developer backend/API E2E를 구현하고 정상·중단/재개·거부·3회 takeover 및 validation→release→apply/discard 경로를 재현했다.
- 독립 검토에서 명시적 빈 validation/defect 기본값 치환 1회를 보완했다.
- 최종 독립 검증: C-15·orchestration·verification 73 passed, compileall, `git diff --check` PASS.
- C-15를 `main`에 병합·push 완료했다.
- Phase C canonical trigger에 도달해 `docs/04_test_reports/DIR-2_HOLD_2026-09-01.md`를 기록하고 `DIR_HOLD`로 중단했다.
- 신산님의 direction Event가 기록되기 전까지 C-16 이후 개발·subagent·제품 write·배포를 시작하지 않는다.

## 2026-09-01 DIR-2 Clear 및 C-16 재개

- 신산님의 명시 지시 `DIR-2 해제하고 계속 진행해`를 `CLEARED` direction Event로 기록했다.
- C-16 Agent Team durable collaboration primitives를 다음 작업으로 확정하고 구현을 재개한다.
- 실제 운영 Provider·DB·browser·배포 검증 경계는 계속 미검증으로 유지한다.

## 2026-09-01 C-16 독립 검증 및 수락

- C-16 Agent Team durable collaboration primitives를 구현했다: thread identity, TeamEvent, dependency graph, append-only log, mailbox/conversation projection.
- 독립 검토에서 foreign actor, parent hash, mutable payload, schema timestamp/parent binding, identity 타입 결함을 2회 보완했다.
- 최종 독립 검증: 전용 48 passed, 관련 회귀 116 passed, compileall·`git diff --check` PASS.
- C-16을 `main`에 병합·push했으며 실제 provider/DB/API/browser/Telegram/deployment는 미검증이다.
- 다음 미완료 항목은 C-17 Team orchestration·peer communication·협업 E2E다.

## 2026-09-01 C-17 독립 검증 및 Main takeover 수락

- C-17 leader/teammate lifecycle, task claim, peer/user messaging, peer review/hooks, pause/resume, write conflict/stale/cost guard와 협업 E2E를 구현했다.
- 독립 검토에서 event subject/session 결박과 conflicting duplicate replay 결함이 3회 누적되어 Main Agent가 인수·보완했다.
- 최종 독립 검증: agent_team 52 passed, 관련 회귀 122 passed·1 skipped, compileall·`git diff --check` PASS.
- C-17을 `main`에 병합·push했으며 실제 provider/DB/API/browser/Telegram/Docker/WSL/deployment는 미검증이다.
- 다음 미완료 항목은 C-18 Capability-based MoA Provider/Model routing이다.

## 2026-09-01 C-18 독립 검증 및 수락

- CapabilityProfile·ProviderModelCatalog·CapabilityRouter·FallbackPolicy·RoutingProvenance와 benchmark/drift 검증을 구현했다.
- 독립 검토에서 primary cost·attempt semantics·future/naive/non-UTC timestamp 경계 결함을 2회 보완했다.
- 최종 독립 검증: C-18 13 passed, 관련 agent_team/orchestration/execution 125 passed, compileall·`git diff --check` PASS.
- C-18을 `2845f8d` 병합 커밋으로 `main`에 통합했다. 실제 provider/API/key/network/DB/browser/Docker/WSL/deployment는 미검증이다.
- 다음 미완료 항목은 C-19 Remote Control Plane·Web Console/PWA다.

## 2026-09-01 C-19 독립 검증 및 수락

- Event/command/audit 계약, cursor 재생, artifact·diff reference, offline `PENDING_REMOTE`/`READY_TO_SYNC`, fencing 및 고위험 승인 경계를 구현했다.
- 독립 검토 2회 보완 후 고위험 subject hash 필수화, 승인자·단일 상태 전이·immutable audit, conversation/thread별 sequence를 확정했다.
- 최종 독립 검증: C-19 도메인 테스트 PASS, `tests/agent_team/test_remote_control.py` 9 passed, compileall·`git diff --check` PASS.
- C-19를 `main`에 병합했다. 실제 SSE/WebSocket/DB/browser/provider/Telegram/deployment는 미검증이며 Python 런타임 경계는 별도 기록했다.
- 다음 미완료 항목은 C-20 Telegram Notification/Command Adapter다.

## 2026-09-01 C-20 독립 검증 및 수락

- Telegram 보조 Adapter에 canonical HMAC, allowlist, UTC/expiry/future 검증, nonce·command replay 방지, actor/device/session audit, 안전한 Web Console deep link를 구현했다.
- 고위험 명령은 실행하지 않고 ApprovalRequest와 승인 링크만 반환하며 secret 노출을 차단했다.
- 독립 검토 최종 PASS(커밋 `8866269`), `git diff --check` PASS. 기본 Python 및 오프라인 의존성 부족으로 pytest/compileall은 미검증이다.
- C-20을 `main`에 병합했다. 실제 Telegram webhook/DB/browser/provider/deployment는 미검증이다.
- C-16~C-20 successor 구현 범위를 완료했으며 다음은 전체 통합·브라우저·운영 검증 및 매뉴얼이다.

## 2026-09-01 C-21 운영 검증 — 부분 완료/환경 차단

- Node 브라우저 계약 14/14 및 `git diff --check`는 PASS했다.
- Python 3 미설치, WSL `E_ACCESSDENIED`, `ysna-server` SSH/DNS 실패, `anvil.sinsan.kr` 443 연결 실패로 실제 DB·API·SSE·Provider·Telegram webhook 운영 증거는 수집하지 못했다.
- 외부 변경·배포·webhook 변경·Provider 과금 호출은 수행하지 않았다. 상세 증거는 `docs/04_test_reports/C-21_OPERATIONAL_VALIDATION_REPORT.md`에 기록했다.
- C-21 판정은 `PARTIAL / OPERATIONAL_BOUNDARY_NOT_VERIFIED`이며, 검증 환경 복구 후 재실행이 필요하다.

### C-21 환경 재확인

- 새 작업 턴에서 `py -3`, `wsl.exe -l -v`, `ssh ysna-server`, `curl https://anvil.sinsan.kr`를 재실행했으나 Python 미설치, WSL `E_ACCESSDENIED`, SSH hostname 해석 실패, HTTPS 443 연결 실패가 동일하게 재현됐다.
- 따라서 실제 운영 경계는 계속 `NOT_EXECUTED`이며, 환경 복구 전 C-21 완료 승격을 보류한다.

### C-21 번들 런타임 재검증

- bundled Python/Node로 `tests/agent_team` 63 passed, `apps/web/tests/*.mjs` 14 passed, compileall·diff-check PASS를 확인했다.
- FastAPI/SQLAlchemy 기반 API·DB 테스트는 bundled 의존성 부재로 collection 미실행이며, WSL/SSH/HTTPS 운영 경계는 계속 차단 상태다.

### C-21 프로젝트 venv 재검증

- 프로젝트 `.venv`로 API·persistence fixture 16 passed, agent_team 63 passed, 브라우저 계약 14 passed, compileall·diff-check PASS를 확인했다.
- 전체 suite는 기존 yaml/fixture import 및 중복 모듈명으로 7개 collection error가 발생해 전체 통합 검증은 미완료로 유지한다.

### C-21 WSL/Docker 재검증

- 권한 승격 WSL에서 Docker Server 29.1.3와 실행 컨테이너를 확인했다.
- `local-postgres`는 실행 중이나 Anvil 전용 `shared-db`와 `anvil` database는 확인되지 않아 실제 Anvil persistence는 미검증이다.
- WSL gateway checkout의 기존 `?? .env` dirty는 변경하지 않고 보존했다.

## 2026-08-31 C-06 독립 검증 및 수락

- C-06 WorkInstruction/InvocationPrompt를 발행하고 정식 `FAILURE_REPORT` fail-closed validator를 구현했다.
- 독립 검증은 필수 실패 필드·lineage/fingerprint·evidence·환경/권한/quota 제외 로직과 C-05 연계를 확인했다.
- 최종 독립 검증: C-06/C-05 15/15, orchestration/execution 회귀 54/54, compileall, `git diff --check` PASS.
- 완료 보고서 기준 HEAD를 `3369196`으로 정합화했다.
- C-06을 `5025bc0` 병합 커밋으로 `main`에 통합했다.
- 실제 subprocess·Provider·DB·API·browser·deployment 및 C-07 집계/takeover는 `NOT_EXECUTED`다.
- 다음 미완료 항목은 C-07이며 C-06 branch/worktree 정리 후 WorkInstruction을 발행한다.

## 2026-08-31 C-05 독립 검증 및 수락

- C-05 WorkInstruction/InvocationPrompt를 발행하고 `subagent_result/v1` Result Envelope·fail-closed validator를 구현했다.
- 독립 검토에서 evidence 필드 원시 타입 강제변환과 unknown field reason code 불일치 1회를 발견했고 strict 검증·`UNKNOWN_FIELD` 회귀로 수정했다.
- 최종 독립 검증: C-05 테스트 7/7, compileall, `git diff --check` PASS.
- C-05를 `790f122` 병합 커밋으로 `main`에 통합했다.
- 실제 Provider·DB·API·browser·deployment 및 C-06 집계는 `NOT_EXECUTED`/다음 Package 범위다.
- 다음 미완료 항목은 C-06이며 C-05 branch/worktree 정리 후 WorkInstruction을 발행한다.

## 2026-08-31 C-04 독립 검증 및 수락

- C-04 WorkInstruction/InvocationPrompt를 발행하고 steer·pause/resume·current·handoff projection을 구현했다.
- 독립 검토에서 checkpoint handoff identity 누락 1회를 발견했고 `session_id·delegation_id·packet_hash` 결박 및 mismatch 회귀 테스트로 수정했다.
- 최종 독립 검증: orchestration 테스트 28/28, compileall, `git diff --check` PASS.
- C-04를 `b6bbe1e` 병합 커밋으로 `main`에 통합했다.
- 실제 subprocess·Provider·DB·API·browser·deployment는 C-04 범위 외로 `NOT_EXECUTED`다.
- 다음 미완료 항목은 C-05이며 C-04 branch/worktree 정리 후 WorkInstruction을 발행한다.

## 2026-08-31 C-03 독립 검증 및 수락

- C-03 WorkInstruction/InvocationPrompt를 발행하고 read-only Developer lifecycle을 구현했다.
- 독립 검토에서 중첩 raw payload 변환 오류 1회를 발견했고 `_thaw()` 재귀 변환 및 회귀 테스트로 수정했다.
- 최종 독립 검증: orchestration 테스트 22/22, compileall, `git diff --check` PASS.
- 완료 보고서 HEAD 정합성을 `8694fc5`로 갱신했다.
- C-03을 `d995320` 병합 커밋으로 `main`에 통합했다.
- 실제 subprocess·Provider·DB·API·browser·deployment는 C-03 범위 외로 `NOT_EXECUTED`다.
- 다음 미완료 항목은 C-04이며 C-03 branch/worktree 정리 후 WorkInstruction을 발행한다.

## 2026-09-01 C-08 독립 검증 및 수락

- C-08 WorkInstruction/InvocationPrompt를 발행하고 Repository Intelligence를 symbol·dependency·test·impact 인덱스로 확장했다.
- 독립 검토에서 내부 symlink, Python unresolved import, require 상대경로, 참조/impact 및 ScanResult schema 노출 결함을 2회 보완했다. 유효 실패 횟수는 2회이며 3회 인수 조건에는 도달하지 않았다.
- 최종 독립 검증: 신규 Repository Intelligence 4/4, compileall, `git diff --check` PASS.
- 관련 A13 테스트는 60개 중 53개 통과, 7개는 C-08 변경과 무관한 기존 evidence/projection baseline 불일치로 미검증 잔여 위험에 기록했다.
- C-08을 `merge: C-08 repository intelligence` 병합 커밋으로 `main`에 통합했다. 구현 커밋은 `4e2dc79`다.
- 실제 Provider·DB·API·browser·deployment 및 운영 성능은 `NOT_EXECUTED`다.
- 다음 미완료 항목은 C-09 Git worktree·Docker ExecutionBackend 및 cross-backend path identity·read Tool Gateway다.

## 2026-09-01 C-10 독립 검증 및 수락

- C-10 Action policy와 structured receipt를 구현해 fencing/path/egress/secret/destructive/metadata/redirect/DNS rebinding 경계를 fail-closed로 적용했다.
- 독립 검토에서 DNS rebinding 및 private/link-local metadata 주소 누락 1회를 보완했다.
- 최종 독립 검증: action policy·tool gateway·repository·API·orchestration 90 passed, compileall, `git diff --check` PASS.
- C-10을 `merge: C-10 action policy` 병합 커밋으로 `main`에 통합했다. 최종 구현 커밋은 `df4f726`이다.
- 실제 secret manager·네트워크·DB·browser·deployment는 미검증이다.
- 다음 미완료 항목은 C-11 Main Agent Task 분석·ExecutionPlan·WorkInstruction orchestration이다.

## 2026-09-01 C-12 독립 검증 및 수락

- C-12 valid FAILURE_REPORT lineage/fingerprint ledger를 구현하고 invalid·환경성 보고 제외, replay idempotency, 3회 takeover 후보 신호를 검증했다.
- 독립 검증: C-12 5/5, orchestration 52/52, compileall, `git diff --check` PASS.
- C-12를 `main`에 병합·push했으며 실제 lease/tool 회수는 C-13 범위로 미실행이다.
- 다음 미완료 항목은 C-13 세 번째 실패의 lease·tool 회수와 Main 직접 인수다.

## 2026-09-01 C-14 독립 검증 및 수락

- C-14 G0~G3 gate engine, EvidenceManifest, ReleaseDecision/Apply Approval을 구현했다.
- 독립 검토에서 gate target hash 결박·외부 위조 결정·path traversal 결함 1회를 보완했다.
- 최종 독립 검증: 신규 8개 및 verification/orchestration 회귀 65개 통과, compileall·`git diff --check` PASS.
- C-14를 `main`에 병합·push했으며 실제 DB/API/browser/provider/Docker/WSL/deployment/분산 persistence는 미검증이다.
- 다음 미완료 항목은 C-15 실제 fixture 전체 Single Developer backend/API E2E다.

## 2026-09-01 C-21 HTTPS 재검증 추가

- 권한 승격 HTTPS에서 `anvil.sinsan.kr` 응답과 `/integrations/telegram/webhook`의 `POST` 전용 경로를 확인했다.
- health 경로는 404이고 Anvil `shared-db`/운영 API 컨테이너가 없어 C-21 운영 PASS로 승격하지 않는다. CSP/HSTS 등 보안 응답 헤더는 확인했다.

### C-21 재개 턴 운영망 재확인

- 공개 root는 200 정적 `Anvil · UI Preview`, webhook 경로는 POST 전용 405, health/OpenAPI/docs/API 경로는 404였다.
- WSL/Docker에는 기존 PostgreSQL만 있고 Anvil API/`shared-db`가 없어 운영 persistence/API 검증은 계속 미완료다.

### C-21 WSL Anvil checkout 확인

- `/home/daon/deploy/anvil`은 존재하지만 dirty·구버전 checkout(`0f48346`)이며 `docker-compose.local.yml`이 `services: {}`인 예약 파일이다.
- 실행 가능한 Anvil API/DB를 임의 기동·수정·배포하지 않았고 C-21 운영 PASS로 승격하지 않는다.
