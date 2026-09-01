# C-21 운영검증 정합성 재판정 — 2026-09-01

## 판정

`PARTIAL / OPERATIONAL_BOUNDARY_NOT_VERIFIED`를 유지한다. 기존 C-21 보고서의 환경 차단 기록은 현재 ysna-server 배포 증거로 일부 해소되었지만, 완료조건 4~5의 실제 Provider·Telegram 검증과 인증된 SSE 재연결 검증은 남아 있다. C-21을 `ACCEPTED`로 올리거나 다음 계획 Package를 자동 시작할 근거는 없다.

## 기준선 및 현재 상태

- 검증 worktree: `ysna-internal-deploy`
- branch/HEAD: `main` / `f6bbded5c7ffdf8dd6fe67505afb0fe9d6ac278d`
- upstream: `origin/main`과 동일
- 시작 `git status`: `main...origin/main` (제품 변경 없음)
- C-21 WorkInstruction: `docs/work_orders/C-21_WORK_INSTRUCTION.md`
- 기존 원본 보고서: `docs/04_test_reports/C-21_OPERATIONAL_VALIDATION_REPORT.md`
- 최신 배포·공개 경로 증거: `docs/progress/ANVIL_WEB_UNIFIED_API_REPORT.md`
- 최신 공개 Host 보안 증거: `docs/progress/PUBLIC_HOST_SECURITY_FIX_REPORT.md`
- 계획 projection: `docs/progress/build-progress.json`은 `B-01~B-12=ACCEPTED`, `next_work_package=C-01 READY_FOR_WORK_INSTRUCTION`, successor `C-21=READY_FOR_WORK_INSTRUCTION`으로 남아 있다.

## C-21 완료조건별 대조

| 완료조건 | 현재 판정 | 근거 및 남은 범위 |
|---|---|---|
| 1. commit/manifest/hash 계보와 서비스 health | `PARTIAL/PASS 범위 제한` | `f6bbded`에 공개 배포 tag `anvil-ui-preview-20260901.5`, `anvil-web` healthy, `/health/live=200`, `/openapi.json=200` 및 `/api/runs/run-1/events=401`이 기록되어 있다. 전체 C-21 EvidenceManifest와 서비스별 이미지·migration 계보의 단일 manifest 결박은 추가 정리 필요하다. |
| 2. PostgreSQL persistence/event/audit/replay | `PARTIAL` | ysna-server `shared-db`의 `anvil` DB와 webhook 상태 테이블 및 migration head `0011_telegram_webhook_state`는 확인됐다. 현재 행 수는 0이므로 read-only identity/schema 확인만 PASS다. 실제 insert→idempotent replay→audit side effect는 미실행이다. |
| 3. same-origin/SSE/Last-Event-ID/secret 비노출 | `PARTIAL` | 공개 health/OpenAPI와 unauthenticated API `401`로 public Host 경로는 확인됐다. 인증된 SSE 수신·재연결·`Last-Event-ID`·브라우저 Network 검증은 미완료다. |
| 4. Provider routing/capability/drift | `NOT_EXECUTED` | 9개 Provider routing 계약은 코드·설계에 있으나 credential 값 비노출 상태 확인만 가능하다. 실제 non-billing capability/health probe와 drift 판정은 실행하지 않았다. |
| 5. Telegram allowlist/secret/replay/audit/high-risk rejection | `NOT_EXECUTED` | webhook 경로와 POST method 존재는 확인됐으나 signed POST, allowlist, replay rejection, audit row 및 고위험 거부는 실행하지 않았다. |
| 6. 실패·미검증 정직성 및 안전 경계 | `PASS` | C-21 검증 중 운영 DB write, webhook 변경, Provider 호출, schema migration/downgrade는 수행하지 않았다. 별도 승인으로 수행된 배포는 최신 배포 보고서에 분리 기록하며 C-21 검증 PASS로 과대계상하지 않는다. |

## 이미 해소된 항목

1. 초기 `ysna-server`/Docker/Anvil API 부재 판정은 최신 운영 증거에서 해소됐다: `anvil-internal-web-1`, `shared-db`, migration head, 내부 health/OpenAPI가 확인됐다.
2. `anvil.sinsan.kr` 공개 TLS/Proxy Host 및 `anvil-web:3770` 경로는 배포 후 health/OpenAPI/인증 응답으로 확인됐다.
3. 공개 API의 `HOST_VALIDATION_FAILED`는 Host 보존 수정 배포 후 `401 AUTHENTICATION_REQUIRED`로 바뀌어 Host 검증 경계를 통과한다.

## 승인 필요한 외부 작업

다음은 코드 문제가 아니라 실제 외부 경계에 대한 별도 실행 승인 또는 인증 세션이 필요하다.

1. 테스트용 Telegram signed POST 1회: DB 감사 행과 replay/idempotency side effect를 생성한다. 실행 전 test payload·보존/정리 결정을 확정해야 한다.
2. Provider non-billing capability/health probe: 현재 등록된 key를 출력하지 않고 각 Provider endpoint에 최소 호출을 수행할 수 있어야 한다. 비용·rate-limit·외부 전송 범위가 승인되어야 한다.
3. 인증된 운영 브라우저/SSE 검증: 승인된 사용자 세션 또는 test token으로 실제 Network, SSE, reconnect, `Last-Event-ID`를 확인한다.

## 다음 WorkInstruction

`WI-C-21-OPS-R2`를 발행한다. 범위는 (a) 위 3개 외부 경계의 승인된 최소 probe, (b) 각 결과의 EvidenceManifest 결박, (c) 테스트 데이터 정리 또는 보존 결정 기록으로 한정한다. 배포·schema 변경·credential 출력·Provider 모델 변경은 범위에 포함하지 않는다. R2 결과가 독립 검증되기 전에는 C-01 또는 Provider UI 구현을 시작하지 않는다.

## 오류·미검증 기록

- 이전 환경의 Python/WSL/SSH 차단은 최신 권한 승격 운영 증거로 일부 해소됐으나, 해당 과거 실패는 삭제하지 않는다.
- 현재 미검증: 인증된 SSE/Last-Event-ID, 실제 DB mutation/replay/audit, 9 Provider capability/drift, Telegram signed POST/allowlist/replay/audit, 전체 EvidenceManifest.
- 제품 코드 변경: 0. 이 문서는 검증·상태 기록만 추가한다.
