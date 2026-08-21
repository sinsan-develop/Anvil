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

`ecfbb7c` root path fix → `9388749` psycopg3 DSN → `430b6fa` migration rebuild → `6668ec4` tmpfs fix → `348131a` database network → `f806399` successor projection → `06a3a4e` public UI preview plan/spec merge

## 2026-08-22 병합 기록

- `codex/anvil-public-ui-preview`를 `main`에 충돌 없이 `--no-ff` 병합했다.
- 병합 커밋: `06a3a4e23fd3c8caa387f0fe61c35fa1ef9a9cec`
- 추가 파일: `docs/superpowers/plans/2026-08-14-anvil-public-ui-preview.md`, `docs/superpowers/specs/2026-08-14-anvil-public-ui-preview.md`
- `git diff --check` 통과, `origin/main` push 완료.

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
