# C-30 WorkInstruction — formal integration and E2E readiness

## 목적

C-22~C-29 공통 모듈과 UI/BFF 계약을 local unit/contract/integration 검증으로 묶고, WSL formal DB/container/entity/E2E 실행을 위한 증거·rollback·Release readiness를 준비한다.

## 허용 범위

- local full contract/integration regression과 route/UI trace checks
- WSL formal DB/container/entity/E2E 명령·환경 preflight·결과 기록
- parent/child trace, evidence/deploy-readiness projection, document matrix sync
- 외부 Provider/Telegram/Kakao/Oracle/production deploy는 실행하지 않음
- WSL/DB mutation·배포는 별도 실행 안전 승인과 환경 조건 확인 후에만 수행

## exact write scope

1. tests/integration/test_c30_console_e2e.py
2. tests/integration/test_c30_contract_matrix.py
3. tests/deploy/test_c30_wsl_formal_preflight.py
4. docs/04_test_reports/C-30_COMPLETION_REPORT.md
5. docs/evidence/manifests/C-30_EVIDENCE_MANIFEST.json
6. docs/progress/BUILD_HANDOFF.md
7. docs/progress/build-progress.json
8. docs/progress/progress-events.json

## 완료 조건

local tests와 preflight를 실행하고, WSL formal DB/container/entity/E2E가 실행되지 못하면 정확히 `NOT_EXECUTED/NOT_INTEGRATED`로 기록한다. 독립 review C/I findings, matrix/document sync, compile/diff-check, rollback을 남긴다.
