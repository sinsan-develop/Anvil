# WorkInstruction — F-20/U-01 R28 브라우저 증거 계약 보정

- 담당: `developer-primary-f20-u01-r28`. Main이 R27 epoch41 두 lease 회수, R28 epoch42 worker/write dual lease ACTIVE, 기존 branch/private Git/WSL-server 동일 checkpoint 및 두 신규 fencing token을 확인한 뒤 단일 writer로 착수한다.
- 기준: `docs/04_test_reports/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_PLAN.md`, 설계서 §29.2, 작업계획서 U-01, 테스트계획서 §10.8, R27 결과보고서. dispatch 때 이 계획/WI/Invocation SHA-256을 제공한다.
- 분류: 기존 R27 실제 검증에서 발견된 내부 증거 계약 누락 보정. 기능 범위·요구사항·중요 위험, 공개 API·DB/schema·auth/Secret 계약 변경 없음.

## allowed_paths 정확히 2개

1. `tests/integration/test_f20_u01_oidc_browser_pg15.py`: 신규 R27 Node evidence key·값을 별도 엄격 helper와 테스트로 검증한다. 기존 R6/R23~R26 exact expected·Secret/Network·artifact 검사 약화 금지. 누락/오류/여분 key의 negative RED를 먼저 증명한다.
2. `docs/04_test_reports/F-20_U01_R28_BROWSER_EVIDENCE_CONTRACT_RESULT.md`: 시작 HEAD/status/hash/lease, RED→GREEN 명령·exit·diff·미검증·rollback·Main 인계를 기록한다.

## 검증·금지·인계

- Python 비 opt-in 전체, Node console·browser 문법/`--audit-self-test`, typecheck/lint/build, G-05, diff check를 수행한다. 임시자원은 사전 기록한 정확한 경로만 정리한다.
- Main은 exact2 독립 검토·기존 branch commit/private push와 WSL-server 동일 clean SHA 격리 PG15/OIDC/HTTPS/Chromium 실제 opt-in·PNG/Network 검토·전용 자원 잔여0을 담당한다.
- Developer는 progress/HANDOFF/WORK_STATUS/control, Git commit/push, WSL-server/Docker/DB, 새 branch/main, ysna/Production을 변경하지 않는다. 결과 상태는 `COMPLETED | FAILURE_REPORT | INCOMPLETE | BLOCKED | CANCELLED` 중 하나다.
