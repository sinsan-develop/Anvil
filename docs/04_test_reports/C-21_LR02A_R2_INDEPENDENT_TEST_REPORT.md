# C-21 / LR-02A R2 independent test report

## 판정

`FAILURE_REPORT` — fingerprint `LR02A_CANONICAL_DEPLOY_CONTRACT_NONEXECUTABLE_R1`의 동일 계보 2차 유효 실패다. Blocking finding은 3건이며 R3 재작업이 필요하다.

## 7개 finding 재판정

1. `BOOTSTRAP_DEPLOY_ROOT_MISMATCH`: PASS. `ANVIL_DEPLOY_ROOT` 전달과 bootstrap 실행형 harness를 확인했다.
2. `CANONICAL_SCRIPT_ROOT_AND_GUARD_ARGUMENT_MISMATCH`: PASS. verify/rollback root와 manifest guard 인자 순서를 확인했다.
3. `FRESH_IMAGE_PRECHECK_AND_0013_RERUN_REJECTED`: 정적 구현 PASS, 실행형 증거 FAIL. build-before-current와 0012 upgrade/0013 no-op/기타 fail-closed 분기는 있으나 canonical `deploy.sh` 실행형 harness가 없다.
4. `ROLLBACK_BASELINE_NOT_DURABLE`: FAIL. target checkout 전에 old checkout의 `compose.production.yml`을 복사하며, 기준선 `e57f008`에는 이 파일이 없어 최초 canonical 전환이 `set -e`에서 중단된다.
5. `CANONICAL_VERIFY_FALSE_POSITIVE`: FAIL. `/api/`, GET `/integrations/`, GET `/auth/`, `/api/events`는 실제 canonical 계약과 다르다. `/auth/session` 발급, cookie, 허용 run ID, `/api/runs/{id}/events`, `Last-Event-ID`, `text/event-stream` 검증이 없다. deploy/verify/rollback 실행형 harness도 없다.
6. `LR01_FROZEN_REPORT_OVERWRITTEN`: PASS. SHA-256 `F3FB0C564BBE4D3E571529A2577B852BC87727531354FE69C04D192AF7F3B0EB`.
7. `DRAFT_APPROVAL_STATE_CONTRADICTION`: PASS. 승인 상태는 일관되게 NOT_APPROVED다.

## 독립 검증

- deploy-focused: `38 passed in 59.84s`
- 전체 API: `84 passed in 6.44s`
- progress tooling: `83 passed in 26.71s`
- progress checker: `PASS sequence=407 reporting=AUTO_CONTINUE`
- shell syntax, DRAFT JSON, `git diff --check`: PASS
- seq1~401 immutable prefix: PASS
- exact11 밖 R2 신규 mutation: 없음

## 미검증과 조치

Docker, SSH, DB, NPM, Telegram, Provider, 브라우저, 운영 배포는 실행하지 않았다. R3에서는 target commit에서 rollback assets를 추출하고, canonical deploy/verify/rollback 실행형 fake-command harness를 추가하며, 실제 method와 canonical endpoint 및 인증 session/cookie/run-id/Last-Event-ID를 검증해야 한다.
