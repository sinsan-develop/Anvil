# F-18 R42 WorkInstruction — OIDC process bootstrap

- 담당 `developer-primary`, Main 관리. 상위 F-18 WorkInstruction·승인 기준선과 R42 Plan에 종속. 서버 전용 합성 QA 신뢰 설정을 기존 OIDC factory에 연결하는 계획 범위 내 내부 구현으로 분류한다. 실제 운영 인증/Secret/certificate 계약과 Production은 변경하지 않는다.
- 시작 기준: `codex/f18-wsl-ops`, baseline `9d9bda6063887091fe154dd9cc11297e9ba9607f`, canonical seq1638 worker/write lease=null. 신규 epoch26 두 fencing token·exact4 ACTIVE lease 확인 전 제품 write 금지.
- 제품 exact4: `apps/api/anvil_api/asgi.py`, 새 `apps/api/anvil_api/oidc_process.py`, 새 `tests/api/test_oidc_process.py`, `docs/04_test_reports/F-18_WSL_OPS_REPORT.md`. Compose/Dockerfile/TLS/DB schema/실제 Secret/기존 배포 스크립트/control/progress는 수정하지 않는다.
- TDD: fail-closed OIDC process import 및 trust file/정책/Secret 경계 RED→GREEN. 기존 COOKIE/WSL/ysna ASGI 동작과 정적·동적 import 계약 보존, R41 OIDC 0019 readiness 회귀. 실패 응답·로그에 path·credential 원문 비반사. `oidc_process`가 `asgi`를 import하지 않게 하여 순환 초기화를 피한다.
- 완료 증거: 시작 HEAD/branch/status, exact4 diff, RED/GREEN 및 관련·bare 전체 pytest 명령/exit, 환경·임시 파일 잔여, 미검증, rollback, 보고서 갱신. Developer는 push·WSL·Docker·실제 issuer/Secret/certificate·control/progress를 건드리지 않는다. Main이 push·WSL QA·lease 회수와 최종 판정 소유.
