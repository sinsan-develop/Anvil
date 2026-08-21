# B-12 Developer Completion Report

- Package: `B-12`
- Result: `COMPLETED`
- Status: `COMPLETED_PENDING_INDEPENDENT_TEST`
- WorkInstruction: `WI-B-12-20260821-001`, SHA-256 `C588069F8F735DF32AC908F3E2F27F9BE5D2E6E18E0C2F67CBAF36202BA4C3EE`
- Invocation SHA-256: `3E2A28FECB4E0A64FDF30BDAD8E0D3DD9546E98F84F010C95924B18D8A41D7DF`
- Start: `main=origin/main=26e2fcf1977d11c22ce81b400b3bf0696337d4ac`, clean; epoch-1 execution/write fencing and exact15 verified.

## 판정

Developer 범위는 `COMPLETED_PENDING_INDEPENDENT_TEST`다. B-12 acceptance와 Phase B Gate 판정은 Main/독립 Tester 범위이므로 수행하지 않았다.

## 판단 이유

변경 전에는 process 종료 뒤 DB/progress/HANDOFF·checkpoint·Action receipt·Secret/capability snapshot을 공통 계약으로 조정하는 모듈, persistence, migration, API adapter가 없었다. 변경 후에는 다음을 fail-closed로 처리한다.

- 완료 Action은 재실행하지 않고, 송신 전/후 미확정 Action은 `safe_retry`와 `manual_review`로 분리한다.
- DB와 두 파일 sequence 불일치는 임의 덮어쓰기 없이 `RECONCILIATION_REQUIRED`다.
- 이전 worker 또는 같은 conflict scope의 이전 write token은 `STALE_FENCING_TOKEN`으로 거부한다.
- revoked Secret은 값 읽기와 Provider 호출 전에 차단하고 reference-only audit를 남긴다.
- capability snapshot drift나 필수 capability 소실은 자동 fallback 없이 새 Run/재계획으로 보낸다.
- B-11 recovery routes는 기존 인증·scope·CSRF·idempotency·version·target hash·request-ID/error 계약을 유지하며 Secret reference를 응답하지 않는다.

TDD RED는 최초 네 모듈 부재, fresh-runtime 순환 import, fencing 입력 검증, target-hash pre-side-effect ordering, PostgreSQL same-scope stale write를 각각 실제 실패로 확인했다. GREEN은 local focused `20 passed, 1 DSN skip`, canonical B core `159 passed, 7 DSN-gated skipped`, 실제 isolated PG18 `21 passed`, FI-05/06/07 각 최소 3회, actual uvicorn 200/409/401/403, PG18 migration·hostile·concurrency·rollback으로 확인했다.

전체 tooling은 `419 passed, 4 failed`였다. 세 건은 authorized dirty exact15 때문에 발생한 `GIT_DESCENDANT_WORKTREE_DIRTY`; 한 건은 frozen A-13 copied hostile-manifest helper의 관찰 실패다. 실제 A-13/G-07/Phase G standalone checker는 PASS했고, 관련 checker/authority/progress를 수정하지 않았다. 이 네 건을 제품 PASS로 숨기거나 수정 범위를 넓히지 않았다.

## 변경 파일·영향·조치

Developer exact15만 변경했다: FastAPI recovery-port 연결 1, recovery package 5, persistence repository 1, migration 1, recovery tests 4, validation/evidence/completion 3. B-11 endpoint 목록·permission label·wire format과 B-01~B-11 도메인/persistence 의미는 변경하지 않았다.

상세 명령, exit code, HTTP/PG18/FI 증거, tooling 실패 분류와 미실행 범위는 `docs/validation/B-12_RECOVERY_VALIDATION.md`에 있다. EvidenceManifest는 exact15와 manifest 자신을 제외한 raw14 checksum, canonical target hash, `self_reference=false`를 고정한다.

잔여 위험은 실제 PC 전원 차단, 실제 메뉴/브라우저 Network, 실제 Secret Broker/Provider, shared DB, WSL staging, ysna/production/deployment가 미실행이라는 점이다. 이는 후속 Package/환경 검증 범위이며 B-12 PASS로 승격하지 않았다.

Rollback은 Main 통합 전 exact15를 시작 HEAD로 복원하는 것이다. DB rollback은 전용 환경에서만 `0010_recovery -> 0009_intervention_budget`이며 실제 검증했다. shared/production DB rollback, commit, push, B Gate, C-01은 Developer가 수행하지 않았다.
